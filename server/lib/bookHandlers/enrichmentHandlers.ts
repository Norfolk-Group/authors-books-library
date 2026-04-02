import { getDb } from "../../db";
import { bookProfiles } from "../../../drizzle/schema";
import { eq, inArray, isNull, or } from "drizzle-orm";
import { mirrorBatchToS3 } from "../../mirrorToS3";
import { enrichBookViaGoogleBooks } from "../bookEnrichment";
import { enrichRichSummary } from "../../enrichment/richSummary";
import { parallelBatch } from "../parallelBatch";
import { logger } from "../logger";

export async function handleEnrich(input: {
  bookTitle: string;
  authorName?: string;
  model?: string;
  secondaryModel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (existing[0]?.enrichedAt && existing[0].enrichedAt > thirtyDaysAgo) {
    return { skipped: true, profile: existing[0] };
  }

  const enriched = await enrichBookViaGoogleBooks(input.bookTitle, input.authorName ?? "", input.model, input.secondaryModel);

  await db
    .insert(bookProfiles)
    .values({
      bookTitle: input.bookTitle,
      authorName: input.authorName ?? "",
      ...enriched,
      enrichedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        authorName: input.authorName ?? "",
        ...enriched,
        enrichedAt: new Date(),
      },
    });

  const updated = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);

  return { skipped: false, profile: updated[0] };
}

export async function handleEnrichBatch(input: {
  books: { bookTitle: string; authorName?: string }[];
  model?: string;
  secondaryModel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const results: { bookTitle: string; status: "enriched" | "skipped" | "error" }[] = [];

  // Pre-fetch all existing rows in a single query (avoids N+1 per-book lookup)
  const bookTitles = input.books.map((b) => b.bookTitle);
  const existingRows = bookTitles.length > 0
    ? await db
        .select()
        .from(bookProfiles)
        .where(inArray(bookProfiles.bookTitle, bookTitles))
    : [];
  const existingMap = new Map(existingRows.map((r) => [r.bookTitle, r]));

  for (const item of input.books) {
    try {
      const existing = existingMap.get(item.bookTitle);
      if (existing?.enrichedAt && existing.enrichedAt > thirtyDaysAgo) {
        results.push({ bookTitle: item.bookTitle, status: "skipped" });
        continue;
      }

      const enriched = await enrichBookViaGoogleBooks(item.bookTitle, item.authorName ?? "", input.model, input.secondaryModel);

      await db
        .insert(bookProfiles)
        .values({
          bookTitle: item.bookTitle,
          authorName: item.authorName ?? "",
          ...enriched,
          enrichedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            authorName: item.authorName ?? "",
            ...enriched,
            enrichedAt: new Date(),
          },
        });

      results.push({ bookTitle: item.bookTitle, status: "enriched" });
    } catch {
      results.push({ bookTitle: item.bookTitle, status: "error" });
    }
  }

  // Auto-mirror newly enriched covers to S3 in the background (fire-and-forget)
  const enrichedCount = results.filter((r) => r.status === "enriched").length;
  if (enrichedCount > 0) {
    void (async () => {
      try {
        const pending = await db
          .select({ id: bookProfiles.id, coverImageUrl: bookProfiles.coverImageUrl, s3CoverKey: bookProfiles.s3CoverKey })
          .from(bookProfiles)
          .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, "")))
          .limit(enrichedCount);
        const toMirror = pending.filter((b) => b.coverImageUrl?.startsWith("http"));
        if (toMirror.length > 0) {
          const mirrorResults = await mirrorBatchToS3(
            toMirror.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
            "book-covers"
          );
          for (const r of mirrorResults) {
            if (r.url && r.key) {
              await db.update(bookProfiles)
                .set({ s3CoverUrl: r.url, s3CoverKey: r.key })
                .where(eq(bookProfiles.id, r.id));
            }
          }
          logger.info(`[auto-mirror] Mirrored ${mirrorResults.filter((r) => r.url).length} book covers to S3`);
        }
      } catch (err) {
        console.error("[auto-mirror] Book cover mirror failed:", err);
      }
    })();
  }

  return results;
}

