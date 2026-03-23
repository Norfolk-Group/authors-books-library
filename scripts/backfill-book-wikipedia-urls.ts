/**
 * backfill-book-wikipedia-urls.ts
 *
 * Calls the Wikipedia search API for each book in book_profiles that has no
 * wikipediaUrl yet, finds the best matching article using strict validation,
 * and writes the URL back.
 *
 * Strict matching rules (to avoid false positives):
 *   1. The Wikipedia article title must contain at least one significant word
 *      from the book title (ignoring stop words).
 *   2. The article snippet must contain "book", "novel", "author", "published",
 *      or the author's last name.
 *
 * Usage:
 *   npx tsx scripts/backfill-book-wikipedia-urls.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { bookProfiles } from "../drizzle/schema";
import { isNull, or, eq } from "drizzle-orm";

const DELAY_MS = 900; // be polite to Wikipedia

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "its", "be", "as", "at", "this",
  "that", "are", "was", "were", "been", "have", "has", "had", "do", "does",
  "did", "will", "would", "could", "should", "may", "might", "shall", "can",
  "how", "why", "what", "when", "where", "who", "which", "your", "my", "our",
  "their", "his", "her", "we", "you", "i", "not", "no", "so", "if", "than",
  "then", "into", "up", "out", "about", "after", "before", "between",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function isGoodMatch(
  bookTitle: string,
  authorName: string | null,
  articleTitle: string,
  snippet: string
): boolean {
  const bookWords = significantWords(bookTitle);
  const articleTitleLower = articleTitle.toLowerCase();
  const snippetLower = snippet.toLowerCase();

  // Rule 1: article title must share at least one significant word with book title
  const titleWordMatch = bookWords.some((w) => articleTitleLower.includes(w));
  if (!titleWordMatch) return false;

  // Rule 2: snippet or article title must contain a book-related signal
  const bookSignals = ["book", "novel", "author", "published", "isbn", "nonfiction", "non-fiction", "bestsell", "chapter"];
  const hasBookSignal = bookSignals.some((s) => snippetLower.includes(s) || articleTitleLower.includes(s));

  // Rule 3: OR the author's last name appears in the snippet/title
  const authorLastName = authorName
    ? authorName.split(" ").pop()?.toLowerCase() ?? ""
    : "";
  const hasAuthorSignal = authorLastName.length > 2 && (
    snippetLower.includes(authorLastName) || articleTitleLower.includes(authorLastName)
  );

  return hasBookSignal || hasAuthorSignal;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findBookWikipediaUrl(
  title: string,
  author: string | null
): Promise<string | null> {
  const query = author ? `${title} book ${author}` : `${title} book`;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NCGLibrary/1.0 (book-backfill-script)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    const results = data.query?.search ?? [];
    if (results.length === 0) return null;

    // Find the first result that passes strict matching
    const match = results.find((r) =>
      isGoodMatch(title, author, r.title, r.snippet)
    );

    if (!match) return null;

    return `https://en.wikipedia.org/wiki/${encodeURIComponent(match.title.replace(/ /g, "_"))}`;
  } catch {
    return null;
  }
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // Fetch all books missing a Wikipedia URL
  const books = await db
    .select({
      id: bookProfiles.id,
      bookTitle: bookProfiles.bookTitle,
      authorName: bookProfiles.authorName,
    })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.wikipediaUrl), eq(bookProfiles.wikipediaUrl, "")));

  console.log(`[backfill-book-wikipedia-urls] Found ${books.length} books without Wikipedia URL`);

  let succeeded = 0;
  let skipped = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    process.stdout.write(`[${i + 1}/${books.length}] "${book.bookTitle}" ... `);

    const wikiUrl = await findBookWikipediaUrl(book.bookTitle, book.authorName ?? null);

    if (wikiUrl) {
      await db
        .update(bookProfiles)
        .set({ wikipediaUrl: wikiUrl })
        .where(eq(bookProfiles.id, book.id));
      console.log(`✓ ${wikiUrl}`);
      succeeded++;
    } else {
      console.log(`✗ (no confident match)`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `\n[backfill-book-wikipedia-urls] Done. Succeeded: ${succeeded}, Skipped (no match): ${skipped}`
  );
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
