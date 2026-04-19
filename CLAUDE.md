# CLAUDE.md — RC Library App

This file provides context for AI coding assistants (Claude Code, Manus, Gemini CLI, etc.)
working on this codebase. **Read this before making any changes.**

Last updated: April 19, 2026

---

## Project Overview

**RC Library** (`authors-books-library`) is a full-stack personal digital library for
Ricardo Cidale / Norfolk Consulting Group. It manages **183 authors** and **163 books**,
enriched with AI-generated bios, avatars, book covers, summaries, social stats, and
semantic vector search powered by **Neon pgvector** (migrated from Pinecone, April 2026).

**Live URL:** `https://authlib-ehsrgokn.manus.space`
**GitHub:** `https://github.com/Norfolk-Group/rc-authors-and-book-library` (private)

---

## Critical Rules (Read First)

1. **Never use Google Drive** — removed April 2026. All cloud storage is Dropbox + Manus S3.
   Do not add any `gws`, `rclone`, or Google Drive API calls.

2. **Always use `ENV` from `server/_core/env.ts`** — never access `process.env` directly in
   application code. Scripts (`.mjs`/`.cjs` in `scripts/`) may use `process.env` directly.

3. **Never edit `server/_core/`** — framework plumbing. Use the exported helpers only.

4. **TypeScript: 0 errors at all times.** Run `npx tsc --noEmit` to verify. Trust this over
   the watcher output.

5. **Test suite: ~1020 tests passing.** All changes must keep tests green.

6. **Always fire-and-forget Neon re-indexing** after bio/summary DB updates:
   ```ts
   indexAuthorIncremental(id).catch(e => logger.warn("Neon re-index failed", e));
   ```

7. **Never store file bytes in DB columns.** Use S3 (`storagePut`) and store the URL.

8. **Never call LLM from client-side code.** All AI calls go through tRPC procedures.

9. **Vite version pin:** Pinned to `6.x`. Do NOT upgrade to Vite 7 — the deployment
   environment runs Node.js 20.15.1, which is below Vite 7's minimum of 20.19+.

10. **flowbite-react version pin:** Pinned to `0.12.16`. Do NOT upgrade to `0.12.17+` —
    those versions introduce `oxc-parser` which has a native binding that fails in deployment.

---

## Tech Stack

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
| Build | Vite 6.4.1, esbuild, TypeScript 5.9 |
| Testing | Vitest — ~1020 tests passing (Apr 2026) |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide |
| Animation | Framer Motion |
| Logging | `server/lib/logger.ts` — structured logger (debug suppressed in prod) |

---

## Vector Database — Neon pgvector (MIGRATED FROM PINECONE, APR 18 2026)

> **IMPORTANT:** The vector database was migrated from Pinecone to Neon pgvector on April 18, 2026.
> All references to `pinecone.service.ts` are now stale. Use `neonVector.service.ts` instead.

### Connection
- **Provider:** Neon Postgres (serverless)
- **Env var:** `NEON_DATABASE_URL` (separate from the MySQL `DATABASE_URL`)
- **Driver:** `@neondatabase/serverless` (WebSocket-based) for server code; `pg` for scripts

### Table Schema
```sql
CREATE TABLE vector_embeddings (
  id          TEXT PRIMARY KEY,
  namespace   TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB,
  title       TEXT,
  text        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON vector_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON vector_embeddings (namespace);
```

### Namespaces (Current Vector Counts — Apr 18, 2026)

| Namespace | Vectors | Content |
|---|---|---|
| `authors` | 183 | Author bios and richBioJson |
| `books` | 165 | Book summaries and richSummaryJson |
| `lb_pitchdeck` | 28 | Library pitch deck RAG chunks |
| `lb_documents` | 8 | Library document RAG chunks |
| `lb_website` | 7 | Library website RAG chunks |
| `lb_app_data` | 4 | Library app data RAG chunks |
| **Total** | **395** | |

### Embedding Model
- **Model:** `models/gemini-embedding-001` with `outputDimensionality: 1536`
- **Why 1536?** pgvector's HNSW index has a 2000-dimension limit. Gemini `gemini-embedding-001`
  default produces 3072 dims (too large). `text-embedding-004` is not available on the v1beta
  API endpoint. `gemini-embedding-001` with `outputDimensionality: 1536` is the correct approach.
- **Do NOT** use `text-embedding-004` — it returns 404 on the v1beta endpoint.
- **Do NOT** use `gemini-embedding-001` without `outputDimensionality: 1536` — it produces 3072
  dims which exceed the HNSW limit.

### Key Service File
```
server/services/neonVector.service.ts   ← Neon pgvector client (all vector operations)
```

### Fire-and-Forget Re-indexing Pattern
```ts
import { indexAuthorIncremental, indexBookIncremental } from "../services/incrementalIndex.service";

// After any bio/summary DB update:
indexAuthorIncremental(authorId).catch(e => logger.warn("Neon re-index failed", e));
indexBookIncremental(bookId).catch(e => logger.warn("Neon re-index failed", e));
```

