# Ricardo Cidale's Authors & Books Library

## Standing Rules

**Last Updated:** March 21, 2026 — Session 2 (Secondary LLM wired into enrichment pipeline; N+1 queries fixed with batch pre-fetch; shared httpClient.ts created; waterfall.ts optimized with per-tier timeouts; apify.ts optimized with retry logic; mirrorToS3.ts dedup check fixed; 10 codebase optimization items completed)

> **MANDATORY:** At the end of every completed task, update this file (`claude.md`) to reflect any new features, architectural changes, component additions, data schema changes, or workflow changes made during that session. Also append a dated entry to `memory.md` summarising what was done. These two files are the source of truth for the project state.

---

## Project Identity

**Name:** authors-books-library
**Path:** `/home/ubuntu/authors-books-library`
**Stack:** React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB
**Deployed:** `authlib-ehsrgokn.manus.space`
**Owner:** Ricardo Cidale / Norfolk AI (NCG)

This is a personal knowledge library application that catalogues business books and authors from a curated Google Drive folder structure. The app scans Drive folders, enriches content with metadata from external APIs, and presents it through a Swiss Modernist UI with three switchable themes.

---

## Architecture Overview

```
client/                          → React 19 SPA (Vite)
  src/
    pages/
      Home.tsx                   → Main library UI orchestrator (~687 lines)
      Admin.tsx                  → Admin Console orchestrator (~857 lines)
    components/
      library/                   → Extracted library card/panel components
        AuthorCard.tsx           → Single author card with avatar + expand/contract hover
        BookCard.tsx             → Single book card with cover thumbnail
        AudioCard.tsx            → Single audio book card
        AuthorBioPanel.tsx       → Author bio dialog (photo, bio, links, book list)
        BookDetailPanel.tsx      → Book detail dialog (cover, summary, themes, links)
        LibraryPrimitives.tsx    → ContentTypeBadge, BookSubfolderRow, StatCard, EmptyState
        libraryConstants.ts      → Shared icon maps, format labels, display name maps
      admin/                     → Extracted admin tab components
        CascadeTab.tsx           → Research cascade stats display
        SettingsTab.tsx          → App settings (icon set, LLM model)
        AboutTab.tsx             → App info and version
        ActionCard.tsx           → Reusable action card with progress
        adminTypes.ts            → Shared admin types
      FlowbiteAuthorCard.tsx     → Flowbite-styled author card (grid view)
      AuthorAccordionRow.tsx     → Accordion list row for author
      AuthorModal.tsx            → Author detail modal (Flowbite)
      BookModal.tsx              → Book detail modal (Flowbite)
      BackToTop.tsx              → Floating back-to-top button
      CoverLightbox.tsx          → Full-screen book cover viewer
      AvatarCropModal.tsx        → Avatar upload + crop editor
    contexts/                    → ThemeContext, AppSettingsContext
    lib/
      libraryData.ts             → Auto-generated Drive scan data (1218 lines)
      audioData.ts               → Audio books data
      authorPhotos.ts            → Static author photo URL map
      authorAliases.ts           → Drive folder name → display name map
server/
  routers/                       → tRPC routers (feature-split)
    library.router.ts            → Google Drive scanning + TS code generation (~475 lines)
    authorProfiles.router.ts     → Author enrichment procedures (~532 lines)
    bookProfiles.router.ts       → Book enrichment procedures (~313 lines)
    apify.router.ts              → Amazon scraping + S3 mirroring (~329 lines)
    cascade.router.ts            → Research cascade stats
    admin.router.ts              → Action log tracking
    llm.router.ts                → Multi-vendor LLM catalogue (10 vendors, 40+ models), listVendors/listModels/refreshVendors/testModel
  lib/
    authorEnrichment.ts          → enrichAuthorViaWikipedia() + generateBioWithLLM() helpers
    bookEnrichment.ts            → enrichBookViaGoogleBooks() + generateBookSummaryWithLLM() helpers
    authorPhotos/                → 5-tier author photo waterfall
      waterfall.ts               → Main orchestrator
      wikipedia.ts               → Tier 1: Wikipedia REST API
      tavily.ts                  → Tier 2: Tavily image search
      geminiValidation.ts        → Tier 4: Gemini vision validation
      replicateGeneration.ts     → Tier 5: Replicate AI portrait
  apify.ts                       → Apify cheerio-scraper helpers
  mirrorToS3.ts                  → External image → S3 CDN mirror
  storage.ts                     → S3 upload/download helpers
  db.ts                          → Drizzle DB connection
drizzle/
  schema.ts                      → All table definitions
shared/
  const.ts                       → Google Drive folder IDs, auth constants
```

