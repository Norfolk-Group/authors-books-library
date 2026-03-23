/**
 * youtube.ts — YouTube Data API v3 enrichment for author channels
 *
 * Pipeline sequence (N+1):
 *   N=0  Search YouTube for "{authorName} official channel" → get channelId
 *   N=1  Fetch channel statistics (subscriberCount, videoCount, viewCount)
 *   N=2  Fetch top video by viewCount (title, url, viewCount, publishedAt)
 *   N=3  Persist results to author_profiles.platformEnrichmentStatus JSON column
 *
 * Free tier: 10,000 units/day
 *   - search.list = 100 units
 *   - channels.list = 1 unit
 *   - playlistItems.list + videos.list = 3 units
 *   → ~50 full author enrichments per 10k quota
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeChannelData {
  channelId: string;
  channelUrl: string;
  channelTitle: string;
  subscriberCount: number;
  videoCount: number;
  totalViewCount: number;
  topVideo?: {
    title: string;
    url: string;
    viewCount: number;
    publishedAt: string;
  } | null;
  enrichedAt: string;
}

interface YouTubeSearchItem {
  id: { channelId?: string };
  snippet: { title: string; description: string; channelId?: string };
}

interface YouTubeChannelItem {
  id: string;
  snippet: { title: string };
  statistics: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: { uploads?: string };
  };
}

interface YouTubeVideoItem {
  id: { videoId?: string } | string;
  snippet: { title: string; publishedAt: string };
  statistics?: { viewCount?: string };
}

/**
 * Search for an author's YouTube channel by name.
 * Returns the best-match channelId or null.
 */
async function searchAuthorChannel(
  authorName: string,
  apiKey: string
): Promise<string | null> {
  const query = encodeURIComponent(`${authorName} author`);
  const url = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${query}&maxResults=3&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube search failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { items?: YouTubeSearchItem[] };
  if (!data.items || data.items.length === 0) return null;

  // Pick the first result whose title closely matches the author name
  const nameLower = authorName.toLowerCase();
  const best = data.items.find((item) => {
    const title = item.snippet.title.toLowerCase();
    const parts = nameLower.split(" ");
    return parts.some((part) => part.length > 3 && title.includes(part));
  });

  const channelId =
    best?.id?.channelId ||
    best?.snippet?.channelId ||
    data.items[0]?.id?.channelId ||
    data.items[0]?.snippet?.channelId;

  return channelId ?? null;
}

/**
 * Fetch channel statistics and top video for a given channelId.
 */
async function fetchChannelData(
  channelId: string,
  apiKey: string
): Promise<Omit<YouTubeChannelData, "enrichedAt">> {
  // N=1: channel statistics
  const channelUrl = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`;
  const channelRes = await fetch(channelUrl);
  if (!channelRes.ok) throw new Error(`YouTube channels.list failed: ${channelRes.status}`);

  const channelData = (await channelRes.json()) as { items?: YouTubeChannelItem[] };
  const channel = channelData.items?.[0];
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const stats = channel.statistics;
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

  // N=2: top video by view count (fetch latest 10, sort by views)
  let topVideo: YouTubeChannelData["topVideo"] = null;
  if (uploadsPlaylistId) {
    try {
      const playlistUrl = `${YOUTUBE_API_BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`;
      const playlistRes = await fetch(playlistUrl);
      if (playlistRes.ok) {
        const playlistData = (await playlistRes.json()) as { items?: YouTubeVideoItem[] };
        const videoIds = (playlistData.items ?? [])
          .map((item) => {
            const id = item.id;
            return typeof id === "object" ? id.videoId : undefined;
          })
          .filter(Boolean)
          .join(",");

        if (videoIds) {
          const videosUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
          const videosRes = await fetch(videosUrl);
          if (videosRes.ok) {
            const videosData = (await videosRes.json()) as { items?: YouTubeVideoItem[] };
            const sorted = (videosData.items ?? []).sort(
              (a, b) =>
                parseInt(b.statistics?.viewCount ?? "0") -
                parseInt(a.statistics?.viewCount ?? "0")
            );
            const top = sorted[0];
            if (top) {
              const videoId = typeof top.id === "object" ? top.id.videoId : top.id;
              topVideo = {
                title: top.snippet.title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                viewCount: parseInt(top.statistics?.viewCount ?? "0"),
                publishedAt: top.snippet.publishedAt,
              };
            }
          }
        }
      }
    } catch {
      // top video is optional — don't fail the whole enrichment
    }
  }

  return {
    channelId,
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    channelTitle: channel.snippet.title,
    subscriberCount: parseInt(stats.subscriberCount ?? "0"),
    videoCount: parseInt(stats.videoCount ?? "0"),
    totalViewCount: parseInt(stats.viewCount ?? "0"),
    topVideo,
  };
}

/**
 * Full enrichment pipeline for a single author.
 * Returns YouTubeChannelData or null if no channel found.
 */
export async function enrichAuthorYouTube(
  authorName: string,
  apiKey: string
): Promise<YouTubeChannelData | null> {
  // N=0: search for channel
  const channelId = await searchAuthorChannel(authorName, apiKey);
  if (!channelId) return null;

  // N=1+2: fetch stats and top video
  const channelData = await fetchChannelData(channelId, apiKey);

  return {
    ...channelData,
    enrichedAt: new Date().toISOString(),
  };
}

/**
 * Validate that the YouTube API key works by fetching a known channel.
 */
export async function validateYouTubeApiKey(apiKey: string): Promise<boolean> {
  try {
    // Fetch YouTube's own channel as a lightweight validation
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet&id=UCWX3yGbODI3HLSKbGSABqSQ&key=${apiKey}`;
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}
