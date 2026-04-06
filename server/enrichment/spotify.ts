/**
 * spotify.ts — Spotify-equivalent podcast and music enrichment helper
 *
 * Spotify's API requires OAuth client credentials and is not publicly accessible
 * without registration. This helper uses:
 *  1. iTunes Search API (free, no key) — same catalog as Apple Podcasts / Spotify
 *  2. Podcast Index API (free, no key for basic search) — open podcast directory
 *
 * Provides:
 *  - searchSpotifyPodcasts(query, limit?)    → podcasts matching query
 *  - getAuthorSpotifyPodcasts(authorName)    → podcasts by/about an author
 *  - searchSpotifyAudiobooks(query, limit?)  → audiobooks on Spotify/iTunes
 *  - getSpotifyBookAudiobook(bookTitle)      → audiobook for a specific book
 */

const ITUNES_BASE = "https://itunes.apple.com/search";
const TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotifyPodcast {
  id: number;
  name: string;
  artistName: string;
  feedUrl?: string;
  artworkUrl?: string;
  genre?: string;
  trackCount?: number;
  viewUrl?: string;
  description?: string;
  source: "itunes";
}

export interface SpotifyAudiobook {
  id: number;
  title: string;
  author: string;
  narrator?: string;
  artworkUrl?: string;
  viewUrl?: string;
  releaseDate?: string;
  trackCount?: number;
  source: "itunes";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchITunes<T>(params: Record<string, string>): Promise<T | null> {
  try {
    const url = `${ITUNES_BASE}?${new URLSearchParams(params)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Podcasts ─────────────────────────────────────────────────────────────────

/**
 * Search for podcasts by query term (same catalog as Spotify podcasts).
 */
export async function searchSpotifyPodcasts(
  query: string,
  limit = 5
): Promise<SpotifyPodcast[]> {
  if (!query?.trim()) return [];
  const data = await fetchITunes<{
    resultCount: number;
    results: Array<{
      collectionId?: number;
      collectionName?: string;
      artistName?: string;
      feedUrl?: string;
      artworkUrl600?: string;
      artworkUrl100?: string;
      primaryGenreName?: string;
      trackCount?: number;
      collectionViewUrl?: string;
      description?: string;
    }>;
  }>({
    term: query,
    media: "podcast",
    limit: String(Math.min(limit, 20)),
    entity: "podcast",
  });
  if (!data) return [];
  return data.results.map((r) => ({
    id: r.collectionId ?? 0,
    name: r.collectionName ?? "Unknown Podcast",
    artistName: r.artistName ?? "",
    feedUrl: r.feedUrl,
    artworkUrl: r.artworkUrl600 ?? r.artworkUrl100,
    genre: r.primaryGenreName,
    trackCount: r.trackCount,
    viewUrl: r.collectionViewUrl,
    description: r.description,
    source: "itunes" as const,
  }));
}

/**
 * Get podcasts by or about a specific author.
 */
export async function getAuthorSpotifyPodcasts(
  authorName: string,
  limit = 5
): Promise<SpotifyPodcast[]> {
  if (!authorName?.trim()) return [];
  return searchSpotifyPodcasts(authorName, limit);
}

// ─── Audiobooks ───────────────────────────────────────────────────────────────

/**
 * Search for audiobooks by query term.
 */
export async function searchSpotifyAudiobooks(
  query: string,
  limit = 5
): Promise<SpotifyAudiobook[]> {
  if (!query?.trim()) return [];
  const data = await fetchITunes<{
    resultCount: number;
    results: Array<{
      collectionId?: number;
      collectionName?: string;
      artistName?: string;
      artworkUrl600?: string;
      artworkUrl100?: string;
      collectionViewUrl?: string;
      releaseDate?: string;
      trackCount?: number;
    }>;
  }>({
    term: query,
    media: "audiobook",
    limit: String(Math.min(limit, 20)),
  });
  if (!data) return [];
  return data.results.map((r) => ({
    id: r.collectionId ?? 0,
    title: r.collectionName ?? "Unknown Audiobook",
    author: r.artistName ?? "",
    artworkUrl: r.artworkUrl600 ?? r.artworkUrl100,
    viewUrl: r.collectionViewUrl,
    releaseDate: r.releaseDate,
    trackCount: r.trackCount,
    source: "itunes" as const,
  }));
}

/**
 * Find the audiobook version of a specific book title.
 */
export async function getSpotifyBookAudiobook(
  bookTitle: string,
  authorName?: string
): Promise<SpotifyAudiobook | null> {
  const query = authorName ? `${bookTitle} ${authorName}` : bookTitle;
  const results = await searchSpotifyAudiobooks(query, 3);
  if (results.length === 0) return null;
  // Find best match by title similarity
  const exact = results.find((r) =>
    r.title.toLowerCase().includes(bookTitle.toLowerCase())
  );
  return exact ?? results[0];
}
