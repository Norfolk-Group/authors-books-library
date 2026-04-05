/**
 * avatar-one.ts — generate avatar for a single author
 * Usage: npx tsx scripts/avatar-one.ts "Author Name"
 */
import * as dotenv from "dotenv";
dotenv.config();

const authorName = process.argv[2];
if (!authorName) { console.error("Usage: npx tsx scripts/avatar-one.ts \"Author Name\""); process.exit(1); }

import { getDb } from "../server/db";
import { processAuthorAvatarWaterfall } from "../server/lib/authorAvatars/waterfall";
import { persistAvatarResult } from "../server/lib/authorAvatars/persistResult";

async function main() {
  console.log(`[avatar-one] Starting: ${authorName}`);
  const start = Date.now();

  const result = await processAuthorAvatarWaterfall(authorName, {
    maxTier: 5, minTier: 1,
    skipValidation: false,
    avatarGenVendor: "google", avatarGenModel: "nano-banana",
    avatarResearchVendor: "google", avatarResearchModel: "gemini-2.5-flash",
    skipAlreadyEnriched: false, forceRefresh: false,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const finalUrl = result.s3AvatarUrl ?? result.avatarUrl ?? "";
  const success = !!finalUrl && result.source !== "failed";

  if (success) {
    const db = await getDb();
    if (db) {
      await persistAvatarResult(db, authorName, result, {
        vendor: "google", model: "nano-banana",
        researchVendor: "google", researchModel: "gemini-2.5-flash",
      });
    }
    console.log(`[avatar-one] SUCCESS ${authorName} | ${result.source} T${result.tier} | ${elapsed}s | ${finalUrl}`);
  } else {
    console.log(`[avatar-one] FAILED ${authorName} | ${result.source} | ${elapsed}s | ${result.error ?? "no url"}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => { console.error("[avatar-one] FATAL:", err); process.exit(1); });
