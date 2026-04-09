# RC Library App — Comprehensive Optimization Plan

**Date:** April 8, 2026  
**Scope:** Full codebase audit covering server/client split, Pinecone usage, database schema, agent skills, and deterministic tools.  
**Methodology:** Deep static analysis of all 30+ routers, 10+ services, schema.ts (1,300+ lines), 27 client files importing hardcoded data, and 5 existing agent skills.

---

## Executive Summary

The app is architecturally sound but has accumulated three systemic issues that compound each other:

1. **Dual source-of-truth:** `libraryData.ts` (hardcoded, 27 importers) and the database (authoritative) coexist. Components that use the hardcoded file bypass all enrichment data (bios, avatars, social stats) stored in the DB.
2. **JS-over-SQL aggregation:** Several server-side procedures fetch full tables and filter/count in JavaScript instead of using SQL `COUNT CASE WHEN` — this is the single biggest performance waste.
3. **Pinecone underutilization:** Pinecone is used for search and chatbot RAG, but not yet for filtering, hybrid search, or metadata-gated queries — leaving significant quality and cost improvements on the table.

The plan below is organized into five tiers. **Tier 1 (P0/P1) items should be implemented in the next session.** Tiers 2–5 are sequenced by impact-to-effort ratio.

---

## Tier 1 — Critical Fixes (P0/P1) | Implement Next Session

### T1-A: Replace JS-filter aggregation with SQL COUNT in `cascade.router.ts`

**Priority:** P1 | **Effort:** S (2h) | **Impact:** 10–50× faster cascade stats, eliminates full-table fetch

**Problem:** `cascade.router.ts` fetches ALL rows from `authorProfiles` (183 rows × 20 columns) and ALL rows from `bookProfiles` (163 rows × 25 columns), then counts them with `.filter()` in JavaScript. This is the most wasteful pattern in the codebase.

**Fix:** Replace with a single SQL query using `COUNT(CASE WHEN ... THEN 1 END)`:

```typescript
// BEFORE (current — fetches all rows, filters in JS)
const rows = await db.select({ authorName, bio, avatarUrl, ... }).from(authorProfiles);
const withAvatar = rows.filter(r => r.avatarUrl && r.avatarUrl.length > 0).length;

// AFTER (single aggregation query)
const [stats] = await db.select({
  total: sql<number>`COUNT(*)`,
  withAvatar: sql<number>`COUNT(CASE WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN 1 END)`,
  withS3Avatar: sql<number>`COUNT(CASE WHEN s3_avatar_url IS NOT NULL AND s3_avatar_url != '' THEN 1 END)`,
  withBio: sql<number>`COUNT(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 END)`,
  fromWikipedia: sql<number>`COUNT(CASE WHEN avatar_source = 'wikipedia' THEN 1 END)`,
  fromTavily: sql<number>`COUNT(CASE WHEN avatar_source = 'tavily' THEN 1 END)`,
  fromApify: sql<number>`COUNT(CASE WHEN avatar_source = 'apify' THEN 1 END)`,
  fromAI: sql<number>`COUNT(CASE WHEN avatar_source = 'ai' THEN 1 END)`,
}).from(authorProfiles);
```

**Files:** `server/routers/cascade.router.ts` (both `authorStats` and `bookStats` procedures)

---

### T1-B: Add missing database indexes for high-frequency queries

**Priority:** P1 | **Effort:** S (1h) | **Impact:** 5–20× faster book lookups, duplicate detection, and filter queries

**Problem:** These columns are queried frequently but have no index:

| Column | Query count | Use case |
|---|---|---|
| `bookProfiles.bookTitle` | 11 | `eq(bookProfiles.bookTitle, ...)` in duplicate detection, CRUD |
| `bookProfiles.isbn` | 5 | Duplicate detection, library cache |
| `bookProfiles.possessionStatus` | 4 | Filter by ownership status |
| `bookProfiles.format` | 3 | Filter by format (PDF, Audio, etc.) |
| `authorProfiles.ragReadinessScore` | 3 | Sort by readiness for chatbot |
| `authorProfiles.richBioJson` (isNotNull) | 2 | `getAllRichBioNames` — should use a boolean flag |

**Fix:** Add to `drizzle/schema.ts`:

