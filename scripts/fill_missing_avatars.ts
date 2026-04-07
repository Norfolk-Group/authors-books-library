/**
 * fill_missing_avatars.ts
 * Runs the avatar waterfall for all authors missing avatars.
 * Usage: tsx scripts/fill_missing_avatars.ts
 */
import { getDb } from "../server/db";
import { authorProfiles } from "../drizzle/schema";
import { processAuthorAvatarWaterfall } from "../server/lib/authorAvatars/waterfall";
import { persistAvatarResult } from "../server/lib/authorAvatars/persistResult";
import { sql } from "drizzle-orm";
import fs from "fs";

const CONCURRENCY = 3;

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Get all authors missing avatars
  const missing = await db
    .select({ authorName: authorProfiles.authorName, id: authorProfiles.id })
    .from(authorProfiles)
    .where(sql`(${authorProfiles.avatarUrl} IS NULL OR ${authorProfiles.avatarUrl} = '') AND (${authorProfiles.s3AvatarUrl} IS NULL OR ${authorProfiles.s3AvatarUrl} = '')`);

  console.log(`Found ${missing.length} authors missing avatars`);
  missing.forEach(a => console.log(`  - ${a.authorName}`));

  const results: Array<{ name: string; success: boolean; source: string; url?: string | null; error?: string }> = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    console.log(`\nProcessing batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(missing.length / CONCURRENCY)}: ${batch.map(a => a.authorName).join(", ")}`);

    const batchResults = await Promise.allSettled(
      batch.map(async (author) => {
        try {
          console.log(`  → Starting waterfall for ${author.authorName}...`);
          const result = await processAuthorAvatarWaterfall(author.authorName, {
            maxTier: 5,
            avatarGenVendor: "google",
            avatarGenModel: "nano-banana",
            avatarResearchVendor: "google",
            avatarResearchModel: "gemini-2.5-flash",
          });
          
          await persistAvatarResult(db, author.authorName, result, {
            vendor: "google",
            model: "nano-banana",
            researchVendor: "google",
            researchModel: "gemini-2.5-flash",
          });

          const success = result.source !== "failed" && result.source !== "skipped";
          const url = result.s3AvatarUrl ?? result.avatarUrl;
          console.log(`  ✓ ${author.authorName}: ${result.source} → ${url ? url.slice(0, 60) + "..." : "no URL"}`);
          return { name: author.authorName, success, source: result.source, url };
        } catch (err: any) {
          console.error(`  ✗ ${author.authorName}: ${err.message}`);
          return { name: author.authorName, success: false, source: "error", error: err.message };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value);
      else results.push({ name: "unknown", success: false, source: "error", error: r.reason?.message });
    }

    // Small delay between batches
    if (i + CONCURRENCY < missing.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n=== AVATAR FILL RESULTS ===`);
  console.log(`Total: ${results.length} | Succeeded: ${succeeded} | Failed: ${failed}`);
  results.forEach(r => {
    const icon = r.success ? "✓" : "✗";
    console.log(`  ${icon} ${r.name}: ${r.source}${r.error ? " — " + r.error : ""}`);
  });

  fs.writeFileSync("/tmp/avatar_fill_results.json", JSON.stringify({ succeeded, failed, results }, null, 2));
  console.log("\nResults saved to /tmp/avatar_fill_results.json");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
