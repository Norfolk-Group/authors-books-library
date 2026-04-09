/**
 * audit-enrichment-gaps.mjs
 *
 * Deterministic tool: identifies authors and books with missing enrichment fields.
 * Produces a prioritized list of what needs enrichment next.
 *
 * Run with: node scripts/audit-enrichment-gaps.mjs
 * Run with: node scripts/audit-enrichment-gaps.mjs --json   (JSON output for piping)
 *
 * Exits with code 0 always (informational tool, not a pass/fail check).
 * Note: Column names are camelCase to match the MySQL schema (Drizzle convention).
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL env var not set");
  process.exit(1);
}

const JSON_MODE = process.argv.includes("--json");

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // ── Author gaps ────────────────────────────────────────────────────────────
  const [[authorGaps]] = await conn.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN bio IS NULL OR bio = '' THEN 1 ELSE 0 END) as noBio,
      SUM(CASE WHEN avatarUrl IS NULL OR avatarUrl = '' THEN 1 ELSE 0 END) as noAvatar,
      SUM(CASE WHEN s3AvatarUrl IS NULL OR s3AvatarUrl = '' THEN 1 ELSE 0 END) as noS3Avatar,
      SUM(CASE WHEN websiteUrl IS NULL OR websiteUrl = '' THEN 1 ELSE 0 END) as noWebsite,
      SUM(CASE WHEN twitterUrl IS NULL OR twitterUrl = '' THEN 1 ELSE 0 END) as noTwitter,
      SUM(CASE WHEN substackUrl IS NULL OR substackUrl = '' THEN 1 ELSE 0 END) as noSubstack,
      SUM(CASE WHEN youtubeUrl IS NULL OR youtubeUrl = '' THEN 1 ELSE 0 END) as noYoutube,
      SUM(CASE WHEN enrichedAt IS NULL THEN 1 ELSE 0 END) as neverEnriched,
      SUM(CASE WHEN richBioJson IS NULL OR richBioJson = '' THEN 1 ELSE 0 END) as noRichBio,
      SUM(CASE WHEN tagsJson IS NULL OR tagsJson = '' OR tagsJson = '[]' THEN 1 ELSE 0 END) as noTags,
      SUM(CASE WHEN bioCompleteness < 30 THEN 1 ELSE 0 END) as lowBioCompleteness
    FROM author_profiles
  `);

  // ── Book gaps ──────────────────────────────────────────────────────────────
  const [[bookGaps]] = await conn.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN coverImageUrl IS NULL OR coverImageUrl = '' THEN 1 ELSE 0 END) as noCover,
      SUM(CASE WHEN s3CoverUrl IS NULL OR s3CoverUrl = '' THEN 1 ELSE 0 END) as noS3Cover,
      SUM(CASE WHEN summary IS NULL OR summary = '' THEN 1 ELSE 0 END) as noSummary,
      SUM(CASE WHEN isbn IS NULL OR isbn = '' THEN 1 ELSE 0 END) as noIsbn,
      SUM(CASE WHEN amazonUrl IS NULL OR amazonUrl = '' THEN 1 ELSE 0 END) as noAmazonUrl,
      SUM(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) as noRating,
      SUM(CASE WHEN publishedDate IS NULL OR publishedDate = '' THEN 1 ELSE 0 END) as noPublishedDate,
      SUM(CASE WHEN enrichedAt IS NULL THEN 1 ELSE 0 END) as neverEnriched
    FROM book_profiles
  `);

  // ── RAG coverage ──────────────────────────────────────────────────────────
  const [[ragGaps]] = await conn.execute(`
    SELECT
      (SELECT COUNT(*) FROM author_profiles) as totalAuthors,
      COUNT(*) as ragTotal,
      SUM(CASE WHEN ragStatus = 'ready' THEN 1 ELSE 0 END) as ragReady,
      SUM(CASE WHEN ragStatus = 'pending' THEN 1 ELSE 0 END) as ragPending,
      SUM(CASE WHEN ragStatus = 'error' THEN 1 ELSE 0 END) as ragError,
      SUM(CASE WHEN ragStatus = 'stale' THEN 1 ELSE 0 END) as ragStale
    FROM author_rag_profiles
  `);

  // ── Top 10 authors needing enrichment ─────────────────────────────────────
  const [topNeedingEnrichment] = await conn.execute(`
    SELECT authorName,
      (CASE WHEN bio IS NULL OR bio = '' THEN 1 ELSE 0 END) +
      (CASE WHEN avatarUrl IS NULL OR avatarUrl = '' THEN 1 ELSE 0 END) +
      (CASE WHEN websiteUrl IS NULL OR websiteUrl = '' THEN 1 ELSE 0 END) +
      (CASE WHEN twitterUrl IS NULL OR twitterUrl = '' THEN 1 ELSE 0 END) +
      (CASE WHEN richBioJson IS NULL OR richBioJson = '' THEN 1 ELSE 0 END) +
      (CASE WHEN tagsJson IS NULL OR tagsJson = '' OR tagsJson = '[]' THEN 1 ELSE 0 END)
      AS missingCount
    FROM author_profiles
    ORDER BY missingCount DESC, enrichedAt ASC
    LIMIT 10
  `);

  await conn.end();

  const n = (v) => Number(v ?? 0);
  const pct = (a, b) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "N/A";

  if (JSON_MODE) {
    console.log(JSON.stringify({ authorGaps, bookGaps, ragGaps, topNeedingEnrichment }, null, 2));
    return;
  }

  console.log(`\n📊 Enrichment Gap Audit Report`);
  console.log(`   Generated: ${new Date().toISOString()}`);

  console.log(`\n── Authors (${n(authorGaps.total)} total) ────────────────────────────────────`);
  console.log(`   Never enriched:      ${n(authorGaps.neverEnriched)} (${pct(n(authorGaps.neverEnriched), n(authorGaps.total))})`);
  console.log(`   No bio:              ${n(authorGaps.noBio)} (${pct(n(authorGaps.noBio), n(authorGaps.total))})`);
  console.log(`   No avatar:           ${n(authorGaps.noAvatar)} (${pct(n(authorGaps.noAvatar), n(authorGaps.total))})`);
  console.log(`   No S3 avatar:        ${n(authorGaps.noS3Avatar)} (${pct(n(authorGaps.noS3Avatar), n(authorGaps.total))})`);
  console.log(`   No rich bio:         ${n(authorGaps.noRichBio)} (${pct(n(authorGaps.noRichBio), n(authorGaps.total))})`);
  console.log(`   No tags:             ${n(authorGaps.noTags)} (${pct(n(authorGaps.noTags), n(authorGaps.total))})`);
  console.log(`   Low bio completeness (<30): ${n(authorGaps.lowBioCompleteness)} (${pct(n(authorGaps.lowBioCompleteness), n(authorGaps.total))})`);
  console.log(`   No website:          ${n(authorGaps.noWebsite)} (${pct(n(authorGaps.noWebsite), n(authorGaps.total))})`);
  console.log(`   No Twitter:          ${n(authorGaps.noTwitter)} (${pct(n(authorGaps.noTwitter), n(authorGaps.total))})`);
  console.log(`   No Substack:         ${n(authorGaps.noSubstack)} (${pct(n(authorGaps.noSubstack), n(authorGaps.total))})`);
  console.log(`   No YouTube:          ${n(authorGaps.noYoutube)} (${pct(n(authorGaps.noYoutube), n(authorGaps.total))})`);

  console.log(`\n── Books (${n(bookGaps.total)} total) ──────────────────────────────────────`);
  console.log(`   Never enriched:      ${n(bookGaps.neverEnriched)} (${pct(n(bookGaps.neverEnriched), n(bookGaps.total))})`);
  console.log(`   No cover:            ${n(bookGaps.noCover)} (${pct(n(bookGaps.noCover), n(bookGaps.total))})`);
  console.log(`   No S3 cover:         ${n(bookGaps.noS3Cover)} (${pct(n(bookGaps.noS3Cover), n(bookGaps.total))})`);
  console.log(`   No summary:          ${n(bookGaps.noSummary)} (${pct(n(bookGaps.noSummary), n(bookGaps.total))})`);
  console.log(`   No ISBN:             ${n(bookGaps.noIsbn)} (${pct(n(bookGaps.noIsbn), n(bookGaps.total))})`);
  console.log(`   No Amazon URL:       ${n(bookGaps.noAmazonUrl)} (${pct(n(bookGaps.noAmazonUrl), n(bookGaps.total))})`);
  console.log(`   No rating:           ${n(bookGaps.noRating)} (${pct(n(bookGaps.noRating), n(bookGaps.total))})`);
  console.log(`   No published date:   ${n(bookGaps.noPublishedDate)} (${pct(n(bookGaps.noPublishedDate), n(bookGaps.total))})`);

  console.log(`\n── RAG Pipeline ──────────────────────────────────────────────────`);
  const ragTotal = n(ragGaps.totalAuthors);
  const ragIndexed = n(ragGaps.ragTotal);
  console.log(`   Authors in DB:       ${ragTotal}`);
  console.log(`   Authors in RAG:      ${ragIndexed} (${pct(ragIndexed, ragTotal)})`);
  console.log(`   RAG ready:           ${n(ragGaps.ragReady)}`);
  console.log(`   RAG pending:         ${n(ragGaps.ragPending)}`);
  console.log(`   RAG error:           ${n(ragGaps.ragError)}`);
  console.log(`   RAG stale:           ${n(ragGaps.ragStale)}`);

  console.log(`\n── Top 10 Authors Needing Enrichment ────────────────────────────`);
  for (const row of topNeedingEnrichment) {
    console.log(`   ${row.authorName} — ${row.missingCount} missing fields`);
  }

  console.log(`\n✅ Audit complete`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
