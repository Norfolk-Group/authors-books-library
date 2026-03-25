/**
 * Types for the Meticulous Author Avatar Pipeline.
 *
 * Pipeline stages:
 *   1. Research (Wikipedia bio + Tavily photo search + Apify Amazon scrape) → raw data
 *   2. Research LLM (Gemini Vision) → AuthorDescription JSON
 *   3. Prompt Builder → ImagePromptPackage
 *   4. Graphics LLM Router (vendor-switchable) → image bytes/URL
 *   5. Storage (S3 + Google Drive + DB)
 */

// ── Author Description ─────────────────────────────────────────────────────────

/**
 * Structured output from the Research LLM stage.
 * Optimized for image generation prompt construction.
 * Cached in DB as authorDescriptionJson to avoid re-research on regeneration.
 */
export interface AuthorDescription {
  /** Core identification */
  authorName: string;

  /** Demographics — critical for accurate likeness */
  demographics: {
    /** Estimated age range for image generation */
    apparentAgeRange: string; // e.g. "early 40s", "mid 50s", "late 60s"
    /** Gender presentation for image generation */
    genderPresentation: "male" | "female" | "non-binary";
    /** Ethnic appearance — be specific for accurate generation */
    ethnicAppearance: string; // e.g. "East Asian", "South Asian", "White European", "African American"
  };

  /** Physical Features — high impact on likeness */
  physicalFeatures: {
    /** Hair description — extremely important */
    hair: {
      color: string;   // "salt-and-pepper", "dark brown", "silver-gray", "bald"
      style: string;   // "swept back", "close-cropped", "curly and full", "receding"
      length: string;  // "short", "medium", "long", "bald", "balding"
      texture?: string; // "straight", "wavy", "curly", "coily", "fine", "thick"
      hairline?: string; // "receding", "high", "normal", "widow's peak"
    };
    /** Facial hair if any */
    facialHair: {
      type: "none" | "beard" | "goatee" | "stubble" | "mustache" | "full beard";
      color?: string;
      style?: string;  // "neatly trimmed", "full and natural"
    };
    /** Face shape affects overall likeness */
    faceShape: string; // "oval", "round", "square", "heart", "oblong"
    /** Distinctive facial features */
    distinctiveFeatures: string[]; // ["strong jawline", "prominent cheekbones", "dimples"]
    /** Eye description */
    eyes: {
      color: string;
      shape?: string;  // "deep-set", "almond-shaped", "hooded", "wide-set"
      notable?: string; // "crow's feet", "expressive", "warm"
      browShape?: string; // "thick and straight", "arched", "thin", "bushy"
      setting?: string; // "deep-set", "prominent", "average"
    };
    /** Skin tone for accurate rendering */
    skinTone: string;  // "fair", "medium", "olive", "tan", "dark brown"
    /** Build/body type visible in headshot */
    build: string;     // "slim", "average", "athletic", "stocky"
    /** Glasses — very distinctive */
    glasses: {
      wears: boolean;
      style?: string;  // "black rectangular frames", "round tortoiseshell", "rimless"
    };
  };

  /**
   * Micro-facial features for maximum specificity.
   * These are the details that distinguish one person from another.
   * All fields are optional — only populate from clear photo evidence.
   */
  microFeatures?: {
    /** Nose shape */
    noseShape?: string; // "straight", "roman", "aquiline", "button", "wide", "narrow", "hooked"
    /** Lip description */
    lipDescription?: string; // "full lips with defined cupid's bow", "thin lips, straight line"
    lipFullness?: string; // "thin", "medium", "full"
    lipShape?: string; // "defined cupid's bow", "straight upper lip", "rounded"
    /** Forehead characteristics */
    foreheadHeight?: string; // "high", "medium", "low"
    foreheadWidth?: string; // "wide", "narrow", "average"
    /** Jaw and chin */
    jawAngle?: string; // "sharp", "soft", "rounded", "square"
    chinShape?: string; // "pointed", "rounded", "square", "cleft"
    /** Cheekbones */
    cheekboneProminence?: string; // "high and prominent", "average", "soft"
    /** Ear shape (partially visible in headshots) */
    earShape?: string; // "small and close to head", "prominent", "average"
    /** Skin texture details */
    skinTexture?: string; // "smooth", "fine lines", "wrinkles around eyes", "pores visible"
    /** Characteristic head tilt */
    characteristicHeadTilt?: string; // "slight right", "slight left", "straight"
    /** Any distinctive marks */
    distinctiveMarks?: string[]; // ["mole above right lip", "small scar on chin"]
    /** Generation-specific notes for the image model */
    generationNotes?: string; // "emphasize the warm eyes and characteristic slight smile"
  };

