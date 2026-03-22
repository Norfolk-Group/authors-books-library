/**
 * Author Researcher — Stage 1 of the Meticulous Avatar Pipeline
 *
 * Runs three research sources in parallel, then feeds all gathered data
 * (text bio + reference photo URLs) to Gemini Vision to produce a structured
 * AuthorDescription JSON.  The result is cached in DB to avoid re-research
 * on subsequent regenerations.
 *
 * Sources (run in parallel via Promise.allSettled):
 *   1. Wikipedia REST API  — bio text + infobox photo
 *   2. Tavily Image Search — up to 5 ranked photo URLs
 *   3. Apify Amazon scrape — author page photo
 */

import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { AuthorDescription, AuthorResearchData } from "./types.js";
import { scrapeAuthorAvatar } from "../../apify.js";

// ── Wikipedia bio helper ───────────────────────────────────────────────────────
// We extend wikipedia.ts with a bio-text fetch (not just the photo URL)

async function fetchWikipediaBioAndPhoto(authorName: string): Promise<{
  bio: string | null;
  photoUrl: string | null;
}> {
  const slug = authorName.replace(/\s+/g, "_");
  const variants = [
    slug,
    `${slug}_(author)`,
    `${slug}_(writer)`,
    authorName.replace(/\s[A-Z]\.\s/g, " ").replace(/\s+/g, "_"),
  ];

  for (const variant of variants) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "NCGLibrary/1.0 (ncglibrary@norfolkgroup.io)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const bio: string | null = data.extract ?? null;
      const photoUrl: string | null =
        data.originalimage?.source ??
        (data.thumbnail?.source
          ? data.thumbnail.source.replace(/\/\d+px-/, "/400px-")
          : null);
      if (bio || photoUrl) return { bio, photoUrl };
    } catch {
      // try next variant
    }
  }
  return { bio: null, photoUrl: null };
}

// ── Tavily multi-photo fetch ───────────────────────────────────────────────────
// We extend tavily.ts to return multiple URLs (not just the top one)

