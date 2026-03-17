/**
 * batch-scrape-covers.mjs
 *
 * Standalone script to:
 * 1. Scrape Amazon for book covers for all books missing coverImageUrl
 * 2. Mirror all books with coverImageUrl but no s3CoverUrl to S3 via Forge API
 *
 * Run: node scripts/batch-scrape-covers.mjs
 */

import { createConnection } from "mysql2/promise";
import { ApifyClient } from "apify-client";
import { config } from "dotenv";

config();

const DB_URL = process.env.DATABASE_URL;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const FORGE_API_URL = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
if (!APIFY_TOKEN) { console.error("APIFY_API_TOKEN not set"); process.exit(1); }
if (!FORGE_API_URL || !FORGE_API_KEY) { console.error("BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY not set"); process.exit(1); }

// ── S3 via Forge API ──────────────────────────────────────────────────────────

function makeS3Key(prefix, sourceUrl) {
  let hash = 0;
  for (let i = 0; i < sourceUrl.length; i++) {
    const char = sourceUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, "0");
  const lower = sourceUrl.toLowerCase().split("?")[0];
  let ext = "jpg";
  if (lower.endsWith(".png")) ext = "png";
  else if (lower.endsWith(".webp")) ext = "webp";
  else if (lower.endsWith(".gif")) ext = "gif";
  return `${prefix}/${hashHex}.${ext}`;
}

async function mirrorToForge(sourceUrl, prefix) {
  // Fetch the image
  let buffer, contentType;
  try {
    const resp = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NCGLibrary/1.0)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) {
      console.log(`  [Mirror] Fetch failed ${resp.status}: ${sourceUrl.substring(0, 60)}`);
      return null;
    }
    buffer = Buffer.from(await resp.arrayBuffer());
    contentType = resp.headers.get("content-type") || "image/jpeg";
  } catch (err) {
    console.log(`  [Mirror] Fetch error: ${err.message}`);
    return null;
  }

  const key = makeS3Key(prefix, sourceUrl);
  const uploadUrl = `${FORGE_API_URL}/v1/storage/upload?path=${encodeURIComponent(key)}`;

  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() || "cover.jpg");

  try {
    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!uploadResp.ok) {
      const msg = await uploadResp.text().catch(() => uploadResp.statusText);
      console.log(`  [Mirror] Upload failed ${uploadResp.status}: ${msg.substring(0, 80)}`);
      return null;
    }
    const data = await uploadResp.json();
    const url = data.url;
    console.log(`  [Mirror] Uploaded: ${key} → ${url.substring(0, 60)}`);
    return { url, key };
  } catch (err) {
    console.log(`  [Mirror] Upload error: ${err.message}`);
    return null;
  }
}

// ── Apify Amazon scraper ──────────────────────────────────────────────────────

