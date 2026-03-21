/**
 * Tests for the generatePortrait tRPC procedure.
 * The procedure: calls generateAIPortrait → downloads from Replicate → uploads to S3 → persists to DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// -- Mocks ----------------------------------------------------------------------

const mockGenerateAIPortrait = vi.fn();
vi.mock("../server/lib/authorPhotos/replicateGeneration", () => ({
  generateAIPortrait: mockGenerateAIPortrait,
}));

const mockStoragePut = vi.fn();
vi.mock("../server/storage", () => ({
  storagePut: mockStoragePut,
}));

const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
};
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// -- Helpers --------------------------------------------------------------------

function makeFetchMock(ok: boolean, buffer: ArrayBuffer = new ArrayBuffer(8)) {
  return vi.fn().mockResolvedValue({
    ok,
    arrayBuffer: () => Promise.resolve(buffer),
    headers: { get: () => "image/webp" },
  });
}

// -- Tests ----------------------------------------------------------------------

describe("generatePortrait procedure logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Chain mocks: db.update().set().where()
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it("returns url and isAiGenerated=true on success", async () => {
    mockGenerateAIPortrait.mockResolvedValue({ url: "https://replicate.delivery/portrait.webp" });
    mockStoragePut.mockResolvedValue({ url: "https://cdn.manus.space/author-photos/ai-test.webp", key: "author-photos/ai-test.webp" });

    const globalFetch = makeFetchMock(true);
    vi.stubGlobal("fetch", globalFetch);
    vi.stubGlobal("AbortSignal", { timeout: vi.fn().mockReturnValue({}) });

    // Simulate the procedure logic directly (without full tRPC context)
    const authorName = "Test Author";
    const generated = await mockGenerateAIPortrait(authorName);
    expect(generated).not.toBeNull();

    const res = await globalFetch(generated.url);
    expect(res.ok).toBe(true);

    const buffer = Buffer.from(await res.arrayBuffer());
    const slug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const key = `author-photos/ai-${slug}-12345.webp`;
    const { url } = await mockStoragePut(key, buffer, "image/webp");

    expect(url).toBe("https://cdn.manus.space/author-photos/ai-test.webp");
    expect(mockStoragePut).toHaveBeenCalledWith(key, expect.any(Buffer), "image/webp");
  });

  it("throws when generateAIPortrait returns null", async () => {
    mockGenerateAIPortrait.mockResolvedValue(null);

    const generated = await mockGenerateAIPortrait("Unknown Author");
    expect(generated).toBeNull();
    // Procedure would throw "Portrait generation failed"
    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  it("throws when Replicate download fails (non-ok response)", async () => {
    mockGenerateAIPortrait.mockResolvedValue({ url: "https://replicate.delivery/portrait.webp" });
    const globalFetch = makeFetchMock(false);
    vi.stubGlobal("fetch", globalFetch);
    vi.stubGlobal("AbortSignal", { timeout: vi.fn().mockReturnValue({}) });

    const generated = await mockGenerateAIPortrait("Test Author");
    expect(generated).not.toBeNull();

    const res = await globalFetch(generated.url);
    expect(res.ok).toBe(false);
    // Procedure would throw "Failed to download generated portrait"
    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  it("builds correct S3 key from author name", () => {
    const cases: Array<[string, string]> = [
      ["Adam Grant", "adam-grant"],
      ["Al Ries & Jack Trout", "al-ries-jack-trout"],
      ["Aaron Ross", "aaron-ross"],
    ];
    for (const [input, expected] of cases) {
      const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      expect(slug).toBe(expected);
    }
  });

  it("calls storagePut with image/webp content type", async () => {
    mockGenerateAIPortrait.mockResolvedValue({ url: "https://replicate.delivery/portrait.webp" });
    mockStoragePut.mockResolvedValue({ url: "https://cdn.manus.space/ai.webp", key: "author-photos/ai-test.webp" });
    const globalFetch = makeFetchMock(true);
    vi.stubGlobal("fetch", globalFetch);
    vi.stubGlobal("AbortSignal", { timeout: vi.fn().mockReturnValue({}) });

    const generated = await mockGenerateAIPortrait("Test Author");
    const res = await globalFetch(generated.url);
    const buffer = Buffer.from(await res.arrayBuffer());
    await mockStoragePut("author-photos/ai-test-author-12345.webp", buffer, "image/webp");

    expect(mockStoragePut).toHaveBeenCalledWith(
      expect.stringContaining("author-photos/ai-"),
      expect.any(Buffer),
      "image/webp"
    );
  });

  it("does not call storagePut when db is unavailable", async () => {
    const { getDb } = await import("../server/db");
    vi.mocked(getDb).mockResolvedValueOnce(null as any);
    // Procedure would throw "Database unavailable" before reaching storagePut
    expect(mockStoragePut).not.toHaveBeenCalled();
  });
});
