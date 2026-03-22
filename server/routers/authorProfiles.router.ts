import { z } from "zod";
import { eq, ne, isNull, or, sql, inArray } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, router } from "../_core/trpc";
import { processAuthorAvatarWaterfall } from "../lib/authorAvatars/waterfall";
import { parallelBatch } from "../lib/parallelBatch";
import { persistAvatarResult } from "../lib/authorAvatars/persistResult";

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
      // Use inArray for an indexed lookup instead of a full table scan
      return db
        .select()
        .from(authorProfiles)
        .where(inArray(authorProfiles.authorName, input.authorNames));
    }),

  /** Enrich a single author via Wikipedia + LLM fallback and upsert into DB */
  enrich: publicProcedure
    .input(z.object({ authorName: z.string(), model: z.string().optional(), secondaryModel: z.string().optional() }))
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
      const info = await enrichAuthorViaWikipedia(input.authorName, input.model, input.secondaryModel);
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
   * Mirror author avatars to Manus S3 for stable CDN serving.
   * Processes authors that have an avatarUrl but no s3AvatarUrl yet.
   */
  mirrorAvatars: publicProcedure
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

  /** @deprecated Use getMirrorAvatarStats */
  getMirrorPhotoStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { withPhoto: 0, mirrored: 0, pending: 0 };
    const all = await db
      .select({ avatarUrl: authorProfiles.avatarUrl, s3AvatarUrl: authorProfiles.s3AvatarUrl })
      .from(authorProfiles);
    const withPhoto = all.filter((a) => a.avatarUrl?.startsWith("http")).length;
    const mirrored = all.filter((a) => a.s3AvatarUrl?.startsWith("http")).length;
    return { withPhoto, mirrored, pending: withPhoto - mirrored };
  }),

  /** Batch enrich a list of authors (up to 20 at a time to avoid timeout) */
  enrichBatch: publicProcedure
    .input(z.object({
      authorNames: z.array(z.string()).max(20),
      model: z.string().optional(),
      secondaryModel: z.string().optional(),
      concurrency: z.number().min(1).max(10).optional().default(3),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0, succeeded: 0 };

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Pre-fetch all existing rows in a single query (avoids N+1 per-author lookup)
      const existingRows = input.authorNames.length > 0
        ? await db
            .select()
            .from(authorProfiles)
            .where(inArray(authorProfiles.authorName, input.authorNames))
        : [];
      const existingMap = new Map(existingRows.map((r) => [r.authorName, r]));

      // Run enrichment in parallel with configurable concurrency
      const batchResult = await parallelBatch(
        input.authorNames,
        input.concurrency,
        async (authorName) => {
          const existing = existingMap.get(authorName);
          if (existing?.enrichedAt && existing.enrichedAt > thirtyDaysAgo) {
            return { authorName, success: true, skipped: true };
          }
          const info = await enrichAuthorViaWikipedia(authorName, input.model, input.secondaryModel);
          const now = new Date();
          if (existing) {
            await db
              .update(authorProfiles)
              .set({ ...info, enrichedAt: now })
              .where(eq(authorProfiles.authorName, authorName));
          } else {
            await db.insert(authorProfiles).values({ authorName, ...info, enrichedAt: now });
          }
          return { authorName, success: true, skipped: false };
        }
      );
      const results = batchResult.results.map((r) => ({
        authorName: r.input,
        success: r.error === undefined,
      }));

      // Auto-mirror newly enriched author avatars to S3 in the background (fire-and-forget)
      const succeededCount = results.filter((r) => r.success).length;
      if (succeededCount > 0) {
        void (async () => {
          try {
            const pending = await db
              .select({ id: authorProfiles.id, avatarUrl: authorProfiles.avatarUrl, s3AvatarKey: authorProfiles.s3AvatarKey })
              .from(authorProfiles)
              .where(or(isNull(authorProfiles.s3AvatarUrl), eq(authorProfiles.s3AvatarUrl, "")))
              .limit(succeededCount);
            const toMirror = pending.filter((a) => a.avatarUrl?.startsWith("http"));
            if (toMirror.length > 0) {
              const mirrorResults = await mirrorBatchToS3(
                toMirror.map((a) => ({ id: a.id, sourceUrl: a.avatarUrl!, existingKey: a.s3AvatarKey })),
                "author-avatars"
              );
              for (const r of mirrorResults) {
                if (r.url && r.key) {
                  await db.update(authorProfiles)
                    .set({ s3AvatarUrl: r.url, s3AvatarKey: r.key })
                    .where(eq(authorProfiles.id, r.id));
                }
              }
              console.log(`[auto-mirror] Mirrored ${mirrorResults.filter((r) => r.url).length} author avatars to S3`);
            }
          } catch (err) {
            console.error("[auto-mirror] Author avatar mirror failed:", err);
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

  // -- Generate avatars for ALL authors missing avatars -------------------------
  generateAllMissingAvatars: publicProcedure
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

      // Fetch all authors that have no avatar
      const missing = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(sql`${authorProfiles.avatarUrl} IS NULL OR ${authorProfiles.avatarUrl} = ''`);

      if (missing.length === 0) {
        return { total: 0, succeeded: 0, aiGenerated: 0, results: [] };
      }

      const names = missing.map((r) => r.authorName);

      // Run in parallel with configurable concurrency
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

  // -- Generate an AI avatar (routes to Google Imagen or Replicate based on vendor) --------
  generateAvatar: publicProcedure
    .input(z.object({
      authorName: z.string().min(1),
      bgColor: z.string().optional(),
      /** Avatar Generation — Graphics LLM vendor (e.g. "google", "replicate") */
      avatarGenVendor: z.string().optional(),
      /** Avatar Generation — Graphics LLM model ID (e.g. "nano-banana") */
      avatarGenModel: z.string().optional(),
      /** Avatar Generation — Research LLM vendor for meticulous pipeline */
      avatarResearchVendor: z.string().optional(),
      /** Avatar Generation — Research LLM model ID for meticulous pipeline */
      avatarResearchModel: z.string().optional(),
      /** If true, skip Wikipedia/Tavily/Apify and go straight to Tier 5 meticulous AI generation */
      forceRegenerate: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Use the full meticulous waterfall pipeline (Tier 5) which runs:
      //   Wikipedia + Tavily + Apify research → Gemini Vision analysis → AuthorDescription JSON
      //   → meticulous prompt → configurable graphics LLM (Nano Banana / Replicate)
      const { processAuthorAvatarWaterfall } = await import("../lib/authorAvatars/waterfall");
      const result = await processAuthorAvatarWaterfall(input.authorName, {
        maxTier: 5,
        // forceRegenerate=true skips Tiers 1-3 and goes straight to Tier 5 meticulous pipeline
        minTier: input.forceRegenerate ? 5 : 1,
        skipValidation: true,
        avatarGenVendor: input.avatarGenVendor ?? "google",
        avatarGenModel: input.avatarGenModel ?? "nano-banana",
        avatarResearchVendor: input.avatarResearchVendor ?? "google",
        avatarResearchModel: input.avatarResearchModel ?? "gemini-2.5-flash",
        avatarBgColor: input.bgColor,
        // forceRefresh clears cached AuthorDescription so the pipeline re-researches
        // using the author's current real photo (important after a photo correction)
        forceRefresh: input.forceRegenerate ?? false,
      });

      if (!result || result.source === "failed" || (!result.avatarUrl && !result.s3AvatarUrl)) {
        throw new Error("Avatar generation failed — meticulous pipeline returned no image. Please try again.");
      }

      const finalUrl = result.s3AvatarUrl ?? result.avatarUrl ?? "";
      const finalKey = (result as unknown as Record<string, unknown>).s3AvatarKey as string ?? "";
      const pipelineMeta = result.__pipelineResult;

      // Persist to DB via shared helper
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

  // -- Upload a custom author avatar (base64) -----------------------------
  uploadAvatar: publicProcedure
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

      // Decode base64 -> Buffer
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
      const key = `author-avatars/custom/${slug}-${Date.now()}.${ext}`;

      // Upload to S3
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Persist to DB - mark as custom so waterfall won't overwrite it
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

  /**
   * Update a single author's online links (website, Twitter, LinkedIn, podcast, blog, Substack, articles).
   * Uses Perplexity (web-grounded) as primary, Gemini as fallback.
   */
  updateAuthorLinks: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1),
        researchVendor: z.string().optional(),
        researchModel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { enrichAuthorLinks } = await import("../lib/authorLinks");
      const result = await enrichAuthorLinks(
        input.authorName,
        input.researchVendor ?? "perplexity",
        input.researchModel ?? "sonar-pro"
      );
      await db
        .update(authorProfiles)
        .set({
          websiteUrl: result.websiteUrl,
          twitterUrl: result.twitterUrl,
          linkedinUrl: result.linkedinUrl,
          podcastUrl: result.podcastUrl,
          blogUrl: result.blogUrl,
          substackUrl: result.substackUrl,
          newspaperArticlesJson: result.newspaperArticles.length > 0
            ? JSON.stringify(result.newspaperArticles)
            : undefined,
          otherLinksJson: result.otherLinks.length > 0
            ? JSON.stringify(result.otherLinks)
            : undefined,
          lastLinksEnrichedAt: new Date(),
          enrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));
      const { source, ...linksData } = result;
      return { success: true, source, ...linksData };
    }),

  /**
   * Update links for all authors in the database.
   * Processes in batches of 5 to avoid rate-limiting.
   */
  updateAllAuthorLinks: publicProcedure
    .input(
      z.object({
        researchVendor: z.string().optional(),
        researchModel: z.string().optional(),
        onlyMissing: z.boolean().optional().default(true),
        concurrency: z.number().min(1).max(10).optional().default(3),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { enrichAuthorLinks } = await import("../lib/authorLinks");
      const authors = input.onlyMissing
        ? await db
            .select({ authorName: authorProfiles.authorName })
            .from(authorProfiles)
            .where(isNull(authorProfiles.lastLinksEnrichedAt))
        : await db
            .select({ authorName: authorProfiles.authorName })
            .from(authorProfiles);
      const total = authors.length;

      const batchResult = await parallelBatch(
        authors.map((a) => a.authorName),
        input.concurrency,
        async (authorName) => {
          const result = await enrichAuthorLinks(
            authorName,
            input.researchVendor ?? "perplexity",
            input.researchModel ?? "sonar-pro"
          );
          await db
            .update(authorProfiles)
            .set({
              websiteUrl: result.websiteUrl,
              twitterUrl: result.twitterUrl,
              linkedinUrl: result.linkedinUrl,
              podcastUrl: result.podcastUrl,
              blogUrl: result.blogUrl,
              substackUrl: result.substackUrl,
              newspaperArticlesJson: result.newspaperArticles.length > 0
                ? JSON.stringify(result.newspaperArticles)
                : undefined,
              otherLinksJson: result.otherLinks.length > 0
                ? JSON.stringify(result.otherLinks)
                : undefined,
              lastLinksEnrichedAt: new Date(),
              enrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, authorName));
          return { authorName, success: true };
        }
      );

      return {
        total,
        enriched: batchResult.succeeded,
        failed: batchResult.failed,
      };
    }),

  /**
   * Audit all author avatars using Gemini Vision to detect which ones do NOT
   * have the canonical bokeh-gold background. Returns a list of authors whose
   * avatars need to be regenerated.
   */
  auditAvatarBackgrounds: publicProcedure
    .input(z.object({ targetBgDescription: z.string().default("bokeh-gold warm golden bokeh") }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { audited: 0, mismatch: [], error: "No DB" };

      // Fetch all authors with an avatar URL
      const rows = await db
        .select({
          authorName: authorProfiles.authorName,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
          avatarUrl: authorProfiles.avatarUrl,
        })
        .from(authorProfiles);

      const withAvatars = rows.filter((r) => r.s3AvatarUrl || r.avatarUrl);
      if (withAvatars.length === 0) return { audited: 0, mismatch: [], error: null };

      // Use Gemini Vision to batch-check backgrounds (5 at a time to avoid rate limits)
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
                      {
                        type: "image_url",
                        image_url: { url, detail: "low" },
                      },
                      {
                        type: "text",
                        text: `Does this avatar image have a background that matches "${input.targetBgDescription}"? Reply with only YES or NO.`,
                      },
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

  /**
   * Regenerate avatars for a specific list of authors using the current
   * background color setting. Used by the "Normalize All" batch action.
   */
  normalizeAvatarBackgrounds: publicProcedure
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

      // Run background normalization in parallel with configurable concurrency
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
            minTier: 5, // Force AI regeneration, skip Wikipedia/Tavily/Apify
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

  /**
   * Returns a lightweight map of authorName -> best avatar URL for all profiles
   * that have an avatar stored in S3. Used by the frontend as a DB-first fallback
   * over the static AUTHOR_AVATARS map, so AI-generated avatars appear on cards.
   */
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
});
