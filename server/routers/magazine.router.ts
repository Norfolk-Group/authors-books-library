/**
 * magazine.router.ts
 *
 * tRPC router for the unified magazine article pipeline.
 * Covers: The Atlantic, The New Yorker, Wired, NYT, The Washington Post.
 *
 * Procedures:
 *   magazine.syncFeed         — fetch RSS for one source and upsert to DB
 *   magazine.syncAll          — sync all 5 sources in parallel
 *   magazine.getByAuthor      — get cached articles for a library author
 *   magazine.getBySource      — get cached articles for a publication
 *   magazine.scrapeArticle    — scrape full text for one article via Apify
 *   magazine.scrapeByAuthor   — scrape all unscraped articles for an author
 *   magazine.getSources       — list available publication sources
 */

import { z } from "zod";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { magazineArticles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import {
  fetchMagazineFeed,
  fetchAllMagazines,
  matchArticlesToAuthor,
  toInsertRow,
  PUBLICATIONS,
  type MagazineSource,
} from "../services/magazine.service";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const MagazineSourceEnum = z.enum([
  "the-atlantic",
  "the-new-yorker",
  "wired",
  "nyt",
  "washington-post",
]);

// ── Apify full-text scraper ───────────────────────────────────────────────────

async function scrapeArticleText(url: string, source: MagazineSource): Promise<string | null> {
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) return null;

  const pub = PUBLICATIONS.find(p => p.source === source);
  const bodySelector = pub?.articleBodySelector ?? "article, .article-body, main";

  try {
    const runRes = await fetch("https://api.apify.com/v2/acts/apify~cheerio-scraper/runs?token=" + apifyToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url }],
        pageFunction: `async function pageFunction({ $, request }) {
          const removeSelectors = ${JSON.stringify(pub?.removeSelectors ?? [])};
          removeSelectors.forEach(sel => $(sel).remove());
          const bodyEl = $('${bodySelector.replace(/'/g, "\\'")}');
          const text = bodyEl.length ? bodyEl.text() : $('article, main, .content').text();
          return { url: request.url, text: text.replace(/\\s+/g, ' ').trim().slice(0, 50000) };
        }`,
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1,
      }),
    });

    if (!runRes.ok) return null;
    const run = await runRes.json() as { data?: { id?: string } };
    const runId = run?.data?.id;
    if (!runId) return null;

    // Poll for completion (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      const status = await statusRes.json() as { data?: { status?: string } };
      if (status?.data?.status === "SUCCEEDED") break;
      if (status?.data?.status === "FAILED" || status?.data?.status === "ABORTED") return null;
    }

    const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apifyToken}`);
    if (!dataRes.ok) return null;
    const items = await dataRes.json() as Array<{ text?: string }>;
    return items?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const magazineRouter = router({
  /** List all available publication sources with metadata */
  getSources: publicProcedure.query(() => {
    return PUBLICATIONS.map(p => ({
      source: p.source,
      name: p.name,
      feedCount: p.feeds.length,
    }));
  }),

  /** Sync RSS feeds for a single publication source and upsert to DB */
  syncFeed: adminProcedure
    .input(z.object({ source: MagazineSourceEnum }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const articles = await fetchMagazineFeed(input.source);
      let inserted = 0;
      let updated = 0;

      for (const article of articles) {
        const row = toInsertRow(article);
        const existing = await db
          .select({ id: magazineArticles.id })
          .from(magazineArticles)
          .where(eq(magazineArticles.articleId, row.articleId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(magazineArticles).values(row);
          inserted++;
        } else {
          // Update metadata but preserve fullText and scrape status
          await db
            .update(magazineArticles)
            .set({
              title: row.title,
              authorName: row.authorName,
              authorNameNormalized: row.authorNameNormalized,
              summaryText: row.summaryText,
              publishedAt: row.publishedAt,
              categoriesJson: row.categoriesJson,
              updatedAt: new Date(),
            })
            .where(eq(magazineArticles.articleId, row.articleId));
          updated++;
        }
      }

      return { source: input.source, fetched: articles.length, inserted, updated };
    }),

  /** Sync all 5 publications in parallel */
  syncAll: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const sources: MagazineSource[] = ["the-atlantic", "the-new-yorker", "wired", "nyt", "washington-post"];
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const articles = await fetchMagazineFeed(source);
        let inserted = 0;
        let updated = 0;

        for (const article of articles) {
          const row = toInsertRow(article);
          const existing = await db
            .select({ id: magazineArticles.id })
            .from(magazineArticles)
            .where(eq(magazineArticles.articleId, row.articleId))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(magazineArticles).values(row);
            inserted++;
          } else {
            await db
              .update(magazineArticles)
              .set({
                title: row.title,
                authorName: row.authorName,
                authorNameNormalized: row.authorNameNormalized,
                summaryText: row.summaryText,
                publishedAt: row.publishedAt,
                categoriesJson: row.categoriesJson,
                updatedAt: new Date(),
              })
              .where(eq(magazineArticles.articleId, row.articleId));
            updated++;
          }
        }

        return { source, fetched: articles.length, inserted, updated };
      })
    );

    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { source: sources[i], error: String(r.reason), fetched: 0, inserted: 0, updated: 0 }
    );
  }),

  /** Get cached articles for a library author (matched by name) */
  getByAuthor: publicProcedure
    .input(z.object({
      authorName: z.string().min(2),
      source: MagazineSourceEnum.optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { articles: [], total: 0 };

      const normalizedName = input.authorName
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const conditions = [
        sql`${magazineArticles.authorNameNormalized} LIKE ${`%${normalizedName}%`}`,
      ];
      if (input.source) {
        conditions.push(eq(magazineArticles.source, input.source));
      }

      const [articles, countResult] = await Promise.all([
        db
          .select()
          .from(magazineArticles)
          .where(and(...conditions))
          .orderBy(desc(magazineArticles.publishedAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(magazineArticles)
          .where(and(...conditions)),
      ]);

      return {
        articles,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  /** Get cached articles for a specific publication */
  getBySource: publicProcedure
    .input(z.object({
      source: MagazineSourceEnum,
      limit: z.number().int().min(1).max(100).default(30),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { articles: [], total: 0 };

      const [articles, countResult] = await Promise.all([
        db
          .select()
          .from(magazineArticles)
          .where(eq(magazineArticles.source, input.source))
          .orderBy(desc(magazineArticles.publishedAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(magazineArticles)
          .where(eq(magazineArticles.source, input.source)),
      ]);

      return {
        articles,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  /** Scrape full text for a single article via Apify */
  scrapeArticle: adminProcedure
    .input(z.object({ articleId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [article] = await db
        .select()
        .from(magazineArticles)
        .where(eq(magazineArticles.articleId, input.articleId))
        .limit(1);

      if (!article) throw new Error("Article not found");

      // Mark as attempted regardless of outcome
      await db
        .update(magazineArticles)
        .set({ scrapeAttempted: true, updatedAt: new Date() })
        .where(eq(magazineArticles.articleId, input.articleId));

      const fullText = await scrapeArticleText(article.url, article.source);

      if (fullText) {
        await db
          .update(magazineArticles)
          .set({ fullText, scrapedAt: new Date(), updatedAt: new Date() })
          .where(eq(magazineArticles.articleId, input.articleId));
      }

      return { success: !!fullText, articleId: input.articleId, charCount: fullText?.length ?? 0 };
    }),

  /** Scrape all unscraped articles for a given author (up to batchSize) */
  scrapeByAuthor: adminProcedure
    .input(z.object({
      authorName: z.string().min(2),
      batchSize: z.number().int().min(1).max(20).default(5),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const normalizedName = input.authorName
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const unscraped = await db
        .select()
        .from(magazineArticles)
        .where(
          and(
            sql`${magazineArticles.authorNameNormalized} LIKE ${`%${normalizedName}%`}`,
            eq(magazineArticles.scrapeAttempted, false)
          )
        )
        .orderBy(desc(magazineArticles.publishedAt))
        .limit(input.batchSize);

      const results = await Promise.allSettled(
        unscraped.map(async (article) => {
          await db
            .update(magazineArticles)
            .set({ scrapeAttempted: true, updatedAt: new Date() })
            .where(eq(magazineArticles.articleId, article.articleId));

          const fullText = await scrapeArticleText(article.url, article.source);
          if (fullText) {
            await db
              .update(magazineArticles)
              .set({ fullText, scrapedAt: new Date(), updatedAt: new Date() })
              .where(eq(magazineArticles.articleId, article.articleId));
          }
          return { articleId: article.articleId, success: !!fullText };
        })
      );

      const scraped = results.filter(r => r.status === "fulfilled" && r.value.success).length;
      return { attempted: unscraped.length, scraped };
    }),

  /** Get article counts per source */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const stats = await db
      .select({
        source: magazineArticles.source,
        total: sql<number>`COUNT(*)`,
        withFullText: sql<number>`SUM(CASE WHEN ${magazineArticles.fullText} IS NOT NULL THEN 1 ELSE 0 END)`,
        withAuthor: sql<number>`SUM(CASE WHEN ${magazineArticles.authorName} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(magazineArticles)
      .groupBy(magazineArticles.source);

    return stats.map(s => ({
      source: s.source,
      total: Number(s.total),
      withFullText: Number(s.withFullText),
      withAuthor: Number(s.withAuthor),
    }));
  }),
});
