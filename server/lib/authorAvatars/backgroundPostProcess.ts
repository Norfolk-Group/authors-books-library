/**
 * backgroundPostProcess.ts — Post-process real author photos by replacing
 * their background using Gemini image editing (via the built-in imageGeneration helper).
 *
 * Use cases:
 *  - Normalize backgrounds of real photos to match the library's bokeh-gold style
 *  - Remove cluttered backgrounds from headshots
 *  - Create consistent visual style across all author avatars
 */
import { generateImage } from "../../_core/imageGeneration";
import { storagePut } from "../../storage";
import { SPECIAL_BACKGROUNDS } from "./promptBuilder";

/** Background replacement result */
export interface BackgroundPostProcessResult {
  /** URL of the processed image (S3 CDN) */
  processedUrl: string;
  /** S3 key for the processed image */
  s3Key: string;
  /** The background style that was applied */
  backgroundStyle: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Replace the background of a real author photo using Gemini image editing.
 *
 * @param authorName - The author's name (used for S3 key naming)
 * @param originalImageUrl - URL of the original photo to process
 * @param bgStyle - Background style key (e.g. "bokeh-gold") or custom description
 * @returns Processed image result with S3 URL
 */
export async function postProcessBackground(
  authorName: string,
  originalImageUrl: string,
  bgStyle: string = "bokeh-gold"
): Promise<BackgroundPostProcessResult> {
  try {
    // Resolve the background description from SPECIAL_BACKGROUNDS or use as-is
    const bgDescription =
      (SPECIAL_BACKGROUNDS as Record<string, string>)[bgStyle] ??
      bgStyle;

    // Build the editing prompt
    const editPrompt = [
      `Replace the background of this portrait photo with: ${bgDescription}.`,
      "Keep the person's face, hair, clothing, and all features exactly as they are.",
      "Only change the background. Maintain the same lighting direction on the subject.",
      "The result should look like a professional headshot with a clean, consistent background.",
    ].join(" ");

    // Use Gemini image editing via the built-in helper
    const { url: editedUrl } = await generateImage({
      prompt: editPrompt,
      originalImages: [
        {
          url: originalImageUrl,
          mimeType: "image/jpeg",
        },
      ],
    });

    if (!editedUrl) {
      return {
        processedUrl: originalImageUrl,
        s3Key: "",
        backgroundStyle: bgStyle,
        success: false,
        error: "Gemini image editing returned no URL",
      };
    }

    // Upload the processed image to S3
    const safeName = authorName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const suffix = Math.random().toString(36).slice(2, 8);
    const s3Key = `author-avatars/${safeName}-bg-processed-${suffix}.webp`;

    // Fetch the edited image and upload to S3
    const response = await fetch(editedUrl);
    if (!response.ok) {
      return {
        processedUrl: originalImageUrl,
        s3Key: "",
        backgroundStyle: bgStyle,
        success: false,
        error: `Failed to fetch edited image: ${response.status}`,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { url: s3Url } = await storagePut(s3Key, buffer, "image/webp");

    return {
      processedUrl: s3Url,
      s3Key,
      backgroundStyle: bgStyle,
      success: true,
    };
  } catch (err: any) {
    return {
      processedUrl: originalImageUrl,
      s3Key: "",
      backgroundStyle: bgStyle,
      success: false,
      error: err?.message ?? "Unknown error during background post-processing",
    };
  }
}
