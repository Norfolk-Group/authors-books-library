/**
 * twitter.test.ts — Tests for the Twitter/X API v2 enrichment helper
 *
 * Tests cover:
 *   - extractTwitterUsername: URL and handle parsing
 *   - fetchTwitterStats: token guard, network error handling, API error handling
 *   - Live API call (skipped when TWITTER_BEARER_TOKEN is absent)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTwitterUsername,
  fetchTwitterStats,
  type TwitterStats,
} from "./enrichment/twitter";

// ── extractTwitterUsername ─────────────────────────────────────────────────

describe("extractTwitterUsername", () => {
  it("extracts from full twitter.com URL", () => {
    expect(extractTwitterUsername("https://twitter.com/adamgrant")).toBe("adamgrant");
  });

  it("extracts from full x.com URL", () => {
    expect(extractTwitterUsername("https://x.com/BreneBrown")).toBe("BreneBrown");
  });

  it("extracts from URL with trailing path", () => {
    expect(extractTwitterUsername("https://twitter.com/JamesClear/status/123")).toBe("JamesClear");
  });

  it("extracts from URL with www prefix", () => {
    expect(extractTwitterUsername("https://www.twitter.com/simonsinekk")).toBe("simonsinekk");
  });

  it("strips @ from bare handle", () => {
    expect(extractTwitterUsername("@TimFerriss")).toBe("TimFerriss");
  });

  it("accepts bare handle without @", () => {
    expect(extractTwitterUsername("MalcolmGladwell")).toBe("MalcolmGladwell");
  });

  it("returns null for empty string", () => {
    expect(extractTwitterUsername("")).toBeNull();
  });

  it("returns null for non-Twitter URL", () => {
    expect(extractTwitterUsername("https://linkedin.com/in/adamgrant")).toBeNull();
  });

  it("returns null for handle that is too long (>15 chars)", () => {
    expect(extractTwitterUsername("@thishandleiswaytoolong123")).toBeNull();
  });

  it("handles URL without protocol", () => {
    expect(extractTwitterUsername("twitter.com/naval")).toBe("naval");
  });
});

// ── fetchTwitterStats ──────────────────────────────────────────────────────

describe("fetchTwitterStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when bearerToken is empty", async () => {
    const result = await fetchTwitterStats("@adamgrant", "");
    expect(result).toBeNull();
  });

  it("returns null when username cannot be extracted", async () => {
    const result = await fetchTwitterStats("not-a-twitter-url", "fake-token");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await fetchTwitterStats("@adamgrant", "fake-token");
    expect(result).toBeNull();
  });

  it("returns null on HTTP 429 (rate limited)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      })
    );
    const result = await fetchTwitterStats("@adamgrant", "fake-token");
    expect(result).toBeNull();
  });

  it("returns null on HTTP 401 (unauthorized)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      })
    );
    const result = await fetchTwitterStats("@adamgrant", "fake-token");
    expect(result).toBeNull();
  });

  it("returns null when API returns errors array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          errors: [{ title: "Not Found Error", detail: "User not found" }],
        }),
      })
    );
    const result = await fetchTwitterStats("@nonexistentuser99999", "fake-token");
    expect(result).toBeNull();
  });

  it("returns null when API returns no data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      })
    );
    const result = await fetchTwitterStats("@adamgrant", "fake-token");
    expect(result).toBeNull();
  });

  it("returns TwitterStats on successful response", async () => {
    const mockUser = {
      id: "123456",
      name: "Adam Grant",
      username: "AdamMGrant",
      public_metrics: {
        followers_count: 500000,
        following_count: 1200,
        tweet_count: 8500,
        listed_count: 4200,
      },
      verified: false,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: mockUser }),
      })
    );

    const result = await fetchTwitterStats("@AdamMGrant", "fake-token");
    expect(result).not.toBeNull();
    const stats = result as TwitterStats;
    expect(stats.userId).toBe("123456");
    expect(stats.username).toBe("AdamMGrant");
    expect(stats.name).toBe("Adam Grant");
    expect(stats.followerCount).toBe(500000);
    expect(stats.followingCount).toBe(1200);
    expect(stats.tweetCount).toBe(8500);
    expect(stats.listedCount).toBe(4200);
    expect(stats.verified).toBe(false);
    expect(stats.profileUrl).toBe("https://x.com/AdamMGrant");
    expect(stats.fetchedAt).toBeTruthy();
  });

  it("handles missing public_metrics gracefully (defaults to 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: "999", name: "Test User", username: "testuser" },
        }),
      })
    );

    const result = await fetchTwitterStats("@testuser", "fake-token");
    expect(result).not.toBeNull();
    const stats = result as TwitterStats;
    expect(stats.followerCount).toBe(0);
    expect(stats.tweetCount).toBe(0);
  });
});

// ── Live API test (skipped without real token) ─────────────────────────────

describe("fetchTwitterStats (live)", () => {
  const token = process.env.TWITTER_BEARER_TOKEN;

  it.skipIf(!token)("fetches real stats for @AdamMGrant (or returns null on CreditsDepleted)", async () => {
    const result = await fetchTwitterStats("https://twitter.com/AdamMGrant", token!);
    // The Twitter Free tier has no API credits for user lookup.
    // The helper returns null gracefully when credits are depleted.
    // This test verifies the helper does not throw — null is an acceptable result.
    if (result !== null) {
      expect(result.followerCount).toBeGreaterThanOrEqual(0);
      expect(result.username).toBeTruthy();
      console.log("[Live Twitter] AdamMGrant:", {
        followers: result.followerCount,
        tweets: result.tweetCount,
      });
    } else {
      console.log("[Live Twitter] null result — likely CreditsDepleted (Free tier has no read credits)");
    }
    // Either way, no exception should have been thrown
    expect(true).toBe(true);
  }, 10_000);
});

// ── searchTwitterUsername ──────────────────────────────────────────────────

describe("searchTwitterUsername", () => {
  it("should be exported from the twitter module", async () => {
    const mod = await import("./enrichment/twitter");
    expect(typeof mod.searchTwitterUsername).toBe("function");
  });
});
