/**
 * run-enrichment-pipeline.mjs
 *
 * Standalone CLI script that runs the full enrichment pipeline for all authors:
 *   Phase 1 — Discover platform presence (Perplexity)
 *   Phase 2 — Enrich social stats (GitHub, Wikipedia, Substack, YC, CNN, YouTube, ...)
 *
 * Usage:
 *   node scripts/run-enrichment-pipeline.mjs [--phase=1|2|all] [--limit=N] [--force]
 *
 * Runs in batches to avoid rate limits. Progress is logged to stdout.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { isNull, sql } from "drizzle-orm";

// Parse CLI args
const args = process.argv.slice(2);
const phaseArg = args.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "all";
const limitArg = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "200");
const force = args.includes("--force");

const runPhase1 = phaseArg === "1" || phaseArg === "all";
const runPhase2 = phaseArg === "2" || phaseArg === "all";

const BATCH_SIZE_PLATFORMS = 20;
const BATCH_SIZE_STATS = 30;
const THROTTLE_MS = 1200;

// ── DB setup ──────────────────────────────────────────────────────────────────

async function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const connection = await mysql.createConnection(url);
  return drizzle(connection);
}

// ── Phase 1: Discover Platforms ───────────────────────────────────────────────

async function runDiscoverPlatforms(db, schema) {
  const { discoverAuthorPlatforms } = await import("../server/enrichment/platforms.js");
  const { authorProfiles } = schema;
  const { eq } = await import("drizzle-orm");

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    console.error("❌ PERPLEXITY_API_KEY not set — skipping Phase 1");
    return;
  }

  const allAuthors = await db
    .select({
      authorName: authorProfiles.authorName,
      platformEnrichmentStatus: authorProfiles.platformEnrichmentStatus,
    })
    .from(authorProfiles)
    .limit(500);

  const toProcess = allAuthors
    .filter((a) => {
      if (force) return true;
      if (!a.platformEnrichmentStatus) return true;
      try {
        const status = JSON.parse(a.platformEnrichmentStatus);
        if (!status.enrichedAt) return true;
        const age = Date.now() - new Date(status.enrichedAt).getTime();
        return age > 7 * 24 * 60 * 60 * 1000; // older than 7 days
      } catch {
        return true;
      }
    })
    .slice(0, limitArg);

  console.log(`\n📡 Phase 1: Discover Platforms — ${toProcess.length} authors to process`);
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const author = toProcess[i];
    try {
      process.stdout.write(`  [${i + 1}/${toProcess.length}] ${author.authorName} ... `);
      const result = await discoverAuthorPlatforms(author.authorName, perplexityKey);
      const { links } = result;

      const updatePayload = {};
      const linkFields = [
        "websiteUrl", "twitterUrl", "linkedinUrl", "substackUrl", "youtubeUrl",
        "facebookUrl", "instagramUrl", "tiktokUrl", "githubUrl", "businessWebsiteUrl",
        "newsletterUrl", "speakingUrl", "podcastUrl", "blogUrl",
      ];
      for (const field of linkFields) {
        if (links[field]) updatePayload[field] = links[field];
      }

      updatePayload.platformEnrichmentStatus = JSON.stringify({
        enrichedAt: result.enrichedAt,
        source: result.source,
        platformCount: Object.keys(links).length,
        platforms: Object.keys(links),
      });

      if (Object.keys(updatePayload).length > 0) {
        await db.update(authorProfiles).set(updatePayload).where(eq(authorProfiles.authorName, author.authorName));
      }

      const count = Object.keys(links).length;
      console.log(`✓ ${count} platforms`);
      succeeded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
    }

    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  console.log(`\n  Phase 1 complete: ${succeeded} succeeded, ${failed} failed\n`);
}

// ── Phase 2: Enrich Social Stats ──────────────────────────────────────────────

async function runEnrichSocialStats(db, schema) {
  const { enrichAuthorSocialStats } = await import("../server/enrichment/socialStats.js");
  const { authorProfiles } = schema;
  const { eq, isNull } = await import("drizzle-orm");

  const rows = await db
    .select({
      authorName: authorProfiles.authorName,
      githubUrl: authorProfiles.githubUrl,
      substackUrl: authorProfiles.substackUrl,
      linkedinUrl: authorProfiles.linkedinUrl,
      wikipediaUrl: authorProfiles.wikipediaUrl,
      stockTicker: authorProfiles.stockTicker,
      socialStatsEnrichedAt: authorProfiles.socialStatsEnrichedAt,
    })
    .from(authorProfiles)
    .where(force ? sql`1=1` : isNull(authorProfiles.socialStatsEnrichedAt))
    .limit(limitArg);

  console.log(`\n📊 Phase 2: Enrich Social Stats — ${rows.length} authors to process`);
  let succeeded = 0;
  let failed = 0;

  const config = {
    youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
    apifyApiToken: process.env.APIFY_API_TOKEN ?? "",
    rapidApiKey: process.env.RAPIDAPI_KEY ?? "",
    phases: ["A", "B"],
  };

  for (let i = 0; i < rows.length; i++) {
    const author = rows[i];
    try {
      process.stdout.write(`  [${i + 1}/${rows.length}] ${author.authorName} ... `);
      const stats = await enrichAuthorSocialStats(
        {
          authorName: author.authorName,
          githubUrl: author.githubUrl,
          substackUrl: author.substackUrl,
          linkedinUrl: author.linkedinUrl,
          wikipediaUrl: author.wikipediaUrl,
          stockTicker: author.stockTicker,
        },
        config
      );

      await db
        .update(authorProfiles)
        .set({
          socialStatsJson: JSON.stringify(stats),
          socialStatsEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, author.authorName));

      const platforms = stats.platformsSucceeded.join(", ") || "none";
      console.log(`✓ [${platforms}]`);
      succeeded++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
    }

    if (i < rows.length - 1) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  console.log(`\n  Phase 2 complete: ${succeeded} succeeded, ${failed} failed\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 NCG Library — Enrichment Pipeline");
  console.log(`   Phase: ${phaseArg} | Limit: ${limitArg} | Force: ${force}`);
  console.log("─".repeat(60));

  const db = await getDb();

  // Dynamically import schema (ESM)
  const schema = await import("../drizzle/schema.js");

  if (runPhase1) {
    await runDiscoverPlatforms(db, schema);
  }

  if (runPhase2) {
    await runEnrichSocialStats(db, schema);
  }

  console.log("✅ Pipeline complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
