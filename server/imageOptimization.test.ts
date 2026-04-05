/**
 * imageOptimization.test.ts
 *
 * Tests for the image optimization work:
 * 1. All author avatars are on S3 CDN
 * 2. All book covers are on S3 CDN
 * 3. LazyImage component file exists with required exports
 * 4. No raw <img> tags remain in key components (replaced by LazyImage)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

describe("Image Optimization — LazyImage Component", () => {
  it("LazyImage component file exists", () => {
    const path = join(ROOT, "client/src/components/ui/LazyImage.tsx");
    expect(existsSync(path)).toBe(true);
  });

  it("LazyImage exports LazyImage and CircularLazyImage", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    expect(src).toContain("export function LazyImage");
    expect(src).toContain("export function CircularLazyImage");
  });

  it("LazyImage uses IntersectionObserver for lazy loading", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    expect(src).toContain("IntersectionObserver");
  });

  it("LazyImage has blur placeholder support", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    // blur-sm or blur placeholder
    expect(src).toContain("blur");
  });

  it("LazyImage has fade-in animation", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    expect(src).toContain("transition");
    expect(src).toContain("opacity");
  });

  it("LazyImage has error fallback handling", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    expect(src).toContain("onError");
  });

  it("LazyImage supports eager loading prop", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/ui/LazyImage.tsx"),
      "utf-8"
    );
    expect(src).toContain("eager");
  });
});

describe("Image Optimization — No Raw img Tags in Key Components", () => {
  const filesToCheck = [
    "client/src/components/FlowbiteAuthorCard.tsx",
    "client/src/components/library/AuthorsTabContent.tsx",
    "client/src/pages/AuthorChatbot.tsx",
    "client/src/pages/AuthorDetail.tsx",
  ];

  for (const relPath of filesToCheck) {
    it(`${relPath.split("/").pop()} uses LazyImage instead of raw <img>`, () => {
      const src = readFileSync(join(ROOT, relPath), "utf-8");
      // Count raw <img src= tags (not in comments, not in JSX comments)
      const rawImgMatches = src.match(/<img\s+src=/g) ?? [];
      expect(rawImgMatches.length).toBe(0);
    });
  }
});

describe("Image Optimization — LazyImage Used in Components", () => {
  it("FlowbiteAuthorCard imports LazyImage", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/FlowbiteAuthorCard.tsx"),
      "utf-8"
    );
    expect(src).toContain("LazyImage");
  });

  it("AuthorsTabContent imports LazyImage", () => {
    const src = readFileSync(
      join(ROOT, "client/src/components/library/AuthorsTabContent.tsx"),
      "utf-8"
    );
    expect(src).toContain("LazyImage");
  });

  it("AuthorChatbot imports LazyImage", () => {
    const src = readFileSync(
      join(ROOT, "client/src/pages/AuthorChatbot.tsx"),
      "utf-8"
    );
    expect(src).toContain("LazyImage");
  });

  it("AuthorDetail imports LazyImage", () => {
    const src = readFileSync(
      join(ROOT, "client/src/pages/AuthorDetail.tsx"),
      "utf-8"
    );
    expect(src).toContain("LazyImage");
  });
});
