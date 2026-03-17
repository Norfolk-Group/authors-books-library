# GEMINI.md — NCG Knowledge Library

This file provides context for Gemini CLI and other Google AI coding assistants
working on this codebase. It mirrors `CLAUDE.md` — read either file for full context.

---

## Quick Reference

| Item | Value |
|---|---|
| Project name | `authors-books-library` |
| Live URL | `https://authlib-ehsrgokn.manus.space` |
| Stack | React 19 + tRPC 11 + Express 4 + Drizzle ORM + MySQL |
| Tests | `pnpm test` — 118 Vitest tests in `server/*.test.ts` |
| Type check | `npx tsc --noEmit` (trust this; the watcher has a stale cache bug) |
| Dev server | `pnpm dev` → `http://localhost:3000` |
| DB migrations | `pnpm db:push` (drizzle-kit generate + migrate) |

---

## What This App Does

NCG Knowledge Library is a personal digital library for Ricardo Cidale / Norfolk
Consulting Group. It displays **109 authors** and **178 books** sourced from a
Google Drive folder hierarchy. Each author card shows:

- Author photo (AI-generated portrait or Wikipedia/Tavily sourced)
- Category badge and specialty description
- A strip of up to 5 book cover thumbnails with hover tooltips (title + summary + ★ rating)
- Bio hover tooltip (first ~200 chars, shown on avatar and "Bio ready" label)
- Click → opens full AuthorModal with bio, social links, and book list

---

## Architecture in One Paragraph

The frontend (`client/src/`) is a React 19 + Tailwind 4 + Flowbite React SPA.
Static author/book data lives in `client/src/lib/libraryData.ts` (generated from
Google Drive scans). Enrichment data (bios, photos, summaries, covers, ratings)
lives in a MySQL database accessed via tRPC procedures in `server/routers/`.
File assets (portraits, book covers) are stored on Manus S3 CDN via
`server/storage.ts`. Authentication uses Manus OAuth; enrichment mutations are
`publicProcedure` (no auth required for internal tools).

---

## Key Files to Know

```
client/src/pages/Home.tsx              ← Main view; builds all data maps passed to cards
client/src/components/FlowbiteAuthorCard.tsx ← Author card with cover strip + tooltips
client/src/lib/authorAliases.ts        ← canonicalName() — ALWAYS use for name lookups
drizzle/schema.ts                      ← DB schema (4 tables)
server/routers/authorProfiles.router.ts ← Bio/photo enrichment, getAllBios
server/routers/bookProfiles.router.ts   ← Summary/cover/rating enrichment
server/routers/apify.router.ts          ← Amazon scrape + S3 mirror
```

---

## Critical Rules

1. **Always use `canonicalName(rawName)`** from `authorAliases.ts` before any DB
   lookup or map access. Raw Drive data has many name variants.

2. **Never add a third dedup layer for books.** Dedup already happens at
   `filteredAuthors` (Home.tsx) and `dedupedBooks` (FlowbiteAuthorCard). A third
   layer will cause books to disappear from cards.

3. **Never store file bytes in the database.** Use `storagePut()` from
   `server/storage.ts` and store only the S3 key + CDN URL.

4. **Never put images in `client/public/` or `client/src/assets/`.** Upload via
   `manus-upload-file --webdev` and use the returned CDN URL.

5. **`bookInfoMap` not `bookSummaryMap`.** The prop was renamed when rating data
   was added. `bookSummaryMap` no longer exists.

6. **Trust `npx tsc --noEmit` over the watcher.** The incremental TS watcher
   (`tsx watch`) has a known stale cache issue in this project. The watcher may
   show a `bio` prop error that does not exist in the actual code.

---

## DB Tables Summary

### `author_profiles`
PK: `authorName` (canonical). Key columns: `bio`, `photoUrl`, `s3PhotoKey`,
`photoSource` (enum: `wikipedia|tavily|apify|ai`), `socialLinks` (JSON),
`enrichedAt` (UTC ms bigint).

### `book_profiles`
PK: `titleKey` (lowercase slug). Key columns: `bookTitle`, `authorName`,
`summary`, `coverImageUrl`, `s3CoverUrl`, `s3CoverKey`, `rating` (decimal 3,1),
`ratingCount`, `amazonUrl`.

### `sync_status`
Tracks last Google Drive sync timestamp.

### `users`
Standard Manus OAuth user table with `role` field (`admin|user`).

---

## Enrichment Pipeline

```
Author enrichment:  Wikipedia API → Perplexity Sonar → LLM fallback
Book enrichment:    Google Books API → LLM fallback
Cover scraping:     Apify cheerio-scraper → Amazon search → S3 mirror
Portrait gen:       Replicate flux-schnell → S3 upload
Image search:       Tavily API → score/rank → S3 mirror
```

A nightly cron job at **2am CDT (07:00 UTC)** runs
`scripts/batch-scrape-covers.mjs` to pick up any new books automatically.

---

## Environment Variables (Manus-injected, never hardcode)

`DATABASE_URL`, `JWT_SECRET`, `APIFY_API_TOKEN`, `BUILT_IN_FORGE_API_URL`,
`BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_KEY`, `PERPLEXITY_API_KEY`,
`REPLICATE_API_TOKEN`, `TAVILY_API_KEY`

---

## Running Tests

```bash
pnpm test                    # run all 118 tests
pnpm test -- --reporter=verbose  # verbose output
```

Tests are in `server/*.test.ts`. There are no frontend tests. Key files:
`library.test.ts`, `author-aliases.test.ts`, `batch-enrich.test.ts`,
`sort-and-profiles.test.ts`, `apify.test.ts`, `generate-portrait.test.ts`.

---

## Design Tokens

- **Fonts:** Playfair Display (headings) + DM Sans (body) — loaded via Google Fonts CDN
- **Background:** Warm off-white `#faf9f6`
- **Foreground:** Deep charcoal `oklch(0.235 0.015 65)`
- **Themes:** Manus (default), Norfolk AI, Noir Dark — CSS variable sets in `index.css`
- **Tailwind:** v4 — use OKLCH in `@theme` blocks, not HSL

---

*Last updated: March 17, 2026 — NCG Knowledge Library v2.0*
