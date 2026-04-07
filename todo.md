# Authors & Books Library — Project TODO

Last cleaned: Apr 5, 2026

---

## Branding

- [ ] Set VITE_APP_LOGO in Management UI → Settings → General (manual step — paste CDN URL: https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png)

---

## Deferred Features

- [x] CNBC "In the News" badge on author cards (show article count from socialStatsJson.cnbc if > 0)
- [x] LinkedIn follower count display on author cards
- [x] Global keyboard shortcut (Cmd/Ctrl+K) command palette for fast author/book search and navigation
- [x] Author "In the News" section on AuthorDetail page (CNBC articles)
- [x] Book ISBN barcode display on BookDetail page

---

## Premium News Enrichment

- [x] Research and test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost APIs
- [x] Build unified `server/enrichment/newsOutlets.ts` helper with typed per-outlet fetchers
- [x] Add `fetchAuthorNews` tRPC procedure returning articles across all 8 outlets
- [x] Add "In the News" section to AuthorDetail page (article cards with outlet badge, headline, date, link)
- [x] Add news article count badge to FlowbiteAuthorCard
- [x] Cache news results in `author_profiles.socialStatsJson` to avoid redundant API calls
- [x] Write vitest tests for newsOutlets helper

---

## Library Catalog APIs

- [x] Test and integrate Open Library API (free, no key) — book metadata, ISBNs, cover images, availability
- [x] Test and integrate WorldCat Search API (OCLC) — public library holdings across 10,000+ libraries
- [x] Test and integrate HathiTrust Data API — university library full-text availability and digital copies
- [x] Test and integrate DPLA (Digital Public Library of America) API — free digital collections
- [x] Test and integrate JSTOR API (if available) — academic citations and university library access
- [x] Add "Library Availability" section to BookDetail page (which public/university libraries hold this book)
- [x] Add "Free Digital Copy" badge to BookDetail when HathiTrust/DPLA has a free version
- [x] Add Apple Podcasts, Instagram, Spotify server-side helpers
- [x] Add Apple News, NYT, BBC, CNN server-side helpers (test which are accessible with RAPIDAPI_KEY)

---

## External API Wiring — Author & Book Detail Pages

### BookDetail Page
- [x] Wire enrichment.hathiTrust.checkAvailability into BookDetail page (show "Free Digital Copy" badge when available)
- [x] Open Library panel: show ISBN-13, publisher, publish date, page count, subjects from OL enrichment
- [x] HathiTrust availability badge: "Free Digital Copy" button when full-view copy exists (links to HathiTrust reader)
- [x] Open Library cover fallback: if no S3 cover, fetch cover from Open Library by ISBN
- [x] "Also available at" library count: show how many HathiTrust copies exist (search-only + full-view)

### AuthorDetail Page
- [x] Wire enrichment.applePodcasts.getAuthorPodcasts into AuthorDetail page
- [x] Wire enrichment.news.searchAuthorNews into AuthorDetail "In the News" section
- [x] "In the News" section: top 10 recent articles mentioning the author (CNBC + Google News RSS)
- [x] Apple Podcasts section: author's podcasts from iTunes — supplement existing content items
- [x] LinkedIn stats panel: follower count, headline, connection count (from socialStatsJson.linkedin if enriched)
- [x] Wikipedia quick-facts panel: birth date, nationality, alma mater, awards (from socialStatsJson.wikipedia)
- [x] Yahoo Finance panel: show company/stock data for author-linked companies (from businessProfileJson.yahooFinance)
- [x] Wire semantic search into author chatbot and author detail page

### Caching & Performance
- [x] Cache news search results in author_profiles.socialStatsJson (TTL: 24h) to avoid redundant API calls
- [x] Cache Open Library enrichment in book_profiles (ISBN, publisher, OL cover URL) after first fetch
- [x] Cache HathiTrust availability in book_profiles (htAvailability field) after first check

