/**
 * duplicateDetection.service.ts
 *
 * Detects duplicate books (book_profiles) and content files (content_files)
 * using four complementary detection layers:
 *
 *   1. Content hash match  — exact byte-for-byte duplicate (content_files only)
 *   2. Filename match      — same normalised filename (content_files only)
 *   3. ISBN match          — normalised ISBN-10/13 (book_profiles only)
 *   4. Fuzzy title match   — Levenshtein similarity >= 0.85 (book_profiles only)
 */

import { getDb } from "../db";
import { bookProfiles, contentFiles } from "../../drizzle/schema";
import { isNull, eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export type DuplicateBookResult = {
  candidateId: number;
  canonicalId: number;
  candidateTitle: string;
  canonicalTitle: string;
  detectionMethod: "isbn" | "fuzzy_title";
  score?: number;
};

export type DuplicateFileResult = {
  candidateId: number;
  canonicalId: number;
  candidateFilename: string;
  canonicalFilename: string;
  detectionMethod: "hash" | "filename";
};

export type DuplicateScanSummary = {
  bookDuplicates: DuplicateBookResult[];
  fileDuplicates: DuplicateFileResult[];
  scannedBooks: number;
  scannedFiles: number;
  flaggedBooks: number;
  flaggedFiles: number;
  durationMs: number;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "").toUpperCase();
}

export function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const FUZZY_THRESHOLD = 0.85;

export async function detectBookDuplicates(): Promise<DuplicateBookResult[]> {
  const db = await getDb();
  if (!db) return [];

  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, isbn: bookProfiles.isbn })
    .from(bookProfiles)
    .where(isNull(bookProfiles.duplicateOfId));

  const results: DuplicateBookResult[] = [];

  const isbnMap = new Map<string, { id: number; bookTitle: string }>();
  for (const book of books) {
    if (!book.isbn) continue;
    const normalizedIsbn = normalizeIsbn(book.isbn);
    if (!normalizedIsbn) continue;
    const existing = isbnMap.get(normalizedIsbn);
    if (existing) {
      results.push({ candidateId: book.id, canonicalId: existing.id, candidateTitle: book.bookTitle ?? "", canonicalTitle: existing.bookTitle, detectionMethod: "isbn" });
    } else {
      isbnMap.set(normalizedIsbn, { id: book.id, bookTitle: book.bookTitle ?? "" });
    }
  }

  const flaggedIds = new Set(results.map(r => r.candidateId));
  const unflagged = books.filter(b => !flaggedIds.has(b.id));
  const seen: Array<{ id: number; normalizedTitle: string; originalTitle: string }> = [];

  for (const book of unflagged) {
    if (!book.bookTitle) continue;
    const normalizedTitle = normalizeTitle(book.bookTitle);
    let matched = false;
    for (const prev of seen) {
      const score = similarityScore(normalizedTitle, prev.normalizedTitle);
      if (score >= FUZZY_THRESHOLD) {
        results.push({ candidateId: book.id, canonicalId: prev.id, candidateTitle: book.bookTitle, canonicalTitle: prev.originalTitle, detectionMethod: "fuzzy_title", score });
        matched = true;
        break;
      }
    }
    if (!matched) seen.push({ id: book.id, normalizedTitle, originalTitle: book.bookTitle });
  }

  return results;
}

