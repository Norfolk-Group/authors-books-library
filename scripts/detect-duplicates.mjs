#!/usr/bin/env node
/**
 * detect-duplicates.mjs
 * Detects duplicate book cover entries in the book_profiles table.
 *
 * Three duplicate patterns detected:
 *   1. EXACT  — same bookTitle (case-insensitive)
 *   2. NEAR   — same normalized slug (strip non-alphanumeric), different bookTitle
 *   3. COVER  — same s3CoverUrl shared by multiple distinct books
 *
 * Usage (run from project root where node_modules and .env exist):
 *   node scripts/detect-duplicates.mjs [--json] [--table book_profiles]
 *
 * Options:
 *   --json          Output results as JSON instead of human-readable text
 *   --table <name>  Table name (default: book_profiles)
 *   --title-col <n> Column holding the book title (default: bookTitle)
 *   --cover-col <n> Column holding the S3 cover URL (default: s3CoverUrl)
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { parseArgs } from 'node:util';

config();

const { values: opts } = parseArgs({
  options: {
    json:       { type: 'boolean', default: false },
    table:      { type: 'string',  default: 'book_profiles' },
    'title-col':{ type: 'string',  default: 'bookTitle' },
    'cover-col':{ type: 'string',  default: 's3CoverUrl' },
  },
  strict: false,
});

const TABLE     = opts.table;
const TITLE_COL = opts['title-col'];
const COVER_COL = opts['cover-col'];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Exact duplicates (same title, case-insensitive)
  const [exact] = await conn.execute(`
    SELECT LOWER(${TITLE_COL}) as title, COUNT(*) as cnt,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') as ids
    FROM ${TABLE}
    GROUP BY LOWER(${TITLE_COL})
    HAVING cnt > 1
  `);

  // 2. Near-duplicates (same normalized slug, different title)
  const [near] = await conn.execute(`
    SELECT LOWER(REGEXP_REPLACE(${TITLE_COL}, '[^a-z0-9]', '')) as slug,
           COUNT(*) as cnt,
           GROUP_CONCAT(${TITLE_COL} ORDER BY LENGTH(${TITLE_COL}) DESC SEPARATOR ' | ') as titles,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') as ids
    FROM ${TABLE}
    GROUP BY slug
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);

  // 3. Same S3 cover URL shared by multiple books
  const [coverDups] = await conn.execute(`
    SELECT ${COVER_COL} as coverUrl,
           COUNT(*) as cnt,
           GROUP_CONCAT(${TITLE_COL} ORDER BY LENGTH(${TITLE_COL}) DESC SEPARATOR ' | ') as titles,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') as ids
    FROM ${TABLE}
    WHERE ${COVER_COL} IS NOT NULL AND ${COVER_COL} != ''
    GROUP BY ${COVER_COL}
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);

  await conn.end();

  const results = {
    table: TABLE,
    exact:  { count: exact.length,     rows: exact },
    near:   { count: near.length,      rows: near },
    cover:  { count: coverDups.length, rows: coverDups },
    total_issues: exact.length + near.length + coverDups.length,
  };

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(`\n📚 Book Cover Duplicate Report — table: ${TABLE}\n`);
  console.log(`Exact title duplicates : ${exact.length}`);
  console.log(`Near-duplicate titles  : ${near.length}`);
  console.log(`Shared S3 cover URLs   : ${coverDups.length}`);
  console.log(`─────────────────────────────────────────`);

  if (near.length) {
    console.log('\n⚠️  Near-duplicate titles (same slug, different spelling):');
    near.forEach(r => console.log(`  [${r.ids}]  ${r.titles}`));
  }

  if (coverDups.length) {
    console.log('\n⚠️  Same S3 cover URL shared by multiple books:');
    coverDups.forEach(r => console.log(`  [${r.ids}]  ${r.titles}`));
  }

  if (exact.length) {
    console.log('\n⚠️  Exact title duplicates:');
    exact.forEach(r => console.log(`  [${r.ids}]  ${r.title}`));
  }

  if (results.total_issues === 0) {
    console.log('\n✅  No duplicates found.');
  } else {
    console.log(`\n→ Run remove-duplicates.mjs to clean up (review first with --dry-run).`);
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
