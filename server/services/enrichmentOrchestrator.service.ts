/**
 * enrichmentOrchestrator.service.ts
 *
 * The Autonomous Intelligence Gathering Engine.
 *
 * This is the N+1 pipeline brain. It:
 *   1. Runs as a background loop inside the Express server process
 *   2. Reads enrichment_schedules to determine which pipelines are enabled + due
 *   3. Builds a priority-ordered work queue of authors/books that need enrichment
 *   4. Executes each pipeline in controlled concurrency batches
 *   5. Writes progress to enrichment_jobs for live monitoring
 *   6. Never blocks the HTTP server — all work is async fire-and-forget
 *
 * Pipeline registry (pipelineKey → handler):
 *   enrich-social-stats      → Wikipedia + Twitter + LinkedIn + YouTube stats
 *   enrich-bios              → Perplexity + Wikipedia bio fetch
 *   discover-platforms       → Multi-platform URL discovery
 *   enrich-rich-bios         → LLM-powered rich biography generation
 *   enrich-book-summaries    → Open Library + Amazon metadata
 *   enrich-rich-summaries    → LLM-powered rich book summary generation
 *   url-health-check         → HTTP HEAD check on all content_item URLs
 *   content-quality-score    → LLM merit scoring for content items
 *   neon-index-authors        → Embed + upsert all authors to Neon pgvector
 *   neon-index-books          → Embed + upsert all books to Neon pgvector
 *   neon-index-content-items  → Embed + upsert all content items to Neon pgvector
 *   neon-index-rag-files      → Fetch RAG files from S3 and embed into Neon rag_files namespace
 *   rag-readiness-scan       → Compute ragReadinessScore for all authors
 *   chatbot-candidate-scan   → Flag chatbot-ready authors in human_review_queue
 */

import { getDb } from "../db";
import {
  authorProfiles,
  authorRagProfiles,
  bookProfiles,
  contentItems,
  enrichmentSchedules,
  enrichmentJobs,
  humanReviewQueue,
} from "../../drizzle/schema";
import { eq, and, lt, or, isNull, desc, asc, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { computeRagReadiness } from "./ragReadiness.service";
import { indexAuthorIncremental, indexBookIncremental } from "./incrementalIndex.service";
import { indexContentItem, indexRagFile } from "./ragPipeline.service";
import { batchScoreContentItems } from "./contentIntelligence.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobProgress {
  jobId: number;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

type PipelineHandler = (
  progress: JobProgress,
  batchSize: number,
  concurrency: number
) => Promise<void>;

// ─── Orchestrator State ───────────────────────────────────────────────────────

let orchestratorRunning = false;
let orchestratorTimer: ReturnType<typeof setTimeout> | null = null;

// Tick interval: check for due pipelines every 5 minutes
const TICK_INTERVAL_MS = 5 * 60 * 1000;

// ─── Pipeline Handlers ────────────────────────────────────────────────────────

/**
 * enrich-social-stats: Fetch Wikipedia + social stats for authors missing them.
 */
async function runSocialStatsEnrichment(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get authors that haven't been enriched recently (>7 days or never)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const authors = await db
    .select({ authorName: authorProfiles.authorName, enrichedAt: authorProfiles.enrichedAt })
    .from(authorProfiles)
    .where(or(isNull(authorProfiles.enrichedAt), lt(authorProfiles.enrichedAt, cutoff)))
    .orderBy(asc(authorProfiles.enrichedAt))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  // Process in controlled concurrency batches
  for (let i = 0; i < authors.length; i += concurrency) {
    const batch = authors.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (author) => {
        try {
          const { enrichAuthorSocialStats } = await import("../enrichment/socialStats");
          await enrichAuthorSocialStats(
            { authorName: author.authorName },
            {
              youtubeApiKey: process.env.YOUTUBE_API_KEY,
              apifyApiToken: process.env.APIFY_API_TOKEN,
              rapidApiKey: process.env.RAPIDAPI_KEY,
              twitterBearerToken: process.env.TWITTER_BEARER_TOKEN,
              phases: ["A"],
            }
          );
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          await updateJobProgress(progress.jobId, {
            processedItems: progress.processed,
            succeededItems: progress.succeeded,
            failedItems: progress.failed,
            progress: Math.round((progress.processed / progress.total) * 100),
          });
        }
      })
    );
  }
}

