/**
 * rapidapi.ts — Phase B enrichment helpers using RapidAPI
 *
 * Covers: Yahoo Finance, CNBC, LinkedIn
 * (Seeking Alpha removed — not subscribed)
 *
 * All require RAPIDAPI_KEY environment variable.
 * Each function gracefully returns null if the key is missing or the API fails.
 */

// ─── Yahoo Finance ────────────────────────────────────────────────────────────

export interface YahooFinanceStats {
  ticker: string;
  shortName: string;
  regularMarketPrice: number | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fetchedAt: string;
}

/**
 * Fetch stock/company data from Yahoo Finance via RapidAPI.
 * @param ticker - Stock ticker symbol (e.g. "AAPL", "MSFT")
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchYahooFinanceStats(
  ticker: string,
  rapidApiKey: string
): Promise<YahooFinanceStats | null> {
  if (!rapidApiKey || !ticker) return null;

  try {
    const res = await fetch(
      `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${encodeURIComponent(ticker)}&type=STOCKS`,
      {
        headers: {
          "x-rapidapi-host": "yahoo-finance15.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[YahooFinance] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      body?: {
        shortName?: string;
        regularMarketPrice?: number;
        marketCap?: number;
        currency?: string;
        fullExchangeName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
    };
    const body = data.body;
    if (!body) return null;

    return {
      ticker: ticker.toUpperCase(),
      shortName: body.shortName || ticker,
      regularMarketPrice: body.regularMarketPrice || null,
      marketCap: body.marketCap || null,
      currency: body.currency || null,
      exchange: body.fullExchangeName || null,
      fiftyTwoWeekHigh: body.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: body.fiftyTwoWeekLow || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[YahooFinance] Error for ticker ${ticker}:`, err);
    return null;
  }
}

// ─── CNBC ─────────────────────────────────────────────────────────────────────

export interface CNBCArticle {
  title: string;
  url: string;
  date: string | null;
  description: string | null;
  section: string | null;
  imageUrl: string | null;
}

export interface CNBCStats {
  /** Total number of matching articles found across all feeds */
  articleCount: number;
  /** Up to 5 most recent matching articles */
  recentArticles: CNBCArticle[];
  /** ISO date string of the most recently published matching article */
  latestArticleDate: string | null;
  /** CNBC franchise feeds that were searched */
  feedsSearched: number;
  fetchedAt: string;
}

/**
 * CNBC franchise IDs covering business, leadership, and investing content.
 * These are the feeds most likely to feature business-book authors.
 *
 * Discovered via probe:
 *   10000664 = Business News (general)
 *   10000108 = Business
 *   10000113 = Investing
 *   10001147 = Make It (leadership/career)
 *   10000110 = Economy
 *   10000115 = Technology
 */
const CNBC_FRANCHISE_IDS = [
  10000664, // Business News
  10001147, // Make It (leadership, career, personal finance)
  10000108, // Business
  10000113, // Investing
  10000110, // Economy
];

/** Raw article shape returned by the CNBC news/v2/list endpoint */
interface CNBCRawArticle {
  __typename?: string;
  id?: number;
  type?: string;
  headline?: string;
  shorterHeadline?: string;
  description?: string;
  pageName?: string;
  relatedTagsFilteredFormatted?: string;
  dateFirstPublished?: string;
  dateLastPublished?: string;
  sectionHierarchyFormatted?: string;
  authorFormatted?: string;
  shortDateFirstPublished?: string;
  url?: string;
  premium?: boolean;
  promoImage?: { url?: string };
  section?: { tagName?: string };
}

interface CNBCFeedResponse {
  data?: {
    sectionsEntries?: Array<{
      assets?: CNBCRawArticle[];
    }>;
  };
}

/**
 * Build name-matching tokens from an author name.
 * Returns [fullNameLower, firstName, lastName] for flexible matching.
 */
export function buildNameTokens(authorName: string): {
  full: string;
  first: string;
  last: string;
  parts: string[];
} {
  const full = authorName.toLowerCase().trim();
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    full,
    first: parts[0] || "",
    last: parts[parts.length - 1] || "",
    parts,
  };
}

/**
 * Check whether a raw CNBC article matches the given author.
 *
 * Matching strategy (in order of confidence):
 *   1. authorFormatted contains the full name (exact)
 *   2. authorFormatted contains last name AND first name (handles "Grant, Adam" bylines)
 *   3. relatedTagsFilteredFormatted contains the full name
 *   4. headline contains the full name
 *   5. relatedTagsFilteredFormatted contains last name AND first name
 *   6. description/pageName contains the full name (partial match)
 *   7. Byline partial: author field contains any 2+ name parts (handles middle names)
 */
