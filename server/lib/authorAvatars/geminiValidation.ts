/**
 * Tier 4 (Quality Gate): Gemini Vision - validates found images are real headshots.
 * Runs after Tiers 1-3 to reject book covers, logos, or irrelevant images.
 */
import { GoogleGenAI } from "@google/genai";

function getGenAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
}

export interface ValidationResult {
  isValidHeadshot: boolean;
  confidence: number;
  reason: string;
}

export async function validateHeadshotWithGemini(
  imageUrl: string,
  authorName: string
): Promise<ValidationResult> {
  try {
    const prompt = `Analyze this image and determine if it is a professional headshot or portrait photo of a person (specifically the author "${authorName}").

Return ONLY valid JSON with this exact structure:
{
  "isHeadshot": boolean,
  "showsOneFace": boolean,
  "isProfessional": boolean,
  "isBookCover": boolean,
  "confidence": number (0.0-1.0),
  "reason": "brief explanation"
}

Criteria:
- isHeadshot: true if the image shows a person's face/upper body as the primary subject
- showsOneFace: true if exactly one person is clearly visible
- isProfessional: true if it looks like an author photo, headshot, or professional portrait
- isBookCover: true if it appears to be a book cover, product image, or illustration
- confidence: your confidence in this assessment (0.0 = uncertain, 1.0 = certain)`;

    // Fetch image as base64
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return { isValidHeadshot: false, confidence: 0, reason: "Could not fetch image" };
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

    const genai = getGenAI();
    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64, mimeType } },
          ],
        },
      ],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isValidHeadshot: false, confidence: 0.5, reason: "Could not parse response" };

    const analysis = JSON.parse(jsonMatch[0]);
    const isValid =
      analysis.isHeadshot &&
      analysis.showsOneFace &&
      analysis.isProfessional &&
      !analysis.isBookCover;

    return {
      isValidHeadshot: isValid,
      confidence: analysis.confidence ?? 0.5,
      reason: analysis.reason ?? "",
    };
  } catch (err) {
    console.error("[Gemini validation error]", err);
    // On error, cautiously accept
    return { isValidHeadshot: true, confidence: 0.3, reason: "Validation service error" };
  }
}
