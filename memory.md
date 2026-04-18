# Project Memory Log

> This file records every significant action taken across all sessions.
> **RULE:** Append a new dated entry at the end of every completed task.

---

## Sessions Prior to March 21, 2026 (Reconstructed from todo.md and codebase)

### Core Library Build (Sessions 1–3)
- Scaffolded `authors-books-library` project with React 19 + Tailwind 4 + tRPC + Drizzle + MySQL.
- Built main library UI in `Home.tsx`: Authors / Books / Books Audio tabs with category sidebar, search, sorting, and stat cards.
- Integrated Google Drive folder scanning via `library.router.ts` — reads author and book folder structure, generates `libraryData.ts` and `audioData.ts` static files.
- Added content-type badges (PDF, Transcript, Binder, Supplemental, etc.) and Google Drive folder links.
- Implemented mobile-responsive layout with collapsible sidebar.

### Enrichment Pipeline — Author Photos (Sessions 4–6)
- Built 5-tier author avatar waterfall in `server/lib/authorAvatars/waterfall.ts`:
  1. Amazon author page scrape (Apify)
  2. Wikipedia API photo
  3. Tavily image search
  4. Gemini vision validation
  5. Replicate AI portrait generation (fallback)
- Created `authorAvatars.ts` static map and `authorAliases.ts` for name normalisation.
- Added `AvatarUpload` component with `AvatarCropModal` (react-image-crop, 256×256 JPEG output).
- Stored uploaded avatars in Manus S3 CDN; saved URL to `author_profiles` DB table.

### Enrichment Pipeline — Book Covers (Sessions 5–7)
- Built Amazon-first book cover scraping via Apify cheerio-scraper actor.
- Added Google Books API fallback for cover, summary, ISBN, publisher, ratings.
- Created `mirrorToS3.ts` helper to fetch external cover URLs and re-host on Manus S3 CDN.
- Stored `s3CoverUrl`, `coverUrl`, `amazonUrl`, `goodreadsUrl`, `summary`, `rating` in `book_profiles` DB table.
- Integrated cover thumbnails into `FlowbiteAuthorCard` and `AuthorAccordionRow`.

### Enrichment Pipeline — Author Bios (Sessions 6–8)
- Built Wikipedia API + Wikidata enrichment in `authorProfiles.router.ts`:
  - Wikipedia extract for bio text
  - Wikidata P856 (website), P2002 (Twitter), P6634 (LinkedIn)
- Added LLM fallback (invokeLLM) when Wikipedia returns no result.
- Stored bio, websiteUrl, twitterUrl, linkedinUrl in `author_profiles` DB table.
- Added `authorBios.json` static file as primary bio source (fastest path).

### UI/UX — Flowbite Card System (Sessions 8–12)
- Installed Flowbite + flowbite-react; wired Tailwind v4 CSS-first plugin.
- Built `FlowbiteAuthorCard` with 3-hotspot interaction model:
  - Hotspot 1: Avatar / author name → opens `AuthorModal`
  - Hotspot 2: Book cover / book title → opens `BookModal`
  - Hotspot 3: Category badge → filters sidebar
- Built `BookModal` (cover, summary, Amazon/Goodreads/Drive links, content-type pills).
- Built `AuthorModal` (photo, bio, category, social links, "Find Real Photo" scrape button).
- Built `CoverLightbox` (Framer Motion spring animation, backdrop blur, Escape key).
- Built `AuthorAccordionRow` for accordion view mode.
- Added 3D tilt effect (Framer Motion) on author cards.
- Added confetti burst on avatar click.
- Added sparkle canvas background.

### Themes (Sessions 10–14)
- Implemented `ThemeContext` with 3 themes switchable from Preferences panel:
  - **Manus** (default light): Swiss Modernist, warm off-white `oklch(0.98 0.005 85)`, charcoal text, Playfair Display + DM Sans fonts.
  - **Norfolk AI**: Deep navy `oklch(0.18 0.04 250)`, gold accent `oklch(0.78 0.15 85)`, Inter font.
  - **Noir Dark**: True black `oklch(0.08 0 0)`, electric blue `oklch(0.65 0.2 250)`, JetBrains Mono font.
- All CSS variables in `client/src/index.css` using OKLCH format.
- Theme persisted to localStorage.

### Admin Console (Sessions 13–18)
- Built `Admin.tsx` (1187 lines) with 3 tabs:
  - **Data Pipeline**: Batch enrich authors/books, regenerate library data, scrape covers.
  - **Media**: Browse and manage author avatars and book covers stored in S3.
  - **Research Cascade**: Stats on enrichment sources (Wikipedia hits, Amazon hits, LLM fallbacks, etc.).
- Added nightly cron job for cover scraping.
- Added LLM model selector (13 Gemini models) in Preferences.

### Data & Infrastructure (Sessions 15–20)
- Database schema: `author_profiles`, `book_profiles`, `users` tables in MySQL/TiDB.
- All media (author avatars, book covers) mirrored to Manus S3 CDN via `storagePut()`.
- Google Drive as source of truth for book/author folder structure; DB/S3 for app-speed access.
- 122 vitest tests across 9 test files.
- GitHub repo: `ricardocidale/authors-books-library` (branch: `main`).
- Deployed: `authlib-ehsrgokn.manus.space`.

### Documentation (Session ~March 19, 2026)
- Created `claude.md` (550+ lines): full architecture, enrichment pipelines, data storage strategy, Google Drive folder structure, UI components, themes, fonts.
- Updated `library-content-enrichment` skill with Amazon-first cascade.
- Updated `book-cover-scrape-mirror` skill.

---

## March 21, 2026

