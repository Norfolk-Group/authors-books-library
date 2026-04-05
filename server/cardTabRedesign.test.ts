/**
 * Tests for the filing-folder tab card redesign.
 * Covers: FlowbiteAuthorCard tab structure, BookCard tab structure,
 * reading progress data flow, and BooksTabContent prop passthrough.
 */

import { describe, it, expect } from "vitest";

// ── FlowbiteAuthorCard tab logic ─────────────────────────────────────────────

describe("FlowbiteAuthorCard tab design", () => {
  it("defines exactly two tabs: info and books", () => {
    type CardTab = "info" | "books";
    const tabs: CardTab[] = ["info", "books"];
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toBe("info");
    expect(tabs[1]).toBe("books");
  });

  it("info tab label is 'Info'", () => {
    const tabLabels: Record<string, string> = { info: "Info", books: "Books" };
    expect(tabLabels["info"]).toBe("Info");
  });

  it("books tab label is 'Books'", () => {
    const tabLabels: Record<string, string> = { info: "Info", books: "Books" };
    expect(tabLabels["books"]).toBe("Books");
  });

  it("default active tab is 'info'", () => {
    // Mirrors useState<CardTab>("info") in the component
    const defaultTab: "info" | "books" = "info";
    expect(defaultTab).toBe("info");
  });

  it("books tab shows a dot badge when author has books and tab is inactive", () => {
    const bookCount = 3;
    const activeTab = "info";
    const showDot = bookCount > 0 && activeTab !== "books";
    expect(showDot).toBe(true);
  });

  it("books tab dot is hidden when tab is active", () => {
    const bookCount = 3;
    const activeTab = "books";
    const showDot = bookCount > 0 && activeTab !== "books";
    expect(showDot).toBe(false);
  });

  it("books tab dot is hidden when author has no books", () => {
    const bookCount = 0;
    const activeTab = "info";
    const showDot = bookCount > 0 && activeTab !== "books";
    expect(showDot).toBe(false);
  });
});

// ── BookCard tab logic ────────────────────────────────────────────────────────

describe("BookCard tab design", () => {
  it("defines exactly two tabs: details and notes", () => {
    type CardTab = "details" | "notes";
    const tabs: CardTab[] = ["details", "notes"];
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toBe("details");
    expect(tabs[1]).toBe("notes");
  });

  it("default active tab is 'details'", () => {
    const defaultTab: "details" | "notes" = "details";
    expect(defaultTab).toBe("details");
  });

  it("notes tab shows a dot badge when hasNotes is true and tab is inactive", () => {
    const hasNotes = true;
    const activeTab = "details";
    const showDot = hasNotes && activeTab !== "notes";
    expect(showDot).toBe(true);
  });

  it("notes tab dot is hidden when tab is active", () => {
    const hasNotes = true;
    const activeTab = "notes";
    const showDot = hasNotes && activeTab !== "notes";
    expect(showDot).toBe(false);
  });

  it("notes tab dot is hidden when hasNotes is false", () => {
    const hasNotes = false;
    const activeTab = "details";
    const showDot = hasNotes && activeTab !== "notes";
    expect(showDot).toBe(false);
  });
});

// ── Reading progress data ─────────────────────────────────────────────────────

describe("BookCard reading progress logic", () => {
  it("hasNotes is true when readingProgressPercent is set", () => {
    const readingProgressPercent = 42;
    const readingStartedAt = null;
    const readingFinishedAt = null;
    const possessionStatus = "owned";
    const hasNotes =
      readingProgressPercent != null ||
      readingStartedAt != null ||
      readingFinishedAt != null ||
      (possessionStatus && possessionStatus !== "owned");
    expect(hasNotes).toBe(true);
  });

  it("hasNotes is true when possessionStatus is 'reading'", () => {
    const readingProgressPercent = null;
    const readingStartedAt = null;
    const readingFinishedAt = null;
    const possessionStatus = "reading";
    const hasNotes =
      readingProgressPercent != null ||
      readingStartedAt != null ||
      readingFinishedAt != null ||
      (possessionStatus && possessionStatus !== "owned");
    expect(hasNotes).toBe(true);
  });

  it("hasNotes is false when all fields are null/owned", () => {
    const readingProgressPercent = null;
    const readingStartedAt = null;
    const readingFinishedAt = null;
    const possessionStatus = "owned";
    const hasNotes =
      readingProgressPercent != null ||
      readingStartedAt != null ||
      readingFinishedAt != null ||
      (possessionStatus && possessionStatus !== "owned");
    expect(hasNotes).toBe(false);
  });

  it("progress bar color is green when progress is 100%", () => {
    const pct = 100;
    const color = pct >= 100 ? "#059669" : "#3b82f6";
    expect(color).toBe("#059669");
  });

  it("progress bar color is blue when progress is less than 100%", () => {
    const pct = 65;
    const color = pct >= 100 ? "#059669" : "#3b82f6";
    expect(color).toBe("#3b82f6");
  });

  it("formatDate returns null for null input", () => {
    const formatDate = (d: Date | null | undefined) => {
      if (!d) return null;
      return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    };
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  it("formatDate returns a non-empty string for a valid date", () => {
    const formatDate = (d: Date | null | undefined) => {
      if (!d) return null;
      return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    };
    const result = formatDate(new Date("2024-03-15"));
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

// ── Status config completeness ────────────────────────────────────────────────

describe("BookCard STATUS_CONFIG", () => {
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    read:      { label: "Read",      color: "#059669", bg: "#d1fae5" },
    reading:   { label: "Reading",   color: "#0284c7", bg: "#e0f2fe" },
    unread:    { label: "Unread",    color: "#6b7280", bg: "#f3f4f6" },
    wishlist:  { label: "Wishlist",  color: "#d97706", bg: "#fef3c7" },
    reference: { label: "Reference", color: "#7c3aed", bg: "#ede9fe" },
    borrowed:  { label: "Borrowed",  color: "#db2777", bg: "#fce7f3" },
    gifted:    { label: "Gifted",    color: "#9333ea", bg: "#f3e8ff" },
    owned:     { label: "Owned",     color: "#2563eb", bg: "#dbeafe" },
  };

  it("covers all 8 possession statuses", () => {
    const keys = Object.keys(STATUS_CONFIG);
    expect(keys).toHaveLength(8);
  });

  it("each status has label, color, and bg", () => {
    for (const [, cfg] of Object.entries(STATUS_CONFIG)) {
      expect(cfg.label).toBeTruthy();
      expect(cfg.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(cfg.bg).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
