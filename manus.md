# RC Library App — Manus Agent Reference

**Last Updated:** April 19, 2026

> **MANDATORY:** At the end of every completed task, update this file (`manus.md`) and `CLAUDE.md`
> to reflect any new features, architectural changes, component additions, data schema changes,
> or workflow changes made during that session. Also append a dated entry to `memory.md`.
> These files are the source of truth for the project state.

---

## Project Identity

**Name:** authors-books-library
**Path:** `/home/ubuntu/authors-books-library`
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB + **Neon pgvector**
**Deployed:** `https://authlib-ehsrgokn.manus.space`
**GitHub:** `https://github.com/Norfolk-Group/rc-authors-and-book-library` (private)
**Owner:** Ricardo Cidale / Norfolk AI (NCG)

This is a personal knowledge library application cataloguing **183 authors** and **163 books**
for Ricardo Cidale / Norfolk Consulting Group. It enriches content with AI-generated bios,
avatars, book covers, summaries, social stats, and semantic vector search powered by
**Neon pgvector** (migrated from Pinecone on April 18, 2026).

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

## Agent Skills (Read Before Working on These Areas)

Skills are in `.agents/skills/` — read the relevant one before making changes:

| Skill | When to read |
|---|---|
| `.agents/skills/library-architecture/SKILL.md` | Onboarding, adding new features, architectural decisions |
| `.agents/skills/neon-rag/SKILL.md` | Neon pgvector indexing, semantic search, RAG chatbot |
| `.agents/skills/dropbox-sync/SKILL.md` | Dropbox paths, env vars, sync pipeline |
| `.agents/skills/smart-upload/SKILL.md` | AI file classification, review queue, commit flow |
| `.agents/skills/enrichment-pipeline/SKILL.md` | Enrichment orchestrator, pipeline registry, post-enrichment hooks |
| `.agents/skills/deterministic-tools/SKILL.md` | Verification scripts — DB indexes, Neon coverage, Dropbox, S3 |
| `.agents/skills/agent-mishaps/SKILL.md` | **Read first every session** — history of agent failures and mistakes |

---

## Architecture Overview

```
client/                              → React 19 SPA (Vite 6)
  src/
    pages/
      Home.tsx                       → Main library UI (Authors / Books / Audiobooks tabs)
      Admin.tsx                      → Admin Console (sidebar with grouped sections)
      AuthorDetail.tsx               → /author/:slug detail page
      BookDetail.tsx                 → /book/:slug detail page
      AuthorCompare.tsx              → /compare side-by-side comparison
      Leaderboard.tsx                → /leaderboard enrichment quality
      InterestHeatmap.tsx            → /interests/heatmap semantic UMAP heatmap
    components/
      admin/
        AdminIntelligenceTab.tsx     → Enrichment orchestrator UI
        AdminNeonTab.tsx             → Neon pgvector index admin UI
        AdminDropboxTab.tsx          → Dropbox backup/sync UI
        AdminSmartUploadTab.tsx      → Smart Upload (drag-drop + AI classify)
        AdminS3AuditTab.tsx          → S3 CDN asset migration UI
        AdminDuplicatesTab.tsx       → Near-duplicate detection UI
        AdminSemanticMapTab.tsx      → Semantic map admin UI
        AdminDropboxFolderBrowser.tsx → Dropbox folder browser
      library/
        AuthorCard.tsx               → Author card (Flowbite-based)
        BookCard.tsx                 → Book card
        ReadingPathPanel.tsx         → Curated reading path (Neon vector + LLM)
        SimilarAuthorsSection.tsx    → Neon-powered similar authors
        SimilarBooksSection.tsx      → Neon-powered similar books
      AuthorCardActions.tsx          → Per-author action buttons (Refresh All Data, etc.)
      DashboardLayout.tsx            → Sidebar layout wrapper

server/
  routers/                           → tRPC feature routers (one file per domain)
    authorProfiles.router.ts         → Bio, avatar, social link enrichment
    bookProfiles.router.ts           → Summary, cover, rating enrichment
    vectorSearch.router.ts           → Semantic search + Neon index management
    recommendations.router.ts        → similarBooks, similarAuthors, thematicSearch
    readingPath.router.ts            → Curated reading paths (quick + AI modes)
    chatbot.router.ts                → Author chatbot with RAG chunk retrieval
    smartUpload.router.ts            → Smart Upload tRPC procedures
    dropboxConfig.router.ts          → Dropbox folder config CRUD
    orchestrator.router.ts           → Enrichment pipeline trigger/monitor
    humanReviewQueue.router.ts       → Human review queue procedures
    favorites.router.ts              → Favorites toggle/list
    scheduling.router.ts             → Pipeline schedules + job history
    s3Audit.router.ts                → S3 CDN asset audit and migration
  services/
    neonVector.service.ts            → Neon pgvector client (upsert, query, ensure index)
    incrementalIndex.service.ts      → indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts           → indexRagFile, indexContentItem, embedBatch
    enrichmentOrchestrator.service.ts → All pipeline runners (bio, richBio, summary, etc.)
    aiFileClassifier.service.ts      → Claude AI file classification for Smart Upload
    semanticDuplicate.service.ts     → Near-duplicate detection (cosine >= 0.92)
    dropboxIngest.service.ts         → Dropbox -> S3 ingestion pipeline
  _core/                             → Framework plumbing — DO NOT EDIT
  storage.ts                         → S3 helpers (storagePut, storageGet)
  db.ts                              → Drizzle query helpers
  lib/
    logger.ts                        → Structured logger (debug suppressed in prod)
    parallelBatch.ts                 → Generic parallel batch executor

drizzle/
  schema.ts                          → All table definitions (46 migrations applied)
  migrations/                        → Auto-generated migration files (0000-0046)

scripts/
  reindex_pg.cjs                     → Pure-Node re-indexing script (no tsx, uses pg + Gemini REST)
  verify-neon-coverage.mjs           → Neon vector coverage report (pnpm coverage)
  run_reindex_all.sh                 → Shell wrapper for full re-index of all types
```

