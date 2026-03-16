/**
 * App Router — combines all domain routers.
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
});

export type AppRouter = typeof appRouter;
