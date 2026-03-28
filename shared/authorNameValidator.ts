/**
 * Author Name Validator
 *
 * Provides `isLikelyAuthorName(name)` — a heuristic guard that returns false
 * when a string is almost certainly NOT a person's name.  Used at every layer
 * where author names enter the system:
 *
 *   1. Drive scanner  (library.router.ts)     — skip bad folder names at scan time
 *   2. DB write layer (authorProfiles.router.ts) — reject createAuthor calls
 *   3. UI layer       (AuthorCard, AddAuthorForm) — warn before rendering / submitting
 *
 * The validator is intentionally conservative: it only rejects strings that
 * match one or more clear disqualifying patterns.  Ambiguous cases pass through
 * so that legitimate single-name authors (e.g. "Epictetus", "Sun Tzu") are not
 * blocked.
 *
 * To add a new known-bad name: append to KNOWN_BAD_AUTHOR_NAMES (lowercase).
 * To add a new disqualifying keyword: append to CONTENT_TYPE_KEYWORDS or
 * TOPIC_PHRASE_KEYWORDS.
 */

// ---------------------------------------------------------------------------
// Blocklist — exact lowercase matches that are definitely not person names
// ---------------------------------------------------------------------------
export const KNOWN_BAD_AUTHOR_NAMES: ReadonlySet<string> = new Set([
  // Book titles that accidentally ended up as Drive author folders
  "your next five moves",
  "active listening",
  "leaders eat last",
  "making conversation",
  "lead engaging meetings",
  "leading engaging meetings",
  "mating in captivity",
  "meditations",           // ambiguous — also Marcus Aurelius book; handled by alias
  "never split the difference",
  "radical candor",
  "quit",
  "objections",
  "positioning",
  "nudge",
  "misbehaving",
  // Test / placeholder records
  "test",
  "test author",
  "placeholder",
  "unknown author",
  "unknown",
  "tbd",
  "n/a",
  // Content-type folder names that leaked to author level
  "pdf",
  "transcript",
  "binder",
  "summary",
  "supplemental",
  "papers",
  "articles",
  "links",
  "images",
  "video",
  "audio",
  "mp3",
  "substack",
  "medium",
  "blog",
  "newsletter",
  "other",
  "doc",
]);

// ---------------------------------------------------------------------------
// Keyword sets — if a name starts with or IS one of these, it is not a person
// ---------------------------------------------------------------------------

/** Content-type words that should never appear as the first word of an author name */
const CONTENT_TYPE_FIRST_WORDS: ReadonlySet<string> = new Set([
  "pdf", "transcript", "binder", "summary", "supplemental",
  "papers", "articles", "links", "images", "video", "audio",
  "mp3", "substack", "medium", "blog", "newsletter", "doc",
]);

/**
 * Common English words that, when they appear as the ENTIRE name (after
 * stripping Drive suffixes), indicate a topic/concept rather than a person.
 * We keep this list tight to avoid false-negatives on real names.
 */
const SINGLE_WORD_TOPIC_BLOCKLIST: ReadonlySet<string> = new Set([
  "leadership", "management", "productivity", "communication",
  "negotiation", "strategy", "marketing", "sales", "finance",
  "entrepreneurship", "innovation", "psychology", "economics",
  "storytelling", "persuasion", "mindset", "habits", "creativity",
  "listening", "speaking", "writing", "reading", "thinking",
  "coaching", "mentoring", "networking", "branding", "growth",
  "analytics", "technology", "futurism", "history", "biography",
]);

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** Matches strings that start with a digit (e.g. "10x Growth", "7 Habits") */
const STARTS_WITH_DIGIT = /^\d/;

/** Matches strings with 4+ consecutive uppercase letters (acronyms like "SPIN Selling") */
const HAS_ACRONYM = /[A-Z]{4,}/;

/**
 * Matches typical book-title prepositions/articles at word boundaries.
 * A name containing "The Art of", "How to", "Why ", "What ", etc. is almost
 * certainly a book title, not a person.
 */
