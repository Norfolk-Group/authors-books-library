/**
 * magazine.test.ts
 *
 * Unit tests for the magazine article pipeline service and router.
 * Tests cover RSS config validation, author name normalization,
 * article ID generation, and the vectorSearch router schema.
 */

import { describe, it, expect } from "vitest";

// ── Magazine service helpers ──────────────────────────────────────────────────

describe("Magazine service — RSS configs", () => {
  it("should have exactly 5 publication sources", async () => {
    const { MAGAZINE_SOURCES } = await import("./services/magazine.service");
    expect(Object.keys(MAGAZINE_SOURCES)).toHaveLength(5);
  });

  it("should include all required publication keys", async () => {
    const { MAGAZINE_SOURCES } = await import("./services/magazine.service");
    const keys = Object.keys(MAGAZINE_SOURCES);
    expect(keys).toContain("the-atlantic");
    expect(keys).toContain("the-new-yorker");
    expect(keys).toContain("wired");
    expect(keys).toContain("nyt");
    expect(keys).toContain("washington-post");
  });

  it("each source should have a feedUrl and publicationName", async () => {
    const { MAGAZINE_SOURCES } = await import("./services/magazine.service");
    for (const [key, config] of Object.entries(MAGAZINE_SOURCES)) {
      expect(config.feedUrl, `${key} missing feedUrl`).toBeTruthy();
      expect(config.publicationName, `${key} missing publicationName`).toBeTruthy();
      expect(config.feedUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe("Magazine service — author name normalization", () => {
  it("should normalize author names to lowercase with no accents", async () => {
    const { normalizeAuthorName } = await import("./services/magazine.service");
    expect(normalizeAuthorName("Adam Grant")).toBe("adam grant");
    expect(normalizeAuthorName("Yuval Noah Harari")).toBe("yuval noah harari");
    expect(normalizeAuthorName("  Derek  Thompson  ")).toBe("derek thompson");
  });

  it("should handle names with special characters", async () => {
    const { normalizeAuthorName } = await import("./services/magazine.service");
    // Should strip accents and normalize
    const result = normalizeAuthorName("José García");
    expect(result).toBe("jose garcia");
  });

  it("should return empty string for empty input", async () => {
    const { normalizeAuthorName } = await import("./services/magazine.service");
    expect(normalizeAuthorName("")).toBe("");
    expect(normalizeAuthorName("   ")).toBe("");
  });
});

describe("Magazine service — article ID generation", () => {
  it("should generate a deterministic article ID from source and URL", async () => {
    const { generateArticleId } = await import("./services/magazine.service");
    const id1 = generateArticleId("the-atlantic", "https://theatlantic.com/article/123");
    const id2 = generateArticleId("the-atlantic", "https://theatlantic.com/article/123");
    expect(id1).toBe(id2);
  });

  it("should generate different IDs for different sources", async () => {
    const { generateArticleId } = await import("./services/magazine.service");
    const id1 = generateArticleId("the-atlantic", "https://example.com/article");
    const id2 = generateArticleId("wired", "https://example.com/article");
    expect(id1).not.toBe(id2);
  });

  it("should generate different IDs for different URLs", async () => {
    const { generateArticleId } = await import("./services/magazine.service");
    const id1 = generateArticleId("nyt", "https://nytimes.com/article/1");
    const id2 = generateArticleId("nyt", "https://nytimes.com/article/2");
    expect(id1).not.toBe(id2);
  });

  it("should produce a non-empty string", async () => {
    const { generateArticleId } = await import("./services/magazine.service");
    const id = generateArticleId("wired", "https://wired.com/story/test");
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

// ── Pinecone service ──────────────────────────────────────────────────────────

describe("Pinecone service — configuration", () => {
  it("should export required functions", async () => {
    const pineconeModule = await import("./services/pinecone.service");
    expect(typeof pineconeModule.ensureIndex).toBe("function");
    expect(typeof pineconeModule.upsertVectors).toBe("function");
    expect(typeof pineconeModule.queryVectors).toBe("function");
    expect(typeof pineconeModule.getIndexStats).toBe("function");
    expect(typeof pineconeModule.chunkText).toBe("function");
  });

  it("should have the correct index name constant", async () => {
    const { PINECONE_INDEX_NAME } = await import("./services/pinecone.service");
    expect(PINECONE_INDEX_NAME).toBe("library-rag");
  });

  it("should have the correct embedding dimension", async () => {
    const { EMBEDDING_DIMENSION } = await import("./services/pinecone.service");
    expect(EMBEDDING_DIMENSION).toBe(768);
  });
});

// ── RAG pipeline service ──────────────────────────────────────────────────────

describe("RAG pipeline service — text chunking", () => {
  it("should export required functions", async () => {
    const ragModule = await import("./services/ragPipeline.service");
    expect(typeof ragModule.semanticSearch).toBe("function");
    expect(typeof ragModule.indexArticle).toBe("function");
    expect(typeof ragModule.indexBook).toBe("function");
    expect(typeof ragModule.indexAuthor).toBe("function");
    expect(typeof ragModule.ensureIndex).toBe("function");
    expect(typeof ragModule.getIndexStats).toBe("function");
  });

  it("should chunk text into segments under max size", async () => {
    const { chunkText } = await import("./services/pinecone.service");
    const longText = "This is a sentence. ".repeat(200); // ~4000 chars
    const chunks = chunkText(longText, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(550); // max + some overlap tolerance
    }
  });

  it("should return a single chunk for short text", async () => {
    const { chunkText } = await import("./services/pinecone.service");
    const shortText = "This is a short article about productivity.";
    const chunks = chunkText(shortText, 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(shortText);
  });

  it("should handle empty text gracefully", async () => {
    const { chunkText } = await import("./services/pinecone.service");
    const chunks = chunkText("", 500, 50);
    expect(chunks).toHaveLength(0);
  });
});
