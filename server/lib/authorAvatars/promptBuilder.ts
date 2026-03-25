/**
 * Prompt Builder — Stage 3 of the Meticulous Avatar Pipeline
 *
 * Converts a structured AuthorDescription into a highly specific image generation
 * prompt optimized for the target graphics LLM vendor.
 *
 * DESIGN PHILOSOPHY (per Claude Opus analysis):
 *
 * 1. IDENTITY ANCHORING — Lead with WHO, not WHAT. The model has latent knowledge
 *    of public figures. "Portrait of Adam Grant" activates different weights than
 *    "portrait of a male in early 50s".
 *
 * 2. HIERARCHICAL SPECIFICITY — Move from macro (face shape) to micro (nostril shape).
 *    Each layer of detail constrains the generation space.
 *
 * 3. CINEMATOGRAPHIC PRECISION — Use industry-standard lighting terminology.
 *    "Rembrandt lighting with 2:1 ratio" is unambiguous; "professional lighting" is not.
 *
 * 4. SEPARATION OF CONCERNS — [SUBJECT] | [PHYSICAL STRUCTURE] | [FACIAL DETAILS]
 *    | [EXPRESSION] | [ATTIRE] | [LIGHTING] | [CAMERA] | [BACKGROUND] | [QUALITY]
 *    | [CONSTRAINTS]. Each section is independently tunable.
 *
 * 5. NEGATIVE SPACE DEFINITION — Explicitly state what NOT to generate.
 */

import { AuthorDescription, ImagePromptPackage } from "./types.js";

// ── Background descriptions ────────────────────────────────────────────────────

export const SPECIAL_BACKGROUNDS: Record<string, string> = {
  "bokeh-gold":
    "Warm golden bokeh with organic light distribution. " +
    "Primary tones: rich amber, warm cream, soft gold. " +
    "Bokeh characteristics: large soft-edged circular orbs of varying sizes naturally distributed " +
    "as if from string lights or candles 8-12 feet behind subject. " +
    "Gradient: slightly darker at edges, brighter warm center creating natural vignette. " +
    "Overall feel: elegant, inviting, bestselling author aesthetic. " +
    "Fully out of focus f/2.8 bokeh rendering. No harsh spots. No geometric patterns.",
  "bokeh-blue":
    "Cool blue bokeh with professional restraint. " +
    "Primary tones: soft gray, muted blue-gray, cream highlights. " +
    "Medium circular orbs, evenly distributed. Professional, corporate feel.",
  "office":
    "Blurred modern open-plan office background with soft bokeh, " +
    "natural window light, professional environment.",
  "library":
    "Blurred bookshelf background with warm amber tones, " +
    "intellectual atmosphere, shallow depth of field.",
  "gradient-dark":
    "Smooth gradient studio backdrop. Deep charcoal at edges transitioning to medium gray at center. " +
    "No texture. No bokeh. Clean, timeless executive portrait aesthetic.",
  "gradient-light":
    "Clean bright white to light gray gradient background, " +
    "airy professional studio photography.",
};

function describeColor(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 200) return "bright white";
  if (brightness > 150) return "light neutral grey";
  if (r > g && r > b) return brightness < 80 ? "deep burgundy" : "warm red";
  if (g > r && g > b) return brightness < 80 ? "deep forest green" : "sage green";
  if (b > r && b > g) return brightness < 80 ? "deep navy blue" : "cool blue";
  if (r > 100 && g > 80 && b < 80) return "warm amber";
  if (r < 60 && g < 60 && b < 60) return "near-black charcoal";
  return "neutral dark";
}

function getBackgroundDescription(bgColor?: string): string {
  if (!bgColor) return SPECIAL_BACKGROUNDS["bokeh-gold"];
  const key = bgColor.toLowerCase();
  if (SPECIAL_BACKGROUNDS[key]) return SPECIAL_BACKGROUNDS[key];
  if (key.startsWith("#") && key.length === 7) {
    return `Solid ${describeColor(bgColor)} background, professional studio lighting.`;
  }
  return "Neutral gray gradient background, professional studio lighting.";
}

// ── Negative prompts ───────────────────────────────────────────────────────────

