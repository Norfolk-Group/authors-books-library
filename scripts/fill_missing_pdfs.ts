/**
 * fill_missing_pdfs.ts
 * Matches books without PDFs to their Dropbox files using fuzzy title matching,
 * then downloads and uploads to S3.
 * Usage: tsx scripts/fill_missing_pdfs.ts
 */
import { getDb } from "../server/db";
import { bookProfiles, contentFiles } from "../drizzle/schema";
import { storagePut } from "../server/storage";
import { isNull, eq, sql } from "drizzle-orm";
import https from "https";
import http from "http";
import fs from "fs";

const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN!;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY!;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET!;
const BACKUP_FOLDER = "/Cidale Interests/01_Companies/Norfolk AI/Apps/RC Library App/Authors and Books Backup";

// Books to skip (duplicates, non-books, or known unfindable)
const SKIP_TITLES = new Set([
  "Active Listening",
  "Active Listening Techniques",
]);

// ── Dropbox helpers ──────────────────────────────────────────────────────────

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

async function searchDropbox(token: string, query: string): Promise<Array<{ path: string; name: string }>> {
  const res = await fetch("https://api.dropboxapi.com/2/files/search_v2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      options: {
        path: BACKUP_FOLDER,
        file_extensions: ["pdf"],
        max_results: 10,
        file_categories: ["document"],
      },
    }),
  });
  const data = await res.json() as any;
  if (!data.matches) return [];
  return data.matches
    .filter((m: any) => m.metadata?.metadata?.[".tag"] === "file")
    .map((m: any) => ({
      path: m.metadata.metadata.path_lower,
      name: m.metadata.metadata.name,
    }));
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

// ── Fuzzy matching helpers ───────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatchScore(bookTitle: string, fileName: string): number {
  const normBook = normalize(bookTitle);
  const normFile = normalize(fileName.replace(/\.pdf$/i, ""));
  
  // Exact match
  if (normBook === normFile) return 1.0;
  
  // File contains book title
  if (normFile.includes(normBook)) return 0.9;
  
  // Book title contains file name
  if (normBook.includes(normFile)) return 0.85;
  
  // Word overlap score
  const bookWords = new Set(normBook.split(" ").filter(w => w.length > 2));
  const fileWords = new Set(normFile.split(" ").filter(w => w.length > 2));
  const overlap = [...bookWords].filter(w => fileWords.has(w)).length;
  const score = overlap / Math.max(bookWords.size, fileWords.size);
  
  return score;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Get all books without PDFs
  const noPdfs = await db.execute(sql`
    SELECT b.id, b.bookTitle, b.authorName 
    FROM book_profiles b
    LEFT JOIN content_files cf ON cf.contentItemId = b.id AND cf.fileType = 'pdf'
    WHERE cf.id IS NULL
    ORDER BY b.bookTitle
  `);
  
  const books = (noPdfs[0] as any[]).filter(b => !SKIP_TITLES.has(b.bookTitle));
  console.log(`Found ${books.length} books without PDFs (after filtering)`);

  // Get Dropbox token
  console.log("Getting Dropbox access token...");
  const token = await getDropboxToken();
  console.log("Got Dropbox token");

  const results: Array<{ title: string; success: boolean; source: string; error?: string }> = [];

  for (const book of books) {
    const title = book.bookTitle as string;
    const author = book.authorName as string;
    const bookId = book.id as number;

    try {
      console.log(`\nSearching for "${title}" by ${author}...`);
      
      // Search Dropbox for this book's PDF
      // Try multiple search queries
      const searchQueries = [
        title,
        title.split(":")[0].trim(), // Title before colon
        title.split(" ").slice(0, 4).join(" "), // First 4 words
      ];

      let bestMatch: { path: string; name: string; score: number } | null = null;

      for (const query of searchQueries) {
        if (query.length < 3) continue;
        const matches = await searchDropbox(token, query);
        
        for (const match of matches) {
          // Only accept actual PDF files
          if (!match.name.toLowerCase().endsWith('.pdf')) continue;
          const score = titleMatchScore(title, match.name);
          if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { ...match, score };
          }
        }
        
        if (bestMatch && bestMatch.score >= 0.85) break; // Good enough match found
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      }

      if (!bestMatch || bestMatch.score < 0.5) {
        console.log(`  ✗ No matching PDF found (best score: ${bestMatch?.score?.toFixed(2) ?? "none"})`);
        results.push({ title, success: false, source: "not-found" });
        continue;
      }

      console.log(`  → Found match: "${bestMatch.name}" (score: ${bestMatch.score.toFixed(2)})`);
      
      // Download from Dropbox
      console.log(`  → Downloading from Dropbox...`);
      const buffer = await downloadDropboxFile(token, bestMatch.path);
      console.log(`  → Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

      // Upload to S3
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const s3Key = `book-pdfs/${bookId}-${slug}.pdf`;
      const { url: s3Url } = await storagePut(s3Key, buffer, "application/pdf");
      console.log(`  ✓ Uploaded to S3: ${s3Url.slice(0, 60)}...`);

      // Insert content_files record
      await db.execute(sql`
        INSERT INTO content_files (contentItemId, s3Key, s3Url, originalFilename, cleanFilename, mimeType, fileSizeBytes, fileType, dropboxPath, dropboxSyncedAt, createdAt, updatedAt)
        VALUES (${bookId}, ${s3Key}, ${s3Url}, ${bestMatch.name}, ${slug + ".pdf"}, 'application/pdf', ${buffer.length}, 'pdf', ${bestMatch.path}, NOW(), NOW(), NOW())
      `);

      results.push({ title, success: true, source: "dropbox" });
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({ title, success: false, source: "error", error: err.message });
    }

    // Rate limit between books
    await new Promise(r => setTimeout(r, 1000));
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== PDF FILL RESULTS ===`);
  console.log(`Total: ${results.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  results.forEach(r => {
    const icon = r.success ? "✓" : "✗";
    console.log(`  ${icon} "${r.title}": ${r.source}${r.error ? " — " + r.error : ""}`);
  });

  fs.writeFileSync("/tmp/pdf_fill_results.json", JSON.stringify({ succeeded, failed, results }, null, 2));
  console.log("\nResults saved to /tmp/pdf_fill_results.json");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
