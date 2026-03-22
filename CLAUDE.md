# CLAUDE.md — Ricardo Cidale's Library

This file provides context for AI coding assistants (Claude Code, Manus, Gemini CLI, etc.)
working on this codebase. Read this before making any changes.

---

## Project Overview

**Ricardo Cidale's Library** (`authors-books-library`) is a personal digital library
for Ricardo Cidale / Norfolk Consulting Group. It displays 109 authors and 178 books
sourced from a Google Drive folder hierarchy, enriched with AI-generated bios, author
avatars, book cover images, ratings, and summaries.

**Live URL:** `https://authlib-ehsrgokn.manus.space`
**GitHub:** `https://github.com/norfolk-ai/authors-books-library` (private)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Flowbite React 0.12.16, shadcn/ui, Radix UI |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL / TiDB (via `DATABASE_URL`) |
| File storage | Manus S3 CDN (`storagePut` / `storageGet` in `server/storage.ts`) |
| Auth | Manus OAuth (`/api/oauth/callback`, `protectedProcedure`) |
| Build | Vite 6.4.1, esbuild, TypeScript 5.9 |
| Testing | Vitest — 118 tests across 8 test files in `server/*.test.ts` |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Enrichment APIs | Google Books, Apify cheerio-scraper, Replicate flux-schnell, Perplexity Sonar, Wikipedia |
| Animation | Framer Motion, React Three Fiber + Drei (sparkles canvas) |

> **Flowbite version pin:** flowbite-react is pinned to `0.12.16`. Do NOT upgrade to
> `0.12.17+` — those versions introduce `oxc-parser` which has a native binding that
> fails in the deployment environment.

---

## File Structure

```
client/src/
  pages/
    Home.tsx               ← Main library view (Authors / Books / Audiobooks tabs)
    Preferences.tsx        ← Admin panel: enrichment controls, S3 mirror, themes, LLM selector
    ResearchCascade.tsx    ← Enrichment pipeline waterfall stats (live DB counts)
    FlowbiteDemo.tsx       ← Component showcase (dev only)
    NotFound.tsx           ← 404 page with breadcrumb
  components/
    FlowbiteAuthorCard.tsx  ← Primary author card (cover strip + hover tooltips + 3 hotspots)
    AuthorModal.tsx         ← Full author detail modal (bio, avatar, social links, avatar gen)
    BookModal.tsx           ← Full book detail modal (cover, summary, rating, Amazon link)
    AuthorAccordionRow.tsx  ← Accordion view row (same 3-hotspot model as card)
    DashboardLayout.tsx     ← Sidebar layout wrapper (Preferences, ResearchCascade)
    CategoryChart.tsx       ← ECharts category breakdown chart
    CoverLightbox.tsx       ← Full-screen cover image viewer (Framer Motion)
    CardGridSparkles.tsx    ← R3F sparkles canvas overlay over card grid
    AvatarUpload.tsx        ← Click-to-upload author avatar with crop modal
    AvatarCropModal.tsx     ← react-image-crop circular crop + zoom
    PageHeader.tsx          ← Breadcrumb nav bar for non-home pages
    AnimatedIcons.tsx       ← Phosphor icon wrappers with motion
    FileTypeIcons.tsx       ← Content-type icon map
  lib/
    libraryData.ts          ← Static author/book data (generated from Drive scan)
    audioData.ts            ← Static audiobook data (generated from Drive scan)
    authorAliases.ts        ← canonicalName() normalization function
    authorBios.json         ← Static bio cache (JSON, used as first-pass before DB)
server/routers/
  library.router.ts         ← Drive sync, author/book list queries
  authorProfiles.router.ts  ← Bio, avatar, social link enrichment; getAllBios; generatePortrait
  bookProfiles.router.ts    ← Summary, cover, rating enrichment; enrichAllMissingSummaries
  apify.router.ts           ← Apify Amazon scrape + S3 mirror for covers and avatars
  cascade.router.ts         ← ResearchCascade waterfall stats (authorStats + bookStats)
  llm.router.ts             ← LLM model list + test ping
  index.ts                  ← Merges all routers into appRouter
drizzle/
  schema.ts                 ← Four tables: users, author_profiles, book_profiles, sync_status
scripts/
  batch-scrape-covers.mjs   ← Standalone CLI: Amazon scrape + S3 mirror (nightly cron)
  detect-duplicates.mjs     ← Detect duplicate book entries in DB (3 patterns)
  remove-duplicates.mjs     ← Remove near-duplicate book entries (scored, with backup)
```