### Admin Re-indexing
The Admin Console → System → Neon pgvector Index tab has individual "Index All Authors",
"Index All Books", etc. buttons. For bulk re-indexing from the command line, use:
```bash
node scripts/reindex_pg.cjs authors 0 200
node scripts/reindex_pg.cjs books 0 200
```

---

## File Structure

```
client/src/
  pages/
    Home.tsx                    ← Main library view (Authors / Books / Audiobooks tabs)
    Admin.tsx                   ← Admin Console (sidebar with grouped sections)
    AuthorDetail.tsx            ← /author/:slug deep-link page
    BookDetail.tsx              ← /book/:slug detail page
    AuthorCompare.tsx           ← /compare — side-by-side author comparison
    Leaderboard.tsx             ← /leaderboard — enrichment quality leaderboard
  components/
    admin/
      AdminIntelligenceTab.tsx  ← Enrichment orchestrator UI (pipeline controls, job monitor)
      AdminReviewQueueTab.tsx   ← Human review queue (chatbot candidates, near-duplicates)
      AdminDropboxConfigTab.tsx ← Dropbox folder connection management
      AdminSmartUploadTab.tsx   ← Smart Upload (drag-drop, AI classify, review, commit)
      AdminRagReadinessTab.tsx  ← RAG readiness leaderboard
      AdminNeonTab.tsx          ← Neon pgvector Index admin UI
      [other admin tabs...]
    library/
      AuthorCard.tsx            ← Author card with cover strip + hover tooltips
      AuthorsTabContent.tsx     ← Authors tab with collapsible Recently Enriched/Tagged strips
      BooksTabContent.tsx       ← Books tab with collapsible Recently Tagged strip
      BookCard.tsx              ← Book card with keyboard nav
      AudioCard.tsx             ← Audiobook card
      [other library components...]
    DashboardLayout.tsx         ← Sidebar layout wrapper

server/
  routers/                      ← tRPC feature routers (one file per domain)
    authorProfiles.router.ts    ← Bio, avatar, social link enrichment
    bookProfiles.router.ts      ← Summary, cover, rating enrichment
    recommendations.router.ts   ← similarBooks, similarAuthors, thematicSearch (score-sorted)
    chatbot.router.ts           ← Author chatbot with RAG chunk retrieval
    smartUpload.router.ts       ← Smart Upload tRPC procedures
    dropboxConfig.router.ts     ← Dropbox folder config CRUD
    orchestrator.router.ts      ← Enrichment pipeline trigger/monitor
    humanReviewQueue.router.ts  ← Human review queue procedures
    vectorSearch.router.ts      ← Semantic search + Neon pgvector index management
    favorites.router.ts         ← Favorites toggle/list
    scheduling.router.ts        ← Pipeline schedules + job history
    admin.router.ts             ← Admin utility procedures
    routers.ts                  ← Root router (merges all feature routers)
  services/
    neonVector.service.ts            ← Neon pgvector client, upsert, query
    incrementalIndex.service.ts      ← indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts           ← indexRagFile, indexContentItem, embedBatch
    enrichmentOrchestrator.service.ts ← All pipeline runners (bio, richBio, summary, etc.)
    aiFileClassifier.service.ts      ← Claude AI file classification for Smart Upload
    semanticDuplicate.service.ts     ← Near-duplicate detection (cosine ≥ 0.92)
    ragReadiness.service.ts          ← RAG readiness scoring (0-100)
    contentIntelligence.service.ts   ← URL health check + LLM quality scoring
    dropboxIngest.service.ts         ← Dropbox → S3 ingestion pipeline
  _core/                        ← Framework plumbing — DO NOT EDIT
    llm.ts                      ← invokeLLM() helper
    env.ts                      ← ENV constants (use instead of process.env)
  dropbox.service.ts            ← Dropbox API client + DROPBOX_FOLDERS constant
  storage.ts                    ← S3 helpers (storagePut, storageGet)
  db.ts                         ← Drizzle query helpers
  lib/
    logger.ts                   ← Structured logger
    parallelBatch.ts            ← Generic parallel batch executor
    llmCatalogue.ts             ← Multi-vendor LLM catalogue (13 vendors, 47 models)

drizzle/
  schema.ts                     ← All table definitions (25 tables, migration 0045 = latest)
  migrations/                   ← Auto-generated migration files (0000–0045)

scripts/
  reindex_pg.cjs                ← Pure-Node re-indexing script (no tsx, uses pg + Gemini REST)
  run_reindex_all.sh            ← Shell wrapper for full re-index of all types
  find_missing_books.cjs        ← Finds and indexes books missing from Neon
  [other scripts...]

shared/
  types.ts                      ← Shared TypeScript types
  const.ts                      ← Shared constants
```

---

## Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `Home.tsx` | Main library (Authors / Books / Audiobooks tabs) |
| `/author/:slug` | `AuthorDetail.tsx` | Deep-link author detail page |
| `/book/:slug` | `BookDetail.tsx` | Deep-link book detail page |
| `/compare` | `AuthorCompare.tsx` | Side-by-side author comparison |
| `/leaderboard` | `Leaderboard.tsx` | Enrichment quality leaderboard |
| `/chat/:slug` | `AuthorChatbot.tsx` | Author chatbot |
| `/interests/heatmap` | `InterestHeatmap.tsx` | Interest heatmap |
| `/interests/contrast` | `GroupContrast.tsx` | Group contrast view |
| `/privacy` | `PrivacyPolicy.tsx` | Privacy policy |
| `/admin` | `Admin.tsx` | Admin Console (auth-gated, admin role required) |
| `/404` | `NotFound.tsx` | 404 fallback |

