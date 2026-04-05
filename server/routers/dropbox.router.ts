/**
 * Dropbox Backup Router
 *
 * Provides tRPC procedures for:
 * - Checking Dropbox connection status
 * - Backing up avatars, book covers, and PDFs to Dropbox
 * - Listing backed-up files
 * - Running a full backup of all assets
 *
 * Backup folder: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/
 *   Avatars/      — author headshot images (from author_profiles.s3AvatarUrl)
 *   Book Covers/  — book cover images (from book_profiles.s3CoverUrl)
 *   PDFs/         — PDF files (from content_files where fileType='pdf')
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDropboxAccountInfo,
  uploadFileToDropbox,
  listDropboxFolder,
  dropboxFileExists,
  listDropboxInbox,
  DROPBOX_FOLDERS,
  sanitizeFilename,
} from "../dropbox.service";
import {
  extractPdfMetadata,
  ingestDropboxFile,
  type IngestFileResult,
} from "../services/dropboxIngest.service";
import { getDb } from "../db";
import { authorProfiles, bookProfiles, contentFiles } from "../../drizzle/schema";
import { isNotNull, eq } from "drizzle-orm";

export const dropboxRouter = router({
  /** Check if Dropbox is connected and return account info */
  status: protectedProcedure.query(async () => {
    try {
      const account = await getDropboxAccountInfo();
      return {
        connected: true,
        displayName: account.displayName,
        email: account.email,
        backupFolder: DROPBOX_FOLDERS.root,
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : "Unknown error",
        backupFolder: DROPBOX_FOLDERS.root,
      };
    }
  }),

  /** List files in a specific Dropbox backup folder */
  listFolder: protectedProcedure
    .input(z.object({ folder: z.enum(["avatars", "bookCovers", "pdfs", "root"]) }))
    .query(async ({ input }) => {
      const folderPath = DROPBOX_FOLDERS[input.folder];
      const files = await listDropboxFolder(folderPath);
      return { folder: folderPath, files, count: files.length };
    }),

  /** Backup all author avatars to Dropbox */
  backupAvatars: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const authors = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          s3AvatarUrl: authorProfiles.s3AvatarUrl,
        })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.s3AvatarUrl));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const author of authors) {
        if (!author.s3AvatarUrl) continue;

        const safeName = sanitizeFilename(author.authorName);
        const ext = author.s3AvatarUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.avatars}/${safeName}.${ext}`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(author.s3AvatarUrl, destPath, true);
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${author.authorName}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: authors.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /** Backup all book covers to Dropbox */
  backupBookCovers: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const books = await db
        .select({
          id: bookProfiles.id,
          bookTitle: bookProfiles.bookTitle,
          s3CoverUrl: bookProfiles.s3CoverUrl,
        })
        .from(bookProfiles)
        .where(isNotNull(bookProfiles.s3CoverUrl));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const book of books) {
        if (!book.s3CoverUrl) continue;

        const safeName = sanitizeFilename(book.bookTitle ?? `book-${book.id}`);
        const ext = book.s3CoverUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.bookCovers}/${safeName}.${ext}`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(book.s3CoverUrl, destPath, true);
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${book.bookTitle}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: books.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /** Backup all PDF files to Dropbox (from content_files table) */
  backupPdfs: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pdfs = await db
        .select({
          id: contentFiles.id,
          s3Url: contentFiles.s3Url,
          originalFilename: contentFiles.originalFilename,
          cleanFilename: contentFiles.cleanFilename,
          dropboxPath: contentFiles.dropboxPath,
        })
        .from(contentFiles)
        .where(eq(contentFiles.fileType, "pdf"));

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const file of pdfs) {
        if (!file.s3Url) continue;

        const filename = file.cleanFilename ?? file.originalFilename ?? `file-${file.id}.pdf`;
        const safeName = sanitizeFilename(filename.replace(/\.pdf$/i, ""));
        const destPath = `${DROPBOX_FOLDERS.pdfs}/${safeName}.pdf`;

        try {
          if (input.skipExisting) {
            const exists = await dropboxFileExists(destPath);
            if (exists) {
              skipped++;
              continue;
            }
          }
          await uploadFileToDropbox(file.s3Url, destPath, true);
          // Update the dropboxPath in the database
          await db
            .update(contentFiles)
            .set({
              dropboxPath: destPath,
              dropboxSyncedAt: new Date(),
            })
            .where(eq(contentFiles.id, file.id));
          uploaded++;
        } catch (err) {
          failed++;
          errors.push(`${filename}: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      return {
        total: pdfs.length,
        uploaded,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      };
    }),

  /**
   * Scan the Dropbox Inbox folder and return a list of files.
   * When dryRun=true, also previews the metadata that would be extracted.
   */
  scanInbox: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .query(async ({ input }) => {
      const files = await listDropboxInbox();
      const previews = await Promise.all(
        files.map(async (f) => {
          if (!f.isPdf) {
            return { ...f, metadata: null, reason: `Skipped: not a PDF (.${f.extension})` };
          }
          const metadata = input.dryRun ? await extractPdfMetadata(f.name) : null;
          return { ...f, metadata, reason: null };
        })
      );
      return {
        inboxFolder: DROPBOX_FOLDERS.inbox,
        processedFolder: DROPBOX_FOLDERS.processed,
        totalFiles: files.length,
        pdfCount: files.filter((f) => f.isPdf).length,
        files: previews,
      };
    }),

  /**
   * Ingest a single file from the Dropbox Inbox.
   * Creates author profiles, book profiles, and uploads the PDF to S3.
   */
  ingestFile: protectedProcedure
    .input(
      z.object({
        dropboxPath: z.string(),
        moveToProcessed: z.boolean().default(true),
        fetchBookCover: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const files = await listDropboxInbox();
      const file = files.find((f) => f.dropboxPath === input.dropboxPath);
      if (!file) throw new Error(`File not found in inbox: ${input.dropboxPath}`);
      return await ingestDropboxFile(file, {
        moveToProcessed: input.moveToProcessed,
        fetchBookCover: input.fetchBookCover,
        dryRun: false,
      });
    }),

  /**
   * Ingest ALL PDF files currently in the Dropbox Inbox.
   * Processes them sequentially to avoid rate limits.
   */
  ingestAll: protectedProcedure
    .input(
      z.object({
        moveToProcessed: z.boolean().default(true),
        fetchBookCover: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const files = await listDropboxInbox();
      const pdfs = files.filter((f) => f.isPdf);
      const results: IngestFileResult[] = [];
      for (const file of pdfs) {
        const result = await ingestDropboxFile(file, {
          moveToProcessed: input.moveToProcessed,
          fetchBookCover: input.fetchBookCover,
          dryRun: false,
        });
        results.push(result);
      }
      const succeeded = results.filter((r) => r.status === "success").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const failed = results.filter((r) => r.status === "error").length;
      return { total: pdfs.length, succeeded, skipped, failed, results };
    }),

  /** Run a full backup of all assets (avatars + covers + PDFs) */
  backupAll: protectedProcedure
    .input(z.object({ skipExisting: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Avatars
      const avatarAuthors = await db
        .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, s3AvatarUrl: authorProfiles.s3AvatarUrl })
        .from(authorProfiles)
        .where(isNotNull(authorProfiles.s3AvatarUrl));

      let avatarUploaded = 0, avatarSkipped = 0, avatarFailed = 0;
      for (const author of avatarAuthors) {
        if (!author.s3AvatarUrl) continue;
        const safeName = sanitizeFilename(author.authorName);
        const ext = author.s3AvatarUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.avatars}/${safeName}.${ext}`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { avatarSkipped++; continue; }
          await uploadFileToDropbox(author.s3AvatarUrl, destPath, true);
          avatarUploaded++;
        } catch { avatarFailed++; }
      }

      // Book Covers
      const coverBooks = await db
        .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, s3CoverUrl: bookProfiles.s3CoverUrl })
        .from(bookProfiles)
        .where(isNotNull(bookProfiles.s3CoverUrl));

      let coverUploaded = 0, coverSkipped = 0, coverFailed = 0;
      for (const book of coverBooks) {
        if (!book.s3CoverUrl) continue;
        const safeName = sanitizeFilename(book.bookTitle ?? `book-${book.id}`);
        const ext = book.s3CoverUrl.split(".").pop()?.split("?")[0] ?? "jpg";
        const destPath = `${DROPBOX_FOLDERS.bookCovers}/${safeName}.${ext}`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { coverSkipped++; continue; }
          await uploadFileToDropbox(book.s3CoverUrl, destPath, true);
          coverUploaded++;
        } catch { coverFailed++; }
      }

      // PDFs
      const pdfFiles = await db
        .select({ id: contentFiles.id, s3Url: contentFiles.s3Url, originalFilename: contentFiles.originalFilename, cleanFilename: contentFiles.cleanFilename })
        .from(contentFiles)
        .where(eq(contentFiles.fileType, "pdf"));

      let pdfUploaded = 0, pdfSkipped = 0, pdfFailed = 0;
      for (const file of pdfFiles) {
        if (!file.s3Url) continue;
        const filename = file.cleanFilename ?? file.originalFilename ?? `file-${file.id}.pdf`;
        const safeName = sanitizeFilename(filename.replace(/\.pdf$/i, ""));
        const destPath = `${DROPBOX_FOLDERS.pdfs}/${safeName}.pdf`;
        try {
          if (input.skipExisting && await dropboxFileExists(destPath)) { pdfSkipped++; continue; }
          await uploadFileToDropbox(file.s3Url, destPath, true);
          await db.update(contentFiles).set({ dropboxPath: destPath, dropboxSyncedAt: new Date() }).where(eq(contentFiles.id, file.id));
          pdfUploaded++;
        } catch { pdfFailed++; }
      }

      return {
        avatars: { total: avatarAuthors.length, uploaded: avatarUploaded, skipped: avatarSkipped, failed: avatarFailed },
        bookCovers: { total: coverBooks.length, uploaded: coverUploaded, skipped: coverSkipped, failed: coverFailed },
        pdfs: { total: pdfFiles.length, uploaded: pdfUploaded, skipped: pdfSkipped, failed: pdfFailed },
        summary: {
          totalAssets: avatarAuthors.length + coverBooks.length + pdfFiles.length,
          totalUploaded: avatarUploaded + coverUploaded + pdfUploaded,
          totalSkipped: avatarSkipped + coverSkipped + pdfSkipped,
          totalFailed: avatarFailed + coverFailed + pdfFailed,
        },
      };
    }),
});