async function scrapeAmazonBook(title, author) {
  const client = new ApifyClient({ token: APIFY_TOKEN });
  const query = encodeURIComponent(`${title} ${author}`);
  const searchUrl = `https://www.amazon.com/s?k=${query}&i=stripbooks`;

  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context;
  const results = [];
  $('.s-result-item[data-asin]').each((i, el) => {
    const asin = $(el).attr('data-asin');
    if (!asin || asin.length < 5) return;
    const title = $(el).find('h2 span').first().text().trim();
    const img = $(el).find('img.s-image').attr('src');
    const href = $(el).find('h2 a').attr('href');
    const authorEl = $(el).find('.a-size-base.a-color-secondary').first().text().trim();
    const priceEl = $(el).find('.a-price .a-offscreen').first().text().trim();
    if (title && img) {
      results.push({
        asin, title,
        coverUrl: img,
        amazonUrl: href ? 'https://www.amazon.com' + href.split('?')[0] : 'https://www.amazon.com/dp/' + asin,
        author: authorEl, price: priceEl
      });
    }
  });
  log.info('Found ' + results.length + ' Amazon results');
  return results.slice(0, 5);
}`;

  try {
    const run = await client.actor("apify/cheerio-scraper").call({
      startUrls: [{ url: searchUrl }],
      pageFunction,
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items?.length) return null;

    const results = items.flatMap((item) => item.results || [item]).filter((r) => r.coverUrl);
    return results[0] || null;
  } catch (err) {
    console.error(`  [Apify] Error: ${err.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await createConnection(DB_URL);
  console.log("Connected to DB\n");

  // Step 1: Scrape Amazon for books missing covers
  const [missingCovers] = await conn.execute(
    "SELECT id, bookTitle, authorName FROM book_profiles WHERE (coverImageUrl IS NULL OR coverImageUrl = '') ORDER BY bookTitle"
  );
  console.log(`=== Step 1: Scrape Amazon covers for ${missingCovers.length} books ===\n`);

  let scraped = 0;
  let skipped = 0;
  let failed = 0;

  const SKIPPABLE_PATTERNS = [
    /^bk_rand_/i,
    /^Book PDF$/i,
    /^Jefferson-Fisher-Open-Graph$/i,
    /^Active Listening \[3-in-1\]$/i,
  ];

  for (let i = 0; i < missingCovers.length; i++) {
    const book = missingCovers[i];
    const { id, bookTitle, authorName } = book;

    const isSkippable =
      SKIPPABLE_PATTERNS.some((p) => p.test(bookTitle)) ||
      bookTitle === authorName;

    console.log(`[${i + 1}/${missingCovers.length}] "${bookTitle}" by ${authorName || "?"}`);

    if (isSkippable) {
      console.log("  → Skipping (placeholder title)");
      await conn.execute(
        "UPDATE book_profiles SET coverImageUrl = 'skipped', enrichedAt = NOW() WHERE id = ?",
        [id]
      );
      skipped++;
      continue;
    }

    const result = await scrapeAmazonBook(bookTitle, authorName || "");
    if (result?.coverUrl) {
      console.log(`  → Found cover: ${result.coverUrl.substring(0, 70)}`);
      await conn.execute(
        "UPDATE book_profiles SET coverImageUrl = ?, amazonUrl = COALESCE(amazonUrl, ?), enrichedAt = NOW() WHERE id = ?",
        [result.coverUrl, result.amazonUrl || null, id]
      );
      scraped++;
    } else {
      console.log("  → No cover found, marking as not-found");
      await conn.execute(
        "UPDATE book_profiles SET coverImageUrl = 'not-found', enrichedAt = NOW() WHERE id = ?",
        [id]
      );
      failed++;
    }

    // Small delay to avoid rate limiting
    if (i < missingCovers.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log(`\nStep 1 complete: ${scraped} scraped, ${skipped} skipped, ${failed} not found\n`);

  // Step 2: Mirror all books with coverImageUrl but no s3CoverUrl to S3
  const [pendingMirror] = await conn.execute(
    "SELECT id, bookTitle, coverImageUrl FROM book_profiles WHERE coverImageUrl IS NOT NULL AND coverImageUrl NOT IN ('', 'not-found', 'skipped') AND (s3CoverUrl IS NULL OR s3CoverUrl = '') ORDER BY bookTitle"
  );
  console.log(`=== Step 2: Mirror ${pendingMirror.length} covers to S3 ===\n`);

  let mirrored = 0;
  let mirrorFailed = 0;

  for (let i = 0; i < pendingMirror.length; i++) {
    const book = pendingMirror[i];
    const { id, bookTitle, coverImageUrl } = book;
    console.log(`[${i + 1}/${pendingMirror.length}] "${bookTitle}"`);

    const result = await mirrorToForge(coverImageUrl, "book-covers");
    if (result) {
      await conn.execute(
        "UPDATE book_profiles SET s3CoverUrl = ?, s3CoverKey = ? WHERE id = ?",
        [result.url, result.key, id]
      );
      mirrored++;
    } else {
      mirrorFailed++;
    }

    if (i < pendingMirror.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  console.log(`\nStep 2 complete: ${mirrored} mirrored, ${mirrorFailed} failed\n`);

  // Final stats
  const [finalStats] = await conn.execute(
    "SELECT COUNT(*) as total, SUM(CASE WHEN coverImageUrl IS NOT NULL AND coverImageUrl NOT IN ('', 'not-found', 'skipped') THEN 1 ELSE 0 END) as withCover, SUM(CASE WHEN s3CoverUrl IS NOT NULL AND s3CoverUrl != '' THEN 1 ELSE 0 END) as withS3Cover FROM book_profiles"
  );
  console.log("=== Final Stats ===");
  console.log(`Total books: ${finalStats[0].total}`);
  console.log(`With cover URL: ${finalStats[0].withCover}`);
  console.log(`With S3 cover: ${finalStats[0].withS3Cover}`);

  await conn.end();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
