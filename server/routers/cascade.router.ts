/**
 * cascade.router.ts
 * Provides live DB statistics for the Research Cascade panel.
 * Each procedure returns counts that reflect how many authors/books
 * were resolved at each tier of the enrichment waterfall.
 *
 * OPTIMIZATION (T1-A): Uses SQL COUNT(CASE WHEN ...) aggregation instead of
 * fetching all rows and filtering in JavaScript. This reduces data transfer
 * from ~183 rows × 10 columns to a single aggregation row.
 */
import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";

export const cascadeRouter = router({
  /**
   * Returns live counts for the author avatar enrichment waterfall.
   * Single SQL aggregation query — no full-table fetch.
   */
  authorStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      total: 0, withPhoto: 0, withAvatar: 0, withS3Photo: 0, withS3Avatar: 0,
      withBio: 0, withEnrichedAt: 0, withSocialLinks: 0, noPhoto: 0, noAvatar: 0,
      noBio: 0, fromWikipedia: 0, fromTavily: 0, fromApify: 0, fromAI: 0, sourceUnknown: 0,
    };

    const [stats] = await db.select({
      total:           sql<number>`COUNT(*)`,
      withAvatar:      sql<number>`COUNT(CASE WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN 1 END)`,
      withS3Avatar:    sql<number>`COUNT(CASE WHEN s3_avatar_url IS NOT NULL AND s3_avatar_url != '' THEN 1 END)`,
      withBio:         sql<number>`COUNT(CASE WHEN bio IS NOT NULL AND bio != '' THEN 1 END)`,
      withEnrichedAt:  sql<number>`COUNT(CASE WHEN enriched_at IS NOT NULL THEN 1 END)`,
      withSocialLinks: sql<number>`COUNT(CASE WHEN (website_url IS NOT NULL AND website_url != '') OR (twitter_url IS NOT NULL AND twitter_url != '') OR (linkedin_url IS NOT NULL AND linkedin_url != '') THEN 1 END)`,
      noAvatar:        sql<number>`COUNT(CASE WHEN avatar_url IS NULL OR avatar_url = '' THEN 1 END)`,
      noBio:           sql<number>`COUNT(CASE WHEN bio IS NULL OR bio = '' THEN 1 END)`,
      fromWikipedia:   sql<number>`COUNT(CASE WHEN avatar_source = 'wikipedia' THEN 1 END)`,
      fromTavily:      sql<number>`COUNT(CASE WHEN avatar_source = 'tavily' THEN 1 END)`,
      fromApify:       sql<number>`COUNT(CASE WHEN avatar_source = 'apify' THEN 1 END)`,
      fromAI:          sql<number>`COUNT(CASE WHEN avatar_source = 'ai' THEN 1 END)`,
      sourceUnknown:   sql<number>`COUNT(CASE WHEN avatar_url IS NOT NULL AND avatar_url != '' AND (avatar_source IS NULL OR avatar_source = '') THEN 1 END)`,
    }).from(authorProfiles);

    // Drizzle returns sql<number> as string from MySQL — coerce to number
    const n = (v: unknown) => Number(v ?? 0);

    return {
      total:           n(stats.total),
      withAvatar:      n(stats.withAvatar),
      withS3Avatar:    n(stats.withS3Avatar),
      withBio:         n(stats.withBio),
      withEnrichedAt:  n(stats.withEnrichedAt),
      withSocialLinks: n(stats.withSocialLinks),
      noAvatar:        n(stats.noAvatar),
      noBio:           n(stats.noBio),
      fromWikipedia:   n(stats.fromWikipedia),
      fromTavily:      n(stats.fromTavily),
      fromApify:       n(stats.fromApify),
      fromAI:          n(stats.fromAI),
      sourceUnknown:   n(stats.sourceUnknown),
      // Legacy aliases for backward compat with ResearchCascade UI
      withPhoto:       n(stats.withAvatar),
      withS3Photo:     n(stats.withS3Avatar),
      noPhoto:         n(stats.noAvatar),
    };
  }),

  /**
   * Returns live counts for the book cover + metadata enrichment waterfall.
   * Single SQL aggregation query — no full-table fetch.
   * Enrichment level scoring is also done in SQL.
   */
  bookStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      total: 0, withCover: 0, withS3Cover: 0, withSummary: 0, withIsbn: 0,
      withAmazonUrl: 0, withRating: 0, withEnrichedAt: 0, withPublisher: 0,
      noCover: 0, noSummary: 0,
      enrichmentLevelCounts: { fullyEnriched: 0, wellEnriched: 0, partiallyEnriched: 0, basic: 0 },
    };

    const [stats] = await db.select({
      total:          sql<number>`COUNT(*)`,
      withCover:      sql<number>`COUNT(CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 END)`,
      withS3Cover:    sql<number>`COUNT(CASE WHEN s3_cover_url IS NOT NULL AND s3_cover_url != '' THEN 1 END)`,
      withSummary:    sql<number>`COUNT(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 END)`,
      withIsbn:       sql<number>`COUNT(CASE WHEN isbn IS NOT NULL AND isbn != '' THEN 1 END)`,
      withAmazonUrl:  sql<number>`COUNT(CASE WHEN amazon_url IS NOT NULL AND amazon_url != '' THEN 1 END)`,
      withRating:     sql<number>`COUNT(CASE WHEN rating IS NOT NULL THEN 1 END)`,
      withEnrichedAt: sql<number>`COUNT(CASE WHEN enriched_at IS NOT NULL THEN 1 END)`,
      withPublisher:  sql<number>`COUNT(CASE WHEN publisher IS NOT NULL AND publisher != '' THEN 1 END)`,
      noCover:        sql<number>`COUNT(CASE WHEN cover_image_url IS NULL OR cover_image_url = '' THEN 1 END)`,
      noSummary:      sql<number>`COUNT(CASE WHEN summary IS NULL OR summary = '' THEN 1 END)`,
      // Enrichment level scoring in SQL:
      // score = (has cover) + (has summary) + (has rating) + (has amazon_url) + (has published_date)
      // fullyEnriched: score >= 5, wellEnriched: score 3-4, partiallyEnriched: score 1-2, basic: score 0
      fullyEnriched:      sql<number>`COUNT(CASE WHEN (
        (CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) +
        (CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN amazon_url IS NOT NULL AND amazon_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN published_date IS NOT NULL AND published_date != '' THEN 1 ELSE 0 END)
      ) >= 5 THEN 1 END)`,
      wellEnriched:       sql<number>`COUNT(CASE WHEN (
        (CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) +
        (CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN amazon_url IS NOT NULL AND amazon_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN published_date IS NOT NULL AND published_date != '' THEN 1 ELSE 0 END)
      ) BETWEEN 3 AND 4 THEN 1 END)`,
      partiallyEnriched:  sql<number>`COUNT(CASE WHEN (
        (CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) +
        (CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN amazon_url IS NOT NULL AND amazon_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN published_date IS NOT NULL AND published_date != '' THEN 1 ELSE 0 END)
      ) BETWEEN 1 AND 2 THEN 1 END)`,
      basicEnriched:      sql<number>`COUNT(CASE WHEN (
        (CASE WHEN cover_image_url IS NOT NULL AND cover_image_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) +
        (CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN amazon_url IS NOT NULL AND amazon_url != '' THEN 1 ELSE 0 END) +
        (CASE WHEN published_date IS NOT NULL AND published_date != '' THEN 1 ELSE 0 END)
      ) = 0 THEN 1 END)`,
    }).from(bookProfiles);

    const n = (v: unknown) => Number(v ?? 0);

    return {
      total:          n(stats.total),
      withCover:      n(stats.withCover),
      withS3Cover:    n(stats.withS3Cover),
      withSummary:    n(stats.withSummary),
      withIsbn:       n(stats.withIsbn),
      withAmazonUrl:  n(stats.withAmazonUrl),
      withRating:     n(stats.withRating),
      withEnrichedAt: n(stats.withEnrichedAt),
      withPublisher:  n(stats.withPublisher),
      noCover:        n(stats.noCover),
      noSummary:      n(stats.noSummary),
      enrichmentLevelCounts: {
        fullyEnriched:     n(stats.fullyEnriched),
        wellEnriched:      n(stats.wellEnriched),
        partiallyEnriched: n(stats.partiallyEnriched),
        basic:             n(stats.basicEnriched),
      },
    };
  }),
});
