---
name: library-architecture
description: Overall architecture reference for the RC Library app. Use when onboarding to the codebase, understanding data flow between components, adding new features, or making architectural decisions. Covers stack, database schema, tRPC router conventions, key design patterns, deterministic verification tools, known broken features, and what NOT to do. Last updated April 18, 2026.
---

# RC Library App — Architecture Reference

> **IMPORTANT CHANGES AS OF APRIL 18, 2026:**
> - Vector DB migrated from **Pinecone → Neon pgvector**. Use `neonVector.service.ts`, NOT `pinecone.service.ts`.
> - Embedding model changed: `text-embedding-004` (404 error) → `gemini-embedding-001` with `outputDimensionality: 1536`.
> - Google Drive removed. All cloud sync is Dropbox + Manus S3.
> - Migration 0045 is the latest (`pineconeNamespace` renamed to `neonNamespace` in `smart_uploads`).

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Radix UI, Wouter (routing) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL / TiDB Cloud (Drizzle ORM v0.44) — 45 migrations applied |
| Vector DB | **Neon pgvector** (`vector_embeddings` table, 1536-dim HNSW cosine index, 395 vectors) |
| File storage | Manus S3 CDN (`storagePut` / `storageGet` in `server/storage.ts`) |
| Cloud sync | Dropbox API (OAuth, auto token refresh) — **Google Drive removed Apr 2026** |
| AI / LLM | Anthropic Claude (Opus for architecture, Sonnet for enrichment), Gemini (embeddings) |
| Auth | Manus OAuth (JWT session cookies) |
| Build | Vite 6.4.1 (pinned — do NOT upgrade), esbuild, TypeScript 5.9 |
| Testing | Vitest — ~1020 tests passing (Apr 2026) |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide |
| Animation | Framer Motion |
| Logging | `server/lib/logger.ts` — structured logger (debug suppressed in prod) |

---

## Key Directories

```
client/src/
  pages/              ← Page-level React components
  components/
    admin/            ← All admin tab components (AdminXxxTab.tsx)
    library/          ← Library UI (AuthorsTabContent, BooksTabContent, AuthorCard, BookCard)
    ui/               ← shadcn/ui primitives
  lib/trpc.ts         ← tRPC client binding
  hooks/
    useLibraryData.ts ← Main data hook (filteredAuthors, filteredBooks, query state)
    useAuthorAliases.ts ← DB-backed alias map with hardcoded fallback
  App.tsx             ← Routes

server/
  routers/            ← tRPC feature routers (one file per domain)
  services/           ← Business logic services (no tRPC, pure functions)
    neonVector.service.ts       ← Neon pgvector client (REPLACES pinecone.service.ts)
    pinecone.service.ts         ← DEPRECATED — do not use; pending deletion
    incrementalIndex.service.ts ← indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts      ← RAG file generation + embedding
    enrichmentOrchestrator.service.ts ← Background job engine (13 pipelines)
  _core/              ← Framework plumbing (auth, context, LLM helpers) — DO NOT EDIT
  db.ts               ← Drizzle query helpers
  routers.ts          ← Root router (merges all feature routers)
  storage.ts          ← S3 helpers (storagePut, storageGet)
  dropbox.service.ts  ← Dropbox API client + DROPBOX_FOLDERS constant
  lib/
    logger.ts         ← Structured logger
    parallelBatch.ts  ← Generic parallel batch executor
    llmCatalogue.ts   ← Multi-vendor LLM catalogue (13 vendors, 47 models)

drizzle/
  schema.ts           ← All table definitions + indexes (25 tables)
  migrations/         ← Auto-generated migration files (0000–0045, 0045 = latest)

scripts/
  reindex_pg.cjs      ← Pure-Node Neon re-indexing (no tsx — avoids OOM)
  verify-db-indexes.mjs ← Verify all 42 DB indexes exist (read-only)
  verify-dropbox-folders.mjs ← Verify Dropbox folder accessibility (read-only)
  audit-enrichment-gaps.mjs  ← Audit enrichment gaps (read-only)
  verify-s3-coverage.mjs     ← Audit S3 mirror coverage (read-only)
  verify-pinecone-coverage.mjs ← BROKEN — still uses Pinecone SDK; needs rewrite

shared/
  types.ts            ← Shared TypeScript types (client + server)
  const.ts            ← Shared constants
```

---

## Database Schema (Core Tables)