```typescript
// In bookProfilesTable indexes:
bookTitleIdx: index("book_profiles_bookTitle_idx").on(table.bookTitle),
isbnIdx: index("book_profiles_isbn_idx").on(table.isbn),
possessionStatusIdx: index("book_profiles_possessionStatus_idx").on(table.possessionStatus),
formatIdx: index("book_profiles_format_idx").on(table.format),

// In authorProfilesTable indexes:
ragReadinessIdx: index("author_profiles_ragReadiness_idx").on(table.ragReadinessScore),
hasRichBioIdx: index("author_profiles_hasRichBio_idx").on(table.richBioJson), // partial index via boolean flag (see T2-C)
```

Then run `pnpm db:push`.

---

### T1-C: Move Leaderboard computation to server side

**Priority:** P1 | **Effort:** M (4h) | **Impact:** Eliminates hardcoded `AUTHORS` dependency, enables real-time data, reduces client bundle

**Problem:** `Leaderboard.tsx` imports `AUTHORS` from the hardcoded `libraryData.ts` and builds the leaderboard in a `useMemo` on the client. This means:
- Book counts come from the hardcoded file, not the database
- Tag counts require a separate `getAllAuthorTagSlugs` query
- Social stats require a separate `getSocialStats` query
- The result is 3 parallel queries + client-side join

**Fix:** Add a `leaderboard.getLeaderboard` procedure that does the join server-side:

```typescript
// server/routers/leaderboard.router.ts (new file)
getLeaderboard: publicProcedure
  .input(z.object({
    metric: z.enum(["wikipedia", "twitter", "youtube", "books", "tags", "platforms"]),
    limit: z.number().int().min(1).max(50).default(20),
  }))
  .query(async ({ input }) => {
    const db = await getDb();
    // Single query with subquery for book counts and tag counts
    // Returns pre-sorted, pre-filtered leaderboard entries
  }),
```

**Files:** New `server/routers/leaderboard.router.ts`, update `client/src/pages/Leaderboard.tsx`

---

### T1-D: Migrate `authorAliases.ts` to database

**Priority:** P1 | **Effort:** M (4h) | **Impact:** Single source of truth for name normalization, agent-editable

**Problem:** `authorAliases.ts` (236 lines, 80+ entries) is a hardcoded client-side file. When a new author is added with a Drive-folder suffix variant, the alias must be manually added to this file. Agents cannot update it without a code change.

**Fix:**
1. Add `author_aliases` table to `drizzle/schema.ts`:
   ```typescript
   export const authorAliases = mysqlTable("author_aliases", {
     id: int("id").primaryKey().autoincrement(),
     rawName: varchar("raw_name", { length: 512 }).notNull(),
     canonicalName: varchar("canonical_name", { length: 512 }).notNull(),
     source: varchar("source", { length: 64 }).default("manual"),
     createdAt: timestamp("created_at").defaultNow(),
   }, (table) => ({
     rawNameIdx: index("author_aliases_rawName_idx").on(table.rawName),
     canonicalNameIdx: index("author_aliases_canonicalName_idx").on(table.canonicalName),
   }));
   ```
2. Create migration script `scripts/seed-author-aliases.mjs` to import current `AUTHOR_ALIASES` into DB
3. Add `authorAliases.getAll` tRPC procedure
4. Update `canonicalName()` function to use DB lookup (with in-memory cache, 5-min TTL)
5. Keep `authorAliases.ts` as a fallback during transition

---

## Tier 2 — High-Value Improvements (P1/P2) | Next 2–3 Sessions

### T2-A: Migrate `authorAvatars.ts` to database

**Priority:** P1 | **Effort:** S (2h) | **Impact:** Eliminates 99-line hardcoded file, avatars managed via Admin UI

**Problem:** `authorAvatars.ts` maps 89 author names → S3 CDN URLs. When a new avatar is generated, the file must be manually updated. The database already has `avatarUrl` and `s3AvatarUrl` columns on `authorProfiles`.

**Fix:** The database already has the data. The issue is that components import from `AUTHOR_PHOTOS` instead of using `trpc.authorProfiles.get.useQuery()`. The fix is to update the 5 components that import `AUTHOR_PHOTOS` to use the DB instead.

**Files:** `AuthorCard.tsx`, `FlowbiteAuthorCard.tsx`, `AuthorModal.tsx`, `AuthorBioPanel.tsx`, `AuthorAccordionRow.tsx`

---

### T2-B: Add `bookTitle` full-text search via Pinecone metadata filter

**Priority:** P2 | **Effort:** S (2h) | **Impact:** Faster book search, eliminates LIKE queries

