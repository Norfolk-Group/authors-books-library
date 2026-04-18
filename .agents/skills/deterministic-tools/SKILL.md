---
name: deterministic-tools
description: Deterministic verification scripts for the RC Library app. Use BEFORE and AFTER major changes to verify system state. Covers DB index verification, Neon pgvector coverage, Dropbox folder access, enrichment gap auditing, and S3 mirror coverage. All scripts are read-only and safe to run at any time. Last updated April 18, 2026.
---

# RC Library — Deterministic Verification Tools

These scripts in `scripts/` provide ground-truth verification of system state. They are:
- **Read-only** — no writes, no side effects
- **Exit-coded** — code 0 = pass, code 1 = failure (for CI/agent use)
- **Self-documenting** — each script prints a clear report with fix instructions

> **IMPORTANT (Apr 18, 2026):** `verify-pinecone-coverage.mjs` is **BROKEN** — it still uses the
> Pinecone SDK which was removed. Do NOT run it. Use the Neon query below instead.
> A replacement `verify-neon-coverage.mjs` has not yet been written — this is a pending task.

---

## When to Run

| Trigger | Scripts to Run |
|---|---|
| After `pnpm db:push` | `verify-db-indexes.mjs` |
| After Neon indexing operations | ⚠️ Use manual Neon query (see below) |
| After changing Dropbox env vars | `verify-dropbox-folders.mjs` |
| Before starting an enrichment session | `audit-enrichment-gaps.mjs` |
| After S3 mirroring operations | `verify-s3-coverage.mjs` |
| At session start (full health check) | Scripts 1, 3, 4, 5 (skip broken script 2) |

## Quick Reference

```bash
# Full health check (4 working scripts — skip verify-pinecone-coverage.mjs)
node scripts/verify-db-indexes.mjs
# SKIP: node scripts/verify-pinecone-coverage.mjs  ← BROKEN (Pinecone removed)
node scripts/verify-dropbox-folders.mjs
node scripts/audit-enrichment-gaps.mjs
node scripts/verify-s3-coverage.mjs
```

### Manual Neon Vector Coverage Check (replaces broken script 2)

```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
client.connect().then(async () => {
  const r = await client.query(\"SELECT namespace, COUNT(*) as count FROM vector_embeddings GROUP BY namespace ORDER BY count DESC\");
  console.table(r.rows);
  const total = await client.query('SELECT COUNT(*) FROM vector_embeddings');
  console.log('Total vectors:', total.rows[0].count);
  client.end();
});
"
```

**Expected output (Apr 18, 2026 baseline):**
```
┌─────────────────┬───────┐
│ namespace       │ count │
├─────────────────┼───────┤
│ authors         │ 183   │
│ books           │ 165   │
│ lb_pitchdeck    │ 28    │
│ lb_documents    │ 8     │
│ lb_website      │ 7     │
│ lb_app_data     │ 4     │
└─────────────────┴───────┘
Total vectors: 395
```

---

## Script 1: `verify-db-indexes.mjs`

**Purpose:** Verifies all 42 expected database indexes exist in the MySQL schema.

**When to run:** After `pnpm db:push`, after schema changes, or when queries seem slow.

```bash
node scripts/verify-db-indexes.mjs
```

**Expected output:**
```
📊 DB Index Verification Report
   Checked: 42 indexes
   Passed:  42
   Failed:  0
✅ All indexes present
```

**If it fails:** The script prints the missing index names. Add them to `drizzle/schema.ts` and run `pnpm db:push`.

**Key indexes checked:**
- `author_profiles`: authorName, enrichedAt, bioCompleteness, s3AvatarUrl
- `book_profiles`: bookTitle, isbn, possessionStatus, format, s3CoverUrl, authorId
- `author_rag_profiles`: ragStatus, authorId
- `human_review_queue`: status, entityType, flagType

---

## Script 2: `verify-pinecone-coverage.mjs` — ⚠️ BROKEN

**Status:** Crashes on startup. Still imports `@pinecone-database/pinecone` and uses `PINECONE_API_KEY`.
Pinecone was removed in April 2026. **Do not run this script.**

**Pending task:** Rewrite as `verify-neon-coverage.mjs` using `pg` + `NEON_DATABASE_URL` to compare
`vector_embeddings` namespace counts against MySQL DB counts. Use the manual query above in the meantime.

---

## Script 3: `verify-dropbox-folders.mjs`

**Purpose:** Verifies all configured Dropbox folder paths exist and are accessible via the Dropbox API.

**When to run:** After changing `DROPBOX_*` env vars, after Dropbox OAuth token refresh issues, or when Dropbox sync fails.

```bash
node scripts/verify-dropbox-folders.mjs
```

