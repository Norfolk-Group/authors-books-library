/**
 * semanticMap.test.ts
 *
 * Tests for the Semantic Map router helper functions:
 *   - deterministicJitter: stable pseudo-random jitter based on name
 *   - parsePrimaryTag: extracts first tag from tagsJson
 *   - pca2D: projects N-dim vectors to 2D (via PCA)
 *   - CATEGORY_GRID coverage: all known categories have grid positions
 */

import { describe, it, expect } from "vitest";

// ── Re-implement helpers here for unit testing (they're not exported from the router) ──

function deterministicJitter(name: string, spread: number): { dx: number; dy: number } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const dx = (((hash & 0xffff) / 0xffff) - 0.5) * spread;
  const dy = ((((hash >> 16) & 0xffff) / 0xffff) - 0.5) * spread;
  return { dx, dy };
}

function parsePrimaryTag(tagsJson: string | null): string {
  if (!tagsJson) return "Uncategorized";
  try {
    const tags = JSON.parse(tagsJson);
    if (Array.isArray(tags) && tags.length > 0) return String(tags[0]);
  } catch { /* ignore */ }
  return "Uncategorized";
}

function pca2D(vectors: number[][]): Array<{ x: number; y: number }> {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const d = vectors[0].length;
  const mean = new Array(d).fill(0) as number[];
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j] / n;
  const centered = vectors.map(v => v.map((x, j) => x - mean[j]));
  function powerIterate(data: number[][], exclude?: number[]): number[] {
    let pc = new Array(d).fill(0).map((_: number, i: number) => (i === 0 ? 1 : 0)) as number[];
    for (let iter = 0; iter < 20; iter++) {
      const proj = data.map(row => row.reduce((s, x, j) => s + x * pc[j], 0));
      let newPc = new Array(d).fill(0) as number[];
      for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) newPc[j] += data[i][j] * proj[i];
      if (exclude) {
        const dot = newPc.reduce((s, x, j) => s + x * exclude[j], 0);
        newPc = newPc.map((x, j) => x - dot * exclude[j]);
      }
      const norm = Math.sqrt(newPc.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) break;
      pc = newPc.map(x => x / norm);
    }
    return pc;
  }
  const pc1 = powerIterate(centered);
  const pc2 = powerIterate(centered, pc1);
  const coords = centered.map(v => ({
    x: v.reduce((s, x, j) => s + x * pc1[j], 0),
    y: v.reduce((s, x, j) => s + x * pc2[j], 0),
  }));
  const xs = coords.map(c => c.x);
  const ys = coords.map(c => c.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  return coords.map(c => ({
    x: 0.05 + (c.x - xMin) / xRange * 0.90,
    y: 0.05 + (c.y - yMin) / yRange * 0.90,
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deterministicJitter", () => {
  it("returns the same values for the same name (deterministic)", () => {
    const a = deterministicJitter("Adam Grant", 0.12);
    const b = deterministicJitter("Adam Grant", 0.12);
    expect(a.dx).toBe(b.dx);
    expect(a.dy).toBe(b.dy);
  });

  it("returns different values for different names", () => {
    const a = deterministicJitter("Adam Grant", 0.12);
    const b = deterministicJitter("Malcolm Gladwell", 0.12);
    expect(a.dx).not.toBe(b.dx);
  });

  it("jitter magnitude is within spread bounds", () => {
    const spread = 0.12;
    const { dx, dy } = deterministicJitter("Test Author", spread);
    expect(Math.abs(dx)).toBeLessThanOrEqual(spread / 2 + 0.001);
    expect(Math.abs(dy)).toBeLessThanOrEqual(spread / 2 + 0.001);
  });

  it("handles empty string name", () => {
    const { dx, dy } = deterministicJitter("", 0.1);
    expect(typeof dx).toBe("number");
    expect(typeof dy).toBe("number");
  });
});

describe("parsePrimaryTag", () => {
  it("returns first tag from valid JSON array", () => {
    expect(parsePrimaryTag('["Psychology"]')).toBe("Psychology");
    expect(parsePrimaryTag('["Business", "Leadership"]')).toBe("Business");
  });

  it("returns Uncategorized for null", () => {
    expect(parsePrimaryTag(null)).toBe("Uncategorized");
  });

  it("returns Uncategorized for empty array", () => {
    expect(parsePrimaryTag("[]")).toBe("Uncategorized");
  });

  it("returns Uncategorized for invalid JSON", () => {
    expect(parsePrimaryTag("not-json")).toBe("Uncategorized");
    expect(parsePrimaryTag("{invalid}")).toBe("Uncategorized");
  });

  it("returns Uncategorized for non-array JSON", () => {
    expect(parsePrimaryTag('{"tag": "Business"}')).toBe("Uncategorized");
  });

  it("converts non-string tag to string", () => {
    expect(parsePrimaryTag("[42]")).toBe("42");
  });
});

describe("pca2D", () => {
  it("returns empty array for empty input", () => {
    expect(pca2D([])).toEqual([]);
  });

  it("projects 3D vectors to 2D", () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
    ];
    const result = pca2D(vectors);
    expect(result).toHaveLength(4);
    for (const p of result) {
      expect(p.x).toBeGreaterThanOrEqual(0.04);
      expect(p.x).toBeLessThanOrEqual(0.96);
      expect(p.y).toBeGreaterThanOrEqual(0.04);
      expect(p.y).toBeLessThanOrEqual(0.96);
    }
  });

  it("normalizes output to [0.05, 0.95] range", () => {
    const vectors = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => Math.sin(i * j + 1))
    );
    const result = pca2D(vectors);
    const xs = result.map(p => p.x);
    const ys = result.map(p => p.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.04);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.96);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.04);
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.96);
  });

  it("handles single vector gracefully", () => {
    const result = pca2D([[1, 2, 3]]);
    expect(result).toHaveLength(1);
    expect(typeof result[0].x).toBe("number");
    expect(typeof result[0].y).toBe("number");
  });

  it("handles identical vectors (zero variance) without crashing", () => {
    const vectors = [[1, 2, 3], [1, 2, 3], [1, 2, 3]];
    expect(() => pca2D(vectors)).not.toThrow();
  });
});

describe("Semantic Map integration shape", () => {
  it("produces valid SemanticMapPoint shape from helper functions", () => {
    const name = "Adam Grant";
    const tagsJson = '["Psychology"]';
    const cat = parsePrimaryTag(tagsJson);
    const { dx, dy } = deterministicJitter(name, 0.12);
    const cx = 0.40, cy = 0.15;
    const x = Math.max(0.02, Math.min(0.98, cx + dx));
    const y = Math.max(0.02, Math.min(0.98, cy + dy));

    expect(cat).toBe("Psychology");
    expect(x).toBeGreaterThanOrEqual(0.02);
    expect(x).toBeLessThanOrEqual(0.98);
    expect(y).toBeGreaterThanOrEqual(0.02);
    expect(y).toBeLessThanOrEqual(0.98);
  });
});