  /**
   * Characteristic pose and expression patterns.
   * Extracted from analyzing multiple reference photos.
   */
  characteristicPose?: {
    /** Typical head angle in professional photos */
    headAngle?: string; // "slightly tilted right", "straight on", "three-quarter view"
    /** Shoulder position */
    shoulderPosition?: string; // "squared to camera", "angled left", "relaxed"
    /** Gaze direction */
    gazeDirection?: string; // "direct to camera", "slightly off-camera left", "thoughtful upward"
    /** Smile type */
    smileType?: string; // "broad open smile", "subtle closed smile", "asymmetric right side higher"
    /** Eye engagement */
    eyeEngagement?: string; // "direct and intense", "warm and inviting", "thoughtful"
  };

  /**
   * Best reference photo URL for use as generation reference.
   * Selected by the research LLM as the highest quality, most representative photo.
   */
  bestReferencePhotoUrl?: string;

  /** Style & Presentation */
  stylePresentation: {
    /** Typical attire in professional contexts */
    typicalAttire: {
      formality: string; // "very formal", "business formal", "business casual", "smart casual"
      description: string; // "Dark suits with no tie, open collar"
      colors: string[];    // ["navy", "charcoal", "light blue shirts"]
    };
    /** Overall aesthetic/vibe */
    aesthetic: string[]; // ["academic", "tech executive", "approachable", "authoritative"]
    /** Visual signatures — recurring style elements */
    visualSignatures?: string[]; // ["always open collar", "signature dark-rimmed glasses"]
  };

  /** Personality Expression — affects expression/pose */
  personalityExpression: {
    /** How they typically present in photos/videos */
    dominantTraits: string[]; // ["warm", "intellectual", "confident", "approachable"]
    /** Typical expression */
    typicalExpression: string; // "genuine smile with slight head tilt"
    /** Energy level */
    energy: string; // "calm", "moderate", "energetic", "intense"
    /** Dominant expression for generation */
    dominantExpression?: string; // "warm", "confident", "thoughtful", "friendly"
    /** Smile type */
    smileType?: string; // "broad", "subtle", "asymmetric", "warm", "professional", "none"
    /** Eye engagement quality */
    eyeEngagement?: string; // "direct and intense", "warm and inviting"
  };

  /** Professional Context */
  professionalContext: {
    /** Primary field — affects styling choices */
    primaryField: string;    // "organizational psychology", "tech entrepreneurship"
    /** Role/position type */
    roleType: string;        // "professor", "CEO", "consultant", "speaker"
    /** Institutions associated with (for styling hints) */
    institutions: string[];  // ["Wharton", "Google", "TED"]
    /** Notable works for identity anchoring */
    notableWorks?: string[]; // ["Think Again", "Give and Take"]
  };

  /** Source Confidence */
  sourceConfidence: {
    /** How many distinct photo sources found */
    photoSourceCount: number;
    /** How consistent were the photos */
    photoConsistency: "high" | "medium" | "low";
    /** Overall confidence in description accuracy */
    overallConfidence: "high" | "medium" | "low";
    /** Notes on any uncertainty */
    uncertainties: string[];
    /** Quality rating of the best reference photo */
    bestPhotoQuality?: "excellent" | "good" | "fair" | "poor";
  };

  /** Raw references for debugging/auditing */
  references: {
    photoUrls: string[];    // URLs of reference photos analyzed
    textSources: string[];  // Source names: "Wikipedia", "Amazon Author Page"
  };
}

// ── Image Prompt Package ───────────────────────────────────────────────────────

/**
 * The complete prompt package sent to the graphics LLM.
 */
