/**
 * socialStats.ts — Main orchestrator for all social stats enrichment
 *
 * Coordinates all platform helpers and persists results to the
 * socialStatsJson column in author_profiles.
 *
 * Platforms covered:
 *   Phase A (no new keys): GitHub, Wikipedia, Substack, YouTube, CNN, Y Combinator
 *   Phase A+ (TWITTER_BEARER_TOKEN): Twitter/X follower count
 *   Phase B (RAPIDAPI_KEY): Yahoo Finance, CNBC, LinkedIn, Seeking Alpha
 */

import { fetchGitHubStats } from "./github";
import { fetchWikipediaStats } from "./wikipedia";
import { fetchSubstackStats } from "./substack";
import { fetchYCStats } from "./ycombinator";
import { fetchCNNStats } from "./cnn";
import { fetchTwitterStats } from "./twitter";
import {
  fetchYahooFinanceStats,
  fetchCNBCStats,
  fetchLinkedInStats,
  fetchSeekingAlphaStats,
} from "./rapidapi";

export interface SocialStatsResult {
  github?: Awaited<ReturnType<typeof fetchGitHubStats>>;
  wikipedia?: Awaited<ReturnType<typeof fetchWikipediaStats>>;
  substack?: Awaited<ReturnType<typeof fetchSubstackStats>>;
  ycombinator?: Awaited<ReturnType<typeof fetchYCStats>>;
  cnn?: Awaited<ReturnType<typeof fetchCNNStats>>;
  twitter?: Awaited<ReturnType<typeof fetchTwitterStats>>;
  yahooFinance?: Awaited<ReturnType<typeof fetchYahooFinanceStats>>;
  cnbc?: Awaited<ReturnType<typeof fetchCNBCStats>>;
  linkedin?: Awaited<ReturnType<typeof fetchLinkedInStats>>;
  seekingAlpha?: Awaited<ReturnType<typeof fetchSeekingAlphaStats>>;
  enrichedAt: string;
  platformsAttempted: string[];
  platformsSucceeded: string[];
}

export interface AuthorEnrichmentInput {
  authorName: string;
  githubUrl?: string | null;
  substackUrl?: string | null;
  linkedinUrl?: string | null;
  wikipediaUrl?: string | null;
  stockTicker?: string | null;
  twitterUrl?: string | null;
}

export interface EnrichmentConfig {
  youtubeApiKey?: string;
  apifyApiToken?: string;
  rapidApiKey?: string;
  twitterBearerToken?: string;
  phases?: ("A" | "B")[];
}

/**
 * Enrich social stats for a single author across all configured platforms.
 */
export async function enrichAuthorSocialStats(
  author: AuthorEnrichmentInput,
  config: EnrichmentConfig
): Promise<SocialStatsResult> {
  const phases = config.phases || ["A", "B"];
  const runPhaseA = phases.includes("A");
  const runPhaseB = phases.includes("B");

  const attempted: string[] = [];
  const succeeded: string[] = [];
  const result: Partial<SocialStatsResult> = {};

  // Helper to run a platform fetch and track success
  async function run<T>(
    platform: string,
    fn: () => Promise<T | null>
  ): Promise<T | null> {
    attempted.push(platform);
    try {
      const data = await fn();
      if (data !== null) succeeded.push(platform);
      return data;
    } catch (err) {
      console.error(`[SocialStats] ${platform} failed for ${author.authorName}:`, err);
      return null;
    }
  }

  // ── Phase A ────────────────────────────────────────────────────────────────

  if (runPhaseA) {
    // GitHub — free, no key needed
    if (author.githubUrl) {
      result.github = await run("github", () =>
        fetchGitHubStats(author.githubUrl!)
      );
    }

    // Wikipedia — free, no key needed
    result.wikipedia = await run("wikipedia", () =>
      fetchWikipediaStats(author.authorName, author.wikipediaUrl)
    );

    // Substack — free, no key needed
    if (author.substackUrl) {
      // Extract LinkedIn handle from LinkedIn URL for subscriber data
      const linkedinHandle = author.linkedinUrl
        ? (author.linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] || null)
        : null;
      result.substack = await run("substack", () =>
        fetchSubstackStats(author.substackUrl!, linkedinHandle)
      );
    }

    // Y Combinator — free, no key needed
    result.ycombinator = await run("ycombinator", () =>
      fetchYCStats(author.authorName)
    );

    // CNN — requires APIFY_API_TOKEN (already set)
    if (config.apifyApiToken) {
      result.cnn = await run("cnn", () =>
        fetchCNNStats(author.authorName, config.apifyApiToken!)
      );
    }

    // Twitter/X — requires TWITTER_BEARER_TOKEN
    if (config.twitterBearerToken && author.twitterUrl) {
      result.twitter = await run("twitter", () =>
        fetchTwitterStats(author.twitterUrl!, config.twitterBearerToken!)
      );
    }
  }

  // ── Phase B ────────────────────────────────────────────────────────────────

  if (runPhaseB && config.rapidApiKey) {
    // Yahoo Finance — requires RAPIDAPI_KEY
    if (author.stockTicker) {
      result.yahooFinance = await run("yahooFinance", () =>
        fetchYahooFinanceStats(author.stockTicker!, config.rapidApiKey!)
      );
    }

    // CNBC — requires RAPIDAPI_KEY
    result.cnbc = await run("cnbc", () =>
      fetchCNBCStats(author.authorName, config.rapidApiKey!)
    );

    // LinkedIn — requires RAPIDAPI_KEY
    if (author.linkedinUrl) {
      result.linkedin = await run("linkedin", () =>
        fetchLinkedInStats(author.linkedinUrl!, config.rapidApiKey!)
      );
    }

    // Seeking Alpha (Bloomberg proxy) — requires RAPIDAPI_KEY
    result.seekingAlpha = await run("seekingAlpha", () =>
      fetchSeekingAlphaStats(author.authorName, config.rapidApiKey!)
    );
  }

  return {
    ...result,
    enrichedAt: new Date().toISOString(),
    platformsAttempted: attempted,
    platformsSucceeded: succeeded,
  };
}
