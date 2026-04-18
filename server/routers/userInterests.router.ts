/**
 * userInterests.router.ts
 *
 * User Interest Graph & RAG Contrast Engine.
 *
 * Procedures:
 *   - list: Get all interests for the current user
 *   - create: Add a new interest topic
 *   - update: Edit an existing interest
 *   - delete: Remove an interest
 *   - reorder: Update display order (drag-to-reorder)
 *   - scoreAuthor: Score one author against all user interests using their RAG file
 *   - scoreAllAuthors: Batch score all authors with ready RAG files
 *   - getScores: Get all alignment scores for the current user
 *   - getAuthorScores: Get scores for a specific author
 *   - compareAuthors: Group contrast — compare 2–5 authors on a specific interest
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userInterests, authorInterestScores, authorRagProfiles } from "../../drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { logger } from "../lib/logger";
import { embedText } from "../services/ragPipeline.service";
import { queryVectors } from "../services/neonVector.service";

const DEFAULT_SCORING_MODEL = "claude-opus-4-5";

// ── Scoring Engine ────────────────────────────────────────────────────────────

async function scoreAuthorAgainstInterests(
  authorName: string,
  ragContent: string,
  interests: Array<{ id: number; topic: string; description: string | null; weight: string }>,
  model: string
): Promise<Array<{ interestId: number; score: number; rationale: string }>> {
  if (interests.length === 0) return [];

  const interestList = interests
    .map((i) => `- ID ${i.id}: "${i.topic}"${i.description ? ` (${i.description})` : ""} [weight: ${i.weight}]`)
    .join("\n");

  const prompt = `You are scoring how well an author's body of work aligns with a user's personal interests.

AUTHOR RAG FILE (first 3000 chars):
${ragContent.slice(0, 3000)}

USER INTERESTS TO SCORE:
${interestList}

For each interest, provide:
- A score from 0–10 (0 = no alignment, 10 = this author is a primary authority on this topic)
- A one-sentence rationale citing specific works or ideas

Return ONLY valid JSON array:
[
  { "interestId": <number>, "score": <0-10>, "rationale": "<one sentence>" },
  ...
]`;

  try {
    const response = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "You are a precise interest-alignment scorer. Return only valid JSON arrays." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response?.choices?.[0]?.message?.content ?? "[]";
    const content = typeof raw === "string" ? raw : "[]";

    // Handle both array and object wrapper responses
    let parsed: Array<{ interestId: number; score: number; rationale: string }>;
    const obj = JSON.parse(content);
    if (Array.isArray(obj)) {
      parsed = obj;
    } else if (obj.scores && Array.isArray(obj.scores)) {
      parsed = obj.scores;
    } else {
      // Try to find any array in the object
      const firstArray = Object.values(obj).find(Array.isArray);
      parsed = (firstArray as typeof parsed) ?? [];
    }

    return parsed.map((item) => ({
      interestId: item.interestId,
      score: Math.max(0, Math.min(10, Math.round(item.score))),
      rationale: item.rationale ?? "",
    }));
  } catch (err) {
    logger.warn(`[userInterests] Scoring failed for "${authorName}":`, err);
    return interests.map((i) => ({ interestId: i.id, score: 0, rationale: "Scoring failed" }));
  }
}

// ── Neon pgvector Pre-filter ──────────────────────────────────────────────────────

/**
 * Use Neon pgvector to pre-filter to the most semantically relevant authors
 * for a given set of user interests. Returns authorNames sorted by
 * cosine similarity (best match first).
 *
 * This replaces the O(N) full-scan with an O(K) LLM pass where K << N.
 * Typical: 183 authors → top 30 candidates → ~84% LLM cost reduction.
 */
