/**
 * Tests for the refined promptBuilder.ts
 *
 * Verifies:
 *   - Sectioned prompt structure ([SUBJECT], [PHYSICAL STRUCTURE], etc.)
 *   - Identity anchoring (author name + notable works)
 *   - Micro-feature specificity in [FACIAL DETAILS] section
 *   - Reference image threading
 *   - Background descriptions
 *   - Fallback generic prompt
 */

import { describe, it, expect } from "vitest";
import { buildMeticulousPrompt, buildGenericFallbackPrompt } from "./promptBuilder.js";
import { AuthorDescription } from "./types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADAM_GRANT: AuthorDescription = {
  authorName: "Adam Grant",
  demographics: {
    apparentAgeRange: "early 40s",
    genderPresentation: "male",
    ethnicAppearance: "White European",
  },
  physicalFeatures: {
    hair: {
      color: "dark brown",
      style: "swept back",
      length: "short",
      texture: "straight",
      hairline: "normal",
    },
    facialHair: { type: "none" },
    faceShape: "oval",
    distinctiveFeatures: ["strong jawline", "warm expressive eyes"],
    eyes: {
      color: "brown",
      shape: "almond-shaped",
      notable: "warm and engaging",
      browShape: "medium arched",
      setting: "average",
    },
    skinTone: "fair",
    build: "average",
    glasses: { wears: false },
  },
  microFeatures: {
    noseShape: "straight",
    lipFullness: "medium",
    lipShape: "defined cupid's bow",
    foreheadHeight: "medium",
    jawAngle: "soft",
    chinShape: "rounded",
    cheekboneProminence: "average",
    skinTexture: "smooth with fine lines around eyes",
    characteristicHeadTilt: "slight right",
    generationNotes: "emphasize warm, intelligent eyes and characteristic slight smile",
  },
  characteristicPose: {
    headAngle: "slightly tilted right",
    shoulderPosition: "squared to camera",
    gazeDirection: "direct to camera",
    smileType: "warm subtle",
    eyeEngagement: "warm and inviting",
  },
  bestReferencePhotoUrl: "https://example.com/adam-grant-headshot.jpg",
  stylePresentation: {
    typicalAttire: {
      formality: "business casual",
      description: "Smart blazer over open-collar shirt",
      colors: ["navy", "charcoal", "light blue"],
    },
    aesthetic: ["academic", "approachable", "intellectual"],
    visualSignatures: ["open collar without tie"],
  },
  personalityExpression: {
    dominantTraits: ["warm", "intellectual", "confident"],
    typicalExpression: "genuine warm smile with engaged eyes",
    energy: "moderate",
    dominantExpression: "warm",
    smileType: "subtle",
    eyeEngagement: "warm and inviting",
  },
  professionalContext: {
    primaryField: "organizational psychology",
    roleType: "professor",
    institutions: ["Wharton", "TED"],
    notableWorks: ["Think Again", "Give and Take"],
  },
  sourceConfidence: {
    photoSourceCount: 4,
    photoConsistency: "high",
    overallConfidence: "high",
    uncertainties: [],
    bestPhotoQuality: "excellent",
  },
  references: {
    photoUrls: ["https://example.com/adam-grant-headshot.jpg"],
    textSources: ["Wikipedia", "Tavily"],
  },
};

