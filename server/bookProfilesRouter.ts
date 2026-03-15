/**
 * Book Profiles Router
 * Handles enrichment of book metadata using Google Books API:
 * cover image, summary, publisher, published date, ISBN, ratings.
 * Amazon and Goodreads links are constructed from search queries.
 */
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { bookProfiles } from "../drizzle/schema";
import { eq, inArray, isNotNull } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookEnrichmentData {
  summary: string;
  keyThemes: string;
  rating: string;
  ratingCount: string;
  amazonUrl: string;
  goodreadsUrl: string;
  resourceUrl: string;
  resourceLabel: string;
  coverImageUrl: string;
  publishedDate: string;
  isbn: string;
  publisher: string;
}

// ── Google Books API ──────────────────────────────────────────────────────────

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    infoLink?: string;
  };
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: GoogleBooksVolume[];
}

/**
 * Fetch book data from Google Books API (no API key required for basic queries).
 * Returns enriched metadata including cover image URL, summary, and publication info.
 */
export async function enrichBookViaGoogleBooks(
  bookTitle: string,
  authorName: string
): Promise<BookEnrichmentData> {
  const result: BookEnrichmentData = {
    summary: "",
    keyThemes: "",
    rating: "",
    ratingCount: "",
    amazonUrl: "",
    goodreadsUrl: "",
    resourceUrl: "",
    resourceLabel: "",
    coverImageUrl: "",
    publishedDate: "",
    isbn: "",
    publisher: "",
  };

  try {
    // Build search query: title + author for best match
    const query = authorName
      ? `intitle:${encodeURIComponent(bookTitle)}+inauthor:${encodeURIComponent(authorName)}`
      : `intitle:${encodeURIComponent(bookTitle)}`;

    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&printType=books&langRestrict=en`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "NCG-Library/1.0" },
    });

    if (!res.ok) {
      console.error(`[bookEnrich] Google Books API returned ${res.status} for "${bookTitle}"`);
      return result;
    }

    const data = (await res.json()) as GoogleBooksResponse;
    const items = data.items ?? [];

    if (items.length === 0) {
      // Try a broader search without intitle/inauthor
      const broadQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
      const broadUrl = `https://www.googleapis.com/books/v1/volumes?q=${broadQuery}&maxResults=3&printType=books&langRestrict=en`;
      const broadRes = await fetch(broadUrl, { headers: { "User-Agent": "NCG-Library/1.0" } });
      if (broadRes.ok) {
        const broadData = (await broadRes.json()) as GoogleBooksResponse;
        items.push(...(broadData.items ?? []));
      }
    }

    if (items.length === 0) return result;

    // Pick the best match: prefer exact title match
    const titleLower = bookTitle.toLowerCase();
    const best =
      items.find((v) => v.volumeInfo.title?.toLowerCase().includes(titleLower)) ?? items[0];

    const info = best.volumeInfo;

    // Summary: strip HTML tags from description
    if (info.description) {
      const clean = info.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      result.summary = clean.slice(0, 600);
    }

    // Key themes from categories
    if (info.categories?.length) {
      result.keyThemes = info.categories.slice(0, 5).join(", ");
    }

    // Rating
    if (info.averageRating) {
      result.rating = info.averageRating.toFixed(1);
    }
    if (info.ratingsCount) {
      result.ratingCount = info.ratingsCount.toLocaleString();
    }

    // Cover image — upgrade to larger size by replacing zoom parameter
    const thumbnail = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "";
    if (thumbnail) {
      // Replace zoom=1 with zoom=3 for larger image, and use https
      result.coverImageUrl = thumbnail
        .replace(/^http:/, "https:")
        .replace(/zoom=\d/, "zoom=3")
        .replace(/&edge=curl/, "");
    }

    // Publication info
    result.publishedDate = info.publishedDate ?? "";
    result.publisher = info.publisher ?? "";

    // ISBN-13 preferred
    const isbn13 = info.industryIdentifiers?.find((id) => id.type === "ISBN_13");
    const isbn10 = info.industryIdentifiers?.find((id) => id.type === "ISBN_10");
    result.isbn = isbn13?.identifier ?? isbn10?.identifier ?? "";

    // Construct Amazon search URL
    const amazonQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
    result.amazonUrl = `https://www.amazon.com/s?k=${amazonQuery}&i=stripbooks`;

    // Goodreads search URL
    const goodreadsQuery = encodeURIComponent(`${bookTitle} ${authorName}`);
    result.goodreadsUrl = `https://www.goodreads.com/search?q=${goodreadsQuery}`;

    // Google Books info link as resource
    if (info.infoLink) {
      result.resourceUrl = info.infoLink;
      result.resourceLabel = "Google Books";
    }
  } catch (err) {
    console.error(`[bookEnrich] Failed to enrich "${bookTitle}":`, err);
  }

  return result;
}

// ── Router ─────────────────────────────────────────────────────────────────

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

  /** Enrich a single book — auto-skips if enriched within 30 days */
  enrich: publicProcedure
    .input(z.object({ bookTitle: z.string(), authorName: z.string().optional() }))
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

      const enriched = await enrichBookViaGoogleBooks(input.bookTitle, input.authorName ?? "");

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

  /** Enrich a batch of books (up to 10 at a time) */
  enrichBatch: publicProcedure
    .input(
      z.array(
        z.object({ bookTitle: z.string(), authorName: z.string().optional() })
      ).max(10)
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const results: { bookTitle: string; status: "enriched" | "skipped" | "error" }[] = [];

      for (const item of input) {
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

          const enriched = await enrichBookViaGoogleBooks(item.bookTitle, item.authorName ?? "");

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

      return results;
    }),
});
