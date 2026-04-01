/**
 * score-interests.mjs
 *
 * Runs Claude Opus interest contrast scoring for all authors with ready RAG files
 * against all user interests in the database.
 *
 * Usage:
 *   node score-interests.mjs
 *   node score-interests.mjs "Adam Grant"   # score a single author
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import Anthropic from "@anthropic-ai/sdk";

const TARGET_AUTHOR = process.argv[2] ?? null; // null = all authors
const MODEL = "claude-opus-4-5";
const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set"); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function scorePair(ragContent, interest) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `You are an expert at analyzing intellectual alignment between an author's body of work and a specific topic of interest.

AUTHOR RAG PROFILE (first 3000 chars):
${ragContent.slice(0, 3000)}

INTEREST TO EVALUATE:
Topic: ${interest.topic}
Category: ${interest.category}
Description: ${interest.description || ""}

Score how well this author aligns with this interest on a scale of 0-10, where:
- 0-2: No meaningful connection
- 3-4: Tangential connection
- 5-6: Moderate alignment, some relevant work
- 7-8: Strong alignment, significant relevant content
- 9-10: Core focus, this is central to the author's work

Respond in JSON format exactly:
{
  "score": <number 0-10>,
  "rationale": "<2-3 sentences explaining the score>",
  "key_connections": ["<connection 1>", "<connection 2>", "<connection 3>"]
}`
    }]
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    return { score: 0, rationale: "Could not parse response", key_connections: [] };
  }
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Get all user interests
  const [interests] = await conn.execute(
    "SELECT id, topic, category, description, weight FROM user_interests ORDER BY weight DESC"
  );

  if (interests.length === 0) {
    console.log("⚠️  No active interests found. Run seed-interests.mjs first.");
    await conn.end();
    return;
  }

  console.log(`📋 Found ${interests.length} active interests`);

  // Get authors with ready RAG files
  let authorQuery = `
    SELECT ap.id, ap.authorName as name, arp.ragFileUrl, arp.id as rag_id
    FROM author_profiles ap
    JOIN author_rag_profiles arp ON arp.authorName = ap.authorName
    WHERE arp.ragStatus = 'ready' AND arp.ragFileUrl IS NOT NULL
  `;
  const params = [];
  if (TARGET_AUTHOR) {
    authorQuery += " AND ap.authorName LIKE ?";
    params.push(`%${TARGET_AUTHOR}%`);
  }

  const [authors] = await conn.execute(authorQuery, params);

  // Fetch RAG content from S3 for each author
  for (const author of authors) {
    try {
      const res = await fetch(author.ragFileUrl);
      author.rag_content = await res.text();
    } catch (e) {
      author.rag_content = `Author: ${author.name}`;
    }
  }

  if (authors.length === 0) {
    console.log("⚠️  No authors with ready RAG files found.");
    await conn.end();
    return;
  }

  console.log(`👥 Scoring ${authors.length} author(s) against ${interests.length} interest(s)\n`);

  for (const author of authors) {
    console.log(`\n🧠 Scoring: ${author.name}`);
    
    for (const interest of interests) {
      process.stdout.write(`   📊 ${interest.topic}... `);
      
      try {
        const result = await scorePair(author.rag_content, interest);
        const score = Math.min(10, Math.max(0, Math.round(result.score)));
        
        // Upsert the score
        await conn.execute(`
          INSERT INTO author_interest_scores 
            (authorName, interestId, userId, score, rationale, modelUsed, computedAt)
          VALUES (?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            rationale = VALUES(rationale),
            modelUsed = VALUES(modelUsed),
            computedAt = NOW()
        `, [
          author.name,
          interest.id,
          'owner',
          score,
          result.rationale,
          MODEL
        ]);

        const bar = "█".repeat(score) + "░".repeat(10 - score);
        console.log(`${bar} ${score}/10`);
      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
      }
    }
  }

  await conn.end();

  console.log("\n✅ Interest scoring complete!");
  console.log("📊 View results at: /interests/heatmap");
  console.log("🔍 Compare authors at: /interests/contrast");
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
