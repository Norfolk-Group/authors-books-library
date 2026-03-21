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
