/**
 * verify-pinecone-coverage.mjs
 *
 * Deterministic tool: compares Pinecone vector counts against DB author/book counts.
 * Reports coverage gaps so agents know which entities need (re)indexing.
 *
 * Run with: node scripts/verify-pinecone-coverage.mjs
 *
 * Exits with code 0 if coverage >= 90%, code 1 if below threshold.
 * Safe to run at any time — read-only, no modifications.
 */
import mysql from "mysql2/promise";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "library-rag";

if (!DATABASE_URL || !PINECONE_API_KEY) {
  console.error("❌ Missing required env vars: DATABASE_URL, PINECONE_API_KEY");
  process.exit(1);
}

const COVERAGE_THRESHOLD = 0.9; // 90% minimum

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.index(PINECONE_INDEX);

  // ── DB counts ──────────────────────────────────────────────────────────────
  const [[authorRow]] = await conn.execute("SELECT COUNT(*) as cnt FROM author_profiles");
  const [[bookRow]] = await conn.execute("SELECT COUNT(*) as cnt FROM book_profiles");
  const [[ragReadyRow]] = await conn.execute(
    "SELECT COUNT(*) as cnt FROM author_rag_profiles WHERE rag_status = 'ready'"
  );
  await conn.end();

  const dbAuthors = Number(authorRow.cnt);
  const dbBooks = Number(bookRow.cnt);
  const ragReadyAuthors = Number(ragReadyRow.cnt);

  // ── Pinecone namespace stats ───────────────────────────────────────────────
  let authorVectors = 0;
  let bookVectors = 0;
  let articleVectors = 0;

  try {
    const stats = await index.describeIndexStats();
    const namespaces = stats.namespaces || {};
    authorVectors = namespaces["authors"]?.vectorCount || 0;
    bookVectors = namespaces["books"]?.vectorCount || 0;
    articleVectors = namespaces["articles"]?.vectorCount || 0;
  } catch (err) {
    console.error("⚠️  Could not fetch Pinecone stats:", err.message);
  }

  // ── Coverage calculations ──────────────────────────────────────────────────
  const authorCoverage = dbAuthors > 0 ? authorVectors / dbAuthors : 0;
  const bookCoverage = dbBooks > 0 ? bookVectors / dbBooks : 0;
  const ragCoverage = ragReadyAuthors > 0 ? authorVectors / ragReadyAuthors : 0;

  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const status = (n) => n >= COVERAGE_THRESHOLD ? "✅" : "⚠️ ";

  console.log(`\n📊 Pinecone Coverage Report`);
  console.log(`   Index: ${PINECONE_INDEX}`);
  console.log(`\n   Namespace: authors`);
  console.log(`   ${status(authorCoverage)} DB authors: ${dbAuthors} | Pinecone vectors: ${authorVectors} | Coverage: ${pct(authorCoverage)}`);
  console.log(`   ${status(ragCoverage)} RAG-ready authors: ${ragReadyAuthors} | Pinecone vectors: ${authorVectors} | RAG coverage: ${pct(ragCoverage)}`);
  console.log(`\n   Namespace: books`);
  console.log(`   ${status(bookCoverage)} DB books: ${dbBooks} | Pinecone vectors: ${bookVectors} | Coverage: ${pct(bookCoverage)}`);
  console.log(`\n   Namespace: articles`);
  console.log(`   ℹ️  Article vectors: ${articleVectors} (no DB baseline for comparison)`);

  const allPass = authorCoverage >= COVERAGE_THRESHOLD && bookCoverage >= COVERAGE_THRESHOLD;

  if (!allPass) {
    console.log(`\n⚠️  Coverage below ${pct(COVERAGE_THRESHOLD)} threshold`);
    if (authorCoverage < COVERAGE_THRESHOLD) {
      const gap = dbAuthors - authorVectors;
      console.log(`   Authors: ${gap} authors need Pinecone indexing`);
      console.log(`   Fix: Admin Console → Intelligence → Pinecone → "Index All Authors"`);
    }
    if (bookCoverage < COVERAGE_THRESHOLD) {
      const gap = dbBooks - bookVectors;
      console.log(`   Books: ${gap} books need Pinecone indexing`);
      console.log(`   Fix: Admin Console → Intelligence → Pinecone → "Index All Books"`);
    }
    process.exit(1);
  } else {
    console.log(`\n✅ All namespaces meet coverage threshold (${pct(COVERAGE_THRESHOLD)})`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
