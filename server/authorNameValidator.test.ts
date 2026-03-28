/**
 * Tests for shared/authorNameValidator.ts
 *
 * Covers:
 *   - Exact blocklist matches
 *   - Digit-leading strings
 *   - Content-type first-word rejection
 *   - Single-word topic nouns
 *   - Book-title opening patterns
 *   - Acronym detection
 *   - TEST prefix
 *   - Drive-suffix stripping (name passes, suffix is ignored)
 *   - Real person names that must NOT be rejected
 *   - Edge cases (empty-ish, single-name authors, co-author names)
 */

import { describe, it, expect } from "vitest";
import {
  validateAuthorName,
  isLikelyAuthorName,
} from "../shared/authorNameValidator";

// ── Helpers ────────────────────────────────────────────────────────────────

function valid(name: string) {
  return validateAuthorName(name).valid;
}

// ── Should be REJECTED ─────────────────────────────────────────────────────

describe("validateAuthorName — should reject", () => {
  it("exact blocklist: book title", () => {
    expect(valid("Active Listening")).toBe(false);
    expect(valid("active listening")).toBe(false);
    expect(valid("Your Next Five Moves")).toBe(false);
    expect(valid("Leaders Eat Last")).toBe(false);
    expect(valid("Making Conversation")).toBe(false);
    expect(valid("Radical Candor")).toBe(false);
    expect(valid("Never Split the Difference")).toBe(false);
  });

  it("exact blocklist: content-type keywords", () => {
    expect(valid("PDF")).toBe(false);
    expect(valid("Transcript")).toBe(false);
    expect(valid("Binder")).toBe(false);
    expect(valid("Summary")).toBe(false);
    expect(valid("Substack")).toBe(false);
    expect(valid("Newsletter")).toBe(false);
  });

  it("exact blocklist: test/placeholder records", () => {
    expect(valid("test")).toBe(false);
    expect(valid("Test Author")).toBe(false);
    expect(valid("placeholder")).toBe(false);
    expect(valid("unknown author")).toBe(false);
    expect(valid("TBD")).toBe(false);
  });

  it("starts with digit", () => {
    expect(valid("10x Growth")).toBe(false);
    expect(valid("7 Habits of Highly Effective People")).toBe(false);
    expect(valid("48 Laws of Power")).toBe(false);
    expect(valid("1984")).toBe(false);
  });

  it("first word is a content-type keyword", () => {
    expect(valid("PDF Guide")).toBe(false);
    expect(valid("Transcript Notes")).toBe(false);
    expect(valid("Audio Files")).toBe(false);
    expect(valid("Video Course")).toBe(false);
  });

  it("single-word topic noun", () => {
    expect(valid("Leadership")).toBe(false);
    expect(valid("Productivity")).toBe(false);
    expect(valid("Marketing")).toBe(false);
    expect(valid("Negotiation")).toBe(false);
    expect(valid("Creativity")).toBe(false);
    expect(valid("Listening")).toBe(false);
  });

  it("book-title opening patterns", () => {
    expect(valid("The Art of War")).toBe(false);
    expect(valid("How to Win Friends")).toBe(false);
    expect(valid("Why Nations Fail")).toBe(false);
    expect(valid("Never Eat Alone")).toBe(false);
    expect(valid("Getting Things Done")).toBe(false);
    expect(valid("Building a Second Brain")).toBe(false);
    expect(valid("Becoming Michelle Obama")).toBe(false);
    expect(valid("Making Conversation")).toBe(false);
    expect(valid("Leading Engaging Meetings")).toBe(false);
    expect(valid("Thinking Fast and Slow")).toBe(false);
    expect(valid("From Good to Great")).toBe(false);
    expect(valid("Beyond Order")).toBe(false);
    expect(valid("Inside Apple")).toBe(false);
    expect(valid("Toward a New World")).toBe(false);
  });

  it("acronym titles (short names with 4+ uppercase letters)", () => {
    expect(valid("SPIN Selling")).toBe(false);
    expect(valid("SNAP Selling")).toBe(false);
  });

  it("TEST prefix", () => {
    expect(valid("TEST Matthew Dixon")).toBe(false);
    expect(valid("Test Adam Grant")).toBe(false);
  });

  it("Drive-suffix does not rescue a blocklisted base name", () => {
    expect(valid("Active Listening - communication skills")).toBe(false);
    expect(valid("Leaders Eat Last - Simon Sinek - Business Leadership")).toBe(false);
  });
});

// ── Should be ACCEPTED ─────────────────────────────────────────────────────

describe("validateAuthorName — should accept", () => {
  it("standard two-word person names", () => {
    expect(valid("Adam Grant")).toBe(true);
    expect(valid("Malcolm Gladwell")).toBe(true);
    expect(valid("Brene Brown")).toBe(true);
    expect(valid("Kim Scott")).toBe(true);
    expect(valid("Simon Sinek")).toBe(true);
    expect(valid("Chris Voss")).toBe(true);
  });

  it("three-word person names", () => {
    expect(valid("Stephen R. Covey")).toBe(true);
    expect(valid("Robert B. Cialdini")).toBe(true);
    expect(valid("Walter Isaacson")).toBe(true);
    expect(valid("Yuval Noah Harari")).toBe(true);
    expect(valid("Geoffrey A. Moore")).toBe(true);
  });

  it("single-word classical / pen-name authors", () => {
    expect(valid("Epictetus")).toBe(true);
    expect(valid("Aristotle")).toBe(true);
    expect(valid("Seneca")).toBe(true);
    expect(valid("Voltaire")).toBe(true);
    expect(valid("Confucius")).toBe(true);
  });

  it("co-author combined names (ampersand / and)", () => {
    expect(valid("Frances Frei & Anne Morriss")).toBe(true);
    expect(valid("Aaron Ross and Jason Lemkin")).toBe(true);
    expect(valid("Richard H. Thaler & Cass R. Sunstein")).toBe(true);
  });

  it("names with Drive-style specialty suffixes", () => {
    expect(valid("Charles Duhigg - Habits, Productivity & Communication")).toBe(true);
    expect(valid("Nixaly Leonardo - Active listening and communication")).toBe(true);
    expect(valid("Philipp Dettmer - Science communication and visual learning")).toBe(true);
    expect(valid("Marcus Aurelius - Philosopher")).toBe(true);
  });

  it("names containing 'AI' or short acronyms in longer names", () => {
    // "AI" alone is only 2 chars, not 4+, so it should pass
    expect(valid("Kai-Fu Lee")).toBe(true);
  });

  it("adminOverride bypasses all checks", () => {
    expect(validateAuthorName("Active Listening", { allowAdminOverride: true }).valid).toBe(true);
    expect(validateAuthorName("7 Habits", { allowAdminOverride: true }).valid).toBe(true);
    expect(validateAuthorName("TEST Fake", { allowAdminOverride: true }).valid).toBe(true);
  });
});

// ── isLikelyAuthorName convenience wrapper ─────────────────────────────────

describe("isLikelyAuthorName", () => {
  it("returns true for real names", () => {
    expect(isLikelyAuthorName("Adam Grant")).toBe(true);
    expect(isLikelyAuthorName("Epictetus")).toBe(true);
  });

  it("returns false for book titles", () => {
    expect(isLikelyAuthorName("Active Listening")).toBe(false);
    expect(isLikelyAuthorName("The Lean Startup")).toBe(false);
    expect(isLikelyAuthorName("Getting Things Done")).toBe(false);
  });
});
