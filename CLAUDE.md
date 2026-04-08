# CLAUDE.md — RC Library App

This file provides context for AI coding assistants (Claude Code, Manus, Gemini CLI, etc.)
working on this codebase. **Read this before making any changes.**

Last updated: April 2026

---

## Project Overview

**RC Library** (`authors-books-library`) is a full-stack personal digital library for
Ricardo Cidale / Norfolk Consulting Group. It manages **183 authors** and **163 books**,
enriched with AI-generated bios, avatars, book covers, summaries, social stats, and
semantic vector search powered by Pinecone.

**Live URL:** `https://authlib-ehsrgokn.manus.space`
**GitHub:** `https://github.com/norfolk-ai/authors-books-library` (private)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Radix UI, Wouter (routing) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL / TiDB Cloud (Drizzle ORM v0.44) |
| Vector DB | Pinecone v7 (`library-rag` index, 4 namespaces, ~1,160 vectors) |
| File storage | Manus S3 CDN (`storagePut` / `storageGet` in `server/storage.ts`) |
| Cloud sync | Dropbox API (OAuth, auto token refresh) — **Google Drive removed Apr 2026** |
| AI / LLM | Anthropic Claude (Opus for architecture, Sonnet for enrichment), Gemini (embeddings) |
| Auth | Manus OAuth (JWT session cookies) |
| Build | Vite 6.4.1, esbuild, TypeScript 5.9 |
| Testing | Vitest — **956 tests passing** (Apr 2026) |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide |
| Animation | Framer Motion |
| Logging | `server/lib/logger.ts` — structured logger (debug suppressed in prod) |

> **Vite version pin:** Pinned to `6.x`. Do NOT upgrade to Vite 7 — the deployment
> environment runs Node.js 20.15.1 which is below Vite 7's minimum of 20.19+.

> **flowbite-react version pin:** Pinned to `0.12.16`. Do NOT upgrade to `0.12.17+` —
> those versions introduce `oxc-parser` which has a native binding that fails in deployment.

---

## File Structure

