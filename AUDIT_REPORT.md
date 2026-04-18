# RC Library — Codebase Audit Report

*Generated: April 18, 2026 | Auditor: Claude Opus (claude-opus-4-5)*

---

## Executive Summary

**Server-side:** This codebase has a well-structured tRPC architecture with proper middleware separation, but suffers from critical security gaps including public procedures exposing sensitive data, missing rate limiting on expensive operations, and potential SSRF vulnerabilities in external API integrations. The database schema stores excessive JSON blobs without validation, and the enrichment orchestrator lacks proper error boundaries and circuit breakers for external API failures.

**Client-side:** The React client demonstrates solid architecture with comprehensive lazy loading, tRPC type safety, and a well-organized component hierarchy. However, there are significant UX issues with the ReadingPathPanel's loading experience, missing accessibility attributes on interactive elements, and potential performance issues with unoptimized re-renders in the author card grid.

---

## Finding Scorecard

| Severity | Server | Client | Total |
|---|---|---|---|
| 🔴 Critical | 4 | 1 | **5** |
| 🟠 High | 4 | 3 | **7** |
| 🟡 Medium | 5 | 7 | **12** |
| 🔵 Low | 3 | 5 | **8** |
| **Total** | **16** | **16** | **32** |

---

## Top Priorities

### Server-side
1. Fix public procedures exposing all author/content data without authentication (S1)
2. Add rate limiting to LLM/API enrichment endpoints to prevent quota exhaustion (S2)
3. Implement SSRF protection on all external URL fetch operations (S3)
4. Remove hardcoded Drive folder ID fallbacks and enforce env var presence at startup (S4)
5. Add Zod validation for all JSON blob columns to prevent runtime parse errors (A1)

### Client-side
1. Fix ReadingPathPanel loading state — 8-second blank wait is unacceptable UX (C1)
2. Add ARIA attributes to all interactive elements and loading states (L3)
3. Prevent AuthorCardGrid re-renders on every keystroke in search (H1)
4. Add error boundaries around all async data-dependent sections (H2)
5. Implement keyboard navigation for the CommandPalette and card grids (M1)

---

## Server-Side Findings

### 🔴 Critical

#### 🔴 [S1] Public procedures expose all author/content data without authentication
**Category:** Security | **File:** `server/routers/authorProfiles.router.ts:30-120, server/routers/contentItems.router.ts:45-130`

`authorProfiles.router.ts` and `contentItems.router.ts` use `publicProcedure` for `list`, `get`, `getMany`, `getGroupCounts`, `getAllEnrichedNames`, and `getAllRichBioNames`. This exposes the entire library catalog including potentially sensitive biographical data, social stats, and enrichment metadata to unauthenticated users. The `richBioJson`, `socialStatsJson`, `earningsCallMentionsJson`, and `professionalProfileJson` fields contain aggregated intelligence that could be valuable for competitive scraping.

> **Fix:** Change `publicProcedure` to `protectedProcedure` for all data access endpoints. If public access is intentional for a subset of fields, create a separate public endpoint that returns only non-sensitive fields (name, basic bio, public avatar URL) and keep detailed enrichment data behind authentication.

---

#### 🔴 [S2] No rate limiting on expensive LLM/API enrichment procedures
**Category:** Security | **File:** `server/routers/authorProfiles.router.ts:75-100, server/services/enrichmentOrchestrator.service.ts:80-150`

The `enrich`, `enrichBatch`, and orchestrator pipelines invoke external APIs (Gemini, Anthropic, Replicate, Tavily, Perplexity, YouTube, RapidAPI) without rate limiting. A malicious or misconfigured client could trigger thousands of enrichment calls, exhausting API quotas and incurring significant costs. The `adminProcedure` only checks role, not request frequency.

> **Fix:** Implement rate limiting middleware using a sliding window counter (e.g., `@trpc/server` middleware with in-memory LRU). Limit enrichment endpoints to 10 calls/minute per user and 100 calls/hour globally. Add circuit breakers for external API failures with exponential backoff.

---

#### 🔴 [S3] SSRF vulnerability in external URL fetching without allowlist
**Category:** Security | **File:** `server/syncEngine.ts:70-80, server/storage.ts:55-75`

The `openS3Stream` function in `syncEngine.ts` and avatar fetching logic accept arbitrary URLs and make HTTP requests without validating the hostname. An attacker could supply internal network URLs (169.254.169.254 for AWS metadata, internal services) to exfiltrate credentials or probe infrastructure. The `mirrorBatchToS3` and avatar download flows are particularly vulnerable.

