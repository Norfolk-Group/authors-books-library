/**
 * Book Profiles Router
 * Handles enrichment of book metadata using Google Books API:
 * cover image, summary, publisher, published date, ISBN, ratings.
 * Amazon and Goodreads links are constructed from search queries.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles } from "../../drizzle/schema";
import { eq, inArray, isNotNull, isNull, or, and, ne } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";

import { enrichBookViaGoogleBooks } from "../lib/bookEnrichment";

// -- Router -----------------------------------------------------------------

export const bookProfilesRouter = router({
  /** Get a single book profile by title */
  get: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Get multiple book profiles by title */
  getMany: publicProcedure
    .input(z.object({ bookTitles: z.array(z.string()).max(200) }))
    .query(async ({ input }) => {
      if (input.bookTitles.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(bookProfiles)
        .where(inArray(bookProfiles.bookTitle, input.bookTitles));
    }),

  /** Get all book titles that have been enriched (for indicator display) */
  getAllEnrichedTitles: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ bookTitle: bookProfiles.bookTitle })
      .from(bookProfiles)
      .where(isNotNull(bookProfiles.enrichedAt));
    return rows.map((r: { bookTitle: string }) => r.bookTitle);
  }),

  /** Enrich a single book - auto-skips if enriched within 30 days */
  enrich: publicProcedure
    .input(z.object({ bookTitle: z.string(), authorName: z.string().optional(), model: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle))
        .limit(1);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
        return { skipped: true, profile: existing[0] };
      }

      const enriched = await enrichBookViaGoogleBooks(input.bookTitle, input.authorName ?? "", input.model);

      await db
        .insert(bookProfiles)
        .values({
          bookTitle: input.bookTitle,
          authorName: input.authorName ?? "",
          ...enriched,
          enrichedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            authorName: input.authorName ?? "",
            ...enriched,
            enrichedAt: new Date(),
          },
        });

      const updated = await db
        .select()
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle))
        .limit(1);

      return { skipped: false, profile: updated[0] };
    }),

  /**
   * Mirror book cover images to Manus S3 for stable CDN serving.
   * Processes books that have a coverImageUrl but no s3CoverUrl yet.
   */
  mirrorCovers: publicProcedure
    .input(z.object({ batchSize: z.number().min(1).max(20).default(10) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pending = await db
        .select({
          id: bookProfiles.id,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverKey: bookProfiles.s3CoverKey,
        })
        .from(bookProfiles)
        .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, "")))
        .limit(input.batchSize);
      const toMirror = pending.filter((b) => b.coverImageUrl?.startsWith("http"));
      if (toMirror.length === 0) {
        return { mirrored: 0, skipped: pending.length, failed: 0, total: pending.length };
      }
      const results = await mirrorBatchToS3(
        toMirror.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
        "book-covers"
      );
      let mirrored = 0;
      let failed = 0;
      for (const result of results) {
        if (result.url && result.key) {
          await db.update(bookProfiles)
            .set({ s3CoverUrl: result.url, s3CoverKey: result.key })
            .where(eq(bookProfiles.id, result.id));
          mirrored++;
        } else {
          failed++;
        }
      }
      return { mirrored, skipped: pending.length - toMirror.length, failed, total: pending.length };
    }),

  /** Count how many book covers still need S3 mirroring */
  getMirrorCoverStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { withCover: 0, mirrored: 0, pending: 0 };
    const all = await db
      .select({ coverImageUrl: bookProfiles.coverImageUrl, s3CoverUrl: bookProfiles.s3CoverUrl })
      .from(bookProfiles);
    const withCover = all.filter((b) => b.coverImageUrl?.startsWith("http")).length;
    const mirrored = all.filter((b) => b.s3CoverUrl?.startsWith("http")).length;
    return { withCover, mirrored, pending: withCover - mirrored };
  }),

  /** Enrich a batch of books (up to 10 at a time) */
  enrichBatch: publicProcedure
    .input(
      z.object({
        books: z.array(
          z.object({ bookTitle: z.string(), authorName: z.string().optional() })
        ).max(10),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const results: { bookTitle: string; status: "enriched" | "skipped" | "error" }[] = [];

      for (const item of input.books) {
        try {
          const existing = await db
            .select()
            .from(bookProfiles)
            .where(eq(bookProfiles.bookTitle, item.bookTitle))
            .limit(1);

          if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
            results.push({ bookTitle: item.bookTitle, status: "skipped" });
            continue;
          }

          const enriched = await enrichBookViaGoogleBooks(item.bookTitle, item.authorName ?? "", input.model);

          await db
            .insert(bookProfiles)
            .values({
              bookTitle: item.bookTitle,
              authorName: item.authorName ?? "",
              ...enriched,
              enrichedAt: new Date(),
            })
            .onDuplicateKeyUpdate({
              set: {
                authorName: item.authorName ?? "",
                ...enriched,
                enrichedAt: new Date(),
              },
            });

          results.push({ bookTitle: item.bookTitle, status: "enriched" });
        } catch {
          results.push({ bookTitle: item.bookTitle, status: "error" });
        }
      }

      // Auto-mirror newly enriched covers to S3 in the background (fire-and-forget)
      const enrichedCount = results.filter((r) => r.status === "enriched").length;
      if (enrichedCount > 0) {
        void (async () => {
          try {
            const pending = await db
              .select({ id: bookProfiles.id, coverImageUrl: bookProfiles.coverImageUrl, s3CoverKey: bookProfiles.s3CoverKey })
              .from(bookProfiles)
              .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, "")))
              .limit(enrichedCount);
            const toMirror = pending.filter((b) => b.coverImageUrl?.startsWith("http"));
            if (toMirror.length > 0) {
              const mirrorResults = await mirrorBatchToS3(
                toMirror.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
                "book-covers"
              );
              for (const r of mirrorResults) {
                if (r.url && r.key) {
                  await db.update(bookProfiles)
                    .set({ s3CoverUrl: r.url, s3CoverKey: r.key })
                    .where(eq(bookProfiles.id, r.id));
                }
              }
              console.log(`[auto-mirror] Mirrored ${mirrorResults.filter((r) => r.url).length} book covers to S3`);
            }
          } catch (err) {
            console.error("[auto-mirror] Book cover mirror failed:", err);
          }
        })();
      }

      return results;
    }),

  /**
   * Return counts of books with/without summaries for the admin dashboard.
   */
  getSummaryStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, withSummary: 0, missingSummary: 0 };
    const all = await db
      .select({ summary: bookProfiles.summary })
      .from(bookProfiles);
    const withSummary = all.filter((b) => b.summary && b.summary.trim().length > 0).length;
    return { total: all.length, withSummary, missingSummary: all.length - withSummary };
  }),

  /**
   * Enrich all books that are missing a summary.
   * Processes in batches of 5 to avoid rate-limiting.
   * Returns { total, enriched, skipped, failed } counts.
   */
  enrichAllMissingSummaries: publicProcedure
    .input(z.object({ model: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find all books with no summary (or empty summary)
      const missing = await db
        .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
        .from(bookProfiles)
        .where(
          or(
            isNull(bookProfiles.summary),
            eq(bookProfiles.summary, "")
          )
        );

      const total = missing.length;
      let enriched = 0;
      let failed = 0;
      let skipped = 0;

      // Process in batches of 5 to avoid overwhelming the API
      const BATCH_SIZE = 5;
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const data = await enrichBookViaGoogleBooks(
                item.bookTitle,
                item.authorName ?? "",
                input.model
              );
              if (!data.summary) {
                skipped++;
                return;
              }
              await db
                .update(bookProfiles)
                .set({ summary: data.summary, enrichedAt: new Date() })
                .where(eq(bookProfiles.bookTitle, item.bookTitle));
              enriched++;
            } catch {
              failed++;
            }
          })
        );
      }

      return { total, enriched, skipped, failed };
    }),
});