---

## Google Drive Folder Structure

The app reads from two root folders in Google Drive. These are the **single source of truth** for the library's content catalogue. All data originates here; the database stores only enrichment metadata (bios, covers, ratings).

### Authors Root Folder

**Drive ID:** `119tuydLrpyvavFEouf3SCq38LAD4_ln5` (stored in `shared/const.ts` as `DRIVE_AUTHORS_ROOT`)

```
Authors Root/
├── Business & Entrepreneurship/
│   ├── Adam Grant/
│   │   ├── Hidden Potential/
│   │   │   ├── PDF/
│   │   │   ├── Transcript/
│   │   │   └── Audio MP3/          ← excluded from book content types
│   │   ├── Think Again/
│   │   │   ├── PDF/
│   │   │   └── Summary/
│   │   └── Originals/
│   │       └── PDF/
│   ├── James Clear/
│   │   ├── Atomic Habits/
│   │   │   ├── PDF/
│   │   │   ├── Transcript/
│   │   │   └── Video/
│   │   └── ...
│   └── ...
├── Behavioral Science & Psychology/
│   ├── Daniel Kahneman/
│   │   └── Thinking Fast and Slow/
│   └── ...
├── Sales & Negotiation/
├── Leadership & Management/
├── Self-Help & Productivity/
├── Communication & Storytelling/
├── Technology & Futurism/
├── Strategy & Economics/
└── History & Biography/
```

**Hierarchy:** `Category → Author → Book → Content-Type → Files`

The scanner (`library.router.ts`) handles two folder layouts:

1. **Standard layout:** Author folder contains book subfolders, each containing content-type subfolders (PDF, Transcript, Video, etc.).
2. **Collapsed layout:** Author folder contains content-type subfolders directly (no book subfolder). The scanner treats the author folder itself as a single book entry.

**Content-type normalization** maps raw folder names to canonical types:

| Raw Folder Name | Normalized Type |
|---|---|
| `Book PDF`, `PDF Extra`, `Bonus PDF` | PDF |
| `Transcript Doc`, `Transcript PDF`, `Book Doc` | Transcript |
| `DOC` | DOC |
| `Images`, `Image` | Images |
| `Video` | Video |
| `Summary` | Summary |
| `Papers`, `Research Papers` | Papers |
| `Articles`, `Article` | Articles |

Audio folders (`Audio MP3`, `Audible`, `M4B`, etc.) are **excluded** from content-type counts.

### Books Audio Root Folder

**Drive ID:** `1VRHbFqZFWHRhNJYiRlJCnKFBvGUdRBFM` (stored in `library.router.ts` as `BOOKS_AUDIO_ROOT`)

```
Books Audio Root/
├── Atomic Habits - James Clear/
│   ├── MP3/
│   │   └── (audio files)
│   └── M4B/
│       └── (audio files)
├── Think Again - Adam Grant/
│   └── MP3/
└── ...
```

**Hierarchy:** `Book Folder ("Title - Author") → Format Folder (MP3/M4B) → Audio Files`

### Media Folders (Enrichment Assets)

These folders store mirrored copies of enrichment media for long-term archival:

| Folder | Drive ID | Purpose |
|---|---|---|
| Author Pictures | `1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH` | Author headshot photos |
| Book Covers | `1qzmgRdCQr98fxVs6Bvnqi3J-tS574GY1` | Book cover images |

These IDs are stored in `shared/const.ts` as `DRIVE_AUTHOR_PICTURES_FOLDER_ID` and `DRIVE_BOOK_COVERS_FOLDER_ID`.

---

## Data Storage Strategy

Data lives in **two locations** with distinct purposes:

### Google Drive (Source of Truth for Content)

