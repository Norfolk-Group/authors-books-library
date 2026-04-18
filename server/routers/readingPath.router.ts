/**
 * readingPath.router.ts
 *
 * Curated Reading Paths — guided learning sequences powered by Neon pgvector.
 *
 * Given a seed book, this router:
 *   1. Looks up (or generates) the book's embedding from Neon.
 *   2. Queries the `books` namespace for the top-N most similar books.
 *   3. Enriches each step with cover image, author, and a short LLM-generated
 *      "why this book next" rationale.
 *   4. Returns a sequenced path with step numbers, similarity scores, and
 *      transition explanations.
 *
 * Endpoints:
 *   readingPath.getPath  — generate a reading path from a seed book ID
 *   readingPath.getQuick — fast path using only DB metadata (no Neon, no LLM)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles } from "../../drizzle/schema";
import { eq, inArray, ne } from "drizzle-orm";
import { embedText } from "../services/ragPipeline.service";
import { queryVectors } from "../services/neonVector.service";
import { invokeLLM } from "../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReadingPathStep = {
  stepNumber: number;
  bookId: number;
  bookTitle: string;
  authorName: string | null;
  coverUrl: string | null;
  amazonUrl: string | null;
  summary: string | null;
  similarityScore: number;
  /** LLM-generated "why read this next" rationale (null in quick mode) */
  rationale: string | null;
  /** Thematic bridge — how this book connects to the previous one */
  bridge: string | null;
};

export type ReadingPath = {
  seedBookId: number;
  seedBookTitle: string;
  steps: ReadingPathStep[];
  theme: string | null;
  mode: "semantic" | "quick";
  generatedAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickCoverUrl(book: { coverImageUrl?: string | null; s3CoverUrl?: string | null }): string | null {
  return book.s3CoverUrl ?? book.coverImageUrl ?? null;
}

function pickAmazonUrl(book: { resourceLinksJson?: string | null }): string | null {
  if (!book.resourceLinksJson) return null;
  try {
    const links = JSON.parse(book.resourceLinksJson) as Array<{ type: string; url: string }>;
    return links.find((l) => l.type === "amazon")?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate a short "why read this next" rationale using the LLM.
 * Falls back to null on any error to keep the path generation fast.
 */
async function generateRationale(
  fromTitle: string,
  toTitle: string,
  toAuthor: string | null,
  score: number
): Promise<{ rationale: string; bridge: string } | null> {
  try {
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a knowledgeable reading guide. Given two books in a reading path, write a concise JSON response with two fields: 'rationale' (1-2 sentences on why to read the second book after the first) and 'bridge' (a 5-10 word thematic connection phrase, e.g. 'Both explore cognitive bias in decision-making'). Be specific and insightful.",
        },
        {
          role: "user",
          content: `Previous book: "${fromTitle}"\nNext book: "${toTitle}" by ${toAuthor ?? "unknown author"}\nSimilarity score: ${(score * 100).toFixed(0)}%\n\nRespond with JSON only.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reading_path_rationale",
          strict: true,
          schema: {
            type: "object",
            properties: {
              rationale: { type: "string" },
              bridge: { type: "string" },
            },
            required: ["rationale", "bridge"],
            additionalProperties: false,
          },
        },
      },
    });
    const rawContent = resp.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) return null;
    return JSON.parse(content) as { rationale: string; bridge: string };
  } catch {
    return null;
  }
}

/**
 * Generate an overall theme label for the reading path using the LLM.
 */
async function generatePathTheme(
  seedTitle: string,
  bookTitles: string[]
): Promise<string | null> {
  try {
    const resp = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a reading curator. Given a list of books in a reading path, generate a concise thematic title (5-8 words) that captures the intellectual journey. Respond with a plain string only — no JSON, no quotes.",
        },
        {
          role: "user",
          content: `Reading path starting with "${seedTitle}":\n${bookTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
    });
    const rawContent = resp.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent.trim() : null;
    return content ?? null;
  } catch {
    return null;
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const readingPathRouter = router({
  /**
   * Full semantic reading path.
   * Uses Neon vector similarity + LLM rationale generation.
   * ~3-8 seconds depending on path length.
   */
  getPath: publicProcedure
    .input(
      z.object({
        seedBookId: z.number().int().positive(),
        /** Number of books in the path (excluding seed). Default 5, max 10. */
        pathLength: z.number().int().min(1).max(10).default(5),
        /** Include LLM-generated rationale for each step. Default true. */
        withRationale: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // 1. Fetch the seed book
      const [seedBook] = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          resourceLinksJson: bookProfiles.resourceLinksJson,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.id, input.seedBookId))
        .limit(1);

      if (!seedBook) throw new Error(`Book ${input.seedBookId} not found`);

      // 2. Embed the seed book's title + summary for vector query
      const textToEmbed = [seedBook.bookTitle, seedBook.summary ?? ""]
        .filter(Boolean)
        .join(". ");
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embedText(textToEmbed);
      } catch {
        // Fall back to quick mode if embedding fails
        return buildQuickPath(db, seedBook, input.pathLength);
      }

      // 3. Query Neon for similar books
      const neonResults = await queryVectors(queryEmbedding, "books", {
        topK: input.pathLength + 5, // Fetch extra to filter out seed
      });

      // Filter out the seed book itself
      const filteredResults = neonResults
        .filter((r) => r.metadata?.title !== seedBook.bookTitle)
        .slice(0, input.pathLength);

      if (filteredResults.length === 0) {
        return buildQuickPath(db, seedBook, input.pathLength);
      }

      // 4. Fetch full DB records for the similar books
      const similarTitles = filteredResults.map((r) => r.metadata?.title as string).filter(Boolean);
      const similarBooks = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          resourceLinksJson: bookProfiles.resourceLinksJson,
        })
        .from(bookProfiles)
        .where(inArray(bookProfiles.bookTitle, similarTitles))
        .limit(input.pathLength + 5);

      // Build a lookup map by title
      const bookByTitle = new Map(similarBooks.map((b) => [b.bookTitle, b]));

      // 5. Build steps in similarity order
      const steps: ReadingPathStep[] = [];
      let prevTitle = seedBook.bookTitle;

      for (let i = 0; i < filteredResults.length; i++) {
        const result = filteredResults[i];
        const title = result.metadata?.title as string;
        const dbBook = bookByTitle.get(title);

        // Generate rationale if requested
        let rationale: string | null = null;
        let bridge: string | null = null;
        if (input.withRationale) {
          const generated = await generateRationale(
            prevTitle,
            title,
            dbBook?.authorName ?? (result.metadata?.authorName as string | null) ?? null,
            result.score
          );
          rationale = generated?.rationale ?? null;
          bridge = generated?.bridge ?? null;
        }

        steps.push({
          stepNumber: i + 1,
          bookId: dbBook?.id ?? 0,
          bookTitle: title,
          authorName: dbBook?.authorName ?? (result.metadata?.authorName as string | null) ?? null,
          coverUrl: dbBook ? pickCoverUrl(dbBook) : null,
          amazonUrl: dbBook ? pickAmazonUrl(dbBook) : null,
          summary: dbBook?.summary ?? null,
          similarityScore: result.score,
          rationale,
          bridge,
        });

        prevTitle = title;
      }

      // 6. Generate overall path theme
      const theme = await generatePathTheme(
        seedBook.bookTitle,
        steps.map((s) => s.bookTitle)
      );

      const path: ReadingPath = {
        seedBookId: seedBook.id,
        seedBookTitle: seedBook.bookTitle,
        steps,
        theme,
        mode: "semantic",
        generatedAt: new Date().toISOString(),
      };

      return path;
    }),

  /**
   * Quick reading path — no Neon, no LLM.
   * Uses same-author books + same-category books from the DB.
   * Returns in < 100ms.
   */
  getQuick: publicProcedure
    .input(
      z.object({
        seedBookId: z.number().int().positive(),
        pathLength: z.number().int().min(1).max(10).default(5),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [seedBook] = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          resourceLinksJson: bookProfiles.resourceLinksJson,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.id, input.seedBookId))
        .limit(1);

      if (!seedBook) throw new Error(`Book ${input.seedBookId} not found`);

      return buildQuickPath(db, seedBook, input.pathLength);
    }),
});