### Manual Review Items Resolved
- **Shared cover URL**: "From Impossible to Inevitable" and "Predictable Revenue" shared the same Google Books cover (wrong ID). Fetched correct Predictable Revenue cover from Open Library, uploaded to S3, updated DB.
- **Jolt Effect duplicate**: Deleted `book_profiles` id=98 ("The Jolt Effect" by Matt Dixon only); kept id=30005 ("The JOLT Effect" by Matthew Dixon & Ted McKenna — more complete attribution). Same ISBN confirmed true duplicate.
- Checkpoint: `268a8543`

### All Book Enrichment Todo Items Confirmed Complete
- Verified all 9 enrichment items were already implemented in prior sessions; marked as done in todo.md.
- Pushed to GitHub (`bcc9743`).
- Checkpoint: `38d67217`

### Comprehensive Documentation
- Rewrote `claude.md` to 550+ lines covering full architecture, Amazon-first enrichment cascade, 5-tier photo waterfall, data storage strategy, Google Drive folder structure with IDs, all UI components, 3 themes with exact OKLCH color values, typography system.
- Updated `library-content-enrichment` and `book-cover-scrape-mirror` skills.
- Pushed to GitHub (`1ab6fe26`).
- Checkpoint: `1ab6fe26`

### Preview Refresh
- Saved checkpoint `3e5793f6` to refresh Management UI preview thumbnail. No code changes.
- Pushed to GitHub (`3e5793f`).

### Exit Buttons Added to All Modals
- Audited all 6 overlay components: AuthorModal, BookModal, CoverLightbox, AvatarCropModal, AlertDialog (Admin), ManusDialog.
- Added prominent X button (top-right, 36px, hover scale + border) and full-width "Close" button (bottom) to `AuthorModal` and `BookModal`.
- CoverLightbox, AvatarCropModal, AlertDialog, ManusDialog already had clear exit paths.
- All 6 components support Escape key.
- 122 tests passing. Pushed to GitHub (`57a94ff`).
- Checkpoint: `b3e437ab`

### Standing Rules Established
- Added **MANDATORY** rule to `claude.md`: update `claude.md` and append to `memory.md` at the end of every task.
- Created this `memory.md` file.

### Back to Top Button (Completed)
- Created `client/src/components/BackToTop.tsx`: Framer Motion spring animation, appears after 300px scroll, 3D shadow button style, smooth scroll-to-top on click.
- Added `mainRef = useRef<HTMLElement>(null)` to `Home.tsx` and attached to `<main ref={mainRef}>`.
- Rendered `<BackToTop scrollContainerRef={mainRef} />` at the bottom of the component tree.
- 122 tests passing.

### Standing Rules Established
- Added **MANDATORY** rule to `claude.md`: update `claude.md` and append to `memory.md` at the end of every task.
- Created `memory.md` (this file) with full reconstructed session history.
- Updated `claude.md` last-updated date and added `BackToTop` to component table and tree.

### Avatar Sizes Tripled & 3D Tilt Removed

All author avatar sizes tripled across every card component:
- `FlowbiteAuthorCard`: `h-9 w-9` (36px) → `h-28 w-28` (112px), column-centered layout
- `AuthorCard` (Home.tsx): `w-10 h-10` (40px) → `w-[120px] h-[120px]`, column-centered layout
- `AuthorAccordionRow`: `h-7 w-7` (28px) → `h-[84px] w-[84px]`

The `useCardTilt` 3D tilt hook (using `useMotionValue`, `useSpring`, `useTransform`) was removed from all 4 card components. Replaced with Framer Motion `whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}` spring animation on card wrappers. Avatar images use CSS `hover:scale-110 active:scale-95`.

Three.js integration added to todo list (use case TBD by user).

Files changed: `FlowbiteAuthorCard.tsx`, `AuthorAccordionRow.tsx`, `Home.tsx`, `claude.md`, `memory.md`, `todo.md`
122 tests passing.

### File Re-Architecture & Codebase Optimization (Context-Compacted Session)

The session inherited from a prior context that exceeded limits. The following work was completed in the previous context and is being documented here:

Fixed unicode box-drawing characters (U+2500 family, em-dashes, curly quotes) in 52 files project-wide. These were causing a Vite parse error at Home.tsx line 279.

Split Home.tsx from 1908 lines to 687 lines by extracting 6 components into client/src/components/library/: AuthorCard.tsx, BookCard.tsx, AudioCard.tsx, AuthorBioPanel.tsx, BookDetailPanel.tsx, LibraryPrimitives.tsx, and libraryConstants.ts.

Split Admin.tsx from 1187 lines to 857 lines by extracting 3 tab components into client/src/components/admin/: CascadeTab.tsx, SettingsTab.tsx, AboutTab.tsx, ActionCard.tsx, adminTypes.ts.

Extracted server helpers: enrichAuthorViaWikipedia() + generateBioWithLLM() into server/lib/authorEnrichment.ts (authorProfiles.router.ts: 672 -> 532 lines). Extracted enrichBookViaGoogleBooks() + generateBookSummaryWithLLM() into server/lib/bookEnrichment.ts (bookProfiles.router.ts: 515 -> 313 lines).

Deleted 4 legacy dead-code router files totalling 1590 lines.

All 122 tests still passing. claude.md architecture overview updated with new file structure. Checkpoint: 6ef6c867.

## Session March 21, 2026 — One-Author-Per-Card + Avatar Background Color

