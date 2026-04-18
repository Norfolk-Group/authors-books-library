/**
 * vectorSearch.router.ts
 *
 * tRPC router for Neon pgvector search and RAG indexing.
 *
 * Procedures:
 *   vectorSearch.search             — semantic search across all content
 *   vectorSearch.searchArticles     — semantic search in magazine articles namespace
 *   vectorSearch.searchBooks        — semantic search in books namespace
 *   vectorSearch.indexArticle       — embed + upsert a single article
 *   vectorSearch.indexBatchArticles — embed + upsert unindexed articles for an author
 *   vectorSearch.indexAllArticles   — embed + upsert ALL unindexed articles (global batch)
 *   vectorSearch.indexAuthor        — embed + upsert an author's bio
 *   vectorSearch.indexBook          — embed + upsert a book's description
 *   vectorSearch.getStats           — Neon pgvector index stats (vector counts per namespace)
 *   vectorSearch.ensureIndex        — create the Neon pgvector table if it doesn't exist
 *   vectorSearch.startReindex       — start a full re-index job (authors + books), returns jobId
 *   vectorSearch.getReindexProgress — poll progress for a re-index job by jobId
 */

import { z } from "zod";
import { eq, isNull, sql, and } from "drizzle-orm";
import { getDb } from "../db";
import { magazineArticles, authorProfiles, bookProfiles, contentItems, authorRagProfiles } from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  semanticSearch,
  indexArticle,
  indexBook,
  indexAuthor,
  indexContentItem,
  indexRagFile,
  ensureIndex,
  getIndexStats,
} from "../services/ragPipeline.service";

// ── Router ────────────────────────────────────────────────────────────────────

