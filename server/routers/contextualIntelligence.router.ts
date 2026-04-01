/**
 * contextualIntelligence.router.ts
 *
 * tRPC procedures for the contextual intelligence enrichment pipeline:
 *   - enrich: Run the full 8-source pipeline for one author
 *   - enrichBatch: Run for multiple authors sequentially
 *   - getStatus: Get completeness scores for all authors
 *   - getByAuthor: Get the full contextual intelligence data for one author
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { enrichContextualIntelligence } from "../enrichment/contextualIntelligence";
import { logger } from "../lib/logger";

export const contextualIntelligenceRouter = router({
  /**
   * Enrich contextual intelligence for a single author.
   * Runs the full 8-source waterfall and stores results in author_profiles.
   */
  enrich: protectedProcedure
    .input(z.object({
      authorName: z.string().min(1),
      model: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await enrichContextualIntelligence(input.authorName, input.model);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(authorProfiles)
        .set({
          geographyJson: JSON.stringify(result.geography),
          historicalContextJson: JSON.stringify(result.historicalContext),
          familyJson: JSON.stringify(result.family),
          associationsJson: JSON.stringify(result.associations),
          formativeExperiencesJson: JSON.stringify(result.formativeExperiences),
          authorBioSourcesJson: JSON.stringify(result.rawSources),
          bioCompleteness: result.bioCompleteness,
          contextualIntelligenceEnrichedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        success: true,
        authorName: input.authorName,
        bioCompleteness: result.bioCompleteness,
        mentorCount: result.associations.mentors?.length ?? 0,
        formativeExperienceCount: result.formativeExperiences.length,
        enrichedAt: result.enrichedAt,
      };
    }),

  /**
   * Batch enrich contextual intelligence for multiple authors.
   * Processes sequentially to avoid rate limits.
   */
  enrichBatch: protectedProcedure
    .input(z.object({
      authorNames: z.array(z.string()).max(20),
      model: z.string().optional(),
      skipEnriched: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const results: Array<{ authorName: string; success: boolean; bioCompleteness?: number; error?: string }> = [];

      for (const authorName of input.authorNames) {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database unavailable");

          // Skip if already enriched (within last 30 days) when skipEnriched=true
          if (input.skipEnriched) {
            const existing = await db
              .select({ contextualIntelligenceEnrichedAt: authorProfiles.contextualIntelligenceEnrichedAt })
              .from(authorProfiles)
              .where(eq(authorProfiles.authorName, authorName))
              .limit(1);

            const enrichedAt = existing[0]?.contextualIntelligenceEnrichedAt;
            if (enrichedAt) {
              const daysSince = (Date.now() - new Date(enrichedAt).getTime()) / (1000 * 60 * 60 * 24);
              if (daysSince < 30) {
                results.push({ authorName, success: true, bioCompleteness: undefined });
                continue;
              }
            }
          }

          const result = await enrichContextualIntelligence(authorName, input.model);

          await db
            .update(authorProfiles)
            .set({
              geographyJson: JSON.stringify(result.geography),
              historicalContextJson: JSON.stringify(result.historicalContext),
              familyJson: JSON.stringify(result.family),
              associationsJson: JSON.stringify(result.associations),
              formativeExperiencesJson: JSON.stringify(result.formativeExperiences),
              authorBioSourcesJson: JSON.stringify(result.rawSources),
              bioCompleteness: result.bioCompleteness,
              contextualIntelligenceEnrichedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, authorName));

          results.push({ authorName, success: true, bioCompleteness: result.bioCompleteness });
        } catch (err) {
          logger.error(`[contextualIntel.router] Batch enrichment failed for "${authorName}":`, err);
          results.push({ authorName, success: false, error: String(err) });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return { results, succeeded, failed, total: input.authorNames.length };
    }),

  /**
   * Get contextual intelligence data for a single author.
   */
  getByAuthor: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select({
          geographyJson: authorProfiles.geographyJson,
          historicalContextJson: authorProfiles.historicalContextJson,
          familyJson: authorProfiles.familyJson,
          associationsJson: authorProfiles.associationsJson,
          formativeExperiencesJson: authorProfiles.formativeExperiencesJson,
          bioCompleteness: authorProfiles.bioCompleteness,
          contextualIntelligenceEnrichedAt: authorProfiles.contextualIntelligenceEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);

      if (!rows[0]) return null;

      const row = rows[0];
      return {
        geography: row.geographyJson ? JSON.parse(row.geographyJson) : null,
        historicalContext: row.historicalContextJson ? JSON.parse(row.historicalContextJson) : null,
        family: row.familyJson ? JSON.parse(row.familyJson) : null,
        associations: row.associationsJson ? JSON.parse(row.associationsJson) : null,
        formativeExperiences: row.formativeExperiencesJson ? JSON.parse(row.formativeExperiencesJson) : null,
        bioCompleteness: row.bioCompleteness ?? 0,
        enrichedAt: row.contextualIntelligenceEnrichedAt,
      };
    }),

  /**
   * Get bio completeness scores for all authors (for Admin heatmap/list).
   */
  getCompletenessScores: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          authorName: authorProfiles.authorName,
          bioCompleteness: authorProfiles.bioCompleteness,
          contextualIntelligenceEnrichedAt: authorProfiles.contextualIntelligenceEnrichedAt,
        })
        .from(authorProfiles)
        .orderBy(authorProfiles.authorName);

      return rows.map((r: typeof rows[number]) => ({
        authorName: r.authorName,
        bioCompleteness: r.bioCompleteness ?? 0,
        enrichedAt: r.contextualIntelligenceEnrichedAt,
        status: !r.contextualIntelligenceEnrichedAt
          ? "not_enriched"
          : (r.bioCompleteness ?? 0) >= 70
          ? "high"
          : (r.bioCompleteness ?? 0) >= 40
          ? "medium"
          : "low",
      }));
    }),
});