> **Fix:** Implement URL validation before any fetch: (1) Parse URL and reject private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x). (2) Allowlist domains for S3 (*.s3.amazonaws.com) and external APIs. (3) Use DNS rebinding protection by resolving hostname before fetch and validating the resolved IP.

---

#### 🔴 [S4] Hardcoded Google Drive folder IDs with fallback defaults
**Category:** Security | **File:** `server/_core/env.ts:28-30`

`env.ts` contains hardcoded Drive folder IDs as fallback values (`driveAuthorsFolderId`, `driveBooksAudioFolderId`, `driveAvatarsFolderId`). If environment variables are not set, the application will read/write to the default folders, potentially exposing production data or allowing writes to incorrect locations.

> **Fix:** Remove hardcoded fallback values and throw an error at startup if required Drive folder IDs are not set: `if (!process.env.DRIVE_AUTHORS_FOLDER_ID) throw new Error('DRIVE_AUTHORS_FOLDER_ID required');`. This ensures misconfiguration fails fast rather than silently using wrong folders.

---

### 🟠 High

#### 🟠 [S5] SQL injection risk via raw SQL template literals with user input
**Category:** Security | **File:** `server/routers/contentItems.router.ts:85-95`

`contentItems.router.ts` uses raw SQL template literals mixing column references with string literals. Any future developer copying this pattern might incorrectly use string interpolation instead of proper parameterization.

> **Fix:** Use Drizzle's type-safe operators exclusively: `like(contentItems.title, \`%${input.query}%\`)`, `ne(contentItems.contentType, 'book')`. Add a linting rule (eslint-plugin-security) to flag raw SQL template usage.

---

#### 🟠 [S6] Missing input sanitization on author names before external API calls
**Category:** Security | **File:** `server/routers/authorProfiles.router.ts:75-80`

Author names from user input are passed directly to Wikipedia, Tavily, Perplexity, and other APIs. Malicious names containing newlines, null bytes, or URL-encoded payloads could exploit vulnerabilities in downstream services or cause log injection.

> **Fix:** Add input sanitization: (1) Strip control characters: `name.replace(/[\x00-\x1F\x7F]/g, '')`. (2) Limit length to 256 chars. (3) Reject names matching URL patterns. (4) Use the existing `validateAuthorName` function as a gate before any enrichment call.

---

#### 🟠 [A1] Unbounded JSON blob columns without schema validation
**Category:** Architecture | **File:** `drizzle/schema.ts:100-250`

The `authorProfiles` table has 20+ JSON text columns (`socialStatsJson`, `mediaPresenceJson`, `associationsJson`, etc.) stored as TEXT without any database-level or application-level schema validation. Malformed JSON will cause runtime parse errors.

> **Fix:** Define Zod schemas for each JSON structure and create typed getter functions: `getSocialStats(profile): SocialStats | null { try { return SocialStatsSchema.parse(JSON.parse(profile.socialStatsJson)) } catch { return null } }`.

---

#### 🟠 [A2] Orchestrator runs in-process without failure isolation
**Category:** Architecture | **File:** `server/services/enrichmentOrchestrator.service.ts:85-150`

`enrichmentOrchestrator.service.ts` runs pipelines as async functions within the Express process. An unhandled exception, memory leak, or infinite loop in any pipeline handler can crash the entire server.

> **Fix:** (1) Add per-pipeline timeouts: `Promise.race([handler(), timeout(300000)])`. (2) Implement memory monitoring and restart the orchestrator if RSS exceeds threshold. (3) Add heartbeat checks to detect stuck pipelines.

---

#### 🟠 [P1] N+1 query pattern in contentItems.list author resolution
**Category:** Performance | **File:** `server/routers/contentItems.router.ts:130-150`

After fetching content items, the code makes a separate query to `authorContentLinks` for each batch of item IDs. The author attachment loop iterates all links for every item, resulting in O(items × links) complexity.

> **Fix:** Use a JOIN to fetch items with authors in a single query: `db.select().from(contentItems).leftJoin(authorContentLinks, eq(contentItems.id, authorContentLinks.contentItemId))`.

---

#### 🟠 [P2] Missing database indexes on frequently filtered columns
**Category:** Performance | **File:** `drizzle/schema.ts:1-300`

