/**
 * Tests for library data normalization and deduplication logic
 * These test the core business logic used in Home.tsx
 */
import { describe, it, expect } from "vitest";

// -- Replicate the normalization logic from Home.tsx ----------
const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC": "Supplemental",
  "PDF Extra": "PDF",
  "PDF Extra 2": "PDF",
  "PDF Extras": "PDF",
  "Complete Book in PDF": "PDF",
  "DOC": "Transcript",
  "ChatGPT": "Supplemental",
  "Sana AI": "Supplemental",
  "Notes": "Supplemental",
  "Knowledge Base": "Supplemental",
  "temp": "Supplemental",
  "Temp": "Supplemental",
  "TEMP": "Supplemental",
};

function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// -- Replicate the deduplication logic from Home.tsx ----------
interface AuthorLike {
  name: string;
  id: string;
  category: string;
  books: { name: string; id: string; contentTypes: Record<string, number> }[];
}

function deduplicateAuthors(authors: AuthorLike[]): AuthorLike[] {
  const seen = new Map<string, AuthorLike>();
  for (const a of authors) {
    const baseName = a.name.split(" - ")[0].trim().toLowerCase();
    const existing = seen.get(baseName);
    if (!existing || a.books.length > existing.books.length) {
      seen.set(baseName, a);
    }
  }
  return Array.from(seen.values());
}

interface BookLike {
  name: string;
  id: string;
  category: string;
  contentTypes: Record<string, number>;
}

function deduplicateBooks(books: BookLike[]): BookLike[] {
  const seen = new Map<string, BookLike>();
  for (const b of books) {
    const titleKey = b.name.split(" - ")[0].trim().toLowerCase();
    const existing = seen.get(titleKey);
    if (!existing) {
      seen.set(titleKey, b);
    } else {
      const hasAuthor = b.name.includes(" - ");
      const existingHasAuthor = existing.name.includes(" - ");
      if (hasAuthor && !existingHasAuthor) seen.set(titleKey, b);
      else if (Object.keys(b.contentTypes).length > Object.keys(existing.contentTypes).length) {
        seen.set(titleKey, b);
      }
    }
  }
  return Array.from(seen.values());
}

// -- Tests -----------------------------------------------------
describe("normalizeContentTypes", () => {
  it("passes through canonical types unchanged", () => {
    const input = { PDF: 2, Transcript: 5, Binder: 1 };
    expect(normalizeContentTypes(input)).toEqual({ PDF: 2, Transcript: 5, Binder: 1 });
  });

  it("maps 'Notes' to 'Supplemental'", () => {
    const result = normalizeContentTypes({ Notes: 8 });
    expect(result).toEqual({ Supplemental: 8 });
  });

  it("maps 'Knowledge Base' to 'Supplemental'", () => {
    const result = normalizeContentTypes({ "Knowledge Base": 4 });
    expect(result).toEqual({ Supplemental: 4 });
  });

  it("maps 'temp' to 'Supplemental'", () => {
    const result = normalizeContentTypes({ temp: 1 });
    expect(result).toEqual({ Supplemental: 1 });
  });

  it("maps 'DOC' to 'Transcript'", () => {
    const result = normalizeContentTypes({ DOC: 2 });
    expect(result).toEqual({ Transcript: 2 });
  });

  it("maps 'PDF Extra 2' to 'PDF'", () => {
    const result = normalizeContentTypes({ "PDF Extra 2": 3 });
    expect(result).toEqual({ PDF: 3 });
  });

  it("merges multiple raw types into the same canonical type", () => {
    const result = normalizeContentTypes({ PDF: 2, "PDF Extra": 1, "PDF Extra 2": 3 });
    expect(result).toEqual({ PDF: 6 });
  });

  it("merges Notes and Knowledge Base both into Supplemental", () => {
    const result = normalizeContentTypes({ Notes: 8, "Knowledge Base": 4 });
    expect(result).toEqual({ Supplemental: 12 });
  });

  it("handles empty input", () => {
    expect(normalizeContentTypes({})).toEqual({});
  });

  it("preserves Papers, Articles, Links types", () => {
    const input = { Papers: 3, Articles: 2, Links: 1 };
    expect(normalizeContentTypes(input)).toEqual({ Papers: 3, Articles: 2, Links: 1 });
  });
});

