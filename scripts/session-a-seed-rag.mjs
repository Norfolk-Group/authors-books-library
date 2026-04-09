/**
 * Session A — Step 1: seedAllPending
 * Creates 'stale' RAG rows for all authors that have no entry in author_rag_profiles.
 * Idempotent — safe to run multiple times.
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

try {
  // Count total authors
  const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM author_profiles");
  console.log(`📚 Total authors: ${total}`);

  // Count existing RAG rows
  const [[{ existing }]] = await conn.execute("SELECT COUNT(*) as existing FROM author_rag_profiles");
  console.log(`🗂️  Existing RAG rows: ${existing}`);

  // Find authors with no RAG row
  const [missing] = await conn.execute(`
    SELECT ap.authorName
    FROM author_profiles ap
    LEFT JOIN author_rag_profiles arp ON ap.authorName = arp.authorName
    WHERE arp.authorName IS NULL
  `);
  console.log(`⚠️  Authors missing RAG rows: ${missing.length}`);

  if (missing.length === 0) {
    console.log("✅ All authors already have a RAG profile row — nothing to do.");
    process.exit(0);
  }

  // Insert pending rows in batches of 50
  const BATCH = 50;
  let seeded = 0;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const placeholders = batch.map(() => "(?, 'stale', 0, 0, ?, ?)").join(", ");
    const values = batch.flatMap(r => [r.authorName, now, now]);
    await conn.execute(
      `INSERT INTO author_rag_profiles (authorName, ragStatus, ragVersion, contentItemCount, createdAt, updatedAt)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE updatedAt = VALUES(updatedAt)`,
      values
    );
    seeded += batch.length;
    console.log(`  ✓ Seeded batch ${Math.floor(i / BATCH) + 1}: ${batch.length} authors`);
  }

  console.log(`\n✅ seedAllPending complete — seeded ${seeded} authors as 'stale'`);

  // Final counts
  const [[{ newTotal }]] = await conn.execute("SELECT COUNT(*) as newTotal FROM author_rag_profiles");
  const [[{ stale }]] = await conn.execute("SELECT COUNT(*) as stale FROM author_rag_profiles WHERE ragStatus = 'stale'");
  const [[{ ready }]] = await conn.execute("SELECT COUNT(*) as ready FROM author_rag_profiles WHERE ragStatus = 'ready'");
  const [[{ pending }]] = await conn.execute("SELECT COUNT(*) as pending FROM author_rag_profiles WHERE ragStatus = 'pending'");
  console.log(`\n📊 RAG Profile Summary:`);
  console.log(`   Total RAG rows: ${newTotal}`);
  console.log(`   Ready:   ${ready}`);
  console.log(`   Stale:   ${stale}`);
  console.log(`   Pending: ${pending}`);
  console.log(`   Coverage: ${Math.round((newTotal / total) * 100)}% (${newTotal}/${total})`);

} finally {
  await conn.end();
}
