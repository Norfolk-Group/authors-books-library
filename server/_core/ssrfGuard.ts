/**
 * SSRF protection: validate URLs before making outbound HTTP requests.
 * Blocks requests to private IP ranges, loopback, and link-local addresses.
 */

import { URL } from "url";

const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // loopback
  /^10\./,                           // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,     // RFC 1918
  /^192\.168\./,                     // RFC 1918
  /^169\.254\./,                     // link-local (AWS metadata)
  /^::1$/,                           // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^0\./,                            // this network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // RFC 6598 shared address
];

/** Allowed URL schemes for external fetches */
const ALLOWED_SCHEMES = ["https:", "http:"];

/**
 * Validates a URL is safe to fetch (not pointing to internal infrastructure).
 * Throws an error if the URL is blocked.
 */
export function assertSafeUrl(rawUrl: string, context = "fetch"): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`[SSRF Guard] Invalid URL in ${context}: ${rawUrl}`);
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new Error(`[SSRF Guard] Blocked scheme "${parsed.protocol}" in ${context}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block numeric IPv4 addresses matching private ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`[SSRF Guard] Blocked private/internal host "${hostname}" in ${context}`);
    }
  }

  // Block bare "localhost" and similar
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::]") {
    throw new Error(`[SSRF Guard] Blocked loopback host "${hostname}" in ${context}`);
  }

  return parsed;
}

/**
 * Safe fetch wrapper that validates the URL before making the request.
 */
export async function safeFetch(url: string, init?: RequestInit, context = "fetch"): Promise<Response> {
  assertSafeUrl(url, context);
  return fetch(url, init);
}
