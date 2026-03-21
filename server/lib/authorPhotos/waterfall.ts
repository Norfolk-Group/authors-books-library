/**
 * Author Photo Waterfall Orchestrator
 *
 * Priority order (Opus-designed):
 *   Tier 1: Wikipedia REST API (free, ~200ms)
 *   Tier 2: Tavily Image Search ($0.001/search, ~1-2s)
 *   Tier 3: Apify Cheerio Scraper ($0.001/run, ~30-60s) - uses existing server/apify.ts
 *   Tier 4: Gemini Vision validation gate (runs after each tier)
 *   Tier 5: Replicate AI Portrait Generation ($0.003/image, ~5-10s)
 *
 * Expected success rate: ~95%+ across all 109 authors
 * Estimated total cost: $1.50-$3.00
 */
import { fetchWikipediaPhoto } from "./wikipedia";
import { fetchTavilyAuthorPhoto } from "./tavily";
import { scrapeAuthorPhoto } from "../../apify";
import { validateHeadshotWithGemini } from "./geminiValidation";
import { generateAIPortrait } from "./replicateGeneration";
import { storagePut } from "../../storage";

// -- Multi-author mapping ------------------------------------------------------
const MULTI_AUTHOR_MAP: Record<string, string> = {
  "Aaron Ross and Jason Lemkin": "Aaron Ross",
  "Colin Bryar & Bill Carr": "Colin Bryar",
  "Frances Frei & Anne Morriss": "Frances Frei",
  "Ashvin Vaidyanathan & Ruben Rabago": "Ashvin Vaidyanathan",
  "Ashvin Vaidyanathan and Ruben Rabago": "Ashvin Vaidyanathan",
  "Ashwin Vaidyanathan and Ruben Rubago": "Ashvin Vaidyanathan",
  "Jack Stack and Bo Burlingham": "Jack Stack",
  "Kelly Leonard and Tom Yorton": "Kelly Leonard",
  "Kerry Leonard": "Kelly Leonard",
};

// -- Skip list -----------------------------------------------------------------
const SKIP_LIST = new Set([
  "Founders Pocket Guide",
  "TEST Matthew Dixon",
  "Your Next Five Moves",
]);

// -- Deduplication map (canonical names) --------------------------------------
const CANONICAL_MAP: Record<string, string> = {
  "Steven Hawking": "Stephen Hawking",
  "Matt Dixon": "Matthew Dixon",
  "Geoffrey A. Moore": "Geoffrey Moore",
  "Robert B Cialdini": "Robert B. Cialdini",
  "Richard H Thaler": "Richard H. Thaler",
  "Peter Hans Beck": "Hans Peter Bech",
};

// -- Result type ---------------------------------------------------------------
export interface AuthorPhotoWaterfallResult {
  originalName: string;
  primaryName: string;
  photoUrl: string | null;
  s3PhotoUrl: string | null;
  source: "wikipedia" | "tavily" | "apify" | "ai-generated" | "skipped" | "failed";
  isAiGenerated: boolean;
  tier: number;
  processingTimeMs: number;
  error?: string;
}

export interface WaterfallOptions {
  /** Skip Gemini validation (faster, less accurate) */
  skipValidation?: boolean;
  /** Maximum tier to try (1-5). Default: 5 */
  maxTier?: number;
  /** Don't write to DB or S3 */
  dryRun?: boolean;
}

// -- Upload helper -------------------------------------------------------------
async function uploadPhotoToS3(
  imageUrl: string,
  authorName: string,
  isAiGenerated: boolean
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
    const sanitized = authorName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const prefix = isAiGenerated ? "ai-" : "";
    const key = `author-photos/${prefix}${sanitized}-${Date.now()}.${ext}`;
    const { url } = await storagePut(key, buffer, contentType);
    return url;
  } catch (err) {
    console.error(`[S3 upload] Failed for ${authorName}:`, err);
    return null;
  }
}

// -- Validate helper -----------------------------------------------------------
async function tryValidate(
  url: string,
  name: string,
  skipValidation: boolean,
  minConfidence: number
): Promise<boolean> {
  if (skipValidation) return true;
  try {
    const v = await validateHeadshotWithGemini(url, name);
    return v.isValidHeadshot && v.confidence >= minConfidence;
  } catch {
    return true; // On validation error, accept the image
  }
}

