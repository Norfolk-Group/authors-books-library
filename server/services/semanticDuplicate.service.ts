/**
 * semanticDuplicate.service.ts
 *
 * Near-duplicate detection using Neon pgvector semantic similarity.
 *
 * When a new book or author is saved, this service:
 *   1. Embeds the entity's text (title + summary, or name + bio)
 *   2. Queries Neon pgvector for the top-5 nearest vectors in the same namespace
 *   3. Flags any result with cosine similarity >= SIMILARITY_THRESHOLD
 *   4. Inserts a near_duplicate review item into human_review_queue
 *
 * This runs asynchronously after the DB insert/update — it does NOT block
 * the save operation.
 */

import { getDb } from "../db";
import {
  humanReviewQueue,
  bookProfiles,
  authorProfiles,
} from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { embedText } from "./ragPipeline.service";
import { queryVectors } from "./neonVector.service";

/** Cosine similarity threshold above which two entities are considered near-duplicates */
const SIMILARITY_THRESHOLD = 0.92;

/**
 * Check a newly saved book for near-duplicates in Neon pgvector.
 * Runs asynchronously — does not throw on failure.
 */
export async function checkBookDuplicate(bookTitle: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const [book] = await db
      .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary })
      .from(bookProfiles)
      .where(eq(bookProfiles.bookTitle, bookTitle))
      .limit(1);
    if (!book) return;

    const textToEmbed = [book.bookTitle, book.authorName, book.summary]
      .filter(Boolean)
      .join(" — ");
    if (textToEmbed.length < 10) return;

    const embedding = await embedText(textToEmbed);
    const results = await queryVectors(embedding, "books", { topK: 5 });

    for (const result of results) {
      if (result.score < SIMILARITY_THRESHOLD) continue;
      // Skip self-match
      if (result.metadata.sourceId === String(book.id)) continue;

      // Check if already flagged
      const existing = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(
          and(
            eq(humanReviewQueue.entityName, book.bookTitle),
            eq(humanReviewQueue.reviewType, "near_duplicate"),
            eq(humanReviewQueue.status, "pending")
          )
        )
        .limit(1);
      if (existing.length > 0) continue;

      await db.insert(humanReviewQueue).values({
        reviewType: "near_duplicate",
        status: "pending",
        entityName: book.bookTitle,
        entityType: "book",
        secondaryEntityName: result.metadata.title,
        secondaryEntityType: "book",
        aiConfidence: String(result.score.toFixed(3)),
        aiReason: `"${book.bookTitle}" is semantically similar to "${result.metadata.title}" ` +
          `(cosine similarity: ${(result.score * 100).toFixed(1)}%). ` +
          `These may be the same book under different titles or editions.`,
        aiSuggestedAction: result.score >= 0.97
          ? "Very likely duplicate — consider merging into the canonical entry."
          : "Possible duplicate — review both entries and decide whether to merge.",
        metadataJson: JSON.stringify({
          similarityScore: result.score,
          namespace: "books",
          primaryId: String(book.id),
          secondaryId: result.metadata.sourceId,
          primaryTitle: book.bookTitle,
          secondaryTitle: result.metadata.title,
          secondaryAuthor: result.metadata.authorName,
        }),
        sourceJob: "checkBookDuplicate",
        priority: result.score >= 0.97 ? 1 : 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    // Non-blocking — log but don't propagate
    console.warn("[semanticDuplicate] checkBookDuplicate failed:", err);
  }
}

/**
 * Check a newly saved author for near-duplicates in Neon pgvector.
 * Runs asynchronously — does not throw on failure.
 */
export async function checkAuthorDuplicate(authorName: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const [author] = await db
      .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, bio: authorProfiles.bio })
      .from(authorProfiles)
      .where(eq(authorProfiles.authorName, authorName))
      .limit(1);
    if (!author) return;

    const textToEmbed = [author.authorName, author.bio?.slice(0, 500)]
      .filter(Boolean)
      .join(" — ");
    if (textToEmbed.length < 10) return;

    const embedding = await embedText(textToEmbed);
    const results = await queryVectors(embedding, "authors", { topK: 5 });

    for (const result of results) {
      if (result.score < SIMILARITY_THRESHOLD) continue;
      if (result.metadata.sourceId === String(author.id)) continue;

      const existing = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(
          and(
            eq(humanReviewQueue.entityName, author.authorName),
            eq(humanReviewQueue.reviewType, "near_duplicate"),
            eq(humanReviewQueue.status, "pending")
          )
        )
        .limit(1);
      if (existing.length > 0) continue;

      await db.insert(humanReviewQueue).values({
        reviewType: "near_duplicate",
        status: "pending",
        entityName: author.authorName,
        entityType: "author",
        secondaryEntityName: result.metadata.authorName ?? result.metadata.title,
        secondaryEntityType: "author",
        aiConfidence: String(result.score.toFixed(3)),
        aiReason: `"${author.authorName}" is semantically similar to "${result.metadata.authorName ?? result.metadata.title}" ` +
          `(cosine similarity: ${(result.score * 100).toFixed(1)}%). ` +
          `These may be the same person under different name variants.`,
        aiSuggestedAction: result.score >= 0.97
          ? "Very likely duplicate — consider merging into the canonical entry."
          : "Possible duplicate — review both entries and decide whether to merge.",
        metadataJson: JSON.stringify({
          similarityScore: result.score,
          namespace: "authors",
          primaryId: String(author.id),
          secondaryId: result.metadata.sourceId,
          primaryName: author.authorName,
          secondaryName: result.metadata.authorName ?? result.metadata.title,
        }),
        sourceJob: "checkAuthorDuplicate",
        priority: result.score >= 0.97 ? 1 : 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    console.warn("[semanticDuplicate] checkAuthorDuplicate failed:", err);
  }
}

/**
 * Run a full near-duplicate scan across all books in Neon pgvector.
 * Returns the number of new review items created.
 */
export async function runFullDuplicateScan(namespace: "books" | "authors" = "books"): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  if (!db) return { checked: 0, flagged: 0 };

  let checked = 0;
  let flagged = 0;

  if (namespace === "books") {
    const books = await db
      .select({ bookTitle: bookProfiles.bookTitle })
      .from(bookProfiles)
      .limit(500);

    for (const { bookTitle } of books) {
      const before = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(and(eq(humanReviewQueue.entityName, bookTitle), eq(humanReviewQueue.reviewType, "near_duplicate")));
      await checkBookDuplicate(bookTitle);
      const after = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(and(eq(humanReviewQueue.entityName, bookTitle), eq(humanReviewQueue.reviewType, "near_duplicate")));
      if (after.length > before.length) flagged++;
      checked++;
    }
  } else {
    const authors = await db
      .select({ authorName: authorProfiles.authorName })
      .from(authorProfiles)
      .limit(500);

    for (const { authorName } of authors) {
      const before = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(and(eq(humanReviewQueue.entityName, authorName), eq(humanReviewQueue.reviewType, "near_duplicate")));
      await checkAuthorDuplicate(authorName);
      const after = await db
        .select({ id: humanReviewQueue.id })
        .from(humanReviewQueue)
        .where(and(eq(humanReviewQueue.entityName, authorName), eq(humanReviewQueue.reviewType, "near_duplicate")));
      if (after.length > before.length) flagged++;
      checked++;
    }
  }

  return { checked, flagged };
}
