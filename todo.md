# Authors & Books Library — Project TODO

Last cleaned: Apr 5, 2026

---

## Branding

- [ ] Set VITE_APP_LOGO in Management UI → Settings → General (manual step — paste CDN URL: https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png)

---

## Deferred Features

- [ ] CNBC "In the News" badge on author cards (show article count from socialStatsJson.cnbc if > 0)
- [ ] LinkedIn follower count display on author cards
- [ ] Global keyboard shortcut (Cmd/Ctrl+K) command palette for fast author/book search and navigation
- [ ] Author "In the News" section on AuthorDetail page (CNBC articles)
- [ ] Book ISBN barcode display on BookDetail page

---

## Premium News Enrichment

- [ ] Research and test RapidAPI access to NYT, Bloomberg, WSJ, BBC, CNN, Atlantic, MSNBC, WashPost APIs
- [ ] Build unified `server/enrichment/newsOutlets.ts` helper with typed per-outlet fetchers
- [ ] Add `fetchAuthorNews` tRPC procedure returning articles across all 8 outlets
- [ ] Add "In the News" section to AuthorDetail page (article cards with outlet badge, headline, date, link)
- [ ] Add news article count badge to FlowbiteAuthorCard
- [ ] Cache news results in `author_profiles.socialStatsJson` to avoid redundant API calls
- [ ] Write vitest tests for newsOutlets helper

---

## Library Catalog APIs

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

## External API Wiring — Author & Book Detail Pages

### BookDetail Page
- [ ] Wire enrichment.hathiTrust.checkAvailability into BookDetail page (show "Free Digital Copy" badge when available)
- [ ] Open Library panel: show ISBN-13, publisher, publish date, page count, subjects from OL enrichment
- [ ] HathiTrust availability badge: "Free Digital Copy" button when full-view copy exists (links to HathiTrust reader)
- [ ] Open Library cover fallback: if no S3 cover, fetch cover from Open Library by ISBN
- [ ] "Also available at" library count: show how many HathiTrust copies exist (search-only + full-view)

### AuthorDetail Page
- [ ] Wire enrichment.applePodcasts.getAuthorPodcasts into AuthorDetail page
- [ ] Wire enrichment.news.searchAuthorNews into AuthorDetail "In the News" section
- [ ] "In the News" section: top 10 recent articles mentioning the author (CNBC + Google News RSS)
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

- [ ] Redesign FlowbiteAuthorCard with tabbed layout (two filing-folder tabs: "Info" and "Books / Substack")
  - [ ] Tab 1 (Info): avatar, badges, bio, platform pills — current default view
  - [ ] Tab 2 (Books): book cover shelf + Substack latest posts preview
  - [ ] Tab labels styled as folder tabs (rounded-t, active tab raised, inactive tab slightly behind)
  - [ ] Animate tab switch with a smooth cross-fade
- [ ] Redesign FlowbiteBookCard with tabbed layout (two filing-folder tabs: "Details" and "Notes")
  - [ ] Tab 1 (Details): cover, title, author, format, possession, tags
  - [ ] Tab 2 (Notes): reading progress bar, reading notes excerpt, start/finish dates
  - [ ] Tab labels styled as folder tabs matching author card style
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
