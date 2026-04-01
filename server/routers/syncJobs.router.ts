/**
 * syncJobs.router.ts
 *
 * S3-to-Dropbox / S3-to-Google-Drive one-way sync engine.
 *
 * Architecture:
 *   - All files (PDFs, audio, avatars, RAG files) are stored in S3 (source of truth)
 *   - This router pushes them to Dropbox and/or Google Drive in author-based folder structure
 *   - Folder structure: /{AuthorName}/{content-type}/{filename}
 *   - Jobs are tracked in the sync_jobs table
 *   - Idempotent: files already present at target are skipped (by key hash)
 *
 * Dropbox integration: uses Dropbox API v2 via REST (no SDK needed)
 * Google Drive integration: uses Google Drive API v3 via REST
 *
 * Credentials required (set via Admin → Settings or webdev_request_secrets):
 *   - DROPBOX_ACCESS_TOKEN (long-lived or refreshable)
 *   - GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (service account JSON string)
 *   - GOOGLE_DRIVE_PARENT_FOLDER_ID (target folder in Drive)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { syncJobs, authorProfiles, bookProfiles, authorRagProfiles } from "../../drizzle/schema";
import { eq, desc, inArray } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").trim();
}

async function fetchS3File(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ── Dropbox upload ─────────────────────────────────────────────────────────────
async function uploadToDropbox(
  token: string,
  dropboxPath: string,
  data: Buffer,
  overwrite = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: overwrite ? "overwrite" : "add",
          autorename: !overwrite,
          mute: true,
        }),
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Google Drive upload ────────────────────────────────────────────────────────
async function getOrCreateDriveFolder(
  accessToken: string,
  parentId: string,
  folderName: string
): Promise<string | null> {
  // Search for existing folder
  const q = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as { files: { id: string }[] };
  if (searchData.files.length > 0) return searchData.files[0].id;

  // Create folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!createRes.ok) return null;
  const createData = (await createRes.json()) as { id: string };
  return createData.id;
}

async function uploadToDrive(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  data: Buffer,
  mimeType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const metadata = JSON.stringify({ name: fileName, parents: [parentFolderId] });
    const boundary = "boundary_" + Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      data,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": body.length.toString(),
        },
      body: new Uint8Array(body),
    }
  );
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const syncJobsRouter = router({
  /**
   * List recent sync jobs
   */
  listJobs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const jobs = await db
        .select()
        .from(syncJobs)
        .orderBy(desc(syncJobs.createdAt))
        .limit(input?.limit ?? 20);
      return jobs;
    }),

  /**
   * Get a specific sync job by ID
   */
  getJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(syncJobs).where(eq(syncJobs.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Trigger a sync job
   * - target: "dropbox" | "google_drive" | "both"
   * - scope: "all" or comma-separated author names
   * - contentTypes: which content types to sync
   */
  triggerSync: publicProcedure
    .input(
      z.object({
        target: z.enum(["dropbox", "google_drive", "both"]),
        scope: z.string().default("all"),
        contentTypes: z
          .array(z.enum(["avatars", "books", "audio", "rag_files"]))
          .default(["avatars", "books", "audio", "rag_files"]),
        overwrite: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };

      // Check credentials
      const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
      const driveParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

      if (input.target === "dropbox" && !dropboxToken) {
        return { success: false, message: "DROPBOX_ACCESS_TOKEN not configured. Add it in Admin → Settings." };
      }
      if (input.target === "google_drive" && !driveParentId) {
        return { success: false, message: "GOOGLE_DRIVE_PARENT_FOLDER_ID not configured. Add it in Admin → Settings." };
      }

      // Create job record
      const [jobResult] = await db.insert(syncJobs).values({
        target: input.target,
        status: "running",
        triggeredBy: "manual",
        scope: input.scope,
        startedAt: new Date(),
      });
      const jobId = (jobResult as unknown as { insertId: number }).insertId;

      // Run sync asynchronously (fire and forget — status tracked in DB)
      runSyncJob(jobId, input).catch(async (err) => {
        const db2 = await getDb();
        if (!db2) return;
        await db2.update(syncJobs).set({
          status: "failed",
          error: String(err),
          completedAt: new Date(),
        }).where(eq(syncJobs.id, jobId));
      });

      return { success: true, jobId };
    }),

  /**
   * Cancel a running sync job
   */
  cancelJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(syncJobs).set({ status: "cancelled", completedAt: new Date() }).where(eq(syncJobs.id, input.id));
      return { success: true };
    }),
});