---

## Database Schema

### `author_profiles` — keyed by `authorName` (canonical display name)

| Column | Type | Notes |
|---|---|---|
| `authorName` | varchar(255) PK | Canonical name, e.g. "Adam Grant" |
| `bio` | text | LLM/Wikipedia-generated bio |
| `avatarUrl` | text | External avatar URL (original source) |
| `s3AvatarUrl` | text | CDN URL for mirrored avatar |
| `s3AvatarKey` | varchar(500) | S3 key for mirrored avatar |
| `avatarSource` | enum | `wikipedia | tavily | apify | ai | NULL (no avatar) |
| `websiteUrl` | text | Author's website |
| `twitterUrl` | text | Twitter/X profile URL |
| `linkedinUrl` | text | LinkedIn profile URL |
| `enrichedAt` | bigint | UTC ms timestamp |

### `book_profiles` — keyed by `titleKey` (lowercase slug)

| Column | Type | Notes |
|---|---|---|
| `titleKey` | varchar(255) PK | Lowercase slug, e.g. "hidden-potential" |
| `bookTitle` | varchar(500) | Display title |
| `authorName` | varchar(255) | Author display name |
| `summary` | text | Google Books / LLM summary |
| `coverImageUrl` | text | External cover URL (`not-found` or `skipped` if failed) |
| `s3CoverUrl` | text | Mirrored CDN URL |
| `s3CoverKey` | varchar(500) | S3 key |
| `rating` | decimal(3,1) | Google Books rating (0 = not available) |
| `ratingCount` | int | Number of ratings |
| `amazonUrl` | text | Amazon product page URL |
| `enrichedAt` | bigint | UTC ms timestamp |

### `sync_status` — single row tracking last Drive sync

| Column | Notes |
|---|---|
| `lastSyncedAt` | UTC ms timestamp of last successful Drive scan |
| `authorCount` | Number of author folders found |
| `bookCount` | Number of book folders found |

---

## Key Conventions

### Author Name Normalization
Always use `canonicalName(rawName)` from `client/src/lib/authorAliases.ts` before
any DB lookup or map access. The same author may appear as "Adam Grant",
"Adam M. Grant", or "Grant, Adam" in raw Drive data.

### Book Deduplication (Two Layers — Never Add a Third)
Books are deduplicated by `titleKey` (lowercase slug) at exactly **two layers**:
1. `filteredAuthors` in `Home.tsx` — before passing to cards (Map<titleKey, BookRecord>)
2. `dedupedBooks` in `FlowbiteAuthorCard.tsx` — safety net inside the card (Set<string>)

The `titleKey` derivation strips the ` - Author` suffix from Drive folder names:
```ts
const titleKey = name.includes(" - ")
  ? name.slice(0, name.lastIndexOf(" - ")).trim().toLowerCase()
  : name.trim().toLowerCase();
