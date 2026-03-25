# Ricardo Cidale's Authors & Books Library

## Standing Rules

**Last Updated:** March 25, 2026 — Comprehensive Audit Sprint (DB integrity fixes, router split, component extraction, LLM vendor expansion, health check fixes, Drive folder ID corrections, Dependencies tab, documentation overhaul)

> **MANDATORY:** At the end of every completed task, update this file (`claude.md`) to reflect any new features, architectural changes, component additions, data schema changes, or workflow changes made during that session. Also append a dated entry to `memory.md` summarising what was done. These two files are the source of truth for the project state. `manus.md` is a copy of `claude.md` — keep them in sync.

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
client/                                → React 19 SPA (Vite)
  src/
    pages/
      Home.tsx                         → Main library UI orchestrator (~623 lines)
      Admin.tsx                        → Admin Console orchestrator (~1493 lines)
      AuthorDetail.tsx                 → Author detail page
      BookDetail.tsx                   → Book detail page
      AuthorCompare.tsx                → Author comparison page
      Leaderboard.tsx                  → Author leaderboard page
      NotFound.tsx                     → 404 page
    components/
      library/                         → Library card/panel components
        LibrarySidebar.tsx             → Extracted sidebar (category filters, search, sort, view toggle)
        BookCard.tsx                   → Single book card with cover thumbnail
        AudioCard.tsx                  → Single audio book card
      admin/                           → Admin tab components
        AiTab.tsx                      → AI model selection tab (~203 lines, slim orchestrator)
        ModelSelector.tsx              → Vendor/model selector with Auto-Recommend button (~606 lines)
        BackgroundSelector.tsx         → Avatar background color picker (~159 lines)
        BatchRegenSection.tsx          → Batch regeneration controls (~146 lines)
        AvatarDetailTable.tsx          → Avatar audit detail table (~140 lines)
        AvatarResolutionControls.tsx   → Avatar resolution settings (~150 lines)
        DependenciesTab.tsx            → Native vs third-party dependency registry (~986 lines)
        ToolHealthCheckTab.tsx         → Service health check runner
        InformationToolsTab.tsx        → Information tools reference
        CascadeTab.tsx                 → Research cascade stats display
        AboutTab.tsx                   → App info and version
        ActionCard.tsx                 → Reusable action card with progress
        adminTypes.ts                  → Shared admin types
      FlowbiteAuthorCard.tsx           → Author card (grid view, 3D tilt, avatar, book list)
      AuthorAccordionRow.tsx           → Accordion list row for author
      AuthorModal.tsx                  → Author detail modal
      BookModal.tsx                    → Book detail modal
      BackToTop.tsx                    → Floating back-to-top button
      CoverLightbox.tsx                → Full-screen book cover viewer
      AvatarCropModal.tsx              → Avatar upload + crop editor
      AvatarUpload.tsx                 → Camera overlay → file picker → crop → S3
      FloatingBooks.tsx                → 3D floating book shapes (Three.js/Fiber decorative bg)
    contexts/
      ThemeContext.tsx                 → next-themes ThemeProvider wrapper
      AppSettingsContext.tsx           → App settings (theme, icon set, LLM model, view mode)
      IconContext.tsx                  → Icon set context
    hooks/
      useLibraryData.ts                → Extracted data hooks + filtering logic (~439 lines)
      useConfetti.ts                   → No-op confetti stub (dependency removed)
    lib/
      libraryData.ts                   → Auto-generated Drive scan data (112 authors, 183 books, 9 categories)
      audioData.ts                     → Auto-generated audiobooks data (45 titles)
      authorAvatars.ts                 → Static author name → S3 CDN URL map
      authorAliases.ts                 → Drive folder name → display name normalization map
      trpc.ts                          → tRPC client binding
