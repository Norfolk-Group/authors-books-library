import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { authorProfiles } from "../drizzle/schema";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthorInfo {
  bio: string;
  websiteUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
}

// ── LLM enrichment ────────────────────────────────────────────────────────────
async function enrichAuthorViaLLM(authorName: string): Promise<AuthorInfo> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant with deep knowledge of business authors, thought leaders, and academics. Return accurate, factual information only. For URLs, only include real, verified URLs that you are highly confident exist.",
      },
      {
        role: "user",
        content: `Provide information about the author "${authorName}". Return a JSON object with these exact fields:
- bio: A 2-3 sentence professional biography (focus on their main field, notable works, and impact). Keep it under 250 characters.
- websiteUrl: Their official personal or author website URL (e.g., adamgrant.net). Empty string if unknown.
- twitterUrl: Their Twitter/X profile URL (e.g., https://twitter.com/AdamMGrant). Empty string if unknown.
- linkedinUrl: Their LinkedIn profile URL. Empty string if unknown.

Return ONLY valid JSON, no markdown, no explanation.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "author_info",
        strict: true,
        schema: {
          type: "object",
          properties: {
            bio: { type: "string", description: "2-3 sentence professional biography" },
            websiteUrl: { type: "string", description: "Official website URL or empty string" },
            twitterUrl: { type: "string", description: "Twitter/X profile URL or empty string" },
            linkedinUrl: { type: "string", description: "LinkedIn profile URL or empty string" },
          },
          required: ["bio", "websiteUrl", "twitterUrl", "linkedinUrl"],
          additionalProperties: false,
        },
      },
    },
  });

  // response_format content is always a string
  const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
  try {
    const parsed = JSON.parse(content) as Partial<AuthorInfo>;
    return {
      bio: parsed.bio ?? "",
      websiteUrl: parsed.websiteUrl ?? "",
      twitterUrl: parsed.twitterUrl ?? "",
      linkedinUrl: parsed.linkedinUrl ?? "",
    };
  } catch {
    return { bio: "", websiteUrl: "", twitterUrl: "", linkedinUrl: "" };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const authorProfilesRouter = router({
  /** Get a single author profile by base name */
  get: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Get multiple author profiles by name list */
  getMany: publicProcedure
    .input(z.object({ authorNames: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.authorNames.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(authorProfiles);
      const nameSet = new Set(input.authorNames);
      return rows.filter((r) => nameSet.has(r.authorName));
    }),

  /** Enrich a single author via LLM and upsert into DB */
  enrich: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, cached: false, profile: null };

      // Check if already enriched recently (within 30 days)
      const existing = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
        return { success: true, cached: true, profile: existing[0] };
      }

      // Enrich via LLM
      const info = await enrichAuthorViaLLM(input.authorName);
      const now = new Date();

      if (existing[0]) {
        await db
          .update(authorProfiles)
          .set({ ...info, enrichedAt: now })
          .where(eq(authorProfiles.authorName, input.authorName));
      } else {
        await db.insert(authorProfiles).values({
          authorName: input.authorName,
          ...info,
          enrichedAt: now,
        });
      }

      const updated = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      return { success: true, cached: false, profile: updated[0] ?? null };
    }),

  /** Batch enrich a list of authors (up to 20 at a time to avoid timeout) */
  enrichBatch: publicProcedure
    .input(z.object({ authorNames: z.array(z.string()).max(20) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0, succeeded: 0 };

      const results: Array<{ authorName: string; success: boolean }> = [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const authorName of input.authorNames) {
        try {
          const existing = await db
            .select()
            .from(authorProfiles)
            .where(eq(authorProfiles.authorName, authorName))
            .limit(1);

          if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
            results.push({ authorName, success: true });
            continue;
          }

          const info = await enrichAuthorViaLLM(authorName);
          const now = new Date();

          if (existing[0]) {
            await db
              .update(authorProfiles)
              .set({ ...info, enrichedAt: now })
              .where(eq(authorProfiles.authorName, authorName));
          } else {
            await db.insert(authorProfiles).values({ authorName, ...info, enrichedAt: now });
          }
          results.push({ authorName, success: true });
        } catch {
          results.push({ authorName, success: false });
        }
      }

      return {
        results,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
      };
    }),
});