function articleMatchesAuthor(
  article: CNBCRawArticle,
  tokens: ReturnType<typeof buildNameTokens>
): boolean {
  const author = (article.authorFormatted || "").toLowerCase();
  const tags = (article.relatedTagsFilteredFormatted || "").toLowerCase();
  const headline = (article.headline || "").toLowerCase();
  const description = (article.description || "").toLowerCase();
  const pageName = (article.pageName || "").toLowerCase();

  // 1. Exact full-name match in author byline
  if (author.includes(tokens.full)) return true;

  // 2. Last + first in author byline (handles "grant, adam" or "adam s. grant" style)
  if (
    tokens.last.length > 2 &&
    tokens.first.length > 1 &&
    author.includes(tokens.last) &&
    author.includes(tokens.first)
  )
    return true;

  // 3. Full name in tags (e.g. "adam grant" as a tag)
  if (tags.includes(tokens.full)) return true;

  // 4. Full name in headline
  if (headline.includes(tokens.full)) return true;

  // 5. Last + first in tags (pipe-separated tag list)
  const tagList = tags.split("|").map((t) => t.trim());
  const hasLastInTags = tagList.some((t) => t === tokens.last || t.includes(tokens.last));
  const hasFirstInTags = tagList.some((t) => t === tokens.first || t.includes(tokens.first));
  if (tokens.last.length > 3 && tokens.first.length > 2 && hasLastInTags && hasFirstInTags)
    return true;

  // 6. Full name in description or pageName (partial match for broader coverage)
  if (description.includes(tokens.full)) return true;
  if (pageName.includes(tokens.full)) return true;

  // 7. Byline partial: if author has 3+ name parts, match if 2+ parts appear in byline
  //    (handles middle names, initials, suffixes like "Jr.", "III")
  if (tokens.parts.length >= 2 && author.length > 3) {
    const matchingParts = tokens.parts.filter(
      (p) => p.length > 1 && author.includes(p)
    );
    if (matchingParts.length >= 2) return true;
  }

  return false;
}

/**
 * Fetch articles from a single CNBC franchise feed.
 */
