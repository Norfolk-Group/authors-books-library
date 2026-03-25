/**
 * Author Avatar Waterfall Orchestrator
 *
 * Priority order (Opus-designed):
 *   Tier 1: Wikipedia REST API (free, ~200ms)
 *   Tier 2: Tavily Image Search ($0.001/search, ~1-2s)
 *   Tier 3: Apify Cheerio Scraper ($0.001/run, ~30-60s) - uses existing server/apify.ts
 *   Tier 4: Gemini Vision validation gate (runs after each tier)
 *   Tier 5: Replicate AI Avatar Generation ($0.003/image, ~5-10s)
 *
 * Expected success rate: ~95%+ across all 109 authors
 * Estimated total cost: $1.50-$3.00
 */
import { fetchWikipediaPhoto } from "./wikipedia";
import { fetchTavilyAuthorPhoto } from "./tavily";
import { scrapeAuthorAvatar } from "../../apify";
import { validateHeadshotWithGemini } from "./geminiValidation";
import { generateAIAvatar } from "./replicateGeneration";
import { generateGoogleImagenPortrait, NANO_BANANA_MODELS, DEFAULT_NANO_BANANA_MODEL } from "./googleImagenGeneration";
import { storagePut } from "../../storage";
import { runMeticulousPipeline } from "./meticulousPipeline";
import { logger } from "../../lib/logger";

