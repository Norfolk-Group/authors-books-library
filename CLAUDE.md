# CLAUDE.md — NCG Knowledge Library

This file provides context for AI coding assistants (Claude Code, Manus, Gemini CLI, etc.)
working on this codebase. Read this before making any changes.

---

## Project Overview

**NCG Knowledge Library** (`authors-books-library`) is a personal digital library
for Ricardo Cidale / Norfolk Consulting Group. It displays 109 authors and 178
books sourced from a Google Drive folder hierarchy, enriched with AI-generated
bios, author portraits, book cover images, ratings, and summaries.

**Live URL:** `https://authlib-ehsrgokn.manus.space`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Flowbite React, shadcn/ui, Radix UI |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL / TiDB (via `DATABASE_URL`) |
| File storage | Manus S3 CDN (`storagePut` / `storageGet` in `server/storage.ts`) |
| Auth | Manus OAuth (`/api/oauth/callback`, `protectedProcedure`) |
| Build | Vite 6, esbuild, TypeScript 5.9 |
| Testing | Vitest — 118 tests, all in `server/*.test.ts` |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| Enrichment APIs | Google Books, Apify cheerio-scraper, Replicate flux-schnell, Perplexity Sonar, Wikipedia |

---

## File Structure

```
client/src/
  pages/
    Home.tsx              ← Main library view (Authors / Books / Audiobooks tabs)
    Preferences.tsx       ← Admin panel: enrichment controls, S3 mirror, themes
    ResearchCascade.tsx   ← Enrichment pipeline waterfall stats
    FlowbiteDemo.tsx      ← Component showcase (dev only)
  components/
    FlowbiteAuthorCard.tsx ← Primary author card with cover strip + hover tooltips
    AuthorModal.tsx        ← Full author detail modal (bio, photo, social links)
    BookModal.tsx          ← Full book detail modal (cover, summary, rating, links)
    DashboardLayout.tsx    ← Sidebar layout wrapper (used on Preferences, ResearchCascade)
    CategoryChart.tsx      ← ECharts category breakdown chart
    CoverLightbox.tsx      ← Full-screen cover image viewer
  lib/
    libraryData.ts         ← Static author/book data (generated from Drive scan)
    audioData.ts           ← Static audiobook data (generated from Drive scan)
    authorAliases.ts       ← canonicalName() normalization function
server/routers/
  library.router.ts        ← Drive sync, author/book list queries
  authorProfiles.router.ts ← Bio, photo, social link enrichment; getAllBios
  bookProfiles.router.ts   ← Summary, cover, rating enrichment; enrichAllMissingSummaries
  apify.router.ts          ← Apify Amazon scrape + S3 mirror for covers
  cascade.router.ts        ← ResearchCascade waterfall stats
  llm.router.ts            ← LLM invocation procedures
drizzle/
  schema.ts                ← Four tables: users, author_profiles, book_profiles, sync_status
scripts/
  batch-scrape-covers.mjs  ← Standalone CLI: Amazon scrape + S3 mirror (nightly cron)
```

---

## Database Schema

### `author_profiles` — keyed by `authorName` (canonical display name)

| Column | Type | Notes |
|---|---|---|
| `authorName` | varchar(255) PK | Canonical name, e.g. "Adam Grant" |
| `bio` | text | LLM/Wikipedia-generated bio |
| `photoUrl` | text | External photo URL |
| `s3PhotoKey` | varchar(500) | S3 key for mirrored portrait |
| `photoSource` | enum | `wikipedia`, `tavily`, `apify`, `ai` |
| `socialLinks` | json | `{ linkedin, twitter, website }` |
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
| `rating` | decimal(3,1) | Google Books rating |
| `ratingCount` | int | Number of ratings |
| `amazonUrl` | text | Amazon product page URL |

---

## Key Conventions

### Author Name Normalization
Always use `canonicalName(rawName)` from `client/src/lib/authorAliases.ts` before
any DB lookup or map access. The same author may appear as "Adam Grant",
"Adam M. Grant", or "Grant, Adam" in raw Drive data.

### Book Deduplication
Books are deduplicated by `titleKey` (lowercase slug) at **two layers**:
1. `filteredAuthors` in `Home.tsx` — before passing to cards
2. `dedupedBooks` in `FlowbiteAuthorCard.tsx` — safety net inside the card

Do not add a third dedup layer — it will cause books to disappear from cards.

