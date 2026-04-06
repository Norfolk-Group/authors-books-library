/**
 * worldcat.ts — WorldCat / OCLC library holdings helper
 *
 * Uses the OCLC WorldCat Search API (free, no key required for basic ISBN lookups).
 * Endpoint: https://www.worldcat.org/api/search
 *
 * Provides:
 *  - searchWorldCat(query, limit?)         → search by title/author, returns holdings info
 *  - getWorldCatByISBN(isbn)               → lookup by ISBN, returns library count + record
 *  - getLibraryHoldingsCount(isbn)         → simplified: how many libraries hold this book
 *
 * Note: WorldCat rate-limits aggressively (429). All functions retry once with backoff
 * and return null gracefully on failure.
 */

const BASE = "https://www.worldcat.org/api";
const TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 1_500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorldCatRecord {
  oclcNumber?: string;
  title: string;
  author?: string;
  publisher?: string;
  publishYear?: string;
  isbn?: string[];
  isbns?: string[];
  libraryCount?: number;
  recordUrl?: string;
  coverUrl?: string;
  language?: string;
  format?: string;
}

export interface WorldCatSearchResult {
  totalRecords: number;
  records: WorldCatRecord[];
}

export interface WorldCatHoldings {
  oclcNumber?: string;
  title?: string;
  libraryCount: number;
  recordUrl?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 1): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RCLibraryBot/1.0)",
          "Accept": "application/json",
        },
      });
      clearTimeout(timer);
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return res;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return null;
    }
  }
  return null;
}

function parseWorldCatRecord(item: Record<string, unknown>): WorldCatRecord {
  const isbns: string[] = [];
  if (Array.isArray(item.isbns)) isbns.push(...(item.isbns as string[]));
  if (typeof item.isbn === "string") isbns.push(item.isbn);

  return {
    oclcNumber: typeof item.oclcNumber === "string" ? item.oclcNumber : undefined,
    title: typeof item.title === "string" ? item.title : "Unknown Title",
    author: typeof item.creator === "string" ? item.creator :
            typeof item.author === "string" ? item.author : undefined,
    publisher: typeof item.publisher === "string" ? item.publisher : undefined,
    publishYear: typeof item.date === "string" ? item.date :
                 typeof item.publishYear === "string" ? item.publishYear : undefined,
    isbn: isbns.length > 0 ? isbns : undefined,
    libraryCount: typeof item.numberOfLibraries === "number" ? item.numberOfLibraries :
                  typeof item.holdingsCount === "number" ? item.holdingsCount : undefined,
    recordUrl: typeof item.oclcNumber === "string"
      ? `https://www.worldcat.org/oclc/${item.oclcNumber}`
      : undefined,
    language: typeof item.language === "string" ? item.language : undefined,
    format: typeof item.generalFormat === "string" ? item.generalFormat : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search WorldCat by title/author query.
 * Returns up to `limit` records with library holding counts.
 */
export async function searchWorldCat(
  query: string,
  limit = 5
): Promise<WorldCatSearchResult | null> {
  if (!query?.trim()) return null;
  try {
    const url = `${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=1`;
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) return null;
    const data = (await res.json()) as {
      numberOfRecords?: number;
      briefRecords?: Record<string, unknown>[];
    };
    const records = (data.briefRecords ?? []).map(parseWorldCatRecord);
    return {
      totalRecords: data.numberOfRecords ?? records.length,
      records,
    };
  } catch {
    return null;
  }
}

/**
 * Look up a book in WorldCat by ISBN.
 * Returns the first matching record with library count, or null.
 */
export async function getWorldCatByISBN(isbn: string): Promise<WorldCatRecord | null> {
  if (!isbn?.trim()) return null;
  const cleanIsbn = isbn.replace(/[-\s]/g, "");
  try {
    const url = `${BASE}/search?q=isbn:${encodeURIComponent(cleanIsbn)}&limit=1&offset=1`;
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) return null;
    const data = (await res.json()) as {
      briefRecords?: Record<string, unknown>[];
    };
    const records = data.briefRecords ?? [];
    if (records.length === 0) return null;
    return parseWorldCatRecord(records[0]);
  } catch {
    return null;
  }
}

/**
 * Simplified: get the number of libraries that hold a book by ISBN.
 * Returns 0 if not found or on error.
 */
export async function getLibraryHoldingsCount(isbn: string): Promise<WorldCatHoldings | null> {
  const record = await getWorldCatByISBN(isbn);
  if (!record) return null;
  return {
    oclcNumber: record.oclcNumber,
    title: record.title,
    libraryCount: record.libraryCount ?? 0,
    recordUrl: record.recordUrl,
  };
}
