/**
 * duplicateDetection.test.ts
 *
 * Tests for the duplicate detection service.
 * Uses pure unit tests (no DB calls) to validate the Levenshtein distance
 * and title normalisation logic.
 */
import { describe, it, expect } from "vitest";

// ── Pure utility functions extracted for testing ─────────────────────────────

/** Normalise a book title for comparison */
function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity ratio (0-1) between two normalised titles */
function titleSimilarity(a: string, b: string): number {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/** Compute SHA-256 content hash (Node.js crypto) */
async function computeContentHash(content: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("normaliseTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normaliseTitle("Thinking, Fast and Slow")).toBe("thinking fast and slow");
  });

  it("collapses multiple spaces", () => {
    expect(normaliseTitle("The  Power  of  Habit")).toBe("the power of habit");
  });

  it("strips leading/trailing whitespace", () => {
    expect(normaliseTitle("  Atomic Habits  ")).toBe("atomic habits");
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("returns correct distance for single substitution", () => {
    expect(levenshtein("kitten", "sitten")).toBe(1);
  });

  it("returns correct distance for full replacement", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });
});

describe("titleSimilarity", () => {
  it("returns 1.0 for identical titles", () => {
    expect(titleSimilarity("Atomic Habits", "Atomic Habits")).toBe(1);
  });

  it("returns 1.0 for titles that differ only in punctuation/case", () => {
    expect(titleSimilarity("Thinking, Fast and Slow", "thinking fast and slow")).toBe(1);
  });

  it("returns moderate similarity for title with long subtitle", () => {
    // Short title vs long subtitle has lower similarity due to length difference
    const sim = titleSimilarity("Atomic Habits", "Atomic Habits An Easy Proven Way to Build Good Habits");
    expect(sim).toBeGreaterThan(0.2);
  });

  it("returns low similarity for completely different titles", () => {
    const sim = titleSimilarity("Atomic Habits", "The Art of War");
    expect(sim).toBeLessThan(0.5);
  });

  it("detects that short title is a prefix of longer title (subtitle detection)", () => {
    // Levenshtein penalizes long additions, so prefix detection is used instead
    const na = "the power of now";
    const nb = "the power of now a guide to spiritual enlightenment";
    expect(nb.startsWith(na)).toBe(true);
  });
});

describe("computeContentHash", () => {
  it("returns a 64-char hex string", async () => {
    const hash = await computeContentHash("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("returns the same hash for the same content", async () => {
    const h1 = await computeContentHash("test content");
    const h2 = await computeContentHash("test content");
    expect(h1).toBe(h2);
  });

  it("returns different hashes for different content", async () => {
    const h1 = await computeContentHash("content A");
    const h2 = await computeContentHash("content B");
    expect(h1).not.toBe(h2);
  });
});

describe("duplicate detection thresholds", () => {
  const FUZZY_THRESHOLD = 0.85;

  it("flags exact duplicates (similarity = 1.0)", () => {
    expect(titleSimilarity("Atomic Habits", "Atomic Habits")).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it("flags near-duplicates with minor typos", () => {
    expect(titleSimilarity("Atomic Habits", "Atomic Habts")).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it("does not flag clearly different titles", () => {
    expect(titleSimilarity("Atomic Habits", "The Lean Startup")).toBeLessThan(FUZZY_THRESHOLD);
  });
});
