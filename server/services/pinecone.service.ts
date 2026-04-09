/**
 * pinecone.service.ts
 *
 * Pinecone vector database service for the library RAG pipeline.
 *
 * Index: "library-rag"
 *   - Dimension: 3072 (Gemini gemini-embedding-001 output)
 *   - Metric: cosine
 *   - Serverless: AWS us-east-1
 *
 * Namespaces (logical partitions within the index):
 *   - "articles"      → magazine articles (Atlantic, New Yorker, Wired, NYT, WaPo)
 *   - "books"         → book summaries and chapter chunks
 *   - "authors"       → author bios and profile text
 *   - "content_items" → content item descriptions (podcasts, videos, newsletters, etc.)
 *   - "rag_files"     → full author RAG knowledge documents
 *
 * Each vector carries metadata for filtering and display:
 *   { contentType, sourceId, title, authorName, source, url, publishedAt, chunkIndex }
 */

import { Pinecone } from "@pinecone-database/pinecone";

// ── Constants ─────────────────────────────────────────────────────────────────

export const PINECONE_INDEX_NAME = "library-rag";
export const EMBEDDING_DIMENSION = 3072; // Gemini gemini-embedding-001

export type ContentNamespace = "articles" | "books" | "authors" | "content_items" | "rag_files";

export type VectorMetadata = {
  contentType: "article" | "book" | "author" | "content_item" | "rag_file";
  sourceId: string;          // DB row ID or articleId
  title: string;
  authorName?: string;
  source?: string;           // publication name or "library"
  url?: string;
  publishedAt?: string;      // ISO date string
  chunkIndex?: number;       // for multi-chunk documents
  chunkTotal?: number;
  text: string;              // the actual chunk text (for retrieval display)
  // T2-A metadata filters (added Apr 2026)
  category?: string;         // primary tag slug (e.g. "psychology", "business")
  bookCount?: number;        // number of books by this author in the library
  enrichedAt?: string;       // ISO date string of last enrichment
};

export type UpsertVectorInput = {
  id: string;
  values: number[];
  metadata: VectorMetadata;
  namespace: ContentNamespace;
};

export type QueryResult = {
  id: string;
  score: number;
  metadata: VectorMetadata;
};

// ── Client singleton ──────────────────────────────────────────────────────────

let _pc: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!_pc) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY environment variable is not set");
    _pc = new Pinecone({ apiKey });
  }
  return _pc;
}

// ── Index management ──────────────────────────────────────────────────────────

/**
 * Ensure the library-rag index exists; create it if not.
 * Uses serverless spec on AWS us-east-1 (free tier compatible).
 */
export async function ensureIndex(): Promise<void> {
  const pc = getPineconeClient();
  const { indexes } = await pc.listIndexes();
  const exists = (indexes ?? []).some(idx => idx.name === PINECONE_INDEX_NAME);

  if (!exists) {
    await pc.createIndex({
      name: PINECONE_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
      waitUntilReady: true,
    });
  }
}

/**
 * Get index stats (vector count per namespace).
 */
export async function getIndexStats() {
  const pc = getPineconeClient();
  const index = pc.index<VectorMetadata>(PINECONE_INDEX_NAME);
  return index.describeIndexStats();
}

// ── Vector operations ─────────────────────────────────────────────────────────

/**
 * Upsert a batch of vectors into the specified namespace.
 * Pinecone supports up to 100 vectors per upsert call.
 */
export async function upsertVectors(vectors: UpsertVectorInput[]): Promise<void> {
  if (vectors.length === 0) return;
  const pc = getPineconeClient();

  // Group by namespace for efficient batching
  const byNamespace = new Map<ContentNamespace, UpsertVectorInput[]>();
  for (const v of vectors) {
    const ns = byNamespace.get(v.namespace) ?? [];
    ns.push(v);
    byNamespace.set(v.namespace, ns);
  }

  for (const [namespace, nsVectors] of Array.from(byNamespace.entries())) {
    const index = pc.index<VectorMetadata>(PINECONE_INDEX_NAME).namespace(namespace);
    // Batch in groups of 100
    for (let i = 0; i < nsVectors.length; i += 100) {
      const batch = nsVectors.slice(i, i + 100).map((v: UpsertVectorInput) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      }));
      await index.upsert({ records: batch });
    }
  }
}

/**
 * Query the index for semantically similar vectors.
 */
export async function queryVectors(
  queryEmbedding: number[],
  namespace: ContentNamespace,
  options: {
    topK?: number;
    filter?: Record<string, unknown>;
  } = {}
): Promise<QueryResult[]> {
  const pc = getPineconeClient();
  const index = pc.index<VectorMetadata>(PINECONE_INDEX_NAME).namespace(namespace);

  const result = await index.query({
    vector: queryEmbedding,
    topK: options.topK ?? 10,
    includeMetadata: true,
    filter: options.filter,
  });

  return (result.matches ?? [])
    .filter(m => m.metadata)
    .map(m => ({
      id: m.id,
      score: m.score ?? 0,
      metadata: m.metadata as VectorMetadata,
    }));
}

/**
 * Query across all namespaces and merge results by score.
 */
export async function queryAllNamespaces(
  queryEmbedding: number[],
  topK = 10,
  filter?: Record<string, unknown>
): Promise<QueryResult[]> {
  const namespaces: ContentNamespace[] = ["articles", "books", "authors", "content_items", "rag_files"];
  const settled = await Promise.allSettled(
    namespaces.map(ns => queryVectors(queryEmbedding, ns, { topK, filter }))
  );

  const all = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
  return all.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Delete vectors by IDs in a namespace.
 */
export async function deleteVectors(ids: string[], namespace: ContentNamespace): Promise<void> {
  const pc = getPineconeClient();
  const index = pc.index<VectorMetadata>(PINECONE_INDEX_NAME).namespace(namespace);
  await index.deleteMany(ids);
}

// ── Text chunking ─────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks suitable for embedding.
 * Target: ~500 tokens (~2000 chars) with 100-char overlap.
 */
export function chunkText(
  text: string,
  chunkSize = 2000,
  overlap = 200
): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    // Try to break at sentence boundary
    let breakPoint = end;
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf(". ", end);
      const lastNewline = cleaned.lastIndexOf("\n", end);
      const boundary = Math.max(lastPeriod, lastNewline);
      if (boundary > start + chunkSize / 2) {
        breakPoint = boundary + 1;
      }
    }
    chunks.push(cleaned.slice(start, breakPoint).trim());
    start = breakPoint - overlap;
  }

  return chunks.filter(c => c.length > 50);
}

/**
 * Generate a stable vector ID for a content chunk.
 */
export function makeVectorId(
  contentType: "article" | "book" | "author" | "content_item" | "rag_file",
  sourceId: string,
  chunkIndex: number
): string {
  const safe = sourceId.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
  return `${contentType}-${safe}-chunk${chunkIndex}`;
}
