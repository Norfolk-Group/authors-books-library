/**
 * Apify Router
 *
 * tRPC procedures for on-demand web scraping via Apify:
 * - scrapeBook: fetch real book cover + Amazon URL from Amazon.com
 * - scrapeAuthorPhoto: fetch real author headshot from Wikipedia
 * - scrapeUrl: generic scrape any URL with a custom page function
 * - batchScrapeCovers: scrape Amazon covers for all books missing coverImageUrl,
 *   then mirror all pending covers (with coverImageUrl but no s3CoverUrl) to S3
 * - getBatchScrapeStats: count books needing scraping / mirroring
 *
 * All procedures are public (no auth required) since the library is internal.
 * Scraping is done on-demand and results are persisted to the DB.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles, authorProfiles } from "../../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";
import { scrapeAmazonBook, scrapeAuthorPhoto, scrapeUrl } from "../apify";
import { mirrorBatchToS3 } from "../mirrorToS3";

export const apifyRouter = router({
  /**
   * Scrape Amazon for a book's cover image and product URL.
   * Persists coverUrl and amazonUrl to the book_profiles table.
   */
  scrapeBook: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        author: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const result = await scrapeAmazonBook(input.title, input.author);
      if (!result) {
        return { success: false as const, message: "No results found on Amazon" };
      }

      // Persist to DB - upsert into book_profiles
      const db = await getDb();
      if (db) {
        const existing = await db
          .select({ id: bookProfiles.id })
          .from(bookProfiles)
          .where(eq(bookProfiles.bookTitle, input.title))
          .limit(1);

        const now = new Date();
        if (existing.length > 0) {
          await db
            .update(bookProfiles)
            .set({
              coverImageUrl: result.coverUrl,
              amazonUrl: result.amazonUrl,
              enrichedAt: now,
            })
            .where(eq(bookProfiles.bookTitle, input.title));
        } else {
          await db.insert(bookProfiles).values({
            bookTitle: input.title,
            authorName: input.author,
            coverImageUrl: result.coverUrl,
            amazonUrl: result.amazonUrl,
            enrichedAt: now,
          });
        }
      }

      return {
        success: true as const,
        asin: result.asin,
        coverUrl: result.coverUrl,
        amazonUrl: result.amazonUrl,
        matchedTitle: result.title,
        author: result.author,
        price: result.price,
      };
    }),

  /**
   * Return stats for the batch scrape UI:
   * - needsScrape: books with no coverImageUrl (need Amazon scraping)
   * - needsMirror: books with coverImageUrl but no s3CoverUrl (need S3 mirroring)
   * - total: total books in book_profiles
   */
  getBatchScrapeStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { needsScrape: 0, needsMirror: 0, total: 0, withS3: 0 };

    const all = await db
      .select({
        coverImageUrl: bookProfiles.coverImageUrl,
        s3CoverUrl: bookProfiles.s3CoverUrl,
      })
      .from(bookProfiles);

    const needsScrape = all.filter(
      (b) => !b.coverImageUrl || b.coverImageUrl.trim() === ""
    ).length;
    const needsMirror = all.filter(
      (b) =>
        b.coverImageUrl &&
        b.coverImageUrl.startsWith("http") &&
        (!b.s3CoverUrl || b.s3CoverUrl.trim() === "")
    ).length;
    const withS3 = all.filter(
      (b) => b.s3CoverUrl && b.s3CoverUrl.startsWith("http")
    ).length;

    return { needsScrape, needsMirror, total: all.length, withS3 };
  }),

  /**
   * Batch scrape Amazon covers for all books missing coverImageUrl.
   * Processes one book per call (call repeatedly until needsScrape = 0).
   * After scraping, also mirrors up to `mirrorBatch` covers to S3.
   *
   * Returns:
   *   scraped: 1 if a cover was found, 0 if not
   *   bookTitle: the book that was processed
   *   coverUrl: the cover URL found (or null)
   *   mirrored: number of covers mirrored to S3 in this call
   */
  scrapeNextMissingCover: publicProcedure
    .input(
      z.object({
        /** How many S3 mirrors to run after scraping (default 3) */
        mirrorBatch: z.number().min(0).max(10).optional().default(3),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Pick the next book with no cover
      const [next] = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          authorName: bookProfiles.authorName,
        })
        .from(bookProfiles)
        .where(or(isNull(bookProfiles.coverImageUrl), eq(bookProfiles.coverImageUrl, "")))
        .limit(1);

      let scraped = 0;
      let bookTitle = "";
      let coverUrl: string | null = null;

      if (next) {
        bookTitle = next.bookTitle;
        const author = next.authorName ?? "";
        // Skip obviously bad titles (internal IDs, placeholders)
        const isSkippable =
          /^bk_rand_/i.test(bookTitle) ||
          /^Book PDF$/i.test(bookTitle) ||
          bookTitle === author; // e.g. "David Brooks" authored by "David Brooks"

        if (!isSkippable) {
          const result = await scrapeAmazonBook(bookTitle, author);
          if (result?.coverUrl) {
            coverUrl = result.coverUrl;
            await db
              .update(bookProfiles)
              .set({
                coverImageUrl: result.coverUrl,
                amazonUrl: result.amazonUrl ?? undefined,
                enrichedAt: new Date(),
              })
              .where(eq(bookProfiles.id, next.id));
            scraped = 1;
          } else {
            // Mark as attempted with a placeholder so we don't retry endlessly
            await db
              .update(bookProfiles)
              .set({ coverImageUrl: "not-found", enrichedAt: new Date() })
              .where(eq(bookProfiles.id, next.id));
          }
        } else {
          // Mark skippable titles so they don't block the queue
          await db
            .update(bookProfiles)
            .set({ coverImageUrl: "skipped", enrichedAt: new Date() })
            .where(eq(bookProfiles.id, next.id));
        }
      }

      // Mirror a batch of covers that have coverImageUrl but no s3CoverUrl
      let mirrored = 0;
      if (input.mirrorBatch > 0) {
        const pending = await db
          .select({
            id: bookProfiles.id,
            coverImageUrl: bookProfiles.coverImageUrl,
            s3CoverKey: bookProfiles.s3CoverKey,
          })
          .from(bookProfiles)
          .where(
            or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, ""))
          )
          .limit(input.mirrorBatch);

        const toMirror = pending.filter(
          (b) =>
            b.coverImageUrl &&
            b.coverImageUrl.startsWith("http")
        );

        if (toMirror.length > 0) {
          const results = await mirrorBatchToS3(
            toMirror.map((b) => ({
              id: b.id,
              sourceUrl: b.coverImageUrl!,
              existingKey: b.s3CoverKey,
            })),
            "book-covers"
          );
          for (const r of results) {
            if (r.url && r.key) {
              await db
                .update(bookProfiles)
                .set({ s3CoverUrl: r.url, s3CoverKey: r.key })
                .where(eq(bookProfiles.id, r.id));
              mirrored++;
            }
          }
        }
      }

      // Return remaining counts so the client knows when to stop
      const remaining = await db
        .select({ coverImageUrl: bookProfiles.coverImageUrl, s3CoverUrl: bookProfiles.s3CoverUrl })
        .from(bookProfiles);

      const remainingScrape = remaining.filter(
        (b) => !b.coverImageUrl || b.coverImageUrl.trim() === ""
      ).length;
      const remainingMirror = remaining.filter(
        (b) =>
          b.coverImageUrl &&
          b.coverImageUrl.startsWith("http") &&
          (!b.s3CoverUrl || b.s3CoverUrl.trim() === "")
      ).length;

      return {
        scraped,
        bookTitle,
        coverUrl,
        mirrored,
        remainingScrape,
        remainingMirror,
      };
    }),

  /**
   * Scrape Wikipedia for a real author headshot.
   * Persists avatarUrl to the author_profiles table.
   */
  scrapeAuthorPhoto: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const result = await scrapeAuthorPhoto(input.authorName);
      if (!result) {
        return { success: false as const, message: "No avatar found on Wikipedia" };
      }

      // Persist to DB - upsert into author_profiles
      const db = await getDb();
      if (db) {
        const existing = await db
          .select({ id: authorProfiles.id })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.authorName))
          .limit(1);

        const now = new Date();
        if (existing.length > 0) {
          await db
            .update(authorProfiles)
            .set({
              avatarUrl: result.avatarUrl,
              avatarSourceUrl: result.sourceUrl,
              enrichedAt: now,
            })
            .where(eq(authorProfiles.authorName, input.authorName));
        } else {
          await db.insert(authorProfiles).values({
            authorName: input.authorName,
            avatarUrl: result.avatarUrl,
            avatarSourceUrl: result.sourceUrl,
            enrichedAt: now,
          });
        }
      }

      return {
        success: true as const,
        avatarUrl: result.avatarUrl,
        sourceUrl: result.sourceUrl,
        sourceName: result.sourceName,
      };
    }),

  /**
   * Generic scrape: run any URL through the Apify Cheerio Scraper
   * with a custom page function. Returns raw scraped items.
   */
  scrapeUrl: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        pageFunction: z.string().min(10),
        maxRequests: z.number().min(1).max(10).optional().default(1),
      })
    )
    .mutation(async ({ input }) => {
      const items = await scrapeUrl(input.url, input.pageFunction, {
        maxRequests: input.maxRequests,
      });
      return { success: true as const, count: items.length, items };
    }),
});
