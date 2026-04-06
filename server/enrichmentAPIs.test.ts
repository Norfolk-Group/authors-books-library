/**
 * enrichmentAPIs.test.ts
 *
 * Unit tests for the new enrichment API helpers:
 *  - Spotify (iTunes-based)
 *  - News Outlets (BBC, NYT, Apple News, Guardian, Reuters)
 *  - WorldCat
 *  - DPLA
 *  - JSTOR / Semantic Scholar
 *
 * Live network tests are skipped by default (marked with .skip).
 * Unit tests cover pure functions and graceful error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Spotify Helper Tests ─────────────────────────────────────────────────────

describe("spotify enrichment helper", () => {
  it("returns empty array for empty query in searchSpotifyPodcasts", async () => {
    const { searchSpotifyPodcasts } = await import("./enrichment/spotify");
    const result = await searchSpotifyPodcasts("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in getAuthorSpotifyPodcasts", async () => {
    const { getAuthorSpotifyPodcasts } = await import("./enrichment/spotify");
    const result = await getAuthorSpotifyPodcasts("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchSpotifyAudiobooks", async () => {
    const { searchSpotifyAudiobooks } = await import("./enrichment/spotify");
    const result = await searchSpotifyAudiobooks("", 5);
    expect(result).toEqual([]);
  });

  it("returns null for empty bookTitle in getSpotifyBookAudiobook", async () => {
    const { getSpotifyBookAudiobook } = await import("./enrichment/spotify");
    const result = await getSpotifyBookAudiobook("", undefined);
    expect(result).toBeNull();
  });

  it.skip("live: searchSpotifyPodcasts returns results for known author", async () => {
    const { searchSpotifyPodcasts } = await import("./enrichment/spotify");
    const results = await searchSpotifyPodcasts("Adam Grant", 3);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("name");
      expect(results[0]).toHaveProperty("artistName");
      expect(results[0].source).toBe("itunes");
    }
  });

  it.skip("live: searchSpotifyAudiobooks returns results for known book", async () => {
    const { searchSpotifyAudiobooks } = await import("./enrichment/spotify");
    const results = await searchSpotifyAudiobooks("Atomic Habits", 3);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("author");
    }
  });
});

// ─── News Outlets Helper Tests ────────────────────────────────────────────────

describe("newsOutlets enrichment helper", () => {
  it("returns empty array for empty query in searchBBCNews", async () => {
    const { searchBBCNews } = await import("./enrichment/newsOutlets");
    const result = await searchBBCNews("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchNYTNews", async () => {
    const { searchNYTNews } = await import("./enrichment/newsOutlets");
    const result = await searchNYTNews("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchAppleNews", async () => {
    const { searchAppleNews } = await import("./enrichment/newsOutlets");
    const result = await searchAppleNews("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchGuardianNews", async () => {
    const { searchGuardianNews } = await import("./enrichment/newsOutlets");
    const result = await searchGuardianNews("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchReutersNews", async () => {
    const { searchReutersNews } = await import("./enrichment/newsOutlets");
    const result = await searchReutersNews("", 5);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in searchAllOutlets", async () => {
    const { searchAllOutlets } = await import("./enrichment/newsOutlets");
    const result = await searchAllOutlets("", 3);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty query in getAuthorNewsFromOutlets", async () => {
    const { getAuthorNewsFromOutlets } = await import("./enrichment/newsOutlets");
    const result = await getAuthorNewsFromOutlets("", 3);
    expect(result).toEqual([]);
  });

  it("searchAllOutlets returns array with 4 outlet entries for valid query", async () => {
    // Mock fetch to avoid live network calls
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    });
    vi.stubGlobal("fetch", mockFetch);

    const { searchAllOutlets } = await import("./enrichment/newsOutlets");
    const result = await searchAllOutlets("Adam Grant", 3);

    // Should return 4 outlet entries (BBC, NYT, Guardian, Reuters) even on failure
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.outlet)).toEqual(
      expect.arrayContaining(["BBC News", "New York Times", "The Guardian", "Reuters"])
    );

    vi.unstubAllGlobals();
  });

  it("outlet entries have articles array even on network failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const { searchAllOutlets } = await import("./enrichment/newsOutlets");
    const result = await searchAllOutlets("test query", 3);

    for (const outlet of result) {
      expect(Array.isArray(outlet.articles)).toBe(true);
    }

    vi.unstubAllGlobals();
  });

  it.skip("live: searchBBCNews returns articles for known topic", async () => {
    const { searchBBCNews } = await import("./enrichment/newsOutlets");
    const results = await searchBBCNews("artificial intelligence", 3);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("url");
      expect(results[0].source).toBe("bbc.com");
    }
  });

  it.skip("live: searchNYTNews returns articles for known author", async () => {
    const { searchNYTNews } = await import("./enrichment/newsOutlets");
    const results = await searchNYTNews("Adam Grant psychology", 3);
    expect(Array.isArray(results)).toBe(true);
  });

  it.skip("live: getBBCTopStories returns latest BBC news", async () => {
    const { getBBCTopStories } = await import("./enrichment/newsOutlets");
    const results = await getBBCTopStories(5);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
      expect(results[0].source).toBe("BBC News");
    }
  });
});

// ─── WorldCat Helper Tests ────────────────────────────────────────────────────

describe("worldcat enrichment helper", () => {
  it("returns null for empty query in searchWorldCat", async () => {
    const { searchWorldCat } = await import("./enrichment/worldcat");
    const result = await searchWorldCat("", 5);
    expect(result).toBeNull();
  });

  it("returns null for empty ISBN in getWorldCatByISBN", async () => {
    const { getWorldCatByISBN } = await import("./enrichment/worldcat");
    const result = await getWorldCatByISBN("");
    expect(result).toBeNull();
  });

  it("getLibraryHoldingsCount returns null for empty ISBN", async () => {
    const { getLibraryHoldingsCount } = await import("./enrichment/worldcat");
    const result = await getLibraryHoldingsCount("");
    expect(result).toBeNull();
  });

  it.skip("live: searchWorldCat returns results for known book", async () => {
    const { searchWorldCat } = await import("./enrichment/worldcat");
    const results = await searchWorldCat("Atomic Habits James Clear", 3);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─── DPLA Helper Tests ────────────────────────────────────────────────────────

describe("dpla enrichment helper", () => {
  it("isDPLAConfigured returns boolean", async () => {
    const { isDPLAConfigured } = await import("./enrichment/dpla");
    const result = isDPLAConfigured();
    expect(typeof result).toBe("boolean");
  });

  it("returns null for empty query in searchDPLA", async () => {
    const { searchDPLA } = await import("./enrichment/dpla");
    const result = await searchDPLA("", {});
    expect(result).toBeNull();
  });

  it("returns null for empty ISBN in getDPLAByISBN", async () => {
    const { getDPLAByISBN } = await import("./enrichment/dpla");
    const result = await getDPLAByISBN("");
    expect(result).toBeNull();
  });

  it("checkDPLAAvailability returns null for empty title", async () => {
    const { checkDPLAAvailability } = await import("./enrichment/dpla");
    const result = await checkDPLAAvailability("", undefined);
    expect(result).toBeNull();
  });
});

// ─── JSTOR / Academic Helper Tests ───────────────────────────────────────────

describe("jstor/academic enrichment helper", () => {
  it("returns null for empty query in searchJSTOR", async () => {
    const { searchJSTOR } = await import("./enrichment/jstor");
    const result = await searchJSTOR("", 5);
    expect(result).toBeNull();
  });

  it("returns null for empty DOI in getJSTORByDOI", async () => {
    const { getJSTORByDOI } = await import("./enrichment/jstor");
    const result = await getJSTORByDOI("");
    expect(result).toBeNull();
  });

  it("returns null for empty query in searchAcademicPapers", async () => {
    const { searchAcademicPapers } = await import("./enrichment/jstor");
    const result = await searchAcademicPapers("", 5);
    expect(result).toBeNull();
  });

  it("returns null for empty bookTitle in searchBookAcademicCitations", async () => {
    const { searchBookAcademicCitations } = await import("./enrichment/jstor");
    const result = await searchBookAcademicCitations("", 5);
    expect(result).toBeNull();
  });

  it.skip("live: searchAcademicPapers returns results for known author", async () => {
    const { searchAcademicPapers } = await import("./enrichment/jstor");
    const results = await searchAcademicPapers("Daniel Kahneman", 3);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("title");
    }
  });
});
