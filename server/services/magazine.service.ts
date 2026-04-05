/**
 * magazine.service.ts
 *
 * Unified RSS + Apify full-text scraping service for 5 publications:
 *   - The Atlantic
 *   - The New Yorker
 *   - Wired
 *   - The New York Times
 *   - The Washington Post
 *
 * Flow:
 *   1. fetchFeed(source)  → parse RSS → return normalised ArticleRecord[]
 *   2. scrapeFullText(url) → Apify Cheerio Scraper → return full article body
 *   3. matchToAuthor(articles, authorName) → fuzzy name match
 */

import Parser from "rss-parser";
import type { InsertMagazineArticle } from "../../drizzle/schema";

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

export type MagazineSource =
  | "the-atlantic"
  | "the-new-yorker"
  | "wired"
  | "nyt"
  | "washington-post";

export type NormalisedArticle = {
  articleId: string;
  source: MagazineSource;
  publicationName: string;
  title: string;
  url: string;
  authorName: string | null;
  authorNameNormalized: string | null;
  publishedAt: Date | null;
  summaryText: string | null;
  categoriesJson: string;
  feedUrl: string;
};

// ── Publication Config ────────────────────────────────────────────────────────

export type PublicationConfig = {
  source: MagazineSource;
  name: string;
  feeds: string[];
  /** CSS selectors for Apify full-text extraction */
  articleBodySelector: string;
  /** CSS selectors to remove from scraped content (ads, nav, etc.) */
  removeSelectors: string[];
};

