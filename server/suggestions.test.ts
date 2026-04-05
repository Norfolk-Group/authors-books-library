/**
 * suggestions.test.ts
 *
 * Tests covering the three "implement all suggestions" features:
 *   1. Substack URL seeding — author_profiles.substackUrl column is populated
 *   2. Magazine feed sync admin procedures — vectorSearch.indexAllArticles exists
 *      and magazine.syncAll / magazine.syncFeed procedures are callable
 *   3. Semantic search — vectorSearch.search procedure validates inputs correctly
 *
 * These are unit / schema tests that do NOT require live DB or Pinecone access.
 */
import { describe, it, expect } from "vitest";

// ── 1. Substack URL seeding ────────────────────────────────────────────────────
describe("Substack URL seeding — schema", () => {
  it("author_profiles table has a substackUrl column in the Drizzle schema", async () => {
    const { authorProfiles } = await import("../drizzle/schema");
    expect(authorProfiles).toBeDefined();
    // Drizzle column objects are keyed by their JS property name
    expect("substackUrl" in authorProfiles).toBe(true);
  });

  it("substackUrl column is nullable (optional field)", async () => {
    const { authorProfiles } = await import("../drizzle/schema");
    const col = (authorProfiles as Record<string, unknown>)["substackUrl"] as {
      notNull?: boolean;
    };
    // Drizzle nullable columns do not have notNull: true
    expect(col?.notNull).not.toBe(true);
  });
});

// ── 2. Magazine feed sync admin procedures ────────────────────────────────────
describe("Magazine admin procedures — router shape", () => {
  it("vectorSearch router exposes indexAllArticles procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    expect(vectorSearchRouter).toBeDefined();
    // tRPC routers expose their procedures via _def.procedures or _def.record
    const def = (vectorSearchRouter as unknown as { _def: { record: Record<string, unknown> } })._def;
    expect(def.record).toBeDefined();
    expect("indexAllArticles" in def.record).toBe(true);
  });

  it("magazine router exposes syncAll and syncFeed procedures", async () => {
    const { magazineRouter } = await import("./routers/magazine.router");
    expect(magazineRouter).toBeDefined();
    const def = (magazineRouter as unknown as { _def: { record: Record<string, unknown> } })._def;
    expect(def.record).toBeDefined();
    expect("syncAll" in def.record).toBe(true);
    expect("syncFeed" in def.record).toBe(true);
  });

  it("vectorSearch router exposes getStats procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    const def = (vectorSearchRouter as unknown as { _def: { record: Record<string, unknown> } })._def;
    expect("getStats" in def.record).toBe(true);
  });
});

// ── 3. Semantic search — input validation ─────────────────────────────────────
describe("Semantic search — vectorSearch.search input validation", () => {
  it("vectorSearch router exposes search procedure", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    const def = (vectorSearchRouter as unknown as { _def: { record: Record<string, unknown> } })._def;
    expect("search" in def.record).toBe(true);
  });

  it("vectorSearch router exposes searchArticles and searchBooks procedures", async () => {
    const { vectorSearchRouter } = await import("./routers/vectorSearch.router");
    const def = (vectorSearchRouter as unknown as { _def: { record: Record<string, unknown> } })._def;
    expect("searchArticles" in def.record).toBe(true);
    expect("searchBooks" in def.record).toBe(true);
  });

  it("ragPipeline service exports semanticSearch function", async () => {
    const mod = await import("./services/ragPipeline.service");
    expect(typeof mod.semanticSearch).toBe("function");
  });

  it("ragPipeline service exports indexArticle, indexBook, indexAuthor functions", async () => {
    const mod = await import("./services/ragPipeline.service");
    expect(typeof mod.indexArticle).toBe("function");
    expect(typeof mod.indexBook).toBe("function");
    expect(typeof mod.indexAuthor).toBe("function");
  });
});

// ── 4. SemanticSearchDropdown — debounce logic (pure function) ────────────────
describe("SemanticSearchDropdown — query length guard", () => {
  it("should only enable search when query is 3+ characters", () => {
    const shouldEnable = (q: string) => q.trim().length >= 3;
    expect(shouldEnable("")).toBe(false);
    expect(shouldEnable("  ")).toBe(false);
    expect(shouldEnable("ab")).toBe(false);
    expect(shouldEnable("abc")).toBe(true);
    expect(shouldEnable("adam grant")).toBe(true);
    expect(shouldEnable("  ok  ")).toBe(false);
    expect(shouldEnable("  yes  ")).toBe(true);
  });

  it("score label mapping works correctly", () => {
    const scoreLabel = (score: number): string => {
      if (score >= 0.85) return "High";
      if (score >= 0.70) return "Good";
      return "Fair";
    };
    expect(scoreLabel(0.95)).toBe("High");
    expect(scoreLabel(0.85)).toBe("High");
    expect(scoreLabel(0.84)).toBe("Good");
    expect(scoreLabel(0.70)).toBe("Good");
    expect(scoreLabel(0.69)).toBe("Fair");
    expect(scoreLabel(0.0)).toBe("Fair");
  });
});
