/**
 * youtube-key.test.ts
 * Validates that YOUTUBE_API_KEY is set and works against the YouTube Data API v3.
 */
import { describe, it, expect } from "vitest";
import { validateYouTubeApiKey } from "./enrichment/youtube";

describe("YOUTUBE_API_KEY validation", () => {
  it("should have YOUTUBE_API_KEY set in environment", () => {
    const key = process.env.YOUTUBE_API_KEY;
    expect(key, "YOUTUBE_API_KEY must be set in environment").toBeTruthy();
    expect(key!.length, "YOUTUBE_API_KEY must be at least 10 chars").toBeGreaterThan(10);
  });

  it("should successfully call the YouTube Data API with the provided key", async () => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      console.warn("[youtube-key.test] YOUTUBE_API_KEY not set, skipping API call test");
      return;
    }
    const isValid = await validateYouTubeApiKey(key);
    expect(isValid, "YouTube API key should be valid and return 200").toBe(true);
  }, 10_000);
});