**Expected output:**
```
📦 Dropbox Folder Verification Report
   ✅ DROPBOX_BACKUP_FOLDER: /Apps NAI/RC Library App Data/Authors and Books Backup
   ✅ DROPBOX_INBOX_FOLDER (Books): /Apps NAI/RC Library App Data/Books Content Entry Folder
   ✅ DROPBOX_AUTHORS_FOLDER: /Apps NAI/RC Library App Data/Authors Content Entry Folder

   Checked: 3 folders
   Passed:  3
   Failed:  0
✅ All Dropbox folders accessible
```

**If it fails:** The script prints the missing path and the env var to fix. Note: Dropbox API paths are **relative to the account root** — do NOT include `/Ricardo Cidale/` prefix.

---

## Script 4: `audit-enrichment-gaps.mjs`

**Purpose:** Comprehensive audit of missing enrichment fields across all authors and books. Identifies the highest-priority enrichment targets.

**When to run:** Before starting an enrichment session, or to understand the current state of the library.

```bash
node scripts/audit-enrichment-gaps.mjs          # Human-readable report
node scripts/audit-enrichment-gaps.mjs --json   # JSON output for piping
```

**Expected output (Apr 18, 2026 baseline):**
```
── Authors (183 total) ────────────────────────────────────
   Never enriched:      0 (0.0%)
   No bio:              3 (1.6%)
   No avatar:           0 (0.0%)
   No rich bio:         ~18 (9.8%)
   No tags:             0 (0.0%)   ← auto-tagged Apr 2026
   ...
── RAG Pipeline ──────────────────────────────────────────────────
   Authors in DB:       183
   Authors in RAG:      183 (100%)  ← seeded + generated Apr 2026
```

**Always exits with code 0** (informational tool, not a pass/fail check).

---

## Script 5: `verify-s3-coverage.mjs`

**Purpose:** Checks that all authors/books with source URLs (avatars, covers) also have their S3 mirror URLs populated.

**When to run:** After S3 mirroring operations, or when images fail to load in production.

```bash
node scripts/verify-s3-coverage.mjs          # Summary report
node scripts/verify-s3-coverage.mjs --list   # Show names of un-mirrored items (first 50)
```

**Expected output (Apr 18, 2026 baseline):**
```
── Author Avatars ────────────────────────────────────────────────
   Total authors:       183
   With source URL:     183
   With S3 mirror:      183 (100.0% of sourced)
   ✅ Needs mirroring:    0

── Book Covers ───────────────────────────────────────────────────
   Total books:         163
   With source URL:     163
   With S3 mirror:      162 (99.4% of sourced)
   ✅ Needs mirroring:    1
```

**Threshold:** 90% coverage required. Below threshold = exit code 1.

**If it fails:** Use `--list` flag to see which items need mirroring, then run "Mirror All Avatars/Covers to S3" in Admin Console.

---

## Stale Scripts (Pending Deletion)

The following scripts in `scripts/` are dead code and should be deleted:

| Script | Reason |
|---|---|
| `indexAllToPinecone.mjs` | Pinecone removed Apr 2026 |
| `indexAllToPinecone.py` | Pinecone removed Apr 2026 |
| `index_pinecone_batched.ts` | Pinecone removed Apr 2026 |
| `verify-pinecone-coverage.mjs` | Pinecone removed; needs rewrite for Neon |

Use `scripts/reindex_pg.cjs` for Neon re-indexing instead.

---

## Adding New Verification Scripts

When adding a new script to `scripts/`:
1. Use `.mjs` extension (ES modules)
2. Start with `dotenv.config()` to load env vars
3. Exit with `process.exit(0)` on pass, `process.exit(1)` on failure
4. Print a clear header, per-item status, and fix instructions
5. Add the script to this SKILL.md
6. Add it to the "When to Run" table above

## Column Name Convention

MySQL column names in this project are **camelCase** (matching Drizzle ORM convention), NOT snake_case. When writing raw SQL queries:

```sql
-- ✅ Correct
SELECT authorName, avatarUrl, s3AvatarUrl FROM author_profiles

-- ❌ Wrong
SELECT author_name, avatar_url, s3_avatar_url FROM author_profiles
```

## Neon Re-indexing Script

For bulk Neon re-indexing, use `scripts/reindex_pg.cjs` (pure Node.js, no tsx):

```bash
# Index 20 books starting at offset 40
node scripts/reindex_pg.cjs books 40 20

# Index 20 authors starting at offset 0
node scripts/reindex_pg.cjs authors 0 20
```

**Why `.cjs` not `.mjs`:** The tsx + Neon driver + Drizzle ORM stack OOMs in the sandbox.
The `.cjs` script uses `pg` (not `@neondatabase/serverless`) and the Gemini REST API directly,
keeping memory usage minimal. Always use this for bulk indexing operations.