// ── Quick path builder (shared by both procedures) ────────────────────────────

async function buildQuickPath(
  db: Awaited<ReturnType<typeof getDb>>,
  seedBook: {
    id: number;
    bookTitle: string;
    authorName: string | null;
    summary: string | null;
    coverImageUrl: string | null;
    s3CoverUrl: string | null;
    resourceLinksJson: string | null;
  },
  pathLength: number
): Promise<ReadingPath> {
  if (!db) throw new Error("DB unavailable");

  // Fetch books by same author (excluding seed)
  const sameAuthorBooks = seedBook.authorName
    ? await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          resourceLinksJson: bookProfiles.resourceLinksJson,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.authorName, seedBook.authorName))
        .limit(pathLength + 2)
    : [];

  const filteredSameAuthor = sameAuthorBooks.filter((b) => b.id !== seedBook.id);

  // If not enough same-author books, pad with other books (by title alphabetically)
  let candidates = filteredSameAuthor;
  if (candidates.length < pathLength) {
    const otherBooks = await db
      .select({
        id: bookProfiles.id,
        bookTitle: bookProfiles.bookTitle,
        authorName: bookProfiles.authorName,
        summary: bookProfiles.summary,
        coverImageUrl: bookProfiles.coverImageUrl,
        s3CoverUrl: bookProfiles.s3CoverUrl,
        resourceLinksJson: bookProfiles.resourceLinksJson,
      })
      .from(bookProfiles)
      .where(ne(bookProfiles.id, seedBook.id))
      .limit(pathLength * 3);

    // Shuffle for variety
    const shuffled = otherBooks.sort(() => Math.random() - 0.5);
    const existingIds = new Set(candidates.map((b) => b.id));
    for (const b of shuffled) {
      if (!existingIds.has(b.id)) {
        candidates.push(b);
        existingIds.add(b.id);
        if (candidates.length >= pathLength) break;
      }
    }
  }

  const steps: ReadingPathStep[] = candidates.slice(0, pathLength).map((book, i) => ({
    stepNumber: i + 1,
    bookId: book.id,
    bookTitle: book.bookTitle,
    authorName: book.authorName,
    coverUrl: pickCoverUrl(book),
    amazonUrl: pickAmazonUrl(book),
    summary: book.summary,
    similarityScore: filteredSameAuthor.includes(book) ? 0.85 : 0.6,
    rationale: null,
    bridge: filteredSameAuthor.includes(book)
      ? `Also by ${book.authorName ?? "this author"}`
      : "Expands your reading horizon",
  }));

  return {
    seedBookId: seedBook.id,
    seedBookTitle: seedBook.bookTitle,
    steps,
    theme: seedBook.authorName ? `More from ${seedBook.authorName}` : "Curated for You",
    mode: "quick",
    generatedAt: new Date().toISOString(),
  };
}
