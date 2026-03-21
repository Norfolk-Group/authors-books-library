/**
 * Tests for batch author bio enrichment logic
 */
import { describe, it, expect, vi } from "vitest";

// -- Batch chunking logic --------------------------------------

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

describe("chunkArray", () => {
  it("splits an array into equal-sized chunks", () => {
    const chunks = chunkArray([1, 2, 3, 4, 5, 6], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it("handles a remainder chunk smaller than batch size", () => {
    const chunks = chunkArray([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles an array smaller than batch size", () => {
    const chunks = chunkArray([1, 2], 10);
    expect(chunks).toEqual([[1, 2]]);
  });

  it("handles an empty array", () => {
    const chunks = chunkArray([], 5);
    expect(chunks).toEqual([]);
  });

  it("handles batch size of 1", () => {
    const chunks = chunkArray(["a", "b", "c"], 1);
    expect(chunks).toEqual([["a"], ["b"], ["c"]]);
  });
});

// -- Progress calculation --------------------------------------

function calcProgress(processed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((processed / total) * 100);
}

describe("calcProgress", () => {
  it("returns 0 at start", () => {
    expect(calcProgress(0, 100)).toBe(0);
  });

  it("returns 100 when complete", () => {
    expect(calcProgress(100, 100)).toBe(100);
  });

  it("returns 50 at halfway", () => {
    expect(calcProgress(50, 100)).toBe(50);
  });

  it("rounds to nearest integer", () => {
    expect(calcProgress(1, 3)).toBe(33);
    expect(calcProgress(2, 3)).toBe(67);
  });

  it("handles total of 0 gracefully", () => {
    expect(calcProgress(0, 0)).toBe(100);
  });
});

// -- Author name normalization for batch -----------------------

function extractDisplayName(rawName: string): string {
  const dashIdx = rawName.indexOf(" - ");
  return dashIdx !== -1 ? rawName.slice(0, dashIdx) : rawName;
}

function getUniqueAuthorNames(authors: { name: string }[]): string[] {
  return Array.from(new Set(authors.map((a) => extractDisplayName(a.name))));
}

describe("getUniqueAuthorNames", () => {
  it("strips author suffix from name", () => {
    expect(extractDisplayName("Adam Grant - Organizational Psychology")).toBe("Adam Grant");
    expect(extractDisplayName("Simon Sinek")).toBe("Simon Sinek");
  });

  it("deduplicates names with different suffixes", () => {
    const authors = [
      { name: "Adam Grant" },
      { name: "Adam Grant - Organizational Psychology" },
      { name: "Simon Sinek" },
    ];
    const names = getUniqueAuthorNames(authors);
    expect(names).toContain("Adam Grant");
    expect(names).toContain("Simon Sinek");
    expect(names.length).toBe(2);
  });

  it("handles empty list", () => {
    expect(getUniqueAuthorNames([])).toEqual([]);
  });

  it("preserves co-author names", () => {
    const authors = [{ name: "Aaron Ross and Jason Lemkin" }];
    const names = getUniqueAuthorNames(authors);
    expect(names).toEqual(["Aaron Ross and Jason Lemkin"]);
  });
});

// -- Batch result aggregation ----------------------------------

type BatchResult = { authorName: string; success: boolean };

function aggregateResults(batches: BatchResult[][]): { done: number; failed: number } {
  let done = 0;
  let failed = 0;
  for (const batch of batches) {
    for (const r of batch) {
      if (r.success) done++;
      else failed++;
    }
  }
  return { done, failed };
}

describe("aggregateResults", () => {
  it("counts all successes and failures", () => {
    const batches: BatchResult[][] = [
      [{ authorName: "A", success: true }, { authorName: "B", success: false }],
      [{ authorName: "C", success: true }, { authorName: "D", success: true }],
    ];
    const { done, failed } = aggregateResults(batches);
    expect(done).toBe(3);
    expect(failed).toBe(1);
  });

  it("handles all successes", () => {
    const batches: BatchResult[][] = [
      [{ authorName: "A", success: true }, { authorName: "B", success: true }],
    ];
    const { done, failed } = aggregateResults(batches);
    expect(done).toBe(2);
    expect(failed).toBe(0);
  });

  it("handles all failures", () => {
    const batches: BatchResult[][] = [
      [{ authorName: "A", success: false }, { authorName: "B", success: false }],
    ];
    const { done, failed } = aggregateResults(batches);
    expect(done).toBe(0);
    expect(failed).toBe(2);
  });

  it("handles empty batches", () => {
    const { done, failed } = aggregateResults([]);
    expect(done).toBe(0);
    expect(failed).toBe(0);
  });
});

// -- Enrichment cache check logic ------------------------------

describe("enrichment cache check", () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  function isStale(enrichedAt: Date | null | undefined): boolean {
    if (!enrichedAt) return true;
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    return enrichedAt < thirtyDaysAgo;
  }

  it("treats null enrichedAt as stale", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(undefined)).toBe(true);
  });

  it("treats a date 31 days ago as stale", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(isStale(old)).toBe(true);
  });

  it("treats a date 1 day ago as fresh", () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(isStale(recent)).toBe(false);
  });

  it("treats a date exactly 29 days ago as fresh", () => {
    const recent = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    expect(isStale(recent)).toBe(false);
  });
});

// -- Enrichment indicator tests ----------------------------------------------

describe("enrichedSet logic", () => {
  it("correctly identifies enriched authors from a name list", () => {
    const enrichedNames = ["Adam Grant", "Simon Sinek", "Mel Robbins"];
    const enrichedSet = new Set(enrichedNames);

    expect(enrichedSet.has("Adam Grant")).toBe(true);
    expect(enrichedSet.has("Simon Sinek")).toBe(true);
    expect(enrichedSet.has("Mel Robbins")).toBe(true);
    expect(enrichedSet.has("Tim Ferriss")).toBe(false);
    expect(enrichedSet.has("")).toBe(false);
  });

  it("extracts base name from 'Name - Specialty' format for lookup", () => {
    const extractBaseName = (name: string) =>
      name.includes(" - ") ? name.slice(0, name.indexOf(" - ")) : name;

    expect(extractBaseName("Adam Grant - Psychology")).toBe("Adam Grant");
    expect(extractBaseName("Simon Sinek")).toBe("Simon Sinek");
    expect(extractBaseName("Dan Heath and Chip Heath - Strategy")).toBe("Dan Heath and Chip Heath");
  });

  it("handles empty enriched names list gracefully", () => {
    const enrichedSet = new Set<string>([]);
    expect(enrichedSet.has("Adam Grant")).toBe(false);
    expect(enrichedSet.size).toBe(0);
  });

  it("handles undefined enriched names (loading state) gracefully", () => {
    const enrichedNames: string[] | undefined = undefined;
    const enrichedSet = new Set(enrichedNames ?? []);
    expect(enrichedSet.has("Adam Grant")).toBe(false);
    expect(enrichedSet.size).toBe(0);
  });

  it("correctly updates enrichedSet after batch enrichment", () => {
    // Simulate initial state: 2 enriched
    let enrichedNames = ["Adam Grant", "Simon Sinek"];
    let enrichedSet = new Set(enrichedNames);
    expect(enrichedSet.size).toBe(2);

    // After batch completes, 3 more are enriched
    enrichedNames = [...enrichedNames, "Mel Robbins", "Tim Ferriss", "James Clear"];
    enrichedSet = new Set(enrichedNames);
    expect(enrichedSet.size).toBe(5);
    expect(enrichedSet.has("James Clear")).toBe(true);
  });
});
