import { z } from "zod";
import { eq, isNull, or, sql } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { processAuthorAvatarWaterfall } from "../lib/authorAvatars/waterfall";
import { parallelBatch } from "../lib/parallelBatch";
import { persistAvatarResult } from "../lib/authorAvatars/persistResult";
import { logger } from "../lib/logger";

// ── Avatar Sub-Router ──────────────────────────────────────────────────────
export const authorAvatarRouter = router({
  /** Mirror author avatars to S3 in batches */
  mirrorAvatars: adminProcedure
    .input(z.object({ batchSize: z.number().min(1).max(20).default(10) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pending = await db
        .select({
          id: authorProfiles.id,
          avatarUrl: authorProfiles.avatarUrl,
          s3AvatarKey: authorProfiles.s3AvatarKey,
        })
        .from(authorProfiles)
        .where(or(isNull(authorProfiles.s3AvatarUrl), eq(authorProfiles.s3AvatarUrl, "")))
        .limit(input.batchSize);
      const toMirror = pending.filter((a) => a.avatarUrl?.startsWith("http"));
      if (toMirror.length === 0) {
        return { mirrored: 0, skipped: pending.length, failed: 0, total: pending.length };
      }
      const results = await mirrorBatchToS3(
        toMirror.map((a) => ({ id: a.id, sourceUrl: a.avatarUrl!, existingKey: a.s3AvatarKey })),
        "author-avatars"
      );
      let mirrored = 0;
      let failed = 0;
      for (const result of results) {
        if (result.url && result.key) {
          await db.update(authorProfiles)
            .set({ s3AvatarUrl: result.url, s3AvatarKey: result.key })
            .where(eq(authorProfiles.id, result.id));
          mirrored++;
        } else {
          failed++;
        }
      }
      return { mirrored, skipped: pending.length - toMirror.length, failed, total: pending.length };
    }),

  /** Count how many author avatars still need S3 mirroring */
  getMirrorAvatarStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { withAvatar: 0, mirrored: 0, pending: 0 };
    const all = await db
      .select({ avatarUrl: authorProfiles.avatarUrl, s3AvatarUrl: authorProfiles.s3AvatarUrl })
      .from(authorProfiles);
    const withAvatar = all.filter((a) => a.avatarUrl?.startsWith("http")).length;
    const mirrored = all.filter((a) => a.s3AvatarUrl?.startsWith("http")).length;
    return { withAvatar, mirrored, pending: withAvatar - mirrored };
  }),

  /** Avatar generation stats */
  getAvatarStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, hasAvatar: 0, inS3: 0, missing: 0 };
    const all = await db
      .select({
        authorName: authorProfiles.authorName,
        avatarUrl: authorProfiles.avatarUrl,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
      })
      .from(authorProfiles);
    return {
      total: all.length,
      hasAvatar: all.filter((a: { avatarUrl: string | null }) => a.avatarUrl).length,
      inS3: all.filter((a: { s3AvatarUrl: string | null }) => a.s3AvatarUrl).length,
      missing: all.filter((a: { avatarUrl: string | null }) => !a.avatarUrl).length,
    };
  }),

  /** Per-author avatar detail stats (for Admin Console table) */
  getAvatarDetailedStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        avatarUrl: authorProfiles.avatarUrl,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
        avatarSource: authorProfiles.avatarSource,
        bestReferencePhotoUrl: authorProfiles.bestReferencePhotoUrl,
      })
      .from(authorProfiles)
      .orderBy(authorProfiles.authorName);
    return rows;
  }),

  /** Generate avatars for ALL authors missing avatars */
  generateAllMissingAvatars: adminProcedure
    .input(
      z.object({
        concurrency: z.number().min(1).max(10).optional().default(3),
        maxTier: z.number().min(1).max(5).optional().default(5),
        skipValidation: z.boolean().optional().default(false),
        avatarGenVendor: z.string().optional().default("google"),
        avatarGenModel: z.string().optional().default("nano-banana"),
        avatarResearchVendor: z.string().optional().default("google"),
        avatarResearchModel: z.string().optional().default("gemini-2.5-flash"),
        avatarBgColor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const missing = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(sql`${authorProfiles.avatarUrl} IS NULL OR ${authorProfiles.avatarUrl} = ''`);

      if (missing.length === 0) {
        return { total: 0, succeeded: 0, aiGenerated: 0, results: [] };
      }

      const names = missing.map((r) => r.authorName);

      const batch = await parallelBatch(names, input.concurrency, async (originalName) => {
        const result = await processAuthorAvatarWaterfall(originalName, {
          skipValidation: input.skipValidation,
          maxTier: input.maxTier,
          avatarGenVendor: input.avatarGenVendor,
          avatarGenModel: input.avatarGenModel,
          avatarResearchVendor: input.avatarResearchVendor,
          avatarResearchModel: input.avatarResearchModel,
          avatarBgColor: input.avatarBgColor,
        });
        await persistAvatarResult(db, originalName, result, {
          vendor: input.avatarGenVendor,
          model: input.avatarGenModel,
          researchVendor: input.avatarResearchVendor,
          researchModel: input.avatarResearchModel,
        });
        return {
          name: originalName,
          success: result.source !== "failed" && result.source !== "skipped",
          source: result.source,
          isAiGenerated: result.isAiGenerated,
          tier: result.tier,
          avatarUrl: result.s3AvatarUrl ?? result.avatarUrl,
        };
      });

      const results = batch.results.map((r) =>
        r.result ?? { name: r.input, success: false, source: "failed", isAiGenerated: false, tier: 0, avatarUrl: null, error: r.error }
      );

      return {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        aiGenerated: results.filter((r) => r.isAiGenerated).length,
        results,
      };
    }),

  /** Generate an AI avatar (routes to Google Imagen or Replicate based on vendor) */
  generateAvatar: adminProcedure
    .input(z.object({
      authorName: z.string().min(1),
      bgColor: z.string().optional(),
      avatarGenVendor: z.string().optional(),
      avatarGenModel: z.string().optional(),
      avatarResearchVendor: z.string().optional(),
      avatarResearchModel: z.string().optional(),
      forceRegenerate: z.boolean().optional(),
      aspectRatio: z.string().optional(),
      width: z.number().int().min(0).max(2048).optional(),
      height: z.number().int().min(0).max(2048).optional(),
      outputFormat: z.enum(["webp", "png", "jpeg"]).optional(),
      outputQuality: z.number().int().min(1).max(100).optional(),
      guidanceScale: z.number().min(1).max(20).optional(),
      numInferenceSteps: z.number().int().min(1).max(50).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.width && input.width > 0 && input.width % 64 !== 0) {
        throw new Error(`Width must be a multiple of 64 (got ${input.width})`);
      }
      if (input.height && input.height > 0 && input.height % 64 !== 0) {
        throw new Error(`Height must be a multiple of 64 (got ${input.height})`);
      }

      const result = await processAuthorAvatarWaterfall(input.authorName, {
        maxTier: 5,
        minTier: input.forceRegenerate ? 5 : 1,
        skipValidation: true,
        avatarGenVendor: input.avatarGenVendor ?? "google",
        avatarGenModel: input.avatarGenModel ?? "nano-banana",
        avatarResearchVendor: input.avatarResearchVendor ?? "google",
        avatarResearchModel: input.avatarResearchModel ?? "gemini-2.5-flash",
        avatarBgColor: input.bgColor,
        forceRefresh: input.forceRegenerate ?? false,
        avatarAspectRatio: input.aspectRatio,
        avatarWidth: input.width,
        avatarHeight: input.height,
        avatarOutputFormat: input.outputFormat,
        avatarOutputQuality: input.outputQuality,
        avatarGuidanceScale: input.guidanceScale,
        avatarInferenceSteps: input.numInferenceSteps,
      });

      if (!result || result.source === "failed" || (!result.avatarUrl && !result.s3AvatarUrl)) {
        throw new Error("Avatar generation failed — meticulous pipeline returned no image. Please try again.");
      }

      const finalUrl = result.s3AvatarUrl ?? result.avatarUrl ?? "";
      const finalKey = (result as unknown as Record<string, unknown>).s3AvatarKey as string ?? "";
      const pipelineMeta = result.__pipelineResult;

      await persistAvatarResult(db, input.authorName, result, {
        vendor: input.avatarGenVendor ?? "google",
        model: input.avatarGenModel ?? "nano-banana",
        researchVendor: input.avatarResearchVendor ?? "google",
        researchModel: input.avatarResearchModel ?? "gemini-2.5-flash",
      });

      return {
        url: finalUrl,
        key: finalKey,
        isAiGenerated: result.isAiGenerated,
        source: result.source,
        tier: result.tier,
        authorDescription: pipelineMeta?.authorDescription,
        prompt: pipelineMeta?.imagePrompt,
      };
    }),

  /** Upload a custom author avatar (base64) */
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        authorName: z.string().min(1),
        imageBase64: z.string().min(1),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const buffer = Buffer.from(input.imageBase64, "base64");
      if (buffer.byteLength > 5 * 1024 * 1024) {
        throw new Error("Image too large - maximum size is 5 MB");
      }

      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const slug = input.authorName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const key = `author-avatars/custom/${slug}-${Date.now()}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      await db
        .update(authorProfiles)
        .set({
          avatarUrl: url,
          s3AvatarUrl: url,
          s3AvatarKey: key,
          enrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return { url, key };
    }),

  /** Audit all author avatars using Gemini Vision to detect background mismatches */
  auditAvatarBackgrounds: adminProcedure
    .input(z.object({ targetBgDescription: z.string().default("bokeh-gold warm golden bokeh") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { audited: 0, mismatch: [], error: "No DB" };

      const rows = await db
        .select({
          authorName: authorProfiles.authorName,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
          avatarUrl: authorProfiles.avatarUrl,
        })
        .from(authorProfiles);

      const withAvatars = rows.filter((r) => r.s3AvatarUrl || r.avatarUrl);
      if (withAvatars.length === 0) return { audited: 0, mismatch: [], error: null };

      const { invokeLLM } = await import("../_core/llm");
      const mismatch: string[] = [];
      const BATCH = 5;

      for (let i = 0; i < withAvatars.length; i += BATCH) {
        const batch = withAvatars.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async (row) => {
            const url = row.s3AvatarUrl ?? row.avatarUrl ?? "";
            if (!url) return;
            try {
              const resp = await invokeLLM({
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "image_url", image_url: { url, detail: "low" } },
                      { type: "text", text: `Does this avatar image have a background that matches "${input.targetBgDescription}"? Reply with only YES or NO.` },
                    ],
                  },
                ],
              });
              const rawContent = resp?.choices?.[0]?.message?.content;
              const answer = (typeof rawContent === "string" ? rawContent : "").trim().toUpperCase();
              if (answer.startsWith("NO")) {
                mismatch.push(row.authorName);
              }
            } catch {
              // Skip authors where vision check fails
            }
          })
        );
      }

      return { audited: withAvatars.length, mismatch, error: null };
    }),

  /** Regenerate avatars for a specific list of authors (normalize backgrounds) */
  normalizeAvatarBackgrounds: adminProcedure
    .input(
      z.object({
        authorNames: z.array(z.string()),
        bgColor: z.string().default("#c8960c"),
        avatarGenVendor: z.string().default("google"),
        avatarGenModel: z.string().default("nano-banana"),
        avatarResearchVendor: z.string().default("google"),
        avatarResearchModel: z.string().default("gemini-2.5-flash"),
        concurrency: z.number().min(1).max(10).optional().default(3),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { total: input.authorNames.length, normalized: 0, failed: 0 };

      const batchResult = await parallelBatch(
        input.authorNames,
        input.concurrency,
        async (authorName) => {
          const result = await processAuthorAvatarWaterfall(authorName, {
            avatarBgColor: input.bgColor,
            avatarGenVendor: input.avatarGenVendor,
            avatarGenModel: input.avatarGenModel,
            avatarResearchVendor: input.avatarResearchVendor,
            avatarResearchModel: input.avatarResearchModel,
            minTier: 5,
          });
          const finalUrl = result.s3AvatarUrl ?? result.avatarUrl;
          if (!finalUrl) throw new Error("No avatar URL returned");
          await db
            .update(authorProfiles)
            .set({ s3AvatarUrl: finalUrl })
            .where(eq(authorProfiles.authorName, authorName));
          return { authorName, url: finalUrl };
        }
      );

      return {
        total: input.authorNames.length,
        normalized: batchResult.succeeded,
        failed: batchResult.failed,
      };
    }),

  /** Returns a lightweight map of authorName -> best avatar URL */
  getAvatarMap: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
        avatarUrl: authorProfiles.avatarUrl,
      })
      .from(authorProfiles);
    return rows
      .filter((r) => r.s3AvatarUrl || r.avatarUrl)
      .map((r) => ({
        authorName: r.authorName,
        avatarUrl: r.s3AvatarUrl ?? r.avatarUrl ?? "",
      }));
  }),

  /** Read the live progress of the background batch-regen script */
  getBatchRegenProgress: publicProcedure.query(() => {
    const progressFile = "/tmp/batch-regen-progress.json";
    if (!existsSync(progressFile)) return null;
    try {
      const raw = readFileSync(progressFile, "utf8");
      const data = JSON.parse(raw) as {
        total: number;
        completed: number;
        succeeded: number;
        failed: number;
        current: string | null;
        startedAt: string;
        finishedAt?: string;
        results: Array<{ name: string; success: boolean; tier: number; source: string }>;
      };
      return data;
    } catch {
      return null;
    }
  }),

  /** Returns a map of authorName -> overallConfidence for research quality badges */
  getResearchQualityMap: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        authorDescriptionJson: authorProfiles.authorDescriptionJson,
      })
      .from(authorProfiles)
      .where(sql`${authorProfiles.authorDescriptionJson} IS NOT NULL`);
    return rows
      .map((r) => {
        try {
          const desc = JSON.parse(r.authorDescriptionJson ?? "{}");
          const confidence = desc?.sourceConfidence?.overallConfidence as "high" | "medium" | "low" | undefined;
          if (!confidence) return null;
          return { authorName: r.authorName, confidence };
        } catch {
          return null;
        }
      })
      .filter((r): r is { authorName: string; confidence: "high" | "medium" | "low" } => r !== null);
  }),

  /** Trigger batch avatar regeneration script */
  triggerBatchRegen: adminProcedure
    .input(z.object({
      forceRegenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ input }) => {
      const scriptPath = join(process.cwd(), "scripts/batch-regenerate-avatars.mjs");
      if (!existsSync(scriptPath)) {
        throw new Error("Batch regen script not found at " + scriptPath);
      }
      const { writeFileSync } = await import("fs");
      writeFileSync("/tmp/batch-regen-progress.json", JSON.stringify({
        total: 0,
        completed: 0,
        succeeded: 0,
        failed: 0,
        current: null,
        startedAt: new Date().toISOString(),
        results: [],
      }));
      const child = spawn(
        "node",
        [scriptPath, input.forceRegenerate ? "--force" : ""].filter(Boolean),
        {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
          env: { ...process.env },
        }
      );
      child.unref();
      return { started: true, pid: child.pid };
    }),
});