### One-Author-Per-Card Rule (Item 1)
- **authorAliases.ts**: All combined-name entries (e.g. "Aaron Ross and Jason Lemkin") now resolve to the first author's canonical name. Added individual canonical entries for 14 co-authors: Jason Lemkin, Bill Carr, Anne Morriss, Bo Burlingham, Ruben Rabago, Ted McKenna, Brent Adamson, Nick Toman, Rick DeLisi, William Ury, Chip Heath, John David Mann, Kelly Leonard, Tom Yorton.
- **authorAvatars.ts**: Removed all combined-name photo entries (group shots). Each primary co-author now has their own individual entry pointing to the same CDN URL. Secondary co-authors (Jason Lemkin, William Ury, Chip Heath, etc.) will use the DB waterfall for individual portraits.
- **DB author_profiles**: Added individual rows for 11 co-authors who had no DB row.
- **DB book_profiles**: Split multi-author book rows — each co-author now has their own book_profiles row with the same cover/metadata.

### Avatar Background Color (Item 2)
- **AppSettingsContext.tsx**: Added `avatarBgColor: string` to `AppSettings` type (default `#1e293b`). Persisted to localStorage via existing `app-settings-v2` key.
- **SettingsTab.tsx**: Added "Avatar Background Color" card with 9 preset swatches (Slate, Navy, Charcoal, Forest, Ocean, Plum, Warm Grey, Cream, White) + native `<input type="color">` picker + live hex preview.
- **replicateGeneration.ts**: Added `describeColor(hex)` helper that converts hex to human-readable color name. Updated `buildPrompt(authorName, bgColor?)` to inject the color description into the portrait prompt (e.g. "solid deep navy blue background"). Updated `generateAIPortrait(authorName, bgColor?)` signature.
- **authorProfiles.router.ts**: Updated `generatePortrait` procedure input schema to accept optional `bgColor` string, passed through to `generateAIPortrait`.
- **AuthorBioPanel.tsx**: Reads `settings.avatarBgColor` from `useAppSettings()` and passes it to the generate portrait button's mutation call.
- **Admin.tsx**: Batch portrait generation passes `settings.avatarBgColor` to each `generatePortrait` mutation.

### Test Results
- 122 tests passing (9 test files), 0 TypeScript errors.

---

## Session: March 21, 2026 — Theme System, AI Model Settings, Avatar Swatches

### Changes Made

**Manus Theme Redesign (Black/White/Grey Seed):**
- Rewrote `.theme-manus` CSS variables in `index.css` to pure black/white/grey system
- Background: `#F2F2F2`, Cards: `#FFFFFF`, Sidebar: `#E4E4E4`, Foreground: `#111111`
- Established Manus as the living seed/default — all other themes branch from it
- Rule: always update Manus theme first when making design changes

**Norfolk AI Official Palette Applied:**
- Updated `.theme-norfolk-ai` CSS variables with official palette from Palette.docx
- Colors: Navy `#112548`, Yellow `#FDB817`, Teal `#0091AE`/`#00A9B8`, Orange `#F4795B`, Green `#21B9A3`

**Avatar Background Swatches:**
- Replaced generic swatches with official Norfolk AI palette colors (11 swatches)
- Seeded default changed from `#1e293b` to `#0091AE` (Norfolk AI Teal 1)
- Added live preview swatch and custom color picker with hex display

**AI Model Settings Redesign (3-Column Layout):**
- Built `VENDOR_CATALOGUE` in `llm.router.ts` with 10 vendors and 40+ models
- Vendors: Google, OpenAI, Anthropic, Meta, Mistral, Cohere, xAI, DeepSeek, Amazon, Microsoft
- Added `listVendors`, `refreshVendors` tRPC procedures; updated `listModels` to accept `vendorId`
- Added to `AppSettings`: `primaryVendor`, `primaryModel`, `secondaryLlmEnabled`, `secondaryVendor`, `secondaryModel`
- Default seeded: Google → Gemini 2.5 Pro (primary), OpenAI → GPT-4o (secondary)
- Rewrote `SettingsTab.tsx` with 3-column AI Model card:
  - Col 1: Primary LLM (vendor dropdown → model radio list with Test button)
  - Col 2: Secondary LLM toggle + vendor/model selectors
  - Col 3: Active summary + Refresh Vendors & Models button

**One-Author-Per-Card Enforcement:**
- Confirmed split logic in `filteredAuthors` (Home.tsx) correctly handles co-author names at render time
- `canonicalName()` called in all card components before any photo/bio lookup
- `authorAliases.ts` and `authorAvatars.ts` updated to map individual co-authors

**TypeScript Fixes:**
- Fixed TS2554 in `SettingsTab.tsx` (listModels.useQuery now requires vendorId)
- 0 TypeScript errors, 122 tests passing

### Files Changed
- `client/src/index.css` — Manus theme + Norfolk AI theme CSS variables
- `client/src/components/admin/SettingsTab.tsx` — Full rewrite with 3-column AI Model card
- `client/src/contexts/AppSettingsContext.tsx` — Added primaryVendor/Model, secondaryLlm* fields
- `server/routers/llm.router.ts` — Full vendor catalogue, listVendors, refreshVendors
- `claude.md` — Updated design system, theme tables, admin tab 4 description

## March 21, 2026 — Session 2: Codebase Optimization + Secondary LLM Wiring

### Completed
- **Secondary LLM wired**: `enrichAuthorViaWikipedia` and `enrichBookViaGoogleBooks` now accept `secondaryModel` parameter; when enabled, secondary LLM runs a refinement pass on the primary LLM output
- **Admin.tsx**: batch enrichment calls now pass `secondaryModel` when `settings.secondaryLlmEnabled` is true
- **N+1 queries fixed**: both `authorProfiles.enrichBatch` and `bookProfiles.enrichBatch` pre-fetch all existing rows in a single `inArray` query before the loop
- **httpClient.ts created**: `server/lib/httpClient.ts` with `fetchJson()` and `fetchBuffer()` — timeout, retry, typed errors
- **apify.ts optimized**: `runActorWithRetry()` helper, `ApifyRunResult` typed interface, retry constants
- **mirrorToS3.ts fixed**: dedup check now correctly skips re-upload when `existingKey` exists; uses `fetchBuffer` from httpClient
- **waterfall.ts optimized**: per-tier timeouts, `skipAlreadyEnriched` option, structured timing logs
- **claude.md updated**: LLM Configuration section, Performance Optimizations section, Last Updated date
- **122 tests passing, 0 TypeScript errors**