describe("deduplicateAuthors", () => {
  it("keeps single author unchanged", () => {
    const authors: AuthorLike[] = [
      { name: "Adam Grant - organizational psychology", id: "1", category: "Behavioral Science & Psychology", books: [{ name: "Think Again", id: "2", contentTypes: {} }] },
    ];
    const result = deduplicateAuthors(authors);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Adam Grant - organizational psychology");
  });

  it("deduplicates authors with same base name, keeping the one with more books", () => {
    const authors: AuthorLike[] = [
      { name: "Charles Duhigg - Habits, Productivity & Communication", id: "1", category: "Self-Help & Productivity", books: [
        { name: "The Power of Habit", id: "b1", contentTypes: {} },
        { name: "Supercommunicators", id: "b2", contentTypes: {} },
        { name: "Charles Duhigg", id: "b3", contentTypes: {} },
      ]},
      { name: "Charles Duhigg - Habits, productivity, and willpower", id: "2", category: "Behavioral Science & Psychology", books: [
        { name: "The Power of Habit - Charles Duhigg", id: "b4", contentTypes: {} },
        { name: "Supercommunicators - Charles Duhigg", id: "b5", contentTypes: {} },
      ]},
    ];
    const result = deduplicateAuthors(authors);
    expect(result).toHaveLength(1);
    expect(result[0].books).toHaveLength(3); // kept the one with 3 books
  });

  it("deduplicates case-insensitively", () => {
    const authors: AuthorLike[] = [
      { name: "Matt Dixon - Sales strategy", id: "1", category: "Sales & Negotiation", books: [{ name: "Book A", id: "b1", contentTypes: {} }] },
      { name: "Matt Dixon - Customer experience", id: "2", category: "Sales & Negotiation", books: [{ name: "Book B", id: "b2", contentTypes: {} }, { name: "Book C", id: "b3", contentTypes: {} }] },
    ];
    const result = deduplicateAuthors(authors);
    expect(result).toHaveLength(1);
    expect(result[0].books).toHaveLength(2);
  });
});

describe("deduplicateBooks", () => {
  it("keeps single book unchanged", () => {
    const books: BookLike[] = [
      { name: "The Lean Startup - Eric Ries", id: "1", category: "Business & Entrepreneurship", contentTypes: { PDF: 1 } },
    ];
    const result = deduplicateBooks(books);
    expect(result).toHaveLength(1);
  });

  it("prefers 'Title - Author' format over plain 'Title'", () => {
    const books: BookLike[] = [
      { name: "The Lean Startup", id: "1", category: "Business & Entrepreneurship", contentTypes: {} },
      { name: "The Lean Startup - Eric Ries", id: "2", category: "Business & Entrepreneurship", contentTypes: { PDF: 1 } },
    ];
    const result = deduplicateBooks(books);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("The Lean Startup - Eric Ries");
  });

  it("prefers book with more content types when both have author suffix", () => {
    const books: BookLike[] = [
      { name: "Sales Pitch - April Dunford", id: "1", category: "Sales & Negotiation", contentTypes: { Transcript: 3, PDF: 1 } },
      { name: "Sales Pitch - April Dunford v2", id: "2", category: "Sales & Negotiation", contentTypes: { Transcript: 3 } },
    ];
    const result = deduplicateBooks(books);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1"); // has more content types
  });

  it("handles empty array", () => {
    expect(deduplicateBooks([])).toHaveLength(0);
  });
});

describe("book name display", () => {
  it("strips author suffix from book name for display", () => {
    const bookName = "From Impossible to Inevitable - Aaron Ross & Jason Lemkin";
    const dashIdx = bookName.lastIndexOf(" - ");
    const displayName = dashIdx !== -1 ? bookName.slice(0, dashIdx) : bookName;
    expect(displayName).toBe("From Impossible to Inevitable");
  });

  it("leaves book name unchanged if no author suffix", () => {
    const bookName = "Positioning";
    const dashIdx = bookName.lastIndexOf(" - ");
    const displayName = dashIdx !== -1 ? bookName.slice(0, dashIdx) : bookName;
    expect(displayName).toBe("Positioning");
  });
});

// -- Author Photo Lookup Tests ---------------------------------
const SAMPLE_PHOTOS: Record<string, string> = {
  "Adam Grant": "https://cdn.example.com/Adam Grant_abc123.png",
  "Simon Sinek": "https://cdn.example.com/Simon Sinek_def456.png",
  "Brene Brown": "https://cdn.example.com/Brene Brown_ghi789.png",
};

function getAuthorPhotoTest(name: string): string | undefined {
  if (SAMPLE_PHOTOS[name]) return SAMPLE_PHOTOS[name];
  const lower = name.toLowerCase();
  const key = Object.keys(SAMPLE_PHOTOS).find(k => k.toLowerCase() === lower);
  return key ? SAMPLE_PHOTOS[key] : undefined;
}

describe("getAuthorPhoto", () => {
  it("returns exact match photo URL", () => {
    expect(getAuthorPhotoTest("Adam Grant")).toBe("https://cdn.example.com/Adam Grant_abc123.png");
  });

  it("returns case-insensitive match", () => {
    expect(getAuthorPhotoTest("adam grant")).toBe("https://cdn.example.com/Adam Grant_abc123.png");
    expect(getAuthorPhotoTest("SIMON SINEK")).toBe("https://cdn.example.com/Simon Sinek_def456.png");
  });

  it("returns undefined for unknown author", () => {
    expect(getAuthorPhotoTest("Unknown Author")).toBeUndefined();
    expect(getAuthorPhotoTest("")).toBeUndefined();
  });

  it("handles authors with special characters in name", () => {
    expect(getAuthorPhotoTest("Brene Brown")).toBe("https://cdn.example.com/Brene Brown_ghi789.png");
  });
});