/**
 * enrich-bios: Fetch Wikipedia bio for authors missing a bio.
 */
async function runBioEnrichment(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ id: authorProfiles.id, authorName: authorProfiles.authorName })
    .from(authorProfiles)
    .where(or(isNull(authorProfiles.bio), eq(authorProfiles.bio, "")))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  for (let i = 0; i < authors.length; i += concurrency) {
    const batch = authors.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (author) => {
        try {
          const { fetchWikipediaStats } = await import("../enrichment/wikipedia");
          const stats = await fetchWikipediaStats(author.authorName, null);
          if (stats?.extract) {
            await db
              .update(authorProfiles)
              .set({ bio: stats.extract, enrichedAt: new Date() })
              .where(eq(authorProfiles.authorName, author.authorName));
            // Re-index in Neon so the author vector stays fresh
            indexAuthorIncremental(author.id, author.authorName, stats.extract).catch(() => {});
          }
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          await updateJobProgress(progress.jobId, {
            processedItems: progress.processed,
            succeededItems: progress.succeeded,
            failedItems: progress.failed,
            progress: Math.round((progress.processed / progress.total) * 100),
          });
        }
      })
    );
  }
}

/**
 * discover-platforms: Auto-discover author website, Twitter, LinkedIn, YouTube, Substack.
 */
async function runPlatformDiscovery(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ authorName: authorProfiles.authorName, websiteUrl: authorProfiles.websiteUrl })
    .from(authorProfiles)
    .where(isNull(authorProfiles.websiteUrl))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  for (let i = 0; i < authors.length; i += concurrency) {
    const batch = authors.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (author) => {
        try {
          const perplexityKey = process.env.PERPLEXITY_API_KEY;
          if (!perplexityKey) { progress.skipped++; return; }
          const { discoverAuthorPlatforms } = await import("../enrichment/platforms");
          const result = await discoverAuthorPlatforms(author.authorName, perplexityKey);
          if (result?.links) {
            const links = result.links;
            const updates: Record<string, string | null> = {};
            if (links.websiteUrl) updates.websiteUrl = links.websiteUrl;
            if (links.twitterUrl) updates.twitterUrl = links.twitterUrl;
            if (links.linkedinUrl) updates.linkedinUrl = links.linkedinUrl;
            if (links.youtubeUrl) updates.youtubeUrl = links.youtubeUrl;
            if (links.substackUrl) updates.substackUrl = links.substackUrl;
            if (Object.keys(updates).length > 0) {
              await db
                .update(authorProfiles)
                .set(updates)
                .where(eq(authorProfiles.authorName, author.authorName));
            }
          }
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          await updateJobProgress(progress.jobId, {
            processedItems: progress.processed,
            succeededItems: progress.succeeded,
            failedItems: progress.failed,
            progress: Math.round((progress.processed / progress.total) * 100),
          });
        }
      })
    );
  }
}

/**
 * enrich-rich-bios: Generate LLM-powered rich biographies for authors missing them.
 */
