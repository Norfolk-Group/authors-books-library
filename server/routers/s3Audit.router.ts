/**
 * S3 CDN Audit Router
 *
 * Provides admin procedures to:
 *   1. Audit author avatars and book covers — identify which ones are NOT on S3
 *   2. Re-upload non-S3 assets to S3 and update the DB with the new CDN URLs
 *   3. Report summary statistics on CDN coverage
 */

import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { isNull, or, sql } from "drizzle-orm";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the URL is already on the Manus/Forge S3 CDN */
function isS3Url(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("forge-api") ||
    url.includes("manus.space") ||
    url.includes("amazonaws.com") ||
    url.includes("s3.") ||
    url.includes("cdn.")
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export const s3AuditRouter = router({
  /**
   * Audit all author avatars and book covers.
   * Returns counts of S3 vs non-S3 assets and a list of non-S3 items.
   */
  auditAssets: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Audit author avatars
    const authors = await db
      .select({
        id: authorProfiles.id,
        authorName: authorProfiles.authorName,
        avatarUrl: authorProfiles.avatarUrl,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
      })
      .from(authorProfiles)
      .limit(5000);

    const avatarAudit = authors.map((a) => ({
      id: a.id,
      name: a.authorName,
      type: "avatar" as const,
      currentUrl: a.avatarUrl ?? null,
      s3Url: a.s3AvatarUrl ?? null,
      onS3: isS3Url(a.s3AvatarUrl),
      hasAnyUrl: !!(a.avatarUrl || a.s3AvatarUrl),
    }));

    // Audit book covers
    const books = await db
      .select({
        id: bookProfiles.id,
        bookTitle: bookProfiles.bookTitle,
        coverImageUrl: bookProfiles.coverImageUrl,
        s3CoverUrl: bookProfiles.s3CoverUrl,
      })
      .from(bookProfiles)
      .limit(5000);

    const coverAudit = books.map((b) => ({
      id: b.id,
      name: b.bookTitle,
      type: "cover" as const,
      currentUrl: b.coverImageUrl ?? null,
      s3Url: b.s3CoverUrl ?? null,
      onS3: isS3Url(b.s3CoverUrl),
      hasAnyUrl: !!(b.coverImageUrl || b.s3CoverUrl),
    }));

    const allItems = [...avatarAudit, ...coverAudit];
    const onS3Count = allItems.filter((i) => i.onS3).length;
    const notOnS3 = allItems.filter((i) => !i.onS3 && i.hasAnyUrl);
    const noImage = allItems.filter((i) => !i.hasAnyUrl);

    return {
      summary: {
        total: allItems.length,
        onS3: onS3Count,
        notOnS3: notOnS3.length,
        noImage: noImage.length,
        coveragePercent: allItems.length > 0 ? Math.round((onS3Count / allItems.length) * 100) : 0,
      },
      notOnS3Items: notOnS3.slice(0, 100), // Return first 100 for display
      noImageItems: noImage.slice(0, 50),
    };
  }),

  /**
   * Re-upload non-S3 author avatars to S3.
   * Processes up to `limit` avatars per call.
   */
  migrateAvatarsToS3: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Find authors with avatarUrl but no s3AvatarUrl (or non-S3 s3AvatarUrl)
      const authors = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          avatarUrl: authorProfiles.avatarUrl,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
        })
        .from(authorProfiles)
        .limit(input.limit * 3); // Fetch more to account for filtering

      const toMirror = authors
        .filter((a) => a.avatarUrl && !isS3Url(a.s3AvatarUrl))
        .slice(0, input.limit)
        .map((a) => ({
          id: a.id,
          sourceUrl: a.avatarUrl!,
          existingKey: null as string | null,
        }));

      if (toMirror.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, errors: [] };
      }

      const results = await mirrorBatchToS3(toMirror, "author-avatars");
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const result of results) {
        if (result.url && result.key) {
          try {
            await db
              .update(authorProfiles)
              .set({ s3AvatarUrl: result.url })
              .where(eq(authorProfiles.id, result.id));
            succeeded++;
          } catch (err) {
            failed++;
            errors.push(`Author ${result.id}: DB update failed`);
          }
        } else {
          failed++;
          errors.push(`Author ${result.id}: Mirror failed — ${result.error ?? "unknown"}`);
        }
      }

      return { processed: toMirror.length, succeeded, failed, errors };
    }),

  /**
   * Re-upload non-S3 book covers to S3.
   * Processes up to `limit` covers per call.
   */
  migrateCoversToS3: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const books = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          coverImageUrl: bookProfiles.coverImageUrl,
          s3CoverUrl: bookProfiles.s3CoverUrl,
          s3CoverKey: bookProfiles.s3CoverKey,
        })
        .from(bookProfiles)
        .limit(input.limit * 3);

      const toMirror = books
        .filter((b) => b.coverImageUrl && !isS3Url(b.s3CoverUrl))
        .slice(0, input.limit)
        .map((b) => ({
          id: b.id,
          sourceUrl: b.coverImageUrl!,
          existingKey: b.s3CoverKey ?? null,
        }));

      if (toMirror.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, errors: [] };
      }

      const results = await mirrorBatchToS3(toMirror, "book-covers");
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const result of results) {
        if (result.url && result.key) {
          try {
            await db
              .update(bookProfiles)
              .set({ s3CoverUrl: result.url, s3CoverKey: result.key })
              .where(eq(bookProfiles.id, result.id));
            succeeded++;
          } catch (err) {
            failed++;
            errors.push(`Book ${result.id}: DB update failed`);
          }
        } else {
          failed++;
          errors.push(`Book ${result.id}: Mirror failed — ${result.error ?? "unknown"}`);
        }
      }

      return { processed: toMirror.length, succeeded, failed, errors };
    }),
});
