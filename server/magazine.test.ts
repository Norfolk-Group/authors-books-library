/**
 * magazine.test.ts
 *
 * Unit tests for the magazine article pipeline service.
 * Tests cover RSS config validation and author name normalization.
 *
 * Note: Pinecone and RAG pipeline tests have been moved to pinecone.test.ts
 * to avoid OOM crashes caused by loading @google/genai in the same worker.
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
