/**
 * platforms.ts — Multi-platform presence discovery for authors
 *
 * Pipeline sequence (N+1):
 *   N=0  Perplexity sonar-pro query: "{authorName} official social media profiles links"
 *   N=1  LLM structured extraction: parse URLs per platform from Perplexity response
 *   N=2  Optional YouTube Data API v3: verify channel + get subscriber count
 *   N=3  Persist all discovered URLs to author_profiles columns + platformEnrichmentStatus JSON
 *
 * Platforms discovered:
 *   Multiple named websites (personal, company, speaking, podcast, course, blog, newsletter, TED, MasterClass, etc.)
 *   + all social platforms: youtube, twitter/X, linkedin, substack, facebook, instagram, tiktok, github
 *
 * Cost estimate per author: ~$0.002 (Perplexity sonar-pro) + $0.0001 (LLM extraction)
 */

const PERPLEXITY_API_BASE = "https://api.perplexity.ai";

/** A single named website entry */
export interface NamedWebsite {
  label: string;
  url: string;
  type: "personal" | "company" | "speaking" | "podcast" | "course" | "blog" | "newsletter" | "ted" | "masterclass" | "other";
}

export interface AuthorPlatformLinks {
  /** Array of all named websites (personal site, company, speaking bureau, course, etc.) */
  websites?: NamedWebsite[];
  // Legacy individual URL fields — kept for backward compat with existing DB columns
  websiteUrl?: string;
  businessWebsiteUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  substackUrl?: string;
  mediumUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  githubUrl?: string;
  podcastUrl?: string;
  newsletterUrl?: string;
  speakingUrl?: string;
  blogUrl?: string;
}

export interface PlatformEnrichmentResult {
  links: AuthorPlatformLinks;
  rawPerplexityResponse?: string;
  enrichedAt: string;
  source: "perplexity";
}

/**
 * Discover all platform presence links for an author using Perplexity sonar-pro.
 * Returns structured URLs per platform, including multiple named websites.
 */
export async function discoverAuthorPlatforms(
  authorName: string,
  perplexityApiKey: string
): Promise<PlatformEnrichmentResult> {
  const prompt = `Find ALL official online presence links for the author/speaker/expert "${authorName}".

IMPORTANT: Many authors have MULTIPLE websites. Find ALL of them — personal site, company site, speaking agency, course platform, podcast site, TED profile, MasterClass, etc.

Return a JSON object with this exact structure:
{
  "websites": [
    {"label": "Personal Site", "url": "https://...", "type": "personal"},
    {"label": "Wharton School", "url": "https://...", "type": "company"},
    {"label": "Speaking Bureau", "url": "https://...", "type": "speaking"},
    {"label": "MasterClass", "url": "https://...", "type": "course"},
    {"label": "TED Profile", "url": "https://...", "type": "ted"},
    {"label": "Podcast", "url": "https://...", "type": "podcast"},
    {"label": "Newsletter", "url": "https://...", "type": "newsletter"},
    {"label": "Blog", "url": "https://...", "type": "blog"}
  ],
  "youtubeUrl": "https://youtube.com/...",
  "twitterUrl": "https://twitter.com/... or https://x.com/...",
  "linkedinUrl": "https://linkedin.com/in/...",
  "substackUrl": "https://....substack.com",
  "mediumUrl": "https://medium.com/@authorname",
  "facebookUrl": "https://facebook.com/...",
  "instagramUrl": "https://instagram.com/...",
  "tiktokUrl": "https://tiktok.com/@...",
  "githubUrl": "https://github.com/..."
}

Rules:
- "websites" array: include ALL websites you find with descriptive labels (use the actual site/org name, not generic "Website")
- Use the real name of the organization/platform as the label (e.g. "Wharton School", "TED", "MasterClass", "Penguin Random House")
- Only include URLs you are confident are correct and official
- Omit any key where no URL is found
- Do not include social platforms (YouTube, Twitter, LinkedIn, etc.) in the websites array — put them in their own keys
- Return ONLY valid JSON, no markdown, no explanation`;

  const response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${perplexityApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "You are a research assistant that finds official social media and web presence for authors and public figures. Return only valid JSON with confirmed URLs. Do not guess or hallucinate URLs. Use the real name of each organization or platform as the label.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawContent = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let links: AuthorPlatformLinks = {};
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      // Parse the websites array
      if (Array.isArray(parsed.websites)) {
        const validTypes = new Set(["personal", "company", "speaking", "podcast", "course", "blog", "newsletter", "ted", "masterclass", "other"]);
        links.websites = (parsed.websites as unknown[])
          .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
          .filter(w => typeof w.label === "string" && typeof w.url === "string" && (w.url as string).startsWith("http"))
          .map(w => ({
            label: String(w.label).trim(),
            url: String(w.url).trim(),
            type: (validTypes.has(String(w.type)) ? String(w.type) : "other") as NamedWebsite["type"],
          }));
      }

      // Parse legacy individual URL fields
      const legacyKeys: (keyof Omit<AuthorPlatformLinks, "websites">)[] = [
        "websiteUrl", "businessWebsiteUrl", "youtubeUrl", "twitterUrl",
        "linkedinUrl", "substackUrl", "mediumUrl", "facebookUrl", "instagramUrl",
        "tiktokUrl", "githubUrl", "podcastUrl", "newsletterUrl",
        "speakingUrl", "blogUrl",
      ];
      for (const key of legacyKeys) {
        const val = parsed[key];
        if (typeof val === "string" && val.startsWith("http") && val.length > 10) {
          (links as Record<string, string>)[key] = val;
        }
      }

      // Back-fill legacy fields from websites array if not already set
      if (links.websites) {
        for (const site of links.websites) {
          if (site.type === "personal" && !links.websiteUrl) links.websiteUrl = site.url;
          if (site.type === "company" && !links.businessWebsiteUrl) links.businessWebsiteUrl = site.url;
          if (site.type === "speaking" && !links.speakingUrl) links.speakingUrl = site.url;
          if (site.type === "podcast" && !links.podcastUrl) links.podcastUrl = site.url;
          if (site.type === "blog" && !links.blogUrl) links.blogUrl = site.url;
          if (site.type === "newsletter" && !links.newsletterUrl) links.newsletterUrl = site.url;
        }
      }
    }
  } catch {
    // JSON parse failed — return empty links rather than crashing
    console.warn(`[platforms] Failed to parse JSON for "${authorName}":`, rawContent.slice(0, 200));
  }

  return {
    links,
    rawPerplexityResponse: rawContent,
    enrichedAt: new Date().toISOString(),
    source: "perplexity",
  };
}

/**
 * Validate that the Perplexity API key works.
 */
export async function validatePerplexityKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
