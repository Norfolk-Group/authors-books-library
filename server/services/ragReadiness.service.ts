/**
 * ragReadiness.service.ts
 *
 * Computes a RAG Readiness Score (0–100) for each author.
 *
 * The score reflects how much high-quality content the system has
 * to power an accurate, rich author-impersonation chatbot.
 *
 * Scoring formula (max 100):
 *   Books in library          0–25  pts  (5 pts per book, max 5 books)
 *   Content items linked      0–20  pts  (4 pts per item, max 5 items)
 *   Bio word count            0–20  pts  (1 pt per 50 words, max 1000 words)
 *   Bio completeness score    0–15  pts  (bioCompleteness / 100 * 15)
 *   Wikipedia URL present     5     pts
 *   LinkedIn URL present      5     pts
 *   RAG file already ready    10    pts  (bonus for existing ready file)
 *
 * Threshold for chatbot enablement: score >= 50
 * Threshold for "high quality":     score >= 75
 */

import { getDb } from "../db";
import {
  authorProfiles,
  bookProfiles,
  authorRagProfiles,
  authorContentLinks,
  humanReviewQueue,
} from "../../drizzle/schema";
import { eq, count, and } from "drizzle-orm";

export interface RagReadinessResult {
  authorName: string;
  score: number;
  breakdown: {
    bookPoints: number;
    contentItemPoints: number;
    bioWordPoints: number;
    bioCompletenessPoints: number;
    wikipediaPoints: number;
    linkedinPoints: number;
    ragReadyBonus: number;
  };
  bookCount: number;
  contentItemCount: number;
  bioWordCount: number;
  bioCompleteness: number;
  hasWikipedia: boolean;
  hasLinkedin: boolean;
  ragStatus: string | null;
  isChatbotReady: boolean;
  isHighQuality: boolean;
}

/**
 * Compute the RAG readiness score for a single author.
 */
export async function computeRagReadiness(authorName: string): Promise<RagReadinessResult | null> {
  const db = await getDb();
  if (!db) return null;

  // Fetch author profile
  const [author] = await db
    .select({
      authorName: authorProfiles.authorName,
      bio: authorProfiles.bio,
      richBioJson: authorProfiles.richBioJson,
      bioCompleteness: authorProfiles.bioCompleteness,
      wikipediaUrl: authorProfiles.wikipediaUrl,
      linkedinUrl: authorProfiles.linkedinUrl,
    })
    .from(authorProfiles)
    .where(eq(authorProfiles.authorName, authorName))
    .limit(1);

  if (!author) return null;

  // Count books for this author
  const [bookCountRow] = await db
    .select({ count: count() })
    .from(bookProfiles)
    .where(eq(bookProfiles.authorName, authorName));
  const bookCount = Number(bookCountRow?.count ?? 0);

  // Count content items linked to this author
  const [contentCountRow] = await db
    .select({ count: count() })
    .from(authorContentLinks)
    .where(eq(authorContentLinks.authorName, authorName));
  const contentItemCount = Number(contentCountRow?.count ?? 0);

  // Get RAG status
  const [ragRow] = await db
    .select({ ragStatus: authorRagProfiles.ragStatus })
    .from(authorRagProfiles)
    .where(eq(authorRagProfiles.authorName, authorName))
    .limit(1);
  const ragStatus = ragRow?.ragStatus ?? null;

  // Compute bio word count (prefer richBioJson.fullBio)
  let bioText = author.bio ?? "";
  try {
    if (author.richBioJson) {
      const rich = typeof author.richBioJson === "string"
        ? JSON.parse(author.richBioJson)
        : author.richBioJson;
      const richBio = rich?.fullBio ?? rich?.bio ?? "";
      if (richBio.length > bioText.length) bioText = richBio;
    }
  } catch { /* use plain bio */ }
  const bioWordCount = bioText.trim() ? bioText.trim().split(/\s+/).length : 0;

  // ── Score breakdown ──────────────────────────────────────────────────────
  const bookPoints = Math.min(bookCount * 5, 25);
  const contentItemPoints = Math.min(contentItemCount * 4, 20);
  const bioWordPoints = Math.min(Math.floor(bioWordCount / 50), 20);
  const bioCompletenessPoints = Math.round(((author.bioCompleteness ?? 0) / 100) * 15);
  const wikipediaPoints = author.wikipediaUrl ? 5 : 0;
  const linkedinPoints = author.linkedinUrl ? 5 : 0;
  const ragReadyBonus = ragStatus === "ready" ? 10 : 0;

  const score = Math.min(
    bookPoints + contentItemPoints + bioWordPoints +
    bioCompletenessPoints + wikipediaPoints + linkedinPoints + ragReadyBonus,
    100
  );

  return {
    authorName,
    score,
    breakdown: {
      bookPoints,
      contentItemPoints,
      bioWordPoints,
      bioCompletenessPoints,
      wikipediaPoints,
      linkedinPoints,
      ragReadyBonus,
    },
    bookCount,
    contentItemCount,
    bioWordCount,
    bioCompleteness: author.bioCompleteness ?? 0,
    hasWikipedia: !!author.wikipediaUrl,
    hasLinkedin: !!author.linkedinUrl,
    ragStatus,
    isChatbotReady: score >= 50,
    isHighQuality: score >= 75,
  };
}

