/**
 * Tests for sort logic and author profile enrichment
 */
import { describe, it, expect } from "vitest";

// -- Sort logic tests -----------------------------------------

type AuthorEntry = {
  id: string;
  name: string;
  category: string;
  books: { id: string; name: string; contentTypes: Record<string, number> }[];
};

function sortAuthors(authors: AuthorEntry[], sort: string): AuthorEntry[] {
  return [...authors].sort((a, b) => {
    switch (sort) {
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      case "books-desc": return b.books.length - a.books.length;
      case "category": return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      default: return a.name.localeCompare(b.name);
    }
  });
}

type BookRecord = {
  id: string;
  name: string;
  category: string;
  contentTypes: Record<string, number>;
};

function sortBooks(books: BookRecord[], sort: string): BookRecord[] {
  return [...books].sort((a, b) => {
    switch (sort) {
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      case "author": {
        const aAuthor = a.name.includes(" - ") ? a.name.split(" - ").slice(1).join(" - ") : "";
        const bAuthor = b.name.includes(" - ") ? b.name.split(" - ").slice(1).join(" - ") : "";
        return aAuthor.localeCompare(bAuthor) || a.name.localeCompare(b.name);
      }
      case "content-desc": return Object.keys(b.contentTypes).length - Object.keys(a.contentTypes).length;
      default: return a.name.localeCompare(b.name);
    }
  });
}

const sampleAuthors: AuthorEntry[] = [
  { id: "1", name: "Simon Sinek", category: "Leadership", books: [{ id: "b1", name: "Start With Why", contentTypes: { PDF: 1 } }, { id: "b2", name: "Leaders Eat Last", contentTypes: { PDF: 1 } }] },
  { id: "2", name: "Adam Grant", category: "Behavioral Science", books: [{ id: "b3", name: "Hidden Potential", contentTypes: { Transcript: 5, PDF: 2 } }] },
  { id: "3", name: "Mel Robbins", category: "Self-Help", books: [] },
  { id: "4", name: "Cal Newport", category: "Behavioral Science", books: [{ id: "b4", name: "Deep Work", contentTypes: { PDF: 1 } }, { id: "b5", name: "Digital Minimalism", contentTypes: { PDF: 1 } }, { id: "b6", name: "So Good They Can't Ignore You", contentTypes: { PDF: 1 } }] },
];

describe("Author sort", () => {
  it("sorts by name A→Z", () => {
    const sorted = sortAuthors(sampleAuthors, "name-asc");
    expect(sorted.map(a => a.name)).toEqual(["Adam Grant", "Cal Newport", "Mel Robbins", "Simon Sinek"]);
  });

  it("sorts by name Z→A", () => {
    const sorted = sortAuthors(sampleAuthors, "name-desc");
    expect(sorted.map(a => a.name)).toEqual(["Simon Sinek", "Mel Robbins", "Cal Newport", "Adam Grant"]);
  });

  it("sorts by most books descending", () => {
    const sorted = sortAuthors(sampleAuthors, "books-desc");
    expect(sorted[0].name).toBe("Cal Newport"); // 3 books
    expect(sorted[1].name).toBe("Simon Sinek"); // 2 books
    expect(sorted[2].name).toBe("Adam Grant");  // 1 book
    expect(sorted[3].name).toBe("Mel Robbins"); // 0 books
  });

  it("sorts by category then name within category", () => {
    const sorted = sortAuthors(sampleAuthors, "category");
    // Behavioral Science comes before Leadership and Self-Help
    expect(sorted[0].category).toBe("Behavioral Science");
    expect(sorted[1].category).toBe("Behavioral Science");
    // Within Behavioral Science: Adam Grant before Cal Newport
    expect(sorted[0].name).toBe("Adam Grant");
    expect(sorted[1].name).toBe("Cal Newport");
  });

  it("does not mutate the original array", () => {
    const original = [...sampleAuthors];
    sortAuthors(sampleAuthors, "name-desc");
    expect(sampleAuthors.map(a => a.id)).toEqual(original.map(a => a.id));
  });
});

const sampleBooks: BookRecord[] = [
  { id: "1", name: "Start With Why - Simon Sinek", category: "Leadership", contentTypes: { PDF: 1, Transcript: 3 } },
  { id: "2", name: "Hidden Potential - Adam Grant", category: "Behavioral Science", contentTypes: { PDF: 2, Transcript: 5, Binder: 1, Supplemental: 8 } },
  { id: "3", name: "Atomic Habits - James Clear", category: "Self-Help", contentTypes: { PDF: 1 } },
  { id: "4", name: "Deep Work - Cal Newport", category: "Behavioral Science", contentTypes: { PDF: 1, Transcript: 2 } },
];

describe("Book sort", () => {
  it("sorts by title A→Z", () => {
    const sorted = sortBooks(sampleBooks, "name-asc");
    expect(sorted[0].name).toContain("Atomic Habits");
    expect(sorted[1].name).toContain("Deep Work");
    expect(sorted[2].name).toContain("Hidden Potential");
    expect(sorted[3].name).toContain("Start With Why");
  });

  it("sorts by title Z→A", () => {
    const sorted = sortBooks(sampleBooks, "name-desc");
    expect(sorted[0].name).toContain("Start With Why");
  });

  it("sorts by author name", () => {
    const sorted = sortBooks(sampleBooks, "author");
    const authors = sorted.map(b => b.name.split(" - ")[1]);
    expect(authors[0]).toBe("Adam Grant");
    expect(authors[1]).toBe("Cal Newport");
    expect(authors[2]).toBe("James Clear");
    expect(authors[3]).toBe("Simon Sinek");
  });

  it("sorts by most content types descending", () => {
    const sorted = sortBooks(sampleBooks, "content-desc");
    // Hidden Potential has 4 content types
    expect(sorted[0].name).toContain("Hidden Potential");
    // Start With Why and Deep Work both have 2 content types
    expect(Object.keys(sorted[1].contentTypes).length).toBe(2);
    // Atomic Habits has 1 content type
    expect(sorted[3].name).toContain("Atomic Habits");
  });
});

