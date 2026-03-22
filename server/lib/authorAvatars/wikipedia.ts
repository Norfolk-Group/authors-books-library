/**
 * Tier 1: Wikipedia REST API - free, fast (~200ms)
 * Best for famous authors with Wikipedia pages.
 */

interface WikipediaSummary {
  title: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
}

function generateNameVariants(name: string): string[] {
  const variants: string[] = [];
  // "Daniel J. Siegel" → "Daniel Siegel"
  variants.push(name.replace(/\s[A-Z]\.\s/g, " "));
  // "Henry Louis Gates Jr" → "Henry Louis Gates Jr."
  if (name.endsWith(" Jr")) variants.push(name + ".");
  // Add "(author)" suffix
  variants.push(`${name.replace(/\s+/g, "_")}_(author)`);
  variants.push(`${name.replace(/\s+/g, "_")}_(writer)`);
  // "Robert B. Cialdini" → "Robert Cialdini"
  variants.push(name.replace(/\s[A-Z]\.\s/g, " "));
  return variants.map((v) => v.replace(/\s+/g, "_"));
}

function upgradeResolution(thumbnailUrl: string): string {
  // Wikipedia thumbnails: /XXXpx- → /400px-
  return thumbnailUrl.replace(/\/\d+px-/, "/400px-");
}

async function fetchWikiSummary(name: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NCGLibrary/1.0 (ncglibrary@example.com)" },
    });
    if (!res.ok) return null;
    const data: WikipediaSummary = await res.json();
    if (data.originalimage?.source) return data.originalimage.source;
    if (data.thumbnail?.source) return upgradeResolution(data.thumbnail.source);
    return null;
  } catch {
    return null;
  }
}

export async function fetchWikipediaPhoto(authorName: string): Promise<string | null> {
  // Try primary name first
  const primary = authorName.replace(/\s+/g, "_");
  const result = await fetchWikiSummary(primary);
  if (result) return result;

  // Try variants
  for (const variant of generateNameVariants(authorName)) {
    const r = await fetchWikiSummary(variant);
    if (r) return r;
  }
  return null;
}
