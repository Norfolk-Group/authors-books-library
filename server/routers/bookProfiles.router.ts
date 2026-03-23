/**
 * Book Profiles Router
 * Handles enrichment of book metadata using Google Books API:
 * cover image, summary, publisher, published date, ISBN, ratings.
 * Amazon and Goodreads links are constructed from search queries.
 */
import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles } from "../../drizzle/schema";
import { eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";

import { enrichBookViaGoogleBooks } from "../lib/bookEnrichment";
import { enrichRichSummary } from "../enrichment/richSummary";
import { parallelBatch } from "../lib/parallelBatch";

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
  enrich: adminProcedure
    .input(z.object({ bookTitle: z.string(), authorName: z.string().optional(), model: z.string().optional(), secondaryModel: z.string().optional() }))
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

      const enriched = await enrichBookViaGoogleBooks(input.bookTitle, input.authorName ?? "", input.model, input.secondaryModel);

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
  mirrorCovers: adminProcedure
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
  enrichBatch: adminProcedure
    .input(
      z.object({
        books: z.array(
          z.object({ bookTitle: z.string(), authorName: z.string().optional() })
        ).max(10),
        model: z.string().optional(),
        secondaryModel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const results: { bookTitle: string; status: "enriched" | "skipped" | "error" }[] = [];

      // Pre-fetch all existing rows in a single query (avoids N+1 per-book lookup)
      const bookTitles = input.books.map((b) => b.bookTitle);
      const existingRows = bookTitles.length > 0
        ? await db
            .select()
            .from(bookProfiles)
            .where(inArray(bookProfiles.bookTitle, bookTitles))
        : [];
      const existingMap = new Map(existingRows.map((r) => [r.bookTitle, r]));

      for (const item of input.books) {
        try {
          const existing = existingMap.get(item.bookTitle);
          if (existing?.enrichedAt && existing.enrichedAt > thirtyDaysAgo) {
            results.push({ bookTitle: item.bookTitle, status: "skipped" });
            continue;
          }

          const enriched = await enrichBookViaGoogleBooks(item.bookTitle, item.authorName ?? "", input.model, input.secondaryModel);

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
   * Update a single book's summary using the AI enrichment pipeline.
   * Uses Perplexity (web-grounded) as primary, Gemini as fallback.
   */
  updateBookSummary: adminProcedure
    .input(
      z.object({
        bookTitle: z.string(),
        authorName: z.string().optional(),
        researchVendor: z.string().optional(),
        researchModel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { enrichBookSummary } = await import("../lib/bookSummary");
      const result = await enrichBookSummary(
        input.bookTitle,
        input.authorName ?? "",
        input.researchVendor ?? "perplexity",
        input.researchModel ?? "sonar-pro"
      );
      if (!result.summary) throw new Error("Failed to generate summary");
      await db
        .update(bookProfiles)
        .set({
          summary: result.summary || undefined,
          keyThemes: result.keyThemes || undefined,
          rating: result.rating,
          ratingCount: result.ratingCount,
          publishedDate: result.publishedDate,
          publisher: result.publisher,
          isbn: result.isbn,
          amazonUrl: result.amazonUrl,
          goodreadsUrl: result.goodreadsUrl,
          publisherUrl: result.publisherUrl,
          summaryEnrichmentSource: result.source,
          lastSummaryEnrichedAt: new Date(),
          enrichedAt: new Date(),
        })
        .where(eq(bookProfiles.bookTitle, input.bookTitle));
      return { success: true, source: result.source, summary: result.summary };
    }),

  /**
   * Update summaries for all books in the database using the AI pipeline.
   * Processes in batches of 5. Returns progress counts.
   */
  updateAllBookSummaries: adminProcedure
    .input(
      z.object({
        researchVendor: z.string().optional(),
        researchModel: z.string().optional(),
        onlyMissing: z.boolean().optional().default(true),
        concurrency: z.number().min(1).max(10).optional().default(3),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { enrichBookSummary } = await import("../lib/bookSummary");
      const books = input.onlyMissing
        ? await db
            .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
            .from(bookProfiles)
            .where(or(isNull(bookProfiles.summary), eq(bookProfiles.summary, "")))
        : await db
            .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
            .from(bookProfiles);
      const total = books.length;

      const batchResult = await parallelBatch(
        books.map((b) => `${b.bookTitle}|||${b.authorName ?? ""}`),
        input.concurrency ?? 3,
        async (key) => {
          const [bookTitle, authorName] = key.split("|||");
          const result = await enrichBookSummary(
            bookTitle,
            authorName,
            input.researchVendor ?? "perplexity",
            input.researchModel ?? "sonar-pro"
          );
          if (!result.summary) throw new Error("No summary returned");
          await db
            .update(bookProfiles)
            .set({
              summary: result.summary || undefined,
              keyThemes: result.keyThemes || undefined,
              rating: result.rating,
              ratingCount: result.ratingCount,
              publishedDate: result.publishedDate,
              publisher: result.publisher,
              isbn: result.isbn,
              amazonUrl: result.amazonUrl,
              goodreadsUrl: result.goodreadsUrl,
              publisherUrl: result.publisherUrl,
              summaryEnrichmentSource: result.source,
              lastSummaryEnrichedAt: new Date(),
              enrichedAt: new Date(),
            })
            .where(eq(bookProfiles.bookTitle, bookTitle));
          return { bookTitle, success: true };
        }
      );

      return { total, enriched: batchResult.succeeded, failed: batchResult.failed };
    }),

  /**
   * Enrich all books that are missing a summary.
   * Processes in batches of 5 to avoid rate-limiting.
   * Returns { total, enriched, skipped, failed } counts.
   */
  enrichAllMissingSummaries: adminProcedure
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

      const batchResult = await parallelBatch(
        missing.map((b) => `${b.bookTitle}|||${b.authorName ?? ""}`),
        3,
        async (key) => {
          const [bookTitle, authorName] = key.split("|||");
          const data = await enrichBookViaGoogleBooks(bookTitle, authorName, input.model);
          if (!data.summary) return { bookTitle, skipped: true };
          await db
            .update(bookProfiles)
            .set({ summary: data.summary, enrichedAt: new Date() })
            .where(eq(bookProfiles.bookTitle, bookTitle));
          return { bookTitle, skipped: false };
        }
      );

      const skipped = batchResult.results.filter((r) => r.result?.skipped).length;
      return {
        total,
        enriched: batchResult.succeeded - skipped,
        skipped,
        failed: batchResult.failed,
      };
    }),

  /**
   * Rebuild the entire book cover database:
   * 1. Upgrade all existing low-res Amazon URLs in-place (_AC_UY218_ → _SX600_)
   * 2. Re-scrape Amazon for books with failed/missing covers
   * 3. Null out all S3 mirrors so they get re-mirrored at the new resolution
   * 4. Trigger a full S3 re-mirror pass
   * Returns counts of upgraded, re-scraped, failed, and mirrored books.
   */
  rebuildAllBookCovers: adminProcedure
    .input(z.object({
      concurrency: z.number().min(1).max(5).optional().default(2),
      rescrapeAll: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { upgradeAmazonImageResolution, scrapeAmazonBook } = await import("../apify");
      const { mirrorBatchToS3 } = await import("../mirrorToS3");

      // ── Step 1: Upgrade all low-res Amazon URLs in-place ──────────────────
      const allBooks = await db
        .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, coverImageUrl: bookProfiles.coverImageUrl })
        .from(bookProfiles);

      let upgraded = 0;
      const upgradeUpdates: Promise<unknown>[] = [];
      for (const book of allBooks) {
        if (!book.coverImageUrl || !book.coverImageUrl.startsWith('http')) continue;
        const upgraded_url = upgradeAmazonImageResolution(book.coverImageUrl);
        if (upgraded_url !== book.coverImageUrl) {
          upgradeUpdates.push(
            db.update(bookProfiles)
              .set({ coverImageUrl: upgraded_url, s3CoverUrl: null, s3CoverKey: null })
              .where(eq(bookProfiles.id, book.id))
          );
          upgraded++;
        }
      }
      // Also null out S3 mirrors for books being re-scraped (rescrapeAll mode)
      if (input.rescrapeAll) {
        for (const book of allBooks) {
          upgradeUpdates.push(
            db.update(bookProfiles)
              .set({ coverImageUrl: null, s3CoverUrl: null, s3CoverKey: null })
              .where(eq(bookProfiles.id, book.id))
          );
        }
      }
      await Promise.all(upgradeUpdates);
      console.log(`[rebuild-covers] Upgraded ${upgraded} low-res Amazon URLs to _SX600_`);

      // ── Step 2: Re-scrape books with failed/missing covers ─────────────────
      const needsScrape = await db
        .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, coverImageUrl: bookProfiles.coverImageUrl })
        .from(bookProfiles)
        .where(
          or(
            isNull(bookProfiles.coverImageUrl),
            eq(bookProfiles.coverImageUrl, ''),
            eq(bookProfiles.coverImageUrl, 'not-found'),
            eq(bookProfiles.coverImageUrl, 'skipped'),
          )
        );

      // Build a lookup map for id by bookTitle
      const bookIdMap = new Map(needsScrape.map((b) => [b.bookTitle, b.id]));
      const bookAuthorMap = new Map(needsScrape.map((b) => [b.bookTitle, b.authorName ?? '']));

      const scrapeResult = await parallelBatch(
        needsScrape.map((b) => b.bookTitle),
        input.concurrency,
        async (title) => {
          const author = bookAuthorMap.get(title) ?? '';
          const bookId = bookIdMap.get(title)!;
          // Skip obviously bad titles
          const isSkippable =
            /^bk_rand_/i.test(title) ||
            /^Book PDF$/i.test(title) ||
            title === author ||
            /open.graph/i.test(title);
          if (isSkippable) {
            console.log(`[rebuild-covers] Skipping bad title: "${title}"`);
            return { bookTitle: title, status: 'skipped' as const };
          }
          const result = await scrapeAmazonBook(title, author);
          if (result?.coverUrl) {
            await db.update(bookProfiles)
              .set({
                coverImageUrl: result.coverUrl,
                amazonUrl: result.amazonUrl ?? undefined,
                s3CoverUrl: null,
                s3CoverKey: null,
                enrichedAt: new Date(),
              })
              .where(eq(bookProfiles.id, bookId));
            return { bookTitle: title, status: 'scraped' as const };
          } else {
            await db.update(bookProfiles)
              .set({ coverImageUrl: 'not-found', enrichedAt: new Date() })
              .where(eq(bookProfiles.id, bookId));
            return { bookTitle: title, status: 'not-found' as const };
          }
        }
      );

      const scraped = scrapeResult.results.filter((r) => r.result?.status === 'scraped').length;
      const notFound = scrapeResult.results.filter((r) => r.result?.status === 'not-found').length;
      console.log(`[rebuild-covers] Re-scraped ${scraped} covers, ${notFound} not found`);

      // ── Step 3: Re-mirror all covers that lost their S3 URL ────────────────
      const toMirror = await db
        .select({ id: bookProfiles.id, coverImageUrl: bookProfiles.coverImageUrl, s3CoverKey: bookProfiles.s3CoverKey })
        .from(bookProfiles)
        .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, '')));

      const mirrorCandidates = toMirror.filter((b) => b.coverImageUrl?.startsWith('http'));
      let mirrored = 0;
      let mirrorFailed = 0;

      // Mirror in batches of 10 to avoid overwhelming S3
      const MIRROR_BATCH = 10;
      for (let i = 0; i < mirrorCandidates.length; i += MIRROR_BATCH) {
        const batch = mirrorCandidates.slice(i, i + MIRROR_BATCH);
        const results = await mirrorBatchToS3(
          batch.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
          'book-covers'
        );
        for (const r of results) {
          if (r.url && r.key) {
            await db.update(bookProfiles)
              .set({ s3CoverUrl: r.url, s3CoverKey: r.key })
              .where(eq(bookProfiles.id, r.id));
            mirrored++;
          } else {
            mirrorFailed++;
          }
        }
      }
      console.log(`[rebuild-covers] Mirrored ${mirrored} covers to S3, ${mirrorFailed} failed`);

      return {
        total: allBooks.length,
        upgraded,
        scraped,
        notFound,
        mirrored,
        mirrorFailed,
      };
    }),

  /** Enrich a single book with rich summary (double-pass LLM) */
  enrichRichSummary: adminProcedure
    .input(z.object({
      bookTitle: z.string(),
      authorName: z.string().optional(),
      force: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existing = await db.select().from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle)).limit(1);
      if (!input.force && existing[0]?.richSummaryJson) {
        return { status: "skipped" as const, bookTitle: input.bookTitle };
      }
      const profile = existing[0];
      const result = await enrichRichSummary(
        input.bookTitle,
        input.authorName ?? profile?.authorName ?? "",
        profile?.summary,
        null
      );
      if (!result) return { status: "failed" as const, bookTitle: input.bookTitle };
      if (profile) {
        await db.update(bookProfiles)
          .set({ richSummaryJson: JSON.stringify(result), resourceLinksJson: JSON.stringify(result.resourceLinks) })
          .where(eq(bookProfiles.bookTitle, input.bookTitle));
      } else {
        await db.insert(bookProfiles).values({
          bookTitle: input.bookTitle,
          authorName: input.authorName ?? "",
          richSummaryJson: JSON.stringify(result),
          resourceLinksJson: JSON.stringify(result.resourceLinks),
        });
      }
      return { status: "enriched" as const, bookTitle: input.bookTitle };
    }),

  /** Batch enrich all books with rich summaries (double-pass LLM) */
  enrichRichSummaryBatch: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).optional().default(50),
      force: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const allBooks = await db.select({
        bookTitle: bookProfiles.bookTitle,
        authorName: bookProfiles.authorName,
        summary: bookProfiles.summary,
        richSummaryJson: bookProfiles.richSummaryJson,
      }).from(bookProfiles);
      const toEnrich = input.force
        ? allBooks.slice(0, input.limit)
        : allBooks.filter(b => !b.richSummaryJson).slice(0, input.limit);
      let enriched = 0, skipped = 0, failed = 0;
      for (const book of toEnrich) {
        const result = await enrichRichSummary(
          book.bookTitle,
          book.authorName ?? "",
          book.summary,
          null
        );
        if (!result) { failed++; continue; }
        await db.update(bookProfiles)
          .set({ richSummaryJson: JSON.stringify(result), resourceLinksJson: JSON.stringify(result.resourceLinks) })
          .where(eq(bookProfiles.bookTitle, book.bookTitle));
        enriched++;
      }
      skipped = allBooks.length - toEnrich.length;
      return { enriched, skipped, failed, total: allBooks.length };
    }),

  /** Get rich summary for a book */
  getRichSummary: publicProcedure
    .input(z.object({ bookTitle: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select({
        richSummaryJson: bookProfiles.richSummaryJson,
        resourceLinksJson: bookProfiles.resourceLinksJson,
      }).from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle)).limit(1);
      return rows[0] ?? null;
    }),
});
