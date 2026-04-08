---
name: library-architecture
description: Overall architecture reference for the RC Library app. Use when onboarding to the codebase, understanding data flow between components, adding new features, or making architectural decisions. Covers stack, database schema, tRPC router conventions, key design patterns, and what NOT to do.
---

# RC Library App — Architecture Reference

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter (routing) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL (TiDB Cloud), Drizzle ORM v0.44 |
| Vector DB | Pinecone v7 (`library-rag` index) |
| File storage | Manus S3 (via `server/storage.ts` helpers) |
| Cloud sync | Dropbox API (OAuth, token refresh) |
| AI/LLM | Anthropic Claude (Opus for architecture, Sonnet for enrichment), Gemini (embeddings) |
| Auth | Manus OAuth (JWT session cookies) |
| Tests | Vitest (956 tests passing as of Apr 2026) |

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
  dropbox.service.ts  ← Dropbox API client + folder constants

drizzle/
  schema.ts           ← All table definitions
  migrations/         ← Auto-generated migration files

shared/
  types.ts            ← Shared TypeScript types (client + server)
  const.ts            ← Shared constants
```

## Database Schema (Core Tables)

| Table | Purpose |
|---|---|
| `author_profiles` | 183 authors — bio, richBioJson, avatarUrl, socialStatsJson, substackUrl, substackPostCount |
| `book_profiles` | 163 books — title, authorId, summary, richSummaryJson, coverImageUrl, s3PdfUrl |
| `content_items` | Articles, videos, podcasts, newsletters per author |
| `rag_files` | RAG knowledge documents (chunked and indexed to Pinecone) |
| `smart_uploads` | Staging table for Smart Upload jobs |
| `dropbox_folder_configs` | Admin-managed Dropbox folder connections |
| `human_review_queue` | Items flagged for human review (chatbot candidates, near-duplicates) |
| `enrichment_jobs` | Background enrichment job log (status, progress, errors) |
| `users` | Manus OAuth users (id, email, role: admin|user) |

## tRPC Router Conventions

All feature routers live in `server/routers/`. They are merged in `server/routers.ts`.

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
  └── RAG Readiness

Media
  ├── Dropbox Config
  └── Smart Upload

System
  ├── API Health
  └── Settings
```

Each section renders a dedicated component from `client/src/components/admin/Admin*Tab.tsx`.

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

## Data Flow: Smart Upload → DB + Pinecone

```
Admin drops file on Smart Upload page
  → POST /api/upload/smart (multer → S3 → smart_uploads row)
    → aiFileClassifier.service.ts: classifyFile(uploadId)
      → Claude AI classifies content type + matches author/book
      → smart_uploads.status = "review"
Admin reviews and commits
  → trpc.smartUpload.commit(uploadId)
    → writes to correct DB table (author_profiles, book_profiles, rag_files, etc.)
    → triggerPineconeIndexing(upload)  ← fire-and-forget
      → indexAuthorIncremental / indexBookIncremental / indexRagFile / indexContentItem
```

## What NOT to Do

- **Never use Google Drive** — removed Apr 2026. All cloud storage is Dropbox + Manus S3.
- **Never hardcode Dropbox paths** — always use `DROPBOX_FOLDERS` constant from `dropbox.service.ts` or env vars.
- **Never store file bytes in DB columns** — use S3 (`storagePut`) and store the URL in the DB.
- **Never call LLM from client-side code** — all AI calls go through tRPC procedures on the server.
- **Never edit `server/_core/`** — framework plumbing. Use the exported helpers (`invokeLLM`, `storagePut`, `protectedProcedure`, etc.).
- **Never skip Pinecone re-index after bio/summary updates** — vectors go stale. Use the fire-and-forget pattern.
- **Never use `pnpm test` without checking for pre-existing skips** — `pinecone.test.ts` is skipped in CI (Vitest worker crash with Pinecone SDK). Run it manually.

## Environment Variables (Key Ones)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `ANTHROPIC_API_KEY` | Claude API (enrichment, Smart Upload classification) |
| `GEMINI_API_KEY` | Gemini embeddings |
| `PINECONE_API_KEY` | Pinecone vector DB |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth app ID |

## Test Suite

```bash
pnpm test              # Run all tests (956 passing, Apr 2026)
pnpm test -- myFile    # Run specific test file
pnpm test -- --watch   # Watch mode
```

Tests live in `server/*.test.ts`. Use Vitest. Mock external services (Dropbox, Pinecone, Claude) with `vi.mock()`.

## TypeScript

The project maintains **0 TypeScript errors** at all times. Run `pnpm tsc --noEmit` to verify before committing.
