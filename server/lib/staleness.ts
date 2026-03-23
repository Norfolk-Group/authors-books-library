/**
 * Staleness / Freshness calculation module.
 *
 * Determines how "fresh" or "stale" an entity's enrichment data is
 * based on the various enrichment timestamps stored in the database.
 *
 * Freshness levels:
 * - "fresh"   → enriched within the last 7 days (green)
 * - "recent"  → enriched within the last 30 days (yellow/amber)
 * - "stale"   → enriched more than 30 days ago (red/orange)
 * - "never"   → never enriched (gray)
 */

export type FreshnessLevel = "fresh" | "recent" | "stale" | "never";

/** Thresholds in milliseconds */
const FRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const RECENT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

/**
 * Given a timestamp (Date, string, or null), return the freshness level.
 */
export function getFreshnessLevel(enrichedAt: Date | string | null | undefined): FreshnessLevel {
  if (!enrichedAt) return "never";

  const ts = typeof enrichedAt === "string" ? new Date(enrichedAt).getTime() : enrichedAt.getTime();
  if (isNaN(ts)) return "never";

  const ageMs = Date.now() - ts;

  if (ageMs <= FRESH_THRESHOLD_MS) return "fresh";
  if (ageMs <= RECENT_THRESHOLD_MS) return "recent";
  return "stale";
}

/**
 * Given a timestamp, return a human-readable age string.
 * e.g. "2 days ago", "3 weeks ago", "2 months ago", "never"
 */
export function getAgeLabel(enrichedAt: Date | string | null | undefined): string {
  if (!enrichedAt) return "never";

  const ts = typeof enrichedAt === "string" ? new Date(enrichedAt).getTime() : enrichedAt.getTime();
  if (isNaN(ts)) return "never";

  const ageMs = Date.now() - ts;
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return "1 week ago";
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

/**
 * Author enrichment dimensions — each has its own timestamp.
 * The overall freshness is the WORST (oldest) of all dimensions.
 */
export interface AuthorEnrichmentTimestamps {
  /** Core bio/metadata enrichment */
  enrichedAt?: Date | string | null;
  /** Social stats (YouTube, Twitter, etc.) */
  socialStatsEnrichedAt?: Date | string | null;
  /** Platform links (website, podcast, etc.) */
  lastLinksEnrichedAt?: Date | string | null;
  /** Avatar description research */
  authorDescriptionCachedAt?: Date | string | null;
  /** Rich bio (double-pass LLM) — stored inside richBioJson.enrichedAt */
  richBioEnrichedAt?: Date | string | null;
}

/**
 * Book enrichment dimensions — each has its own timestamp.
 */
export interface BookEnrichmentTimestamps {
  /** Core metadata enrichment (Google Books) */
  enrichedAt?: Date | string | null;
  /** Summary enrichment (LLM) */
  lastSummaryEnrichedAt?: Date | string | null;
  /** Rich summary (double-pass LLM) — stored inside richSummaryJson.enrichedAt */
  richSummaryEnrichedAt?: Date | string | null;
}

/**
 * Compute the overall freshness for an author.
 * Returns the worst (stalest) freshness across all dimensions.
 */
export function getAuthorFreshness(timestamps: AuthorEnrichmentTimestamps): {
  overall: FreshnessLevel;
  dimensions: Record<string, { level: FreshnessLevel; age: string }>;
} {
  const dims: Record<string, { level: FreshnessLevel; age: string }> = {
    bio: {
      level: getFreshnessLevel(timestamps.enrichedAt),
      age: getAgeLabel(timestamps.enrichedAt),
    },
    socialStats: {
      level: getFreshnessLevel(timestamps.socialStatsEnrichedAt),
      age: getAgeLabel(timestamps.socialStatsEnrichedAt),
    },
    links: {
      level: getFreshnessLevel(timestamps.lastLinksEnrichedAt),
      age: getAgeLabel(timestamps.lastLinksEnrichedAt),
    },
    avatar: {
      level: getFreshnessLevel(timestamps.authorDescriptionCachedAt),
      age: getAgeLabel(timestamps.authorDescriptionCachedAt),
    },
    richBio: {
      level: getFreshnessLevel(timestamps.richBioEnrichedAt),
      age: getAgeLabel(timestamps.richBioEnrichedAt),
    },
  };

  // Overall = worst level
  const levels: FreshnessLevel[] = Object.values(dims).map((d) => d.level);
  const priority: FreshnessLevel[] = ["never", "stale", "recent", "fresh"];
  let overall: FreshnessLevel = "fresh";
  for (const l of levels) {
    if (priority.indexOf(l) < priority.indexOf(overall)) {
      overall = l;
    }
  }

  return { overall, dimensions: dims };
}

/**
 * Compute the overall freshness for a book.
 */
export function getBookFreshness(timestamps: BookEnrichmentTimestamps): {
  overall: FreshnessLevel;
  dimensions: Record<string, { level: FreshnessLevel; age: string }>;
} {
  const dims: Record<string, { level: FreshnessLevel; age: string }> = {
    metadata: {
      level: getFreshnessLevel(timestamps.enrichedAt),
      age: getAgeLabel(timestamps.enrichedAt),
    },
    summary: {
      level: getFreshnessLevel(timestamps.lastSummaryEnrichedAt),
      age: getAgeLabel(timestamps.lastSummaryEnrichedAt),
    },
    richSummary: {
      level: getFreshnessLevel(timestamps.richSummaryEnrichedAt),
      age: getAgeLabel(timestamps.richSummaryEnrichedAt),
    },
  };

  const levels: FreshnessLevel[] = Object.values(dims).map((d) => d.level);
  const priority: FreshnessLevel[] = ["never", "stale", "recent", "fresh"];
  let overall: FreshnessLevel = "fresh";
  for (const l of levels) {
    if (priority.indexOf(l) < priority.indexOf(overall)) {
      overall = l;
    }
  }

  return { overall, dimensions: dims };
}