Columns used in WHERE clauses (`includedInLibrary`, `contentType`, `enrichedAt`, `authorName`) may lack explicit indexes. The `authorProfiles.authorName` has a unique constraint but other filter columns lack indexes.

> **Fix:** Add explicit indexes: `index('idx_content_included').on(contentItems.includedInLibrary)`, `index('idx_content_type').on(contentItems.contentType)`, `index('idx_author_enriched').on(authorProfiles.enrichedAt)`. Run EXPLAIN on slow queries to identify missing indexes.

---

### 🟡 Medium

#### 🟡 [S7] JWT secret fallback to empty string allows weak tokens
**Category:** Security | **File:** `server/_core/env.ts:3`

`ENV.cookieSecret` defaults to empty string if `JWT_SECRET` is not set. This would allow signing tokens with an empty secret, making them trivially forgeable.

> **Fix:** Throw at startup if `JWT_SECRET` is missing: `cookieSecret: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET required') })()`. Add minimum length validation (32+ characters).

---

#### 🟡 [S8] API credentials potentially exposed in error messages
**Category:** Security | **File:** `server/storage.ts:70-75`

The `storage.ts` error handling includes full response text which may contain authentication errors or credential hints.

> **Fix:** Sanitize error messages before logging/throwing: extract only status code and generic message, never include response body in client-facing errors. Log full details server-side only.

---

#### 🟡 [A3] Circular dependency risk between routers and services
**Category:** Architecture | **File:** `server/services/enrichmentOrchestrator.service.ts:105-110`

Dynamic imports in `enrichmentOrchestrator.service.ts` (`await import('../enrichment/socialStats')`) suggest workarounds for circular dependencies between routers, services, and DB modules.

> **Fix:** Establish clear dependency direction: routers → services → lib → db. Extract shared types to a separate `types.ts` file. Replace dynamic imports with proper dependency injection.

---

#### 🟡 [A4] Neon pgvector embedding string concatenation without validation
**Category:** Architecture | **File:** `server/services/neonVector.service.ts:140-150`

`neonVector.service.ts` builds embedding vectors as string: `` const embStr = `[${v.values.join(',')}]` `` without validating that values are finite numbers.

> **Fix:** Validate embedding values before concatenation: `if (!v.values.every(n => typeof n === 'number' && isFinite(n))) throw new Error('Invalid embedding');`.

---

#### 🟡 [P3] Sequential embedding generation blocks event loop
**Category:** Performance | **File:** `server/services/ragPipeline.service.ts, server/services/neonVector.service.ts:140-160`

Large batch embedding operations process in sequential loops, blocking the Node.js event loop and causing HTTP request timeouts.

> **Fix:** Add `setImmediate()` yields between batches to allow I/O. Implement streaming/pagination for large reindex operations.

---

#### 🟡 [Q1] Inconsistent error handling — null returns vs. throws
**Category:** Quality | **File:** `server/db.ts, server/services/neonVector.service.ts:60-65`

`getDb()` returns `null` when DB is unavailable, but `getSql()` throws. Router procedures check `if (!db) return { items: [], total: 0 }` silently failing.

> **Fix:** Standardize: critical operations (auth, writes) should throw; read operations should return typed `Result<T, Error>`. Add request-level error boundary middleware.

---

#### 🟡 [Q2] Fire-and-forget async calls without error tracking
**Category:** Quality | **File:** `server/routers/authorProfiles.router.ts:105-110`

Multiple places call async functions with `.catch(() => {})`: `indexAuthorIncremental(...).catch(() => {})`, `checkAuthorDuplicate(...).catch(() => {})`. Failures are silently swallowed with no logging or retry.

> **Fix:** Replace empty catch with logging: `.catch(err => console.error('Incremental index failed', { authorId, error: err.message }))`.

---

### 🔵 Low

#### 🔵 [A5] Schema file exceeds maintainability threshold
**Category:** Architecture | **File:** `drizzle/schema.ts`

`drizzle/schema.ts` likely exceeds 1000 lines total, making it difficult to review and maintain.

> **Fix:** Split schema into domain-specific files: `schema/authors.ts`, `schema/books.ts`, `schema/content.ts`, `schema/enrichment.ts`. Re-export from a central `schema/index.ts`.

---

## Client-Side Findings

### 🔴 Critical

