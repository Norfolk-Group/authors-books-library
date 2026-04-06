/**
 * Library Cache Router
 *
 * Wraps Open Library, HathiTrust, WorldCat, and news enrichment with DB caching.
 * First call fetches from the external API and persists to the DB.
 * Subsequent calls return cached data until the TTL expires (7 days by default).
 *
 * Procedures:
 *  libraryCache.getBookLibraryData     → cached OL + HathiTrust + WorldCat for a book (by ISBN or title)
 *  libraryCache.getAuthorNews          → cached news articles for an author
 *  libraryCache.refreshBookLibraryData → force-refresh all library cache for a book
 *  libraryCache.refreshAuthorNews      → force-refresh news cache for an author
 */
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { bookProfiles, authorProfiles } from "../../drizzle/schema";
import { getBookByISBN, getCoverUrl } from "../enrichment/openLibrary";
import { checkDigitalAvailability, getAvailabilitySummary } from "../enrichment/hathiTrust";
import { searchWorldCat } from "../enrichment/worldcat";
import { getAuthorNewsFromOutlets } from "../enrichment/newsOutlets";
import { getCNBCAuthorMentions } from "../enrichment/newsSearch";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isCacheValid(cachedAt: Date | null): boolean {
  if (!cachedAt) return false;
  return Date.now() - cachedAt.getTime() < CACHE_TTL_MS;
}

