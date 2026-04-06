/**
 * Enrichment Router — server-side API helpers for book and author data enrichment.
 *
 * Exposes:
 *  enrichment.openLibrary.searchBooks       → search books by query
 *  enrichment.openLibrary.getByISBN         → get book details by ISBN
 *  enrichment.openLibrary.searchAuthors     → search authors by name
 *  enrichment.openLibrary.enrichBook        → enrich a book with OL data (cover, ISBN, publisher)
 *  enrichment.applePodcasts.searchPodcasts  → search Apple Podcasts by term
 *  enrichment.applePodcasts.getAuthorPodcasts → podcasts by/about an author
 *  enrichment.hathiTrust.checkAvailability  → check digital availability by ISBN
 *  enrichment.hathiTrust.getAvailabilitySummary → full HathiTrust availability summary
 *  enrichment.news.searchAuthorNews         → news articles mentioning an author
 *  enrichment.news.searchBookNews           → news articles mentioning a book
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  searchBooks,
  getBookByISBN,
  searchAuthors,
  enrichBookFromOpenLibrary,
  getCoverUrl,
} from "../enrichment/openLibrary";
import {
  searchPodcasts,
  getAuthorPodcasts,
  getArtworkUrl,
} from "../enrichment/applePodcasts";
import {
  checkDigitalAvailability,
  getAvailabilitySummary,
} from "../enrichment/hathiTrust";
import {
  searchAuthorNews,
  searchBookNews,
} from "../enrichment/newsSearch";
import {
  searchWorldCat,
  getWorldCatByISBN,
  getLibraryHoldingsCount,
} from "../enrichment/worldcat";
import {
  searchDPLA,
  getDPLAByISBN,
  checkDPLAAvailability,
  isDPLAConfigured,
} from "../enrichment/dpla";
import {
  searchJSTOR,
  getJSTORByDOI,
  searchAcademicPapers,
  searchBookAcademicCitations,
} from "../enrichment/jstor";
import {
  searchSpotifyPodcasts,
  getAuthorSpotifyPodcasts,
  searchSpotifyAudiobooks,
  getSpotifyBookAudiobook,
} from "../enrichment/spotify";
import {
  searchBBCNews,
  searchNYTNews,
  searchAppleNews,
  searchGuardianNews,
  searchReutersNews,
  searchAllOutlets,
  getAuthorNewsFromOutlets,
  getBBCTopStories,
  getNYTTopStories,
} from "../enrichment/newsOutlets";
import { fetchCNNStats } from "../enrichment/cnn";
import { fetchInstagramStats, extractInstagramUsername } from "../enrichment/instagram";
import { ENV } from "../_core/env";

// ─── Open Library ─────────────────────────────────────────────────────────────

const openLibraryRouter = router({
  searchBooks: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const docs = await searchBooks(input.query, input.limit);
      return docs.map((d) => ({
        key: d.key,
        title: d.title,
        authorNames: d.author_name ?? [],
        isbn: d.isbn?.[0],
        coverUrl: d.cover_i ? getCoverUrl(d.cover_i, "M") : null,
        firstPublishYear: d.first_publish_year ?? null,
        pageCount: d.number_of_pages_median ?? null,
        publisher: d.publisher?.[0] ?? null,
      }));
    }),

  getByISBN: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      const edition = await getBookByISBN(input.isbn);
      if (!edition) return null;
      return {
        title: edition.title,
        isbn13: edition.isbn_13?.[0] ?? null,
        isbn10: edition.isbn_10?.[0] ?? null,
        coverUrl: edition.covers?.[0] ? getCoverUrl(edition.covers[0], "M") : null,
        publisher: edition.publishers?.[0] ?? null,
        publishDate: edition.publish_date ?? null,
        pageCount: edition.number_of_pages ?? null,
        subjects: edition.subjects?.slice(0, 10) ?? [],
      };
    }),

  searchAuthors: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const authors = await searchAuthors(input.name, input.limit);
      return authors.map((a) => ({
        key: a.key,
        name: a.name,
        workCount: a.work_count,
        birthDate: a.birth_date ?? null,
        topWork: a.top_work ?? null,
        topSubjects: a.top_subjects?.slice(0, 5) ?? [],
      }));
    }),

  enrichBook: publicProcedure
    .input(
      z.object({
        isbn: z.string().optional(),
        title: z.string().optional(),
        authorName: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return enrichBookFromOpenLibrary(input);
    }),
});

// ─── Apple Podcasts ───────────────────────────────────────────────────────────

const applePodcastsRouter = router({
  searchPodcasts: publicProcedure
    .input(
      z.object({
        term: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const results = await searchPodcasts(input.term, input.limit);
      return results.map((p) => ({
        collectionId: p.collectionId,
        name: p.collectionName,
        artistName: p.artistName,
        feedUrl: p.feedUrl ?? null,
        artworkUrl: getArtworkUrl(p.artworkUrl100, 300) ?? null,
        genre: p.primaryGenreName ?? null,
        trackCount: p.trackCount ?? null,
        releaseDate: p.releaseDate ?? null,
        viewUrl: p.collectionViewUrl ?? null,
      }));
    }),

  getAuthorPodcasts: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      const results = await getAuthorPodcasts(input.authorName, input.limit);
      return results.map((p) => ({
        collectionId: p.collectionId,
        name: p.collectionName,
        artistName: p.artistName,
        feedUrl: p.feedUrl ?? null,
        artworkUrl: getArtworkUrl(p.artworkUrl100, 300) ?? null,
        genre: p.primaryGenreName ?? null,
        trackCount: p.trackCount ?? null,
        viewUrl: p.collectionViewUrl ?? null,
      }));
    }),
});

// ─── HathiTrust ───────────────────────────────────────────────────────────────

const hathiTrustRouter = router({
  checkAvailability: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      return checkDigitalAvailability(input.isbn);
    }),

  getAvailabilitySummary: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      return getAvailabilitySummary(input.isbn);
    }),
});

// ─── News Search ──────────────────────────────────────────────────────────────

const newsRouter = router({
  searchAuthorNews: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(30).default(15),
      })
    )
    .query(async ({ input }) => {
      return searchAuthorNews(input.authorName, input.limit);
    }),

  searchBookNews: publicProcedure
    .input(
      z.object({
        bookTitle: z.string().min(1).max(200),
        authorName: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      return searchBookNews(input.bookTitle, input.authorName, input.limit);
    }),
});

/// ─── WorldCat ─────────────────────────────────────────────────────────────────

const worldCatRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return searchWorldCat(input.query, input.limit);
    }),
  getByISBN: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      return getWorldCatByISBN(input.isbn);
    }),
  getHoldingsCount: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      return getLibraryHoldingsCount(input.isbn);
    }),
});

// ─── DPLA ─────────────────────────────────────────────────────────────────────

const dplaRouter = router({
  isConfigured: publicProcedure.query(() => isDPLAConfigured()),
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(20).default(5),
        type: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return searchDPLA(input.query, { limit: input.limit, type: input.type });
    }),
  getByISBN: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(17) }))
    .query(async ({ input }) => {
      return getDPLAByISBN(input.isbn);
    }),
  checkAvailability: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(300),
        author: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return checkDPLAAvailability(input.title, input.author);
    }),
});

// ─── JSTOR / Academic ─────────────────────────────────────────────────────────

const jstorRouter = router({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return searchJSTOR(input.query, input.limit);
    }),
  getByDOI: publicProcedure
    .input(z.object({ doi: z.string().min(5).max(200) }))
    .query(async ({ input }) => {
      return getJSTORByDOI(input.doi);
    }),
  searchByAuthor: publicProcedure
    .input(
      z.object({
        authorName: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return searchAcademicPapers(input.authorName, input.limit);
    }),
  searchBookCitations: publicProcedure
    .input(
      z.object({
        bookTitle: z.string().min(1).max(300),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      return searchBookAcademicCitations(input.bookTitle, input.limit);
    }),
});

// ─── Spotify (iTunes-based) ───────────────────────────────────────────────────

const spotifyRouter = router({
  searchPodcasts: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchSpotifyPodcasts(input.query, input.limit)),

  getAuthorPodcasts: publicProcedure
    .input(z.object({ authorName: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => getAuthorSpotifyPodcasts(input.authorName, input.limit)),

  searchAudiobooks: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchSpotifyAudiobooks(input.query, input.limit)),

  getBookAudiobook: publicProcedure
    .input(z.object({ bookTitle: z.string().min(1).max(300), authorName: z.string().optional() }))
    .query(async ({ input }) => getSpotifyBookAudiobook(input.bookTitle, input.authorName)),
});

// ─── News Outlets (BBC, NYT, Apple News, Guardian, Reuters) ───────────────────

const newsOutletsRouter = router({
  searchBBC: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchBBCNews(input.query, input.limit)),

  searchNYT: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchNYTNews(input.query, input.limit)),

  searchAppleNews: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchAppleNews(input.query, input.limit)),

  searchGuardian: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchGuardianNews(input.query, input.limit)),

  searchReuters: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => searchReutersNews(input.query, input.limit)),

  searchAll: publicProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).default(3) }))
    .query(async ({ input }) => searchAllOutlets(input.query, input.limit)),

  getAuthorMentions: publicProcedure
    .input(z.object({ authorName: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).default(3) }))
    .query(async ({ input }) => getAuthorNewsFromOutlets(input.authorName, input.limit)),

  getBBCTop: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }) => getBBCTopStories(input.limit)),

  getNYTTop: publicProcedure
    .input(z.object({
      section: z.enum(["home", "business", "technology", "books", "arts"]).default("home"),
      limit: z.number().int().min(1).max(20).default(5),
    }))
    .query(async ({ input }) => getNYTTopStories(input.section, input.limit)),
});

// ─── CNN ─────────────────────────────────────────────────────────────────────

const cnnRouter = router({
  searchAuthorMentions: publicProcedure
    .input(z.object({ authorName: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const token = ENV.apifyApiToken;
      if (!token) return null;
      return fetchCNNStats(input.authorName, token);
    }),
});

// ─── Instagram ────────────────────────────────────────────────────────────────

const instagramRouter = router({
  getProfileStats: publicProcedure
    .input(z.object({ instagramUrlOrHandle: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const token = process.env.INSTAGRAM_ACCESS_TOKEN ?? "";
      if (!token) return null;
      return fetchInstagramStats(input.instagramUrlOrHandle, token);
    }),

  extractUsername: publicProcedure
    .input(z.object({ input: z.string().min(1).max(200) }))
    .query(async ({ input }) => extractInstagramUsername(input.input)),
});

// ─── Combined Router ──────────────────────────────────────────────────────────
export const enrichmentRouter = router({
  openLibrary: openLibraryRouter,
  applePodcasts: applePodcastsRouter,
  hathiTrust: hathiTrustRouter,
  news: newsRouter,
  worldCat: worldCatRouter,
  dpla: dplaRouter,
  jstor: jstorRouter,
  spotify: spotifyRouter,
  newsOutlets: newsOutletsRouter,
  cnn: cnnRouter,
  instagram: instagramRouter,
});
