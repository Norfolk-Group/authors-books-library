/**
 * semanticMap.router.ts
 *
 * Provides the data for the Semantic Interest Heatmap in Admin → Intelligence.
 *
 * Two modes:
 *   1. Fast (default): Tag-based layout — groups authors by their primary tag
 *      in a deterministic 2D grid with per-author jitter. No Pinecone calls.
 *      Returns in < 200ms.
 *
 *   2. Full semantic (on demand): Embeds each author's bio text, then runs a
 *      simple PCA-style 2D projection. Returns in ~30-60s for 100 authors.
 *      Only triggered by the "Compute Semantic Map" button in the UI.
 */

import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { sql } from "drizzle-orm";
import { embedText } from "../services/ragPipeline.service";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SemanticMapPoint = {
  id: number;
  name: string;
  category: string;
  x: number;
  y: number;
  bookCount: number;
  hasAvatar: boolean;
  avatarUrl: string | null;
};

export type SemanticMapData = {
  points: SemanticMapPoint[];
  categories: string[];
  mode: "fast" | "semantic";
  computedAt: string;
};

// ── Category positions (deterministic grid for fast mode) ─────────────────────

const CATEGORY_GRID: Record<string, { cx: number; cy: number }> = {
  "Leadership":       { cx: 0.15, cy: 0.20 },
  "Management":       { cx: 0.20, cy: 0.25 },
  "Psychology":       { cx: 0.40, cy: 0.15 },
  "Behavior":         { cx: 0.45, cy: 0.20 },
  "Business":         { cx: 0.65, cy: 0.20 },
  "Entrepreneurship": { cx: 0.70, cy: 0.25 },
  "Communication":    { cx: 0.85, cy: 0.35 },
  "Influence":        { cx: 0.80, cy: 0.40 },
  "Self-Help":        { cx: 0.75, cy: 0.60 },
  "Personal Development": { cx: 0.70, cy: 0.65 },
  "Productivity":     { cx: 0.55, cy: 0.75 },
  "Performance":      { cx: 0.60, cy: 0.80 },
  "Technology":       { cx: 0.30, cy: 0.75 },
  "AI":               { cx: 0.25, cy: 0.80 },
  "Science":          { cx: 0.10, cy: 0.60 },
  "Research":         { cx: 0.15, cy: 0.65 },
  "Philosophy":       { cx: 0.10, cy: 0.40 },
  "Ethics":           { cx: 0.15, cy: 0.45 },
  "Finance":          { cx: 0.50, cy: 0.45 },
  "Economics":        { cx: 0.55, cy: 0.50 },
  "Health":           { cx: 0.70, cy: 0.40 },
  "Wellbeing":        { cx: 0.75, cy: 0.45 },
  "Creativity":       { cx: 0.40, cy: 0.55 },
  "Innovation":       { cx: 0.45, cy: 0.60 },
  "Social Impact":    { cx: 0.25, cy: 0.45 },
  "Spirituality":     { cx: 0.20, cy: 0.65 },
  "Mindfulness":      { cx: 0.25, cy: 0.70 },
  "History":          { cx: 0.60, cy: 0.55 },
  "Culture":          { cx: 0.65, cy: 0.60 },
  "Marketing":        { cx: 0.80, cy: 0.55 },
  "Sales":            { cx: 0.85, cy: 0.60 },
  "Strategy":         { cx: 0.50, cy: 0.30 },
  "Negotiation":      { cx: 0.55, cy: 0.35 },
  "Neuroscience":     { cx: 0.35, cy: 0.35 },
  "Sociology":        { cx: 0.30, cy: 0.40 },
  "Politics":         { cx: 0.20, cy: 0.35 },
  "Journalism":       { cx: 0.35, cy: 0.65 },
};

const FALLBACK_CENTER = { cx: 0.50, cy: 0.50 };

/** Deterministic pseudo-random jitter based on author name */
function deterministicJitter(name: string, spread: number): { dx: number; dy: number } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const dx = (((hash & 0xffff) / 0xffff) - 0.5) * spread;
  const dy = ((((hash >> 16) & 0xffff) / 0xffff) - 0.5) * spread;
  return { dx, dy };
}

/** Parse primary tag from tagsJson column */
function parsePrimaryTag(tagsJson: string | null): string {
  if (!tagsJson) return "Uncategorized";
  try {
    const tags = JSON.parse(tagsJson);
    if (Array.isArray(tags) && tags.length > 0) return String(tags[0]);
  } catch { /* ignore */ }
  return "Uncategorized";
}

// ── PCA helpers (for semantic mode) ──────────────────────────────────────────

/** Simple PCA: project N-dim vectors to 2D using first two principal components */
function pca2D(vectors: number[][]): Array<{ x: number; y: number }> {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const d = vectors[0].length;

  // Compute mean
  const mean = new Array(d).fill(0) as number[];
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j] / n;

  // Center vectors
  const centered = vectors.map(v => v.map((x, j) => x - mean[j]));

  // Power iteration for first two PCs (simplified, 20 iterations each)
  function powerIterate(data: number[][], exclude?: number[]): number[] {
    let pc = new Array(d).fill(0).map((_: number, i: number) => (i === 0 ? 1 : 0)) as number[];
    for (let iter = 0; iter < 20; iter++) {
      // Project: Av = X^T (X v)
      const proj = data.map(row => row.reduce((s, x, j) => s + x * pc[j], 0));
      let newPc = new Array(d).fill(0) as number[];
      for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) newPc[j] += data[i][j] * proj[i];
      // Deflate if we have a component to exclude
      if (exclude) {
        const dot = newPc.reduce((s, x, j) => s + x * exclude[j], 0);
        newPc = newPc.map((x, j) => x - dot * exclude[j]);
      }
      // Normalize
      const norm = Math.sqrt(newPc.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) break;
      pc = newPc.map(x => x / norm);
    }
    return pc;
  }

  const pc1 = powerIterate(centered);
  const pc2 = powerIterate(centered, pc1);

  // Project all points
  const coords = centered.map(v => ({
    x: v.reduce((s, x, j) => s + x * pc1[j], 0),
    y: v.reduce((s, x, j) => s + x * pc2[j], 0),
  }));

  // Normalize to [0.05, 0.95]
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