async function runRichBioEnrichment(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
    .from(authorProfiles)
    .where(and(isNull(authorProfiles.richBioJson), sql`${authorProfiles.bio} IS NOT NULL AND ${authorProfiles.bio} != ''`))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  // Rich bio generation is expensive — use concurrency=1 to avoid rate limits
  for (const author of authors) {
    try {
      const { enrichRichBio } = await import("../enrichment/richBio");
      const richBio = await enrichRichBio(author.authorName, author.bio);
      if (richBio) {
        await db
          .update(authorProfiles)
          .set({ richBioJson: JSON.stringify(richBio), enrichedAt: new Date() })
          .where(eq(authorProfiles.authorName, author.authorName));
        // Re-index in Neon using the richer fullBio text
        indexAuthorIncremental(author.id, author.authorName, author.bio, JSON.stringify(richBio)).catch(() => {});
      }
      progress.succeeded++;
    } catch {
      progress.failed++;
    } finally {
      progress.processed++;
      await updateJobProgress(progress.jobId, {
        processedItems: progress.processed,
        succeededItems: progress.succeeded,
        failedItems: progress.failed,
        progress: Math.round((progress.processed / progress.total) * 100),
      });
    }
  }
}

/**
 * enrich-book-summaries: Fetch Open Library + Amazon metadata for books missing summaries.
 */
async function runBookSummaryEnrichment(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary })
    .from(bookProfiles)
    .where(or(isNull(bookProfiles.summary), eq(bookProfiles.summary, "")))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: books.length });
  progress.total = books.length;

  for (let i = 0; i < books.length; i += concurrency) {
    const batch = books.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (book) => {
        try {
          const { searchBooks, enrichBookFromOpenLibrary } = await import("../enrichment/openLibrary");
          const results = await searchBooks(`${book.bookTitle} ${book.authorName}`, 3);
          if (results.length > 0) {
            const enriched = await enrichBookFromOpenLibrary({ title: book.bookTitle, authorName: book.authorName ?? "" });
            if (enriched?.publisher) {
              // Update publisher info from Open Library
              await db
                .update(bookProfiles)
                .set({ publisher: enriched.publisher, enrichedAt: new Date() })
                .where(eq(bookProfiles.id, book.id));
            }
          }
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          await updateJobProgress(progress.jobId, {
            processedItems: progress.processed,
            succeededItems: progress.succeeded,
            failedItems: progress.failed,
            progress: Math.round((progress.processed / progress.total) * 100),
          });
        }
      })
    );
  }
}

/**
 * enrich-rich-summaries: Generate LLM-powered rich book summaries.
 */
async function runRichSummaryEnrichment(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary, richSummaryJson: bookProfiles.richSummaryJson })
    .from(bookProfiles)
    .where(and(isNull(bookProfiles.richSummaryJson), sql`${bookProfiles.summary} IS NOT NULL AND ${bookProfiles.summary} != ''`))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: books.length });
  progress.total = books.length;

  for (const book of books) {
    try {
      const { enrichRichSummary } = await import("../enrichment/richSummary");
      const richSummary = await enrichRichSummary(book.bookTitle, book.authorName ?? "", book.summary);
      if (richSummary) {
        await db
          .update(bookProfiles)
          .set({ richSummaryJson: JSON.stringify(richSummary), enrichedAt: new Date() })
          .where(eq(bookProfiles.id, book.id));
        // Re-index in Neon using the richer summary text
        const richText = richSummary.fullSummary ?? book.summary ?? "";
        indexBookIncremental(book.id, book.bookTitle, book.authorName, richText).catch(() => {});
      }
      progress.succeeded++;
    } catch {
      progress.failed++;
    } finally {
      progress.processed++;
      await updateJobProgress(progress.jobId, {
        processedItems: progress.processed,
        succeededItems: progress.succeeded,
        failedItems: progress.failed,
        progress: Math.round((progress.processed / progress.total) * 100),
      });
    }
  }
}

/**
 * url-health-check: HTTP HEAD check on all content_item URLs. Flags broken links.
 */