server/
  routers/                             → tRPC routers (feature-split)
    authorProfiles.router.ts           → Core CRUD + merges 3 sub-routers (~360 lines)
    authorAvatar.router.ts             → Avatar generation, upload, audit, normalize, stats (~484 lines)
    authorEnrichment.router.ts         → Rich bio, academic, enterprise, professional, document enrichment (~570 lines)
    authorSocial.router.ts             → Social stats, platform discovery, Twitter, business profile (~659 lines)
    bookProfiles.router.ts             → Book enrichment procedures
    library.router.ts                  → Google Drive scanning + TS code generation
    apify.router.ts                    → Amazon scraping + S3 mirroring
    cascade.router.ts                  → Research cascade stats
    admin.router.ts                    → Action log tracking
    llm.router.ts                      → Multi-vendor LLM catalogue (13 vendors, 47 models) + recommendation engine (~1006 lines)
    healthCheck.router.ts              → Service health check procedures
  enrichment/                          → 22 enrichment modules
    academicResearch.ts                → OpenAlex academic paper search
    apollo.ts                          → Wikipedia professional data
    cnn.ts                             → CNN stats
    context7.ts                        → Technical references (GitHub, docs)
    facebook.ts                        → Facebook page ID extraction
    gdrive.ts                          → Google Drive folder listing
    github.ts                          → GitHub username extraction + stats
    instagram.ts                       → Instagram username extraction
    notion.ts                          → Notion database sync
    platforms.ts                       → Multi-platform discovery (discoverAuthorPlatforms)
    quartr.ts                          → SEC EDGAR filings search
    rapidapi.ts                        → Yahoo Finance stats
    richBio.ts                         → LLM-powered rich biography generation
    richSummary.ts                     → LLM-powered rich book summary generation
    socialStats.ts                     → Social media stats aggregation
    substack.ts                        → Substack subdomain extraction
    ted.ts                             → TED Talk scraping
    tiktok.ts                          → TikTok username extraction
    twitter.ts                         → Twitter username extraction
    wikipedia.ts                       → Wikipedia stats + Wikidata social links
    ycombinator.ts                     → YC company stats
    youtube.ts                         → YouTube channel enrichment
  lib/
    authorAvatars/                     → 5-tier author avatar waterfall
      waterfall.ts                     → Main orchestrator (~402 lines)
      authorResearcher.ts              → Parallel research across 3 sources
      persistResult.ts                 → DB write helper (extracted from router)
      promptBuilder.ts                 → Avatar prompt construction
      types.ts                         → Avatar pipeline types
      googleImagenGeneration.ts        → Google Imagen generation
      replicateGeneration.ts           → Replicate Flux generation
      geminiValidation.ts              → Gemini vision photo validation
      tavily.ts                        → Tavily image search
      wikipedia.ts                     → Wikipedia photo fetch
    httpClient.ts                      → Shared fetch with timeout/retry (fetchJson, fetchBuffer)
    parallelBatch.ts                   → Parallel batch processing utilities
  db.ts                                → Drizzle DB connection + base query helpers
  storage.ts                           → S3 upload/download via Manus Forge API
  dependencies.test.ts                 → Vitest tests for dependency registry
drizzle/
  schema.ts                            → All 9 table definitions (~486 lines)
  relations.ts                         → Drizzle relations
shared/
  const.ts                             → Google Drive folder IDs, auth constants
  types.ts                             → Shared TypeScript types