/**
 * Compute RAG readiness for all authors and return sorted results.
 */
export async function computeAllRagReadiness(limit = 500): Promise<RagReadinessResult[]> {
  const db = await getDb();
  if (!db) return [];

  const authors = await db
    .select({ authorName: authorProfiles.authorName })
    .from(authorProfiles)
    .limit(limit);

  const results: RagReadinessResult[] = [];
  for (const { authorName } of authors) {
    const result = await computeRagReadiness(authorName);
    if (result) results.push(result);
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Flag authors who are chatbot-ready but not yet in the review queue.
 * Returns the number of new items added to the queue.
 */
export async function flagChatbotCandidates(limit = 200): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const allReadiness = await computeAllRagReadiness(limit);
  const candidates = allReadiness.filter(r => r.isChatbotReady);

  let added = 0;
  for (const candidate of candidates) {
    // Check if already in queue (pending or approved)
    const existing = await db
      .select({ id: humanReviewQueue.id })
      .from(humanReviewQueue)
      .where(
        and(
          eq(humanReviewQueue.entityName, candidate.authorName),
          eq(humanReviewQueue.reviewType, "chatbot_candidate"),
          eq(humanReviewQueue.status, "pending")
        )
      )
      .limit(1);

    if (existing.length > 0) continue;

    const priority = candidate.isHighQuality ? 1 : candidate.score >= 65 ? 2 : 3;

    await db.insert(humanReviewQueue).values({
      reviewType: "chatbot_candidate",
      status: "pending",
      entityName: candidate.authorName,
      entityType: "author",
      aiConfidence: String(candidate.score / 100),
      aiReason: `Author has a RAG readiness score of ${candidate.score}/100. ` +
        `${candidate.bookCount} book(s), ${candidate.contentItemCount} content item(s), ` +
        `${candidate.bioWordCount} bio words, ${candidate.bioCompleteness}% bio completeness.`,
      aiSuggestedAction: candidate.isHighQuality
        ? "Enable chatbot immediately — high-quality profile with rich content."
        : "Enable chatbot — sufficient content available for a functional persona.",
      metadataJson: JSON.stringify({
        ragReadinessScore: candidate.score,
        ragStatus: candidate.ragStatus,
        bioCompleteness: candidate.bioCompleteness,
        bookCount: candidate.bookCount,
        contentItemCount: candidate.contentItemCount,
        bioWordCount: candidate.bioWordCount,
        breakdown: candidate.breakdown,
      }),
      sourceJob: "flagChatbotCandidates",
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    added++;
  }

  return added;
}
