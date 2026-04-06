/**
 * dpla.ts — Digital Public Library of America (DPLA) API helper
 *
 * DPLA provides free access to digital collections from libraries, archives,
 * and museums across the United States.
 * Docs: https://pro.dp.la/developers/api-codex
 *
 * Requires a free DPLA API key (register at https://dp.la/info/developers/codex/policies/).
 * If the key is not set, all functions gracefully return null.
 *
 * Provides:
 *  - searchDPLA(query, opts?)           → search items by title/creator
 *  - getDPLAByISBN(isbn)                → find items by ISBN
 *  - checkDPLAAvailability(title, author?) → check if a free digital copy exists
 */

import { ENV } from "../_core/env";

const BASE = "https://api.dp.la/v2";
const TIMEOUT_MS = 12_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DPLAItem {
  id: string;
  title?: string;
  creator?: string | string[];
  description?: string;
  subject?: string[];
  publisher?: string[];
  date?: string;
  rights?: string;
  isShownAt?: string;
  thumbnailUrl?: string;
  provider?: string;
  dataProvider?: string;
  format?: string[];
  language?: string[];
}

export interface DPLASearchResult {
  count: number;
  items: DPLAItem[];
  hasDigitalCopy: boolean;
}

export interface DPLAAvailability {
  available: boolean;
  itemCount: number;
  freeItems: DPLAItem[];
  searchUrl?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getDPLAKey(): string | null {
  // Check multiple possible env var names
  return (ENV as unknown as Record<string, string>).dplaApiKey ||
         process.env.DPLA_API_KEY ||
         null;
}

async function fetchDPLA<T>(path: string): Promise<T | null> {
  const key = getDPLAKey();
  if (!key) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}${sep}api_key=${encodeURIComponent(key)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "RCLibraryBot/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseItem(raw: Record<string, unknown>): DPLAItem {
  const sourceResource = (raw.sourceResource ?? {}) as Record<string, unknown>;
  const object = (raw.object ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    title: Array.isArray(sourceResource.title)
      ? String(sourceResource.title[0] ?? "")
      : typeof sourceResource.title === "string"
      ? sourceResource.title
      : undefined,
    creator: Array.isArray(sourceResource.creator)
      ? (sourceResource.creator as string[])
      : typeof sourceResource.creator === "string"
      ? sourceResource.creator
      : undefined,
    description: Array.isArray(sourceResource.description)
      ? String(sourceResource.description[0] ?? "")
      : typeof sourceResource.description === "string"
      ? sourceResource.description
      : undefined,
    subject: Array.isArray(sourceResource.subject)
      ? (sourceResource.subject as Array<{ name?: string }>).map((s) => s.name ?? String(s))
      : undefined,
    publisher: Array.isArray(sourceResource.publisher)
      ? (sourceResource.publisher as string[])
      : undefined,
    date: typeof (sourceResource.date as Record<string, unknown>)?.displayDate === "string"
      ? String((sourceResource.date as Record<string, unknown>).displayDate)
      : typeof sourceResource.date === "string"
      ? sourceResource.date
      : undefined,
    rights: typeof sourceResource.rights === "string" ? sourceResource.rights : undefined,
    isShownAt: typeof raw.isShownAt === "string" ? raw.isShownAt : undefined,
    thumbnailUrl: typeof object.url === "string" ? object.url :
                  typeof raw.object === "string" ? raw.object : undefined,
    provider: typeof (raw.provider as Record<string, unknown>)?.name === "string"
      ? String((raw.provider as Record<string, unknown>).name)
      : undefined,
    dataProvider: typeof raw.dataProvider === "string" ? raw.dataProvider : undefined,
    format: Array.isArray(sourceResource.format)
      ? (sourceResource.format as string[])
      : typeof sourceResource.format === "string"
      ? [sourceResource.format]
      : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search DPLA for items matching a query.
 * Returns null if API key is not configured.
 */
export async function searchDPLA(
  query: string,
  opts: { limit?: number; type?: string } = {}
): Promise<DPLASearchResult | null> {
  if (!query?.trim()) return null;
  const limit = opts.limit ?? 5;
  let path = `/items?q=${encodeURIComponent(query)}&page_size=${limit}`;
  if (opts.type) path += `&sourceResource.type=${encodeURIComponent(opts.type)}`;
  const data = await fetchDPLA<{
    count?: number;
    docs?: Record<string, unknown>[];
  }>(path);
  if (!data) return null;
  const items = (data.docs ?? []).map(parseItem);
  return {
    count: data.count ?? items.length,
    items,
    hasDigitalCopy: items.some((i) => i.isShownAt != null),
  };
}

/**
 * Search DPLA for a specific book by ISBN.
 * Returns null if API key is not configured or book not found.
 */
export async function getDPLAByISBN(isbn: string): Promise<DPLASearchResult | null> {
  if (!isbn?.trim()) return null;
  const cleanIsbn = isbn.replace(/[-\s]/g, "");
  return searchDPLA(cleanIsbn, { limit: 3 });
}

/**
 * Check if a free digital copy of a book exists in DPLA.
 * Returns null if API key is not configured.
 */
export async function checkDPLAAvailability(
  title: string,
  author?: string
): Promise<DPLAAvailability | null> {
  const query = author ? `${title} ${author}` : title;
  const result = await searchDPLA(query, { limit: 5, type: "text" });
  if (!result) return null;
  const freeItems = result.items.filter((i) => i.isShownAt != null);
  const encodedQuery = encodeURIComponent(query);
  return {
    available: freeItems.length > 0,
    itemCount: result.count,
    freeItems,
    searchUrl: `https://dp.la/search?q=${encodedQuery}`,
  };
}

/**
 * Check if DPLA API key is configured.
 * Useful for UI to show/hide DPLA availability section.
 */
export function isDPLAConfigured(): boolean {
  return getDPLAKey() !== null;
}