// -- Multi-author mapping ------------------------------------------------------
const MULTI_AUTHOR_MAP: Record<string, string> = {
  // Legacy combined entries — kept for backward compat with old DB rows
  "Aaron Ross and Jason Lemkin": "Aaron Ross",
  "Colin Bryar & Bill Carr": "Colin Bryar",
  "Frances Frei & Anne Morriss": "Frances Frei",
  "Ashvin Vaidyanathan & Ruben Rabago": "Ashvin Vaidyanathan",
  "Ashvin Vaidyanathan and Ruben Rabago": "Ashvin Vaidyanathan",
  "Ashwin Vaidyanathan and Ruben Rubago": "Ashvin Vaidyanathan",
  "Jack Stack and Bo Burlingham": "Jack Stack",
  "Kelly Leonard and Tom Yorton": "Kelly Leonard",
  "Kelly Leonard and Tom Yorton - Improv and business communication": "Kelly Leonard",
  "Kerry Leonard": "Kelly Leonard",
  // New individual entries from split (strip specialty suffix for avatar search)
  "Aaron Ross - B2B sales strategy, predictable revenue, and outbound growth": "Aaron Ross",
  "Jason Lemkin - SaaS growth, B2B sales strategy, and venture capital": "Jason Lemkin",
  "Ashvin Vaidyanathan - Customer success strategy and growth enablement": "Ashvin Vaidyanathan",
  "Ruben Rabago - Customer success operations and revenue growth": "Ruben Rabago",
  "Colin Bryar - Amazon leadership principles and operational excellence": "Colin Bryar",
  "Bill Carr - Amazon product development and innovation culture": "Bill Carr",
  "Frances Frei - Leadership transformation and organizational trust": "Frances Frei",
  "Anne Morriss - Leadership strategy and organizational change": "Anne Morriss",
  "Jack Stack - Open-book management and employee ownership": "Jack Stack",
  "Bo Burlingham - Entrepreneurship, small business excellence, and ownership culture": "Bo Burlingham",
  "Kelly Leonard - Improv-based leadership and business communication": "Kelly Leonard",
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
export interface AuthorAvatarWaterfallResult {
  originalName: string;
  primaryName: string;
  avatarUrl: string | null;
  s3AvatarUrl: string | null;
  source: "wikipedia" | "tavily" | "apify" | "ai-generated" | "skipped" | "failed";
  isAiGenerated: boolean;
  tier: number;
  processingTimeMs: number;
  error?: string;
  /** Pipeline metadata from meticulous Tier 5 — persisted to DB */
  __pipelineResult?: {
    authorDescription?: import('./types.js').AuthorDescription;
    imagePrompt?: string;
    driveFileId?: string;
    vendor?: string;
    model?: string;
  };
}

/** @deprecated Use AuthorAvatarWaterfallResult */
export type AuthorPhotoWaterfallResult = AuthorAvatarWaterfallResult;

export interface WaterfallOptions {
  /** Skip Gemini validation (faster, less accurate) */
  skipValidation?: boolean;
  /** Maximum tier to try (1-5). Default: 5 */
  maxTier?: number;
  /** Minimum tier to start from (1-5). Default: 1. Set to 5 to force AI generation, skipping Wikipedia/Tavily/Apify. */
  minTier?: number;
  /** Don't write to DB or S3 */
  dryRun?: boolean;
  /** If true and existingS3AvatarUrl is set, skip processing entirely */
  skipAlreadyEnriched?: boolean;
  /** Existing s3AvatarUrl from DB — used with skipAlreadyEnriched */
  existingS3AvatarUrl?: string | null;
  /** Per-tier timeout overrides in ms */
  tierTimeouts?: Partial<Record<1 | 2 | 3 | 5, number>>;
  /** Avatar generation — Graphics LLM vendor (e.g. 'google', 'replicate'). Default: 'google' */
  avatarGenVendor?: string;
  /** Avatar generation — Graphics LLM model ID (e.g. 'nano-banana'). Default: nano-banana */
  avatarGenModel?: string;
  /** Avatar generation — Research LLM vendor for meticulous pipeline. Default: 'google' */
  avatarResearchVendor?: string;
  /** Avatar generation — Research LLM model ID for meticulous pipeline. Default: 'gemini-2.5-flash' */
  avatarResearchModel?: string;
  /** Avatar background color hex or sentinel key (e.g. 'bokeh-gold') */
  avatarBgColor?: string;
  /** If true, force re-research even if a cached AuthorDescription exists in DB */
  forceRefresh?: boolean;
  // ── Resolution & Output Controls (passed through to MeticulousPipeline) ──
  /** Aspect ratio for the generated image */
  avatarAspectRatio?: string;
  /** Explicit width in pixels (Replicate only) */
  avatarWidth?: number;
  /** Explicit height in pixels (Replicate only) */
  avatarHeight?: number;
  /** Output image format */
  avatarOutputFormat?: string;
  /** Output quality 1-100 */
  avatarOutputQuality?: number;
  /** Guidance scale for generation */
  avatarGuidanceScale?: number;
  /** Number of inference steps */
  avatarInferenceSteps?: number;
}

/** Default per-tier timeouts (ms) */
const DEFAULT_TIER_TIMEOUTS: Record<1 | 2 | 3 | 5, number> = {
  1: 5_000,   // Wikipedia REST API
  2: 10_000,  // Tavily image search
  3: 90_000,  // Apify actor (slow)
  5: 240_000,  // Meticulous pipeline (research + Gemini Vision + image generation — allow up to 4 minutes)
};

// -- Upload helper -------------------------------------------------------------
async function uploadAvatarToS3(
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
    const key = `author-avatars/${prefix}${sanitized}-${Date.now()}.${ext}`;
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
export async function processAuthorAvatarWaterfall(
  originalAuthorName: string,
  options: WaterfallOptions = {}
): Promise<AuthorAvatarWaterfallResult> {
  const start = Date.now();
  const {
    skipValidation = false,
    maxTier = 5,
    minTier = 1,
    dryRun = false,
    skipAlreadyEnriched = false,
    existingS3AvatarUrl = null,
    tierTimeouts = {},
    avatarGenVendor = "google",
    avatarGenModel = "nano-banana",
    avatarResearchVendor = "google",
    avatarResearchModel = "gemini-2.5-flash",
    avatarBgColor,
    forceRefresh = false,
  } = options;

  const timeouts = { ...DEFAULT_TIER_TIMEOUTS, ...tierTimeouts };

  // Skip if already enriched
  if (skipAlreadyEnriched && existingS3AvatarUrl) {
    logger.debug(`[Avatar] Skipping ${originalAuthorName} — already enriched`);
    return {
      originalName: originalAuthorName,
      primaryName: originalAuthorName,
      avatarUrl: existingS3AvatarUrl,
      s3AvatarUrl: existingS3AvatarUrl,
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
      avatarUrl: null,
      s3AvatarUrl: null,
      source: "skipped",
      isAiGenerated: false,
      tier: 0,
      processingTimeMs: Date.now() - start,
    };
  }

  // Resolve primary name (multi-author -> first author, canonical dedup)
  let primaryName =
    MULTI_AUTHOR_MAP[originalAuthorName] ||
    CANONICAL_MAP[originalAuthorName] ||
    originalAuthorName;

  let avatarUrl: string | null = null;
  let source: AuthorAvatarWaterfallResult["source"] = "failed";
  let isAiGenerated = false;
  let tier = 0;
  let pipelineMetadata: AuthorAvatarWaterfallResult["__pipelineResult"] | undefined;

  // -- TIER 1: Wikipedia ------------------------------------------------------
  if (!avatarUrl && maxTier >= 1 && minTier <= 1) {
    tier = 1;
    const t1Start = Date.now();
    logger.debug(`[Avatar T1] Wikipedia -> ${primaryName}`);
    try {
      const url = await Promise.race([
        fetchWikipediaPhoto(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T1 timeout after ${timeouts[1]}ms`)), timeouts[1])
        ),
      ]);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.6))) {
        avatarUrl = url;
        source = "wikipedia";
        logger.debug(`[Avatar T1] Wikipedia found for ${primaryName} (${Date.now() - t1Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T1] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 2: Tavily ---------------------------------------------------------
  if (!avatarUrl && maxTier >= 2 && minTier <= 2) {
    tier = 2;
    const t2Start = Date.now();
    logger.debug(`[Avatar T2] Tavily -> ${primaryName}`);
    try {
      const url = await Promise.race([
        fetchTavilyAuthorPhoto(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T2 timeout after ${timeouts[2]}ms`)), timeouts[2])
        ),
      ]);
      if (url && (await tryValidate(url, primaryName, skipValidation, 0.5))) {
        avatarUrl = url;
        source = "tavily";
        logger.debug(`[Avatar T2] Tavily found for ${primaryName} (${Date.now() - t2Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T2] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 3: Apify ----------------------------------------------------------
  if (!avatarUrl && maxTier >= 3 && minTier <= 3) {
    tier = 3;
    const t3Start = Date.now();
    logger.debug(`[Avatar T3] Apify -> ${primaryName}`);
    try {
      const result = await Promise.race([
        scrapeAuthorAvatar(primaryName),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T3 timeout after ${timeouts[3]}ms`)), timeouts[3])
        ),
      ]);
      if (result?.avatarUrl && (await tryValidate(result.avatarUrl, primaryName, skipValidation, 0.4))) {
        avatarUrl = result.avatarUrl;
        source = "apify";
        logger.debug(`[Avatar T3] Apify found for ${primaryName} (${Date.now() - t3Start}ms)`);
      }
    } catch (e) {
      console.warn(`[Avatar T3] Error for ${primaryName}: ${e}`);
    }
  }

  // -- TIER 5: Meticulous AI Avatar Generation (research + prompt + vendor-switchable graphics LLM) ------
  if (!avatarUrl && maxTier >= 5 && minTier <= 5) {
    tier = 5;
    const t5Start = Date.now();
    logger.debug(`[Avatar T5] Meticulous Pipeline (${avatarGenVendor}/${avatarGenModel}) -> ${primaryName}`);
    try {
      const pipelineResult = await Promise.race([
        runMeticulousPipeline(primaryName, {
          bgColor: avatarBgColor,
          vendor: avatarGenVendor,
          model: avatarGenModel,
          researchVendor: avatarResearchVendor,
          researchModel: avatarResearchModel,
          useCache: !forceRefresh,
          forceRefresh,
          // Pass resolution params through to the pipeline
          aspectRatio: options.avatarAspectRatio,
          width: options.avatarWidth,
          height: options.avatarHeight,
          outputFormat: options.avatarOutputFormat as any,
          outputQuality: options.avatarOutputQuality,
          guidanceScale: options.avatarGuidanceScale,
          numInferenceSteps: options.avatarInferenceSteps,
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error(`T5 timeout after ${timeouts[5]}ms`)), timeouts[5])
        ),
      ]);
      if (pipelineResult && pipelineResult.success && pipelineResult.s3AvatarUrl) {
        avatarUrl = pipelineResult.s3AvatarUrl;
        source = "ai-generated";
        isAiGenerated = true;
        // Store pipeline metadata for DB persistence (accessed in router)
        pipelineMetadata = {
          authorDescription: pipelineResult.authorDescription,
          imagePrompt: pipelineResult.imagePrompt,
          driveFileId: pipelineResult.driveFileId,
          vendor: pipelineResult.vendor,
          model: pipelineResult.model,
        };
        logger.debug(`[Avatar T5] Meticulous pipeline complete for ${primaryName} in ${Date.now() - t5Start}ms`);
      } else {
        // Pipeline failed — fall back to legacy direct generation
        console.warn(`[Avatar T5] Meticulous pipeline failed for ${primaryName}, falling back to legacy generation`);
        const useGoogle = avatarGenVendor === "google" || avatarGenVendor === "gemini";
        if (useGoogle) {
          const resolvedModel = NANO_BANANA_MODELS[avatarGenModel] ?? avatarGenModel ?? DEFAULT_NANO_BANANA_MODEL;
          const generated = await generateGoogleImagenPortrait(primaryName, avatarBgColor, resolvedModel);
          if (generated && !dryRun) {
            const ext = generated.mimeType.includes("png") ? "png" : "jpg";
            const sanitized = primaryName.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const key = `author-avatars/ai-${sanitized}-${Date.now()}.${ext}`;
            const { url } = await storagePut(key, generated.buffer, generated.mimeType);
            avatarUrl = url;
            source = "ai-generated";
            isAiGenerated = true;
          }
        } else {
          const generated = await generateAIAvatar(primaryName);
          if (generated) {
            avatarUrl = generated.url;
            source = "ai-generated";
            isAiGenerated = true;
          }
        }
      }
    } catch (e) {
      console.warn(`[Avatar T5] Error for ${primaryName}: ${e}`);
    }
  }

  // -- Upload to S3 -----------------------------------------------------------
  let s3AvatarUrl: string | null = null;
  if (avatarUrl && !dryRun) {
    s3AvatarUrl = await uploadAvatarToS3(avatarUrl, primaryName, isAiGenerated);
  }

  return {
    originalName: originalAuthorName,
    primaryName,
    avatarUrl: s3AvatarUrl ?? avatarUrl,
    s3AvatarUrl,
    source,
    isAiGenerated,
    tier,
    processingTimeMs: Date.now() - start,
    ...(pipelineMetadata ? { __pipelineResult: pipelineMetadata } : {}),
  };
}