```
client/src/
  pages/
    Home.tsx                    ← Main library view (Authors / Books / Audiobooks tabs)
    admin/Admin.tsx             ← Admin Console (sidebar with grouped sections)
    AuthorDetail.tsx            ← /author/:slug deep-link page
    BookDetail.tsx              ← /book/:slug deep-link page
    AuthorCompare.tsx           ← /compare — side-by-side author comparison
    Leaderboard.tsx             ← /leaderboard — enrichment quality leaderboard
  components/
    admin/
      AdminIntelligenceTab.tsx  ← Enrichment orchestrator UI (pipeline controls, job monitor)
      AdminReviewQueueTab.tsx   ← Human review queue (chatbot candidates, near-duplicates)
      AdminDropboxConfigTab.tsx ← Dropbox folder connection management
      AdminSmartUploadTab.tsx   ← Smart Upload (drag-drop, AI classify, review, commit)
      AdminRagReadinessTab.tsx  ← RAG readiness leaderboard
      [other admin tabs...]
    library/
      AuthorCard.tsx            ← Author card with cover strip + hover tooltips
      BookCard.tsx              ← Book card with keyboard nav
      AudioCard.tsx             ← Audiobook card
      [other library components...]
    DashboardLayout.tsx         ← Sidebar layout wrapper

server/
  routers/                      ← tRPC feature routers (one file per domain)
    authorProfiles.router.ts    ← Bio, avatar, social link enrichment
    bookProfiles.router.ts      ← Summary, cover, rating enrichment
    recommendations.router.ts   ← similarBooks, similarAuthors, thematicSearch (Pinecone + reranker)
    chatbot.router.ts           ← Author chatbot with RAG chunk retrieval
    smartUpload.router.ts       ← Smart Upload tRPC procedures
    dropboxConfig.router.ts     ← Dropbox folder config CRUD
    orchestrator.router.ts      ← Enrichment pipeline trigger/monitor
    humanReviewQueue.router.ts  ← Human review queue procedures
    search.router.ts            ← Semantic search across namespaces
    favorites.router.ts         ← Favorites toggle/list
    scheduling.router.ts        ← Pipeline schedules + job history
    admin.router.ts             ← Admin utility procedures
    routers.ts                  ← Root router (merges all feature routers)
  services/
    enrichmentOrchestrator.service.ts ← All pipeline runners (bio, richBio, summary, etc.)
    pinecone.service.ts               ← Pinecone client, upsert, query, rerank
    incrementalIndex.service.ts       ← indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts            ← indexRagFile, indexContentItem, embedBatch
    aiFileClassifier.service.ts       ← Claude AI file classification for Smart Upload
    semanticDuplicate.service.ts      ← Near-duplicate detection (cosine ≥ 0.92)
    ragReadiness.service.ts           ← RAG readiness scoring (0-100)
    contentIntelligence.service.ts    ← URL health check + LLM quality scoring
    dropboxIngest.service.ts          ← Dropbox → S3 ingestion pipeline
  _core/                        ← Framework plumbing — DO NOT EDIT
    llm.ts                      ← invokeLLM() helper
    env.ts                      ← ENV constants (use instead of process.env)
  dropbox.service.ts            ← Dropbox API client + DROPBOX_FOLDERS constant
  storage.ts                    ← S3 helpers (storagePut, storageGet)
  db.ts                         ← Drizzle query helpers
  lib/
    logger.ts                   ← Structured logger
    parallelBatch.ts            ← Generic parallel batch executor

drizzle/
  schema.ts                     ← All table definitions
  migrations/                   ← Auto-generated migration files

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

### `rag_files`

Chunked RAG documents indexed to Pinecone `rag_files` namespace.

### `content_items`

Individual content items (articles, videos, podcasts, newsletters) per author.
Indexed to Pinecone `content_items` namespace.

### `smart_uploads`

Staging table for Smart Upload jobs. Statuses: `pending` → `classifying` → `review` → `committed` / `rejected` / `error`.

### `dropbox_folder_configs`

Admin-managed Dropbox folder connections. Managed via Admin → Media → Dropbox Config.

### `human_review_queue`

Items flagged for human review (chatbot candidates, near-duplicates).

### `enrichment_jobs`

Background enrichment job log (pipeline name, status, progress, errors).

---

## Pinecone Vector Database

**Index:** `library-rag` | **Dimension:** 1536 | **Metric:** cosine | **Cloud:** AWS us-east-1

| Namespace | Vectors (Apr 2026) | Content |
|---|---|---|
| `authors` | ~465 | Author bios, richBioJson fields |
| `books` | ~409 | Book summaries, themes, richSummaryJson |
| `rag_files` | ~129 | Chunked RAG documents |
| `content_items` | ~157 | Individual content items |

**Reranker:** `bge-reranker-v2-m3` applied to `similarBooks`, `similarAuthors`, `thematicSearch`.

**Post-enrichment re-indexing:** All bio/summary enrichment pipelines automatically call
`indexAuthorIncremental` or `indexBookIncremental` after each DB update (fire-and-forget).

See `.agents/skills/pinecone-rag/SKILL.md` for full Pinecone patterns.

---

## Dropbox Integration

**All cloud sync goes through Dropbox. Google Drive was removed in April 2026.**

| Folder | API Path |
|---|---|
| Backup root | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| Books inbox | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| Authors inbox | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |
| Graphics | `/Apps NAI/RC Library App Data/Graphics and Design` |

Always use `DROPBOX_FOLDERS` from `server/dropbox.service.ts` — never hardcode paths.
Always call `getDropboxAccessToken()` — it auto-refreshes the short-lived token.

See `.agents/skills/dropbox-sync/SKILL.md` for full Dropbox patterns.

---

## Smart Upload

Admin feature (`/admin` → Media → Smart Upload) for AI-powered file ingestion:
1. Drag-and-drop files (PDF, images, audio, video, EPUB, DOCX — 100 MB × 10)
2. Claude AI classifies each file → determines content type, matched author/book, Pinecone namespace
3. Admin reviews and commits → writes to DB + auto-indexes to Pinecone

See `.agents/skills/smart-upload/SKILL.md` for full Smart Upload patterns.

---

## Enrichment Pipelines

All pipelines are managed by `server/services/enrichmentOrchestrator.service.ts` and
triggered from Admin → Intelligence Dashboard.

Post-enrichment Pinecone re-indexing is automatic for all bio/summary pipelines.

See `.agents/skills/enrichment-pipeline/SKILL.md` for full pipeline patterns.

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
  └── Settings
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

### Fire-and-Forget Pinecone Re-indexing

Always use `.catch()` to prevent pipeline failures from Pinecone errors:

```ts
// ✅ Correct pattern
await db.update(authorProfiles).set({ bio: newBio }).where(eq(authorProfiles.id, id));
indexAuthorIncremental(id).catch(e => logger.warn("Pinecone re-index failed", e));
```

---

## Environment Variables

All secrets are injected by the Manus platform. Use `ENV` from `server/_core/env.ts`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `ANTHROPIC_API_KEY` | Claude (enrichment, Smart Upload classification) |
| `GEMINI_API_KEY` | Gemini embeddings |
| `PINECONE_API_KEY` | Pinecone vector DB |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `PERPLEXITY_API_KEY` | Perplexity Sonar bio enrichment |
| `REPLICATE_API_TOKEN` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | Tavily image search |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `TWITTER_BEARER_TOKEN` | Twitter/X API v2 (requires Basic plan for read access) |
| `RAPIDAPI_KEY` | RapidAPI enrichment helpers |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (956 tests passing, Apr 2026)
pnpm build          # production build
npx tsc --noEmit    # type check — ALWAYS trust this over the watcher
```

