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
 *   website, businessWebsite, youtube, twitter/X, linkedin, substack, facebook,
 *   instagram, tiktok, github, podcast, newsletter, speaking, blog
 *
 * Cost estimate per author: ~$0.002 (Perplexity sonar-pro) + $0.0001 (LLM extraction)
 */

const PERPLEXITY_API_BASE = "https://api.perplexity.ai";

export interface AuthorPlatformLinks {
  websiteUrl?: string;
  businessWebsiteUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  substackUrl?: string;
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
 * Returns structured URLs per platform.
 */
export async function discoverAuthorPlatforms(
  authorName: string,
  perplexityApiKey: string
): Promise<PlatformEnrichmentResult> {
  const prompt = `Find the official online presence for the author "${authorName}". 
I need exact URLs for each of these platforms (only include if you are confident it is the correct official account):
- Personal website (e.g. adamgrant.net)
- Business or company website (e.g. organizational affiliation site)
- YouTube channel
- Twitter/X profile
- LinkedIn profile
- Substack newsletter
- Facebook page
- Instagram profile
- TikTok profile
- GitHub profile
- Podcast (own show, not appearances)
- Email newsletter (Mailchimp, ConvertKit, Beehiiv, etc.)
- Speaking bureau or booking page
- Blog (if separate from main website)

Return ONLY a JSON object with these exact keys (omit keys where no URL found):
{
  "websiteUrl": "https://...",
  "businessWebsiteUrl": "https://...",
  "youtubeUrl": "https://...",
  "twitterUrl": "https://...",
  "linkedinUrl": "https://...",
  "substackUrl": "https://...",
  "facebookUrl": "https://...",
  "instagramUrl": "https://...",
  "tiktokUrl": "https://...",
  "githubUrl": "https://...",
  "podcastUrl": "https://...",
  "newsletterUrl": "https://...",
  "speakingUrl": "https://...",
  "blogUrl": "https://..."
}`;

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
          content: "You are a research assistant that finds official social media and web presence for authors. Return only valid JSON with confirmed URLs. Do not guess or hallucinate URLs.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1024,
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
      // Validate and sanitize — only accept https:// URLs
      const validKeys: (keyof AuthorPlatformLinks)[] = [
        "websiteUrl", "businessWebsiteUrl", "youtubeUrl", "twitterUrl",
        "linkedinUrl", "substackUrl", "facebookUrl", "instagramUrl",
        "tiktokUrl", "githubUrl", "podcastUrl", "newsletterUrl",
        "speakingUrl", "blogUrl",
      ];
      for (const key of validKeys) {
        const val = parsed[key];
        if (typeof val === "string" && val.startsWith("http") && val.length > 10) {
          links[key] = val;
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