```

---

## Google Drive Folder Structure

The app reads from two root folders in Google Drive. These are the **single source of truth** for the library's content catalogue. All data originates here; the database stores only enrichment metadata (bios, covers, ratings).

### Authors Root Folder

**Drive ID:** `119tuydLrpyvavFEouf3SCq38LAD4_ln5` (stored in `shared/const.ts` as `DRIVE_AUTHORS_ROOT` and `server/_core/env.ts` as `driveAuthorsFolderId`)

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
│   └── ...
├── Behavioral Science & Psychology/
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

**Drive ID:** `1-8bnr7xSAYucSFLW75E6DcP712eQ7wMU` (stored in `server/_core/env.ts` as `driveBooksAudioFolderId`)

Located under: `Norfolk Consulting Group / Books Audio`

```
Books Audio/
├── Atomic Habits - James Clear/
│   ├── MP3/
│   └── M4B/
├── Think Again - Adam Grant/
│   └── MP3/
└── ...
```

**Hierarchy:** `Book Folder ("Title - Author") → Format Folder (MP3/M4B) → Audio Files`

### Knowledge Library Structure

**Root:** `02 — Knowledge Library` (Drive ID: `1Oi_oYg8jh8kaANvpjYb2OCENYTE4nnbG`)

```
02 — Knowledge Library/
├── 01 — Authors (18SjO_Cz6U7hjsSQZwSFVaAA12pL2RQaf)
├── 02 — Books by Category (19aB4kx8TgGQE8jYjylCKFJKdroXzykK0)
├── 03 — Author Avatars (1Vhjh-gmnSYRXD6Y2Kh4Ve1YvFsvwA3Fo) ← currently empty
├── 04 — Book Covers (1p9vlKx44C8iKcoVJsddJURVn5VpAQ2L_) ← currently empty
└── Knowledge Base (1I0ff-JhIrKuVgyRpAkGeqdGUedh3mbFK)
```

### Media Folders (Enrichment Assets)

These folders store mirrored copies of enrichment media. **These are the active folders with content:**

| Folder | Drive ID | Purpose | Status |
|---|---|---|---|
| Author Pictures | `1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH` | Author headshot photos (80+ files) | Active ✓ |
| Book Covers | `1qzmgRdCQr98fxVs6Bvnqi3J-tS574GY1` | Book cover images (200+ files) | Active ✓ |

These IDs are stored in `shared/const.ts` as `DRIVE_AUTHOR_AVATARS_FOLDER_ID` and `DRIVE_BOOK_COVERS_FOLDER_ID`.

> **Note:** The `03 — Author Avatars` and `04 — Book Covers` folders in the Knowledge Library are empty. The active media folders are at the IDs listed above.

---

## Data Storage Strategy

Data lives in **three locations** with distinct purposes:

### Google Drive (Source of Truth for Content)

All original book files (PDFs, transcripts, videos, audio) live in Google Drive. The app never copies these files; it only reads the folder structure to build the catalogue. Drive folder IDs are stored in the database and used to generate direct links (`https://drive.google.com/drive/folders/{id}`).

### MySQL/TiDB Database (Enrichment Metadata)

The database stores enrichment data that accelerates the app UI. It does **not** store any file content.

**Tables (9 total):**

| Table | Purpose | Key Columns | Row Count |
|---|---|---|---|
| `users` | Manus OAuth users | `id`, `name`, `email`, `role` (admin/user), `avatarUrl` | 1 |
| `author_profiles` | Author enrichment (66 columns) | `authorName`, `bio`, `avatarUrl`, `s3AvatarUrl`, `avatarSource`, social links, enrichment JSON fields | 171 |
| `book_profiles` | Book enrichment (32 columns) | `bookTitle`, `authorName`, `summary`, `keyThemes`, `rating`, `coverImageUrl`, `s3CoverUrl`, `amazonUrl`, `isbn` | 139 |
| `sync_status` | Background job tracking | `jobType`, `status`, `progress`, `totalItems`, `processedItems` | 0 |
| `admin_action_log` | Admin action audit trail | `actionKey`, `lastRunAt`, `lastRunDurationMs`, `lastRunResult` | varies |
| `favorites` | User-saved authors/books | `userId`, `authorName`, `bookTitle` | 0 |
| `enrichment_schedules` | Scheduled enrichment jobs | `jobType`, `cronExpression`, `enabled` | 0 |
| `enrichment_jobs` | Enrichment job run history | `jobType`, `status`, `startedAt`, `completedAt` | 0 |

**Enrichment coverage (as of March 25, 2026):**

| Metric | Count | % |
|---|---|---|
| Authors with S3 avatar | 141 / 171 | 82% |
| Authors with bio | 91 / 171 | 53% |
| Books with S3 cover | 139 / 139 | 100% |
| Books with summary | 138 / 139 | 99% |

### Manus S3 CDN (Stable Media URLs)

External image URLs are unreliable. The app mirrors all images to Manus S3 for stable CDN delivery.

**S3 key prefixes:**
- `author-photos/` — Author headshot images
- `ai-author-photos/` — AI-generated portraits (Replicate Flux)
- `book-covers/` — Book cover images

**Helper:** `server/mirrorToS3.ts` provides `mirrorImageToS3()` and `mirrorBatchToS3()`.

### Static Client-Side Maps

For instant rendering without DB round-trips:

| File | Content |
|---|---|
| `client/src/lib/libraryData.ts` | Auto-generated: 112 authors, 183 books, 9 categories, content types |
| `client/src/lib/audioData.ts` | Auto-generated: 45 audiobooks with format info |
| `client/src/lib/authorAvatars.ts` | `Record<string, string>` mapping author names to S3 CDN photo URLs |
| `client/src/lib/authorAliases.ts` | Drive folder name → canonical display name map |