export const vectorSearchRouter = router({
  /** Ensure the Neon pgvector index exists (idempotent) */
  ensureIndex: adminProcedure.mutation(async () => {
    await ensureIndex();
    return { success: true, indexName: "library-rag" };
  }),

  /** Public status check: returns total vector count (no admin required) */
  getPublicStatus: publicProcedure.query(async () => {
    try {
      const stats = await getIndexStats();
      const total = stats.totalVectorCount ?? 0;
      return { isActive: total > 0, totalVectors: total };
    } catch {
      return { isActive: false, totalVectors: 0 };
    }
  }),

  /** Get Neon pgvector index stats (vector counts per namespace) */
  getStats: adminProcedure.query(async () => {
    try {
      const stats = await getIndexStats();
      return {
        totalVectors: stats.totalVectorCount ?? 0,
        namespaces: stats.namespaces ?? {},
      };
    } catch {
      return { totalVectors: 0, namespaces: {} };
    }
  }),

  /** Semantic search across all content (articles + books + authors) */
  search: protectedProcedure
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
  searchArticles: protectedProcedure
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
  searchBooks: protectedProcedure
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

  /** Index ALL unindexed articles across all sources (global batch for Admin) */
  indexAllArticles: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const unindexed = await db
        .select()
        .from(magazineArticles)
        .where(eq(magazineArticles.ragIndexed, false))
        .limit(input.limit);
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
      return { indexed, totalVectors, remaining: unindexed.length - indexed };
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

  /** Bulk index ALL authors with sufficient bio text */
  indexAllAuthors: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(200),
      onlyMissing: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const authors = await db
        .select()
        .from(authorProfiles)
        .limit(input.limit);
      let indexed = 0;
      let skipped = 0;
      let totalVectors = 0;
      for (const author of authors) {
        // Use richBioJson.bio if available, fallback to bio field
        let bioText = author.bio ?? "";
        try {
          if (author.richBioJson) {
            const rich = typeof author.richBioJson === "string"
              ? JSON.parse(author.richBioJson)
              : author.richBioJson;
            if (rich?.bio && rich.bio.length > bioText.length) bioText = rich.bio;
            if (rich?.fullBio && rich.fullBio.length > bioText.length) bioText = rich.fullBio;
          }
        } catch { /* use plain bio */ }
        if (bioText.length < 50) { skipped++; continue; }
        try {
          const vectors = await indexAuthor({
            authorId: String(author.id),
            authorName: author.authorName,
            bioText,
          });
          totalVectors += vectors;
          indexed++;
        } catch { skipped++; }
      }
      return { indexed, skipped, totalVectors, attempted: authors.length };
    }),

  /** Bulk index ALL books with sufficient summary text */
  indexAllBooks: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(200),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const books = await db
        .select()
        .from(bookProfiles)
        .limit(input.limit);
      let indexed = 0;
      let skipped = 0;
      let totalVectors = 0;
      for (const book of books) {
        let text = book.summary ?? "";
        try {
          if (book.richSummaryJson) {
            const rich = typeof book.richSummaryJson === "string"
              ? JSON.parse(book.richSummaryJson)
              : book.richSummaryJson;
            if (rich?.fullSummary && rich.fullSummary.length > text.length) text = rich.fullSummary;
            if (rich?.summary && rich.summary.length > text.length) text = rich.summary;
          }
        } catch { /* use plain summary */ }
        if (text.length < 50) { skipped++; continue; }
        try {
          const vectors = await indexBook({
            bookId: String(book.id),
            title: book.bookTitle,
            authorName: book.authorName ?? undefined,
            text,
          });
          totalVectors += vectors;
          indexed++;
        } catch { skipped++; }
      }
      return { indexed, skipped, totalVectors, attempted: books.length };
    }),

  /** Bulk index ALL content items with descriptions */
  indexAllContentItems: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(1000).default(500),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const items = await db
        .select()
        .from(contentItems)
        .limit(input.limit);
      let indexed = 0;
      let skipped = 0;
      let totalVectors = 0;
      for (const item of items) {
        const description = item.description ?? item.title ?? "";
        if (description.length < 50) { skipped++; continue; }
        try {
          const vectors = await indexContentItem({
            itemId: String(item.id),
            title: item.title,
            authorName: undefined, // content_items links to authors via author_content_links table
            contentType: item.contentType ?? "unknown",
            url: item.url ?? undefined,
            description,
          });
          totalVectors += vectors;
          indexed++;
        } catch { skipped++; }
      }
      return { indexed, skipped, totalVectors, attempted: items.length };
    }),

  /** Bulk index ALL ready RAG files from S3 */
  indexAllRagFiles: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const ragProfiles = await db
        .select()
        .from(authorRagProfiles)
        .where(eq(authorRagProfiles.ragStatus, "ready"))
        .limit(input.limit);
      let indexed = 0;
      let skipped = 0;
      let totalVectors = 0;
      for (const profile of ragProfiles) {
        if (!profile.ragFileUrl) { skipped++; continue; }
        try {
          const resp = await fetch(profile.ragFileUrl);
          if (!resp.ok) { skipped++; continue; }
          const ragContent = await resp.text();
          if (ragContent.length < 100) { skipped++; continue; }
          const vectors = await indexRagFile({
            authorName: profile.authorName,
            ragContent,
            ragVersion: profile.ragVersion ?? 1,
          });
          totalVectors += vectors;
          indexed++;
        } catch { skipped++; }
      }
      return { indexed, skipped, totalVectors, attempted: ragProfiles.length };
    }),

  /** Bulk index EVERYTHING: authors + books + content items + RAG files */
  indexAll: adminProcedure
    .input(z.object({
      includeAuthors: z.boolean().default(true),
      includeBooks: z.boolean().default(true),
      includeContentItems: z.boolean().default(true),
      includeRagFiles: z.boolean().default(true),
      limit: z.number().int().min(1).max(500).default(200),
    }))
    .mutation(async () => {
      await ensureIndex();
      return { message: "Use startReindex for progress-tracked re-indexing", success: true };
    }),

  // ── Re-index All with live progress tracking ──────────────────────────────

  /** Start a full re-index job (authors + books). Returns a jobId to poll. */
  startReindex: adminProcedure.mutation(async () => {
    const jobId = `reindex-${Date.now()}`;
    reindexJobs.set(jobId, {
      jobId,
      status: "running",
      startedAt: Date.now(),
      stages: [
        { name: "authors", label: "Authors", status: "pending", indexed: 0, skipped: 0, total: 0 },
        { name: "books",   label: "Books",   status: "pending", indexed: 0, skipped: 0, total: 0 },
      ],
    });
    void runReindexJob(jobId);
    return { jobId };
  }),

  /** Poll progress for a re-index job */
  getReindexProgress: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = reindexJobs.get(input.jobId);
      if (!job) return null;
      return job;
    }),
});