async function runUrlHealthCheck(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const items = await db
    .select({ id: contentItems.id, url: contentItems.url, title: contentItems.title })
    .from(contentItems)
    .where(and(sql`${contentItems.url} IS NOT NULL AND ${contentItems.url} != ''`, eq(contentItems.includedInLibrary, 1)))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: items.length });
  progress.total = items.length;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          let statusCode = 0;
          let isHealthy = false;
          try {
            const res = await fetch(item.url!, {
              method: "HEAD",
              signal: controller.signal,
              redirect: "follow",
              headers: { "User-Agent": "Mozilla/5.0 (compatible; LibraryBot/1.0)" },
            });
            statusCode = res.status;
            isHealthy = res.status >= 200 && res.status < 400;
          } finally {
            clearTimeout(timer);
          }

          if (!isHealthy) {
            // Flag in human_review_queue
            await db.insert(humanReviewQueue).values({
              reviewType: "url_quality",
              status: "pending",
              entityType: "content_item",
              entityName: item.title,
              aiConfidence: String(1.0),
              aiReason: `URL returned HTTP ${statusCode}`,
              aiSuggestedAction: statusCode === 404 ? "remove_link" : "verify_link",
              priority: statusCode === 404 ? 8 : 5,
            });
          }
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          if (progress.processed % 10 === 0) {
            await updateJobProgress(progress.jobId, {
              processedItems: progress.processed,
              succeededItems: progress.succeeded,
              failedItems: progress.failed,
              progress: Math.round((progress.processed / progress.total) * 100),
            });
          }
        }
      })
    );
  }
}

/**
 * content-quality-score: LLM merit scoring for content items.
 * Uses the dedicated contentIntelligence.service for URL health + LLM scoring.
 * Persists scores to dedicated columns: qualityScore, relevanceScore, authorityScore, freshnessScore, depthScore, isAlive.
 */
async function runContentQualityScoring(progress: JobProgress, batchSize: number, _concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Count unscored items first
  const unscoredItems = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(and(
      eq(contentItems.includedInLibrary, 1),
      isNull(contentItems.qualityScore),
    ))
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: unscoredItems.length });
  progress.total = unscoredItems.length;

  // Delegate to the dedicated contentIntelligence service
  const result = await batchScoreContentItems({
    limit: batchSize,
    onProgress: async (processed, total) => {
      progress.processed = processed;
      progress.total = total;
      await updateJobProgress(progress.jobId, {
        processedItems: processed,
        succeededItems: progress.succeeded,
        failedItems: progress.failed,
        progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      });
    },
  });

  progress.processed = result.processed;
  progress.succeeded = result.succeeded;
  progress.failed = result.failed;

  // Flag dead links for human review
  if (result.deadLinks > 0) {
    const deadItems = await db
      .select({ id: contentItems.id, title: contentItems.title, url: contentItems.url })
      .from(contentItems)
      .where(and(
        eq(contentItems.isAlive, 0),
        isNull(humanReviewQueue.id),
      ))
      .leftJoin(humanReviewQueue, and(
        sql`${humanReviewQueue.entityType} = 'content_item'`,
        sql`${humanReviewQueue.reviewType} = 'link_merit'`,
        sql`${humanReviewQueue.status} = 'pending'`,
      ))
      .limit(50);

    for (const dead of deadItems) {
      try {
        await db.insert(humanReviewQueue).values({
          reviewType: "link_merit",
          status: "pending",
          entityType: "content_item",
          entityName: dead.title,
          aiConfidence: "0.95",
          aiReason: `Dead link — URL returned HTTP error: ${dead.url}`,
          aiSuggestedAction: "remove_link",
          priority: 9,
        });
      } catch { /* already queued */ }
    }
  }
}

/**
 * neon-index-authors: Embed + upsert all un-indexed authors to Neon pgvector.
 */
async function runNeonIndexAuthors(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ id: authorProfiles.id, authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
    .from(authorProfiles)
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  for (let i = 0; i < authors.length; i += concurrency) {
    const batch = authors.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (author) => {
        try {
          await indexAuthorIncremental(
            author.id,
            author.authorName,
            author.bio,
            author.richBioJson,
          );
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          if (progress.processed % 5 === 0) {
            await updateJobProgress(progress.jobId, {
              processedItems: progress.processed,
              succeededItems: progress.succeeded,
              failedItems: progress.failed,
              progress: Math.round((progress.processed / progress.total) * 100),
            });
          }
        }
      })
    );
  }
}