export interface ImagePromptPackage {
  /** Main positive prompt */
  prompt: string;
  /** Negative prompt (things to avoid) — vendor-specific */
  negativePrompt: string;
  /** Background description derived from bgColor setting */
  backgroundDescription: string;
  /** Which vendor this prompt was optimized for */
  targetVendor: string;
  /** Which model this prompt was optimized for */
  targetModel: string;
  /**
   * Best reference photo base64 for reference-guided generation.
   * When present, the generator should pass this as a multimodal input
   * alongside the text prompt to improve facial likeness.
   */
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

// ── Image Generator Interfaces ─────────────────────────────────────────────────

export interface ImageGeneratorConfig {
  vendor: "google" | "replicate" | "openai" | "stability";
  model: string;
}

// ── Resolution & Output Types ─────────────────────────────────────────────────

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "2:3" | "3:2";
export type OutputFormat = "png" | "webp" | "jpeg";

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio | string;
  /** Explicit width in pixels (Replicate only, must be multiple of 64) */
  width?: number;
  /** Explicit height in pixels (Replicate only, must be multiple of 64) */
  height?: number;
  /** Output image format */
  outputFormat?: OutputFormat;
  /** Output quality 1-100 (Replicate only) */
  outputQuality?: number;
  guidanceScale?: number;
  /** Number of inference steps (Replicate only, 1-50) */
  numInferenceSteps?: number;
  /**
   * Optional reference image for guided generation.
   * When provided, the generator passes this as a multimodal input
   * alongside the text prompt to improve facial likeness.
   */
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

export interface ImageGenerationResult {
  /** URL to the generated image (for Replicate, OpenAI) */
  imageUrl?: string;
  /** Base64-encoded image bytes (for Google Imagen, Stability) */
  imageBase64?: string;
  mimeType: string;
  vendor: string;
  model: string;
  durationMs: number;
  error?: string;
}

export interface ImageGenerator {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  isAvailable(): boolean;
}

// ── Research Input/Output ──────────────────────────────────────────────────────

/**
 * Raw data aggregated from all research sources before LLM analysis.
 */
export interface AuthorResearchData {
  authorName: string;
  /** Bio text from Wikipedia */
  wikiBio?: string;
  /** Photo URLs from Tavily image search */
  tavilyPhotoUrls: string[];
  /** Photo URLs from Apify Amazon/Wikipedia scrape */
  apifyPhotoUrls: string[];
  /** All unique photo URLs (deduplicated, prioritized) */
  allPhotoUrls: string[];
  /** Source names that contributed data */
  sources: string[];
}

// ── Pipeline Options ───────────────────────────────────────────────────────────

export interface MeticulousPipelineOptions {
  /** Background color hex or sentinel key (e.g. "bokeh-gold") */
  bgColor?: string;
  /** Graphics LLM vendor */
  vendor?: string;
  /** Graphics LLM model */
  model?: string;
  /** Research LLM vendor (for description building, e.g. 'google', 'anthropic') */
  researchVendor?: string;
  /** Research LLM model (for description building) */
  researchModel?: string;
  /** If true, use cached AuthorDescription from DB instead of re-researching */
  useCache?: boolean;
  /** If true, skip research and use the cached lastAvatarPrompt directly */
  promptOnly?: boolean;
  /** Force regeneration even if cache is fresh */
  forceRefresh?: boolean;
  // ── Resolution & Output Controls ──────────────────────────────────────────
  /** Aspect ratio for the generated image */
  aspectRatio?: AspectRatio | string;
  /** Explicit width in pixels (Replicate only) */
  width?: number;
  /** Explicit height in pixels (Replicate only) */
  height?: number;
  /** Output image format */
  outputFormat?: OutputFormat;
  /** Output quality 1-100 */
  outputQuality?: number;
  /** Guidance scale for generation */
  guidanceScale?: number;
  /** Number of inference steps */
  numInferenceSteps?: number;
}

export interface MeticulousPipelineResult {
  success: boolean;
  s3AvatarUrl?: string;
  s3AvatarKey?: string;
  driveFileId?: string;
  avatarSource: "google-imagen" | "ai" | "drive";
  authorDescription?: AuthorDescription;
  imagePrompt?: string;
  vendor?: string;
  model?: string;
  durationMs: number;
  error?: string;
  /** Which stages were executed */
  stages: {
    research: "executed" | "cached" | "skipped" | "failed";
    promptBuild: "executed" | "cached" | "skipped" | "failed";
    imageGen: "executed" | "failed";
    s3Upload: "executed" | "failed" | "skipped";
    driveUpload: "executed" | "failed" | "skipped";
  };
}