```

Do not add a third dedup layer — it will cause books to disappear from cards.

### Tooltip Pattern (Radix `Tooltip`)
- **Author bio tooltip:** `bio` prop on `FlowbiteAuthorCard` — `authorBios.json` first,
  then `dbBioMap` from `getAllBios` tRPC query as fallback. Only shown when bio is available.
- **Book cover tooltip:** `bookInfoMap` prop — `Map<titleKey, { summary, rating, ratingCount }>`
  built from `bookCoversQuery` in `Home.tsx`. Shows title, summary snippet, and ★ rating badge.
  Rating badge only appears when `rating > 0`.

### FlowbiteAuthorCard — 3 Hotspot Model
The card has exactly three interactive zones:
1. **Avatar + author name group** → opens `AuthorModal`
2. **Book title / mini cover thumbnail** → opens `BookModal`
3. **Card surface (anywhere else)** → opens bio panel in parent via `onBioClick`

All other elements (category chip, Bio ready dot, resource pills) are non-interactive.
Do not add new click handlers outside these three zones.

### S3 Storage
Use `storagePut(key, buffer, contentType)` from `server/storage.ts`. Key conventions:
- Author avatars (AI-generated): `author-avatars/ai-<8-char-hex>.jpg`
- Author avatars (real): `author-avatars/<8-char-hex>.jpg`
- Book covers: `book-covers/<8-char-hex>.<ext>`

Never store file bytes in the database. Store only the S3 key and CDN URL.

### Enrichment Procedures

| Procedure | What it does |
|---|---|
| `authorProfiles.enrich` | Single author: Wikipedia → Perplexity → LLM fallback |
| `authorProfiles.enrichBatch` | Batch: same pipeline for multiple authors |
| `authorProfiles.generatePortrait` | Replicate flux-schnell → S3 → DB |
| `authorProfiles.getAllBios` | Returns all rows with non-empty bio (for tooltip map) |
| `bookProfiles.enrichOne` | Single book: Google Books API → LLM fallback |
| `bookProfiles.enrichAllMissingSummaries` | Batch all books with no summary |
| `bookProfiles.getSummaryStats` | Returns { total, withSummary, missing } counts |
| `apify.scrapeNextMissingCover` | One book: Amazon scrape + mirror batch of 3 |

### Multi-Author Splitting
Authors with combined names (e.g. "Aaron Ross and Jason Lemkin") are split into
individual cards in `filteredAuthors`. The `dbPhotoMap` in `Home.tsx` is extended to
add individual name keys from combined entries so each split author gets their avatar.

---

## Design System

**Philosophy:** Editorial Intelligence — a private library aesthetic with Swiss Modernist
typography and warm paper tones.

| Token | Value |
|---|---|
| Heading font | IBM Plex Sans Bold / SemiBold |
| Body font | Inter / DM Sans |
| Mono font | JetBrains Mono |
| Background | Warm off-white `oklch(0.98 0.005 80)` |
| Foreground | Deep charcoal `oklch(0.235 0.015 65)` |
| Border radius | `0.65rem` |
| Card left border | 3px solid, category accent color |

**Multi-theme support:** Three themes — Manus (default), Norfolk AI, Noir Dark — are
defined as CSS variable sets in `client/src/index.css`. The active theme is stored in
`localStorage` via `AppSettingsContext` and applied via `ThemeProvider` in `App.tsx`.

**Category color system** (defined in `libraryData.ts`):

| Category | Accent |
|---|---|
| Business & Entrepreneurship | `#b45309` (amber) |
| Behavioral Science & Psychology | `#7c3aed` (violet) |
| Sales & Negotiation | `#0369a1` (sky blue) |
| Leadership & Management | `#065f46` (emerald) |
| Self-Help & Productivity | `#b91c1c` (rose) |
| Communication & Storytelling | `#c2410c` (orange) |
| Technology & Futurism | `#1d4ed8` (blue) |
| Strategy & Economics | `#374151` (slate) |
| History & Biography | `#92400e` (brown) |

---

## Google Drive Structure

```
Norfolk Consulting Group/
├── Authors/
│   └── [Category]/
│       └── [Author Name - Specialty]/
│           └── [Book Title]/
│               ├── PDF/  Binder/  Transcript/  Audio/
├── Books/
│   └── [Category]/
│       └── [Book Title - Author]/
│           ├── PDF/  Binder/  Transcript/
└── Books Audio/
    └── [Book Title]/
        ├── MP3/  M4B/  AAX/
```

**Key Google Drive Folder IDs:**

| Folder | ID |
|---|---|
| Authors (root) | `119tuydLrpyvavFEouf3SCq38LAD4_ln5` |
| Author Avatars | `1XGBfvnqN3W9LFpFJjqhDEZVBRPrXGf9W` |
| Bios | `1DDxUQhlMmqudPFzkp5oOjru1zZd_XAl-` |

---

## Environment Variables

