/**
 * fill_pdfs_from_scan.ts
 * Uses the Dropbox scan JSON to match books without PDFs to their files,
 * then downloads and uploads to S3. Also deduplicates book entries.
 */
import { getDb } from "../server/db";
import { bookProfiles, contentFiles } from "../drizzle/schema";
import { storagePut } from "../server/storage";
import { sql, eq } from "drizzle-orm";
import https from "https";
import fs from "fs";

const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN!;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY!;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET!;

// Books to skip (not real books or known unfindable)
const SKIP_TITLES = new Set([
  "Active Listening",
  "Active Listening Techniques",
  "Podcasts",
  "Leading Engaging Meetings",
]);

// Duplicate book IDs to skip (keep only the canonical version)
// Format: id → canonical id (the one that already has a PDF or is the "real" one)
const DUPLICATE_IDS = new Set([
  // 1929 duplicates — id=11 is the original, 210005 is the long-title duplicate
  11,
  // A Therapist's Guide — 3 versions with different apostrophes
  210017, 112, // keep 30001 (has the standard apostrophe)
  // Founder's Pocket Guide — two versions
  30003, // keep 210021
  // Good to Great (Summary) — summary, not the real book
  82,
  // The Leader's Guide / The Leaders Guide / The Leader — Eric Ries duplicates
  50, 51, 60002, // keep The Leader's Guide (60002 is likely canonical)
  // The Customer Success Professional duplicates
  19, // keep 30004
  // Never Eat Alone — check which is canonical
  // The Dip_ (with underscore) vs The Dip
  124, // keep the clean version
  // Hidden Brain / The Hidden Brain
  127, // keep 126
  // Small Data_ (with underscore)
  97,
  // Steve Jobs_ (with underscore)
  86,
  // 7 Powers_ (with underscore)
  63,
  // Inside Steve (truncated)
  91,
  // New Business Road Test, The (inverted title)
  85,
  // Never Split the Difference by Chris Voss (has author in title)
  120005,
  // Start with a No / No (Jim Camp duplicates)
  120008,
  // The Dip_ with underscore
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[''`\u2019\u2018]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatchScore(bookTitle: string, fileName: string): number {
  const normBook = normalize(bookTitle);
  const normFile = normalize(fileName.replace(/\.pdf$/i, "").replace(/\s+by\s+.+$/i, ""));
  
  if (normBook === normFile) return 1.0;
  if (normFile.includes(normBook)) return 0.9;
  if (normBook.includes(normFile)) return 0.85;
  
  const bookWords = new Set(normBook.split(" ").filter(w => w.length > 2));
  const fileWords = new Set(normFile.split(" ").filter(w => w.length > 2));
  const overlap = [...bookWords].filter(w => fileWords.has(w)).length;
  const score = overlap / Math.max(bookWords.size, fileWords.size);
  return score;
}

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Load the Dropbox scan data
  console.log("Loading Dropbox scan data...");
  const scanRaw = fs.readFileSync("/tmp/dropbox_smart.json", "utf-8");
  // The scan file has mixed content - extract the JSON part
  const jsonMatch = scanRaw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not find JSON in scan file");
  
  // Parse the scan to build a map of book folder → PDF paths
  // The scan format: each line is either a log line or JSON
  const lines = scanRaw.split("\n");
  
  // Build a map: normalized folder name → array of PDF path_lower values
  const dropboxPdfs: Array<{ folderName: string; pdfPath: string; authorFolder: string }> = [];
  
  // Parse the scan output - look for PDF paths in the log
  for (const line of lines) {
    // Lines like: "  PDF: /path/to/file.pdf"
    const pdfMatch = line.match(/PDF:\s+(.+\.pdf)/i);
    if (pdfMatch) {
      const fullPath = pdfMatch[1].trim();
      const parts = fullPath.split("/");
      // Structure: /backup/AuthorName/books/BookTitle/book/pdf/file.pdf
      // or: /backup/AuthorName/books/BookTitle/file.pdf
      const fileName = parts[parts.length - 1];
      const authorFolder = parts[3] || "";
      // Find book folder name (usually 2-3 levels up from the PDF)
      const bookFolder = parts.find((p, i) => 
        i > 3 && p.toLowerCase() !== "book" && p.toLowerCase() !== "pdf" && 
        p.toLowerCase() !== "books" && !p.endsWith(".pdf")
      ) || "";
      
      dropboxPdfs.push({
        folderName: bookFolder,
        pdfPath: fullPath,
        authorFolder,
      });
    }
  }
  
  console.log(`Found ${dropboxPdfs.length} PDFs in scan data`);

  // Get books without PDFs
  const noPdfs = await db.execute(sql`
    SELECT b.id, b.bookTitle, b.authorName 
    FROM book_profiles b
    LEFT JOIN content_files cf ON cf.contentItemId = b.id AND cf.fileType = 'pdf'
    WHERE cf.id IS NULL
    ORDER BY b.bookTitle
  `);
  
  const books = (noPdfs[0] as any[]).filter(b => 
    !SKIP_TITLES.has(b.bookTitle) && 
    !DUPLICATE_IDS.has(b.id)
  );
  
  console.log(`Found ${books.length} books without PDFs (after filtering duplicates)`);

  // Get Dropbox token
  console.log("Getting Dropbox access token...");
  const token = await getDropboxToken();

  const results: Array<{ title: string; id: number; success: boolean; source: string; error?: string }> = [];

  for (const book of books) {
    const title = book.bookTitle as string;
    const author = book.authorName as string;
    const bookId = book.id as number;

    try {
      console.log(`\nSearching for "${title}" by ${author}...`);
      
      // Find best matching PDF in scan data
      let bestMatch: { folderName: string; pdfPath: string; score: number } | null = null;
      
      for (const pdf of dropboxPdfs) {
        // Score against folder name
        const folderScore = pdf.folderName ? titleMatchScore(title, pdf.folderName) : 0;
        // Score against PDF filename
        const fileScore = titleMatchScore(title, pdf.pdfPath.split("/").pop() || "");
        const score = Math.max(folderScore, fileScore);
        
        if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { ...pdf, score };
        }
      }

      if (!bestMatch || bestMatch.score < 0.5) {
        console.log(`  ✗ No matching PDF found in scan data`);
        results.push({ title, id: bookId, success: false, source: "not-found" });
        continue;
      }

      console.log(`  → Found match: "${bestMatch.pdfPath.split("/").pop()}" (score: ${bestMatch.score.toFixed(2)})`);
      
      // Download from Dropbox
      console.log(`  → Downloading from Dropbox: ${bestMatch.pdfPath}`);
      const buffer = await downloadDropboxFile(token, bestMatch.pdfPath);
      console.log(`  → Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

      // Upload to S3
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const s3Key = `book-pdfs/${bookId}-${slug}.pdf`;
      const { url: s3Url } = await storagePut(s3Key, buffer, "application/pdf");
      console.log(`  ✓ Uploaded to S3: ${s3Url.slice(0, 60)}...`);

      // Insert content_files record
      const fileName = bestMatch.pdfPath.split("/").pop() || `${slug}.pdf`;
      await db.execute(sql`
        INSERT INTO content_files (contentItemId, s3Key, s3Url, originalFilename, cleanFilename, mimeType, fileSizeBytes, fileType, dropboxPath, dropboxSyncedAt, createdAt, updatedAt)
        VALUES (${bookId}, ${s3Key}, ${s3Url}, ${fileName}, ${slug + ".pdf"}, 'application/pdf', ${buffer.length}, 'pdf', ${bestMatch.pdfPath}, NOW(), NOW(), NOW())
      `);

      results.push({ title, id: bookId, success: true, source: "dropbox-scan" });
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({ title, id: bookId, success: false, source: "error", error: err.message });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== PDF FILL RESULTS (from scan) ===`);
  console.log(`Total: ${results.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  results.forEach(r => {
    const icon = r.success ? "✓" : "✗";
    console.log(`  ${icon} [${r.id}] "${r.title}": ${r.source}${r.error ? " — " + r.error : ""}`);
  });

  fs.writeFileSync("/tmp/pdf_fill_scan_results.json", JSON.stringify({ succeeded, failed, results }, null, 2));
  console.log("\nResults saved to /tmp/pdf_fill_scan_results.json");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