---

## Atlantic / Magazine Pipeline

- [x] Save The Atlantic RSS scraper as server/services/atlantic.service.ts
- [x] Add tRPC procedure: `author.getAtlanticArticles(authorName)` — fetches + matches articles to author
- [x] Wire Atlantic articles panel into AuthorDetail page (latest articles, title, date, link)
- [x] Cache Atlantic feed results in DB to avoid re-fetching on every page load
- [x] Add `atlantic_articles` table to drizzle schema (articleId, title, url, authorName, publishedAt, summaryText, fullText, categories, feedUrl, scrapedAt)
- [x] Run pnpm db:push to migrate atlantic_articles
- [x] Build `server/routers/atlantic.router.ts` with procedures: fetchFeed, scrapeArticle (Apify), getByAuthor
- [x] Wire Atlantic articles panel into AuthorDetail page (title, date, summary, expandable full text, link)
- [x] Write vitest tests for atlantic router
- [x] Run pnpm db:push to migrate magazine_articles table

---

## Pinecone / Semantic Search

- [ ] Populate Pinecone index: run Admin Console → Magazine Feeds → "Sync All Feeds" then "Index All in Pinecone"
- [x] Wire semantic search into author chatbot and author detail page

---

## Author & Book Cards — Tabbed Filing-Folder Layout

- [x] Redesign FlowbiteAuthorCard with tabbed layout (two filing-folder tabs: "Info" and "Books / Substack")
  - [x] Tab 1 (Info): avatar, badges, bio, platform pills — current default view
  - [x] Tab 2 (Books): book cover shelf + Substack latest posts preview
  - [x] Tab labels styled as folder tabs (rounded-t, active tab raised, inactive tab slightly behind)
  - [x] Animate tab switch with a smooth cross-fade
- [x] Redesign FlowbiteBookCard with tabbed layout (two filing-folder tabs: "Details" and "Notes")
  - [x] Tab 1 (Details): cover, title, author, format, possession, tags
  - [x] Tab 2 (Notes): reading progress bar, reading notes excerpt, start/finish dates
  - [x] Tab labels styled as folder tabs matching author card style
- [x] Optimize card real estate: reduce vertical padding, tighten bio to 2 lines max, use compact platform pills

---

## Author Detail Page — Substack Tab

- [x] Add "Substack" tab to Author Detail page that lists the author's latest Substack posts
  - [ ] Use existing `substack.getPostsByAuthor` procedure (already wired)
  - [ ] Show post title, date, excerpt, and "Read on Substack" link per post
  - [ ] Show "No Substack feed" empty state if substackUrl is null

---

## Substack Post Counts

- [ ] Enrich Substack post counts: run Admin Console → Author Enrichment → "Enrich All Social Stats"
  - [ ] This will populate actual post counts for the 40 authors with substackUrl
  - [ ] Makes the orange Substack badge show "42 posts" instead of just "Substack"

---

## Sidebar Footer — AI Search Status Indicator

- [x] Add "AI Search: active / inactive" indicator to sidebar footer
  - [ ] Shows green dot when Pinecone index has content, grey dot when empty
  - [ ] Links to Admin Console → Magazine Feeds page
  - [ ] Nudges users to index content when Pinecone index is empty

---

## Testing

- [x] Fix pre-existing Worker exited unexpectedly error in magazine.test.ts (not caused by our changes — investigate root cause)
- [x] Test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost (premium news outlets)
- [x] Test Spotify API via RapidAPI for author audiobook/podcast data
- [x] Test Instagram API via RapidAPI for author follower counts and recent posts

---

## S3 CDN Migration & Image Performance

