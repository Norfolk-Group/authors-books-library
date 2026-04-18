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

---
## Backup Verification Toast + Auto-Refresh (Apr 7, 2026)
- [x] After successful backup, auto-refresh AdminDropboxFolderBrowser (refreshTrigger prop + useEffect)
- [x] Show toast with per-subfolder file counts (Avatars uploaded/skipped, Book Covers, PDFs) — rich description on backupAll, concise on individual backups

---
## S3 Media Migration (Apr 7, 2026)
- [ ] Audit all asset URL columns: avatarUrl, s3AvatarUrl, coverImageUrl, s3CoverUrl, pdfUrl, s3PdfUrl, fileUrl
- [ ] Build S3 migration service: fetch from current URL → re-upload to S3 → update DB column
- [ ] Migrate author avatars (avatarUrl → s3AvatarUrl)
- [ ] Migrate book covers (coverImageUrl → s3CoverUrl)
- [ ] Migrate book PDFs / files (pdfUrl → s3PdfUrl)
- [ ] Add Admin S3 Migration UI with progress tracker and per-type controls
- [ ] Ensure all future uploads (avatar, cover, PDF ingest) write directly to S3
- [ ] Verify all CDN URLs are live and update DB columns

---
## Dropbox Backup Import (Apr 7, 2026)
- [x] Scan /Cidale Interests/01_Companies/Norfolk AI/Apps/RC Library App/Authors and Books Backup/ folder structure
- [x] Compare Dropbox inventory against database (authors, books, covers, avatars, files)
- [x] Import missing authors into database (1 new book added: "To Know a Person" by David Brooks)
- [x] Import missing books into database (163 total books in DB)
- [ ] Mirror missing covers and avatars to S3 CDN (deferred — covered by enrichment pipeline)
- [x] Import missing book files (PDFs, audio) to S3 CDN — 111 books now have S3 PDFs

---
## Dropbox Supplementary Source Import (Apr 7, 2026 — Session 2)
- [x] Deep-scan /Cidale Interests/01_Companies/Norfolk AI/Apps/RC Library App/Authors and Books Backup/ via Dropbox API — built full inventory (115 author folders, 214 book folders)
- [x] Compare inventory against DB — identified 71 books in Dropbox not in DB (most were already in DB under different titles)
- [x] Upload missing PDFs to S3 CDN — 111 books now have S3-hosted PDFs (110 uploaded in main run + 1 Scaling Lean fix)
- [ ] Upload missing book covers to S3 CDN (deferred — use enrichment pipeline)
- [x] Add missing authors and books to DB without overwriting existing good data (1 new book added)
- [ ] Generate missing avatars and covers for new entries via enrichment pipeline (deferred)
- [ ] Run orchestrator "Run All Pipelines" to enrich new entries (deferred — manual step)

---
## Author Card Book Cover Display (Apr 7, 2026 — Session 3)
- [x] Audit FlowbiteAuthorCard Books tab — covers were only visible on Books tab, not Info tab
- [x] Fix cover image fallback chain: s3CoverUrl → coverImageUrl → placeholder (already correct)
- [x] Add book cover mini-strip to Info tab (always visible, no tab switch needed, up to 6 covers + overflow button)
- [x] Make book covers larger on the Books tab (96px tall × 66px wide, was 80×56)
- [x] Verify covers load correctly: Aaron Ross (2 covers), Adam Grant (1), Al Ries (1) confirmed working

---
## Content Gap Fill (Apr 7, 2026 — Session 4)
- [x] Source and upload avatars for 18 authors missing them — 18/18 success (6 Wikipedia, 10 Tavily, 2 AI-generated)
- [x] Source and upload covers for 24 books missing them — 24/24 success via Amazon scraping
- [x] Match and upload PDFs for 52 books — 127 books now have S3 PDFs (16 additional uploaded this session)
  - 2 failed: apostrophe in Dropbox path (A Therapist's Guide, Founder's Pocket Guide) — known API limitation
  - Remaining 35 without PDFs are duplicates, summaries, or not in Dropbox backup
- [x] Verified: avatarsMissing=0, coversMissing=0, pdfsMissing=35 (all duplicates or not in backup)

---
## Enrichment Orchestrator Run (Apr 7, 2026 — Session 5)
- [ ] Trigger all 13 enrichment pipelines via orchestrator runAllPipelines
- [ ] Verify Pinecone index populated (authors, books, articles namespaces)
- [ ] Verify Substack post counts updated on author badges

## Dropbox Configuration Admin Section

