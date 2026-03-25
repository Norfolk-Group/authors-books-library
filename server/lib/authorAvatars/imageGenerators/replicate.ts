/**
 * Replicate Image Generator
 *
 * Supports Replicate-hosted models:
 *   - black-forest-labs/flux-schnell  (fast, ~2s, good quality — default)
 *   - black-forest-labs/flux-dev      (slower, higher quality)
 *   - black-forest-labs/flux-pro      (best quality, most expensive)
 *
 * NOTE: The Replicate SDK (>=1.0) returns FileOutput objects.
 * FileOutput.toString() returns the URL string directly.
 */

import Replicate from "replicate";
import {
  ImageGenerator,
  ImageGeneratorConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types.js";

export const REPLICATE_MODELS: Record<string, string> = {
  "flux-schnell": "black-forest-labs/flux-schnell",
  "flux-dev": "black-forest-labs/flux-dev",
  "flux-pro": "black-forest-labs/flux-pro",
  "flux-1.1-pro": "black-forest-labs/flux-1.1-pro",
  // Allow passing full model IDs directly
  "black-forest-labs/flux-schnell": "black-forest-labs/flux-schnell",
  "black-forest-labs/flux-dev": "black-forest-labs/flux-dev",
  "black-forest-labs/flux-pro": "black-forest-labs/flux-pro",
  "black-forest-labs/flux-1.1-pro": "black-forest-labs/flux-1.1-pro",
};

export const DEFAULT_REPLICATE_MODEL = "black-forest-labs/flux-schnell";

/**
 * Validate dimension is a positive multiple of 64 (Replicate requirement).
 * Returns the nearest valid value or undefined if input is invalid.
 */
function validateDimension(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (value < 64) return 64;
  if (value > 2048) return 2048;
  return Math.round(value / 64) * 64;
}

/**
 * Map OutputFormat to Replicate's expected format string.
 */
function mapOutputFormat(format: string | undefined): string {
  switch (format) {
    case "png": return "png";
    case "jpeg": return "jpg";
    case "webp": return "webp";
    default: return "webp";
  }
}

export class ReplicateGenerator implements ImageGenerator {
  private readonly model: string;

  constructor(config: ImageGeneratorConfig) {
    this.model = REPLICATE_MODELS[config.model] ?? config.model ?? DEFAULT_REPLICATE_MODEL;
  }

  isAvailable(): boolean {
    return !!process.env.REPLICATE_API_TOKEN;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const auth = process.env.REPLICATE_API_TOKEN;

    if (!auth) {
      return {
        mimeType: "image/webp",
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: "REPLICATE_API_TOKEN is not set",
      };
    }

    try {
      const client = new Replicate({ auth });

      const outputFormat = mapOutputFormat(request.outputFormat);
      const mimeType = outputFormat === "png" ? "image/png"
        : outputFormat === "jpg" ? "image/jpeg"
        : "image/webp";

      // Build input with all resolution params
      const input: Record<string, unknown> = {
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        aspect_ratio: request.aspectRatio ?? "1:1",
        guidance_scale: request.guidanceScale ?? 7.5,
        num_outputs: 1,
        output_format: outputFormat,
        output_quality: request.outputQuality ?? 90,
      };

      // Add explicit dimensions if provided (overrides aspect_ratio)
      const width = validateDimension(request.width);
      const height = validateDimension(request.height);
      if (width) input.width = width;
      if (height) input.height = height;

      // Add inference steps if provided
      if (request.numInferenceSteps !== undefined) {
        input.num_inference_steps = Math.max(1, Math.min(50, request.numInferenceSteps));
      }

      const output = await client.run(this.model as `${string}/${string}`, { input });

      // FileOutput.toString() returns the URL
      const imageUrl = Array.isArray(output)
        ? String(output[0])
        : String(output);

      return {
        imageUrl: imageUrl || undefined,
        mimeType,
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        mimeType: "image/webp",
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
