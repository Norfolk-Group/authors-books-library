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