- [ ] Audit all avatar URLs — identify non-S3 sources (Wikipedia, Tavily, Replicate, Google Drive)
- [ ] Re-upload all non-S3 avatars to S3 CDN and update author_profiles.avatar_url
- [ ] Audit all book cover URLs — identify non-S3 sources
- [ ] Re-upload all non-S3 book covers to S3 CDN and update book_profiles.s3_cover_url
- [x] Add blur placeholder + lazy loading to author avatar images in FlowbiteAuthorCard
- [x] Add blur placeholder + lazy loading to book cover images in BookCard
- [x] Add image preload hints for above-the-fold cards
- [ ] Verify 100% of avatars and covers are on S3 CDN after migration

---

## Dropbox Content Ingestion Pipeline (Drop Zone)

- [ ] Register Dropbox inbox folder path as secret: DROPBOX_INBOX_FOLDER = /Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox
- [ ] Build dropbox.service.ts: listDropboxInbox() — scan Inbox folder, return files not yet in DB
- [ ] Build ingest.service.ts: PDF → S3 upload, LLM metadata extraction (title/authors), author profile creation, book profile creation, avatar generation
- [ ] Add tRPC procedures: dropbox.scanInbox, dropbox.ingestFile, dropbox.ingestAll
- [ ] Build AdminDropboxInboxTab UI: file list with status badges, ingest buttons, progress tracking
- [ ] Implement guardrails: no duplicate authors/books, no book titles misidentified as authors
- [ ] Support multi-author books: create separate author card per author
- [ ] Auto-generate avatar for new authors (Wikipedia → Tavily → AI portrait fallback)
- [ ] Auto-source book cover from Amazon/Google Books
- [ ] Mark ingested files in Dropbox (move to Processed/ subfolder after successful ingest)
- [ ] Write vitest tests for ingestion pipeline

## Dropbox Inbox Ingestion Pipeline (completed)
- [x] Permanent Dropbox refresh token (never expires) — authenticated as Ricardo Cidale
- [x] Dropbox folder structure: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/
- [x] Inbox folder: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox/
- [x] Processed folder: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox/Processed/
- [x] dropbox.service.ts — listDropboxInbox, downloadDropboxFile, moveDropboxFile
- [x] dropboxIngest.service.ts — PDF ingestion pipeline with LLM metadata extraction
- [x] Guardrails: book titles never used as author names, multi-author support
- [x] Author upsert: creates new author profile + triggers avatar waterfall
- [x] Book upsert: creates book_profiles entry, links authors via author_content_links
- [x] Amazon book cover scraping after ingest
- [x] Moves processed PDFs to Inbox/Processed folder
- [x] tRPC procedures: scanInbox, ingestFile, ingestAll (in dropbox.router.ts)
- [x] AdminDropboxTab: Content Inbox section with scan, per-file ingest, ingest-all
- [x] AdminDropboxTab: Backup section (avatars, covers, PDFs)
- [x] LazyImage blur placeholder fix — all imageOptimization tests pass

---
## Duplicate Detection System (Tasks 70-76)
- [x] Add content_hash column to content_files table (SHA-256 of file bytes) — push migration
- [x] Add duplicate_of_id column to book_profiles (self-referential FK for flagged duplicates)
- [x] Build duplicateDetection.service.ts: filename match, hash match, fuzzy title match (Levenshtein), ISBN match
- [x] Integrate duplicate detection into Dropbox ingestion pipeline: skip/flag/replace modes
- [x] Add Admin UI panel for reviewing flagged duplicates: side-by-side comparison, merge/keep/discard actions
- [x] Write vitest tests for duplicate detection service (all 4 detection layers)
- [x] Add duplicate detection summary to AdminDropboxTab scan results

---
## Pinecone Maximization (Gemini 2.5 Pro Strategy)

### P1 Features
- [x] Chatbot RAG Upgrade: semantic chunk retrieval from rag_files namespace instead of loading full file
- [x] Book Recommendations: "Readers Also Liked" via vector similarity in books namespace (BookDetail page)
- [x] Similar Authors: vector similarity in authors namespace (AuthorDetail page)

