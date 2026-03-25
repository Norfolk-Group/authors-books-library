/**
 * Direct test of the meticulous pipeline on Aaron Ross.
 * Runs: research → description → prompt build (no image gen to save API credits).
 */
import { researchAuthor, researchAndDescribeAuthor } from "../server/lib/authorAvatars/authorResearcher";

async function main() {
  console.log("=== Testing Meticulous Pipeline on Aaron Ross ===\n");

  // Stage 1: Research only
  console.log("Stage 1: Research (Wikipedia + Tavily + Apify)...");
  const research = await researchAuthor("Aaron Ross");
  console.log(`  Sources found: ${research.sources.join(", ") || "(none)"}`);
  console.log(`  Wiki bio: ${research.wikiBio ? research.wikiBio.substring(0, 120) + "..." : "(none)"}`);
  console.log(`  Photos found: ${research.allPhotoUrls.length}`);
  research.allPhotoUrls.forEach((url, i) => console.log(`    ${i + 1}. ${url}`));

  // Stage 2: Full research + Gemini Vision analysis
  console.log("\nStage 2: Gemini Vision Analysis → AuthorDescription...");
  const description = await researchAndDescribeAuthor("Aaron Ross", "gemini-2.5-flash", "google");

  if (description) {
    console.log(`  Demographics: ${description.demographics?.genderPresentation}, ${description.demographics?.apparentAgeRange}`);
    console.log(`  Ethnic appearance: ${description.demographics?.ethnicAppearance}`);
    console.log(`  Face shape: ${description.physicalFeatures?.faceShape}`);
    console.log(`  Hair: ${description.physicalFeatures?.hair?.color} ${description.physicalFeatures?.hair?.style}`);
    console.log(`  Eyes: ${description.physicalFeatures?.eyes?.color} ${description.physicalFeatures?.eyes?.shape}`);
    console.log(`  Glasses: ${description.physicalFeatures?.glasses?.wears ? description.physicalFeatures.glasses.style : "no"}`);
    console.log(`  Build: ${description.physicalFeatures?.build}`);
    console.log(`  Best reference photo: ${description.bestReferencePhotoUrl || "(none)"}`);
    console.log(`  Confidence: ${description.sourceConfidence?.overallConfidence}`);
    console.log(`  Photo consistency: ${description.sourceConfidence?.photoConsistency}`);
    console.log(`  Uncertainties: ${description.sourceConfidence?.uncertainties?.join(", ") || "(none)"}`);
    console.log(`  Professional: ${description.professionalContext?.primaryField} — ${description.professionalContext?.roleType}`);
    console.log(`  Notable works: ${description.professionalContext?.notableWorks?.join(", ") || "(none)"}`);
    console.log("\n  ✅ AuthorDescription JSON generated successfully");
  } else {
    console.log("  ❌ Failed to generate AuthorDescription");
  }

  console.log("\n=== Pipeline Test Complete ===");
}

main().catch(console.error);
