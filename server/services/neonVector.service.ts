/**
 * neonVector.service.ts
 *
 * Neon pgvector service — vector database for semantic search and RAG.
 *
 * Storage: Neon Postgres (NEON_DATABASE_URL) with the pgvector extension.
 * Table: vector_embeddings (1536-dim, HNSW cosine index)
 *
 * Embedding model: Gemini text-embedding-004 with outputDimensionality=1536
 *   (replaces gemini-embedding-001 which produced 3072 dims — above pgvector HNSW limit)
 *
 * Namespaces (logical partitions stored as a column):
 *   "articles"      → magazine articles
 *   "books"         → book summaries and chapter chunks
 *   "authors"       → author bios and profile text
 *   "content_items" → content item descriptions
 *   "rag_files"     → full author RAG knowledge documents
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ── Constants ─────────────────────────────────────────────────────────────────

export const NEON_TABLE_NAME = "vector_embeddings";
export const EMBEDDING_DIMENSION = 1536; // Gemini text-embedding-004 truncated
export type ContentNamespace = "articles" | "books" | "authors" | "content_items" | "rag_files";

export type VectorMetadata = {
  contentType: "article" | "book" | "author" | "content_item" | "rag_file";
  sourceId: string;
  title: string;
  authorName?: string;
  source?: string;
  url?: string;
  publishedAt?: string;
  chunkIndex?: number;
  chunkTotal?: number;
  text: string;
  category?: string;
  bookCount?: number;
  enrichedAt?: string;
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

// ── Neon client singleton ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlFn = ReturnType<typeof neon>;

let _sql: SqlFn | null = null;

function getSql(): SqlFn {
  if (!_sql) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error("NEON_DATABASE_URL environment variable is not set");
    _sql = neon(url);
  }
  return _sql;
}

// ── Index management (no-op stubs for API compatibility) ──────────────────────

/**
 * Ensure the vector_embeddings table and indexes exist.
 * Idempotent — safe to call on every startup.
 */
export async function ensureIndex(): Promise<void> {
  const sql = getSql();
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`
    CREATE TABLE IF NOT EXISTS vector_embeddings (
      id           TEXT PRIMARY KEY,
      namespace    TEXT NOT NULL,
      embedding    vector(1536) NOT NULL,
      content_type TEXT NOT NULL,
      source_id    TEXT NOT NULL,
      title        TEXT NOT NULL,
      author_name  TEXT,
      source       TEXT,
      url          TEXT,
      published_at TEXT,
      chunk_index  INTEGER DEFAULT 0,
      chunk_total  INTEGER DEFAULT 1,
      text         TEXT NOT NULL,
      category     TEXT,
      book_count   INTEGER,
      enriched_at  TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_vec_namespace ON vector_embeddings(namespace)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vec_source_id  ON vector_embeddings(source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vec_embedding  ON vector_embeddings USING hnsw (embedding vector_cosine_ops)`;
}

/**
 * Return per-namespace vector counts (mirrors describeIndexStats shape).
 */
export async function getIndexStats(): Promise<{
  namespaces: Record<string, { vectorCount: number }>;
  totalVectorCount: number;
}> {
  const sql = getSql();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await sql.query(
    `SELECT namespace, COUNT(*)::text AS cnt FROM vector_embeddings GROUP BY namespace`
  )) as any[];
  const namespaces: Record<string, { vectorCount: number }> = {};
  let total = 0;
  for (const row of rows) {
    const count = parseInt(row.cnt, 10);
    namespaces[row.namespace] = { vectorCount: count };
    total += count;
  }
  return { namespaces, totalVectorCount: total };
}

// ── Vector operations ─────────────────────────────────────────────────────────

/**
 * Upsert a batch of vectors (INSERT … ON CONFLICT DO UPDATE).
 */
export async function upsertVectors(vectors: UpsertVectorInput[]): Promise<void> {
  if (vectors.length === 0) return;
  const sql = getSql();

  // Process in batches of 50 to stay within Neon HTTP payload limits
  const BATCH = 50;
  for (let i = 0; i < vectors.length; i += BATCH) {
    const batch = vectors.slice(i, i + BATCH);
    for (const v of batch) {
      const m = v.metadata;
      const embStr = `[${v.values.join(",")}]`;
      await sql`
        INSERT INTO vector_embeddings
          (id, namespace, embedding, content_type, source_id, title,
           author_name, source, url, published_at, chunk_index, chunk_total,
           text, category, book_count, enriched_at, updated_at)
        VALUES (
          ${v.id}, ${v.namespace}, ${embStr}::vector,
          ${m.contentType}, ${m.sourceId}, ${m.title},
          ${m.authorName ?? null}, ${m.source ?? null}, ${m.url ?? null},
          ${m.publishedAt ?? null}, ${m.chunkIndex ?? 0}, ${m.chunkTotal ?? 1},
          ${m.text}, ${m.category ?? null}, ${m.bookCount ?? null},
          ${m.enrichedAt ?? null}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          namespace    = EXCLUDED.namespace,
          embedding    = EXCLUDED.embedding,
          content_type = EXCLUDED.content_type,
          source_id    = EXCLUDED.source_id,
          title        = EXCLUDED.title,
          author_name  = EXCLUDED.author_name,
          source       = EXCLUDED.source,
          url          = EXCLUDED.url,
          published_at = EXCLUDED.published_at,
          chunk_index  = EXCLUDED.chunk_index,
          chunk_total  = EXCLUDED.chunk_total,
          text         = EXCLUDED.text,
          category     = EXCLUDED.category,
          book_count   = EXCLUDED.book_count,
          enriched_at  = EXCLUDED.enriched_at,
          updated_at   = NOW()
      `;
    }
  }
}

