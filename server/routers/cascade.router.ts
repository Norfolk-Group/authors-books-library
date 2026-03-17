/**
 * cascade.router.ts
 * Provides live DB statistics for the Research Cascade panel.
 * Each procedure returns counts that reflect how many authors/books
 * were resolved at each tier of the enrichment waterfall.
 */
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";

export const cascadeRouter = router({
  /**
   * Returns live counts for the author photo enrichment waterfall:
   * - total: unique author names in the DB
   * - withPhoto: authors that have any photoUrl
   * - withS3Photo: authors whose photo is mirrored to S3
   * - withBio: authors that have a non-empty bio
   * - withWikiBio: authors enriched via Wikipedia (proxy: enrichedAt is set)
   * - withLlmBio: authors with bio but no photoUrl (LLM fallback proxy)
   * - withSocialLinks: authors with websiteUrl or twitterUrl or linkedinUrl
   * - noPhoto: authors with no photoUrl at all
   * - noBio: authors with no bio
   */
  authorStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, withPhoto: 0, withS3Photo: 0, withBio: 0, withEnrichedAt: 0, withSocialLinks: 0, noPhoto: 0, noBio: 0, fromWikipedia: 0, fromTavily: 0, fromApify: 0, fromAI: 0, sourceUnknown: 0 };
    const rows = await db
      .select({
        authorName: authorProfiles.authorName,
        bio: authorProfiles.bio,
        photoUrl: authorProfiles.photoUrl,
        s3PhotoUrl: authorProfiles.s3PhotoUrl,
        photoSource: authorProfiles.photoSource,
        websiteUrl: authorProfiles.websiteUrl,
        twitterUrl: authorProfiles.twitterUrl,
        linkedinUrl: authorProfiles.linkedinUrl,
        enrichedAt: authorProfiles.enrichedAt,
      })
      .from(authorProfiles);

    type AuthorRow = typeof rows[number];
    const total = rows.length;
    const withPhoto = rows.filter((r: AuthorRow) => r.photoUrl && r.photoUrl.length > 0).length;
    const withS3Photo = rows.filter((r: AuthorRow) => r.s3PhotoUrl && r.s3PhotoUrl.length > 0).length;
    const withBio = rows.filter((r: AuthorRow) => r.bio && r.bio.length > 0).length;
    const withEnrichedAt = rows.filter((r: AuthorRow) => r.enrichedAt != null).length;
    const withSocialLinks = rows.filter(
      (r: AuthorRow) =>
        (r.websiteUrl && r.websiteUrl.length > 0) ||
        (r.twitterUrl && r.twitterUrl.length > 0) ||
        (r.linkedinUrl && r.linkedinUrl.length > 0)
    ).length;
    const noPhoto = rows.filter((r: AuthorRow) => !r.photoUrl || r.photoUrl.length === 0).length;
    const noBio = rows.filter((r: AuthorRow) => !r.bio || r.bio.length === 0).length;

    // Per-tier photo source counts (now that photoSource column exists)
    const fromWikipedia = rows.filter((r: AuthorRow) => r.photoSource === "wikipedia").length;
    const fromTavily = rows.filter((r: AuthorRow) => r.photoSource === "tavily").length;
    const fromApify = rows.filter((r: AuthorRow) => r.photoSource === "apify").length;
    const fromAI = rows.filter((r: AuthorRow) => r.photoSource === "ai").length;
    const sourceUnknown = rows.filter((r: AuthorRow) => r.photoUrl && r.photoUrl.length > 0 && !r.photoSource).length;

    return {
      total,
      withPhoto,
      withS3Photo,
      withBio,
      withEnrichedAt,
      withSocialLinks,
      noPhoto,
      noBio,
      // Per-tier breakdown
      fromWikipedia,
      fromTavily,
      fromApify,
      fromAI,
      sourceUnknown,
    };
  }),

  /**
   * Returns live counts for the book cover + metadata enrichment waterfall:
   * - total: unique book titles in the DB
   * - withCover: books that have a coverImageUrl
   * - withS3Cover: books whose cover is mirrored to S3
   * - withSummary: books with a non-empty summary
   * - withIsbn: books with an ISBN
   * - withAmazonUrl: books with an Amazon URL
   * - withRating: books with a rating
   * - enrichedAt: books that have been enriched (any field set)
   * - noCover: books with no cover at all
   * - noSummary: books with no summary
   */
  bookStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, withCover: 0, withS3Cover: 0, withSummary: 0, withIsbn: 0, withAmazonUrl: 0, withRating: 0, withEnrichedAt: 0, withPublisher: 0, noCover: 0, noSummary: 0 };
    const rows = await db
      .select({
        bookTitle: bookProfiles.bookTitle,
        coverImageUrl: bookProfiles.coverImageUrl,
        s3CoverUrl: bookProfiles.s3CoverUrl,
        summary: bookProfiles.summary,
        isbn: bookProfiles.isbn,
        amazonUrl: bookProfiles.amazonUrl,
        rating: bookProfiles.rating,
        enrichedAt: bookProfiles.enrichedAt,
        publisher: bookProfiles.publisher,
        publishedDate: bookProfiles.publishedDate,
      })
      .from(bookProfiles);

    type BookRow = typeof rows[number];
    const total = rows.length;
    const withCover = rows.filter((r: BookRow) => r.coverImageUrl && r.coverImageUrl.length > 0).length;
    const withS3Cover = rows.filter((r: BookRow) => r.s3CoverUrl && r.s3CoverUrl.length > 0).length;
    const withSummary = rows.filter((r: BookRow) => r.summary && r.summary.length > 0).length;
    const withIsbn = rows.filter((r: BookRow) => r.isbn && r.isbn.length > 0).length;
    const withAmazonUrl = rows.filter((r: BookRow) => r.amazonUrl && r.amazonUrl.length > 0).length;
    const withRating = rows.filter((r: BookRow) => r.rating && r.rating.length > 0).length;
    const withEnrichedAt = rows.filter((r: BookRow) => r.enrichedAt != null).length;
    const withPublisher = rows.filter((r: BookRow) => r.publisher && r.publisher.length > 0).length;
    const noCover = rows.filter((r: BookRow) => !r.coverImageUrl || r.coverImageUrl.length === 0).length;
    const noSummary = rows.filter((r: BookRow) => !r.summary || r.summary.length === 0).length;

    return {
      total,
      withCover,
      withS3Cover,
      withSummary,
      withIsbn,
      withAmazonUrl,
      withRating,
      withEnrichedAt,
      withPublisher,
      noCover,
      noSummary,
    };
  }),
});
