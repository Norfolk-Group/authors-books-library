/**
 * fill-missing-avatars.ts
 * 
 * Runs the N+1 avatar waterfall pipeline directly (no HTTP) for all authors
 * missing avatarUrl AND s3AvatarUrl. Processes one author at a time.
 * 
 * Usage: npx tsx scripts/fill-missing-avatars.ts
 * 
 * Progress is saved to /tmp/fill-missing-avatars-progress.json for resumability.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import * as dotenv from "dotenv";
dotenv.config();

import { getDb } from "../server/db";
import { processAuthorAvatarWaterfall } from "../server/lib/authorAvatars/waterfall";
import { persistAvatarResult } from "../server/lib/authorAvatars/persistResult";

const PROGRESS_FILE = "/tmp/fill-missing-avatars-progress.json";
const DELAY_MS = 3000; // 3s cooldown between authors

interface ProgressEntry {
  name: string;
  success: boolean;
  source: string;
  url: string;
  tier: number;
  error?: string;
  processedAt: string;
}

interface Progress {
  completed: string[];
  results: ProgressEntry[];
  startedAt: string;
}

// Load previous progress
let progress: Progress = {
  completed: [],
  results: [],
  startedAt: new Date().toISOString(),
};

if (existsSync(PROGRESS_FILE)) {
  try {
    progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    console.log(`Resuming: ${progress.completed.length} already done`);
  } catch {
    console.log("Starting fresh");
  }
}

const completedSet = new Set(progress.completed);

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMissingAuthors(): Promise<Array<{ id: number; authorName: string }>> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [rows] = await db.execute(
    `SELECT id, authorName FROM author_profiles 
     WHERE (avatarUrl IS NULL OR avatarUrl = '') 
       AND (s3AvatarUrl IS NULL OR s3AvatarUrl = '')
     ORDER BY authorName`
  ) as [Array<{ id: number; authorName: string }>, unknown];
  return rows;
}

async function main() {
  const authors = await getMissingAuthors();
  const toProcess = authors.filter(a => !completedSet.has(a.authorName));

  console.log(`\n=== Fill Missing Avatars ===`);
  console.log(`Total missing: ${authors.length}`);
  console.log(`Already done: ${progress.completed.length}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`\nPipeline: Wikipedia → Tavily → Apify → Google Imagen (N+1)\n`);

  for (let i = 0; i < toProcess.length; i++) {
    const { authorName } = toProcess[i];
    const idx = i + 1;
    console.log(`\n[${idx}/${toProcess.length}] Processing: ${authorName}`);
    const start = Date.now();

    try {
      const result = await processAuthorAvatarWaterfall(authorName, {
        maxTier: 5,
        minTier: 1,
        skipValidation: false,
        avatarGenVendor: "google",
        avatarGenModel: "nano-banana",
        avatarResearchVendor: "google",
        avatarResearchModel: "gemini-2.5-flash",
        skipAlreadyEnriched: false,
        forceRefresh: false,
      });

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const finalUrl = result.s3AvatarUrl ?? result.avatarUrl ?? "";
      const success = !!finalUrl && result.source !== "failed";

      if (success) {
        // Persist to DB
        const db = await getDb();
        if (db) {
          await persistAvatarResult(db, authorName, result, {
            vendor: "google",
            model: "nano-banana",
            researchVendor: "google",
            researchModel: "gemini-2.5-flash",
          });
        }
        console.log(`  ✓ ${result.source} (Tier ${result.tier}) → ${finalUrl.substring(0, 80)} [${elapsed}s]`);
      } else {
        console.log(`  ✗ Failed: ${result.error ?? "no image returned"} [${elapsed}s]`);
      }

      const entry: ProgressEntry = {
        name: authorName,
        success,
        source: result.source,
        url: finalUrl,
        tier: result.tier,
        error: result.error,
        processedAt: new Date().toISOString(),
      };

      progress.completed.push(authorName);
      progress.results.push(entry);
      saveProgress();

    } catch (err: unknown) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Error: ${errMsg.substring(0, 120)} [${elapsed}s]`);

      progress.completed.push(authorName);
      progress.results.push({
        name: authorName,
        success: false,
        source: "failed",
        url: "",
        tier: 0,
        error: errMsg,
        processedAt: new Date().toISOString(),
      });
      saveProgress();
    }

    if (i < toProcess.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Final summary
  const succeeded = progress.results.filter(r => r.success);
  const failed = progress.results.filter(r => !r.success);

  console.log(`\n=== DONE ===`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed: ${failed.length}`);

  if (succeeded.length > 0) {
    console.log(`\nSuccessful:`);
    succeeded.forEach(r => console.log(`  ✓ ${r.name} [${r.source} T${r.tier}]`));
  }
  if (failed.length > 0) {
    console.log(`\nFailed:`);
    failed.forEach(r => console.log(`  ✗ ${r.name}: ${r.error?.substring(0, 80)}`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
