/**
 * llmScoring.ts — Task-based recommendation engine for LLM models
 *
 * Scores each model per use-case and tags the top pick as `recommended`.
 * Imported by llmCatalogue.ts (barrel) which re-exports the final catalogue.
 */
import type { LLMModel, LLMVendor, UseCase } from "./llmTypes";
import { USE_CASES } from "./llmTypes";

// ---------------------------------------------------------------------------
// Task-Based Recommendation Engine
// ---------------------------------------------------------------------------

interface ScoringCriteria {
  contextWindowScore: (ctx: number) => number;
  tierScore: (tier: LLMModel["tier"]) => number;
  speedScore: (speed: LLMModel["speed"]) => number;
  vendorBonus: (vendorId: string) => number;
  modelBonus: (modelId: string) => number;
}

const USE_CASE_CRITERIA: Record<UseCase, ScoringCriteria> = {
  /**
   * Research (LLM 1): Needs broad world knowledge, large context, factual accuracy.
   * Prefer: balanced speed (not too slow), large context, Google/Anthropic/OpenAI.
   */
  research: {
    contextWindowScore: (ctx) => Math.min(ctx / 100000, 10),
    tierScore: (tier) =>
      ({ flagship: 4, balanced: 8, fast: 6, lite: 2, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 7, balanced: 10, powerful: 6 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ google: 5, openai: 3, anthropic: 3, perplexity: 4, meta: 2, mistral: 1, xai: 2, deepseek: 2 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-flash": 15, // recommended for LLM 1
        "gemini-2.5-pro": 10,
        "gemini-3-flash-preview": 8,
        "gpt-4o": 8,
        "llama-4-scout": 7,
        "claude-sonnet-4-5-20250929": 6,
        "sonar-pro": 8,
        "grok-3": 5,
        "deepseek-v3": 5,
        "command-r-plus": 5,
      };
      return bonuses[id] ?? 0;
    },
  },

  /**
   * Refinement (LLM 2): Needs prose quality, tone, editing ability.
   * Prefer: flagship tier, powerful models, Anthropic/Google.
   */
  refinement: {
    contextWindowScore: (ctx) => Math.min(ctx / 200000, 5),
    tierScore: (tier) =>
      ({ flagship: 10, balanced: 7, fast: 4, lite: 1, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 3, balanced: 7, powerful: 10 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ anthropic: 5, google: 5, openai: 3, xai: 2, meta: 1 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-pro": 20, // recommended for LLM 2
        "claude-opus-4-5-20251101": 18,
        "claude-sonnet-4-5-20250929": 15,
        "gemini-3.1-pro-preview": 14,
        "gpt-4o": 12,
        "o3": 10,
        "grok-3": 8,
      };
      return bonuses[id] ?? 0;
    },
  },

  /**
   * Structured output: JSON schema, data extraction, structured responses.
   * Prefer: models with strong instruction following and JSON mode support.
   */
  structured: {
    contextWindowScore: (ctx) => Math.min(ctx / 100000, 5),
    tierScore: (tier) =>
      ({ flagship: 6, balanced: 10, fast: 8, lite: 4, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 10, balanced: 8, powerful: 4 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ google: 5, openai: 5, anthropic: 3, deepseek: 3, mistral: 2 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-flash": 15,
        "gpt-4o-mini": 12,
        "o4-mini": 10,
        "claude-haiku-4-5-20251001": 8,
        "deepseek-v3": 7,
        "mistral-small-3": 6,
        "grok-3-mini": 5,
      };
      return bonuses[id] ?? 0;
    },
  },

  /**
   * Avatar research: Deep visual description synthesis for avatar generation.
   * Needs strong visual understanding and descriptive writing.
   */
  avatar_research: {
    contextWindowScore: (ctx) => Math.min(ctx / 200000, 5),
    tierScore: (tier) =>
      ({ flagship: 8, balanced: 10, fast: 5, lite: 2, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 6, balanced: 10, powerful: 8 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ google: 6, anthropic: 4, openai: 3, xai: 2 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-flash": 18,
        "gemini-2.5-pro": 14,
        "claude-sonnet-4-5-20250929": 10,
        "gpt-4o": 8,
        "grok-3": 6,
      };
      return bonuses[id] ?? 0;
    },
  },

  /**
   * Code generation: Code writing, analysis, debugging.
   * Prefer: models with strong coding benchmarks.
   */
  code: {
    contextWindowScore: (ctx) => Math.min(ctx / 100000, 5),
    tierScore: (tier) =>
      ({ flagship: 8, balanced: 7, fast: 5, lite: 2, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 6, balanced: 8, powerful: 10 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ anthropic: 5, openai: 5, google: 4, deepseek: 5, mistral: 3 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "claude-sonnet-4-20250514": 18,
        "gpt-4.1": 15,
        "codestral-2501": 14,
        "deepseek-v3": 13,
        "o3": 12,
        "gemini-2.5-pro": 10,
        "qwen-coder-plus": 8,
      };
      return bonuses[id] ?? 0;
    },
  },

  /**
   * Bulk processing: High-volume, cost-sensitive batch operations.
   * Prefer: fast, lite models with good throughput.
   */
  bulk: {
    contextWindowScore: (ctx) => Math.min(ctx / 200000, 3),
    tierScore: (tier) =>
      ({ flagship: 2, balanced: 6, fast: 8, lite: 10, "image-gen": 0 })[tier] ?? 0,
    speedScore: (speed) => ({ fast: 10, balanced: 6, powerful: 2 })[speed] ?? 0,
    vendorBonus: (v) =>
      ({ google: 5, openai: 3, anthropic: 2, deepseek: 4, alibaba: 3 })[v] ?? 0,
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-flash-lite": 18,
        "gpt-4o-mini": 14,
        "claude-3-5-haiku-20241022": 12,
        "claude-haiku-4-5-20251001": 11,
        "grok-3-mini-fast": 10,
        "deepseek-v3-0324": 9,
        "qwen-turbo": 8,
        "amazon.nova-micro-v1:0": 7,
      };
      return bonuses[id] ?? 0;
    },
  },
};

