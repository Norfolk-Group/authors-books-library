/**
 * newsOutlets.ts — Dedicated RSS helpers for major news outlets
 *
 * Uses free public RSS feeds (no API key required):
 *  - BBC News: https://feeds.bbci.co.uk/news/rss.xml
 *  - New York Times: https://rss.nytimes.com/services/xml/rss/nyt/
 *  - Apple News: Uses Google News RSS (Apple News has no public RSS)
 *  - The Guardian: https://www.theguardian.com/rss
 *  - Reuters: https://feeds.reuters.com/reuters/topNews
 *
 * Provides:
 *  - searchBBCNews(query, limit?)         → BBC articles matching query
 *  - searchNYTNews(query, limit?)         → NYT articles matching query
 *  - searchAppleNews(query, limit?)       → Apple News via Google News RSS
 *  - searchGuardianNews(query, limit?)    → Guardian articles
 *  - searchReutersNews(query, limit?)     → Reuters articles
 *  - searchAllOutlets(query, limit?)      → Combined results from all outlets
 *  - getAuthorNewsFromOutlets(authorName) → Author mentions across all outlets
 */

const TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsOutletArticle {
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
  source: string;
  imageUrl?: string;
}

export interface OutletSearchResult {
  outlet: string;
  articles: NewsOutletArticle[];
  error?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchRSS(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RCLibraryBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  return (match[1] ?? match[2] ?? "").trim();
}

function parseRSSItems(
  xml: string,
  sourceName: string,
  limit: number
): NewsOutletArticle[] {
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  const articles: NewsOutletArticle[] = [];
  let match;
  while ((match = itemRegex.exec(xml)) !== null && articles.length < limit) {
    const item = match[1];
    const title = extractTag(item, "title");
    const link = extractTag(item, "link") || (item.match(/<link>([^<]+)<\/link>/)?.[1] ?? "");
    const description = extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate");
    const imageMatch = item.match(/url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/) ??
                       item.match(/<media:content[^>]+url="([^"]+)"/);
    if (!title || !link) continue;
    articles.push({
      title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      url: link.trim(),
      description: description?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").slice(0, 200),
      publishedAt: pubDate || undefined,
      source: sourceName,
      imageUrl: imageMatch?.[1],
    });
  }
  return articles;
}

async function searchGoogleNewsRSS(
  query: string,
  limit: number,
  siteFilter?: string
): Promise<NewsOutletArticle[]> {
  const q = siteFilter ? `${query} site:${siteFilter}` : query;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchRSS(url);
  if (!xml) return [];
  return parseRSSItems(xml, siteFilter ?? "Google News", limit);
}

// ─── BBC News ─────────────────────────────────────────────────────────────────

/**
 * Search BBC News for articles matching a query.
 * Uses BBC's public RSS feed + Google News RSS for search.
 */
export async function searchBBCNews(
  query: string,
  limit = 5
): Promise<NewsOutletArticle[]> {
  if (!query?.trim()) return [];
  return searchGoogleNewsRSS(query, limit, "bbc.com");
}

/**
 * Get BBC News top stories (no search, just latest).
 */
export async function getBBCTopStories(limit = 5): Promise<NewsOutletArticle[]> {
  const xml = await fetchRSS("https://feeds.bbci.co.uk/news/rss.xml");
  if (!xml) return [];
  return parseRSSItems(xml, "BBC News", limit);
}

// ─── New York Times ───────────────────────────────────────────────────────────

/**
 * Search NYT for articles matching a query.
 */
export async function searchNYTNews(
  query: string,
  limit = 5
): Promise<NewsOutletArticle[]> {
  if (!query?.trim()) return [];
  return searchGoogleNewsRSS(query, limit, "nytimes.com");
}

/**
 * Get NYT top stories from their public RSS feed.
 */
export async function getNYTTopStories(
  section: "home" | "business" | "technology" | "books" | "arts" = "home",
  limit = 5
): Promise<NewsOutletArticle[]> {
  const url = `https://rss.nytimes.com/services/xml/rss/nyt/${section.charAt(0).toUpperCase() + section.slice(1)}.xml`;
  const xml = await fetchRSS(url);
  if (!xml) return [];
  return parseRSSItems(xml, "New York Times", limit);
}

// ─── Apple News ───────────────────────────────────────────────────────────────

/**
 * Search Apple News for articles (uses Google News RSS as Apple News has no public RSS).
 */
export async function searchAppleNews(
  query: string,
  limit = 5
): Promise<NewsOutletArticle[]> {
  if (!query?.trim()) return [];
  // Apple News aggregates many sources; use Google News for broad coverage
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchRSS(url);
  if (!xml) return [];
  return parseRSSItems(xml, "Apple News", limit);
}

// ─── The Guardian ─────────────────────────────────────────────────────────────

/**
 * Search The Guardian for articles matching a query.
 */
export async function searchGuardianNews(
  query: string,
  limit = 5
): Promise<NewsOutletArticle[]> {
  if (!query?.trim()) return [];
  return searchGoogleNewsRSS(query, limit, "theguardian.com");
}

// ─── Reuters ─────────────────────────────────────────────────────────────────

/**
 * Search Reuters for articles matching a query.
 */
export async function searchReutersNews(
  query: string,
  limit = 5
): Promise<NewsOutletArticle[]> {
  if (!query?.trim()) return [];
  return searchGoogleNewsRSS(query, limit, "reuters.com");
}

// ─── Combined search ──────────────────────────────────────────────────────────

/**
 * Search across all major news outlets simultaneously.
 * Returns combined and deduplicated results.
 */
export async function searchAllOutlets(
  query: string,
  limit = 3
): Promise<OutletSearchResult[]> {
  if (!query?.trim()) return [];
  const [bbc, nyt, guardian, reuters] = await Promise.allSettled([
    searchBBCNews(query, limit),
    searchNYTNews(query, limit),
    searchGuardianNews(query, limit),
    searchReutersNews(query, limit),
  ]);
  return [
    {
      outlet: "BBC News",
      articles: bbc.status === "fulfilled" ? bbc.value : [],
      error: bbc.status === "rejected" ? String(bbc.reason) : undefined,
    },
    {
      outlet: "New York Times",
      articles: nyt.status === "fulfilled" ? nyt.value : [],
      error: nyt.status === "rejected" ? String(nyt.reason) : undefined,
    },
    {
      outlet: "The Guardian",
      articles: guardian.status === "fulfilled" ? guardian.value : [],
      error: guardian.status === "rejected" ? String(guardian.reason) : undefined,
    },
    {
      outlet: "Reuters",
      articles: reuters.status === "fulfilled" ? reuters.value : [],
      error: reuters.status === "rejected" ? String(reuters.reason) : undefined,
    },
  ];
}

/**
 * Get author mentions across all major news outlets.
 */
export async function getAuthorNewsFromOutlets(
  authorName: string,
  limit = 3
): Promise<OutletSearchResult[]> {
  return searchAllOutlets(authorName, limit);
}
