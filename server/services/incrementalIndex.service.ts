/**
 * incrementalIndex.service.ts
 *
 * Incremental Pinecone indexing — fires after a book or author is saved.
 *
 * These functions are designed to be called as a fire-and-forget side effect
 * from the create/update mutation handlers. They do NOT block the save
 * operation and silently swallow errors to avoid breaking the main flow.
 *
 * Usage:
 *   // In bookProfiles.router.ts after handleCreateBook/handleUpdateBook:
 *   indexBookIncremental(book.id, book.bookTitle, book.authorName, book.summary).catch(() => {});
 *
 *   // In authorProfiles.router.ts after createAuthor/updateAuthor:
 *   indexAuthorIncremental(author.id, author.authorName, author.bio).catch(() => {});
 */

import { indexBook, indexAuthor } from "./ragPipeline.service";
import { checkBookDuplicate, checkAuthorDuplicate } from "./semanticDuplicate.service";

/**
 * Index a book in Pinecone after it is created or updated.
 * Also triggers semantic duplicate detection.
 * Non-blocking — all errors are caught and logged.
 */
export async function indexBookIncremental(
  bookId: number,
  bookTitle: string,
  authorName: string | null | undefined,
  summary: string | null | undefined,
  keyThemes?: string | null,
  // T2-A metadata fields (optional)
  meta?: { category?: string; enrichedAt?: string }
): Promise<void> {
  try {
    const text = [summary, keyThemes].filter(Boolean).join(" ") || bookTitle;
    if (text.length < 30) return;

    await indexBook({
      bookId: String(bookId),
      title: bookTitle,
      authorName: authorName ?? undefined,
      text,
      category: meta?.category,
      enrichedAt: meta?.enrichedAt,
    });

    // After indexing, check for near-duplicates
    await checkBookDuplicate(bookTitle);
  } catch (err) {
    console.warn(`[incrementalIndex] indexBookIncremental failed for "${bookTitle}":`, err);
  }
}

/**
 * Index an author in Pinecone after they are created or updated.
 * Also triggers semantic duplicate detection.
 * Non-blocking — all errors are caught and logged.
 */
export async function indexAuthorIncremental(
  authorId: number,
  authorName: string,
  bio: string | null | undefined,
  richBioJson?: string | null,
  // T2-A metadata fields (optional)
  meta?: { category?: string; bookCount?: number; enrichedAt?: string }
): Promise<void> {
  try {
    let bioText = bio ?? "";

    // Prefer richBioJson.fullBio if available
    try {
      if (richBioJson) {
        const rich = typeof richBioJson === "string" ? JSON.parse(richBioJson) : richBioJson;
        const richBio = rich?.fullBio ?? rich?.bio ?? "";
        if (richBio.length > bioText.length) bioText = richBio;
      }
    } catch { /* use plain bio */ }

    if (bioText.length < 50) return;

    await indexAuthor({
      authorId: String(authorId),
      authorName,
      bioText,
      category: meta?.category,
      bookCount: meta?.bookCount,
      enrichedAt: meta?.enrichedAt,
    });

    // After indexing, check for near-duplicates
    await checkAuthorDuplicate(authorName);
  } catch (err) {
    console.warn(`[incrementalIndex] indexAuthorIncremental failed for "${authorName}":`, err);
  }
}
