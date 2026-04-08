---
name: pinecone-rag
description: Manage Pinecone vector indexing, semantic search, reranking, and RAG context retrieval for the RC Library app. Use when adding new content to Pinecone, querying vectors, debugging search quality, adding reranking, or wiring RAG context into the chatbot.
---

# Pinecone RAG — RC Library App

## Index Configuration

| Property | Value |
|---|---|
| Index name | `library-rag` |
| Dimension | 1536 (OpenAI `text-embedding-3-small`) |
| Metric | cosine |
| Cloud | AWS us-east-1 (serverless) |
| SDK | `@pinecone-database/pinecone` v7 |
| Reranker | `bge-reranker-v2-m3` (applied to all similarity searches) |

## Namespaces

| Namespace | Content | Source table |
|---|---|---|
| `authors` | Author bios + profile text | `author_profiles` |
| `books` | Book summaries + chapter chunks | `book_profiles` |
| `rag_files` | Full author RAG knowledge documents (chunked) | `rag_files` |
| `content_items` | Podcasts, videos, newsletters, articles | `content_items` |
| `articles` | Magazine articles (Atlantic, New Yorker, Wired…) | `magazine_articles` |

## Key Files

```
server/services/pinecone.service.ts      ← client singleton, upsertVectors, queryVectors
server/services/ragPipeline.service.ts   ← embedBatch, indexAuthor, indexBook, indexRagFile, indexContentItem
server/services/incrementalIndex.service.ts ← indexAuthorIncremental, indexBookIncremental (skip-if-indexed)
server/routers/recommendations.router.ts ← similarBooks, similarAuthors, thematicSearch (all reranked)
server/routers/authorChatbot.router.ts   ← ragChatContext chunk retrieval + LLM chat
server/routers/vectorSearch.router.ts    ← semantic search across all namespaces
```

## Embedding

Always use `embedBatch()` from `ragPipeline.service.ts`. Never call the Gemini API directly.

```ts
import { embedBatch } from "../services/ragPipeline.service";
const vectors = await embedBatch(["text one", "text two"]);
// Returns number[][] — one 3072-dim vector per input string
```

## Upsert Vectors

```ts
import { upsertVectors } from "../services/pinecone.service";
import type { UpsertVectorInput } from "../services/pinecone.service";

const records: UpsertVectorInput[] = [{
  id: `author-${authorId}`,
  values: embeddingVector,
  metadata: {
    contentType: "author",
    sourceId: String(authorId),
    title: authorName,
    authorName,
    text: bioText,
  },
  namespace: "authors",
}];

await upsertVectors(records);
// Pinecone v7: internally calls index.namespace(ns).upsert({ records })
```

**Critical:** Pinecone v7 `upsert` takes `{ records: [...] }`, NOT a plain array.

## Query Vectors

```ts
import { queryVectors } from "../services/pinecone.service";

const results = await queryVectors({
  namespace: "books",
  queryText: "leadership and resilience",
  topK: 20,
  filter: { contentType: "book" },
});
// Returns QueryResult[] sorted by cosine score descending
```

## Reranking (bge-reranker-v2-m3)

All three search procedures (`similarBooks`, `similarAuthors`, `thematicSearch`) already apply reranking. To add reranking to a new procedure:

```ts
import { getPinecone } from "../services/pinecone.service";

async function rerankResults(query: string, hits: QueryResult[], topN: number) {
  try {
    const pc = getPinecone();
    const docs = hits.map(h => ({ id: h.id, text: h.metadata.text ?? h.metadata.title }));
    const reranked = await pc.inference.rerank(
      "bge-reranker-v2-m3",
      query,
      docs,
      { topN, returnDocuments: false }
    );
    const rankMap = new Map(reranked.data.map((r, i) => [r.document.id, i]));
    return [...hits].sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
  } catch {
    return hits; // graceful fallback to cosine order
  }
}
```

## RAG Chatbot Context Retrieval

The chatbot uses chunk retrieval, NOT full-file injection. The `ragChatContext` procedure in `recommendations.router.ts` queries the `rag_files` namespace with the user's message and returns the top 6 chunks.

```ts
// In authorChatbot.router.ts — already wired:
const ragCtx = await caller.recommendations.ragChatContext({
  authorId: input.authorId,
  query: input.message,
  topK: 6,
});
// ragCtx.chunks is an array of { text, score } objects
// Inject into system prompt as a "Knowledge Chunks" section
```

## Incremental Indexing (skip-if-already-indexed)

Use `indexAuthorIncremental` / `indexBookIncremental` for bulk operations — they skip rows that already have a Pinecone vector, preventing duplicate work.

```ts
import { indexAuthorIncremental, indexBookIncremental } from "../services/incrementalIndex.service";

await indexAuthorIncremental(authorId); // skips if already indexed
await indexBookIncremental(bookId);     // skips if already indexed
```

## Post-Enrichment Re-indexing (automatic)

Pinecone vectors are automatically refreshed whenever:
- `runBioEnrichment` or `runRichBioEnrichment` updates an author bio → calls `indexAuthorIncremental`
- `runRichSummaryEnrichment` updates a book summary → calls `indexBookIncremental`
- Admin manually enriches an author via the single-author enrich procedure → calls `indexAuthorIncremental`
- A book profile is updated via `handleUpdateBook` → calls `indexBookIncremental`
- A Smart Upload is committed → calls the correct indexing function based on `pineconeNamespace`

**Do not** call indexing functions from client-side code. Always trigger from server-side tRPC procedures.

## Current Vector Counts (as of Apr 2026)

| Namespace | Vectors |
|---|---|
| authors | 465 |
| books | 409 |
| rag_files | 129 |
| content_items | 157 |
| articles | 0 (empty — no magazine articles in DB yet) |
| **Total** | **1,160** |

## Common Pitfalls

- **Stale vectors**: enrichment pipelines now auto-re-index, but manually editing `bio` or `summary` directly in the DB (not via tRPC) will leave vectors stale. Always use tRPC procedures.
- **Wrong upsert format**: Pinecone v7 requires `{ records: [...] }` not a plain array. The `upsertVectors` helper handles this correctly — use it instead of calling `index.upsert()` directly.
- **Empty text field**: vectors without a `text` metadata field will fail reranking (no document text to score). Always include `text` in `VectorMetadata`.
- **Namespace mismatch**: the `articles` namespace exists but has 0 vectors. Do not query it until magazine articles are loaded.

See [references/pinecone-api.md](references/pinecone-api.md) for full API reference.
