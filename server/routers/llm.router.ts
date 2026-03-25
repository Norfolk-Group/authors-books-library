/**
 * LLM Router — vendor/model catalogue with task-based recommendation engine.
 *
 * Architecture:
 *  - VENDOR_CATALOGUE_RAW: static registry of all major LLM providers + models.
 *  - applyRecommendations(): scores each model per use-case and tags the top
 *    pick as `recommended`. Re-runs on every `refreshVendors` call.
 *  - Task-based use cases:
 *      "research"        → LLM 1 pass: factual extraction, synthesis, world knowledge
 *      "refinement"      → LLM 2 pass: prose quality, tone, editing
 *      "structured"      → JSON schema output, structured data extraction
 *      "avatar_research" → Deep visual description for avatar generation pipeline
 *      "code"            → Code generation and analysis
 *      "bulk"            → High-volume, cost-sensitive batch processing
 *
 * Seeded defaults (March 2026):
 *   LLM 1 (research):   Google → Gemini 2.5 Flash  (fast, 1M ctx, strong factual)
 *   LLM 2 (refinement): Google → Gemini 2.5 Pro    (best prose quality in family)
 */
import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
        description: "Best reasoning and writing quality in the 2.5 family.",
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
      {
        id: "nano-banana",
        displayName: "Nano Banana (Image Gen)",
        description: "Google Nano Banana — state-of-the-art image generation model for AI avatars.",
        contextWindow: 0,
        outputTokens: 0,
        tier: "image-gen",
        speed: "balanced",
        imageGen: true,
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
        id: "claude-opus-4-5-20251101",
        displayName: "Claude Opus 4.5",
        description: "Most capable Claude model. Best for nuanced writing and deep research.",
        contextWindow: 200000,
        outputTokens: 32000,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet 4.5",
        description: "Best balance of speed and quality in the Claude 4 family.",
        contextWindow: 200000,
        outputTokens: 16000,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "claude-haiku-4-5-20251001",
        displayName: "Claude Haiku 4.5",
        description: "Fastest Claude model. Ideal for bulk processing and simple tasks.",
        contextWindow: 200000,
        outputTokens: 8192,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "claude-opus-4-20250514",
        displayName: "Claude Opus 4",
        description: "High-performance flagship model with excellent reasoning capabilities.",
        contextWindow: 200000,
        outputTokens: 32000,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "claude-sonnet-4-20250514",
        displayName: "Claude Sonnet 4",
        description: "Balanced model with strong reasoning and coding capabilities.",
        contextWindow: 200000,
        outputTokens: 16000,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "claude-3-5-haiku-20241022",
        displayName: "Claude 3.5 Haiku",
        description: "Lightweight fast model. Good for simple tasks and bulk processing.",
        contextWindow: 200000,
        outputTokens: 8192,
        tier: "lite",
        speed: "fast",
      },
    ],
  },

  // ── xAI (Grok) ───────────────────────────────────────────────────────────
  {
    id: "xai",
    displayName: "xAI",
    shortName: "Grok",
    logoColor: "#000000",
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
      {
        id: "grok-3-mini-fast",
        displayName: "Grok 3 Mini Fast",
        description: "Fastest Grok variant. Optimized for low-latency bulk operations.",
        contextWindow: 131072,
        outputTokens: 16384,
        tier: "lite",
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
      {
        id: "deepseek-v3-0324",
        displayName: "DeepSeek V3 (March 2024)",
        description: "Updated V3 with improved instruction following and coding.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "balanced",
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

  // ── Perplexity ────────────────────────────────────────────────────────────
  {
    id: "perplexity",
    displayName: "Perplexity AI",
    shortName: "Perplexity",
    logoColor: "#20808D",
    models: [
      {
        id: "sonar-pro",
        displayName: "Sonar Pro",
        description: "Web-grounded reasoning model. Best for research with live citations.",
        contextWindow: 200000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "balanced",
      },
      {
        id: "sonar",
        displayName: "Sonar",
        description: "Fast web-grounded model. Good for quick fact-checking.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "fast",
      },
      {
        id: "sonar-reasoning-pro",
        displayName: "Sonar Reasoning Pro",
        description: "Deep reasoning with web grounding. Best for complex research questions.",
        contextWindow: 200000,
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

  // ── Alibaba (Qwen) ───────────────────────────────────────────────────────
  {
    id: "alibaba",
    displayName: "Alibaba Cloud (Qwen)",
    shortName: "Qwen",
    logoColor: "#FF6A00",
    models: [
      {
        id: "qwen-max",
        displayName: "Qwen Max",
        description: "Alibaba's flagship model. Strong multilingual and reasoning capabilities.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "flagship",
        speed: "powerful",
      },
      {
        id: "qwen-plus",
        displayName: "Qwen Plus",
        description: "Balanced Qwen model. Good cost-performance for general tasks.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "balanced",
      },
      {
        id: "qwen-turbo",
        displayName: "Qwen Turbo",
        description: "Fast Qwen variant. Optimized for high-throughput batch processing.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "lite",
        speed: "fast",
      },
      {
        id: "qwen-coder-plus",
        displayName: "Qwen Coder Plus",
        description: "Specialized for code generation. Strong at structured output.",
        contextWindow: 128000,
        outputTokens: 8192,
        tier: "balanced",
        speed: "balanced",
      },
    ],
  },

  // ── AI21 Labs ─────────────────────────────────────────────────────────────
  {
    id: "ai21",
    displayName: "AI21 Labs",
    shortName: "AI21",
    logoColor: "#6C47FF",
    models: [
      {
        id: "jamba-1.5-large",
        displayName: "Jamba 1.5 Large",
        description: "SSM-Transformer hybrid. 256K context with efficient long-document processing.",
        contextWindow: 256000,
        outputTokens: 4096,
        tier: "flagship",
        speed: "balanced",
      },
      {
        id: "jamba-1.5-mini",
        displayName: "Jamba 1.5 Mini",
        description: "Compact Jamba model. Fast inference for structured tasks.",
        contextWindow: 256000,
        outputTokens: 4096,
        tier: "balanced",
        speed: "fast",
      },
    ],
  },
];

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

const RECOMMENDATION_REASONS: Record<UseCase, string> = {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Exported catalogue with recommendations pre-applied */
export const VENDOR_CATALOGUE: LLMVendor[] = applyRecommendations(
  VENDOR_CATALOGUE_RAW
);

/** Find a vendor by ID (case-insensitive) */
export function findVendor(vendorId: string): LLMVendor | undefined {
  return VENDOR_CATALOGUE.find((v) => v.id === vendorId.toLowerCase());
}

/** Find a model within a vendor */
export function findModel(
  vendorId: string,
  modelId: string
): LLMModel | undefined {
  return findVendor(vendorId)?.models.find((m) => m.id === modelId);
}

/**
 * Get the recommended model ID for a given use case.
 */
export function getRecommendedModel(
  useCase: UseCase
): { vendorId: string; modelId: string; modelName: string; reason: string } | null {
  for (const vendor of VENDOR_CATALOGUE) {
    for (const model of vendor.models) {
      if (model.recommended?.includes(useCase)) {
        return {
          vendorId: vendor.id,
          modelId: model.id,
          modelName: model.displayName,
          reason: model.recommendedReasons?.[useCase] ?? RECOMMENDATION_REASONS[useCase],
        };
      }
    }
  }
  return null;
}

/** Seeded defaults — derived from the recommendation engine */
export const DEFAULT_PRIMARY_VENDOR = "google";
export const DEFAULT_PRIMARY_MODEL = "gemini-2.5-flash"; // LLM 1: research
export const DEFAULT_SECONDARY_VENDOR = "google";
export const DEFAULT_SECONDARY_MODEL = "gemini-2.5-pro"; // LLM 2: refinement

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
      const vendor = input.vendorId
        ? findVendor(input.vendorId)
        : findVendor("google");
      return vendor?.models ?? findVendor("google")!.models;
    }),

  /**
   * Refresh the vendor catalogue.
   * Re-runs the recommendation engine so recommendations stay current.
   */
  refreshVendors: adminProcedure.mutation(() => {
    const refreshed = applyRecommendations(VENDOR_CATALOGUE_RAW);
    const allRecs: Record<string, ReturnType<typeof getRecommendedModel>> = {};
    for (const uc of USE_CASES) {
      allRecs[uc] = getRecommendedModel(uc);
    }
    return {
      vendors: refreshed,
      refreshedAt: new Date(),
      vendorCount: refreshed.length,
      modelCount: refreshed.reduce((s, v) => s + v.models.length, 0),
      recommendations: allRecs,
    };
  }),

  /**
   * Get current recommendations for all use cases.
   * Used by the UI to highlight the recommended model in each selector.
   */
  getRecommendations: publicProcedure.query(() => {
    const recs: Record<string, ReturnType<typeof getRecommendedModel>> = {};
    for (const uc of USE_CASES) {
      recs[uc] = getRecommendedModel(uc);
    }
    return {
      recommendations: recs,
      useCases: USE_CASES,
      updatedAt: new Date(),
    };
  }),

  /**
   * Get the recommended model for a specific task/use case.
   * Returns vendor + model + reason. UI can use this for the "Auto-Recommend" button.
   */
  recommendForTask: publicProcedure
    .input(z.object({ useCase: z.enum(USE_CASES) }))
    .query(({ input }) => {
      return getRecommendedModel(input.useCase);
    }),

  /** Test a model with a lightweight ping — returns latency in ms */
  testModel: adminProcedure
    .input(
      z.object({ modelId: z.string(), vendorId: z.string().optional() })
    )
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const result = await invokeLLM({
          model: input.modelId,
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
        });
        const latencyMs = Date.now() - start;
        const content = result.choices[0]?.message?.content;
        const text =
          typeof content === "string" ? content : JSON.stringify(content);
        return {
          success: true,
          latencyMs,
          response: text.trim().slice(0, 100),
        };
      } catch (err) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
});