---

## Database Schema (Core Tables)

### `author_profiles`

| Column | Notes |
|---|---|
| `id` | Auto-increment PK |
| `authorName` | Canonical display name (unique) |
| `bio` | Short bio (Wikipedia/Perplexity/LLM) |
| `richBioJson` | Structured rich bio (fullBio, professionalSummary, personalNote) |
| `avatarUrl` / `s3AvatarUrl` | External URL / S3 CDN URL |
| `substackUrl` / `substackPostCount` | Substack URL and post count |
| `socialStatsJson` | YouTube + Twitter + Substack stats JSON |
| `categories` | Comma-separated category list |
| `createdAt` / `updatedAt` | UTC ms timestamps |

### `book_profiles`

| Column | Notes |
|---|---|
| `id` | Auto-increment PK |
| `bookTitle` | Display title (unique) |
| `authorName` | Author display name |
| `summary` | Google Books / LLM summary |
| `richSummaryJson` | Structured rich summary (keyThemes, mainArguments) |
| `coverImageUrl` / `s3CoverUrl` | External URL / S3 CDN URL |
| `s3PdfUrl` | S3 CDN URL for the book PDF |

### `smart_uploads`

Staging table for Smart Upload jobs. Statuses: `pending` → `classifying` → `review` → `committed` / `rejected` / `error`.

**Column rename (Apr 18, 2026):** `pineconeNamespace` was renamed to `neonNamespace` (migration `0045_pale_betty_ross.sql`).

### `author_aliases`

DB-backed author name normalization. Maps `rawName → canonical`. Managed via Admin → Content → Author Aliases. Seeded from `scripts/seed-author-aliases.mjs`.

---

## Admin Console Structure

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
  ├── Neon pgvector Index   ← formerly "Pinecone Index"
  └── [other system tabs]
```

---

## tRPC Router Conventions

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

Keep router files under ~150 lines. Split into `server/routers/<feature>.router.ts` when they grow.

---

## Key Conventions

### S3 Storage

Use `storagePut(key, buffer, contentType)` from `server/storage.ts`. Key conventions:
- Author avatars (AI-generated): `author-avatars/ai-<8-char-hex>.jpg`
- Author avatars (real): `author-avatars/<8-char-hex>.jpg`
- Book covers: `book-covers/<8-char-hex>.<ext>`
- Smart uploads: `smart-uploads/<timestamp>-<originalName>`

Never store file bytes in the database. Store only the S3 key and CDN URL.

### Logging

Use `logger` from `server/lib/logger.ts`:
- `logger.debug(...)` — verbose per-item progress (suppressed in production)
- `logger.info(...)` — operational milestones (always emitted)
- `logger.warn(...)` — non-fatal issues (always emitted)
- `logger.error(...)` — errors (always emitted)

Never use `console.log` directly in server production code.

### Parallel Batch Processing

Use `parallelBatch<TInput>` from `server/lib/parallelBatch.ts` for all batch procedures.
The function is generic over input type. Default concurrency is 2.

### Fire-and-Forget Neon Re-indexing

Always use `.catch()` to prevent pipeline failures from Neon errors:

```ts
// ✅ Correct pattern
await db.update(authorProfiles).set({ bio: newBio }).where(eq(authorProfiles.id, id));
indexAuthorIncremental(id).catch(e => logger.warn("Neon re-index failed", e));
```

---

## Dropbox Integration

**All cloud sync goes through Dropbox. Google Drive was removed in April 2026.**

| Folder | API Path |
|---|---|
| Backup root | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| Books inbox | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| Authors inbox | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` (env: `DROPBOX_AUTHORS_FOLDER`) |
| Graphics | `/Apps NAI/RC Library App Data/Graphics and Design` |

Always use `DROPBOX_FOLDERS` from `server/dropbox.service.ts` — never hardcode paths.
Always call `getDropboxAccessToken()` — it auto-refreshes the short-lived token.

---

## Smart Upload

Admin feature (`/admin` → Media → Smart Upload) for AI-powered file ingestion:
1. Drag-and-drop files (PDF, images, audio, video, EPUB, DOCX — 100 MB × 10)
2. Claude AI classifies each file → determines content type, matched author/book, Neon namespace
3. Admin reviews and commits → writes to DB + auto-indexes to Neon pgvector

**Column name:** `smart_uploads.neonNamespace` (was `pineconeNamespace` before Apr 18, 2026 migration).

---

## Enrichment Pipelines

All pipelines are managed by `server/services/enrichmentOrchestrator.service.ts` and
triggered from Admin → Intelligence Dashboard.

Post-enrichment Neon re-indexing is automatic for all bio/summary pipelines.

