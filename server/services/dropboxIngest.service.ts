/**
 * Dropbox Inbox Ingestion Service
 *
 * Workflow for each PDF found in the Dropbox Inbox:
 *   1. Download the PDF from Dropbox
 *   2. Upload it to S3 (content_files table)
 *   3. Use LLM to extract title, authors, description, category from filename
 *   4. For each author:
 *      a. Check if author already exists in author_profiles
 *      b. If not, create a new author profile
 *      c. Trigger avatar waterfall (Wikipedia → Tavily → AI)
 *   5. Create or update book_profiles entry
 *   6. Link authors to content item via author_content_links
 *   7. Scrape Amazon for book cover (if missing)
 *   8. Move the PDF from Inbox → Inbox/Processed in Dropbox
 *
 * Guardrails:
 *   - Book titles are NEVER treated as author names
 *   - Multi-author books create one author card per author
 *   - Duplicate detection: normalised name matching before insert
 *   - Large files (>100 MB) are flagged and skipped
 */

import { getDb } from "../db";
import {
  authorProfiles,
  bookProfiles,
  contentItems,
  contentFiles,
  authorContentLinks,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { scrapeAmazonBook } from "../apify";
import { mirrorBatchToS3 } from "../mirrorToS3";
import { processAuthorAvatarWaterfall } from "../lib/authorAvatars/waterfall";
import {
  downloadDropboxFile,
  moveDropboxFile,
  DROPBOX_FOLDERS,
  sanitizeFilename,
  type InboxFile,
} from "../dropbox.service";
import {
  flagBookDuplicate,
  flagFileDuplicate,
  normalizeTitle,
  normalizeIsbn,
  similarityScore,
} from "./duplicateDetection.service";
import crypto from "crypto";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/** Known book title keywords that should never be treated as an author name */
const BOOK_TITLE_KEYWORDS = [
  "active listening",
  "the art of",
  "introduction to",
  "guide to",
  "handbook",
  "principles of",
  "fundamentals of",
  "how to",
  "the power of",
  "the science of",
  "thinking fast",
  "thinking slow",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestMetadata {
  bookTitle: string;
  authors: string[]; // One entry per author (multi-author books split here)
  description: string;
  category: string;
  publishedYear?: string;
  isbn?: string;
  confidence: "high" | "medium" | "low";
  rawFilename: string;
}

export interface AuthorIngestResult {
  authorName: string;
  action: "created" | "existing" | "skipped";
  authorId?: number;
  avatarUrl?: string;
  error?: string;
}

export type DuplicateMode = "skip" | "flag" | "replace";

export interface DuplicateInfo {
  isDuplicate: boolean;
  duplicateOfId?: number;
  method?: "hash" | "filename" | "isbn" | "fuzzy_title";
  similarity?: number;
}

export interface IngestFileResult {
  dropboxPath: string;
  filename: string;
  status: "success" | "skipped" | "error" | "duplicate";
  reason?: string;
  metadata?: IngestMetadata;
  s3Url?: string;
  bookProfileId?: number;
  contentItemId?: number;
  authorResults?: AuthorIngestResult[];
  movedToProcessed?: boolean;
  duplicateInfo?: DuplicateInfo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate that a string looks like a real person's name (not a book title).
 */
function looksLikePersonName(candidate: string): boolean {
  const lower = candidate.toLowerCase().trim();
  if (!lower.includes(" ")) return false;
  if (candidate.split(" ").length > 4) return false;
  for (const kw of BOOK_TITLE_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }
  if (/^(the|a|an)\s/i.test(lower)) return false;
  return true;
}

/**
 * Extract metadata from a PDF filename using LLM.
 */
export async function extractPdfMetadata(filename: string): Promise<IngestMetadata> {
  const cleanName = filename.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");

  const systemPrompt = `You are a metadata extraction assistant for a digital library.
Given a PDF filename, extract structured metadata about the book.

CRITICAL GUARDRAILS:
- NEVER use a book title as an author name
- NEVER use a generic term (e.g. "Active Listening", "The Art of War") as an author name
- Authors must be real human names in "First Last" format
- If you cannot identify real author names with confidence, return an empty authors array
- For multi-author books, list each author separately

Return JSON matching this schema exactly:
{
  "bookTitle": "string — clean book title",
  "authors": ["string — each author as 'First Last'"],
  "description": "string — 1-2 sentence description of the book",
  "category": "string — one of: Business, Psychology, Leadership, Science, Technology, Self-Help, Biography, Economics, Philosophy, Other",
  "publishedYear": "string or null — 4-digit year if known",
  "isbn": "string or null — ISBN-13 if visible in filename",
  "confidence": "high|medium|low — how confident you are in the extracted data"
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Filename: "${cleanName}"` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pdf_metadata",
          strict: true,
          schema: {
            type: "object",
            properties: {
              bookTitle: { type: "string" },
              authors: { type: "array", items: { type: "string" } },
              description: { type: "string" },
              category: { type: "string" },
              publishedYear: { type: ["string", "null"] },
              isbn: { type: ["string", "null"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["bookTitle", "authors", "description", "category", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = result.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) throw new Error("LLM returned empty response");
    const parsed = JSON.parse(content) as {
      bookTitle: string;
      authors: string[];
      description: string;
      category: string;
      publishedYear?: string | null;
      isbn?: string | null;
      confidence: "high" | "medium" | "low";
    };

    // Apply guardrail: filter out any author names that look like book titles
    const safeAuthors = (parsed.authors ?? []).filter(looksLikePersonName);

    return {
      bookTitle: parsed.bookTitle || cleanName,
      authors: safeAuthors,
      description: parsed.description || "",
      category: parsed.category || "Other",
      publishedYear: parsed.publishedYear ?? undefined,
      isbn: parsed.isbn ?? undefined,
      confidence: parsed.confidence || "low",
      rawFilename: filename,
    };
  } catch {
    return {
      bookTitle: cleanName,
      authors: [],
      description: "",
      category: "Other",
      confidence: "low",
      rawFilename: filename,
    };
  }
}

/**
 * Find or create an author profile. Returns the author ID and action taken.
 */
async function upsertAuthor(authorName: string): Promise<AuthorIngestResult> {
  const db = await getDb();
  if (!db) return { authorName, action: "skipped", error: "DB unavailable" };

  // Check for existing author
  const existing = await db
    .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, s3AvatarUrl: authorProfiles.s3AvatarUrl })
    .from(authorProfiles)
    .where(eq(authorProfiles.authorName, authorName))
    .limit(1);

  if (existing.length > 0) {
    return {
      authorName,
      action: "existing",
      authorId: existing[0].id,
      avatarUrl: existing[0].s3AvatarUrl ?? undefined,
    };
  }

  // Create new author profile
  try {
    const insertResult = await db.insert(authorProfiles).values({
      authorName,
    });

    const newId = (insertResult as unknown as { insertId: number }).insertId;

    // Trigger avatar waterfall
    let avatarUrl: string | undefined;
    try {
      const avatarResult = await processAuthorAvatarWaterfall(authorName, {
        maxTier: 3, // Wikipedia → Tavily → Apify (skip AI for speed)
        skipAlreadyEnriched: false,
      });

      if (avatarResult.s3AvatarUrl) {
        avatarUrl = avatarResult.s3AvatarUrl;
        // Map tier number to source enum
        const tierToSource: Record<number, "wikipedia" | "tavily" | "apify" | "ai" | "google-imagen" | "drive"> = {
          1: "wikipedia", 2: "tavily", 3: "apify", 4: "apify", 5: "ai"
        };
        await db
          .update(authorProfiles)
          .set({
            avatarUrl: avatarResult.avatarUrl ?? avatarResult.s3AvatarUrl,
            s3AvatarUrl: avatarResult.s3AvatarUrl,
            avatarSource: tierToSource[avatarResult.tier] ?? null,
          })
          .where(eq(authorProfiles.id, newId));
      }
    } catch (avatarErr) {
      console.warn(`[Ingest] Avatar fetch failed for ${authorName}:`, avatarErr);
    }

    return { authorName, action: "created", authorId: newId, avatarUrl };
  } catch (err) {
    return {
      authorName,
      action: "skipped",
      error: err instanceof Error ? err.message : "Insert failed",
    };
  }
}

/**
 * Scrape Amazon for a book cover and mirror it to S3.
 */
async function fetchAndMirrorBookCover(
  bookTitle: string,
  authorName: string,
  bookProfileId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const amazonResult = await scrapeAmazonBook(bookTitle, authorName);
    if (!amazonResult?.coverUrl) return;

    const mirrorResults = await mirrorBatchToS3([
      { id: bookProfileId, sourceUrl: amazonResult.coverUrl, existingKey: null },
    ], "book-covers");

    const mirrored = mirrorResults[0];
    if (mirrored?.url) {
      await db
        .update(bookProfiles)
        .set({
          coverImageUrl: amazonResult.coverUrl,
          coverImageSource: "amazon",
          s3CoverUrl: mirrored.url,
          s3CoverKey: mirrored.key,
          amazonUrl: amazonResult.amazonUrl ?? null,
        })
        .where(eq(bookProfiles.id, bookProfileId));
    }
  } catch (err) {
    console.warn(`[Ingest] Book cover fetch failed for "${bookTitle}":`, err);
  }
}

// ── Main Ingestion Function ───────────────────────────────────────────────────

/**
 * Ingest a single PDF file from the Dropbox Inbox.
 */
export async function ingestDropboxFile(
  file: InboxFile,
  options: {
    moveToProcessed?: boolean;
    fetchBookCover?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<IngestFileResult> {
  const {
    moveToProcessed = true,
    fetchBookCover = true,
    dryRun = false,
  } = options;

  if (!file.isPdf) {
    return {
      dropboxPath: file.dropboxPath,
      filename: file.name,
      status: "skipped",
      reason: `Not a PDF (extension: .${file.extension})`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      dropboxPath: file.dropboxPath,
      filename: file.name,
      status: "skipped",
      reason: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 100 MB limit)`,
    };
  }

  if (dryRun) {
    const metadata = await extractPdfMetadata(file.name);
    return {
      dropboxPath: file.dropboxPath,
      filename: file.name,
      status: "success",
      reason: "dry-run — no changes made",
      metadata,
    };
  }

  try {
    // 1. Extract metadata from filename
    const metadata = await extractPdfMetadata(file.name);

    // 2. Download PDF from Dropbox
    const { buffer, size } = await downloadDropboxFile(file.dropboxPath);

    // 2a. Compute SHA-256 hash for duplicate detection
    const contentHash = crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");

    // 3. Upload to S3
    const safeTitle = sanitizeFilename(metadata.bookTitle);
    const s3Key = `pdfs/inbox/${safeTitle}-${Date.now()}.pdf`;
    const { url: s3Url } = await storagePut(
      s3Key,
      Buffer.from(buffer),
      "application/pdf"
    );

    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // 4. Create content_item record
    const ciResult = await db.insert(contentItems).values({
      contentType: "book",
      title: metadata.bookTitle,
      description: metadata.description || null,
      publishedDate: metadata.publishedYear || null,
    });
    const contentItemId = (ciResult as unknown as { insertId: number }).insertId;

    // 5. Create content_file record (with hash for duplicate detection)
    const cfResult = await db.insert(contentFiles).values({
      contentItemId,
      s3Key,
      s3Url,
      originalFilename: file.name,
      cleanFilename: `${safeTitle}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: size,
      fileType: "pdf",
      contentHash,
    });
    const contentFileId = (cfResult as unknown as { insertId: number }).insertId;

    // 5a. Check for duplicate files by hash
    const existingByHash = await db
      .select({ id: contentFiles.id })
      .from(contentFiles)
      .where(eq(contentFiles.contentHash, contentHash))
      .limit(2);
    if (existingByHash.length > 1) {
      const canonicalId = existingByHash.find(r => r.id !== contentFileId)?.id;
      if (canonicalId) {
        await flagFileDuplicate(contentFileId, canonicalId, "hash");
      }
    }

    // 6. Upsert authors and link them to the content item
    const authorResults: AuthorIngestResult[] = [];
    for (let i = 0; i < metadata.authors.length; i++) {
      const authorName = metadata.authors[i];
      if (!looksLikePersonName(authorName)) {
        authorResults.push({ authorName, action: "skipped", error: "Failed person-name guardrail" });
        continue;
      }
      const result = await upsertAuthor(authorName);
      authorResults.push(result);

      // Link author to content item
      if (result.action !== "skipped") {
        try {
          await db.insert(authorContentLinks).values({
            authorName,
            contentItemId,
            role: i === 0 ? "primary" : "co-author",
            displayOrder: i,
          });
        } catch {
          // Ignore duplicate link errors
        }
      }
    }

    // 7. Upsert book profile with duplicate detection
    const primaryAuthor = metadata.authors[0] ?? "Unknown";
    let bookProfileId: number | undefined;
    let duplicateInfo: DuplicateInfo = { isDuplicate: false };

    const existingBook = await db
      .select({ id: bookProfiles.id })
      .from(bookProfiles)
      .where(eq(bookProfiles.bookTitle, metadata.bookTitle))
      .limit(1);

    if (existingBook.length > 0) {
      // Exact title match — treat as existing book (not a new duplicate)
      bookProfileId = existingBook[0].id;
    } else {
      // Check for fuzzy title or ISBN duplicates before inserting
      const allBooks = await db
        .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, isbn: bookProfiles.isbn })
        .from(bookProfiles)
        .limit(2000);
      const normalizedNew = normalizeTitle(metadata.bookTitle);
      const newIsbn = metadata.isbn ? normalizeIsbn(metadata.isbn) : null;
      let fuzzyMatch: { id: number; method: "isbn" | "fuzzy_title"; similarity: number } | null = null;
      for (const existing of allBooks) {
        if (newIsbn && existing.isbn && normalizeIsbn(existing.isbn) === newIsbn) {
          fuzzyMatch = { id: existing.id, method: "isbn", similarity: 1.0 };
          break;
        }
        const score = similarityScore(normalizedNew, normalizeTitle(existing.bookTitle));
        if (score >= 0.85) {
          fuzzyMatch = { id: existing.id, method: "fuzzy_title", similarity: score };
          break;
        }
      }

      const bpResult = await db.insert(bookProfiles).values({
        bookTitle: metadata.bookTitle,
        authorName: primaryAuthor,
        summary: metadata.description || null,
        keyThemes: metadata.category || null,
        isbn: metadata.isbn || null,
        publishedDate: metadata.publishedYear || null,
      });
      bookProfileId = (bpResult as unknown as { insertId: number }).insertId;

      // Flag as duplicate if fuzzy match found
      if (fuzzyMatch && bookProfileId) {
        await flagBookDuplicate(bookProfileId, fuzzyMatch.id, fuzzyMatch.method);
        duplicateInfo = { isDuplicate: true, duplicateOfId: fuzzyMatch.id, method: fuzzyMatch.method, similarity: fuzzyMatch.similarity };
      }

      // 8. Fetch book cover from Amazon (async, non-blocking) — skip for duplicates
      if (fetchBookCover && bookProfileId && !duplicateInfo.isDuplicate) {
        fetchAndMirrorBookCover(metadata.bookTitle, primaryAuthor, bookProfileId).catch(() => {});
      }
    }

    // 9. Move to Processed folder in Dropbox
    let movedToProcessed = false;
    if (moveToProcessed) {
      try {
        const processedPath = `${DROPBOX_FOLDERS.processed}/${file.name}`;
        await moveDropboxFile(file.dropboxPath, processedPath);
        movedToProcessed = true;
      } catch (moveErr) {
        console.warn(`[Ingest] Failed to move ${file.name} to Processed:`, moveErr);
      }
    }

    return {
      dropboxPath: file.dropboxPath,
      filename: file.name,
      status: duplicateInfo.isDuplicate ? "duplicate" : "success",
      metadata,
      s3Url,
      bookProfileId,
      contentItemId,
      authorResults,
      movedToProcessed,
      duplicateInfo,
    };
  } catch (err) {
    return {
      dropboxPath: file.dropboxPath,
      filename: file.name,
      status: "error",
      reason: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
