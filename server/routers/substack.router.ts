/**
 * substack.router.ts
 *
 * tRPC procedures for fetching Substack publication posts for authors.
 *
 * Procedures:
 *   - getPostsByAuthor(authorId, limit?) — reads substackUrl from DB, fetches RSS, returns posts
 *   - getPostsByUrl(substackUrl, limit?)  — fetch directly by URL (for preview/testing)
 *   - updateSubstackUrl(authorId, substackUrl) — admin: update the stored substackUrl
 */

import { logger } from "../lib/logger";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import {
  fetchSubstackPosts,
  extractSubstackSubdomain,
  type SubstackFeedResult,
} from "../services/substack.service";

export const substackRouter = router({
  /**
   * Fetch recent Substack posts for an author by their authorId.
   * Reads the stored substackUrl from the author_profiles table.
   */
  getPostsByAuthor: publicProcedure
    .input(
      z.object({
        authorId: z.number().int().positive(),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }): Promise<SubstackFeedResult | null> => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select({ substackUrl: authorProfiles.substackUrl })
        .from(authorProfiles)
        .where(eq(authorProfiles.id, input.authorId))
        .limit(1);

      const substackUrl = rows[0]?.substackUrl;
      if (!substackUrl) return null;

      const subdomain = extractSubstackSubdomain(substackUrl);
      if (!subdomain) return null;

      try {
        return await fetchSubstackPosts(substackUrl, input.limit);
      } catch (err) {
        // Return null rather than throwing — the panel will show a graceful empty state
        logger.warn(`[Substack] Failed to fetch posts for author ${input.authorId}:`, err);
        return null;
      }
    }),

  /**
   * Fetch Substack posts directly by URL — useful for admin preview before saving.
   */
  getPostsByUrl: publicProcedure
    .input(
      z.object({
        substackUrl: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }): Promise<SubstackFeedResult | null> => {
      try {
        return await fetchSubstackPosts(input.substackUrl, input.limit);
      } catch {
        return null;
      }
    }),

  /**
   * Admin: update the stored substackUrl for an author.
   */
  updateSubstackUrl: adminProcedure
    .input(
      z.object({
        authorId: z.number().int().positive(),
        substackUrl: z.string().max(512),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const cleanUrl = input.substackUrl.trim();

      // Validate the subdomain can be extracted
      if (cleanUrl && !extractSubstackSubdomain(cleanUrl)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot parse Substack subdomain from: "${cleanUrl}"`,
        });
      }

      await db
        .update(authorProfiles)
        .set({ substackUrl: cleanUrl || null })
        .where(eq(authorProfiles.id, input.authorId));

      return { success: true, substackUrl: cleanUrl || null };
    }),
});