const COMMON_NEGATIVE = [
  "cartoon", "anime", "illustration", "painting", "drawing", "sketch",
  "distorted", "deformed", "disfigured", "bad anatomy", "extra limbs",
  "blurry", "out of focus", "low resolution", "pixelated", "jpeg artifacts",
  "watermark", "signature", "text", "logo", "caption",
  "multiple people", "group shot", "crowd", "two faces",
  "full body", "hands visible", "fingers",
  "ugly", "scary", "creepy", "uncanny valley",
  "oversaturated", "overexposed", "underexposed",
  "plastic skin", "airbrushed", "excessive retouching",
  "harsh shadows", "raccoon eyes", "flat lighting",
];

const VENDOR_NEGATIVE_ADDITIONS: Record<string, string[]> = {
  stability: ["nsfw", "nude", "naked", "explicit"],
  replicate: ["bad lighting", "asymmetric lighting"],
  openai: [],
  google: [],
};

function buildNegativePrompt(vendor: string): string {
  const additions = VENDOR_NEGATIVE_ADDITIONS[vendor] ?? [];
  return [...COMMON_NEGATIVE, ...additions].join(", ");
}

// ── Section builders ───────────────────────────────────────────────────────────

function buildIdentitySection(desc: AuthorDescription): string {
  const parts: string[] = [];

  // Identity anchoring — critical for public figures with latent model knowledge
  parts.push(`Portrait of ${desc.authorName}`);

  if (desc.professionalContext?.primaryField) {
    parts.push(`renowned ${desc.professionalContext.primaryField}`);
  }

  if (desc.professionalContext?.notableWorks?.length) {
    const works = desc.professionalContext.notableWorks.slice(0, 2).join(" and ");
    parts.push(`author of ${works}`);
  }

  // Demographics with specificity
  const d = desc.demographics;
  parts.push(
    `${d.genderPresentation} presenting individual`,
    `approximately ${d.apparentAgeRange}`,
    d.ethnicAppearance ? `with ${d.ethnicAppearance} heritage` : ""
  );

  return parts.filter(Boolean).join(", ") + ".";
}

function buildPhysicalStructureSection(desc: AuthorDescription): string {
  const pf = desc.physicalFeatures;
  const parts: string[] = [];

  // Face shape with geometric specificity
  const faceDescriptors: Record<string, string> = {
    oval: "oval facial structure with balanced proportions, gentle tapering from cheekbones to chin",
    round: "round facial structure with soft angles, full cheeks, and curved jawline",
    square: "square facial structure with strong horizontal jawline and angular mandible",
    heart: "heart-shaped face with wider forehead tapering to a narrower chin",
    oblong: "elongated facial structure with vertical emphasis and balanced width",
    diamond: "diamond-shaped face with prominent cheekbones and narrow forehead and chin",
    rectangular: "rectangular facial structure with elongated proportions and angular jaw",
  };
  const faceKey = pf.faceShape.toLowerCase();
  parts.push(faceDescriptors[faceKey] ?? `${pf.faceShape} facial structure`);

  // Hair with color nuance, texture, and style
  const hairColorEnhancements: Record<string, string> = {
    black: "deep black hair with subtle blue-black highlights",
    "dark brown": "rich dark brown hair with warm undertones",
    brown: "medium brown hair with natural variation",
    "light brown": "light brown hair with honey highlights",
    blonde: "blonde hair with natural golden tones",
    red: "auburn hair with copper undertones",
    gray: "distinguished silver-gray hair",
    "silver-gray": "distinguished silver-gray hair with natural variation",
    white: "pure white hair with silver undertones",
    "salt-and-pepper": "salt-and-pepper hair with natural gray-black distribution",
    "salt and pepper": "salt-and-pepper hair with natural gray-black distribution",
    bald: "clean-shaven head",
    balding: "naturally thinning hair with visible scalp at crown",
  };
  const hairColorKey = pf.hair.color.toLowerCase();
  const hairColorDesc = hairColorEnhancements[hairColorKey] ?? `${pf.hair.color} hair`;

  const textureDesc: Record<string, string> = {
    straight: "with straight texture and natural fall",
    wavy: "with gentle waves and natural movement",
    curly: "with defined curls and volume",
    coily: "with tight coils and natural texture",
    fine: "with fine, smooth texture",
    thick: "with thick, full-bodied texture",
  };
  const textureKey = (pf.hair.texture ?? "").toLowerCase();
  const hairTexture = textureDesc[textureKey] ?? "";

  const hairlineDesc = pf.hair.hairline ? `, with ${pf.hair.hairline} hairline` : "";
  const hairStyleDesc = pf.hair.style ? `, styled ${pf.hair.style}` : "";
  const hairLengthDesc = pf.hair.length && pf.hair.length !== "bald" ? `, ${pf.hair.length} length` : "";

  parts.push(`${hairColorDesc}${hairTexture ? " " + hairTexture : ""}${hairStyleDesc}${hairLengthDesc}${hairlineDesc}`);

  // Build/body type
  const buildDescriptors: Record<string, string> = {
    slim: "lean build with narrow shoulders",
    average: "medium build with proportional shoulders",
    athletic: "athletic build with defined shoulder structure",
    stocky: "solid build with broad shoulders",
    heavy: "substantial build with wide frame",
  };
  const buildKey = pf.build.toLowerCase();
  parts.push(buildDescriptors[buildKey] ?? pf.build);

  return parts.join(". ") + ".";
}