- [x] Create `dropbox_folder_configs` table in schema with all 7 Dropbox folder connections
- [x] Seed table with correct online Dropbox paths (RC Library App Data root, Authors and Books Backup, Books Content Entry Folder, Authors Content Entry Folder, Graphics and Design, etc.)
- [x] Build `dropboxConfig.router.ts` with list, update, toggleEnabled, validatePath, add, delete procedures
- [x] Build `AdminDropboxConfigTab.tsx` — professional folder management UI with toggle switches, validate, open-in-Dropbox, edit, delete per row; stats row (Total/Enabled/Validated/Issues); Add Folder dialog
- [x] Register `dropbox-config` section in Admin sidebar under Media group
- [x] Remove Google Drive references from architecture

## Smart Upload Admin Section

- [x] Create `smart_uploads` table in schema (id, filename, s3Key, s3Url, mimeType, fileSize, status, aiClassification, authorId, bookId, targetTable, notes, committedAt, createdAt)
- [x] Build `aiFileClassifier.service.ts` — Claude AI classifies uploaded files (PDF/image/audio/video/doc), matches to author/book, determines target DB table and Pinecone namespace
- [x] Build `smartUpload.router.ts` with list, stats, classify, updateOverride, commit, reject, delete, listAuthors, listBooks procedures
- [x] Build `smartUploadRoutes.ts` — multer REST endpoint for file uploads (100 MB limit, 10 files at once)
- [x] Build `AdminSmartUploadTab.tsx` — drag-and-drop file picker, stats row, Upload Files / Review Queue / History tabs
- [x] Register `smart-upload` section in Admin sidebar under Media group
- [x] Wire both new sections into Admin.tsx render block

## Pinecone Bulk Indexing (Completed Apr 8, 2026)

- [x] Write bulk-index-pinecone.mjs script to index all authors and books without manual UI clicks
- [x] Index 183 authors into Pinecone authors namespace (4 skipped — insufficient bio text)
- [x] Run book summaries enrichment pipeline to fill 25 books missing summaries
- [x] Index all 163 books into Pinecone books namespace
- [x] Total vectors: 1,160 (up from 810)

## Substack Post Counts (Completed Apr 8, 2026)

- [x] Write update-substack-counts.mjs to fetch live post counts from Substack API
- [x] Populate substackPostCount for 9 authors with actual Substack publications
- [x] Sync substackPostCount into socialStatsJson for badge display consistency

---

## Substack URL Fixes (Apr 8, 2026)

- [x] Fix Ben Horowitz: a16z newsletter post → benhorowitz.substack.com
- [x] Fix Dan Harris: personal website → danharris.substack.com
- [x] Fix Scott Galloway: personal website → profgmedia.com (actual Substack)
- [x] Fix Todd Herman: profile page → thetoddhermanshow.substack.com
- [x] Clear James Clear: uses own platform (jamesclear.com), not Substack
- [x] Clear Ryan Holiday: uses ryanholiday.net, not Substack
- [x] Clear Seth Godin: uses seths.blog, not Substack
- [x] Clear Tali Sharot: had Annie Duke's post URL (wrong author)
- [x] Clear Tim Ferriss: uses tim.blog, not Substack
- [x] Verify Ezra Klein: substack.com/@ezraklein1 is correct (61K+ subscribers)
- [x] Verify Sean Ellis: substack.com/@seanellis is a valid profile URL
- [x] Verify Shankar Vedantam: news.hiddenbrain.org IS on Substack (62K+ subscribers)

---

## Agent Skills Compliance (Apr 8, 2026)

- [x] Create `.agents/skills/pinecone-rag/SKILL.md` — Pinecone indexing, search, reranking, chatbot RAG
- [x] Create `.agents/skills/dropbox-sync/SKILL.md` — Dropbox folder paths, env vars, sync pipeline
- [x] Create `.agents/skills/smart-upload/SKILL.md` — AI file classification, review queue, commit flow
- [x] Create `.agents/skills/enrichment-pipeline/SKILL.md` — Enrichment orchestrator, pipeline registry
- [x] Create `.agents/skills/library-architecture/SKILL.md` — Overall app architecture reference
- [x] Rewrite CLAUDE.md — updated to reflect current architecture (Pinecone, Dropbox, Smart Upload, 956 tests)
- [x] Rewrite manus.md — updated with current architecture, skill references, session history

---

## Dropbox Authors Folder Path Fix (Apr 8, 2026)

