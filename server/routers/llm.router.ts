/**
 * LLM Router — vendor/model catalogue with recommendation engine.
 *
 * Architecture:
 *  - VENDOR_CATALOGUE_RAW: static registry of all major LLM providers + models.
 *  - applyRecommendations(): scores each model per use-case and tags the top
 *    pick as `recommended`. Re-runs on every `refreshVendors` call.
 *  - Use cases:
 *      "research"   → LLM 1 pass: factual extraction, synthesis, world knowledge
 *      "refinement" → LLM 2 pass: prose quality, tone, editing
 *
 * Seeded defaults (March 2026):
 *   LLM 1 (research):   Google → Gemini 2.5 Flash  (fast, 1M ctx, strong factual)
 *   LLM 2 (refinement): Google → Gemini 2.5 Pro    (best prose quality in family)
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseCase = "research" | "refinement";

export interface LLMModel {
  id: string;
  displayName: string;
  description: string;
  contextWindow: number; // input tokens (K)
  outputTokens: number;
  tier: "flagship" | "balanced" | "fast" | "lite";
  speed: "fast" | "balanced" | "powerful";
  /** Populated by the recommendation engine — not stored in the raw catalogue */
  recommended?: UseCase;
  /** Human-readable reason for the recommendation */
  recommendedReason?: string;
}

export interface LLMVendor {
  id: string;
  displayName: string;
  shortName: string;
  logoColor: string;  // brand accent hex for UI
  models: LLMModel[];
}

// ---------------------------------------------------------------------------
// Vendor Catalogue — all major LLM providers, March 2026
// ---------------------------------------------------------------------------