async function fetchTavilyPhotos(authorName: string): Promise<string[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  // Include current year to bias toward recent photos
  const currentYear = new Date().getFullYear();
  const query = `"${authorName}" author headshot professional photo ${currentYear} OR ${currentYear - 1} OR ${currentYear - 2}`;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_images: true,
        include_image_descriptions: false,
        max_results: 10,
        days: 730,  // Prefer photos from the last 2 years
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const images: string[] = data.images ?? [];
    // Prioritize trusted sources and recent photos
    const nameParts = authorName.toLowerCase().split(" ");
    const scored = images.map((url) => {
      const lower = url.toLowerCase();
      let score = 0;
      if (lower.includes("linkedin")) score += 10;
      if (lower.includes("wikipedia") || lower.includes("wikimedia")) score += 9;
      if (lower.includes("ted.com")) score += 8;
      if (lower.includes("penguin") || lower.includes("harpercollins")) score += 7;
      if (lower.includes("author") || lower.includes("headshot")) score += 5;
      if (lower.includes("speaker") || lower.includes("keynote")) score += 6;
      if (lower.includes("official") || lower.includes("press")) score += 4;
      if (nameParts.some((p) => p.length > 3 && lower.includes(p))) score += 3;
      // Boost recent years
      if (lower.includes("2024") || lower.includes("2025") || lower.includes("2026")) score += 5;
      if (lower.includes("2023") || lower.includes("2022")) score += 2;
      // Penalise old photos
      if (lower.includes("2015") || lower.includes("2016") || lower.includes("2017")) score -= 3;
      if (lower.includes("2010") || lower.includes("2011") || lower.includes("2012")) score -= 6;
      if (lower.includes("book") || lower.includes("cover")) score -= 5;
      if (lower.includes("amazon") && lower.includes("images")) score -= 2;
      return { url, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.url);
  } catch {
    return [];
  }
}

// ── Apify photo fetch ──────────────────────────────────────────────────────────

async function fetchApifyPhoto(authorName: string): Promise<string | null> {
  try {
    const result = await scrapeAuthorAvatar(authorName);
    return result?.avatarUrl ?? null;
  } catch {
    return null;
  }
}

// ── Research aggregation ───────────────────────────────────────────────────────

export async function researchAuthor(
  authorName: string
): Promise<AuthorResearchData> {
  const [wikiResult, tavilyResult, apifyResult] = await Promise.allSettled([
    fetchWikipediaBioAndPhoto(authorName),
    fetchTavilyPhotos(authorName),
    fetchApifyPhoto(authorName),
  ]);

  const wiki =
    wikiResult.status === "fulfilled" ? wikiResult.value : { bio: null, photoUrl: null };
  const tavilyPhotos =
    tavilyResult.status === "fulfilled" ? tavilyResult.value : [];
  const apifyPhoto =
    apifyResult.status === "fulfilled" ? apifyResult.value : null;

  // Deduplicate and collect all photo URLs
  const allPhotoUrls = Array.from(
    new Set(
      [wiki.photoUrl, ...tavilyPhotos, apifyPhoto].filter(
        (u): u is string => !!u && u.startsWith("http")
      )
    )
  ).slice(0, 5); // Cap at 5 for Gemini Vision

  const sources: string[] = [];
  if (wiki.bio || wiki.photoUrl) sources.push("Wikipedia");
  if (tavilyPhotos.length > 0) sources.push("Tavily");
  if (apifyPhoto) sources.push("Apify");

  return {
    authorName,
    wikiBio: wiki.bio ?? undefined,
    tavilyPhotoUrls: tavilyPhotos,
    apifyPhotoUrls: apifyPhoto ? [apifyPhoto] : [],
    allPhotoUrls,
    sources,
  };
}

// ── Gemini Vision analysis ─────────────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `You are an expert at analyzing public figures for professional avatar generation.
Given biographical text and reference photo URLs for an author, extract a precise physical description optimized for AI image generation.

CRITICAL RULES:
1. Only describe what you can observe from the reference materials or reliably infer from biographical data
2. For uncertain features, use ranges (e.g., "late 40s to mid 50s")
3. Flag low-confidence fields in sourceConfidence.uncertainties
4. Never invent features not supported by evidence
5. Focus on stable features (hair color may vary; face shape doesn't)
6. Be specific and concrete — vague descriptions produce generic avatars
7. Output ONLY valid JSON matching the AuthorDescription schema — no markdown, no explanation`;

const AUTHOR_DESCRIPTION_SCHEMA = {
  type: "object",
  properties: {
    authorName: { type: "string" },
    demographics: {
      type: "object",
      properties: {
        apparentAgeRange: { type: "string" },
        genderPresentation: { type: "string", enum: ["male", "female", "non-binary"] },
        ethnicAppearance: { type: "string" },
      },
      required: ["apparentAgeRange", "genderPresentation", "ethnicAppearance"],
      additionalProperties: false,
    },
    physicalFeatures: {
      type: "object",
      properties: {
        hair: {
          type: "object",
          properties: {
            color: { type: "string" },
            style: { type: "string" },
            length: { type: "string" },
          },
          required: ["color", "style", "length"],
          additionalProperties: false,
        },
        facialHair: {
          type: "object",
          properties: {
            type: { type: "string" },
            color: { type: "string" },
            style: { type: "string" },
          },
          required: ["type"],
          additionalProperties: false,
        },
        faceShape: { type: "string" },
        distinctiveFeatures: { type: "array", items: { type: "string" } },
        eyes: {
          type: "object",
          properties: {
            color: { type: "string" },
            shape: { type: "string" },
            notable: { type: "string" },
          },
          required: ["color"],
          additionalProperties: false,
        },
        skinTone: { type: "string" },
        build: { type: "string" },
        glasses: {
          type: "object",
          properties: {
            wears: { type: "boolean" },
            style: { type: "string" },
          },
          required: ["wears"],
          additionalProperties: false,
        },
      },
      required: ["hair", "facialHair", "faceShape", "distinctiveFeatures", "eyes", "skinTone", "build", "glasses"],
      additionalProperties: false,
    },
    stylePresentation: {
      type: "object",
      properties: {
        typicalAttire: {
          type: "object",
          properties: {
            formality: { type: "string" },
            description: { type: "string" },
            colors: { type: "array", items: { type: "string" } },
          },
          required: ["formality", "description", "colors"],
          additionalProperties: false,
        },
        aesthetic: { type: "array", items: { type: "string" } },
      },
      required: ["typicalAttire", "aesthetic"],
      additionalProperties: false,
    },
    personalityExpression: {
      type: "object",
      properties: {
        dominantTraits: { type: "array", items: { type: "string" } },
        typicalExpression: { type: "string" },
        energy: { type: "string" },
      },
      required: ["dominantTraits", "typicalExpression", "energy"],
      additionalProperties: false,
    },
    professionalContext: {
      type: "object",
      properties: {
        primaryField: { type: "string" },
        roleType: { type: "string" },
        institutions: { type: "array", items: { type: "string" } },
      },
      required: ["primaryField", "roleType", "institutions"],
      additionalProperties: false,
    },
    sourceConfidence: {
      type: "object",
      properties: {
        photoSourceCount: { type: "number" },
        photoConsistency: { type: "string", enum: ["high", "medium", "low"] },
        overallConfidence: { type: "string", enum: ["high", "medium", "low"] },
        uncertainties: { type: "array", items: { type: "string" } },
      },
      required: ["photoSourceCount", "photoConsistency", "overallConfidence", "uncertainties"],
      additionalProperties: false,
    },
    references: {
      type: "object",
      properties: {
        photoUrls: { type: "array", items: { type: "string" } },
        textSources: { type: "array", items: { type: "string" } },
      },
      required: ["photoUrls", "textSources"],
      additionalProperties: false,
    },
  },
  required: [
    "authorName", "demographics", "physicalFeatures", "stylePresentation",
    "personalityExpression", "professionalContext", "sourceConfidence", "references"
  ],
  additionalProperties: false,
};

/**
 * Analyze research data with Gemini Vision to produce a structured AuthorDescription.
 * Feeds up to 4 reference photo URLs directly to the vision model.
 */
export async function buildAuthorDescription(
  research: AuthorResearchData,
  researchModel = "gemini-2.5-flash",
  researchVendor = "google"
): Promise<AuthorDescription | null> {
  // Build the user message with text bio + photo URLs (shared across vendors)
  const textParts: string[] = [];
  if (research.wikiBio) {
    textParts.push(`## Wikipedia Bio\n${research.wikiBio}`);
  }
  if (research.allPhotoUrls.length > 0) {
    textParts.push(
      `## Reference Photo URLs (analyze these for physical appearance)\n` +
      research.allPhotoUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")
    );
  }
  textParts.push(
    `## Task\nAnalyze the above information for "${research.authorName}" and produce a structured AuthorDescription JSON.`
  );
  const userMessage = textParts.join("\n\n");

  // Route to the appropriate vendor
  if (researchVendor === "anthropic") {
    return buildAuthorDescriptionWithClaude(research, userMessage, researchModel);
  }
  // Default: Google Gemini
  return buildAuthorDescriptionWithGemini(research, userMessage, researchModel);
}

