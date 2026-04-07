/**
 * upload_matched_pdfs.ts
 * Uploads the 17 validated PDF matches from Dropbox to S3.
 * Uses pre-validated matches from /tmp/pdf_matches_clean.json
 */
import { getDb } from "../server/db";
import { storagePut } from "../server/storage";
import { sql } from "drizzle-orm";
import https from "https";
import fs from "fs";

const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN!;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY!;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET!;

async function getDropboxToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: DROPBOX_REFRESH_TOKEN,
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
  });
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error("Failed to get Dropbox token: " + JSON.stringify(data));
  return data.access_token;
}

async function downloadDropboxFile(token: string, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://content.dropboxapi.com/2/files/download",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path }),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let body = "";
          res.on("data", (d) => (body += d));
          res.on("end", () => reject(new Error(`Dropbox download failed ${res.statusCode}: ${body.slice(0, 200)}`)));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load validated matches
  const matchesRaw = JSON.parse(fs.readFileSync("/tmp/pdf_matches_clean.json", "utf-8"));
  const validMatches = Object.entries(matchesRaw).filter(([, v]) => v !== null) as Array<[string, { path: string; score: number; folder: string }]>;
  
  console.log(`Processing ${validMatches.length} validated PDF matches...`);

  // Get Dropbox token
  const token = await getDropboxToken();
  console.log("Got Dropbox token");

  const results: Array<{ title: string; success: boolean; error?: string }> = [];

  for (const [title, matchInfo] of validMatches) {
    try {
      // Find the book ID in the database
      const bookRows = await db.execute(sql`
        SELECT b.id FROM book_profiles b
        LEFT JOIN content_files cf ON cf.contentItemId = b.id AND cf.fileType = 'pdf'
        WHERE b.bookTitle = ${title} AND cf.id IS NULL
        LIMIT 1
      `);
      
      const bookId = (bookRows[0] as any[])[0]?.id;
      if (!bookId) {
        console.log(`  ⚠ "${title}": already has PDF or not found in DB, skipping`);
        results.push({ title, success: false, error: "already-has-pdf-or-not-found" });
        continue;
      }

      console.log(`\n"${title}" (id=${bookId}):`);
      console.log(`  → Downloading: ${matchInfo.path.split("/").pop()}`);
      
      const buffer = await downloadDropboxFile(token, matchInfo.path);
      console.log(`  → Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const s3Key = `book-pdfs/${bookId}-${slug}.pdf`;
      const { url: s3Url } = await storagePut(s3Key, buffer, "application/pdf");
      console.log(`  ✓ Uploaded to S3: ${s3Url.slice(0, 60)}...`);

      const fileName = matchInfo.path.split("/").pop() || `${slug}.pdf`;
      await db.execute(sql`
        INSERT INTO content_files (contentItemId, s3Key, s3Url, originalFilename, cleanFilename, mimeType, fileSizeBytes, fileType, dropboxPath, dropboxSyncedAt, createdAt, updatedAt)
        VALUES (${bookId}, ${s3Key}, ${s3Url}, ${fileName}, ${slug + ".pdf"}, 'application/pdf', ${buffer.length}, 'pdf', ${matchInfo.path}, NOW(), NOW(), NOW())
      `);

      results.push({ title, success: true });
    } catch (err: any) {
      console.error(`  ✗ Error for "${title}": ${err.message}`);
      results.push({ title, success: false, error: err.message });
    }

    await new Promise(r => setTimeout(r, 800));
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== UPLOAD RESULTS ===`);
  console.log(`Succeeded: ${succeeded} | Failed/Skipped: ${failed}`);
  results.forEach(r => {
    const icon = r.success ? "✓" : "✗";
    console.log(`  ${icon} "${r.title}"${r.error ? ": " + r.error : ""}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
