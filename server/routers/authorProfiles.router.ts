import { z } from "zod";
import { eq, isNull, isNotNull, or, sql, inArray, desc } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { enrichAuthorViaWikipedia } from "../lib/authorEnrichment";
import { parallelBatch } from "../lib/parallelBatch";
import { logger } from "../lib/logger";
import { validateAuthorName } from "../../shared/authorNameValidator";

// Sub-routers (split for maintainability)
import { authorAvatarRouter } from "./authorAvatar.router";
// Incremental Pinecone indexing (fire-and-forget)
import { indexAuthorIncremental } from "../services/incrementalIndex.service";
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
      // Re-index in Pinecone with fresh bio
      if (updated[0]?.bio) {
        indexAuthorIncremental(updated[0].id, updated[0].authorName, updated[0].bio, updated[0].richBioJson).catch(() => {});
      }
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
          mediumUrl: result.mediumUrl,
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
              mediumUrl: result.mediumUrl,
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

  /** Create a new author profile manually */
  createAuthor: adminProcedure
    .input(
      z.object({
        authorName: z.string().min(1).max(256),
        category: z.string().optional(),
        bio: z.string().optional(),
        websiteUrl: z.string().url().optional().or(z.literal("")),
        twitterUrl: z.string().url().optional().or(z.literal("")),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        youtubeUrl: z.string().url().optional().or(z.literal("")),
        substackUrl: z.string().url().optional().or(z.literal("")),
        mediumUrl: z.string().url().optional().or(z.literal("")),
        instagramUrl: z.string().url().optional().or(z.literal("")),
        tiktokUrl: z.string().url().optional().or(z.literal("")),
        facebookUrl: z.string().url().optional().or(z.literal("")),
        githubUrl: z.string().url().optional().or(z.literal("")),
        podcastUrl: z.string().url().optional().or(z.literal("")),
        newsletterUrl: z.string().url().optional().or(z.literal("")),
        blogUrl: z.string().url().optional().or(z.literal("")),
        speakingUrl: z.string().url().optional().or(z.literal("")),
        businessWebsiteUrl: z.string().url().optional().or(z.literal("")),
        avatarUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Guardrail: reject names that are clearly not a person
      // Admin users can bypass by passing allowAdminOverride (handled client-side via the flag below)
      const nameCheck = validateAuthorName(input.authorName);
      if (!nameCheck.valid) {
        throw new Error(`Invalid author name: ${nameCheck.reason}. If this is intentional, contact an admin.`);
      }
      const existing = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (existing.length > 0) throw new Error(`Author "${input.authorName}" already exists`);
      const clean = (v: string | undefined) => (v === "" ? null : v ?? null);
      await db.insert(authorProfiles).values({
        authorName: input.authorName,
        bio: clean(input.bio),
        websiteUrl: clean(input.websiteUrl),
        twitterUrl: clean(input.twitterUrl),
        linkedinUrl: clean(input.linkedinUrl),
        youtubeUrl: clean(input.youtubeUrl),
        substackUrl: clean(input.substackUrl),
        mediumUrl: clean(input.mediumUrl),
        instagramUrl: clean(input.instagramUrl),
        tiktokUrl: clean(input.tiktokUrl),
        facebookUrl: clean(input.facebookUrl),
        githubUrl: clean(input.githubUrl),
        podcastUrl: clean(input.podcastUrl),
        newsletterUrl: clean(input.newsletterUrl),
        blogUrl: clean(input.blogUrl),
        speakingUrl: clean(input.speakingUrl),
        businessWebsiteUrl: clean(input.businessWebsiteUrl),
        avatarUrl: clean(input.avatarUrl),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const rows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      const created = rows[0];
      // Fire-and-forget: index in Pinecone and check for near-duplicates
      if (created) {
        indexAuthorIncremental(created.id, created.authorName, created.bio, created.richBioJson).catch(() => {});
      }
      return created;
    }),

  /** Update an existing author profile */
  updateAuthor: adminProcedure
    .input(
      z.object({
        authorName: z.string().min(1),
        bio: z.string().optional(),
        websiteUrl: z.string().url().optional().or(z.literal("")),
        twitterUrl: z.string().url().optional().or(z.literal("")),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        youtubeUrl: z.string().url().optional().or(z.literal("")),
        substackUrl: z.string().url().optional().or(z.literal("")),
        mediumUrl: z.string().url().optional().or(z.literal("")),
        instagramUrl: z.string().url().optional().or(z.literal("")),
        tiktokUrl: z.string().url().optional().or(z.literal("")),
        facebookUrl: z.string().url().optional().or(z.literal("")),
        githubUrl: z.string().url().optional().or(z.literal("")),
        podcastUrl: z.string().url().optional().or(z.literal("")),
        newsletterUrl: z.string().url().optional().or(z.literal("")),
        blogUrl: z.string().url().optional().or(z.literal("")),
        speakingUrl: z.string().url().optional().or(z.literal("")),
        businessWebsiteUrl: z.string().url().optional().or(z.literal("")),
        avatarUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const clean = (v: string | undefined) => (v === "" ? null : v ?? undefined);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.bio !== undefined) patch.bio = input.bio || null;
      if (input.websiteUrl !== undefined) patch.websiteUrl = clean(input.websiteUrl);
      if (input.twitterUrl !== undefined) patch.twitterUrl = clean(input.twitterUrl);
      if (input.linkedinUrl !== undefined) patch.linkedinUrl = clean(input.linkedinUrl);
      if (input.youtubeUrl !== undefined) patch.youtubeUrl = clean(input.youtubeUrl);
      if (input.substackUrl !== undefined) patch.substackUrl = clean(input.substackUrl);
      if (input.mediumUrl !== undefined) patch.mediumUrl = clean(input.mediumUrl);
      if (input.instagramUrl !== undefined) patch.instagramUrl = clean(input.instagramUrl);
      if (input.tiktokUrl !== undefined) patch.tiktokUrl = clean(input.tiktokUrl);
      if (input.facebookUrl !== undefined) patch.facebookUrl = clean(input.facebookUrl);
      if (input.githubUrl !== undefined) patch.githubUrl = clean(input.githubUrl);
      if (input.podcastUrl !== undefined) patch.podcastUrl = clean(input.podcastUrl);
      if (input.newsletterUrl !== undefined) patch.newsletterUrl = clean(input.newsletterUrl);
      if (input.blogUrl !== undefined) patch.blogUrl = clean(input.blogUrl);
      if (input.speakingUrl !== undefined) patch.speakingUrl = clean(input.speakingUrl);
      if (input.businessWebsiteUrl !== undefined) patch.businessWebsiteUrl = clean(input.businessWebsiteUrl);
      if (input.avatarUrl !== undefined) patch.avatarUrl = clean(input.avatarUrl);
      await db
        .update(authorProfiles)
        .set(patch)
        .where(eq(authorProfiles.authorName, input.authorName));
      const rows = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      const updated = rows[0] ?? null;
      // Fire-and-forget: re-index in Pinecone after update
      if (updated && input.bio !== undefined) {
        indexAuthorIncremental(updated.id, updated.authorName, updated.bio, updated.richBioJson).catch(() => {});
      }
      return updated;
    }),

  /** Delete an author profile by name */
  deleteAuthor: adminProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName));
      return { success: true, authorName: input.authorName };
    }),
});

// NOTE: createAuthor, updateAuthor, deleteAuthor are in authorProfilesCoreRouter above
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
