# Authors & Books Library — Project TODO

Last cleaned: Apr 19, 2026

---

## Branding

- [ ] Set VITE_APP_LOGO in Management UI → Settings → General (manual step — paste CDN URL: https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png)

---

## Neon Vector — Pending Pipelines

- [ ] Enable `neon-index-content-items` pipeline in Admin → Intelligence → Schedules (157 content items at 0% coverage)
- [ ] Enable `neon-index-rag-files` pipeline in Admin → Intelligence → Schedules (187 RAG files at 0% coverage)
- [ ] Populate Neon vector index: run Admin Console → Magazine Feeds → "Sync All Feeds" then "Index All in Neon"

---

## Substack Post Counts

- [ ] Enrich Substack post counts: run Admin Console → Author Enrichment → "Enrich All Social Stats"
  - This will populate actual post counts for the 40 authors with substackUrl
  - Makes the orange Substack badge show "42 posts" instead of just "Substack"

---

## S3 CDN Migration & Image Performance

- [ ] Audit all avatar URLs — identify non-S3 sources (Wikipedia, Tavily, Replicate)
- [ ] Re-upload all non-S3 avatars to S3 CDN and update author_profiles.avatar_url
- [ ] Audit all book cover URLs — identify non-S3 sources
- [ ] Re-upload all non-S3 book covers to S3 CDN and update book_profiles.s3_cover_url
- [ ] Verify 100% of avatars and covers are on S3 CDN after migration

---

## Cleanup — Optional

- [ ] Delete `client/src/lib/authorAliases.ts` (superseded by DB; still imported in 10+ places — refactor callers first)
- [ ] Delete `client/src/lib/authorAvatars.ts` (superseded by DB; still imported in 10+ places — refactor callers first)
- [ ] Add orchestrator first-run guidance card (shows when no jobs have run yet)
- [ ] Add infotips to all Admin tab content: buttons, stat cards, configuration fields

---

## Semantic Interest Heatmap

- [ ] Semantic Interest Heatmap: cluster authors/books by vector similarity with UMAP (P3 — deferred)

---

## Enrichment Orchestrator Run (Manual Steps)

- [ ] Trigger all enrichment pipelines via orchestrator runAllPipelines
- [ ] Verify Neon vector index populated (authors, books, articles namespaces)
- [ ] Verify Substack post counts updated on author badges

---

## S3 Media Migration

- [ ] Audit all asset URL columns: avatarUrl, s3AvatarUrl, coverImageUrl, s3CoverUrl, pdfUrl, s3PdfUrl, fileUrl
- [ ] Build S3 migration service: fetch from current URL → re-upload to S3 → update DB column
- [ ] Migrate author avatars (avatarUrl → s3AvatarUrl)
- [ ] Migrate book covers (coverImageUrl → s3CoverUrl)
- [ ] Migrate book PDFs / files (pdfUrl → s3PdfUrl)
- [ ] Add Admin S3 Migration UI with progress tracker and per-type controls
- [ ] Ensure all future uploads (avatar, cover, PDF ingest) write directly to S3
- [ ] Verify all CDN URLs are live and update DB columns

---

## Dropbox Content Ingestion Pipeline

- [ ] Write vitest tests for ingestion pipeline (remaining gap)

---

## Author Detail Page — Substack Tab

- [ ] Use existing `substack.getPostsByAuthor` procedure (already wired)
- [ ] Show post title, date, excerpt, and "Read on Substack" link per post
- [ ] Show "No Substack feed" empty state if substackUrl is null

---

## Audit Fixes — Remaining Low-Priority Items (from Apr 18 2026 Audit)

- [ ] A1: Add Zod schemas for all JSON blob columns in authorProfiles
- [ ] P1: Fix N+1 query in contentItems.list — use JOIN instead of separate authorContentLinks query
- [ ] P2: Add DB indexes on includedInLibrary, contentType, enrichedAt columns
- [ ] S8: Sanitize error messages in storage.ts — strip response body from client-facing errors
- [ ] A4: Validate embedding values are finite numbers before Neon vector concatenation
- [ ] Q1: Standardize error handling — critical ops throw, reads return typed Result
- [ ] H1: Memoize AuthorCard grid + debounce search input 300ms
- [ ] H3: Fix CommandPalette Cmd+K to check event.defaultPrevented
- [ ] M1: Add keyboard navigation (tabIndex, onKeyDown) to author/book card grids
- [ ] M2: Set staleTime: 5min on AuthorModal + BookModal queries
- [ ] M3: Add 400ms debounce to SemanticSearchDropdown input
- [ ] M4: Add Skeleton placeholders to AuthorDetail + BookDetail loading states
- [ ] M5: Add axis labels + legend + tooltip to InterestHeatmap
- [ ] M7: Lazy-initialize CommandPalette only on first Cmd+K press
- [ ] A5: Split drizzle/schema.ts into domain files (authors, books, content, enrichment)
- [ ] L1: Remove unused imports in AuthorDetail.tsx
- [ ] L2: Replace magic strings for tab types with typed constants
- [ ] L3: Add ARIA attributes to PageLoader spinner
- [ ] L4: Replace inline accentColor styles with CSS custom properties in ReadingPathPanel
- [ ] L5: Add onError toast callbacks to all mutations in AuthorCardActions

---

## Completed (Apr 19, 2026 Session)

