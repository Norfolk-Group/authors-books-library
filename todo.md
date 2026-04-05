# Authors & Books Library — Project TODO

Last cleaned: Apr 2, 2026

---

## Tag System

- [x] Add `tagsJson` column to `book_profiles` (schema + migration)
- [x] Build tag management UI (create, rename, delete, reorder tags) — `TagManagement.tsx`
- [x] Add inline tag picker on author cards — `TagPicker` in `FlowbiteAuthorCard`
- [x] Add inline tag picker on book cards — `TagPicker` in `BookCard`
- [x] Add tag filter chips in Books tab sidebar — `BookFilterBar.tsx`
- [x] Persist selected tag slugs to `localStorage` (`useLocalStorage` hook)
- [x] Sync active tag filters to URL query params (`?tags=slug1,slug2`)
- [x] Build `TagTaxonomyMatrix` — bulk assign/remove tags across all entities
- [x] Build `BulkTagAssignment` — bulk tag multiple authors at once
- [x] Add Tag Statistics bar chart in Admin → Tags (`TagStatisticsCard.tsx` with recharts)
- [x] Tag rename cascade — when a tag slug changes, update all `tagsJson` arrays in `author_profiles` and `book_profiles`
- [x] Tag auto-suggest at creation time — add tag picker to Author and Book CRUD dialogs

---

## Library Home UI

- [x] Authors tab with card grid, search, sort, category filter
- [x] Books tab with card grid, search, sort, category filter
- [x] Possession/status filter chips in Books tab (Owned / Wishlist / Reading / etc.)
- [x] Format filter chips in Books tab (Physical / Digital / Audiobook)
- [x] Enrichment filter chips in Books tab (Enriched / Not Enriched)
- [x] "Show favorites only" heart toggle in Authors tab
- [x] "Show favorites only" heart toggle in Books tab
- [x] "Show favorites only" heart toggle in Media tab
- [x] Media tab with sub-filters (All / Written / Audio & Video / Courses / Film & TV / Other)
- [x] `MediaItemFormDialog` — Create / Edit / Delete media content items
- [x] `BookFilterBar` component extracted from `Home.tsx`
- [x] Show active tag filter chips in header bar as dismissible badge pills (Books tab)
- [x] Add content type cards with appropriate icons in Media tab grid

---

## Author & Book Cards

- [x] `FlowbiteAuthorCard` — 6-zone card layout with avatar, badges, bio, book shelf, platforms, tags
- [x] Suspicious name warning badge (`isLikelyAuthorName` check) in `FlowbiteAuthorCard`
- [x] `BookCard` — card with cover, title, author, format, possession, tags
- [x] Redesign `FlowbiteAuthorCard` with strict 4-zone grid:
  - [x] Avatar zone: fixed 96×96px square, top-left, always same position
  - [x] Badges zone: category pill, quality badge, platform icons — right of avatar, top-aligned
  - [x] Info zone: author name, specialty, bio snippet — full-width middle strip
  - [x] Content shelf: book covers strip — full-width bottom, fixed height
  - [x] Card background: Apple fluid glass (bg-card/85 backdrop-blur-xl) + category-tinted gradient overlay
  - [x] All cards identical structure regardless of data density
  - [x] Quality/Rich/Digital Me badges redesigned as pill-style with icons (Brain, Cpu) and ring borders
  - [x] Avatar placeholder uses category-tinted gradient instead of plain bg-muted
  - [x] Book cover placeholder uses category-tinted gradient with title text
  - [x] Actions bar: 3D buttons with shadow-[0_2px_0] style + hover/active effects
  - [x] currentTagSlugs wired from authorTagsMap at all 3 call sites in Home.tsx
  - [x] Specialty text styled italic + muted/80 for visual hierarchy
  - [x] Book count badge uses category color (tinted background + category text)
  - [x] Category watermark icon increased to w-16 h-16 with 3% opacity

---

## Author Detail Page

- [x] Author detail page with bio, books, platforms, tags, RAG chat
- [x] "Generate Digital Me" trigger button (amber → spinner → Chat / Regenerate)
- [x] `DigitalMeChatButton` with polling for RAG generation status

---

## Leaderboard & Analytics

- [x] Leaderboard page with Rating, Enrichment Score, Platform Count metric tabs
- [x] Leaderboard: Books Count metric tab
- [x] Leaderboard: Tag Count metric tab
- [x] Compare Authors page
- [x] Interest Heatmap page
- [x] Group Contrast page

---

## Content Items & Enrichment

