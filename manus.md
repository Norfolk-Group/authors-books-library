# Ricardo Cidale's Authors & Books Library

## Standing Rules

**Last Updated:** April 2, 2026 — Todo audit (141 items verified done), sidebar layout fix (Tailwind 4 w-[var(--sidebar-width)]), tRPC POST override, em-dash author splits fixed, shadcn components installed, validator architecture documented, dependency contracts updated

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
      Home.tsx                         → Main library UI orchestrator (~814 lines)
      Admin.tsx                        → Admin Console orchestrator (~1493 lines)
      AuthorDetail.tsx                 → Author detail page (~728 lines)
      BookDetail.tsx                   → Book detail page (~563 lines)
      AuthorCompare.tsx                → Author comparison page (~383 lines)
      Leaderboard.tsx                  → Author leaderboard page (~319 lines)
      NotFound.tsx                     → 404 page
    components/
      library/                         → Library card/panel components
        LibrarySidebar.tsx             → Extracted sidebar (category filters, search, sort, view toggle) (~294 lines)
        BookCard.tsx                   → Single book card with cover thumbnail (~492 lines)
        AudioCard.tsx                  → Single audio book card (~102 lines)
        AuthorCard.tsx                 → Author card for library view (~285 lines)
        AuthorBioPanel.tsx             → Author bio slide-over panel (~659 lines)
        BookDetailPanel.tsx            → Book detail slide-over panel (~575 lines)
      admin/                           → Admin tab components
        AiTab.tsx                      → AI model selection tab (~203 lines, slim orchestrator)
        ModelSelector.tsx              → Vendor/model selector with Auto-Recommend button (~606 lines)
        BackgroundSelector.tsx         → Avatar background color picker (~159 lines)
        BatchRegenSection.tsx          → Batch regeneration controls (~146 lines)
        AvatarDetailTable.tsx          → Avatar audit detail table (~140 lines)
        AvatarResolutionControls.tsx   → Avatar resolution settings (~150 lines)
        DependenciesTab.tsx            → Native vs third-party dependency registry (~1004 lines)
        ToolHealthCheckTab.tsx         → Service health check runner (~481 lines)
        InformationToolsTab.tsx        → Information tools reference (~523 lines)
        CascadeTab.tsx                 → Research cascade stats display (~188 lines)
        AboutTab.tsx                   → App info and version (~73 lines)
        ActionCard.tsx                 → Reusable action card with progress (~148 lines)
        adminTypes.ts                  → Shared admin types (~45 lines)
      FlowbiteAuthorCard.tsx           → Author card (grid view, 3D tilt, avatar, book list) (~622 lines)
      AuthorAccordionRow.tsx           → Accordion list row for author (~379 lines)
      AuthorModal.tsx                  → Author detail modal (~305 lines)
      AuthorCardActions.tsx            → Author card action buttons (~303 lines)
      BackToTop.tsx                    → Floating back-to-top button (~69 lines)
      CoverLightbox.tsx                → Full-screen book cover viewer (~114 lines)
      AvatarCropModal.tsx              → Avatar upload + crop editor (~215 lines)
      AvatarUpload.tsx                 → Camera overlay → file picker → crop → S3 (~231 lines)
      FloatingBooks.tsx                → 3D floating book shapes (Three.js/Fiber decorative bg) (~116 lines)
    contexts/
      AppSettingsContext.tsx           → App settings (theme, icon set, LLM model, view mode)
                                         Replaces former ThemeContext.tsx (removed). Use useAppSettings() or useThemeCompat().
      IconContext.tsx                  → Icon set context (used by iconSets/)
    hooks/
      useLibraryData.ts                → Extracted data hooks + filtering logic (~457 lines)
      useConfetti.ts                   → No-op confetti stub (dependency removed)
    lib/
      libraryData.ts                   → Auto-generated Drive scan data (112 authors, 183 books, 9 categories) (~1981 lines)
                                         Re-exports all constants from libraryConstants.ts for backward compatibility.
      libraryConstants.ts              → Static constants extracted from libraryData.ts (~131 lines)
                                         (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, CONTENT_TYPE_ICONS,
                                          CONTENT_TYPE_COLORS, LIBRARY_STATS, CATEGORIES, BookEntry/AuthorEntry/BookRecord types)
      audioData.ts                     → Auto-generated audiobooks data (45 titles)
      authorAvatars.ts                 → Static author name → S3 CDN URL map
      authorAliases.ts                 → Drive folder name → display name normalization map
      iconSets/
        phosphorRegular.ts             → Phosphor regular icon set catalogue
        phosphorDuotone.tsx            → Phosphor duotone icon set catalogue
      trpc.ts                          → tRPC client binding