// ── Router ────────────────────────────────────────────────────────────────────

export const semanticMapRouter = router({
  /**
   * Fast tag-based map (default).
   * Returns immediately using deterministic layout.
   */
  getFastMap: adminProcedure.query(async (): Promise<SemanticMapData> => {
    const db = await getDb();
    if (!db) return { points: [], categories: [], mode: "fast", computedAt: new Date().toISOString() };

    const authors = await db
      .select({
        id: authorProfiles.id,
        authorName: authorProfiles.authorName,
        tagsJson: authorProfiles.tagsJson,
        avatarUrl: authorProfiles.avatarUrl,
      })
      .from(authorProfiles);

    // Count books per author
    const bookCounts = await db
      .select({
        authorName: bookProfiles.authorName,
        count: sql<number>`count(*)`,
      })
      .from(bookProfiles)
      .groupBy(bookProfiles.authorName);

    const bookCountMap = new Map<string, number>();
    for (const row of bookCounts) {
      if (row.authorName) bookCountMap.set(row.authorName, Number(row.count));
    }

    const categorySet = new Set<string>();
    const points: SemanticMapPoint[] = authors.map(author => {
      const cat = parsePrimaryTag(author.tagsJson);
      categorySet.add(cat);
      const center = CATEGORY_GRID[cat] ?? FALLBACK_CENTER;
      const { dx, dy } = deterministicJitter(author.authorName, 0.12);
      return {
        id: author.id,
        name: author.authorName,
        category: cat,
        x: Math.max(0.02, Math.min(0.98, center.cx + dx)),
        y: Math.max(0.02, Math.min(0.98, center.cy + dy)),
        bookCount: bookCountMap.get(author.authorName) ?? 0,
        hasAvatar: !!author.avatarUrl,
        avatarUrl: author.avatarUrl ?? null,
      };
    });

    const categories = Array.from(categorySet).sort();

    return {
      points,
      categories,
      mode: "fast",
      computedAt: new Date().toISOString(),
    };
  }),

  /**
   * Full semantic map using Gemini embeddings + PCA.
   * Expensive — only call on demand (button click).
   * Limits to top 100 authors with bios to keep latency reasonable.
   */
  getSemanticMap: adminProcedure
    .input(z.object({ limit: z.number().min(10).max(200).default(100) }))
    .mutation(async ({ input }): Promise<SemanticMapData> => {
      const db = await getDb();
      if (!db) return { points: [], categories: [], mode: "semantic", computedAt: new Date().toISOString() };

      // Fetch authors with bios (needed for embedding)
      const authors = await db
        .select({
          id: authorProfiles.id,
          authorName: authorProfiles.authorName,
          tagsJson: authorProfiles.tagsJson,
          bio: authorProfiles.bio,
          avatarUrl: authorProfiles.avatarUrl,
        })
        .from(authorProfiles)
        .limit(input.limit);

      const bookCounts = await db
        .select({
          authorName: bookProfiles.authorName,
          count: sql<number>`count(*)`,
        })
        .from(bookProfiles)
        .groupBy(bookProfiles.authorName);

      const bookCountMap = new Map<string, number>();
      for (const row of bookCounts) {
        if (row.authorName) bookCountMap.set(row.authorName, Number(row.count));
      }

      // Embed each author's name + bio (in parallel batches of 10)
      const BATCH_SIZE = 10;
      const embeddings: Array<{ authorIdx: number; vector: number[] }> = [];

      for (let i = 0; i < authors.length; i += BATCH_SIZE) {
        const batch = authors.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (author, batchIdx) => {
            const text = [author.authorName, author.bio?.slice(0, 300)]
              .filter(Boolean)
              .join(" — ");
            const vector = await embedText(text);
            return { authorIdx: i + batchIdx, vector };
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled") embeddings.push(r.value);
        }
      }

      if (embeddings.length < 3) {
        // Not enough data — fall back to fast mode
        return { points: [], categories: [], mode: "semantic", computedAt: new Date().toISOString() };
      }

      // Run PCA
      const vectorMatrix = embeddings.map(e => e.vector);
      const coords2D = pca2D(vectorMatrix);

      const categorySet = new Set<string>();
      const points: SemanticMapPoint[] = embeddings.map((e, i) => {
        const author = authors[e.authorIdx];
        const coord = coords2D[i];
        const cat = parsePrimaryTag(author.tagsJson);
        categorySet.add(cat);
        return {
          id: author.id,
          name: author.authorName,
          category: cat,
          x: coord.x,
          y: coord.y,
          bookCount: bookCountMap.get(author.authorName) ?? 0,
          hasAvatar: !!author.avatarUrl,
          avatarUrl: author.avatarUrl ?? null,
        };
      });

      const categories = Array.from(categorySet).sort();

      return {
        points,
        categories,
        mode: "semantic",
        computedAt: new Date().toISOString(),
      };
    }),
});
