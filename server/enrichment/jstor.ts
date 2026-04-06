/**
 * jstor.ts — JSTOR academic content helper
 *
 * JSTOR does not provide a public API for general searches.
 * This helper uses:
 *  1. Google Scholar RSS (via Google News RSS targeting scholar.google.com)
 *     for finding academic papers related to an author or book
 *  2. CrossRef API (free, no key) for DOI-based metadata lookup
 *  3. Semantic Scholar API (free, no key) for academic paper search
 *
 * Provides:
 *  - searchJSTOR(query, limit?)              → academic papers via Semantic Scholar
 *  - getJSTORByDOI(doi)                      → paper metadata via CrossRef
 *  - searchAcademicPapers(authorName, limit?) → papers by author
 *  - searchBookAcademicCitations(bookTitle)   → academic citations of a book
 */

const CROSSREF_BASE = "https://api.crossref.org/works";
const SEMANTIC_BASE = "https://api.semanticscholar.org/graph/v1";
const TIMEOUT_MS = 12_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcademicPaper {
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  abstract?: string;
  citations?: number;
  journal?: string;
  openAccess?: boolean;
  source: "crossref" | "semantic_scholar" | "google_scholar";
}

export interface AcademicSearchResult {
  totalResults: number;
  papers: AcademicPaper[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RCLibraryBot/1.0 (mailto:library@example.com)",
        "Accept": "application/json",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── CrossRef ─────────────────────────────────────────────────────────────────

/**
 * Look up a paper by DOI via CrossRef (free, no key required).
 */
export async function getJSTORByDOI(doi: string): Promise<AcademicPaper | null> {
  if (!doi?.trim()) return null;
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
  const data = await fetchJson<{
    status?: string;
    message?: {
      title?: string[];
      author?: Array<{ given?: string; family?: string }>;
      published?: { "date-parts"?: number[][] };
      DOI?: string;
      URL?: string;
      abstract?: string;
      "is-referenced-by-count"?: number;
      "container-title"?: string[];
    };
  }>(`${CROSSREF_BASE}/${encodeURIComponent(cleanDoi)}`);
  if (!data?.message) return null;
  const m = data.message;
  const authors = (m.author ?? []).map((a) =>
    [a.given, a.family].filter(Boolean).join(" ")
  );
  const year = m.published?.["date-parts"]?.[0]?.[0];
  return {
    title: m.title?.[0] ?? "Unknown Title",
    authors,
    year,
    doi: m.DOI,
    url: m.URL ?? (m.DOI ? `https://doi.org/${m.DOI}` : undefined),
    abstract: m.abstract?.replace(/<[^>]+>/g, "").trim(),
    citations: m["is-referenced-by-count"],
    journal: m["container-title"]?.[0],
    source: "crossref",
  };
}

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

/**
 * Search academic papers via Semantic Scholar API (free, no key required).
 */
export async function searchJSTOR(
  query: string,
  limit = 5
): Promise<AcademicSearchResult | null> {
  if (!query?.trim()) return null;
  const fields = "title,authors,year,externalIds,openAccessPdf,citationCount,venue,abstract";
  const url = `${SEMANTIC_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
  const data = await fetchJson<{
    total?: number;
    data?: Array<{
      paperId?: string;
      title?: string;
      authors?: Array<{ name?: string }>;
      year?: number;
      externalIds?: { DOI?: string; ArXiv?: string };
      openAccessPdf?: { url?: string };
      citationCount?: number;
      venue?: string;
      abstract?: string;
    }>;
  }>(url);
  if (!data) return null;
  const papers: AcademicPaper[] = (data.data ?? []).map((p) => ({
    title: p.title ?? "Unknown Title",
    authors: (p.authors ?? []).map((a) => a.name ?? ""),
    year: p.year,
    doi: p.externalIds?.DOI,
    url: p.openAccessPdf?.url ??
         (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : undefined),
    abstract: p.abstract?.slice(0, 300),
    citations: p.citationCount,
    journal: p.venue,
    openAccess: p.openAccessPdf?.url != null,
    source: "semantic_scholar" as const,
  }));
  return {
    totalResults: data.total ?? papers.length,
    papers,
  };
}

/**
 * Search for academic papers authored by a specific person.
 */
export async function searchAcademicPapers(
  authorName: string,
  limit = 5
): Promise<AcademicSearchResult | null> {
  if (!authorName?.trim()) return null;
  const fields = "title,authors,year,externalIds,openAccessPdf,citationCount,venue";
  const url = `${SEMANTIC_BASE}/author/search?query=${encodeURIComponent(authorName)}&fields=papers.${fields}&limit=1`;
  const data = await fetchJson<{
    data?: Array<{
      authorId?: string;
      papers?: Array<{
        paperId?: string;
        title?: string;
        authors?: Array<{ name?: string }>;
        year?: number;
        externalIds?: { DOI?: string };
        openAccessPdf?: { url?: string };
        citationCount?: number;
        venue?: string;
      }>;
    }>;
  }>(url);
  if (!data?.data?.[0]) {
    // Fall back to general search
    return searchJSTOR(authorName, limit);
  }
  const authorData = data.data[0];
  const papers: AcademicPaper[] = (authorData.papers ?? []).slice(0, limit).map((p) => ({
    title: p.title ?? "Unknown Title",
    authors: (p.authors ?? []).map((a) => a.name ?? ""),
    year: p.year,
    doi: p.externalIds?.DOI,
    url: p.openAccessPdf?.url ??
         (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : undefined),
    citations: p.citationCount,
    journal: p.venue,
    openAccess: p.openAccessPdf?.url != null,
    source: "semantic_scholar" as const,
  }));
  return {
    totalResults: papers.length,
    papers,
  };
}

/**
 * Find academic citations and reviews of a book by title.
 * Uses Semantic Scholar to find papers that reference the book.
 */
export async function searchBookAcademicCitations(
  bookTitle: string,
  limit = 5
): Promise<AcademicSearchResult | null> {
  if (!bookTitle?.trim()) return null;
  // Search for the book itself first
  const bookSearch = await searchJSTOR(`"${bookTitle}"`, 1);
  if (!bookSearch || bookSearch.papers.length === 0) {
    // Fall back to general title search
    return searchJSTOR(bookTitle, limit);
  }
  // Get citations for the first matching paper
  const firstPaper = bookSearch.papers[0];
  if (!firstPaper.doi) {
    return searchJSTOR(bookTitle, limit);
  }
  const fields = "title,authors,year,externalIds,openAccessPdf,citationCount,venue";
  const citationUrl = `${SEMANTIC_BASE}/paper/DOI:${encodeURIComponent(firstPaper.doi)}/citations?fields=${fields}&limit=${limit}`;
  const data = await fetchJson<{
    data?: Array<{
      citingPaper?: {
        title?: string;
        authors?: Array<{ name?: string }>;
        year?: number;
        externalIds?: { DOI?: string };
        openAccessPdf?: { url?: string };
        citationCount?: number;
        venue?: string;
      };
    }>;
  }>(citationUrl);
  if (!data?.data) {
    return searchJSTOR(bookTitle, limit);
  }
  const papers: AcademicPaper[] = (data.data ?? [])
    .map((c) => c.citingPaper)
    .filter(Boolean)
    .map((p) => ({
      title: p!.title ?? "Unknown Title",
      authors: (p!.authors ?? []).map((a) => a.name ?? ""),
      year: p!.year,
      doi: p!.externalIds?.DOI,
      url: p!.openAccessPdf?.url ??
           (p!.externalIds?.DOI ? `https://doi.org/${p!.externalIds.DOI}` : undefined),
      citations: p!.citationCount,
      journal: p!.venue,
      openAccess: p!.openAccessPdf?.url != null,
      source: "semantic_scholar" as const,
    }));
  return {
    totalResults: papers.length,
    papers,
  };
}
