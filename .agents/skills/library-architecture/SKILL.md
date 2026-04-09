---
name: library-architecture
description: Overall architecture reference for the RC Library app. Use when onboarding to the codebase, understanding data flow between components, adding new features, or making architectural decisions. Covers stack, database schema, tRPC router conventions, key design patterns, deterministic verification tools, and what NOT to do.
---

# RC Library App — Architecture Reference

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter (routing) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL (TiDB Cloud), Drizzle ORM v0.44 |
| Vector DB | Pinecone v7 (`library-rag` index, 1536-dim, cosine) |
| File storage | Manus S3 (via `server/storage.ts` helpers) |
| Cloud sync | Dropbox API (OAuth, token refresh) |
| AI/LLM | Anthropic Claude (Sonnet for enrichment), Gemini (embeddings via `text-embedding-004`) |
| Auth | Manus OAuth (JWT session cookies) |
| Tests | Vitest (963 tests passing as of Apr 2026) |

## Key Directories

```
client/src/
  pages/              ← Page-level React components
  components/
    admin/            ← All admin tab components (AdminXxxTab.tsx)
    ui/               ← shadcn/ui primitives
  lib/trpc.ts         ← tRPC client binding
  App.tsx             ← Routes

server/
  routers/            ← tRPC feature routers (one file per domain)
  services/           ← Business logic services (no tRPC, pure functions)
  _core/              ← Framework plumbing (auth, context, LLM helpers) — DO NOT EDIT
  db.ts               ← Drizzle query helpers
  routers.ts          ← Root router (merges all feature routers)
  storage.ts          ← S3 helpers (storagePut, storageGet)
  dropbox.service.ts  ← Dropbox API client + DROPBOX_FOLDERS constant

drizzle/
  schema.ts           ← All table definitions + indexes
  migrations/         ← Auto-generated migration files (0043 = latest)

scripts/              ← Deterministic verification tools (see below)
shared/
  types.ts            ← Shared TypeScript types (client + server)
  const.ts            ← Shared constants
```

## Database Schema (Core Tables)

| Table | Purpose |
|---|---|
| `author_profiles` | 187 authors — bio, richBioJson, avatarUrl, s3AvatarUrl, socialStatsJson, substackUrl, bioCompleteness |
| `book_profiles` | 163 books — title, authorId, summary, richSummaryJson, coverImageUrl, s3CoverUrl, isbn |
| `author_rag_profiles` | RAG pipeline state per author (ragStatus: pending/ready/error/stale) |
| `content_items` | Articles, videos, podcasts, newsletters per author |
| `smart_uploads` | Staging table for Smart Upload jobs |
| `dropbox_folder_configs` | Admin-managed Dropbox folder connections |
| `human_review_queue` | Items flagged for human review (near-duplicates, chatbot candidates) |
| `enrichment_schedules` | Cron-like enrichment pipeline schedules |
| `users` | Manus OAuth users (id, email, role: admin\|user) |

## Pinecone Namespaces

| Namespace | Content | Dimension |
|---|---|---|
| `authors` | Author bio + richBioJson chunks | 1536 |
| `books` | Book summary + richSummaryJson chunks | 1536 |
| `articles` | Content item text chunks | 1536 |

**Important:** The Pinecone index uses **1536 dimensions** (Gemini `text-embedding-004`). Do not use 3072-dim models.

## Dropbox Folder Constants

All Dropbox paths are in `DROPBOX_FOLDERS` in `server/dropbox.service.ts`:

| Key | Env Var | Path |
|---|---|---|
| `backup` | `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `booksInbox` | `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `booksProcessed` | — | `{booksInbox}/Processed` |
| `authorsInbox` | `DROPBOX_AUTHORS_FOLDER` | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |
| `authorsProcessed` | — | `{authorsInbox}/Processed` |

**Never hardcode these paths.** Always use `DROPBOX_FOLDERS.authorsInbox` etc.

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

**Router file size limit:** keep each router under ~150 lines. Split into `server/routers/<feature>.router.ts` when they grow.

## Admin Console Structure

The Admin page (`client/src/pages/admin/Admin.tsx`) uses a sidebar with grouped sections:

```
Content
  ├── Authors
  ├── Books
  └── Content Items

Intelligence
  ├── Intelligence Dashboard (enrichment orchestrator)
  ├── Human Review Queue
  ├── RAG Readiness
  ├── Pinecone
  └── Semantic Map  ← NEW (Apr 2026)

Media
  ├── Dropbox Config
  └── Smart Upload

System
  ├── API Health
  └── Settings
```