- [x] `content_items` table in schema (title, type, url, coverImageUrl, s3CoverUrl, rating, etc.)
- [x] `contentItems` tRPC router — list, getByType, counts, create, update, delete, uploadCoverImage
- [x] YouTube enrichment procedure (`enrichFromYouTube` via YouTube Data API v3)
- [x] Podcast enrichment procedure (`enrichFromPodcast` via iTunes Search API)
- [x] `BulkUrlImportPanel` in Admin → Content Items tab (paste URLs → auto-import)
- [x] TED talk enrichment (view counts, event data via TED public API + OG tag fallback)
- [x] Academic paper enrichment (DOI, citations via OpenAlex API — free, no key required)
- [x] Film/TV enrichment (IMDB data via OMDB API — requires OMDB_API_KEY secret)
- [x] Substack post enrichment (individual post stats via Substack public API + OG fallback)
- [x] Support multi-author content items (many-to-many via `authorContentLinks` — schema + router + BulkUrlImportPanel author field)
- [x] Migrate existing `book_profiles` rows into `content_items` (idempotent batch migration with dry-run + progress UI in Admin → Content Items)
- [x] Seed sample non-book content items (19 items: 8 TED talks, 4 podcasts, 3 papers, 2 articles, 2 YouTube videos) for top authors (Adam Grant, Simon Sinek, Carol Dweck, Dan Pink, Amy Cuddy, Shawn Achor, James Clear, Tim Ferriss, Shane Parrish, Daniel Kahneman, Charles Duhigg)

---

## Admin Console

- [x] Admin Console with tabs: Authors, Books, Tags, Pipeline, Sync, Media, AI Models, Digital Me, Content Items
- [x] `AdminPipelineTab` — Run All cascade button (4-step: Regen DB → Enrich Bios → Enrich Books → Discover Platforms)
- [x] `SyncJobsTab` — Sync Manager with trigger, job history, cancel, credential status
- [x] `TagManagement` + `TagTaxonomyMatrix` + `BulkTagAssignment` in Admin → Tags
- [x] `TagStatisticsCard` bar chart in Admin → Tags
- [x] `MediaItemFormDialog` — Create / Edit / Delete in Admin → Content Items
- [x] `BulkUrlImportPanel` in Admin → Content Items
- [x] Admin sidebar badge counts and running indicators (e.g. jobs in progress)
- [x] Admin sidebar search/filter bar
- [x] Split `Admin.tsx` (643L → 447L) into 15 focused wrapper tab components under `components/admin/` — Admin.tsx is now a thin orchestrator shell with single-component calls per section

---

## Sync / Storage

- [x] `SyncJobsTab` — Dropbox sync trigger, job history, credential status
- [x] Stream-based S3 → Dropbox transfer: `syncEngine.ts` uses Dropbox Upload Session API (chunked, 50MB chunks) for audio files; simple upload for small files — no full-buffer OOM risk
- [x] `_metadata.json` sidecar per book folder: `generateBookMetadata()` + `uploadMetadataSidecarToDropbox()` + `uploadMetadataSidecarToDrive()` in `syncEngine.ts`; Admin → Sync tab has "Generate Sidecars" button with target/scope controls
- [x] Google Drive sync as secondary option: `getOrCreateDriveFolder()` + `uploadToDrive()` (resumable upload API) in `syncEngine.ts`; `getDriveAccessToken()` uses gws CLI in sandbox, falls back to `GOOGLE_DRIVE_ACCESS_TOKEN` env var in production; Admin Sync tab shows Drive connection status
- [x] Vitest tests for sync engine: `server/syncEngine.test.ts` (31 tests) covering slugify, generateBookMetadata, openS3Stream, fetchS3Buffer, dropboxSimpleUpload, uploadMetadataSidecarToDropbox, getOrCreateDriveFolder, uploadMetadataSidecarToDrive, uploadToDropbox routing

---

## Code Quality / Refactoring

- [x] `BookFilterBar` extracted from `Home.tsx` (possession, format, enrichment chip rows)
- [x] `useLibraryCrud` hook for CRUD dialog orchestration
- [x] Split `bookProfiles.router.ts` — extracted book CRUD (createBook, updateBook, deleteBook) into `bookCrud.router.ts` (52L); bookProfiles.router.ts now 203L
- [x] Split `Home.tsx` further — extracted `AuthorsTabContent` and `BooksTabContent` (969L → 734L); recently-enriched/tagged strips moved into AuthorsTabContent; books grid + audiobooks moved into BooksTabContent
- [x] Updated `claude.md` and `manus.md` dependency contracts table with all new components, router splits, and line counts; manus.md synced as copy of claude.md
- [x] Commit and push all changes to GitHub (pushed directly via gh CLI — all 15 checkpoints, latest: 4a3f131)

