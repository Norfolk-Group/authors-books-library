/**
 * llmCatalogue.ts — Public API barrel for the LLM catalogue system
 *
 * Architecture:
 *  - llmTypes.ts       → Shared types (LLMModel, LLMVendor, UseCase)
 *  - llmVendorData.ts  → Static vendor + model registry (VENDOR_CATALOGUE_RAW)
 *  - llmScoring.ts     → Task-based recommendation engine (applyRecommendations)
 *  - llmCatalogue.ts   → This file: final catalogue + helper functions (barrel)
 *
 * All downstream consumers import from this file only.
 */

// Re-export types
export type { LLMModel, LLMVendor, UseCase } from "./llmTypes";
export { USE_CASES } from "./llmTypes";

// Re-export raw data
export { VENDOR_CATALOGUE_RAW } from "./llmVendorData";

// Re-export scoring engine
export { applyRecommendations, RECOMMENDATION_REASONS } from "./llmScoring";

import { VENDOR_CATALOGUE_RAW } from "./llmVendorData";
import { applyRecommendations, RECOMMENDATION_REASONS } from "./llmScoring";
import type { LLMVendor, UseCase } from "./llmTypes";

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
) {
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