// ── Gemini Vision implementation ───────────────────────────────────────────────

/**
 * Attempt to fetch an image URL and return it as a base64-encoded inline part.
 * Returns null if the fetch fails, times out, or the content-type is not an image.
 */
async function fetchImageAsBase64(
  url: string
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "NCGLibrary/1.0 (ncglibrary@norfolkgroup.io)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    // Cap at 3 MB to stay within Gemini inline limits
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 3 * 1024 * 1024) return null;
    const mimeType = contentType.split(";")[0].trim() as string;
    return { inlineData: { data: buffer.toString("base64"), mimeType } };
  } catch {
    return null;
  }
}

async function buildAuthorDescriptionWithGemini(
  research: AuthorResearchData,
  userMessage: string,
  researchModel = "gemini-2.5-flash"
): Promise<AuthorDescription | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[authorResearcher] GEMINI_API_KEY not set");
    return null;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });

    // ── Inline up to 4 reference photos as true multimodal image parts ─────────
    // Fetch all photos in parallel; keep only the ones that succeed
    const imagePartResults = await Promise.allSettled(
      research.allPhotoUrls.slice(0, 4).map(fetchImageAsBase64)
    );
    const imageParts = imagePartResults
      .filter(
        (r): r is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string } }> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    console.log(
      `[authorResearcher] Gemini multimodal: ${imageParts.length}/${research.allPhotoUrls.length} photos inlined for ${research.authorName}`
    );

    // Build parts: system prompt + text context + inlined images
    const parts: object[] = [
      { text: RESEARCH_SYSTEM_PROMPT },
      { text: userMessage },
      ...imageParts,
    ];

    const response = await ai.models.generateContent({
      model: researchModel,
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: AUTHOR_DESCRIPTION_SCHEMA,
        temperature: 0.2,
      },
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error(`[authorResearcher] No text in Gemini response for ${research.authorName}`);
      return null;
    }
    const parsed = JSON.parse(text) as AuthorDescription;
    parsed.references = { photoUrls: research.allPhotoUrls, textSources: research.sources };
    return parsed;
  } catch (err) {
    console.error(`[authorResearcher] Gemini analysis error for ${research.authorName}:`, err);
    return null;
  }
}