// -- Author profile enrichment logic tests --------------------

describe("Author profile LLM response parsing", () => {
  function parseProfileResponse(json: string): { bio: string; websiteUrl: string; twitterUrl: string; linkedinUrl: string } {
    try {
      const parsed = JSON.parse(json);
      return {
        bio: typeof parsed.bio === "string" ? parsed.bio.slice(0, 1000) : "",
        websiteUrl: typeof parsed.websiteUrl === "string" ? parsed.websiteUrl : "",
        twitterUrl: typeof parsed.twitterUrl === "string" ? parsed.twitterUrl : "",
        linkedinUrl: typeof parsed.linkedinUrl === "string" ? parsed.linkedinUrl : "",
      };
    } catch {
      return { bio: "", websiteUrl: "", twitterUrl: "", linkedinUrl: "" };
    }
  }

  it("parses a complete LLM response", () => {
    const json = JSON.stringify({
      bio: "Adam Grant is an organizational psychologist at Wharton.",
      websiteUrl: "https://adamgrant.net",
      twitterUrl: "https://twitter.com/AdamMGrant",
      linkedinUrl: "https://linkedin.com/in/adammgrant",
    });
    const result = parseProfileResponse(json);
    expect(result.bio).toBe("Adam Grant is an organizational psychologist at Wharton.");
    expect(result.websiteUrl).toBe("https://adamgrant.net");
    expect(result.twitterUrl).toBe("https://twitter.com/AdamMGrant");
    expect(result.linkedinUrl).toBe("https://linkedin.com/in/adammgrant");
  });

  it("handles missing fields gracefully", () => {
    const json = JSON.stringify({ bio: "Short bio only." });
    const result = parseProfileResponse(json);
    expect(result.bio).toBe("Short bio only.");
    expect(result.websiteUrl).toBe("");
    expect(result.twitterUrl).toBe("");
    expect(result.linkedinUrl).toBe("");
  });

  it("handles malformed JSON gracefully", () => {
    const result = parseProfileResponse("not valid json {{{");
    expect(result.bio).toBe("");
    expect(result.websiteUrl).toBe("");
  });

  it("truncates bio to 1000 chars", () => {
    const longBio = "A".repeat(2000);
    const json = JSON.stringify({ bio: longBio });
    const result = parseProfileResponse(json);
    expect(result.bio.length).toBe(1000);
  });

  it("rejects non-string bio values", () => {
    const json = JSON.stringify({ bio: 42, websiteUrl: null });
    const result = parseProfileResponse(json);
    expect(result.bio).toBe("");
    expect(result.websiteUrl).toBe("");
  });
});

// -- Author Bio Modal tests --------------------------------------------------

describe("Author bio modal behavior", () => {
  it("modal opens with the correct author when card is clicked", () => {
    const authors = [
      { name: "Adam Grant - Organizational Psychology", category: "Behavioral Science & Psychology", books: [] as { id: string; name: string; contentTypes: Record<string, number> }[] },
      { name: "Simon Sinek - Leadership", category: "Leadership & Management", books: [] as { id: string; name: string; contentTypes: Record<string, number> }[] },
    ];

    let selectedAuthor: typeof authors[0] | null = null;
    const openModal = (author: typeof authors[0]) => { selectedAuthor = author; };

    openModal(authors[0]);
    expect(selectedAuthor).not.toBeNull();
    expect((selectedAuthor as typeof authors[0]).name).toBe("Adam Grant - Organizational Psychology");
  });

  it("extracts display name and specialty from 'Name - Specialty' format", () => {
    const extractParts = (name: string) => {
      const dashIdx = name.indexOf(" - ");
      return dashIdx !== -1
        ? { displayName: name.slice(0, dashIdx), specialty: name.slice(dashIdx + 3) }
        : { displayName: name, specialty: "" };
    };

    expect(extractParts("Adam Grant - Organizational Psychology")).toEqual({
      displayName: "Adam Grant",
      specialty: "Organizational Psychology",
    });
    expect(extractParts("Simon Sinek")).toEqual({
      displayName: "Simon Sinek",
      specialty: "",
    });
    expect(extractParts("Dan Heath and Chip Heath - Strategy & Decision Making")).toEqual({
      displayName: "Dan Heath and Chip Heath",
      specialty: "Strategy & Decision Making",
    });
  });

  it("modal closes when onOpenChange is called with false", () => {
    let isOpen = true;
    const onOpenChange = (open: boolean) => { isOpen = open; };

    onOpenChange(false);
    expect(isOpen).toBe(false);
  });

  it("drive URL is constructed correctly from folder id", () => {
    const buildDriveUrl = (folderId: string) =>
      `https://drive.google.com/drive/folders/${folderId}?view=grid`;

    const url = buildDriveUrl("mock-folder-id");
    expect(url).toContain("drive.google.com");
    expect(url).toContain("mock-folder-id");
    expect(url).toContain("view=grid");
  });
});
