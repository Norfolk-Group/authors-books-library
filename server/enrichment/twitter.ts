/**
 * twitter.ts — Twitter/X API v2 enrichment for author profiles
 *
 * Uses the Twitter API v2 Bearer Token (app-only auth) to:
 *   1. Resolve a Twitter/X username → userId via /2/users/by/username/:username
 *   2. Fetch public metrics (followers_count, following_count, tweet_count, listed_count)
 *   3. Return structured TwitterStats for persistence in socialStatsJson
 *
 * Rate limits (app-only, free tier):
 *   - GET /2/users/by/username/:username: 15 req/15min per app
 *   - GET /2/users/:id: 15 req/15min per app
 *   → Batch carefully; add 1-2s delay between authors in bulk runs.
 *
 * Username extraction:
 *   Accepts either a full URL (https://twitter.com/username or https://x.com/username)
 *   or a bare handle (@username or username).
 */

const TWITTER_API_BASE = "https://api.twitter.com/2";

export interface TwitterStats {
  userId: string;
  username: string;
  name: string;
  followerCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  verified: boolean;
  profileUrl: string;
  fetchedAt: string;
}

interface TwitterUserResponse {
  data?: {
    id: string;
    name: string;
    username: string;
    public_metrics?: {
      followers_count: number;
      following_count: number;
      tweet_count: number;
      listed_count: number;
    };
    verified?: boolean;
  };
  errors?: Array<{ title: string; detail: string }>;
}

/**
 * Extract a clean Twitter/X username from a URL or handle string.
 * Returns null if the input cannot be parsed.
 */
export function extractTwitterUsername(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Full URL: https://twitter.com/username or https://x.com/username
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})(?:\/.*)?$/i
  );
  if (urlMatch) return urlMatch[1];

  // Bare handle: @username or username
  const handleMatch = trimmed.match(/^@?([A-Za-z0-9_]{1,15})$/);
  if (handleMatch) return handleMatch[1];

  return null;
}

/**
 * Fetch Twitter/X public metrics for an author by their Twitter URL or handle.
 *
 * @param twitterUrlOrHandle - Full URL (https://twitter.com/user) or bare handle (@user / user)
 * @param bearerToken - Twitter API v2 Bearer Token
 * @returns TwitterStats or null if not found / rate-limited
 */
export async function fetchTwitterStats(
  twitterUrlOrHandle: string,
  bearerToken: string
): Promise<TwitterStats | null> {
  if (!bearerToken) {
    console.warn("[Twitter] TWITTER_BEARER_TOKEN not set — skipping");
    return null;
  }

  const username = extractTwitterUsername(twitterUrlOrHandle);
  if (!username) {
    console.warn(`[Twitter] Cannot extract username from: ${twitterUrlOrHandle}`);
    return null;
  }

  const url = new URL(`${TWITTER_API_BASE}/users/by/username/${username}`);
  url.searchParams.set(
    "user.fields",
    "public_metrics,verified,name,username"
  );

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "User-Agent": "NCGLibraryBot/1.0",
      },
    });
  } catch (err) {
    console.error(`[Twitter] Network error for @${username}:`, err);
    return null;
  }

  if (response.status === 429) {
    console.warn(`[Twitter] Rate limited for @${username} — retry later`);
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `[Twitter] HTTP ${response.status} for @${username}: ${body.slice(0, 200)}`
    );
    return null;
  }

  let json: TwitterUserResponse;
  try {
    json = (await response.json()) as TwitterUserResponse;
  } catch {
    console.error(`[Twitter] JSON parse error for @${username}`);
    return null;
  }

  if (json.errors?.length || !json.data) {
    const errMsg = json.errors?.[0]?.detail ?? "No data returned";
    console.warn(`[Twitter] API error for @${username}: ${errMsg}`);
    return null;
  }

  const user = json.data;
  const metrics = user.public_metrics;

  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    followerCount: metrics?.followers_count ?? 0,
    followingCount: metrics?.following_count ?? 0,
    tweetCount: metrics?.tweet_count ?? 0,
    listedCount: metrics?.listed_count ?? 0,
    verified: user.verified ?? false,
    profileUrl: `https://x.com/${user.username}`,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Attempt to find a Twitter username for an author by searching their name.
 * Uses the Twitter v2 search endpoint — costs 1 unit per call.
 * Returns null if no confident match found.
 */
export async function searchTwitterUsername(
  authorName: string,
  bearerToken: string
): Promise<string | null> {
  if (!bearerToken) return null;

  // Build a search query: exact name + common author signals
  const query = encodeURIComponent(`"${authorName}" (author OR speaker OR writer) -is:retweet`);
  const url = `${TWITTER_API_BASE}/tweets/search/recent?query=${query}&max_results=10&tweet.fields=author_id&expansions=author_id&user.fields=username,public_metrics,verified`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "User-Agent": "NCGLibraryBot/1.0",
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  interface SearchResponse {
    includes?: {
      users?: Array<{
        username: string;
        public_metrics?: { followers_count: number };
        verified?: boolean;
      }>;
    };
  }

  const json = (await response.json().catch(() => null)) as SearchResponse | null;
  if (!json?.includes?.users?.length) return null;

  // Pick the user with the most followers as the most likely match
  const sorted = json.includes.users.sort(
    (a, b) =>
      (b.public_metrics?.followers_count ?? 0) -
      (a.public_metrics?.followers_count ?? 0)
  );

  return sorted[0]?.username ?? null;
}
