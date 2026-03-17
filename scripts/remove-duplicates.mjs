#!/usr/bin/env node
/**
 * remove-duplicates.mjs
 * Removes duplicate book cover entries from the book_profiles table.
 *
 * Strategy: for each duplicate group, keep the row with the LONGEST title
 * (most complete) and the richest cover data (s3CoverUrl > coverImageUrl > NULL).
 * The loser rows are deleted. A backup SQL file is written before any deletion.
 *
 * Usage (run from project root where node_modules and .env exist):
 *   node scripts/remove-duplicates.mjs [--dry-run] [--table book_profiles]
 *
 * Options:
 *   --dry-run       Show what would be deleted without making changes
 *   --table <name>  Table name (default: book_profiles)
 *   --title-col <n> Column holding the book title (default: bookTitle)
 *   --cover-col <n> Column holding the S3 cover URL (default: s3CoverUrl)
 *   --backup <path> Path to write backup SQL (default: /tmp/book-cover-dedup-backup.sql)
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';

config();

const { values: opts } = parseArgs({
  options: {
    'dry-run':  { type: 'boolean', default: false },
    table:      { type: 'string',  default: 'book_profiles' },
    'title-col':{ type: 'string',  default: 'bookTitle' },
    'cover-col':{ type: 'string',  default: 's3CoverUrl' },
    backup:     { type: 'string',  default: '/tmp/book-cover-dedup-backup.sql' },
  },
  strict: false,
});

const TABLE     = opts.table;
const TITLE_COL = opts['title-col'];
const COVER_COL = opts['cover-col'];
const DRY_RUN   = opts['dry-run'];

/**
 * Score a row: higher = better to keep.
 * Prefers: has s3CoverUrl > has coverImageUrl > longer title > lower id
 */
function score(row) {
  let s = 0;
  if (row.s3CoverUrl)    s += 100;
  if (row.coverImageUrl) s += 50;
  s += (row[TITLE_COL]?.length ?? 0);
  s -= row.id * 0.0001; // tiebreak: keep earlier row
  return s;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Find all near-duplicate groups (same normalized slug)
  const [groups] = await conn.execute(`
    SELECT LOWER(REGEXP_REPLACE(${TITLE_COL}, '[^a-z0-9]', '')) as slug,
           GROUP_CONCAT(id ORDER BY id SEPARATOR ',') as ids
    FROM ${TABLE}
    GROUP BY slug
    HAVING COUNT(*) > 1
  `);

  if (groups.length === 0) {
    console.log('✅  No duplicate groups found.');
    await conn.end();
    return;
  }

  console.log(`Found ${groups.length} duplicate group(s).`);

  const toDelete = [];
  const toKeep   = [];

  for (const group of groups) {
    const ids = group.ids.split(',').map(Number);
    const [rows] = await conn.execute(
      `SELECT id, ${TITLE_COL}, ${COVER_COL}, coverImageUrl FROM ${TABLE} WHERE id IN (${ids.join(',')})`
    );
    rows.sort((a, b) => score(b) - score(a));
    const winner = rows[0];
    const losers = rows.slice(1);
    toKeep.push(winner);
    toDelete.push(...losers);
    console.log(`  KEEP  [${winner.id}] "${winner[TITLE_COL]}"${winner[COVER_COL] ? ' (has S3 cover)' : ''}`);
    losers.forEach(l => console.log(`  DELETE[${l.id}] "${l[TITLE_COL]}"`));
  }

  if (toDelete.length === 0) {
    console.log('✅  Nothing to delete.');
    await conn.end();
    return;
  }

  // Write backup SQL
  const backupSql = toDelete.map(r =>
    `-- Deleted duplicate: id=${r.id} title="${r[TITLE_COL]}"\n` +
    `INSERT IGNORE INTO ${TABLE} (id, ${TITLE_COL}, ${COVER_COL}) VALUES (${r.id}, '${r[TITLE_COL].replace(/'/g,"\\'")}', ${r[COVER_COL] ? `'${r[COVER_COL]}'` : 'NULL'});`
  ).join('\n');
  writeFileSync(opts.backup, backupSql, 'utf8');
  console.log(`\nBackup written to: ${opts.backup}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${toDelete.length} row(s). Re-run without --dry-run to apply.`);
    await conn.end();
    return;
  }

  const deleteIds = toDelete.map(r => r.id);
  const [result] = await conn.execute(
    `DELETE FROM ${TABLE} WHERE id IN (${deleteIds.join(',')})`
  );
  console.log(`\n✅  Deleted ${result.affectedRows} duplicate row(s).`);
  await conn.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