/**
 * neon-index-books: Embed + upsert all un-indexed books to Neon pgvector.
 */
async function runNeonIndexBooks(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const books = await db
    .select({ id: bookProfiles.id, bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary })
    .from(bookProfiles)
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: books.length });
  progress.total = books.length;

  for (let i = 0; i < books.length; i += concurrency) {
    const batch = books.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (book) => {
        try {
          await indexBookIncremental(
            book.id,
            book.bookTitle,
            book.authorName,
            book.summary,
          );
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          if (progress.processed % 5 === 0) {
            await updateJobProgress(progress.jobId, {
              processedItems: progress.processed,
              succeededItems: progress.succeeded,
              failedItems: progress.failed,
              progress: Math.round((progress.processed / progress.total) * 100),
            });
          }
        }
      })
    );
  }
}

/**
 * neon-index-content-items: Embed + upsert all content items with descriptions to Neon pgvector.
 */
async function runNeonIndexContentItems(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const items = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      contentType: contentItems.contentType,
      description: contentItems.description,
      url: contentItems.url,
    })
    .from(contentItems)
    .where(
      and(
        sql`${contentItems.description} IS NOT NULL AND TRIM(${contentItems.description}) != ''`,
        eq(contentItems.includedInLibrary, 1)
      )
    )
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: items.length });
  progress.total = items.length;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          if (!item.description || item.description.trim().length < 20) {
            progress.skipped++;
            return;
          }
          await indexContentItem({
            itemId: String(item.id),
            title: item.title,
            contentType: item.contentType,
            url: item.url,
            description: item.description,
          });
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          if (progress.processed % 5 === 0) {
            await updateJobProgress(progress.jobId, {
              processedItems: progress.processed,
              succeededItems: progress.succeeded,
              failedItems: progress.failed,
              progress: Math.round((progress.processed / progress.total) * 100),
            });
          }
        }
      })
    );
  }
}

/**
 * neon-index-rag-files: Fetch each author's RAG file from S3 and embed it into Neon rag_files namespace.
 */
async function runNeonIndexRagFiles(progress: JobProgress, batchSize: number, concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const ragRows = await db
    .select({
      authorName: authorRagProfiles.authorName,
      ragFileUrl: authorRagProfiles.ragFileUrl,
      ragVersion: authorRagProfiles.ragVersion,
      ragStatus: authorRagProfiles.ragStatus,
    })
    .from(authorRagProfiles)
    .where(
      and(
        eq(authorRagProfiles.ragStatus, "ready"),
        sql`${authorRagProfiles.ragFileUrl} IS NOT NULL AND TRIM(${authorRagProfiles.ragFileUrl}) != ''`
      )
    )
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: ragRows.length });
  progress.total = ragRows.length;

  for (let i = 0; i < ragRows.length; i += concurrency) {
    const batch = ragRows.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (row) => {
        try {
          if (!row.ragFileUrl) { progress.skipped++; return; }
          // Fetch the RAG Markdown file from S3
          const resp = await fetch(row.ragFileUrl);
          if (!resp.ok) { progress.failed++; return; }
          const ragContent = await resp.text();
          if (ragContent.trim().length < 100) { progress.skipped++; return; }
          await indexRagFile({
            authorName: row.authorName,
            ragContent,
            ragVersion: row.ragVersion ?? 1,
          });
          progress.succeeded++;
        } catch {
          progress.failed++;
        } finally {
          progress.processed++;
          if (progress.processed % 5 === 0) {
            await updateJobProgress(progress.jobId, {
              processedItems: progress.processed,
              succeededItems: progress.succeeded,
              failedItems: progress.failed,
              progress: Math.round((progress.processed / progress.total) * 100),
            });
          }
        }
      })
    );
  }
}

/**
 * rag-readiness-scan: Compute ragReadinessScore for all authors.
 */