// -- Main waterfall ------------------------------------------------------------
export async function processAuthorPhotoWaterfall(
  originalAuthorName: string,
  options: WaterfallOptions = {}
): Promise<AuthorPhotoWaterfallResult> {
  const start = Date.now();
  const { skipValidation = false, maxTier = 5, dryRun = false } = options;

  // Skip list
  if (SKIP_LIST.has(originalAuthorName)) {
    return {
      originalName: originalAuthorName,
      primaryName: originalAuthorName,
      photoUrl: null,
      s3PhotoUrl: null,
      source: "skipped",
      isAiGenerated: false,
      tier: 0,
      processingTimeMs: Date.now() - start,
    };
  }

  // Resolve primary name (multi-author → first author, canonical dedup)
  let primaryName =
    MULTI_AUTHOR_MAP[originalAuthorName] ||
    CANONICAL_MAP[originalAuthorName] ||
    originalAuthorName;

  let photoUrl: string | null = null;
  let source: AuthorPhotoWaterfallResult["source"] = "failed";
  let isAiGenerated = false;
  let tier = 0;

  // -- TIER 1: Wikipedia ------------------------------------------------------
  if (!photoUrl && maxTier >= 1) {
    tier = 1;
    console.log(`[Avatar T1] Wikipedia → ${primaryName}`);
    try {
      const url = await fetchWikipediaPhoto(primaryName);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.6))) {
        photoUrl = url;
        source = "wikipedia";
        console.log(`[Avatar T1] ✓ Wikipedia found for ${primaryName}`);
      }
    } catch (e) {
      console.warn(`[Avatar T1] Error: ${e}`);
    }
  }

  // -- TIER 2: Tavily ---------------------------------------------------------
  if (!photoUrl && maxTier >= 2) {
    tier = 2;
    console.log(`[Avatar T2] Tavily → ${primaryName}`);
    try {
      const url = await fetchTavilyAuthorPhoto(primaryName);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.5))) {
        photoUrl = url;
        source = "tavily";
        console.log(`[Avatar T2] ✓ Tavily found for ${primaryName}`);
      }
    } catch (e) {
      console.warn(`[Avatar T2] Error: ${e}`);
    }
  }

  // -- TIER 3: Apify ----------------------------------------------------------
  if (!photoUrl && maxTier >= 3) {
    tier = 3;
    console.log(`[Avatar T3] Apify → ${primaryName}`);
    try {
      const result = await scrapeAuthorPhoto(primaryName);
      if (result?.photoUrl && (await tryValidate(result.photoUrl, primaryName, skipValidation, 0.4))) {
        photoUrl = result.photoUrl;
        source = "apify";
        console.log(`[Avatar T3] ✓ Apify found for ${primaryName}`);
      }
    } catch (e) {
      console.warn(`[Avatar T3] Error: ${e}`);
    }
  }

  // -- TIER 5: Replicate AI ---------------------------------------------------
  if (!photoUrl && maxTier >= 5) {
    tier = 5;
    console.log(`[Avatar T5] Replicate AI → ${primaryName}`);
    try {
      const generated = await generateAIPortrait(primaryName);
      if (generated) {
        photoUrl = generated.url;
        source = "ai-generated";
        isAiGenerated = true;
        console.log(`[Avatar T5] ✓ AI portrait generated for ${primaryName}`);
      }
    } catch (e) {
      console.warn(`[Avatar T5] Error: ${e}`);
    }
  }

  // -- Upload to S3 -----------------------------------------------------------
  let s3PhotoUrl: string | null = null;
  if (photoUrl && !dryRun) {
    s3PhotoUrl = await uploadPhotoToS3(photoUrl, primaryName, isAiGenerated);
  }

  return {
    originalName: originalAuthorName,
    primaryName,
    photoUrl: s3PhotoUrl ?? photoUrl,
    s3PhotoUrl,
    source,
    isAiGenerated,
    tier,
    processingTimeMs: Date.now() - start,
  };
}