### P2 Features
- [x] Cross-Content Discovery: find podcasts/videos related to a book via content_items namespace
- [x] Thematic/Conceptual Search: search by concept not keyword (e.g. "books about resilience")
- [x] Personalized "What to Read Next": average user favorites vectors → query books namespace

### P3 Features
- [ ] Near-Duplicate Detection: check new content against Pinecone before saving
- [ ] Semantic Interest Heatmap: cluster authors/books by vector similarity with UMAP
- [ ] Curated Reading Paths: guided learning sequences from a starting book

---
## AI Autonomy & Human-in-the-Loop (Session: Apr 6 2026)

- [x] Add human_review_queue table to schema (reviewType, status, entityName, aiConfidence, aiReason, aiSuggestedAction, metadataJson, priority)
- [x] Run db:push migration for human_review_queue table
- [x] Create ragReadiness.service.ts — computes 0-100 score per author (books, content items, bio words, bio completeness, Wikipedia, LinkedIn, RAG ready bonus)
- [x] Create semanticDuplicate.service.ts — Pinecone-based near-duplicate detection (cosine similarity >= 0.92) for books and authors
- [x] Create incrementalIndex.service.ts — fire-and-forget Pinecone indexing after book/author save
- [x] Wire incremental indexing into bookProfiles.router.ts (createBook, updateBook mutations)
- [x] Wire incremental indexing into authorProfiles.router.ts (createAuthor, updateAuthor mutations)
- [x] Create humanReviewQueue.router.ts — full CRUD + AI scan triggers (getQueue, getStats, updateStatus, bulkUpdateStatus, runChatbotScan, runDuplicateScan, computeReadiness, getAllReadiness)
- [x] Register humanReviewQueue router in server/routers/index.ts
- [x] Create AdminReviewQueueTab.tsx — Chatbot Candidates tab + Near Duplicates tab with review cards, approve/reject/skip actions, RAG Readiness Leaderboard
- [x] Add AI Review Queue nav item to Admin.tsx Intelligence group
- [x] Register AdminReviewQueueTab in Admin.tsx section rendering
- [x] Write vitest tests for ragReadiness scoring algorithm (13 tests, all passing)
- [ ] Near-Duplicate Detection: check new content against Pinecone before saving (P3 — wired in incrementalIndex.service, UI in review queue)

---
## Autonomous N+1 Intelligence Gathering (Session: Apr 7 2026)

- [x] Deep audit: mapped all 22 enrichment modules, 34+ routers, and 6 critical gaps (no background runner, no URL health, no LLM content scoring, no auto Pinecone indexing, no gap detector, no cron runner)
- [x] Create enrichmentOrchestrator.service.ts — autonomous background job engine (5-min tick loop, 13 pipeline handlers, priority queue, concurrency control)
- [x] 13 pipeline handlers registered: enrich-social-stats, enrich-bios, discover-platforms, enrich-rich-bios, enrich-book-summaries, enrich-rich-summaries, url-health-check, content-quality-score, pinecone-index-authors, pinecone-index-books, pinecone-index-articles, rag-readiness-scan, chatbot-candidate-scan
- [x] Wire orchestrator startup into server/_core/index.ts (auto-starts 30s after server boot, seeds default schedules)
- [x] Seed 12 default enrichment schedules on first boot (configurable intervals: 6h to 7d)
- [x] Create orchestrator.router.ts — admin tRPC procedures (triggerPipeline, pausePipeline, resumePipeline, getStatus, getCoverageStats, getJobActivity, cancelJob, reseedSchedules, listPipelineKeys)
- [x] Register orchestrator router in server/routers/index.ts
- [x] Create contentIntelligence.service.ts — URL health check (HTTP HEAD) + LLM quality scoring (relevance 40%, authority 25%, freshness 15%, depth 20%) + content type detection (YouTube, Spotify, Apple Podcasts, TED, Substack, PDF, Amazon, Twitter, Medium, LinkedIn)
- [x] Add 11 quality scoring columns to content_items schema: qualityScore, relevanceScore, authorityScore, freshnessScore, depthScore, isAlive, qualityRecommendation, qualityReason, qualityScoredAt, extractedTitle, extractedSummary
- [x] Run db:push to migrate new content_items columns
- [x] Update runContentQualityScoring pipeline to use contentIntelligence.service (dedicated columns, not metadataJson)
- [x] Update orchestrator router content stats to use new dedicated columns (deadLinks, aliveLinks, avgQualityScore)
- [x] Create AdminIntelligenceDashboard.tsx — command center UI (live job monitor, pipeline controls, coverage heatmap, review queue stats, job activity log)
- [x] Add dead links and avg quality score metrics to content coverage section
- [x] Wire AdminIntelligenceDashboard into Admin.tsx (Intelligence nav group, "intelligence-dashboard" section)
- [x] Write 24 vitest tests for contentIntelligence service (URL type detection, score structure, weighted formula, batch result shape) — all passing
- [x] Full test suite: 941 tests passing, 17 skipped, 0 failures from our code

