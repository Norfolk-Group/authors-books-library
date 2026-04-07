/**
 * humanReviewQueue.router.ts
 *
 * tRPC procedures for the Human Review Queue — the AI-to-human handoff layer.
 *
 * The AI pipeline automatically populates this queue with items that need
 * human judgment. Admins review, approve, reject, or skip each item.
 *
 * Procedures:
 *   getQueue        — list items by type/status with pagination
 *   getStats        — counts per reviewType and status
 *   updateStatus    — approve / reject / merge / skip an item
 *   addNotes        — add admin notes to an item
 *   runChatbotScan  — trigger AI scan for chatbot candidates
 *   runDuplicateScan — trigger AI scan for near-duplicates
 *   computeReadiness — compute RAG readiness for a single author
 *   getAllReadiness  — compute RAG readiness for all authors
 */

import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { humanReviewQueue } from "../../drizzle/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  computeRagReadiness,
  computeAllRagReadiness,
  flagChatbotCandidates,
} from "../services/ragReadiness.service";
import { runFullDuplicateScan } from "../services/semanticDuplicate.service";

const reviewTypeEnum = z.enum([
  "chatbot_candidate",
  "near_duplicate",
  "author_match",
  "url_quality",
  "content_classify",
  "link_merit",
]);

const statusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "merged",
  "skipped",
  "auto_resolved",
]);

export const humanReviewQueueRouter = router({
  /**
   * List review queue items with optional filters.
   */
  getQueue: adminProcedure
    .input(z.object({
      reviewType: reviewTypeEnum.optional(),
      status: statusEnum.optional().default("pending"),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.status) conditions.push(eq(humanReviewQueue.status, input.status));
      if (input.reviewType) conditions.push(eq(humanReviewQueue.reviewType, input.reviewType));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalRow] = await Promise.all([
        db
          .select()
          .from(humanReviewQueue)
          .where(whereClause)
          .orderBy(humanReviewQueue.priority, desc(humanReviewQueue.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: count() })
          .from(humanReviewQueue)
          .where(whereClause),
      ]);

      return {
        items,
        total: Number(totalRow[0]?.count ?? 0),
      };
    }),

  /**
   * Get counts per reviewType and status for the dashboard.
   */
  getStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { byType: [], byStatus: [], total: 0 };

      const byType = await db
        .select({
          reviewType: humanReviewQueue.reviewType,
          count: count(),
        })
        .from(humanReviewQueue)
        .where(eq(humanReviewQueue.status, "pending"))
        .groupBy(humanReviewQueue.reviewType);

      const byStatus = await db
        .select({
          status: humanReviewQueue.status,
          count: count(),
        })
        .from(humanReviewQueue)
        .groupBy(humanReviewQueue.status);

      const [totalRow] = await db
        .select({ count: count() })
        .from(humanReviewQueue)
        .where(eq(humanReviewQueue.status, "pending"));

      return {
        byType,
        byStatus,
        total: Number(totalRow?.count ?? 0),
      };
    }),

  /**
   * Update the status of a review item.
   */
  updateStatus: adminProcedure
    .input(z.object({
      id: z.number().int(),
      status: statusEnum,
      adminNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(humanReviewQueue)
        .set({
          status: input.status,
          adminNotes: input.adminNotes ?? undefined,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(humanReviewQueue.id, input.id));

      return { success: true };
    }),

  /**
   * Add or update admin notes on a review item.
   */
  addNotes: adminProcedure
    .input(z.object({
      id: z.number().int(),
      adminNotes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(humanReviewQueue)
        .set({ adminNotes: input.adminNotes, updatedAt: new Date() })
        .where(eq(humanReviewQueue.id, input.id));

      return { success: true };
    }),

  /**
   * Bulk update status for multiple items.
   */
  bulkUpdateStatus: adminProcedure
    .input(z.object({
      ids: z.array(z.number().int()).min(1).max(100),
      status: statusEnum,
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      let updated = 0;
      for (const id of input.ids) {
        await db
          .update(humanReviewQueue)
          .set({ status: input.status, reviewedAt: new Date(), updatedAt: new Date() })
          .where(eq(humanReviewQueue.id, id));
        updated++;
      }

      return { success: true, updated };
    }),

  /**
   * Trigger AI scan to find chatbot candidates.
   * Computes RAG readiness for all authors and flags those with score >= 50.
   */
  runChatbotScan: adminProcedure
    .mutation(async () => {
      const added = await flagChatbotCandidates(500);
      return { success: true, added };
    }),

  /**
   * Trigger AI scan for near-duplicate books or authors via Pinecone.
   */
  runDuplicateScan: adminProcedure
    .input(z.object({
      namespace: z.enum(["books", "authors"]).default("books"),
    }))
    .mutation(async ({ input }) => {
      const result = await runFullDuplicateScan(input.namespace);
      return { success: true, ...result };
    }),

  /**
   * Compute RAG readiness score for a single author.
   */
  computeReadiness: protectedProcedure
    .input(z.object({ authorName: z.string().min(1) }))
    .query(async ({ input }) => {
      return computeRagReadiness(input.authorName);
    }),

  /**
   * Compute RAG readiness scores for all authors.
   * Returns sorted by score descending.
   */
  getAllReadiness: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(200),
    }))
    .query(async ({ input }) => {
      return computeAllRagReadiness(input.limit);
    }),

  /**
   * Delete a review item (permanent — use with caution).
   */
  deleteItem: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(humanReviewQueue).where(eq(humanReviewQueue.id, input.id));
      return { success: true };
    }),
});