All secrets are injected by the Manus platform — never hardcode or commit them.

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Drizzle ORM (MySQL/TiDB) |
| `JWT_SECRET` | Session cookie signing |
| `APIFY_API_TOKEN` | Apify Amazon scraper |
| `BUILT_IN_FORGE_API_URL` | Manus S3 / LLM / notification APIs |
| `BUILT_IN_FORGE_API_KEY` | Server-side Forge bearer token |
| `VITE_FRONTEND_FORGE_API_KEY` | Client-side Forge bearer token |
| `PERPLEXITY_API_KEY` | Perplexity Sonar bio enrichment |
| `REPLICATE_API_TOKEN` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | Tavily image search |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema (drizzle-kit generate && migrate)
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (118 tests, 8 files)
pnpm build          # production build
npx tsc --noEmit    # type check — ALWAYS trust this over the watcher
```

---

## Scheduled Jobs

A nightly cron runs `scripts/batch-scrape-covers.mjs` at **2am CDT (07:00 UTC)**
via the Manus scheduler. It scrapes Amazon for any books missing `coverImageUrl`,
then mirrors all pending covers to S3. The script is idempotent and safe to re-run.

---

## Test Files

| File | What it tests |
|---|---|
| `library.test.ts` | Drive sync, author/book list queries |
| `author-aliases.test.ts` | `canonicalName()` normalization |
| `batch-enrich.test.ts` | Batch enrichment pipeline |
| `sort-and-profiles.test.ts` | Sorting, filtering, profile queries |
| `apify.test.ts` | Amazon scrape + S3 mirror logic |
| `generate-avatar.test.ts` | Replicate portrait generation |
| `batch-avatars.test.ts` | Batch portrait pipeline |
| `auth.logout.test.ts` | Auth logout flow |

---

## Reusable Skills (in `/home/ubuntu/skills/`)

These skills were created from patterns discovered in this project:

| Skill | Description |
|---|---|
| `book-cover-scrape-mirror` | Batch Amazon scrape + S3 mirror for book covers |
| `book-cover-dedup` | Detect and remove duplicate book cover entries (DB + UI) |
| `book-profile-enrichment` | Google Books + LLM enrichment pipeline for book summaries |
| `author-bio-enrichment` | Wikipedia + Perplexity + LLM bio enrichment pipeline |
| `library-content-enrichment` | Full enrichment workflow (avatars, bios, covers) |
| `webdev-card-system` | Flowbite card + modal system with 3-hotspot model |
| `webdev-flowbite` | Flowbite React + Tailwind v4 integration |
| `webdev-theme-aware-cards` | Theme-aware card backgrounds (bg-card pattern) |
| `webdev-visualizations` | ECharts + React Flow + Nivo charts |
| `skill-creation-workflow` | How to package a repeatable process into a skill |

---

## Avatar Generation Pipeline

### Architecture — 5-Stage Meticulous Pipeline

The pipeline lives in `server/lib/authorAvatars/` and runs sequentially:

| Stage | File | What it does |
|---|---|---|
| 1 — Research | `authorResearcher.ts` | Wikipedia + Tavily + Apify in parallel → `AuthorResearchData` |
| 2 — Vision Analysis | `authorResearcher.ts` | Gemini Vision (multimodal) or Claude → `AuthorDescription` JSON (cached in DB) |
| 3 — Prompt Build | `promptBuilder.ts` | Converts `AuthorDescription` → vendor-specific `ImagePromptPackage` |
| 4 — Image Gen | `imageGenerators/google.ts` or `replicate.ts` | Generates image bytes/URL |
| 5 — Storage | `meticulousPipeline.ts` | Uploads to S3, updates DB `s3AvatarUrl` |

If a real photo is found at Stage 1 and passes Gemini validation, the pipeline stops there. Only authors with no real photo reach Stage 4 (AI generation).

### Research LLM (Stage 2)

- **Default vendor:** Google (`gemini-2.5-flash`) — multimodal, inlines up to 4 reference photos as base64 image parts
- **Alternative vendor:** Anthropic (`claude-sonnet-4-5-20250929`) — text-only (no image inlining), falls back to Gemini if `ANTHROPIC_API_KEY` is missing
- The `AuthorDescription` JSON is cached in `author_profiles.authorDescriptionJson` — subsequent regenerations skip Stage 1–2 unless `forceRefresh: true`

### Image Generation (Stage 4) — Vendor Capabilities

| Vendor | Model | Controllable Params |
|---|---|---|
| Google | `nano-banana` (gemini image) | None — model-determined output (typically 1024×1024 PNG) |
| Google | `imagen-3` | `aspectRatio` only: `1:1`, `3:4`, `4:3`, `9:16`, `16:9` |
| Replicate | `flux-schnell` | `aspect_ratio`, `output_format`, `output_quality`, `num_inference_steps` (default 4) |
| Replicate | `flux-dev` / `flux-pro` | All of the above + `guidance_scale`, `width`, `height` (custom) |

**Default model:** `nano-banana` (Google Gemini image model) — fast, no cost per token, good quality for professional headshots.

### Resolution System (Planned — see todo.md)

The following resolution parameters are planned but not yet implemented:

```typescript
// To be added to ImageGenerationRequest (types.ts)
aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "custom";
width?: number;           // Replicate only, 256–1440 (multiples of 64)
height?: number;          // Replicate only, 256–1440 (multiples of 64)
outputFormat?: "webp" | "png" | "jpg";  // Replicate only
outputQuality?: number;   // 1–100, Replicate only (not for PNG)
guidanceScale?: number;   // 0–10, Replicate flux-dev/pro only
numInferenceSteps?: number; // 1–50, Replicate only
```

Once implemented, these will be user-configurable in the Admin Console → AI tab → Avatar Generation sub-tab.

### Key Rules

- **Never pass `aspectRatio` to Gemini image models** — only `generateImages` (Imagen 3) supports it; `generateContent` (Gemini image) does not.
- **`authorAvatars.ts` takes priority** over DB — if an author has an entry in this static map, the DB `s3AvatarUrl` is never queried for that author's card display.
- **`authorDescriptionJson` caching** — always check `useCache` flag before re-running Stage 1–2. The cache is per-author in `author_profiles.authorDescriptionJson`.

---

## Common Pitfalls

**Stale TS watcher errors** — The incremental TypeScript watcher (`tsx watch`) can
show cached errors from before a fix. Always trust `npx tsc --noEmit` over the
watcher output. Clear the cache with `rm -f node_modules/.cache/typescript*` and
restart the server if needed.

**`bookInfoMap` vs `bookSummaryMap`** — The prop was renamed from `bookSummaryMap`
to `bookInfoMap` when rating data was added. If you see a TS error about
`bookSummaryMap`, it has been removed — use `bookInfoMap`.

**Protected vs public procedures** — Enrichment mutations use `publicProcedure`
(no auth required for internal library tools). Only user-specific operations use
`protectedProcedure`.

**No local image assets** — All images must be uploaded to CDN via
`manus-upload-file --webdev` and referenced by URL. Never put images in
`client/public/` or `client/src/assets/`.

**flowbite-react version** — Do NOT upgrade past `0.12.16`. The `0.12.17+` versions
introduce `oxc-parser` which fails in the Manus deployment environment.

**Vite version** — Pinned to `6.x`. Do NOT upgrade to Vite 7 — the deployment
environment runs Node.js 20.15.1 which is below Vite 7's minimum of 20.19+.

**Pending DB duplicates** — 10 books share the same S3 cover URL (different title
variants for the same book) and 1 exact duplicate ("The Jolt Effect", ids 98 and
30005) are flagged for manual review. Run `node scripts/detect-duplicates.mjs` to
see the current state before any bulk operations.

---

## Scan Scripts (in `/home/ubuntu/`)

These Python scripts regenerate `libraryData.ts` and `audioData.ts` from Google Drive.

| Script | Purpose |
|---|---|
| `rescan_library.py` | Full deep scan → `library_scan_results.json` |
| `final_audio_move_v2.py` | Move audio files into Books Audio |
| `organize_authors.py` | Initial categorization of author folders |
| `organize_books.py` | Initial categorization of book folders |

All scripts use the `gws` CLI. Run with `python3.11 -u <script>.py`.

---

*Last updated: March 22, 2026 — Ricardo Cidale's Library v2.2 — Avatar pipeline architecture documented; resolution system planned*
