# RC Library App — Manus Agent Reference

## Standing Rules

**Last Updated:** April 8, 2026 — Agent Skills compliance: created 5 app-specific skills in `.agents/skills/`, rewrote CLAUDE.md and manus.md to reflect current architecture (Pinecone 1,160 vectors, Dropbox-only sync, Smart Upload, enrichment orchestrator with post-enrichment re-indexing, 956 tests passing).

> **MANDATORY:** At the end of every completed task, update this file (`manus.md`) and `CLAUDE.md`
> to reflect any new features, architectural changes, component additions, data schema changes,
> or workflow changes made during that session. Also append a dated entry to `memory.md`.
> These files are the source of truth for the project state.

---

## Project Identity

**Name:** authors-books-library
**Path:** `/home/ubuntu/authors-books-library`
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB + Pinecone v7
**Deployed:** `https://authlib-ehsrgokn.manus.space`
**Owner:** Ricardo Cidale / Norfolk AI (NCG)

This is a personal knowledge library application cataloguing **183 authors** and **163 books**
for Ricardo Cidale / Norfolk Consulting Group. It enriches content with AI-generated bios,
avatars, book covers, summaries, social stats, and semantic vector search powered by Pinecone.

---

## Critical Rules (Read First)

1. **Never use Google Drive** — removed April 2026. All cloud storage is Dropbox + Manus S3.
   Do not add any `gws`, `rclone`, or Google Drive API calls.

2. **Always use `ENV` from `server/_core/env.ts`** — never access `process.env` directly.

3. **Never edit `server/_core/`** — framework plumbing. Use the exported helpers only.

4. **TypeScript: 0 errors at all times.** Run `npx tsc --noEmit` to verify.

5. **Test suite: 956 tests passing.** All changes must keep tests green.

6. **Always fire-and-forget Pinecone re-indexing** after bio/summary DB updates:
   ```ts
   indexAuthorIncremental(id).catch(e => logger.warn("Pinecone re-index failed", e));
   ```

7. **Never store file bytes in DB columns.** Use S3 (`storagePut`) and store the URL.

8. **Never call LLM from client-side code.** All AI calls go through tRPC procedures.

---

## Agent Skills (Read Before Working on These Areas)

Skills are in `.agents/skills/` — read the relevant one before making changes:

| Skill | When to read |
|---|---|
| `.agents/skills/library-architecture/SKILL.md` | Onboarding, adding new features, architectural decisions |
| `.agents/skills/pinecone-rag/SKILL.md` | Pinecone indexing, search, reranking, chatbot RAG |
| `.agents/skills/dropbox-sync/SKILL.md` | Dropbox paths, env vars, sync pipeline |
| `.agents/skills/smart-upload/SKILL.md` | AI file classification, review queue, commit flow |
| `.agents/skills/enrichment-pipeline/SKILL.md` | Enrichment orchestrator, pipeline registry, post-enrichment hooks |

---

## Architecture Overview

```
client/                              → React 19 SPA (Vite 6)
  src/
    pages/
      Home.tsx                       → Main library UI (Authors / Books / Audiobooks tabs)
      admin/Admin.tsx                → Admin Console (sidebar with grouped sections)
      AuthorDetail.tsx               → /author/:slug detail page
      BookDetail.tsx                 → /book/:slug detail page
      AuthorCompare.tsx              → /compare side-by-side comparison
      Leaderboard.tsx                → /leaderboard enrichment quality
    components/
      admin/
        AdminIntelligenceTab.tsx     → Enrichment orchestrator UI
        AdminReviewQueueTab.tsx      → Human review queue
        AdminDropboxConfigTab.tsx    → Dropbox folder management
        AdminSmartUploadTab.tsx      → Smart Upload (drag-drop + AI classify)
        AdminRagReadinessTab.tsx     → RAG readiness leaderboard
      library/                       → Author/book/audio cards and panels
      FlowbiteAuthorCard.tsx         → Primary author card (3D tilt, avatar, book strip)
      DashboardLayout.tsx            → Sidebar layout wrapper

server/
  routers/                           → tRPC feature routers (one file per domain)
  services/                          → Business logic (no tRPC, pure functions)
    enrichmentOrchestrator.service.ts → All pipeline runners
    pinecone.service.ts               → Pinecone client, upsert, query, rerank
    incrementalIndex.service.ts       → indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts            → indexRagFile, indexContentItem, embedBatch
    aiFileClassifier.service.ts       → Claude AI file classification
    semanticDuplicate.service.ts      → Near-duplicate detection
  _core/                             → Framework plumbing — DO NOT EDIT
  dropbox.service.ts                 → Dropbox API client + DROPBOX_FOLDERS constant
  storage.ts                         → S3 helpers (storagePut, storageGet)
  db.ts                              → Drizzle query helpers
  lib/
    logger.ts                        → Structured logger
    parallelBatch.ts                 → Generic parallel batch executor

drizzle/
  schema.ts                          → All table definitions
```