async function getNeonAuthorCandidates(
  interests: Array<{ topic: string; description: string | null; weight: string }>,
  topK = 30
): Promise<string[]> {
  try {
    // Build a composite query string from all interests (weighted by importance)
    const weightMultiplier: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const queryParts: string[] = [];
    for (const interest of interests) {
      const repeat = weightMultiplier[interest.weight] ?? 2;
      const phrase = interest.description
        ? `${interest.topic}: ${interest.description}`
        : interest.topic;
      for (let i = 0; i < repeat; i++) queryParts.push(phrase);
    }
    const queryText = queryParts.join(". ");

    // Embed the composite interest query
    const queryEmbedding = await embedText(queryText);

    // Query the authors namespace
    const hits = await queryVectors(queryEmbedding, "authors", { topK });

    // Extract unique authorNames from metadata
    const seen = new Set<string>();
    const candidates: string[] = [];
    for (const hit of hits) {
      const name = hit.metadata?.authorName;
      if (name && !seen.has(name)) {
        seen.add(name);
        candidates.push(name);
      }
    }

    logger.info(`[userInterests] Neon pgvector pre-filter: ${candidates.length} candidates from ${hits.length} hits (topK=${topK})`);
    return candidates;
  } catch (err) {
    logger.warn("[userInterests] Neon pgvector pre-filter failed, falling back to full scan:", err);
    return []; // empty = caller falls back to full scan
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const userInterestsRouter = router({
  /**
   * List all interests for the current user.
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, ctx.user.openId))
        .orderBy(userInterests.displayOrder, userInterests.createdAt);
    }),

  /**
   * Create a new interest.
   */
  create: protectedProcedure
    .input(z.object({
      topic: z.string().min(1).max(256),
      description: z.string().max(1000).optional(),
      category: z.string().max(128).optional(),
      weight: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366F1"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get current max display order
      const existing = await db
        .select({ displayOrder: userInterests.displayOrder })
        .from(userInterests)
        .where(eq(userInterests.userId, ctx.user.openId))
        .orderBy(desc(userInterests.displayOrder))
        .limit(1);

      const nextOrder = (existing[0]?.displayOrder ?? -1) + 1;

      const [result] = await db
        .insert(userInterests)
        .values({
          userId: ctx.user.openId,
          topic: input.topic,
          description: input.description ?? null,
          category: input.category ?? null,
          weight: input.weight,
          color: input.color,
          displayOrder: nextOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      return { success: true, id: (result as { insertId?: number }).insertId };
    }),

  /**
   * Update an existing interest.
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      topic: z.string().min(1).max(256).optional(),
      description: z.string().max(1000).nullable().optional(),
      category: z.string().max(128).nullable().optional(),
      weight: z.enum(["low", "medium", "high", "critical"]).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { id, ...fields } = input;
      await db
        .update(userInterests)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(userInterests.id, id), eq(userInterests.userId, ctx.user.openId)));

      return { success: true };
    }),

  /**
   * Delete an interest and its associated scores.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Delete scores first (FK constraint)
      await db
        .delete(authorInterestScores)
        .where(and(
          eq(authorInterestScores.interestId, input.id),
          eq(authorInterestScores.userId, ctx.user.openId)
        ));

      await db
        .delete(userInterests)
        .where(and(eq(userInterests.id, input.id), eq(userInterests.userId, ctx.user.openId)));

      return { success: true };
    }),

  /**
   * Reorder interests (drag-to-reorder).
   */
  reorder: protectedProcedure
    .input(z.object({
      orderedIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      for (let i = 0; i < input.orderedIds.length; i++) {
        await db
          .update(userInterests)
          .set({ displayOrder: i, updatedAt: new Date() })
          .where(and(
            eq(userInterests.id, input.orderedIds[i]),
            eq(userInterests.userId, ctx.user.openId)
          ));
      }

      return { success: true };
    }),

  /**
   * Score one author against all user interests using their RAG file.
   * Uses Claude Opus by default.
   */
  scoreAuthor: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional().default(DEFAULT_SCORING_MODEL),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get user interests
      const interests = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, ctx.user.openId));

      if (interests.length === 0) {
        return { success: false, message: "No interests defined. Add interests in Admin → My Interests." };
      }

      // Get RAG file
      const ragRows = await db
        .select({ ragFileUrl: authorRagProfiles.ragFileUrl, ragStatus: authorRagProfiles.ragStatus, ragVersion: authorRagProfiles.ragVersion })
        .from(authorRagProfiles)
        .where(and(
          eq(authorRagProfiles.authorName, input.authorName),
          eq(authorRagProfiles.ragStatus, "ready")
        ))
        .limit(1);

      if (!ragRows[0]?.ragFileUrl) {
        return { success: false, message: `No ready RAG file for "${input.authorName}". Generate Digital Me first.` };
      }

      // Fetch RAG content
      const ragResp = await fetch(ragRows[0].ragFileUrl);
      if (!ragResp.ok) {
        return { success: false, message: "Failed to fetch RAG file from storage." };
      }
      const ragContent = await ragResp.text();

      // Score against all interests
      const scores = await scoreAuthorAgainstInterests(
        input.authorName,
        ragContent,
        interests.map((i) => ({ id: i.id, topic: i.topic, description: i.description, weight: i.weight })),
        input.model
      );

      // Upsert scores
      for (const score of scores) {
        await db
          .insert(authorInterestScores)
          .values({
            authorName: input.authorName,
            interestId: score.interestId,
            userId: ctx.user.openId,
            score: score.score,
            rationale: score.rationale,
            modelUsed: input.model,
            computedAt: new Date(),
            ragVersion: ragRows[0].ragVersion,
          })
          .onDuplicateKeyUpdate({
            set: {
              score: score.score,
              rationale: score.rationale,
              modelUsed: input.model,
              computedAt: new Date(),
              ragVersion: ragRows[0].ragVersion,
            },
          });
      }

      return { success: true, authorName: input.authorName, scoresComputed: scores.length };
    }),

  /**
   * Get all alignment scores for the current user (for heatmap view).
   */
  getScores: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(authorInterestScores)
        .where(eq(authorInterestScores.userId, ctx.user.openId))
        .orderBy(authorInterestScores.authorName);
    }),

  /**
   * Get scores for a specific author (for author card pills).
   */
  getAuthorScores: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(authorInterestScores)
        .where(and(
          eq(authorInterestScores.authorName, input.authorName),
          eq(authorInterestScores.userId, ctx.user.openId)
        ))
        .orderBy(desc(authorInterestScores.score));
    }),

  /**
   * Compare 2–5 authors on a specific interest using their RAG files.
   * Produces a structured comparative analysis.
   */
  compareAuthors: protectedProcedure
    .input(z.object({
      authorNames: z.array(z.string()).min(2).max(5),
      interestId: z.number(),
      model: z.string().optional().default(DEFAULT_SCORING_MODEL),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the interest
      const interestRows = await db
        .select()
        .from(userInterests)
        .where(and(
          eq(userInterests.id, input.interestId),
          eq(userInterests.userId, ctx.user.openId)
        ))
        .limit(1);

      if (!interestRows[0]) throw new Error("Interest not found");
      const interest = interestRows[0];

      // Fetch RAG files for all authors
      const ragFiles: Record<string, string> = {};
      for (const authorName of input.authorNames) {
        const ragRows = await db
          .select({ ragFileUrl: authorRagProfiles.ragFileUrl })
          .from(authorRagProfiles)
          .where(and(
            eq(authorRagProfiles.authorName, authorName),
            eq(authorRagProfiles.ragStatus, "ready")
          ))
          .limit(1);

        if (ragRows[0]?.ragFileUrl) {
          try {
            const resp = await fetch(ragRows[0].ragFileUrl);
            if (resp.ok) ragFiles[authorName] = (await resp.text()).slice(0, 2000);
          } catch { /* skip */ }
        }
      }

      if (Object.keys(ragFiles).length < 2) {
        throw new Error("Need at least 2 authors with ready RAG files for comparison");
      }

      const authorBlocks = Object.entries(ragFiles)
        .map(([name, content]) => `=== ${name} ===\n${content}`)
        .join("\n\n");

      const response = await invokeLLM({
        model: input.model,
        messages: [
          {
            role: "system",
            content: "You are a comparative intellectual analyst. Produce structured, insightful comparisons grounded in each author's actual work.",
          },
          {
            role: "user",
            content: `Compare how these authors approach the topic: "${interest.topic}"${interest.description ? ` (${interest.description})` : ""}.

AUTHOR KNOWLEDGE FILES:
${authorBlocks}

Write a structured comparative analysis (500–800 words):
1. **Overview**: How each author approaches this topic at a high level
2. **Points of Agreement**: Where their thinking converges
3. **Key Differences**: Where they diverge — in method, emphasis, or conclusion
4. **Complementary Insights**: How their perspectives together give a richer view than any one alone
5. **Recommended Reading Order**: Which author to start with and why, for someone new to this topic

Be specific — cite actual books, frameworks, and ideas from each author.`,
          },
        ],
      });

      const content = response?.choices?.[0]?.message?.content;
      return {
        analysis: typeof content === "string" ? content : "Analysis failed.",
        authorNames: input.authorNames,
        interest: interest.topic,
        authorsWithRag: Object.keys(ragFiles),
      };
    }),

  /**
   * Batch score all authors with ready RAG files against all user interests.
   *
   * P2 Optimization: Neon-first pre-filter.
   * Instead of running LLM scoring on ALL authors (O(N) LLM calls), we:
   *   1. Embed the composite interest query via Gemini
   *   2. Query Neon pgvector authors namespace → top-K candidates
   *   3. Only run LLM scoring on those K candidates
   * Typical reduction: 183 authors → 30 candidates → ~84% LLM cost savings.
   * Falls back to full scan if Neon is unavailable.
   */
  scoreAllAuthors: protectedProcedure
    .input(z.object({
      model: z.string().optional().default(DEFAULT_SCORING_MODEL),
      neonTopK: z.number().int().min(5).max(183).optional().default(30),
      skipNeonFilter: z.boolean().optional().default(false),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const model = input?.model ?? DEFAULT_SCORING_MODEL;
      const neonTopK = input?.neonTopK ?? 30;
      const skipNeonFilter = input?.skipNeonFilter ?? false;

      const interests = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, ctx.user.openId));

      if (interests.length === 0) {
        return { success: false, scored: 0, message: "No interests defined." };
      }

      // ── Step 1: Neon pgvector pre-filter ──────────────────────────────────────────
      let candidateNames: string[] = [];
      let usedNeonFilter = false;

      if (!skipNeonFilter) {
        candidateNames = await getNeonAuthorCandidates(
          interests.map((i) => ({ topic: i.topic, description: i.description, weight: i.weight })),
          neonTopK
        );
        usedNeonFilter = candidateNames.length > 0;
      }

      // ── Step 2: Fetch RAG rows (filtered or full) ────────────────────────────
      const allRagRows = await db
        .select({ authorName: authorRagProfiles.authorName, ragFileUrl: authorRagProfiles.ragFileUrl, ragVersion: authorRagProfiles.ragVersion })
        .from(authorRagProfiles)
        .where(eq(authorRagProfiles.ragStatus, "ready"));

      // If Neon returned candidates, restrict to those authors only
      const ragRows = usedNeonFilter
        ? allRagRows.filter(r => candidateNames.includes(r.authorName))
        : allRagRows;

      logger.info(`[userInterests] scoreAllAuthors: ${ragRows.length} authors to score (neon filter: ${usedNeonFilter}, total with RAG: ${allRagRows.length})`);

      // ── Step 3: LLM scoring on candidates ───────────────────────────────────
      let scored = 0;
      for (const rag of ragRows) {
        if (!rag.ragFileUrl) continue;
        try {
          const resp = await fetch(rag.ragFileUrl);
          if (!resp.ok) continue;
          const ragContent = await resp.text();
          const scores = await scoreAuthorAgainstInterests(
            rag.authorName,
            ragContent,
            interests.map((i) => ({ id: i.id, topic: i.topic, description: i.description, weight: i.weight })),
            model
          );
          for (const score of scores) {
            await db
              .insert(authorInterestScores)
              .values({
                authorName: rag.authorName,
                interestId: score.interestId,
                userId: ctx.user.openId,
                score: score.score,
                rationale: score.rationale,
                modelUsed: model,
                computedAt: new Date(),
                ragVersion: rag.ragVersion,
              })
              .onDuplicateKeyUpdate({
                set: {
                  score: score.score,
                  rationale: score.rationale,
                  modelUsed: model,
                  computedAt: new Date(),
                  ragVersion: rag.ragVersion,
                },
              });
          }
          scored++;
        } catch { /* skip failed authors */ }
      }

      return {
        success: true,
        scored,
        total: allRagRows.length,
        candidates: ragRows.length,
        usedNeonFilter,
        message: usedNeonFilter
          ? `Scored ${scored} of ${ragRows.length} Neon-selected candidates (${allRagRows.length} total with RAG)`
          : `Scored ${scored} of ${allRagRows.length} authors (full scan — Neon filter unavailable)`,
      };
    }),

  /**
   * Generate a 3-sentence explanation of why an author is relevant
   * to the user's current interests. Uses Claude Opus.
   */
  whyThisAuthor: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional().default(DEFAULT_SCORING_MODEL),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const interests = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, ctx.user.openId))
        .orderBy(desc(userInterests.displayOrder));

      if (interests.length === 0) {
        throw new Error("You have no interests defined. Add some in Admin → My Interests.");
      }

      const scores = await db
        .select()
        .from(authorInterestScores)
        .where(and(
          eq(authorInterestScores.authorName, input.authorName),
          eq(authorInterestScores.userId, ctx.user.openId)
        ))
        .orderBy(desc(authorInterestScores.score));

      const interestList = interests
        .map((i) => `"${i.topic}"${i.description ? ` (${i.description})` : ""}`)
        .join(", ");

      const topScores = scores.slice(0, 5).map((s) => {
        const interest = interests.find((i) => i.id === s.interestId);
        return interest ? `${interest.topic}: ${s.score}/10 — ${s.rationale ?? ""}` : "";
      }).filter(Boolean).join("\n");

      const prompt = `You are explaining to a reader why a specific author is relevant to their personal interests.

AUTHOR: ${input.authorName}
USER INTERESTS: ${interestList}
${topScores ? `\nALIGNMENT SCORES:\n${topScores}` : ""}

Write exactly 3 sentences explaining why this author is relevant to the user's interests.
- Sentence 1: The core connection between this author's work and the user's interests
- Sentence 2: A specific book, idea, or framework that directly addresses their interests
- Sentence 3: What unique perspective this author brings that other authors don't

Be specific, concrete, and compelling. Do not use generic phrases.`;

      const response = await invokeLLM({
        model: input.model,
        messages: [
          { role: "system", content: "You are a precise intellectual matchmaker. Write exactly 3 sentences, no more, no less." },
          { role: "user", content: prompt },
        ],
      });

      const responseContent = response?.choices?.[0]?.message?.content;
      return {
        explanation: typeof responseContent === "string" ? responseContent.trim() : "Could not generate explanation.",
        authorName: input.authorName,
      };
    }),
});
