/**
 * Shared HTTP client helpers for server-side fetch calls.
 *
 * Consolidates common patterns: browser-like headers, timeout handling,
 * JSON parsing with typed responses, and error normalisation.
 */

/** Default browser-like headers to avoid bot-blocking */
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (compatible; NCGLibrary/1.0; +https://ncg.com)",
  Accept: "application/json, text/plain, */*",
};

/** Default fetch timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchOptions {
  /** Request timeout in ms. Default: 15 000 */
  timeoutMs?: number;
  /** Additional headers to merge with defaults */
  headers?: Record<string, string>;
  /** If true, skip the default browser-like User-Agent header */
  noDefaultHeaders?: boolean;
}

/**
 * Fetch a URL and return the response as parsed JSON.
 * Throws on non-2xx status or network/timeout errors.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, noDefaultHeaders = false } = options;

  const mergedHeaders = noDefaultHeaders
    ? headers
    : { ...DEFAULT_HEADERS, ...headers };

  const response = await fetch(url, {
    headers: mergedHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} from ${url}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch a URL and return the response as a Buffer (for binary content like images).
 * Throws on non-2xx status or network/timeout errors.
 */
export async function fetchBuffer(
  url: string,
  options: FetchOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, noDefaultHeaders = false } = options;

  const mergedHeaders = noDefaultHeaders
    ? headers
    : {
        ...DEFAULT_HEADERS,
        Accept: "image/webp,image/avif,image/jpeg,image/*,*/*;q=0.8",
        ...headers,
      };

  const response = await fetch(url, {
    headers: mergedHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} fetching image from ${url}`
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error(`Empty response body from ${url}`);
  }

  return { buffer, contentType };
}

/**
 * Normalise an error value to a human-readable string.
 * Useful for logging catch blocks.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