| Pipeline Key | What it does | Auto-re-indexes Neon? |
|---|---|---|
| `enrich-bios` | Fetches short author bios via Perplexity/Wikipedia | ✅ Yes |
| `enrich-rich-bios` | Generates long-form richBioJson via Claude | ✅ Yes |
| `enrich-book-summaries` | Fetches book summaries via Google Books / Perplexity | ✅ Yes |
| `enrich-rich-summaries` | Generates long-form richSummaryJson via Claude | ✅ Yes |
| `enrich-social-stats` | Fetches Twitter/Substack/LinkedIn stats | ❌ No (metadata only) |
| `enrich-avatars` | Generates AI avatars for authors | ❌ No (images only) |
| `enrich-book-covers` | Scrapes Amazon for book cover images | ❌ No (images only) |
| `neon-index-authors` | Bulk-indexes all authors to Neon pgvector | N/A (is the indexing) |
| `neon-index-books` | Bulk-indexes all books to Neon pgvector | N/A (is the indexing) |

---

## Environment Variables

All secrets are injected by the Manus platform. Use `ENV` from `server/_core/env.ts`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `NEON_DATABASE_URL` | Neon Postgres connection string (pgvector) |
| `JWT_SECRET` | Session cookie signing |
| `ANTHROPIC_API_KEY` | Claude (enrichment, Smart Upload classification) |
| `GEMINI_API_KEY` | Gemini embeddings (`gemini-embedding-001` with 1536 dims) |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `DROPBOX_AUTHORS_FOLDER` | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |
| `PERPLEXITY_API_KEY` | Perplexity Sonar bio enrichment |
| `REPLICATE_API_TOKEN` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | Tavily image search |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `TWITTER_BEARER_TOKEN` | Twitter/X API v2 (requires Basic plan for read access) |
| `RAPIDAPI_KEY` | RapidAPI enrichment helpers |
| `PINECONE_API_KEY` | Removed — Pinecone fully replaced by Neon pgvector (Apr 2026) |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (~1020 tests passing, Apr 2026)
pnpm build          # production build
npx tsc --noEmit    # type check — ALWAYS trust this over the watcher
```

---

## Design System

**Philosophy:** Editorial Intelligence — private library aesthetic with Swiss Modernist typography.

| Token | Value |
|---|---|
| Heading font | IBM Plex Sans Bold / SemiBold |
| Body font | Inter / DM Sans |
| Background | Warm off-white `oklch(0.98 0.005 80)` |
| Foreground | Deep charcoal `oklch(0.235 0.015 65)` |
| Border radius | `0.65rem` |

**Multi-theme support:** Three themes — Manus (default), Norfolk AI, Noir Dark — defined as
CSS variable sets in `client/src/index.css`. Active theme stored in `localStorage` via
`AppSettingsContext`.

### Design Rules (Absolute)

1. **Zero hardcoded colors** — No hex, rgb, rgba, or hsl literals in components. All colors from CSS variable tokens.
2. **Category identity via icon + label only** — No colored stripes or tinted backgrounds (except in Manus/Norfolk AI themes where border stripes are allowed).
3. **Top-justified card content** — All card content starts at the top (`flex-col`, `items-start`).
4. **Business-like monocolor icons** — All icons are single-color. Add subtle hover animation to interactive icons.
5. **3-hotspot interaction model** — Every card has exactly 3 clickable areas (avatar/name, cover/title, card surface). Everything else is presentational.
6. **Amazon-first for book covers** — Always scrape Amazon before falling back to Google Books or other sources.
7. **Manus theme is the seed** — Always update the Manus theme first when making design changes. Other themes branch from it.
8. **Avatar background color** — Default is Norfolk AI Teal `#0091AE`. Swatches use the official Norfolk AI palette.
9. **AppSettingsContext is the theme authority** — `ThemeContext.tsx` has been removed. Use `useAppSettings()` from `AppSettingsContext.tsx` for theme state.
10. **Sidebar open by default** — `SidebarProvider defaultOpen={true}` in Home.tsx.

---

## Avatar Generation Pipeline

### Architecture — 5-Stage Meticulous Pipeline

| Stage | File | What it does |
|---|---|---|
| 1 — Research | `authorResearcher.ts` | Wikipedia + Tavily + Apify → `AuthorResearchData` |
| 2 — Vision Analysis | `authorResearcher.ts` | Gemini Vision (multimodal) → `AuthorDescription` JSON (cached in DB) |
| 3 — Prompt Build | `promptBuilder.ts` | `AuthorDescription` → vendor-specific `ImagePromptPackage` |
| 4 — Image Gen | `imageGenerators/google.ts` or `replicate.ts` | Generates image |
| 5 — Storage | `meticulousPipeline.ts` | Uploads to S3, updates DB `s3AvatarUrl` |

**Background consistency:** The canonical background for all AI-generated avatars is
**`bokeh-gold`** — warm golden bokeh with soft amber/cream circular light orbs.
Always pass `settings.avatarBgColor` when calling `buildMeticulousPrompt()`.

**T5 Timeout:** Must be **≥ 240 seconds (4 minutes)**. Do not reduce.

---

## Author Alias System

Author name normalization is **fully DB-backed** via the `author_aliases` table.

