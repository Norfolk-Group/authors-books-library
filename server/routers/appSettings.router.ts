/**
 * appSettings.router.ts
 *
 * tRPC router for reading and writing application settings stored in the
 * app_settings table. Currently used for AI model configuration.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const MODEL_CONFIG_KEY = "ai_model_config";

interface ModelConfig {
  primaryVendor: string;
  primaryModel: string;
  secondaryEnabled: boolean;
  secondaryVendor: string | null;
  secondaryModel: string | null;
  savedAt: string;
}

const DEFAULT_CONFIG: ModelConfig = {
  primaryVendor: "google",
  primaryModel: "gemini-2.5-pro",
  secondaryEnabled: false,
  secondaryVendor: null,
  secondaryModel: null,
  savedAt: new Date().toISOString(),
};

export const appSettingsRouter = router({
  /**
   * Get the current AI model configuration.
   * Returns the default config if none has been saved yet.
   */
  getModelConfig: publicProcedure.query(async (): Promise<ModelConfig> => {
    const db = await getDb();
    if (!db) return DEFAULT_CONFIG;
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, MODEL_CONFIG_KEY))
      .limit(1);
    if (!rows[0]) return DEFAULT_CONFIG;
    try {
      return JSON.parse(rows[0].value) as ModelConfig;
    } catch {
      return DEFAULT_CONFIG;
    }
  }),

  /**
   * Save the AI model configuration.
   */
  saveModelConfig: publicProcedure
    .input(
      z.object({
        primaryVendor: z.string().min(1),
        primaryModel: z.string().min(1),
        secondaryEnabled: z.boolean(),
        secondaryVendor: z.string().nullable(),
        secondaryModel: z.string().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const config: ModelConfig = {
        ...input,
        savedAt: new Date().toISOString(),
      };
      await db
        .insert(appSettings)
        .values({ key: MODEL_CONFIG_KEY, value: JSON.stringify(config), updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { value: JSON.stringify(config), updatedAt: new Date() } });
      return { success: true };
    }),

  /**
   * Get a single setting value by key.
   */
  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, input.key))
        .limit(1);
      return rows[0]?.value ?? null;
    }),

  /**
   * Set a single setting value.
   */
  set: publicProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .insert(appSettings)
        .values({ key: input.key, value: input.value, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { value: input.value, updatedAt: new Date() } });
      return { success: true };
    }),
});
