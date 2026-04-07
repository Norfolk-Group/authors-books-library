/**
 * Book Profiles Router
 * Handles enrichment of book metadata using Google Books API:
 * cover image, summary, publisher, published date, ISBN, ratings.
 * Amazon and Goodreads links are constructed from search queries.
 */
import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";

/// CRUD handlers
import {
  handleGet,
  handleGetMany,
  handleGetAllEnrichedTitles,
  handleGetAllFreshness,
  handleGetSummaryStats,
  handleCreateBook,
  handleUpdateBook,
  handleDeleteBook,
  handleGetReadingNotes,
  handleSyncReadingNotes,
} from "../lib/bookHandlers/crudHandlers";

// Cover handlers
import {
  handleMirrorCovers,
  handleGetMirrorCoverStats,
  handleRebuildAllBookCovers,
} from "../lib/bookHandlers/coverHandlers";

// Enrichment handlers
import {
  handleEnrich,
  handleEnrichBatch,
  handleUpdateBookSummary,
  handleUpdateAllBookSummaries,
  handleEnrichAllMissingSummaries,
  handleEnrichRichSummary,
  handleEnrichRichSummaryBatch,
  handleGetRichSummary,
  handleEnrichTechnicalReferences,
  handleGetTechnicalReferences,
  handleEnrichTechnicalReferencesBatch,
} from "../lib/bookHandlers/enrichmentHandlers";

// Incremental Pinecone indexing (fire-and-forget)
import { indexBookIncremental } from "../services/incrementalIndex.service";

// -- Router -----------------------------------------------------------------

