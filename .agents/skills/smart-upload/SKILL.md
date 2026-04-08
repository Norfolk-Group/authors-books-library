---
name: smart-upload
description: Understand and extend the Smart Upload feature — AI-powered file classification, review queue, and auto-Pinecone indexing. Use when adding new file types, changing the AI classification logic, debugging the commit flow, or extending the review queue UI.
---

# Smart Upload — RC Library App

## Overview

Smart Upload is an admin feature (`/admin` → Media → Smart Upload) that:
1. Accepts files via drag-and-drop or OS file picker (PDF, images, audio, video, EPUB, DOCX — up to 100 MB × 10 files)
2. Uploads each file to Manus S3 via a REST endpoint (`POST /api/upload/smart`)
3. Runs Claude AI classification to determine content type, matched author/book, and Pinecone namespace
4. Presents a **Review Queue** where the admin can approve, override, or reject each classification
5. On commit: writes to the correct DB table and auto-indexes to Pinecone (fire-and-forget)

## Key Files

```
server/smartUploadRoutes.ts              ← REST endpoint POST /api/upload/smart (multer, S3 upload, classify)
server/routers/smartUpload.router.ts     ← tRPC: list, getById, classify, updateOverride, commit, reject, delete, stats
server/services/aiFileClassifier.service.ts ← Claude classification + DB match enrichment
client/src/components/admin/AdminSmartUploadTab.tsx ← Full UI: drag-drop, review queue, history
drizzle/schema.ts (smart_uploads table)  ← Staging table for upload jobs
```

## Database Table: `smart_uploads`

```ts
export const smartUploads = mysqlTable("smart_uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileSize: int("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 200 }).notNull(),
  s3Key: varchar("s3_key", { length: 500 }).notNull(),
  s3Url: varchar("s3_url", { length: 1000 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  // "pending" | "classifying" | "review" | "committed" | "rejected" | "error"
  aiContentType: varchar("ai_content_type", { length: 100 }),
  // "author_bio" | "book_summary" | "rag_file" | "book_cover" | "author_photo" | "audio_book" | "content_item" | "unknown"
  aiConfidence: varchar("ai_confidence", { length: 20 }),   // "high" | "medium" | "low"
  aiReasoning: text("ai_reasoning"),
  matchedAuthorId: int("matched_author_id"),
  matchedBookId: int("matched_book_id"),
  matchedAuthorName: varchar("matched_author_name", { length: 255 }),
  matchedBookTitle: varchar("matched_book_title", { length: 500 }),
  pineconeNamespace: varchar("pinecone_namespace", { length: 100 }),
  // "authors" | "books" | "rag_files" | "content_items" | null
  shouldIndexPinecone: boolean("should_index_pinecone").default(false),
  adminOverride: text("admin_override"),   // JSON blob of admin corrections
  committedAt: bigint("committed_at", { mode: "number" }),
  errorMessage: text("error_message"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
```

## Upload REST Endpoint

`POST /api/upload/smart` — handled by `server/smartUploadRoutes.ts`

- Accepts `multipart/form-data` with field `files` (up to 10 files, 100 MB each)
- Uploads each file to S3 at key `smart-uploads/{timestamp}-{originalName}`
- Creates a `smart_uploads` row with `status: "classifying"`
- Calls `classifyFile()` asynchronously (non-blocking)
- Returns `{ uploadIds: number[] }` immediately

## AI Classification

`classifyFile()` in `server/services/aiFileClassifier.service.ts` uses **Claude claude-opus-4-5** to:

1. Read the file content (text extraction for PDFs/DOCX, metadata for images/audio)
2. Determine `aiContentType`, `aiConfidence`, `aiReasoning`
3. Call `enrichClassificationWithDbMatches()` to fuzzy-match author/book names against the DB
4. Update the `smart_uploads` row with classification results and `status: "review"`

### Content Type → Pinecone Namespace Mapping

| `aiContentType` | `pineconeNamespace` | `shouldIndexPinecone` |
|---|---|---|
| `author_bio` | `authors` | true |
| `book_summary` | `books` | true |
| `rag_file` | `rag_files` | true |
| `content_item` | `content_items` | true |
| `book_cover` | null | false |
| `author_photo` | null | false |
| `audio_book` | null | false |
| `unknown` | null | false |

## Commit Flow

When the admin clicks **Commit** on a reviewed upload:

1. `trpc.smartUpload.commit` mutation is called with the upload ID
2. Router reads the upload row (including any `adminOverride`)
3. Writes to the correct DB table based on `aiContentType`:
   - `author_bio` → updates `author_profiles.bio`
   - `book_summary` → updates `book_profiles.summary`
   - `rag_file` → creates/updates `rag_files` row
   - `book_cover` → updates `book_profiles.coverImageUrl`
   - `author_photo` → updates `author_profiles.photoUrl`
   - `content_item` → creates `content_items` row
4. Sets `status: "committed"` and `committedAt`
5. Calls `triggerPineconeIndexing()` fire-and-forget if `shouldIndexPinecone: true`

## Auto-Pinecone Indexing After Commit

```ts
// Triggered automatically in smartUpload.router.ts commit procedure
async function triggerPineconeIndexing(upload) {
  if (!upload.shouldIndexPinecone) return;
  switch (upload.pineconeNamespace) {
    case "authors": await indexAuthorIncremental(upload.matchedAuthorId); break;
    case "books":   await indexBookIncremental(upload.matchedBookId); break;
    case "rag_files": await indexRagFile({ authorId, title, text, url }); break;
    case "content_items": await indexContentItem({ id, contentType, description, authorName }); break;
  }
}
```

## Admin Override

If the AI classification is wrong, the admin can override before committing:

```ts
// trpc.smartUpload.updateOverride
{
  uploadId: number,
  override: {
    aiContentType?: string,
    matchedAuthorId?: number,
    matchedBookId?: number,
    pineconeNamespace?: string,
    shouldIndexPinecone?: boolean,
  }
}
```

The override is stored as JSON in `adminOverride` and applied during the commit.

## Common Pitfalls

- **File size limit**: multer is configured for 100 MB per file, 10 files max. Do not increase without also updating the S3 upload timeout.
- **Classification is async**: the REST endpoint returns immediately with `uploadIds`. The UI polls `trpc.smartUpload.list` to watch status transitions from `classifying` → `review`.
- **Commit is idempotent for status**: calling commit on an already-committed upload returns an error. Check `status === "review"` before showing the Commit button.
- **Fire-and-forget indexing**: Pinecone indexing errors are logged but never surface to the user. Check server logs if a committed file doesn't appear in search.