server/
  routers/                             → tRPC routers (feature-split)
    authorProfiles.router.ts           → Core CRUD + merges 3 sub-routers (~498 lines)
    authorAvatar.router.ts             → Avatar generation, upload, audit, normalize, stats (~484 lines)
    authorEnrichment.router.ts         → Rich bio, academic, enterprise, professional, document enrichment (~570 lines)
    authorSocial.router.ts             → Social stats, platform discovery, Twitter, business profile (~662 lines)
    authorChatbot.router.ts            → Author impersonation chatbot (RAG-grounded, multi-turn)
    bookProfiles.router.ts             → Book CRUD + enrichment procedures (~975 lines)
    library.router.ts                  → Google Drive scanning + TS code generation
    apify.router.ts                    → Amazon scraping + S3 mirroring
    cascade.router.ts                  → Research cascade stats
    admin.router.ts                    → Action log tracking
    llm.router.ts                      → Multi-vendor LLM router (~133 lines); data in server/lib/llmCatalogue.ts
    healthCheck.router.ts              → Service health check procedures
    ragPipeline.router.ts              → Digital Me RAG file generation pipeline (Claude Opus primary)
    userInterests.router.ts            → User personal interest CRUD + scoring
    contextualIntelligence.router.ts   → 8-source biographical research waterfall
    syncJobs.router.ts                 → S3-to-Dropbox/Drive sync job management
    appSettings.router.ts              → Key-value app settings CRUD
    scheduling.router.ts               → Enrichment schedule management
    favorites.router.ts                → User favorites (authors/books)
  lib/
    llmCatalogue.ts                    → Multi-vendor LLM catalogue: 13 vendors, 47 models, recommendation engine (~899 lines)
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
  db.ts                                → Drizzle DB connection + base query helpers
  storage.ts                           → S3 upload/download via Manus Forge API
  drizzle/
  schema.ts                            → All 18 table definitions
  relations.ts                         → Drizzle relations
shared/
  const.ts                             → Google Drive folder IDs, auth constants
  types.ts                             → Shared TypeScript types
scripts/                               → One-off enrichment and maintenance scripts (17 files)
  README.md                            → Script usage guide
  backfill-*.ts                        → Wikipedia backfill scripts
  batch-*.mjs                          → Batch processing scripts
  enrich-*.ts                          → Enrichment pipeline scripts
  run-*.mjs / run-*.ts                 → Pipeline runners
  detect-duplicates.mjs / remove-duplicates.mjs → Duplicate management
  fix-alan-dib-covers.mjs              → One-off cover fix
  retry-*.ts                           → Retry failed enrichments
```

---

## Database Schema (18 Tables)

| Table | Purpose | Key Columns |
|---|---|---|
| `author_profiles` | Core author records | `id`, `driveId`, `authorName`, `category`, `displayName`, `bio`, `richBio`, `avatarUrl`, `coverImageUrl`, `rating`, `bioCompleteness`, `geographyJson`, `historicalContextJson`, `familyJson`, `associationsJson`, `formativeExperiencesJson`, `authorBioSourcesJson` |
| `book_profiles` | Core book records | `id`, `driveId`, `authorName`, `name`, `category`, `coverImageUrl`, `s3CoverUrl`, `amazonUrl`, `richSummary`, `rating`, `format`, `possessionStatus` |
| `author_rag_profiles` | Digital Me RAG files | `authorName`, `ragFileUrl`, `ragFileKey`, `ragVersion`, `ragGeneratedAt`, `ragWordCount`, `ragModel`, `ragStatus` |
| `content_items` | Universal content model (all types) | `id`, `title`, `contentType`, `authorName`, `coverImageUrl`, `url`, `includedInLibrary` |
| `author_content_links` | M:M authors ↔ content | `authorName`, `contentItemId` |
| `content_files` | S3 file tracking per content item | `contentItemId`, `fileKey`, `fileUrl`, `mimeType` |
| `ingest_sources` | Tracks content origin | `contentItemId`, `source`, `sourceId`, `ingestedAt` |
| `author_subscriptions` | Periodic refresh subscriptions | `authorName`, `platform`, `interval`, `lastRefreshedAt` |
| `sync_jobs` | S3-to-Dropbox/Drive sync runs | `id`, `status`, `target`, `filesTotal`, `filesSynced`, `filesSkipped`, `errors`, `startedAt`, `completedAt` |
| `user_interests` | User personal interest graph | `id`, `userId`, `topic`, `description`, `weight`, `category`, `color`, `sortOrder` |
| `author_interest_scores` | Author ↔ interest alignment scores | `authorName`, `interestId`, `userId`, `score`, `reasoning`, `scoredAt` |
| `app_settings` | Key-value app configuration | `key`, `value`, `updatedAt` |
| `users` | Auth users | `id`, `openId`, `name`, `email`, `role`, `createdAt` |
| `favorites` | User-saved authors/books | `userId`, `entityType`, `entityId` |
| `enrichment_schedules` | Scheduled enrichment runs | `authorName`, `enrichmentType`, `cronExpr`, `nextRunAt` |
| `enrichment_jobs` | Enrichment job history | `authorName`, `enrichmentType`, `status`, `startedAt`, `completedAt` |
| `admin_action_log` | Admin action audit trail | `userId`, `action`, `entityType`, `entityId`, `details`, `createdAt` |
| `sync_status` | Sync state per author/book | `entityType`, `entityId`, `target`, `lastSyncedAt`, `syncStatus` |
| `action_log` | Admin action history | `id`, `action`, `authorId`, `details`, `createdAt` |
| `users` | Auth users | `id`, `openId`, `name`, `email`, `role`, `createdAt` |

**Key fields added in recent sessions:**
- `author_profiles.possession` — `owned` | `wishlist` | `reading` | `read`
- `author_profiles.format` — `digital` | `physical` | `audio` | `both`
- `book_profiles.possession` — same enum as author
- `book_profiles.format` — same enum as author

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
│   │   └── Originals/
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
├── Author Name — Book Title.mp3
└── ...
```

