/**
 * tiktok.ts — TikTok Research API enrichment for author profiles
 *
 * Uses the TikTok Research API to fetch public profile metrics.
 * Requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET environment variables.
 *
 * Rate limits: Varies by endpoint (typically 1000 req/day for research tier)
 *
 * If the credentials are not set, all functions gracefully return null.
 */

export interface TikTokStats {
  username: string;
  followerCount: number;
  followingCount: number;
  likeCount: number;
  videoCount: number;
  profileUrl: string;
  fetchedAt: string;
}

/**
 * Extract a TikTok username from a URL or handle string.
 */
export function extractTikTokUsername(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Full URL: https://tiktok.com/@username
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{1,24})(?:\/.*)?$/i
  );
  if (urlMatch) return urlMatch[1];

  // Bare handle: @username or username
  const handleMatch = trimmed.match(/^@?([A-Za-z0-9_.]{1,24})$/);
  if (handleMatch) return handleMatch[1];

  return null;
}

/**
 * Fetch TikTok public metrics for an author.
 *
 * @param tiktokUrlOrHandle - Full URL or bare handle
 * @param clientKey - TikTok API client key
 * @param clientSecret - TikTok API client secret (optional, for OAuth flow)
 * @returns TikTokStats or null if not found / credentials missing
 */
export async function fetchTikTokStats(
  tiktokUrlOrHandle: string,
  clientKey: string,
  clientSecret?: string
): Promise<TikTokStats | null> {
  if (!clientKey) {
    console.warn("[TikTok] TIKTOK_CLIENT_KEY not set — skipping");
    return null;
  }

  const username = extractTikTokUsername(tiktokUrlOrHandle);
  if (!username) {
    console.warn(`[TikTok] Cannot extract username from: ${tiktokUrlOrHandle}`);
    return null;
  }

  try {
    // Step 1: Get access token via client credentials
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret || "",
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      console.warn(`[TikTok] Token request failed: ${tokenRes.status}`);
      return null;
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      console.warn(`[TikTok] No access token returned: ${tokenData.error}`);
      return null;
    }

    // Step 2: Query user info via Research API
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/research/user/info/?fields=display_name,follower_count,following_count,likes_count,video_count",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      }
    );

    if (!userRes.ok) {
      console.warn(`[TikTok] User info request failed: ${userRes.status}`);
      return null;
    }

    const userData = (await userRes.json()) as {
      data?: {
        display_name?: string;
        follower_count?: number;
        following_count?: number;
        likes_count?: number;
        video_count?: number;
      };
      error?: { code?: string; message?: string };
    };

    if (userData.error?.code || !userData.data) {
      console.warn(`[TikTok] API error for @${username}: ${userData.error?.message}`);
      return null;
    }

    const user = userData.data;
    return {
      username,
      followerCount: user.follower_count ?? 0,
      followingCount: user.following_count ?? 0,
      likeCount: user.likes_count ?? 0,
      videoCount: user.video_count ?? 0,
      profileUrl: `https://tiktok.com/@${username}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[TikTok] Error for @${username}:`, err);
    return null;
  }
}