export async function handleUpdateBookSummary(input: {
  bookTitle: string;
  authorName?: string;
  researchVendor?: string;
  researchModel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { enrichBookSummary } = await import("../bookSummary");
  const result = await enrichBookSummary(
    input.bookTitle,
    input.authorName ?? "",
    input.researchVendor ?? "perplexity",
    input.researchModel ?? "sonar-pro"
  );
  if (!result.summary) throw new Error("Failed to generate summary");
  await db
    .update(bookProfiles)
    .set({
      summary: result.summary || undefined,
      keyThemes: result.keyThemes || undefined,
      rating: result.rating,
      ratingCount: result.ratingCount,
      publishedDate: result.publishedDate,
      publisher: result.publisher,
      isbn: result.isbn,
      amazonUrl: result.amazonUrl,
      goodreadsUrl: result.goodreadsUrl,
      wikipediaUrl: result.wikipediaUrl,
      publisherUrl: result.publisherUrl,
      summaryEnrichmentSource: result.source,
      lastSummaryEnrichedAt: new Date(),
      enrichedAt: new Date(),
    })
    .where(eq(bookProfiles.bookTitle, input.bookTitle));
  return { success: true, source: result.source, summary: result.summary };
}

export async function handleUpdateAllBookSummaries(input: {
  researchVendor?: string;
  researchModel?: string;
  onlyMissing?: boolean;
  concurrency?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { enrichBookSummary } = await import("../bookSummary");
  const books = input.onlyMissing
    ? await db
        .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
        .from(bookProfiles)
        .where(or(isNull(bookProfiles.summary), eq(bookProfiles.summary, "")))
    : await db
        .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
        .from(bookProfiles);
  const total = books.length;

  const batchResult = await parallelBatch(
    books.map((b) => `${b.bookTitle}|||${b.authorName ?? ""}`),
    input.concurrency ?? 3,
    async (key) => {
      const [bookTitle, authorName] = key.split("|||");
      const result = await enrichBookSummary(
        bookTitle,
        authorName,
        input.researchVendor ?? "perplexity",
        input.researchModel ?? "sonar-pro"
      );
      if (!result.summary) throw new Error("No summary returned");
      await db
        .update(bookProfiles)
        .set({
          summary: result.summary || undefined,
          keyThemes: result.keyThemes || undefined,
          rating: result.rating,
          ratingCount: result.ratingCount,
          publishedDate: result.publishedDate,
          publisher: result.publisher,
          isbn: result.isbn,
          amazonUrl: result.amazonUrl,
          goodreadsUrl: result.goodreadsUrl,
          wikipediaUrl: result.wikipediaUrl,
          publisherUrl: result.publisherUrl,
          summaryEnrichmentSource: result.source,
          lastSummaryEnrichedAt: new Date(),
          enrichedAt: new Date(),
        })
        .where(eq(bookProfiles.bookTitle, bookTitle));
      return { bookTitle, success: true };
    }
  );

  return { total, enriched: batchResult.succeeded, failed: batchResult.failed };
}

export async function handleEnrichAllMissingSummaries(input: { model?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find all books with no summary (or empty summary)
  const missing = await db
    .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName })
    .from(bookProfiles)
    .where(
      or(
        isNull(bookProfiles.summary),
        eq(bookProfiles.summary, "")
      )
    );

  const total = missing.length;

  const batchResult = await parallelBatch(
    missing.map((b) => `${b.bookTitle}|||${b.authorName ?? ""}`),
    3,
    async (key) => {
      const [bookTitle, authorName] = key.split("|||");
      const data = await enrichBookViaGoogleBooks(bookTitle, authorName, input.model);
      if (!data.summary) return { bookTitle, skipped: true };
      await db
        .update(bookProfiles)
        .set({ summary: data.summary, enrichedAt: new Date() })
        .where(eq(bookProfiles.bookTitle, bookTitle));
      return { bookTitle, skipped: false };
    }
  );

  const skipped = batchResult.results.filter((r) => r.result?.skipped).length;
  return {
    total,
    enriched: batchResult.succeeded - skipped,
    skipped,
    failed: batchResult.failed,
  };
}

export async function handleEnrichRichSummary(input: {
  bookTitle: string;
  authorName?: string;
  force?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle)).limit(1);
  if (!input.force && existing[0]?.richSummaryJson) {
    return { status: "skipped" as const, bookTitle: input.bookTitle };
  }
  const profile = existing[0];
  const result = await enrichRichSummary(
    input.bookTitle,
    input.authorName ?? profile?.authorName ?? "",
    profile?.summary,
    null
  );
  if (!result) return { status: "failed" as const, bookTitle: input.bookTitle };
  if (profile) {
    await db.update(bookProfiles)
      .set({ richSummaryJson: JSON.stringify(result), resourceLinksJson: JSON.stringify(result.resourceLinks) })
      .where(eq(bookProfiles.bookTitle, input.bookTitle));
  } else {
    await db.insert(bookProfiles).values({
      bookTitle: input.bookTitle,
      authorName: input.authorName ?? "",
      richSummaryJson: JSON.stringify(result),
      resourceLinksJson: JSON.stringify(result.resourceLinks),
    });
  }
  return { status: "enriched" as const, bookTitle: input.bookTitle };
}

