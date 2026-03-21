/**
 * mirrorToS3 - Image Mirror Service
 *
 * Fetches an external image URL (e.g. Amazon cover, Wikipedia photo) and
 * uploads it to Manus S3, returning a stable CDN URL.
 *
 * Why: Third-party image hosts (Amazon, Wikipedia, publisher CDNs) can:
 *   - Block hotlinking from our domain
 *   - Change or delete URLs without notice
 *   - Go offline or rate-limit requests
 *
 * This service creates a permanent copy under our control.
 *
 * Usage:
 *   const { url, key } = await mirrorImageToS3(externalUrl, "book-covers/hidden-potential.jpg");
 */

import { storagePut, storageGet } from "./storage";
import { fetchBuffer } from "./lib/httpClient";

/** Supported image MIME types and their file extensions */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Infer MIME type from URL path extension */
function inferMimeFromUrl(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg"; // default for most book covers and author photos
}

/** Generate a deterministic S3 key from a prefix and a source URL */
function makeS3Key(prefix: string, sourceUrl: string): string {
  // Use a hash of the source URL to avoid collisions and keep keys short
  let hash = 0;
  for (let i = 0; i < sourceUrl.length; i++) {
    const char = sourceUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, "0");
  const mimeType = inferMimeFromUrl(sourceUrl);
  const ext = MIME_TO_EXT[mimeType] ?? "jpg";
  return `${prefix}/${hashHex}.${ext}`;
}

export interface MirrorResult {
  /** Stable Manus CDN URL */
  url: string;
  /** S3 key (for deduplication/cleanup) */
  key: string;
  /** Whether this was a fresh upload (true) or skipped because key already existed */
  uploaded: boolean;
}

/**
 * Fetch an external image URL and upload it to Manus S3.
 *
 * @param sourceUrl - The external image URL to mirror
 * @param s3Prefix  - S3 key prefix, e.g. "book-covers" or "author-photos"
 * @param existingKey - If provided and matches the computed key, skip re-upload
 * @returns MirrorResult with stable CDN url, key, and uploaded flag
 */
export async function mirrorImageToS3(
  sourceUrl: string,
  s3Prefix: string,
  existingKey?: string | null
): Promise<MirrorResult> {
  if (!sourceUrl || !sourceUrl.startsWith("http")) {
    throw new Error(`Invalid source URL: ${sourceUrl}`);
  }

  const key = makeS3Key(s3Prefix, sourceUrl);

  // Skip re-upload if the key is already stored — derive the CDN URL from the key
  if (existingKey && existingKey === key) {
    try {
      const { url } = await storageGet(key);
      console.log(`[Mirror] Skipping re-upload (key exists): ${key}`);
      return { url, key, uploaded: false };
    } catch {
      // storageGet failed (key may not exist yet) — fall through to re-upload
      console.warn(`[Mirror] storageGet failed for ${key}, re-uploading`);
    }
  }

  // Fetch the image from the external URL
  const { buffer, contentType: fetchedContentType } = await fetchBuffer(sourceUrl);
  const contentType = fetchedContentType !== "application/octet-stream"
    ? fetchedContentType
    : inferMimeFromUrl(sourceUrl);

  // Upload to S3
  const { url } = await storagePut(key, buffer, contentType);

  return { url, key, uploaded: true };
}

/**
 * Mirror a batch of images to S3, returning results for each.
 * Failures are caught per-item so one bad URL doesn't abort the batch.
 */
export async function mirrorBatchToS3(
  items: Array<{ id: number; sourceUrl: string; existingKey?: string | null }>,
  s3Prefix: string
): Promise<Array<{ id: number; url: string | null; key: string | null; error: string | null }>> {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const result = await mirrorImageToS3(item.sourceUrl, s3Prefix, item.existingKey);
      return { id: item.id, url: result.url, key: result.key, error: null };
    })
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      id: items[i].id,
      url: null,
      key: null,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}
