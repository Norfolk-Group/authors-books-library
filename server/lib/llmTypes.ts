/**
 * llmTypes.ts — Shared types for the LLM catalogue system
 */

export const USE_CASES = [
  "research",
  "refinement",
  "structured",
  "avatar_research",
  "code",
  "bulk",
] as const;

export type UseCase = (typeof USE_CASES)[number];

export interface LLMModel {
  id: string;
  displayName: string;
  description: string;
  contextWindow: number; // input tokens
  outputTokens: number;
  tier: "flagship" | "balanced" | "fast" | "lite" | "image-gen";
  /** True if this model is an image generation model, not a text LLM */
  imageGen?: boolean;
  speed: "fast" | "balanced" | "powerful";
  /** Populated by the recommendation engine — all use cases this model is recommended for */
  recommended?: UseCase[];
  /** Human-readable reasons for each recommendation, keyed by use case */
  recommendedReasons?: Record<string, string>;
}

export interface LLMVendor {
  id: string;
  displayName: string;
  shortName: string;
  logoColor: string; // brand accent hex for UI
  models: LLMModel[];
}