**Problem:** Book search currently uses SQL `LIKE '%query%'` which is slow and doesn't support semantic matching.

**Fix:** Add Pinecone metadata filter to `thematicSearch` for books:
```typescript
// When namespace = "books", add metadata filter:
filter: { bookTitle: { $contains: query } }
// Or use hybrid: embed query + filter by tag
```

---

### T2-C: Add `hasRichBio` boolean flag to `authorProfiles`

**Priority:** P2 | **Effort:** XS (30min) | **Impact:** Eliminates `isNotNull(richBioJson)` full-table scan

**Problem:** `getAllRichBioNames` does `WHERE rich_bio_json IS NOT NULL` — MySQL cannot use a partial index on nullable JSON columns efficiently.

**Fix:** Add `hasRichBio: boolean().default(false)` column, set it in the enrichment pipeline when `richBioJson` is written. Index the boolean column.

---

### T2-D: Paginate `getAllFreshness` and `getAllBios`

**Priority:** P2 | **Effort:** S (2h) | **Impact:** Eliminates 183-row full-table fetches with large JSON blobs

**Problem:** `getAllFreshness` returns 183 rows × 9 timestamp columns. `getAllBios` returns 183 rows × `richBioJson` (large JSON). Both are used by the Admin Intelligence Dashboard — which only shows 20 rows at a time.

**Fix:** Add `limit` and `offset` parameters. For `getAllBios`, add a `search` parameter to filter by author name.

---

### T2-E: Implement Pinecone metadata filtering for interest scoring

**Priority:** P2 | **Effort:** M (4h) | **Impact:** Reduces Pinecone query cost, improves relevance

**Problem:** `getPineconeAuthorCandidates` queries Pinecone with `topK=30` but no metadata filter — it gets the 30 most similar authors regardless of tag. If the user's interests are "Psychology" and "Neuroscience", the top-30 might include Business authors with tangentially related content.

**Fix:** Add tag-based metadata filter to the Pinecone query:
```typescript
// When user has interests, filter by matching tags
const tagFilter = interests.length > 0 
  ? { tags: { $in: interests.map(i => i.category.toLowerCase()) } }
  : undefined;
const hits = await queryVectors(queryEmbedding, "authors", { topK, filter: tagFilter });
```

This requires storing tag slugs in Pinecone vector metadata at index time (currently not done).

---

### T2-F: Implement hybrid search (keyword + vector) for ThematicSearch

**Priority:** P2 | **Effort:** M (4h) | **Impact:** Better search quality, especially for exact title/author name matches

**Problem:** `thematicSearch` is pure vector search — searching "Adam Grant" returns semantically similar authors, not Adam Grant himself. Users expect exact matches to rank first.

**Fix:** Add a pre-filter step: if the query matches an exact author name or book title (DB lookup), prepend that result to the vector search results.

---

### T2-G: Implement full Semantic Map with real Pinecone vectors

**Priority:** P3 | **Effort:** L (1 day) | **Impact:** Genuine 2D semantic clustering, not just category grouping

**Problem:** The current `AdminSemanticMapTab` uses category-based clustering (fake positions). The "Compute Full Semantic Map" button exists but has no backend implementation.

**Fix:** Implement `semanticMap.computeFullMap` procedure:
1. Fetch all author vectors from Pinecone (using `listVectors` or batch `fetchVectors`)
2. Apply PCA (2 principal components) using pure math (no external library)
3. Store computed coordinates in a `semantic_map_cache` table with TTL
4. Return coordinates + metadata to frontend

---

## Tier 3 — Architecture Improvements (P2/P3) | Medium Term

### T3-A: Split oversized routers

**Priority:** P2 | **Effort:** M (4h) | **Impact:** Maintainability, faster agent context loading

**Problem:** Three routers exceed the 150-line guideline significantly:
- `authorEnrichment.router.ts` — 570 lines
- `authorSocial.router.ts` — 650+ lines

**Fix:**
- Split `authorEnrichment.router.ts` → `authorEnrichment.core.router.ts` + `authorEnrichment.batch.router.ts`
- Split `authorSocial.router.ts` → `authorSocial.stats.router.ts` + `authorSocial.discovery.router.ts`

---

### T3-B: Add typed JSON columns for key JSON blobs

**Priority:** P3 | **Effort:** M (4h) | **Impact:** Type safety, better IDE support, eliminates JSON.parse calls