Audio files are flat (no subfolders). The scanner matches them to author profiles by name.

---

## LLM Catalogue (server/lib/llmCatalogue.ts)

The multi-vendor LLM catalogue data lives in `server/lib/llmCatalogue.ts` (~899 lines). The `llm.router.ts` router (~133 lines) imports from it. **Do not add vendor/model data directly to the router.**

**13 vendors, 47 models** as of March 2026:

| Vendor | Key Models |
|---|---|
| OpenAI | gpt-4o, gpt-4o-mini, o1, o3-mini, o4-mini |
| Anthropic | claude-opus-4, claude-sonnet-4, claude-3-7-sonnet, claude-3-5-haiku |
| Google | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-pro |
| Meta | llama-3.3-70b, llama-3.1-405b |
| Mistral | mistral-large-2, mistral-small-3 |
| Cohere | command-r-plus, command-r |
| xAI | grok-3, grok-3-mini |
| DeepSeek | deepseek-r1, deepseek-v3 |
| Perplexity | sonar-pro, sonar |
| Amazon | nova-pro, nova-lite |
| Microsoft | phi-4, phi-3.5-mini |
| IBM | granite-3.3-8b |
| Manus | manus-default |

The recommendation engine (`getRecommendedModels`) maps task types (bio generation, cover scraping, social enrichment, etc.) to optimal vendor/model combinations.

---

## Avatar Waterfall (5 Tiers)

The avatar resolution pipeline in `server/lib/authorAvatars/waterfall.ts` tries sources in order:

| Tier | Source | Description |
|---|---|---|
| 1 | S3 CDN | Previously uploaded custom or generated avatar |
| 2 | Tavily | Web image search for author photo |
| 3 | Wikipedia | Wikipedia infobox photo |
| 4 | Google Imagen | AI-generated portrait (Google Imagen 3) |
| 5 | Replicate Flux | AI-generated portrait (Replicate Flux) |

Gemini vision validates photos before accepting them (checks for real person, professional quality, correct identity).

---

## Testing

The project uses Vitest with **492 passing tests** across **34 test files** in `server/*.test.ts`. Run with:
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
- `server/lib/authorAvatars/googleImagenGeneration.test.ts` — Google Imagen generation

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
| `/chat/:slug` | `AuthorChatbot.tsx` | Public |
| `/interests/heatmap` | `InterestHeatmap.tsx` | Public |
| `/interests/contrast` | `GroupContrast.tsx` | Public |
| `/privacy` | `PrivacyPolicy.tsx` | Public |
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
13. **Sidebar open by default** — `SidebarProvider defaultOpen={true}` in Home.tsx.
14. **AppSettingsContext is the theme authority** — `ThemeContext.tsx` has been removed. Use `useAppSettings()` from `AppSettingsContext.tsx` for theme state. The `useThemeCompat()` export provides a backward-compatible `appTheme`/`theme`/`toggleTheme` API.

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

> **Router split note:** The former monolithic `authorProfiles.router.ts` was split into 4 routers. Skill references to `authorProfiles.router.ts` for avatar/enrichment/social procedures now apply to `authorAvatar.router.ts`, `authorEnrichment.router.ts`, and `authorSocial.router.ts` respectively.

> **LLM catalogue note:** The vendor catalogue data was extracted from `llm.router.ts` into `server/lib/llmCatalogue.ts`. The router file is now ~133 lines (down from ~1006). Import catalogue types and data from `server/lib/llmCatalogue.ts`.