function buildFacialDetailsSection(desc: AuthorDescription): string {
  const pf = desc.physicalFeatures;
  const micro = desc.microFeatures;
  const parts: string[] = [];

  // Eyes — most critical for likeness
  const eyeColorEnhancements: Record<string, string> = {
    brown: "warm brown eyes with amber flecks",
    "dark brown": "deep brown eyes, nearly black in low light",
    blue: "clear blue eyes with subtle gray undertones",
    green: "green eyes with golden-brown limbal rings",
    hazel: "hazel eyes shifting between green and brown",
    gray: "steel gray eyes with blue undertones",
  };
  const eyeColorKey = pf.eyes.color.toLowerCase();
  let eyeDesc = eyeColorEnhancements[eyeColorKey] ?? `${pf.eyes.color} eyes`;
  if (pf.eyes.shape) eyeDesc += `, ${pf.eyes.shape} shape`;
  if (pf.eyes.setting) eyeDesc += `, ${pf.eyes.setting}`;
  if (pf.eyes.browShape) eyeDesc += `, with ${pf.eyes.browShape} eyebrows`;
  if (pf.eyes.notable) eyeDesc += `, ${pf.eyes.notable}`;
  parts.push(eyeDesc);

  // Nose — second most critical
  if (micro?.noseShape) {
    const noseDescriptors: Record<string, string> = {
      straight: "straight nose with even bridge profile",
      roman: "Roman nose with prominent bridge and slight downward curve",
      aquiline: "aquiline nose with refined bridge and defined tip",
      button: "small rounded nose with upturned tip",
      wide: "broad nose with wide nostrils",
      narrow: "narrow nose with refined bridge",
      hooked: "nose with prominent bridge curve",
      snub: "short nose with slightly upturned tip",
    };
    const noseKey = micro.noseShape.toLowerCase();
    parts.push(noseDescriptors[noseKey] ?? `${micro.noseShape} nose`);
  }

  // Lips
  if (micro?.lipDescription) {
    parts.push(micro.lipDescription);
  } else if (micro?.lipFullness) {
    const lipDesc = `${micro.lipFullness} lips${micro.lipShape ? ` with ${micro.lipShape} shape` : ""}`;
    parts.push(lipDesc);
  }

  // Forehead
  if (micro?.foreheadHeight) {
    parts.push(`${micro.foreheadHeight} forehead${micro.foreheadWidth ? `, ${micro.foreheadWidth} width` : ""}`);
  }

  // Jaw and chin
  if (micro?.jawAngle) parts.push(`jaw with ${micro.jawAngle} angle`);
  if (micro?.chinShape) parts.push(`${micro.chinShape} chin`);

  // Cheekbones
  if (micro?.cheekboneProminence) parts.push(`${micro.cheekboneProminence} cheekbones`);

  // Skin tone and texture
  let skinDesc = `${pf.skinTone} skin tone`;
  if (micro?.skinTexture) skinDesc += ` with ${micro.skinTexture}`;
  parts.push(skinDesc);

  // Facial hair with precision
  if (pf.facialHair.type === "none") {
    parts.push("clean-shaven face");
  } else {
    const facialHairDescriptors: Record<string, string> = {
      stubble: "light stubble, approximately 2-3 days growth",
      "short beard": "neatly trimmed short beard following the jawline",
      "full beard": "full beard with natural growth pattern",
      goatee: "goatee with clean cheeks",
      mustache: "mustache with groomed edges",
      beard: "well-maintained beard",
    };
    const fhKey = pf.facialHair.type.toLowerCase();
    const fhColor = pf.facialHair.color ? `${pf.facialHair.color} ` : "";
    const fhStyle = pf.facialHair.style ? ` (${pf.facialHair.style})` : "";
    parts.push(`${fhColor}${facialHairDescriptors[fhKey] ?? pf.facialHair.type}${fhStyle}`);
  }

  // Distinctive features
  if (pf.distinctiveFeatures.length > 0) {
    parts.push(`distinctive features: ${pf.distinctiveFeatures.slice(0, 4).join(", ")}`);
  }

  // Distinctive marks
  if (micro?.distinctiveMarks?.length) {
    parts.push(micro.distinctiveMarks.join(", "));
  }

  // Glasses
  if (pf.glasses.wears) {
    parts.push(`wearing ${pf.glasses.style ?? "glasses"}`);
  }

  // Generation notes
  if (micro?.generationNotes) {
    parts.push(micro.generationNotes);
  }

  return parts.join(". ") + ".";
}

