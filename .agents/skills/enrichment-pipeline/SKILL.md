---
name: enrichment-pipeline
description: Understand and extend the enrichment orchestrator — the autonomous pipeline that fetches bios, summaries, social stats, avatars, and book covers for all authors and books. Use when adding new enrichment steps, debugging pipeline failures, adjusting batch sizes, or understanding the post-enrichment Pinecone re-indexing hooks.
---

# Enrichment Pipeline — RC Library App

## Overview

The enrichment orchestrator runs a series of named pipelines that progressively enrich author and book data. Each pipeline is triggered from the Admin Console (`/admin` → Intelligence Dashboard) or via the Scheduling tab.

## Key Files

```
server/services/enrichmentOrchestrator.service.ts  ← All pipeline runners (runBioEnrichment, runRichBioEnrichment, etc.)
server/routers/orchestrator.router.ts               ← tRPC procedures to trigger/monitor pipelines
server/services/incrementalIndex.service.ts         ← indexAuthorIncremental, indexBookIncremental
server/services/ragPipeline.service.ts              ← indexRagFile, indexContentItem
client/src/components/admin/AdminIntelligenceTab.tsx ← Pipeline control UI
```

## Pipeline Registry

| Pipeline Key | What it does | Auto-re-indexes Pinecone? |
|---|---|---|
| `enrich-bios` | Fetches short author bios via Perplexity/Wikipedia | ✅ Yes — after each bio update |
| `enrich-rich-bios` | Generates long-form richBioJson via Claude | ✅ Yes — after each richBioJson update |
| `enrich-book-summaries` | Fetches book summaries via Google Books / Perplexity | ✅ Yes — after each summary update |
| `enrich-rich-summaries` | Generates long-form richSummaryJson via Claude | ✅ Yes — after each richSummaryJson update |
| `enrich-social-stats` | Fetches Twitter/Substack/LinkedIn stats | ❌ No (metadata only) |
| `enrich-avatars` | Generates AI avatars for authors | ❌ No (images only) |
| `enrich-book-covers` | Scrapes Amazon for book cover images | ❌ No (images only) |
| `pinecone-index-authors` | Bulk-indexes all authors to Pinecone | N/A (is the indexing) |
| `pinecone-index-books` | Bulk-indexes all books to Pinecone | N/A (is the indexing) |

## Post-Enrichment Pinecone Re-indexing

As of Apr 2026, the four bio/summary enrichment pipelines automatically re-index to Pinecone after each DB update. This prevents stale vectors.

### Where the hooks are wired:

**`runBioEnrichment`** (short bio):
```ts
// After: await db.update(authorProfiles).set({ bio: newBio }).where(eq(authorProfiles.id, author.id))
await indexAuthorIncremental(author.id).catch(e => logger.warn("Pinecone re-index failed", e));
```

**`runRichBioEnrichment`** (long-form richBioJson):
```ts
// After: await db.update(authorProfiles).set({ richBioJson: result }).where(...)
await indexAuthorIncremental(author.id).catch(e => logger.warn("Pinecone re-index failed", e));
```

**`runRichSummaryEnrichment`** (long-form richSummaryJson):
```ts
// After: await db.update(bookProfiles).set({ richSummaryJson: result }).where(...)
await indexBookIncremental(book.id).catch(e => logger.warn("Pinecone re-index failed", e));
```

**`handleUpdateBook`** (manual admin book edit):
```ts
// After: return updatedBook
if (patch.summary || patch.keyThemes) {
  indexBookIncremental(updatedBook.id).catch(e => logger.warn("Pinecone re-index failed", e));
}
```

**Single-author enrich** (admin manual trigger):
```ts
// After: await enrichAuthorViaWikipedia(authorId)
await indexAuthorIncremental(authorId).catch(e => logger.warn("Pinecone re-index failed", e));
```

## Adding a New Enrichment Pipeline

1. Add a new `run*Enrichment` function in `enrichmentOrchestrator.service.ts`
2. Register it in the `PIPELINE_REGISTRY` object in `orchestrator.router.ts`
3. If the pipeline updates `bio`, `richBioJson`, `summary`, or `richSummaryJson`, add a Pinecone re-index hook after the DB update
4. Add a trigger button in `AdminIntelligenceTab.tsx`

### Template for a new pipeline:

```ts
export async function runMyNewEnrichment(
  onProgress?: (done: number, total: number) => void
): Promise<{ processed: number; skipped: number; errors: number }> {
  const db = getDb();
  const rows = await db.select({ id: authorProfiles.id, authorName: authorProfiles.authorName })
    .from(authorProfiles)
    .where(isNull(authorProfiles.myNewField));  // only process rows missing this field

  let processed = 0, skipped = 0, errors = 0;
  for (const row of rows) {
    try {
      const result = await fetchMyData(row.authorName);
      if (!result) { skipped++; continue; }
      await db.update(authorProfiles).set({ myNewField: result }).where(eq(authorProfiles.id, row.id));
      // If this updates bio/summary, add re-index hook here:
      // await indexAuthorIncremental(row.id).catch(e => logger.warn("Pinecone re-index failed", e));
      processed++;
    } catch (e) {
      logger.error(`Failed to enrich author ${row.authorName}:`, e);
      errors++;
    }
    onProgress?.(processed + skipped + errors, rows.length);
  }
  return { processed, skipped, errors };
}
```

## Batch Size and Rate Limiting

- Default batch size: 1 (sequential, not parallel) to avoid API rate limits
- Use `parallelBatch<TInput>(items, batchSize, fn)` from `server/lib/parallelBatch.ts` for parallel processing
- Perplexity: max 5 concurrent requests
- Gemini embedding: max 10 concurrent requests (embedBatch handles batching internally)
- Claude: max 3 concurrent requests

## Substack Post Count Enrichment

41 authors have Substack URLs. The `substackPostCount` column is populated by the `enrich-social-stats` pipeline. 9 authors have confirmed post counts; 21 have zero-post accounts; 11 have incorrect URLs (personal blogs, not `*.substack.com` publication URLs).

To fix an incorrect Substack URL:
```sql
UPDATE author_profiles SET substackUrl = 'https://authorname.substack.com' WHERE id = <authorId>;
```
Then re-run `enrich-social-stats` for that author.

## Common Pitfalls

- **Re-index hook placement**: always add the Pinecone hook AFTER the DB update succeeds, inside the `try` block, with `.catch()` to prevent pipeline failures from Pinecone errors.
- **`indexAuthorIncremental` vs `indexAuthor`**: use `indexAuthorIncremental` (skips if already indexed) for enrichment hooks; use `indexAuthor` only for full re-index operations.
- **`parallelBatch` generic type**: the function signature is `parallelBatch<TInput>`. TypeScript infers the type from the array — do not cast to `string[]`.
- **Pipeline progress**: `onProgress` is called after each item. The UI polls for updates every 2 seconds. Do not call `onProgress` more than once per item.