async function runRagReadinessScan(progress: JobProgress, batchSize: number, _concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ authorName: authorProfiles.authorName })
    .from(authorProfiles)
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  for (const author of authors) {
    try {
      await computeRagReadiness(author.authorName);
      progress.succeeded++;
    } catch {
      progress.failed++;
    } finally {
      progress.processed++;
      if (progress.processed % 10 === 0) {
        await updateJobProgress(progress.jobId, {
          processedItems: progress.processed,
          succeededItems: progress.succeeded,
          failedItems: progress.failed,
          progress: Math.round((progress.processed / progress.total) * 100),
        });
      }
    }
  }
}

/**
 * chatbot-candidate-scan: Flag chatbot-ready authors in human_review_queue.
 */
async function runChatbotCandidateScan(progress: JobProgress, batchSize: number, _concurrency: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const authors = await db
    .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
    .from(authorProfiles)
    .limit(batchSize);

  await updateJobProgress(progress.jobId, { totalItems: authors.length });
  progress.total = authors.length;

  for (const author of authors) {
    try {
      const result2 = await computeRagReadiness(author.authorName);
      const score = result2?.score ?? 0;
      if (score >= 50) {
        await db.insert(humanReviewQueue).values({
          reviewType: "chatbot_candidate",
          status: "pending",
          entityType: "author",
          entityName: author.authorName,
          aiConfidence: String(score / 100),
          aiReason: `RAG readiness score: ${score}/100`,
          aiSuggestedAction: score >= 75 ? "enable_chatbot" : "enrich_first",
          priority: score >= 75 ? 8 : 5,
        });
      }
      progress.succeeded++;
    } catch {
      progress.failed++;
    } finally {
      progress.processed++;
      if (progress.processed % 10 === 0) {
        await updateJobProgress(progress.jobId, {
          processedItems: progress.processed,
          succeededItems: progress.succeeded,
          failedItems: progress.failed,
          progress: Math.round((progress.processed / progress.total) * 100),
        });
      }
    }
  }
}

// ─── Pipeline Registry ────────────────────────────────────────────────────────

const PIPELINE_HANDLERS: Record<string, PipelineHandler> = {
  "enrich-social-stats": runSocialStatsEnrichment,
  "enrich-bios": runBioEnrichment,
  "discover-platforms": runPlatformDiscovery,
  "enrich-rich-bios": runRichBioEnrichment,
  "enrich-book-summaries": runBookSummaryEnrichment,
  "enrich-rich-summaries": runRichSummaryEnrichment,
  "url-health-check": runUrlHealthCheck,
  "content-quality-score": runContentQualityScoring,
  "neon-index-authors": runNeonIndexAuthors,
  "neon-index-books": runNeonIndexBooks,
  "neon-index-content-items": runNeonIndexContentItems,
  "neon-index-rag-files": runNeonIndexRagFiles,
  "rag-readiness-scan": runRagReadinessScan,
  "chatbot-candidate-scan": runChatbotCandidateScan,
};

// ─── Job Helpers ──────────────────────────────────────────────────────────────

async function updateJobProgress(
  jobId: number,
  updates: Partial<{
    status: string;
    totalItems: number;
    processedItems: number;
    succeededItems: number;
    failedItems: number;
    skippedItems: number;
    progress: number;
    message: string;
    completedAt: Date;
  }>
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(enrichmentJobs)
      .set({ ...updates, updatedAt: new Date() } as Parameters<typeof db.update>[0] extends { set: infer S } ? S : never)
      .where(eq(enrichmentJobs.id, jobId));
  } catch {
    // Non-fatal — progress update failure shouldn't stop the pipeline
  }
}

async function createJobRecord(pipelineKey: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(enrichmentJobs).values({
    pipelineKey,
    status: "running",
    triggeredBy: "schedule",
    totalItems: 0,
    processedItems: 0,
    succeededItems: 0,
    failedItems: 0,
    skippedItems: 0,
    progress: 0,
    message: "Running...",
    startedAt: new Date(),
  });
  return (result as { insertId: number }).insertId;
}