export const bookProfilesRouter = router({
  get: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(({ input }) => handleGet(input)),

  getMany: publicProcedure
    .input(z.object({ bookTitles: z.array(z.string()).max(200) }))
    .query(({ input }) => handleGetMany(input)),

  getAllEnrichedTitles: publicProcedure
    .query(() => handleGetAllEnrichedTitles()),

  getAllFreshness: publicProcedure
    .query(() => handleGetAllFreshness()),

  enrich: adminProcedure
    .input(z.object({ bookTitle: z.string(), authorName: z.string().optional(), model: z.string().optional(), secondaryModel: z.string().optional() }))
    .mutation(({ input }) => handleEnrich(input)),

  mirrorCovers: adminProcedure
    .input(z.object({ batchSize: z.number().min(1).max(20).default(10) }))
    .mutation(({ input }) => handleMirrorCovers(input)),

  getMirrorCoverStats: publicProcedure
    .query(() => handleGetMirrorCoverStats()),

  enrichBatch: adminProcedure
    .input(z.object({
      books: z.array(z.object({ bookTitle: z.string(), authorName: z.string().optional() })).max(10),
      model: z.string().optional(),
      secondaryModel: z.string().optional(),
    }))
    .mutation(({ input }) => handleEnrichBatch(input)),

  getSummaryStats: publicProcedure
    .query(() => handleGetSummaryStats()),

  updateBookSummary: adminProcedure
    .input(z.object({
      bookTitle: z.string(),
      authorName: z.string().optional(),
      researchVendor: z.string().optional(),
      researchModel: z.string().optional(),
    }))
    .mutation(({ input }) => handleUpdateBookSummary(input)),

  updateAllBookSummaries: adminProcedure
    .input(z.object({
      researchVendor: z.string().optional(),
      researchModel: z.string().optional(),
      onlyMissing: z.boolean().optional().default(true),
      concurrency: z.number().min(1).max(10).optional().default(3),
    }))
    .mutation(({ input }) => handleUpdateAllBookSummaries(input)),

  enrichAllMissingSummaries: adminProcedure
    .input(z.object({ model: z.string().optional() }))
    .mutation(({ input }) => handleEnrichAllMissingSummaries(input)),

  rebuildAllBookCovers: adminProcedure
    .input(z.object({
      concurrency: z.number().min(1).max(5).optional().default(2),
      rescrapeAll: z.boolean().optional().default(false),
    }))
    .mutation(({ input }) => handleRebuildAllBookCovers(input)),

  enrichRichSummary: adminProcedure
    .input(z.object({
      bookTitle: z.string(),
      authorName: z.string().optional(),
      force: z.boolean().optional().default(false),
    }))
    .mutation(({ input }) => handleEnrichRichSummary(input)),

  enrichRichSummaryBatch: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).optional().default(50),
      force: z.boolean().optional().default(false),
    }))
    .mutation(({ input }) => handleEnrichRichSummaryBatch(input)),

  getRichSummary: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(({ input }) => handleGetRichSummary(input)),

  enrichTechnicalReferences: adminProcedure
    .input(z.object({ bookTitle: z.string() }))
    .mutation(({ input }) => handleEnrichTechnicalReferences(input)),

  getTechnicalReferences: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(({ input }) => handleGetTechnicalReferences(input)),

  getReadingNotes: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(({ input }) => handleGetReadingNotes(input)),

  syncReadingNotes: adminProcedure
    .input(z.object({
      bookTitle: z.string(),
      notionPageId: z.string(),
    }))
    .mutation(({ input }) => handleSyncReadingNotes(input)),

  enrichTechnicalReferencesBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(({ input }) => handleEnrichTechnicalReferencesBatch(input)),

  // ── Book CRUD (create / update / delete) ─────────────────────────────────
  createBook: adminProcedure
    .input(z.object({
      bookTitle: z.string().min(1).max(512),
      authorName: z.string().optional(),
      summary: z.string().optional(),
      keyThemes: z.string().optional(),
      amazonUrl: z.string().url().optional().or(z.literal("")),
      goodreadsUrl: z.string().url().optional().or(z.literal("")),
      wikipediaUrl: z.string().url().optional().or(z.literal("")),
      publisherUrl: z.string().url().optional().or(z.literal("")),
      coverImageUrl: z.string().url().optional().or(z.literal("")),
      isbn: z.string().optional(),
      publishedDate: z.string().optional(),
      publisher: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
      format: z.enum(["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]).optional(),
      possessionStatus: z.enum(["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await handleCreateBook(input);
      // Fire-and-forget: index in Pinecone and check for near-duplicates
      if (result) {
        indexBookIncremental(result.id, result.bookTitle, result.authorName, result.summary, result.keyThemes).catch(() => {});
      }
      return result;
    }),
  updateBook: adminProcedure
    .input(z.object({
      bookTitle: z.string().min(1),
      authorName: z.string().optional(),
      summary: z.string().optional(),
      keyThemes: z.string().optional(),
      amazonUrl: z.string().url().optional().or(z.literal("")),
      goodreadsUrl: z.string().url().optional().or(z.literal("")),
      wikipediaUrl: z.string().url().optional().or(z.literal("")),
      publisherUrl: z.string().url().optional().or(z.literal("")),
      coverImageUrl: z.string().url().optional().or(z.literal("")),
      isbn: z.string().optional(),
      publishedDate: z.string().optional(),
      publisher: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
      format: z.enum(["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]).optional().nullable(),
      possessionStatus: z.enum(["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]).optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const result = await handleUpdateBook(input);
      // Fire-and-forget: re-index in Pinecone after update
      if (result) {
        indexBookIncremental(result.id, result.bookTitle, result.authorName, result.summary, result.keyThemes).catch(() => {});
      }
      return result;
    }),
  deleteBook: adminProcedure
    .input(z.object({ bookTitle: z.string().min(1) }))
    .mutation(({ input }) => handleDeleteBook(input)),

  /** Update reading progress for a book (public — single user app) */
  updateReadingProgress: publicProcedure
    .input(z.object({
      bookTitle: z.string().min(1),
      readingProgressPercent: z.number().min(0).max(100).nullable().optional(),
      readingStartedAt: z.date().nullable().optional(),
      readingFinishedAt: z.date().nullable().optional(),
      personalNotes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { bookProfiles } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.readingProgressPercent !== undefined) updates.readingProgressPercent = input.readingProgressPercent;
      if (input.readingStartedAt !== undefined) updates.readingStartedAt = input.readingStartedAt;
      if (input.readingFinishedAt !== undefined) updates.readingFinishedAt = input.readingFinishedAt;
      if (input.personalNotes !== undefined) {
        updates.personalNotesJson = input.personalNotes
          ? JSON.stringify({ notes: input.personalNotes, updatedAt: new Date().toISOString() })
          : null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(bookProfiles).set(updates as any).where(eq(bookProfiles.bookTitle, input.bookTitle));
      return { success: true };
    }),

  /** Get reading stats across all books (for the Stats dashboard) */
  getReadingStats: publicProcedure
    .query(async () => {
      const { getDb } = await import("../db");
      const { bookProfiles } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) return null;
      const books = await db
        .select({
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
          possessionStatus: bookProfiles.possessionStatus,
          format: bookProfiles.format,
          rating: bookProfiles.rating,
          readingProgressPercent: bookProfiles.readingProgressPercent,
          readingStartedAt: bookProfiles.readingStartedAt,
          readingFinishedAt: bookProfiles.readingFinishedAt,
          enrichedAt: bookProfiles.enrichedAt,
          publishedDate: bookProfiles.publishedDate,
          tagsJson: bookProfiles.tagsJson,
        })
        .from(bookProfiles);
      const byStatus: Record<string, number> = {};
      const byFormat: Record<string, number> = {};
      let totalRating = 0, ratingCount = 0;
      const readDates: Date[] = [];
      for (const b of books) {
        const s = b.possessionStatus ?? "unknown";
        byStatus[s] = (byStatus[s] ?? 0) + 1;
        const f = b.format ?? "unknown";
        byFormat[f] = (byFormat[f] ?? 0) + 1;
        if (b.rating) { totalRating += parseFloat(b.rating); ratingCount++; }
        if (b.readingFinishedAt) readDates.push(b.readingFinishedAt);
      }
      return {
        total: books.length,
        byStatus,
        byFormat,
        avgRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : null,
        readCount: (byStatus["read"] ?? 0),
        readingCount: (byStatus["reading"] ?? 0),
        wishlistCount: (byStatus["wishlist"] ?? 0),
        readDates: readDates.sort((a, b) => a.getTime() - b.getTime()),
        books: books.map(b => ({
          bookTitle: b.bookTitle,
          authorName: b.authorName,
          possessionStatus: b.possessionStatus,
          format: b.format,
          rating: b.rating ? parseFloat(b.rating) : null,
          readingProgressPercent: b.readingProgressPercent,
          readingStartedAt: b.readingStartedAt,
          readingFinishedAt: b.readingFinishedAt,
          publishedDate: b.publishedDate,
        })),
      };
    }),
});