These files are regenerated by the "Regenerate DB" action in the Admin Console.

---

## Enrichment Pipelines

### Book Cover & Metadata Enrichment

**The correct cascade order (Amazon-first):**

1. **Amazon Scrape (Apify)** — Primary source for book covers. `scrapeAmazonBook()` in `server/apify.ts` uses Apify's `cheerio-scraper` actor to search Amazon, extract cover URL, ASIN, and product page URL.

2. **Google Books API** — Fallback for covers and primary source for metadata. Queries `googleapis.com/books/v1/volumes?q={title}+inauthor:{author}` for cover thumbnails, summaries, ratings, ISBN, publisher, and published date.

3. **S3 Mirror** — After obtaining a cover URL, `mirrorImageToS3()` fetches the image and uploads it to Manus S3 CDN. The stable CDN URL is stored in `s3CoverUrl`.

**Important:** Books with no cover found are marked `coverImageUrl = 'not-found'` to prevent infinite retries. Skippable titles are marked `coverImageUrl = 'skipped'`.

### Author Photo Enrichment (5-Tier Waterfall)

Implemented in `server/lib/authorAvatars/waterfall.ts`. Tries each tier in order, stopping at first success:

| Tier | Source | File | Cost | Speed |
|---|---|---|---|---|
| 1 | Wikipedia REST API | `wikipedia.ts` | Free | ~200ms |
| 2 | Tavily Image Search | `tavily.ts` | ~$0.001/search | ~1-2s |
| 3 | Apify Web Scrape | `apify.ts` | ~$0.005/run | ~5-15s |
| 4 | Gemini Vision Validation | `geminiValidation.ts` | ~$0.001/call | ~2-3s |
| 5 | Replicate AI Portrait | `replicateGeneration.ts` | ~$0.003/image | ~10-30s |

**Tier 4** validates images from Tiers 1-3 using Gemini 2.5 Flash vision. Photos that fail (not a single professional headshot) are rejected and the waterfall continues.

**Tier 5** uses Black Forest Labs `flux-schnell` via Replicate. AI-generated portraits are tagged `avatarSource = 'ai'`.

**After finding a photo:** Uploads to S3 via `uploadAvatarToS3()`, storing stable CDN URL in `s3AvatarUrl`.

### Author Bio & Social Links Enrichment

`enrichAuthorViaWikipedia()` fetches:
1. **Bio** from Wikipedia REST API — first 2 sentences (max 400 chars)
2. **Social links** from Wikidata — P856 (website), P2002 (Twitter), P6634 (LinkedIn)
3. **LLM fallback** — `generateBioWithLLM()` if Wikipedia returns nothing

### Rich Bio Enrichment

`enrichRichBio()` in `server/enrichment/richBio.ts` — LLM-powered multi-paragraph biography with career arc, key contributions, and notable works.

### Social Stats Enrichment

`enrichAuthorSocialStats()` in `server/enrichment/socialStats.ts` — aggregates YouTube subscribers, Twitter followers, LinkedIn connections, Substack subscribers, GitHub stars, website traffic.

### Avatar Upload (Manual)

1. Click camera overlay on any author avatar
2. Select image file (JPEG, PNG, WebP, GIF; max 10 MB)
3. Crop using `AvatarCropModal` (circular mask, 1:1, zoom 1x-3x)
4. Export as 256×256 JPEG canvas blob
5. Upload via `authorProfiles.uploadPhoto` → base64 → S3 → CDN URL
6. Persist in `author_profiles.s3AvatarUrl`

---

## UI Components & Interaction Model

### Component Hierarchy

```
Home.tsx
├── LibrarySidebar.tsx (extracted)
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
├── AuthorModal
├── BookModal
├── CoverLightbox (Framer Motion overlay)
├── AvatarUpload + AvatarCropModal
├── FloatingBooks (Three.js 3D background)
└── BackToTop (floating scroll-to-top button)

Admin.tsx
├── Tabs: Data Pipeline | Media | AI | Research Cascade | Settings | About | Dependencies | Health Check | Information Tools
├── AiTab.tsx
│   ├── ModelSelector.tsx (primary LLM)
│   ├── ModelSelector.tsx (secondary LLM)
│   ├── BackgroundSelector.tsx
│   ├── BatchRegenSection.tsx
│   └── AvatarResolutionControls.tsx
├── DependenciesTab.tsx
│   ├── Manus Native Services (7 services)
│   └── Third-Party / Optional Services (16 services)
├── ToolHealthCheckTab.tsx
└── ActionCard (reusable admin action button with status)
```

