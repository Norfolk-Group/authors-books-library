/**
 * magazine.test.ts
 *
 * Unit tests for the magazine article pipeline service and router.
 * Tests cover RSS config validation, author name normalization,
 * and the vectorSearch router schema.
 *
 * Note: the magazine.service exports PUBLICATIONS (array), normalizeName, and
 * matchArticlesToAuthor — not MAGAZINE_SOURCES, normalizeAuthorName, or
 * generateArticleId.
 */

import { describe, it, expect } from "vitest";

// ── Magazine service helpers ──────────────────────────────────────────────────

describe("Magazine service — RSS configs", () => {
  it("should have exactly 5 publication sources", async () => {
    const { PUBLICATIONS } = await import("./services/magazine.service");
    expect(PUBLICATIONS).toHaveLength(5);
  });

  it("should include all required publication source keys", async () => {
    const { PUBLICATIONS } = await import("./services/magazine.service");
    const sources = PUBLICATIONS.map((p) => p.source);
    expect(sources).toContain("the-atlantic");
    expect(sources).toContain("the-new-yorker");
    expect(sources).toContain("wired");
    expect(sources).toContain("nyt");
    expect(sources).toContain("washington-post");
  });

  it("each publication should have a name, source, and at least one feed URL", async () => {
    const { PUBLICATIONS } = await import("./services/magazine.service");
    for (const pub of PUBLICATIONS) {
      expect(pub.source, `${pub.source} missing source`).toBeTruthy();
      expect(pub.name, `${pub.source} missing name`).toBeTruthy();
      expect(pub.feeds.length, `${pub.source} has no feeds`).toBeGreaterThan(0);
      for (const feed of pub.feeds) {
        expect(feed).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe("Magazine service — author name normalization", () => {
  it("should normalize author names to lowercase", async () => {
    const { normalizeName } = await import("./services/magazine.service");
    expect(normalizeName("Adam Grant")).toBe("adam grant");
    expect(normalizeName("Yuval Noah Harari")).toBe("yuval noah harari");
    expect(normalizeName("  Derek  Thompson  ")).toBe("derek thompson");
  });

  it("should handle names with accented characters", async () => {
    const { normalizeName } = await import("./services/magazine.service");
    const result = normalizeName("José García");
    // Should strip accents and normalize
    expect(result).toBe("jose garcia");
  });

  it("should return empty string for empty input", async () => {
    const { normalizeName } = await import("./services/magazine.service");
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });
});

describe("Magazine service — matchArticlesToAuthor", () => {
  it("should export matchArticlesToAuthor function", async () => {
    const { matchArticlesToAuthor } = await import("./services/magazine.service");
    expect(typeof matchArticlesToAuthor).toBe("function");
  });

  it("should match articles by normalised author name", async () => {
    const { matchArticlesToAuthor } = await import("./services/magazine.service");
    const articles = [
      { authorNameNormalized: "adam grant", title: "A1" },
      { authorNameNormalized: "james clear", title: "A2" },
      { authorNameNormalized: "adam grant", title: "A3" },
    ] as Parameters<typeof matchArticlesToAuthor>[0];
    const matched = matchArticlesToAuthor(articles, "Adam Grant");
    expect(matched).toHaveLength(2);
    expect(matched.map((a) => a.title)).toContain("A1");
    expect(matched.map((a) => a.title)).toContain("A3");
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
