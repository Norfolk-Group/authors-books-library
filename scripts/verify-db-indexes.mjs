/**
 * verify-db-indexes.mjs
 *
 * Deterministic tool: verifies that all expected database indexes exist in MySQL.
 * Run with: node scripts/verify-db-indexes.mjs
 *
 * Exits with code 0 if all indexes pass, code 1 if any are missing.
 * Safe to run at any time — read-only, no modifications.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL env var not set");
  process.exit(1);
}

// Expected indexes — derived from drizzle/schema.ts
// Format: { table, indexName, columns }
const EXPECTED_INDEXES = [
  // author_profiles
  { table: "author_profiles", indexName: "author_profiles_authorName_idx", columns: ["authorName"] },
  { table: "author_profiles", indexName: "author_profiles_enrichedAt_idx", columns: ["enrichedAt"] },
  { table: "author_profiles", indexName: "author_profiles_avatarSource_idx", columns: ["avatarSource"] },
  { table: "author_profiles", indexName: "author_profiles_bioCompleteness_idx", columns: ["bioCompleteness"] },

  // book_profiles
  { table: "book_profiles", indexName: "book_profiles_authorName_idx", columns: ["authorName"] },
  { table: "book_profiles", indexName: "book_profiles_enrichedAt_idx", columns: ["enrichedAt"] },
  { table: "book_profiles", indexName: "book_profiles_isbn_idx", columns: ["isbn"] },
  { table: "book_profiles", indexName: "book_profiles_possessionStatus_idx", columns: ["possessionStatus"] },
  { table: "book_profiles", indexName: "book_profiles_format_idx", columns: ["format"] },

  // content_items
  { table: "content_items", indexName: "content_items_contentType_idx", columns: ["contentType"] },
  { table: "content_items", indexName: "content_items_title_idx", columns: ["title"] },
  { table: "content_items", indexName: "content_items_included_idx", columns: ["includedInLibrary"] },
  { table: "content_items", indexName: "content_items_qualityScore_idx", columns: ["qualityScore"] },
  { table: "content_items", indexName: "content_items_isAlive_idx", columns: ["isAlive"] },

  // favorites
  { table: "favorites", indexName: "favorites_userId_entityType_entityKey_idx", columns: ["userId", "entityType", "entityKey"] },
  { table: "favorites", indexName: "favorites_userId_idx", columns: ["userId"] },

  // enrichment_jobs
  { table: "enrichment_jobs", indexName: "enrichment_jobs_pipelineKey_idx", columns: ["pipelineKey"] },
  { table: "enrichment_jobs", indexName: "enrichment_jobs_status_idx", columns: ["status"] },

  // author_rag_profiles
  { table: "author_rag_profiles", indexName: "author_rag_profiles_authorName_idx", columns: ["authorName"] },
  { table: "author_rag_profiles", indexName: "author_rag_profiles_ragStatus_idx", columns: ["ragStatus"] },

  // author_content_links
  { table: "author_content_links", indexName: "author_content_links_authorName_idx", columns: ["authorName"] },
  { table: "author_content_links", indexName: "author_content_links_contentItemId_idx", columns: ["contentItemId"] },

  // author_subscriptions
  { table: "author_subscriptions", indexName: "author_subscriptions_author_platform_idx", columns: ["authorName", "platform"] },

  // sync_jobs
  { table: "sync_jobs", indexName: "sync_jobs_status_idx", columns: ["status"] },
  { table: "sync_jobs", indexName: "sync_jobs_target_idx", columns: ["target"] },

  // user_interests
  { table: "user_interests", indexName: "user_interests_userId_idx", columns: ["userId"] },
  { table: "user_interests", indexName: "user_interests_userId_category_idx", columns: ["userId", "category"] },

  // author_interest_scores
  { table: "author_interest_scores", indexName: "author_interest_scores_author_interest_idx", columns: ["authorName", "interestId"] },
  { table: "author_interest_scores", indexName: "author_interest_scores_userId_idx", columns: ["userId"] },
  { table: "author_interest_scores", indexName: "author_interest_scores_score_idx", columns: ["score"] },

  // tags
  { table: "tags", indexName: "tags_slug_idx", columns: ["slug"] },

  // api_registry
  { table: "api_registry", indexName: "api_registry_category_idx", columns: ["category"] },
  { table: "api_registry", indexName: "api_registry_enabled_idx", columns: ["enabled"] },

  // magazine_articles
  { table: "magazine_articles", indexName: "mag_author_idx", columns: ["authorNameNormalized"] },
  { table: "magazine_articles", indexName: "mag_source_idx", columns: ["source"] },
  { table: "magazine_articles", indexName: "mag_published_idx", columns: ["publishedAt"] },
  { table: "magazine_articles", indexName: "mag_article_id_idx", columns: ["articleId"] },
  { table: "magazine_articles", indexName: "mag_rag_idx", columns: ["ragIndexed"] },

  // human_review_queue
  { table: "human_review_queue", indexName: "hrq_reviewType_idx", columns: ["reviewType"] },
  { table: "human_review_queue", indexName: "hrq_status_idx", columns: ["status"] },
  { table: "human_review_queue", indexName: "hrq_entityName_idx", columns: ["entityName"] },
  { table: "human_review_queue", indexName: "hrq_priority_idx", columns: ["priority"] },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Get all indexes from the database
  const [rows] = await conn.execute(
    `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') as COLUMNS
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     GROUP BY TABLE_NAME, INDEX_NAME`
  );

  // Build a lookup map: "table.indexName" -> columns
  const existing = new Map();
  for (const row of rows) {
    existing.set(`${row.TABLE_NAME}.${row.INDEX_NAME}`, row.COLUMNS);
  }

  await conn.end();

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const expected of EXPECTED_INDEXES) {
    const key = `${expected.table}.${expected.indexName}`;
    if (existing.has(key)) {
      passed++;
    } else {
      failed++;
      failures.push({ table: expected.table, indexName: expected.indexName, columns: expected.columns });
    }
  }

  console.log(`\n📊 DB Index Verification Report`);
  console.log(`   Checked: ${EXPECTED_INDEXES.length} indexes`);
  console.log(`   Passed:  ${passed}`);
  console.log(`   Failed:  ${failed}`);

  if (failures.length > 0) {
    console.log(`\n❌ Missing indexes:`);
    for (const f of failures) {
      console.log(`   ${f.table}.${f.indexName} (columns: ${f.columns.join(", ")})`);
    }
    console.log(`\nFix: Add the missing indexes to drizzle/schema.ts and run pnpm db:push`);
    process.exit(1);
  } else {
    console.log(`\n✅ All indexes present`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
