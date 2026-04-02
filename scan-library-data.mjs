/**
 * scan-library-data.mjs
 * Scans the AUTHORS array in libraryData.ts and uses Claude Opus to identify
 * entries that are book titles, topics, or other non-person names.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extract the AUTHORS array from libraryData.ts
const libData = readFileSync("/home/ubuntu/authors-books-library/client/src/lib/libraryData.ts", "utf-8");

// Parse all author entries - extract name field from each object in the AUTHORS array
const authorMatches = [...libData.matchAll(/"name":\s*"([^"]+)",\s*\n\s*"id":\s*"[^"]+",\s*\n\s*"category":/g)];
const authorNames = authorMatches.map(m => m[1]);

console.log(`Found ${authorNames.length} author entries in libraryData.ts\n`);

// Show all names for manual review
console.log("All author names:");
authorNames.forEach((name, i) => console.log(`  ${i+1}. ${name}`));

console.log("\n🧠 Running Claude Opus classification...\n");

// Classify in batches
const BATCH = 60;
const flagged = [];

for (let i = 0; i < authorNames.length; i += BATCH) {
  const batch = authorNames.slice(i, i + BATCH);
  process.stdout.write(`  Batch ${Math.floor(i/BATCH)+1}/${Math.ceil(authorNames.length/BATCH)}... `);

  const resp = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are reviewing an author database. Some entries are book titles, topics, or skills that were incorrectly added as author names.

Note: Many entries follow the pattern "Author Name - description" (e.g., "Adam Grant - organizational psychology"). These are VALID author entries.

FLAG entries that are clearly NOT person names:
- Book titles (e.g., "Active Listening", "Think and Grow Rich", "The 7 Habits of Highly Effective People")
- Topics or skills (e.g., "Leadership", "Time Management", "Communication")
- Generic phrases (e.g., "A Therapist's Guide to...", "Introduction to...")
- Company or brand names

KEEP entries that are:
- Person names with or without description suffix (e.g., "Adam Grant - psychology", "Simon Sinek")
- Even unusual names

Names to classify:
${batch.map((n, idx) => `${i+idx+1}. ${n}`).join("\n")}

Respond in JSON only:
{"flagged": [{"name": "<exact name>", "reason": "<why not a person>"}]}`
    }]
  });

  try {
    const text = resp.content[0].type === "text" ? resp.content[0].text : "{}";
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    const batchFlagged = parsed.flagged || [];
    flagged.push(...batchFlagged);
    console.log(`✓ (${batchFlagged.length} flagged)`);
  } catch (e) {
    console.log(`⚠️ parse error: ${e.message}`);
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`RESULTS: ${flagged.length} false positives found in libraryData.ts AUTHORS array`);
console.log("=".repeat(70));

if (flagged.length > 0) {
  flagged.forEach(f => {
    console.log(`\n  "${f.name}"`);
    console.log(`    Reason: ${f.reason}`);
  });
  
  writeFileSync("/tmp/librarydata-audit.json", JSON.stringify({
    scannedAt: new Date().toISOString(),
    totalScanned: authorNames.length,
    flaggedCount: flagged.length,
    flagged,
  }, null, 2));
  console.log("\n📄 Saved to /tmp/librarydata-audit.json");
} else {
  console.log("✅ All entries appear to be real person names.");
}