/**
 * Query for semantically similar vectors in a namespace using cosine distance.
 */
export async function queryVectors(
  queryEmbedding: number[],
  namespace: ContentNamespace,
  options: { topK?: number; filter?: Record<string, unknown> } = {}
): Promise<QueryResult[]> {
  const sql = getSql();
  const topK = options.topK ?? 10;
  const embStr = `[${queryEmbedding.join(",")}]`;

  // Build optional WHERE clauses from filter (supports category, authorName)
  const filter = options.filter ?? {};
  const category = (filter["category"] as string | undefined) ?? null;
  const authorName = (filter["authorName"] as string | undefined) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];
  if (category && authorName) {
    rows = (await sql.query(
      `SELECT id, content_type, source_id, title, author_name, source, url,
              published_at, chunk_index, chunk_total, text, category, book_count, enriched_at,
              (1 - (embedding <=> $1::vector))::text AS score
       FROM vector_embeddings
       WHERE namespace = $2 AND category = $3 AND author_name = $4
       ORDER BY embedding <=> $1::vector LIMIT $5`,
      [embStr, namespace, category, authorName, topK]
    )) as any[];
  } else if (category) {
    rows = (await sql.query(
      `SELECT id, content_type, source_id, title, author_name, source, url,
              published_at, chunk_index, chunk_total, text, category, book_count, enriched_at,
              (1 - (embedding <=> $1::vector))::text AS score
       FROM vector_embeddings
       WHERE namespace = $2 AND category = $3
       ORDER BY embedding <=> $1::vector LIMIT $4`,
      [embStr, namespace, category, topK]
    )) as any[];
  } else if (authorName) {
    rows = (await sql.query(
      `SELECT id, content_type, source_id, title, author_name, source, url,
              published_at, chunk_index, chunk_total, text, category, book_count, enriched_at,
              (1 - (embedding <=> $1::vector))::text AS score
       FROM vector_embeddings
       WHERE namespace = $2 AND author_name = $3
       ORDER BY embedding <=> $1::vector LIMIT $4`,
      [embStr, namespace, authorName, topK]
    )) as any[];
  } else {
    rows = (await sql.query(
      `SELECT id, content_type, source_id, title, author_name, source, url,
              published_at, chunk_index, chunk_total, text, category, book_count, enriched_at,
              (1 - (embedding <=> $1::vector))::text AS score
       FROM vector_embeddings
       WHERE namespace = $2
       ORDER BY embedding <=> $1::vector LIMIT $3`,
      [embStr, namespace, topK]
    )) as any[];
  }

  return rows.map(r => ({
    id: r.id,
    score: parseFloat(r.score),
    metadata: {
      contentType: r.content_type as VectorMetadata["contentType"],
      sourceId: r.source_id,
      title: r.title,
      authorName: r.author_name ?? undefined,
      source: r.source ?? undefined,
      url: r.url ?? undefined,
      publishedAt: r.published_at ?? undefined,
      chunkIndex: r.chunk_index,
      chunkTotal: r.chunk_total,
      text: r.text,
      category: r.category ?? undefined,
      bookCount: r.book_count ?? undefined,
      enrichedAt: r.enriched_at ?? undefined,
    },
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
  const all = settled.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  return all.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Delete vectors by IDs in a namespace.
 */
export async function deleteVectors(ids: string[], namespace: ContentNamespace): Promise<void> {
  if (ids.length === 0) return;
  const sql = getSql();
  for (const id of ids) {
    await sql`DELETE FROM vector_embeddings WHERE id = ${id} AND namespace = ${namespace}`;
  }
}

// ── Text chunking ────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks suitable for embedding.
 * Target: ~500 tokens (~2000 chars) with 200-char overlap.
 */
export function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= chunkSize) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    let breakPoint = end;
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf(". ", end);
      const lastNewline = cleaned.lastIndexOf("\n", end);
      const boundary = Math.max(lastPeriod, lastNewline);
      if (boundary > start + chunkSize / 2) breakPoint = boundary + 1;
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