function buildExpressionSection(desc: AuthorDescription): string {
  const expr = desc.personalityExpression;
  const pose = desc.characteristicPose;
  const micro = desc.microFeatures;
  const parts: string[] = [];

  // Primary expression
  const dominantExpr = expr.dominantExpression ?? (expr.dominantTraits[0] ?? "warm");
  const expressionEnhancements: Record<string, string> = {
    warm: "warm, approachable expression with relaxed facial muscles",
    confident: "confident expression with steady, direct gaze",
    thoughtful: "thoughtful, contemplative expression with slight focus in the eyes",
    friendly: "friendly, open expression inviting engagement",
    serious: "composed, serious expression conveying gravitas",
    playful: "playful expression with hint of amusement in the eyes",
    intellectual: "intelligent, engaged expression suggesting deep thinking",
    approachable: "approachable, open expression with natural warmth",
  };
  const exprKey = dominantExpr.toLowerCase();
  parts.push(expressionEnhancements[exprKey] ?? dominantExpr);

  // Smile specifics
  const smileType = expr.smileType ?? pose?.smileType;
  if (smileType) {
    const smileDescriptors: Record<string, string> = {
      broad: "broad genuine Duchenne smile with visible teeth and engaged eye muscles creating crow's feet",
      subtle: "subtle closed-lip smile with gentle upward curve at mouth corners",
      asymmetric: "characteristic asymmetric smile with one side slightly higher",
      warm: "warm smile reaching the eyes, creating natural eye crinkle",
      professional: "professional, measured smile appropriate for executive portraiture",
      none: "neutral, composed mouth position",
    };
    const smileKey = smileType.toLowerCase();
    parts.push(smileDescriptors[smileKey] ?? `${smileType} smile`);
  } else {
    parts.push(expr.typicalExpression);
  }

  // Eye engagement
  const eyeEngagement = expr.eyeEngagement ?? pose?.eyeEngagement;
  if (eyeEngagement) {
    parts.push(`eyes ${eyeEngagement}`);
  }

  // Head position
  const headAngle = pose?.headAngle ?? micro?.characteristicHeadTilt;
  if (headAngle) {
    parts.push(`head ${headAngle}`);
  }

  // Shoulder position
  if (pose?.shoulderPosition) {
    parts.push(`shoulders ${pose.shoulderPosition}`);
  }

  // Gaze direction
  const gazeDir = pose?.gazeDirection;
  if (gazeDir) {
    parts.push(`gaze ${gazeDir}`);
  } else {
    parts.push("direct eye contact with camera");
  }

  return parts.join(", ") + ".";
}

function buildAttireSection(desc: AuthorDescription): string {
  const style = desc.stylePresentation;
  const parts: string[] = [];

  if (style.typicalAttire.description) {
    parts.push(style.typicalAttire.description);
  } else {
    // Default by formality
    const formalityDefaults: Record<string, string> = {
      "very formal": "tailored dark charcoal suit jacket over a crisp white dress shirt with tie",
      "business formal": "tailored dark charcoal suit jacket over a crisp white dress shirt, open collar without tie, creating approachable executive presence",
      "business casual": "smart blazer in navy or charcoal over a quality collared shirt, balancing professionalism with approachability",
      "smart casual": "smart casual blazer over a quality crew neck or open-collar shirt",
    };
    const formalityKey = style.typicalAttire.formality.toLowerCase();
    parts.push(formalityDefaults[formalityKey] ?? "tailored dark suit jacket over a collared shirt");
  }

  if (style.typicalAttire.colors.length > 0) {
    parts.push(`color palette: ${style.typicalAttire.colors.slice(0, 3).join(", ")}`);
  }

  if (style.visualSignatures?.length) {
    parts.push(`signature elements: ${style.visualSignatures.join(", ")}`);
  }

  return parts.join(". ") + ".";
}