### Tooltip Pattern (Radix `Tooltip`)
- **Author bio tooltip:** `bio` prop on `FlowbiteAuthorCard` — JSON bio first, DB bio (`getAllBios` query) as fallback. Only shown when bio is available.
- **Book cover tooltip:** `bookInfoMap` prop — `Map<titleKey, { summary, rating, ratingCount }>` built from `bookCoversQuery` in `Home.tsx`. Shows title, summary snippet, and ★ rating badge.

### S3 Storage
Use `storagePut(key, buffer, contentType)` from `server/storage.ts`. Key conventions:
- Author portraits: `author-photos/ai-<hash>.jpg` (AI-generated) or `author-photos/<hash>.jpg`
- Book covers: `book-covers/<8-char-hex>.<ext>`

Never store file bytes in the database. Store only the S3 key and CDN URL.

### Enrichment Procedures
| Procedure | What it does |
|---|---|
| `authorProfiles.enrich` | Single author: Wikipedia → Perplexity → LLM fallback |
| `authorProfiles.batchEnrich` | Batch: same pipeline for multiple authors |
| `bookProfiles.enrichOne` | Single book: Google Books API → LLM fallback |
| `bookProfiles.enrichAllMissingSummaries` | Batch all books with no summary |
| `apify.scrapeNextMissingCover` | One book: Amazon scrape + mirror batch of 3 |

---

## Design System

**Philosophy:** Editorial Intelligence — a private library aesthetic.

| Token | Value |
|---|---|
| Heading font | Playfair Display (serif) |
| Body font | DM Sans (sans-serif) |
| Background | Warm off-white `#faf9f6` (paper tone) |
| Foreground | Deep charcoal `oklch(0.235 0.015 65)` |
| Border radius | `0.65rem` |
| Card left border | 3px solid, category accent color |

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

**Multi-theme support:** Three themes — Manus (default), Norfolk AI, Noir Dark — are
defined as CSS variable sets in `client/src/index.css`. The active theme is stored in
`localStorage` and applied via `ThemeProvider` in `App.tsx`.

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

**Google Drive Folder IDs:**

| Folder | ID |
|---|---|
| Authors (root) | `119tuydLrpyvavFEouf3SCq38LAD4_ln5` |
| Author Pictures | `1XGBfvnqN3W9LFpFJjqhDEZVBRPrXGf9W` |
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
| `REPLICATE_API_TOKEN` | Replicate flux-schnell portraits |
| `TAVILY_API_KEY` | Tavily image search |

---

## Development Commands

```bash
pnpm install
pnpm db:push        # generate + migrate schema (drizzle-kit generate && migrate)
pnpm dev            # starts Express + Vite on :3000
pnpm test           # vitest (118 tests)
pnpm build          # production build
npx tsc --noEmit    # type check (trust this over the watcher)
```

---

## Common Pitfalls

**Stale TS watcher errors** — The incremental TypeScript watcher (`tsx watch`) can
show cached errors from before a fix. Always trust `npx tsc --noEmit` over the
watcher output. Clear the cache with `rm -f node_modules/.cache/typescript*` and
restart the server.

**`bookInfoMap` vs `bookSummaryMap`** — The prop was renamed from `bookSummaryMap`
to `bookInfoMap` when rating data was added. If you see a TS error about
`bookSummaryMap`, it has been removed.

**Protected vs public procedures** — Enrichment mutations use `publicProcedure`
(no auth required for internal library tools). Only user-specific operations use
`protectedProcedure`.

**No local image assets** — All images must be uploaded to CDN via
`manus-upload-file --webdev` and referenced by URL. Never put images in
`client/public/` or `client/src/assets/`.

---

## Scheduled Jobs

A nightly cron runs `scripts/batch-scrape-covers.mjs` at **2am CDT (07:00 UTC)**
via the Manus scheduler. It scrapes Amazon for any books missing `coverImageUrl`,
then mirrors all pending covers to S3. Logs: `/tmp/nightly-cover-scrape.log`.

---

## Test Files

| File | What it tests |
|---|---|
| `library.test.ts` | Drive sync, author/book list queries |
| `author-aliases.test.ts` | `canonicalName()` normalization |
| `batch-enrich.test.ts` | Batch enrichment pipeline |
| `sort-and-profiles.test.ts` | Sorting, filtering, profile queries |
| `apify.test.ts` | Amazon scrape + S3 mirror logic |
| `generate-portrait.test.ts` | Replicate portrait generation |
| `batch-portraits.test.ts` | Batch portrait pipeline |
| `auth.logout.test.ts` | Auth logout flow |

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

*Last updated: March 17, 2026 — NCG Knowledge Library v2.0 (full-stack)*
