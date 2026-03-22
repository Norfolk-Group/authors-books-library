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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum time (seconds) to wait for an Apify actor run to complete */
const ACTOR_WAIT_SECS = 120;
/** Memory (MB) allocated per actor run */
const ACTOR_MEMORY_MB = 256;
/** Number of times to retry a failed actor run before giving up */
const MAX_RETRIES = 2;
/** Base delay (ms) between retries — doubles on each attempt */
const RETRY_BASE_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AmazonBookResult {
  asin: string;
  title: string;
  coverUrl: string;
  amazonUrl: string;
  author: string;
  price: string;
}

export interface AuthorPhotoResult {
  avatarUrl: string;
  sourceUrl: string;
  sourceName: string;
}

export interface ApifyRunResult<T> {
  items: T[];
  runId: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Apify client factory
// ---------------------------------------------------------------------------

function getClient(): ApifyClient {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN is not set");
  return new ApifyClient({ token: APIFY_TOKEN });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an Apify actor with automatic retry on transient failures.
 * Returns typed dataset items or null on permanent failure.
 */
async function runActorWithRetry<T>(
  startUrls: Array<{ url: string }>,
  pageFunction: string,
  options: { maxRequests?: number; memory?: number; label?: string } = {}
): Promise<ApifyRunResult<T> | null> {
  const client = getClient();
  const label = options.label ?? startUrls[0]?.url ?? "unknown";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const run = await client.actor(ACTOR_ID).call(
        {
          startUrls,
          pageFunction,
          maxRequestsPerCrawl: options.maxRequests ?? 1,
          maxConcurrency: 1,
          proxyConfiguration: { useApifyProxy: true },
        },
        { memory: options.memory ?? ACTOR_MEMORY_MB, waitSecs: ACTOR_WAIT_SECS }
      );

      if (run.status !== "SUCCEEDED") {
        console.warn(`[Apify] Run ${run.status} for "${label}" (attempt ${attempt}/${MAX_RETRIES + 1})`);
        if (attempt <= MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        return null;
      }

      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log(`[Apify] ✓ ${items?.length ?? 0} items from "${label}" (attempt ${attempt})`);
      return {
        items: (items ?? []) as T[],
        runId: run.id,
        status: run.status,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Apify] Error on attempt ${attempt}/${MAX_RETRIES + 1} for "${label}": ${msg}`);
      if (attempt <= MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

// -- Amazon book scraper -------------------------------------------------------

/**
 * Search Amazon for a book by title + author and return the best match.
 * Returns cover image URL, ASIN, Amazon product URL, and metadata.
 */
export async function scrapeAmazonBook(
  title: string,
  author: string
): Promise<AmazonBookResult | null> {
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

  const result = await runActorWithRetry<AmazonBookResult>(
    [{ url: searchUrl }],
    pageFunction,
    { label: `Amazon: ${title} by ${author}` }
  );

  if (!result || result.items.length === 0) return null;

  // Find the best match: prefer exact title match
  const titleLower = title.toLowerCase();
  const sorted = [...result.items].sort((a, b) => {
    const aMatch = String(a.title ?? "").toLowerCase().includes(titleLower) ? 0 : 1;
    const bMatch = String(b.title ?? "").toLowerCase().includes(titleLower) ? 0 : 1;
    return aMatch - bMatch;
  });

  return sorted[0] ?? null;
}

// -- Author avatar scraper ------------------------------------------------------

/**
 * Search for a real author headshot from Wikipedia and publisher pages.
 * Returns the best avatar URL found.
 */
export async function scrapeAuthorPhoto(
  authorName: string
): Promise<AuthorPhotoResult | null> {
  const slug = authorName.replace(/ /g, "_");
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;

  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context;
  const results = [];

  // Wikipedia infobox avatar (most reliable)
  const infoboxImg = $('.infobox img, .infobox-image img').first();
  if (infoboxImg.length) {
    const src = infoboxImg.attr('src');
    if (src) {
      const fullSrc = src.startsWith('//') ? 'https:' + src : src;
      results.push({ avatarUrl: fullSrc, sourceUrl: request.url, sourceName: 'Wikipedia' });
    }
  }

  // Fallback: any portrait-style image in the article
  if (results.length === 0) {
    $('figure img, .thumb img').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('flag')) {
        const fullSrc = src.startsWith('//') ? 'https:' + src : src;
        results.push({ avatarUrl: fullSrc, sourceUrl: request.url, sourceName: 'Wikipedia' });
        return false; // break
      }
    });
  }

  log.info('Found ' + results.length + ' avatar candidates');
  return results.slice(0, 1);
}
`;

  const result = await runActorWithRetry<AuthorPhotoResult>(
    [{ url: wikiUrl }],
    pageFunction,
    { label: `Wikipedia avatar: ${authorName}` }
  );

  if (!result || result.items.length === 0) return null;
  return result.items[0] ?? null;
}

// -- Generic URL scraper -------------------------------------------------------

/**
 * Scrape any URL with a custom Cheerio page function.
 * Returns raw dataset items from the run.
 */
export async function scrapeUrl(
  url: string,
  pageFunction: string,
  options: { maxRequests?: number; memory?: number; label?: string } = {}
): Promise<Record<string, unknown>[]> {
  const result = await runActorWithRetry<Record<string, unknown>>(
    [{ url }],
    pageFunction,
    { ...options, label: options.label ?? url }
  );
  return result?.items ?? [];
}
