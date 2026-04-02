/**
 * find-bad-authors.mjs
 * Finds suspicious author entries using pattern matching + Claude Opus validation
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Get ALL author names and their book counts
  const [rows] = await conn.execute(`
    SELECT 
      ap.id,
      ap.authorName,
      ap.bio,
      ap.avatarUrl,
      ap.s3AvatarUrl,
      COUNT(bp.id) as bookCount
    FROM author_profiles ap
    LEFT JOIN book_profiles bp ON bp.authorName = ap.authorName
    GROUP BY ap.id, ap.authorName, ap.bio, ap.avatarUrl, ap.s3AvatarUrl
    ORDER BY ap.authorName ASC
  `);

  console.log(`Total entries: ${rows.length}\n`);

  // Pattern-based suspicious detection
  const suspicious = [];
  for (const row of rows) {
    const name = row.authorName;
    const flags = [];

    // All lowercase (real names have capitals)
    if (name === name.toLowerCase() && name.length > 2) {
      flags.push("all_lowercase");
    }
    // Starts with article
    if (/^(the |a |an )/i.test(name)) {
      flags.push("starts_with_article");
    }
    // Starts with verb phrase
    if (/^(how to|introduction to|guide to|learn|mastering|becoming|building)/i.test(name)) {
      flags.push("starts_with_verb_phrase");
    }
    // Contains numbers (rare in real names)
    if (/\d/.test(name)) {
      flags.push("contains_numbers");
    }
    // Very long (book titles tend to be longer)
    if (name.split(" ").length > 5) {
      flags.push("too_many_words");
    }
    // No bio, no avatar, no books
    if (!row.bio && !row.avatarUrl && !row.s3AvatarUrl && row.bookCount === 0) {
      flags.push("no_data_at_all");
    }

    if (flags.length > 0) {
      suspicious.push({ id: row.id, name, flags, bookCount: row.bookCount, hasBio: !!row.bio });
    }
  }

  console.log(`Pattern-flagged suspicious entries: ${suspicious.length}`);
  suspicious.forEach(s => {
    console.log(`  [${s.id}] "${s.name}" — flags: ${s.flags.join(", ")} | books: ${s.bookCount} | bio: ${s.hasBio}`);
  });

  // Now use Claude Opus to validate ALL entries with context
  console.log("\n🧠 Running Claude Opus classification on all entries...\n");

  const allNames = rows.map(r => r.authorName);
  const BATCH = 60;
  const flaggedByAI = [];

  for (let i = 0; i < allNames.length; i += BATCH) {
    const batch = allNames.slice(i, i + BATCH);
    process.stdout.write(`  Batch ${Math.floor(i/BATCH)+1}/${Math.ceil(allNames.length/BATCH)}... `);

    const resp = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are an expert at identifying whether a string is a real person's name or a false positive entry in an author database.

FALSE POSITIVES include:
- Book titles (e.g., "Active Listening", "Think and Grow Rich", "The 7 Habits")
- Skills or topics (e.g., "active listening", "time management", "leadership")
- Generic phrases or categories
- Company names or brand names
- Podcast or show names
- Single common words that aren't names

KEEP entries that are:
- Real person names (first + last name, or well-known single names like "Confucius")
- Even if unusual or non-English names

For each name below, respond with FLAG if it is NOT a real person's name.
Only include flagged entries in your response.

Names:
${batch.map((n, i) => `${i+1}. ${n}`).join("\n")}

Respond in JSON:
{"flagged": [{"name": "<exact name>", "reason": "<why it's not a person>"}]}`
      }]
    });

    try {
      const text = resp.content[0].type === "text" ? resp.content[0].text : "{}";
      const clean = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(clean);
      const batchFlagged = parsed.flagged || [];
      flaggedByAI.push(...batchFlagged);
      console.log(`✓ (${batchFlagged.length} flagged)`);
    } catch {
      console.log("⚠️ parse error");
    }
  }

  console.log(`\n🚨 Claude Opus flagged: ${flaggedByAI.length} false positives\n`);

  // Merge pattern + AI flags
  const allFlagged = new Map();
  for (const s of suspicious) {
    allFlagged.set(s.name, { ...s, source: "pattern" });
  }
  for (const f of flaggedByAI) {
    const row = rows.find(r => r.authorName === f.name);
    if (row) {
      if (allFlagged.has(f.name)) {
        allFlagged.get(f.name).source = "both";
        allFlagged.get(f.name).aiReason = f.reason;
      } else {
        allFlagged.set(f.name, { id: row.id, name: f.name, aiReason: f.reason, source: "ai_only", bookCount: row.bookCount });
      }
    }
  }

  const finalFlagged = Array.from(allFlagged.values()).sort((a, b) => a.name.localeCompare(b.name));

  console.log("=".repeat(70));
  console.log(`FINAL AUDIT RESULTS — ${finalFlagged.length} entries to review:`);
  console.log("=".repeat(70));
  finalFlagged.forEach(f => {
    console.log(`\n  ID ${f.id}: "${f.name}"`);
    console.log(`    Source: ${f.source}`);
    if (f.aiReason) console.log(`    AI reason: ${f.aiReason}`);
    if (f.flags) console.log(`    Pattern flags: ${f.flags.join(", ")}`);
    console.log(`    Books in DB: ${f.bookCount ?? "?"}`);
  });

  // Save to JSON
  const { writeFileSync } = await import("fs");
  const output = {
    scannedAt: new Date().toISOString(),
    totalScanned: rows.length,
    flaggedCount: finalFlagged.length,
    flagged: finalFlagged,
  };
  writeFileSync("/tmp/author-audit-results.json", JSON.stringify(output, null, 2));
  console.log("\n📄 Results saved to /tmp/author-audit-results.json");
  console.log("To delete all flagged entries: node audit-authors.mjs --delete");

  await conn.end();
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
