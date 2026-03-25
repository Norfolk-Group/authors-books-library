import { z } from "zod";
import { eq, isNull, isNotNull, or, sql, inArray, desc } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { enrichAuthorViaWikipedia } from "../lib/authorEnrichment";
import { parallelBatch } from "../lib/parallelBatch";
import { logger } from "../lib/logger";

// Sub-routers (split for maintainability)
import { authorAvatarRouter } from "./authorAvatar.router";
import { authorEnrichmentRouter } from "./authorEnrichment.router";
import { authorSocialRouter } from "./authorSocial.router";

// ── Author Profiles Router ─────────────────────────────────────────────────
// Core CRUD + basic enrichment live here; avatar, deep enrichment, and social
// procedures are delegated to sub-routers and merged at the bottom.
const authorProfilesCoreRouter = router({
  /** Get recently enriched authors (by enrichedAt desc) */
  getRecentlyEnriched: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          authorName: authorProfiles.authorName,
          bio: authorProfiles.bio,
          avatarUrl: authorProfiles.avatarUrl,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
          enrichedAt: authorProfiles.enrichedAt,
          createdAt: authorProfiles.createdAt,
        })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.enrichedAt))
        .orderBy(desc(authorProfiles.enrichedAt))
        .limit(input.limit);
    }),

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
      return db
        .select()
        .from(authorProfiles)
        .where(inArray(authorProfiles.authorName, input.authorNames));
    }),

  /** Enrich a single author via Wikipedia + LLM fallback and upsert into DB */
  enrich: adminProcedure
    .input(z.object({ authorName: z.string(), model: z.string().optional(), secondaryModel: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, cached: false, profile: null };

      const existing = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
        return { success: true, cached: true, profile: existing[0] };
      }

      const info = await enrichAuthorViaWikipedia(input.authorName, input.model, input.secondaryModel);
      const now = new Date();

      if (existing[0]) {
        await db
          .update(authorProfiles)
          .set({ ...info, enrichedAt: now })
          .where(eq(authorProfiles.authorName, input.authorName));
      } else {
        await db.insert(authorProfiles).values({ authorName: input.authorName, ...info, enrichedAt: now });
      }

      const updated = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      return { success: true, cached: false, profile: updated[0] ?? null };
    }),

  /** Get all enriched author names */
  getAllEnrichedNames: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ authorName: authorProfiles.authorName })
      .from(authorProfiles)
      .where(isNotNull(authorProfiles.enrichedAt));
    return rows.map((r) => r.authorName);
  }),

  /** Get all author names that have a rich bio */
  getAllRichBioNames: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ authorName: authorProfiles.authorName })
      .from(authorProfiles)
      .where(isNotNull(authorProfiles.richBioJson));
    return rows.map((r) => r.authorName);
  }),

  /** Get enrichment freshness for all authors */
  getAllFreshness: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        authorName: authorProfiles.authorName,
        enrichedAt: authorProfiles.enrichedAt,
        lastLinksEnrichedAt: authorProfiles.lastLinksEnrichedAt,
        socialStatsEnrichedAt: authorProfiles.socialStatsEnrichedAt,
        academicResearchEnrichedAt: authorProfiles.academicResearchEnrichedAt,
        earningsCallMentionsEnrichedAt: authorProfiles.earningsCallMentionsEnrichedAt,
        professionalProfileEnrichedAt: authorProfiles.professionalProfileEnrichedAt,
        documentArchiveEnrichedAt: authorProfiles.documentArchiveEnrichedAt,
        businessProfileEnrichedAt: authorProfiles.businessProfileEnrichedAt,
      })
      .from(authorProfiles);
  }),

  /** Get all bios */
  getAllBios: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        authorName: authorProfiles.authorName,
        bio: authorProfiles.bio,
        richBioJson: authorProfiles.richBioJson,
      })
      .from(authorProfiles);
  }),

  /** Batch enrich a list of authors (up to 20 at a time) */
  enrichBatch: adminProcedure
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

      const existingRows = input.authorNames.length > 0
        ? await db
            .select()
            .from(authorProfiles)
            .where(inArray(authorProfiles.authorName, input.authorNames))
        : [];
      const existingMap = new Map(existingRows.map((r) => [r.authorName, r]));

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

      // Auto-mirror newly enriched author avatars to S3 in the background
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
              logger.info(`[auto-mirror] Mirrored ${mirrorResults.filter((r) => r.url).length} author avatars to S3`);
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

  /** Update a single author's online links */
  updateAuthorLinks: adminProcedure
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

  /** Update links for all authors in the database */
  updateAllAuthorLinks: adminProcedure
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
});

// ── Merged Router ──────────────────────────────────────────────────────────
// Merge the core CRUD router with the three sub-routers so that the
// existing frontend paths (authorProfiles.getAvatarMap, authorProfiles.enrichRichBio, etc.)
// continue to work without any client-side changes.
export const authorProfilesRouter = router({
  ...authorProfilesCoreRouter._def.procedures,
  ...authorAvatarRouter._def.procedures,
  ...authorEnrichmentRouter._def.procedures,
  ...authorSocialRouter._def.procedures,
});
