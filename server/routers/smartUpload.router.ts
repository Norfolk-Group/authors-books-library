/**
 * Smart Upload Router
 *
 * Handles the lifecycle of AI-classified file uploads:
 * 1. list — paginated list of upload jobs
 * 2. getById — single upload job details
 * 3. classify — re-run AI classification on an existing upload
 * 4. updateOverride — admin overrides AI classification
 * 5. commit — commit a reviewed upload to the target DB table + Pinecone (auto-indexed)
 * 6. reject — mark an upload as rejected
 * 7. delete — remove a staging upload
 * 8. stats — summary counts by status
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { smartUploads, authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { classifyFile, enrichClassificationWithDbMatches } from "../services/aiFileClassifier.service";
import { storagePut } from "../storage";
import {
  indexAuthorIncremental,
  indexBookIncremental,
} from "../services/incrementalIndex.service";
import {
  indexRagFile,
  indexContentItem,
} from "../services/ragPipeline.service";

// ── Pinecone auto-index helper ────────────────────────────────────────────────

/**
 * After a commit succeeds, trigger the correct Pinecone indexing function
 * based on the upload's pineconeNamespace and content type.
 * Runs fire-and-forget — never throws, so it never blocks the commit response.
 */
async function triggerPineconeIndexing(upload: {
  pineconeNamespace: string | null;
  shouldIndexPinecone: boolean | null;
  aiContentType: string | null;
  overrideContentType: string | null;
  matchedAuthorId: number | null;
  confirmedAuthorId: number | null;
  matchedBookId: number | null;
  confirmedBookId: number | null;
  finalS3Url: string | null;
  originalFilename: string;
  aiSuggestedAuthorName: string | null;
  aiSuggestedBookTitle: string | null;
}): Promise<{ indexed: boolean; namespace: string | null; vectorCount: number }> {
  if (!upload.shouldIndexPinecone || !upload.pineconeNamespace) {
    return { indexed: false, namespace: null, vectorCount: 0 };
  }

  const namespace = upload.pineconeNamespace;
  const authorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
  const bookId = upload.confirmedBookId ?? upload.matchedBookId;
  const contentType = upload.overrideContentType ?? upload.aiContentType;

  try {
    const db = await getDb();
    if (!db) return { indexed: false, namespace, vectorCount: 0 };

    switch (namespace) {
      case "authors": {
        if (!authorId) {
          console.warn("[SmartUpload] Pinecone authors index skipped — no authorId");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        // Fetch the author's current bio from DB
        const rows = await db
          .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, bio: authorProfiles.bio })
          .from(authorProfiles)
          .where(eq(authorProfiles.id, authorId))
          .limit(1);
        const author = rows[0];
        if (!author?.bio) {
          console.warn(`[SmartUpload] Pinecone authors index skipped — author ${authorId} has no bio`);
          return { indexed: false, namespace, vectorCount: 0 };
        }
        await indexAuthorIncremental(author.id, author.authorName, author.bio);
        console.log(`[SmartUpload] ✅ Indexed author ${author.authorName} to Pinecone (authors namespace)`);
        return { indexed: true, namespace, vectorCount: 1 };
      }

      case "books": {
        if (!bookId) {
          console.warn("[SmartUpload] Pinecone books index skipped — no bookId");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        // Fetch the book's current summary from DB
        const rows = await db
          .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary })
          .from(bookProfiles)
          .where(eq(bookProfiles.id, bookId))
          .limit(1);
        const book = rows[0];
        if (!book?.summary) {
          console.warn(`[SmartUpload] Pinecone books index skipped — book ${bookId} has no summary`);
          return { indexed: false, namespace, vectorCount: 0 };
        }
        await indexBookIncremental(book.id, book.bookTitle, book.authorName ?? "", book.summary);
        console.log(`[SmartUpload] ✅ Indexed book "${book.bookTitle}" to Pinecone (books namespace)`);
        return { indexed: true, namespace, vectorCount: 1 };
      }

      case "rag_files": {
        // For RAG files, we need the text content — use the S3 URL as the source reference
        const authorName = upload.aiSuggestedAuthorName ?? upload.originalFilename;
        if (!upload.finalS3Url) {
          console.warn("[SmartUpload] Pinecone rag_files index skipped — no S3 URL");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        // Fetch the text content from S3
        const res = await fetch(upload.finalS3Url);
        if (!res.ok) {
          console.warn(`[SmartUpload] Pinecone rag_files index skipped — could not fetch S3 content (${res.status})`);
          return { indexed: false, namespace, vectorCount: 0 };
        }
        const ragContent = await res.text();
        if (!ragContent || ragContent.length < 50) {
          console.warn("[SmartUpload] Pinecone rag_files index skipped — content too short");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        const vectorCount = await indexRagFile({ authorName, ragContent });
        console.log(`[SmartUpload] ✅ Indexed RAG file "${authorName}" to Pinecone (rag_files namespace, ${vectorCount} vectors)`);
        return { indexed: true, namespace, vectorCount };
      }

      case "content_items": {
        // Index as a generic content item
        const title = upload.aiSuggestedBookTitle ?? upload.aiSuggestedAuthorName ?? upload.originalFilename;
        const authorName = upload.aiSuggestedAuthorName ?? "Unknown";
        if (!upload.finalS3Url) {
          console.warn("[SmartUpload] Pinecone content_items index skipped — no S3 URL");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        const res = await fetch(upload.finalS3Url);
        if (!res.ok) {
          console.warn(`[SmartUpload] Pinecone content_items index skipped — could not fetch S3 content (${res.status})`);
          return { indexed: false, namespace, vectorCount: 0 };
        }
        const text = await res.text();
        if (!text || text.length < 50) {
          console.warn("[SmartUpload] Pinecone content_items index skipped — content too short");
          return { indexed: false, namespace, vectorCount: 0 };
        }
        const vectorCount = await indexContentItem({
          itemId: upload.originalFilename.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
          title,
          authorName,
          contentType: contentType ?? "upload",
          description: text,
        });
        console.log(`[SmartUpload] ✅ Indexed content item "${title}" to Pinecone (content_items namespace, ${vectorCount} vectors)`);
        return { indexed: true, namespace, vectorCount };
      }

      default:
        console.warn(`[SmartUpload] Unknown Pinecone namespace: ${namespace}`);
        return { indexed: false, namespace, vectorCount: 0 };
    }
  } catch (err) {
    // Never block the commit — log and return gracefully
    console.error(`[SmartUpload] Pinecone indexing failed for namespace "${namespace}":`, err);
    return { indexed: false, namespace, vectorCount: 0 };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const smartUploadRouter = router({
  /** List all uploads with pagination */
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "classifying", "review", "committed", "rejected", "error", "all"])
          .optional()
          .default("all"),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions =
        input.status !== "all" ? [eq(smartUploads.status, input.status as any)] : [];

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(smartUploads)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(smartUploads.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: count() })
          .from(smartUploads)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      return {
        items: rows,
        total: totalResult[0]?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /** Get a single upload by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Stats: counts by status */
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db
      .select({
        status: smartUploads.status,
        count: count(),
      })
      .from(smartUploads)
      .groupBy(smartUploads.status);

    const result: Record<string, number> = {
      pending: 0,
      classifying: 0,
      review: 0,
      committed: 0,
      rejected: 0,
      error: 0,
    };
    for (const row of rows) {
      if (row.status) result[row.status] = row.count;
    }
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    return result;
  }),

  /** Re-run AI classification on an existing upload */
  classify: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      const upload = rows[0];
      if (!upload) throw new Error("Upload not found");

      // Set status to classifying
      await db
        .update(smartUploads)
        .set({ status: "classifying" })
        .where(eq(smartUploads.id, input.id));

      try {
        const classification = await classifyFile({
          filename: upload.originalFilename,
          mimeType: upload.mimeType,
          fileSizeBytes: upload.fileSizeBytes,
        });

        const { matchedAuthorId, matchedBookId } =
          await enrichClassificationWithDbMatches(classification);

        await db
          .update(smartUploads)
          .set({
            status: "review",
            aiContentType: classification.contentType as any,
            aiConfidence: classification.confidence,
            aiReasoning: classification.reasoning,
            aiClassificationJson: JSON.stringify(classification),
            aiSuggestedAuthorName: classification.suggestedAuthorName,
            aiSuggestedBookTitle: classification.suggestedBookTitle,
            matchedAuthorId,
            matchedBookId,
            targetTable: classification.targetTable,
            shouldIndexPinecone: classification.shouldIndexPinecone,
            pineconeNamespace: classification.pineconeNamespace,
            shouldMirrorDropbox: true,
            suggestedDropboxPath: classification.suggestedDropboxPath,
            classifiedAt: new Date(),
          })
          .where(eq(smartUploads.id, input.id));

        return { success: true, classification };
      } catch (err) {
        await db
          .update(smartUploads)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Classification failed",
          })
          .where(eq(smartUploads.id, input.id));
        throw err;
      }
    }),

  /** Admin override of AI classification */
  updateOverride: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        overrideContentType: z.string().optional(),
        confirmedAuthorId: z.number().nullable().optional(),
        confirmedBookId: z.number().nullable().optional(),
        shouldIndexPinecone: z.boolean().optional(),
        pineconeNamespace: z.string().nullable().optional(),
        shouldMirrorDropbox: z.boolean().optional(),
        suggestedDropboxPath: z.string().nullable().optional(),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updates } = input;
      await db
        .update(smartUploads)
        .set(updates as any)
        .where(eq(smartUploads.id, id));

      return { success: true };
    }),

  /** Commit a reviewed upload to the target DB + Pinecone (auto-indexed) */
  commit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(smartUploads)
        .where(eq(smartUploads.id, input.id))
        .limit(1);
      const upload = rows[0];
      if (!upload) throw new Error("Upload not found");
      if (upload.status !== "review") throw new Error("Upload must be in review status to commit");

      // Determine effective values (override takes precedence over AI)
      const contentType = upload.overrideContentType ?? upload.aiContentType;
      const authorId = upload.confirmedAuthorId ?? upload.matchedAuthorId;
      const bookId = upload.confirmedBookId ?? upload.matchedBookId;

      let committedRecordId: number | null = null;

      try {
        // ── Step 1: Route to the correct DB table based on content type ──────
        switch (contentType) {
          case "author_avatar": {
            if (!authorId) throw new Error("Author ID required for avatar upload");
            if (!upload.finalS3Url) throw new Error("No S3 URL available for avatar");
            await db
              .update(authorProfiles)
              .set({
                s3AvatarUrl: upload.finalS3Url,
                s3AvatarKey: upload.finalS3Key ?? undefined,
                avatarSource: "drive" as any,
              })
              .where(eq(authorProfiles.id, authorId));
            committedRecordId = authorId;
            break;
          }
          case "book_cover": {
            if (!bookId) throw new Error("Book ID required for cover upload");
            if (!upload.finalS3Url) throw new Error("No S3 URL available for cover");
            await db
              .update(bookProfiles)
              .set({ coverImageUrl: upload.finalS3Url } as any)
              .where(eq(bookProfiles.id, bookId));
            committedRecordId = bookId;
            break;
          }
          default:
            // For other types (rag_files, content_items, etc.), DB routing is handled by Pinecone indexing below
            committedRecordId = upload.id;
        }

        // ── Step 2: Mark as committed in DB ──────────────────────────────────
        await db
          .update(smartUploads)
          .set({
            status: "committed",
            committedRecordId,
            reviewedAt: new Date(),
          })
          .where(eq(smartUploads.id, input.id));

        // ── Step 3: Auto-index to Pinecone (fire-and-forget, never blocks) ───
        const pineconeResult = await triggerPineconeIndexing({
          pineconeNamespace: upload.pineconeNamespace,
          shouldIndexPinecone: upload.shouldIndexPinecone,
          aiContentType: upload.aiContentType,
          overrideContentType: upload.overrideContentType,
          matchedAuthorId: upload.matchedAuthorId,
          confirmedAuthorId: upload.confirmedAuthorId,
          matchedBookId: upload.matchedBookId,
          confirmedBookId: upload.confirmedBookId,
          finalS3Url: upload.finalS3Url,
          originalFilename: upload.originalFilename,
          aiSuggestedAuthorName: upload.aiSuggestedAuthorName,
          aiSuggestedBookTitle: upload.aiSuggestedBookTitle,
        });

        return {
          success: true,
          committedRecordId,
          pinecone: pineconeResult,
        };
      } catch (err) {
        await db
          .update(smartUploads)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Commit failed",
          })
          .where(eq(smartUploads.id, input.id));
        throw err;
      }
    }),

  /** Reject an upload */
  reject: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(smartUploads)
        .set({
          status: "rejected",
          adminNotes: input.reason,
          reviewedAt: new Date(),
        })
        .where(eq(smartUploads.id, input.id));
      return { success: true };
    }),

  /** Delete an upload record */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(smartUploads).where(eq(smartUploads.id, input.id));
      return { success: true };
    }),

  /** List all authors for the override dropdowns */
  listAuthors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: authorProfiles.id, name: authorProfiles.authorName })
      .from(authorProfiles)
      .orderBy(authorProfiles.authorName)
      .limit(300);
  }),

  /** List all books for the override dropdowns */
  listBooks: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: bookProfiles.id, title: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
      .from(bookProfiles)
      .orderBy(bookProfiles.bookTitle)
      .limit(500);
  }),
});
