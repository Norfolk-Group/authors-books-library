/**
 * Session A — Step 4: Score all authors against user interests
 * Runs the same logic as userInterests.scoreAllAuthors but server-side.
 * Processes all authors with ready RAG files.
 *
 * Usage: npx tsx scripts/session-a-score-authors.mts [--concurrency=2]
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const CONCURRENCY = parseInt(args.concurrency ?? "2", 10);
const MODEL = args.model ?? "claude-haiku-4-5";
const OWNER_ID = process.env.OWNER_OPEN_ID ?? "";

if (!OWNER_ID) {
  console.error("❌ OWNER_OPEN_ID not set in environment");
  process.exit(1);
}

const { getDb } = await import("../server/db.js");
const { invokeLLM } = await import("../server/_core/llm.js");
const { authorRagProfiles, userInterests, authorInterestScores } = await import("../drizzle/schema.js");
const { eq } = await import("drizzle-orm");

const db = await getDb();
if (!db) { console.error("❌ DB unavailable"); process.exit(1); }

// Fetch user interests
const interests = await db.select().from(userInterests).where(eq(userInterests.userId, OWNER_ID));
if (interests.length === 0) {
  console.error("❌ No interests found for owner:", OWNER_ID);
  process.exit(1);
}
console.log(`\n📊 Scoring authors against ${interests.length} interests for owner: ${OWNER_ID}`);
console.log(`   Interests: ${interests.map(i => i.topic).join(", ")}\n`);

// Fetch all ready RAG rows
const ragRows = await db
  .select({ authorName: authorRagProfiles.authorName, ragFileUrl: authorRagProfiles.ragFileUrl, ragVersion: authorRagProfiles.ragVersion })
  .from(authorRagProfiles)
  .where(eq(authorRagProfiles.ragStatus, "ready" as const));

console.log(`🎯 ${ragRows.length} authors with ready RAG files to score\n`);

// Score each author
async function scoreAuthor(rag: { authorName: string; ragFileUrl: string | null; ragVersion: number | null }) {
  if (!rag.ragFileUrl) return { success: false, reason: "no ragFileUrl" };
  
  const resp = await fetch(rag.ragFileUrl);
  if (!resp.ok) return { success: false, reason: `fetch failed: ${resp.status}` };
  const ragContent = await resp.text();
  
  const interestList = interests
    .map(i => `- ID ${i.id}: "${i.topic}"${i.description ? ` (${i.description})` : ""} [weight: ${i.weight}]`)
    .join("\n");
  
  const prompt = `You are scoring how well an author's body of work aligns with a user's personal interests.
AUTHOR RAG FILE (first 3000 chars):
${ragContent.slice(0, 3000)}
USER INTERESTS TO SCORE:
${interestList}
For each interest, provide:
- A score from 0–10 (0 = no alignment, 10 = this author is a primary authority on this topic)
- A one-sentence rationale citing specific works or ideas
Return ONLY valid JSON array:
[
  { "interestId": <number>, "score": <0-10>, "rationale": "<one sentence>" },
  ...
]`;

  const llmResp = await invokeLLM({
    model: MODEL,
    messages: [
      { role: "system", content: "You are a precise interest-alignment scorer. Return only valid JSON arrays." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });
  
  const raw = llmResp?.choices?.[0]?.message?.content ?? "[]";
  const content = typeof raw === "string" ? raw : "[]";
  let parsed: Array<{ interestId: number; score: number; rationale: string }>;
  const obj = JSON.parse(content);
  if (Array.isArray(obj)) {
    parsed = obj;
  } else if (obj.scores && Array.isArray(obj.scores)) {
    parsed = obj.scores;
  } else {
    const firstArray = Object.values(obj).find(Array.isArray);
    parsed = (firstArray as typeof parsed) ?? [];
  }
  
  const scores = parsed.map(item => ({
    interestId: item.interestId,
    score: Math.max(0, Math.min(10, Math.round(item.score))),
    rationale: item.rationale ?? "",
  }));
  
  for (const score of scores) {
    await db.insert(authorInterestScores)
      .values({
        authorName: rag.authorName,
        interestId: score.interestId,
        userId: OWNER_ID,
        score: score.score,
        rationale: score.rationale,
        modelUsed: MODEL,
        computedAt: new Date(),
        ragVersion: rag.ragVersion ?? 1,
      })
      .onDuplicateKeyUpdate({
        set: {
          score: score.score,
          rationale: score.rationale,
          modelUsed: MODEL,
          computedAt: new Date(),
          ragVersion: rag.ragVersion ?? 1,
        },
      });
  }
  
  return { success: true, scoreCount: scores.length };
}

let done = 0;
let succeeded = 0;
let failed = 0;

for (let i = 0; i < ragRows.length; i += CONCURRENCY) {
  const batch = ragRows.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async (rag) => {
    try {
      const result = await scoreAuthor(rag);
      if (result.success) {
        succeeded++;
        done++;
        const pct = Math.round((done / ragRows.length) * 100);
        console.log(`  ✓ [${done}/${ragRows.length}] ${pct}% — ${rag.authorName} (${result.scoreCount} scores)`);
      } else {
        failed++;
        done++;
        console.log(`  ⚠️  [${done}/${ragRows.length}] ${rag.authorName}: ${result.reason}`);
      }
    } catch (err) {
      failed++;
      done++;
      console.error(`  ✗ [${done}/${ragRows.length}] ${rag.authorName}: ${String(err).slice(0, 100)}`);
    }
  }));
}

console.log(`\n📊 Scoring Complete`);
console.log(`   Succeeded: ${succeeded}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${ragRows.length}`);

process.exit(failed > succeeded ? 1 : 0);
