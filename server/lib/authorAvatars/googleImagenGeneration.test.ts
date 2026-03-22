/**
 * Tests for googleImagenGeneration.ts
 *
 * Covers:
 *   - NANO_BANANA_MODELS mapping correctness
 *   - DEFAULT_NANO_BANANA_MODEL value
 *   - Model resolution logic (friendly key → Gemini model ID)
 *   - generateGoogleImagenPortrait returns null when GEMINI_API_KEY is absent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NANO_BANANA_MODELS,
  DEFAULT_NANO_BANANA_MODEL,
  generateGoogleImagenPortrait,
} from "./googleImagenGeneration";

// ── NANO_BANANA_MODELS mapping ────────────────────────────────────────────────

describe("NANO_BANANA_MODELS", () => {
  it("maps nano-banana to gemini-2.5-flash-image", () => {
    expect(NANO_BANANA_MODELS["nano-banana"]).toBe("gemini-2.5-flash-image");
  });

  it("maps nano-banana-2 to gemini-3.1-flash-image-preview", () => {
    expect(NANO_BANANA_MODELS["nano-banana-2"]).toBe("gemini-3.1-flash-image-preview");
  });

  it("maps nano-banana-pro to gemini-3-pro-image-preview", () => {
    expect(NANO_BANANA_MODELS["nano-banana-pro"]).toBe("gemini-3-pro-image-preview");
  });

  it("has exactly 3 entries", () => {
    expect(Object.keys(NANO_BANANA_MODELS)).toHaveLength(3);
  });
});

// ── DEFAULT_NANO_BANANA_MODEL ─────────────────────────────────────────────────

describe("DEFAULT_NANO_BANANA_MODEL", () => {
  it("is gemini-2.5-flash-image (fast, efficient model)", () => {
    expect(DEFAULT_NANO_BANANA_MODEL).toBe("gemini-2.5-flash-image");
  });

  it("is present in NANO_BANANA_MODELS values", () => {
    expect(Object.values(NANO_BANANA_MODELS)).toContain(DEFAULT_NANO_BANANA_MODEL);
  });
});

// ── generateGoogleImagenPortrait — missing API key ────────────────────────────

describe("generateGoogleImagenPortrait", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it("returns null when GEMINI_API_KEY is not set", async () => {
    const result = await generateGoogleImagenPortrait("Adam Grant");
    expect(result).toBeNull();
  });

  it("returns null when GEMINI_API_KEY is empty string", async () => {
    process.env.GEMINI_API_KEY = "";
    const result = await generateGoogleImagenPortrait("Adam Grant");
    expect(result).toBeNull();
  });
});

// ── Model resolution logic (unit-level, no API call) ─────────────────────────

describe("Model resolution logic", () => {
  it("friendly key 'nano-banana' resolves to gemini-2.5-flash-image", () => {
    const key = "nano-banana";
    const resolved = NANO_BANANA_MODELS[key] ?? key;
    expect(resolved).toBe("gemini-2.5-flash-image");
  });

  it("unknown key passes through unchanged (used as raw model ID)", () => {
    const key = "some-custom-model-id";
    const resolved = NANO_BANANA_MODELS[key] ?? key;
    expect(resolved).toBe("some-custom-model-id");
  });

  it("undefined model falls back to DEFAULT_NANO_BANANA_MODEL", () => {
    const modelId: string | undefined = undefined;
    const resolved = modelId ?? DEFAULT_NANO_BANANA_MODEL;
    expect(resolved).toBe(DEFAULT_NANO_BANANA_MODEL);
  });
});

// ── Vendor routing logic (mirrors generatePortrait procedure logic) ───────────

describe("Vendor routing logic", () => {
  function shouldUseGoogleImagen(
    avatarGenVendor?: string,
    avatarGenModel?: string,
  ): boolean {
    return (
      avatarGenVendor === "google" ||
      !!(
        avatarGenModel &&
        (avatarGenModel.startsWith("gemini-") || avatarGenModel.startsWith("nano-banana"))
      )
    );
  }

  it("routes to Google Imagen when vendor is 'google'", () => {
    expect(shouldUseGoogleImagen("google", undefined)).toBe(true);
  });

  it("routes to Google Imagen when model starts with 'gemini-'", () => {
    expect(shouldUseGoogleImagen(undefined, "gemini-2.5-flash-image")).toBe(true);
  });

  it("routes to Google Imagen when model starts with 'nano-banana'", () => {
    expect(shouldUseGoogleImagen(undefined, "nano-banana-pro")).toBe(true);
  });

  it("routes to Replicate when vendor is 'replicate'", () => {
    expect(shouldUseGoogleImagen("replicate", undefined)).toBe(false);
  });

  it("routes to Replicate when no vendor or model is specified", () => {
    expect(shouldUseGoogleImagen(undefined, undefined)).toBe(false);
  });

  it("routes to Replicate for non-Google model IDs", () => {
    expect(shouldUseGoogleImagen("replicate", "black-forest-labs/flux-schnell")).toBe(false);
  });
});
