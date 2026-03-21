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
- Built 5-tier author photo waterfall in `server/lib/authorPhotos/waterfall.ts`:
  1. Amazon author page scrape (Apify)
  2. Wikipedia API photo
  3. Tavily image search
  4. Gemini vision validation
  5. Replicate AI portrait generation (fallback)
- Created `authorPhotos.ts` static map and `authorAliases.ts` for name normalisation.
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
  - **Media**: Browse and manage author photos and book covers stored in S3.
  - **Research Cascade**: Stats on enrichment sources (Wikipedia hits, Amazon hits, LLM fallbacks, etc.).
- Added nightly cron job for cover scraping.
- Added LLM model selector (13 Gemini models) in Preferences.

### Data & Infrastructure (Sessions 15–20)
- Database schema: `author_profiles`, `book_profiles`, `users` tables in MySQL/TiDB.
- All media (author photos, book covers) mirrored to Manus S3 CDN via `storagePut()`.
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
- **authorPhotos.ts**: Removed all combined-name photo entries (group shots). Each primary co-author now has their own individual entry pointing to the same CDN URL. Secondary co-authors (Jason Lemkin, William Ury, Chip Heath, etc.) will use the DB waterfall for individual portraits.
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
- `authorAliases.ts` and `authorPhotos.ts` updated to map individual co-authors

**TypeScript Fixes:**
- Fixed TS2554 in `SettingsTab.tsx` (listModels.useQuery now requires vendorId)
- 0 TypeScript errors, 122 tests passing

### Files Changed
- `client/src/index.css` — Manus theme + Norfolk AI theme CSS variables
- `client/src/components/admin/SettingsTab.tsx` — Full rewrite with 3-column AI Model card
- `client/src/contexts/AppSettingsContext.tsx` — Added primaryVendor/Model, secondaryLlm* fields
- `server/routers/llm.router.ts` — Full vendor catalogue, listVendors, refreshVendors
- `claude.md` — Updated design system, theme tables, admin tab 4 description