- [x] Update DROPBOX_AUTHORS_FOLDER path to: /Apps NAI/RC Library App Data/Authors Content Entry Folder (verified via live Dropbox API)
- [x] Update DROPBOX_FOLDERS constant in dropbox.service.ts to use correct authors path (authorsInbox + authorsProcessed keys)
- [x] Test live Dropbox API access to the corrected path (6/6 dropboxPaths tests pass)
- [x] Update CLAUDE.md and manus.md with correct folder paths and new DROPBOX_AUTHORS_FOLDER env var

---

## P3 Near-Duplicate Detection Wiring (Apr 8, 2026)

- [x] Wire checkAuthorDuplicate into createAuthor mutation (authorProfiles.router.ts) — fire-and-forget after DB write
- [x] Wire checkAuthorDuplicate into updateAuthor mutation (authorProfiles.router.ts) — fire-and-forget after DB write
- [x] Wire checkBookDuplicate into handleCreateBook (crudHandlers.ts) — fire-and-forget after DB write
- [x] Wire checkBookDuplicate into handleUpdateBook (crudHandlers.ts) — fire-and-forget after DB write
- [x] Add 12 vitest tests for near-duplicate wiring (nearDuplicateWiring.test.ts) — all passing

---

## P3 Semantic Interest Heatmap (Apr 8, 2026)

- [x] Create semanticMap.router.ts with getFastMap (tag-based, instant) and getSemanticMap (Gemini PCA, on-demand) procedures
- [x] Register semanticMapRouter in routers/index.ts
- [x] Create AdminSemanticMapTab.tsx with SVG scatter plot, zoom/pan, category legend, hover tooltip
- [x] Add Semantic Map tab to Admin Console → Intelligence group (nav item + render block)
- [x] Add 16 vitest tests for semantic map helper functions (semanticMap.test.ts) — all passing
- [x] Update P3 items in todo.md (Near-Duplicate Detection + Semantic Interest Heatmap marked done)

---

## Admin Infotips on Tab Content (Apr 8, 2026)

- [x] Add InfoTip to AdminIntelligenceDashboard: Authors coverage card, Books coverage card, Content & Queue card, Pipeline Controls header
- [x] Add InfoTip to AdminPineconeTab: page header, Index Statistics card title, Index Everything button
- [x] Add InfoTip to AdminDropboxConfigTab: page header, all 4 stats cards (Total/Enabled/Validated/Issues)
- [x] All infotips use consistent side="top" default, side="right" for headers
- [x] TypeScript: 0 errors after all infotip additions

---

## Optimization Audit (Apr 8, 2026)

- [x] Deep codebase audit: server/client split, Pinecone usage, DB schema, skills, tools
- [x] Produce OPTIMIZATION_PLAN.md with Tier 1/2/3 priorities and effort estimates
- [x] T1: SQL aggregation in cascade.router.ts (replace JS filter with COUNT CASE WHEN)
- [x] T1: Add 4 missing DB indexes (isbn, possessionStatus, format, bioCompleteness) — migration 0043
- [x] Create 5 deterministic verification scripts in scripts/
  - [x] verify-db-indexes.mjs (42 indexes, all passing)
  - [x] verify-pinecone-coverage.mjs
  - [x] verify-dropbox-folders.mjs
  - [x] audit-enrichment-gaps.mjs (--json mode supported)
  - [x] verify-s3-coverage.mjs (--list mode supported)
- [x] Create deterministic-tools SKILL.md documenting all 5 scripts
- [x] Update library-architecture SKILL.md with new tools, correct counts, Dropbox folder
- [x] Update CLAUDE.md: 187 authors, 963 tests, DROPBOX_AUTHORS_FOLDER, deterministic-tools skill
- [x] Live audit results: 187 authors (100% avatars, 100% S3), 163 books (99.4% S3 covers)
- [x] Key gaps identified: 90.4% no tags, 5.3% RAG coverage (10/187 authors)

---

## Implement All 3 Optimization Suggestions (Apr 8, 2026)

### S1 — RAG Pipeline Expansion (Build RAG Files for All Authors)
- [x] Add `seedAllPending` procedure to ragPipeline.router.ts (creates pending rows for all 177 missing authors)
- [x] Add "Seed All Authors for RAG" button to DigitalMeTab.tsx (Admin → Intelligence → Digital Me)
- [x] Show count of newly seeded authors in success toast
- [x] Idempotent: skips authors already in the RAG pipeline
- [x] Write vitest tests for the new procedure

