/**
 * fill_missing_covers.ts
 * Scrapes Amazon covers for all books missing cover images and uploads to S3.
 * Usage: tsx scripts/fill_missing_covers.ts
 */
import { getDb } from "../server/db";
import { bookProfiles } from "../drizzle/schema";
import { scrapeAmazonBook } from "../server/apify";
import { mirrorImageToS3 } from "../server/mirrorToS3";
import { isNull, or, eq } from "drizzle-orm";
import fs from "fs";

const CONCURRENCY = 3;

// Books to skip (known bad titles or non-books)
const SKIP_TITLES = new Set(["Active Listening", "Active Listening Techniques"]);

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Get all books missing covers
  const missing = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
    .from(bookProfiles)
    .where(
      or(
        isNull(bookProfiles.coverImageUrl),
        eq(bookProfiles.coverImageUrl, ""),
        eq(bookProfiles.coverImageUrl, "not-found"),
        eq(bookProfiles.coverImageUrl, "skipped"),
      )
    );

  // Also include books where s3CoverUrl is null but coverImageUrl might exist
  const missingS3 = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, coverImageUrl: bookProfiles.coverImageUrl })
    .from(bookProfiles)
    .where(
      or(
        isNull(bookProfiles.s3CoverUrl),
        eq(bookProfiles.s3CoverUrl, ""),
      )
    );

  // Combine: books with no cover at all
  const toScrape = missing.filter(b => !SKIP_TITLES.has(b.bookTitle));
  console.log(`Found ${toScrape.length} books missing covers (after filtering)`);
  toScrape.forEach(b => console.log(`  - "${b.bookTitle}" by ${b.authorName}`));

  const results: Array<{ title: string; success: boolean; source: string; url?: string | null; error?: string }> = [];

  // Process in batches
  for (let i = 0; i < toScrape.length; i += CONCURRENCY) {
    const batch = toScrape.slice(i, i + CONCURRENCY);
    console.log(`\nBatch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(toScrape.length / CONCURRENCY)}: ${batch.map(b => b.bookTitle).join(", ")}`);

    const batchResults = await Promise.allSettled(
      batch.map(async (book) => {
        try {
          console.log(`  → Scraping Amazon for "${book.bookTitle}"...`);
          const result = await scrapeAmazonBook(book.bookTitle, book.authorName ?? undefined);
          
          if (!result?.coverUrl) {
            console.log(`  ✗ "${book.bookTitle}": no cover found on Amazon`);
            // Mark as not-found to avoid re-scraping
            await db.update(bookProfiles)
              .set({ coverImageUrl: "not-found" })
              .where(eq(bookProfiles.id, book.id));
            return { title: book.bookTitle, success: false, source: "amazon-not-found" };
          }

          console.log(`  ✓ "${book.bookTitle}": found cover → ${result.coverUrl.slice(0, 60)}...`);

          // Save coverImageUrl first
          await db.update(bookProfiles)
            .set({ 
              coverImageUrl: result.coverUrl,
              ...(result.amazonUrl ? { amazonUrl: result.amazonUrl } : {}),
            })
            .where(eq(bookProfiles.id, book.id));

          // Mirror to S3
          const s3Result = await mirrorImageToS3(result.coverUrl, "book-covers", null);

          if (s3Result?.url) {
            await db.update(bookProfiles)
              .set({ s3CoverUrl: s3Result.url, s3CoverKey: s3Result.key })
              .where(eq(bookProfiles.id, book.id));
            console.log(`  ✓ "${book.bookTitle}": uploaded to S3 → ${s3Result.url.slice(0, 60)}...`);
            return { title: book.bookTitle, success: true, source: "amazon", url: s3Result.url };
          }

          return { title: book.bookTitle, success: true, source: "amazon-no-s3", url: result.coverUrl };
        } catch (err: any) {
          console.error(`  ✗ "${book.bookTitle}": ${err.message}`);
          return { title: book.bookTitle, success: false, source: "error", error: err.message };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
      else results.push({ title: "unknown", success: false, source: "error", error: r.reason?.message });
    }

    if (i + CONCURRENCY < toScrape.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== COVER FILL RESULTS ===`);
  console.log(`Total: ${results.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  results.forEach(r => {
    const icon = r.success ? "✓" : "✗";
    console.log(`  ${icon} "${r.title}": ${r.source}${r.error ? " — " + r.error : ""}`);
  });

  fs.writeFileSync("/tmp/cover_fill_results.json", JSON.stringify({ succeeded, failed, results }, null, 2));
  console.log("\nResults saved to /tmp/cover_fill_results.json");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
