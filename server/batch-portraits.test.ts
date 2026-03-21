/**
 * Tests for the batch portrait generation logic.
 * Validates: missing-author detection, sequential processing, rate-limit delay,
 * partial-failure handling, and early-exit when all authors have photos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// -- Mock getAuthorPhoto --------------------------------------------------------
const MOCK_PHOTOS: Record<string, string> = {
  "Adam Grant": "https://cdn.example.com/adam-grant.png",
  "James Clear": "https://cdn.example.com/james-clear.png",
};

vi.mock("../client/src/lib/authorPhotos", () => ({
  getAuthorPhoto: (name: string) => MOCK_PHOTOS[name] ?? undefined,
}));

// -- Helpers --------------------------------------------------------------------

/** Simulate the client-side batch logic extracted from generateAllPortraits */
async function runBatchPortraits(
  authorNames: string[],
  generatePortrait: (name: string) => Promise<void>,
  delayMs = 0
): Promise<{ done: number; failed: number; processed: string[] }> {
  const { getAuthorPhoto } = await import("../client/src/lib/authorPhotos");
  const missing = authorNames.filter((n) => !getAuthorPhoto(n));

  let done = 0;
  let failed = 0;
  const processed: string[] = [];

  for (let i = 0; i < missing.length; i++) {
    const name = missing[i];
    try {
      await generatePortrait(name);
      done++;
      processed.push(name);
    } catch {
      failed++;
    }
    if (delayMs > 0 && i < missing.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { done, failed, processed };
}

// -- Tests ----------------------------------------------------------------------

describe("batch portrait generation logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips authors who already have a photo in the static map", async () => {
    const generate = vi.fn().mockResolvedValue(undefined);
    const authors = ["Adam Grant", "James Clear", "Unknown Author"];

    const { done, failed, processed } = await runBatchPortraits(authors, generate);

    expect(done).toBe(1);
    expect(failed).toBe(0);
    expect(processed).toEqual(["Unknown Author"]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("Unknown Author");
  });

  it("returns done=0 and calls generate 0 times when all authors have photos", async () => {
    const generate = vi.fn().mockResolvedValue(undefined);
    const authors = ["Adam Grant", "James Clear"];

    const { done, failed } = await runBatchPortraits(authors, generate);

    expect(done).toBe(0);
    expect(failed).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("counts failed authors correctly when generate throws", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(undefined) // first succeeds
      .mockRejectedValueOnce(new Error("Replicate timeout")) // second fails
      .mockResolvedValueOnce(undefined); // third succeeds

    const authors = ["Author A", "Author B", "Author C"];

    const { done, failed, processed } = await runBatchPortraits(authors, generate);

    expect(done).toBe(2);
    expect(failed).toBe(1);
    expect(processed).toEqual(["Author A", "Author C"]);
  });

  it("processes all missing authors in order", async () => {
    const callOrder: string[] = [];
    const generate = vi.fn().mockImplementation(async (name: string) => {
      callOrder.push(name);
    });

    const authors = ["Author X", "Author Y", "Adam Grant", "Author Z"];

    await runBatchPortraits(authors, generate);

    expect(callOrder).toEqual(["Author X", "Author Y", "Author Z"]);
  });

  it("handles empty author list gracefully", async () => {
    const generate = vi.fn().mockResolvedValue(undefined);

    const { done, failed } = await runBatchPortraits([], generate);

    expect(done).toBe(0);
    expect(failed).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("applies delay between requests (not after last)", async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;
    vi.stubGlobal("setTimeout", (fn: () => void, ms: number) => {
      delays.push(ms);
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const generate = vi.fn().mockResolvedValue(undefined);
    const authors = ["Author 1", "Author 2", "Author 3"];

    await runBatchPortraits(authors, generate, 2000);

    // Should have 2 delays (between 1→2 and 2→3), not 3
    expect(delays.length).toBe(2);
    expect(delays.every((d) => d === 2000)).toBe(true);

    vi.stubGlobal("setTimeout", originalSetTimeout);
  });

  it("continues processing remaining authors after a failure", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("GPU timeout"))
      .mockResolvedValue(undefined);

    const authors = ["Fail Author", "Success Author 1", "Success Author 2"];

    const { done, failed } = await runBatchPortraits(authors, generate);

    expect(done).toBe(2);
    expect(failed).toBe(1);
    expect(generate).toHaveBeenCalledTimes(3);
  });
});
