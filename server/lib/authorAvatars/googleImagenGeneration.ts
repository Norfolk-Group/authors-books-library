/**
 * Google Imagen / Nano Banana portrait generation helper.
 *
 * Supported models (nano-banana family):
 *   - gemini-2.5-flash-image          → "Nano Banana" (fast, efficient)
 *   - gemini-3.1-flash-image-preview  → "Nano Banana 2" (high-efficiency)
 *   - gemini-3-pro-image-preview      → "Nano Banana Pro" (highest quality)
 *
 * All use the same @google/genai SDK with GEMINI_API_KEY.
 * Returns a base64 PNG buffer that the caller can upload to S3.
 */

import { GoogleGenAI } from "@google/genai";

export const NANO_BANANA_MODELS: Record<string, string> = {
  "nano-banana":       "gemini-2.5-flash-image",
  "nano-banana-2":     "gemini-3.1-flash-image-preview",
  "nano-banana-pro":   "gemini-3-pro-image-preview",
};

/** Default model when none is specified */
export const DEFAULT_NANO_BANANA_MODEL = "gemini-2.5-flash-image";

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

function describeColor(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 200) return "bright white";
  if (brightness > 150) return "light neutral grey";
  if (r > g && r > b) return brightness < 80 ? "deep burgundy" : "warm red";
  if (g > r && g > b) return brightness < 80 ? "deep forest green" : "sage green";
  if (b > r && b > g) return brightness < 80 ? "deep navy blue" : "cool blue";
  if (r > 100 && g > 80 && b < 80) return "warm amber";
  if (r < 60 && g < 60 && b < 60) return "near-black charcoal";
  return "neutral dark";
}

const SPECIAL_BACKGROUNDS: Record<string, string> = {
  "bokeh-gold":
    "warm golden bokeh background with soft amber and cream circular light orbs, " +
    "professional studio portrait photography with warm backlighting, " +
    "shallow depth of field, elegant and inviting atmosphere",
};

function buildPrompt(authorName: string, bgColor?: string): string {
  const firstName = authorName.split(" ")[0].toLowerCase();
  const gender = FEMALE_NAMES.has(firstName)
    ? "woman"
    : MALE_NAMES.has(firstName)
    ? "man"
    : "person";
  const specialBg = bgColor ? SPECIAL_BACKGROUNDS[bgColor.toLowerCase()] : undefined;
  const bgPhrase = specialBg
    ? specialBg + " background"
    : `solid ${bgColor ? describeColor(bgColor) : "neutral gray"} background`;
  return (
    `Professional corporate headshot photograph of a professional ${gender} business author and thought leader. ` +
    `Warm approachable expression with a slight confident smile. Smart business attire suitable for a book author avatar. ` +
    `Clean studio lighting, soft shadows, ${bgPhrase}. High-end corporate portrait photography. ` +
    `Sharp focus on face, shallow depth of field. 85mm portrait lens, f/2.8, professional studio lighting, photorealistic. ` +
    `The portrait looks like it could appear on the back cover of a bestselling business book. No text, watermarks, or logos.`
  );
}

export interface GoogleImagenPortrait {
  buffer: Buffer;
  mimeType: string;
  isAiGenerated: true;
}

/**
 * Generate a professional author portrait using Google Imagen / Nano Banana.
 *
 * @param authorName  Display name of the author
 * @param bgColor     Optional hex color or sentinel key (e.g. "bokeh-gold")
 * @param modelId     Optional Gemini model ID override (defaults to gemini-2.5-flash-image)
 * @returns           Buffer + mimeType ready for S3 upload, or null on failure
 */
export async function generateGoogleImagenPortrait(
  authorName: string,
  bgColor?: string,
  modelId?: string,
): Promise<GoogleImagenPortrait | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[GoogleImagen] GEMINI_API_KEY is not set");
    return null;
  }

  const model = modelId ?? DEFAULT_NANO_BANANA_MODEL;
  const prompt = buildPrompt(authorName, bgColor);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Find the first image part in the response
    const candidates = response.candidates ?? [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          return {
            buffer,
            mimeType: part.inlineData.mimeType,
            isAiGenerated: true,
          };
        }
      }
    }

    console.error(`[GoogleImagen] No image part found in response for ${authorName}`);
    return null;
  } catch (err) {
    console.error(`[GoogleImagen] Portrait generation error for ${authorName}:`, err);
    return null;
  }
}
