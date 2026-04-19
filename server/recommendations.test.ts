/**
 * Recommendations Router Tests
 * Tests for all Neon-powered recommendation procedures.
 * Return shapes match recommendations.router.ts exactly:
 *   - similarBooks      → { books: [] }
 *   - similarAuthors    → { authors: [] }
 *   - relatedContent    → { items: [] }
 *   - thematicSearch    → { results: [] }
 *   - personalizedNext  → { books: [], reason: string }
 *
 * NOTE: All recommendation procedures use protectedProcedure (S1 audit fix).
 * Tests must use createAuthContext() for all calls.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock Neon vector service to avoid real API calls in tests
vi.mock("./services/neonVector.service", () => ({
  queryVectors: vi.fn().mockResolvedValue([]),
  queryAllNamespaces: vi.fn().mockResolvedValue([]),
  fetchVectorById: vi.fn().mockResolvedValue(null),
}));

// Mock ragPipeline service
vi.mock("./services/ragPipeline.service", () => ({
  embedText: vi.fn().mockResolvedValue(new Array(3072).fill(0.1)),
  semanticSearch: vi.fn().mockResolvedValue([]),
}));

// Mock DB to return null (unavailable)
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("recommendations router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("similarBooks", () => {
    it("returns { books: [] } when DB is unavailable", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.similarBooks({ bookId: "1", topK: 5 });
      expect(result).toHaveProperty("books");
      expect(Array.isArray(result.books)).toBe(true);
      expect(result.books).toHaveLength(0);
    });

    it("accepts valid topK values between 1 and 20", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.similarBooks({ bookId: "42", topK: 10 });
      expect(result).toHaveProperty("books");
      expect(Array.isArray(result.books)).toBe(true);
    });

    it("rejects topK above 20", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.recommendations.similarBooks({ bookId: "1", topK: 25 })
      ).rejects.toThrow();
    });

    it("requires authentication — throws for unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.recommendations.similarBooks({ bookId: "1", topK: 5 })
      ).rejects.toThrow();
    });
  });

  describe("similarAuthors", () => {
    it("returns { authors: [] } when DB is unavailable", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.similarAuthors({ authorName: "Adam Grant", topK: 5 });
      expect(result).toHaveProperty("authors");
      expect(Array.isArray(result.authors)).toBe(true);
      expect(result.authors).toHaveLength(0);
    });

    it("accepts valid author name", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.similarAuthors({ authorName: "Malcolm Gladwell" });
      expect(result).toHaveProperty("authors");
      expect(Array.isArray(result.authors)).toBe(true);
    });

    it("rejects empty author name", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.recommendations.similarAuthors({ authorName: "" })
      ).rejects.toThrow();
    });

    it("requires authentication — throws for unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.recommendations.similarAuthors({ authorName: "Adam Grant" })
      ).rejects.toThrow();
    });
  });

  describe("relatedContent", () => {
    it("returns { items: [] } when DB is unavailable", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.relatedContent({ bookId: "1", topK: 5 });
      expect(result).toHaveProperty("items");
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toHaveLength(0);
    });

    it("rejects topK above 12", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.recommendations.relatedContent({ bookId: "1", topK: 20 })
      ).rejects.toThrow();
    });

    it("requires authentication — throws for unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.recommendations.relatedContent({ bookId: "1", topK: 5 })
      ).rejects.toThrow();
    });
  });

  describe("thematicSearch", () => {
    it("returns { results: [] } when DB is unavailable", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.thematicSearch({
        query: "habits and productivity",
        topK: 10,
      });
      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);
    });

    it("validates query minimum length of 2 chars", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.recommendations.thematicSearch({ query: "a", topK: 5 })
      ).rejects.toThrow();
    });

    it("accepts valid namespace values", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.thematicSearch({
        query: "leadership",
        namespace: "books",
        topK: 5,
      });
      expect(result).toHaveProperty("results");
    });

    it("rejects invalid namespace values", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      await expect(
        caller.recommendations.thematicSearch({
          query: "leadership",
          namespace: "invalid" as any,
          topK: 5,
        })
      ).rejects.toThrow();
    });

    it("requires authentication — throws for unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.recommendations.thematicSearch({ query: "leadership", topK: 5 })
      ).rejects.toThrow();
    });
  });

  describe("personalizedNext (protected)", () => {
    it("requires authentication — throws for unauthenticated users", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.recommendations.personalizedNext({ topK: 5 })
      ).rejects.toThrow();
    });

    it("returns { books: [], reason } for authenticated user when DB is unavailable", async () => {
      const { appRouter } = await import("./routers");
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.recommendations.personalizedNext({ topK: 5 });
      expect(result).toHaveProperty("books");
      expect(Array.isArray(result.books)).toBe(true);
      expect(result.books).toHaveLength(0);
      expect(result).toHaveProperty("reason");
      expect(typeof result.reason).toBe("string");
    });
  });
});
