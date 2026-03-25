/**
 * Academic Research Enrichment — OpenAlex + Semantic Scholar
 *
 * Searches for an author's academic publications, h-index, citation count,
 * and top papers. Uses OpenAlex as primary (free, generous limits) and
 * Semantic Scholar as fallback.
 */

import { AXIOS_TIMEOUT_MS } from "@shared/const";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AcademicAuthorProfile {
  source: "openalex" | "semantic_scholar";
  authorId: string;
  name: string;
  affiliations: string[];
  hIndex: number;
  i10Index: number;
  citationCount: number;
  worksCount: number;
  orcid: string | null;
}

export interface AcademicPaper {
  source: "openalex" | "semantic_scholar";
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  doi: string | null;
  isOpenAccess: boolean;
  pdfUrl: string | null;
  journal: string | null;
  type: string | null;
  authors: string[];
}

export interface AcademicEnrichmentResult {
  authorProfile: AcademicAuthorProfile | null;
  topPapers: AcademicPaper[];
  bookRelatedPapers: AcademicPaper[];
  fetchedAt: string;
  error?: string;
}

// ── OpenAlex API ──────────────────────────────────────────────────────────────

const OPENALEX_BASE = "https://api.openalex.org";
const OPENALEX_EMAIL = "admin@norfolkai.vip"; // polite pool for higher limits

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NCGLibrary/1.0 (mailto:admin@norfolkai.vip)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchAuthorOpenAlex(
  authorName: string
): Promise<AcademicAuthorProfile | null> {
  try {
    const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(authorName)}&per_page=5&mailto=${OPENALEX_EMAIL}`;
    const data = await fetchJson(url);
    if (!data.results?.length) return null;

    // Pick the best match — highest relevance score
    const best = data.results[0];
    const oaId = best.id?.replace("https://openalex.org/", "") ?? "";

    return {
      source: "openalex",
      authorId: oaId,
      name: best.display_name ?? authorName,
      affiliations: (best.affiliations ?? [])
        .slice(0, 3)
        .map((a: any) => a.institution?.display_name)
        .filter(Boolean),
      hIndex: best.summary_stats?.h_index ?? 0,
      i10Index: best.summary_stats?.i10_index ?? 0,
      citationCount: best.cited_by_count ?? 0,
      worksCount: best.works_count ?? 0,
      orcid: best.orcid?.replace("https://orcid.org/", "") ?? null,
    };
  } catch (err: any) {
    console.error(`[AcademicResearch] OpenAlex author search failed for "${authorName}":`, err.message);
    return null;
  }
}

export async function getTopPapersOpenAlex(
  authorId: string,
  limit: number = 10
): Promise<AcademicPaper[]> {
  try {
    const url = `${OPENALEX_BASE}/works?filter=authorships.author.id:${authorId}&sort=cited_by_count:desc&per_page=${limit}&select=id,title,publication_year,cited_by_count,doi,type,primary_location,authorships&mailto=${OPENALEX_EMAIL}`;
    const data = await fetchJson(url);
    if (!data.results?.length) return [];

    return data.results.map((w: any) => ({
      source: "openalex" as const,
      paperId: w.id?.replace("https://openalex.org/", "") ?? "",
      title: w.title ?? "Untitled",
      year: w.publication_year ?? null,
      citationCount: w.cited_by_count ?? 0,
      doi: w.doi?.replace("https://doi.org/", "") ?? null,
      isOpenAccess: w.primary_location?.is_oa ?? false,
      pdfUrl: w.primary_location?.pdf_url ?? null,
      journal: w.primary_location?.source?.display_name ?? null,
      type: w.type ?? null,
      authors: (w.authorships ?? [])
        .slice(0, 5)
        .map((a: any) => a.author?.display_name)
        .filter(Boolean),
    }));
  } catch (err: any) {
    console.error(`[AcademicResearch] OpenAlex papers fetch failed for "${authorId}":`, err.message);
    return [];
  }
}

export async function searchBookRelatedPapers(
  authorName: string,
  bookTitles: string[],
  limit: number = 5
): Promise<AcademicPaper[]> {
  const allPapers: AcademicPaper[] = [];

  for (const bookTitle of bookTitles.slice(0, 3)) {
    try {
      // Search for papers related to the book's topic by the same author
      const query = `${authorName} ${bookTitle}`;
      const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,title,publication_year,cited_by_count,doi,type,primary_location,authorships&mailto=${OPENALEX_EMAIL}`;
      const data = await fetchJson(url);

      if (data.results?.length) {
        const papers = data.results.map((w: any) => ({
          source: "openalex" as const,
          paperId: w.id?.replace("https://openalex.org/", "") ?? "",
          title: w.title ?? "Untitled",
          year: w.publication_year ?? null,
          citationCount: w.cited_by_count ?? 0,
          doi: w.doi?.replace("https://doi.org/", "") ?? null,
          isOpenAccess: w.primary_location?.is_oa ?? false,
          pdfUrl: w.primary_location?.pdf_url ?? null,
          journal: w.primary_location?.source?.display_name ?? null,
          type: w.type ?? null,
          authors: (w.authorships ?? [])
            .slice(0, 5)
            .map((a: any) => a.author?.display_name)
            .filter(Boolean),
        }));
        allPapers.push(...papers);
      }
    } catch (err: any) {
      console.error(`[AcademicResearch] Book-related search failed for "${bookTitle}":`, err.message);
    }
  }

  // Deduplicate by paperId
  const seen = new Set<string>();
  return allPapers.filter((p) => {
    if (seen.has(p.paperId)) return false;
    seen.add(p.paperId);
    return true;
  });
}