// ─── Core Tick ────────────────────────────────────────────────────────────────

/**
 * orchestratorTick: Called every TICK_INTERVAL_MS.
 * Finds all enabled schedules that are due and runs them sequentially.
 */
async function orchestratorTick(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // Find enabled schedules that are due (lastRunAt + intervalHours <= now)
    const schedules = await db
      .select()
      .from(enrichmentSchedules)
      .where(eq(enrichmentSchedules.enabled, 1))
      .orderBy(desc(enrichmentSchedules.priority));

    for (const schedule of schedules) {
      const handler = PIPELINE_HANDLERS[schedule.pipelineKey];
      if (!handler) continue;

      // Check if due
      const lastRun = schedule.lastRunAt;
      const intervalMs = (schedule.intervalHours ?? 24) * 60 * 60 * 1000;
      const isDue = !lastRun || (now.getTime() - new Date(lastRun).getTime()) >= intervalMs;
      if (!isDue) continue;

      // Mark as running
      await db
        .update(enrichmentSchedules)
        .set({ lastRunAt: now })
        .where(eq(enrichmentSchedules.id, schedule.id));

      // Create job record
      let jobId: number;
      try {
        jobId = await createJobRecord(schedule.pipelineKey);
      } catch {
        continue;
      }

      const progress: JobProgress = {
        jobId,
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      };

      // Run the pipeline (fire-and-forget with error capture, 30-min timeout)
      const PIPELINE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Pipeline timed out after 30 minutes")), PIPELINE_TIMEOUT_MS)
      );
      Promise.race([
        handler(progress, schedule.batchSize ?? 20, schedule.concurrency ?? 2),
        timeoutPromise,
      ])
        .then(async () => {
          await updateJobProgress(jobId, {
            status: "completed",
            progress: 100,
            message: `Completed: ${progress.succeeded} succeeded, ${progress.failed} failed`,
            completedAt: new Date(),
          });
        })
        .catch(async (err: Error) => {
          await updateJobProgress(jobId, {
            status: "failed",
            message: err.message ?? "Unknown error",
            completedAt: new Date(),
          });
        });
    }
  } catch (err) {
    console.error("[Orchestrator] Tick error:", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the autonomous enrichment orchestrator.
 * Called once from server startup — runs indefinitely.
 */
export function startOrchestrator(): void {
  if (orchestratorRunning) return;
  orchestratorRunning = true;

  console.log("[Orchestrator] Starting autonomous enrichment engine...");

  // Run first tick after 30s (let server fully start)
  orchestratorTimer = setTimeout(async () => {
    await orchestratorTick();
    // Then run on interval
    orchestratorTimer = setInterval(orchestratorTick, TICK_INTERVAL_MS) as unknown as ReturnType<typeof setTimeout>;
  }, 30_000);
}

/**
 * Stop the orchestrator (for graceful shutdown).
 */
export function stopOrchestrator(): void {
  if (orchestratorTimer) {
    clearTimeout(orchestratorTimer);
    clearInterval(orchestratorTimer as unknown as ReturnType<typeof setInterval>);
    orchestratorTimer = null;
  }
  orchestratorRunning = false;
  console.log("[Orchestrator] Stopped.");
}

/**
 * Manually trigger a specific pipeline by key.
 * Returns the job ID for progress tracking.
 */
export async function triggerPipeline(pipelineKey: string, batchSize = 20, concurrency = 2): Promise<number> {
  const handler = PIPELINE_HANDLERS[pipelineKey];
  if (!handler) throw new Error(`Unknown pipeline: ${pipelineKey}`);

  const jobId = await createJobRecord(pipelineKey);
  const progress: JobProgress = { jobId, total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  // Fire and forget
  handler(progress, batchSize, concurrency)
    .then(async () => {
      await updateJobProgress(jobId, {
        status: "completed",
        progress: 100,
        message: `Completed: ${progress.succeeded} succeeded, ${progress.failed} failed`,
        completedAt: new Date(),
      });
    })
    .catch(async (err: Error) => {
      await updateJobProgress(jobId, {
        status: "failed",
        message: err.message ?? "Unknown error",
        completedAt: new Date(),
      });
    });

  return jobId;
}

/**
 * Get all registered pipeline keys.
 */
export function getRegisteredPipelines(): string[] {
  return Object.keys(PIPELINE_HANDLERS);
}

/**
 * Seed the default pipeline schedules into the DB if they don't exist.
 * Called at server startup.
 */
export async function seedDefaultSchedules(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const DEFAULT_SCHEDULES = [
    { pipelineKey: "enrich-social-stats", label: "Enrich Social Stats", entityType: "author" as const, intervalHours: 168, priority: 8, batchSize: 30, concurrency: 3 },
    { pipelineKey: "enrich-bios", label: "Enrich Author Bios", entityType: "author" as const, intervalHours: 720, priority: 7, batchSize: 20, concurrency: 2 },
    { pipelineKey: "discover-platforms", label: "Discover Author Platforms", entityType: "author" as const, intervalHours: 720, priority: 6, batchSize: 20, concurrency: 2 },
    { pipelineKey: "enrich-rich-bios", label: "Generate Rich Biographies", entityType: "author" as const, intervalHours: 2160, priority: 5, batchSize: 10, concurrency: 1 },
    { pipelineKey: "enrich-book-summaries", label: "Enrich Book Summaries", entityType: "book" as const, intervalHours: 720, priority: 6, batchSize: 20, concurrency: 2 },
    { pipelineKey: "enrich-rich-summaries", label: "Generate Rich Book Summaries", entityType: "book" as const, intervalHours: 2160, priority: 4, batchSize: 10, concurrency: 1 },
    { pipelineKey: "url-health-check", label: "URL Health Check", entityType: "both" as const, intervalHours: 168, priority: 9, batchSize: 100, concurrency: 10 },
    { pipelineKey: "content-quality-score", label: "Content Quality Scoring", entityType: "both" as const, intervalHours: 2160, priority: 5, batchSize: 20, concurrency: 1 },
    { pipelineKey: "neon-index-authors", label: "Neon: Index Authors", entityType: "author" as const, intervalHours: 168, priority: 7, batchSize: 50, concurrency: 5 },
    { pipelineKey: "neon-index-books", label: "Neon: Index Books", entityType: "book" as const, intervalHours: 168, priority: 7, batchSize: 50, concurrency: 5 },
    { pipelineKey: "neon-index-content-items", label: "Neon: Index Content Items", entityType: "both" as const, intervalHours: 168, priority: 6, batchSize: 100, concurrency: 5 },
    { pipelineKey: "neon-index-rag-files", label: "Neon: Index RAG Files", entityType: "author" as const, intervalHours: 72, priority: 8, batchSize: 50, concurrency: 3 },
    { pipelineKey: "rag-readiness-scan", label: "RAG Readiness Scan", entityType: "author" as const, intervalHours: 48, priority: 8, batchSize: 169, concurrency: 5 },
    { pipelineKey: "chatbot-candidate-scan", label: "Chatbot Candidate Scan", entityType: "author" as const, intervalHours: 48, priority: 7, batchSize: 169, concurrency: 5 },
  ];

  for (const schedule of DEFAULT_SCHEDULES) {
    const existing = await db
      .select({ id: enrichmentSchedules.id })
      .from(enrichmentSchedules)
      .where(eq(enrichmentSchedules.pipelineKey, schedule.pipelineKey))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(enrichmentSchedules).values({
        pipelineKey: schedule.pipelineKey,
        label: schedule.label,
        entityType: schedule.entityType,
        intervalHours: schedule.intervalHours,
        priority: schedule.priority,
        enabled: 0, // Off by default — admin must enable
        batchSize: schedule.batchSize,
        concurrency: schedule.concurrency,
      });
    }
  }

  console.log("[Orchestrator] Default schedules seeded.");
}
