import { z } from "zod";
import { eq, ne, isNull, or, sql } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, router } from "../_core/trpc";
import { processAuthorPhotoWaterfall } from "../lib/authorPhotos/waterfall";

import { enrichAuthorViaWikipedia } from "../lib/authorEnrichment";

// -- Router --------------------------------------------------------------------
export const authorProfilesRouter = router({
  /** Get a single author profile by base name */
  get: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Get multiple author profiles by name list */
  getMany: publicProcedure
    .input(z.object({ authorNames: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.authorNames.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(authorProfiles);
      const nameSet = new Set(input.authorNames);
      return rows.filter((r) => nameSet.has(r.authorName));
    }),

  /** Enrich a single author via Wikipedia + LLM fallback and upsert into DB */
  enrich: publicProcedure
    .input(z.object({ authorName: z.string(), model: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, cached: false, profile: null };

      // Check if already enriched recently (within 30 days)
      const existing = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
        return { success: true, cached: true, profile: existing[0] };
      }

      // Enrich via Wikipedia/Wikidata (with LLM fallback for missing bios)
      const info = await enrichAuthorViaWikipedia(input.authorName, input.model);
      const now = new Date();

      if (existing[0]) {
        await db
          .update(authorProfiles)
          .set({ ...info, enrichedAt: now })
          .where(eq(authorProfiles.authorName, input.authorName));
      } else {
        await db.insert(authorProfiles).values({
          authorName: input.authorName,
          ...info,
          enrichedAt: now,
        });
      }

      const updated = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      return { success: true, cached: false, profile: updated[0] ?? null };
    }),

  /** Get all author names that have a non-empty bio (lightweight, for enrichment indicators) */
  getAllEnrichedNames: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ authorName: authorProfiles.authorName })
      .from(authorProfiles)
      .where(ne(authorProfiles.bio, ""));
    return rows.map((r) => r.authorName);
  }),

  /**
   * Return all author profiles that have a non-empty bio.
   * Used to populate the bio tooltip on author cards without per-card queries.
   */
  getAllBios: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio })
      .from(authorProfiles)
      .where(ne(authorProfiles.bio, ""));
    return rows
      .filter((r) => r.bio && r.bio.trim().length > 0)
      .map((r) => ({ authorName: r.authorName, bio: r.bio as string }));
  }),

  /**
   * Mirror author photos to Manus S3 for stable CDN serving.
   * Processes authors that have a photoUrl but no s3PhotoUrl yet.
   */
  mirrorPhotos: publicProcedure
    .input(z.object({ batchSize: z.number().min(1).max(20).default(10) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pending = await db
        .select({
          id: authorProfiles.id,
          photoUrl: authorProfiles.photoUrl,
          s3PhotoKey: authorProfiles.s3PhotoKey,
        })
        .from(authorProfiles)
        .where(or(isNull(authorProfiles.s3PhotoUrl), eq(authorProfiles.s3PhotoUrl, "")))
        .limit(input.batchSize);
      const toMirror = pending.filter((a) => a.photoUrl?.startsWith("http"));
      if (toMirror.length === 0) {
        return { mirrored: 0, skipped: pending.length, failed: 0, total: pending.length };
      }
      const results = await mirrorBatchToS3(
        toMirror.map((a) => ({ id: a.id, sourceUrl: a.photoUrl!, existingKey: a.s3PhotoKey })),
        "author-photos"
      );
      let mirrored = 0;
      let failed = 0;
      for (const result of results) {
        if (result.url && result.key) {
          await db.update(authorProfiles)
            .set({ s3PhotoUrl: result.url, s3PhotoKey: result.key })
            .where(eq(authorProfiles.id, result.id));
          mirrored++;
        } else {
          failed++;
        }
      }
      return { mirrored, skipped: pending.length - toMirror.length, failed, total: pending.length };
    }),

  /** Count how many author photos still need S3 mirroring */
  getMirrorPhotoStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { withPhoto: 0, mirrored: 0, pending: 0 };
    const all = await db
      .select({ photoUrl: authorProfiles.photoUrl, s3PhotoUrl: authorProfiles.s3PhotoUrl })
      .from(authorProfiles);
    const withPhoto = all.filter((a) => a.photoUrl?.startsWith("http")).length;
    const mirrored = all.filter((a) => a.s3PhotoUrl?.startsWith("http")).length;
    return { withPhoto, mirrored, pending: withPhoto - mirrored };
  }),

  /** Batch enrich a list of authors (up to 20 at a time to avoid timeout) */
  enrichBatch: publicProcedure
    .input(z.object({ authorNames: z.array(z.string()).max(20), model: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0, succeeded: 0 };

      const results: Array<{ authorName: string; success: boolean }> = [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const authorName of input.authorNames) {
        try {
          const existing = await db
            .select()
            .from(authorProfiles)
            .where(eq(authorProfiles.authorName, authorName))
            .limit(1);

          if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
            results.push({ authorName, success: true });
            continue;
          }

          const info = await enrichAuthorViaWikipedia(authorName, input.model);
          const now = new Date();

          if (existing[0]) {
            await db
              .update(authorProfiles)
              .set({ ...info, enrichedAt: now })
              .where(eq(authorProfiles.authorName, authorName));
          } else {
            await db.insert(authorProfiles).values({ authorName, ...info, enrichedAt: now });
          }
          results.push({ authorName, success: true });
        } catch {
          results.push({ authorName, success: false });
        }
      }

      // Auto-mirror newly enriched author photos to S3 in the background (fire-and-forget)
      const succeededCount = results.filter((r) => r.success).length;
      if (succeededCount > 0) {
        void (async () => {
          try {
            const pending = await db
              .select({ id: authorProfiles.id, photoUrl: authorProfiles.photoUrl, s3PhotoKey: authorProfiles.s3PhotoKey })
              .from(authorProfiles)
              .where(or(isNull(authorProfiles.s3PhotoUrl), eq(authorProfiles.s3PhotoUrl, "")))
              .limit(succeededCount);
            const toMirror = pending.filter((a) => a.photoUrl?.startsWith("http"));
            if (toMirror.length > 0) {
              const mirrorResults = await mirrorBatchToS3(
                toMirror.map((a) => ({ id: a.id, sourceUrl: a.photoUrl!, existingKey: a.s3PhotoKey })),
                "author-photos"
              );
              for (const r of mirrorResults) {
                if (r.url && r.key) {
                  await db.update(authorProfiles)
                    .set({ s3PhotoUrl: r.url, s3PhotoKey: r.key })
                    .where(eq(authorProfiles.id, r.id));
                }
              }
              console.log(`[auto-mirror] Mirrored ${mirrorResults.filter((r) => r.url).length} author photos to S3`);
            }
          } catch (err) {
            console.error("[auto-mirror] Author photo mirror failed:", err);
          }
        })();
      }

      return {
        results,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
      };
    }),

  // -- Avatar generation stats -------------------------------------------------
  getAvatarStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, hasPhoto: 0, inS3: 0, missing: 0 };
    const all = await db
      .select({
        authorName: authorProfiles.authorName,
        photoUrl: authorProfiles.photoUrl,
        s3PhotoUrl: authorProfiles.s3PhotoUrl,
      })
      .from(authorProfiles);
    return {
      total: all.length,
      hasPhoto: all.filter((a: { photoUrl: string | null }) => a.photoUrl).length,
      inS3: all.filter((a: { s3PhotoUrl: string | null }) => a.s3PhotoUrl).length,
      missing: all.filter((a: { photoUrl: string | null }) => !a.photoUrl).length,
    };
  }),

  // -- Batch avatar generation via waterfall -----------------------------------
  generateAvatarsBatch: publicProcedure
    .input(
      z.object({
        names: z.array(z.string()).min(1).max(5),
        skipValidation: z.boolean().optional().default(false),
        maxTier: z.number().min(1).max(5).optional().default(5),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const results: Array<{
        name: string;
        success: boolean;
        source: string;
        isAiGenerated: boolean;
        tier: number;
        photoUrl: string | null;
        error?: string;
      }> = [];

      for (const originalName of input.names) {
        try {
          const result = await processAuthorPhotoWaterfall(originalName, {
            skipValidation: input.skipValidation,
            maxTier: input.maxTier,
          });

          // Save to DB
          if (result.photoUrl || result.s3PhotoUrl) {
            // Map waterfall source to photoSource enum
            const photoSourceVal =
              result.source === "wikipedia" ? "wikipedia" as const
              : result.source === "tavily" ? "tavily" as const
              : result.source === "apify" ? "apify" as const
              : result.source === "ai-generated" ? "ai" as const
              : undefined;
            await db
              .update(authorProfiles)
              .set({
                photoUrl: result.s3PhotoUrl ?? result.photoUrl,
                s3PhotoUrl: result.s3PhotoUrl,
                enrichedAt: new Date(),
                ...(photoSourceVal ? { photoSource: photoSourceVal } : {}),
              })
              .where(eq(authorProfiles.authorName, originalName));
          }

          results.push({
            name: originalName,
            success: result.source !== "failed" && result.source !== "skipped",
            source: result.source,
            isAiGenerated: result.isAiGenerated,
            tier: result.tier,
            photoUrl: result.s3PhotoUrl ?? result.photoUrl,
          });
        } catch (err) {
          results.push({
            name: originalName,
            success: false,
            source: "failed",
            isAiGenerated: false,
            tier: 0,
            photoUrl: null,
            error: String(err),
          });
        }
      }

      return {
        results,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        aiGenerated: results.filter((r) => r.isAiGenerated).length,
      };
    }),

  // -- Generate avatars for ALL authors missing photos -------------------------
  generateAllMissingAvatars: publicProcedure
    .input(
      z.object({
        batchSize: z.number().min(1).max(10).optional().default(5),
        maxTier: z.number().min(1).max(5).optional().default(5),
        skipValidation: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch all authors that have no photo
      const missing = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(sql`${authorProfiles.photoUrl} IS NULL OR ${authorProfiles.photoUrl} = ''`);

      if (missing.length === 0) {
        return { total: 0, succeeded: 0, aiGenerated: 0, results: [] };
      }

      const names = missing.map((r) => r.authorName);
      const results: Array<{
        name: string;
        success: boolean;
        source: string;
        isAiGenerated: boolean;
        tier: number;
        photoUrl: string | null;
        error?: string;
      }> = [];

      // Process in batches
      for (let i = 0; i < names.length; i += input.batchSize) {
        const batch = names.slice(i, i + input.batchSize);
        for (const originalName of batch) {
          try {
            const result = await processAuthorPhotoWaterfall(originalName, {
              skipValidation: input.skipValidation,
              maxTier: input.maxTier,
            });
            if (result.photoUrl || result.s3PhotoUrl) {
              const photoSourceVal2 =
                result.source === "wikipedia" ? "wikipedia" as const
                : result.source === "tavily" ? "tavily" as const
                : result.source === "apify" ? "apify" as const
                : result.source === "ai-generated" ? "ai" as const
                : undefined;
              await db
                .update(authorProfiles)
                .set({
                  photoUrl: result.s3PhotoUrl ?? result.photoUrl,
                  s3PhotoUrl: result.s3PhotoUrl,
                  enrichedAt: new Date(),
                  ...(photoSourceVal2 ? { photoSource: photoSourceVal2 } : {}),
                })
                .where(eq(authorProfiles.authorName, originalName));
            }
            results.push({
              name: originalName,
              success: result.source !== "failed" && result.source !== "skipped",
              source: result.source,
              isAiGenerated: result.isAiGenerated,
              tier: result.tier,
              photoUrl: result.s3PhotoUrl ?? result.photoUrl,
            });
          } catch (err) {
            results.push({
              name: originalName,
              success: false,
              source: "failed",
              isAiGenerated: false,
              tier: 0,
              photoUrl: null,
              error: String(err),
            });
          }
        }
      }

      return {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        aiGenerated: results.filter((r) => r.isAiGenerated).length,
        results,
      };
    }),

  // -- Generate an AI portrait via Replicate (last-resort fallback) --------
  generatePortrait: publicProcedure
    .input(z.object({ authorName: z.string().min(1), bgColor: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Generate via Replicate flux-schnell
      const { generateAIPortrait } = await import("../lib/authorPhotos/replicateGeneration");
      const generated = await generateAIPortrait(input.authorName, input.bgColor);
      if (!generated) throw new Error("Portrait generation failed - please try again");

      // Mirror to S3 immediately (Replicate URLs expire after ~1 hour)
      const res = await fetch(generated.url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error("Failed to download generated portrait");
      const buffer = Buffer.from(await res.arrayBuffer());
      const slug = input.authorName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const key = `author-photos/ai-${slug}-${Date.now()}.webp`;
      const { url } = await storagePut(key, buffer, "image/webp");

      // Persist to DB - AI-generated portrait
      await db
        .update(authorProfiles)
        .set({ photoUrl: url, s3PhotoUrl: url, s3PhotoKey: key, enrichedAt: new Date(), photoSource: "ai" })
        .where(eq(authorProfiles.authorName, input.authorName));

      return { url, key, isAiGenerated: true };
    }),

  // -- Upload a custom author photo (base64) -----------------------------
  uploadPhoto: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1),
        // base64-encoded image data (without data: prefix)
        imageBase64: z.string().min(1),
        // mime type e.g. "image/jpeg", "image/png", "image/webp"
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Decode base64 → Buffer
      const buffer = Buffer.from(input.imageBase64, "base64");

      // Enforce 5 MB size limit
      if (buffer.byteLength > 5 * 1024 * 1024) {
        throw new Error("Image too large - maximum size is 5 MB");
      }

      // Build a unique S3 key
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const slug = input.authorName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const key = `author-photos/custom/${slug}-${Date.now()}.${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Persist to DB - mark as custom so waterfall won't overwrite it
      await db
        .update(authorProfiles)
        .set({
          photoUrl: url,
          s3PhotoUrl: url,
          s3PhotoKey: key,
          enrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return { url, key };
    }),

  /**
   * Returns a lightweight map of authorName → best photo URL for all profiles
   * that have a photo stored in S3. Used by the frontend as a DB-first fallback
   * over the static AUTHOR_PHOTOS map, so AI-generated portraits appear on cards.
   */
  getPhotoMap: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        s3PhotoUrl: authorProfiles.s3PhotoUrl,
        photoUrl: authorProfiles.photoUrl,
      })
      .from(authorProfiles);
    return rows
      .filter((r) => r.s3PhotoUrl || r.photoUrl)
      .map((r) => ({
        authorName: r.authorName,
        photoUrl: r.s3PhotoUrl ?? r.photoUrl ?? "",
      }));
  }),
});