function buildLightingSection(desc: AuthorDescription): string {
  // Determine formality from attire
  const formality = desc.stylePresentation.typicalAttire.formality.toLowerCase();
  const isCreative = desc.stylePresentation.aesthetic.some(
    (a) => a.toLowerCase().includes("creative") || a.toLowerCase().includes("artistic")
  );
  const isAcademic = desc.professionalContext.roleType.toLowerCase().includes("professor") ||
    desc.professionalContext.roleType.toLowerCase().includes("academic");

  if (isAcademic) {
    return (
      "Studio lighting setup: Classic butterfly/Paramount lighting variation. " +
      "Key light: Large softbox directly above camera, creating subtle butterfly shadow under nose. " +
      "Fill: Reflector below face level for gentle under-eye fill. " +
      "Background separation: Soft rim light from both sides for scholarly gravitas. " +
      "Catchlights: Centered catchlight suggesting intellectual clarity. " +
      "Light quality: Even, intelligent, dignified."
    );
  }

  if (isCreative) {
    return (
      "Studio lighting setup: Dramatic loop lighting with contemporary edge. " +
      "Key light: Medium softbox at 30 degrees camera-left, creating defined but soft-edged nose shadow. " +
      "Fill: Negative fill camera-right (black panel) for increased contrast ratio at 3:1. " +
      "Accent: Subtle edge light from behind-right adding dimensional separation. " +
      "Catchlights: Crisp catchlight at 10 o'clock position. " +
      "Light quality: Controlled contrast, emphasizing facial structure while remaining flattering."
    );
  }

  // Default: modified Rembrandt (corporate)
  return (
    "Studio lighting setup: Modified Rembrandt lighting with softened shadow edge. " +
    "Key light: Large octabox (60\") at 45 degrees camera-left, positioned slightly above eye level, " +
    "creating gentle shadow under nose falling toward camera-right cheek. " +
    "Fill light: Reflector panel camera-right at 2:1 ratio to key, maintaining shadow detail without eliminating dimensionality. " +
    "Hair light: Subtle rim light from behind at 45 degrees, adding separation from background. " +
    "Catchlights: Single natural-looking catchlight in each eye at 10-11 o'clock position. " +
    "Light quality: Soft, diffused, flattering for skin texture while maintaining facial dimension."
  );
}

const CAMERA_SECTION =
  "Camera: Professional portrait lens simulation. " +
  "Focal length: 85mm equivalent (classic portrait compression, natural facial proportions). " +
  "Aperture: f/2.8 (shallow depth of field, sharp focus on eyes, gentle ear-to-nose falloff). " +
  "Focus point: Near eye (camera-side eye if head is angled). " +
  "Depth of field: Eyes tack-sharp, ears and shoulder slightly soft, background fully diffused. " +
  "Perspective: Camera at eye level, approximately 4-5 feet from subject. " +
  "Framing: Head and shoulders, generous headroom, asymmetric composition following rule of thirds. " +
  "No lens distortion. No wide-angle effect. Natural facial proportions.";

const QUALITY_SECTION =
  "Technical quality: Photorealistic, indistinguishable from professional studio photography. " +
  "Resolution: High resolution, suitable for print reproduction. " +
  "Skin rendering: Natural skin texture with pores visible but not emphasized, " +
  "no plastic or airbrushed appearance, appropriate for age. " +
  "Color science: Natural, accurate skin tones, no color casts. " +
  "Dynamic range: Full tonal range from deep shadows to bright highlights. " +
  "Style reference: Annie Leibovitz corporate portraiture, Martin Schoeller precision.";

const CONSTRAINTS_SECTION =
  "MUST NOT include: text, watermarks, logos, signatures, dates, frames, borders. " +
  "MUST NOT include: hands, props, books, microphones, other objects. " +
  "MUST NOT include: other people, reflections of photographer, studio equipment. " +
  "MUST NOT include: excessive retouching, plastic skin, uncanny valley artifacts. " +
  "MUST NOT include: asymmetric lighting that creates harsh shadows, raccoon eyes. " +
  "SINGLE SUBJECT ONLY. HEAD AND SHOULDERS FRAMING ONLY. " +
  "This is a professional author headshot suitable for: book jacket, website about page, " +
  "speaking engagement promotional materials, Forbes-style executive profile.";