---

## Common Pitfalls

**Never use Google Drive** — removed Apr 2026. All cloud storage is Dropbox + Manus S3.
Do not add any `gws` or `rclone` calls.

**Stale TS watcher errors** — Always trust `npx tsc --noEmit` over the watcher output.

**Protected vs public procedures** — Enrichment mutations use `adminProcedure`.
Only user-specific operations use `protectedProcedure`. Public reads use `publicProcedure`.

**No local image assets** — All images must be uploaded to CDN via `manus-upload-file --webdev`.
Never put images in `client/public/` or `client/src/assets/`.

**`parallelBatch` generic type** — The function signature is `parallelBatch<TInput>`.
Do not cast to `string[]`.

**Pinecone test skip** — `pinecone.test.ts` is skipped in CI due to a Vitest worker crash
with the Pinecone SDK. Run it manually: `pnpm test -- pinecone`.

**Twitter API credits** — The Free tier does not include read access to user lookup endpoints.
The `twitter.ts` helper handles `CreditsDepleted` gracefully (returns `null`).

**Vite version** — Pinned to `6.x`. Do NOT upgrade to Vite 7.

**flowbite-react version** — Pinned to `0.12.16`. Do NOT upgrade.

---

## Agent Skills (in `.agents/skills/`)

These app-specific skills document repeatable patterns for this codebase:

| Skill | Description |
|---|---|
| `library-architecture` | Overall app architecture, stack, data flow, what NOT to do |
| `pinecone-rag` | Pinecone indexing, querying, reranking, chatbot chunk retrieval |
| `dropbox-sync` | Dropbox folder paths, env vars, API patterns, sync pipeline |
| `smart-upload` | AI file classification, review queue, commit flow, auto-indexing |
| `enrichment-pipeline` | Enrichment orchestrator, pipeline registry, post-enrichment hooks |

Read the relevant skill before working on any of these areas.

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

---

## Test Files (Key Ones)

| File | What it tests |
|---|---|
| `dropbox.test.ts` | Dropbox API client, token refresh, folder listing |
| `dropboxIngest.test.ts` | Dropbox → S3 ingestion pipeline |
| `dropboxPaths.test.ts` | Live validation of both Dropbox folder paths |
| `smartUpload.test.ts` | Smart Upload tRPC procedures + auto-indexing |
| `pinecone.test.ts` | Pinecone indexing + search (skipped in CI — run manually) |
| `humanReviewQueue.test.ts` | Human review queue procedures |
| `auth.logout.test.ts` | Auth logout flow |
| `favorites.test.ts` | Favorites toggle, list, checkMany |
| `lib/parallelBatch.test.ts` | Generic parallel batch executor |
