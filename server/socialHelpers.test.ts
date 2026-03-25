/**
 * socialHelpers.test.ts — Tests for Instagram, TikTok, Facebook enrichment helpers
 *
 * Covers:
 *   - Username/page extraction from URLs
 *   - Graceful null return when API keys are missing
 *   - Error handling for network failures
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Instagram ────────────────────────────────────────────────────────────────

describe("Instagram enrichment", () => {
  it("should export extractInstagramUsername", async () => {
    const { extractInstagramUsername } = await import("./enrichment/instagram");
    expect(typeof extractInstagramUsername).toBe("function");
  });

  it("should export fetchInstagramStats", async () => {
    const { fetchInstagramStats } = await import("./enrichment/instagram");
    expect(typeof fetchInstagramStats).toBe("function");
  });

  describe("extractInstagramUsername", () => {
    it("extracts from full URL", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("https://instagram.com/adamgrant")).toBe("adamgrant");
    });

    it("extracts from URL with www", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("https://www.instagram.com/brenebrown")).toBe("brenebrown");
    });

    it("extracts from bare handle with @", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("@timferriss")).toBe("timferriss");
    });

    it("extracts from bare handle without @", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("jamesclear")).toBe("jamesclear");
    });

    it("returns null for empty string", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("")).toBeNull();
    });

    it("returns null for non-Instagram URL", async () => {
      const { extractInstagramUsername } = await import("./enrichment/instagram");
      expect(extractInstagramUsername("https://twitter.com/adamgrant")).toBeNull();
    });
  });

  describe("fetchInstagramStats", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("returns null when access token is empty", async () => {
      const { fetchInstagramStats } = await import("./enrichment/instagram");
      const result = await fetchInstagramStats("@adamgrant", "");
      expect(result).toBeNull();
    });

    it("returns null for invalid handle", async () => {
      const { fetchInstagramStats } = await import("./enrichment/instagram");
      const result = await fetchInstagramStats("", "test-token");
      expect(result).toBeNull();
    });

    it("handles API errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);
      const { fetchInstagramStats } = await import("./enrichment/instagram");
      const result = await fetchInstagramStats("@adamgrant", "test-token");
      expect(result).toBeNull();
    });

    it("handles network errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
      const { fetchInstagramStats } = await import("./enrichment/instagram");
      const result = await fetchInstagramStats("@adamgrant", "test-token");
      expect(result).toBeNull();
    });
  });
});

// ── TikTok ───────────────────────────────────────────────────────────────────

describe("TikTok enrichment", () => {
  it("should export extractTikTokUsername", async () => {
    const { extractTikTokUsername } = await import("./enrichment/tiktok");
    expect(typeof extractTikTokUsername).toBe("function");
  });

  it("should export fetchTikTokStats", async () => {
    const { fetchTikTokStats } = await import("./enrichment/tiktok");
    expect(typeof fetchTikTokStats).toBe("function");
  });

  describe("extractTikTokUsername", () => {
    it("extracts from full URL", async () => {
      const { extractTikTokUsername } = await import("./enrichment/tiktok");
      expect(extractTikTokUsername("https://tiktok.com/@adamgrant")).toBe("adamgrant");
    });

    it("extracts from URL with www", async () => {
      const { extractTikTokUsername } = await import("./enrichment/tiktok");
      expect(extractTikTokUsername("https://www.tiktok.com/@brenebrown")).toBe("brenebrown");
    });

    it("extracts from bare handle with @", async () => {
      const { extractTikTokUsername } = await import("./enrichment/tiktok");
      expect(extractTikTokUsername("@timferriss")).toBe("timferriss");
    });

    it("returns null for empty string", async () => {
      const { extractTikTokUsername } = await import("./enrichment/tiktok");
      expect(extractTikTokUsername("")).toBeNull();
    });
  });

  describe("fetchTikTokStats", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("returns null when client key is empty", async () => {
      const { fetchTikTokStats } = await import("./enrichment/tiktok");
      const result = await fetchTikTokStats("@adamgrant", "");
      expect(result).toBeNull();
    });

    it("returns null for invalid handle", async () => {
      const { fetchTikTokStats } = await import("./enrichment/tiktok");
      const result = await fetchTikTokStats("", "test-key");
      expect(result).toBeNull();
    });

    it("handles token request failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);
      const { fetchTikTokStats } = await import("./enrichment/tiktok");
      const result = await fetchTikTokStats("@adamgrant", "test-key");
      expect(result).toBeNull();
    });
  });
});

// ── Facebook ─────────────────────────────────────────────────────────────────

describe("Facebook enrichment", () => {
  it("should export extractFacebookPageId", async () => {
    const { extractFacebookPageId } = await import("./enrichment/facebook");
    expect(typeof extractFacebookPageId).toBe("function");
  });

  it("should export fetchFacebookStats", async () => {
    const { fetchFacebookStats } = await import("./enrichment/facebook");
    expect(typeof fetchFacebookStats).toBe("function");
  });

  describe("extractFacebookPageId", () => {
    it("extracts from full URL", async () => {
      const { extractFacebookPageId } = await import("./enrichment/facebook");
      expect(extractFacebookPageId("https://facebook.com/adamgrant")).toBe("adamgrant");
    });

    it("extracts from URL with www", async () => {
      const { extractFacebookPageId } = await import("./enrichment/facebook");
      expect(extractFacebookPageId("https://www.facebook.com/brenebrown")).toBe("brenebrown");
    });

    it("accepts bare page name", async () => {
      const { extractFacebookPageId } = await import("./enrichment/facebook");
      expect(extractFacebookPageId("timferriss")).toBe("timferriss");
    });

    it("returns null for empty string", async () => {
      const { extractFacebookPageId } = await import("./enrichment/facebook");
      expect(extractFacebookPageId("")).toBeNull();
    });
  });

  describe("fetchFacebookStats", () => {
    beforeEach(() => vi.restoreAllMocks());

    it("returns null when access token is empty", async () => {
      const { fetchFacebookStats } = await import("./enrichment/facebook");
      const result = await fetchFacebookStats("adamgrant", "");
      expect(result).toBeNull();
    });

    it("returns null for invalid page ID", async () => {
      const { fetchFacebookStats } = await import("./enrichment/facebook");
      const result = await fetchFacebookStats("", "test-token");
      expect(result).toBeNull();
    });

    it("handles API errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);
      const { fetchFacebookStats } = await import("./enrichment/facebook");
      const result = await fetchFacebookStats("adamgrant", "test-token");
      expect(result).toBeNull();
    });

    it("handles network errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
      const { fetchFacebookStats } = await import("./enrichment/facebook");
      const result = await fetchFacebookStats("adamgrant", "test-token");
      expect(result).toBeNull();
    });
  });
});
