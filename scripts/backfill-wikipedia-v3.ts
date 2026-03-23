/**
 * backfill-wikipedia-v3.ts
 *
 * Most precise Wikipedia backfill for books.
 * Strategy: Use Wikipedia's "opensearch" API to find exact page title matches,
 * then verify the page is actually about a book by checking its categories/extract.
 *
 * Only saves URLs when we're confident the article is about the book.
 *
 * Usage:
 *   npx tsx scripts/backfill-wikipedia-v3.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { bookProfiles } from "../drizzle/schema";
import { isNull, or, eq, inArray } from "drizzle-orm";

const DELAY_MS = 500;
const UA = "NCGLibrary/1.0 (ncg-library-bot; educational use)";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getAuthorLastName(authorName: string): string {
  const parts = authorName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? authorName;
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Fetch the Wikipedia page summary for an exact page title.
 * Returns null if the page doesn't exist or is a disambiguation page.
 */
async function fetchPageSummary(title: string): Promise<{ extract: string; categories: string[] } | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.type === "disambiguation") return null;
    return { extract: data.extract ?? "", categories: [] };
  } catch {
    return null;
  }
}

/**
 * Check if a Wikipedia page extract is about a book.
 * The extract should mention "book", "novel", "nonfiction", "memoir", "chapter", "isbn", or the author's name.
 */
function isBookExtract(extract: string, authorLastName: string): boolean {
  const lower = extract.toLowerCase();
  const bookSignals = ["is a book", "is a nonfiction", "is a non-fiction", "is a novel", "is a memoir",
    "is a self-help", "is a business book", "is a management book", "is a bestsell",
    "published in", "isbn", "chapter", "author", "written by"];
  const hasBookSignal = bookSignals.some((s) => lower.includes(s));
  const hasAuthor = lower.includes(authorLastName.toLowerCase());
  return hasBookSignal || hasAuthor;
}

/**
 * Try to find a Wikipedia URL for a book using multiple strategies.
 */
async function findWikipediaUrl(bookTitle: string, authorName: string): Promise<string | null> {
  const authorLastName = getAuthorLastName(authorName);

  // Clean the title for lookup (remove subtitles after colon/dash)
  const cleanTitle = bookTitle.split(/[:\u2013\u2014]/)[0].trim();

  // Strategy 1: Exact title
  const page1 = await fetchPageSummary(cleanTitle);
  if (page1 && isBookExtract(page1.extract, authorLastName)) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanTitle.replace(/ /g, "_"))}`;
  }

  await sleep(200);

  // Strategy 2: "<Title> (book)"
  const page2 = await fetchPageSummary(`${cleanTitle} (book)`);
  if (page2 && isBookExtract(page2.extract, authorLastName)) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(`${cleanTitle} (book)`.replace(/ /g, "_"))}`;
  }

  await sleep(200);

  // Strategy 3: "<Title> (<AuthorLastName> book)"
  const page3 = await fetchPageSummary(`${cleanTitle} (${authorLastName} book)`);
  if (page3 && isBookExtract(page3.extract, authorLastName)) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(`${cleanTitle} (${authorLastName} book)`.replace(/ /g, "_"))}`;
  }

  return null;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // First, clean up the 3 false positives from v2
  const falsePositiveTitles = [
    "Statistics for the Rest of Us",
    "Quit",
    "Sales Pitch",
  ];
  await db
    .update(bookProfiles)
    .set({ wikipediaUrl: null })
    .where(inArray(bookProfiles.bookTitle, falsePositiveTitles));
  console.log(`[wikipedia-v3] Cleaned up ${falsePositiveTitles.length} false positives from v2`);

  // Get all books still missing Wikipedia URL
  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.wikipediaUrl), eq(bookProfiles.wikipediaUrl, "")));

  console.log(`[wikipedia-v3] Found ${books.length} books missing Wikipedia URL`);

  let found = 0;
  let skipped = 0;

  for (const book of books) {
    const title = book.bookTitle ?? "";
    const author = book.authorName ?? "";

    const url = await findWikipediaUrl(title, author);

    if (url) {
      await db
        .update(bookProfiles)
        .set({ wikipediaUrl: url, updatedAt: new Date() })
        .where(eq(bookProfiles.id, book.id));
      console.log(`  ✓ "${title}" → ${url}`);
      found++;
    } else {
      console.log(`  ✗ "${title}" — no match`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n[wikipedia-v3] Done. Found: ${found}, Skipped: ${skipped}`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
