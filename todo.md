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
- [ ] Tag rename cascade — when a tag slug changes, update all `tagsJson` arrays in `author_profiles` and `book_profiles`
- [ ] Tag auto-suggest at creation time — add tag picker to Author and Book CRUD dialogs

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
- [ ] Show active tag filter chips in header bar as dismissible badge pills (Books tab)
- [ ] Add content type cards with appropriate icons in Media tab grid

---

## Author & Book Cards

- [x] `FlowbiteAuthorCard` — 6-zone card layout with avatar, badges, bio, book shelf, platforms, tags
- [x] Suspicious name warning badge (`isLikelyAuthorName` check) in `FlowbiteAuthorCard`
- [x] `BookCard` — card with cover, title, author, format, possession, tags
- [ ] Redesign `FlowbiteAuthorCard` with strict 4-zone grid:
  - [ ] Avatar zone: fixed 96×96px square, top-left, always same position
  - [ ] Badges zone: category pill, quality badge, platform icons — right of avatar, top-aligned
  - [ ] Info zone: author name, specialty, bio snippet — full-width middle strip
  - [ ] Content shelf: book covers strip — full-width bottom, fixed height
  - [ ] Card background: light theme-aware glass/frosted effect
  - [ ] All cards identical structure regardless of data density

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
- [ ] TED talk enrichment (view counts, event data)
- [ ] Academic paper enrichment (DOI, citations via OpenAlex)
- [ ] Film/TV enrichment (IMDB data)
- [ ] Substack post enrichment (individual post stats)
- [ ] Support multi-author content items (many-to-many via `authorContentLinks`)
- [ ] Migrate existing `book_profiles` rows into `content_items` (data migration)

---

## Admin Console

- [x] Admin Console with tabs: Authors, Books, Tags, Pipeline, Sync, Media, AI Models, Digital Me, Content Items
- [x] `AdminPipelineTab` — Run All cascade button (4-step: Regen DB → Enrich Bios → Enrich Books → Discover Platforms)
- [x] `SyncJobsTab` — Sync Manager with trigger, job history, cancel, credential status
- [x] `TagManagement` + `TagTaxonomyMatrix` + `BulkTagAssignment` in Admin → Tags
- [x] `TagStatisticsCard` bar chart in Admin → Tags
- [x] `MediaItemFormDialog` — Create / Edit / Delete in Admin → Content Items
- [x] `BulkUrlImportPanel` in Admin → Content Items
- [ ] Admin sidebar badge counts and running indicators (e.g. jobs in progress)
- [ ] Admin sidebar search/filter bar
- [ ] Split `Admin.tsx` (641L) into focused tab components

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
- [ ] Split `bookProfiles.router.ts` — extract book CRUD into `bookCrud.router.ts`
- [ ] Split `Home.tsx` further — extract `AuthorsTabContent` and `BooksTabContent`
- [ ] Update `claude.md` and `manus.md` dependency contracts table
- [ ] Commit and push all changes to GitHub (via Management UI → Settings → GitHub)

---

## Infrastructure / Meta

- [x] tRPC + Drizzle + MySQL schema
- [x] Manus OAuth authentication
- [x] S3 file storage helpers
- [x] LLM integration (`invokeLLM`)
- [x] RAG pipeline for Digital Me chat
- [x] Vitest test suite (492 tests passing)
