/**
 * verify-s3-coverage.mjs
 *
 * Deterministic tool: checks that all authors/books with source URLs also have
 * their S3 mirror URLs populated. Identifies assets that need S3 mirroring.
 *
 * Run with: node scripts/verify-s3-coverage.mjs
 * Run with: node scripts/verify-s3-coverage.mjs --list   (show names of un-mirrored items)
 *
 * Exits with code 0 if S3 coverage >= 90%, code 1 if below threshold.
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

const LIST_MODE = process.argv.includes("--list");
const COVERAGE_THRESHOLD = 0.9; // 90%

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // ── Author avatar S3 coverage ──────────────────────────────────────────────
  const [[avatarStats]] = await conn.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN avatarUrl IS NOT NULL AND avatarUrl != '' THEN 1 ELSE 0 END) as hasSource,
      SUM(CASE WHEN s3AvatarUrl IS NOT NULL AND s3AvatarUrl != '' THEN 1 ELSE 0 END) as hasS3,
      SUM(CASE WHEN avatarUrl IS NOT NULL AND avatarUrl != ''
               AND (s3AvatarUrl IS NULL OR s3AvatarUrl = '') THEN 1 ELSE 0 END) as needsMirroring
    FROM author_profiles
  `);

  // ── Book cover S3 coverage ─────────────────────────────────────────────────
  const [[coverStats]] = await conn.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN coverImageUrl IS NOT NULL AND coverImageUrl != '' THEN 1 ELSE 0 END) as hasSource,
      SUM(CASE WHEN s3CoverUrl IS NOT NULL AND s3CoverUrl != '' THEN 1 ELSE 0 END) as hasS3,
      SUM(CASE WHEN coverImageUrl IS NOT NULL AND coverImageUrl != ''
               AND (s3CoverUrl IS NULL OR s3CoverUrl = '') THEN 1 ELSE 0 END) as needsMirroring
    FROM book_profiles
  `);

  // ── Authors with source but no S3 (for --list mode) ───────────────────────
  let unMirroredAuthors = [];
  let unMirroredBooks = [];
  if (LIST_MODE) {
    const [authors] = await conn.execute(`
      SELECT authorName, avatarUrl
      FROM author_profiles
      WHERE avatarUrl IS NOT NULL AND avatarUrl != ''
        AND (s3AvatarUrl IS NULL OR s3AvatarUrl = '')
      ORDER BY authorName
      LIMIT 50
    `);
    unMirroredAuthors = authors;

    const [books] = await conn.execute(`
      SELECT bookTitle, coverImageUrl
      FROM book_profiles
      WHERE coverImageUrl IS NOT NULL AND coverImageUrl != ''
        AND (s3CoverUrl IS NULL OR s3CoverUrl = '')
      ORDER BY bookTitle
      LIMIT 50
    `);
    unMirroredBooks = books;
  }

  await conn.end();

  const n = (v) => Number(v ?? 0);
  const pct = (a, b) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "N/A";
  const statusIcon = (a, b) => (b === 0 || a / b >= COVERAGE_THRESHOLD) ? "✅" : "⚠️ ";

  const avatarHasSource = n(avatarStats.hasSource);
  const avatarHasS3 = n(avatarStats.hasS3);
  const coverHasSource = n(coverStats.hasSource);
  const coverHasS3 = n(coverStats.hasS3);

  console.log(`\n☁️  S3 Mirror Coverage Report`);
  console.log(`   Threshold: ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%`);

  console.log(`\n── Author Avatars ────────────────────────────────────────────────`);
  console.log(`   Total authors:       ${n(avatarStats.total)}`);
  console.log(`   With source URL:     ${avatarHasSource}`);
  console.log(`   With S3 mirror:      ${avatarHasS3} (${pct(avatarHasS3, avatarHasSource)} of sourced)`);
  console.log(`   ${statusIcon(avatarHasS3, avatarHasSource)} Needs mirroring:    ${n(avatarStats.needsMirroring)}`);

  console.log(`\n── Book Covers ───────────────────────────────────────────────────`);
  console.log(`   Total books:         ${n(coverStats.total)}`);
  console.log(`   With source URL:     ${coverHasSource}`);
  console.log(`   With S3 mirror:      ${coverHasS3} (${pct(coverHasS3, coverHasSource)} of sourced)`);
  console.log(`   ${statusIcon(coverHasS3, coverHasSource)} Needs mirroring:    ${n(coverStats.needsMirroring)}`);

  if (LIST_MODE && unMirroredAuthors.length > 0) {
    console.log(`\n── Authors needing S3 mirror (first 50) ─────────────────────────`);
    for (const a of unMirroredAuthors) {
      console.log(`   ${a.authorName}`);
    }
  }

  if (LIST_MODE && unMirroredBooks.length > 0) {
    console.log(`\n── Books needing S3 mirror (first 50) ───────────────────────────`);
    for (const b of unMirroredBooks) {
      console.log(`   ${b.bookTitle}`);
    }
  }

  const avatarOk = avatarHasSource === 0 || avatarHasS3 / avatarHasSource >= COVERAGE_THRESHOLD;
  const coverOk = coverHasSource === 0 || coverHasS3 / coverHasSource >= COVERAGE_THRESHOLD;

  if (!avatarOk || !coverOk) {
    console.log(`\n⚠️  S3 coverage below threshold`);
    if (!avatarOk) {
      console.log(`   Fix: Admin Console → Author Enrichment → "Mirror All Avatars to S3"`);
    }
    if (!coverOk) {
      console.log(`   Fix: Admin Console → Book Enrichment → "Mirror All Covers to S3"`);
    }
    process.exit(1);
  } else {
    console.log(`\n✅ S3 mirror coverage meets threshold`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