export async function detectFileDuplicates(): Promise<DuplicateFileResult[]> {
  const db = await getDb();
  if (!db) return [];

  const files = await db
    .select({ id: contentFiles.id, filename: contentFiles.originalFilename, contentHash: contentFiles.contentHash })
    .from(contentFiles)
    .where(isNull(contentFiles.duplicateOfId));

  const results: DuplicateFileResult[] = [];

  const hashMap = new Map<string, { id: number; filename: string }>();
  for (const file of files) {
    if (!file.contentHash) continue;
    const existing = hashMap.get(file.contentHash);
    if (existing) {
      results.push({ candidateId: file.id, canonicalId: existing.id, candidateFilename: file.filename ?? "", canonicalFilename: existing.filename, detectionMethod: "hash" });
    } else {
      hashMap.set(file.contentHash, { id: file.id, filename: file.filename ?? "" });
    }
  }

  const flaggedIds = new Set(results.map(r => r.candidateId));
  const unflagged = files.filter(f => !flaggedIds.has(f.id));
  const filenameMap = new Map<string, { id: number; filename: string }>();

  for (const file of unflagged) {
    if (!file.filename) continue;
    const normalizedName = normalizeFilename(file.filename);
    if (!normalizedName) continue;
    const existing = filenameMap.get(normalizedName);
    if (existing) {
      results.push({ candidateId: file.id, canonicalId: existing.id, candidateFilename: file.filename, canonicalFilename: existing.filename, detectionMethod: "filename" });
    } else {
      filenameMap.set(normalizedName, { id: file.id, filename: file.filename });
    }
  }

  return results;
}

export async function runDuplicateScan(): Promise<DuplicateScanSummary> {
  const start = Date.now();
  const db = await getDb();
  if (!db) return { bookDuplicates: [], fileDuplicates: [], scannedBooks: 0, scannedFiles: 0, flaggedBooks: 0, flaggedFiles: 0, durationMs: 0 };

  const [bookCount, fileCount] = await Promise.all([
    db.select({ id: bookProfiles.id }).from(bookProfiles).then(r => r.length),
    db.select({ id: contentFiles.id }).from(contentFiles).then(r => r.length),
  ]);

  const [bookDuplicates, fileDuplicates] = await Promise.all([detectBookDuplicates(), detectFileDuplicates()]);
  const durationMs = Date.now() - start;
  logger.info(`[duplicateDetection] Scan: ${bookDuplicates.length} book dupes, ${fileDuplicates.length} file dupes in ${durationMs}ms`);

  return { bookDuplicates, fileDuplicates, scannedBooks: bookCount, scannedFiles: fileCount, flaggedBooks: bookDuplicates.length, flaggedFiles: fileDuplicates.length, durationMs };
}

export async function flagBookDuplicate(candidateId: number, canonicalId: number, method: "isbn" | "fuzzy_title"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(bookProfiles).set({ duplicateOfId: canonicalId, duplicateDetectionMethod: method, duplicateStatus: "pending", duplicateFlaggedAt: new Date() }).where(eq(bookProfiles.id, candidateId));
}

export async function resolveBookDuplicate(candidateId: number, action: "keep" | "discard" | "replace"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (action === "keep") {
    await db.update(bookProfiles).set({ duplicateOfId: null, duplicateDetectionMethod: null, duplicateStatus: null, duplicateFlaggedAt: null }).where(eq(bookProfiles.id, candidateId));
  } else {
    await db.update(bookProfiles).set({ duplicateStatus: action }).where(eq(bookProfiles.id, candidateId));
  }
}

export async function flagFileDuplicate(candidateId: number, canonicalId: number, method: "hash" | "filename"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(contentFiles).set({ duplicateOfId: canonicalId, duplicateDetectionMethod: method, duplicateStatus: "pending", duplicateFlaggedAt: new Date() }).where(eq(contentFiles.id, candidateId));
}

export async function resolveFileDuplicate(candidateId: number, action: "keep" | "discard" | "replace"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (action === "keep") {
    await db.update(contentFiles).set({ duplicateOfId: null, duplicateDetectionMethod: null, duplicateStatus: null, duplicateFlaggedAt: null }).where(eq(contentFiles.id, candidateId));
  } else {
    await db.update(contentFiles).set({ duplicateStatus: action }).where(eq(contentFiles.id, candidateId));
  }
}

export async function getPendingBookDuplicates() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, isbn: bookProfiles.isbn, duplicateOfId: bookProfiles.duplicateOfId, duplicateDetectionMethod: bookProfiles.duplicateDetectionMethod, duplicateStatus: bookProfiles.duplicateStatus, duplicateFlaggedAt: bookProfiles.duplicateFlaggedAt })
    .from(bookProfiles)
    .where(eq(bookProfiles.duplicateStatus, "pending"));
}
