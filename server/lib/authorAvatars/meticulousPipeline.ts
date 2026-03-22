/**
 * Meticulous Avatar Pipeline — Stage Orchestrator
 *
 * Full pipeline for generating a research-grounded, highly specific author avatar:
 *
 *   Stage 1: Research (Wikipedia + Tavily + Apify in parallel)
 *   Stage 2: Gemini Vision Analysis → AuthorDescription JSON
 *   Stage 3: Prompt Builder → ImagePromptPackage (vendor-specific)
 *   Stage 4: Graphics LLM (vendor-switchable: Google Imagen, Replicate, etc.)
 *   Stage 5: Storage (S3 + Google Drive)
 *
 * The pipeline is designed to be:
 *   - Resumable: each stage result is cached in DB
 *   - Configurable: vendor/model can be changed by the user at any time
 *   - Auditable: all intermediate results are stored
 *   - Resilient: each stage has its own error handling and fallback
 */

import {
  AuthorDescription,
  MeticulousPipelineOptions,
  MeticulousPipelineResult,
} from "./types.js";
import { researchAndDescribeAuthor } from "./authorResearcher.js";
import { buildMeticulousPrompt, buildGenericFallbackPrompt } from "./promptBuilder.js";
import {
  createImageGenerator,
  resultToBuffer,
} from "./imageGenerators/index.js";
import { storagePut } from "../../storage.js";
import { ENV } from "../../_core/env.js";

// ── Google Drive upload helper ─────────────────────────────────────────────────

async function uploadToGoogleDrive(
  buffer: Buffer,
  mimeType: string,
  authorName: string
): Promise<string | null> {
  // Drive upload is best-effort — failure doesn't block the pipeline
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const { writeFile, unlink, mkdir } = await import("fs/promises");
    const { join } = await import("path");

    const execAsync = promisify(exec);
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const sanitized = authorName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const filename = `${sanitized}.${ext}`;

    // gws CLI requires the file to be within the current working directory (not /tmp).
    // Write to .avatar-uploads/ inside the project root, then pass a relative path
    // to gws so it resolves within its own CWD (which we also set to projectRoot).
    const projectRoot = process.cwd();
    const uploadDir = join(projectRoot, ".avatar-uploads");
    await mkdir(uploadDir, { recursive: true });
    const relFilename = `avatar-${Date.now()}-${filename}`;
    const tmpPath = join(uploadDir, relFilename);
    const relPath = `.avatar-uploads/${relFilename}`;

    // Write buffer to local file
    await writeFile(tmpPath, buffer);

    // Upload to Google Drive "Author Pictures" folder using gws CLI.
    // Pass cwd: projectRoot so gws resolves the relative path correctly.
    const DRIVE_FOLDER_ID = ENV.driveAvatarsFolderId;
    const { stdout } = await execAsync(
      `gws drive files create --params '{"name":"${sanitized}","parents":["${DRIVE_FOLDER_ID}"]}' --upload '${relPath}' --upload-content-type 'image/png'`,
      { cwd: projectRoot }
    );

    // Clean up temp file
    await unlink(tmpPath).catch(() => {});

    // Parse file ID from response
    try {
      const parsed = JSON.parse(stdout);
      return parsed.id ?? null;
    } catch {
      return null;
    }
  } catch (err) {
    console.warn(`[meticulousPipeline] Drive upload failed for ${authorName}:`, err);
    return null;
  }
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

/**
 * Run the full meticulous avatar generation pipeline for a single author.
 *
 * @param authorName  Clean display name of the author
 * @param options     Pipeline configuration (vendor, model, bgColor, cache settings)
 * @param cachedDescription  Pre-loaded AuthorDescription from DB (skip research stage)
 */
