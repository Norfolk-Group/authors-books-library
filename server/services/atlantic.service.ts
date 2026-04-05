/**
 * atlantic.service.ts
 *
 * Fetches and parses The Atlantic RSS feeds, normalises articles,
 * deduplicates them, and matches them to library authors by name.
 *
 * Adapted from user-supplied scraper code.
 */

import Parser from "rss-parser";

// ── Types ─────────────────────────────────────────────────────────────────────

type FeedItem = {
  creator?: string;
  "dc:creator"?: string;
  content?: string;
  "content:encoded"?: string;
  summary?: string;
  author?: string;
  guid?: string;
  link?: string;
  title?: string;
  isoDate?: string;
  pubDate?: string;
  categories?: string[];
};

export type AtlanticArticle = {
  articleId: string;
  title: string;
  url: string;
  authorName: string | null;
  publishedAt: string | null;
  summaryText: string | null;
  categories: string[];
  feedUrl: string;
};

export type AtlanticFeedResult = {
  fetchedAt: string;
  totalArticles: number;
  articles: AtlanticArticle[];
};

export type AtlanticAuthorMatch = {
  authorName: string;
  articles: AtlanticArticle[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const FEED_URLS = [
  "https://www.theatlantic.com/feed/all/",
  "https://www.theatlantic.com/feed/channel/news/",
  "https://www.theatlantic.com/feed/channel/politics/",
  "https://www.theatlantic.com/feed/channel/business/",
  "https://www.theatlantic.com/feed/channel/technology/",
  "https://www.theatlantic.com/feed/channel/science/",
  "https://www.theatlantic.com/feed/channel/health/",
  "https://www.theatlantic.com/feed/channel/education/",
];

// Simple in-memory cache: refreshed every 30 minutes
let _cache: { data: AtlanticFeedResult; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

const rssParser = new Parser<Record<string, never>, FeedItem>({
  timeout: 10_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; RSSBot/1.0)" },
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toIsoDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildArticleId(url: string): string {
  return `atlantic-${slugify(url).slice(-60)}`;
}

function normalizeArticle(feedUrl: string, item: FeedItem): AtlanticArticle | null {
  const url = firstNonEmpty(item.link, item.guid);
  const title = firstNonEmpty(item.title);
  if (!url || !title) return null;

  const authorName = firstNonEmpty(item.creator, item["dc:creator"], item.author);
  const summaryHtml = firstNonEmpty(item["content:encoded"], item.content, item.summary);
  const summaryText = summaryHtml ? stripHtml(summaryHtml).slice(0, 400) : null;

  return {
    articleId: buildArticleId(url),
    title,
    url,
    authorName,
    publishedAt: toIsoDate(item.isoDate || item.pubDate),
    summaryText,
    categories: Array.isArray(item.categories)
      ? item.categories.filter((x): x is string => typeof x === "string")
      : [],
    feedUrl,
  };
}

function dedupeArticles(articles: AtlanticArticle[]): AtlanticArticle[] {
  const map = new Map<string, AtlanticArticle>();
  for (const article of articles) {
    const existing = map.get(article.url);
    if (!existing) {
      map.set(article.url, article);
      continue;
    }
    const score = (a: AtlanticArticle) =>
      (a.authorName ? 1 : 0) + (a.summaryText ? 1 : 0) + (a.categories.length ? 1 : 0) + (a.publishedAt ? 1 : 0);
    if (score(article) > score(existing)) map.set(article.url, article);
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });
}

async function fetchFeed(feedUrl: string): Promise<AtlanticArticle[]> {
  try {
    const feed = await rssParser.parseURL(feedUrl);
    return (feed.items ?? []).map(item => normalizeArticle(feedUrl, item)).filter((x): x is AtlanticArticle => x !== null);
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all Atlantic feeds and return deduplicated articles.
 * Results are cached in memory for 30 minutes.
 */
export async function fetchAtlanticFeed(forceRefresh = false): Promise<AtlanticFeedResult> {
  const now = Date.now();
  if (!forceRefresh && _cache && _cache.expiresAt > now) {
    return _cache.data;
  }

  const settled = await Promise.allSettled(FEED_URLS.map(fetchFeed));
  const all = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const articles = dedupeArticles(all);

  const result: AtlanticFeedResult = {
    fetchedAt: new Date().toISOString(),
    totalArticles: articles.length,
    articles,
  };

  _cache = { data: result, expiresAt: now + CACHE_TTL_MS };
  return result;
}

/**
 * Find Atlantic articles that match a given author name.
 * Uses fuzzy normalization — matches "Adam Grant" to "adam grant" etc.
 */
export function matchAtlanticArticlesToAuthor(
  articles: AtlanticArticle[],
  authorName: string,
  limit = 10
): AtlanticArticle[] {
  const normalizedTarget = normalizeName(authorName);
  // Also try first+last name fragments for partial matches
  const nameParts = normalizedTarget.split(" ").filter(p => p.length > 2);

  return articles
    .filter(article => {
      if (!article.authorName) return false;
      const normalizedAuthor = normalizeName(article.authorName);
      // Exact match
      if (normalizedAuthor === normalizedTarget) return true;
      // Contains full name
      if (normalizedAuthor.includes(normalizedTarget)) return true;
      // All significant name parts present
      if (nameParts.length >= 2 && nameParts.every(part => normalizedAuthor.includes(part))) return true;
      return false;
    })
    .slice(0, limit);
}
