/**
 * authorLinks.ts
 * Enriches author profiles with links: website, podcast, blog, Substack,
 * newspaper articles, and other online presence.
 * Primary source: Perplexity (sonar-pro) for web-grounded research.
 * Fallback: Tavily search.
 */

import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

export interface AuthorLinkArticle {
  title: string;
  url: string;
  date?: string;
  publication?: string;
}

export interface AuthorOtherLink {
  label: string;
  url: string;
  type: "podcast" | "blog" | "substack" | "article" | "social" | "other";
}

export interface AuthorLinksResult {
  websiteUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  podcastUrl?: string;
  blogUrl?: string;
  substackUrl?: string;
  mediumUrl?: string;
  newspaperArticles: AuthorLinkArticle[];
  otherLinks: AuthorOtherLink[];
  source: "perplexity" | "gemini" | "fallback";
}

/**
 * Uses Perplexity (or Gemini fallback) to find all online presence for an author.
 */
export async function enrichAuthorLinks(
  authorName: string,
  researchVendor: string = "perplexity",
  researchModel: string = "sonar-pro"
): Promise<AuthorLinksResult> {
  const prompt = `Research the online presence of author "${authorName}". Find:
1. Official website URL
2. Twitter/X profile URL
3. LinkedIn profile URL
4. Podcast URL (if they host or regularly appear on a podcast)
5. Blog URL (personal blog, Medium, etc.)
6. Substack newsletter URL
7. Medium profile URL (medium.com/@authorname)
8. Up to 5 notable newspaper or online articles ABOUT them (not by them) — include title, URL, publication name, and date if available
8. Any other notable online presence (YouTube channel, speaking page, etc.)

Return ONLY a JSON object with this exact structure:
{
  "websiteUrl": "https://..." or null,
  "twitterUrl": "https://twitter.com/..." or null,
  "linkedinUrl": "https://linkedin.com/in/..." or null,
  "podcastUrl": "https://..." or null,
  "blogUrl": "https://..." or null,
  "substackUrl": "https://..." or null,
  "mediumUrl": "https://medium.com/@..." or null,
  "newspaperArticles": [
    {"title": "...", "url": "https://...", "date": "YYYY-MM-DD", "publication": "..."}
  ],
  "otherLinks": [
    {"label": "YouTube Channel", "url": "https://...", "type": "other"}
  ]
}

Only include URLs you are confident are correct. Use null for unknown fields.`;

  try {
    // Try Perplexity first (web-grounded)
    if (researchVendor === "perplexity" && ENV.perplexityApiKey) {
      const result = await callPerplexityLinks(authorName, researchModel, prompt);
      if (result) return { ...result, source: "perplexity" };
    }

    // Fallback to Gemini via invokeLLM
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant that finds accurate online presence information for authors. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "author_links",
          strict: true,
          schema: {
            type: "object",
            properties: {
              websiteUrl: { type: ["string", "null"] },
              twitterUrl: { type: ["string", "null"] },
              linkedinUrl: { type: ["string", "null"] },
              podcastUrl: { type: ["string", "null"] },
              blogUrl: { type: ["string", "null"] },
              substackUrl: { type: ["string", "null"] },
              mediumUrl: { type: ["string", "null"] },
              newspaperArticles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    date: { type: ["string", "null"] },
                    publication: { type: ["string", "null"] },
                  },
                  required: ["title", "url"],
                  additionalProperties: false,
                },
              },
              otherLinks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    url: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["podcast", "blog", "substack", "article", "social", "other"],
                    },
                  },
                  required: ["label", "url", "type"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "websiteUrl",
              "twitterUrl",
              "linkedinUrl",
              "podcastUrl",
              "blogUrl",
              "substackUrl",
              "mediumUrl",
              "newspaperArticles",
              "otherLinks",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from LLM");

    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return {
      websiteUrl: parsed.websiteUrl ?? undefined,
      twitterUrl: parsed.twitterUrl ?? undefined,
      linkedinUrl: parsed.linkedinUrl ?? undefined,
      podcastUrl: parsed.podcastUrl ?? undefined,
      blogUrl: parsed.blogUrl ?? undefined,
      substackUrl: parsed.substackUrl ?? undefined,
      mediumUrl: parsed.mediumUrl ?? undefined,
      newspaperArticles: parsed.newspaperArticles ?? [],
      otherLinks: parsed.otherLinks ?? [],
      source: "gemini",
    };
  } catch (err) {
    console.error(`[authorLinks] Failed to enrich links for ${authorName}:`, err);
    return {
      newspaperArticles: [],
      otherLinks: [],
      source: "fallback",
    };
  }
}

/**
 * Calls Perplexity API directly for web-grounded link research.
 */
async function callPerplexityLinks(
  authorName: string,
  model: string,
  prompt: string
): Promise<Omit<AuthorLinksResult, "source"> | null> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Find accurate online presence for authors. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.warn(`[authorLinks] Perplexity returned ${response.status} for ${authorName}`);
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Extract JSON from the response (Perplexity may wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      websiteUrl: parsed.websiteUrl ?? undefined,
      twitterUrl: parsed.twitterUrl ?? undefined,
      linkedinUrl: parsed.linkedinUrl ?? undefined,
      podcastUrl: parsed.podcastUrl ?? undefined,
      blogUrl: parsed.blogUrl ?? undefined,
      substackUrl: parsed.substackUrl ?? undefined,
      mediumUrl: parsed.mediumUrl ?? undefined,
      newspaperArticles: parsed.newspaperArticles ?? [],
      otherLinks: parsed.otherLinks ?? [],
    };
  } catch (err) {
    console.warn(`[authorLinks] Perplexity call failed for ${authorName}:`, err);
    return null;
  }
}