| Table | Purpose |
|---|---|
| `author_profiles` | 183 authors — bio, richBioJson, avatarUrl, s3AvatarUrl, socialStatsJson, substackUrl, businessProfileJson, academicResearchJson |
| `book_profiles` | 163 books — title, authorId, summary, richSummaryJson, coverImageUrl, s3CoverUrl, isbn |
| `author_rag_profiles` | RAG pipeline state per author (ragStatus: pending/ready/error/stale) |
| `content_items` | Articles, videos, podcasts, newsletters per author |
| `smart_uploads` | Staging table for Smart Upload jobs (`neonNamespace` column, renamed from `pineconeNamespace` in migration 0045) |
| `dropbox_folder_configs` | Admin-managed Dropbox folder connections |
| `human_review_queue` | Items flagged for human review (near-duplicates, chatbot candidates) |
| `enrichment_schedules` | Cron-like enrichment pipeline schedules |
| `author_aliases` | DB-backed author name normalization (rawName → canonical) |
| `users` | Manus OAuth users (id, email, role: admin\|user) |

---

## Neon pgvector Namespaces (Current — Apr 18, 2026)

| Namespace | Vectors | Content |
|---|---|---|
| `authors` | 183 | Author bio + richBioJson |
| `books` | 165 | Book summary + richSummaryJson |
| `lb_pitchdeck` | 28 | Library pitch deck RAG chunks |
| `lb_documents` | 8 | Library document RAG chunks |
| `lb_website` | 7 | Library website RAG chunks |
| `lb_app_data` | 4 | Library app data RAG chunks |
| **Total** | **395** | |

**Embedding model:** `models/gemini-embedding-001` with `outputDimensionality: 1536`
**Do NOT use `text-embedding-004`** — returns 404 on the Gemini v1beta API endpoint.
**Do NOT use `gemini-embedding-001` without `outputDimensionality: 1536`** — produces 3072 dims which exceed the HNSW limit.

---

## Dropbox Folder Constants

All Dropbox paths are in `DROPBOX_FOLDERS` in `server/dropbox.service.ts`:

| Key | Env Var | Path |
|---|---|---|
| `backup` | `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `booksInbox` | `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `authorsInbox` | `DROPBOX_AUTHORS_FOLDER` | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |

**Never hardcode these paths.** Always use `DROPBOX_FOLDERS.authorsInbox` etc.

---

## tRPC Router Conventions

All feature routers live in `server/routers/`. They are merged in `server/routers/index.ts`.

```ts
// server/routers/myFeature.router.ts
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";

export const myFeatureRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => { ... }),
  create: adminProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => { ... }),
});
```

**Procedure types:**
- `publicProcedure` — no auth required
- `protectedProcedure` — requires login (any role)
- `adminProcedure` — requires `ctx.user.role === "admin"`

Keep each router under ~150 lines. Split into `server/routers/<feature>.router.ts` when they grow.

---

## Admin Console Structure

```
Content
  ├── Authors
  ├── Books
  ├── Content Items
  └── Author Aliases

Intelligence
  ├── Intelligence Dashboard (enrichment orchestrator)
  ├── Human Review Queue
  └── RAG Readiness

Media
  ├── Dropbox Config
  └── Smart Upload

System
  ├── API Health
  ├── Neon pgvector Index   ← formerly "Pinecone Index" (file still named AdminPineconeTab.tsx)
  ├── Semantic Map
  ├── LLM Catalogue
  ├── Dependencies
  └── Settings
```

---

## Data Flow: Author Enrichment → Neon

```
Admin triggers pipeline
  → enrichmentOrchestrator.service.ts: runBioEnrichment(authorId)
    → fetch bio from Perplexity/Wikipedia
    → db.update(authorProfiles).set({ bio })
    → indexAuthorIncremental(authorId)  ← fire-and-forget Neon re-index
      → embedBatch([bioText, richBioJson fields])
      → neonVector.upsertVectors({ namespace: "authors", records: [...] })
```

Always use fire-and-forget pattern:
```ts
indexAuthorIncremental(id).catch(e => logger.warn("Neon re-index failed", e));
```

## Data Flow: Interest Scoring (Neon-First)

```
User triggers "Score All Authors"
  → userInterests.router.ts: scoreAllAuthors
    → build composite query from user interests
    → embedText(compositeQuery)  ← single Gemini embed call
    → neonVector.queryVectors(namespace: "authors", topK: 30)  ← pre-filter
    → for each of top-30 candidates:
        → invokeLLM(authorBio + userInterests)  ← score 0-100
    → upsert scores to DB
```

This is ~84% cheaper than the old full-scan approach (30 LLM calls vs 183).

---

## Deterministic Verification Tools

```bash
# 1. Verify all DB indexes exist (42 expected)
node scripts/verify-db-indexes.mjs

# 2. ⚠️ BROKEN — verify-pinecone-coverage.mjs still uses Pinecone SDK
# DO NOT RUN: node scripts/verify-pinecone-coverage.mjs
# TODO: Rewrite as verify-neon-coverage.mjs using pg + NEON_DATABASE_URL

# 3. Check Dropbox folder accessibility
node scripts/verify-dropbox-folders.mjs

# 4. Audit enrichment gaps (what's missing)
node scripts/audit-enrichment-gaps.mjs
node scripts/audit-enrichment-gaps.mjs --json   # machine-readable

# 5. Check S3 mirror coverage for avatars/covers
node scripts/verify-s3-coverage.mjs
node scripts/verify-s3-coverage.mjs --list      # show un-mirrored items
```