async function fetchCNBCFeed(
  franchiseId: number,
  count: number,
  rapidApiKey: string
): Promise<CNBCRawArticle[]> {
  const res = await fetch(
    `https://cnbc.p.rapidapi.com/news/v2/list?franchiseId=${franchiseId}&count=${count}`,
    {
      headers: {
        "x-rapidapi-host": "cnbc.p.rapidapi.com",
        "x-rapidapi-key": rapidApiKey,
      },
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as CNBCFeedResponse;
  return data.data?.sectionsEntries?.[0]?.assets || [];
}

/**
 * Search CNBC for articles mentioning an author by fetching multiple franchise
 * feeds in parallel and filtering by author name.
 *
 * Strategy:
 *   - Fetch 5 franchise feeds (business, make-it, investing, economy, tech)
 *     in parallel, 30 articles each → up to 150 candidates
 *   - Filter by author name using a multi-signal matcher
 *   - De-duplicate by article ID
 *   - Return up to 5 most recent matches
 *
 * @param authorName - Full name of the author (e.g. "Adam Grant")
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchCNBCStats(
  authorName: string,
  rapidApiKey: string
): Promise<CNBCStats | null> {
  if (!rapidApiKey || !authorName.trim()) return null;

  const tokens = buildNameTokens(authorName);

  try {
    // Fetch all feeds in parallel
    const feedResults = await Promise.allSettled(
      CNBC_FRANCHISE_IDS.map((id) => fetchCNBCFeed(id, 30, rapidApiKey))
    );

    // Flatten and de-duplicate by article ID
    const seen = new Set<number>();
    const allArticles: CNBCRawArticle[] = [];
    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        for (const article of result.value) {
          if (article.id && !seen.has(article.id)) {
            seen.add(article.id);
            allArticles.push(article);
          }
        }
      }
    }

    // Filter to articles that match the author
    const matching = allArticles.filter((a) => articleMatchesAuthor(a, tokens));

    // Sort by date descending
    matching.sort((a, b) => {
      const da = a.dateFirstPublished || "";
      const db = b.dateFirstPublished || "";
      return db.localeCompare(da);
    });

    const recentArticles: CNBCArticle[] = matching.slice(0, 5).map((a) => ({
      title: a.headline || a.shorterHeadline || "",
      url: a.url || "",
      date: a.dateFirstPublished || null,
      description: a.description || null,
      section: a.section?.tagName || a.sectionHierarchyFormatted?.split("|")[0] || null,
      imageUrl: a.promoImage?.url || null,
    }));

    const latestDate = recentArticles.find((a) => a.date)?.date || null;

    console.info(
      `[CNBC] ${authorName}: searched ${allArticles.length} articles across ${CNBC_FRANCHISE_IDS.length} feeds → ${matching.length} matches`
    );

    return {
      articleCount: matching.length,
      recentArticles,
      latestArticleDate: latestDate,
      feedsSearched: CNBC_FRANCHISE_IDS.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[CNBC] Error for ${authorName}:`, err);
    return null;
  }
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export interface LinkedInStats {
  followerCount: number | null;
  connectionCount: number | null;
  headline: string | null;
  profileUrl: string;
  fetchedAt: string;
}

/**
 * Fetch LinkedIn profile stats via RapidAPI scraper.
 * @param linkedinUrl - LinkedIn profile URL
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchLinkedInStats(
  linkedinUrl: string,
  rapidApiKey: string
): Promise<LinkedInStats | null> {
  if (!rapidApiKey || !linkedinUrl) return null;

  try {
    const res = await fetch(
      `https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url?url=${encodeURIComponent(linkedinUrl)}`,
      {
        headers: {
          "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[LinkedIn] API error: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      followersCount?: number;
      connectionsCount?: number;
      headline?: string;
      profileUrl?: string;
    };

    return {
      followerCount: data.followersCount || null,
      connectionCount: data.connectionsCount || null,
      headline: data.headline || null,
      profileUrl: linkedinUrl,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[LinkedIn] Error for ${linkedinUrl}:`, err);
    return null;
  }
}

// ─── Seeking Alpha stub (kept for type compatibility, always returns null) ────

export interface SeekingAlphaStats {
  articleCount: number;
  recentArticles: Array<{ title: string; url: string; date: string | null }>;
  latestArticleDate: string | null;
  fetchedAt: string;
}

/**
 * Seeking Alpha integration removed (not subscribed to this RapidAPI endpoint).
 * Stub kept for backward compatibility with existing socialStatsJson data.
 */
export async function fetchSeekingAlphaStats(
  _authorName: string,
  _rapidApiKey: string
): Promise<SeekingAlphaStats | null> {
  return null;
}

// ─── CNBC Author Profile ────────────────────────────────────────────────────

export interface CNBCAuthorProfile {
  authorName: string;
  /** Number of articles found mentioning this author */
  articleCount: number;
  /** Up to 5 most recent articles */
  recentArticles: CNBCArticle[];
  /** Most recent article date */
  latestArticleDate: string | null;
  /** Author's primary topics based on article sections */
  topTopics: string[];
  /** Whether author appears as a CNBC contributor (byline match) */
  isContributor: boolean;
  fetchedAt: string;
}

/**
 * Build a full CNBC author profile by aggregating article data.
 * Extends fetchCNBCStats with topic analysis and contributor detection.
 *
 * @param authorName - Full name of the author
 * @param rapidApiKey - RapidAPI key
 */
export async function fetchCNBCAuthorProfile(
  authorName: string,
  rapidApiKey: string
): Promise<CNBCAuthorProfile | null> {
  if (!rapidApiKey || !authorName.trim()) return null;

  const stats = await fetchCNBCStats(authorName, rapidApiKey);
  if (!stats) return null;

  // Analyze topics from article sections
  const topicCounts = new Map<string, number>();
  for (const article of stats.recentArticles) {
    if (article.section) {
      const count = topicCounts.get(article.section) || 0;
      topicCounts.set(article.section, count + 1);
    }
  }
  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  // Check if author appears as a CNBC contributor (byline match)
  // Re-fetch raw articles to check authorFormatted field
  const tokens = buildNameTokens(authorName);
  let isContributor = false;

  try {
    const feedResults = await Promise.allSettled(
      CNBC_FRANCHISE_IDS.slice(0, 2).map((id) => fetchCNBCFeed(id, 10, rapidApiKey))
    );
    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        for (const article of result.value) {
          const byline = (article.authorFormatted || "").toLowerCase();
          if (byline.includes(tokens.full) || (byline.includes(tokens.first) && byline.includes(tokens.last))) {
            isContributor = true;
            break;
          }
        }
      }
      if (isContributor) break;
    }
  } catch {
    // Non-critical — contributor detection is best-effort
  }

  return {
    authorName,
    articleCount: stats.articleCount,
    recentArticles: stats.recentArticles,
    latestArticleDate: stats.latestArticleDate,
    topTopics,
    isContributor,
    fetchedAt: new Date().toISOString(),
  };
}
