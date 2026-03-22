/**
 * Tier 2: Tavily Image Search - fast (~1-2s), $0.001/search
 * Best for business authors on LinkedIn, publisher sites, speaker bios.
 */

function prioritizeImages(images: string[], authorName: string): string[] {
  const nameParts = authorName.toLowerCase().split(" ");
  const scored = images.map((url) => {
    const lower = url.toLowerCase();
    let score = 0;
    // Trusted sources
    if (lower.includes("linkedin")) score += 10;
    if (lower.includes("wikipedia") || lower.includes("wikimedia")) score += 9;
    if (lower.includes("ted.com")) score += 8;
    if (lower.includes("penguin") || lower.includes("harpercollins")) score += 7;
    if (lower.includes("simonandschuster")) score += 7;
    if (lower.includes("author")) score += 5;
    if (lower.includes("headshot") || lower.includes("portrait")) score += 5;
    if (nameParts.some((p) => p.length > 3 && lower.includes(p))) score += 3;
    // Boost recent/current sources
    if (lower.includes("speaker") || lower.includes("keynote")) score += 6;
    if (lower.includes("official") || lower.includes("press")) score += 4;
    if (lower.includes("2024") || lower.includes("2025") || lower.includes("2026")) score += 5;
    if (lower.includes("2023") || lower.includes("2022")) score += 2;
    // Penalise old/dated sources
    if (lower.includes("2015") || lower.includes("2016") || lower.includes("2017")) score -= 3;
    if (lower.includes("2010") || lower.includes("2011") || lower.includes("2012")) score -= 6;
    // Penalise book covers
    if (lower.includes("book") || lower.includes("cover")) score -= 5;
    if (lower.includes("thumb") || lower.includes("small")) score -= 3;
    if (lower.includes("amazon") && lower.includes("images")) score -= 2;
    return { url, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.url);
}

export async function fetchTavilyAuthorPhoto(authorName: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  // Use current year to bias search toward recent photos
  const currentYear = new Date().getFullYear();
  const query = `"${authorName}" author headshot photo ${currentYear} OR ${currentYear - 1} OR ${currentYear - 2}`;
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
        // Prefer recent content — Tavily supports days_back for recency
        days: 730,  // Search within last 2 years for recent photos
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const images: string[] = data.images ?? [];
    if (!images.length) return null;
    const ranked = prioritizeImages(images, authorName);
    return ranked[0] ?? null;
  } catch {
    return null;
  }
}