export const libraryCacheRouter = router({
  /**
   * Get cached library availability data for a book.
   * Fetches from Open Library, HathiTrust, and WorldCat if cache is stale.
   * Requires either isbn or bookTitle.
   */
  getBookLibraryData: publicProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        forceRefresh: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [book] = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          isbn: bookProfiles.isbn,
          openLibraryCacheJson: bookProfiles.openLibraryCacheJson,
          openLibraryCachedAt: bookProfiles.openLibraryCachedAt,
          hathiTrustCacheJson: bookProfiles.hathiTrustCacheJson,
          hathiTrustCachedAt: bookProfiles.hathiTrustCachedAt,
          worldcatCacheJson: bookProfiles.worldcatCacheJson,
          worldcatCachedAt: bookProfiles.worldcatCachedAt,
        })
        .from(bookProfiles)
        .where(eq(bookProfiles.id, input.bookId))
        .limit(1);

      if (!book) throw new Error("Book not found");

      const isbn = book.isbn ?? null;

      // Check if all caches are valid
      const olValid = !input.forceRefresh && isCacheValid(book.openLibraryCachedAt);
      const htValid = !input.forceRefresh && isCacheValid(book.hathiTrustCachedAt);
      const wcValid = !input.forceRefresh && isCacheValid(book.worldcatCachedAt);

      const updates: Record<string, unknown> = {};

      // Fetch Open Library data if needed
      let olData = olValid && book.openLibraryCacheJson
        ? JSON.parse(book.openLibraryCacheJson)
        : null;
      if (!olValid && isbn) {
        try {
          const edition = await getBookByISBN(isbn);
          if (edition) {
            olData = {
              title: edition.title,
              isbn13: edition.isbn_13?.[0] ?? null,
              isbn10: edition.isbn_10?.[0] ?? null,
              coverUrl: edition.covers?.[0] ? getCoverUrl(edition.covers[0], "M") : null,
              publisher: edition.publishers?.[0] ?? null,
              publishDate: edition.publish_date ?? null,
              pageCount: edition.number_of_pages ?? null,
              subjects: edition.subjects?.slice(0, 10) ?? [],
              cachedAt: new Date().toISOString(),
            };
            updates.openLibraryCacheJson = JSON.stringify(olData);
            updates.openLibraryCachedAt = new Date();
          }
        } catch {
          // Non-fatal: return stale or null
        }
      }

      // Fetch HathiTrust data if needed
      let htData = htValid && book.hathiTrustCacheJson
        ? JSON.parse(book.hathiTrustCacheJson)
        : null;
      if (!htValid && isbn) {
        try {
          const availability = await checkDigitalAvailability(isbn);
          if (availability) {
            htData = { ...availability, cachedAt: new Date().toISOString() };
            updates.hathiTrustCacheJson = JSON.stringify(htData);
            updates.hathiTrustCachedAt = new Date();
          }
        } catch {
          // Non-fatal
        }
      }

      // Fetch WorldCat data if needed
      let wcData = wcValid && book.worldcatCacheJson
        ? JSON.parse(book.worldcatCacheJson)
        : null;
      if (!wcValid) {
        try {
          const query = isbn ? `isbn:${isbn}` : book.bookTitle;
          const wcResult = await searchWorldCat(query, 1);
          if (wcResult) {
            wcData = { ...wcResult, cachedAt: new Date().toISOString() };
            updates.worldcatCacheJson = JSON.stringify(wcData);
            updates.worldcatCachedAt = new Date();
          }
        } catch {
          // Non-fatal
        }
      }

      // Persist updates to DB if any
      if (Object.keys(updates).length > 0) {
        await db.update(bookProfiles).set(updates).where(eq(bookProfiles.id, input.bookId));
      }

      return {
        bookId: book.id,
        bookTitle: book.bookTitle,
        isbn,
        openLibrary: olData,
        hathiTrust: htData,
        worldcat: wcData,
      };
    }),

  /**
   * Get cached news articles for an author.
   * Fetches from Google News RSS and CNBC if cache is stale.
   */
  getAuthorNews: publicProcedure
    .input(
      z.object({
        authorId: z.number().int().positive(),
        limit: z.number().int().min(1).max(30).default(15),
        forceRefresh: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [author] = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          newsCacheJson: authorProfiles.newsCacheJson,
          newsCachedAt: authorProfiles.newsCachedAt,
          cnbcMentionsCacheJson: authorProfiles.cnbcMentionsCacheJson,
          cnbcMentionsCachedAt: authorProfiles.cnbcMentionsCachedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.id, input.authorId))
        .limit(1);

      if (!author) throw new Error("Author not found");

      const newsValid = !input.forceRefresh && isCacheValid(author.newsCachedAt);
      const cnbcValid = !input.forceRefresh && isCacheValid(author.cnbcMentionsCachedAt);

      const updates: Record<string, unknown> = {};

      // Fetch general news if needed
      let newsArticles = newsValid && author.newsCacheJson
        ? JSON.parse(author.newsCacheJson)
        : null;
      if (!newsValid) {
        try {
          const articles = await getAuthorNewsFromOutlets(author.authorName, input.limit);
          newsArticles = articles;
          updates.newsCacheJson = JSON.stringify(articles);
          updates.newsCachedAt = new Date();
        } catch {
          newsArticles = newsArticles ?? [];
        }
      }

      // Fetch CNBC mentions if needed
      let cnbcMentions = cnbcValid && author.cnbcMentionsCacheJson
        ? JSON.parse(author.cnbcMentionsCacheJson)
        : null;
      if (!cnbcValid) {
        try {
          const mentions = await getCNBCAuthorMentions(author.authorName, 5);
          cnbcMentions = mentions;
          updates.cnbcMentionsCacheJson = JSON.stringify(mentions);
          updates.cnbcMentionsCachedAt = new Date();
        } catch {
          cnbcMentions = cnbcMentions ?? [];
        }
      }

      // Persist updates
      if (Object.keys(updates).length > 0) {
        await db.update(authorProfiles).set(updates).where(eq(authorProfiles.id, input.authorId));
      }

      return {
        authorId: author.id,
        authorName: author.authorName,
        newsArticles: newsArticles ?? [],
        cnbcMentions: cnbcMentions ?? [],
        newsCachedAt: updates.newsCachedAt ?? author.newsCachedAt,
      };
    }),

  /**
   * Force-refresh all library cache data for a book.
   */
  refreshBookLibraryData: protectedProcedure
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Clear cache timestamps to force re-fetch
      await db.update(bookProfiles).set({
        openLibraryCachedAt: null,
        hathiTrustCachedAt: null,
        worldcatCachedAt: null,
      }).where(eq(bookProfiles.id, input.bookId));

      return { success: true, message: "Cache cleared — next query will re-fetch from APIs" };
    }),

  /**
   * Force-refresh news cache for an author.
   */
  refreshAuthorNews: protectedProcedure
    .input(z.object({ authorId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(authorProfiles).set({
        newsCachedAt: null,
        cnbcMentionsCachedAt: null,
      }).where(eq(authorProfiles.id, input.authorId));

      return { success: true, message: "News cache cleared — next query will re-fetch" };
    }),
});
