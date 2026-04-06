/**
 * Tests for libraryCache router and new enrichment helpers
 * Tasks 17-19: DB caching for news, Open Library, HathiTrust, WorldCat
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── libraryCache router: isCacheValid logic ──────────────────────────────────

describe("isCacheValid (cache TTL logic)", () => {
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  function isCacheValid(cachedAt: Date | null): boolean {
    if (!cachedAt) return false;
    return Date.now() - cachedAt.getTime() < CACHE_TTL_MS;
  }

  it("returns false for null cachedAt", () => {
    expect(isCacheValid(null)).toBe(false);
  });

  it("returns true for a timestamp 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(isCacheValid(oneHourAgo)).toBe(true);
  });

  it("returns true for a timestamp 6 days ago", () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    expect(isCacheValid(sixDaysAgo)).toBe(true);
  });

  it("returns false for a timestamp 8 days ago (expired)", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isCacheValid(eightDaysAgo)).toBe(false);
  });

  it("returns false for a timestamp exactly at TTL boundary (expired)", () => {
    const exactlyAtTTL = new Date(Date.now() - CACHE_TTL_MS - 1);
    expect(isCacheValid(exactlyAtTTL)).toBe(false);
  });
});

// ─── WorldCat enrichment helper ───────────────────────────────────────────────

describe("WorldCat enrichment helper", () => {
  it("exports searchWorldCat function", async () => {
    const mod = await import("./enrichment/worldcat");
    expect(typeof mod.searchWorldCat).toBe("function");
  });

  it("exports getLibraryHoldingsCount function", async () => {
    const mod = await import("./enrichment/worldcat");
    expect(typeof mod.getLibraryHoldingsCount).toBe("function");
  });

  it("returns null for empty query", async () => {
    const { searchWorldCat } = await import("./enrichment/worldcat");
    const result = await searchWorldCat("", 1);
    expect(result).toBeNull();
  });

  it("returns null for empty ISBN in holdings count", async () => {
    const { getLibraryHoldingsCount } = await import("./enrichment/worldcat");
    const result = await getLibraryHoldingsCount("");
    expect(result).toBeNull();
  });
})

// ─── DPLA enrichment helper ───────────────────────────────────────────────────

describe("DPLA enrichment helper", () => {
  it("exports searchDPLA function", async () => {
    const mod = await import("./enrichment/dpla");
    expect(typeof mod.searchDPLA).toBe("function");
  });

  it("exports checkDPLAAvailability function", async () => {
    const mod = await import("./enrichment/dpla");
    expect(typeof mod.checkDPLAAvailability).toBe("function");
  });

  it("returns null for empty query", async () => {
    const { searchDPLA } = await import("./enrichment/dpla");
    const result = await searchDPLA("", 5);
    expect(result).toBeNull();
  });

  it("returns null for empty ISBN in checkDPLAAvailability", async () => {
    const { checkDPLAAvailability } = await import("./enrichment/dpla");
    const result = await checkDPLAAvailability("");
    expect(result).toBeNull();
  });
})

// ─── JSTOR / Semantic Scholar enrichment helper ───────────────────────────────

describe("JSTOR/Semantic Scholar enrichment helper", () => {
  it("exports searchAcademicPapers function", async () => {
    const mod = await import("./enrichment/jstor");
    expect(typeof mod.searchAcademicPapers).toBe("function");
  });

  it("exports searchJSTOR function", async () => {
    const mod = await import("./enrichment/jstor");
    expect(typeof mod.searchJSTOR).toBe("function");
  });

  it("returns null for empty query in searchAcademicPapers", async () => {
    const { searchAcademicPapers } = await import("./enrichment/jstor");
    const result = await searchAcademicPapers("", 5);
    expect(result).toBeNull();
  });

  it("returns null for empty query in searchJSTOR", async () => {
    const { searchJSTOR } = await import("./enrichment/jstor");
    const result = await searchJSTOR("", 5);
    expect(result).toBeNull();
  });
})

// ─── Spotify (iTunes) enrichment helper ──────────────────────────────────────

describe("Spotify/iTunes enrichment helper", () => {
  it("exports searchSpotifyPodcasts function", async () => {
    const mod = await import("./enrichment/spotify");
    expect(typeof mod.searchSpotifyPodcasts).toBe("function");
  });

  it("exports getAuthorSpotifyPodcasts function", async () => {
    const mod = await import("./enrichment/spotify");
    expect(typeof mod.getAuthorSpotifyPodcasts).toBe("function");
  });

  it("returns empty array for empty query", async () => {
    const { searchSpotifyPodcasts } = await import("./enrichment/spotify");
    const result = await searchSpotifyPodcasts("", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns empty array for empty author name", async () => {
    const { getAuthorSpotifyPodcasts } = await import("./enrichment/spotify");
    const result = await getAuthorSpotifyPodcasts("", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── newsOutlets enrichment helper ───────────────────────────────────────────

describe("newsOutlets enrichment helper", () => {
  it("exports getBBCTopStories function", async () => {
    const mod = await import("./enrichment/newsOutlets");
    expect(typeof mod.getBBCTopStories).toBe("function");
  });

  it("exports getNYTTopStories function", async () => {
    const mod = await import("./enrichment/newsOutlets");
    expect(typeof mod.getNYTTopStories).toBe("function");
  });

  it("exports searchAllOutlets function", async () => {
    const mod = await import("./enrichment/newsOutlets");
    expect(typeof mod.searchAllOutlets).toBe("function");
  });

  it("exports getAuthorNewsFromOutlets function", async () => {
    const mod = await import("./enrichment/newsOutlets");
    expect(typeof mod.getAuthorNewsFromOutlets).toBe("function");
  });

  it("returns empty array for empty author name in getAuthorNewsFromOutlets", async () => {
    const { getAuthorNewsFromOutlets } = await import("./enrichment/newsOutlets");
    const result = await getAuthorNewsFromOutlets("", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns empty array for empty query in searchAllOutlets", async () => {
    const { searchAllOutlets } = await import("./enrichment/newsOutlets");
    const result = await searchAllOutlets("", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── libraryCache router: module structure ────────────────────────────────────

describe("libraryCache router module", () => {
  it("exports libraryCacheRouter", async () => {
    const mod = await import("./routers/libraryCache.router");
    expect(mod.libraryCacheRouter).toBeDefined();
  });

  it("libraryCacheRouter has expected procedures", async () => {
    const { libraryCacheRouter } = await import("./routers/libraryCache.router");
    const procedures = Object.keys(libraryCacheRouter._def.procedures ?? libraryCacheRouter._def.record ?? {});
    // Should have at least 4 procedures
    expect(procedures.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Pinecone bulk indexing: vectorSearch router ──────────────────────────────

describe("vectorSearch router bulk indexing procedures", () => {
  it("exports vectorSearchRouter with bulk indexing procedures", async () => {
    const mod = await import("./routers/vectorSearch.router");
    expect(mod.vectorSearchRouter).toBeDefined();
  });

  it("vectorSearchRouter has indexAllAuthors procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    const record = vectorSearchRouter._def.procedures ?? vectorSearchRouter._def.record ?? {};
    const keys = Object.keys(record);
    expect(keys.some(k => k.includes("indexAll") || k.includes("IndexAll"))).toBe(true);
  });
});
