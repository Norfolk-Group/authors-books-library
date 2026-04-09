---
name: deterministic-tools
description: Deterministic verification scripts for the RC Library app. Use BEFORE and AFTER major changes to verify system state. Covers DB index verification, Pinecone coverage, Dropbox folder access, enrichment gap auditing, and S3 mirror coverage. All scripts are read-only and safe to run at any time.
---

# RC Library — Deterministic Verification Tools

These scripts in `scripts/` provide ground-truth verification of system state. They are:
- **Read-only** — no writes, no side effects
- **Exit-coded** — code 0 = pass, code 1 = failure (for CI/agent use)
- **Self-documenting** — each script prints a clear report with fix instructions

## When to Run

| Trigger | Scripts to Run |
|---|---|
| After `pnpm db:push` | `verify-db-indexes.mjs` |
| After Pinecone indexing operations | `verify-pinecone-coverage.mjs` |
| After changing Dropbox env vars | `verify-dropbox-folders.mjs` |
| Before starting an enrichment session | `audit-enrichment-gaps.mjs` |
| After S3 mirroring operations | `verify-s3-coverage.mjs` |
| At session start (full health check) | All 5 in sequence |

## Quick Reference

```bash
# Full health check (run all 5)
node scripts/verify-db-indexes.mjs
node scripts/verify-pinecone-coverage.mjs
node scripts/verify-dropbox-folders.mjs
node scripts/audit-enrichment-gaps.mjs
node scripts/verify-s3-coverage.mjs
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

## Script 2: `verify-pinecone-coverage.mjs`

**Purpose:** Compares Pinecone vector counts (per namespace) against DB entity counts. Reports coverage gaps.

**When to run:** After "Index All Authors/Books" operations, or when interest scoring seems incomplete.

```bash
node scripts/verify-pinecone-coverage.mjs
```

**Expected output:**
```
📊 Pinecone Coverage Report
   Index: library-rag

   Namespace: authors
   ✅ DB authors: 187 | Pinecone vectors: 187 | Coverage: 100.0%
   ✅ RAG-ready authors: 10 | Pinecone vectors: 187 | RAG coverage: 100.0%

   Namespace: books
   ✅ DB books: 163 | Pinecone vectors: 163 | Coverage: 100.0%
```

**Threshold:** 90% coverage required. Below threshold = exit code 1.

**If it fails:** Go to Admin Console → Intelligence → Pinecone → "Index All Authors" or "Index All Books".

**Note:** The `articles` namespace has no DB baseline for comparison (articles are not tracked in a separate count table).

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

**Expected output (Apr 2026 baseline):**
```
── Authors (187 total) ────────────────────────────────────
   Never enriched:      0 (0.0%)
   No bio:              4 (2.1%)
   No avatar:           0 (0.0%)
   No rich bio:         18 (9.6%)
   No tags:             169 (90.4%)   ← major gap
   ...
── RAG Pipeline ──────────────────────────────────────────────────
   Authors in DB:       187
   Authors in RAG:      10 (5.3%)    ← major gap
```

**Key gaps to address:**
1. **Tags** — 90.4% of authors have no tags. Run "Enrich All Tags" in Admin Console.
2. **RAG coverage** — only 5.3% of authors are in the RAG pipeline. Run "Build RAG Files" for all authors.
3. **Rich bio** — 9.6% of authors have no rich bio JSON. Run "Enrich All Rich Bios".

**Always exits with code 0** (informational tool, not a pass/fail check).

---

## Script 5: `verify-s3-coverage.mjs`

**Purpose:** Checks that all authors/books with source URLs (avatars, covers) also have their S3 mirror URLs populated.

**When to run:** After S3 mirroring operations, or when images fail to load in production.

```bash
node scripts/verify-s3-coverage.mjs          # Summary report
node scripts/verify-s3-coverage.mjs --list   # Show names of un-mirrored items (first 50)
```

**Expected output (Apr 2026 baseline):**
```
── Author Avatars ────────────────────────────────────────────────
   Total authors:       187
   With source URL:     187
   With S3 mirror:      187 (100.0% of sourced)
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

## Adding New Verification Scripts

When adding a new script to `scripts/`:
1. Use `.mjs` extension (ES modules)
2. Start with `dotenv.config()` to load env vars
3. Exit with `process.exit(0)` on pass, `process.exit(1)` on failure
4. Print a clear header, per-item status, and fix instructions
5. Add the script to this SKILL.md
6. Add it to `verify-db-indexes.mjs` if it checks DB state

## Column Name Convention

MySQL column names in this project are **camelCase** (matching Drizzle ORM convention), NOT snake_case. When writing raw SQL queries:

```sql
-- ✅ Correct
SELECT authorName, avatarUrl, s3AvatarUrl FROM author_profiles

-- ❌ Wrong
SELECT author_name, avatar_url, s3_avatar_url FROM author_profiles
```
