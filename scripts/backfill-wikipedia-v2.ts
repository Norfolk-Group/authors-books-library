/**
 * backfill-wikipedia-v2.ts
 *
 * Improved Wikipedia backfill for books missing a Wikipedia URL.
 * Strategy:
 *   1. Search Wikipedia for "<bookTitle> book <authorLastName>"
 *   2. Verify the top result is a book article (snippet or title contains "book", "novel", "author", or author name)
 *   3. Fall back to searching "<bookTitle> <authorLastName>" if first search fails
 *   4. Skip if no confident match found
 *
 * Usage:
 *   npx tsx scripts/backfill-wikipedia-v2.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { bookProfiles } from "../drizzle/schema";
import { isNull, or, eq } from "drizzle-orm";

const DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getAuthorLastName(authorName: string): string {
  const parts = authorName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? authorName;
}

function normalizeTitle(title: string): string {
  // Remove subtitle after colon, clean special chars
  return title
    .split(/[:\u2013\u2014]/)[0]
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleWordsMatch(articleTitle: string, bookTitle: string): boolean {
  const normArticle = normalizeTitle(articleTitle);
  const normBook = normalizeTitle(bookTitle);
  const bookWords = normBook.split(" ").filter((w) => w.length > 3);
  if (bookWords.length === 0) return false;
  // At least half the significant words from the book title must appear in the article title
  const matchCount = bookWords.filter((w) => normArticle.includes(w)).length;
  return matchCount >= Math.ceil(bookWords.length * 0.5);
}

function isBookArticle(
  articleTitle: string,
  snippet: string,
  bookTitle: string,
  authorLastName: string
): boolean {
  const combined = (articleTitle + " " + snippet).toLowerCase();
  const normBook = normalizeTitle(bookTitle);
  const normAuthor = authorLastName.toLowerCase();

  // Must match title words
  if (!titleWordsMatch(articleTitle, bookTitle)) return false;

  // Must have at least one book-related signal OR author name
  const bookSignals = ["book", "novel", "nonfiction", "non-fiction", "memoir", "author", "published", "bestsell", "chapter", "isbn"];
  const hasBookSignal = bookSignals.some((s) => combined.includes(s));
  const hasAuthorName = combined.includes(normAuthor) || combined.includes(normBook);

  return hasBookSignal || hasAuthorName;
}

async function searchWikipedia(query: string): Promise<Array<{ title: string; snippet: string; pageid: number }>> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
  const res = await fetch(url, {
    headers: { "User-Agent": "NCGLibrary/1.0 (ncg-library-bot; educational use)" },
  });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return data?.query?.search ?? [];
}

async function findWikipediaUrl(bookTitle: string, authorName: string): Promise<string | null> {
  const authorLastName = getAuthorLastName(authorName);

  // Strategy 1: "<title> book <lastName>"
  const results1 = await searchWikipedia(`${bookTitle} book ${authorLastName}`);
  for (const r of results1) {
    if (isBookArticle(r.title, r.snippet, bookTitle, authorLastName)) {
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
    }
  }

  await sleep(200);

  // Strategy 2: "<title> <lastName>"
  const results2 = await searchWikipedia(`${bookTitle} ${authorLastName}`);
  for (const r of results2) {
    if (isBookArticle(r.title, r.snippet, bookTitle, authorLastName)) {
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
    }
  }

  await sleep(200);

  // Strategy 3: exact title only (for well-known books)
  const results3 = await searchWikipedia(bookTitle);
  for (const r of results3) {
    // For exact title search, be stricter — require title match + book signal
    const normArticle = normalizeTitle(r.title);
    const normBook = normalizeTitle(bookTitle);
    if (normArticle === normBook || normArticle.startsWith(normBook)) {
      const combined = (r.title + " " + r.snippet).toLowerCase();
      const bookSignals = ["book", "novel", "nonfiction", "memoir", "author", "published", "bestsell", "isbn"];
      if (bookSignals.some((s) => combined.includes(s))) {
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
      }
    }
  }

  return null;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // Get all books missing Wikipedia URL
  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.wikipediaUrl), eq(bookProfiles.wikipediaUrl, "")));

  console.log(`[wikipedia-v2] Found ${books.length} books missing Wikipedia URL`);

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

  console.log(`\n[wikipedia-v2] Done. Found: ${found}, Skipped: ${skipped}`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
