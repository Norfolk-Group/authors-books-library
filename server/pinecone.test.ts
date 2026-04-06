/**
 * pinecone.test.ts
 *
 * Unit tests for the Pinecone vector search service and RAG pipeline.
 * Isolated in a separate file from magazine.test.ts to prevent OOM crashes
 * caused by loading @google/genai + @pinecone/data-plane in the same worker.
 */

import { describe, it, expect } from "vitest";

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
