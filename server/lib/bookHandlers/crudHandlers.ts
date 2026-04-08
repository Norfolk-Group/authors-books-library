import { getDb } from "../../db";
import { bookProfiles } from "../../../drizzle/schema";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { indexBookIncremental } from "../../services/incrementalIndex.service";
import { checkBookDuplicate } from "../../services/semanticDuplicate.service";

export async function handleGet(input: { bookTitle: string }) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  return rows[0] ?? null;
}

export async function handleGetMany(input: { bookTitles: string[] }) {
  if (input.bookTitles.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookProfiles)
    .where(inArray(bookProfiles.bookTitle, input.bookTitles));
}

export async function handleGetAllEnrichedTitles() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ bookTitle: bookProfiles.bookTitle })
    .from(bookProfiles)
    .where(isNotNull(bookProfiles.enrichedAt));
  return rows.map((r: { bookTitle: string }) => r.bookTitle);
}

export async function handleGetAllFreshness() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      bookTitle: bookProfiles.bookTitle,
      enrichedAt: bookProfiles.enrichedAt,
      lastSummaryEnrichedAt: bookProfiles.lastSummaryEnrichedAt,
      richSummaryJson: bookProfiles.richSummaryJson,
    })
    .from(bookProfiles);
  return rows.map((r) => {
    let richSummaryEnrichedAt: string | null = null;
    if (r.richSummaryJson) {
      try {
        const parsed = JSON.parse(r.richSummaryJson);
        richSummaryEnrichedAt = parsed.enrichedAt || null;
      } catch { /* ignore */ }
    }
    return {
      bookTitle: r.bookTitle,
      enrichedAt: r.enrichedAt,
      lastSummaryEnrichedAt: r.lastSummaryEnrichedAt,
      richSummaryEnrichedAt,
    };
  });
}

export async function handleGetSummaryStats() {
  const db = await getDb();
  if (!db) return { total: 0, withSummary: 0, missingSummary: 0 };
  const all = await db
    .select({ summary: bookProfiles.summary })
    .from(bookProfiles);
  const withSummary = all.filter((b) => b.summary && b.summary.trim().length > 0).length;
  return { total: all.length, withSummary, missingSummary: all.length - withSummary };
}

