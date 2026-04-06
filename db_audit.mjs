import mysql from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set in environment");
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);

const queries = [
  ["author_profiles (total)", "SELECT COUNT(*) as c FROM author_profiles"],
  ["author_profiles with bio (>50 chars)", "SELECT COUNT(*) as c FROM author_profiles WHERE bio IS NOT NULL AND LENGTH(bio) > 50"],
  ["author_profiles with richBioJson", "SELECT COUNT(*) as c FROM author_profiles WHERE richBioJson IS NOT NULL"],
  ["book_profiles (total)", "SELECT COUNT(*) as c FROM book_profiles"],
  ["book_profiles with summary (>50 chars)", "SELECT COUNT(*) as c FROM book_profiles WHERE summary IS NOT NULL AND LENGTH(summary) > 50"],
  ["book_profiles with richSummaryJson", "SELECT COUNT(*) as c FROM book_profiles WHERE richSummaryJson IS NOT NULL"],
  ["magazine_articles (total)", "SELECT COUNT(*) as c FROM magazine_articles"],
  ["magazine_articles with fullText", "SELECT COUNT(*) as c FROM magazine_articles WHERE fullText IS NOT NULL AND LENGTH(fullText) > 100"],
  ["magazine_articles ragIndexed=true", "SELECT COUNT(*) as c FROM magazine_articles WHERE ragIndexed = 1"],
  ["magazine_articles NOT yet indexed", "SELECT COUNT(*) as c FROM magazine_articles WHERE (ragIndexed = 0 OR ragIndexed IS NULL) AND (summaryText IS NOT NULL OR fullText IS NOT NULL)"],
  ["author_rag_profiles (total)", "SELECT COUNT(*) as c FROM author_rag_profiles"],
  ["author_rag_profiles status=ready", "SELECT COUNT(*) as c FROM author_rag_profiles WHERE ragStatus = 'ready'"],
  ["content_items (total)", "SELECT COUNT(*) as c FROM content_items"],
  ["content_items with description", "SELECT COUNT(*) as c FROM content_items WHERE description IS NOT NULL AND LENGTH(description) > 50"],
];

console.log("=== DATABASE CONTENT AUDIT FOR PINECONE INDEXING ===\n");
for (const [label, sql] of queries) {
  try {
    const [rows] = await conn.execute(sql);
    console.log(`  ${label}: ${rows[0].c}`);
  } catch (e) {
    console.log(`  ${label}: ERROR - ${e.message}`);
  }
}

await conn.end();
console.log("\n=== AUDIT COMPLETE ===");
