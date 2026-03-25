/**
 * instagram.ts — Instagram Graph API enrichment for author profiles
 *
 * Uses the Instagram Graph API to fetch public profile metrics.
 * Requires INSTAGRAM_ACCESS_TOKEN environment variable.
 *
 * Rate limits: 200 calls/hour per user token
 *
 * If the token is not set, all functions gracefully return null.
 */

export interface InstagramStats {
  username: string;
  followerCount: number;
  followingCount: number;
  mediaCount: number;
  profileUrl: string;
  fetchedAt: string;
}

/**
 * Extract an Instagram username from a URL or handle string.
 */
export function extractInstagramUsername(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Full URL: https://instagram.com/username or https://www.instagram.com/username
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})(?:\/.*)?$/i
  );
  if (urlMatch) return urlMatch[1];

  // Bare handle: @username or username
  const handleMatch = trimmed.match(/^@?([A-Za-z0-9_.]{1,30})$/);
  if (handleMatch) return handleMatch[1];

  return null;
}

/**
 * Fetch Instagram public metrics for an author.
 *
 * @param instagramUrlOrHandle - Full URL or bare handle
 * @param accessToken - Instagram Graph API access token
 * @returns InstagramStats or null if not found / token missing
 */
export async function fetchInstagramStats(
  instagramUrlOrHandle: string,
  accessToken: string
): Promise<InstagramStats | null> {
  if (!accessToken) {
    console.warn("[Instagram] INSTAGRAM_ACCESS_TOKEN not set — skipping");
    return null;
  }

  const username = extractInstagramUsername(instagramUrlOrHandle);
  if (!username) {
    console.warn(`[Instagram] Cannot extract username from: ${instagramUrlOrHandle}`);
    return null;
  }

  try {
    // Instagram Graph API: search for business/creator account by username
    const searchUrl = `https://graph.facebook.com/v18.0/ig_hashtag_search?q=${encodeURIComponent(username)}&access_token=${accessToken}`;
    
    // For business accounts, use the Instagram Business Discovery API
    const discoveryUrl = `https://graph.facebook.com/v18.0/me?fields=business_discovery.fields(username,followers_count,follows_count,media_count).username(${username})&access_token=${accessToken}`;

    const response = await fetch(discoveryUrl);
    
    if (response.status === 400 || response.status === 403) {
      // Account may not be a business account or token lacks permissions
      console.warn(`[Instagram] Cannot access @${username} — may not be a business account`);
      return null;
    }

    if (!response.ok) {
      console.warn(`[Instagram] API error ${response.status} for @${username}`);
      return null;
    }

    const data = (await response.json()) as {
      business_discovery?: {
        username?: string;
        followers_count?: number;
        follows_count?: number;
        media_count?: number;
      };
    };

    const discovery = data.business_discovery;
    if (!discovery) return null;

    return {
      username: discovery.username || username,
      followerCount: discovery.followers_count ?? 0,
      followingCount: discovery.follows_count ?? 0,
      mediaCount: discovery.media_count ?? 0,
      profileUrl: `https://instagram.com/${discovery.username || username}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Instagram] Error for @${username}:`, err);
    return null;
  }
}
