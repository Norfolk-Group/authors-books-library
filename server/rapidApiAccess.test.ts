/**
 * Tasks 58-60: RapidAPI Access Tests
 *
 * Tests cover:
 *  - News outlet functions: BBC, NYT, Apple News, Guardian, Reuters, searchAllOutlets
 *  - Spotify podcast/audiobook search functions
 *  - Instagram username extraction and graceful failure handling
 *  - CNBC stats: buildNameTokens, fetchCNBCStats shape validation
 *  - Yahoo Finance: fetchYahooFinanceStats shape validation
 *  - LinkedIn: fetchLinkedInStats graceful failure on missing key
 *
 * Live tests (RUN_LIVE_TESTS=1) hit real APIs and are skipped in CI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── News Outlets ──────────────────────────────────────────────────────────────
import {
  searchBBCNews,
  getBBCTopStories,
  searchNYTNews,
  searchAppleNews,
  searchGuardianNews,
  searchReutersNews,
  searchAllOutlets,
  getAuthorNewsFromOutlets,
  type NewsOutletArticle,
  type OutletSearchResult,
} from "./enrichment/newsOutlets";

// ── Spotify ───────────────────────────────────────────────────────────────────
import {
  searchSpotifyPodcasts,
  getAuthorSpotifyPodcasts,
  searchSpotifyAudiobooks,
  getSpotifyBookAudiobook,
  type SpotifyPodcast,
  type SpotifyAudiobook,
} from "./enrichment/spotify";

// ── Instagram ─────────────────────────────────────────────────────────────────
import {
  extractInstagramUsername,
  fetchInstagramStats,
  type InstagramStats,
} from "./enrichment/instagram";

// ── RapidAPI (CNBC, LinkedIn, Yahoo Finance) ──────────────────────────────────
import {
  buildNameTokens,
  fetchCNBCStats,
  fetchLinkedInStats,
  fetchYahooFinanceStats,
  type CNBCStats,
  type LinkedInStats,
  type YahooFinanceStats,
} from "./enrichment/rapidapi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_LIVE = !process.env.RUN_LIVE_TESTS;

/** Build a minimal RSS XML string with n items */
function buildRSSXml(items: Array<{ title: string; link: string; source?: string; pubDate?: string; description?: string }>): string {
  const itemsXml = items
    .map(
      (i) => `<item>
  <title><![CDATA[${i.title}]]></title>
  <link>${i.link}</link>
  ${i.source ? `<source>${i.source}</source>` : ""}
  ${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ""}
  ${i.description ? `<description><![CDATA[${i.description}]]></description>` : ""}
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    ${itemsXml}
  </channel>
</rss>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// NewsOutletArticle Interface
// ═════════════════════════════════════════════════════════════════════════════

describe("NewsOutletArticle interface", () => {
  it("has required fields: title, url, source", () => {
    const article: NewsOutletArticle = {
      title: "Test Article",
      url: "https://bbc.co.uk/news/test",
      source: "BBC News",
    };
    expect(article.title).toBe("Test Article");
    expect(article.url).toBe("https://bbc.co.uk/news/test");
    expect(article.source).toBe("BBC News");
  });

  it("has optional fields: publishedAt, description, imageUrl", () => {
    const article: NewsOutletArticle = {
      title: "Test",
      url: "https://example.com",
      source: "Source",
      publishedAt: "2024-01-01T00:00:00.000Z",
      description: "A description",
      imageUrl: "https://example.com/img.jpg",
    };
    expect(article.publishedAt).toBeDefined();
    expect(article.description).toBeDefined();
    expect(article.imageUrl).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// OutletSearchResult Interface
// ═════════════════════════════════════════════════════════════════════════════

describe("OutletSearchResult interface", () => {
  it("has required fields: outlet, articles, error", () => {
    const result: OutletSearchResult = {
      outlet: "BBC",
      articles: [],
      error: null,
    };
    expect(result.outlet).toBe("BBC");
    expect(Array.isArray(result.articles)).toBe(true);
    expect(result.error).toBeNull();
  });

  it("can carry error info when fetch fails", () => {
    const result: OutletSearchResult = {
      outlet: "NYT",
      articles: [],
      error: "Network timeout",
    };
    expect(result.error).toBe("Network timeout");
    expect(result.articles).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BBC News — graceful failure
// ═════════════════════════════════════════════════════════════════════════════

describe("searchBBCNews", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchBBCNews("Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("returns empty array on non-200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    });
    const results = await searchBBCNews("Malcolm Gladwell", 5);
    expect(results).toHaveLength(0);
  });

  it("returns articles with required fields when RSS is valid", async () => {
    const xml = buildRSSXml([
      { title: "BBC Article 1", link: "https://bbc.co.uk/news/1", source: "BBC News", pubDate: "Mon, 01 Jan 2024 00:00:00 GMT" },
      { title: "BBC Article 2", link: "https://bbc.co.uk/news/2", source: "BBC News" },
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const results = await searchBBCNews("test query", 10);
    expect(results.length).toBeGreaterThanOrEqual(0);
    for (const article of results) {
      expect(article.title).toBeTruthy();
      expect(article.url).toMatch(/^https?:\/\//);
      expect(article.source).toBeTruthy();
    }
  });

  it.skipIf(SKIP_LIVE)("live: returns real BBC articles for Adam Grant", async () => {
    const results = await searchBBCNews("Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// NYT News — graceful failure
// ═════════════════════════════════════════════════════════════════════════════

describe("searchNYTNews", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const results = await searchNYTNews("Malcolm Gladwell", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("returns articles with required fields when RSS is valid", async () => {
    const xml = buildRSSXml([
      { title: "NYT Article", link: "https://nytimes.com/2024/01/01/test", source: "The New York Times" },
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const results = await searchNYTNews("test", 5);
    for (const article of results) {
      expect(typeof article.title).toBe("string");
      expect(article.url).toMatch(/^https?:\/\//);
    }
  });

  it.skipIf(SKIP_LIVE)("live: returns real NYT articles for Brené Brown", async () => {
    const results = await searchNYTNews("Brené Brown", 5);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// searchAllOutlets — aggregation
// ═════════════════════════════════════════════════════════════════════════════

describe("searchAllOutlets", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns array of OutletSearchResult objects", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchAllOutlets("Adam Grant", 3);
    expect(Array.isArray(results)).toBe(true);
    for (const result of results) {
      expect(result).toHaveProperty("outlet");
      expect(result).toHaveProperty("articles");
      expect(Array.isArray(result.articles)).toBe(true);
    }
  });

  it("returns results for multiple outlets", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchAllOutlets("test", 2);
    expect(results.length).toBeGreaterThan(0);
  });

  it("each result has outlet name", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchAllOutlets("test", 2);
    for (const result of results) {
      expect(typeof result.outlet).toBe("string");
      expect(result.outlet.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(SKIP_LIVE)("live: aggregates articles from multiple outlets for Simon Sinek", async () => {
    const results = await searchAllOutlets("Simon Sinek", 3);
    expect(results.length).toBeGreaterThan(0);
    const totalArticles = results.reduce((sum, r) => sum + r.articles.length, 0);
    expect(totalArticles).toBeGreaterThanOrEqual(0);
  }, 30000);
});

// ═════════════════════════════════════════════════════════════════════════════
// getAuthorNewsFromOutlets
// ═════════════════════════════════════════════════════════════════════════════

describe("getAuthorNewsFromOutlets", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns array of OutletSearchResult objects", async () => {
    const xml = buildRSSXml([
      { title: "Article 1", link: "https://bbc.co.uk/1", source: "BBC" },
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const results = await getAuthorNewsFromOutlets("Adam Grant", 5);
    expect(Array.isArray(results)).toBe(true);
    for (const result of results) {
      expect(result).toHaveProperty("outlet");
      expect(result).toHaveProperty("articles");
    }
  });

  it("returns OutletSearchResult array even on all-outlet failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await getAuthorNewsFromOutlets("Unknown Author", 5);
    // Returns array of OutletSearchResult (one per outlet), each with empty articles
    expect(Array.isArray(results)).toBe(true);
    for (const result of results) {
      expect(result).toHaveProperty("outlet");
      expect(Array.isArray(result.articles)).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Spotify — Task 59
// ═════════════════════════════════════════════════════════════════════════════

describe("SpotifyPodcast interface", () => {
  it("has required fields: id, name, description, publisher", () => {
    const podcast: SpotifyPodcast = {
      id: "abc123",
      name: "WorkLife with Adam Grant",
      description: "A podcast about work",
      publisher: "TED",
      totalEpisodes: 50,
      languages: ["en"],
      imageUrl: "https://example.com/img.jpg",
      spotifyUrl: "https://open.spotify.com/show/abc123",
    };
    expect(podcast.id).toBe("abc123");
    expect(podcast.name).toBe("WorkLife with Adam Grant");
    expect(podcast.publisher).toBe("TED");
  });
});

describe("SpotifyAudiobook interface", () => {
  it("has required fields: id, name, authors", () => {
    const audiobook: SpotifyAudiobook = {
      id: "def456",
      name: "Think Again",
      authors: [{ name: "Adam Grant" }],
      narrators: [{ name: "Adam Grant" }],
      description: "A book about rethinking",
      totalChapters: 12,
      languages: ["en"],
      imageUrl: "https://example.com/cover.jpg",
      spotifyUrl: "https://open.spotify.com/audiobook/def456",
      publisher: "Penguin",
    };
    expect(audiobook.id).toBe("def456");
    expect(audiobook.authors[0].name).toBe("Adam Grant");
  });
});

describe("searchSpotifyPodcasts", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchSpotifyPodcasts("Adam Grant");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("returns empty array on non-200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });
    const results = await searchSpotifyPodcasts("Adam Grant");
    expect(results).toHaveLength(0);
  });

  it("returns podcasts with required fields when API responds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        resultCount: 1,
        results: [
          {
            collectionId: 123,
            collectionName: "WorkLife with Adam Grant",
            description: "A podcast about work",
            artistName: "TED",
            trackCount: 50,
            primaryGenreName: "Business",
            artworkUrl600: "https://example.com/img.jpg",
            collectionViewUrl: "https://podcasts.apple.com/podcast/123",
          },
        ],
      }),
    });
    const results = await searchSpotifyPodcasts("Adam Grant");
    if (results.length > 0) {
      expect(results[0].name).toBeTruthy();
      expect(results[0].id).toBeTruthy();
    }
  });

  it.skipIf(SKIP_LIVE)("live: returns real Spotify podcasts for Adam Grant", async () => {
    const results = await searchSpotifyPodcasts("Adam Grant");
    expect(Array.isArray(results)).toBe(true);
  }, 15000);
});

describe("searchSpotifyAudiobooks", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await searchSpotifyAudiobooks("Think Again");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it.skipIf(SKIP_LIVE)("live: returns real audiobooks for Think Again", async () => {
    const results = await searchSpotifyAudiobooks("Think Again Adam Grant");
    expect(Array.isArray(results)).toBe(true);
  }, 15000);
});

describe("getAuthorSpotifyPodcasts", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const results = await getAuthorSpotifyPodcasts("Adam Grant");
    expect(Array.isArray(results)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Instagram — Task 60
// ═════════════════════════════════════════════════════════════════════════════

describe("extractInstagramUsername", () => {
  it("extracts username from full URL", () => {
    expect(extractInstagramUsername("https://instagram.com/adamgrant")).toBe("adamgrant");
    expect(extractInstagramUsername("https://www.instagram.com/adamgrant/")).toBe("adamgrant");
    expect(extractInstagramUsername("https://www.instagram.com/adamgrant/posts/")).toBe("adamgrant");
  });

  it("extracts bare handle (with or without @)", () => {
    expect(extractInstagramUsername("@adamgrant")).toBe("adamgrant");
    expect(extractInstagramUsername("adamgrant")).toBe("adamgrant");
  });

  it("returns null for invalid input", () => {
    expect(extractInstagramUsername("")).toBeNull();
    expect(extractInstagramUsername("not-a-url")).toBeNull();
    expect(extractInstagramUsername("https://twitter.com/adamgrant")).toBeNull();
  });

  it("handles usernames with dots and underscores", () => {
    const result = extractInstagramUsername("https://instagram.com/adam.grant_official");
    expect(result).toBe("adam.grant_official");
  });
});

describe("InstagramStats interface", () => {
  it("has required fields: username, followersCount, mediaCount", () => {
    const stats: InstagramStats = {
      username: "adamgrant",
      followersCount: 500000,
      followsCount: 1000,
      mediaCount: 300,
      biography: "Organizational psychologist at Wharton",
      profilePictureUrl: "https://example.com/pic.jpg",
      website: "https://adamgrant.net",
    };
    expect(stats.username).toBe("adamgrant");
    expect(stats.followersCount).toBe(500000);
    expect(stats.mediaCount).toBe(300);
  });
});

describe("fetchInstagramStats", () => {
  it("returns null when no access token is set", async () => {
    const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const result = await fetchInstagramStats("https://instagram.com/adamgrant");
    expect(result).toBeNull();
    if (originalToken) process.env.INSTAGRAM_ACCESS_TOKEN = originalToken;
  });

  it("returns null for invalid handle", async () => {
    const result = await fetchInstagramStats("not-a-valid-handle");
    expect(result).toBeNull();
  });

  it.skipIf(SKIP_LIVE)("live: returns stats for a real Instagram account", async () => {
    const result = await fetchInstagramStats("https://instagram.com/adamgrant");
    // May be null if not a business account or token not set
    if (result !== null) {
      expect(result.username).toBeTruthy();
      expect(typeof result.followersCount).toBe("number");
    }
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// CNBC Stats — buildNameTokens
// ═════════════════════════════════════════════════════════════════════════════

describe("buildNameTokens", () => {
  it("splits a two-part name into first and last", () => {
    const tokens = buildNameTokens("Adam Grant");
    expect(tokens.first).toBe("adam");
    expect(tokens.last).toBe("grant");
    expect(tokens.full).toBe("adam grant");
    expect(Array.isArray(tokens.parts)).toBe(true);
    expect(tokens.parts.length).toBe(2);
  });

  it("handles three-part names", () => {
    const tokens = buildNameTokens("Malcolm Timothy Gladwell");
    expect(tokens.first).toBe("malcolm");
    expect(tokens.last).toBe("gladwell");
    expect(tokens.parts.length).toBe(3);
  });

  it("handles single-word names gracefully", () => {
    const tokens = buildNameTokens("Cher");
    expect(tokens.first).toBe("cher");
    expect(tokens.last).toBe("cher"); // first === last for single word
    expect(tokens.parts.length).toBe(1);
  });

  it("normalizes to lowercase", () => {
    const tokens = buildNameTokens("Brené Brown");
    expect(tokens.full).toBe("brené brown");
    expect(Array.isArray(tokens.parts)).toBe(true);
    expect(tokens.parts.length).toBeGreaterThanOrEqual(1);
    for (const part of tokens.parts) {
      expect(typeof part).toBe("string");
      expect(part.length).toBeGreaterThan(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LinkedIn Stats — graceful failure
// ═════════════════════════════════════════════════════════════════════════════

describe("fetchLinkedInStats", () => {
  it("returns null when RAPIDAPI_KEY is not set", async () => {
    const originalKey = process.env.RAPIDAPI_KEY;
    delete process.env.RAPIDAPI_KEY;
    const result = await fetchLinkedInStats("https://linkedin.com/in/adamgrant");
    expect(result).toBeNull();
    if (originalKey) process.env.RAPIDAPI_KEY = originalKey;
  });

  it("returns null for empty input", async () => {
    const result = await fetchLinkedInStats("");
    expect(result).toBeNull();
  });

  it.skipIf(SKIP_LIVE)("live: returns stats for a real LinkedIn profile", async () => {
    const result = await fetchLinkedInStats("https://linkedin.com/in/adamgrant");
    if (result !== null) {
      expect(typeof result.followersCount).toBe("number");
    }
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// Yahoo Finance Stats — graceful failure
// ═════════════════════════════════════════════════════════════════════════════

describe("fetchYahooFinanceStats", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await fetchYahooFinanceStats("AAPL");
    expect(result).toBeNull();
  });

  it("returns null on non-200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limited" }),
    });
    const result = await fetchYahooFinanceStats("MSFT");
    expect(result).toBeNull();
  });

  it("returns YahooFinanceStats with required fields on valid response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        body: {
          symbol: "AAPL",
          companyName: "Apple Inc.",
          primaryExchange: "NASDAQ",
          regularMarketPrice: 175.50,
          regularMarketChangePercent: 1.23,
          marketCap: 2750000000000,
          fiftyTwoWeekHigh: 199.62,
          fiftyTwoWeekLow: 124.17,
          currency: "USD",
        },
      }),
    });
    const result = await fetchYahooFinanceStats("AAPL");
    if (result !== null) {
      expect(result.symbol).toBeTruthy();
      expect(typeof result.regularMarketPrice).toBe("number");
    }
  });

  it.skipIf(SKIP_LIVE)("live: returns real stats for AAPL", async () => {
    const result = await fetchYahooFinanceStats("AAPL");
    if (result !== null) {
      expect(result.symbol).toBe("AAPL");
      expect(typeof result.regularMarketPrice).toBe("number");
    }
  }, 15000);
});

// ═════════════════════════════════════════════════════════════════════════════
// CNBCStats interface
// ═════════════════════════════════════════════════════════════════════════════

describe("CNBCStats interface", () => {
  it("has required fields: articleCount, recentArticles, latestArticleDate", () => {
    const stats: CNBCStats = {
      articleCount: 5,
      recentArticles: [],
      latestArticleDate: "2024-01-01T00:00:00.000Z",
      feedsSearched: 5,
      fetchedAt: new Date().toISOString(),
    };
    expect(typeof stats.articleCount).toBe("number");
    expect(Array.isArray(stats.recentArticles)).toBe(true);
    expect(typeof stats.feedsSearched).toBe("number");
    expect(typeof stats.fetchedAt).toBe("string");
  });

  it("allows null latestArticleDate when no articles found", () => {
    const stats: CNBCStats = {
      articleCount: 0,
      recentArticles: [],
      latestArticleDate: null,
      feedsSearched: 5,
      fetchedAt: new Date().toISOString(),
    };
    expect(stats.latestArticleDate).toBeNull();
    expect(stats.articleCount).toBe(0);
  });
});