const BOOK_TITLE_PATTERNS = [
  /^the\s+/i,
  /^how\s+to\s+/i,
  /^why\s+/i,
  /^what\s+/i,
  /^when\s+/i,
  /^never\s+/i,
  /^always\s+/i,
  /^stop\s+/i,
  /^start\s+/i,
  /^getting\s+/i,
  /^building\s+/i,
  /^mastering\s+/i,
  /^becoming\s+/i,
  /^finding\s+/i,
  /^making\s+/i,
  /^leading\s+/i,
  /^winning\s+/i,
  /^thinking\s+/i,
  /^selling\s+/i,
  /^from\s+/i,
  /^beyond\s+/i,
  /^inside\s+/i,
  /^outside\s+/i,
  /^toward\s+/i,
  /^towards\s+/i,
];

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export interface AuthorNameValidationResult {
  /** true = probably a real person name; false = likely not a person */
  valid: boolean;
  /** Human-readable reason when valid is false */
  reason?: string;
}

/**
 * Returns `{ valid: true }` when `name` looks like a real person's name,
 * or `{ valid: false, reason }` when it matches a disqualifying pattern.
 *
 * @param rawName  The raw string to test (Drive folder name, form input, etc.)
 * @param options.allowAdminOverride  When true, skip the check entirely (for
 *   admin-forced imports where the operator knows what they are doing).
 */
export function validateAuthorName(
  rawName: string,
  options: { allowAdminOverride?: boolean } = {}
): AuthorNameValidationResult {
  if (options.allowAdminOverride) return { valid: true };

  // Strip Drive-style suffixes ("Name - specialty description")
  const namePart = rawName.includes(" - ")
    ? rawName.slice(0, rawName.indexOf(" - ")).trim()
    : rawName.trim();

  const lower = namePart.toLowerCase();

  // 1. Exact blocklist match
  if (KNOWN_BAD_AUTHOR_NAMES.has(lower)) {
    return { valid: false, reason: `"${namePart}" is on the known-bad author names blocklist` };
  }

  // 2. Starts with a digit
  if (STARTS_WITH_DIGIT.test(namePart)) {
    return { valid: false, reason: `"${namePart}" starts with a digit — likely a book title or list` };
  }

  // 3. First word is a content-type keyword
  const firstWord = lower.split(/\s+/)[0];
  if (CONTENT_TYPE_FIRST_WORDS.has(firstWord)) {
    return { valid: false, reason: `"${namePart}" starts with content-type keyword "${firstWord}"` };
  }

  // 4. Single-word topic noun (only if the name is exactly one word)
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 1 && SINGLE_WORD_TOPIC_BLOCKLIST.has(lower)) {
    return { valid: false, reason: `"${namePart}" is a single topic noun, not a person name` };
  }

  // 5. Matches a book-title opening pattern
  for (const pattern of BOOK_TITLE_PATTERNS) {
    if (pattern.test(lower)) {
      return { valid: false, reason: `"${namePart}" matches book-title pattern "${pattern.source}"` };
    }
  }

  // 6. Contains 4+ consecutive uppercase letters (acronym title like "SPIN Selling")
  //    Exception: allow all-caps short names like "AI" in a longer name
  if (HAS_ACRONYM.test(namePart) && words.length <= 3) {
    return { valid: false, reason: `"${namePart}" contains an acronym — likely a book/product title` };
  }

  // 7. TEST prefix (case-insensitive)
  if (/^test\s+/i.test(namePart)) {
    return { valid: false, reason: `"${namePart}" starts with "TEST" — likely a test record` };
  }

  return { valid: true };
}

/** Convenience boolean wrapper */
export function isLikelyAuthorName(
  rawName: string,
  options: { allowAdminOverride?: boolean } = {}
): boolean {
  return validateAuthorName(rawName, options).valid;
}