| Layer | File | Role |
|---|---|---|
| DB table | `drizzle/schema.ts` → `authorAliases` | Stores `rawName → canonical` mappings |
| Seed script | `scripts/seed-author-aliases.mjs` | One-time seed of 159 aliases |
| tRPC router | `server/routers/authorAliases.router.ts` | `getMap`, `getAll`, `upsert`, `delete`, `resolveNames` |
| Client hook | `client/src/hooks/useAuthorAliases.ts` | Fetches alias map from DB; provides `canonicalName()` with hardcoded fallback |
| Admin UI | `client/src/components/admin/AdminAliasesTab.tsx` | CRUD UI under Admin → Content → Author Aliases |

`client/src/lib/authorAliases.ts` is kept as a fallback but should be deleted once all aliases are confirmed in the DB.

---

## Author Name Validator

The author name validator (`shared/authorNameValidator.ts`) prevents false-positive author records. Applied at three entry points: Drive scanner, `createAuthor` procedure, and Add Author form.

**Admin bypass:** Pass `allowAdminOverride: true` in the `createAuthor` procedure input.

---

## Test Files (Key Ones)

| File | What it tests |
|---|---|
| `dropbox.test.ts` | Dropbox API client, token refresh, folder listing |
| `dropboxIngest.test.ts` | Dropbox → S3 ingestion pipeline |
| `smartUpload.test.ts` | Smart Upload tRPC procedures + auto-indexing |
| `neonVector.test.ts` | Neon pgvector unit tests (mocked; OOM in vitest worker with live driver) |
| `humanReviewQueue.test.ts` | Human review queue procedures |
| `auth.logout.test.ts` | Auth logout flow |
| `favorites.test.ts` | Favorites toggle, list, checkMany |
| `authorNameValidator.test.ts` | 29 tests for name validation rules |
| `authorAliases.router.test.ts` | 9 tests for alias CRUD |
| `lib/parallelBatch.test.ts` | Generic parallel batch executor |

---

## Known Issues and Lessons Learned

### Pinecone → Neon Migration (Apr 18, 2026)

**What was done:**
- Replaced `pinecone.service.ts` with `neonVector.service.ts` (identical public API)
- Created `vector_embeddings` table in Neon Postgres with pgvector HNSW index (1536 dims)
- Renamed `smart_uploads.pineconeNamespace` → `neonNamespace` (migration 0045)
- Updated all enrichment pipeline keys from `pinecone-index-*` to `neon-index-*`
- Updated Admin UI labels from "Pinecone Index" to "Neon pgvector Index"
- Re-indexed 183 authors + 163 books using `scripts/reindex_pg.cjs`

**Failed attempts during migration:**
1. **`text-embedding-004` returns 404** — This model is not available on the Gemini v1beta API
   endpoint. Use `gemini-embedding-001` with `outputDimensionality: 1536` instead.
2. **tsx-based indexing scripts OOM in sandbox** — The tsx + Neon driver + Drizzle ORM stack
   consumes ~2GB just to start in the sandbox. Solution: use pure Node.js `.cjs` scripts with
   `pg` (not `@neondatabase/serverless`) and the Gemini REST API directly.
3. **`@neondatabase/serverless` OOM in vitest workers** — The serverless driver is too large for
   vitest's worker heap. Solution: mock the Neon client in tests and run live integration tests
   as standalone scripts.
4. **JWT authentication for admin tRPC calls from shell** — The server's `JWT_SECRET` is injected
   by the Manus platform and differs from what's in the shell environment. Cannot generate valid
   admin tokens from shell scripts. Solution: use direct DB + REST API scripts instead.
5. **Stale chunk IDs after first tsx run** — The first tsx-based run used `author-{id}-chunk0`
   IDs. The pg script used `author-{id}`. This created duplicate entries. Solution: deleted
   all `-chunk0` suffixed entries after the pg re-index completed.
6. **`ON CONFLICT` not matching** — The `ON CONFLICT (id)` clause requires the `id` column to
   be the primary key. Ensure the table uses `id TEXT PRIMARY KEY` not a composite key.

