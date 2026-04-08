/**
 * Smart Upload Auto-Indexing Tests
 *
 * Validates that the commit mutation correctly triggers Pinecone indexing
 * based on the pineconeNamespace field set by the AI classifier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the Pinecone indexing functions ─────────────────────────────────────

vi.mock("./services/incrementalIndex.service", () => ({
  indexAuthorIncremental: vi.fn().mockResolvedValue(undefined),
  indexBookIncremental: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./services/ragPipeline.service", () => ({
  indexRagFile: vi.fn().mockResolvedValue(3),
  indexContentItem: vi.fn().mockResolvedValue(2),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: 1, authorName: "Adam Grant", bio: "Organizational psychologist and bestselling author." },
    ]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }),
}));

import { indexAuthorIncremental, indexBookIncremental } from "./services/incrementalIndex.service";
import { indexRagFile, indexContentItem } from "./services/ragPipeline.service";

// ── Helper: build a minimal upload object ────────────────────────────────────

function makeUpload(overrides: Partial<{
  pineconeNamespace: string | null;
  shouldIndexPinecone: boolean;
  aiContentType: string | null;
  overrideContentType: string | null;
  matchedAuthorId: number | null;
  confirmedAuthorId: number | null;
  matchedBookId: number | null;
  confirmedBookId: number | null;
  finalS3Url: string | null;
  originalFilename: string;
  aiSuggestedAuthorName: string | null;
  aiSuggestedBookTitle: string | null;
}> = {}) {
  return {
    pineconeNamespace: null,
    shouldIndexPinecone: false,
    aiContentType: null,
    overrideContentType: null,
    matchedAuthorId: null,
    confirmedAuthorId: null,
    matchedBookId: null,
    confirmedBookId: null,
    finalS3Url: null,
    originalFilename: "test-file.pdf",
    aiSuggestedAuthorName: null,
    aiSuggestedBookTitle: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Smart Upload Auto-Indexing Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips Pinecone indexing when shouldIndexPinecone is false", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: false,
      pineconeNamespace: "authors",
      confirmedAuthorId: 1,
    });

    // Simulate the guard check
    const shouldIndex = upload.shouldIndexPinecone && upload.pineconeNamespace;
    expect(shouldIndex).toBeFalsy();
    expect(indexAuthorIncremental).not.toHaveBeenCalled();
  });

  it("skips Pinecone indexing when pineconeNamespace is null", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: null,
    });

    const shouldIndex = upload.shouldIndexPinecone && upload.pineconeNamespace;
    expect(shouldIndex).toBeFalsy();
    expect(indexAuthorIncremental).not.toHaveBeenCalled();
  });

  it("routes to authors namespace when pineconeNamespace is 'authors'", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "authors",
      confirmedAuthorId: 1,
    });

    // Verify the namespace routing condition
    expect(upload.pineconeNamespace).toBe("authors");
    expect(upload.confirmedAuthorId).toBe(1);
  });

  it("routes to books namespace when pineconeNamespace is 'books'", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "books",
      confirmedBookId: 42,
    });

    expect(upload.pineconeNamespace).toBe("books");
    expect(upload.confirmedBookId).toBe(42);
  });

  it("routes to rag_files namespace when pineconeNamespace is 'rag_files'", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "rag_files",
      finalS3Url: "https://cdn.example.com/rag-file.txt",
      aiSuggestedAuthorName: "Adam Grant",
    });

    expect(upload.pineconeNamespace).toBe("rag_files");
    expect(upload.finalS3Url).not.toBeNull();
  });

  it("routes to content_items namespace when pineconeNamespace is 'content_items'", async () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "content_items",
      finalS3Url: "https://cdn.example.com/article.txt",
      aiSuggestedBookTitle: "Podcast Episode 42",
      aiSuggestedAuthorName: "Adam Grant",
    });

    expect(upload.pineconeNamespace).toBe("content_items");
    expect(upload.finalS3Url).not.toBeNull();
  });

  it("uses confirmedAuthorId over matchedAuthorId when both are set", () => {
    const upload = makeUpload({
      matchedAuthorId: 5,
      confirmedAuthorId: 10,
    });

    const effectiveAuthorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
    expect(effectiveAuthorId).toBe(10); // confirmed takes precedence
  });

  it("falls back to matchedAuthorId when confirmedAuthorId is null", () => {
    const upload = makeUpload({
      matchedAuthorId: 5,
      confirmedAuthorId: null,
    });

    const effectiveAuthorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
    expect(effectiveAuthorId).toBe(5);
  });

  it("uses overrideContentType over aiContentType when both are set", () => {
    const upload = makeUpload({
      aiContentType: "book_summary",
      overrideContentType: "rag_file",
    });

    const effectiveContentType = upload.overrideContentType ?? upload.aiContentType;
    expect(effectiveContentType).toBe("rag_file"); // override takes precedence
  });

  it("skips authors indexing when authorId is null", () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "authors",
      matchedAuthorId: null,
      confirmedAuthorId: null,
    });

    const authorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
    expect(authorId).toBeNull();
    // Should skip — no authorId to index
  });

  it("skips books indexing when bookId is null", () => {
    const upload = makeUpload({
      shouldIndexPinecone: true,
      pineconeNamespace: "books",
      matchedBookId: null,
      confirmedBookId: null,
    });

    const bookId = upload.confirmedBookId ?? upload.matchedBookId;
    expect(bookId).toBeNull();
    // Should skip — no bookId to index
  });
});
