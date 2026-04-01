/**
 * ragPipeline.router.ts
 *
 * Digital Me RAG (Retrieval-Augmented Generation) pipeline.
 * Synthesizes all available author data into a structured persona knowledge file
 * stored in S3 — used as the system prompt for the author impersonation chatbot.
 *
 * Pipeline: N+1 LLM calls
 *   - N calls: one per content item to extract key insights
 *   - 1 final synthesis call: produces the full RAG Markdown file
 *
 * Default model: claude-opus-4-5 (complex synthesis)
 * Fallback model: gemini-2.5-pro
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, authorRagProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { logger } from "../lib/logger";

// ── Default model: Claude Opus ────────────────────────────────────────────────
const DEFAULT_RAG_MODEL = "claude-opus-4-5";
const FALLBACK_RAG_MODEL = "gemini-2.5-pro";

// ── RAG File Builder ──────────────────────────────────────────────────────────

interface AuthorData {
  authorName: string;
  bio: string | null;
  richBioJson: string | null;
  geographyJson: string | null;
  historicalContextJson: string | null;
  familyJson: string | null;
  associationsJson: string | null;
  formativeExperiencesJson: string | null;
  authorDescriptionJson: string | null;
  socialStatsJson: string | null;
  businessProfileJson: string | null;
  professionalEntriesJson: string | null;
}

interface BookData {
  bookTitle: string;
  authorName: string | null;
  summary: string | null;
  keyThemes: string | null;
  richSummaryJson: string | null;
}

async function extractBookInsights(
  book: BookData,
  authorName: string,
  model: string
): Promise<string> {
  try {
    const richSummary = book.richSummaryJson ? JSON.parse(book.richSummaryJson) : null;
    const summaryText = richSummary?.fullSummary ?? book.summary ?? "";
    const themes = book.keyThemes ?? "";

    if (!summaryText && !themes) {
      return `**${book.bookTitle}**: No summary available.`;
    }

    const response = await invokeLLM({
      model,
      messages: [
        {
          role: "system",
          content: `You are extracting key insights from a book for an author persona knowledge file. Be concise and specific. Focus on ideas, voice, and themes that reveal the author's thinking.`,
        },
        {
          role: "user",
          content: `Book: "${book.bookTitle}" by ${authorName}

Summary: ${summaryText}
Key Themes: ${themes}
${richSummary?.keyInsights ? `Key Insights: ${richSummary.keyInsights.join("; ")}` : ""}
${richSummary?.notableQuotes ? `Notable Quotes: ${richSummary.notableQuotes.slice(0, 3).join(" | ")}` : ""}

Extract in 3–5 sentences:
1. The central argument or thesis of this book
2. The author's emotional register and rhetorical approach in this work
3. 2–3 signature ideas or frameworks introduced
4. How this book fits into the author's broader intellectual arc`,
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    return `**${book.bookTitle}** (${book.authorName ?? authorName})\n${text.trim()}`;
  } catch (err) {
    logger.warn(`[ragPipeline] Book insight extraction failed for "${book.bookTitle}":`, err);
    return `**${book.bookTitle}**: ${book.summary ?? "No summary available."}`;
  }
}

async function synthesizeRagFile(
  author: AuthorData,
  bookInsights: string[],
  model: string
): Promise<string> {
  // Parse all JSON fields
  const richBio = author.richBioJson ? JSON.parse(author.richBioJson) : null;
  const geography = author.geographyJson ? JSON.parse(author.geographyJson) : null;
  const historical = author.historicalContextJson ? JSON.parse(author.historicalContextJson) : null;
  const family = author.familyJson ? JSON.parse(author.familyJson) : null;
  const associations = author.associationsJson ? JSON.parse(author.associationsJson) : null;
  const formativeExp = author.formativeExperiencesJson ? JSON.parse(author.formativeExperiencesJson) : null;
  const description = author.authorDescriptionJson ? JSON.parse(author.authorDescriptionJson) : null;
  const business = author.businessProfileJson ? JSON.parse(author.businessProfileJson) : null;
  const professionalEntries = author.professionalEntriesJson ? JSON.parse(author.professionalEntriesJson) : null;

  const contextBlock = [
    author.bio ? `BIOGRAPHY:\n${author.bio}` : "",
    richBio?.fullBio ? `RICH BIOGRAPHY:\n${richBio.fullBio}` : "",
    geography ? `GEOGRAPHY:\n${JSON.stringify(geography, null, 2)}` : "",
    historical ? `HISTORICAL CONTEXT:\n${JSON.stringify(historical, null, 2)}` : "",
    family ? `FAMILY & UPBRINGING:\n${JSON.stringify(family, null, 2)}` : "",
    associations ? `ASSOCIATIONS & NETWORKS:\n${JSON.stringify(associations, null, 2)}` : "",
    formativeExp?.length ? `FORMATIVE EXPERIENCES:\n${JSON.stringify(formativeExp, null, 2)}` : "",
    description ? `PHYSICAL PRESENCE & STYLE:\n${JSON.stringify(description, null, 2)}` : "",
    business ? `BUSINESS PROFILE:\n${JSON.stringify(business, null, 2)}` : "",
    professionalEntries?.length ? `CAREER HISTORY:\n${JSON.stringify(professionalEntries, null, 2)}` : "",
  ].filter(Boolean).join("\n\n---\n\n");

  const booksBlock = bookInsights.length > 0
    ? bookInsights.join("\n\n")
    : "No book content available.";

  const prompt = `You are building a comprehensive Digital Me persona knowledge file for ${author.authorName}.

This file will be used as a system prompt to power an AI chatbot that impersonates ${author.authorName}.
It must be rich, specific, and grounded in the actual data provided below.

AUTHOR DATA:
${contextBlock}

CONTENT CATALOG INSIGHTS:
${booksBlock}

---

Write the complete Digital Me knowledge file in the following exact Markdown structure.
Be specific, detailed, and use actual facts from the data. Do NOT use generic filler.
Aim for 1500–2500 words total.

# Digital Me: ${author.authorName}
## Generated: ${new Date().toISOString().split("T")[0]}

---

## 1. Identity & Biographical Foundation
[3–4 paragraphs: full biography with geographical and historical context woven in naturally.
Include birth, education, career arc, current work. Be specific about places, dates, institutions.]

## 2. Formative Context
[2–3 paragraphs: how geography, family background, historical era, and formative experiences
shaped this author's worldview, values, and intellectual focus. Be analytical and specific.]

## 3. Core Ideology & Worldview
[2–3 paragraphs: fundamental beliefs, philosophical positions, recurring intellectual commitments.
What does this author fundamentally believe about human nature, society, organizations, change?]

## 4. Favorite Subjects & Recurring Themes
[List 5–8 themes with 1–2 sentence explanation of each, grounded in their actual works.]

## 5. Voice, Tone & Writing Style
[2 paragraphs: how this author writes and speaks. Sentence length, vocabulary level, use of
data vs. storytelling, humor style, rhetorical devices, typical structure of arguments.]

## 6. Signature Frameworks & Mental Models
[List each named framework/model with a 2–3 sentence explanation. Include the book/source.]

## 7. Personality & Behavioral Traits
[1–2 paragraphs: known personality traits, communication style, intellectual habits, quirks.
Ground in interviews, public appearances, and what colleagues/interviewers have noted.]

## 8. Physical Presence & Personal Brand
[1 paragraph: how this author presents publicly — dress, energy, speaking style, stage presence.
This helps the AI embody the author in conversation.]

## 9. Causes, Advocacy & Values
[List publicly championed causes, charitable work, social/political positions (if public).]

## 10. Intellectual Influences & Associations
[List key mentors, cited influences, organizations, intellectual rivals. Include context.]

## 11. Signature Phrases & Rhetorical Patterns
[5–10 actual or characteristic phrases, sentence openers, favorite analogies, catchphrases.]

## 12. Content Catalog Summary
[One paragraph per book/major work summarizing the key argument and its place in the author's arc.]

## 13. Known Gaps & Contradictions
[1 paragraph: areas where the author has changed their mind, been inconsistent, or where the
system has low confidence. Important for the chatbot to handle gracefully.]

---

IMPORTANT: Respond only with the Markdown content. No preamble, no explanation.`;

  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: "You are a master biographer and persona architect. Write rich, specific, grounded persona knowledge files. Never use generic filler. Every sentence must be grounded in actual facts about the person.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = response?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : `# Digital Me: ${author.authorName}\n\nGeneration failed.`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const ragPipelineRouter = router({
  /**
   * Generate or regenerate the Digital Me RAG file for one author.
   * Uses Claude Opus for the synthesis call by default.
   */
  generate: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional().default(DEFAULT_RAG_MODEL),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Check if already generating
      const existing = await db
        .select({ ragStatus: authorRagProfiles.ragStatus, ragVersion: authorRagProfiles.ragVersion })
        .from(authorRagProfiles)
        .where(eq(authorRagProfiles.authorName, input.authorName))
        .limit(1);

      if (existing[0]?.ragStatus === "generating" && !input.force) {
        return { success: false, message: "RAG generation already in progress" };
      }

      // Mark as generating
      const currentVersion = existing[0]?.ragVersion ?? 0;
      const nextVersion = currentVersion + 1;

      await db
        .insert(authorRagProfiles)
        .values({
          authorName: input.authorName,
          ragStatus: "generating",
          ragVersion: nextVersion,
          contentItemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            ragStatus: "generating",
            ragVersion: nextVersion,
            ragError: null,
            updatedAt: new Date(),
          },
        });

      try {
        // 1. Fetch author data
        const authorRows = await db
          .select({
            authorName: authorProfiles.authorName,
            bio: authorProfiles.bio,
            richBioJson: authorProfiles.richBioJson,
            geographyJson: authorProfiles.geographyJson,
            historicalContextJson: authorProfiles.historicalContextJson,
            familyJson: authorProfiles.familyJson,
            associationsJson: authorProfiles.associationsJson,
            formativeExperiencesJson: authorProfiles.formativeExperiencesJson,
            authorDescriptionJson: authorProfiles.authorDescriptionJson,
            socialStatsJson: authorProfiles.socialStatsJson,
            businessProfileJson: authorProfiles.businessProfileJson,
            professionalEntriesJson: authorProfiles.professionalEntriesJson,
          })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.authorName))
          .limit(1);

        if (!authorRows[0]) {
          throw new Error(`Author "${input.authorName}" not found in database`);
        }

        const author = authorRows[0];

        // 2. Fetch books for this author (N items)
        const books = await db
          .select({
            bookTitle: bookProfiles.bookTitle,
            authorName: bookProfiles.authorName,
            summary: bookProfiles.summary,
            keyThemes: bookProfiles.keyThemes,
            richSummaryJson: bookProfiles.richSummaryJson,
          })
          .from(bookProfiles)
          .where(eq(bookProfiles.authorName, input.authorName));

        logger.info(`[ragPipeline] Generating RAG for "${input.authorName}": ${books.length} books, model=${input.model}`);

        // 3. N calls: extract per-book insights
        const bookInsights: string[] = [];
        for (const book of books.slice(0, 15)) { // cap at 15 books to avoid token overflow
          const insight = await extractBookInsights(book, input.authorName, input.model);
          bookInsights.push(insight);
        }

        // 4. 1 synthesis call: build the full RAG file
        const ragContent = await synthesizeRagFile(author, bookInsights, input.model);
        const wordCount = ragContent.split(/\s+/).length;

        // 5. Upload to S3
        const s3Key = `library/${input.authorName.toLowerCase().replace(/\s+/g, "-")}/digital-me/rag-v${nextVersion}.md`;
        const { url: ragFileUrl } = await storagePut(
          s3Key,
          Buffer.from(ragContent, "utf-8"),
          "text/markdown"
        );

        // 6. Update DB record
        const bioRow = await db
          .select({ bioCompleteness: authorProfiles.bioCompleteness })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.authorName))
          .limit(1);

        await db
          .update(authorRagProfiles)
          .set({
            ragFileUrl,
            ragFileKey: s3Key,
            ragVersion: nextVersion,
            ragGeneratedAt: new Date(),
            ragWordCount: wordCount,
            ragModel: input.model,
            ragVendor: input.model.startsWith("claude") ? "anthropic" : "google",
            contentItemCount: books.length,
            bioCompletenessAtGeneration: bioRow[0]?.bioCompleteness ?? 0,
            ragStatus: "ready",
            ragError: null,
            updatedAt: new Date(),
          })
          .where(eq(authorRagProfiles.authorName, input.authorName));

        logger.info(`[ragPipeline] RAG ready for "${input.authorName}": v${nextVersion}, ${wordCount} words, ${books.length} books`);

        return {
          success: true,
          authorName: input.authorName,
          ragVersion: nextVersion,
          ragFileUrl,
          wordCount,
          bookCount: books.length,
          model: input.model,
        };
      } catch (err) {
        // Mark as failed
        await db
          .update(authorRagProfiles)
          .set({
            ragStatus: "stale",
            ragError: String(err),
            updatedAt: new Date(),
          })
          .where(eq(authorRagProfiles.authorName, input.authorName));

        logger.error(`[ragPipeline] Generation failed for "${input.authorName}":`, err);
        throw err;
      }
    }),

  /**
   * Get RAG profile status for a single author.
   */
  getStatus: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(authorRagProfiles)
        .where(eq(authorRagProfiles.authorName, input.authorName))
        .limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Get RAG status for all authors (Admin overview).
   */
  getAllStatuses: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          authorName: authorRagProfiles.authorName,
          ragStatus: authorRagProfiles.ragStatus,
          ragVersion: authorRagProfiles.ragVersion,
          ragGeneratedAt: authorRagProfiles.ragGeneratedAt,
          ragWordCount: authorRagProfiles.ragWordCount,
          ragModel: authorRagProfiles.ragModel,
          contentItemCount: authorRagProfiles.contentItemCount,
          bioCompletenessAtGeneration: authorRagProfiles.bioCompletenessAtGeneration,
        })
        .from(authorRagProfiles)
        .orderBy(authorRagProfiles.authorName);
      return rows;
    }),

  /**
   * Get the full RAG file content for an author (used by chatbot).
   */
  getRagContent: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, input.authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      if (!rows[0]?.ragFileUrl) return null;

      try {
        const resp = await fetch(rows[0].ragFileUrl);
        if (!resp.ok) return null;
        const content = await resp.text();
        return { content, url: rows[0].ragFileUrl };
      } catch {
        return null;
      }
    }),

  /**
   * Mark an author's RAG file as stale (triggers regeneration prompt).
   */
  markStale: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(authorRagProfiles)
        .set({ ragStatus: "stale", updatedAt: new Date() })
        .where(eq(authorRagProfiles.authorName, input.authorName));
      return { success: true };
    }),
});
