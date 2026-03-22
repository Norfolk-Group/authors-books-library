/**
 * persistAvatarResult — shared DB persistence helper for avatar generation results.
 *
 * Extracted from three duplicate inline DB-write blocks in authorProfiles.router.ts
 * (generateAvatarsBatch, generateAllMissingAvatars, generateAvatar) per Claude Opus
 * architecture review (March 22, 2026).
 *
 * Usage:
 *   import { persistAvatarResult } from "../lib/authorAvatars/persistResult";
 *   await persistAvatarResult(db, authorName, result, { vendor, model, researchVendor, researchModel });
 */

import { eq } from "drizzle-orm";
import { authorProfiles } from "../../../drizzle/schema";
import type { AuthorAvatarWaterfallResult } from "./waterfall.js";

type AvatarSourceEnum = "wikipedia" | "tavily" | "apify" | "google-imagen" | "ai";

function mapSource(source: AuthorAvatarWaterfallResult["source"]): AvatarSourceEnum | undefined {
  switch (source) {
    case "wikipedia": return "wikipedia";
    case "tavily": return "tavily";
    case "apify": return "apify";
    case "ai-generated": return "google-imagen";
    default: return undefined;
  }
}

export interface PersistAvatarOptions {
  vendor?: string;
  model?: string;
  researchVendor?: string;
  researchModel?: string;
}

/**
 * Persist a completed waterfall result to the authorProfiles table.
 * No-ops if both avatarUrl and s3AvatarUrl are null/empty.
 */
export async function persistAvatarResult(
  // Accept any drizzle db instance — use unknown to avoid circular import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  authorName: string,
  result: AuthorAvatarWaterfallResult,
  options: PersistAvatarOptions = {}
): Promise<void> {
  if (!result.avatarUrl && !result.s3AvatarUrl) return;

  const avatarSourceVal = mapSource(result.source);
  const pipelineMeta = result.__pipelineResult;

  await db
    .update(authorProfiles)
    .set({
      avatarUrl: result.s3AvatarUrl ?? result.avatarUrl,
      s3AvatarUrl: result.s3AvatarUrl,
      enrichedAt: new Date(),
      ...(avatarSourceVal ? { avatarSource: avatarSourceVal } : {}),
      ...(result.isAiGenerated !== undefined ? { isAiGenerated: result.isAiGenerated ? 1 : 0 } : {}),
      avatarGenVendor: options.vendor ?? "google",
      avatarGenModel: options.model ?? "nano-banana",
      avatarResearchVendor: options.researchVendor ?? "google",
      avatarResearchModel: options.researchModel ?? "gemini-2.5-flash",
      ...(pipelineMeta?.authorDescription ? {
        authorDescriptionJson: JSON.stringify(pipelineMeta.authorDescription),
        authorDescriptionCachedAt: new Date(),
      } : {}),
      ...(pipelineMeta?.imagePrompt ? {
        lastAvatarPrompt: pipelineMeta.imagePrompt,
        lastAvatarPromptBuiltAt: new Date(),
      } : {}),
      ...(pipelineMeta?.driveFileId ? { driveAvatarFileId: pipelineMeta.driveFileId } : {}),
      // pipelineMeta.vendor/model override the input options (more specific)
      ...(pipelineMeta?.vendor ? { avatarGenVendor: pipelineMeta.vendor } : {}),
      ...(pipelineMeta?.model ? { avatarGenModel: pipelineMeta.model } : {}),
      // Persist the best reference photo URL used during research for transparency/auditing
      ...(pipelineMeta?.authorDescription?.bestReferencePhotoUrl
        ? { bestReferencePhotoUrl: pipelineMeta.authorDescription.bestReferencePhotoUrl }
        : {}),
    })
    .where(eq(authorProfiles.authorName, authorName));
}