All original book files (PDFs, transcripts, videos, audio) live in Google Drive. The app never copies these files; it only reads the folder structure to build the catalogue. Drive folder IDs are stored in the database and used to generate direct links (`https://drive.google.com/drive/folders/{id}`).

**What lives in Drive:**
- All book content files (PDFs, transcripts, summaries, videos, images)
- All audiobook files (MP3, M4B)
- Archival copies of author headshots and book covers (in the Media folders)
- The folder hierarchy that defines categories, authors, and books

### MySQL/TiDB Database (Enrichment Metadata)

The database stores enrichment data that accelerates the app UI. It does **not** store any file content.

**Tables:**

| Table | Purpose | Key Columns |
|---|---|---|
| `user` | Manus OAuth users | `id`, `name`, `email`, `role` (admin/user), `avatarUrl` |
| `author_profiles` | Author enrichment | `authorName`, `bio`, `photoUrl`, `s3PhotoUrl`, `photoSource`, `websiteUrl`, `twitterUrl`, `linkedinUrl` |
| `book_profiles` | Book enrichment | `bookTitle`, `authorName`, `summary`, `keyThemes`, `rating`, `ratingCount`, `coverImageUrl`, `s3CoverUrl`, `amazonUrl`, `isbn`, `publisher` |
| `sync_status` | Background job tracking | `jobType`, `status`, `progress`, `totalItems`, `processedItems` |
| `admin_action_log` | Admin action audit trail | `actionKey`, `lastRunAt`, `lastRunDurationMs`, `lastRunResult` |

### Manus S3 CDN (Stable Media URLs)

External image URLs (from Amazon, Wikipedia, publisher CDNs) are unreliable: they can be blocked, changed, or deleted. The app mirrors all images to Manus S3 for stable CDN delivery.

**S3 key prefixes:**
- `author-photos/` — Author headshot images
- `ai-author-photos/` — AI-generated portraits (Replicate Flux)
- `book-covers/` — Book cover images

**Helper:** `server/mirrorToS3.ts` provides `mirrorImageToS3()` and `mirrorBatchToS3()` functions that fetch an external URL, upload to S3 via `storagePut()`, and return a stable CDN URL.

### Static Client-Side Maps

For instant rendering without DB round-trips, some data is baked into TypeScript files:

| File | Content |
|---|---|
| `client/src/lib/libraryData.ts` | Auto-generated from Drive scan: all authors, books, categories, content types |
| `client/src/lib/audioData.ts` | Auto-generated from Drive scan: all audiobooks with format info |
| `client/src/lib/authorPhotos.ts` | `Record<string, string>` mapping author names to S3 CDN photo URLs |
| `client/src/lib/authorAliases.ts` | Name normalization: Drive folder variants → canonical display names |
| `client/src/lib/authorBios.json` | Pre-fetched author bios for instant display |

These files are regenerated by the "Regenerate DB" action in the Admin Console, which calls `library.regenerate` tRPC procedure.

---

## Enrichment Pipelines

### Book Cover & Metadata Enrichment

**The correct cascade order (Amazon-first):**

1. **Amazon Scrape (Apify)** — Primary source for book covers. The `scrapeAmazonBook()` function in `server/apify.ts` uses Apify's `cheerio-scraper` actor to search Amazon (`amazon.com/s?k={title}+{author}&i=stripbooks`), extract the cover image URL, ASIN, and product page URL. This is the preferred source because Amazon has the most comprehensive and high-quality book cover database.

2. **Google Books API** — Fallback for covers and primary source for metadata. The `enrichBookViaGoogleBooks()` function in `server/routers/bookProfiles.router.ts` queries `googleapis.com/books/v1/volumes?q={title}+inauthor:{author}` to get cover thumbnails (upgraded to `zoom=1` for higher resolution), summaries, ratings, ISBN, publisher, and published date.

3. **S3 Mirror** — After obtaining a cover URL from either source, `mirrorImageToS3()` fetches the image and uploads it to Manus S3 CDN. The stable CDN URL is stored in `s3CoverUrl`.

**Important:** Books with no cover found are marked `coverImageUrl = 'not-found'` to prevent infinite retries. Skippable titles (placeholders, author-name-equals-title) are marked `coverImageUrl = 'skipped'`.