---

## Infrastructure / Meta

- [x] tRPC + Drizzle + MySQL schema
- [x] Manus OAuth authentication
- [x] S3 file storage helpers
- [x] LLM integration (`invokeLLM`)
- [x] RAG pipeline for Digital Me chat
- [x] Vitest test suite (568 tests passing)

---

## Branding

- [x] Upload book logo (Logo04) to CDN (64x64, 256x256, full-res versions)
- [x] Set browser favicon to Logo0464x64.png (64x64 + 256x256 + apple-touch-icon in index.html)
- [x] Display logo in main library sidebar header (above user identity row, with "Personal Library" wordmark)
- [x] Display logo in Admin Console sidebar header (replacing gear icon with book logo)
- [ ] Set VITE_APP_LOGO in Management UI → Settings → General (manual step — paste CDN URL: https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png)
- [x] Apply subtle warm amber tint to main library sidebar header background (amber-100 → orange-50 → amber-50/30 gradient)
- [x] Apply subtle warm amber tint to Admin Console sidebar header background (matching gradient)
- [x] Roll back amber tint from sidebar headers
- [x] Redesign main library sidebar header: centered 64px logo above wordmark + user identity row (clean, no background tint)

## Legal Pages

- [x] Write Terms of Service content
- [x] Write Cookie Policy content
- [x] Build TermsOfService.tsx page component (/terms)
- [x] Build CookiePolicy.tsx page component (/cookies)
- [x] Register /terms and /cookies routes in App.tsx
- [x] Add Terms and Cookie Policy links to sidebar footer alongside Privacy Policy
- [x] Move user avatar + name from sidebar header to sidebar footer (with "Library Owner" subtitle)
- [x] Sidebar header: logo (80px) + "Ricardo Cidale's Library" two-line wordmark, centered, no tint
- [x] Add Terms of Service and Cookie Policy links to sidebar footer (Privacy · Terms · Cookies)

## RapidAPI Integration

- [x] RAPIDAPI_KEY confirmed available in server environment (50-char key injected via platform secrets)
- [x] server/enrichment/rapidapi.ts already exists with full typed helpers: Yahoo Finance, CNBC, LinkedIn, Seeking Alpha stub
- [x] RapidAPI endpoints in use: yahoo-finance15 (stock quotes), cnbc (news feeds), linkedin-data-api (profile stats)
- [x] tRPC procedures using RapidAPI: authorSocial.router.ts (fetchCNBCAuthorProfile, fetchYahooFinanceStats)
- [x] Vitest tests passing: 568 tests across 36 test files (including cnbc.test.ts, socialStats.test.ts, dependencies.test.ts)

---

## Next 10 Backlog Features (Apr 4, 2026)

