import { getDb } from "../../db";
import { bookProfiles } from "../../../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";
import { mirrorBatchToS3 } from "../../mirrorToS3";
import { parallelBatch } from "../parallelBatch";
import { logger } from "../logger";

export async function handleMirrorCovers(input: { batchSize: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const pending = await db
    .select({
      id: bookProfiles.id,
      coverImageUrl: bookProfiles.coverImageUrl,
      s3CoverKey: bookProfiles.s3CoverKey,
    })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, "")))
    .limit(input.batchSize);
  const toMirror = pending.filter((b) => b.coverImageUrl?.startsWith("http"));
  if (toMirror.length === 0) {
    return { mirrored: 0, skipped: pending.length, failed: 0, total: pending.length };
  }
  const results = await mirrorBatchToS3(
    toMirror.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
    "book-covers"
  );
  let mirrored = 0;
  let failed = 0;
  for (const result of results) {
    if (result.url && result.key) {
      await db.update(bookProfiles)
        .set({ s3CoverUrl: result.url, s3CoverKey: result.key })
        .where(eq(bookProfiles.id, result.id));
      mirrored++;
    } else {
      failed++;
    }
  }
  return { mirrored, skipped: pending.length - toMirror.length, failed, total: pending.length };
}

export async function handleGetMirrorCoverStats() {
  const db = await getDb();
  if (!db) return { withCover: 0, mirrored: 0, pending: 0 };
  const all = await db
    .select({ coverImageUrl: bookProfiles.coverImageUrl, s3CoverUrl: bookProfiles.s3CoverUrl })
    .from(bookProfiles);
  const withCover = all.filter((b) => b.coverImageUrl?.startsWith("http")).length;
  const mirrored = all.filter((b) => b.s3CoverUrl?.startsWith("http")).length;
  return { withCover, mirrored, pending: withCover - mirrored };
}

export async function handleRebuildAllBookCovers(input: { concurrency: number; rescrapeAll: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { upgradeAmazonImageResolution, scrapeAmazonBook } = await import("../../apify");

  // ── Step 1: Upgrade all low-res Amazon URLs in-place ──────────────────
  const allBooks = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, coverImageUrl: bookProfiles.coverImageUrl })
    .from(bookProfiles);

  let upgraded = 0;
  const upgradeUpdates: Promise<unknown>[] = [];
  for (const book of allBooks) {
    if (!book.coverImageUrl || !book.coverImageUrl.startsWith('http')) continue;
    const upgraded_url = upgradeAmazonImageResolution(book.coverImageUrl);
    if (upgraded_url !== book.coverImageUrl) {
      upgradeUpdates.push(
        db.update(bookProfiles)
          .set({ coverImageUrl: upgraded_url, s3CoverUrl: null, s3CoverKey: null })
          .where(eq(bookProfiles.id, book.id))
      );
      upgraded++;
    }
  }
  // Also null out S3 mirrors for books being re-scraped (rescrapeAll mode)
  if (input.rescrapeAll) {
    for (const book of allBooks) {
      upgradeUpdates.push(
        db.update(bookProfiles)
          .set({ coverImageUrl: null, s3CoverUrl: null, s3CoverKey: null })
          .where(eq(bookProfiles.id, book.id))
      );
    }
  }
  await Promise.all(upgradeUpdates);
  logger.info(`[rebuild-covers] Upgraded ${upgraded} low-res Amazon URLs to _SX600_`);

  // ── Step 2: Re-scrape books with failed/missing covers ─────────────────
  const needsScrape = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, coverImageUrl: bookProfiles.coverImageUrl })
    .from(bookProfiles)
    .where(
      or(
        isNull(bookProfiles.coverImageUrl),
        eq(bookProfiles.coverImageUrl, ''),
        eq(bookProfiles.coverImageUrl, 'not-found'),
        eq(bookProfiles.coverImageUrl, 'skipped'),
      )
    );

  // Build a lookup map for id by bookTitle
  const bookIdMap = new Map(needsScrape.map((b) => [b.bookTitle, b.id]));
  const bookAuthorMap = new Map(needsScrape.map((b) => [b.bookTitle, b.authorName ?? '']));

  const scrapeResult = await parallelBatch(
    needsScrape.map((b) => b.bookTitle),
    input.concurrency,
    async (title) => {
      const author = bookAuthorMap.get(title) ?? '';
      const bookId = bookIdMap.get(title)!;
      // Skip obviously bad titles
      const isSkippable =
        /^bk_rand_/i.test(title) ||
        /^Book PDF$/i.test(title) ||
        title === author ||
        /open.graph/i.test(title);
      if (isSkippable) {
        logger.info(`[rebuild-covers] Skipping bad title: "${title}"`);
        return { bookTitle: title, status: 'skipped' as const };
      }
      const result = await scrapeAmazonBook(title, author);
      if (result?.coverUrl) {
        await db.update(bookProfiles)
          .set({
            coverImageUrl: result.coverUrl,
            amazonUrl: result.amazonUrl ?? undefined,
            s3CoverUrl: null,
            s3CoverKey: null,
            enrichedAt: new Date(),
          })
          .where(eq(bookProfiles.id, bookId));
        return { bookTitle: title, status: 'scraped' as const };
      } else {
        await db.update(bookProfiles)
          .set({ coverImageUrl: 'not-found', enrichedAt: new Date() })
          .where(eq(bookProfiles.id, bookId));
        return { bookTitle: title, status: 'not-found' as const };
      }
    }
  );

  const scraped = scrapeResult.results.filter((r) => r.result?.status === 'scraped').length;
  const notFound = scrapeResult.results.filter((r) => r.result?.status === 'not-found').length;
  logger.info(`[rebuild-covers] Re-scraped ${scraped} covers, ${notFound} not found`);

  // ── Step 3: Re-mirror all covers that lost their S3 URL ────────────────
  const toMirror = await db
    .select({ id: bookProfiles.id, coverImageUrl: bookProfiles.coverImageUrl, s3CoverKey: bookProfiles.s3CoverKey })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.s3CoverUrl), eq(bookProfiles.s3CoverUrl, '')));

  const mirrorCandidates = toMirror.filter((b) => b.coverImageUrl?.startsWith('http'));
  let mirrored = 0;
  let mirrorFailed = 0;

  // Mirror in batches of 10 to avoid overwhelming S3
  const MIRROR_BATCH = 10;
  for (let i = 0; i < mirrorCandidates.length; i += MIRROR_BATCH) {
    const batch = mirrorCandidates.slice(i, i + MIRROR_BATCH);
    const results = await mirrorBatchToS3(
      batch.map((b) => ({ id: b.id, sourceUrl: b.coverImageUrl!, existingKey: b.s3CoverKey })),
      'book-covers'
    );
    for (const r of results) {
      if (r.url && r.key) {
        await db.update(bookProfiles)
          .set({ s3CoverUrl: r.url, s3CoverKey: r.key })
          .where(eq(bookProfiles.id, r.id));
        mirrored++;
      } else {
        mirrorFailed++;
      }
    }
  }
  logger.info(`[rebuild-covers] Mirrored ${mirrored} covers to S3, ${mirrorFailed} failed`);

  return {
    total: allBooks.length,
    upgraded,
    scraped,
    notFound,
    mirrored,
    mirrorFailed,
  };
}