**tRPC procedures:**
- `bookProfiles.enrichBatch` — Batch enrichment via Google Books API (max 10 per call)
- `apify.scrapeNextMissingCover` — Scrapes one book from Amazon + mirrors a batch to S3
- `bookProfiles.getMany` — Fetch enrichment data for display

### Author Photo Enrichment (5-Tier Waterfall)

The author photo pipeline is implemented in `server/lib/authorPhotos/waterfall.ts`. It tries each tier in order, stopping at the first success:

| Tier | Source | File | Cost | Speed | Best For |
|---|---|---|---|---|---|
| 1 | Wikipedia REST API | `wikipedia.ts` | Free | ~200ms | Famous authors with Wikipedia pages |
| 2 | Tavily Image Search | `tavily.ts` | ~$0.001/search | ~1-2s | Business authors on LinkedIn, publisher sites |
| 3 | Apify Web Scrape | `apify.ts` (`scrapeAuthorPhoto`) | ~$0.005/run | ~5-15s | Authors with Wikipedia infobox photos |
| 4 | Gemini Vision Validation | `geminiValidation.ts` | ~$0.001/call | ~2-3s | Validates photos from Tiers 1-3 are real headshots |
| 5 | Replicate AI Portrait | `replicateGeneration.ts` | ~$0.003/image | ~10-30s | Last resort: generates a professional headshot |

**Tier 4 (Gemini Validation)** is not a source tier; it validates images from Tiers 1-3. It sends the image to Gemini 2.5 Flash with a prompt asking whether it shows a single professional headshot (not a book cover, group photo, or logo). Photos that fail validation are rejected, and the waterfall continues to the next tier.

**Tier 5 (Replicate AI Portrait)** uses Black Forest Labs' `flux-schnell` model to generate a professional corporate headshot. The prompt is gender-aware (using name-based heuristics) and produces a 1:1 aspect ratio WebP image. AI-generated portraits are tagged with `photoSource = 'ai'` and `isAiGenerated = true`.

**After finding a photo:** The waterfall uploads it to S3 via `uploadPhotoToS3()`, storing the stable CDN URL in `s3PhotoUrl`.

**tRPC procedures:**
- `authorProfiles.enrichSingle` — Runs the full waterfall for one author
- `authorProfiles.enrichBatch` — Batch enrichment (max 20 per call)
- `authorProfiles.uploadPhoto` — Manual avatar upload (user picks a file, crops it, uploads to S3)

### Author Bio & Social Links Enrichment

The `enrichAuthorViaWikipedia()` function in `server/routers/authorProfiles.router.ts` fetches:

1. **Bio** from Wikipedia REST API (`/api/rest_v1/page/summary/{name}`) — extracts the first 2 sentences of the article extract (max 400 chars). Falls back to a search query if the direct slug fails.

2. **Social links** from Wikidata — uses the `wikibase_item` ID from the Wikipedia response to query Wikidata claims:
   - P856 → Official website URL
   - P2002 → Twitter/X username
   - P6634 → LinkedIn profile ID

3. **LLM fallback** — If Wikipedia returns nothing, `generateBioWithLLM()` calls the Manus LLM helper to generate a 2-sentence professional bio.

### Avatar Upload (Manual)

Users can manually upload author photos through the `AvatarUpload` component:

1. **Click** the camera overlay on any author avatar
2. **Select** an image file (JPEG, PNG, WebP, GIF; max 10 MB)
3. **Crop** using `AvatarCropModal` (powered by `react-image-crop`): circular mask, 1:1 aspect ratio, zoom slider (1x-3x)
4. **Export** as 256x256 JPEG canvas blob
5. **Upload** via `authorProfiles.uploadPhoto` tRPC mutation → base64 → S3 → CDN URL
6. **Persist** the S3 URL in `author_profiles.s3PhotoUrl`

---

## UI Components & Interaction Model

### Component Hierarchy