### S2 — Tag Enrichment for All Untagged Authors
- [x] Add `autoTagAll` procedure to tags.router.ts with 15-tag taxonomy, LLM-powered batch tagging
- [x] skipExisting flag: skips authors that already have tags (default: true)
- [x] Creates new tags in `tags` table if they don't exist
- [x] Add "Auto-Tag All Authors" button to AdminIntelligenceDashboard.tsx header
- [x] Write vitest tests for the new procedure

### S3 — T2-A Pinecone Metadata Filters
- [x] Add `category`, `bookCount`, `enrichedAt` fields to VectorMetadata type in pinecone.service.ts
- [x] Add `category`, `bookCount`, `enrichedAt` to IndexAuthorInput and IndexBookInput types
- [x] Update indexAuthor and indexBook in ragPipeline.service.ts to pass metadata to Pinecone
- [x] Update indexAuthorIncremental and indexBookIncremental to accept and forward metadata
- [x] Update createAuthor and updateAuthor to extract category from tagsJson and pass to indexAuthorIncremental
- [x] Write 18 vitest tests for S1/S2/S3 metadata logic (all passing)

---

## Session A — Admin Quick Wins (Apr 9, 2026)

- [x] seedAllPending: All 187 authors already had RAG rows — no new rows needed
- [x] RAG generation: Ran batch script (scripts/session-a-generate-rag.mts) — 175 new RAG files generated
  - 187/187 (100%) authors now have ready RAG files (was 5.3% / 10 ready)
- [x] autoTagAll: Tagged 4 remaining untagged authors via LLM (scripts/session-a-autotag.mts)
  - Kerry Leonard manually assigned [business, leadership] (no books/bio available)
  - 187/187 (100%) authors now tagged (was 9.6% / 18 tagged)
- [x] scoreAllAuthors: Ran 3 scoring passes (scripts/session-a-score-authors.mts)
  - 187/187 (100%) authors scored against 8 user interests
  - 182 succeeded, 5 had JSON parse errors (retried in final pass)
- [x] Verified: RAG 100%, Tagged 100%, Scored 100% — all targets exceeded

---

## Session B — Data Migration (Apr 9, 2026)

### B1 — authorAliases.ts to Database
- [x] Add dedicated `author_aliases` table to schema (separate table, not aliasesJson column)
- [x] Run pnpm db:push to apply migration
- [x] Write seed script (scripts/seed-author-aliases.mjs) — seeded 159 aliases
- [x] Add authorAliases tRPC router (server/routers/authorAliases.router.ts) with getMap, getAll, upsert, delete, resolveNames
- [x] Add useAuthorAliases() hook (client/src/hooks/useAuthorAliases.ts) — DB-backed with hardcoded fallback
- [x] Update all 12 client callers of canonicalName() to use useAuthorAliases() hook
- [x] Add Admin UI tab (AdminAliasesTab) under Content > Author Aliases
- [x] Write vitest tests (server/authorAliases.router.test.ts) — 9 tests all passing
- [ ] Delete authorAliases.ts after migration verified in production (optional cleanup)

### B2 — authorAvatars.ts to Database
- [x] ASSESSED: authorAvatars.ts already superseded by DB-backed avatar system
  - author_profiles table has avatarUrl, s3AvatarUrl columns
  - getAvatarMap tRPC procedure already serves DB avatars to all components
  - getAuthorAvatar() from authorAvatars.ts is only a tertiary fallback
  - No new migration needed — architecture is already correct
- [ ] Delete authorAvatars.ts after confirming all authors have DB avatars (optional cleanup)

## Bug Fix — Hook Violation (Apr 9, 2026)

- [x] Fix "Invalid hook call / Cannot read properties of null (reading 'useContext')" on home page
  - Root cause: useAuthorAliases() was placed at module level in AuthorBioPanel.tsx (line 428)
    between two function definitions, outside any React component body
  - Fix: moved the hook call inside the AuthorBioPanel function body
  - TypeScript: 0 errors, HMR applied at 10:15:13 AM

## ESLint — rules-of-hooks (Apr 10, 2026)

