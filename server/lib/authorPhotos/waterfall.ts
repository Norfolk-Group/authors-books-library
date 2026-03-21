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
  /** If true and existingS3PhotoUrl is set, skip processing entirely */
  skipAlreadyEnriched?: boolean;
  /** Existing s3PhotoUrl from DB — used with skipAlreadyEnriched */
  existingS3PhotoUrl?: string | null;
  /** Per-tier timeout overrides in ms */
  tierTimeouts?: Partial<Record<1 | 2 | 3 | 5, number>>;
}

/** Default per-tier timeouts (ms) */
const DEFAULT_TIER_TIMEOUTS: Record<1 | 2 | 3 | 5, number> = {
  1: 5_000,   // Wikipedia REST API
  2: 10_000,  // Tavily image search
  3: 90_000,  // Apify actor (slow)
  5: 30_000,  // Replicate AI generation
};

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
  const {
    skipValidation = false,
    maxTier = 5,
    dryRun = false,
    skipAlreadyEnriched = false,
    existingS3PhotoUrl = null,
    tierTimeouts = {},
  } = options;

  const timeouts = { ...DEFAULT_TIER_TIMEOUTS, ...tierTimeouts };

  // Skip if already enriched
  if (skipAlreadyEnriched && existingS3PhotoUrl) {
    console.log(`[Avatar] Skipping ${originalAuthorName} — already enriched`);
    return {
      originalName: originalAuthorName,
      primaryName: originalAuthorName,
      photoUrl: existingS3PhotoUrl,
      s3PhotoUrl: existingS3PhotoUrl,
      source: "skipped",
      isAiGenerated: false,
      tier: 0,
      processingTimeMs: Date.now() - start,
    };
  }

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
    const t1Start = Date.now();
    console.log(`[Avatar T1] Wikipedia → ${primaryName}`);
    try {
      const url = await Promise.race([
        fetchWikipediaPhoto(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T1 timeout after ${timeouts[1]}ms`)), timeouts[1])
        ),
      ]);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.6))) {
        photoUrl = url;
        source = "wikipedia";
        console.log(`[Avatar T1] ✓ Wikipedia found for ${primaryName} (${Date.now() - t1Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T1] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 2: Tavily ---------------------------------------------------------
  if (!photoUrl && maxTier >= 2) {
    tier = 2;
    const t2Start = Date.now();
    console.log(`[Avatar T2] Tavily → ${primaryName}`);
    try {
      const url = await Promise.race([
        fetchTavilyAuthorPhoto(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T2 timeout after ${timeouts[2]}ms`)), timeouts[2])
        ),
      ]);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.5))) {
        photoUrl = url;
        source = "tavily";
        console.log(`[Avatar T2] ✓ Tavily found for ${primaryName} (${Date.now() - t2Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T2] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 3: Apify ----------------------------------------------------------
  if (!photoUrl && maxTier >= 3) {
    tier = 3;
    const t3Start = Date.now();
    console.log(`[Avatar T3] Apify → ${primaryName}`);
    try {
      const result = await Promise.race([
        scrapeAuthorPhoto(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T3 timeout after ${timeouts[3]}ms`)), timeouts[3])
        ),
      ]);
      if (result?.photoUrl && (await tryValidate(result.photoUrl, primaryName, skipValidation, 0.4))) {
        photoUrl = result.photoUrl;
        source = "apify";
        console.log(`[Avatar T3] ✓ Apify found for ${primaryName} (${Date.now() - t3Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T3] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 5: Replicate AI ---------------------------------------------------
  if (!photoUrl && maxTier >= 5) {
    tier = 5;
    const t5Start = Date.now();
    console.log(`[Avatar T5] Replicate AI → ${primaryName}`);
    try {
      const generated = await Promise.race([
        generateAIPortrait(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T5 timeout after ${timeouts[5]}ms`)), timeouts[5])
        ),
      ]);
      if (generated) {
        photoUrl = generated.url;
        source = "ai-generated";
        isAiGenerated = true;
        console.log(`[Avatar T5] ✓ AI portrait generated for ${primaryName} (${Date.now() - t5Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T5] Error for ${primaryName}: ${e}`);
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
