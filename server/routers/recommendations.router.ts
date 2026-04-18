/**
 * recommendations.router.ts
 *
 * Neon-powered recommendation and discovery procedures.
 *
 * Features:
 *   recommendations.similarBooks       — "Readers Also Liked" via vector similarity
 *   recommendations.similarAuthors     — similar authors via vector similarity
 *   recommendations.relatedContent     — cross-content discovery (podcasts/videos for a book)
 *   recommendations.thematicSearch     — conceptual/thematic search ("books about resilience")
 *   recommendations.personalizedNext   — "What to Read Next" based on user's favorites
 *   recommendations.ragChatContext     — semantic chunk retrieval for chatbot RAG upgrade
 */
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  bookProfiles,
  authorProfiles,
  contentItems,
  favorites,
} from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  embedText,
  semanticSearch,
} from "../services/ragPipeline.service";
import {
  queryVectors,
  queryAllNamespaces,
  NEON_TABLE_NAME,
} from "../services/neonVector.service";
import type { VectorMetadata } from "../services/neonVector.service";

import { logger } from "../lib/logger";

// ── Reranking helper ─────────────────────────────────────────────────────
/**
 * Sort hits by cosine similarity score (pgvector already returns cosine similarity).
 * The Neon bge-reranker-v2-m3 has been removed; pgvector cosine distance
 * provides equivalent relevance ordering for this library use-case.
 */
