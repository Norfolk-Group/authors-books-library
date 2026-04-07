/**
 * ragReadiness.test.ts
 *
 * Unit tests for the RAG Readiness scoring algorithm.
 * Tests the scoring formula without requiring a live database.
 */

import { describe, it, expect } from "vitest";

// ── Inline the scoring logic for unit testing (no DB dependency) ──────────────

interface ScoringInputs {
  bookCount: number;
  contentItemCount: number;
  bioWordCount: number;
  bioCompleteness: number;
  hasWikipedia: boolean;
  hasLinkedin: boolean;
  ragStatus: string | null;
}

function computeScore(inputs: ScoringInputs): {
  score: number;
  breakdown: Record<string, number>;
} {
  const bookPoints = Math.min(inputs.bookCount * 5, 25);
  const contentItemPoints = Math.min(inputs.contentItemCount * 4, 20);
  const bioWordPoints = Math.min(Math.floor(inputs.bioWordCount / 50), 20);
  const bioCompletenessPoints = Math.round((inputs.bioCompleteness / 100) * 15);
  const wikipediaPoints = inputs.hasWikipedia ? 5 : 0;
  const linkedinPoints = inputs.hasLinkedin ? 5 : 0;
  const ragReadyBonus = inputs.ragStatus === "ready" ? 10 : 0;

  const score = Math.min(
    bookPoints + contentItemPoints + bioWordPoints +
    bioCompletenessPoints + wikipediaPoints + linkedinPoints + ragReadyBonus,
    100
  );

  return {
    score,
    breakdown: {
      bookPoints,
      contentItemPoints,
      bioWordPoints,
      bioCompletenessPoints,
      wikipediaPoints,
      linkedinPoints,
      ragReadyBonus,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RAG Readiness Score", () => {
  it("returns 0 for an author with no content", () => {
    const { score } = computeScore({
      bookCount: 0,
      contentItemCount: 0,
      bioWordCount: 0,
      bioCompleteness: 0,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: null,
    });
    expect(score).toBe(0);
  });

  it("returns correct score for a minimal author (1 book, short bio)", () => {
    const { score, breakdown } = computeScore({
      bookCount: 1,
      contentItemCount: 0,
      bioWordCount: 100,
      bioCompleteness: 20,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: null,
    });
    // 5 (book) + 0 (content) + 2 (100/50) + 3 (20/100*15) + 0 + 0 + 0 = 10
    expect(breakdown.bookPoints).toBe(5);
    expect(breakdown.bioWordPoints).toBe(2);
    expect(breakdown.bioCompletenessPoints).toBe(3);
    expect(score).toBe(10);
  });

  it("caps book points at 25 (5 books max)", () => {
    const { breakdown } = computeScore({
      bookCount: 10,
      contentItemCount: 0,
      bioWordCount: 0,
      bioCompleteness: 0,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: null,
    });
    expect(breakdown.bookPoints).toBe(25);
  });

  it("caps content item points at 20 (5 items max)", () => {
    const { breakdown } = computeScore({
      bookCount: 0,
      contentItemCount: 10,
      bioWordCount: 0,
      bioCompleteness: 0,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: null,
    });
    expect(breakdown.contentItemPoints).toBe(20);
  });

  it("caps bio word points at 20 (1000 words max)", () => {
    const { breakdown } = computeScore({
      bookCount: 0,
      contentItemCount: 0,
      bioWordCount: 5000,
      bioCompleteness: 0,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: null,
    });
    expect(breakdown.bioWordPoints).toBe(20);
  });

  it("awards Wikipedia and LinkedIn bonuses correctly", () => {
    const { breakdown } = computeScore({
      bookCount: 0,
      contentItemCount: 0,
      bioWordCount: 0,
      bioCompleteness: 0,
      hasWikipedia: true,
      hasLinkedin: true,
      ragStatus: null,
    });
    expect(breakdown.wikipediaPoints).toBe(5);
    expect(breakdown.linkedinPoints).toBe(5);
  });

  it("awards RAG ready bonus of 10 when ragStatus is 'ready'", () => {
    const { breakdown } = computeScore({
      bookCount: 0,
      contentItemCount: 0,
      bioWordCount: 0,
      bioCompleteness: 0,
      hasWikipedia: false,
      hasLinkedin: false,
      ragStatus: "ready",
    });
    expect(breakdown.ragReadyBonus).toBe(10);
  });

  it("does not award RAG bonus for 'pending' or 'stale' status", () => {
    for (const status of ["pending", "stale", "generating"]) {
      const { breakdown } = computeScore({
        bookCount: 0,
        contentItemCount: 0,
        bioWordCount: 0,
        bioCompleteness: 0,
        hasWikipedia: false,
        hasLinkedin: false,
        ragStatus: status,
      });
      expect(breakdown.ragReadyBonus).toBe(0);
    }
  });

  it("caps total score at 100", () => {
    const { score } = computeScore({
      bookCount: 100,
      contentItemCount: 100,
      bioWordCount: 100000,
      bioCompleteness: 100,
      hasWikipedia: true,
      hasLinkedin: true,
      ragStatus: "ready",
    });
    expect(score).toBe(100);
  });

  it("identifies chatbot-ready authors (score >= 50)", () => {
    const richAuthor = computeScore({
      bookCount: 5,
      contentItemCount: 3,
      bioWordCount: 500,
      bioCompleteness: 70,
      hasWikipedia: true,
      hasLinkedin: false,
      ragStatus: "ready",
    });
    // 25 + 12 + 10 + 11 + 5 + 0 + 10 = 73
    expect(richAuthor.score).toBeGreaterThanOrEqual(50);
    expect(richAuthor.score).toBe(73);
  });

  it("identifies high-quality authors (score >= 75)", () => {
    const highQualityAuthor = computeScore({
      bookCount: 5,
      contentItemCount: 5,
      bioWordCount: 1000,
      bioCompleteness: 85,
      hasWikipedia: true,
      hasLinkedin: true,
      ragStatus: "ready",
    });
    // 25 + 20 + 20 + 13 + 5 + 5 + 10 = 98
    expect(highQualityAuthor.score).toBeGreaterThanOrEqual(75);
  });

  it("correctly computes bio completeness points (15 max)", () => {
    expect(computeScore({ bookCount: 0, contentItemCount: 0, bioWordCount: 0, bioCompleteness: 100, hasWikipedia: false, hasLinkedin: false, ragStatus: null }).breakdown.bioCompletenessPoints).toBe(15);
    expect(computeScore({ bookCount: 0, contentItemCount: 0, bioWordCount: 0, bioCompleteness: 50, hasWikipedia: false, hasLinkedin: false, ragStatus: null }).breakdown.bioCompletenessPoints).toBe(8);
    expect(computeScore({ bookCount: 0, contentItemCount: 0, bioWordCount: 0, bioCompleteness: 0, hasWikipedia: false, hasLinkedin: false, ragStatus: null }).breakdown.bioCompletenessPoints).toBe(0);
  });
});

describe("RAG Readiness Thresholds", () => {
  it("chatbot threshold is 50", () => {
    const borderline = computeScore({
      bookCount: 2,
      contentItemCount: 2,
      bioWordCount: 300,
      bioCompleteness: 50,
      hasWikipedia: true,
      hasLinkedin: false,
      ragStatus: null,
    });
    // 10 + 8 + 6 + 8 + 5 + 0 + 0 = 37 — not ready
    expect(borderline.score).toBeLessThan(50);

    const ready = computeScore({
      bookCount: 3,
      contentItemCount: 3,
      bioWordCount: 500,
      bioCompleteness: 60,
      hasWikipedia: true,
      hasLinkedin: true,
      ragStatus: null,
    });
    // 15 + 12 + 10 + 9 + 5 + 5 + 0 = 56 — ready
    expect(ready.score).toBeGreaterThanOrEqual(50);
  });
});
