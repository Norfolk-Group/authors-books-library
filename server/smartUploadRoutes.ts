/**
 * Smart Upload REST Routes
 *
 * Handles multipart file uploads that cannot go through tRPC.
 * POST /api/upload/smart — accepts one or more files, stages them to S3,
 *   creates smart_uploads records, then triggers AI classification.
 */

import { Express, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { smartUploads } from "../drizzle/schema";
import { storagePut } from "./storage";
import { classifyFile, enrichClassificationWithDbMatches } from "./services/aiFileClassifier.service";

// ── Multer config — memory storage (files go straight to S3) ─────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB per file
    files: 10, // max 10 files per request
  },
  fileFilter: (_req, file, cb) => {
    // Allow all common document, image, and media types
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "audio/mpeg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/wav",
      "audio/ogg",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/epub+zip",
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/") || file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ── Helper: generate a random suffix ─────────────────────────────────────────
function randomSuffix(): string {
  return crypto.randomBytes(6).toString("hex");
}

// ── Helper: sanitize filename for S3 key ─────────────────────────────────────
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

// ── Register routes ───────────────────────────────────────────────────────────

export function registerSmartUploadRoutes(app: Express): void {
  /**
   * POST /api/upload/smart
   * Accepts multipart/form-data with field name "files"
   * Returns array of created upload job records
   */
  app.post(
    "/api/upload/smart",
    upload.array("files", 10),
    async (req: Request, res: Response) => {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Database not available" });
        return;
      }

      const results: Array<{
        id: number;
        filename: string;
        status: string;
        stagingS3Url: string | null;
        error?: string;
      }> = [];

      for (const file of files) {
        try {
          // 1. Upload to S3 staging area
          const ext = path.extname(file.originalname) || "";
          const safeName = sanitizeFilename(path.basename(file.originalname, ext));
          const stagingKey = `smart-uploads/staging/${safeName}-${randomSuffix()}${ext}`;

          const { url: stagingS3Url } = await storagePut(
            stagingKey,
            file.buffer,
            file.mimetype
          );

          // 2. Create smart_uploads record
          const [insertResult] = await db.insert(smartUploads).values({
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
            stagingS3Key: stagingKey,
            stagingS3Url,
            finalS3Key: stagingKey, // same key until committed
            finalS3Url: stagingS3Url,
            status: "classifying",
          });

          const uploadId = (insertResult as any).insertId as number;

          // 3. Run AI classification asynchronously (don't block the response)
          setImmediate(async () => {
            try {
              // For images, pass base64 content to Claude
              let base64Content: string | undefined;
              if (file.mimetype.startsWith("image/") && file.size < 4 * 1024 * 1024) {
                base64Content = file.buffer.toString("base64");
              }

              const classification = await classifyFile({
                filename: file.originalname,
                mimeType: file.mimetype,
                fileSizeBytes: file.size,
                base64Content,
              });

              const { matchedAuthorId, matchedBookId } =
                await enrichClassificationWithDbMatches(classification);

              // Update the staging record with AI classification results
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
                  shouldIndexNeon: classification.shouldIndexNeon,
                  neonNamespace: classification.neonNamespace,
                  shouldMirrorDropbox: true,
                  suggestedDropboxPath: classification.suggestedDropboxPath,
                  classifiedAt: new Date(),
                })
                .where(eq(smartUploads.id, uploadId));

            } catch (classErr) {
              console.error(`[SmartUpload] Classification failed for upload ${uploadId}:`, classErr);
              await db
                .update(smartUploads)
                .set({
                  status: "error",
                  errorMessage: classErr instanceof Error ? classErr.message : "Classification failed",
                })
                .where(eq(smartUploads.id, uploadId));
            }
          });

          results.push({
            id: uploadId,
            filename: file.originalname,
            status: "classifying",
            stagingS3Url,
          });
        } catch (err) {
          console.error(`[SmartUpload] Upload failed for ${file.originalname}:`, err);
          results.push({
            id: -1,
            filename: file.originalname,
            status: "error",
            stagingS3Url: null,
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      res.json({ success: true, uploads: results });
    }
  );
}
