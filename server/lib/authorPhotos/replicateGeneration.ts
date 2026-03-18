/**
 * Tier 5: Replicate AI Portrait Generation — last resort, ~$0.003/image
 * Generates a realistic professional headshot when no real photo is found.
 *
 * NOTE: The Replicate SDK (>=1.0) returns FileOutput objects, not plain strings.
 * FileOutput.toString() returns the URL string directly.
 * FileOutput.url() returns a URL object (not a string) — do NOT call .slice() on it.
 */
import Replicate from "replicate";

// Pinned model version for stability (flux-schnell latest as of 2025-03)
const MODEL_ID = "black-forest-labs/flux-schnell";
// Timeout for the Replicate run (90 seconds — flux-schnell is fast, usually <10s)
const REPLICATE_TIMEOUT_MS = 90_000;

function getClient() {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  if (!token) {
    console.error("[Replicate] REPLICATE_API_TOKEN is not set");
  }
  return new Replicate({ auth: token });
}

const FEMALE_NAMES = new Set([
  "frances", "anne", "emma", "rhea", "karen", "kim", "sue", "arianna",
  "esther", "annie", "april", "alison", "mel", "nixaly", "leil",
]);
const MALE_NAMES = new Set([
  "aaron", "adam", "alex", "andrew", "ben", "cal", "charles", "chris",
  "colin", "dale", "dan", "daniel", "david", "eric", "ezra", "fred",
  "geoffrey", "george", "gino", "hamilton", "hans", "henry", "houston",
  "jack", "james", "jason", "jeb", "jeff", "jefferson", "jim", "john",
  "lawrence", "leander", "malcolm", "marcus", "martin", "matt", "mike",
  "morgan", "peter", "philipp", "ray", "reid", "richard", "rob", "robert",
  "sanjoy", "scott", "sean", "seth", "shankar", "simon", "stephen",
  "steven", "uri", "walter", "will", "yuval", "albert",
]);

function buildPrompt(authorName: string): string {
  const firstName = authorName.split(" ")[0].toLowerCase();
  const gender = FEMALE_NAMES.has(firstName)
    ? "woman"
    : MALE_NAMES.has(firstName)
    ? "man"
    : "person";

  return `Professional corporate headshot photograph of a professional ${gender} business author and thought leader. Warm approachable expression with a slight confident smile. Smart business attire suitable for a book author photo. Clean studio lighting, soft shadows, neutral gray background. High-end corporate portrait photography. Sharp focus on face, shallow depth of field. 85mm portrait lens, f/2.8, professional studio lighting, photorealistic. The portrait looks like it could appear on the back cover of a bestselling business book. No text, watermarks, or logos.`;
}

export interface GeneratedPortrait {
  url: string;
  isAiGenerated: true;
}

/**
 * Extract URL string from a Replicate output item.
 * Handles both legacy string outputs and new FileOutput objects (SDK >=1.0).
 */
function extractUrl(item: unknown): string | null {
  if (!item) return null;

  // Plain string (legacy SDK behaviour)
  if (typeof item === "string" && item.startsWith("http")) return item;

  // FileOutput object: toString() returns the CDN URL directly
  const str = String(item);
  if (str.startsWith("http")) return str;

  // Try .url property if it exists (some SDK versions)
  if (typeof item === "object" && item !== null) {
    const obj = item as Record<string, unknown>;
    if (typeof obj.url === "string" && obj.url.startsWith("http")) return obj.url;
    // FileOutput.url() method returns a URL object
    if (typeof obj.url === "function") {
      try {
        const urlObj = (obj.url as () => unknown)();
        if (urlObj instanceof URL) return urlObj.href;
        if (typeof urlObj === "string" && urlObj.startsWith("http")) return urlObj;
      } catch {
        // ignore
      }
    }
  }

  console.error("[Replicate] Could not extract URL from output item:", typeof item, str.slice(0, 100));
  return null;
}

export async function generateAIPortrait(
  authorName: string
): Promise<GeneratedPortrait | null> {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  if (!token) {
    console.error("[Replicate] Cannot generate portrait — REPLICATE_API_TOKEN is not set");
    return null;
  }

  console.log(`[Replicate] Generating portrait for: ${authorName}`);

  try {
    const replicate = getClient();
    const prompt = buildPrompt(authorName);

    // Wrap in a timeout to prevent hanging
    const runPromise = replicate.run(MODEL_ID, {
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "webp",
        output_quality: 90,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Replicate timeout after ${REPLICATE_TIMEOUT_MS}ms`)), REPLICATE_TIMEOUT_MS)
    );

    const output = await Promise.race([runPromise, timeoutPromise]);

    console.log(`[Replicate] Raw output type: ${typeof output}, isArray: ${Array.isArray(output)}, length: ${Array.isArray(output) ? output.length : 'N/A'}`);

    // flux-schnell returns an array of FileOutput objects (SDK >=1.0)
    // or plain strings (older SDK). Use extractUrl() to handle both.
    let imageUrl: string | null = null;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = extractUrl(output[0]);
    } else if (output) {
      imageUrl = extractUrl(output);
    }

    if (!imageUrl) {
      console.error(`[Replicate] No URL extracted from output for ${authorName}`, JSON.stringify(output));
      return null;
    }

    console.log(`[Replicate] Portrait generated successfully for ${authorName}: ${imageUrl.slice(0, 60)}...`);
    return { url: imageUrl, isAiGenerated: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Replicate] Portrait generation error for ${authorName}: ${message}`);
    return null;
  }
}

/**
 * Validate the Replicate API token by calling the account endpoint.
 * Returns the username on success, null on failure.
 */
export async function validateReplicateToken(): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN ?? "";
  if (!token) return null;
  try {
    const resp = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { username?: string };
    return data.username ?? "ok";
  } catch {
    return null;
  }
}
