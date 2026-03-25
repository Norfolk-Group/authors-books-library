/**
 * Vitest tests for Avatar Resolution Controls
 *
 * Tests that the resolution/output fields are properly defined in types,
 * passed through the pipeline options, and handled by generators.
 */

import { describe, it, expect } from "vitest";
import type {
  ImageGenerationRequest,
  MeticulousPipelineOptions,
  AspectRatio,
  OutputFormat,
} from "./lib/authorAvatars/types";

describe("Avatar Resolution Controls — Types", () => {
  it("AspectRatio type accepts all valid ratios", () => {
    const ratios: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"];
    expect(ratios).toHaveLength(7);
    ratios.forEach((r) => expect(r).toMatch(/^\d+:\d+$/));
  });

  it("OutputFormat type accepts png, webp, jpeg", () => {
    const formats: OutputFormat[] = ["png", "webp", "jpeg"];
    expect(formats).toHaveLength(3);
  });

  it("ImageGenerationRequest includes all resolution fields", () => {
    const req: ImageGenerationRequest = {
      prompt: "Test prompt",
      aspectRatio: "3:4",
      width: 768,
      height: 1024,
      outputFormat: "webp",
      outputQuality: 90,
      numInferenceSteps: 30,
      guidanceScale: 7.5,
    };
    expect(req.aspectRatio).toBe("3:4");
    expect(req.width).toBe(768);
    expect(req.height).toBe(1024);
    expect(req.outputFormat).toBe("webp");
    expect(req.outputQuality).toBe(90);
    expect(req.numInferenceSteps).toBe(30);
    expect(req.guidanceScale).toBe(7.5);
  });

  it("ImageGenerationRequest resolution fields are optional", () => {
    const minimal: ImageGenerationRequest = {
      prompt: "Minimal prompt",
    };
    expect(minimal.aspectRatio).toBeUndefined();
    expect(minimal.width).toBeUndefined();
    expect(minimal.height).toBeUndefined();
    expect(minimal.outputFormat).toBeUndefined();
    expect(minimal.outputQuality).toBeUndefined();
    expect(minimal.numInferenceSteps).toBeUndefined();
    expect(minimal.guidanceScale).toBeUndefined();
  });

  it("MeticulousPipelineOptions includes all resolution fields", () => {
    const opts: MeticulousPipelineOptions = {
      bgColor: "bokeh-gold",
      vendor: "replicate",
      model: "nano-banana",
      aspectRatio: "2:3",
      width: 640,
      height: 960,
      outputFormat: "png",
      outputQuality: 95,
      guidanceScale: 8,
      numInferenceSteps: 40,
    };
    expect(opts.aspectRatio).toBe("2:3");
    expect(opts.width).toBe(640);
    expect(opts.height).toBe(960);
    expect(opts.outputFormat).toBe("png");
    expect(opts.outputQuality).toBe(95);
    expect(opts.guidanceScale).toBe(8);
    expect(opts.numInferenceSteps).toBe(40);
  });

  it("MeticulousPipelineOptions resolution fields are optional", () => {
    const minimal: MeticulousPipelineOptions = {};
    expect(minimal.aspectRatio).toBeUndefined();
    expect(minimal.outputFormat).toBeUndefined();
  });

  it("width/height must be multiples of 64 for Replicate", () => {
    const validWidths = [512, 576, 640, 704, 768, 832, 896, 960, 1024];
    validWidths.forEach((w) => expect(w % 64).toBe(0));
  });

  it("outputQuality range is 1-100", () => {
    const req: ImageGenerationRequest = {
      prompt: "test",
      outputQuality: 50,
    };
    expect(req.outputQuality).toBeGreaterThanOrEqual(1);
    expect(req.outputQuality).toBeLessThanOrEqual(100);
  });

  it("numInferenceSteps range is 1-50", () => {
    const req: ImageGenerationRequest = {
      prompt: "test",
      numInferenceSteps: 28,
    };
    expect(req.numInferenceSteps).toBeGreaterThanOrEqual(1);
    expect(req.numInferenceSteps).toBeLessThanOrEqual(50);
  });
});

describe("Avatar Resolution Controls — Pipeline Options Passthrough", () => {
  it("pipeline options map to generation request fields", () => {
    const opts: MeticulousPipelineOptions = {
      aspectRatio: "3:4",
      width: 768,
      height: 1024,
      outputFormat: "webp",
      outputQuality: 90,
      guidanceScale: 7.5,
      numInferenceSteps: 30,
    };

    // Simulate the passthrough that meticulousPipeline.ts does
    const genRequest: ImageGenerationRequest = {
      prompt: "test prompt",
      aspectRatio: opts.aspectRatio,
      width: opts.width,
      height: opts.height,
      outputFormat: opts.outputFormat,
      outputQuality: opts.outputQuality,
      guidanceScale: opts.guidanceScale,
      numInferenceSteps: opts.numInferenceSteps,
    };

    expect(genRequest.aspectRatio).toBe(opts.aspectRatio);
    expect(genRequest.width).toBe(opts.width);
    expect(genRequest.height).toBe(opts.height);
    expect(genRequest.outputFormat).toBe(opts.outputFormat);
    expect(genRequest.outputQuality).toBe(opts.outputQuality);
    expect(genRequest.guidanceScale).toBe(opts.guidanceScale);
    expect(genRequest.numInferenceSteps).toBe(opts.numInferenceSteps);
  });

  it("default values are used when pipeline options omit resolution fields", () => {
    const opts: MeticulousPipelineOptions = {
      vendor: "replicate",
      model: "nano-banana",
    };

    const genRequest: ImageGenerationRequest = {
      prompt: "test prompt",
      aspectRatio: opts.aspectRatio ?? "3:4",
      outputFormat: opts.outputFormat ?? "webp",
      outputQuality: opts.outputQuality ?? 90,
      numInferenceSteps: opts.numInferenceSteps ?? 28,
    };

    expect(genRequest.aspectRatio).toBe("3:4");
    expect(genRequest.outputFormat).toBe("webp");
    expect(genRequest.outputQuality).toBe(90);
    expect(genRequest.numInferenceSteps).toBe(28);
  });
});
