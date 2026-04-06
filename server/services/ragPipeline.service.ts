/**
 * ragPipeline.service.ts
 *
 * RAG pipeline: embed text chunks via Gemini text-embedding-004,
 * upsert to Pinecone, and query for semantic search.
 *
 * Supported content types:
 *   - Magazine articles (from magazine_articles table)
 *   - Book summaries / chapter text
 *   - Author bios and profile text
 */

import {
  ensureIndex,
  upsertVectors,
  queryVectors,
  queryAllNamespaces,
  chunkText,
  makeVectorId,
  PINECONE_INDEX_NAME,
  type ContentNamespace,
  type VectorMetadata,
  type UpsertVectorInput,
  type QueryResult,
} from "./pinecone.service";

// ── Gemini Embedding Client (lazy import to avoid OOM in test workers) ────────────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _genai: any | null = null;

async function getGenAI() {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
    const { GoogleGenAI } = await import("@google/genai");
    _genai = new GoogleGenAI({ apiKey });
  }
  return _genai;
}

const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Embed a single text string using Gemini text-embedding-004.
 * Returns a 768-dimensional float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const genai = await getGenAI();
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text.slice(0, 8192), // Gemini max input
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned empty values");
  }
  return values;
}

/**
 * Embed multiple texts in batches (Gemini allows up to 100 per batch).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 20; // conservative to avoid rate limits
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await Promise.all(batch.map(t => embedText(t)));
    results.push(...embeddings);
    // Small delay to respect rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

// ── Index Article ─────────────────────────────────────────────────────────────

export type IndexArticleInput = {
  articleId: string;
  title: string;
  authorName?: string | null;
  source: string;
  url: string;
  publishedAt?: Date | null;
  text: string; // summaryText or fullText
};

/**
 * Chunk an article, embed each chunk, and upsert to Pinecone.
 * Returns the number of vectors upserted.
 */