```
Home.tsx
├── Sidebar (shadcn/ui)
│   ├── Category filters (9 categories)
│   ├── Search input
│   ├── Sort controls
│   ├── View mode toggle (Cards / Accordion)
│   └── Theme switcher + Settings
├── Content Area
│   ├── Tab bar: Authors | Books | Books Audio
│   ├── Stat cards (4 summary stats)
│   └── Card grid / Accordion list
│       ├── FlowbiteAuthorCard (Kanban view)
│       ├── AuthorAccordionRow (List view)
│       ├── BookCard
│       └── AudioCard
├── AuthorModal (Flowbite Modal)
├── BookModal (Flowbite Modal)
├── CoverLightbox (Framer Motion overlay)
├── AvatarUpload + AvatarCropModal
└── BackToTop (floating scroll-to-top button)

Admin.tsx
├── Tabs: Data Pipeline | Media | Research Cascade | Settings | About
├── ActionCard (reusable admin action button with status)
└── Stats dashboard (Nivo charts)
```

### Card Interaction Model (3 Hotspots)

Every card (FlowbiteAuthorCard, AuthorAccordionRow) follows the same 3-hotspot interaction model:

| Hotspot | Element | Action |
|---|---|---|
| 1 | Avatar + author name | Opens `AuthorModal` (bio, social links, photo) |
| 2 | Book cover + book title | Opens `BookModal` (summary, Amazon link, content types) |
| 3 | Card surface | Opens full bio panel in parent |

Everything else (category chip, badges, resource pills, watermark icon) is **purely presentational** — `cursor-default`, no `onClick`.

### Key UI Components

| Component | Library | Purpose |
|---|---|---|
| `FlowbiteAuthorCard` | Flowbite React `Card` | Author card with 3D tilt, avatar, book list, category chip |
| `AuthorAccordionRow` | Framer Motion | Compact accordion row with expand/collapse animation |
| `AuthorModal` | Flowbite React `Modal` | Author bio dialog with photo, social links, enrichment actions |
| `BookModal` | Flowbite React `Modal` | Book detail dialog with cover, summary, Amazon/Goodreads links |
| `CoverLightbox` | Framer Motion | Full-screen book cover overlay with backdrop blur |
| `AvatarUpload` | Custom + `react-image-crop` | Camera overlay → file picker → crop modal → S3 upload |
| `AvatarCropModal` | `react-image-crop` | Circular crop mask, zoom slider, 256x256 export |
| `BackToTop` | Framer Motion | Floating arrow-up button, appears after 300px scroll, 3D shadow style |
| `StatCard` | Custom | Summary stat with icon, value, label; 3D tilt on hover |

### Animations & Micro-interactions

| Effect | Library | CSS Class | Description |
|---|---|---|---|
| 3D card tilt | Framer Motion | `.stat-card-3d`, `.book-card-tilt` | `useMotionValue` + `useSpring` for perspective rotation on mouse move |
| Book cover 3D | CSS | `.book-cover-3d` | `perspective(500px) rotateY(-8deg)` on hover |
| Author avatar 3D | CSS | `.author-avatar-3d` | `perspective(400px) rotateY(10deg)` on hover |
| Progress shimmer | CSS | `.progress-shimmer` | Animated gradient background on progress bars |
| Sparkle spin | CSS | `.sparkle-spin` | Rotating sparkle icon (2.5s linear infinite) |
| Accordion expand | Framer Motion | `AnimatePresence` | Smooth height animation for accordion rows |
| Cover lightbox | Framer Motion | `motion.div` | Fade-in backdrop + scale-up cover image |

### shadcn/ui Components Used

The project uses these shadcn/ui components from `client/src/components/ui/`:

`accordion`, `alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `empty`, `hover-card`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner` (toasts), `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`

### Flowbite React Components Used

| Component | Import | Usage |
|---|---|---|
| `Card` | `flowbite-react` | Author cards in Kanban view |
| `Modal`, `ModalBody`, `ModalHeader` | `flowbite-react` | Author and Book detail dialogs |

### Icon Libraries

| Library | Usage | Import |
|---|---|---|
| Lucide React | Primary icons throughout the app | `lucide-react` |
| Phosphor Icons | Avatar upload camera, page header nav, icon set system | `@phosphor-icons/react` |

The app supports two icon sets (configurable in Settings): **Phosphor Regular** and **Phosphor Duotone**. Icon sets are defined in `client/src/lib/iconSets/`.

---

## Design System: Themes, Fonts & Colors

### Typography