### Card Interaction Model (3 Hotspots)

Every card follows the same 3-hotspot interaction model:

| Hotspot | Element | Action |
|---|---|---|
| 1 | Avatar + author name | Opens `AuthorModal` (bio, social links, photo) |
| 2 | Book cover + book title | Opens `BookModal` (summary, Amazon link, content types) |
| 3 | Card surface | Opens full bio panel in parent |

Everything else is **purely presentational** — `cursor-default`, no `onClick`.

### Key UI Components

| Component | Library | Purpose |
|---|---|---|
| `FlowbiteAuthorCard` | Custom (Flowbite removed) | Author card with 3D tilt, avatar, book list, category chip |
| `AuthorAccordionRow` | Framer Motion | Compact accordion row with expand/collapse animation |
| `AuthorModal` | shadcn/ui Dialog | Author bio dialog with photo, social links, enrichment actions |
| `BookModal` | shadcn/ui Dialog | Book detail dialog with cover, summary, Amazon/Goodreads links |
| `CoverLightbox` | Framer Motion | Full-screen book cover overlay with backdrop blur |
| `AvatarUpload` | Custom + `react-image-crop` | Camera overlay → file picker → crop modal → S3 upload |
| `AvatarCropModal` | `react-image-crop` | Circular crop mask, zoom slider, 256×256 export |
| `FloatingBooks` | `@react-three/fiber` + `drei` | Decorative 3D floating book shapes in hero background |
| `BackToTop` | Framer Motion | Floating arrow-up button, appears after 300px scroll |
| `ModelSelector` | Custom + shadcn/ui | Vendor dropdown + model radio list + Auto-Recommend button |
| `DependenciesTab` | Custom + shadcn/ui | Native vs third-party dependency registry with health checks |

### shadcn/ui Components Used

`accordion`, `alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `empty`, `hover-card`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner` (toasts), `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`

### Icon Libraries

| Library | Usage | Import |
|---|---|---|
| Lucide React | Primary icons throughout the app | `lucide-react` |
| Phosphor Icons | Avatar upload camera, page header nav, icon set system | `@phosphor-icons/react` |

The app supports two icon sets (configurable in Settings): **Phosphor Regular** and **Phosphor Duotone**.

---

## Design System: Themes, Fonts & Colors

### Typography

| Role | Font Family | Weight | Usage |
|---|---|---|---|
| Display / Headings | IBM Plex Sans | 400, 500, 600 | Page titles, card headings, stat labels |
| Body / UI | Inter | 400, 500, 600 | All body text, form labels, buttons |
| Monospace | JetBrains Mono | 400, 600 | Code snippets, technical values |

Fonts are loaded from Google Fonts CDN in `client/index.html`.

### Theme System

The app has three named themes managed by `AppSettingsContext`:

| Theme | Class | Style |
|---|---|---|
| **Manus** (default/seed) | `.theme-manus` | Black / white / grey — clean default |
| **Norfolk AI** | `.theme-norfolk-ai` | Official NCG palette — navy + yellow |
| **Noir Dark** | `.theme-noir-dark` | Executive monochrome — pure B&W |

**Design System Rule — Manus as Seed:** Always update the Manus theme first when making design changes. Other themes branch from Manus and override only their brand-specific tokens.

Settings are persisted to `localStorage` under key `app-settings-v2`.

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

### NCG Brand Tokens (OKLCH)

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

**Noir Dark theme override:** All category colors are suppressed. Cards use monochrome borders, category chips use grey backgrounds.

---

## Admin Console

The Admin Console (`/admin`, lazy-loaded) has 9 tabs:

### Tab 1: Data Pipeline
- **Regenerate DB** — Scans Google Drive, rebuilds `libraryData.ts` and `audioData.ts`
- **Enrich Author Bios** — Batch Wikipedia/Wikidata enrichment
- **Enrich Book Metadata** — Batch Google Books API enrichment