export const PUBLICATIONS: PublicationConfig[] = [
  {
    source: "the-atlantic",
    name: "The Atlantic",
    feeds: [
      "https://www.theatlantic.com/feed/all/",
      "https://www.theatlantic.com/feed/channel/news/",
      "https://www.theatlantic.com/feed/channel/politics/",
      "https://www.theatlantic.com/feed/channel/business/",
      "https://www.theatlantic.com/feed/channel/technology/",
      "https://www.theatlantic.com/feed/channel/science/",
      "https://www.theatlantic.com/feed/channel/health/",
    ],
    articleBodySelector: "article .article-body, .article-content, [data-id='article-body']",
    removeSelectors: ["nav", "header", "footer", ".ad", ".newsletter-signup", "aside"],
  },
  {
    source: "the-new-yorker",
    name: "The New Yorker",
    feeds: [
      "https://www.newyorker.com/feed/everything",
      "https://www.newyorker.com/feed/news",
      "https://www.newyorker.com/feed/culture",
      "https://www.newyorker.com/feed/tech",
      "https://www.newyorker.com/feed/books",
    ],
    articleBodySelector: ".article__body, .body__inner-container, [data-testid='body-inner-container']",
    removeSelectors: ["nav", "header", "footer", ".ad", ".subscribe-promo", "aside"],
  },
  {
    source: "wired",
    name: "Wired",
    feeds: [
      "https://www.wired.com/feed/rss",
      "https://www.wired.com/feed/category/science/latest/rss",
      "https://www.wired.com/feed/category/business/latest/rss",
      "https://www.wired.com/feed/category/culture/latest/rss",
      "https://www.wired.com/feed/category/ideas/latest/rss",
    ],
    articleBodySelector: ".article__chunks, .body__inner-container, [data-testid='BodyWrapper']",
    removeSelectors: ["nav", "header", "footer", ".ad", ".paywall", "aside"],
  },
  {
    source: "nyt",
    name: "The New York Times",
    feeds: [
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml",
    ],
    articleBodySelector: ".StoryBodyCompanionColumn, .article-body, section[name='articleBody']",
    removeSelectors: ["nav", "header", "footer", ".ad", ".paywall", "aside", ".nytimes-promo"],
  },
  {
    source: "washington-post",
    name: "The Washington Post",
    feeds: [
      "https://feeds.washingtonpost.com/rss/national",
      "https://feeds.washingtonpost.com/rss/business",
      "https://feeds.washingtonpost.com/rss/technology",
      "https://feeds.washingtonpost.com/rss/science",
      "https://feeds.washingtonpost.com/rss/entertainment/books",
      "https://feeds.washingtonpost.com/rss/opinions",
    ],
    articleBodySelector: ".article-body, .teaser-content, [data-qa='article-body']",
    removeSelectors: ["nav", "header", "footer", ".ad", ".paywall", "aside"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const rssParser = new Parser<Record<string, never>, FeedItem>({
  timeout: 12_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; LibraryBot/1.0)" },
});

export function stripHtml(html: string): string {
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

export function normalizeName(name: string): string {
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
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildArticleId(source: MagazineSource, url: string): string {
  return `${source}-${slugify(url)}`;
}

function normaliseItem(
  feedUrl: string,
  pub: PublicationConfig,
  item: FeedItem
): NormalisedArticle | null {
  const url = firstNonEmpty(item.link, item.guid);
  const title = firstNonEmpty(item.title);
  if (!url || !title) return null;

  const authorName = firstNonEmpty(item.creator, item["dc:creator"], item.author);
  const summaryHtml = firstNonEmpty(item["content:encoded"], item.content, item.summary);
  const summaryText = summaryHtml ? stripHtml(summaryHtml).slice(0, 600) : null;
  const categories = Array.isArray(item.categories)
    ? item.categories.filter((x): x is string => typeof x === "string")
    : [];

  return {
    articleId: buildArticleId(pub.source, url),
    source: pub.source,
    publicationName: pub.name,
    title,
    url,
    authorName,
    authorNameNormalized: authorName ? normalizeName(authorName) : null,
    publishedAt: toDate(item.isoDate || item.pubDate),
    summaryText,
    categoriesJson: JSON.stringify(categories),
    feedUrl,
  };
}

function dedupeArticles(articles: NormalisedArticle[]): NormalisedArticle[] {
  const map = new Map<string, NormalisedArticle>();
  for (const a of articles) {
    const existing = map.get(a.articleId);
    if (!existing) { map.set(a.articleId, a); continue; }
    const score = (x: NormalisedArticle) =>
      (x.authorName ? 1 : 0) + (x.summaryText ? 1 : 0) + (x.publishedAt ? 1 : 0);
    if (score(a) > score(existing)) map.set(a.articleId, a);
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = a.publishedAt?.getTime() ?? 0;
    const db = b.publishedAt?.getTime() ?? 0;
    return db - da;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch and normalise all RSS feeds for a given publication source.
 */
export async function fetchMagazineFeed(source: MagazineSource): Promise<NormalisedArticle[]> {
  const pub = PUBLICATIONS.find(p => p.source === source);
  if (!pub) throw new Error(`Unknown magazine source: ${source}`);

  const settled = await Promise.allSettled(
    pub.feeds.map(async (feedUrl) => {
      try {
        const feed = await rssParser.parseURL(feedUrl);
        return (feed.items ?? [])
          .map(item => normaliseItem(feedUrl, pub, item))
          .filter((x): x is NormalisedArticle => x !== null);
      } catch {
        return [] as NormalisedArticle[];
      }
    })
  );

  const all = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
  return dedupeArticles(all);
}

/**
 * Fetch all 5 publications in parallel.
 */
export async function fetchAllMagazines(): Promise<NormalisedArticle[]> {
  const sources: MagazineSource[] = ["the-atlantic", "the-new-yorker", "wired", "nyt", "washington-post"];
  const settled = await Promise.allSettled(sources.map(fetchMagazineFeed));
  return settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
}

/**
 * Match articles to a library author by normalised name.
 */
export function matchArticlesToAuthor(
  articles: NormalisedArticle[],
  authorName: string,
  limit = 20
): NormalisedArticle[] {
  const target = normalizeName(authorName);
  const parts = target.split(" ").filter(p => p.length > 2);

  return articles
    .filter(a => {
      if (!a.authorNameNormalized) return false;
      const n = a.authorNameNormalized;
      if (n === target) return true;
      if (n.includes(target)) return true;
      if (parts.length >= 2 && parts.every(p => n.includes(p))) return true;
      return false;
    })
    .slice(0, limit);
}

/**
 * Convert a NormalisedArticle to a DB insert row.
 */
export function toInsertRow(a: NormalisedArticle): InsertMagazineArticle {
  return {
    articleId: a.articleId,
    source: a.source,
    publicationName: a.publicationName,
    title: a.title,
    url: a.url,
    authorName: a.authorName ?? undefined,
    authorNameNormalized: a.authorNameNormalized ?? undefined,
    publishedAt: a.publishedAt ?? undefined,
    summaryText: a.summaryText ?? undefined,
    categoriesJson: a.categoriesJson,
    feedUrl: a.feedUrl,
    scrapeAttempted: false,
    ragIndexed: false,
  };
}
