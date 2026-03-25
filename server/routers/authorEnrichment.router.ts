import { z } from "zod";
import { eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { authorProfiles, bookProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { enrichRichBio } from "../enrichment/richBio";
import { enrichRichSummary } from "../enrichment/richSummary";
import { parallelBatch } from "../lib/parallelBatch";

// ── Enrichment Sub-Router ──────────────────────────────────────────────────
export const authorEnrichmentRouter = router({
  /** Enrich a single author's rich bio + professional entries via double-pass LLM */
  enrichRichBio: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [profile] = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!profile) throw new Error(`Author not found: ${input.authorName}`);

      const result = await enrichRichBio(
        input.authorName,
        profile.bio ?? undefined,
        undefined
      );
      if (!result) throw new Error(`Enrichment returned no data for: ${input.authorName}`);

      await db
        .update(authorProfiles)
        .set({
          richBioJson: JSON.stringify(result),
          professionalEntriesJson: JSON.stringify(result.professionalEntries),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return { success: true, authorName: input.authorName };
    }),

  /** Batch enrich rich bios for all authors (or those missing richBioJson) */
  enrichRichBioBatch: adminProcedure
    .input(z.object({ limit: z.number().optional(), forceAll: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const allAuthors = await db
        .select({ authorName: authorProfiles.authorName, bio: authorProfiles.bio, richBioJson: authorProfiles.richBioJson })
        .from(authorProfiles);

      const toProcess = input.forceAll
        ? allAuthors
        : allAuthors.filter((a) => !a.richBioJson);

      const batch = input.limit ? toProcess.slice(0, input.limit) : toProcess;
      const richBatch = await parallelBatch(batch, 2, async (author) => {
        const result = await enrichRichBio(
          author.authorName,
          author.bio ?? undefined,
          undefined
        );
        if (result) {
          await db
            .update(authorProfiles)
            .set({
              richBioJson: JSON.stringify(result),
              professionalEntriesJson: JSON.stringify(result.professionalEntries),
            })
            .where(eq(authorProfiles.authorName, author.authorName));
          return { authorName: author.authorName, success: true };
        }
        return { authorName: author.authorName, success: false, error: "No data returned" };
      });
      const results = richBatch.results.map((r) =>
        r.result ?? { authorName: r.input.authorName, success: false, error: r.error }
      );

      return {
        processed: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),

  /** Enrich a single book's rich summary + similar books + resource links via double-pass LLM */
  enrichRichSummary: adminProcedure
    .input(z.object({ bookTitle: z.string(), authorName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [book] = await db
        .select()
        .from(bookProfiles)
        .where(eq(bookProfiles.bookTitle, input.bookTitle))
        .limit(1);

      const result = await enrichRichSummary(
        input.bookTitle,
        input.authorName,
        book?.summary ?? undefined,
        undefined
      );
      if (!result) throw new Error(`Enrichment returned no data for: ${input.bookTitle}`);

      if (book) {
        await db
          .update(bookProfiles)
          .set({
            richSummaryJson: JSON.stringify(result),
            resourceLinksJson: JSON.stringify(result.resourceLinks),
          })
          .where(eq(bookProfiles.bookTitle, input.bookTitle));
      }

      return { success: true, bookTitle: input.bookTitle };
    }),

  /** Batch enrich rich summaries for all books (or those missing richSummaryJson) */
  enrichRichSummaryBatch: adminProcedure
    .input(z.object({ limit: z.number().optional(), forceAll: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const allBooks = await db
        .select({ bookTitle: bookProfiles.bookTitle, authorName: bookProfiles.authorName, summary: bookProfiles.summary, richSummaryJson: bookProfiles.richSummaryJson })
        .from(bookProfiles);

      const toProcess = input.forceAll
        ? allBooks
        : allBooks.filter((b) => !b.richSummaryJson);

      const batch = input.limit ? toProcess.slice(0, input.limit) : toProcess;
      const results: { bookTitle: string; success: boolean; error?: string }[] = [];

      for (const book of batch) {
        try {
          const result = await enrichRichSummary(
            book.bookTitle,
            book.authorName ?? "",
            book.summary ?? undefined,
            undefined
          );
          if (result) {
            await db
              .update(bookProfiles)
              .set({
                richSummaryJson: JSON.stringify(result),
                resourceLinksJson: JSON.stringify(result.resourceLinks),
              })
              .where(eq(bookProfiles.bookTitle, book.bookTitle));
            results.push({ bookTitle: book.bookTitle, success: true });
          } else {
            results.push({ bookTitle: book.bookTitle, success: false, error: "No data returned" });
          }
        } catch (err) {
          results.push({ bookTitle: book.bookTitle, success: false, error: String(err) });
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      return {
        processed: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),

  // ── Academic Research Enrichment (OpenAlex + Semantic Scholar) ─────────────

  /** Enrich a single author's academic profile: h-index, citations, top papers */
  enrichAcademicResearch: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { enrichAcademicProfile } = await import("../enrichment/academicResearch");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!profile) throw new Error(`Author not found: ${input.authorName}`);

      const books = await db
        .select({ bookTitle: bookProfiles.bookTitle })
        .from(bookProfiles)
        .where(eq(bookProfiles.authorName, input.authorName));
      const bookTitles = books.map((b) => b.bookTitle).filter(Boolean);

      const result = await enrichAcademicProfile(input.authorName, bookTitles);

      await db
        .update(authorProfiles)
        .set({
          academicResearchJson: JSON.stringify(result),
          academicResearchEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        authorName: input.authorName,
        hIndex: result.authorProfile?.hIndex ?? 0,
        citationCount: result.authorProfile?.citationCount ?? 0,
        topPapersCount: result.topPapers.length,
        bookRelatedPapersCount: result.bookRelatedPapers.length,
        source: result.authorProfile?.source ?? "none",
        fetchedAt: result.fetchedAt,
      };
    }),

  /** Batch enrich academic research for all authors */
  enrichAcademicResearchBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { enrichAcademicProfile } = await import("../enrichment/academicResearch");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const condition = input.onlyMissing
        ? isNull(authorProfiles.academicResearchEnrichedAt)
        : undefined;
      const rows = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(condition)
        .limit(input.limit);

      const results: Array<{
        authorName: string;
        hIndex: number;
        citationCount: number;
        error?: string;
      }> = [];

      for (const row of rows) {
        try {
          const books = await db
            .select({ bookTitle: bookProfiles.bookTitle })
            .from(bookProfiles)
            .where(eq(bookProfiles.authorName, row.authorName));
          const bookTitles = books.map((b) => b.bookTitle).filter(Boolean);

          const result = await enrichAcademicProfile(row.authorName, bookTitles);

          await db
            .update(authorProfiles)
            .set({
              academicResearchJson: JSON.stringify(result),
              academicResearchEnrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, row.authorName));

          results.push({
            authorName: row.authorName,
            hIndex: result.authorProfile?.hIndex ?? 0,
            citationCount: result.authorProfile?.citationCount ?? 0,
          });
        } catch (err: any) {
          results.push({
            authorName: row.authorName,
            hIndex: 0,
            citationCount: 0,
            error: String(err.message ?? err),
          });
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      return {
        processed: results.length,
        succeeded: results.filter((r) => !r.error).length,
        failed: results.filter((r) => !!r.error).length,
        results,
      };
    }),

  /** Enrich enterprise impact (SEC EDGAR + Quartr) for a single author */
  enrichEnterpriseImpact: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { enrichEnterpriseImpact } = await import("../enrichment/quartr");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!profile) throw new Error(`Author not found: ${input.authorName}`);

      const books = await db
        .select({ bookTitle: bookProfiles.bookTitle })
        .from(bookProfiles)
        .where(eq(bookProfiles.authorName, input.authorName));
      const bookTitles = books.map((b) => b.bookTitle).filter(Boolean);

      const result = await enrichEnterpriseImpact(input.authorName, bookTitles);

      await db
        .update(authorProfiles)
        .set({
          earningsCallMentionsJson: JSON.stringify(result),
          earningsCallMentionsEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        authorName: input.authorName,
        totalMentions: result.totalMentions,
        uniqueCompanies: result.uniqueCompanies.length,
        impactScore: result.impactScore,
        fetchedAt: result.fetchedAt,
      };
    }),

  /** Get enterprise impact data for a single author */
  getEnterpriseImpact: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({
          earningsCallMentionsJson: authorProfiles.earningsCallMentionsJson,
          earningsCallMentionsEnrichedAt: authorProfiles.earningsCallMentionsEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.earningsCallMentionsJson) return null;
      return {
        data: JSON.parse(row.earningsCallMentionsJson),
        enrichedAt: row.earningsCallMentionsEnrichedAt,
      };
    }),

  /** Enrich professional profile (Wikidata + Apollo.io) for a single author */
  enrichProfessionalProfile: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { enrichProfessionalProfile } = await import("../enrichment/apollo");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select()
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!profile) throw new Error(`Author not found: ${input.authorName}`);

      const result = await enrichProfessionalProfile(input.authorName);

      await db
        .update(authorProfiles)
        .set({
          professionalProfileJson: JSON.stringify(result),
          professionalProfileEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        authorName: input.authorName,
        rolesCount: result.roles.length,
        boardSeatsCount: result.boardSeats.length,
        educationCount: result.education.length,
        awardsCount: result.awards.length,
        source: result.source,
        fetchedAt: result.fetchedAt,
      };
    }),

  /** Get professional profile data for a single author */
  getProfessionalProfile: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({
          professionalProfileJson: authorProfiles.professionalProfileJson,
          professionalProfileEnrichedAt: authorProfiles.professionalProfileEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.professionalProfileJson) return null;
      return {
        data: JSON.parse(row.professionalProfileJson),
        enrichedAt: row.professionalProfileEnrichedAt,
      };
    }),

  /** Index document archive from Google Drive for a single author */
  indexDocumentArchive: adminProcedure
    .input(z.object({ authorName: z.string() }))
    .mutation(async ({ input }) => {
      const { buildDocumentArchive } = await import("../enrichment/gdrive");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [profile] = await db
        .select({
          authorName: authorProfiles.authorName,
          driveFolderId: authorProfiles.driveFolderId,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!profile) throw new Error(`Author not found: ${input.authorName}`);
      if (!profile.driveFolderId) throw new Error(`No Drive folder for: ${input.authorName}`);

      const archive = await buildDocumentArchive(input.authorName, profile.driveFolderId);

      await db
        .update(authorProfiles)
        .set({
          documentArchiveJson: JSON.stringify(archive),
          documentArchiveEnrichedAt: new Date(),
        })
        .where(eq(authorProfiles.authorName, input.authorName));

      return {
        authorName: input.authorName,
        documentCount: archive.documentCount,
        totalSize: archive.totalSize,
        folderUrl: archive.folderUrl,
      };
    }),

  /** Get document archive data for a single author */
  getDocumentArchive: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({
          documentArchiveJson: authorProfiles.documentArchiveJson,
          documentArchiveEnrichedAt: authorProfiles.documentArchiveEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.documentArchiveJson) return null;
      return {
        data: JSON.parse(row.documentArchiveJson),
        enrichedAt: row.documentArchiveEnrichedAt,
      };
    }),

  /** Batch enrich enterprise impact for all authors */
  enrichEnterpriseImpactBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { enrichEnterpriseImpact } = await import("../enrichment/quartr");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const condition = input.onlyMissing
        ? isNull(authorProfiles.earningsCallMentionsEnrichedAt)
        : undefined;
      const rows = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(condition)
        .limit(input.limit);

      let succeeded = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          const books = await db
            .select({ bookTitle: bookProfiles.bookTitle })
            .from(bookProfiles)
            .where(eq(bookProfiles.authorName, row.authorName));
          const bookTitles = books.map((b) => b.bookTitle).filter(Boolean);
          const result = await enrichEnterpriseImpact(row.authorName, bookTitles);
          await db
            .update(authorProfiles)
            .set({
              earningsCallMentionsJson: JSON.stringify(result),
              earningsCallMentionsEnrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, row.authorName));
          succeeded++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      return { processed: rows.length, succeeded, failed };
    }),

  /** Batch enrich professional profiles for all authors */
  enrichProfessionalProfileBatch: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(20),
      onlyMissing: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const { enrichProfessionalProfile } = await import("../enrichment/apollo");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const condition = input.onlyMissing
        ? isNull(authorProfiles.professionalProfileEnrichedAt)
        : undefined;
      const rows = await db
        .select({ authorName: authorProfiles.authorName })
        .from(authorProfiles)
        .where(condition)
        .limit(input.limit);

      let succeeded = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          const result = await enrichProfessionalProfile(row.authorName);
          await db
            .update(authorProfiles)
            .set({
              professionalProfileJson: JSON.stringify(result),
              professionalProfileEnrichedAt: new Date(),
            })
            .where(eq(authorProfiles.authorName, row.authorName));
          succeeded++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      return { processed: rows.length, succeeded, failed };
    }),

  /** Get academic research data for a single author */
  getAcademicResearch: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [row] = await db
        .select({
          academicResearchJson: authorProfiles.academicResearchJson,
          academicResearchEnrichedAt: authorProfiles.academicResearchEnrichedAt,
        })
        .from(authorProfiles)
        .where(eq(authorProfiles.authorName, input.authorName))
        .limit(1);
      if (!row?.academicResearchJson) return null;
      return {
        data: JSON.parse(row.academicResearchJson),
        enrichedAt: row.academicResearchEnrichedAt,
      };
    }),
});