> **libraryData note:** Static constants (CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS, etc.) were extracted into `client/src/lib/libraryConstants.ts`. `libraryData.ts` re-exports them for backward compatibility. New code should import constants from `libraryConstants.ts` directly.

---

## Author Name Validator Architecture

The author name validator (`shared/authorNameValidator.ts`) prevents false-positive author records from being created. It is applied at **three entry points**:

| Entry Point | File | Behavior |
|---|---|---|
| Drive scanner | `server/routers/library.router.ts` | Skips folders whose name fails validation; logs a warning |
| Create author procedure | `server/routers/authorProfiles.router.ts` | Throws a typed error if name fails; admin bypass flag available |
| Add Author form | `client/src/components/library/AuthorFormDialog.tsx` | Shows inline error message before submission |

**Validation rules** (`isLikelyAuthorName()`):
- Minimum 2 words
- No content-type keywords (PDF, Transcript, Audio, Video, Summary, etc.)
- No topic phrases (e.g., "active listening", "conflict resolution")
- No single common nouns
- Blocklist of known bad names (`KNOWN_BAD_AUTHOR_NAMES`)

**Admin bypass:** Pass `allowAdminOverride: true` in the `createAuthor` procedure input to bypass validation for edge cases.

**Tests:** 29 vitest tests in `server/authorNameValidator.test.ts` covering valid names, edge cases, and known bad examples.

---

## External Dependency Contracts

All external services used by the app, their purpose, and where credentials are stored:

| Service | Purpose | Credential | Where Used |
|---|---|---|---|
| Google Drive API | Drive folder scanning, file listing | `GOOGLE_DRIVE_PARENT_FOLDER_ID` (env) | `server/enrichment/gdrive.ts`, `library.router.ts` |
| Google Imagen 3 | AI avatar generation (Tier 4) | `GEMINI_API_KEY` (env) | `server/lib/authorAvatars/googleImagenGeneration.ts` |
| Gemini Vision | Avatar photo validation | `GEMINI_API_KEY` (env) | `server/lib/authorAvatars/geminiValidation.ts` |
| Replicate Flux | AI avatar generation (Tier 5) | `REPLICATE_API_TOKEN` (env) | `server/lib/authorAvatars/replicateGeneration.ts` |
| Tavily | Web image search for avatars (Tier 2) | `TAVILY_API_KEY` (env) | `server/lib/authorAvatars/tavily.ts` |
| Wikipedia / Wikidata | Author photos (Tier 3), bio data, social links | None (public API) | `server/lib/authorAvatars/wikipedia.ts`, `server/enrichment/wikipedia.ts` |
| Perplexity | Rich bio generation, biographical research | `PERPLEXITY_API_KEY` (env) | `server/enrichment/richBio.ts`, `server/routers/contextualIntelligence.router.ts` |
| Anthropic Claude Opus | RAG generation, Digital Me synthesis, contrast scoring | `ANTHROPIC_API_KEY` (env) | `server/routers/ragPipeline.router.ts`, `server/_core/llm.ts` |
| Google Gemini 2.5 Pro | Secondary LLM, fallback for synthesis | `GEMINI_API_KEY` (env) | `server/_core/llm.ts` |
| OpenAI | Tertiary LLM option | `OPENAI_API_KEY` (env, optional) | `server/_core/llm.ts` |
| Apify | Amazon book cover scraping | `APIFY_API_TOKEN` (env) | `server/routers/apify.router.ts` |
| RapidAPI | Yahoo Finance stats | `RAPIDAPI_KEY` (env) | `server/enrichment/rapidapi.ts` |
| Twitter Bearer | Twitter follower counts | `TWITTER_BEARER_TOKEN` (env) | `server/enrichment/twitter.ts` |
| YouTube Data API | Channel stats | `YOUTUBE_API_KEY` (env) | `server/enrichment/youtube.ts` |
| Dropbox OAuth 2 | S3-to-Dropbox sync target | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` (env); refresh token in `app_settings` DB | `server/dropboxAuth.ts`, `server/routers/syncJobs.router.ts` |
| Manus Forge S3 | File storage (avatars, covers, RAG files) | `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_API_URL` (env) | `server/storage.ts` |
| Context7 MCP | Technical documentation lookup | None (free public API) | `server/enrichment/context7.ts`, `server/routers/healthCheck.router.ts` |
| Manus OAuth | User authentication | `VITE_APP_ID`, `JWT_SECRET`, `OAUTH_SERVER_URL` (env) | `server/_core/oauth.ts` |
| TiDB / MySQL | Primary database | `DATABASE_URL` (env) | `server/db.ts`, all routers |
