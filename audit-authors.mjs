/**
 * audit-authors.mjs
 *
 * Scans the entire author_profiles table and uses Claude Opus to classify
 * each entry as a real person (KEEP) or a false positive (FLAG).
 *
 * False positives include:
 *   - Book titles (e.g., "Active Listening", "Think and Grow Rich")
 *   - Skills/topics (e.g., "Leadership", "Time Management")
 *   - Generic phrases (e.g., "Best Practices", "Introduction to")
 *   - Company/brand names (e.g., "Harvard Business Review")
 *   - Folder names or categories
 *
 * Usage:
 *   node audit-authors.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-5";
const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set"); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function classifyBatch(names) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are an expert at identifying whether a string is a real person's name or a false positive (book title, topic, skill, company, generic phrase, etc.).

For each name in the list below, classify it as:
- KEEP: This is a real person's name (author, speaker, thought leader, academic, business figure)
- FLAG: This is NOT a person's name (book title, topic, skill, company, phrase, category)

Be conservative — if it could plausibly be a person's name, classify as KEEP.
Only FLAG entries that are clearly not person names.

Names to classify (one per line):
${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Respond in JSON format:
{
  "results": [
    { "name": "<exact name>", "classification": "KEEP" | "FLAG", "reason": "<brief reason if FLAG>" },
    ...
  ]
}`
    }]
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    return parsed.results || [];
  } catch {
    return names.map(n => ({ name: n, classification: "KEEP", reason: "" }));
  }
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Get all author names
  const [rows] = await conn.execute(
    "SELECT id, authorName FROM author_profiles ORDER BY authorName ASC"
  );

  console.log(`📋 Scanning ${rows.length} author entries...\n`);

  const BATCH_SIZE = 50;
  const flagged = [];
  const kept = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const names = batch.map(r => r.authorName);
    
    process.stdout.write(`   Classifying batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${names[0]} → ${names[names.length - 1]})... `);
    
    try {
      const results = await classifyBatch(names);
      
      for (const result of results) {
        const row = batch.find(r => r.authorName === result.name);
        if (!row) continue;
        
        if (result.classification === "FLAG") {
          flagged.push({ id: row.id, name: result.name, reason: result.reason });
        } else {
          kept.push(result.name);
        }
      }
      
      console.log(`✓ (${results.filter(r => r.classification === "FLAG").length} flagged)`);
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  await conn.end();

  console.log("\n" + "=".repeat(60));
  console.log(`✅ AUDIT COMPLETE`);
  console.log(`   KEEP: ${kept.length} valid authors`);
  console.log(`   FLAG: ${flagged.length} false positives\n`);

  if (flagged.length > 0) {
    console.log("🚨 FALSE POSITIVES DETECTED:");
    console.log("=".repeat(60));
    for (const entry of flagged) {
      console.log(`  ID ${entry.id}: "${entry.name}"`);
      console.log(`    Reason: ${entry.reason}`);
    }
    
    // Write results to a JSON file for review
    const fs = await import("fs");
    const output = {
      scannedAt: new Date().toISOString(),
      totalScanned: rows.length,
      keepCount: kept.length,
      flagCount: flagged.length,
      flagged: flagged,
    };
    fs.writeFileSync("/tmp/author-audit-results.json", JSON.stringify(output, null, 2));
    console.log("\n📄 Full results saved to: /tmp/author-audit-results.json");
    console.log("\nTo delete flagged entries, run:");
    console.log("  node audit-authors.mjs --delete");
  } else {
    console.log("✅ No false positives found — all entries appear to be real people.");
  }
}

// If --delete flag is passed, delete all flagged entries
if (process.argv.includes("--delete")) {
  const fs = await import("fs");
  if (!fs.existsSync("/tmp/author-audit-results.json")) {
    console.error("❌ No audit results found. Run without --delete first.");
    process.exit(1);
  }
  
  const results = JSON.parse(fs.readFileSync("/tmp/author-audit-results.json", "utf-8"));
  const conn = await mysql.createConnection(DATABASE_URL);
  
  console.log(`🗑️  Deleting ${results.flagged.length} false positive entries...\n`);
  
  for (const entry of results.flagged) {
    try {
      // Delete linked data first
      await conn.execute("DELETE FROM author_rag_profiles WHERE authorName = ?", [entry.name]);
      await conn.execute("DELETE FROM author_interest_scores WHERE authorName = ?", [entry.name]);
      await conn.execute("DELETE FROM book_profiles WHERE authorName = ?", [entry.name]);
      // Delete the author profile
      await conn.execute("DELETE FROM author_profiles WHERE id = ?", [entry.id]);
      console.log(`  ✅ Deleted: "${entry.name}" (ID: ${entry.id})`);
    } catch (err) {
      console.log(`  ❌ Failed to delete "${entry.name}": ${err.message}`);
    }
  }
  
  await conn.end();
  console.log("\n✅ Deletion complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