export const RECOMMENDATION_REASONS: Record<UseCase, string> = {
  research:
    "Best for LLM 1 research pass — fast, large context, strong factual recall for bulk author/book enrichment.",
  refinement:
    "Best for LLM 2 refinement pass — highest prose quality for polishing bios and summaries.",
  structured:
    "Best for structured output — fast JSON schema compliance and data extraction.",
  avatar_research:
    "Best for avatar pipeline — strong visual understanding and descriptive writing for image prompts.",
  code:
    "Best for code generation — top coding benchmarks with strong instruction following.",
  bulk:
    "Best for bulk processing — fastest throughput at lowest cost for high-volume batch operations.",
};

function scoreModel(vendorId: string, model: LLMModel, useCase: UseCase): number {
  const c = USE_CASE_CRITERIA[useCase];
  return (
    c.contextWindowScore(model.contextWindow) +
    c.tierScore(model.tier) +
    c.speedScore(model.speed) +
    c.vendorBonus(vendorId) +
    c.modelBonus(model.id)
  );
}

/**
 * Run the recommendation engine over the full catalogue.
 * Tags the top-scoring model per use case with `recommended` and `recommendedReason`.
 * Returns a deep copy of the catalogue with recommendations applied.
 */
export function applyRecommendations(catalogue: LLMVendor[]): LLMVendor[] {
  const cloned: LLMVendor[] = catalogue.map((v) => ({
    ...v,
    models: v.models.map((m) => ({
      ...m,
      recommended: [] as UseCase[],
      recommendedReasons: {} as Record<string, string>,
    })),
  }));

  for (const useCase of USE_CASES) {
    let topScore = -Infinity;
    let topVendorIdx = -1;
    let topModelIdx = -1;

    for (let vi = 0; vi < cloned.length; vi++) {
      const vendor = cloned[vi];
      for (let mi = 0; mi < vendor.models.length; mi++) {
        if (vendor.models[mi].imageGen) continue; // skip image-gen models for text use cases
        const score = scoreModel(vendor.id, vendor.models[mi], useCase);
        if (score > topScore) {
          topScore = score;
          topVendorIdx = vi;
          topModelIdx = mi;
        }
      }
    }

    if (topVendorIdx >= 0 && topModelIdx >= 0) {
      const model = cloned[topVendorIdx].models[topModelIdx];
      if (!model.recommended) model.recommended = [];
      if (!model.recommendedReasons) model.recommendedReasons = {};
      model.recommended.push(useCase);
      model.recommendedReasons[useCase] = RECOMMENDATION_REASONS[useCase];
    }
  }

  return cloned;
}