Each section renders a dedicated component from `client/src/components/admin/Admin*Tab.tsx`.

## Deterministic Verification Tools

Run these scripts to verify system state before/after major changes:

```bash
# 1. Verify all DB indexes exist (42 expected)
node scripts/verify-db-indexes.mjs

# 2. Check Pinecone vector coverage vs DB counts
node scripts/verify-pinecone-coverage.mjs

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

## Current System State (Apr 2026)

From `audit-enrichment-gaps.mjs` live run:

| Metric | Value |
|---|---|
| Authors in DB | 187 |
| Books in DB | 163 |
| Authors with avatars | 187 (100%) |
| Authors with S3 avatar | 187 (100%) |
| Authors with bio | 183 (97.9%) |
| Authors with tags | 18 (9.6%) — **major gap** |
| Authors in RAG | 10 (5.3%) — **major gap** |
| Books with covers | 163 (100%) |
| Books with S3 cover | 162 (99.4%) |

## Data Flow: Author Enrichment → Pinecone

```
Admin triggers pipeline
  → enrichmentOrchestrator.service.ts: runBioEnrichment(authorId)
    → fetch bio from Perplexity/Wikipedia
    → db.update(authorProfiles).set({ bio })
    → indexAuthorIncremental(authorId)  ← fire-and-forget Pinecone re-index
      → embedBatch([bioText, richBioJson fields])
      → pinecone.upsert({ namespace: "authors", records: [...] })
```

## Data Flow: Interest Scoring (Pinecone-First, Apr 2026)

```
User triggers "Score All Authors"
  → userInterests.router.ts: scoreAllAuthors
    → build composite query from user interests
    → embedText(compositeQuery)  ← single Gemini embed call
    → pinecone.queryVectors(namespace: "authors", topK: 30)  ← pre-filter
    → for each of top-30 candidates:
        → invokeLLM(authorBio + userInterests)  ← score 0-100
    → upsert scores to DB
```

This is ~84% cheaper than the old full-scan approach (30 LLM calls vs 183).

## Near-Duplicate Detection (Apr 2026)

`checkAuthorDuplicate` and `checkBookDuplicate` from `semanticDuplicate.service.ts` are wired into:
- `createAuthor` and `updateAuthor` in `authorProfiles.router.ts`
- `handleCreateBook` and `handleUpdateBook` in `server/lib/bookHandlers/crudHandlers.ts`

Duplicates are flagged in `human_review_queue` automatically on every save.

## What NOT to Do

- **Never use Google Drive** — removed Apr 2026. All cloud storage is Dropbox + Manus S3.
- **Never hardcode Dropbox paths** — always use `DROPBOX_FOLDERS` constant from `dropbox.service.ts`.
- **Never store file bytes in DB columns** — use S3 (`storagePut`) and store the URL in the DB.
- **Never call LLM from client-side code** — all AI calls go through tRPC procedures on the server.
- **Never edit `server/_core/`** — framework plumbing. Use the exported helpers.
- **Never skip Pinecone re-index after bio/summary updates** — vectors go stale.
- **Never use 3072-dim embeddings** — the Pinecone index is 1536-dim (`text-embedding-004`).
- **Never run heavy client-side data transforms** — use SQL aggregates (COUNT, SUM CASE WHEN) in the router instead of filtering in JS.
- **Never use `pnpm test` without checking for pre-existing skips** — `pinecone.test.ts` is skipped in CI (Vitest worker crash with Pinecone SDK). Run it manually.

## Environment Variables (Key Ones)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `ANTHROPIC_API_KEY` | Claude API (enrichment, Smart Upload classification) |
| `GEMINI_API_KEY` | Gemini embeddings (`text-embedding-004`) |
| `PINECONE_API_KEY` | Pinecone vector DB |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `DROPBOX_AUTHORS_FOLDER` | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |

## Test Suite

```bash
pnpm test              # Run all tests (963 passing, Apr 2026)
pnpm test -- myFile    # Run specific test file
pnpm test -- --watch   # Watch mode
```

Tests live in `server/*.test.ts`. Use Vitest. Mock external services (Dropbox, Pinecone, Claude) with `vi.mock()`.

## TypeScript

The project maintains **0 TypeScript errors** at all times. Run `npx tsc --noEmit` to verify before committing.

## Database Indexes (Migration 0043)

Key indexes added Apr 2026 for query performance:
- `book_profiles.isbn` — ISBN lookups
- `book_profiles.possessionStatus` — filter by owned/wishlist/etc.
- `book_profiles.format` — filter by ebook/paperback/audiobook
- `author_profiles.bioCompleteness` — sort by enrichment quality
