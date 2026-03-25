/**
 * Test the meticulous avatar pipeline on Aaron Ross.
 * Aaron Ross is a known case: no avatar, group shot was cleared.
 * This tests the full pipeline: research → description → prompt → image → S3.
 */
import { createRequire } from "module";
import { config } from "dotenv";
config({ path: ".env" });

// We need to use tsx to run TypeScript imports, so we'll call the pipeline via HTTP
// through the tRPC endpoint instead of importing directly.

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function testPipeline() {
  console.log("=== Testing Meticulous Pipeline on Aaron Ross ===\n");

  // Step 1: Check current profile status
  console.log("1. Checking current profile for Aaron Ross...");
  try {
    const profileRes = await fetch(`${BASE_URL}/api/trpc/authorProfiles.get?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { name: "Aaron Ross" } } }))}`, {
      headers: { "Content-Type": "application/json" },
    });
    const profileData = await profileRes.json();
    const profile = profileData?.[0]?.result?.data?.json;
    if (profile) {
      console.log(`   Bio: ${profile.bio ? profile.bio.substring(0, 80) + "..." : "(none)"}`);
      console.log(`   S3 Avatar: ${profile.s3AvatarUrl || "(none)"}`);
      console.log(`   Description cached: ${profile.authorDescriptionCachedAt ? "yes" : "no"}`);
      console.log(`   Avatar source: ${profile.avatarSource || "(none)"}`);
    } else {
      console.log("   No profile found — will be created during pipeline run.");
    }
  } catch (err) {
    console.log(`   Error checking profile: ${err.message}`);
  }

  // Step 2: Test the research stage only (via researchAuthor)
  console.log("\n2. Testing research stage (Wikipedia + Tavily + Apify)...");
  try {
    // Call the generate avatar endpoint which triggers the meticulous pipeline
    const genRes = await fetch(`${BASE_URL}/api/trpc/authorProfiles.generateAvatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          authorName: "Aaron Ross",
          vendor: "google",
          model: "gemini-2.5-flash-image",
          forceRefresh: true,
        },
      }),
    });
    
    if (genRes.ok) {
      const genData = await genRes.json();
      const result = genData?.result?.data?.json;
      if (result) {
        console.log(`   Success: ${result.success}`);
        console.log(`   Avatar source: ${result.avatarSource}`);
        console.log(`   S3 URL: ${result.s3AvatarUrl || "(none)"}`);
        console.log(`   Duration: ${result.durationMs}ms`);
        console.log(`   Stages: ${JSON.stringify(result.stages)}`);
        if (result.authorDescription) {
          const desc = result.authorDescription;
          console.log(`   Description: ${desc.demographics?.genderPresentation}, ${desc.demographics?.apparentAgeRange}`);
          console.log(`   Face shape: ${desc.physicalFeatures?.faceShape}`);
          console.log(`   Hair: ${desc.physicalFeatures?.hair?.color} ${desc.physicalFeatures?.hair?.style}`);
          console.log(`   Photos found: ${desc.references?.photoUrls?.length || 0}`);
          console.log(`   Best reference: ${desc.bestReferencePhotoUrl || "(none)"}`);
        }
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      } else {
        console.log(`   Response: ${JSON.stringify(genData).substring(0, 500)}`);
      }
    } else {
      const errText = await genRes.text();
      console.log(`   HTTP ${genRes.status}: ${errText.substring(0, 300)}`);
    }
  } catch (err) {
    console.log(`   Pipeline error: ${err.message}`);
  }

  console.log("\n=== Test Complete ===");
}

testPipeline().catch(console.error);
