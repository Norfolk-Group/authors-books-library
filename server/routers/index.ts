/**
 * App Router - combines all domain routers.
 * This file is the single source of truth for the tRPC router tree.
 *
 * Router files follow the pattern: <domain>.router.ts
 */
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { systemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { libraryRouter } from "./library.router";
import { authorProfilesRouter } from "./authorProfiles.router";
import { bookProfilesRouter } from "./bookProfiles.router";
import { apifyRouter } from "./apify.router";
import { llmRouter } from "./llm.router";
import { cascadeRouter } from "./cascade.router";
import { adminRouter } from "./admin.router";
import { favoritesRouter } from "./favorites.router";
import { schedulingRouter } from "./scheduling.router";
import { healthCheckRouter } from "./healthCheck.router";
import { contextualIntelligenceRouter } from "./contextualIntelligence.router";
import { ragPipelineRouter } from "./ragPipeline.router";
import { userInterestsRouter } from "./userInterests.router";
import { authorChatbotRouter } from "./authorChatbot.router";
import { syncJobsRouter } from "./syncJobs.router";
import { appSettingsRouter } from "./appSettings.router";
import { tagsRouter } from "./tags.router";
import { contentItemsRouter } from "./contentItems.router";
import { enrichmentRouter } from "./enrichment.router";
import { apiRegistryRouter } from "./apiRegistry.router";
import { magazineRouter } from "./magazine.router";
import { vectorSearchRouter } from "./vectorSearch.router";
import { substackRouter } from "./substack.router";
import { dropboxRouter } from "./dropbox.router";
import { duplicateDetectionRouter } from "./duplicateDetection.router";
import { s3AuditRouter } from "./s3Audit.router";
import { libraryCacheRouter } from "./libraryCache.router";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  library: libraryRouter,
  authorProfiles: authorProfilesRouter,
  bookProfiles: bookProfilesRouter,
  apify: apifyRouter,
  llm: llmRouter,
  cascade: cascadeRouter,
  admin: adminRouter,
  favorites: favoritesRouter,
  scheduling: schedulingRouter,
  healthCheck: healthCheckRouter,
  // ── New intelligence features ──────────────────────────────────────────────
  contextualIntelligence: contextualIntelligenceRouter,
  ragPipeline: ragPipelineRouter,
  userInterests: userInterestsRouter,
  authorChatbot: authorChatbotRouter,
  syncJobs: syncJobsRouter,
  appSettings: appSettingsRouter,
  tags: tagsRouter,
  contentItems: contentItemsRouter,
  enrichment: enrichmentRouter,
  apiRegistry: apiRegistryRouter,
  // ── Magazine article pipeline (Atlantic, New Yorker, Wired, NYT, WaPo) ──────
  magazine: magazineRouter,
  // ── Pinecone vector search + RAG indexing ─────────────────────────────────
  vectorSearch: vectorSearchRouter,
  // ── Substack RSS feeds ─────────────────────────────────────────────────────
  substack: substackRouter,
  // ── Dropbox backup service ─────────────────────────────────────────────────
  dropbox: dropboxRouter,
  // ── Library availability cache (OL, HathiTrust, WorldCat, news) ───────────
  duplicateDetection: duplicateDetectionRouter,
  // ── S3 CDN audit & migration ───────────────────────────────────────────────
  s3Audit: s3AuditRouter,
  libraryCache: libraryCacheRouter,
});

export type AppRouter = typeof appRouter;