- [x] Reading progress tracker on BookDetail page (% complete slider + start/finish date pickers, persisted via updateReadingProgress mutation; schema: readingProgressPercent, readingStartedAt, readingFinishedAt)
- [x] Reading notes UI on BookDetail page (personal notes textarea, persisted to readingNotesJson via updateReadingProgress mutation)
- [x] Author media section on AuthorDetail page (list author's TED talks, podcasts, papers, YouTube videos with type icons and direct links — getByAuthor query via authorContentLinks join)
- [x] getByAuthor tRPC procedure added to contentItems router
- [x] updateReadingProgress tRPC mutation added to bookProfiles router
- [x] getReadingStats tRPC query added to bookProfiles router (byStatus, byFormat, avgRating, readDates, books list)
- [x] Reading Stats dashboard page (/stats) — KPI cards, status bars, format bars, in-progress list with progress bars, books-by-year timeline, recently finished list
- [x] /stats route registered in App.tsx and Reading Stats link added to sidebar footer (TrendingUp icon)
- [ ] CNBC "In the News" badge on author cards (show article count from socialStatsJson.cnbc if > 0) — deferred
- [ ] LinkedIn follower count display on author cards and AuthorDetail page — deferred
- [ ] Similar books recommendations panel on BookDetail page — deferred
- [ ] Global keyboard shortcut (Cmd/Ctrl+K) command palette for fast author/book search and navigation — deferred
- [ ] Author "In the News" section on AuthorDetail page (CNBC articles) — deferred
- [ ] Book ISBN barcode display on BookDetail page — deferred

---

## Premium News Enrichment (Apr 4, 2026)

- [ ] Research and test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost APIs
- [ ] Build unified `server/enrichment/newsOutlets.ts` helper with typed per-outlet fetchers
- [ ] Add `fetchAuthorNews` tRPC procedure returning articles across all 8 outlets
- [ ] Add "In the News" section to AuthorDetail page (article cards with outlet badge, headline, date, link)
- [ ] Add news article count badge to FlowbiteAuthorCard
- [ ] Cache news results in `author_profiles.socialStatsJson` to avoid redundant API calls
- [ ] Write vitest tests for newsOutlets helper

## Library Catalog APIs (Apr 4, 2026)

- [ ] Test and integrate Open Library API (free, no key) — book metadata, ISBNs, cover images, availability
- [ ] Test and integrate WorldCat Search API (OCLC) — public library holdings across 10,000+ libraries
- [ ] Test and integrate HathiTrust Data API — university library full-text availability and digital copies
- [ ] Test and integrate DPLA (Digital Public Library of America) API — free digital collections
- [ ] Test and integrate JSTOR API (if available) — academic citations and university library access
- [ ] Add "Library Availability" section to BookDetail page (which public/university libraries hold this book)
- [ ] Add "Free Digital Copy" badge to BookDetail when HathiTrust/DPLA has a free version
- [ ] Add Apple Podcasts, Instagram, Spotify server-side helpers
- [ ] Add Apple News, NYT, BBC, CNN server-side helpers (test which are accessible with RAPIDAPI_KEY)

---

## External API Helpers — Server-Side Tools (Apr 4, 2026)

- [x] server/enrichment/openLibrary.ts — searchBooks, getBookByISBN, searchAuthors, getAuthorWorks, enrichBookFromOpenLibrary, getCoverUrl (Open Library — free, no key)
- [x] server/enrichment/applePodcasts.ts — searchPodcasts, searchPodcastEpisodes, lookupPodcast, getAuthorPodcasts, getArtworkUrl (iTunes Search API — free, no key)
- [x] server/enrichment/hathiTrust.ts — getVolumesByISBN, checkDigitalAvailability, getAvailabilitySummary, getReadUrl (HathiTrust — free, no key)
- [x] server/enrichment/newsSearch.ts — searchAuthorNews (CNBC RapidAPI + Google News RSS fallback), searchBookNews, getCNBCAuthorMentions
- [x] server/routers/enrichment.router.ts — unified tRPC router: enrichment.openLibrary.*, enrichment.applePodcasts.*, enrichment.hathiTrust.*, enrichment.news.*
- [x] server/enrichment.test.ts — 19 vitest tests, all passing (including live API calls to Open Library, HathiTrust, Google News RSS)
- [x] 587 total tests passing across 37 test files
- [ ] Wire enrichment.hathiTrust.checkAvailability into BookDetail page (show "Free Digital Copy" badge when available)
- [ ] Wire enrichment.applePodcasts.getAuthorPodcasts into AuthorDetail page
- [ ] Wire enrichment.news.searchAuthorNews into AuthorDetail "In the News" section
- [ ] Test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost (premium news outlets)
- [ ] Test Spotify API via RapidAPI for author audiobook/podcast data
- [ ] Test Instagram API via RapidAPI for author follower counts and recent posts

---

## Full API Wiring — Author & Book Research Dashboard (Apr 4, 2026)

### BookDetail Page Enrichment
- [ ] Open Library panel: show ISBN-13, publisher, publish date, page count, subjects from OL enrichment
- [ ] HathiTrust availability badge: "Free Digital Copy" button when full-view copy exists (links to HathiTrust reader)
- [ ] Open Library cover fallback: if no S3 cover, fetch cover from Open Library by ISBN
- [ ] "Also available at" library count: show how many HathiTrust copies exist (search-only + full-view)

### AuthorDetail Page Enrichment
- [ ] "In the News" section: top 10 recent articles mentioning the author (CNBC + Google News RSS via enrichment.news.searchAuthorNews)
- [ ] Apple Podcasts section: author's podcasts from iTunes (enrichment.applePodcasts.getAuthorPodcasts) — supplement existing content items
- [ ] LinkedIn stats panel: follower count, headline, connection count (from socialStatsJson.linkedin if enriched)
- [ ] Wikipedia quick-facts panel: birth date, nationality, alma mater, awards (from socialStatsJson.wikipedia)
- [ ] Yahoo Finance panel: show company/stock data for author-linked companies (from socialStatsJson.yahooFinance)
- [ ] Substack subscriber count badge on author cards (from socialStatsJson.substack if available)

### Author Cards (Home page)
- [ ] "In the News" count badge on FlowbiteAuthorCard (article count from news search cache)
- [ ] LinkedIn follower count display on author cards
- [ ] Substack subscriber count on author cards

### Caching & Performance
- [ ] Cache news search results in author_profiles.socialStatsJson (TTL: 24h) to avoid redundant API calls
- [ ] Cache Open Library enrichment in book_profiles (ISBN, publisher, OL cover URL) after first fetch
- [ ] Cache HathiTrust availability in book_profiles (htAvailability field) after first check

---

## Admin — API Management Page (Apr 4, 2026)

- [x] Add `api_registry` table to schema (id, key, name, description, source, sourceUrl, category, host, enabled, statusColor, lastCheckedAt, lastStatus, lastStatusCode, notes)
- [x] Run `pnpm db:push` to migrate the new table
- [x] Seed `api_registry` with all known APIs (RapidAPI subscriptions + free APIs used in the app)
- [x] Build `server/routers/apiRegistry.router.ts` — list, toggle enabled, update status, ping/check
- [x] Build `client/src/components/admin/ApiManagementTab.tsx` — 3-column responsive card grid
  - [x] Each card: API name, source badge, status dot (green/yellow/red), description, enable/disable switch
  - [x] Status dot colors: green = working, yellow = subscribed but endpoint issues, red = not subscribed / down
  - [x] Cards grouped by category (Books, News, Social, Finance, Travel, Utilities)
  - [x] "Check All" button to ping all APIs and refresh status
- [x] Register `ApiManagementTab` in Admin Console tabs
- [x] Write vitest tests for apiRegistry router

## Bug Fixes (Apr 5, 2026)

- [ ] Fix Admin sidebar overlapping breadcrumb bar and page content (copy layout fix from home page)

## Substack RSS Integration (Apr 5, 2026)

- [ ] Install rss-parser and @aws-sdk/client-s3
- [ ] Build server-side Substack RSS helper (fetch author's Substack feed by URL)
- [ ] Add tRPC procedure: `author.getSubstackFeed(authorId)` 
- [ ] Wire Substack feed panel into AuthorDetail page (latest 5 posts, publication name, subscribe link)
- [ ] Write vitest tests for Substack helper

## The Atlantic RSS Integration (Apr 5, 2026)

- [ ] Save The Atlantic RSS scraper as server/services/atlantic.service.ts
- [ ] Add tRPC procedure: `author.getAtlanticArticles(authorName)` — fetches + matches articles to author
- [ ] Wire Atlantic articles panel into AuthorDetail page (latest articles, title, date, link)
- [ ] Cache Atlantic feed results in DB to avoid re-fetching on every page load

## Atlantic Full Article Pipeline (Apr 5, 2026)

- [ ] Add `atlantic_articles` table to drizzle schema (articleId, title, url, authorName, publishedAt, summaryText, fullText, categories, feedUrl, scrapedAt)
- [ ] Run pnpm db:push to migrate
- [ ] Build `server/routers/atlantic.router.ts` with procedures: fetchFeed, scrapeArticle (Apify), getByAuthor
- [ ] Wire Atlantic articles panel into AuthorDetail page (title, date, summary, expandable full text, link)
- [ ] Write vitest tests for atlantic router

## Magazine Article Pipeline — Atlantic, New Yorker, Wired (Apr 5, 2026)

- [ ] Add shared `magazine_articles` table to drizzle schema (source: 'atlantic'|'new-yorker'|'wired', articleId, title, url, authorName, authorNameNormalized, publishedAt, summaryText, fullText, categoriesJson, feedUrl, scrapedAt, scrapeAttempted)
- [ ] Run pnpm db:push to migrate
- [ ] Build `server/services/magazine.service.ts` with RSS configs for all 3 sources
- [ ] Build `server/routers/magazine.router.ts` with procedures: syncFeed, scrapeArticle, getByAuthor, getBySource
- [ ] Wire magazine articles panel into AuthorDetail page (grouped by source, title, date, summary, expandable full text, link)
- [ ] Write vitest tests for magazine router

- [ ] Add NYT and Washington Post RSS feeds to magazine pipeline (5 total sources)

## Pinecone RAG Integration (Apr 5, 2026)

- [ ] Install @pinecone-database/pinecone SDK
- [ ] Add PINECONE_API_KEY secret
- [ ] Build server/services/pinecone.service.ts (upsert vectors, query by similarity)
- [ ] Build RAG pipeline: chunk text (articles/books), embed via Gemini text-embedding-004, upsert to Pinecone
- [ ] Add tRPC procedure: ragPipeline.indexArticle, ragPipeline.indexBook, ragPipeline.semanticSearch
- [ ] Wire semantic search into author chatbot and author detail page
