/**
 * Google Imagen / Nano Banana Image Generator
 *
 * Supports all Google Gemini image generation models:
 *   - gemini-2.5-flash-image  (Nano Banana — default, fast, high quality)
 *   - gemini-3-pro-image-preview  (Nano Banana Pro — higher quality, slower)
 *   - imagen-3.0-generate-001  (Imagen 3 — dedicated image model)
 *
 * Reference-image injection:
 *   When a `referenceImageBase64` is provided in the request, the generator
 *   constructs a multimodal prompt:
 *     1. Reference instruction text (how to use the photo)
 *     2. Reference image (inline base64)
 *     3. Generation prompt (what to create)
 *   This allows Gemini to use the reference face as a visual anchor while
 *   applying the target style (lighting, background, attire).
 *
 * Falls back to text-only generation if no reference image is available.
 */

import { GoogleGenAI } from "@google/genai";
import {
  ImageGenerator,
  ImageGeneratorConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types.js";
import { logger } from "../../../lib/logger";

export const GOOGLE_MODELS: Record<string, string> = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "imagen-3": "imagen-3.0-generate-001",
  // Allow passing model IDs directly
  "gemini-2.5-flash-image": "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
  "imagen-3.0-generate-001": "imagen-3.0-generate-001",
};

export const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash-image";

/**
 * Imagen 3 only supports a limited set of aspect ratios.
 * Map any input ratio to the nearest supported one.
 */
const IMAGEN3_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;

function mapToImagen3AspectRatio(ratio: string | undefined): string {
  if (!ratio) return "1:1";
  if ((IMAGEN3_ASPECT_RATIOS as readonly string[]).includes(ratio)) return ratio;
  // Map common ratios to nearest Imagen 3 equivalent
  const mapping: Record<string, string> = {
    "2:3": "3:4",
    "3:2": "4:3",
    "4:5": "3:4",
    "5:4": "4:3",
  };
  return mapping[ratio] ?? "1:1";
}

/**
 * Reference instruction prepended before the reference image.
 * Tells the model exactly how to use the reference photo.
 */
const REFERENCE_INSTRUCTION = `REFERENCE IMAGE GUIDANCE:
You are provided with a reference photograph of a real person. Your task is to generate a NEW professional portrait that:

1. PRESERVES FACIAL IDENTITY — Maintain the exact facial structure, features, and proportions from the reference:
   - Same face shape, bone structure, and facial proportions
   - Same eye shape, color, spacing, and expression tendency
   - Same nose shape, size, and profile
   - Same lip shape and fullness
   - Same jawline and chin structure
   - Same forehead shape and hairline position
   - Same distinctive features (moles, dimples, asymmetries, glasses)
   - Same approximate age appearance

2. TRANSFORMS CONTEXT — Apply the requested changes from the generation prompt:
   - New professional lighting setup as specified
   - New background as specified
   - Professional attire as specified
   - Improved composition and framing

3. CRITICAL RULES:
   - The generated person MUST be recognizable as the same individual in the reference photo
   - Do NOT make the person younger, thinner, or more conventionally attractive
   - Do NOT change ethnicity, hair color, or fundamental facial structure
   - Maintain authentic likeness over idealization
   - This is for a professional author headshot — maintain dignity and professionalism

Now apply the following generation prompt to create the portrait:`;

/**
 * Wrap the generation prompt with reference-aware framing.
 */
function buildReferenceAwarePrompt(prompt: string): string {
  return `GENERATION PROMPT (apply while maintaining the facial identity from the reference photo above):\n\n${prompt}`;
}

export class GoogleImagenGenerator implements ImageGenerator {
  private readonly model: string;

  constructor(config: ImageGeneratorConfig) {
    // Resolve friendly names to actual model IDs
    this.model = GOOGLE_MODELS[config.model] ?? config.model ?? DEFAULT_GOOGLE_MODEL;
  }

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        mimeType: "image/png",
        vendor: "google",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: "GEMINI_API_KEY is not set",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // For Imagen 3, use the dedicated generateImages API (no multimodal input support)
      if (this.model.startsWith("imagen-")) {
        return this.generateWithImagen3(ai, request, startTime);
      }

      // For Gemini image models (Nano Banana), use generateContent with IMAGE modality
      // and optional reference image injection
      return this.generateWithGemini(ai, request, startTime);
    } catch (err) {
      return {
        mimeType: "image/png",
        vendor: "google",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  private async generateWithImagen3(
    ai: GoogleGenAI,
    request: ImageGenerationRequest,
    startTime: number
  ): Promise<ImageGenerationResult> {
    // Imagen 3 doesn't support multimodal input — text-only
    const response = await ai.models.generateImages({
      model: this.model,
      prompt: request.prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: mapToImagen3AspectRatio(request.aspectRatio),
      },
    });
    const image = response.generatedImages?.[0];
    if (!image?.image?.imageBytes) {
      return {
        mimeType: "image/png",
        vendor: "google",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: "No image generated by Imagen",
      };
    }
    return {
      imageBase64: image.image.imageBytes,
      mimeType: "image/png",
      vendor: "google",
      model: this.model,
      durationMs: Date.now() - startTime,
    };
  }

  private async generateWithGemini(
    ai: GoogleGenAI,
    request: ImageGenerationRequest,
    startTime: number
  ): Promise<ImageGenerationResult> {
    const hasReference = !!(request.referenceImageBase64);
    const mimeType = (request.referenceImageMimeType ?? "image/jpeg") as string;

    let parts: object[];

    if (hasReference) {
      // Reference-guided generation: instruction → reference image → generation prompt
      logger.debug(`[GoogleImagenGenerator] Reference-guided generation (model: ${this.model})`);
      parts = [
        { text: REFERENCE_INSTRUCTION },
        {
          inlineData: {
            mimeType,
            data: request.referenceImageBase64!,
          },
        },
        { text: buildReferenceAwarePrompt(request.prompt) },
      ];
    } else {
      // Text-only generation (fallback when no reference photo available)
      logger.debug(`[GoogleImagenGenerator] Text-only generation (model: ${this.model})`);
      // Embed negative prompt as constraint since Gemini doesn't have a separate field
      const fullPrompt = request.negativePrompt
        ? `${request.prompt}\n\nIMPORTANT — AVOID IN THE OUTPUT: ${request.negativePrompt}`
        : request.prompt;
      parts = [{ text: fullPrompt }];
    }

    const response = await ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const candidates = response.candidates ?? [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          return {
            imageBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
            vendor: "google",
            model: this.model,
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    return {
      mimeType: "image/png",
      vendor: "google",
      model: this.model,
      durationMs: Date.now() - startTime,
      error: "No image part found in Gemini response",
    };
  }
}
