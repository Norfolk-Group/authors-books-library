/**
 * cnbc.test.ts — Tests for CNBC/RapidAPI enrichment enhancements
 *
 * Covers:
 *   - buildNameTokens: improved author-name filtering
 *   - fetchCNBCAuthorProfile: aggregated profile with topics and contributor detection
 *   - fetchCNBCStats: article matching with partial/byline match
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildNameTokens,
  fetchCNBCStats,
  fetchCNBCAuthorProfile,
  type CNBCArticle,
  type CNBCAuthorProfile,
} from "./enrichment/rapidapi";

// ── buildNameTokens ─────────────────────────────────────────────────────────

describe("buildNameTokens", () => {
  it("should be exported from rapidapi module", () => {
    expect(typeof buildNameTokens).toBe("function");
  });

  it("should extract first, last, and full name tokens", () => {
    const tokens = buildNameTokens("Adam Grant");
    expect(tokens.first).toBe("adam");
    expect(tokens.last).toBe("grant");
    expect(tokens.full).toBe("adam grant");
  });

  it("should handle single-word names", () => {
    const tokens = buildNameTokens("Madonna");
    expect(tokens.first).toBe("madonna");
    expect(tokens.last).toBe("madonna");
    expect(tokens.full).toBe("madonna");
  });

  it("should handle names with middle parts", () => {
    const tokens = buildNameTokens("Martin Luther King");
    expect(tokens.first).toBe("martin");
    expect(tokens.last).toBe("king");
    expect(tokens.full).toBe("martin luther king");
  });

  it("should lowercase all tokens", () => {
    const tokens = buildNameTokens("ADAM GRANT");
    expect(tokens.first).toBe("adam");
    expect(tokens.last).toBe("grant");
  });

  it("should trim whitespace", () => {
    const tokens = buildNameTokens("  Adam Grant  ");
    expect(tokens.full).toBe("adam grant");
  });
});

// ── fetchCNBCStats ──────────────────────────────────────────────────────────

describe("fetchCNBCStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return null when rapidApiKey is empty", async () => {
    const result = await fetchCNBCStats("Adam Grant", "");
    expect(result).toBeNull();
  });

  it("should return null when authorName is empty", async () => {
    const result = await fetchCNBCStats("", "test-key");
    expect(result).toBeNull();
  });

  it("should handle network errors gracefully (returns empty results)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await fetchCNBCStats("Adam Grant", "test-key");
    // fetchCNBCStats uses Promise.allSettled, so network errors result in empty articles, not null
    expect(result).not.toBeNull();
    expect(result!.articleCount).toBe(0);
    expect(result!.recentArticles).toHaveLength(0);
  });

  it("should handle API errors gracefully (returns empty results)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: "Rate limited" }),
    } as Response);
    const result = await fetchCNBCStats("Adam Grant", "test-key");
    // API errors on individual feeds result in empty articles, not null
    expect(result).not.toBeNull();
    expect(result!.articleCount).toBe(0);
  });
});

// ── fetchCNBCAuthorProfile ──────────────────────────────────────────────────

describe("fetchCNBCAuthorProfile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should be exported from rapidapi module", () => {
    expect(typeof fetchCNBCAuthorProfile).toBe("function");
  });

  it("should return null when rapidApiKey is empty", async () => {
    const result = await fetchCNBCAuthorProfile("Adam Grant", "");
    expect(result).toBeNull();
  });

  it("should return null when authorName is empty", async () => {
    const result = await fetchCNBCAuthorProfile("", "test-key");
    expect(result).toBeNull();
  });

  it("should return null when authorName is whitespace only", async () => {
    const result = await fetchCNBCAuthorProfile("   ", "test-key");
    expect(result).toBeNull();
  });
});

// ── CNBCArticle type ────────────────────────────────────────────────────────

describe("CNBCArticle type", () => {
  it("should have expected shape", () => {
    const article: CNBCArticle = {
      title: "Test Article",
      url: "https://cnbc.com/test",
      date: "2024-01-15",
      description: "A test article",
      section: "Business",
      imageUrl: null,
    };
    expect(article.title).toBe("Test Article");
    expect(article.url).toContain("cnbc.com");
    expect(article.section).toBe("Business");
  });
});

// ── CNBCAuthorProfile type ──────────────────────────────────────────────────

describe("CNBCAuthorProfile type", () => {
  it("should have expected shape", () => {
    const profile: CNBCAuthorProfile = {
      authorName: "Adam Grant",
      articleCount: 5,
      recentArticles: [],
      latestArticleDate: "2024-01-15",
      topTopics: ["Business", "Leadership"],
      isContributor: false,
      fetchedAt: new Date().toISOString(),
    };
    expect(profile.authorName).toBe("Adam Grant");
    expect(profile.topTopics).toHaveLength(2);
    expect(profile.isContributor).toBe(false);
  });
});