- [x] Install eslint-plugin-react-hooks (+ @eslint/js, @typescript-eslint/*, globals)
- [x] Create eslint.config.js (flat config) with rules-of-hooks: error, exhaustive-deps: warn
- [x] Add pnpm lint and pnpm lint:fix scripts to package.json
- [x] Run ESLint: 0 errors, 124 warnings (all pre-existing exhaustive-deps / no-explicit-any)
  - rules-of-hooks: CLEAN across all 100+ client source files

## ESLint — Fix exhaustive-deps & no-unused-vars (Apr 10, 2026)

- [x] Fixed all 23 exhaustive-deps warnings (0 remaining)
  - Added canonicalName to useMemo/useCallback deps in 12 files
  - Added eslint-disable-next-line for intentional mount-only useEffects (AuthorModal, AuthorBioPanel, BookDetailPanel)
  - Stabilized unstable query.data expressions in GroupContrast, InterestHeatmap
  - Extracted platformLinksData type to avoid typeof reference in AuthorCompare, Leaderboard
- [x] Fixed all 101 no-unused-vars warnings (0 remaining)
  - Removed unused imports across 25+ files
  - Prefixed intentionally unused args/vars with _ convention
- [x] TypeScript: 0 errors, ESLint: 0 errors, 37 warnings (all no-explicit-any — acceptable)

## Feature — Real-time Author Search Bar (Apr 12, 2026)

- [x] Inspect current search/filter implementation on the Authors page
  - Existing header search bar was small (64px mobile, 256px desktop) and easy to miss
  - filteredAuthors already computed in useLibraryData via query state
  - FlowbiteAuthorCard already had Highlight component for matched text
- [x] Add prominent inline search bar above the author card grid in AuthorsTabContent
  - Full-width, h-11, rounded-xl with search icon on left and count+clear on right
  - Transitions: bg-muted/30 → bg-background on focus, icon color primary on focus
- [x] Debounce input with 200ms delay (localInput state + debounceRef pattern)
  - localInput updates instantly for UI feedback; parent query updates after 200ms
  - External query clears (e.g. clearFilters button) sync back to localInput via useEffect
- [x] Show live match count badge (Users icon + count, primary color when active)
- [x] Show clear button (X, only visible when there is input, active:scale-95)
- [x] Show active search feedback text below bar ("Showing N authors matching 'X'")
- [x] Highlight matched text already working via existing Highlight component in FlowbiteAuthorCard
- [x] TypeScript: 0 errors, ESLint: 0 new warnings

## Feature — Collapsible Activity Strips (Apr 12, 2026)

- [x] Convert "Recently Enriched" strip in AuthorsTabContent to collapsible pill toggle
  - Amber-tinted pill with Sparkles icon, count badge, ChevronDown rotation animation
  - Default collapsed so the author grid is immediately visible on tab load
- [x] Convert "Recently Tagged" strip in AuthorsTabContent to collapsible pill toggle
  - Violet-tinted pill with Tag icon, count badge, ChevronDown rotation animation
  - Default collapsed; same open/close pattern as Enriched pill
- [x] Convert "Recently Tagged" strip in BooksTabContent to collapsible pill toggle
  - Violet-tinted pill matching Authors tab style for visual consistency
  - Default collapsed; useState(false) inside BooksTabContent function body
- [x] TypeScript: 0 errors, ESLint: 0 new warnings (still 37 pre-existing no-explicit-any)

## Migration — Pinecone → Neon pgvector (Apr 17, 2026)

- [x] Install @neondatabase/serverless and pg packages
- [x] Test Neon connection and enable pgvector extension (ensureIndex + getIndexStats confirmed working)
- [x] Create vector_embeddings table in Neon with pgvector HNSW index (1536 dims)
- [x] Write neonVector.service.ts replacing pinecone.service.ts (same public API)
- [x] Switch embedding model: Gemini gemini-embedding-001 (3072d) → text-embedding-004 (1536d)
- [x] Update all server routers that import from pinecone.service.ts
- [x] Update ragPipeline.service.ts to use new service
- [x] Update aiFileClassifier.service.ts to use new service
- [x] Update enrichmentOrchestrator.service.ts pipeline keys (neon-index-*)
- [x] Update smartUpload.router.ts, recommendations.router.ts, userInterests.router.ts
- [x] Update scripts/run_all_pipelines.ts and index_pinecone_batched.ts
- [x] Rename pineconeNamespace → neonNamespace in schema + DB migration (0045_pale_betty_ross.sql)
- [x] Update Admin UI labels: Pinecone Index → Neon pgvector Index
- [x] Write vitest unit tests for neonVector.service (chunkText, makeVectorId, EMBEDDING_DIMENSION)
- [x] TypeScript: 0 errors
- [x] Database migration applied successfully

## Fix Session — Apr 18, 2026

- [ ] Delete stale Pinecone files (pinecone.service.ts, pinecone.test.ts, indexAllToPinecone.mjs, indexAllToPinecone.py, index_pinecone_batched.ts, verify-pinecone-coverage.mjs)
- [ ] Rewrite verify-pinecone-coverage.mjs → verify-neon-coverage.mjs using pg
- [ ] Complete Re-index All button with tRPC mutation and live progress bar in Admin Console
- [ ] Implement "Refresh All Data" in AuthorCardActions.tsx (remove "coming soon" toast)
- [ ] Delete client/src/lib/authorAliases.ts (superseded by DB)
- [ ] Delete client/src/lib/authorAvatars.ts (superseded by DB)
- [ ] Add backup toast with per-subfolder file counts
- [ ] Add Admin infotips to tab content (buttons, stat cards)
- [ ] Add "Run All Pipelines Now" button to AdminIntelligenceDashboard
- [ ] Add Dropbox folder browser (listFolderContents tRPC + AdminDropboxFolderBrowser UI)

## Fix Session Apr 18 2026 — Pinecone → Neon Full Rename Sweep

- [ ] Rename shouldIndexPinecone → shouldIndexNeon in aiFileClassifier.service.ts, AdminSmartUploadTab.tsx, smartUploadRoutes.ts
- [ ] Rename getPineconeAuthorCandidates → getNeonAuthorCandidates in userInterests.router.ts and userInterests.test.ts
- [ ] Update all comments in ragPipeline.service.ts: "upsert to Pinecone" → "upsert to Neon"
- [ ] Update all comments in enrichmentOrchestrator.service.ts: "Pinecone" → "Neon"
- [ ] Update all comments in semanticDuplicate.service.ts: "Pinecone" → "Neon"
- [ ] Update all comments in incrementalIndex.service.ts: "Pinecone" → "Neon"
- [ ] Update pipeline labels in enrichmentOrchestrator.service.ts: "Pinecone: Index Authors/Books" → "Neon: Index Authors/Books"
- [ ] Remove PINECONE_INDEX_NAME legacy alias from neonVector.service.ts
- [ ] Update UI labels in AdminMagazineTab.tsx: "Index All into Pinecone" → "Index All into Neon"
- [ ] Update UI labels in AdminReviewQueueTab.tsx: "Pinecone semantic similarity" → "Neon vector similarity"
- [ ] Update UI labels in LibraryHeader.tsx, LibrarySidebar.tsx, SemanticSearchDropdown.tsx
- [ ] Update UI labels in PersonalizedNextSection.tsx, RelatedContentSection.tsx, SimilarAuthorsSection.tsx, SimilarBooksSection.tsx, ThematicSearch.tsx
- [ ] Update vectorSearch.router.ts comments: "Pinecone index" → "Neon index"
- [ ] Update Admin.tsx smart-upload description: "Pinecone namespace" → "Neon namespace"

## Fix Session Apr 18 2026 — Completed

- [x] Full Pinecone → Neon rename sweep: all server services, routers, UI labels, comments
  - ragPipeline.service.ts, enrichmentOrchestrator.service.ts, semanticDuplicate.service.ts, incrementalIndex.service.ts
  - neonVector.service.ts: removed PINECONE_INDEX_NAME alias
  - AdminMagazineTab.tsx, AdminReviewQueueTab.tsx, LibraryHeader.tsx, SemanticSearchDropdown.tsx
  - PersonalizedNextSection.tsx, RelatedContentSection.tsx, SimilarAuthorsSection.tsx, SimilarBooksSection.tsx, ThematicSearch.tsx
  - vectorSearch.router.ts, authorChatbot.router.ts, authorProfiles.router.ts, crudHandlers.ts
  - AdminIntelligenceDashboard.tsx, drizzle/schema.ts comments
  - Renamed AdminPineconeTab.tsx → AdminNeonTab.tsx, export AdminPineconeTab → AdminNeonTab
  - Renamed getPineconeAuthorCandidates → getNeonAuthorCandidates in userInterests.router.ts
  - NOTE: shouldIndexPinecone DB column kept as-is (renaming requires a migration)
- [x] Implement "Refresh All Data" in AuthorCardActions.tsx (bio → links → avatar sequential pipeline with progress toasts)
- [x] Confirmed: backup toasts already show per-subfolder file counts (uploaded/skipped/failed)
- [x] Confirmed: AdminIntelligenceDashboard already has InfoTips + Run All Pipelines Now button
- [x] Confirmed: AdminDropboxFolderBrowser already exists with browseFolderContents + getBackupFolderStats
- [x] TypeScript: 0 errors
