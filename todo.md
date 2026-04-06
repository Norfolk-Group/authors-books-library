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

- [ ] Research and test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost APIs
- [ ] Build unified `server/enrichment/newsOutlets.ts` helper with typed per-outlet fetchers
- [ ] Add `fetchAuthorNews` tRPC procedure returning articles across all 8 outlets
- [x] Add "In the News" section to AuthorDetail page (article cards with outlet badge, headline, date, link)
- [ ] Add news article count badge to FlowbiteAuthorCard
- [ ] Cache news results in `author_profiles.socialStatsJson` to avoid redundant API calls
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
- [ ] Open Library panel: show ISBN-13, publisher, publish date, page count, subjects from OL enrichment
- [ ] HathiTrust availability badge: "Free Digital Copy" button when full-view copy exists (links to HathiTrust reader)
- [ ] Open Library cover fallback: if no S3 cover, fetch cover from Open Library by ISBN
- [ ] "Also available at" library count: show how many HathiTrust copies exist (search-only + full-view)

### AuthorDetail Page
- [ ] Wire enrichment.applePodcasts.getAuthorPodcasts into AuthorDetail page
- [x] Wire enrichment.news.searchAuthorNews into AuthorDetail "In the News" section
- [x] "In the News" section: top 10 recent articles mentioning the author (CNBC + Google News RSS)
- [ ] Apple Podcasts section: author's podcasts from iTunes — supplement existing content items
- [ ] LinkedIn stats panel: follower count, headline, connection count (from socialStatsJson.linkedin if enriched)
- [ ] Wikipedia quick-facts panel: birth date, nationality, alma mater, awards (from socialStatsJson.wikipedia)
- [ ] Yahoo Finance panel: show company/stock data for author-linked companies (from socialStatsJson.yahooFinance)
- [ ] Wire semantic search into author chatbot and author detail page

### Caching & Performance
- [ ] Cache news search results in author_profiles.socialStatsJson (TTL: 24h) to avoid redundant API calls
- [ ] Cache Open Library enrichment in book_profiles (ISBN, publisher, OL cover URL) after first fetch
- [ ] Cache HathiTrust availability in book_profiles (htAvailability field) after first check

---

## Atlantic / Magazine Pipeline

- [ ] Save The Atlantic RSS scraper as server/services/atlantic.service.ts
- [ ] Add tRPC procedure: `author.getAtlanticArticles(authorName)` — fetches + matches articles to author
- [ ] Wire Atlantic articles panel into AuthorDetail page (latest articles, title, date, link)
- [ ] Cache Atlantic feed results in DB to avoid re-fetching on every page load
- [ ] Add `atlantic_articles` table to drizzle schema (articleId, title, url, authorName, publishedAt, summaryText, fullText, categories, feedUrl, scrapedAt)
- [ ] Run pnpm db:push to migrate atlantic_articles
- [ ] Build `server/routers/atlantic.router.ts` with procedures: fetchFeed, scrapeArticle (Apify), getByAuthor
- [ ] Wire Atlantic articles panel into AuthorDetail page (title, date, summary, expandable full text, link)
- [ ] Write vitest tests for atlantic router
- [ ] Run pnpm db:push to migrate magazine_articles table

---

## Pinecone / Semantic Search

- [ ] Populate Pinecone index: run Admin Console → Magazine Feeds → "Sync All Feeds" then "Index All in Pinecone"
- [ ] Wire semantic search into author chatbot and author detail page

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
- [ ] Optimize card real estate: reduce vertical padding, tighten bio to 2 lines max, use compact platform pills

---

## Author Detail Page — Substack Tab

- [ ] Add "Substack" tab to Author Detail page that lists the author's latest Substack posts
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

- [ ] Add "AI Search: active / inactive" indicator to sidebar footer
  - [ ] Shows green dot when Pinecone index has content, grey dot when empty
  - [ ] Links to Admin Console → Magazine Feeds page
  - [ ] Nudges users to index content when Pinecone index is empty

---

## Testing

- [ ] Fix pre-existing Worker exited unexpectedly error in magazine.test.ts (not caused by our changes — investigate root cause)
- [ ] Test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost (premium news outlets)
- [ ] Test Spotify API via RapidAPI for author audiobook/podcast data
- [ ] Test Instagram API via RapidAPI for author follower counts and recent posts

---

## S3 CDN Migration & Image Performance

- [ ] Audit all avatar URLs — identify non-S3 sources (Wikipedia, Tavily, Replicate, Google Drive)
- [ ] Re-upload all non-S3 avatars to S3 CDN and update author_profiles.avatar_url
- [ ] Audit all book cover URLs — identify non-S3 sources
- [ ] Re-upload all non-S3 book covers to S3 CDN and update book_profiles.s3_cover_url
- [ ] Add blur placeholder + lazy loading to author avatar images in FlowbiteAuthorCard
- [ ] Add blur placeholder + lazy loading to book cover images in BookCard
- [ ] Add image preload hints for above-the-fold cards
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
- [ ] Add content_hash column to content_files table (SHA-256 of file bytes) — push migration
- [ ] Add duplicate_of_id column to book_profiles (self-referential FK for flagged duplicates)
- [ ] Build duplicateDetection.service.ts: filename match, hash match, fuzzy title match (Levenshtein), ISBN match
- [ ] Integrate duplicate detection into Dropbox ingestion pipeline: skip/flag/replace modes
- [ ] Add Admin UI panel for reviewing flagged duplicates: side-by-side comparison, merge/keep/discard actions
- [ ] Write vitest tests for duplicate detection service (all 4 detection layers)
- [ ] Add duplicate detection summary to AdminDropboxTab scan results
