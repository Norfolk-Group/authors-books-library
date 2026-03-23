/**
 * retry-failed-enrichments.ts
 *
 * Retries the 4 failed enrichments from the previous pipeline run:
 *   Authors: Dale Carnegie, Mark Manson (richBioJson missing)
 *   Books: "How to Win Friends and Influence People", "The 7 Habits of Highly Effective People"
 *
 * Usage:
 *   npx tsx scripts/retry-failed-enrichments.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { authorProfiles, bookProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { enrichRichBio } from "../server/enrichment/richBio";
import { enrichRichSummary } from "../server/enrichment/richSummary";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // ── 1. Retry author bios ─────────────────────────────────────────────────
  const failedAuthors = ["Dale Carnegie", "Mark Manson"];

  for (const authorName of failedAuthors) {
    console.log(`\n[retry] Author bio: "${authorName}"`);
    const [author] = await db
      .select()
      .from(authorProfiles)
      .where(eq(authorProfiles.authorName, authorName))
      .limit(1);

    if (!author) {
      console.log(`  ✗ Author not found in DB`);
      continue;
    }

    try {
      const result = await enrichRichBio(author.authorName, author.bio, null);
      if (result) {
        await db
          .update(authorProfiles)
          .set({ richBioJson: JSON.stringify(result), updatedAt: new Date() })
          .where(eq(authorProfiles.id, author.id));
        console.log(`  ✓ Rich bio saved (${Object.keys(result).length} fields)`);
      } else {
        console.log(`  ✗ enrichRichBio returned null`);
      }
    } catch (err) {
      console.error(`  ✗ Error:`, err);
    }

    await sleep(2000);
  }

  // ── 2. Retry book summaries ──────────────────────────────────────────────
  const failedBooks = [
    "How to Win Friends and Influence People",
    "The 7 Habits of Highly Effective People",
  ];

  for (const bookTitle of failedBooks) {
    console.log(`\n[retry] Book summary: "${bookTitle}"`);
    const [book] = await db
      .select()
      .from(bookProfiles)
      .where(eq(bookProfiles.bookTitle, bookTitle))
      .limit(1);

    if (!book) {
      console.log(`  ✗ Book not found in DB`);
      continue;
    }

    try {
      const result = await enrichRichSummary(book.bookTitle, book.authorName ?? "", book.summary, null);
      if (result) {
        await db
          .update(bookProfiles)
          .set({ richSummaryJson: JSON.stringify(result), updatedAt: new Date() })
          .where(eq(bookProfiles.id, book.id));
        console.log(`  ✓ Rich summary saved (${Object.keys(result).length} fields)`);
      } else {
        console.log(`  ✗ enrichRichSummary returned null`);
      }
    } catch (err) {
      console.error(`  ✗ Error:`, err);
    }

    await sleep(2000);
  }

  console.log("\n[retry-failed-enrichments] Done.");
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
