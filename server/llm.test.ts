import { describe, it, expect } from "vitest";
import {
  VENDOR_CATALOGUE,
  USE_CASES,
  applyRecommendations,
  findVendor,
  findModel,
  getRecommendedModel,
  DEFAULT_PRIMARY_VENDOR,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_SECONDARY_VENDOR,
  DEFAULT_SECONDARY_MODEL,
} from "./routers/llm.router";

// ─── Vendor Catalogue ────────────────────────────────────────────────────────

describe("Vendor Catalogue", () => {
  it("contains at least 10 vendors", () => {
    expect(VENDOR_CATALOGUE.length).toBeGreaterThanOrEqual(10);
  });

  it("includes all major providers", () => {
    const ids = VENDOR_CATALOGUE.map((v) => v.id);
    expect(ids).toContain("google");
    expect(ids).toContain("openai");
    expect(ids).toContain("anthropic");
    expect(ids).toContain("xai");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("meta");
    expect(ids).toContain("mistral");
    expect(ids).toContain("perplexity");
    expect(ids).toContain("amazon");
    expect(ids).toContain("alibaba");
    expect(ids).toContain("cohere");
    expect(ids).toContain("microsoft");
    expect(ids).toContain("ai21");
  });

  it("every vendor has at least 2 models", () => {
    for (const v of VENDOR_CATALOGUE) {
      expect(v.models.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every vendor has required fields", () => {
    for (const v of VENDOR_CATALOGUE) {
      expect(v.id).toBeTruthy();
      expect(v.displayName).toBeTruthy();
      expect(v.shortName).toBeTruthy();
      expect(v.logoColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("every model has required fields", () => {
    for (const v of VENDOR_CATALOGUE) {
      for (const m of v.models) {
        expect(m.id).toBeTruthy();
        expect(m.displayName).toBeTruthy();
        expect(m.description).toBeTruthy();
        expect(["flagship", "balanced", "fast", "lite", "image-gen"]).toContain(m.tier);
        expect(["fast", "balanced", "powerful"]).toContain(m.speed);
      }
    }
  });

  it("does not contain deprecated gemini-2.0-flash", () => {
    for (const v of VENDOR_CATALOGUE) {
      for (const m of v.models) {
        expect(m.id).not.toBe("gemini-2.0-flash");
      }
    }
  });

  it("contains gemini-2.5-flash and gemini-2.5-pro", () => {
    const google = findVendor("google");
    expect(google).toBeDefined();
    const modelIds = google!.models.map((m) => m.id);
    expect(modelIds).toContain("gemini-2.5-flash");
    expect(modelIds).toContain("gemini-2.5-pro");
  });

  it("contains Grok models under xAI vendor", () => {
    const xai = findVendor("xai");
    expect(xai).toBeDefined();
    expect(xai!.displayName).toBe("xAI");
    expect(xai!.shortName).toBe("Grok");
    const modelIds = xai!.models.map((m) => m.id);
    expect(modelIds).toContain("grok-3");
    expect(modelIds).toContain("grok-3-mini");
  });

  it("contains DeepSeek models", () => {
    const ds = findVendor("deepseek");
    expect(ds).toBeDefined();
    const modelIds = ds!.models.map((m) => m.id);
    expect(modelIds).toContain("deepseek-v3");
    expect(modelIds).toContain("deepseek-r1");
  });

  it("has no duplicate model IDs within a vendor", () => {
    for (const v of VENDOR_CATALOGUE) {
      const ids = v.models.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("has no duplicate vendor IDs", () => {
    const ids = VENDOR_CATALOGUE.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── findVendor / findModel ──────────────────────────────────────────────────

describe("findVendor / findModel", () => {
  it("finds Google vendor", () => {
    const v = findVendor("google");
    expect(v).toBeDefined();
    expect(v!.id).toBe("google");
  });

  it("returns undefined for unknown vendor", () => {
    expect(findVendor("nonexistent")).toBeUndefined();
  });

  it("finds gemini-2.5-flash within Google", () => {
    const m = findModel("google", "gemini-2.5-flash");
    expect(m).toBeDefined();
    expect(m!.displayName).toContain("Flash");
  });

  it("returns undefined for unknown model", () => {
    expect(findModel("google", "nonexistent-model")).toBeUndefined();
  });
});

// ─── Recommendation Engine ───────────────────────────────────────────────────

describe("Recommendation Engine", () => {
  it("produces at least one recommendation per use case", () => {
    const recommended = new Set<string>();
    for (const v of VENDOR_CATALOGUE) {
      for (const m of v.models) {
        if (m.recommended) {
          for (const uc of m.recommended) {
            recommended.add(uc);
          }
        }
      }
    }
    for (const uc of USE_CASES) {
      expect(recommended.has(uc)).toBe(true);
    }
  });

  it("does not recommend image-gen models for text use cases", () => {
    for (const v of VENDOR_CATALOGUE) {
      for (const m of v.models) {
        if (m.imageGen && m.recommended && m.recommended.length > 0) {
          // Image-gen models should never be recommended for text use cases
          for (const uc of m.recommended) {
            expect(["research", "refinement", "structured", "avatar_research", "code", "bulk"]).not.toContain(uc);
          }
        }
      }
    }
  });

  it("recommends gemini-2.5-flash for research", () => {
    const rec = getRecommendedModel("research");
    expect(rec).not.toBeNull();
    expect(rec!.modelId).toBe("gemini-2.5-flash");
    expect(rec!.vendorId).toBe("google");
  });

  it("recommends gemini-2.5-pro for refinement", () => {
    const rec = getRecommendedModel("refinement");
    expect(rec).not.toBeNull();
    expect(rec!.modelId).toBe("gemini-2.5-pro");
    expect(rec!.vendorId).toBe("google");
  });

  it("returns a recommendation for every use case", () => {
    for (const uc of USE_CASES) {
      const rec = getRecommendedModel(uc);
      expect(rec).not.toBeNull();
      expect(rec!.vendorId).toBeTruthy();
      expect(rec!.modelId).toBeTruthy();
      expect(rec!.reason).toBeTruthy();
    }
  });

  it("applyRecommendations returns a deep copy (does not mutate raw catalogue)", () => {
    const raw = [
      {
        id: "test",
        displayName: "Test",
        shortName: "T",
        logoColor: "#000000",
        models: [
          {
            id: "test-model",
            displayName: "Test Model",
            description: "A test",
            contextWindow: 100000,
            outputTokens: 4096,
            tier: "balanced" as const,
            speed: "balanced" as const,
          },
        ],
      },
    ];
    const result = applyRecommendations(raw);
    // Original should not have recommended field
    expect(raw[0].models[0]).not.toHaveProperty("recommended");
    // Result should have recommended as an array
    expect(Array.isArray(result[0].models[0].recommended)).toBe(true);
  });
});

// ─── Defaults ────────────────────────────────────────────────────────────────

describe("Default Model Configuration", () => {
  it("default primary vendor is google", () => {
    expect(DEFAULT_PRIMARY_VENDOR).toBe("google");
  });

  it("default primary model is gemini-2.5-flash", () => {
    expect(DEFAULT_PRIMARY_MODEL).toBe("gemini-2.5-flash");
  });

  it("default secondary vendor is google", () => {
    expect(DEFAULT_SECONDARY_VENDOR).toBe("google");
  });

  it("default secondary model is gemini-2.5-pro", () => {
    expect(DEFAULT_SECONDARY_MODEL).toBe("gemini-2.5-pro");
  });

  it("default models exist in the catalogue", () => {
    expect(findModel(DEFAULT_PRIMARY_VENDOR, DEFAULT_PRIMARY_MODEL)).toBeDefined();
    expect(findModel(DEFAULT_SECONDARY_VENDOR, DEFAULT_SECONDARY_MODEL)).toBeDefined();
  });
});
