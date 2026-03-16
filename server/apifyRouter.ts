/**
 * Apify Router
 *
 * tRPC procedures for on-demand web scraping via Apify:
 * - scrapeBook: fetch real book cover + Amazon URL from Amazon.com
 * - scrapeAuthorPhoto: fetch real author headshot from Wikipedia
 * - scrapeUrl: generic scrape any URL with a custom page function
 *
 * All procedures are public (no auth required) since the library is internal.
 * Scraping is done on-demand and results are persisted to the DB.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { bookProfiles, authorProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { scrapeAmazonBook, scrapeAuthorPhoto, scrapeUrl } from "./apify";

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

      // Persist to DB — upsert into book_profiles
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
   * Scrape Wikipedia for a real author headshot.
   * Persists photoUrl to the author_profiles table.
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
        return { success: false as const, message: "No photo found on Wikipedia" };
      }

      // Persist to DB — upsert into author_profiles
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
              photoUrl: result.photoUrl,
              photoSourceUrl: result.sourceUrl,
              enrichedAt: now,
            })
            .where(eq(authorProfiles.authorName, input.authorName));
        } else {
          await db.insert(authorProfiles).values({
            authorName: input.authorName,
            photoUrl: result.photoUrl,
            photoSourceUrl: result.sourceUrl,
            enrichedAt: now,
          });
        }
      }

      return {
        success: true as const,
        photoUrl: result.photoUrl,
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