export async function runMeticulousPipeline(
  authorName: string,
  options: MeticulousPipelineOptions = {},
  cachedDescription?: AuthorDescription | null
): Promise<MeticulousPipelineResult> {
  const startTime = Date.now();
  const stages: MeticulousPipelineResult["stages"] = {
    research: "skipped",
    promptBuild: "skipped",
    imageGen: "failed",
    s3Upload: "skipped",
    driveUpload: "skipped",
  };

  const vendor = options.vendor ?? "google";
  const model = options.model ?? "gemini-2.5-flash-image";
  const researchVendor = options.researchVendor ?? "google";
  const researchModel = options.researchModel ?? "gemini-2.5-flash";

  let authorDescription: AuthorDescription | null = null;

  // ── Stage 1 & 2: Research + LLM Analysis ──────────────────────────────────
  if (options.promptOnly) {
    // Skip research entirely — use cached prompt directly
    stages.research = "skipped";
    stages.promptBuild = "skipped";
    console.log(`[meticulousPipeline] Prompt-only mode for ${authorName}`);
  } else if (cachedDescription && !options.forceRefresh) {
    // Use cached description from DB
    authorDescription = cachedDescription;
    stages.research = "cached";
    stages.promptBuild = "cached";
    console.log(`[meticulousPipeline] Using cached description for ${authorName}`);
  } else {
    // Run full research pipeline
    console.log(`[meticulousPipeline] Running research for ${authorName}`);
    try {
      authorDescription = await researchAndDescribeAuthor(authorName, researchModel, researchVendor);
      stages.research = authorDescription ? "executed" : "failed";
      stages.promptBuild = authorDescription ? "executed" : "failed";
    } catch (err) {
      console.error(`[meticulousPipeline] Research failed for ${authorName}:`, err);
      stages.research = "failed";
      stages.promptBuild = "failed";
    }
  }

  // ── Stage 3: Prompt Building (with reference photo fetch) ────────────────────
  // Fetch the best reference photo as base64 for reference-guided generation.
  // This is done here (not in the generator) so we can log the outcome and
  // gracefully fall back to text-only generation if the fetch fails.
  let referenceImageBase64: string | undefined;
  let referenceImageMimeType: string | undefined;

  if (authorDescription?.bestReferencePhotoUrl) {
    try {
      const refUrl = authorDescription.bestReferencePhotoUrl;
      console.log(`[meticulousPipeline] Fetching reference photo for ${authorName}: ${refUrl}`);
      const res = await fetch(refUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "NCGLibrary/1.0 (ncglibrary@norfolkgroup.io)" },
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.startsWith("image/")) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const sizeKb = Math.round(buffer.length / 1024);
          // Quality gate: reject photos that are too small (likely icons/thumbnails)
          // or too large (exceeds Gemini inline limit)
          if (buffer.length < 10 * 1024) {
            console.warn(`[meticulousPipeline] Reference photo too small for ${authorName} (${sizeKb}KB < 10KB) — likely a thumbnail, using text-only`);
          } else if (buffer.length > 3 * 1024 * 1024) {
            console.warn(`[meticulousPipeline] Reference photo too large for ${authorName} (${sizeKb}KB > 3072KB) — using text-only`);
          } else {
            referenceImageBase64 = buffer.toString("base64");
            referenceImageMimeType = contentType.split(";")[0].trim();
            console.log(
              `[meticulousPipeline] Reference photo fetched for ${authorName} ` +
              `(${sizeKb}KB, ${referenceImageMimeType}) — quality gate passed`
            );
          }
        }
      } else {
        console.warn(`[meticulousPipeline] Reference photo fetch failed for ${authorName}: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[meticulousPipeline] Reference photo fetch error for ${authorName}:`, err);
    }
  } else if (authorDescription) {
    // Fall back to first available photo from references
    const fallbackUrl = authorDescription.references?.photoUrls?.[0];
    if (fallbackUrl) {
      try {
        console.log(`[meticulousPipeline] No bestReferencePhotoUrl — trying first reference photo for ${authorName}`);
        const res = await fetch(fallbackUrl, {
          signal: AbortSignal.timeout(10_000),
          headers: { "User-Agent": "NCGLibrary/1.0 (ncglibrary@norfolkgroup.io)" },
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.startsWith("image/")) {
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length <= 3 * 1024 * 1024) {
              referenceImageBase64 = buffer.toString("base64");
              referenceImageMimeType = contentType.split(";")[0].trim();
              console.log(`[meticulousPipeline] Fallback reference photo fetched for ${authorName}`);
            }
          }
        }
      } catch {
        // Silently skip — text-only generation will be used
      }
    }
  }

  let promptPackage;
  if (authorDescription) {
    promptPackage = buildMeticulousPrompt(authorDescription, {
      bgColor: options.bgColor,
      vendor,
      model,
      referenceImageBase64,
      referenceImageMimeType,
    });
    stages.promptBuild = "executed";
  } else {
    // Fallback to generic prompt
    promptPackage = buildGenericFallbackPrompt(authorName, options.bgColor, vendor);
    console.warn(
      `[meticulousPipeline] Using generic fallback prompt for ${authorName} (no description available)`
    );
    stages.promptBuild = "executed";
  }

  console.log(
    `[meticulousPipeline] Prompt built for ${authorName} ` +
    `(${promptPackage.prompt.length} chars, reference: ${referenceImageBase64 ? "yes" : "no"})`
  );

  // ── Stage 4: Image Generation ──────────────────────────────────────────────
  const generator = createImageGenerator({ vendor: vendor as "google" | "replicate" | "openai" | "stability", model });

  if (!generator.isAvailable()) {
    return {
      success: false,
      avatarSource: "ai",
      durationMs: Date.now() - startTime,
      error: `Vendor "${vendor}" is not available (API key not configured)`,
      stages,
    };
  }

  const imageResult = await generator.generate({
    prompt: promptPackage.prompt,
    negativePrompt: promptPackage.negativePrompt,
    aspectRatio: "1:1",
    guidanceScale: 7.5,
    referenceImageBase64: promptPackage.referenceImageBase64,
    referenceImageMimeType: promptPackage.referenceImageMimeType,
  });

  if (imageResult.error) {
    stages.imageGen = "failed";
    return {
      success: false,
      avatarSource: "ai",
      authorDescription: authorDescription ?? undefined,
      imagePrompt: promptPackage.prompt,
      vendor,
      model,
      durationMs: Date.now() - startTime,
      error: imageResult.error,
      stages,
    };
  }

  stages.imageGen = "executed";

  // ── Stage 5a: S3 Upload ────────────────────────────────────────────────────
  const imageData = await resultToBuffer(imageResult);
  if (!imageData) {
    stages.s3Upload = "failed";
    return {
      success: false,
      avatarSource: "ai",
      authorDescription: authorDescription ?? undefined,
      imagePrompt: promptPackage.prompt,
      vendor,
      model,
      durationMs: Date.now() - startTime,
      error: "Failed to convert image result to buffer",
      stages,
    };
  }

  let s3AvatarUrl: string | undefined;
  let s3AvatarKey: string | undefined;

  try {
    const ext = imageData.mimeType.includes("png")
      ? "png"
      : imageData.mimeType.includes("webp")
      ? "webp"
      : "jpg";
    const sanitized = authorName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const key = `author-avatars/ai-${sanitized}-${Date.now()}.${ext}`;
    const { url } = await storagePut(key, imageData.buffer, imageData.mimeType);
    s3AvatarUrl = url;
    s3AvatarKey = key;
    stages.s3Upload = "executed";
    console.log(`[meticulousPipeline] S3 upload complete for ${authorName}: ${url}`);
  } catch (err) {
    stages.s3Upload = "failed";
    console.error(`[meticulousPipeline] S3 upload failed for ${authorName}:`, err);
    // S3 failure is non-fatal — we still have the image
  }

  // ── Stage 5b: Google Drive Upload (best-effort) ────────────────────────────
  let driveFileId: string | undefined;
  try {
    const fileId = await uploadToGoogleDrive(
      imageData.buffer,
      imageData.mimeType,
      authorName
    );
    if (fileId) {
      driveFileId = fileId;
      stages.driveUpload = "executed";
      console.log(`[meticulousPipeline] Drive upload complete for ${authorName}: ${fileId}`);
    } else {
      stages.driveUpload = "failed";
    }
  } catch {
    stages.driveUpload = "failed";
  }

  return {
    success: true,
    s3AvatarUrl,
    s3AvatarKey,
    driveFileId,
    avatarSource: "google-imagen",
    authorDescription: authorDescription ?? undefined,
    imagePrompt: promptPackage.prompt,
    vendor,
    model,
    durationMs: Date.now() - startTime,
    stages,
  };
}