## March 21, 2026 — Session 3: Codebase Optimization + Secondary LLM Wiring

### Completed
- **Secondary LLM wired**: enrichAuthorViaWikipedia and enrichBookViaGoogleBooks now accept secondaryModel parameter; when enabled, secondary LLM runs a refinement pass on the primary LLM output
- **Admin.tsx**: batch enrichment calls now pass secondaryModel when settings.secondaryLlmEnabled is true
- **N+1 queries fixed**: both authorProfiles.enrichBatch and bookProfiles.enrichBatch pre-fetch all existing rows in a single inArray query before the loop
- **httpClient.ts created**: server/lib/httpClient.ts with fetchJson() and fetchBuffer() -- timeout, retry, typed errors
- **apify.ts optimized**: runActorWithRetry() helper, ApifyRunResult typed interface, retry constants
- **mirrorToS3.ts fixed**: dedup check now correctly skips re-upload when existingKey exists; uses fetchBuffer from httpClient
- **waterfall.ts optimized**: per-tier timeouts, skipAlreadyEnriched option, structured timing logs
- **claude.md updated**: LLM Configuration section, Performance Optimizations section, Last Updated date
- **122 tests passing, 0 TypeScript errors**

## Session March 21, 2026 — Rename authorPhotos → authorAvatars + Book Cover 2x + LLM Wiring

### authorPhotos → authorAvatars Rename (Complete)
- Renamed all TypeScript variables, function names, and types: authorPhoto → authorAvatar, photoUrl → avatarUrl, s3PhotoUrl → s3AvatarUrl, s3PhotoKey → s3AvatarKey, photoSource → avatarSource, photoSourceUrl → avatarSourceUrl
- Updated server/apify.ts: AuthorPhotoResult.photoUrl → AuthorPhotoResult.avatarUrl
- Updated server/lib/authorAvatars/waterfall.ts: result.photoUrl → result.avatarUrl
- Updated server/routers/apify.router.ts: all result.photoUrl → result.avatarUrl
- Updated drizzle/schema.ts: physical MySQL column names renamed from photoUrl/photoSourceUrl/s3PhotoUrl/s3PhotoKey/photoSource to avatarUrl/avatarSourceUrl/s3AvatarUrl/s3AvatarKey/avatarSource
- Ran pnpm db:push — migration 0009_flat_wallflower.sql applied successfully (5 RENAME COLUMN statements)
- Updated all UI text/labels: "photo" → "avatar" in Admin.tsx, Home.tsx sidebar footer
- Updated claude.md and memory.md to reflect the rename

### Book Cover Thumbnail 2x Enlargement
- FlowbiteAuthorCard.tsx: cover strip h-11 w-8 → h-[88px] w-16 (2x)
- AuthorAccordionRow.tsx: expanded panel covers h-10 w-7 → h-20 w-14 (2x)
- library/AuthorCard.tsx: grid card covers w-8 h-11 → w-16 h-[88px] (2x)

### AuthorAccordionRow Redesign
- Author name upgraded from text-sm font-medium → text-base font-bold tracking-tight — now matches card grid view prominence
- Specialty subtitle now shown below name in list/accordion view (was missing)
- Legible against all three themes (Manus, Norfolk AI, Noir Dark) — uses text-card-foreground semantic token

### Two-Level LLM Wiring (Complete)
- AuthorBioPanel.tsx: auto-enrich now passes model: settings.primaryModel and secondaryModel: settings.secondaryModel (when secondaryLlmEnabled)
- BookDetailPanel.tsx: same two-level LLM wiring applied to book auto-enrich
- Previously only batch enrichment (Admin cascade) used the two-level model; now all single-item enrichment paths use it too

### Norfolk AI Theme Verification
- Confirmed AppSettingsContext applies theme-norfolk-ai class to html element
- All CSS variables in .theme-norfolk-ai block use official NCG palette: Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B, Green #21B9A3, Light Gray #F5F8FA
- Theme verified as correct — no changes needed

## March 25, 2026 — Tool Health Check, CNBC, Avatar Resolution, Academic Research

### Tool Health Check Panel (Complete)
- Built `server/routers/healthCheck.router.ts` with `checkService` and `checkAll` mutations for 9 external services: Apify, Gemini, Anthropic, Replicate, YouTube, Twitter/X, Tavily, Perplexity, Google Imagen
- Built `client/src/components/admin/ToolHealthCheckTab.tsx` with service cards, status dots (green/yellow/red), latency badges, last-checked timestamps, per-service Re-check button, "Run All Checks" button, summary bar, status legend
- Wired into Admin Console as "Health" tab (Activity icon)
- 22 new tests in healthCheck.test.ts
- Checkpoint: `c2961606`