All scripts exit with code 0 on pass, code 1 on failure. Safe to run at any time (read-only).

---

## Current System State (Apr 18, 2026)

| Metric | Value |
|---|---|
| Authors in DB | 183 |
| Books in DB | 163 |
| Authors with avatars | 183 (100%) |
| Authors with S3 avatar | 183 (100%) |
| Authors with bio | ~180 (98%) |
| Authors with tags | 183 (100%) — auto-tagged Apr 2026 |
| Authors in RAG | 183 (100%) — seeded + generated Apr 2026 |
| Books with covers | 163 (100%) |
| Books with S3 cover | ~162 (99.4%) |
| Neon vectors | 395 (183 authors + 163 books + 49 RAG chunks) |
| DB migrations applied | 45 (0000–0045) |
| Test suite | ~1020 passing, 17 skipped, 2 OOM (neonVector, pinecone) |
| TypeScript errors | 0 |

---

## Broken / Non-Functional Features

| Feature | Status | Notes |
|---|---|---|
| CNBC RapidAPI badge | **Permanently 403** | Requires paid RapidAPI subscription; never worked in prod |
| `businessProfileJson` column | **Always null** | Populated by CNBC scraper which is broken |
| `verify-pinecone-coverage.mjs` | **Crashes** | Still uses Pinecone SDK; needs rewrite for Neon |
| `pinecone.service.ts` | **Replaced** | Superseded by `neonVector.service.ts`; pending deletion |
| `pinecone.test.ts` | **OOM + stale** | Pinecone removed; pending deletion |
| `indexAllToPinecone.mjs/py/ts` | **Dead code** | Pinecone removed; pending deletion |
| "Refresh All Data" button | **Toast placeholder** | Shows "coming soon"; never implemented |
| `vectorSearch.indexEverything` | **Stub only** | Returns a message; does nothing |
| `authorAliases.ts` (client lib) | **Superseded** | DB-backed aliases are the source of truth |
| `authorAvatars.ts` (client lib) | **Superseded** | DB-backed `s3AvatarUrl` is the source of truth |

---

## What NOT to Do

- **Never use Google Drive** — removed Apr 2026. All cloud storage is Dropbox + Manus S3.
- **Never use `pinecone.service.ts`** — replaced by `neonVector.service.ts`. Pinecone removed.
- **Never use `text-embedding-004`** — returns 404 on the Gemini v1beta endpoint.
- **Never use `gemini-embedding-001` without `outputDimensionality: 1536`** — produces 3072 dims.
- **Never hardcode Dropbox paths** — always use `DROPBOX_FOLDERS` from `dropbox.service.ts`.
- **Never store file bytes in DB columns** — use S3 (`storagePut`) and store the URL.
- **Never call LLM from client-side code** — all AI calls go through tRPC procedures.
- **Never edit `server/_core/`** — framework plumbing. Use the exported helpers.
- **Never skip Neon re-index after bio/summary updates** — use fire-and-forget pattern.
- **Never run tsx-based scripts for bulk indexing** — OOMs in sandbox. Use `.cjs` + `pg` + Gemini REST.
- **Never upgrade Vite past 6.x** — Node.js 20.15.1 is below Vite 7's minimum of 20.19+.
- **Never upgrade flowbite-react past 0.12.16** — newer versions introduce `oxc-parser` native binding that fails in deployment.
- **Never run heavy client-side data transforms** — use SQL aggregates in the router instead.
- **Never access `process.env` directly in application code** — use `ENV` from `server/_core/env.ts`.

---

## Environment Variables (Key Ones)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `NEON_DATABASE_URL` | Neon Postgres connection string (pgvector) |
| `ANTHROPIC_API_KEY` | Claude API (enrichment, Smart Upload classification) |
| `GEMINI_API_KEY` | Gemini embeddings (`gemini-embedding-001` with 1536 dims) |
| `PINECONE_API_KEY` | **DEPRECATED** — Pinecone removed Apr 2026; key still in env but unused |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |

---

## Test Suite

```bash
pnpm test              # Run all tests (~1020 passing, Apr 2026)
pnpm test -- myFile    # Run specific test file
pnpm test -- --watch   # Watch mode
```

Tests live in `server/*.test.ts`. Use Vitest. Mock external services (Dropbox, Neon, Claude) with `vi.mock()`.

**Known OOM test files (sandbox constraint, not code bugs):**
- `neonVector.test.ts` — `@neondatabase/serverless` too large for vitest worker heap
- `pinecone.test.ts` — stale + OOM; should be deleted

---

## TypeScript

The project maintains **0 TypeScript errors** at all times. Run `npx tsc --noEmit` to verify.
Trust this over the watcher output.
