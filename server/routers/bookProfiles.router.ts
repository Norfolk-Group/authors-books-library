/**
 * Book Profiles Router
 * Handles enrichment of book metadata using Google Books API:
 * cover image, summary, publisher, published date, ISBN, ratings.
 * Amazon and Goodreads links are constructed from search queries.
 */
import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";

// CRUD handlers
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
    .mutation(({ input }) => handleCreateBook(input)),

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
    .mutation(({ input }) => handleUpdateBook(input)),

  deleteBook: adminProcedure
    .input(z.object({ bookTitle: z.string().min(1) }))
    .mutation(({ input }) => handleDeleteBook(input)),
});