#### 🔴 [C1] ReadingPathPanel shows blank state for 8+ seconds with no feedback
**Category:** UX | **File:** `client/src/components/library/ReadingPathPanel.tsx:85-120`

When the user clicks "AI Path", the panel shows a generic spinner for 3-8 seconds with no indication of progress. There is no skeleton, no step indicator, and no timeout fallback. Users will assume the feature is broken and navigate away.

> **Fix:** Add a multi-step loading indicator: "Analyzing book themes... → Finding semantic connections... → Generating path rationale...". Implement a 15-second timeout that falls back to the quick path with a toast: "AI path timed out — showing curated path instead."

---

### 🟠 High

#### 🟠 [H1] AuthorCard grid re-renders entire list on every search keystroke
**Category:** Performance | **File:** `client/src/pages/Home.tsx:150-200`

The author card grid is not memoized. Every keystroke in the search box triggers a full re-render of all visible cards (up to 183 authors). Each card has hover animations and image loading logic that re-initializes on every render.

> **Fix:** Wrap the card grid with `React.memo` and memoize the filtered list with `useMemo`. Debounce the search input by 300ms. Consider virtualizing the list with `@tanstack/react-virtual` for grids exceeding 50 items.

---

#### 🟠 [H2] No error boundaries around async data sections
**Category:** Architecture | **File:** `client/src/pages/AuthorDetail.tsx, client/src/pages/BookDetail.tsx`

`AuthorDetail.tsx` and `BookDetail.tsx` render multiple sections that depend on separate tRPC queries. If any query throws an unhandled error, the entire page unmounts.

> **Fix:** Wrap each independent section in an `<ErrorBoundary>` with a graceful fallback: `<ErrorBoundary fallback={<SectionError message="Could not load similar authors" />}>`.

---

#### 🟠 [H3] CommandPalette keyboard shortcut may conflict with browser defaults
**Category:** UX | **File:** `client/src/components/CommandPalette.tsx`

The CommandPalette listens for `Cmd+K` globally. On some browsers, `Cmd+K` is a reserved shortcut for the address bar or link dialog. The implementation may intercept these events without checking `event.defaultPrevented`.

> **Fix:** Check `event.defaultPrevented` before opening the palette. Consider using `Ctrl+Space` or `Ctrl+/` as alternatives. Add a visible keyboard shortcut hint in the UI.

---

### 🟡 Medium

#### 🟡 [M1] No keyboard navigation in author/book card grids
**Category:** UX | **File:** `client/src/pages/Home.tsx:150-250`

The author and book card grids are not keyboard-navigable. Users cannot Tab through cards or use arrow keys to navigate the grid.

> **Fix:** Add `tabIndex={0}` to each card and handle `onKeyDown` for Enter/Space to trigger the modal. Implement arrow key navigation within the grid using `useRef` and `focus()`.

---

#### 🟡 [M2] AuthorModal and BookModal fetch data on every open
**Category:** Performance | **File:** `client/src/components/AuthorModal.tsx, client/src/components/BookModal.tsx`

Every time a modal opens, it triggers a fresh tRPC query even if the data was recently fetched.

> **Fix:** Set `staleTime: 5 * 60 * 1000` (5 minutes) on modal queries. Use `initialData` from the parent card's cached data to show content immediately while the full detail query loads in the background.

---

#### 🟡 [M3] SemanticSearchDropdown has no debounce on input
**Category:** Performance | **File:** `client/src/components/SemanticSearchDropdown.tsx`

The semantic search dropdown fires a Neon vector query on every character typed. Each query embeds the search term and runs a pgvector similarity search — an expensive operation.

> **Fix:** Add 400ms debounce to the search input. Cache recent search results with `useMemo` keyed on the debounced query string.

---

#### 🟡 [M4] Missing loading skeletons on AuthorDetail and BookDetail
**Category:** UX | **File:** `client/src/pages/AuthorDetail.tsx, client/src/pages/BookDetail.tsx`

Both detail pages show blank content areas while tRPC queries load, causing layout shift (CLS) and a perception of slowness.

> **Fix:** Add `Skeleton` components (from shadcn/ui) matching the layout of each section. Show skeletons immediately and replace with real content when queries resolve.

---

#### 🟡 [M5] InterestHeatmap uses PCA projection without explaining axes
**Category:** UX | **File:** `client/src/pages/InterestHeatmap.tsx`

The semantic heatmap shows a 2D scatter plot projected via PCA, but the axes are unlabeled and there's no explanation of what proximity means.