### Tab 2: Media
- **Generate Portraits** — Runs the 5-tier waterfall for authors missing photos
- **Scrape Covers** — Amazon scraping via Apify for books missing covers
- **Mirror to S3** — Uploads external images to Manus CDN

### Tab 3: AI (AiTab.tsx)
- **Primary LLM** — `ModelSelector` with vendor dropdown (13 vendors), model radio list, Auto-Recommend button per task type
- **Secondary LLM** — Enable/disable toggle + separate `ModelSelector` (used for research parallel processing)
- **Avatar Background Color** — Norfolk AI palette swatches + custom color picker
- **Batch Regeneration** — `BatchRegenSection` for bulk avatar/bio regen
- **Avatar Resolution Controls** — `AvatarResolutionControls` for output size settings

### Tab 4: Research Cascade
- Live stats dashboard showing enrichment coverage (photos, bios, covers, summaries)
- Per-tier breakdown (Wikipedia, Tavily, Apify, AI)

### Tab 5: Settings
- **Theme selector** — Manus | Norfolk AI | Noir Dark with mini palette preview swatches
- **Icon set selector** — Phosphor Regular / Duotone
- **View mode preference** — Cards / Accordion

### Tab 6: About
- App version, tech stack, credits

### Tab 7: Dependencies (DependenciesTab.tsx)
- **Manus Native Services** (7 always-available): Database (TiDB), OAuth, S3 Storage, LLM Gateway, Image Generation, Notifications, Analytics
- **Third-Party / Optional Services** (16 external): Gemini, Anthropic, Apify, Replicate, Tavily, Perplexity, YouTube, Twitter, RapidAPI, Google Books, Wikipedia/Wikidata, SEC EDGAR, OpenAlex, GitHub, Google Drive, Notion
- Each card shows: description, status indicator with latency, env var names, features using it, docs link
- **Check All Services** button runs batch health checks

### Tab 8: Health Check (ToolHealthCheckTab.tsx)
- Individual service health check runner with status badges

### Tab 9: Information Tools (InformationToolsTab.tsx)
- Reference guide for available information tools and APIs

---

## LLM Configuration

### Vendor Catalogue (13 vendors, 47 models)

| Vendor | ID | Key Models |
|---|---|---|
| Google | `google` | Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash Lite |
| OpenAI | `openai` | GPT-4.1, GPT-4o, GPT-4o Mini, o3, o4-mini |
| Anthropic | `anthropic` | Claude 3.5 Haiku, Claude 3.7 Sonnet, Claude 3.5 Sonnet |
| xAI | `xai` | Grok 3, Grok 3 Mini, Grok 3 Fast |
| DeepSeek | `deepseek` | DeepSeek V3, DeepSeek R1, DeepSeek V3-0324 |
| Meta | `meta` | Llama 3.3 70B, Llama 3.1 405B |
| Mistral | `mistral` | Mistral Large, Mistral Small, Codestral |
| Cohere | `cohere` | Command A |
| Perplexity | `perplexity` | Sonar, Sonar Pro, Sonar Reasoning |
| Amazon | `amazon` | Nova Pro, Nova Lite, Nova Micro |
| Microsoft | `microsoft` | Phi-4, Phi-4 Mini |
| Alibaba | `alibaba` | Qwen Max, Qwen Plus, Qwen Turbo, Qwen Coder |
| AI21 | `ai21` | Jamba 1.5 Large |

### Recommendation Engine (6 use cases)

| Use Case | Best Model | Purpose |
|---|---|---|
| `research` | Gemini 2.5 Pro | Deep author/book research, web-grounded |
| `refinement` | Claude 3.7 Sonnet | Bio/summary polishing, nuanced writing |
| `structured` | GPT-4.1 | JSON schema output, data extraction |
| `avatar_research` | Gemini 2.5 Flash | Fast photo validation, image understanding |
| `code` | DeepSeek V3 | Code generation, technical references |
| `bulk` | Gemini 2.5 Flash | High-volume batch processing |

### LLM Settings

- **Primary model**: stored in `settings.primaryModel` (AppSettings)
- **Secondary LLM**: `settings.secondaryLlmEnabled` toggle; when true, `settings.secondaryModel` is used for second-pass refinement
- **Auto-Recommend**: Each `ModelSelector` has an "Auto-Recommend" button that calls `llm.getRecommendedModel` with the task's `useCase` and auto-selects the best vendor/model
- **Seeded defaults**: Google → Gemini 2.5 Flash (primary), Anthropic → Claude 3.5 Haiku (secondary)