export async function indexArticle(article: IndexArticleInput): Promise<number> {
  await ensureIndex();

  const chunks = chunkText(article.text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  const vectors: UpsertVectorInput[] = chunks.map((chunk, i) => ({
    id: makeVectorId("article", article.articleId, i),
    values: embeddings[i],
    namespace: "articles" as ContentNamespace,
    metadata: {
      contentType: "article",
      sourceId: article.articleId,
      title: article.title,
      authorName: article.authorName ?? undefined,
      source: article.source,
      url: article.url,
      publishedAt: article.publishedAt?.toISOString(),
      chunkIndex: i,
      chunkTotal: chunks.length,
      text: chunk,
    } satisfies VectorMetadata,
  }));

  await upsertVectors(vectors);
  return vectors.length;
}

// ── Index Book ────────────────────────────────────────────────────────────────

export type IndexBookInput = {
  bookId: string;
  title: string;
  authorName?: string | null;
  text: string; // description, summary, or extracted chapter text
};

/**
 * Chunk a book's text, embed each chunk, and upsert to Pinecone.
 */
export async function indexBook(book: IndexBookInput): Promise<number> {
  await ensureIndex();

  const chunks = chunkText(book.text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  const vectors: UpsertVectorInput[] = chunks.map((chunk, i) => ({
    id: makeVectorId("book", book.bookId, i),
    values: embeddings[i],
    namespace: "books" as ContentNamespace,
    metadata: {
      contentType: "book",
      sourceId: book.bookId,
      title: book.title,
      authorName: book.authorName ?? undefined,
      source: "library",
      chunkIndex: i,
      chunkTotal: chunks.length,
      text: chunk,
    } satisfies VectorMetadata,
  }));

  await upsertVectors(vectors);
  return vectors.length;
}

// ── Index Author ──────────────────────────────────────────────────────────────

export type IndexAuthorInput = {
  authorId: string;
  authorName: string;
  bioText: string; // Wikipedia bio, profile text, etc.
};

/**
 * Embed an author's bio text and upsert to Pinecone.
 */
export async function indexAuthor(author: IndexAuthorInput): Promise<number> {
  await ensureIndex();

  const chunks = chunkText(author.bioText, 3000, 300); // larger chunks for bios
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  const vectors: UpsertVectorInput[] = chunks.map((chunk, i) => ({
    id: makeVectorId("author", author.authorId, i),
    values: embeddings[i],
    namespace: "authors" as ContentNamespace,
    metadata: {
      contentType: "author",
      sourceId: author.authorId,
      title: author.authorName,
      authorName: author.authorName,
      source: "library",
      chunkIndex: i,
      chunkTotal: chunks.length,
      text: chunk,
    } satisfies VectorMetadata,
  }));

  await upsertVectors(vectors);
  return vectors.length;
}

// ── Semantic Search ───────────────────────────────────────────────────────────

export type SemanticSearchOptions = {
  query: string;
  namespace?: ContentNamespace;
  topK?: number;
  filterAuthor?: string;
  filterSource?: string;
};

export type SemanticSearchResult = QueryResult & {
  snippet: string;
};

/**
 * Embed a query and search Pinecone for semantically similar content.
 */
export async function semanticSearch(
  options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
  const { query, namespace, topK = 10, filterAuthor, filterSource } = options;

  const queryEmbedding = await embedText(query);

  const filter: Record<string, unknown> = {};
  if (filterAuthor) filter.authorName = { $eq: filterAuthor };
  if (filterSource) filter.source = { $eq: filterSource };

  let results: QueryResult[];
  if (namespace) {
    results = await queryVectors(queryEmbedding, namespace, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });
  } else {
    results = await queryAllNamespaces(
      queryEmbedding,
      topK,
      Object.keys(filter).length > 0 ? filter : undefined
    );
  }

  return results.map(r => ({
    ...r,
    snippet: r.metadata.text.slice(0, 300) + (r.metadata.text.length > 300 ? "…" : ""),
  }));
}

// ── Index Content Item ───────────────────────────────────────────────────────

export type IndexContentItemInput = {
  itemId: string;
  title: string;
  authorName?: string | null;
  contentType: string; // podcast, video, newsletter, etc.
  url?: string | null;
  description: string;
};

/**
 * Embed a content item's description and upsert to Pinecone.
 */
export async function indexContentItem(item: IndexContentItemInput): Promise<number> {
  await ensureIndex();
  const chunks = chunkText(item.description, 2000, 200);
  if (chunks.length === 0) return 0;
  const embeddings = await embedBatch(chunks);
  const vectors: UpsertVectorInput[] = chunks.map((chunk, i) => ({
    id: makeVectorId("content_item", item.itemId, i),
    values: embeddings[i],
    namespace: "content_items" as ContentNamespace,
    metadata: {
      contentType: "content_item",
      sourceId: item.itemId,
      title: item.title,
      authorName: item.authorName ?? undefined,
      source: item.contentType,
      url: item.url ?? undefined,
      chunkIndex: i,
      chunkTotal: chunks.length,
      text: chunk,
    } satisfies VectorMetadata,
  }));
  await upsertVectors(vectors);
  return vectors.length;
}

// ── Index RAG File ────────────────────────────────────────────────────────────

export type IndexRagFileInput = {
  authorName: string;
  ragContent: string; // full markdown RAG document
  ragVersion?: number;
};

/**
 * Chunk and embed a full author RAG file, upsert to Pinecone rag_files namespace.
 */
export async function indexRagFile(input: IndexRagFileInput): Promise<number> {
  await ensureIndex();
  const chunks = chunkText(input.ragContent, 3000, 300);
  if (chunks.length === 0) return 0;
  const embeddings = await embedBatch(chunks);
  const safeId = input.authorName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const vectors: UpsertVectorInput[] = chunks.map((chunk, i) => ({
    id: makeVectorId("rag_file", safeId, i),
    values: embeddings[i],
    namespace: "rag_files" as ContentNamespace,
    metadata: {
      contentType: "rag_file",
      sourceId: safeId,
      title: input.authorName,
      authorName: input.authorName,
      source: "rag",
      chunkIndex: i,
      chunkTotal: chunks.length,
      text: chunk,
    } satisfies VectorMetadata,
  }));
  await upsertVectors(vectors);
  return vectors.length;
}

// ── Convenience re-exports ────────────────────────────────────────────────────

export { ensureIndex, getIndexStats } from "./pinecone.service";
