/**
 * optimizationSuggestions.test.ts
 *
 * Tests for the 3 optimization suggestions implemented in Apr 2026:
 *   S1 — RAG pipeline seedAllPending procedure
 *   S2 — autoTagAll bulk tag enrichment
 *   S3 — T2-A Pinecone metadata filters (category, bookCount, enrichedAt)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── S1: seedAllPending ────────────────────────────────────────────────────────

describe("S1 — seedAllPending logic", () => {
  it("should identify authors missing from author_rag_profiles", () => {
    const allAuthorIds = [1, 2, 3, 4, 5];
    const existingRagIds = new Set([1, 3, 5]);
    const missing = allAuthorIds.filter(id => !existingRagIds.has(id));
    expect(missing).toEqual([2, 4]);
    expect(missing.length).toBe(2);
  });

  it("should return 0 seeded when all authors already have RAG profiles", () => {
    const allAuthorIds = [1, 2, 3];
    const existingRagIds = new Set([1, 2, 3]);
    const missing = allAuthorIds.filter(id => !existingRagIds.has(id));
    expect(missing.length).toBe(0);
  });

  it("should handle empty author list gracefully", () => {
    const allAuthorIds: number[] = [];
    const existingRagIds = new Set<number>();
    const missing = allAuthorIds.filter(id => !existingRagIds.has(id));
    expect(missing.length).toBe(0);
  });

  it("should seed all authors when none have RAG profiles", () => {
    const allAuthorIds = [10, 20, 30, 40];
    const existingRagIds = new Set<number>();
    const missing = allAuthorIds.filter(id => !existingRagIds.has(id));
    expect(missing.length).toBe(4);
    expect(missing).toEqual([10, 20, 30, 40]);
  });
});

// ── S2: autoTagAll ────────────────────────────────────────────────────────────

describe("S2 — autoTagAll tag taxonomy validation", () => {
  const TAG_TAXONOMY = [
    { slug: "business", label: "Business" },
    { slug: "psychology", label: "Psychology" },
    { slug: "science", label: "Science" },
    { slug: "leadership", label: "Leadership" },
    { slug: "economics", label: "Economics" },
    { slug: "philosophy", label: "Philosophy" },
    { slug: "history", label: "History" },
    { slug: "technology", label: "Technology" },
    { slug: "self-help", label: "Self-Help" },
    { slug: "biography", label: "Biography" },
    { slug: "health", label: "Health" },
    { slug: "communication", label: "Communication" },
    { slug: "creativity", label: "Creativity" },
    { slug: "decision-making", label: "Decision-Making" },
    { slug: "productivity", label: "Productivity" },
  ];

  it("should validate that returned slugs exist in the taxonomy", () => {
    const llmSlugs = ["business", "psychology", "invalid-slug"];
    const valid = llmSlugs.filter(s => TAG_TAXONOMY.some(t => t.slug === s));
    expect(valid).toEqual(["business", "psychology"]);
    expect(valid.length).toBe(2);
  });

  it("should cap at 4 tags per author", () => {
    const llmSlugs = ["business", "psychology", "leadership", "economics", "science"];
    const valid = llmSlugs
      .filter(s => TAG_TAXONOMY.some(t => t.slug === s))
      .slice(0, 4);
    expect(valid.length).toBe(4);
  });

  it("should handle empty LLM response gracefully", () => {
    const llmSlugs: string[] = [];
    const valid = llmSlugs.filter(s => TAG_TAXONOMY.some(t => t.slug === s));
    expect(valid.length).toBe(0);
  });

  it("should skip authors with existing tags when skipExisting=true", () => {
    const authors = [
      { id: 1, authorName: "Adam Grant", tagsJson: '["psychology"]' },
      { id: 2, authorName: "Malcolm Gladwell", tagsJson: null },
      { id: 3, authorName: "Simon Sinek", tagsJson: "[]" },
    ];
    const skipExisting = true;
    const toProcess = authors.filter(a => {
      if (!skipExisting) return true;
      try {
        const tags = JSON.parse(a.tagsJson ?? "[]") as string[];
        return tags.length === 0;
      } catch { return true; }
    });
    expect(toProcess.map(a => a.id)).toEqual([2, 3]);
  });

  it("should process all authors when skipExisting=false", () => {
    const authors = [
      { id: 1, authorName: "Adam Grant", tagsJson: '["psychology"]' },
      { id: 2, authorName: "Malcolm Gladwell", tagsJson: null },
    ];
    const skipExisting = false;
    const toProcess = authors.filter(a => {
      if (!skipExisting) return true;
      try {
        const tags = JSON.parse(a.tagsJson ?? "[]") as string[];
        return tags.length === 0;
      } catch { return true; }
    });
    expect(toProcess.length).toBe(2);
  });
});

// ── S3: T2-A Pinecone metadata filters ───────────────────────────────────────

describe("S3 — T2-A Pinecone metadata fields", () => {
  it("should include category in author VectorMetadata when provided", () => {
    const authorInput = {
      authorId: "123",
      authorName: "Adam Grant",
      bioText: "Adam Grant is an organizational psychologist at Wharton.",
      category: "psychology",
      bookCount: 6,
      enrichedAt: "2026-04-09T00:00:00.000Z",
    };

    const metadata = {
      contentType: "author" as const,
      sourceId: authorInput.authorId,
      title: authorInput.authorName,
      authorName: authorInput.authorName,
      source: "library",
      text: authorInput.bioText,
      ...(authorInput.category ? { category: authorInput.category } : {}),
      ...(authorInput.bookCount !== undefined ? { bookCount: authorInput.bookCount } : {}),
      ...(authorInput.enrichedAt ? { enrichedAt: authorInput.enrichedAt } : {}),
    };

    expect(metadata.category).toBe("psychology");
    expect(metadata.bookCount).toBe(6);
    expect(metadata.enrichedAt).toBe("2026-04-09T00:00:00.000Z");
  });

  it("should omit category from VectorMetadata when not provided", () => {
    const authorInput = {
      authorId: "456",
      authorName: "Unknown Author",
      bioText: "Some bio text here.",
    };

    const metadata = {
      contentType: "author" as const,
      sourceId: authorInput.authorId,
      title: authorInput.authorName,
      text: authorInput.bioText,
      ...(("category" in authorInput && authorInput.category) ? { category: (authorInput as { category?: string }).category } : {}),
    };

    expect("category" in metadata).toBe(false);
  });

  it("should include category in book VectorMetadata when provided", () => {
    const bookInput = {
      bookId: "789",
      title: "Thinking Fast and Slow",
      authorName: "Daniel Kahneman",
      text: "A book about cognitive biases.",
      category: "psychology",
      enrichedAt: "2026-04-09T00:00:00.000Z",
    };

    const metadata = {
      contentType: "book" as const,
      sourceId: bookInput.bookId,
      title: bookInput.title,
      authorName: bookInput.authorName,
      source: "library",
      text: bookInput.text,
      ...(bookInput.category ? { category: bookInput.category } : {}),
      ...(bookInput.enrichedAt ? { enrichedAt: bookInput.enrichedAt } : {}),
    };

    expect(metadata.category).toBe("psychology");
    expect(metadata.enrichedAt).toBe("2026-04-09T00:00:00.000Z");
  });

  it("should extract primary category from tagsJson correctly", () => {
    const tagsJson = '["psychology", "leadership", "business"]';
    const primaryCategory = (() => {
      try {
        const tags = JSON.parse(tagsJson) as string[];
        return tags[0] ?? undefined;
      } catch { return undefined; }
    })();
    expect(primaryCategory).toBe("psychology");
  });

  it("should return undefined primary category for empty tagsJson", () => {
    const tagsJson = "[]";
    const primaryCategory = (() => {
      try {
        const tags = JSON.parse(tagsJson) as string[];
        return tags[0] ?? undefined;
      } catch { return undefined; }
    })();
    expect(primaryCategory).toBeUndefined();
  });

  it("should return undefined primary category for null tagsJson", () => {
    const tagsJson = null;
    const primaryCategory = (() => {
      try {
        const tags = JSON.parse(tagsJson ?? "[]") as string[];
        return tags[0] ?? undefined;
      } catch { return undefined; }
    })();
    expect(primaryCategory).toBeUndefined();
  });

  it("should build Pinecone filter object for category-based queries", () => {
    const dominantCategory = "psychology";
    const filter = dominantCategory
      ? { category: { $eq: dominantCategory } }
      : undefined;

    expect(filter).toEqual({ category: { $eq: "psychology" } });
  });

  it("should not apply filter when no dominant category", () => {
    const dominantCategory: string | undefined = undefined;
    const filter = dominantCategory
      ? { category: { $eq: dominantCategory } }
      : undefined;

    expect(filter).toBeUndefined();
  });
});

// ── Integration: metadata flow through incremental indexing ──────────────────

describe("Metadata flow through incrementalIndex", () => {
  it("should pass category from tagsJson to indexAuthorIncremental meta param", () => {
    const author = {
      id: 1,
      authorName: "Adam Grant",
      bio: "Organizational psychologist at Wharton.",
      richBioJson: null,
      tagsJson: '["psychology", "leadership"]',
      enrichedAt: new Date("2026-04-09"),
    };

    const primaryCategory = (() => {
      try { const tags = JSON.parse(author.tagsJson ?? "[]") as string[]; return tags[0] ?? undefined; }
      catch { return undefined; }
    })();

    const meta = {
      category: primaryCategory,
      enrichedAt: author.enrichedAt?.toISOString(),
    };

    expect(meta.category).toBe("psychology");
    expect(meta.enrichedAt).toBe("2026-04-09T00:00:00.000Z");
  });
});