const MINIMAL_AUTHOR: AuthorDescription = {
  authorName: "Jane Smith",
  demographics: {
    apparentAgeRange: "mid 50s",
    genderPresentation: "female",
    ethnicAppearance: "African American",
  },
  physicalFeatures: {
    hair: { color: "black", style: "natural", length: "medium" },
    facialHair: { type: "none" },
    faceShape: "round",
    distinctiveFeatures: [],
    eyes: { color: "dark brown" },
    skinTone: "dark brown",
    build: "average",
    glasses: { wears: true, style: "round gold frames" },
  },
  stylePresentation: {
    typicalAttire: {
      formality: "business formal",
      description: "Tailored dark suit jacket",
      colors: ["black", "navy"],
    },
    aesthetic: ["authoritative", "professional"],
  },
  personalityExpression: {
    dominantTraits: ["confident", "authoritative"],
    typicalExpression: "composed, professional smile",
    energy: "calm",
  },
  professionalContext: {
    primaryField: "leadership",
    roleType: "consultant",
    institutions: [],
  },
  sourceConfidence: {
    photoSourceCount: 2,
    photoConsistency: "medium",
    overallConfidence: "medium",
    uncertainties: ["hair texture uncertain"],
  },
  references: {
    photoUrls: [],
    textSources: ["Wikipedia"],
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("buildMeticulousPrompt", () => {
  it("produces all 10 required sections", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const requiredSections = [
      "[SUBJECT]",
      "[PHYSICAL STRUCTURE]",
      "[FACIAL DETAILS]",
      "[EXPRESSION]",
      "[ATTIRE]",
      "[LIGHTING]",
      "[CAMERA]",
      "[BACKGROUND]",
      "[QUALITY]",
      "[CONSTRAINTS]",
    ];
    for (const section of requiredSections) {
      expect(pkg.prompt).toContain(section);
    }
  });

  it("anchors identity with author name in [SUBJECT]", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const subjectSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[SUBJECT]"))!;
    expect(subjectSection).toContain("Adam Grant");
    expect(subjectSection).toContain("organizational psychology");
  });

  it("includes notable works in identity anchoring", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    expect(pkg.prompt).toContain("Think Again");
    expect(pkg.prompt).toContain("Give and Take");
  });

  it("includes micro-features in [FACIAL DETAILS]", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const facialSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[FACIAL DETAILS]"))!;
    expect(facialSection).toContain("straight"); // noseShape
    expect(facialSection).toContain("cupid's bow"); // lipShape
    expect(facialSection).toContain("smooth with fine lines"); // skinTexture
    expect(facialSection).toContain("emphasize warm, intelligent eyes"); // generationNotes
  });

  it("includes characteristic pose in [EXPRESSION]", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const exprSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[EXPRESSION]"))!;
    expect(exprSection).toContain("direct to camera"); // gazeDirection
    expect(exprSection).toContain("slightly tilted right"); // headAngle
  });

  it("includes visual signatures in [ATTIRE]", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const attireSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[ATTIRE]"))!;
    expect(attireSection).toContain("open collar without tie");
  });

  it("uses academic lighting for professor roleType", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    const lightingSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[LIGHTING]"))!;
    expect(lightingSection).toContain("butterfly");
  });

  it("uses default bokeh-gold background when no bgColor specified", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    expect(pkg.backgroundDescription).toContain("golden bokeh");
  });

  it("uses library background when bgColor is 'library'", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT, { bgColor: "library" });
    expect(pkg.backgroundDescription).toContain("bookshelf");
  });

  it("threads reference image base64 through to the package", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT, {
      referenceImageBase64: "abc123base64",
      referenceImageMimeType: "image/jpeg",
    });
    expect(pkg.referenceImageBase64).toBe("abc123base64");
    expect(pkg.referenceImageMimeType).toBe("image/jpeg");
  });

  it("returns undefined referenceImageBase64 when not provided", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    expect(pkg.referenceImageBase64).toBeUndefined();
  });

  it("handles minimal author without microFeatures gracefully", () => {
    const pkg = buildMeticulousPrompt(MINIMAL_AUTHOR);
    expect(pkg.prompt).toContain("[SUBJECT]");
    expect(pkg.prompt).toContain("Jane Smith");
    expect(pkg.prompt).toContain("[FACIAL DETAILS]");
    // Should still include glasses
    expect(pkg.prompt).toContain("round gold frames");
  });

  it("includes glasses in [FACIAL DETAILS] when wears is true", () => {
    const pkg = buildMeticulousPrompt(MINIMAL_AUTHOR);
    const facialSection = pkg.prompt.split("\n\n").find((s) => s.startsWith("[FACIAL DETAILS]"))!;
    expect(facialSection).toContain("round gold frames");
  });

  it("produces a negative prompt", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    expect(pkg.negativePrompt.length).toBeGreaterThan(50);
    expect(pkg.negativePrompt).toContain("cartoon");
    expect(pkg.negativePrompt).toContain("watermark");
  });

  it("prompt is substantially longer than the old format (>1500 chars)", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT);
    // Old prompt was ~400 chars; new sectioned prompt should be much longer
    expect(pkg.prompt.length).toBeGreaterThan(1500);
  });

  it("sets correct targetVendor and targetModel", () => {
    const pkg = buildMeticulousPrompt(ADAM_GRANT, { vendor: "google", model: "gemini-2.5-flash-image" });
    expect(pkg.targetVendor).toBe("google");
    expect(pkg.targetModel).toBe("gemini-2.5-flash-image");
  });
});

describe("buildGenericFallbackPrompt", () => {
  it("includes the author name", () => {
    const pkg = buildGenericFallbackPrompt("Michael Porter");
    expect(pkg.prompt).toContain("Michael Porter");
  });

  it("includes required sections", () => {
    const pkg = buildGenericFallbackPrompt("Michael Porter");
    expect(pkg.prompt).toContain("[SUBJECT]");
    expect(pkg.prompt).toContain("[LIGHTING]");
    expect(pkg.prompt).toContain("[CAMERA]");
  });

  it("produces a negative prompt", () => {
    const pkg = buildGenericFallbackPrompt("Michael Porter");
    expect(pkg.negativePrompt.length).toBeGreaterThan(50);
  });
});
