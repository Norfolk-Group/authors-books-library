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
- [ ] Implement stream-based S3 → Dropbox transfer (no memory buffering for large audio files)
- [ ] Add `_metadata.json` sidecar per book folder (title, authors, ISBN, rating, summary, S3 URL)
- [ ] Add Google Drive sync as secondary option (rclone / gws CLI)
- [ ] Write vitest tests for sync engine

---

## Code Quality / Refactoring

- [x] `BookFilterBar` extracted from `Home.tsx` (possession, format, enrichment chip rows)
- [x] `useLibraryCrud` hook for CRUD dialog orchestration
- [x] Split `bookProfiles.router.ts` — extracted book CRUD (createBook, updateBook, deleteBook) into `bookCrud.router.ts` (52L); bookProfiles.router.ts now 203L
- [x] Split `Home.tsx` further — extracted `AuthorsTabContent` and `BooksTabContent` (969L → 734L); recently-enriched/tagged strips moved into AuthorsTabContent; books grid + audiobooks moved into BooksTabContent
- [x] Updated `claude.md` and `manus.md` dependency contracts table with all new components, router splits, and line counts; manus.md synced as copy of claude.md
- [ ] Commit and push all changes to GitHub (via Management UI → Settings → GitHub)

---

## Infrastructure / Meta

- [x] tRPC + Drizzle + MySQL schema
- [x] Manus OAuth authentication
- [x] S3 file storage helpers
- [x] LLM integration (`invokeLLM`)
- [x] RAG pipeline for Digital Me chat
- [x] Vitest test suite (492 tests passing)