// ── Anthropic Claude implementation ───────────────────────────────────────────

async function buildAuthorDescriptionWithClaude(
  research: AuthorResearchData,
  userMessage: string,
  researchModel = "claude-sonnet-4-5-20250929"
): Promise<AuthorDescription | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[authorResearcher] ANTHROPIC_API_KEY not set — falling back to Gemini");
    return buildAuthorDescriptionWithGemini(research, userMessage);
  }
  try {
    const client = new Anthropic({ apiKey });
    const schemaStr = JSON.stringify(AUTHOR_DESCRIPTION_SCHEMA, null, 2);
    const systemPrompt = `${RESEARCH_SYSTEM_PROMPT}\n\nYou MUST respond with ONLY a valid JSON object matching this schema:\n${schemaStr}\n\nNo markdown, no code blocks, no explanation — raw JSON only.`;

    const response = await client.messages.create({
      model: researchModel,
      max_tokens: 2048,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(`[authorResearcher] No text block in Claude response for ${research.authorName}`);
      return null;
    }

    // Strip any accidental markdown code fences
    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as AuthorDescription;
    parsed.references = { photoUrls: research.allPhotoUrls, textSources: research.sources };
    console.log(`[authorResearcher] Claude analysis complete for ${research.authorName}`);
    return parsed;
  } catch (err) {
    console.error(`[authorResearcher] Claude analysis error for ${research.authorName}:`, err);
    return null;
  }
}

/**
 * Full research pipeline: gather data in parallel, then analyze with Gemini Vision.
 * Returns null if research fails completely.
 */
export async function researchAndDescribeAuthor(
  authorName: string,
  researchModel?: string,
  researchVendor?: string
): Promise<AuthorDescription | null> {
  console.log(`[authorResearcher] Starting research for: ${authorName} (vendor: ${researchVendor ?? "google"}, model: ${researchModel ?? "default"})`);
  const research = await researchAuthor(authorName);
  console.log(
    `[authorResearcher] Research complete for ${authorName}: ` +
    `${research.sources.join(", ")} | ${research.allPhotoUrls.length} photos`
  );

  if (!research.wikiBio && research.allPhotoUrls.length === 0) {
    console.warn(`[authorResearcher] No data found for ${authorName} — skipping LLM analysis`);
    return null;
  }

  return buildAuthorDescription(research, researchModel, researchVendor);
}