export async function handleEnrichRichSummaryBatch(input: {
  limit?: number;
  force?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const allBooks = await db.select({
    bookTitle: bookProfiles.bookTitle,
    authorName: bookProfiles.authorName,
    summary: bookProfiles.summary,
    richSummaryJson: bookProfiles.richSummaryJson,
  }).from(bookProfiles);
  const toEnrich = input.force
    ? allBooks.slice(0, input.limit ?? 50)
    : allBooks.filter(b => !b.richSummaryJson).slice(0, input.limit ?? 50);
  let enriched = 0, skipped = 0, failed = 0;
  for (const book of toEnrich) {
    const result = await enrichRichSummary(
      book.bookTitle,
      book.authorName ?? "",
      book.summary,
      null
    );
    if (!result) { failed++; continue; }
    await db.update(bookProfiles)
      .set({ richSummaryJson: JSON.stringify(result), resourceLinksJson: JSON.stringify(result.resourceLinks) })
      .where(eq(bookProfiles.bookTitle, book.bookTitle));
    enriched++;
  }
  skipped = allBooks.length - toEnrich.length;
  return { enriched, skipped, failed, total: allBooks.length };
}

export async function handleGetRichSummary(input: { bookTitle: string }) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    richSummaryJson: bookProfiles.richSummaryJson,
    resourceLinksJson: bookProfiles.resourceLinksJson,
  }).from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle)).limit(1);
  return rows[0] ?? null;
}

export async function handleEnrichTechnicalReferences(input: { bookTitle: string }) {
  const { enrichTechnicalReferences } = await import("../../enrichment/context7");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [book] = await db
    .select()
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  if (!book) throw new Error(`Book not found: ${input.bookTitle}`);

  const result = await enrichTechnicalReferences(
    input.bookTitle,
    book.summary,
    book.keyThemes,
  );

  await db
    .update(bookProfiles)
    .set({
      technicalReferencesJson: JSON.stringify(result),
      technicalReferencesEnrichedAt: new Date(),
    })
    .where(eq(bookProfiles.bookTitle, input.bookTitle));

  return {
    bookTitle: input.bookTitle,
    referencesCount: result.totalReferences,
    technologies: result.technologies,
    source: result.source,
    fetchedAt: result.fetchedAt,
  };
}

export async function handleGetTechnicalReferences(input: { bookTitle: string }) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      technicalReferencesJson: bookProfiles.technicalReferencesJson,
      technicalReferencesEnrichedAt: bookProfiles.technicalReferencesEnrichedAt,
    })
    .from(bookProfiles)
    .where(eq(bookProfiles.bookTitle, input.bookTitle))
    .limit(1);
  if (!row?.technicalReferencesJson) return null;
  return {
    data: JSON.parse(row.technicalReferencesJson),
    enrichedAt: row.technicalReferencesEnrichedAt,
  };
}

export async function handleEnrichTechnicalReferencesBatch(input: {
  limit?: number;
  onlyMissing?: boolean;
}) {
  const { enrichTechnicalReferences } = await import("../../enrichment/context7");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const condition = input.onlyMissing
    ? isNull(bookProfiles.technicalReferencesEnrichedAt)
    : undefined;
  const rows = await db
    .select({
      bookTitle: bookProfiles.bookTitle,
      summary: bookProfiles.summary,
      keyThemes: bookProfiles.keyThemes,
    })
    .from(bookProfiles)
    .where(condition)
    .limit(input.limit ?? 20);

  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const result = await enrichTechnicalReferences(
        row.bookTitle,
        row.summary,
        row.keyThemes,
      );
      await db
        .update(bookProfiles)
        .set({
          technicalReferencesJson: JSON.stringify(result),
          technicalReferencesEnrichedAt: new Date(),
        })
        .where(eq(bookProfiles.bookTitle, row.bookTitle));
      succeeded++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 1500)); // GitHub rate limit
  }

  return { processed: rows.length, succeeded, failed };
}
