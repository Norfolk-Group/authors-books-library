/**
 * facebook.ts — Facebook Graph API enrichment for author profiles
 *
 * Uses the Facebook Graph API to fetch public page metrics.
 * Requires FACEBOOK_ACCESS_TOKEN environment variable.
 *
 * Rate limits: 200 calls/hour per user token
 *
 * If the token is not set, all functions gracefully return null.
 */

export interface FacebookStats {
  pageName: string;
  fanCount: number;
  followerCount: number;
  pageUrl: string;
  category: string | null;
  fetchedAt: string;
}

/**
 * Extract a Facebook page name/ID from a URL.
 */
export function extractFacebookPageId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Full URL: https://facebook.com/pagename or https://www.facebook.com/pagename
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9._-]+)(?:\/.*)?$/i
  );
  if (urlMatch) return urlMatch[1];

  // Bare page name
  if (/^[A-Za-z0-9._-]+$/.test(trimmed)) return trimmed;

  return null;
}

/**
 * Fetch Facebook page public metrics for an author.
 *
 * @param facebookUrlOrPageId - Full URL or page name/ID
 * @param accessToken - Facebook Graph API access token
 * @returns FacebookStats or null if not found / token missing
 */
export async function fetchFacebookStats(
  facebookUrlOrPageId: string,
  accessToken: string
): Promise<FacebookStats | null> {
  if (!accessToken) {
    console.warn("[Facebook] FACEBOOK_ACCESS_TOKEN not set — skipping");
    return null;
  }

  const pageId = extractFacebookPageId(facebookUrlOrPageId);
  if (!pageId) {
    console.warn(`[Facebook] Cannot extract page ID from: ${facebookUrlOrPageId}`);
    return null;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${pageId}?fields=name,fan_count,followers_count,category,link&access_token=${accessToken}`;
    const response = await fetch(url);

    if (response.status === 400 || response.status === 403) {
      console.warn(`[Facebook] Cannot access page ${pageId} — may require page token`);
      return null;
    }

    if (!response.ok) {
      console.warn(`[Facebook] API error ${response.status} for ${pageId}`);
      return null;
    }

    const data = (await response.json()) as {
      name?: string;
      fan_count?: number;
      followers_count?: number;
      category?: string;
      link?: string;
      error?: { message: string };
    };

    if (data.error) {
      console.warn(`[Facebook] API error for ${pageId}: ${data.error.message}`);
      return null;
    }

    return {
      pageName: data.name || pageId,
      fanCount: data.fan_count ?? 0,
      followerCount: data.followers_count ?? 0,
      pageUrl: data.link || `https://facebook.com/${pageId}`,
      category: data.category || null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Facebook] Error for ${pageId}:`, err);
    return null;
  }
}