### CNBC RapidAPI Integration (Partial — Blocked on Subscription)
- Rewrote `server/enrichment/rapidapi.ts` with improved multi-feed CNBC search
- Removed Seeking Alpha (user cancelled)
- CNBC API requires RapidAPI subscription (currently 403 — not subscribed)
- Strategy: fetch from 6 CNBC franchise feeds in parallel, filter by author name in `relatedTagsFilteredFormatted` and `authorFormatted`
- Added `enrichBusinessProfile` and `enrichBusinessProfileBatch` procedures
- UI and tests still pending (#CNBC7-10)

### Connector Audit & Enrichment Recommendations
- Audited 46 connectors from user's screenshots (Airtable, Apify, Apollo.io, Clay, Cloudflare, etc.)
- Recommended 6 connectors + Context7 for enrichment value:
  1. Consensus → Academic research papers (implemented via OpenAlex)
  2. Similarweb → Web traffic (CANCELLED by user)
  3. Quartr → Earnings call transcripts
  4. Apollo.io → Professional profiles
  5. Notion → Bidirectional reading notes sync
  6. Google Drive → Document archive
  7. Context7 → Technical book references
- Added 57 new todo items across 7 features

### Three.js Integration (Complete)
- Installed @react-three/fiber + @react-three/drei
- Built `client/src/components/FloatingBooks.tsx` — 3D floating book shapes as background for hero stat section
- Wired into Home.tsx hero area

### Aaron Ross Pipeline Test (Complete)
- Ran meticulous pipeline end-to-end on Aaron Ross
- All 3 sources hit (Wikipedia, Tavily, Apify) — 5 photos found
- Gemini Vision: 2/5 photos inlined as base64 multimodal parts
- Description: Male, late 40s-50s, oval face, dark brown hair with graying, hazel eyes, rectangular glasses
- Disambiguation issue: Wikipedia bio returns football player Aaron Ross (known limitation)
- Best reference photo: meetime-blog headshot

### Avatar Resolution Controls (Complete)
- Extended `types.ts` with `AspectRatio` (9 ratios) and `OutputFormat` (png/jpeg/webp) types
- Extended `ImageGenerationRequest` with: aspectRatio, width, height, outputFormat, outputQuality, guidanceScale, numInferenceSteps
- Extended `MeticulousPipelineOptions` with same fields
- Updated `replicate.ts` with `validateDimension` helper (64px alignment) and full resolution param passthrough
- Updated `google.ts` with `mapToImagen3AspectRatio` helper for unsupported ratio mapping
- Updated `meticulousPipeline.ts` to pass resolution options through (removed hardcoded values)
- Added resolution fields to `AppSettings` with sensible defaults (1:1, 1024x1024, png, 90%, 7.5 guidance, 28 steps)
- Built Avatar Resolution Controls card in AiTab with sliders for all params
- 11 new tests in avatarResolution.test.ts

### Academic Research / Consensus Integration (Complete)
- Built `server/enrichment/academicResearch.ts` using OpenAlex (primary, free, no key) + Semantic Scholar (fallback)
- OpenAlex: author search → h-index, citation count, works count, top papers, book-related papers
- Semantic Scholar: rate-limited on sandbox IPs (429) but works as production fallback
- Added `academicResearchJson` + `academicResearchEnrichedAt` columns to author_profiles schema
- Built 3 procedures: enrichAcademicResearch, enrichAcademicResearchBatch, getAcademicResearch
- Built `client/src/components/AcademicResearchPanel.tsx` — h-index badge, citation count, top papers with DOI links, book-related papers section, admin "Enrich" button
- Wired into AuthorDetail.tsx
- 17 new tests in academicResearch.test.ts

### Similarweb — CANCELLED
- User opted out of Similarweb integration
- Removed `server/enrichment/webTraffic.ts` and `scripts/fetch-similarweb.py`
- Marked all #SW items as cancelled in todo.md

### Stale Items Resolved
- Marked 6 items as already-done duplicates (Avatar Terminology, Claude routing, authorDescriptionJson UI, Claude model ID, Gemini multimodal, nano-banana default)

### Test Suite Status
- 267 tests passing across 20 test files (up from 239)
- New: avatarResolution.test.ts (11), academicResearch.test.ts (17)

### Checkpoints
- `c2961606` — Health Check panel complete
- `4fd31ca3` — First 10 todo items (Three.js, Aaron Ross test, stale items)
- `80c19dbe` — Avatar Resolution Controls + Academic Research + Similarweb cancelled

### Files Changed
- `server/routers/healthCheck.router.ts` (new)
- `client/src/components/admin/ToolHealthCheckTab.tsx` (new)
- `client/src/components/FloatingBooks.tsx` (new)
- `client/src/components/AcademicResearchPanel.tsx` (new)
- `server/enrichment/academicResearch.ts` (new)
- `server/enrichment/rapidapi.ts` (rewritten)
- `server/lib/authorAvatars/types.ts` (extended)
- `server/lib/authorAvatars/imageGenerators/replicate.ts` (updated)
- `server/lib/authorAvatars/imageGenerators/google.ts` (updated)
- `server/lib/authorAvatars/meticulousPipeline.ts` (updated)
- `client/src/contexts/AppSettingsContext.tsx` (extended)
- `client/src/components/admin/AiTab.tsx` (extended)
- `client/src/pages/AuthorDetail.tsx` (extended)
- `client/src/pages/Home.tsx` (FloatingBooks wired)
- `client/src/pages/Admin.tsx` (Health tab wired)
- `drizzle/schema.ts` (academicResearchJson columns)
- `server/routers/authorProfiles.router.ts` (academic + business procedures)
- `todo.md` (57 new items, 10+ marked complete)

---

## March 28, 2026 — Codebase Audit & Optimization

**Goal:** Audit and optimize the full codebase — identify large files, remove dead code, split modules, and update documentation.

### Dead Code Removed
- `client/src/components/AIChatBox.tsx` — template component, not used in this project
- `client/src/components/DashboardLayout.tsx` — template component, not used (custom sidebar layout)
- `client/src/components/DashboardLayoutSkeleton.tsx` — template component, not used
- `client/src/components/Map.tsx` — template component, not used
- `client/src/pages/ComponentShowcase.tsx` — template showcase page, not used
- `client/src/contexts/ThemeContext.tsx` — fully superseded by `AppSettingsContext.tsx`

### File Splits
- **`server/lib/llmCatalogue.ts`** (new, ~899 lines) — extracted vendor catalogue data, types, and recommendation engine from `llm.router.ts`. The router is now ~133 lines (down from ~1006).
- **`client/src/lib/libraryConstants.ts`** (new, ~131 lines) — extracted static constants (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS, LIBRARY_STATS, CATEGORIES, types) from `libraryData.ts`. `libraryData.ts` re-exports them for backward compatibility.

### Documentation Updated
- `claude.md` / `manus.md` — full rewrite with accurate line counts, corrected file paths (removed BookModal.tsx, ThemeContext.tsx), added new files (libraryConstants.ts, llmCatalogue.ts, AuthorCard.tsx, AuthorBioPanel.tsx, BookDetailPanel.tsx, AuthorCardActions.tsx), updated test count (27 files, 439 tests), added Design Rule 14 (AppSettingsContext is the theme authority)
- `skills/llm-recommendation-engine/SKILL.md` — updated Key Files section to point to `server/lib/llmCatalogue.ts`
- `skills/library-content-enrichment/SKILL.md` — updated stale `authorProfiles.router.ts` reference to `authorSocial.router.ts`
- `skills/webdev-card-system/SKILL.md` — added note that BookModal.tsx was replaced by BookDetailPanel.tsx in this project

### Verification
- TypeScript: 0 errors
- Tests: 439 passing across 30 test files
- Server: healthy (API endpoints responding)


---

## March 28, 2026 - Codebase Audit and Optimization

**Goal:** Audit and optimize the full codebase -- identify large files, remove dead code, split modules, and update documentation.

### Dead Code Removed
- client/src/components/AIChatBox.tsx -- template component, not used in this project
- client/src/components/DashboardLayout.tsx -- template component, not used (custom sidebar layout)
- client/src/components/DashboardLayoutSkeleton.tsx -- template component, not used
- client/src/components/Map.tsx -- template component, not used
- client/src/pages/ComponentShowcase.tsx -- template showcase page, not used
- client/src/contexts/ThemeContext.tsx -- fully superseded by AppSettingsContext.tsx

### File Splits
- server/lib/llmCatalogue.ts (new, ~899 lines) -- extracted vendor catalogue data, types, and recommendation engine from llm.router.ts. The router is now ~133 lines (down from ~1006).
- client/src/lib/libraryConstants.ts (new, ~131 lines) -- extracted static constants (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS, LIBRARY_STATS, CATEGORIES, types) from libraryData.ts. libraryData.ts re-exports them for backward compatibility.

### Documentation Updated
- claude.md / manus.md -- full rewrite with accurate line counts, corrected file paths, added new files, updated test count (27 files, 439 tests), added Design Rule 14 (AppSettingsContext is the theme authority)
- skills/llm-recommendation-engine/SKILL.md -- updated Key Files section to point to server/lib/llmCatalogue.ts
- skills/library-content-enrichment/SKILL.md -- updated stale authorProfiles.router.ts reference to authorSocial.router.ts
- skills/webdev-card-system/SKILL.md -- added note that BookModal.tsx was replaced by BookDetailPanel.tsx

### Verification
- TypeScript: 0 errors
- Tests: 439 passing across 30 test files
- Server: healthy (API endpoints responding)

---

## April 1–2, 2026 — Digital Me, Tag System, Content Items, FlowbiteAuthorCard Redesign

> **Note:** memory.md was not updated after March 28. The following entries are reconstructed from git history (commits `f86b9ff` through `4a3f131`) as part of the April 18 documentation audit.

### Digital Me RAG Pipeline (Complete)
- Built `server/routers/ragPipeline.router.ts` — Claude Opus generates 1,977-word persona files per author
- Generated Digital Me profiles for Adam Grant, Simon Sinek, James Clear, Brené Brown, Malcolm Gladwell, Daniel Kahneman, Cal Newport, Chris Voss, Seth Godin, Morgan Housel (10 authors total)
- RAG files stored in `author_rag_profiles` DB table with `ragFileUrl`, `ragFileKey`, `ragVersion`, `ragWordCount`, `ragModel`, `ragStatus`
- "Chat with Author" page (`/chat/:slug`) wired to RAG-grounded chatbot (`authorChatbot.router.ts`)
- "Generate Digital Me" trigger button added to AuthorDetail page with polling
- Checkpoint: `f86b9ff`

### User Interests + Interest Alignment (Complete)
- Seeded 8 default personal interests: Behavioral Economics, Leadership Psychology, Organizational Culture, Neuroscience, Innovation, Human Performance, Communication, Systems Thinking
- `user_interests` and `author_interest_scores` tables created
- 32 interest alignment scores computed and stored
- `InterestAlignmentPills` and `WhyThisAuthor` components added to author cards
- Interest Heatmap (`/interests/heatmap`) and Group Contrast (`/interests/contrast`) pages added to sidebar footer
- Checkpoint: `01e3424`

### Dropbox OAuth 2 Integration (Complete)
- Implemented permanent Dropbox refresh token flow (not just static token)
- "Connect" button in Admin → Sync tab
- Dropbox connected as `ricardo@cidale.com`
- `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` env vars; refresh token stored in `app_settings` DB
- **Known issue:** Dropbox OAuth redirect URI must be `https://` — `http://` causes silent failure. Fixed in commit `20d8045`.
- Checkpoint: `a982db3`

### AI Model Config Tab (Complete)
- 8 vendors, 35 models, primary/secondary toggle
- Seeded Google/Gemini 2.5 Pro as primary
- Checkpoint: `a982db3`

### Tag System (Complete)
- Tags CRUD with rename cascade (slug changes propagate to all `tagsJson` arrays in author_profiles and book_profiles)
- `InlineTagSelector` added to `AuthorFormDialog` and `BookFormDialog`
- `TagPicker` wired into `AuthorBioPanel` and `BookDetailPanel` headers
- `TagGroupHeader` component for card grid when sorted by tag
- `TagTaxonomyMatrix` admin view (tags × entities, clickable cells)
- `TagStatisticsCard` with recharts horizontal BarChart (top 20 tags by usage)
- Tag filter URL persistence: `?tags=slug1,slug2` in URL + localStorage sync
- `BulkTagAssignment` (authors) and `BulkTagBooksAssignment` (books) in Admin
- Checkpoint: `137e0c0`, `ef4ffb1`, `c76e0e2`, `a4bced1`

### Content Items (Complete)
- `content_items` table as universal content model (all non-book types)
- `author_content_links` M:M table
- `content_files` and `ingest_sources` tables
- Enrichment modules: TED (Apify), OpenAlex (academic papers), OMDB (film/TV), Substack
- YouTube Data API v3 enrichment procedure
- iTunes Search API podcast enrichment
- `BulkUrlImportPanel` with URL type detection in Admin → Content Items tab
- `BookMigrationPanel` — `book_profiles → content_items` migration with dry-run + progress UI
- Seeded 19 sample non-book content items (TED Talks, Podcasts, Research Papers, Articles, YouTube Videos)
- Migration executed: 139 book_profiles migrated to content_items with 139 author_content_links
- Checkpoint: `2b03fec`, `07740f4`, `8822cdca`

### Dropbox Metadata Sidecars (Complete)
- Generated `_metadata.json` sidecars for all 139 books uploaded to Dropbox
- Path: `/{author-slug}/books/{book-slug}/_metadata.json`
- Contains: title, author, publisher, ISBN, rating, summary, cover URLs, Amazon/Goodreads/Wikipedia links, format, possession status, key themes, tags
- Checkpoint: `4ad9070`

### FlowbiteAuthorCard 4-Zone Redesign (Complete)
- Avatar 96×96px, category-tinted gradient placeholder
- Glass effect: `bg-card/85 backdrop-blur-xl`
- 3D shadow action buttons: `shadow-[0_2px_0]` + hover lift + active press
- Category watermark icon: `w-16 h-16` at 3% opacity
- Book cover hover overlay: title always visible on hover
- InterestAlignmentPills left-aligned, TagPicker right-aligned
- Checkpoint: `731077f`, `0408d97`

### Code Quality Refactoring (Complete)
- `Home.tsx` split: `AuthorsTabContent` + `BooksTabContent` extracted (969L → 734L)
- `Admin.tsx` split: 15 focused wrapper tab components (643L → 447L)
- `bookProfiles.router.ts` CRUD extracted into `bookCrud.router.ts` (52L)
- `claude.md` and `manus.md` updated
- Checkpoint: `e4e05ec`

### Admin Console Redesign (Complete)
- Flat 15-tab row replaced with 2-level sidebar navigation (6 groups: Content, Media, Intelligence, Personalization, System, Configuration)
- All icons replaced with Phosphor Icons (duotone weight for section headers, fill for active nav items)
- Action cards: 2-column grid layout
- tRPC client fixed with `splitLink + maxURLLength:8192` to handle both large queries and mutations
- Checkpoint: `076a0c7`

### HTTP 414 Bug — Multiple Attempts (Resolved)
- **Root cause:** `libraryData.ts` was being sent as a tRPC query parameter, exceeding URL length limits
- **Attempt 1:** Switched to `httpBatchStreamLink` with POST override — failed (stream link incompatible with Express adapter)
- **Attempt 2:** Reverted to `httpBatchLink` with `methodOverride: 'POST'`
- **Attempt 3 (final):** `splitLink + maxURLLength:8192` — correctly routes large queries to POST, small queries to GET
- Checkpoints: `a55e2a6`, `255b484`, `076a0c7`, `cb4f46b`

### Privacy Policy Page (Complete)
- `/privacy` route with full legal content
- Privacy Policy link in sidebar footer
- Checkpoint: `20d8045`

### Google Drive Access Token (Known Limitation)
- Google Drive access token added as secret — **expires hourly**
- Use `rclone` for sandbox Drive sync, not the token directly
- Checkpoint: `8822cdca`

### Sync / Storage (Complete)
- Stream-based S3→Dropbox (Upload Session API, 50MB chunks)
- `_metadata.json` sidecar generation per book folder
- Google Drive sync (resumable upload, `gws` CLI auth bridge)
- `SyncJobsTab` UI updated with Drive status card + Generate Sidecars button
- `syncEngine.test.ts` (31 tests)
- Checkpoint: `8bf3e7e`

---

## April 18, 2026 — Documentation Audit (This Session)

### Nightly Cron Run
- Nightly `batch-scrape-covers.mjs` cron triggered at 2am CDT
- **Execution method:** Script cannot run in sandbox (no access to `DATABASE_URL`, `APIFY_API_TOKEN`, `BUILT_IN_FORGE_API_KEY` — these are injected only into the live Manus deployment)
- Executed via live app's tRPC API at `https://authlib-ehsrgokn.manus.space`
- **Result:** 0 books needed scraping, 0 needed S3 mirror — library fully up to date (135 books, 134 with S3 covers)

### Replit Migration Investigation
- User asked why `batch-scrape-covers.mjs` is in `authors-books-library` (Manus) and not in the NAI Books App (Replit)
- **Finding:** The Replit repo (`authors-books-library-replit`) was created March 19, 2026 — two days after the batch script was written (March 17). The script was never ported to Replit.
- **Key difference:** The Manus version uses `BUILT_IN_FORGE_API_KEY` for S3 mirroring; the Replit version uses `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (Replit Object Storage) — the script cannot be copied directly.
- **Current status:** `authors-books-library` (Manus) is the active production deployment (last commit April 2, 2026). The Replit version appears to be an exploratory migration, not yet production.
- **Decision pending:** User has not yet decided whether to port to Replit or keep on Manus.

### Documentation Audit Findings — Dropped Instructions & Forgotten Rules
The following instructions were given by the user but were not captured in `claude.md` or `memory.md` and were subsequently forgotten by the agent:

1. **`memory.md` was not updated after March 28.** The mandatory rule ("append a dated entry at the end of every completed task") was violated for all April 1–2 sessions. This is the most systemic failure.

2. **`manus.md` was not kept in sync with `claude.md` after March 28.** The rule states both files must be updated simultaneously. `manus.md` is stale by ~2 weeks.

3. **Google Drive access token expiry.** The token expires hourly. The agent repeatedly attempted to use it in sandbox scripts without checking expiry. Rule: always use `rclone` for Drive sync from the sandbox, never the raw token.

4. **Nightly cron script cannot run in sandbox.** The agent spent significant time attempting to run `batch-scrape-covers.mjs` locally before discovering that `DATABASE_URL`, `APIFY_API_TOKEN`, and `BUILT_IN_FORGE_API_KEY` are only available in the live Manus deployment. Rule: for scheduled scripts, always invoke via the live app's tRPC API, not directly in the sandbox.

5. **Replit repo exists but is not the active deployment.** The agent was unaware of the Replit repo until the user asked. Rule: the Manus deployment (`authlib-ehsrgokn.manus.space`) is production; the Replit repo is exploratory only.

6. **`manus.md` is a copy of `claude.md`.** The agent has sometimes treated them as separate documents. They must be kept byte-for-byte identical except for the header.

7. **Flowbite was removed from the project.** `FlowbiteAuthorCard` retains its name for historical reasons but no longer imports from `flowbite-react`. The agent has occasionally attempted to add Flowbite components. Rule: use shadcn/ui Dialog for modals; do not add `flowbite-react` imports.

8. **`oxc-parser` native binding issue.** `flowbite-react@0.12.17` introduced an `oxc-parser` native binding that breaks Manus deployment builds. The project is pinned to `flowbite-react@0.12.16` via pnpm override. Do not upgrade `flowbite-react` without testing the build.

9. **`ThemeContext.tsx` was deleted.** It was superseded by `AppSettingsContext.tsx`. The agent has occasionally referenced `useTheme()` from the deleted context. Rule: always use `useAppSettings()` or `useThemeCompat()`.

10. **`BookModal.tsx` is a deprecated shim.** It was replaced by `BookDetailPanel.tsx`. The shim was deleted in March 2026. Do not reference or recreate `BookModal.tsx`.

11. **Seeking Alpha integration was cancelled.** The user cancelled the Seeking Alpha/Bloomberg enrichment. `rapidapi.ts` now uses Yahoo Finance only.

12. **Similarweb integration was cancelled.** The user explicitly opted out. All `#SW` todo items are cancelled.

13. **CNBC RapidAPI requires a paid subscription.** The integration was built but is blocked at 403. Do not attempt to use CNBC API without confirming the user has subscribed.

14. **Twitter API requires developer account approval.** The integration exists but is rate-limited/blocked on free tier. Do not run Twitter enrichment in batch without confirming API access.

15. **`fix-alan-dib-covers.mjs` is a one-off migration already applied (March 22, 2026).** Do not re-run it.

16. **`scripts/` directory in Replit repo is a stub.** It contains only `hello.ts`. Do not assume the Replit version has the same scripts as the Manus version.

17. **`R3F Canvas blocks card interactions.** `FloatingBooks` (Three.js/React Three Fiber) was found to block pointer events on cards below it. Fixed by adding `style={{ pointerEvents: 'none' }}` to the Canvas. If Three.js is re-added anywhere, always set `pointerEvents: 'none'` on the Canvas.

18. **`confetti` dependency was removed.** `useConfetti.ts` is now a no-op stub. Do not attempt to use the confetti library.

19. **`em-dash` bug in `libraryData.ts`.** 15 author entries used Unicode em-dash (`–`) instead of regular hyphen (`-`), causing the co-author split regex to create fake author cards. Fixed in `9b72e12`. Rule: always use regular hyphen in author names; validate with `isLikelyAuthorName()` before writing to DB.

20. **`parallelBatch` is generic.** It was made generic over `TInput` in March 2026. Do not use sequential `for` loops for batch enrichment — use `parallelBatch(concurrency=2)`.

21. **`pnpm db:push` not `pnpm migrate`.** The project uses Drizzle Kit's `db:push` command, not a separate migration runner. Always use `pnpm db:push` after schema changes.

22. **`slugify` was improved** to lowercase+hyphens (April 2, 2026). All new slug generation uses this. Do not use custom slug logic.

23. **`content_items` is the universal content model.** Books have been migrated from `book_profiles` to `content_items` (April 2, 2026). `book_profiles` still exists for backward compatibility but new content should use `content_items` + `author_content_links`.

### Test Count as of April 2, 2026
- **568 tests passing** across **34+ test files** (up from 492 at end of March)

---
