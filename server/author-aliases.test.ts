/**
 * Tests for author name normalization via canonicalName()
 * Covers: Drive-folder suffix stripping, alias resolution, co-author separator
 * normalization, misspelling correction, and round-trip stability.
 */
import { describe, it, expect } from "vitest";

// -- Inline the canonicalName logic (mirrors client/src/lib/authorAliases.ts) --
// We duplicate here to keep tests server-side (no client imports in vitest).

const AUTHOR_ALIASES: Record<string, string> = {
  // Drive-folder suffix variants
  "Charles Duhigg - Habits, Productivity & Communication": "Charles Duhigg",
  "Charles Duhigg - Habits, productivity, and willpower": "Charles Duhigg",
  "Matthew Dixon - Sales strategy and customer psychology experts": "Matthew Dixon",
  "Matthew Dixon - Customer experience and loyalty": "Matthew Dixon",
  "Stephen Hawking - Theoretical physics and cosmology": "Stephen Hawking",
  "Stephen Hawking - Cosmology, black holes, theoretical physics": "Stephen Hawking",
  "Sue Hawkes - Leadership development and self-empowerment": "Sue Hawkes",
  "Sue Hawkes - Leadership and organizational performance": "Sue Hawkes",
  "Scott Brinker - Marketing technology strategy and analysis": "Scott Brinker",
  "Scott Brinker - Marketing technology and agile marketing": "Scott Brinker",
  "Sean Ellis - Growth hacking and startup scaling": "Sean Ellis",
  "Sean Ellis - Growth hacking and product-led growth": "Sean Ellis",
  "Philipp Dettmer - Health": "Philipp Dettmer",
  "Eric Topol - Longevity and precision medicine": "Eric Topol",
  "Eric Topol - Digital health, AI, and longevity": "Eric Topol",
  "Nixaly Leonardo - Active listening and communication": "Nixaly Leonardo",
  "Nixaly Leonardo - Therapeutic communication and emotional intelligence": "Nixaly Leonardo",
  "Hans Peter Bech - B2B channel strategy and global expansion": "Hans Peter Bech",
  "Hans Peter Bech - Channel Sales - business development, B2B marketing, and international sales strategy": "Hans Peter Bech",
  // Middle-initial / abbreviated name aliases
  "Stephen Covey": "Stephen R. Covey",
  "Robert Cialdini": "Robert B. Cialdini",
  "Geoffrey Moore": "Geoffrey A. Moore",
  "Geoffrey A. Moore": "Geoffrey A. Moore",
  // Misspellings
  "Steven Hawking": "Stephen Hawking",
  "Brené Brown": "Brene Brown",
  // Co-author separator variants
  "Ashvin Vaidyanathan & Ruben Rabago": "Ashvin Vaidyanathan and Ruben Rabago",
  "Frances Frei & Anne Morriss": "Frances Frei and Anne Morriss",
  "Colin Bryar & Bill Carr": "Colin Bryar and Bill Carr",
};

function canonicalName(raw: string): string {
  if (!raw) return raw;
  if (AUTHOR_ALIASES[raw]) return AUTHOR_ALIASES[raw];
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx !== -1) {
    const base = raw.slice(0, dashIdx).trim();
    if (AUTHOR_ALIASES[base]) return AUTHOR_ALIASES[base];
    return base;
  }
  return raw;
}

// --------------------------------------------------------------

describe("canonicalName - Drive-folder suffix stripping", () => {
  it("strips specialty suffix from Matthew Dixon", () => {
    expect(canonicalName("Matthew Dixon - Sales strategy and customer psychology experts")).toBe("Matthew Dixon");
    expect(canonicalName("Matthew Dixon - Customer experience and loyalty")).toBe("Matthew Dixon");
  });

  it("strips specialty suffix from Stephen Hawking", () => {
    expect(canonicalName("Stephen Hawking - Theoretical physics and cosmology")).toBe("Stephen Hawking");
    expect(canonicalName("Stephen Hawking - Cosmology, black holes, theoretical physics")).toBe("Stephen Hawking");
  });

  it("strips specialty suffix from Sue Hawkes", () => {
    expect(canonicalName("Sue Hawkes - Leadership development and self-empowerment")).toBe("Sue Hawkes");
    expect(canonicalName("Sue Hawkes - Leadership and organizational performance")).toBe("Sue Hawkes");
  });

  it("strips specialty suffix from Charles Duhigg", () => {
    expect(canonicalName("Charles Duhigg - Habits, Productivity & Communication")).toBe("Charles Duhigg");
  });

  it("strips specialty suffix from Scott Brinker", () => {
    expect(canonicalName("Scott Brinker - Marketing technology strategy and analysis")).toBe("Scott Brinker");
  });

  it("strips specialty suffix from Sean Ellis", () => {
    expect(canonicalName("Sean Ellis - Growth hacking and startup scaling")).toBe("Sean Ellis");
  });

  it("strips any unknown suffix (generic fallback)", () => {
    expect(canonicalName("Some Author - Unknown specialty here")).toBe("Some Author");
  });
});