| Role | Font Family | Weight | Usage |
|---|---|---|---|
| Display / Headings | IBM Plex Sans | 400, 500, 600 | Page titles, card headings, stat labels |
| Body / UI | Inter | 400, 500, 600 | All body text, form labels, buttons |
| Monospace | JetBrains Mono | 400, 600 | Code snippets, technical values |

Fonts are loaded from Google Fonts CDN in `client/index.html`. The CSS custom properties are:
- `--font-sans: 'Inter', sans-serif`
- `--font-display: 'IBM Plex Sans', sans-serif`
- `--font-mono: 'JetBrains Mono', monospace`

### Theme System

The app has three named themes managed by `AppSettingsContext`:

| Theme | Class | Style | Sidebar | Cards |
|---|---|---|---|---|
| **Manus** (default/seed) | `.theme-manus` | Black / white / grey — clean default | `#E4E4E4` light grey | `#FFFFFF` white bg |
| **Norfolk AI** | `.theme-norfolk-ai` | Official NCG palette — navy + yellow | `#112548` navy | `#FFFFFF` white bg |
| **Noir Dark** | `.theme-noir-dark` | Executive monochrome — pure B&W | White bg, black text | White bg, 1px dark border |

**Design System Rule — Manus as Seed:** The Manus theme is the living default. Always update it first when making design changes. Other themes branch from Manus and override only their brand-specific tokens.

Theme switching is controlled by `AppSettingsProvider` in `client/src/contexts/AppSettingsContext.tsx`. Settings are persisted to `localStorage` under key `app-settings-v2`.

### Manus Theme (Black / White / Grey)

| Token | Value | Hex | Usage |
|---|---|---|---|
| `--background` | `0 0% 95%` | `#F2F2F2` | Light grey page background |
| `--foreground` | `0 0% 7%` | `#111111` | Near-black text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Pure white cards |
| `--primary` | `0 0% 7%` | `#111111` | Black CTAs, active states |
| `--border` | `0 0% 83%` | `#D4D4D4` | Subtle grey dividers |
| `--muted-foreground` | `0 0% 42%` | `#6B6B6B` | Secondary labels |
| `--sidebar` | `0 0% 89%` | `#E4E4E4` | Slightly darker than background |

### Norfolk AI Theme (Official Palette)

| Token | Hex | Name |
|---|---|---|
| Yellow/Gold | `#FDB817` | Primary accent, CTAs |
| Navy | `#112548` | Dark navy, headings, sidebar |
| Orange | `#F4795B` | Warm accent |
| Teal 1 | `#0091AE` | Font color, focus rings, avatar bg default |
| Teal 2 | `#00A9B8` | Help pages |
| Green | `#21B9A3` | Selected items |
| White | `#FFFFFF` | Background |
| Light Gray | `#F5F8FA` | Surface |
| Gray | `#CCD6E2` | Inactive |
| Dark Gray | `#34475B` | Body text |
| Green alt | `#6A9E56` | Secondary green |

### Color Palette (Manus Theme — Default / Seed)

See Manus Theme table above. The Manus theme uses pure black/white/grey with no brand colors.

### NCG Brand Tokens (OKLCH)

These are available as direct CSS custom properties for brand-specific usage:

| Token | OKLCH | Hex | Name |
|---|---|---|---|
| `--color-ncg-navy` | `oklch(0.22 0.07 255)` | `#112548` | Navy |
| `--color-ncg-yellow` | `oklch(0.87 0.17 85)` | `#FDB817` | Yellow |
| `--color-ncg-orange` | `oklch(0.72 0.15 30)` | `#F4795B` | Orange |
| `--color-ncg-teal` | `oklch(0.60 0.12 210)` | `#0091AE` | Teal |
| `--color-ncg-green` | `oklch(0.70 0.12 175)` | `#21B9A3` | Green |
| `--color-ncg-gray` | `oklch(0.85 0.02 240)` | `#CCD6E2` | Gray |
| `--color-ncg-light` | `oklch(0.97 0.008 240)` | `#F5F8FA` | Light |

### Category Color System

Each of the 9 knowledge categories has a distinct accent color used for sidebar active states, card border stripes, and category chips:

| Category | Color | Hex |
|---|---|---|
| Business & Entrepreneurship | Amber | `#b45309` |
| Behavioral Science & Psychology | Violet | `#7c3aed` |
| Sales & Negotiation | Sky | `#0369a1` |
| Leadership & Management | Emerald | `#065f46` |
| Self-Help & Productivity | Red | `#b91c1c` |
| Communication & Storytelling | Orange | `#c2410c` |
| Technology & Futurism | Blue | `#1d4ed8` |
| Strategy & Economics | Gray | `#374151` |
| History & Biography | Brown | `#92400e` |

**Noir Dark theme override:** All category colors are suppressed. Cards use monochrome borders (`hsl(0 0% 18%)`), category chips use grey backgrounds, and the sidebar uses black active pills.

### Noir Dark Theme Specifics

The Noir Dark theme applies extensive component-level CSS overrides (in `index.css` lines 827-900+):

- **Cards:** White bg, 1px dark border, no left-color stripe
- **Stat cards:** Crisp dark border, no shadow
- **Buttons:** Outline = white + black border; solid = black fill + white text
- **Progress bars:** Black fill
- **Search highlights:** Grey tint instead of colored
- **Watermark icons:** Grey instead of category color
- **Modals:** Dark border, white bg
- **Category pills:** Black active, grey inactive

---

## Admin Console

The Admin Console (`/admin`, lazy-loaded) has 5 tabs:

### Tab 1: Data Pipeline
- **Regenerate DB** — Scans Google Drive, rebuilds `libraryData.ts` and `audioData.ts`
- **Enrich Author Bios** — Batch Wikipedia/Wikidata enrichment
- **Enrich Book Metadata** — Batch Google Books API enrichment

### Tab 2: Media
- **Generate Portraits** — Runs the 5-tier waterfall for authors missing photos
- **Scrape Covers** — Amazon scraping via Apify for books missing covers
- **Mirror to S3** — Uploads external images to Manus CDN

### Tab 3: Research Cascade
- Live stats dashboard showing enrichment coverage (photos, bios, covers, summaries)
- Per-tier breakdown (Wikipedia, Tavily, Apify, AI)

