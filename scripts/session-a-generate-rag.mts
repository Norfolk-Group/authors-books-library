/**
 * Session A — Step 2: Batch RAG Generation
 * Generates Digital Me RAG files for all pending/stale authors.
 * Uses the same logic as ragPipeline.generate but runs server-side.
 *
 * Usage: npx tsx scripts/session-a-generate-rag.mts [--concurrency=3] [--limit=50] [--model=claude-haiku-4-5]
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const CONCURRENCY = parseInt(args.concurrency ?? "3", 10);
const LIMIT = parseInt(args.limit ?? "999", 10);
const MODEL = args.model ?? "claude-haiku-4-5"; // Use haiku for speed/cost efficiency

// Dynamic imports (must come after dotenv.config)
const { getDb } = await import("../server/db.js");
const { invokeLLM } = await import("../server/_core/llm.js");
const { storagePut } = await import("../server/storage.js");
const { authorProfiles, authorRagProfiles, bookProfiles } = await import("../drizzle/schema.js");
const { eq } = await import("drizzle-orm");

const db = await getDb();
if (!db) {
  console.error("❌ Database unavailable");
  process.exit(1);
}

// ── Helper: extract book insights ─────────────────────────────────────────────
async function extractBookInsights(book: { bookTitle: string; summary: string | null; keyThemes: string | null; richSummaryJson: string | null }, authorName: string): Promise<string> {
  const themes = book.keyThemes ?? "";
  const summary = book.summary ?? "";
  if (!summary && !themes) return `Book: "${book.bookTitle}" — no summary available`;
  const resp = await invokeLLM({
    messages: [
      { role: "system", content: "You are extracting key insights from a book for an author persona knowledge file. Be concise and specific. Focus on ideas, voice, and themes that reveal the author's thinking." },
      { role: "user", content: `Book: "${book.bookTitle}" by ${authorName}\n\nSummary: ${summary}\n\nKey Themes: ${themes}\n\nExtract 3-5 key insights that reveal this author's thinking, voice, and intellectual contributions. Be specific and concrete.` },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}

// ── Helper: synthesize RAG file ────────────────────────────────────────────────
async function synthesizeRagFile(author: { authorName: string; bio: string | null; richBioJson: string | null; socialStatsJson: string | null }, bookInsights: string[]): Promise<string> {
  const richBio = author.richBioJson ? (() => { try { return JSON.parse(author.richBioJson!); } catch { return null; } })() : null;
  const fullBio = richBio?.fullBio ?? author.bio ?? "";
  const professionalSummary = richBio?.professionalSummary ?? "";
  const insightsText = bookInsights.length > 0 ? bookInsights.join("\n\n---\n\n") : "No book insights available.";

  const resp = await invokeLLM({
    messages: [
      { role: "system", content: `You are building a comprehensive persona knowledge file for ${author.authorName}. This file will be used as a RAG document to power an AI chatbot that can discuss this author's work, ideas, and perspectives. Write in a structured, information-dense format.` },
      { role: "user", content: `Author: ${author.authorName}\n\nBio: ${fullBio}\n\nProfessional Summary: ${professionalSummary}\n\nBook Insights:\n${insightsText}\n\nCreate a comprehensive Digital Me knowledge file for ${author.authorName}. Include: core intellectual contributions, recurring themes, writing style, key arguments, notable quotes (if known), areas of expertise, and how their ideas connect. Format as structured Markdown.` },
    ],
  });
  return resp.choices[0]?.message?.content ?? `# ${author.authorName}\n\n${fullBio}`;
}

// ── Main ───────────────────────────────────────────────────────────────────────
// Fetch all pending/stale authors
const pendingRows = await db
  .select({ authorName: authorRagProfiles.authorName, ragVersion: authorRagProfiles.ragVersion })
  .from(authorRagProfiles)
  .where(eq(authorRagProfiles.ragStatus, "stale" as const))
  .limit(LIMIT);

// Also get "pending" status
const pendingRows2 = await db
  .select({ authorName: authorRagProfiles.authorName, ragVersion: authorRagProfiles.ragVersion })
  .from(authorRagProfiles)
  .where(eq(authorRagProfiles.ragStatus, "pending" as const))
  .limit(LIMIT);

const allTargets = [...pendingRows, ...pendingRows2].slice(0, LIMIT);

console.log(`\n🚀 Session A — Batch RAG Generation`);
console.log(`   Model: ${MODEL}`);
console.log(`   Concurrency: ${CONCURRENCY}`);
console.log(`   Targets: ${allTargets.length} authors (pending + stale)`);
console.log(`   Limit: ${LIMIT}\n`);

if (allTargets.length === 0) {
  console.log("✅ No pending/stale authors — all RAG files are up to date.");
  process.exit(0);
}

let done = 0;
let succeeded = 0;
let failed = 0;
const errors: string[] = [];

// Process in batches of CONCURRENCY
for (let i = 0; i < allTargets.length; i += CONCURRENCY) {
  const batch = allTargets.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async (row) => {
    const { authorName, ragVersion } = row;
    const nextVersion = (ragVersion ?? 0) + 1;
    try {
      // Mark as generating
      await db.update(authorRagProfiles).set({ ragStatus: "generating" as const, ragError: null, updatedAt: new Date() }).where(eq(authorRagProfiles.authorName, authorName));

      // Fetch author data
      const authorRows = await db
        .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson, socialStatsJson: authorProfiles.socialStatsJson, bioCompleteness: authorProfiles.bioCompleteness })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, authorName))
        .limit(1);
      if (!authorRows[0]) throw new Error(`Author not found in author_profiles`);
      const author = authorRows[0];

      // Fetch books
      const books = await db
        .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary, keyThemes: bookProfiles.keyThemes, richSummaryJson: bookProfiles.richSummaryJson })
        .from(bookProfiles)
        .where(eq(bookProfiles.authorName, authorName));

      // Extract per-book insights (cap at 8 for speed)
      const bookInsights: string[] = [];
      for (const book of books.slice(0, 8)) {
        const insight = await extractBookInsights(book, authorName);
        bookInsights.push(insight);
      }

      // Synthesize RAG file
      const ragContent = await synthesizeRagFile(author, bookInsights);
      const wordCount = ragContent.split(/\s+/).length;

      // Upload to S3
      const s3Key = `library/${authorName.toLowerCase().replace(/\s+/g, "-")}/digital-me/rag-v${nextVersion}.md`;
      const { url: ragFileUrl } = await storagePut(s3Key, Buffer.from(ragContent, "utf-8"), "text/markdown");

      // Update DB
      await db.update(authorRagProfiles).set({
        ragFileUrl,
        ragFileKey: s3Key,
        ragVersion: nextVersion,
        ragGeneratedAt: new Date(),
        ragWordCount: wordCount,
        ragModel: MODEL,
        ragVendor: MODEL.startsWith("claude") ? "anthropic" : "google",
        contentItemCount: books.length,
        bioCompletenessAtGeneration: author.bioCompleteness ?? 0,
        ragStatus: "ready" as const,
        ragError: null,
        updatedAt: new Date(),
      }).where(eq(authorRagProfiles.authorName, authorName));

      succeeded++;
      done++;
      const pct = Math.round((done / allTargets.length) * 100);
      console.log(`  ✓ [${done}/${allTargets.length}] ${pct}% — ${authorName} (${wordCount} words, ${books.length} books)`);
    } catch (err) {
      failed++;
      done++;
      const msg = String(err);
      errors.push(`${authorName}: ${msg}`);
      console.error(`  ✗ [${done}/${allTargets.length}] ${authorName}: ${msg}`);
      // Mark as stale so it can be retried
      await db.update(authorRagProfiles).set({ ragStatus: "stale" as const, ragError: msg.slice(0, 500), updatedAt: new Date() }).where(eq(authorRagProfiles.authorName, authorName)).catch(() => {});
    }
  }));
}

console.log(`\n📊 Batch RAG Generation Complete`);
console.log(`   Succeeded: ${succeeded}`);
console.log(`   Failed: ${failed}`);
if (errors.length > 0) {
  console.log(`\n❌ Errors:`);
  errors.forEach(e => console.log(`   ${e}`));
}

// Final coverage stats
const [[{ ready }]] = await db.execute!("SELECT COUNT(*) as ready FROM author_rag_profiles WHERE ragStatus = 'ready'") as any;
const [[{ total }]] = await db.execute!("SELECT COUNT(*) as total FROM author_profiles") as any;
console.log(`\n✅ RAG Coverage: ${ready}/${total} (${Math.round(ready/total*100)}%)`);

process.exit(failed > 0 ? 1 : 0);