async function rerankHits<T extends { id: string; score: number; metadata: { text: string } }>(
  _query: string,
  hits: T[],
  topN?: number
): Promise<T[]> {
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const result = topN ? sorted.slice(0, topN) : sorted;
  logger.info(`[rerank] Returning top ${result.length} hits by cosine score`);
  return result;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const recommendationsRouter = router({
  /**
   * "Readers Also Liked" — find books similar to a given book via vector similarity.
   * Uses the book's own vector as the query to find nearest neighbours.
   */
  similarBooks: publicProcedure
    .input(z.object({
      bookId: z.string().min(1),
      topK: z.number().int().min(1).max(20).default(6),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { books: [] };

      // 1. Fetch the source book's metadata
      const sourceBooks = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          richSummaryJson: bookProfiles.richSummaryJson,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.id, parseInt(input.bookId, 10)))
        .limit(1);

      if (!sourceBooks[0]) return { books: [] };
      const source = sourceBooks[0];

      // 2. Build a query text from the book's summary
      let queryText = source.summary ?? "";
      try {
        if (source.richSummaryJson) {
          const rich = typeof source.richSummaryJson === "string"
            ? JSON.parse(source.richSummaryJson as string)
            : source.richSummaryJson;
          if (rich?.fullSummary && rich.fullSummary.length > queryText.length) queryText = rich.fullSummary;
        }
      } catch { /* use plain summary */ }

      if (queryText.length < 30) return { books: [] };

      // 3. Embed and query Neon pgvector books namespace
      const queryEmbedding = await embedText(queryText.slice(0, 2000));
      const hits = await queryVectors(queryEmbedding, "books", {
        topK: input.topK + 5, // over-fetch to exclude self
      });

      // 4. Exclude the source book itself
      const sourceVectorId = `book-${input.bookId}-`;
      const filteredHits = hits.filter(h => !h.id.startsWith(sourceVectorId));

      // 5. Deduplicate by sourceId
      const seen = new Set<string>();
      const deduped = filteredHits.filter(h => {
        if (seen.has(h.metadata.sourceId)) return false;
        seen.add(h.metadata.sourceId);
        return true;
      });

      if (deduped.length === 0) return { books: [] };

      // 5b. Rerank with bge-reranker-v2-m3 for better relevance ordering
      const rerankedHits = await rerankHits(queryText.slice(0, 500), deduped, input.topK);
      const uniqueHits = rerankedHits.slice(0, input.topK);

      // 6. Fetch full book data from DB
      const bookIds = uniqueHits.map(h => parseInt(h.metadata.sourceId, 10)).filter(id => !isNaN(id));
      if (bookIds.length === 0) return { books: [] };

      const bookRows = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          coverImageUrl: bookProfiles.coverImageUrl,
          summary: bookProfiles.summary,
          tagsJson: bookProfiles.tagsJson,
          amazonUrl: bookProfiles.amazonUrl,
        })
        .from(bookProfiles)
        .where(inArray(bookProfiles.id, bookIds));

      // 7. Merge reranked scores and sort
      const scoreMap = new Map(uniqueHits.map(h => [parseInt(h.metadata.sourceId, 10), h.score]));
      const result = bookRows
        .map(b => ({ ...b, score: scoreMap.get(b.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { books: result };
    }),

  /**
   * Similar Authors — find authors with similar writing/thinking style.
   */
  similarAuthors: publicProcedure
    .input(z.object({
      authorName: z.string().min(1),
      topK: z.number().int().min(1).max(10).default(5),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { authors: [] };

      // 1. Fetch source author bio
      const sourceAuthors = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          bio: authorProfiles.bio,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      if (!sourceAuthors[0]?.bio) return { authors: [] };
      const source = sourceAuthors[0];

      // 2. Embed bio and query Neon pgvector authors namespace
      const queryEmbedding = await embedText((source.bio ?? "").slice(0, 2000));
      const hits = await queryVectors(queryEmbedding, "authors", {
        topK: input.topK + 3,
      });

      // 3. Exclude self and deduplicate
      const filteredHits = hits.filter(h =>
        h.metadata.authorName?.toLowerCase() !== input.authorName.toLowerCase()
      );
      const seen = new Set<string>();
      const deduped = filteredHits.filter(h => {
        const key = h.metadata.authorName ?? h.metadata.sourceId;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length === 0) return { authors: [] };

      // 3b. Rerank with bge-reranker-v2-m3
      const rerankedHits = await rerankHits((source.bio ?? "").slice(0, 500), deduped, input.topK);
      const uniqueHits = rerankedHits.slice(0, input.topK);

      // 4. Fetch full author data from DB
      const authorNames = uniqueHits.map(h => h.metadata.authorName).filter(Boolean) as string[];
      if (authorNames.length === 0) return { authors: [] };

      const authorRows = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          bio: authorProfiles.bio,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
          avatarUrl: authorProfiles.avatarUrl,
          tagsJson: authorProfiles.tagsJson,
        })
        .from(authorProfiles)
        .where(inArray(authorProfiles.authorName, authorNames));

      // 5. Merge reranked scores
      const scoreMap = new Map(uniqueHits.map(h => [h.metadata.authorName, h.score]));
      const result = authorRows
        .map(a => ({ ...a, score: scoreMap.get(a.authorName) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { authors: result as (typeof result[number] & { score: number })[] };
    }),

  /**
   * Cross-Content Discovery — find podcasts, videos, and articles related to a book.
   */
  relatedContent: publicProcedure
    .input(z.object({
      bookId: z.string().min(1),
      topK: z.number().int().min(1).max(12).default(6),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [] };

      // 1. Fetch book summary
      const sourceBooks = await db
        .select({
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          summary: bookProfiles.summary,
          richSummaryJson: bookProfiles.richSummaryJson,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.id, parseInt(input.bookId, 10)))
        .limit(1);

      if (!sourceBooks[0]) return { items: [] };
      const source = sourceBooks[0];

      let queryText = `${source.bookTitle} ${source.authorName ?? ""} ${source.summary ?? ""}`.trim();
      try {
        if (source.richSummaryJson) {
          const rich = typeof source.richSummaryJson === "string"
            ? JSON.parse(source.richSummaryJson as string)
            : source.richSummaryJson;
          if (rich?.fullSummary) queryText += " " + rich.fullSummary;
        }
      } catch { /* use plain */ }

      if (queryText.length < 20) return { items: [] };

      // 2. Query content_items namespace
      const queryEmbedding = await embedText(queryText.slice(0, 2000));
      const hits = await queryVectors(queryEmbedding, "content_items", {
        topK: input.topK + 3,
      });

      if (hits.length === 0) return { items: [] };

      // 3. Deduplicate by sourceId
      const seen = new Set<string>();
      const uniqueHits = hits.filter(h => {
        if (seen.has(h.metadata.sourceId)) return false;
        seen.add(h.metadata.sourceId);
        return true;
      }).slice(0, input.topK);

      // 4. Fetch content item details from DB
      const itemIds = uniqueHits.map(h => parseInt(h.metadata.sourceId, 10)).filter(id => !isNaN(id));
      if (itemIds.length === 0) return { items: [] };

      const itemRows = await db
        .select({
          id: contentItems.id,
          title: contentItems.title,
          contentType: contentItems.contentType,
          url: contentItems.url,
          description: contentItems.description,
          coverImageUrl: contentItems.coverImageUrl,
          s3CoverUrl: contentItems.s3CoverUrl,
        })
        .from(contentItems)
        .where(inArray(contentItems.id, itemIds));

      const scoreMap = new Map(uniqueHits.map(h => [parseInt(h.metadata.sourceId, 10), h.score]));
      const result = itemRows
        .map(item => ({ ...item, score: scoreMap.get(item.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return { items: result };
    }),

  /**
   * Thematic/Conceptual Search — search by concept, theme, or idea across all content.
   * Unlike keyword search, this finds semantically related content even without exact matches.
   */
  thematicSearch: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(500),
      namespace: z.enum(["books", "authors", "articles", "content_items", "rag_files", "all"]).default("all"),
      topK: z.number().int().min(1).max(30).default(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [] };

      const queryEmbedding = await embedText(input.query);

      let rawHits;
      if (input.namespace === "all") {
        rawHits = await queryAllNamespaces(queryEmbedding, input.topK);
      } else {
        rawHits = await queryVectors(queryEmbedding, input.namespace as any, {
          topK: input.topK,
        });
      }

      if (rawHits.length === 0) return { results: [] };

      // Deduplicate by sourceId + contentType
      const seen = new Set<string>();
      const deduped = rawHits.filter(h => {
        const key = `${h.metadata.contentType}:${h.metadata.sourceId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Rerank with bge-reranker-v2-m3 for better relevance ordering
      const rerankedResults = await rerankHits(input.query, deduped, input.topK);
      const uniqueHits = rerankedResults.slice(0, input.topK);

      // Enrich with DB data
      const bookIds = uniqueHits
        .filter(h => h.metadata.contentType === "book")
        .map(h => parseInt(h.metadata.sourceId, 10))
        .filter(id => !isNaN(id));

      const authorNames = uniqueHits
        .filter(h => h.metadata.contentType === "author")
        .map(h => h.metadata.authorName)
        .filter(Boolean) as string[];

      const [bookRows, authorRows] = await Promise.all([
        bookIds.length > 0
          ? db.select({
              id: bookProfiles.id,
              bookTitle: bookProfiles.bookTitle,
              authorName: bookProfiles.authorName,
              s3CoverUrl: bookProfiles.s3CoverUrl,
              coverImageUrl: bookProfiles.coverImageUrl,
              tagsJson: bookProfiles.tagsJson,
              amazonUrl: bookProfiles.amazonUrl,
            }).from(bookProfiles).where(inArray(bookProfiles.id, bookIds))
          : Promise.resolve([]),
        authorNames.length > 0
          ? db.select({
              id: authorProfiles.id,
              authorName: authorProfiles.authorName,
              s3AvatarUrl: authorProfiles.s3AvatarUrl,
              avatarUrl: authorProfiles.avatarUrl,
              tagsJson: authorProfiles.tagsJson,
            }).from(authorProfiles).where(inArray(authorProfiles.authorName, authorNames))
          : Promise.resolve([]),
      ]);

      const bookMap = new Map(bookRows.map(b => [b.id, b]));
      const authorMap = new Map(authorRows.map(a => [a.authorName, a]));

      const results = uniqueHits.map(h => {
        const base = {
          id: h.metadata.sourceId,
          contentType: h.metadata.contentType,
          title: h.metadata.title,
          authorName: h.metadata.authorName,
          source: h.metadata.source,
          url: h.metadata.url,
          score: h.score,
          snippet: h.metadata.text.slice(0, 200) + (h.metadata.text.length > 200 ? "…" : ""),
        };

        if (h.metadata.contentType === "book") {
          const book = bookMap.get(parseInt(h.metadata.sourceId, 10));
          return { ...base, coverUrl: book?.s3CoverUrl ?? book?.coverImageUrl, tagsJson: book?.tagsJson, amazonUrl: book?.amazonUrl };
        }
        if (h.metadata.contentType === "author") {
          const author = authorMap.get(h.metadata.authorName ?? "");
          return { ...base, avatarUrl: author?.s3AvatarUrl ?? author?.avatarUrl, tagsJson: author?.tagsJson };
        }
        return base;
      });

      return { results };
    }),

  /**
   * Personalized "What to Read Next" — uses the user's favorited books to build
   * a taste vector and finds the most similar un-read books.
   */
  personalizedNext: protectedProcedure
    .input(z.object({
      topK: z.number().int().min(1).max(20).default(8),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { books: [], reason: "Database unavailable" };

      const userId = ctx.user.openId;

      // 1. Fetch user's favorited books
      const userFavorites = await db
        .select({ entityKey: favorites.entityKey, entityType: favorites.entityType })
        .from(favorites)
        .where(eq(favorites.userId, userId));

      // Favorites store book titles as entityKey for books
      // We need to look up book IDs from titles
      const favBookTitles = userFavorites
        .filter(f => f.entityType === "book")
        .map(f => f.entityKey)
        .filter(Boolean);

      if (favBookTitles.length === 0) {
        return { books: [], reason: "No favorite books yet — add some favorites to get personalized recommendations!" };
      }

      // 2. Fetch summaries for favorited books to build taste profile
      const favBooks = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          summary: bookProfiles.summary,
          richSummaryJson: bookProfiles.richSummaryJson,
        })
        .from(bookProfiles)
        .where(inArray(bookProfiles.bookTitle, favBookTitles as [string, ...string[]]));

      if (favBooks.length === 0) return { books: [], reason: "Could not load favorite books" };

      // 3. Build a combined taste query from all favorites
      const tasteTexts = favBooks.map(b => {
        let text = b.summary ?? "";
        try {
          if (b.richSummaryJson) {
            const rich = typeof b.richSummaryJson === "string"
              ? JSON.parse(b.richSummaryJson as string)
              : b.richSummaryJson;
            if (rich?.fullSummary) text = rich.fullSummary;
          }
        } catch { /* use plain */ }
        return `${b.bookTitle}: ${text}`.slice(0, 500);
      });

      const tasteQuery = tasteTexts.join("\n\n").slice(0, 3000);

      // 4. Embed the combined taste profile
      const tasteEmbedding = await embedText(tasteQuery);

      // 5. Query Neon pgvector for similar books
      const hits = await queryVectors(tasteEmbedding, "books", {
        topK: input.topK + favBooks.length + 5,
      });

      // 6. Exclude already-favorited books
      const favTitleSet = new Set(favBooks.map(b => String(b.id)));
      const filteredHits = hits.filter(h => !favTitleSet.has(h.metadata.sourceId));

      // 7. Deduplicate by sourceId
      const seen = new Set<string>();
      const uniqueHits = filteredHits.filter(h => {
        if (seen.has(h.metadata.sourceId)) return false;
        seen.add(h.metadata.sourceId);
        return true;
      }).slice(0, input.topK);

      if (uniqueHits.length === 0) return { books: [], reason: "No new recommendations found" };

      // 8. Fetch full book data
      const bookIds = uniqueHits.map(h => parseInt(h.metadata.sourceId, 10)).filter(id => !isNaN(id));
      if (bookIds.length === 0) return { books: [], reason: "No matching books in database" };

      const bookRows = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          coverImageUrl: bookProfiles.coverImageUrl,
          summary: bookProfiles.summary,
          tagsJson: bookProfiles.tagsJson,
          amazonUrl: bookProfiles.amazonUrl,
        })
        .from(bookProfiles)
        .where(inArray(bookProfiles.id, bookIds));

      const scoreMap = new Map(uniqueHits.map(h => [parseInt(h.metadata.sourceId, 10), h.score]));
      const result = bookRows
        .map(b => ({ ...b, score: scoreMap.get(b.id) ?? 0 }))
        .sort((a, b) => b.score - a.score);

      return {
        books: result,
        reason: `Based on your ${favBooks.length} favorite book${favBooks.length !== 1 ? "s" : ""}`,
        basedOn: favBooks.map(b => b.bookTitle),
      };
    }),

  /**
   * RAG Chat Context — semantic chunk retrieval for the chatbot.
   * Returns the most relevant chunks from the rag_files namespace for a given query + author.
   * This is the upgraded version of the chatbot's RAG augmentation.
   */
  ragChatContext: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(1000),
      authorName: z.string().min(1),
      topK: z.number().int().min(1).max(10).default(5),
    }))
    .query(async ({ input }) => {
      const hits = await semanticSearch({
        query: input.query,
        namespace: "rag_files",
        filterAuthor: input.authorName,
        topK: input.topK,
      });

      return {
        chunks: hits.map(h => ({
          text: h.metadata.text,
          snippet: h.snippet,
          score: h.score,
          chunkIndex: h.metadata.chunkIndex ?? 0,
        })),
      };
    }),
});