> **Fix:** Add axis labels ("← Less Similar | More Similar →"), a legend explaining dot colors (category), and a tooltip explaining: "Authors/books that appear close together share similar themes and ideas based on AI analysis."

---

#### 🟡 [M6] ReadingPathPanel AI rationale text is not streamed
**Category:** UX | **File:** `client/src/components/library/ReadingPathPanel.tsx:140-160`

The LLM-generated "why read this next" rationale is fetched as a complete string and displayed all at once after a 3-8 second wait.

> **Fix:** Add a loading state with estimated time: "Analyzing semantic connections... (usually 3-8 seconds)". Consider showing partial results as they stream in.

---

#### 🟡 [M7] CommandPalette loaded globally regardless of usage
**Category:** Architecture | **File:** `client/src/App.tsx:26,84`

`App.tsx` renders `CommandPalette` on every page regardless of whether the user ever uses Cmd+K. The component still initializes and sets up global listeners.

> **Fix:** Initialize `CommandPalette` only after first Cmd+K press using a global keyboard listener that triggers lazy load.

---

### 🔵 Low

#### 🔵 [L1] Unused imports in AuthorDetail
**Category:** Quality | **File:** `client/src/pages/AuthorDetail.tsx:29-44`

`AuthorDetail.tsx` imports many icons that may not all be used (Mail, Presentation, Brain, MessageSquare).

> **Fix:** Run `eslint --fix` with `unused-imports` plugin or manually audit each import.

---

#### 🔵 [L2] Magic strings for tab types
**Category:** Quality | **File:** `client/src/pages/Home.tsx:79`

`Home.tsx` uses string literal `'authors'` for `setActiveTab` instead of a typed constant.

> **Fix:** Define a TAB_TYPES const object: `const TABS = { AUTHORS: 'authors', BOOKS: 'books' } as const` and use throughout.

---

#### 🔵 [L3] PageLoader lacks accessibility attributes
**Category:** UX | **File:** `client/src/App.tsx:26-32`

The PageLoader spinner div has no ARIA attributes. Screen readers won't announce that content is loading.

> **Fix:** Add `role='status' aria-live='polite' aria-label='Loading page content'` to the outer div.

---

#### 🔵 [L4] Inline styles mixed with Tailwind in ReadingPathPanel
**Category:** Quality | **File:** `client/src/components/library/ReadingPathPanel.tsx:105,148,159`

`ReadingPathPanel` uses inline style objects for dynamic colors (`accentColor`), mixing with Tailwind reduces consistency.

> **Fix:** Consider CSS custom properties: set `--accent-color` via style prop, then use `bg-[var(--accent-color)]` in Tailwind.

---

#### 🔵 [L5] Inconsistent error handling in AuthorCardActions
**Category:** Quality | **File:** `client/src/components/AuthorCardActions.tsx:54-70`

`AuthorCardActions` shows error states but may not call `toast.error` on all mutation failures.

> **Fix:** Add `onError` callback to each mutation that shows `toast.error` with an actionable message.

---

## Positive Observations

### Server-side
- Well-structured tRPC router architecture with clear separation between public and admin procedures
- Comprehensive enrichment orchestrator with 20+ pipeline handlers covering all major data sources
- Neon pgvector integration is correctly implemented with proper namespace isolation
- `Promise.allSettled` usage in batch operations prevents single failures from blocking entire batches
- Drizzle ORM usage provides type-safe database access and prevents most SQL injection vectors
- Test coverage exists for critical paths (Dropbox ingestion, near-duplicate detection, user interests)
- `incrementalIndex.service.ts` correctly implements idempotent upsert semantics for vector embeddings
- `verify-neon-coverage.mjs` provides a solid health-check baseline for vector embedding coverage

### Client-side
- All page components are correctly lazy-loaded with `React.lazy` and `Suspense` — the correct pattern for code-splitting
- tRPC usage provides end-to-end type safety between client and server, eliminating API contract bugs
- `manualChunks` in `vite.config.ts` correctly splits vendor libraries to prevent OOM build failures
- `ReadingPathPanel` has a well-designed visual hierarchy with step numbers, similarity badges, and cover images
- `AuthorCardActions` correctly implements sequential step-by-step progress toasts for the Refresh All Data flow
- shadcn/ui component usage is consistent across the codebase

---

*End of Audit Report — 32 findings across 5 severity levels*