---

## Pinecone Vector Database

**Index:** `library-rag` | **Dimension:** 1536 | **Metric:** cosine

| Namespace | Vectors (Apr 2026) | Content |
|---|---|---|
| `authors` | ~465 | Author bios, richBioJson |
| `books` | ~409 | Book summaries, themes |
| `rag_files` | ~129 | Chunked RAG documents |
| `content_items` | ~157 | Articles, videos, podcasts |

**Reranker:** `bge-reranker-v2-m3` on `similarBooks`, `similarAuthors`, `thematicSearch`.

**Chatbot:** Uses chunk retrieval (top-6 chunks from `rag_files` namespace per turn).

---

## Dropbox Integration

**All cloud sync goes through Dropbox. Google Drive was removed April 2026.**

| Folder | API Path |
|---|---|
| Backup root | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| Books inbox | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| Authors inbox | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` (env: `DROPBOX_AUTHORS_FOLDER`) |

Always use `DROPBOX_FOLDERS` from `server/dropbox.service.ts`. Never hardcode paths.

---

## Admin Console Sections

```
Content:     Authors | Books | Content Items
Intelligence: Intelligence Dashboard | Human Review Queue | RAG Readiness
Media:        Dropbox Config | Smart Upload
System:       API Health | Settings
```

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB |
| `ANTHROPIC_API_KEY` | Claude (enrichment, Smart Upload) |
| `GEMINI_API_KEY` | Gemini embeddings |
| `PINECONE_API_KEY` | Pinecone |
| `DROPBOX_ACCESS_TOKEN` | Short-lived (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived refresh |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | OAuth credentials |
| `DROPBOX_BACKUP_FOLDER` | `/Apps NAI/RC Library App Data/Authors and Books Backup` |
| `DROPBOX_INBOX_FOLDER` | `/Apps NAI/RC Library App Data/Books Content Entry Folder` |
| `DROPBOX_AUTHORS_FOLDER` | `/Apps NAI/RC Library App Data/Authors Content Entry Folder` |
| `PERPLEXITY_API_KEY` | Bio enrichment |
| `TAVILY_API_KEY` | Image search |
| `GEMINI_API_KEY` | Embeddings + vision |
| `REPLICATE_API_TOKEN` | Flux avatar generation |
| `YOUTUBE_API_KEY` | YouTube stats |

---

## Development Commands

```bash
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (956 tests passing, Apr 2026)
pnpm db:push        # generate + migrate schema
npx tsc --noEmit    # type check (always trust this over watcher)
pnpm build          # production build
```

---

## Session History (Recent)

### April 8, 2026
- Created 5 app-specific Agent Skills in `.agents/skills/`
- Rewrote CLAUDE.md and manus.md to reflect current architecture
- All 956 tests passing, 0 TypeScript errors

### April 7, 2026 (P0/P1 Pinecone + Smart Upload session)
- Pinecone bulk indexing: 1,160 total vectors (183 authors + 163 books)
- Substack post counts: 9 authors populated
- Dropbox Configuration admin page (7 folder connections)
- Smart Upload admin page (AI classification + review queue)
- P0: Chatbot now uses chunk retrieval (top-6 from rag_files namespace)
- P0: bge-reranker-v2-m3 added to similarBooks, similarAuthors, thematicSearch
- P1: Post-enrichment Pinecone re-indexing hooks in all 4 enrichment pipelines
- P1: Smart Upload auto-indexing on commit
- Dropbox env vars fixed: DROPBOX_BACKUP_FOLDER and DROPBOX_INBOX_FOLDER updated
- Google Drive fully removed from architecture

### April 2, 2026
- Code quality refactoring: Home.tsx split, Admin.tsx split into 15 tab components
- bookProfiles.router.ts CRUD extracted into bookCrud.router.ts
- Content Items enrichment (TED/OpenAlex/OMDB/Substack)
- FlowbiteAuthorCard 4-zone redesign

---

## Common Pitfalls

- **Google Drive removed** — do not add `gws` or `rclone` calls
- **Stale TS watcher** — always trust `npx tsc --noEmit`
- **Pinecone test skip** — `pinecone.test.ts` skipped in CI; run manually
- **flowbite-react** — pinned to `0.12.16`, do not upgrade
- **Vite** — pinned to `6.x`, do not upgrade to Vite 7
- **Twitter API** — Free tier has no read access; `CreditsDepleted` handled gracefully
- **parallelBatch generic** — `parallelBatch<TInput>`, do not cast to `string[]`