// ── Re-index job store (in-memory, single-server) ────────────────────────────

type StageStatus = "pending" | "running" | "done" | "error";
type JobStatus   = "running" | "done" | "error";

interface ReindexStage {
  name: string;
  label: string;
  status: StageStatus;
  indexed: number;
  skipped: number;
  total: number;
  error?: string;
}

interface ReindexJob {
  jobId: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  stages: ReindexStage[];
}

const reindexJobs = new Map<string, ReindexJob>();

// Evict jobs older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of Array.from(reindexJobs.entries())) {
    if (job.startedAt < cutoff) reindexJobs.delete(id);
  }
}, 5 * 60 * 1000);

async function runReindexJob(jobId: string) {
  const job = reindexJobs.get(jobId);
  if (!job) return;

  const db = await getDb();
  if (!db) {
    job.status = "error";
    job.finishedAt = Date.now();
    return;
  }

  // ── Stage 1: Authors ──────────────────────────────────────────────────────
  const authorStage = job.stages[0];
  authorStage.status = "running";
  try {
    const authors = await db.select().from(authorProfiles).limit(500);
    authorStage.total = authors.length;
    for (const author of authors) {
      let bioText = author.bio ?? "";
      try {
        if (author.richBioJson) {
          const rich = typeof author.richBioJson === "string"
            ? JSON.parse(author.richBioJson as string)
            : author.richBioJson as Record<string, string>;
          if (rich?.bio && rich.bio.length > bioText.length) bioText = rich.bio;
          if (rich?.fullBio && rich.fullBio.length > bioText.length) bioText = rich.fullBio;
        }
      } catch { /* use plain bio */ }
      if (bioText.length < 50) { authorStage.skipped++; continue; }
      try {
        await indexAuthor({ authorId: String(author.id), authorName: author.authorName, bioText });
        authorStage.indexed++;
      } catch { authorStage.skipped++; }
    }
    authorStage.status = "done";
  } catch (err) {
    authorStage.status = "error";
    authorStage.error = String(err);
  }

  // ── Stage 2: Books ────────────────────────────────────────────────────────
  const bookStage = job.stages[1];
  bookStage.status = "running";
  try {
    const books = await db.select().from(bookProfiles).limit(500);
    bookStage.total = books.length;
    for (const book of books) {
      let text = book.summary ?? "";
      try {
        if (book.richSummaryJson) {
          const rich = typeof book.richSummaryJson === "string"
            ? JSON.parse(book.richSummaryJson as string)
            : book.richSummaryJson as Record<string, string>;
          if (rich?.fullSummary && rich.fullSummary.length > text.length) text = rich.fullSummary;
          if (rich?.summary && rich.summary.length > text.length) text = rich.summary;
        }
      } catch { /* use plain summary */ }
      if (text.length < 50) { bookStage.skipped++; continue; }
      try {
        await indexBook({ bookId: String(book.id), title: book.bookTitle, authorName: book.authorName ?? undefined, text });
        bookStage.indexed++;
      } catch { bookStage.skipped++; }
    }
    bookStage.status = "done";
  } catch (err) {
    bookStage.status = "error";
    bookStage.error = String(err);
  }

  job.status = job.stages.some(s => s.status === "error") ? "error" : "done";
  job.finishedAt = Date.now();
}