// ── Main prompt builder ────────────────────────────────────────────────────────

/**
 * Build a meticulous image generation prompt from a structured AuthorDescription.
 *
 * Uses Claude Opus's recommended sectioned structure:
 * [SUBJECT] | [PHYSICAL STRUCTURE] | [FACIAL DETAILS] | [EXPRESSION] | [ATTIRE]
 * | [LIGHTING] | [CAMERA] | [BACKGROUND] | [QUALITY] | [CONSTRAINTS]
 */
export function buildMeticulousPrompt(
  desc: AuthorDescription,
  options: {
    bgColor?: string;
    vendor?: string;
    model?: string;
    referenceImageBase64?: string;
    referenceImageMimeType?: string;
  } = {}
): ImagePromptPackage {
  const vendor = options.vendor ?? "google";
  const model = options.model ?? "gemini-2.5-flash-image";
  const bgDescription = getBackgroundDescription(options.bgColor);

  const sections = [
    `[SUBJECT] ${buildIdentitySection(desc)}`,
    `[PHYSICAL STRUCTURE] ${buildPhysicalStructureSection(desc)}`,
    `[FACIAL DETAILS] ${buildFacialDetailsSection(desc)}`,
    `[EXPRESSION] ${buildExpressionSection(desc)}`,
    `[ATTIRE] ${buildAttireSection(desc)}`,
    `[LIGHTING] ${buildLightingSection(desc)}`,
    `[CAMERA] ${CAMERA_SECTION}`,
    `[BACKGROUND] ${bgDescription}`,
    `[QUALITY] ${QUALITY_SECTION}`,
    `[CONSTRAINTS] ${CONSTRAINTS_SECTION}`,
  ];

  const prompt = sections.join("\n\n");

  // Use the best reference photo from the description if available,
  // or fall back to the one passed directly in options
  const referenceImageBase64 = options.referenceImageBase64 ?? undefined;
  const referenceImageMimeType = options.referenceImageMimeType ?? undefined;

  return {
    prompt,
    negativePrompt: buildNegativePrompt(vendor),
    backgroundDescription: bgDescription,
    targetVendor: vendor,
    targetModel: model,
    referenceImageBase64,
    referenceImageMimeType,
  };
}

/**
 * Fallback generic prompt when no AuthorDescription is available.
 */
export function buildGenericFallbackPrompt(
  authorName: string,
  bgColor?: string,
  vendor = "google"
): ImagePromptPackage {
  const bgDescription = getBackgroundDescription(bgColor);
  const firstName = authorName.split(" ")[0].toLowerCase();
  const FEMALE_NAMES = new Set([
    "frances", "anne", "emma", "rhea", "karen", "kim", "sue", "arianna",
    "esther", "annie", "april", "alison", "mel", "nixaly", "leil",
  ]);
  const gender = FEMALE_NAMES.has(firstName) ? "woman" : "person";

  const prompt = [
    `[SUBJECT] Portrait of ${authorName}, professional business author and thought leader.`,
    `${gender} presenting individual with warm, approachable expression.`,
    `[ATTIRE] Smart business attire suitable for a book author avatar. Tailored dark jacket over collared shirt.`,
    `[LIGHTING] Studio lighting setup: Modified Rembrandt lighting. Key light at 45 degrees camera-left, softbox. Fill light at 2:1 ratio. Soft, diffused, flattering.`,
    `[CAMERA] 85mm portrait lens equivalent, f/2.8, head and shoulders framing, eyes tack-sharp.`,
    `[BACKGROUND] ${bgDescription}`,
    `[QUALITY] Photorealistic, professional studio photography. Natural skin tones. High resolution.`,
    `[CONSTRAINTS] No text, watermarks, logos. Single subject only. Head and shoulders framing only.`,
  ].join("\n\n");

  return {
    prompt,
    negativePrompt: buildNegativePrompt(vendor),
    backgroundDescription: bgDescription,
    targetVendor: vendor,
    targetModel: vendor === "google" ? "gemini-2.5-flash-image" : "flux-schnell",
  };
}