const VENDOR_CATALOGUE_RAW: LLMVendor[] = [
  // ── Google ────────────────────────────────────────────────────────────────
  {
    id: "google",
    displayName: "Google DeepMind",
    shortName: "Google",
    logoColor: "#4285F4",
    models: [
      {
        id: "gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro",
        description: "Best reasoning and writing quality in the 2.5 family. Recommended for research.",
        contextWindow: 1048576,
        outputTokens: 65536,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash",
        description: "Fast, accurate, 1M context. Recommended default for bulk enrichment.",
        contextWindow: 1048576,
        outputTokens: 65536,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "gemini-2.5-flash-lite",
        displayName: "Gemini 2.5 Flash-Lite",
        description: "Lightest 2.5 model. Best for high-volume tasks with tight latency.",
        contextWindow: 1048576,
        outputTokens: 65536,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "gemini-2.0-flash",
        displayName: "Gemini 2.0 Flash",
        description: "Reliable and fast, proven in production.",
        contextWindow: 1048576,
        outputTokens: 8192,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "gemini-3.1-pro-preview",
        displayName: "Gemini 3.1 Pro Preview",
        description: "Latest preview — most capable for complex reasoning and long-form writing.",
        contextWindow: 1048576,
        outputTokens: 65536,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "gemini-3-flash-preview",
        displayName: "Gemini 3 Flash Preview",
        description: "Gemini 3 Flash preview — fast and capable.",
        contextWindow: 1048576,
        outputTokens: 65536,
        tier: "fast",
        speed: "fast",
      },
    ],
  },

  // ── OpenAI ────────────────────────────────────────────────────────────────
  {
    id: "openai",
    displayName: "OpenAI",
    shortName: "OpenAI",
    logoColor: "#10A37F",
    models: [
      {
        id: "gpt-4o",
        displayName: "GPT-4o",
        description: "Flagship multimodal model. Best overall quality for complex tasks.",
        contextWindow: 128000,
        outputTokens: 16384,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "gpt-4o-mini",
        displayName: "GPT-4o Mini",
        description: "Smaller, faster, cheaper GPT-4o. Great for high-volume enrichment.",
        contextWindow: 128000,
        outputTokens: 16384,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "o3",
        displayName: "o3",
        description: "Advanced reasoning model. Best for multi-step analysis and research.",
        contextWindow: 200000,
        outputTokens: 100000,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "o4-mini",
        displayName: "o4-mini",
        description: "Fast reasoning model. Good balance of speed and analytical depth.",
        contextWindow: 200000,
        outputTokens: 100000,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "gpt-4.1",
        displayName: "GPT-4.1",
        description: "Latest GPT-4 generation. Improved instruction following and coding.",
        contextWindow: 1000000,
        outputTokens: 32768,
        tier: "flagship",
        speed: "powerful",
      },
    ],
  },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  {
    id: "anthropic",
    displayName: "Anthropic",
    shortName: "Anthropic",
    logoColor: "#D97706",
    models: [
      {
        id: "claude-opus-4",
        displayName: "Claude Opus 4",
        description: "Most capable Claude model. Best for nuanced writing and deep research.",
        contextWindow: 200000,
        outputTokens: 32000,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "claude-sonnet-4",
        displayName: "Claude Sonnet 4",
        description: "Best balance of speed and quality in the Claude 4 family.",
        contextWindow: 200000,
        outputTokens: 16000,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "claude-haiku-3-5",
        displayName: "Claude Haiku 3.5",
        description: "Fastest Claude model. Ideal for bulk processing and simple tasks.",
        contextWindow: 200000,
        outputTokens: 8192,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "claude-sonnet-3-7",
        displayName: "Claude Sonnet 3.7",
        description: "Extended thinking model with hybrid reasoning capabilities.",
        contextWindow: 200000,
        outputTokens: 64000,
        tier: "flagship",
        speed: "powerful",
      },
    ],
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  {
    id: "meta",
    displayName: "Meta AI",
    shortName: "Meta",
    logoColor: "#0866FF",
    models: [
      {
        id: "llama-4-maverick",
        displayName: "Llama 4 Maverick",
        description: "Meta's flagship multimodal model with 128 experts MoE architecture.",
        contextWindow: 1000000,
        outputTokens: 16384,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "llama-4-scout",
        displayName: "Llama 4 Scout",
        description: "Efficient Llama 4 variant. 10M context window, fast inference.",
        contextWindow: 10000000,
        outputTokens: 16384,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "llama-3-3-70b",
        displayName: "Llama 3.3 70B",
        description: "Proven open-weight model. Strong reasoning and instruction following.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "balanced",
      },
    ],
  },

  // ── Mistral ───────────────────────────────────────────────────────────────
  {
    id: "mistral",
    displayName: "Mistral AI",
    shortName: "Mistral",
    logoColor: "#FF7000",
    models: [
      {
        id: "mistral-large-2",
        displayName: "Mistral Large 2",
        description: "Flagship Mistral model. Strong multilingual and coding capabilities.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "mistral-small-3",
        displayName: "Mistral Small 3",
        description: "Efficient and fast. Best cost-performance for structured tasks.",
        contextWindow: 32000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "codestral-2501",
        displayName: "Codestral 2501",
        description: "Specialized for code generation and analysis.",
        contextWindow: 256000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "balanced",
      },
    ],
  },

  // ── Cohere ────────────────────────────────────────────────────────────────
  {
    id: "cohere",
    displayName: "Cohere",
    shortName: "Cohere",
    logoColor: "#39594D",
    models: [
      {
        id: "command-r-plus",
        displayName: "Command R+",
        description: "Flagship RAG-optimized model. Best for retrieval-augmented generation.",
        contextWindow: 128000,
        outputTokens: 4096,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "command-r",
        displayName: "Command R",
        description: "Efficient RAG model. Good balance of speed and retrieval quality.",
        contextWindow: 128000,
        outputTokens: 4096,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "command-a",
        displayName: "Command A",
        description: "Latest Cohere model with agentic capabilities.",
        contextWindow: 256000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "powerful",
      },
    ],
  },

  // ── xAI ───────────────────────────────────────────────────────────────────
  {
    id: "xai",
    displayName: "xAI",
    shortName: "xAI",
    logoColor: "#1DA1F2",
    models: [
      {
        id: "grok-3",
        displayName: "Grok 3",
        description: "xAI's flagship model. Strong reasoning with real-time knowledge.",
        contextWindow: 131072,
        outputTokens: 16384,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "grok-3-mini",
        displayName: "Grok 3 Mini",
        description: "Efficient Grok 3 variant. Fast inference for structured tasks.",
        contextWindow: 131072,
        outputTokens: 16384,
        tier: "balanced",
        speed: "fast",
      },
    ],
  },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  {
    id: "deepseek",
    displayName: "DeepSeek",
    shortName: "DeepSeek",
    logoColor: "#4D6BFE",
    models: [
      {
        id: "deepseek-v3",
        displayName: "DeepSeek V3",
        description: "Flagship MoE model. Exceptional coding and reasoning at low cost.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "deepseek-r1",
        displayName: "DeepSeek R1",
        description: "Reasoning-focused model with chain-of-thought capabilities.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "powerful",
      },
    ],
  },

  // ── Amazon ────────────────────────────────────────────────────────────────
  {
    id: "amazon",
    displayName: "Amazon Web Services",
    shortName: "Amazon",
    logoColor: "#FF9900",
    models: [
      {
        id: "amazon.nova-pro-v1:0",
        displayName: "Nova Pro",
        description: "Amazon's flagship multimodal model. Best accuracy in the Nova family.",
        contextWindow: 300000,
        outputTokens: 5120,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "amazon.nova-lite-v1:0",
        displayName: "Nova Lite",
        description: "Fast and cost-effective multimodal model.",
        contextWindow: 300000,
        outputTokens: 5120,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "amazon.nova-micro-v1:0",
        displayName: "Nova Micro",
        description: "Text-only, lowest latency and cost in the Nova family.",
        contextWindow: 128000,
        outputTokens: 5120,
        tier: "lite",
        speed: "fast",
      },
    ],
  },

  // ── Microsoft ─────────────────────────────────────────────────────────────
  {
    id: "microsoft",
    displayName: "Microsoft",
    shortName: "Microsoft",
    logoColor: "#00A4EF",
    models: [
      {
        id: "phi-4",
        displayName: "Phi-4",
        description: "Small but powerful reasoning model. Excellent for structured tasks.",
        contextWindow: 16384,
        outputTokens: 4096,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "phi-4-mini",
        displayName: "Phi-4 Mini",
        description: "Ultra-compact reasoning model. Best for edge and low-latency scenarios.",
        contextWindow: 128000,
        outputTokens: 4096,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "phi-4-multimodal",
        displayName: "Phi-4 Multimodal",
        description: "Phi-4 with vision and audio capabilities.",
        contextWindow: 128000,
        outputTokens: 4096,
        tier: "balanced",
        speed: "fast",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Recommendation Engine
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
    tierScore: (tier) => ({ flagship: 4, balanced: 8, fast: 6, lite: 2 }[tier] ?? 0),
    speedScore: (speed) => ({ fast: 7, balanced: 10, powerful: 6 }[speed] ?? 0),
    vendorBonus: (v) => ({ google: 5, openai: 3, anthropic: 3, meta: 2, mistral: 1 }[v] ?? 0),
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-flash": 15,   // ★ Recommended for LLM 1
        "gemini-2.5-pro": 10,
        "gemini-3-flash-preview": 8,
        "gpt-4o": 8,
        "llama-4-scout": 7,
        "claude-sonnet-4": 6,
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
    tierScore: (tier) => ({ flagship: 10, balanced: 7, fast: 4, lite: 1 }[tier] ?? 0),
    speedScore: (speed) => ({ fast: 3, balanced: 7, powerful: 10 }[speed] ?? 0),
    vendorBonus: (v) => ({ anthropic: 5, google: 5, openai: 3, meta: 1 }[v] ?? 0),
    modelBonus: (id) => {
      const bonuses: Record<string, number> = {
        "gemini-2.5-pro": 20,     // ★ Recommended for LLM 2
        "claude-opus-4": 18,
        "claude-sonnet-4": 15,
        "gemini-3.1-pro-preview": 14,
        "gpt-4o": 12,
        "o3": 10,
      };
      return bonuses[id] ?? 0;
    },
  },
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

const RECOMMENDATION_REASONS: Record<UseCase, string> = {
  research:
    "Best for LLM 1 research pass — fast, large context, strong factual recall for bulk author/book enrichment.",
  refinement:
    "Best for LLM 2 refinement pass — highest prose quality for polishing bios and summaries.",
};

/**
 * Run the recommendation engine over the full catalogue.
 * Tags the top-scoring model per use case with `recommended` and `recommendedReason`.
 * Returns a deep copy of the catalogue with recommendations applied.
 */
export function applyRecommendations(catalogue: LLMVendor[]): LLMVendor[] {
  const cloned: LLMVendor[] = catalogue.map((v) => ({
    ...v,
    models: v.models.map((m) => ({ ...m, recommended: undefined, recommendedReason: undefined })),
  }));

  const useCases: UseCase[] = ["research", "refinement"];

  for (const useCase of useCases) {
    let topScore = -Infinity;
    let topVendorIdx = -1;
    let topModelIdx = -1;

    for (let vi = 0; vi < cloned.length; vi++) {
      const vendor = cloned[vi];
      for (let mi = 0; mi < vendor.models.length; mi++) {
        const score = scoreModel(vendor.id, vendor.models[mi], useCase);
        if (score > topScore) {
          topScore = score;
          topVendorIdx = vi;
          topModelIdx = mi;
        }
      }
    }

    if (topVendorIdx >= 0 && topModelIdx >= 0) {
      cloned[topVendorIdx].models[topModelIdx].recommended = useCase;
      cloned[topVendorIdx].models[topModelIdx].recommendedReason =
        RECOMMENDATION_REASONS[useCase];
    }
  }

  return cloned;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a vendor by ID (case-insensitive) */
export function findVendor(vendorId: string): LLMVendor | undefined {
  return VENDOR_CATALOGUE.find((v) => v.id === vendorId.toLowerCase());
}

/** Find a model within a vendor */
export function findModel(vendorId: string, modelId: string): LLMModel | undefined {
  return findVendor(vendorId)?.models.find((m) => m.id === modelId);
}

/**
 * Get the recommended model ID for a given use case.
 */
export function getRecommendedModel(useCase: UseCase): { vendorId: string; modelId: string } | null {
  for (const vendor of VENDOR_CATALOGUE) {
    for (const model of vendor.models) {
      if (model.recommended === useCase) {
        return { vendorId: vendor.id, modelId: model.id };
      }
    }
  }
  return null;
}

/** Exported catalogue with recommendations pre-applied */
export const VENDOR_CATALOGUE: LLMVendor[] = applyRecommendations(VENDOR_CATALOGUE_RAW);

/** Seeded defaults — derived from the recommendation engine */
export const DEFAULT_PRIMARY_VENDOR = "google";
export const DEFAULT_PRIMARY_MODEL = "gemini-2.5-flash";  // LLM 1: research
export const DEFAULT_SECONDARY_VENDOR = "google";
export const DEFAULT_SECONDARY_MODEL = "gemini-2.5-pro";  // LLM 2: refinement

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const llmRouter = router({
  /** Return the full vendor catalogue with current recommendations applied */
  listVendors: publicProcedure.query(() => {
    return VENDOR_CATALOGUE;
  }),

  /**
   * Return models for a specific vendor.
   * Falls back to all Google models if vendorId is not found.
   */
  listModels: publicProcedure
    .input(z.object({ vendorId: z.string().optional() }))
    .query(({ input }) => {
      const vendor = input.vendorId ? findVendor(input.vendorId) : findVendor("google");
      return vendor?.models ?? findVendor("google")!.models;
    }),

  /**
   * Refresh the vendor catalogue.
   * Re-runs the recommendation engine so recommendations stay current.
   */
  refreshVendors: publicProcedure.mutation(() => {
    const refreshed = applyRecommendations(VENDOR_CATALOGUE_RAW);
    return {
      vendors: refreshed,
      refreshedAt: new Date(),
      recommendations: {
        research: getRecommendedModel("research"),
        refinement: getRecommendedModel("refinement"),
      },
    };
  }),

  /**
   * Get current recommendations for all use cases.
   * Used by the UI to highlight the recommended model in each selector.
   */
  getRecommendations: publicProcedure.query(() => {
    return {
      research: getRecommendedModel("research"),
      refinement: getRecommendedModel("refinement"),
      updatedAt: new Date(),
    };
  }),

  /** Test a model with a lightweight ping — returns latency in ms */
  testModel: publicProcedure
    .input(z.object({ modelId: z.string(), vendorId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const result = await invokeLLM({
          model: input.modelId,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
        });
        const latencyMs = Date.now() - start;
        const content = result.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : JSON.stringify(content);
        return { success: true, latencyMs, response: text.trim().slice(0, 100) };
      } catch (err) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
});
