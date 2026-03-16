/**
 * Apify Web Scraping Helpers
 *
 * Uses the Apify Cheerio Scraper (free) to extract structured data from:
 * - Amazon.com: book covers, ASIN, Amazon URL, title, author
 * - Google Images / author pages: real author headshots
 *
 * Actor used: apify/cheerio-scraper (FREE tier, no rental required)
 * Docs: https://apify.com/apify/cheerio-scraper
 */

import { ApifyClient } from "apify-client";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";
const ACTOR_ID = "apify/cheerio-scraper";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AmazonBookResult {
  asin: string;
  title: string;
  coverUrl: string;
  amazonUrl: string;
  author: string;
  price: string;
}

export interface AuthorPhotoResult {
  photoUrl: string;
  sourceUrl: string;
  sourceName: string;
}

// ── Apify client factory ──────────────────────────────────────────────────────

function getClient(): ApifyClient {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN is not set");
  return new ApifyClient({ token: APIFY_TOKEN });
}

// ── Amazon book scraper ───────────────────────────────────────────────────────

/**
 * Search Amazon for a book by title + author and return the best match.
 * Returns cover image URL, ASIN, Amazon product URL, and metadata.
 */
export async function scrapeAmazonBook(
  title: string,
  author: string
): Promise<AmazonBookResult | null> {
  const client = getClient();
  const query = encodeURIComponent(`${title} ${author}`);
  const searchUrl = `https://www.amazon.com/s?k=${query}&i=stripbooks`;

  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context;
  const results = [];
  $('.s-result-item[data-asin]').each((i, el) => {
    const asin = $(el).attr('data-asin');
    if (!asin || asin.length < 5) return;
    const title = $(el).find('h2 span').first().text().trim();
    const img = $(el).find('img.s-image').attr('src');
    const href = $(el).find('h2 a').attr('href');
    const authorEl = $(el).find('.a-size-base.a-color-secondary').first().text().trim();
    const priceEl = $(el).find('.a-price .a-offscreen').first().text().trim();
    if (title && img) {
      results.push({
        asin,
        title,
        coverUrl: img,
        amazonUrl: href ? 'https://www.amazon.com' + href.split('?')[0] : 'https://www.amazon.com/dp/' + asin,
        author: authorEl,
        price: priceEl
      });
    }
  });
  log.info('Found ' + results.length + ' Amazon results');
  return results.slice(0, 5);
}
`;

  try {
    const run = await client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url: searchUrl }],
        pageFunction,
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        proxyConfiguration: { useApifyProxy: true },
      },
      { memory: 256, waitSecs: 120 }
    );

    if (run.status !== "SUCCEEDED") {
      console.error("[Apify] Amazon scrape failed:", run.status);
      return null;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return null;

    // Find the best match: prefer exact title match
    const titleLower = title.toLowerCase();
    const sorted = [...items].sort((a, b) => {
      const aMatch = String(a.title ?? "").toLowerCase().includes(titleLower) ? 0 : 1;
      const bMatch = String(b.title ?? "").toLowerCase().includes(titleLower) ? 0 : 1;
      return aMatch - bMatch;
    });

    const best = sorted[0] as unknown as AmazonBookResult;
    return best ?? null;
  } catch (err) {
    console.error("[Apify] scrapeAmazonBook error:", err);
    return null;
  }
}

// ── Author photo scraper ──────────────────────────────────────────────────────

/**
 * Search for a real author headshot from Wikipedia and publisher pages.
 * Returns the best photo URL found.
 */
export async function scrapeAuthorPhoto(
  authorName: string
): Promise<AuthorPhotoResult | null> {
  const client = getClient();
  const slug = authorName.replace(/ /g, "_");
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;

  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context;
  const results = [];

  // Wikipedia infobox photo (most reliable)
  const infoboxImg = $('.infobox img, .infobox-image img').first();
  if (infoboxImg.length) {
    const src = infoboxImg.attr('src');
    if (src) {
      const fullSrc = src.startsWith('//') ? 'https:' + src : src;
      results.push({ photoUrl: fullSrc, sourceUrl: request.url, sourceName: 'Wikipedia' });
    }
  }

  // Fallback: any portrait-style image in the article
  if (results.length === 0) {
    $('figure img, .thumb img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('flag')) {
        const fullSrc = src.startsWith('//') ? 'https:' + src : src;
        results.push({ photoUrl: fullSrc, sourceUrl: request.url, sourceName: 'Wikipedia' });
        return false; // break
      }
    });
  }

  log.info('Found ' + results.length + ' photo candidates');
  return results.slice(0, 1);
}
`;

  try {
    const run = await client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url: wikiUrl }],
        pageFunction,
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        proxyConfiguration: { useApifyProxy: true },
      },
      { memory: 256, waitSecs: 120 }
    );

    if (run.status !== "SUCCEEDED") {
      console.error("[Apify] Author photo scrape failed:", run.status);
      return null;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return null;

    return items[0] as unknown as AuthorPhotoResult;
  } catch (err) {
    console.error("[Apify] scrapeAuthorPhoto error:", err);
    return null;
  }
}

// ── Generic URL scraper ───────────────────────────────────────────────────────

/**
 * Scrape any URL with a custom Cheerio page function.
 * Returns raw dataset items from the run.
 */
export async function scrapeUrl(
  url: string,
  pageFunction: string,
  options: { maxRequests?: number; memory?: number } = {}
): Promise<Record<string, unknown>[]> {
  const client = getClient();

  try {
    const run = await client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url }],
        pageFunction,
        maxRequestsPerCrawl: options.maxRequests ?? 1,
        maxConcurrency: 1,
        proxyConfiguration: { useApifyProxy: true },
      },
      { memory: options.memory ?? 256, waitSecs: 120 }
    );

    if (run.status !== "SUCCEEDED") {
      console.error("[Apify] scrapeUrl failed:", run.status, url);
      return [];
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return (items ?? []) as Record<string, unknown>[];
  } catch (err) {
    console.error("[Apify] scrapeUrl error:", err);
    return [];
  }
}