export async function handleCreateBook(input: {
  bookTitle: string;
  authorName?: string;
  summary?: string;
  keyThemes?: string;
  amazonUrl?: string;
  goodreadsUrl?: string;
  wikipediaUrl?: string;
  publisherUrl?: string;
  coverImageUrl?: string;
  isbn?: string;
  publishedDate?: string;
  publisher?: string;
  rating?: number;
  format?: "physical" | "digital" | "audio" | "physical_digital" | "physical_audio" | "digital_audio" | "all" | "none";
  possessionStatus?: "owned" | "wishlist" | "reference" | "borrowed" | "gifted" | "read" | "reading" | "unread";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db
    .select({ bookTitle: bookProfiles.bookTitle })
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  if (existing.length > 0) throw new Error(`Book "${input.bookTitle}" already exists`);
  const clean = (v: string | undefined) => (v === "" ? null : v ?? null);
  await db.insert(bookProfiles).values({
    bookTitle: input.bookTitle,
    authorName: input.authorName ?? null,
    summary: clean(input.summary),
    keyThemes: clean(input.keyThemes),
    amazonUrl: clean(input.amazonUrl),
    goodreadsUrl: clean(input.goodreadsUrl),
    wikipediaUrl: clean(input.wikipediaUrl),
    publisherUrl: clean(input.publisherUrl),
    coverImageUrl: clean(input.coverImageUrl),
    isbn: clean(input.isbn),
    publishedDate: clean(input.publishedDate),
    publisher: clean(input.publisher),
    rating: input.rating != null ? String(input.rating) : null,
    format: input.format ?? null,
    possessionStatus: input.possessionStatus ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const rows = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  const created = rows[0];
  // P3: Near-duplicate detection — fire-and-forget, flags similar books in review queue
  if (created) {
    checkBookDuplicate(created.bookTitle).catch(() => {});
  }
  return created;
}

export async function handleUpdateBook(input: {
  bookTitle: string;
  authorName?: string;
  summary?: string;
  keyThemes?: string;
  amazonUrl?: string;
  goodreadsUrl?: string;
  wikipediaUrl?: string;
  publisherUrl?: string;
  coverImageUrl?: string;
  isbn?: string;
  publishedDate?: string;
  publisher?: string;
  rating?: number;
  format?: "physical" | "digital" | "audio" | "physical_digital" | "physical_audio" | "digital_audio" | "all" | "none" | null;
  possessionStatus?: "owned" | "wishlist" | "reference" | "borrowed" | "gifted" | "read" | "reading" | "unread" | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const clean = (v: string | undefined) => (v === "" ? null : v ?? undefined);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.authorName !== undefined) patch.authorName = input.authorName || null;
  if (input.summary !== undefined) patch.summary = input.summary || null;
  if (input.keyThemes !== undefined) patch.keyThemes = input.keyThemes || null;
  if (input.amazonUrl !== undefined) patch.amazonUrl = clean(input.amazonUrl);
  if (input.goodreadsUrl !== undefined) patch.goodreadsUrl = clean(input.goodreadsUrl);
  if (input.wikipediaUrl !== undefined) patch.wikipediaUrl = clean(input.wikipediaUrl);
  if (input.publisherUrl !== undefined) patch.publisherUrl = clean(input.publisherUrl);
  if (input.coverImageUrl !== undefined) patch.coverImageUrl = clean(input.coverImageUrl);
  if (input.isbn !== undefined) patch.isbn = input.isbn || null;
  if (input.publishedDate !== undefined) patch.publishedDate = input.publishedDate || null;
  if (input.publisher !== undefined) patch.publisher = input.publisher || null;
  if (input.rating !== undefined) patch.rating = input.rating ?? null;
  if (input.format !== undefined) patch.format = input.format ?? null;
  if (input.possessionStatus !== undefined) patch.possessionStatus = input.possessionStatus ?? null;
  await db
    .update(bookProfiles)
    .set(patch)
    .where(eq(bookProfiles.bookTitle, input.bookTitle));
  const rows = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  const updated = rows[0] ?? null;
  // Re-index in Pinecone if semantic content changed
  if (updated && (input.summary !== undefined || input.keyThemes !== undefined)) {
    indexBookIncremental(updated.id, updated.bookTitle, updated.authorName, updated.summary, updated.keyThemes ?? undefined).catch(() => {});
    // P3: Near-duplicate detection after summary update
    checkBookDuplicate(updated.bookTitle).catch(() => {});
  }
  return updated;
}

export async function handleDeleteBook(input: { bookTitle: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .delete(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle));
  return { success: true, bookTitle: input.bookTitle };
}

export async function handleGetReadingNotes(input: { bookTitle: string }) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      readingNotesJson: bookProfiles.readingNotesJson,
      readingNotesSyncedAt: bookProfiles.readingNotesSyncedAt,
    })
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  if (!row?.readingNotesJson) return null;
  return {
    data: JSON.parse(row.readingNotesJson),
    syncedAt: row.readingNotesSyncedAt,
  };
}

export async function handleSyncReadingNotes(input: { bookTitle: string; notionPageId: string }) {
  const { pullNotesFromNotion } = await import("../../enrichment/notion");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const notes = await pullNotesFromNotion(input.notionPageId);
  if (!notes) throw new Error("Failed to pull notes from Notion");

  await db
    .update(bookProfiles)
    .set({
      readingNotesJson: JSON.stringify(notes),
      readingNotesSyncedAt: new Date(),
    })
    .where(eq(bookProfiles.bookTitle, input.bookTitle));

  return {
    bookTitle: input.bookTitle,
    hasNotes: !!notes.notes,
    highlightsCount: notes.highlights.length,
    status: notes.status,
    syncedAt: notes.lastEditedAt,
  };
}
