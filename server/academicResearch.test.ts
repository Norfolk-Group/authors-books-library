/**
 * Vitest tests for Academic Research Enrichment (OpenAlex + Semantic Scholar)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  AcademicAuthorProfile,
  AcademicPaper,
  AcademicEnrichmentResult,
} from "./enrichment/academicResearch";

// ── Mock fetch globally ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Reset mocks before each test
beforeEach(() => {
  mockFetch.mockReset();
});

// ── Helper to create mock Response ───────────────────────────────────────────

function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
  };
}

// ── Type Tests ───────────────────────────────────────────────────────────────

describe("Academic Research — Types", () => {
  it("AcademicAuthorProfile has required fields", () => {
    const profile: AcademicAuthorProfile = {
      source: "openalex",
      authorId: "A12345",
      name: "Adam Grant",
      affiliations: ["Wharton School"],
      hIndex: 63,
      i10Index: 100,
      citationCount: 26872,
      worksCount: 133,
      orcid: "0000-0001-2345-6789",
    };
    expect(profile.source).toBe("openalex");
    expect(profile.hIndex).toBe(63);
    expect(profile.citationCount).toBe(26872);
  });

  it("AcademicPaper has required fields", () => {
    const paper: AcademicPaper = {
      source: "openalex",
      paperId: "W12345",
      title: "The dynamics of proactivity at work",
      year: 2008,
      citationCount: 1936,
      doi: "10.1234/test",
      isOpenAccess: true,
      pdfUrl: "https://example.com/paper.pdf",
      journal: "Research in Organizational Behavior",
      type: "article",
      authors: ["Adam Grant", "Sharon Parker"],
    };
    expect(paper.citationCount).toBe(1936);
    expect(paper.isOpenAccess).toBe(true);
  });

  it("AcademicEnrichmentResult can have null authorProfile", () => {
    const result: AcademicEnrichmentResult = {
      authorProfile: null,
      topPapers: [],
      bookRelatedPapers: [],
      fetchedAt: new Date().toISOString(),
      error: "Author not found",
    };
    expect(result.authorProfile).toBeNull();
    expect(result.topPapers).toHaveLength(0);
  });

  it("AcademicEnrichmentResult with full data", () => {
    const result: AcademicEnrichmentResult = {
      authorProfile: {
        source: "openalex",
        authorId: "A12345",
        name: "Adam Grant",
        affiliations: ["Wharton"],
        hIndex: 63,
        i10Index: 100,
        citationCount: 26872,
        worksCount: 133,
        orcid: null,
      },
      topPapers: [
        {
          source: "openalex",
          paperId: "W1",
          title: "Test Paper",
          year: 2020,
          citationCount: 500,
          doi: null,
          isOpenAccess: false,
          pdfUrl: null,
          journal: "Test Journal",
          type: "article",
          authors: ["Adam Grant"],
        },
      ],
      bookRelatedPapers: [],
      fetchedAt: new Date().toISOString(),
    };
    expect(result.authorProfile?.hIndex).toBe(63);
    expect(result.topPapers).toHaveLength(1);
  });
});

// ── Function Tests ───────────────────────────────────────────────────────────

describe("Academic Research — OpenAlex Author Search", () => {
  it("returns author profile from OpenAlex response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: "https://openalex.org/A5023888391",
            display_name: "Adam M. Grant",
            affiliations: [
              { institution: { display_name: "University of Pennsylvania" } },
            ],
            summary_stats: { h_index: 63, i10_index: 100 },
            cited_by_count: 26872,
            works_count: 133,
            orcid: "https://orcid.org/0000-0001-2345-6789",
          },
        ],
      })
    );

    const { searchAuthorOpenAlex } = await import("./enrichment/academicResearch");
    const result = await searchAuthorOpenAlex("Adam Grant");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("openalex");
    expect(result!.authorId).toBe("A5023888391");
    expect(result!.name).toBe("Adam M. Grant");
    expect(result!.hIndex).toBe(63);
    expect(result!.citationCount).toBe(26872);
    expect(result!.affiliations).toContain("University of Pennsylvania");
  });

  it("returns null when no results found", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ results: [] })
    );

    const { searchAuthorOpenAlex } = await import("./enrichment/academicResearch");
    const result = await searchAuthorOpenAlex("Nonexistent Author XYZ");
    expect(result).toBeNull();
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({}, 500)
    );

    const { searchAuthorOpenAlex } = await import("./enrichment/academicResearch");
    const result = await searchAuthorOpenAlex("Adam Grant");
    expect(result).toBeNull();
  });

  it("handles network timeout gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("AbortError: timeout"));

    const { searchAuthorOpenAlex } = await import("./enrichment/academicResearch");
    const result = await searchAuthorOpenAlex("Adam Grant");
    expect(result).toBeNull();
  });
});

describe("Academic Research — OpenAlex Papers", () => {
  it("returns top papers sorted by citation count", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: "https://openalex.org/W1234",
            title: "Paper A",
            publication_year: 2020,
            cited_by_count: 500,
            doi: "https://doi.org/10.1234/a",
            type: "article",
            primary_location: {
              is_oa: true,
              pdf_url: "https://example.com/a.pdf",
              source: { display_name: "Journal A" },
            },
            authorships: [
              { author: { display_name: "Adam Grant" } },
            ],
          },
          {
            id: "https://openalex.org/W5678",
            title: "Paper B",
            publication_year: 2018,
            cited_by_count: 300,
            doi: null,
            type: "article",
            primary_location: {
              is_oa: false,
              pdf_url: null,
              source: { display_name: "Journal B" },
            },
            authorships: [
              { author: { display_name: "Adam Grant" } },
              { author: { display_name: "Coauthor" } },
            ],
          },
        ],
      })
    );

    const { getTopPapersOpenAlex } = await import("./enrichment/academicResearch");
    const papers = await getTopPapersOpenAlex("A5023888391", 10);

    expect(papers).toHaveLength(2);
    expect(papers[0].title).toBe("Paper A");
    expect(papers[0].citationCount).toBe(500);
    expect(papers[0].doi).toBe("10.1234/a");
    expect(papers[0].isOpenAccess).toBe(true);
    expect(papers[1].title).toBe("Paper B");
    expect(papers[1].authors).toContain("Coauthor");
  });

  it("returns empty array on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { getTopPapersOpenAlex } = await import("./enrichment/academicResearch");
    const papers = await getTopPapersOpenAlex("A5023888391", 10);
    expect(papers).toEqual([]);
  });
});

describe("Academic Research — Book-Related Papers", () => {
  it("deduplicates papers across multiple book searches", async () => {
    const paperResponse = mockJsonResponse({
      results: [
        {
          id: "https://openalex.org/W1111",
          title: "Shared Paper",
          publication_year: 2019,
          cited_by_count: 200,
          doi: null,
          type: "article",
          primary_location: { is_oa: false, pdf_url: null, source: null },
          authorships: [],
        },
      ],
    });

    // Both book searches return the same paper
    mockFetch.mockResolvedValueOnce(paperResponse);
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: "https://openalex.org/W1111", // Same paper
            title: "Shared Paper",
            publication_year: 2019,
            cited_by_count: 200,
            doi: null,
            type: "article",
            primary_location: { is_oa: false, pdf_url: null, source: null },
            authorships: [],
          },
        ],
      })
    );

    const { searchBookRelatedPapers } = await import("./enrichment/academicResearch");
    const papers = await searchBookRelatedPapers(
      "Adam Grant",
      ["Think Again", "Give and Take"],
      5
    );

    // Should deduplicate — only 1 unique paper
    expect(papers).toHaveLength(1);
    expect(papers[0].paperId).toBe("W1111");
  });

  it("limits to 3 books max", async () => {
    // Set up mocks for 3 book searches (the function caps at 3)
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ results: [] })
      );
    }

    const { searchBookRelatedPapers } = await import("./enrichment/academicResearch");
    await searchBookRelatedPapers(
      "Author",
      ["Book1", "Book2", "Book3", "Book4", "Book5"],
      5
    );

    // Should only call fetch 3 times (capped at 3 books)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe("Academic Research — Semantic Scholar Fallback", () => {
  it("returns author profile from S2 response", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        data: [
          {
            authorId: "12345",
            name: "Adam Grant",
            affiliations: ["Wharton School"],
            paperCount: 133,
            citationCount: 26000,
            hIndex: 60,
          },
        ],
      })
    );

    const { searchAuthorSemanticScholar } = await import("./enrichment/academicResearch");
    const result = await searchAuthorSemanticScholar("Adam Grant");

    expect(result).not.toBeNull();
    expect(result!.source).toBe("semantic_scholar");
    expect(result!.authorId).toBe("12345");
    expect(result!.i10Index).toBe(0); // S2 doesn't provide i10
  });

  it("returns null when S2 has no results", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ data: [] })
    );

    const { searchAuthorSemanticScholar } = await import("./enrichment/academicResearch");
    const result = await searchAuthorSemanticScholar("Unknown Author");
    expect(result).toBeNull();
  });
});

describe("Academic Research — Combined Enrichment", () => {
  it("enrichAcademicProfile uses OpenAlex first, then fetches papers", async () => {
    // Mock 1: OpenAlex author search
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: "https://openalex.org/A123",
            display_name: "Adam Grant",
            affiliations: [],
            summary_stats: { h_index: 63, i10_index: 100 },
            cited_by_count: 26000,
            works_count: 133,
            orcid: null,
          },
        ],
      })
    );

    // Mock 2: Top papers
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: "https://openalex.org/W999",
            title: "Top Paper",
            publication_year: 2021,
            cited_by_count: 1000,
            doi: null,
            type: "article",
            primary_location: { is_oa: true, pdf_url: null, source: { display_name: "Nature" } },
            authorships: [{ author: { display_name: "Adam Grant" } }],
          },
        ],
      })
    );

    // Mock 3: Book-related papers
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ results: [] })
    );

    const { enrichAcademicProfile } = await import("./enrichment/academicResearch");
    const result = await enrichAcademicProfile("Adam Grant", ["Think Again"]);

    expect(result.authorProfile).not.toBeNull();
    expect(result.authorProfile!.source).toBe("openalex");
    expect(result.topPapers).toHaveLength(1);
    expect(result.topPapers[0].title).toBe("Top Paper");
    expect(result.fetchedAt).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it("falls back to Semantic Scholar when OpenAlex fails", async () => {
    // Mock 1: OpenAlex returns empty
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ results: [] })
    );

    // Mock 2: Semantic Scholar returns result
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        data: [
          {
            authorId: "S2-456",
            name: "Niche Author",
            affiliations: [],
            paperCount: 10,
            citationCount: 500,
            hIndex: 8,
          },
        ],
      })
    );

    const { enrichAcademicProfile } = await import("./enrichment/academicResearch");
    const result = await enrichAcademicProfile("Niche Author");

    expect(result.authorProfile).not.toBeNull();
    expect(result.authorProfile!.source).toBe("semantic_scholar");
    // No papers fetched for S2 (only OpenAlex has paper fetching)
    expect(result.topPapers).toHaveLength(0);
  });

  it("returns empty result when both sources fail", async () => {
    // Both return empty
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ results: [] }));
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    const { enrichAcademicProfile } = await import("./enrichment/academicResearch");
    const result = await enrichAcademicProfile("Completely Unknown Person");

    expect(result.authorProfile).toBeNull();
    expect(result.topPapers).toHaveLength(0);
    expect(result.bookRelatedPapers).toHaveLength(0);
    expect(result.fetchedAt).toBeTruthy();
  });
});
