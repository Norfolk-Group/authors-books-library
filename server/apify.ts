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

export interface AmazonBookDetailResult {
  asin: string;
  title: string;
  coverUrl: string;
  amazonUrl: string;
  author: string;
  description: string;
  rating: string;
  ratingCount: string;
  isbn: string;
  publisher: string;
  publicationDate: string;
  pageCount: string;
  categories: string;
  aboutAuthor: string;
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

// ── Amazon book detail scraper ────────────────────────────────────────────────

/**
 * Scrape an Amazon product detail page for full book metadata.
 * Requires an ASIN (Amazon Standard Identification Number).
 * Returns description, rating, ISBN, publisher, page count, categories, and "About the Author".
 */
export async function scrapeAmazonBookDetail(
  asin: string
): Promise<AmazonBookDetailResult | null> {
  const client = getClient();
  const productUrl = `https://www.amazon.com/dp/${asin}`;

  const pageFunction = `
async function pageFunction(context) {
  const { $, request, log } = context;

  // Title
  const title = $('#productTitle').text().trim() || $('span#ebooksProductTitle').text().trim() || '';

  // Author
  const author = $('.author a.contributorNameID, .author a').first().text().trim() || '';

  // Cover image — high-res from the main product image
  const coverUrl = $('#imgBlkFront').attr('src') || $('#ebooksImgBlkFront').attr('src') || $('#main-image').attr('src') || '';

  // Description — from the book description section
  let description = '';
  const descEl = $('#bookDescription_feature_div .a-expander-content, #bookDescription_feature_div span, div[data-a-expander-name="book_description_expander"] span');
  if (descEl.length) {
    description = descEl.first().text().trim();
  }
  if (!description) {
    const iframeContent = $('#bookDesc_iframe_wrapper noscript, #bookDescription_feature_div noscript').text().trim();
    if (iframeContent) description = iframeContent.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
  }

  // Rating
  const ratingText = $('span[data-hook="rating-out-of-text"], #acrPopover .a-icon-alt').first().text().trim();
  const rating = ratingText ? ratingText.replace(/[^0-9.]/g, '').slice(0, 3) : '';

  // Rating count
  const ratingCountText = $('#acrCustomerReviewText').first().text().trim();
  const ratingCount = ratingCountText ? ratingCountText.replace(/[^0-9,]/g, '') : '';

  // Product details — ISBN, publisher, page count, publication date
  let isbn = '';
  let publisher = '';
  let publicationDate = '';
  let pageCount = '';

  // Try detail bullets list
  $('#detailBullets_feature_div li, #productDetailsTable .content li, .detail-bullet-list li').each((i, el) => {
    const text = $(el).text().replace(/\\s+/g, ' ').trim();
    if (text.includes('ISBN-13') || text.includes('ISBN-10')) {
      const match = text.match(/([0-9-]{10,17})/);
      if (match) isbn = isbn || match[1].replace(/-/g, '');
    }
    if (text.includes('Publisher')) {
      publisher = publisher || text.replace(/.*Publisher\\s*[:：]?\\s*/i, '').split('(')[0].trim();
    }
    if (text.includes('Publication date') || text.includes('publish')) {
      const dateMatch = text.match(/(\\w+ \\d{1,2},? \\d{4}|\\d{4}-\\d{2}-\\d{2})/);
      if (dateMatch) publicationDate = publicationDate || dateMatch[1];
    }
    if (text.includes('pages') || text.includes('Print length')) {
      const pageMatch = text.match(/(\\d+)\\s*pages/i);
      if (pageMatch) pageCount = pageCount || pageMatch[1];
    }
  });

  // Also try the carousel/table format
  $('#productDetailsTable tr, .prodDetTable tr, #detailBulletsWrapper_feature_div li').each((i, el) => {
    const label = $(el).find('th, .a-text-bold, span.a-text-bold').text().trim();
    const value = $(el).find('td, span:not(.a-text-bold)').last().text().trim();
    if (label.includes('ISBN-13') && !isbn) isbn = value.replace(/[^0-9]/g, '');
    if (label.includes('Publisher') && !publisher) publisher = value.split('(')[0].trim();
    if ((label.includes('Publication') || label.includes('publish')) && !publicationDate) publicationDate = value;
    if ((label.includes('pages') || label.includes('Print')) && !pageCount) {
      const m = value.match(/(\\d+)/);
      if (m) pageCount = m[1];
    }
  });

  // Categories / breadcrumbs
  const categories = [];
  $('#wayfinding-breadcrumbs_feature_div li a, .zg_hrsr_ladder a').each((i, el) => {
    const cat = $(el).text().trim();
    if (cat && cat !== 'Books' && cat !== 'Back') categories.push(cat);
  });

  // About the Author
  let aboutAuthor = '';
  const aboutEl = $('#authorBio_feature_div .a-expander-content, .author-bio-text, div[data-feature-name="authorBio"] span');
  if (aboutEl.length) {
    aboutAuthor = aboutEl.first().text().trim();
  }

  log.info('Scraped detail: ' + title + ' | rating: ' + rating + ' | isbn: ' + isbn);

  return [{
    asin: '${asin}',
    title,
    coverUrl,
    amazonUrl: request.url,
    author,
    description: description.slice(0, 2000),
    rating,
    ratingCount,
    isbn,
    publisher,
    publicationDate,
    pageCount,
    categories: categories.slice(0, 5).join(', '),
    aboutAuthor: aboutAuthor.slice(0, 1000),
    price: ''
  }];
}
`;

  try {
    const run = await client.actor(ACTOR_ID).call(
      {
        startUrls: [{ url: productUrl }],
        pageFunction,
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
        proxyConfiguration: { useApifyProxy: true },
      },
      { memory: 256, waitSecs: 120 }
    );

    if (run.status !== "SUCCEEDED") {
      console.error("[Apify] Amazon detail scrape failed:", run.status);
      return null;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) return null;

    return items[0] as unknown as AmazonBookDetailResult;
  } catch (err) {
    console.error("[Apify] scrapeAmazonBookDetail error:", err);
    return null;
  }
}

/**
 * Full Amazon enrichment: search for the book, then scrape the detail page.
 * Returns the combined result with cover, description, rating, ISBN, publisher, etc.
 */
export async function enrichBookFromAmazon(
  title: string,
  author: string
): Promise<AmazonBookDetailResult | null> {
  // Step 1: Search Amazon to find the ASIN
  const searchResult = await scrapeAmazonBook(title, author);
  if (!searchResult?.asin) {
    console.log(`[Amazon enrich] No ASIN found for "${title}" by ${author}`);
    return null;
  }

  // Step 2: Scrape the detail page
  const detail = await scrapeAmazonBookDetail(searchResult.asin);
  if (!detail) {
    // Return search result as a minimal detail
    return {
      asin: searchResult.asin,
      title: searchResult.title,
      coverUrl: searchResult.coverUrl,
      amazonUrl: searchResult.amazonUrl,
      author: searchResult.author,
      description: "",
      rating: "",
      ratingCount: "",
      isbn: "",
      publisher: "",
      publicationDate: "",
      pageCount: "",
      categories: "",
      aboutAuthor: "",
      price: searchResult.price,
    };
  }

  // Merge: use detail page data, but fall back to search result for cover
  return {
    ...detail,
    coverUrl: detail.coverUrl || searchResult.coverUrl,
    amazonUrl: detail.amazonUrl || searchResult.amazonUrl,
    author: detail.author || searchResult.author,
    price: detail.price || searchResult.price,
  };
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