- [x] Full Pinecone → Neon pgvector migration (Apr 18-19, 2026)
- [x] `shouldIndexPinecone` DB column renamed to `shouldIndexNeon` (migration 0046)
- [x] `@pinecone-database/pinecone` package removed from package.json
- [x] `pinecone-rag` skill renamed to `neon-rag`
- [x] All test files updated (Pinecone → Neon function/describe names)
- [x] 32 Claude Opus audit findings fixed (S1–S7, A2, C1+M6, H2, Q2)
  - [x] S1: All data endpoints changed from publicProcedure to protectedProcedure
  - [x] S2: Rate limiting middleware added for LLM enrichment calls
  - [x] S3: SSRF guard (safeFetch) added for external URL fetching
  - [x] S4+S7: JWT_SECRET startup validation (warns instead of throws — platform-managed)
  - [x] S5: Raw SQL template literals replaced with Drizzle type-safe operators
  - [x] S6: sanitizeAuthorName added and wired into enrich/createAuthor procedures
  - [x] A2: 30-minute timeout wrapper around pipeline handler calls
  - [x] C1+M6: ReadingPathPanel upgraded with multi-step loading indicator + 15s timeout fallback
  - [x] H2: ErrorBoundary wrapping async sections in BookDetail
  - [x] Q2: Structured logger replacing console.log in server routers
- [x] Curated Reading Paths feature (readingPath.router.ts + ReadingPathPanel.tsx)
- [x] Two new Neon indexing pipelines: neon-index-content-items + neon-index-rag-files
- [x] verify-neon-coverage.mjs script added (pnpm coverage)
- [x] OOM build failure fixed (manualChunks + lazy imports in Vite config)
- [x] manus.md rewritten with full Neon architecture (Apr 19, 2026)
- [x] CLAUDE.md updated (Legacy Pinecone Notes removed, AdminPineconeTab → AdminNeonTab)
- [x] All .agents/skills/ SKILL.md files updated for Neon migration
- [x] agent-mishaps SKILL.md updated with new mishaps from this session

---

## Completed (Apr 8–18, 2026 Sessions)

- [x] Created 5 app-specific Agent Skills in .agents/skills/
- [x] Rewrote CLAUDE.md and manus.md to reflect current architecture
- [x] Pinecone bulk indexing: 1,160 total vectors (183 authors + 163 books)
- [x] Substack post counts: 9 authors populated
- [x] Dropbox Configuration admin page (7 folder connections)
- [x] Smart Upload admin page (AI classification + review queue)
- [x] Chatbot chunk retrieval (top-6 from rag_files namespace)
- [x] bge-reranker-v2-m3 added to similarBooks, similarAuthors, thematicSearch
- [x] Post-enrichment re-indexing hooks in all 4 enrichment pipelines
- [x] Smart Upload auto-indexing on commit
- [x] Google Drive fully removed from architecture
- [x] RAG generation: 175 new RAG files generated (187/187 = 100% ready)
- [x] autoTagAll: 187/187 (100%) authors tagged
- [x] scoreAllAuthors: 187/187 (100%) authors scored against 8 user interests
- [x] author_aliases table + seed script (159 aliases) + useAuthorAliases hook
- [x] ESLint rules-of-hooks: 0 errors across all 100+ client source files
- [x] ESLint exhaustive-deps: 0 warnings remaining
- [x] Real-time author search bar (inline, debounced, match count badge)
- [x] Collapsible activity strips (Recently Enriched, Recently Tagged)
- [x] Neon pgvector migration: neonVector.service.ts, HNSW index, Gemini embeddings
- [x] Refresh All Data button in AuthorCardActions.tsx (bio → links → avatar sequential)
- [x] Backup toast with per-subfolder file counts
- [x] Admin infotips on sidebar nav items
- [x] Dropbox folder browser (AdminDropboxFolderBrowser)
- [x] Run All Pipelines Now button in AdminIntelligenceDashboard
- [x] Near-duplicate detection (semanticDuplicate.service.ts, cosine >= 0.92)
- [x] Semantic Interest Heatmap admin tab (AdminSemanticMapTab)
- [x] Human Review Queue (humanReviewQueue.router.ts + AdminReviewQueueTab.tsx)
- [x] Enrichment Orchestrator (enrichmentOrchestrator.service.ts, 13 pipelines)
- [x] Content Intelligence service (URL health + LLM quality scoring)
- [x] Duplicate detection system (content_hash, duplicate_of_id, AdminDuplicatesTab)
- [x] S3 CDN migration UI (AdminS3AuditTab)
- [x] Dropbox inbox ingestion pipeline (dropboxIngest.service.ts, PDF → S3 → DB)
- [x] Atlantic magazine pipeline (atlantic_articles table, atlantic.router.ts)
- [x] Premium news enrichment (newsOutlets.ts, 8 outlets)
- [x] Library catalog APIs (Open Library, HathiTrust, DPLA)
- [x] Author/book card tabbed layout (Info/Books tabs, Details/Notes tabs)
- [x] Command palette (Cmd/Ctrl+K)
- [x] Book ISBN barcode display on BookDetail
- [x] LinkedIn follower count display on author cards
- [x] CNBC "In the News" badge (built; always 0 due to paid API requirement)
- [x] 4 missing DB indexes (isbn, possessionStatus, format, bioCompleteness) — migration 0043
- [x] 5 deterministic verification scripts (verify-db-indexes, verify-neon-coverage, verify-dropbox-folders, audit-enrichment-gaps, verify-s3-coverage)
- [x] Dropbox Authors Folder path fixed (DROPBOX_AUTHORS_FOLDER env var)
- [x] Content gap fill: 18 missing avatars, 24 missing covers, 52 PDFs sourced and uploaded
- [x] ~1020 vitest tests passing, 0 TypeScript errors
