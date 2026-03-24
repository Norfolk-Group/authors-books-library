/**
 * Admin Router - action log tracking for admin operations
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adminActionLog } from "../../drizzle/schema";

export const adminRouter = router({
  /** Get all action logs */
  getActionLogs: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(adminActionLog);
  }),

  /** Get the status of configured external tools/APIs */
  getToolStatus: publicProcedure.query(() => {
    return {
      apify: !!(process.env.APIFY_API_TOKEN),
      replicate: !!(process.env.REPLICATE_API_TOKEN),
      perplexity: !!(process.env.PERPLEXITY_API_KEY),
      googleBooks: !!(process.env.GOOGLE_BOOKS_API_KEY),
      tavily: !!(process.env.TAVILY_API_KEY),
      youtube: !!(process.env.YOUTUBE_API_KEY),
      twitter: !!(process.env.TWITTER_BEARER_TOKEN),
    };
  }),

  /**
   * Get a summary of YouTube stats across all enriched authors.
   * Used by the YouTube ActionCard in Admin Console to show aggregate stats.
   */
  getYouTubeStatsSummary: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const { authorProfiles } = await import("../../drizzle/schema");
    const { isNotNull } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { total: 0, withYouTube: 0, topAuthors: [] };

    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        socialStatsJson: authorProfiles.socialStatsJson,
        avatarUrl: authorProfiles.avatarUrl,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
      })
      .from(authorProfiles)
      .where(isNotNull(authorProfiles.socialStatsJson));

    interface YouTubeData {
      channelTitle?: string;
      channelUrl?: string;
      subscriberCount?: number;
      videoCount?: number;
      totalViewCount?: number;
    }
    interface SocialStats { youtube?: YouTubeData }

    const withYouTube: Array<{
      authorName: string;
      avatarUrl: string | null;
      s3AvatarUrl: string | null;
      subscriberCount: number;
      videoCount: number;
      totalViewCount: number;
      channelUrl: string;
    }> = [];

    for (const row of rows) {
      if (!row.socialStatsJson) continue;
      try {
        const stats = JSON.parse(row.socialStatsJson) as SocialStats;
        const yt = stats.youtube;
        if (yt?.subscriberCount !== undefined) {
          withYouTube.push({
            authorName: row.authorName,
            avatarUrl: row.avatarUrl,
            s3AvatarUrl: row.s3AvatarUrl,
            subscriberCount: yt.subscriberCount ?? 0,
            videoCount: yt.videoCount ?? 0,
            totalViewCount: yt.totalViewCount ?? 0,
            channelUrl: yt.channelUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(row.authorName)}`,
          });
        }
      } catch { /* skip malformed JSON */ }
    }

    withYouTube.sort((a, b) => b.subscriberCount - a.subscriberCount);

    return {
      total: rows.length,
      withYouTube: withYouTube.length,
      topAuthors: withYouTube.slice(0, 10),
    };
  }),

  /** Record an action run */
  recordAction: adminProcedure
    .input(
      z.object({
        actionKey: z.string(),
        label: z.string(),
        durationMs: z.number(),
        result: z.string(),
        itemCount: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const existing = await db
        .select()
        .from(adminActionLog)
        .where(eq(adminActionLog.actionKey, input.actionKey))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(adminActionLog)
          .set({
            lastRunAt: new Date(),
            lastRunDurationMs: input.durationMs,
            lastRunResult: input.result,
            lastRunItemCount: input.itemCount ?? null,
            label: input.label,
          })
          .where(eq(adminActionLog.actionKey, input.actionKey));
      } else {
        await db.insert(adminActionLog).values({
          actionKey: input.actionKey,
          label: input.label,
          lastRunAt: new Date(),
          lastRunDurationMs: input.durationMs,
          lastRunResult: input.result,
          lastRunItemCount: input.itemCount ?? null,
        });
      }
      return { success: true };
    }),
});