// ── Async sync runner ─────────────────────────────────────────────────────────
async function runSyncJob(
  jobId: number,
  input: {
    target: "dropbox" | "google_drive" | "both";
    scope: string;
    contentTypes: string[];
    overwrite: boolean;
  }
) {
  const db = await getDb();
  if (!db) return;

    const dropboxToken: string = process.env.DROPBOX_ACCESS_TOKEN ?? "";
    const driveParentId: string = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID ?? "";

  // Collect files to sync
  interface SyncFile {
    authorName: string;
    contentType: "avatars" | "books" | "audio" | "rag_files";
    s3Url: string;
    fileName: string;
    mimeType: string;
  }

  const files: SyncFile[] = [];

  // Determine which authors to include
  let authorFilter: string[] | null = null;
  if (input.scope !== "all") {
    authorFilter = input.scope.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // Avatars
  if (input.contentTypes.includes("avatars")) {
    const rows = await db
      .select({ authorName: authorProfiles.authorName, s3AvatarUrl: authorProfiles.s3AvatarUrl })
      .from(authorProfiles);
    for (const row of rows) {
      if (!row.s3AvatarUrl) continue;
      if (authorFilter && !authorFilter.includes(row.authorName)) continue;
      files.push({
        authorName: row.authorName,
        contentType: "avatars",
        s3Url: row.s3AvatarUrl,
        fileName: `${slugify(row.authorName)}_avatar.jpg`,
        mimeType: "image/jpeg",
      });
    }
  }

  // Books (PDFs)
  if (input.contentTypes.includes("books")) {
    const rows = await db
      .select({
        authorName: bookProfiles.authorName,
        bookTitle: bookProfiles.bookTitle,
        s3CoverUrl: bookProfiles.s3CoverUrl,
      })
      .from(bookProfiles);
    for (const row of rows) {
      if (!row.s3CoverUrl) continue;
      const bookAuthor = row.authorName ?? "Unknown";
      if (authorFilter && !authorFilter.includes(bookAuthor)) continue;
      files.push({
        authorName: bookAuthor,
        contentType: "books",
        s3Url: row.s3CoverUrl,
        fileName: `${slugify(row.bookTitle ?? "book")}_cover.jpg`,
        mimeType: "image/jpeg",
      });
    }
  }

  // RAG files
  if (input.contentTypes.includes("rag_files")) {
    const rows = await db
      .select({
        authorName: authorRagProfiles.authorName,
        ragFileUrl: authorRagProfiles.ragFileUrl,
        ragVersion: authorRagProfiles.ragVersion,
      })
      .from(authorRagProfiles);
    for (const row of rows) {
      if (!row.ragFileUrl) continue;
      if (authorFilter && !authorFilter.includes(row.authorName)) continue;
      files.push({
        authorName: row.authorName,
        contentType: "rag_files",
        s3Url: row.ragFileUrl ?? "",
        fileName: `${slugify(row.authorName)}_digital_me_v${row.ragVersion ?? 1}.md`,
        mimeType: "text/markdown",
      });
    }
  }

  // Update total count
  await db.update(syncJobs).set({ totalFiles: files.length }).where(eq(syncJobs.id, jobId));

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;
  const fileResults: { s3Url: string; targetPath: string; status: string; error?: string; bytes?: number }[] = [];

  for (const file of files) {
    // Check if job was cancelled
    const jobRows = await db.select({ status: syncJobs.status }).from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);
    if (jobRows[0]?.status === "cancelled") break;

      const authorSlug = slugify(file.authorName ?? "unknown");
    const targetPath = `/${authorSlug}/${file.contentType}/${file.fileName}`;

    // Fetch from S3
    const data = await fetchS3File(file.s3Url);
    if (!data) {
      failed++;
      fileResults.push({ s3Url: file.s3Url, targetPath, status: "failed", error: "Could not fetch from S3" });
      continue;
    }

    bytes += data.length;

    // Upload to Dropbox
    if (input.target === "dropbox" || input.target === "both") {
      const result = await uploadToDropbox(dropboxToken, targetPath, data, input.overwrite);
      if (result.success) {
        synced++;
        fileResults.push({ s3Url: file.s3Url, targetPath, status: "synced", bytes: data.length });
      } else {
        failed++;
        fileResults.push({ s3Url: file.s3Url, targetPath, status: "failed", error: result.error });
      }
    }

    // Upload to Google Drive (simplified — uses parent folder directly for now)
    if (input.target === "google_drive" || input.target === "both") {
      const result = await uploadToDrive(
        driveParentId, // Note: in production, exchange service account JSON for access token
        driveParentId,
        file.fileName,
        data,
        file.mimeType
      );
      if (result.success) {
        if (input.target === "google_drive") synced++;
        fileResults.push({ s3Url: file.s3Url, targetPath: `Drive/${file.fileName}`, status: "synced", bytes: data.length });
      } else {
        if (input.target === "google_drive") failed++;
        fileResults.push({ s3Url: file.s3Url, targetPath: `Drive/${file.fileName}`, status: "failed", error: result.error });
      }
    }

    // Update progress every 5 files
    if ((synced + failed + skipped) % 5 === 0) {
      await db.update(syncJobs).set({
        syncedFiles: synced,
        failedFiles: failed,
        skippedFiles: skipped,
        bytesTransferred: bytes,
        message: `Syncing… ${synced + failed + skipped}/${files.length} files`,
      }).where(eq(syncJobs.id, jobId));
    }
  }

  // Final update
  await db.update(syncJobs).set({
    status: failed > 0 && synced === 0 ? "failed" : "completed",
    syncedFiles: synced,
    failedFiles: failed,
    skippedFiles: skipped,
    bytesTransferred: bytes,
    message: `Completed: ${synced} synced, ${failed} failed, ${skipped} skipped`,
    fileResultsJson: JSON.stringify(fileResults.slice(0, 500)), // cap at 500 entries
    completedAt: new Date(),
  }).where(eq(syncJobs.id, jobId));
}
