#!/usr/bin/env node
/**
 * verify-neon-coverage.mjs
 * Compares Neon pgvector vector_embeddings namespace counts against MySQL DB counts.
 * Replaces the old verify-pinecone-coverage.mjs (which used the Pinecone SDK).
 *
 * Usage:
 *   node scripts/verify-neon-coverage.mjs
 *
 * Requires:
 *   NEON_DATABASE_URL  — Neon Postgres connection string (set in .env or shell)
 *   DATABASE_URL       — MySQL connection string (set in .env or shell)
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const NEON_URL = process.env.NEON_DATABASE_URL;
const MYSQL_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!NEON_URL) {
  console.error('❌  NEON_DATABASE_URL is not set');
  process.exit(1);
}

async function getNeonCounts() {
  const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT namespace, COUNT(*) AS count
    FROM vector_embeddings
    GROUP BY namespace
    ORDER BY namespace
  `);
  await client.end();
  const counts = {};
  for (const row of res.rows) counts[row.namespace] = parseInt(row.count, 10);
  return counts;
}

async function getMysqlCounts() {
  // Parse the DATABASE_URL (mysql2 format: mysql://user:pass@host:port/db)
  const url = new URL(MYSQL_URL.replace(/^mysql2?:\/\//, 'http://'));
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || '3306', 10),
    user: url.username,
    password: url.password,
    database: url.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  });

  const [[authorRow]] = await conn.execute('SELECT COUNT(*) AS count FROM author_profiles');
  const [[bookRow]] = await conn.execute('SELECT COUNT(*) AS count FROM book_profiles');
  await conn.end();

  return {
    authors: parseInt(authorRow.count, 10),
    books: parseInt(bookRow.count, 10),
  };
}

async function main() {
  console.log('\n🔍  Verifying Neon pgvector coverage against MySQL DB...\n');

  let neon, mysql_;
  try {
    [neon, mysql_] = await Promise.all([getNeonCounts(), getMysqlCounts()]);
  } catch (err) {
    console.error('❌  Connection error:', err.message);
    process.exit(1);
  }

  const totalNeon = Object.values(neon).reduce((a, b) => a + b, 0);

  console.log('📊  Neon pgvector namespace counts:');
  for (const [ns, count] of Object.entries(neon)) {
    console.log(`   ${ns.padEnd(20)} ${count}`);
  }
  console.log(`   ${'TOTAL'.padEnd(20)} ${totalNeon}`);

  console.log('\n📊  MySQL DB counts:');
  console.log(`   ${'authors'.padEnd(20)} ${mysql_.authors}`);
  console.log(`   ${'books'.padEnd(20)} ${mysql_.books}`);

  console.log('\n📋  Coverage check:');

  const authorNeon = neon['authors'] ?? 0;
  const bookNeon = neon['books'] ?? 0;

  const authorCoverage = mysql_.authors > 0 ? Math.round((authorNeon / mysql_.authors) * 100) : 0;
  const bookCoverage = mysql_.books > 0 ? Math.round((bookNeon / mysql_.books) * 100) : 0;

  const authorStatus = authorCoverage >= 95 ? '✅' : authorCoverage >= 80 ? '⚠️ ' : '❌';
  const bookStatus = bookCoverage >= 95 ? '✅' : bookCoverage >= 80 ? '⚠️ ' : '❌';

  console.log(`   ${authorStatus} Authors: ${authorNeon}/${mysql_.authors} (${authorCoverage}%)`);
  console.log(`   ${bookStatus} Books:   ${bookNeon}/${mysql_.books} (${bookCoverage}%)`);

  const missing = {
    authors: mysql_.authors - authorNeon,
    books: mysql_.books - bookNeon,
  };

  if (missing.authors > 0 || missing.books > 0) {
    console.log('\n⚠️   Missing vectors:');
    if (missing.authors > 0) console.log(`   - ${missing.authors} authors not indexed`);
    if (missing.books > 0) console.log(`   - ${missing.books} books not indexed`);
    console.log('\n   Run: node scripts/reindex_pg.cjs author 0 999 (or book 0 999)');
  } else {
    console.log('\n✅  All authors and books are indexed in Neon pgvector.');
  }

  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