**Problem:** `socialStatsJson`, `richBioJson`, `richSummaryJson`, `tagsJson`, `platformEnrichmentStatus` are all `TEXT` columns storing JSON. Every consumer calls `JSON.parse()` with no type checking.

**Fix:** Use Drizzle's `json()` column type with TypeScript generics:
```typescript
import type { SocialStats } from "../../shared/types";
socialStatsJson: json("social_stats_json").$type<SocialStats>(),
```

---

### T3-C: Add referential integrity for `bookProfiles.authorName`

**Priority:** P3 | **Effort:** S (2h) | **Impact:** Data integrity, prevents orphaned books

**Problem:** `bookProfiles.authorName` is a plain `varchar` — there's no foreign key constraint to `authorProfiles.authorName`. Books can be created for non-existent authors.

**Fix:** Add a foreign key constraint (or at minimum, a server-side validation in `createBook`).

---

### T3-D: Normalize `tagsJson` into a proper junction table

**Priority:** P3 | **Effort:** L (1 day) | **Impact:** Enables SQL-level tag filtering, eliminates JSON parsing

**Problem:** Author tags are stored as a JSON array in `tagsJson` on `authorProfiles`. This prevents SQL-level filtering (e.g., "all authors tagged Psychology") without fetching all rows.

**Fix:** The `tags` and `author_tag_assignments` tables already exist (based on the schema). The issue is that `tagsJson` is a denormalized copy. The fix is to:
1. Ensure `author_tag_assignments` is always kept in sync when `tagsJson` changes
2. Update queries to use the junction table instead of `tagsJson`
3. Deprecate `tagsJson` in favor of the junction table

---

## Tier 4 — Agent Skills & Deterministic Tools | Implement Alongside Features

### T4-A: Create `database-schema` skill

**Priority:** P1 | **Effort:** S (2h) | **Impact:** Agents can query correct columns without reading schema.ts