// ── Semantic Scholar Fallback ─────────────────────────────────────────────────

const S2_BASE = "https://api.semanticscholar.org/graph/v1";

export async function searchAuthorSemanticScholar(
  authorName: string
): Promise<AcademicAuthorProfile | null> {
  try {
    const url = `${S2_BASE}/author/search?query=${encodeURIComponent(authorName)}&fields=authorId,name,affiliations,paperCount,citationCount,hIndex`;
    const data = await fetchJson(url);
    if (!data.data?.length) return null;

    const best = data.data[0];
    return {
      source: "semantic_scholar",
      authorId: best.authorId ?? "",
      name: best.name ?? authorName,
      affiliations: (best.affiliations ?? []).slice(0, 3),
      hIndex: best.hIndex ?? 0,
      i10Index: 0, // S2 doesn't provide i10
      citationCount: best.citationCount ?? 0,
      worksCount: best.paperCount ?? 0,
      orcid: null,
    };
  } catch (err: any) {
    console.error(`[AcademicResearch] S2 author search failed for "${authorName}":`, err.message);
    return null;
  }
}

// ── Combined Enrichment ───────────────────────────────────────────────────────

export async function enrichAcademicProfile(
  authorName: string,
  bookTitles: string[] = []
): Promise<AcademicEnrichmentResult> {
  const fetchedAt = new Date().toISOString();

  // Try OpenAlex first (more reliable, no rate limit issues)
  let authorProfile = await searchAuthorOpenAlex(authorName);

  // Fallback to Semantic Scholar
  if (!authorProfile) {
    authorProfile = await searchAuthorSemanticScholar(authorName);
  }

  let topPapers: AcademicPaper[] = [];
  let bookRelatedPapers: AcademicPaper[] = [];

  if (authorProfile?.source === "openalex") {
    // Fetch top papers and book-related papers in parallel
    const [top, related] = await Promise.all([
      getTopPapersOpenAlex(authorProfile.authorId, 10),
      bookTitles.length > 0
        ? searchBookRelatedPapers(authorName, bookTitles, 5)
        : Promise.resolve([]),
    ]);
    topPapers = top;
    bookRelatedPapers = related;
  }

  return {
    authorProfile,
    topPapers,
    bookRelatedPapers,
    fetchedAt,
  };
}
