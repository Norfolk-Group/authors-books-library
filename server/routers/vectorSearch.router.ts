/**
 * vectorSearch.router.ts
 *
 * tRPC router for Pinecone vector search and RAG indexing.
 *
 * Procedures:
 *   vectorSearch.search           — semantic search across all content
 *   vectorSearch.searchArticles   — semantic search in magazine articles namespace
 *   vectorSearch.searchBooks      — semantic search in books namespace
 *   vectorSearch.indexArticle     — embed + upsert a single article
 *   vectorSearch.indexBatchArticles — embed + upsert unindexed articles for an author
 *   vectorSearch.indexAuthor      — embed + upsert an author's bio
 *   vectorSearch.indexBook        — embed + upsert a book's description
 *   vectorSearch.getStats         — Pinecone index stats (vector counts per namespace)
 *   vectorSearch.ensureIndex      — create the Pinecone index if it doesn't exist
 */

import { z } from "zod";
import { eq, isNull, sql, and } from "drizzle-orm";
import { getDb } from "../db";
import { magazineArticles, authorProfiles, bookProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import {
  semanticSearch,
  indexArticle,
  indexBook,
  indexAuthor,
  ensureIndex,
  getIndexStats,
} from "../services/ragPipeline.service";

// ── Router ────────────────────────────────────────────────────────────────────

export const vectorSearchRouter = router({
  /** Ensure the Pinecone index exists (idempotent) */
  ensureIndex: adminProcedure.mutation(async () => {
    await ensureIndex();
    return { success: true, indexName: "library-rag" };
  }),

  /** Get Pinecone index stats (vector counts per namespace) */
  getStats: adminProcedure.query(async () => {
    try {
      const stats = await getIndexStats();
      return {
        totalVectors: stats.totalRecordCount ?? 0,
        namespaces: stats.namespaces ?? {},
      };
    } catch {
      return { totalVectors: 0, namespaces: {} };
    }
  }),

  /** Semantic search across all content (articles + books + authors) */
  search: publicProcedure
    .input(z.object({
      query: z.string().min(3).max(500),
      namespace: z.enum(["articles", "books", "authors"]).optional(),
      topK: z.number().int().min(1).max(30).default(10),
      filterAuthor: z.string().optional(),
      filterSource: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const results = await semanticSearch({
        query: input.query,
        namespace: input.namespace,
        topK: input.topK,
        filterAuthor: input.filterAuthor,
        filterSource: input.filterSource,
      });
      return results;
    }),

  /** Semantic search within magazine articles only */
  searchArticles: publicProcedure
    .input(z.object({
      query: z.string().min(3).max(500),
      topK: z.number().int().min(1).max(20).default(8),
      filterAuthor: z.string().optional(),
      filterSource: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return semanticSearch({
        query: input.query,
        namespace: "articles",
        topK: input.topK,
        filterAuthor: input.filterAuthor,
        filterSource: input.filterSource,
      });
    }),

  /** Semantic search within books only */
  searchBooks: publicProcedure
    .input(z.object({
      query: z.string().min(3).max(500),
      topK: z.number().int().min(1).max(20).default(8),
      filterAuthor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return semanticSearch({
        query: input.query,
        namespace: "books",
        topK: input.topK,
        filterAuthor: input.filterAuthor,
      });
    }),

  /** Embed and index a single magazine article by articleId */
  indexArticle: adminProcedure
    .input(z.object({ articleId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [article] = await db
        .select()
        .from(magazineArticles)
        .where(eq(magazineArticles.articleId, input.articleId))
        .limit(1);

      if (!article) throw new Error("Article not found");

      const text = article.fullText ?? article.summaryText ?? article.title;
      if (!text || text.length < 50) {
        return { success: false, reason: "Insufficient text content", vectors: 0 };
      }

      const vectors = await indexArticle({
        articleId: article.articleId,
        title: article.title,
        authorName: article.authorName,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt,
        text,
      });

      // Mark as indexed
      await db
        .update(magazineArticles)
        .set({ ragIndexed: true, ragIndexedAt: new Date(), updatedAt: new Date() })
        .where(eq(magazineArticles.articleId, input.articleId));

      return { success: true, vectors };
    }),

  /** Index all unindexed articles for a given author (batch) */
  indexBatchArticles: adminProcedure
    .input(z.object({
      authorName: z.string().min(2),
      batchSize: z.number().int().min(1).max(20).default(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const normalizedName = input.authorName
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const unindexed = await db
        .select()
        .from(magazineArticles)
        .where(
          and(
            sql`${magazineArticles.authorNameNormalized} LIKE ${`%${normalizedName}%`}`,
            eq(magazineArticles.ragIndexed, false)
          )
        )
        .limit(input.batchSize);

      let totalVectors = 0;
      let indexed = 0;

      for (const article of unindexed) {
        const text = article.fullText ?? article.summaryText ?? article.title;
        if (!text || text.length < 50) continue;

        try {
          const vectors = await indexArticle({
            articleId: article.articleId,
            title: article.title,
            authorName: article.authorName,
            source: article.source,
            url: article.url,
            publishedAt: article.publishedAt,
            text,
          });
          await db
            .update(magazineArticles)
          .set({ ragIndexed: true, ragIndexedAt: new Date(), updatedAt: new Date() })
              .where(eq(magazineArticles.articleId, article.articleId));
          totalVectors += vectors;
          indexed++;
        } catch {
          // Continue with next article on error
        }
      }

      return { indexed, totalVectors, attempted: unindexed.length };
    }),

  /** Embed and index an author's bio text */
  indexAuthor: adminProcedure
    .input(z.object({ authorId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [author] = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.id, parseInt(input.authorId)))
        .limit(1);

      if (!author) throw new Error("Author not found");

      const bioText = author.bio ?? "";
      if (bioText.length < 50) {
        return { success: false, reason: "Insufficient bio text", vectors: 0 };
      }

      const vectors = await indexAuthor({
        authorId: String(author.id),
        authorName: author.authorName,
        bioText,
      });

      return { success: true, vectors };
    }),

  /** Embed and index a book's description */
  indexBook: adminProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [book] = await db
        .select()
        .from(bookProfiles)
        .where(eq(bookProfiles.id, parseInt(input.bookId)))
        .limit(1);

      if (!book) throw new Error("Book not found");

      const text = book.summary ?? book.bookTitle ?? "";
      if (text.length < 50) {
        return { success: false, reason: "Insufficient text", vectors: 0 };
      }

      const vectors = await indexBook({
        bookId: String(book.id),
        title: book.bookTitle,
        authorName: book.authorName ?? undefined,
        text,
      });

      return { success: true, vectors };
    }),
});
