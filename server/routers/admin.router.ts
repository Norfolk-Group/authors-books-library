/**
 * Admin Router - action log tracking for admin operations
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adminActionLog } from "../../drizzle/schema";

export const adminRouter = router({
  /** Get all action logs */
  getActionLogs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(adminActionLog);
  }),

  /** Record an action run */
  recordAction: publicProcedure
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
