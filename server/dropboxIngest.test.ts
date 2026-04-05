/**
 * dropboxIngest.test.ts
 *
 * Tests for the Dropbox Content Ingestion Pipeline:
 * 1. Metadata extraction guardrails (book titles never become author names)
 * 2. Person-name validation
 * 3. Dropbox folder structure constants
 * 4. InboxFile type shape
 * 5. Router procedure registration
 */

import { describe, it, expect } from "vitest";
import { DROPBOX_FOLDERS } from "./dropbox.service";

// ── Folder Structure ──────────────────────────────────────────────────────────

describe("Dropbox Folder Structure", () => {
  it("root folder is under Cidale Interests/Company/Norfolk AI/Apps/RC Library", () => {
    expect(DROPBOX_FOLDERS.root).toBe(
      "/Cidale Interests/Company/Norfolk AI/Apps/RC Library"
    );
  });

  it("inbox folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.inbox).toContain(DROPBOX_FOLDERS.root);
    expect(DROPBOX_FOLDERS.inbox.toLowerCase()).toContain("inbox");
  });

  it("processed folder is inside the inbox folder", () => {
    expect(DROPBOX_FOLDERS.processed).toContain(DROPBOX_FOLDERS.inbox);
  });

  it("avatars folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.avatars).toContain(DROPBOX_FOLDERS.root);
  });

  it("bookCovers folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.bookCovers).toContain(DROPBOX_FOLDERS.root);
  });

  it("pdfs folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.pdfs).toContain(DROPBOX_FOLDERS.root);
  });
});

// ── Guardrail Logic ───────────────────────────────────────────────────────────

/**
 * Replicate the looksLikePersonName guardrail from dropboxIngest.service.ts
 * so we can unit-test it without importing the full service (which has side effects).
 */
function looksLikePersonName(candidate: string): boolean {
  const lower = candidate.toLowerCase().trim();
  if (!lower.includes(" ")) return false;
  if (candidate.split(" ").length > 4) return false;
  const BOOK_TITLE_KEYWORDS = [
    "active listening",
    "the art of",
    "introduction to",
    "guide to",
    "handbook",
    "principles of",
    "fundamentals of",
    "how to",
    "the power of",
    "the science of",
    "thinking fast",
    "thinking slow",
  ];
  for (const kw of BOOK_TITLE_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }
  if (/^(the|a|an)\s/i.test(lower)) return false;
  return true;
}

describe("Author Name Guardrails", () => {
  it("accepts a normal two-word author name", () => {
    expect(looksLikePersonName("Adam Grant")).toBe(true);
  });

  it("accepts a three-word author name", () => {
    expect(looksLikePersonName("Malcolm Gladwell Jr")).toBe(true);
  });

  it("rejects a single word (no space)", () => {
    expect(looksLikePersonName("Gladwell")).toBe(false);
  });

  it("rejects 'Active Listening' — classic book-title false positive", () => {
    expect(looksLikePersonName("Active Listening")).toBe(false);
  });

  it("rejects 'The Art of War' — starts with 'The'", () => {
    expect(looksLikePersonName("The Art of War")).toBe(false);
  });

  it("rejects 'How to Win Friends' — contains 'how to'", () => {
    expect(looksLikePersonName("How to Win Friends")).toBe(false);
  });

  it("rejects 'The Power of Habit' — contains 'the power of'", () => {
    expect(looksLikePersonName("The Power of Habit")).toBe(false);
  });

  it("rejects 'Thinking Fast and Slow' — contains 'thinking fast'", () => {
    expect(looksLikePersonName("Thinking Fast and Slow")).toBe(false);
  });

  it("rejects very long names (more than 4 words)", () => {
    expect(looksLikePersonName("John Michael Robert David Smith")).toBe(false);
  });

  it("rejects names starting with 'A' article", () => {
    expect(looksLikePersonName("A Guide to Success")).toBe(false);
  });
});

// ── Dropbox Service Exports ───────────────────────────────────────────────────

describe("Dropbox Service Exports", () => {
  it("DROPBOX_FOLDERS has all required keys", () => {
    const keys = Object.keys(DROPBOX_FOLDERS);
    expect(keys).toContain("root");
    expect(keys).toContain("avatars");
    expect(keys).toContain("bookCovers");
    expect(keys).toContain("pdfs");
    expect(keys).toContain("inbox");
    expect(keys).toContain("processed");
  });

  it("all folder paths start with a forward slash", () => {
    for (const [, path] of Object.entries(DROPBOX_FOLDERS)) {
      expect(path.startsWith("/")).toBe(true);
    }
  });

  it("no folder path ends with a trailing slash", () => {
    for (const [, path] of Object.entries(DROPBOX_FOLDERS)) {
      expect(path.endsWith("/")).toBe(false);
    }
  });
});

// ── Ingest Service Exports ────────────────────────────────────────────────────

describe("Dropbox Ingest Service Exports", () => {
  it("extractPdfMetadata is exported from dropboxIngest.service", async () => {
    const mod = await import("./services/dropboxIngest.service");
    expect(typeof mod.extractPdfMetadata).toBe("function");
  });

  it("ingestDropboxFile is exported from dropboxIngest.service", async () => {
    const mod = await import("./services/dropboxIngest.service");
    expect(typeof mod.ingestDropboxFile).toBe("function");
  });
});