### Vitest Worker OOM (Persistent Issue)
`neonVector.test.ts` causes OOM in vitest workers due to the heavy Neon SDK dependency. This is a sandbox constraint, not a code bug. The full test suite (~1020 tests) passes; this file is the only OOM casualty. Run it standalone:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run neonVector
```

### Collapsible Activity Strips (Apr 18, 2026)
"Recently Enriched" and "Recently Tagged" strips in `AuthorsTabContent.tsx` and
`BooksTabContent.tsx` were converted from always-visible scrolling rows to collapsible pill
toggles. They default to **collapsed** so the card grid is immediately visible.

### Books Tab Search (Apr 18, 2026)
The search bar in the Authors tab was extended to also filter book titles on the Books tab.
The `query` state from `useLibraryData` already drove `filteredBooks` — the fix was simply
adding the search input UI to `BooksTabContent.tsx`.

---

## Broken / Non-Functional Features (Do Not Use Without Fixing)

### 1. CNBC RapidAPI — Permanently 403
**Status:** Built and wired, permanently non-functional.
**What was built:** `server/enrichment/rapidapi.ts` has a full CNBC franchise feed scraper
(`fetchCNBCStats`). The `businessProfileJson` column in `author_profiles` stores CNBC article
counts. `AuthorBioPanel.tsx` renders a `CNBCArticlesSection`. `FlowbiteAuthorCard.tsx` shows
a CNBC badge.
**Why it fails:** The CNBC endpoint (`cnbc.p.rapidapi.com`) requires a paid RapidAPI
subscription. All requests return 403. This feature has **never worked in production**.
**Impact:** CNBC badge on author cards always shows 0. `businessProfileJson` is always null.
**Fix options:** Subscribe to the CNBC RapidAPI plan, OR remove the CNBC UI elements and
drop the `businessProfileJson` column entirely.

### 2. CNBC Badge Always Shows 0 — Permanently Broken
**Status:** Built and wired, permanently non-functional (same as item 1 above).

### 3. Admin Infotips — Only Nav Items Done
**Status:** InfoTip tooltips added to all 24 Admin sidebar nav items. Tab content infotips (buttons, stat cards, configuration fields) were deferred.

---

## Forgotten / Never-Executed Tasks (Pending Backlog)

These tasks were explicitly requested or planned but were **never executed**. They remain
open in `todo.md`. Prioritized by impact:

| Priority | Task | Notes |
|---|---|---|
| **Medium** | Set `VITE_APP_LOGO` in Management UI → Settings → General | Manual step; CDN URL: `https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png` |
| **Medium** | Run Substack post count enrichment | Trigger `enrich-social-stats` pipeline in Admin |
| **Medium** | Enable Neon index pipelines for content_items + rag_files | Admin → Intelligence → Schedules, toggle on `neon-index-content-items` and `neon-index-rag-files` |
| **Low** | Delete `client/src/lib/authorAliases.ts` | Still imported in 10+ places; needs refactor first |
| **Low** | Delete `client/src/lib/authorAvatars.ts` | Still imported in 10+ places; needs refactor first |

---

## Imposed Features That Were Built But Are Never Used

These features were built at some point but have no active users or are permanently broken:

| Feature | Location | Status | Notes |
|---|---|---|---|
| CNBC article badge | `FlowbiteAuthorCard.tsx`, `AuthorBioPanel.tsx` | **Always shows 0** | CNBC API requires paid subscription; 403 on every request |
| `businessProfileJson` column | `author_profiles` table | **Always null** | Populated by CNBC scraper which is broken |
| `academicResearchJson` column | `author_profiles` table | Partially populated | Semantic Scholar API works but enrichment run is infrequent |
| `authorAliases.ts` (client lib) | `client/src/lib/` | **Superseded** | DB-backed aliases are the source of truth; still imported in 10+ places |
| `authorAvatars.ts` (client lib) | `client/src/lib/` | **Superseded** | DB-backed `s3AvatarUrl` is the source of truth; still imported in 10+ places |
| Google Drive integration | Removed Apr 2026 | **Removed** | All `gws`/`rclone` code removed; Dropbox is the only cloud sync |

---

## Agent Skills (in `.agents/skills/`)

These app-specific skills document repeatable patterns for this codebase:

| Skill | Description |
|---|---|
| `library-architecture` | Overall app architecture, stack, data flow, what NOT to do |
| `neon-rag` | Neon pgvector vector search, RAG chatbot, semantic recommendations |
| `dropbox-sync` | Dropbox folder paths, env vars, API patterns, sync pipeline |
| `smart-upload` | AI file classification, review queue, commit flow, auto-indexing |
| `enrichment-pipeline` | Enrichment orchestrator, pipeline registry, post-enrichment hooks |
| `deterministic-tools` | Verification scripts in `scripts/` — DB indexes, Neon coverage, Dropbox, S3, enrichment gaps |
| `agent-mishaps` | **Read first every session** — complete history of agent failures, unapproved tasks, forgotten items, and coding mistakes |


---

## Agent Mishaps — Complete Honest History

This section documents every instance where the AI agent (Manus/Claude) made mistakes,
added unapproved tasks, forgot to implement things, or failed to execute instructions.
**Read this before trusting any "done" claim from the agent.**

---

### Self-Imposed Tasks Added Without User Approval

The following features were **added to `todo.md` by the agent without user request**.
They were either built anyway (wasting time) or remain as clutter in the backlog:

| Item | Added When | Status | Notes |
|---|---|---|---|
| **Three.js `FloatingBooks.tsx`** | Mar 25, 2026 | Built, in codebase | Agent installed `@react-three/fiber` + `@react-three/drei` and built 3D floating book shapes. User never asked for this. Component is wired into `Home.tsx` hero area. |
| **`AcademicResearchPanel.tsx`** | Mar 25, 2026 | Built, partially used | Agent built a full academic research panel using OpenAlex/Semantic Scholar. The `academicResearchJson` column was added to the DB schema. User never explicitly requested this feature. |
| **57 new todo items in one session** | Mar 25, 2026 | Mixed | After a connector audit, agent added 57 new todo items across 7 features (Quartr, Apollo.io, Notion, Context7, Semantic Interest Heatmap, Curated Reading Paths, Near-Duplicate Detection) without user approval. Most were never implemented. |
| **Quartr earnings transcripts** | Mar 25, 2026 | Never built | Added to todo as a recommended connector. User never approved. |
| **Apollo.io professional profiles** | Mar 25, 2026 | Never built | Added to todo as a recommended connector. User never approved. |
| **Notion bidirectional sync** | Mar 25, 2026 | Never built | Added to todo as a recommended connector. User never approved. |
| **Context7 technical references** | Mar 25, 2026 | Never built | Added to todo as a recommended connector. User never approved. |
| **Semantic Interest Heatmap (UMAP)** | Mar 25, 2026 | Partially built | Agent added P3 todo items. A basic SVG scatter plot was built in `AdminSemanticMapTab.tsx` but UMAP clustering was never implemented. |
| **Curated Reading Paths** | Mar 25, 2026 | Never built | Added to todo as P3 feature. Never started. |
| **P3 Near-Duplicate Detection UI** | Apr 6, 2026 | Backend only | `semanticDuplicate.service.ts` was built and wired into create/update mutations. The UI review panel exists in `AdminReviewQueueTab.tsx`. But the original P3 todo item (UI for blocking saves) was never completed. |
| **CNBC RapidAPI integration** | Mar 25, 2026 | Built, permanently broken | Agent built a full CNBC scraper without confirming the user had a RapidAPI subscription. The endpoint requires a paid plan. Has never worked. |
| **Seeking Alpha integration** | Mar 25, 2026 | Built, then removed | Agent built Seeking Alpha enrichment. User cancelled it. Removed from codebase. |
| **SimilarWeb integration** | Mar 25, 2026 | Built, then cancelled | Agent recommended and started SimilarWeb integration. User cancelled it. Rolled back. |

---

### Forgotten Tasks — Marked Done But Weren't

These items were marked `[x]` in `todo.md` but the implementation was **incomplete or wrong**:

| Item | What Was Claimed | What Was Actually True |
|---|---|---|
| **Substack tab in AuthorDetail** | Marked `[x]` — "Add Substack tab" | The `SubstackPostsPanel` component was built and wired. But the three sub-tasks ("Use existing procedure", "Show post title/date/excerpt", "Show empty state") remain `[ ]` unchecked. The panel works but the sub-items were never verified. |
| **AI Search Status Indicator** | Marked `[x]` — "Add AI Search indicator" | The sidebar footer shows a static "AI Search · N vectors" label. The three sub-tasks (green dot when index has content, link to Admin Console, nudge when empty) remain `[ ]` unchecked. |
| **Backup toast with file counts** | Marked `[x]` in one session, then `[ ]` in another | The backup mutations were updated to return per-subfolder stats. But the UI toast showing those counts was never implemented. The `[x]` was premature. |
| **Admin infotips on tab content** | Marked `[x]` for nav items, deferred tab content | Only the 24 nav item infotips were done. The deferred tab content infotips (buttons, stat cards, config fields) were never implemented and remain `[ ]`. |
| **Populate Neon index (magazine feeds)** | Marked as part of migration | The todo item "Populate Pinecone index: run Admin Console → Magazine Feeds → Index All" was never updated to reflect the Neon migration. Magazine feeds table is empty anyway. |

---

### Coding Failures That Required Multiple Retries

#### Neon Migration (Apr 18, 2026) — 6 Failed Attempts
1. **Wrong embedding model** — Used `text-embedding-004` which returns 404 on the Gemini v1beta endpoint. Required 2 retries to discover `gemini-embedding-001` with `outputDimensionality: 1536` is the correct approach.
2. **tsx OOM on every attempt** — Three separate tsx-based indexing scripts all OOM'd in the sandbox before processing a single record. Required pivot to pure Node.js `.cjs` scripts.
3. **`@neondatabase/serverless` OOM in vitest** — The serverless driver is too large for vitest workers. Required 4 attempts (reducing batch size, increasing heap, mocking the module) before settling on a mocked unit test approach.
4. **JWT auth from shell** — Spent multiple attempts trying to generate valid admin JWT tokens from shell scripts to call tRPC procedures. Failed because the server's `JWT_SECRET` is injected by the Manus platform and differs from the shell env. Solution: bypass HTTP entirely.
5. **Stale `-chunk0` IDs** — First tsx run created `author-{id}-chunk0` IDs. Second pg run created `author-{id}` IDs. Both existed simultaneously. Required manual cleanup of 159 duplicate entries.
6. **`ON CONFLICT` clause wrong** — First version used `ON CONFLICT (id, namespace)` but the table has no composite unique constraint. Required fixing to `ON CONFLICT (id)`.

#### Drizzle Schema Rename (Apr 18, 2026)
- `pnpm db:push` hung waiting for interactive input (rename vs. create new column prompt). Agent killed the process 3 times before discovering the `--force` flag approach.

#### Vite 7 Upgrade Attempt (Rolled Back)
- Agent attempted to upgrade Vite from 6 to 7. Deployment failed because the deployment environment runs Node.js 20.15.1, below Vite 7's minimum of 20.19+. Rolled back and added Critical Rule #9.

#### flowbite-react `0.12.17` Upgrade (Rolled Back)
- Agent upgraded flowbite-react to `0.12.17`. Deployment failed because `oxc-parser` (a new dependency) has native bindings that fail in the deployment environment. Rolled back and pinned to `0.12.16`. Added Critical Rule #10.

#### CLAUDE.md Loaded Wrong File (Multiple Sessions)
- In several sessions, the agent loaded `claude.md` (lowercase) instead of `CLAUDE.md` (uppercase). Both files existed for a period. The lowercase `claude.md` was an older version. This caused the agent to work from stale architecture information. **Resolution:** `claude.md` was deleted; `CLAUDE.md` is the canonical file.

#### Wrong Stack Confusion (Early Sessions)
- In the first 2-3 sessions, the agent occasionally confused the project's MySQL/TiDB stack with a Postgres/Prisma stack (the Manus template default). This caused several failed `db:push` commands and incorrect schema syntax. **Resolution:** Added explicit MySQL/Drizzle notes to Critical Rules.

#### Google Drive Removal (Mar 2026)
- The project originally used Google Drive as the source of truth for folder structure. The agent built extensive `gws`/`rclone` integration. This was removed when the user switched to Dropbox. The agent continued referencing Google Drive in documentation for 2+ weeks after removal. **Resolution:** Added Critical Rule #1 (Never use Google Drive).

---

### Tasks Explicitly Requested But Never Executed

These were **user-requested** but the agent never completed them:

| Task | Requested | Status |
|---|---|---|
| **Implement "Refresh All Data" in AuthorCardActions** | Multiple sessions | Shows "coming soon" toast. Never wired. |
| **Delete stale Pinecone files** | Apr 18, 2026 | 6 files still exist: `pinecone.service.ts`, `pinecone.test.ts`, `indexAllToPinecone.mjs`, `indexAllToPinecone.py`, `index_pinecone_batched.ts`, `verify-pinecone-coverage.mjs` |
| **Rewrite `verify-pinecone-coverage.mjs` → `verify-neon-coverage.mjs`** | Apr 18, 2026 | Never done. Script still crashes. |
| **Complete Re-index All button with live progress** | Apr 18, 2026 | Work interrupted mid-session. `vectorSearch.indexEverything` is still a stub. |
| **Set `VITE_APP_LOGO` in Management UI** | Multiple sessions | Manual step never completed. |
| **Run Substack post count enrichment** | Multiple sessions | Never triggered. 40 authors have `substackUrl` but post counts are 0. |
| **Build Dropbox inbox ingestion pipeline** | Apr 7, 2026 | `dropboxIngest.service.ts` exists. Pipeline not wired into the enrichment orchestrator. |
| **S3 migration audit** | Apr 8, 2026 | Some authors still have external `avatarUrl` values instead of `s3AvatarUrl`. Migration service was planned but never built. |
| **Delete `client/src/lib/authorAliases.ts`** | Multiple sessions | Still exists. Superseded by DB-backed `author_aliases` table. |
| **Delete `client/src/lib/authorAvatars.ts`** | Multiple sessions | Still exists. Superseded by DB-backed `s3AvatarUrl` column. |
| **Commit and push to GitHub** | Apr 18, 2026 | Git history diverged between Manus and GitHub. Merge/push was interrupted when user asked to rename the repo. Never completed. |

---

## LLM Catalogue

The multi-vendor LLM catalogue data lives in `server/lib/llmCatalogue.ts` (~899 lines).
The `llm.router.ts` router (~133 lines) imports from it. **Do not add vendor/model data directly to the router.**

**13 vendors, 47 models** as of March 2026. The recommendation engine (`getRecommendedModels`)
maps task types to optimal vendor/model combinations.

---

## External Dependency Contracts

| Service | Purpose | Credential |
|---|---|---|
| Google Imagen 3 | AI avatar generation (Tier 4) | `GEMINI_API_KEY` |
| Gemini Vision | Avatar photo validation | `GEMINI_API_KEY` |
| Gemini Embeddings | 1536-dim text embeddings | `GEMINI_API_KEY` |
| Replicate Flux | AI avatar generation (Tier 5) | `REPLICATE_API_TOKEN` |
| Tavily | Web image search for avatars (Tier 2) | `TAVILY_API_KEY` |
| Wikipedia / Wikidata | Author photos (Tier 3), bio data | None (public API) |
| Perplexity | Rich bio generation | `PERPLEXITY_API_KEY` |
| Anthropic Claude Opus | RAG generation, Digital Me synthesis | `ANTHROPIC_API_KEY` |
| Apify | Amazon book cover scraping | `APIFY_API_TOKEN` |
| RapidAPI | Yahoo Finance stats | `RAPIDAPI_KEY` |
| Twitter Bearer | Twitter follower counts | `TWITTER_BEARER_TOKEN` |
| YouTube Data API | Channel stats | `YOUTUBE_API_KEY` |
| Dropbox OAuth 2 | S3-to-Dropbox sync target | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` |
| Manus Forge S3 | File storage (avatars, covers, RAG files) | `BUILT_IN_FORGE_API_KEY` |
| Neon Postgres | pgvector vector database | `NEON_DATABASE_URL` |
| TiDB / MySQL | Primary relational database | `DATABASE_URL` |
| Manus OAuth | User authentication | `VITE_APP_ID`, `JWT_SECRET` |