---

## Vector Database — Neon pgvector

**Migrated from Pinecone on April 18, 2026.** All vector operations go through `neonVector.service.ts`.

| Namespace | Vectors | Content |
|---|---|---|
| `authors` | 183 | Author bios and richBioJson |
| `books` | 165 | Book summaries and richSummaryJson |
| `lb_pitchdeck` | 28 | Library pitch deck RAG chunks |
| `lb_documents` | 8 | Library document RAG chunks |
| `lb_website` | 7 | Library website RAG chunks |
| `lb_app_data` | 4 | Library app data RAG chunks |
| `content_items` | 0 | Pending — pipeline `neon-index-content-items` not yet enabled |
| `rag_files` | 0 | Pending — pipeline `neon-index-rag-files` not yet enabled |
| **Total** | **395** | |

**Embedding model:** `models/gemini-embedding-001` with `outputDimensionality: 1536`
**Index:** HNSW cosine, 1536 dims
**Run coverage check:** `pnpm coverage`

---

## Enrichment Pipelines

All pipelines are registered in `enrichmentOrchestrator.service.ts` and managed via
Admin Console → Intelligence Dashboard → Schedules.

Key pipeline keys:
- `neon-index-authors` — re-index all authors into Neon (weekly)
- `neon-index-books` — re-index all books into Neon (weekly)
- `neon-index-content-items` — index content_items (disabled; 157 items pending)
- `neon-index-rag-files` — index RAG Markdown files (disabled; 187 files pending)
- `enrich-bio` — Perplexity bio enrichment
- `enrich-rich-bio` — Claude structured bio enrichment
- `enrich-social-stats` — Substack + YouTube stats
- `enrich-book-summary` — Claude book summary enrichment
- `generate-avatars` — Replicate/Google avatar generation
- `scrape-book-covers` — Apify Amazon cover scraping

---

## Dropbox Integration

**All cloud sync goes through Dropbox. Google Drive was removed April 2026.**

| Folder | API Path |
|---|---|
| Backup root | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| Books inbox | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| Authors inbox | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |

Always use `DROPBOX_FOLDERS` from `server/dropbox.service.ts`. Never hardcode paths.

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `NEON_DATABASE_URL` | Neon Postgres connection string (vector DB) |
| `JWT_SECRET` | Session cookie signing secret |
| `ANTHROPIC_API_KEY` | Claude (Opus for architecture, Sonnet for enrichment) |
| `GEMINI_API_KEY` | Gemini (embeddings: `gemini-embedding-001`, 1536 dims) |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox access token |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `PERPLEXITY_API_KEY` | Perplexity Sonar bio enrichment |
| `REPLICATE_API_TOKEN` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | Tavily image search |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `TWITTER_BEARER_TOKEN` | Twitter/X API v2 |
| `RAPIDAPI_KEY` | RapidAPI enrichment helpers |
| `APIFY_API_TOKEN` | Apify Amazon book cover scraping |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema (currently at migration 0046)
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (~1020 tests passing, Apr 2026)
pnpm coverage       # Neon vector coverage report
pnpm build          # production build
npx tsc --noEmit    # type check — ALWAYS trust this over the watcher
```

---

## Known Broken Features

| Feature | Status | Notes |
|---|---|---|
| CNBC article badge | Always shows 0 | CNBC API requires paid RapidAPI subscription; 403 on every request |
| `businessProfileJson` | Always null | Populated by CNBC scraper which is broken |
| `content_items` Neon vectors | 0 / 157 | Enable `neon-index-content-items` pipeline to fix |
| `rag_files` Neon vectors | 0 / 187 | Enable `neon-index-rag-files` pipeline to fix |

---

## Pending Manual Steps

| Priority | Task |
|---|---|
| **Medium** | Set `VITE_APP_LOGO` in Management UI → Settings → General (CDN URL: `https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png`) |
| **Medium** | Enable `neon-index-content-items` + `neon-index-rag-files` pipelines in Admin → Intelligence → Schedules |
| **Medium** | Run Substack post count enrichment via `enrich-social-stats` pipeline |
| **Low** | Refactor + delete `client/src/lib/authorAliases.ts` (still imported in 10+ places) |
| **Low** | Refactor + delete `client/src/lib/authorAvatars.ts` (still imported in 10+ places) |

---

## Common Pitfalls

- **Google Drive removed** — do not add `gws` or `rclone` calls
- **Stale TS watcher** — always trust `npx tsc --noEmit`
- **flowbite-react** — pinned to `0.12.16`, do not upgrade
- **Vite** — pinned to `6.x`, do not upgrade to Vite 7
- **Twitter API** — Free tier has no read access; `CreditsDepleted` handled gracefully
- **parallelBatch generic** — `parallelBatch<TInput>`, do not cast to `string[]`
- **Neon OOM in vitest** — `neonVector.test.ts` causes OOM in vitest workers; run standalone with `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run neonVector`
- **Embedding dimensions** — always use `gemini-embedding-001` with `outputDimensionality: 1536`; do NOT use `text-embedding-004` (404 on v1beta) or `gemini-embedding-001` without dimension override (produces 3072 dims, exceeds HNSW limit)

---

## Session History (Recent)

### April 19, 2026
- Full Pinecone → Neon pgvector migration completed (Apr 18-19)
- `shouldIndexPinecone` DB column renamed to `shouldIndexNeon` (migration 0046)
- `@pinecone-database/pinecone` package removed from package.json
- `pinecone-rag` skill renamed to `neon-rag`
- All test files updated (Pinecone → Neon function/describe names)
- 32 Claude Opus audit findings fixed (security, performance, UX, code quality)
- Curated Reading Paths feature added (`readingPath.router.ts` + `ReadingPathPanel.tsx`)
- Two new Neon indexing pipelines: `neon-index-content-items` + `neon-index-rag-files`
- `verify-neon-coverage.mjs` script added (`pnpm coverage`)
- OOM build failure fixed (manualChunks + lazy imports in Vite config)
- ~1020 tests passing, 0 TypeScript errors

### April 8, 2026
- Created 5 app-specific Agent Skills in `.agents/skills/`
- Rewrote CLAUDE.md and manus.md to reflect current architecture
- 956 tests passing, 0 TypeScript errors

### April 7, 2026
- Pinecone bulk indexing: 1,160 total vectors (183 authors + 163 books)
- Substack post counts: 9 authors populated
- Dropbox Configuration admin page (7 folder connections)
- Smart Upload admin page (AI classification + review queue)
- Chatbot now uses chunk retrieval (top-6 from rag_files namespace)
- bge-reranker-v2-m3 added to similarBooks, similarAuthors, thematicSearch
- Post-enrichment re-indexing hooks in all 4 enrichment pipelines
- Smart Upload auto-indexing on commit
- Google Drive fully removed from architecture