---

## Dependency Contracts

### Manus Native Services (Always Available)

These services are provided by the Manus platform and require no external API keys:

| Service | Env Var | Purpose |
|---|---|---|
| Database (TiDB) | `DATABASE_URL` | MySQL-compatible cloud database |
| Manus OAuth | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | User authentication |
| S3 Storage | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | File storage and CDN |
| LLM Gateway | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Multi-vendor LLM proxy |
| Image Generation | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | AI image generation |
| Notifications | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Owner push notifications |
| Analytics | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | Page view analytics |

### Third-Party / Optional Services

| Service | Env Var | Purpose | Cost |
|---|---|---|---|
| Google Gemini | `GEMINI_API_KEY` | Photo validation, bio generation, vision | Pay-per-use |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models for enrichment | Pay-per-use |
| Apify | `APIFY_API_TOKEN` | Amazon book cover scraping, Wikipedia photo scraping | ~$0.005/run |
| Replicate | `REPLICATE_API_TOKEN` | AI portrait generation (Flux Schnell) | ~$0.003/image |
| Tavily | `TAVILY_API_KEY` | Author headshot image search | ~$0.001/search |
| Perplexity | `PERPLEXITY_API_KEY` | Web-grounded author bio research | Pay-per-use |
| YouTube Data API | `YOUTUBE_API_KEY` | YouTube channel stats | Free quota |
| Twitter Bearer | `TWITTER_BEARER_TOKEN` | Twitter follower counts | Free tier |
| RapidAPI | `RAPIDAPI_KEY` | Yahoo Finance stats, web traffic | Pay-per-use |
| Google Books | None (public) | Book metadata, covers, ratings | Free |
| Wikipedia/Wikidata | None (public) | Author bios, social links, photos | Free |
| SEC EDGAR | None (public) | Earnings call mentions | Free |
| OpenAlex | None (public) | Academic paper search | Free |
| GitHub | None (public) | Repository stats, technical references | Free |
| Google Drive | OAuth (gws CLI) | Source of truth for book/author catalogue | Free |
| Notion | OAuth (MCP) | Reading notes sync | Free |

---

## Author Name Normalization

`client/src/lib/authorAliases.ts` maps every known name variant to a canonical display name:

```
"Adam Grant - Organizational psychology" → "Adam Grant"
"Matthew Dixon - Sales strategy and customer psychology experts" → "Matthew Dixon"
"Stephen Hawking - Cosmology, black holes, theoretical physics" → "Stephen Hawking"
```

The `canonicalName(raw)` function must be called before any photo/bio lookup.

---

## Performance Optimizations

- **N+1 queries fixed**: `enrichBatch` procedures pre-fetch all existing rows in a single `inArray` query before the loop
- **Shared httpClient**: `server/lib/httpClient.ts` provides `fetchJson()` and `fetchBuffer()` with timeout, retry, and structured error handling
- **apify.ts**: `runActorWithRetry()` helper with configurable retry count and delay
- **mirrorToS3.ts**: Dedup check — skips re-upload when `existingKey` already exists in S3
- **waterfall.ts**: Per-tier timeouts (Wikipedia 8s, Tavily 10s, Apify 15s, Gemini 12s, Replicate 30s)
- **Router split**: `authorProfiles.router.ts` split into 4 files (core + avatar + enrichment + social) to keep each under 700 lines
- **Component extraction**: `AiTab.tsx` split into 5 components; `Home.tsx` split with `useLibraryData` hook and `LibrarySidebar`

---

## Testing

The project uses Vitest with **439 passing tests** across **30 test files** in `server/*.test.ts`. Run with:

```bash
pnpm test
```

Key test files:
- `server/llm.test.ts` — Vendor registry, model lookup, recommendation engine
- `server/dependencies.test.ts` — Dependency registry data structure
- `server/healthCheck.test.ts` — Health check procedures
- `server/avatarResolution.test.ts` — Avatar waterfall resolution
- `server/socialStats.test.ts` — Social stats enrichment
- `server/auth.logout.test.ts` — Auth flow (reference sample)

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