**Content should include:**
- All 20+ tables with their key columns and data types
- All existing indexes (so agents don't add duplicates)
- Known anti-patterns (JS filter vs SQL COUNT, tagsJson vs junction table)
- Migration workflow (`pnpm db:push`)
- Query pattern examples for common operations

---

### T4-B: Create `server-side-patterns` skill

**Priority:** P1 | **Effort:** S (2h) | **Impact:** Prevents future JS-over-SQL anti-patterns

**Content should include:**
- When to use SQL aggregates vs JS (rule: always SQL for counts/sums)
- N+1 prevention patterns (batch queries, `inArray`, `Promise.allSettled`)
- Pagination pattern (limit/offset with total count)
- JSON column handling (parse once, type-assert, never re-parse in loops)
- tRPC procedure size limits (150 lines → split into sub-routers)

---

### T4-C: Create `deterministic-tools` skill + implement 4 scripts

**Priority:** P1 | **Effort:** M (4h) | **Impact:** Agents can verify system state without reading code

**Scripts to create:**

1. **`scripts/verify-db-indexes.mjs`** — Queries `SHOW INDEX FROM <table>` for all tables and compares against expected indexes. Outputs a pass/fail report.

2. **`scripts/audit-hardcoded-vs-db.mjs`** — Compares `libraryData.ts` author/book list against DB. Reports: authors in hardcoded but not DB, authors in DB but not hardcoded, books with mismatched titles.

3. **`scripts/verify-pinecone-coverage.mjs`** — For each author in DB, checks if they have a vector in Pinecone `authors` namespace. Reports coverage percentage and lists missing authors.

4. **`scripts/health-check-all.mjs`** — Runs all health checks (DB connectivity, Pinecone connectivity, Dropbox token validity, S3 access) and outputs a JSON report.

---

### T4-D: Update existing skills with new findings

**Priority:** P2 | **Effort:** S (2h) | **Impact:** Skills stay accurate as codebase evolves

**Updates needed:**
- `library-architecture` skill: Add Pinecone namespace details, DB index list, known anti-patterns section, `DROPBOX_AUTHORS_FOLDER` env var
- `pinecone-rag` skill: Add metadata filter examples, hybrid search pattern, reranking details, dimension (1536)
- `dropbox-sync` skill: Add `authorsInbox`/`authorsProcessed` keys, `DROPBOX_AUTHORS_FOLDER` env var
- `enrichment-pipeline` skill: Add orchestrator tick interval (5 min), pipeline handler signatures, concurrency limits

---

## Tier 5 — Long-Term Architecture (P3) | Future Sessions

### T5-A: Full migration away from `libraryData.ts`

**Priority:** P3 | **Effort:** XL (2+ days) | **Impact:** Single source of truth, eliminates 27-file dependency

**Problem:** `libraryData.ts` is imported by 27 files. A full migration requires:
1. Ensuring all data in `libraryData.ts` is in the database (audit script T4-C-2 will reveal gaps)
2. Creating server-side procedures for every data access pattern currently using the hardcoded file
3. Updating all 27 importing files to use tRPC queries instead
4. Deleting `libraryData.ts`

This is a multi-session effort. The recommended approach is incremental: fix one component at a time, starting with the highest-traffic ones (Home.tsx, AuthorsTabContent.tsx, BooksTabContent.tsx).

---

### T5-B: Implement server-sent events (SSE) for enrichment progress

**Priority:** P3 | **Effort:** L (1 day) | **Impact:** Real-time progress without polling

**Problem:** The Admin Intelligence Dashboard polls for enrichment job progress every 3 seconds. This creates unnecessary load.

**Fix:** Replace polling with SSE (`text/event-stream`) for the enrichment job progress endpoint.

---

### T5-C: Add Pinecone sparse vectors for hybrid search

**Priority:** P3 | **Effort:** L (1 day) | **Impact:** Best-in-class search quality

**Problem:** Pure dense vector search misses exact keyword matches. Pinecone supports hybrid search (dense + sparse BM25 vectors) which combines semantic and keyword matching.

**Fix:** Upgrade to Pinecone's hybrid search API. Requires re-indexing all vectors with sparse BM25 representations.

---

## Implementation Sequence (Recommended)

The following sequence maximizes impact while minimizing risk:

| Session | Items | Estimated Time |
|---|---|---|
| Next session | T1-A (cascade SQL), T1-B (indexes), T4-C-1 (verify-db-indexes script) | 4h |
| Session +2 | T1-C (leaderboard server-side), T4-A (database-schema skill) | 6h |
| Session +3 | T1-D (author aliases to DB), T4-B (server-side-patterns skill) | 6h |
| Session +4 | T2-A (avatars from DB), T2-C (hasRichBio flag), T2-D (pagination) | 4h |
| Session +5 | T2-E (Pinecone metadata filter), T2-F (hybrid search), T4-C-2,3,4 (scripts) | 6h |
| Session +6 | T3-A (split routers), T4-D (update skills), T2-G (full semantic map) | 6h |
| Future | T3-B, T3-C, T3-D, T5-A, T5-B, T5-C | Multiple sessions |

---

## Quick Wins (< 30 minutes each)

These can be done at the start of any session as warmup:

1. Add `bookTitle` index to `drizzle/schema.ts` + `pnpm db:push` (5 min)
2. Add `isbn` index to `drizzle/schema.ts` + `pnpm db:push` (5 min)
3. Add `possessionStatus` index to `drizzle/schema.ts` + `pnpm db:push` (5 min)
4. Add `ragReadinessScore` index to `drizzle/schema.ts` + `pnpm db:push` (5 min)
5. Fix `cascade.router.ts` authorStats to use SQL COUNT (20 min)
6. Fix `cascade.router.ts` bookStats to use SQL COUNT (20 min)

---

## Anti-Patterns to Prevent Going Forward

These patterns were found in the audit and should be avoided in all future code:

| Anti-Pattern | Correct Approach |
|---|---|
| `rows.filter(r => r.col).length` | `COUNT(CASE WHEN col IS NOT NULL THEN 1 END)` |
| `import { AUTHORS } from "@/lib/libraryData"` | `trpc.authorProfiles.getAll.useQuery()` |
| `import { AUTHOR_PHOTOS } from "@/lib/authorAvatars"` | Use `profile.s3AvatarUrl ?? profile.avatarUrl` from DB |
| `JSON.parse(row.socialStatsJson)` in a loop | Parse once, type-assert, pass typed object |
| Router files > 150 lines | Split into `feature.core.router.ts` + `feature.batch.router.ts` |
| Hardcoded category colors/icons in server code | Move to `shared/constants.ts` or DB |
| `for (const row of rows) { await db.update(...) }` | `Promise.allSettled(rows.map(r => db.update(...)))` |

---

*This plan was generated from a full static analysis of the RC Library App codebase on April 8, 2026. All file references are relative to `/home/ubuntu/authors-books-library/`.*