describe("canonicalName - alias resolution", () => {
  it("maps abbreviated 'Stephen Covey' → 'Stephen R. Covey'", () => {
    expect(canonicalName("Stephen Covey")).toBe("Stephen R. Covey");
  });

  it("maps abbreviated 'Robert Cialdini' → 'Robert B. Cialdini'", () => {
    expect(canonicalName("Robert Cialdini")).toBe("Robert B. Cialdini");
  });

  it("maps 'Geoffrey Moore' → 'Geoffrey A. Moore'", () => {
    expect(canonicalName("Geoffrey Moore")).toBe("Geoffrey A. Moore");
  });

  it("maps misspelling 'Steven Hawking' → 'Stephen Hawking'", () => {
    expect(canonicalName("Steven Hawking")).toBe("Stephen Hawking");
  });

  it("maps 'Brené Brown' (accented) → 'Brene Brown'", () => {
    expect(canonicalName("Brené Brown")).toBe("Brene Brown");
  });
});

describe("canonicalName - co-author separator normalization", () => {
  it("normalizes ampersand to 'and' for Ashvin/Ruben", () => {
    expect(canonicalName("Ashvin Vaidyanathan & Ruben Rabago")).toBe("Ashvin Vaidyanathan and Ruben Rabago");
  });

  it("normalizes ampersand to 'and' for Frances Frei", () => {
    expect(canonicalName("Frances Frei & Anne Morriss")).toBe("Frances Frei and Anne Morriss");
  });

  it("normalizes ampersand to 'and' for Colin Bryar", () => {
    expect(canonicalName("Colin Bryar & Bill Carr")).toBe("Colin Bryar and Bill Carr");
  });
});

describe("canonicalName - round-trip stability", () => {
  it("returns canonical names unchanged (idempotent)", () => {
    const canonicals = [
      "Matthew Dixon",
      "Stephen Hawking",
      "Stephen R. Covey",
      "Robert B. Cialdini",
      "Geoffrey A. Moore",
      "Charles Duhigg",
      "Brene Brown",
      "Adam Grant",
      "Malcolm Gladwell",
    ];
    for (const name of canonicals) {
      expect(canonicalName(name)).toBe(name);
    }
  });

  it("handles empty string gracefully", () => {
    expect(canonicalName("")).toBe("");
  });

  it("handles names with no dash (no suffix)", () => {
    expect(canonicalName("Adam Grant")).toBe("Adam Grant");
    expect(canonicalName("Tim Ferriss")).toBe("Tim Ferriss");
  });
});

describe("canonicalName - deduplication key consistency", () => {
  it("two entries for Matthew Dixon produce the same dedup key", () => {
    const key1 = canonicalName("Matthew Dixon - Sales strategy and customer psychology experts").toLowerCase();
    const key2 = canonicalName("Matthew Dixon - Customer experience and loyalty").toLowerCase();
    expect(key1).toBe(key2);
  });

  it("two entries for Stephen Hawking produce the same dedup key", () => {
    const key1 = canonicalName("Stephen Hawking - Theoretical physics and cosmology").toLowerCase();
    const key2 = canonicalName("Stephen Hawking - Cosmology, black holes, theoretical physics").toLowerCase();
    expect(key1).toBe(key2);
  });

  it("misspelling 'Steven Hawking' deduplicates with 'Stephen Hawking'", () => {
    const key1 = canonicalName("Steven Hawking").toLowerCase();
    const key2 = canonicalName("Stephen Hawking").toLowerCase();
    expect(key1).toBe(key2);
  });
});
