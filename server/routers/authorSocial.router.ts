import { z } from "zod";
import { eq, isNull, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { discoverAuthorPlatforms } from "../enrichment/platforms";
import { parallelBatch } from "../lib/parallelBatch";

// ── Social / Platform Sub-Router ───────────────────────────────────────────
export const authorSocialRouter = router({
  /** Returns a lightweight map of authorName -> platform links for all authors */
  getAllPlatformLinks: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        websiteUrl: authorProfiles.websiteUrl,
        twitterUrl: authorProfiles.twitterUrl,
        linkedinUrl: authorProfiles.linkedinUrl,
        substackUrl: authorProfiles.substackUrl,
        youtubeUrl: authorProfiles.youtubeUrl,
        facebookUrl: authorProfiles.facebookUrl,
        instagramUrl: authorProfiles.instagramUrl,
        tiktokUrl: authorProfiles.tiktokUrl,
        githubUrl: authorProfiles.githubUrl,
        businessWebsiteUrl: authorProfiles.businessWebsiteUrl,
        newsletterUrl: authorProfiles.newsletterUrl,
        speakingUrl: authorProfiles.speakingUrl,
        podcastUrl: authorProfiles.podcastUrl,
        blogUrl: authorProfiles.blogUrl,
        socialStatsJson: authorProfiles.socialStatsJson,
      })
      .from(authorProfiles);
    return rows.filter((r) =>
      r.websiteUrl || r.twitterUrl || r.linkedinUrl || r.substackUrl ||
      r.youtubeUrl || r.facebookUrl || r.instagramUrl || r.tiktokUrl ||
      r.githubUrl || r.businessWebsiteUrl || r.newsletterUrl ||
      r.speakingUrl || r.podcastUrl || r.blogUrl || r.socialStatsJson
    );
  }),

  /** Discover all platform presence links for a single author using Perplexity */
  discoverPlatforms: adminProcedure
    .input(z.object({
      authorName: z.string(),
      forceRefresh: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not configured");

      if (!input.forceRefresh) {
        const [existing] = await db
          .select({ platformEnrichmentStatus: authorProfiles.platformEnrichmentStatus })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.authorName))
          .limit(1);
        if (existing?.platformEnrichmentStatus) {
          try {
            const status = JSON.parse(existing.platformEnrichmentStatus) as { enrichedAt?: string };
            if (status.enrichedAt) {
              const age = Date.now() - new Date(status.enrichedAt).getTime();
              if (age < 7 * 24 * 60 * 60 * 1000) {
                return { skipped: true, reason: "Recently enriched", authorName: input.authorName, platformCount: 0, platforms: [], links: {} };
              }
            }
          } catch { /* parse error — proceed with enrichment */ }
        }
      }

      const result = await discoverAuthorPlatforms(input.authorName, perplexityKey);

      // Build the update set from discovered links
      const updateSet: Record<string, unknown> = {};
      const linkFields: Record<string, string> = {
        websiteUrl: "websiteUrl",
        twitterUrl: "twitterUrl",
        linkedinUrl: "linkedinUrl",
        substackUrl: "substackUrl",
        youtubeUrl: "youtubeUrl",
        facebookUrl: "facebookUrl",
        instagramUrl: "instagramUrl",
        tiktokUrl: "tiktokUrl",
        githubUrl: "githubUrl",
        businessWebsiteUrl: "businessWebsiteUrl",
        newsletterUrl: "newsletterUrl",
        speakingUrl: "speakingUrl",
        podcastUrl: "podcastUrl",
        blogUrl: "blogUrl",
      };
      for (const [key, col] of Object.entries(linkFields)) {
        const val = (result.links as Record<string, string | undefined>)[key];
        if (val) updateSet[col] = val;
      }
      // Count how many link fields were discovered
      const discoveredCount = Object.keys(updateSet).length;
      updateSet.platformEnrichmentStatus = JSON.stringify({
        enrichedAt: new Date().toISOString(),
        platformCount: discoveredCount,
      });

      if (Object.keys(updateSet).length > 0) {
        await db
          .update(authorProfiles)
          .set(updateSet)
          .where(eq(authorProfiles.authorName, input.authorName));
      }

      return {
        skipped: false,
        authorName: input.authorName,
        platformCount: discoveredCount,
        links: result.links,
      };
    }),

  /** Batch discover platforms for multiple authors */
  discoverPlatformsBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
      concurrency: z.number().min(1).max(5).optional().default(2),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not configured");

      const rows = input.onlyMissing
        ? await db
            .select({ authorName: authorProfiles.authorName })
            .from(authorProfiles)
            .where(isNull(authorProfiles.platformEnrichmentStatus))
            .limit(input.limit)
        : await db
            .select({ authorName: authorProfiles.authorName })
            .from(authorProfiles)
            .limit(input.limit);

      const batchResult = await parallelBatch(
        rows.map((r) => r.authorName),
        input.concurrency,
        async (authorName) => {
          const result = await discoverAuthorPlatforms(authorName, perplexityKey);
          const updateSet: Record<string, unknown> = {};
          const linkFields: Record<string, string> = {
            websiteUrl: "websiteUrl",
            twitterUrl: "twitterUrl",
            linkedinUrl: "linkedinUrl",
            substackUrl: "substackUrl",
            youtubeUrl: "youtubeUrl",
            facebookUrl: "facebookUrl",
            instagramUrl: "instagramUrl",
            tiktokUrl: "tiktokUrl",
            githubUrl: "githubUrl",
            businessWebsiteUrl: "businessWebsiteUrl",
            newsletterUrl: "newsletterUrl",
            speakingUrl: "speakingUrl",
            podcastUrl: "podcastUrl",
            blogUrl: "blogUrl",
          };
          for (const [key, col] of Object.entries(linkFields)) {
            const val = (result.links as Record<string, string | undefined>)[key];
            if (val) updateSet[col] = val;
          }
          const discoveredCount = Object.keys(updateSet).length;
          updateSet.platformEnrichmentStatus = JSON.stringify({
            enrichedAt: new Date().toISOString(),
            platformCount: discoveredCount,
          });
          await db
            .update(authorProfiles)
            .set(updateSet)
            .where(eq(authorProfiles.authorName, authorName));
          return { authorName, platformCount: discoveredCount };
        }
      );

      return {
        processed: batchResult.results.length,
        succeeded: batchResult.succeeded,
        failed: batchResult.failed,
      };
    }),

  /** Get social stats for all authors (or a single author) */
  getSocialStats: publicProcedure
    .input(z.object({ authorName: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          authorName: authorProfiles.authorName,
          socialStatsJson: authorProfiles.socialStatsJson,
          socialStatsEnrichedAt: authorProfiles.socialStatsEnrichedAt,
          githubUrl: authorProfiles.githubUrl,
          substackUrl: authorProfiles.substackUrl,
          linkedinUrl: authorProfiles.linkedinUrl,
          wikipediaUrl: authorProfiles.wikipediaUrl,
          stockTicker: authorProfiles.stockTicker,
        })
        .from(authorProfiles)
        .where(
          input.authorName
            ? eq(authorProfiles.authorName, input.authorName)
            : sql`1=1`
        );
      return rows.map((r) => ({
        ...r,
        socialStats: r.socialStatsJson ? JSON.parse(r.socialStatsJson) : null,
      }));
    }),

  /** Enrich social stats for a single author across all configured platforms */
  enrichSocialStats: adminProcedure
    .input(
      z.object({
        authorName: z.string(),
        phases: z.array(z.enum(["A", "B"])).optional().default(["A", "B"]),
      })
    )
    .mutation(async ({ input }) => {
      const { enrichAuthorSocialStats } = await import("../enrichment/socialStats");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!rows.length) throw new Error(`Author not found: ${input.authorName}`);
      const author = rows[0];

      const stats = await enrichAuthorSocialStats(
        {
          authorName: author.authorName,
          githubUrl: author.githubUrl,
          substackUrl: author.substackUrl,
          linkedinUrl: author.linkedinUrl,
          wikipediaUrl: author.wikipediaUrl,
          stockTicker: author.stockTicker,
          twitterUrl: author.twitterUrl,
        },
        {
          youtubeApiKey: ENV.youtubeApiKey,
          apifyApiToken: ENV.apifyApiToken,
          rapidApiKey: ENV.rapidApiKey,
          twitterBearerToken: ENV.twitterBearerToken,
          phases: input.phases as ("A" | "B")[],
        }
      );

      await db
        .update(authorProfiles)
        .set({
          socialStatsJson: JSON.stringify(stats),
          socialStatsEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        authorName: input.authorName,
        platformsAttempted: stats.platformsAttempted,
        platformsSucceeded: stats.platformsSucceeded,
        enrichedAt: stats.enrichedAt,
      };
    }),

  /** Batch enrich social stats for all authors */
  enrichSocialStatsBatch: adminProcedure
    .input(
      z.object({
        phases: z.array(z.enum(["A", "B"])).optional().default(["A", "B"]),
        limit: z.number().optional().default(50),
        onlyMissing: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const { enrichAuthorSocialStats } = await import("../enrichment/socialStats");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select({
          authorName: authorProfiles.authorName,
          githubUrl: authorProfiles.githubUrl,
          substackUrl: authorProfiles.substackUrl,
          linkedinUrl: authorProfiles.linkedinUrl,
          wikipediaUrl: authorProfiles.wikipediaUrl,
          stockTicker: authorProfiles.stockTicker,
          twitterUrl: authorProfiles.twitterUrl,
          socialStatsEnrichedAt: authorProfiles.socialStatsEnrichedAt,
        })
        .from(authorProfiles)
        .where(
          input.onlyMissing
            ? isNull(authorProfiles.socialStatsEnrichedAt)
            : sql`1=1`
        )
        .limit(input.limit);

      const results: Array<{
        authorName: string;
        platformsSucceeded: string[];
        error?: string;
      }> = [];

      for (const author of rows) {
        try {
          const stats = await enrichAuthorSocialStats(
            {
              authorName: author.authorName,
              githubUrl: author.githubUrl,
              substackUrl: author.substackUrl,
              linkedinUrl: author.linkedinUrl,
              wikipediaUrl: author.wikipediaUrl,
              stockTicker: author.stockTicker,
              twitterUrl: author.twitterUrl,
            },
            {
              youtubeApiKey: ENV.youtubeApiKey,
              apifyApiToken: ENV.apifyApiToken,
              rapidApiKey: ENV.rapidApiKey,
              twitterBearerToken: ENV.twitterBearerToken,
              phases: input.phases as ("A" | "B")[],
            }
          );

          await db
            .update(authorProfiles)
            .set({
              socialStatsJson: JSON.stringify(stats),
              socialStatsEnrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, author.authorName));

          results.push({
            authorName: author.authorName,
            platformsSucceeded: stats.platformsSucceeded,
          });
        } catch (err) {
          results.push({
            authorName: author.authorName,
            platformsSucceeded: [],
            error: String(err),
          });
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      return {
        processed: results.length,
        succeeded: results.filter((r) => !r.error).length,
        failed: results.filter((r) => !!r.error).length,
        results,
      };
    }),

  // ── Twitter/X Enrichment ──────────────────────────────────────────────────

  /** Enrich a single author's Twitter stats using their twitterUrl */
  enrichTwitterStats: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { fetchTwitterStats, searchTwitterUsername } = await import("../enrichment/twitter");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!ENV.twitterBearerToken) {
        throw new Error("TWITTER_BEARER_TOKEN not configured");
      }

      const [author] = await db
        .select({
          authorName: authorProfiles.authorName,
          twitterUrl: authorProfiles.twitterUrl,
          socialStatsJson: authorProfiles.socialStatsJson,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!author) throw new Error(`Author not found: ${input.authorName}`);

      let twitterHandle = author.twitterUrl;

      if (!twitterHandle) {
        const found = await searchTwitterUsername(input.authorName, ENV.twitterBearerToken);
        if (found) {
          twitterHandle = `https://x.com/${found}`;
          await db
            .update(authorProfiles)
            .set({ twitterUrl: twitterHandle })
            .where(eq(authorProfiles.authorName, input.authorName));
        } else {
          return { success: false, authorName: input.authorName, error: "No Twitter handle found" };
        }
      }

      const stats = await fetchTwitterStats(twitterHandle, ENV.twitterBearerToken);
      if (!stats) {
        return { success: false, authorName: input.authorName, error: "Twitter API returned no data" };
      }

      const existing = author.socialStatsJson ? JSON.parse(author.socialStatsJson) : {};
      existing.twitter = stats;
      existing.enrichedAt = new Date().toISOString();

      await db
        .update(authorProfiles)
        .set({
          socialStatsJson: JSON.stringify(existing),
          socialStatsEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        success: true,
        authorName: input.authorName,
        followerCount: stats.followerCount,
        username: stats.username,
      };
    }),

  /** Batch enrich Twitter stats for all authors with Twitter URLs */
  enrichTwitterStatsBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { fetchTwitterStats } = await import("../enrichment/twitter");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!ENV.twitterBearerToken) {
        throw new Error("TWITTER_BEARER_TOKEN not configured");
      }

      const allAuthors = await db
        .select({
          authorName: authorProfiles.authorName,
          twitterUrl: authorProfiles.twitterUrl,
          socialStatsJson: authorProfiles.socialStatsJson,
        })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.twitterUrl));

      const toProcess = input.onlyMissing
        ? allAuthors.filter((a) => {
            if (!a.socialStatsJson) return true;
            const parsed = JSON.parse(a.socialStatsJson);
            return !parsed.twitter;
          })
        : allAuthors;

      const batch = toProcess.slice(0, input.limit);
      const results: Array<{ authorName: string; success: boolean; error?: string }> = [];

      for (const author of batch) {
        try {
          const stats = await fetchTwitterStats(author.twitterUrl!, ENV.twitterBearerToken);
          if (stats) {
            const existing = author.socialStatsJson ? JSON.parse(author.socialStatsJson) : {};
            existing.twitter = stats;
            existing.enrichedAt = new Date().toISOString();

            await db
              .update(authorProfiles)
              .set({
                socialStatsJson: JSON.stringify(existing),
                socialStatsEnrichedAt: new Date(),
              })
              .where(eq(authorProfiles.authorName, author.authorName));

            results.push({ authorName: author.authorName, success: true });
          } else {
            results.push({ authorName: author.authorName, success: false, error: "No data returned" });
          }
        } catch (err: any) {
          results.push({ authorName: author.authorName, success: false, error: String(err) });
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      return {
        processed: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),

  /** Get Twitter stats for a single author */
  getTwitterStats: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({ socialStatsJson: authorProfiles.socialStatsJson })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.socialStatsJson) return null;
      const parsed = JSON.parse(row.socialStatsJson);
      return parsed.twitter ?? null;
    }),

  // ── Business Profile (CNBC + Yahoo Finance) ──────────────────────────────────

  /** Enrich a single author's business profile from CNBC + Yahoo Finance */
  enrichBusinessProfile: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { fetchCNBCAuthorProfile, fetchYahooFinanceStats } = await import("../enrichment/rapidapi");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!ENV.rapidApiKey) {
        throw new Error("RAPIDAPI_KEY not configured");
      }

      const [author] = await db
        .select({
          authorName: authorProfiles.authorName,
          stockTicker: authorProfiles.stockTicker,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!author) throw new Error(`Author not found: ${input.authorName}`);

      const profile: Record<string, unknown> = {};
      const cnbc = await fetchCNBCAuthorProfile(input.authorName, ENV.rapidApiKey);
      if (cnbc) profile.cnbc = cnbc;

      if (author.stockTicker) {
        const yahoo = await fetchYahooFinanceStats(author.stockTicker, ENV.rapidApiKey);
        if (yahoo) profile.yahooFinance = yahoo;
      }

      profile.enrichedAt = new Date().toISOString();

      await db
        .update(authorProfiles)
        .set({
          businessProfileJson: JSON.stringify(profile),
          businessProfileEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        success: true,
        authorName: input.authorName,
        hasCnbc: !!cnbc,
        cnbcArticleCount: cnbc?.articleCount ?? 0,
        hasYahooFinance: !!author.stockTicker,
      };
    }),

  /** Batch enrich business profiles for all authors */
  enrichBusinessProfileBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { fetchCNBCAuthorProfile, fetchYahooFinanceStats } = await import("../enrichment/rapidapi");
      const { ENV } = await import("../_core/env");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!ENV.rapidApiKey) {
        throw new Error("RAPIDAPI_KEY not configured");
      }

      const allAuthors = await db
        .select({
          authorName: authorProfiles.authorName,
          stockTicker: authorProfiles.stockTicker,
          businessProfileJson: authorProfiles.businessProfileJson,
        })
        .from(authorProfiles);

      const toProcess = input.onlyMissing
        ? allAuthors.filter((a) => !a.businessProfileJson)
        : allAuthors;

      const batch = toProcess.slice(0, input.limit);
      const results: Array<{ authorName: string; success: boolean; error?: string }> = [];

      for (const author of batch) {
        try {
          const profile: Record<string, unknown> = {};
          const cnbc = await fetchCNBCAuthorProfile(author.authorName, ENV.rapidApiKey);
          if (cnbc) profile.cnbc = cnbc;
          if (author.stockTicker) {
            const yahoo = await fetchYahooFinanceStats(author.stockTicker, ENV.rapidApiKey);
            if (yahoo) profile.yahooFinance = yahoo;
          }
          profile.enrichedAt = new Date().toISOString();

          await db
            .update(authorProfiles)
            .set({
              businessProfileJson: JSON.stringify(profile),
              businessProfileEnrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, author.authorName));

          results.push({ authorName: author.authorName, success: true });
        } catch (err: any) {
          results.push({ authorName: author.authorName, success: false, error: String(err) });
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      return {
        processed: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),

  /** Get business profile data for a single author */
  getBusinessProfile: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({
          businessProfileJson: authorProfiles.businessProfileJson,
          businessProfileEnrichedAt: authorProfiles.businessProfileEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.businessProfileJson) return null;
      return {
        data: JSON.parse(row.businessProfileJson),
        enrichedAt: row.businessProfileEnrichedAt,
      };
    }),
});
