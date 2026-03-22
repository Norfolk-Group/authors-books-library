/**
 * Fix Alan Dib Book Covers
 * 1. Updates "Lean Marketing" cover from Amazon
 * 2. Adds "The 1-Page Marketing Plan" as a new book entry with Amazon cover
 * Both covers are mirrored to S3 CDN via the Manus storage proxy.
 */

import mysql from "mysql2/promise";
import https from "https";
import http from "http";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env file
const envPath = join(__dirname, "../.env");
let envVars = {};
try {
  const content = readFileSync(envPath, "utf8");
  content.split("\n").forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch {}

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || envVars.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY || envVars.BUILT_IN_FORGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL || envVars.DATABASE_URL;

const LEAN_MARKETING = {
  bookTitle: "Lean Marketing",
  authorName: "Alan Dib",
  coverUrl: "https://m.media-amazon.com/images/I/612G+UBkh2L._SX600_.jpg",
  amazonUrl: "https://www.amazon.com/dp/B0CQ6T5KBY",
};

const ONE_PAGE_PLAN = {
  bookTitle: "The 1-Page Marketing Plan",
  authorName: "Alan Dib",
  coverUrl: "https://m.media-amazon.com/images/I/51jhXf1C1tL._SX600_.jpg",
  amazonUrl: "https://www.amazon.com/dp/B0FBCFSC3F",
};

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function uploadToForge(buffer, relKey) {
  const baseUrl = FORGE_API_URL.replace(/\/+$/, "");
  const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(relKey)}`;
  
  // Must use multipart/form-data with a 'file' field — same as server/storage.ts storagePut
  const blob = new Blob([buffer], { type: "image/jpeg" });
  const formData = new FormData();
  const fileName = relKey.split("/").pop() || "cover.jpg";
  formData.append("file", blob, fileName);
  
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${FORGE_API_KEY}`,
      // Do NOT set Content-Type manually — fetch sets it with the boundary automatically
    },
    body: formData,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${text}`);
  }
  
  const data = await res.json();
  return data.url || data.cdnUrl || data.publicUrl;
}

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  
  const db = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database");

  const books = [LEAN_MARKETING, ONE_PAGE_PLAN];

  for (const book of books) {
    console.log(`\nProcessing: ${book.bookTitle}`);

    // Download cover from Amazon
    console.log(`  Downloading cover from Amazon...`);
    let imgBuffer;
    try {
      imgBuffer = await fetchBuffer(book.coverUrl);
      console.log(`  Downloaded: ${imgBuffer.length} bytes`);
    } catch (err) {
      console.error(`  Download failed: ${err.message}`);
      continue;
    }

    // Upload to S3 via Forge proxy
    const suffix = randomBytes(4).toString("hex");
    const s3Key = `book-covers/${suffix}.jpg`;
    let s3Url = null;
    
    if (FORGE_API_URL && FORGE_API_KEY) {
      try {
        s3Url = await uploadToForge(imgBuffer, s3Key);
        console.log(`  Uploaded to S3: ${s3Url}`);
      } catch (err) {
        console.warn(`  S3 upload failed: ${err.message}. Using Amazon URL as fallback.`);
        s3Url = book.coverUrl;
      }
    } else {
      console.warn(`  No Forge credentials — using Amazon URL directly`);
      s3Url = book.coverUrl;
    }

    // Check if book exists
    const [rows] = await db.execute(
      "SELECT id FROM book_profiles WHERE bookTitle = ?",
      [book.bookTitle]
    );

    if (rows.length > 0) {
      await db.execute(
        `UPDATE book_profiles SET coverImageUrl = ?, s3CoverUrl = ?, amazonUrl = ?, updatedAt = NOW() WHERE bookTitle = ?`,
        [book.coverUrl, s3Url, book.amazonUrl, book.bookTitle]
      );
      console.log(`  ✓ Updated: ${book.bookTitle}`);
    } else {
      await db.execute(
        `INSERT INTO book_profiles (bookTitle, authorName, coverImageUrl, s3CoverUrl, amazonUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [book.bookTitle, book.authorName, book.coverUrl, s3Url, book.amazonUrl]
      );
      console.log(`  ✓ Inserted new: ${book.bookTitle}`);
    }
  }

  // Verify
  const [result] = await db.execute(
    "SELECT bookTitle, s3CoverUrl, amazonUrl FROM book_profiles WHERE authorName LIKE '%Alan Dib%' OR authorName LIKE '%Allan Dib%'"
  );
  console.log("\n=== Alan Dib books in DB ===");
  result.forEach(r => {
    const s3Status = r.s3CoverUrl ? "✓ S3" : "✗ no S3";
    const amazonStatus = r.amazonUrl ? "✓ Amazon" : "✗ no Amazon";
    console.log(`  ${r.bookTitle}: ${s3Status} | ${amazonStatus}`);
  });

  await db.end();
  console.log("\nDone.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