## Routes

| Path | Component | Auth |
|---|---|---|
| `/` | `Home.tsx` | Public |
| `/author/:slug` | `AuthorDetail.tsx` | Public |
| `/book/:slug` | `BookDetail.tsx` | Public |
| `/compare` | `AuthorCompare.tsx` | Public |
| `/leaderboard` | `Leaderboard.tsx` | Public |
| `/admin` | `Admin.tsx` | Protected (admin role) |
| `/404` | `NotFound.tsx` | Public |

---

## Design Rules (Absolute)

These rules apply to all UI work on this project:

1. **Zero hardcoded colors** — No hex, rgb, rgba, or hsl literals in components. All colors from CSS variable tokens (`bg-card`, `text-foreground`, `border-border`, etc.).
2. **Category identity via icon + label only** — No colored stripes or tinted backgrounds (except in Manus/Norfolk AI themes where border stripes are allowed).
3. **Top-justified card content** — All card content starts at the top (`flex-col`, `items-start`).
4. **Business-like monocolor icons** — All icons are single-color. Add subtle hover animation to interactive icons.
5. **3-hotspot interaction model** — Every card has exactly 3 clickable areas (avatar/name, cover/title, card surface). Everything else is presentational.
6. **Amazon-first for book covers** — Always scrape Amazon before falling back to Google Books or other sources.
7. **AI Model selection** — Present vendors as a dropdown, models as radio buttons. Primary + optional Secondary LLM. Auto-Recommend button per task.
8. **Content categorization** — Authors' content is categorized into Books, Papers, and Articles.
9. **Manus theme is the seed** — Always update the Manus theme first when making design changes. Other themes branch from it.
10. **Avatar background color** — Default is Norfolk AI Teal `#0091AE`. Swatches use the official Norfolk AI palette.
11. **Flowbite is removed** — `FlowbiteAuthorCard` is named for historical reasons but no longer imports from `flowbite-react`. Use shadcn/ui Dialog for modals.
12. **Three.js for decorative only** — `FloatingBooks` is purely decorative. Do not add interactive 3D elements.

---

## Skills Reference

The following skills document reusable patterns from this project:

| Skill | Purpose |
|---|---|
| `library-content-enrichment` | Full enrichment pipeline: photo waterfall, cover scraping, bio fetching |
| `book-cover-scrape-mirror` | Amazon scrape + S3 mirror batch script |
| `webdev-apify-scraping` | Apify cheerio-scraper integration pattern |
| `webdev-card-system` | Card + modal + accordion component system |
| `webdev-flowbite` | Flowbite + Tailwind v4 integration (historical; Flowbite removed from this project) |
| `webdev-theme-aware-cards` | Multi-theme card styling (Manus, Norfolk AI, Noir Dark) |
| `webdev-norfolk-ai-branding` | "Powered by Norfolk AI" badge |
| `webdev-page-header` | Breadcrumb navigation bar |
| `webdev-visualizations` | Charts and diagrams (ECharts, Nivo, React Flow) |
| `drive-media-folders` | Google Drive media folder management |
| `data-dedup-normalizer` | Entity deduplication and name normalization |
| `llm-recommendation-engine` | Multi-vendor LLM catalogue + task-based recommendation |
| `author-avatar-terminology` | Avatar source terminology and waterfall tier naming |
| `avatar-background-consistency` | Avatar background color rules |
| `avatar-photo-recency` | Avatar photo recency and quality standards |

---

## Project Skills (Local)

These skills are stored in `/home/ubuntu/skills/` and are specific to this project:

| Skill | File | Purpose |
|---|---|---|
| `llm-recommendation-engine` | `SKILL.md` | 13-vendor catalogue, recommendation engine, use cases |
| `author-avatar-terminology` | `SKILL.md` | Avatar source types, waterfall tier naming conventions |
| `avatar-background-consistency` | `SKILL.md` | Background color rules for AI-generated avatars |
| `avatar-photo-recency` | `SKILL.md` | Photo quality and recency standards |

> **Note:** These skills reference `server/routers/authorProfiles.router.ts` in some places. After the router split, the relevant procedures are now in `authorAvatar.router.ts`, `authorEnrichment.router.ts`, and `authorSocial.router.ts`. Update skill references if needed.