### Tab 4: Settings
- **Theme selector** — Manus (default) | Norfolk AI | Noir Dark, with mini palette preview swatches
- **Avatar Background Color** — Norfolk AI palette swatches (11 colors, seed: #0091AE darker teal) + custom color picker with live preview
- **AI Model** — 3-column layout:
  - Column 1: Primary LLM — vendor dropdown (10 vendors) → model radio list with Test button per model
  - Column 2: Secondary LLM — enable/disable toggle + vendor/model selectors (used for research parallel processing)
  - Column 3: Active configuration summary + Refresh Vendors & Models button
- Icon set selector (Phosphor Regular / Duotone)
- View mode preference (Cards / Accordion)

### Tab 5: About
- App version, tech stack, credits

---

## External Services & API Keys

| Service | Env Variable | Purpose |
|---|---|---|
| Apify | `APIFY_API_TOKEN` | Amazon book cover scraping, Wikipedia photo scraping |
| Tavily | `TAVILY_API_KEY` | Author headshot image search |
| Replicate | `REPLICATE_API_TOKEN` | AI portrait generation (flux-schnell) |
| Perplexity | `PERPLEXITY_API_KEY` | Web-grounded author bio research |
| Google Gemini | `GEMINI_API_KEY` | Photo validation, bio generation fallback |
| Manus Forge | `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` | S3 storage, LLM proxy |

---

## Author Name Normalization

The `client/src/lib/authorAliases.ts` file maps every known name variant to a canonical display name. This is critical because Google Drive folder names often include specialty suffixes:

```
"Adam Grant - Organizational psychology" → "Adam Grant"
"Matthew Dixon - Sales strategy and customer psychology experts" → "Matthew Dixon"
"Stephen Hawking - Cosmology, black holes, theoretical physics" → "Stephen Hawking"
```

The `canonicalName(raw)` function must be called before any photo/bio lookup.

---

## LLM Configuration

- **Primary model**: stored in `settings.primaryModel` (AppSettings); falls back to `settings.geminiModel` for backward compat
- **Secondary LLM**: `settings.secondaryLlmEnabled` toggle; when true, `settings.secondaryModel` is used for a second-pass refinement of LLM-generated bios and book summaries
  - `enrichAuthorViaWikipedia(name, model, secondaryModel)` — secondary refines bio when Wikipedia returns nothing
  - `enrichBookViaGoogleBooks(title, author, model, secondaryModel)` — secondary refines summary when Google Books returns nothing
  - `Admin.tsx` batch enrichment passes `secondaryModel` when `secondaryLlmEnabled` is true
- **Vendor catalogue**: `VENDOR_CATALOGUE` in `server/routers/llm.router.ts` — 10 vendors, 40+ models
- **Seeded defaults**: Google → Gemini 2.5 Pro (primary), OpenAI → GPT-4o (secondary)

---

## Performance Optimizations (March 2026)

- **N+1 queries fixed**: `authorProfiles.router.ts` and `bookProfiles.router.ts` `enrichBatch` procedures now pre-fetch all existing rows in a single `inArray` query before the loop
- **Shared httpClient**: `server/lib/httpClient.ts` provides `fetchJson()` and `fetchBuffer()` with timeout, retry, and structured error handling
- **apify.ts**: Added `runActorWithRetry()` helper with configurable retry count and delay; typed `ApifyRunResult` interface
- **mirrorToS3.ts**: Fixed dedup check — skips re-upload when `existingKey` already exists in S3; uses `fetchBuffer` from httpClient
- **waterfall.ts**: Per-tier timeouts (Wikipedia 8s, Tavily 10s, Apify 15s, Gemini 12s, Replicate 30s); `skipAlreadyEnriched` option; structured timing logs

---

## Testing

The project uses Vitest with 122 passing tests. Test files are in `server/*.test.ts`. Run with:

```bash
pnpm test
```

---

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server (tsx watch) |
| `pnpm build` | Production build (Vite + esbuild) |
| `pnpm test` | Run Vitest tests |
| `pnpm db:push` | Generate + run Drizzle migrations |
| `pnpm format` | Prettier formatting |

---

## Design Rules (Absolute)

These rules apply to all UI work on this project:

1. **Zero hardcoded colors** — No hex, rgb, rgba, or hsl literals in components. All colors from CSS variable tokens (`bg-card`, `text-foreground`, `border-border`, etc.).
2. **Category identity via icon + label only** — No colored stripes or tinted backgrounds (except in Manus/Norfolk AI themes where border stripes are allowed).
3. **Top-justified card content** — All card content starts at the top (`flex-col`, items-start).
4. **Business-like monocolor icons** — All icons are single-color. Add subtle hover animation to interactive icons.
5. **3-hotspot interaction model** — Every card has exactly 3 clickable areas (avatar/name, cover/title, card surface). Everything else is presentational.
6. **Amazon-first for book covers** — Always scrape Amazon before falling back to Google Books or other sources.
7. **AI Model selection** — Present vendors as a dropdown, models as radio buttons. Primary + optional Secondary LLM. Seeded: Google → Gemini 2.5 Pro.
8. **Content categorization** — Authors' content is categorized into Books, Papers, and Articles.
9. **Manus theme is the seed** — Always update the Manus theme first when making design changes. Other themes branch from it.
10. **Avatar background color** — Default is Norfolk AI Teal `#0091AE`. Swatches use the official Norfolk AI palette.

---

## Skills Reference

The following skills document reusable patterns from this project:

| Skill | Purpose |
|---|---|
| `library-content-enrichment` | Full enrichment pipeline: photo waterfall, cover scraping, bio fetching |
| `book-cover-scrape-mirror` | Amazon scrape + S3 mirror batch script |
| `webdev-apify-scraping` | Apify cheerio-scraper integration pattern |
| `webdev-card-system` | Flowbite card + modal + accordion component system |
| `webdev-flowbite` | Flowbite + Tailwind v4 integration |
| `webdev-theme-aware-cards` | Multi-theme card styling (Manus, Norfolk AI, Noir Dark) |
| `webdev-norfolk-ai-branding` | "Powered by Norfolk AI" badge |
| `webdev-page-header` | Breadcrumb navigation bar |
| `webdev-visualizations` | Charts and diagrams (ECharts, Nivo, React Flow) |
| `drive-media-folders` | Google Drive media folder management |
| `data-dedup-normalizer` | Entity deduplication and name normalization |
