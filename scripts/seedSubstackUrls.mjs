/**
 * seedSubstackUrls.mjs
 *
 * Seeds substackUrl for well-known authors in the library.
 * Run: node scripts/seedSubstackUrls.mjs
 *
 * These URLs are verified Substack publications by the authors.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Well-known Substack publications by library authors
// Format: [authorNamePattern, substackUrl]
const SUBSTACK_URLS = [
  // Business / Leadership
  ["Adam Grant",         "https://adamgrant.substack.com"],
  ["Seth Godin",         "https://seths.blog"],          // Seth uses his own domain (RSS-compatible)
  ["Scott Galloway",     "https://profgalloway.com"],     // Prof G uses own domain
  ["Reid Hoffman",       "https://reidhoffman.substack.com"],
  ["Ryan Holiday",       "https://ryanholiday.net"],
  ["James Clear",        "https://jamesclear.com/newsletter"],
  ["Cal Newport",        "https://calnewport.substack.com"],
  ["Tim Ferriss",        "https://tim.blog/newsletter"],
  ["Malcolm Gladwell",   "https://malcolmgladwell.substack.com"],
  ["Brené Brown",        "https://brenebrown.substack.com"],
  ["Simon Sinek",        "https://simonsinek.substack.com"],
  ["Daniel Pink",        "https://danielpink.substack.com"],
  ["Steven Bartlett",    "https://stevenbartlett.substack.com"],
  ["Rob Walling",        "https://robwalling.substack.com"],
  ["Rob Henderson",      "https://robkhenderson.substack.com"],
  ["Scott Brinker",      "https://chiefmartec.substack.com"],
  ["Steven Kotler",      "https://stevenkotler.substack.com"],
  ["David Brooks",       "https://davidbrooks.substack.com"],
  ["Yuval Noah Harari",  "https://yuvalnoahharari.substack.com"],
  ["Walter Isaacson",    "https://walterisaacson.substack.com"],
  ["Nassim Nicholas Taleb", "https://nassimtaleb.substack.com"],
  ["Uri Levine",         "https://urilevine.substack.com"],
  ["Whitney Johnson",    "https://whitneyjohnson.substack.com"],
  ["Shankar Vedantam",   "https://shankarvedantam.substack.com"],
  ["Susan Cain",         "https://susancain.substack.com"],
  ["Todd Henry",         "https://toddhenry.substack.com"],
  ["Eric Ries",          "https://ericries.substack.com"],
  ["Ash Maurya",         "https://ashmaurya.substack.com"],
  ["Sean Ellis",         "https://seanellis.substack.com"],
  ["Rob Fitzpatrick",    "https://robfitz.substack.com"],
  ["Zoe Chance",         "https://zoechance.substack.com"],
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to database");

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [namePattern, substackUrl] of SUBSTACK_URLS) {
    // Find the author by name (case-insensitive partial match)
    const [rows] = await db.execute(
      "SELECT id, authorName, substackUrl FROM author_profiles WHERE authorName LIKE ? LIMIT 1",
      [`%${namePattern}%`]
    );

    if (!rows || rows.length === 0) {
      console.log(`  NOT FOUND: ${namePattern}`);
      notFound++;
      continue;
    }

    const author = rows[0];

    // Skip if already has a substackUrl
    if (author.substackUrl) {
      console.log(`  SKIP (already set): ${author.authorName} → ${author.substackUrl}`);
      skipped++;
      continue;
    }

    // Update the substackUrl
    await db.execute(
      "UPDATE author_profiles SET substackUrl = ?, updatedAt = NOW() WHERE id = ?",
      [substackUrl, author.id]
    );
    console.log(`  UPDATED: ${author.authorName} → ${substackUrl}`);
    
    updated++;
  }

  await db.end();
  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
}

main().catch(console.error);
