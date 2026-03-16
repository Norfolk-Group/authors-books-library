/**
 * LLM Router — model discovery and preference management.
 * Exposes the list of available Gemini text-generation models
 * and allows callers to test a model with a lightweight ping.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

// ── Static model catalogue (sourced from Google AI API, March 2026) ───────────
// Filtered to text-generation models only (generateContent, ≥32K context).
// Grouped by tier for display in the UI.

export interface GeminiModel {
  id: string;
  displayName: string;
  description: string;
  inputTokens: number;
  outputTokens: number;
  tier: "stable" | "preview" | "latest";
  speed: "fast" | "balanced" | "powerful";
}

export const GEMINI_MODELS: GeminiModel[] = [
  // ── Gemini 3.x Preview ──────────────────────────────────────────────────────
  {
    id: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro Preview",
    description: "Latest Gemini 3.1 Pro — most capable, best for complex reasoning and long-form writing.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "preview",
    speed: "powerful",
  },
  {
    id: "gemini-3-pro-preview",
    displayName: "Gemini 3 Pro Preview",
    description: "Gemini 3 Pro — high-capability model for demanding tasks.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "preview",
    speed: "powerful",
  },
  {
    id: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    description: "Gemini 3 Flash — fast and capable, great balance of speed and quality.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "preview",
    speed: "fast",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    displayName: "Gemini 3.1 Flash Lite Preview",
    description: "Gemini 3.1 Flash Lite — ultra-fast, ideal for high-volume enrichment tasks.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "preview",
    speed: "fast",
  },
  // ── Gemini 2.5 Stable ───────────────────────────────────────────────────────
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    description: "Stable Gemini 2.5 Pro — best reasoning and writing quality in the 2.5 family.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "stable",
    speed: "powerful",
  },
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "Stable Gemini 2.5 Flash — recommended default. Fast, accurate, 1M context.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "stable",
    speed: "balanced",
  },
  {
    id: "gemini-2.5-flash-lite",
    displayName: "Gemini 2.5 Flash-Lite",
    description: "Stable Gemini 2.5 Flash-Lite — lightest model, best for bulk tasks with tight latency.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "stable",
    speed: "fast",
  },
  // ── Gemini 2.0 Stable ───────────────────────────────────────────────────────
  {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    description: "Stable Gemini 2.0 Flash — reliable and fast, proven in production.",
    inputTokens: 1048576,
    outputTokens: 8192,
    tier: "stable",
    speed: "fast",
  },
  {
    id: "gemini-2.0-flash-lite",
    displayName: "Gemini 2.0 Flash-Lite",
    description: "Stable Gemini 2.0 Flash-Lite — smallest and fastest, minimal cost.",
    inputTokens: 1048576,
    outputTokens: 8192,
    tier: "stable",
    speed: "fast",
  },
  // ── Latest aliases ──────────────────────────────────────────────────────────
  {
    id: "gemini-flash-latest",
    displayName: "Gemini Flash (Latest)",
    description: "Always points to the latest stable Flash release. Good for staying current automatically.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "latest",
    speed: "balanced",
  },
  {
    id: "gemini-pro-latest",
    displayName: "Gemini Pro (Latest)",
    description: "Always points to the latest stable Pro release.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "latest",
    speed: "powerful",
  },
  {
    id: "gemini-flash-lite-latest",
    displayName: "Gemini Flash-Lite (Latest)",
    description: "Always points to the latest stable Flash-Lite release.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "latest",
    speed: "fast",
  },
  // ── 2.5 Flash-Lite Preview ──────────────────────────────────────────────────
  {
    id: "gemini-2.5-flash-lite-preview-09-2025",
    displayName: "Gemini 2.5 Flash-Lite Preview (Sep 2025)",
    description: "Preview release of Gemini 2.5 Flash-Lite from September 2025.",
    inputTokens: 1048576,
    outputTokens: 65536,
    tier: "preview",
    speed: "fast",
  },
];

// ── Router ────────────────────────────────────────────────────────────────────

export const llmRouter = router({
  /** Return the full list of available Gemini text-generation models */
  listModels: publicProcedure.query(() => {
    return GEMINI_MODELS;
  }),

  /** Test a model with a lightweight ping — returns latency in ms */
  testModel: publicProcedure
    .input(z.object({ modelId: z.string() }))
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const result = await invokeLLM({
          model: input.modelId,
          messages: [
            { role: "user", content: "Reply with exactly: OK" },
          ],
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