---
## Dropbox Backup Path Update

- [x] Update DROPBOX_BACKUP_FOLDER secret to /Cidale Interests/Company/Norfolk AI/Apps/RC Library/backup
- [x] Update all hardcoded backup path references in server code (dropbox.service.ts, env.ts, dropbox.test.ts)

---
## Suggested Features Implementation (Session: Apr 7 2026)

- [ ] Add Dropbox folder browser tRPC procedures: listFolderContents, getFolderStats (file count, total size, last modified per subfolder)
- [ ] Build AdminDropboxFolderBrowser UI component (file tree, subfolder drill-down, file counts, last-modified dates, backup verification)
- [ ] Wire Dropbox folder browser into Admin Console → Dropbox tab
- [ ] Add "Run All Pipelines Now" button to AdminIntelligenceDashboard (triggers all 13 pipelines in sequence)
- [ ] Add orchestrator first-run guidance card (shows when no jobs have run yet)
- [ ] Write vitest tests for new Dropbox folder browser procedures

---
## Dropbox Folder Browser + Run All Pipelines (Apr 7, 2026)
- [x] Add `browseFolderContents` tRPC procedure to dropbox router (file list with name, size, extension, serverModified)
- [x] Add `getBackupFolderStats` tRPC procedure to dropbox router (per-subfolder count, totalSize, lastModified, exists)
- [x] Build AdminDropboxFolderBrowser component with summary strip (4 counters), expandable subfolder rows, and drill-down file list
- [x] Replace static folder structure card in AdminDropboxTab with live AdminDropboxFolderBrowser
- [x] Add `runAllPipelines` tRPC procedure to orchestrator router (triggers all registered pipelines in sequence)
- [x] Add "Run All Pipelines" button to Intelligence Dashboard header (blue CTA with Zap icon)
- [x] Add "Run All Pipelines Now" button to empty-state job monitor (first-run guidance)
- [x] Fix dropboxIngest.test.ts assertions to match new /backup subfolder path (21 tests pass)

---
## Backup Verification Toast + Auto-Refresh (Apr 7, 2026)
- [ ] Update backup mutations (backupAvatars, backupBookCovers, backupPdfs, backupAll) to return per-subfolder file counts
- [ ] Wire auto-refresh of AdminDropboxFolderBrowser after backup completes
- [ ] Show toast with file counts per subfolder after "Backup All Assets" completes

---
## Admin Infotips (Apr 7, 2026)
- [x] Build shared InfoTip component (Info icon + Tooltip from shadcn/ui, plus LabelWithTip variant)
- [x] Add infotips to all Admin sidebar nav items (hover-reveal, side=right, descriptive text for all 24 items)
- [ ] Add infotips to all Admin tab content: buttons, stat cards, configuration fields (in progress — deferred to next session)
