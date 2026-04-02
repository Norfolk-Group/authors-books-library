/**
 * useLibraryData — All tRPC queries, memoised maps, and filtered/sorted
 * lists that power the Home page.  Extracted from Home.tsx to keep the
 * orchestrator lean.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AUTHORS,
  BOOKS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { AUDIO_BOOKS } from "@/lib/audioData";
import { canonicalName } from "@/lib/authorAliases";
import authorBios from "@/lib/authorBios.json";
import {
  buildAuthorDimensions,
  buildBookDimensions,
  type FreshnessDimension,
} from "@/components/library/FreshnessDot";
import { getBookEnrichmentLevel, type BookEnrichmentLevel } from "@/components/library/libraryConstants";
import { STATS } from "@/components/library/libraryConstants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthorSort = "name-asc" | "name-desc" | "books-desc" | "category" | "quality-desc" | "favorites-first" | "most-popular" | "tags";
export type BookSort = "name-asc" | "name-desc" | "author" | "content-desc" | "enrich-desc" | "favorites-first" | "tags";

// ── Module-level constants ────────────────────────────────────────────────────

const QUALITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, undefined: 3 };
const ENRICH_ORDER: Record<string, number> = { complete: 3, enriched: 2, basic: 1, none: 0 };

/**
 * Normalise a raw book name into a stable lookup key.
 */
export function normalizeTitleKey(raw: string): string {
  return raw
    .split(" - ")[0]
    .trim()
    .replace(/[?!.,;:]+$/, "")
    .toLowerCase();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseLibraryDataParams {
  query: string;
  selectedCategories: Set<string>;
  authorSort: AuthorSort;
  bookSort: BookSort;
  enrichFilter: BookEnrichmentLevel | "all";
  possessionFilter?: string;
  /** Tag slugs to filter by — only show entities that have ALL selected tags */
  selectedTagSlugs?: Set<string>;
}

export function useLibraryData({
  query,
  selectedCategories,
  // possessionFilter used below in filteredBooks
  possessionFilter = "all",
  authorSort,
  bookSort,
  enrichFilter,
  selectedTagSlugs = new Set<string>(),
}: UseLibraryDataParams) {
  const { isAuthenticated } = useAuth();

  // ── tRPC queries ────────────────────────────────────────────────────────

  const enrichedNamesQuery = trpc.authorProfiles.getAllEnrichedNames.useQuery(undefined, { staleTime: 60_000 });
  const enrichedSet = useMemo(() => new Set(enrichedNamesQuery.data ?? []), [enrichedNamesQuery.data]);

  const allBiosQuery = trpc.authorProfiles.getAllBios.useQuery(undefined, { staleTime: 5 * 60_000 });
  const dbBioMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const { authorName, bio } of allBiosQuery.data ?? []) {
      if (bio) map.set(authorName.toLowerCase(), bio);
    }
    return map;
  }, [allBiosQuery.data]);

  const enrichedTitlesQuery = trpc.bookProfiles.getAllEnrichedTitles.useQuery(undefined, { staleTime: 60_000 });
  const enrichedTitlesSet = useMemo(() => new Set(enrichedTitlesQuery.data ?? []), [enrichedTitlesQuery.data]);

  const allBookTitles = useMemo(
    () => Array.from(new Set(BOOKS.map((b) => b.name.split(" - ")[0].trim().replace(/[?!.,;:]+$/, "")))),
    []
  );
  const bookCoversQuery = trpc.bookProfiles.getMany.useQuery({ bookTitles: allBookTitles }, { staleTime: 60_000 });

  const bookCoverMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      const url = (p as { s3CoverUrl?: string | null }).s3CoverUrl || p.coverImageUrl;
      if (url) {
        map.set(p.bookTitle, url);
        map.set(p.bookTitle.toLowerCase(), url);
      }
    }
    return map;
  }, [bookCoversQuery.data]);

  const amazonUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      if (p.amazonUrl) map.set(p.bookTitle, p.amazonUrl);
    }
    return map;
  }, [bookCoversQuery.data]);

  const goodreadsUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      if (p.goodreadsUrl) map.set(p.bookTitle, p.goodreadsUrl);
    }
    return map;
  }, [bookCoversQuery.data]);

  const wikipediaUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      if ((p as { wikipediaUrl?: string | null }).wikipediaUrl)
        map.set(p.bookTitle, (p as { wikipediaUrl?: string | null }).wikipediaUrl!);
    }
    return map;
  }, [bookCoversQuery.data]);

  const richSummarySet = useMemo(() => {
    const set = new Set<string>();
    for (const p of bookCoversQuery.data ?? []) {
      if ((p as { richSummaryJson?: string | null }).richSummaryJson)
        set.add(p.bookTitle);
    }
    return set;
  }, [bookCoversQuery.data]);

  const richBioNamesQuery = trpc.authorProfiles.getAllRichBioNames.useQuery(undefined, { staleTime: 5 * 60_000 });
  const richBioSet = useMemo(
    () => new Set((richBioNamesQuery.data ?? []).map((n) => n.toLowerCase())),
    [richBioNamesQuery.data]
  );

  const authorFreshnessQuery = trpc.authorProfiles.getAllFreshness.useQuery(undefined, { staleTime: 5 * 60_000 });
  const bookFreshnessQuery = trpc.bookProfiles.getAllFreshness.useQuery(undefined, { staleTime: 5 * 60_000 });

  const authorFreshnessMap = useMemo(() => {
    const map = new Map<string, FreshnessDimension[]>();
    for (const row of authorFreshnessQuery.data ?? []) {
      map.set(row.authorName.toLowerCase(), buildAuthorDimensions(row));
    }
    return map;
  }, [authorFreshnessQuery.data]);

  const bookFreshnessMap = useMemo(() => {
    const map = new Map<string, FreshnessDimension[]>();
    for (const row of bookFreshnessQuery.data ?? []) {
      map.set(row.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase(), buildBookDimensions(row));
    }
    return map;
  }, [bookFreshnessQuery.data]);

  const bookInfoMap = useMemo(() => {
    const map = new Map<string, { summary?: string; rating?: string; ratingCount?: number; publishedDate?: string; keyThemes?: string; format?: string | null; possessionStatus?: string | null }>();
    for (const p of bookCoversQuery.data ?? []) {
      const hasRating = p.rating && String(p.rating).trim() !== '' && parseFloat(String(p.rating)) > 0;
      map.set(p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase(), {
        summary: p.summary ?? undefined,
        rating: hasRating ? String(p.rating) : undefined,
        ratingCount: hasRating && p.ratingCount ? Number(p.ratingCount) : undefined,
        publishedDate: p.publishedDate ?? undefined,
        keyThemes: p.keyThemes ?? undefined,
        format: (p as { format?: string | null }).format ?? null,
        possessionStatus: (p as { possessionStatus?: string | null }).possessionStatus ?? null,
      });
    }
    return map;
  }, [bookCoversQuery.data]);

  const authorAvatarMapQuery = trpc.authorProfiles.getAvatarMap.useQuery(undefined, { staleTime: 60_000 });
  const researchQualityQuery = trpc.authorProfiles.getResearchQualityMap.useQuery(undefined, { staleTime: 300_000 });
  const researchQualityMap = useMemo(() => {
    const map = new Map<string, "high" | "medium" | "low">();
    for (const r of researchQualityQuery.data ?? []) {
      map.set(r.authorName.toLowerCase(), r.confidence);
    }
    return map;
  }, [researchQualityQuery.data]);

  const platformLinksQuery = trpc.authorProfiles.getAllPlatformLinks.useQuery(undefined, { staleTime: 5 * 60_000 });
  const recentlyEnrichedQuery = trpc.authorProfiles.getRecentlyEnriched.useQuery(
    { limit: 6 },
    { staleTime: 5 * 60_000 }
  );
  type PlatformRow = typeof platformLinksQuery.data extends (infer T)[] | undefined ? T : never;
  const platformLinksMap = useMemo(() => {
    const map = new Map<string, PlatformRow>();
    for (const r of platformLinksQuery.data ?? []) {
      map.set(r.authorName.toLowerCase(), r);
    }
    return map;
  }, [platformLinksQuery.data]);

  // ── Favorites ───────────────────────────────────────────────────────────
  // Fetch all favorites for the current user (small result set) and build
  // maps client-side — avoids sending hundreds of keys in a GET URL (HTTP 414).

  const allFavoritesQuery = trpc.favorites.list.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 60_000 }
  );

  const authorFavoritesQuery = useMemo(() => {
    const data: Record<string, boolean> = {};
    for (const fav of allFavoritesQuery.data ?? []) {
      if (fav.entityType === "author") data[fav.entityKey] = true;
    }
    return { data, isLoading: allFavoritesQuery.isLoading };
  }, [allFavoritesQuery.data, allFavoritesQuery.isLoading]);

  const bookFavoritesQuery = useMemo(() => {
    const data: Record<string, boolean> = {};
    for (const fav of allFavoritesQuery.data ?? []) {
      if (fav.entityType === "book") data[fav.entityKey] = true;
    }
    return { data, isLoading: allFavoritesQuery.isLoading };
  }, [allFavoritesQuery.data, allFavoritesQuery.isLoading]);

  // ── Tag filtering ──────────────────────────────────────────────────────
  const allTagsQuery = trpc.tags.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const authorTagsQuery = trpc.tags.getAllAuthorTagSlugs.useQuery(undefined, { staleTime: 5 * 60_000 });
  const bookTagsQuery = trpc.tags.getAllBookTagSlugs.useQuery(undefined, { staleTime: 5 * 60_000 });

  const authorTagsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of authorTagsQuery.data ?? []) {
      map.set(row.authorName.toLowerCase(), new Set(row.tagSlugs));
    }
    return map;
  }, [authorTagsQuery.data]);

  const bookTagsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of bookTagsQuery.data ?? []) {
      map.set(row.bookTitle.toLowerCase(), new Set(row.tagSlugs));
    }
    return map;
  }, [bookTagsQuery.data]);

  const dbAvatarMap = useMemo(() => {
    const map = new Map<string, string>();
    const splitSep = /\s+(?:and|&)\s+/i;
    for (const r of authorAvatarMapQuery.data ?? []) {
      if (!r.avatarUrl) continue;
      map.set(r.authorName.toLowerCase(), r.avatarUrl);
      const parts = r.authorName.split(splitSep).map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) {
          const key = part.toLowerCase();
          if (!map.has(key)) map.set(key, r.avatarUrl);
        }
      }
    }
    return map;
  }, [authorAvatarMapQuery.data]);

  // ── Filtered + sorted data ──────────────────────────────────────────────

  const filteredAuthors = useMemo(() => {
    const q = query.toLowerCase();
    const splitSeparators = /\s+(?:and|&)\s+/i;
    const expandedAuthors: typeof AUTHORS[number][] = [];
    for (const a of AUTHORS) {
      const namePart = a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name;
      const specialty = a.name.includes(" - ") ? a.name.slice(a.name.indexOf(" - ")) : "";
      const parts = namePart.split(splitSeparators).map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) expandedAuthors.push({ ...a, name: part + specialty });
      } else {
        expandedAuthors.push(a);
      }
    }
    const seen = new Map<string, typeof AUTHORS[number]>();
    const booksSeen = new Map<string, Set<string>>();
    for (const a of expandedAuthors) {
      const baseName = canonicalName(a.name).toLowerCase();
      const existing = seen.get(baseName);
      if (!existing) {
        seen.set(baseName, { ...a, books: [...a.books] });
        booksSeen.set(baseName, new Set(a.books.map((b) => b.id)));
      } else {
        const seenIds = booksSeen.get(baseName)!;
        for (const book of a.books) {
          if (!seenIds.has(book.id)) { existing.books.push(book); seenIds.add(book.id); }
        }
        const existingSpecialty = existing.name.includes(" - ") ? existing.name.split(" - ").slice(1).join(" - ") : "";
        const newSpecialty = a.name.includes(" - ") ? a.name.split(" - ").slice(1).join(" - ") : "";
        if (newSpecialty.length > existingSpecialty.length) {
          existing.name = a.name; existing.id = a.id; existing.category = a.category;
        }
      }
    }
    for (const author of Array.from(seen.values())) {
      const bookByTitle = new Map<string, typeof author.books[number]>();
      for (const book of author.books) {
        const titleKey = normalizeTitleKey(book.name);
        const existing = bookByTitle.get(titleKey);
        if (!existing) {
          bookByTitle.set(titleKey, book);
        } else {
          const existingScore = Object.keys(existing.contentTypes).length * 2 + (existing.name.includes(" - ") ? 1 : 0);
          const newScore = Object.keys(book.contentTypes).length * 2 + (book.name.includes(" - ") ? 1 : 0);
          if (newScore > existingScore) bookByTitle.set(titleKey, book);
        }
      }
      author.books = Array.from(bookByTitle.values());
    }
    const deduped = Array.from(seen.values());
    return deduped.filter((a) => {
      const matchesCat = selectedCategories.size === 0 || selectedCategories.has(a.category);
      const matchesQ = !q || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.books.some((b) => b.name.toLowerCase().includes(q));
      // Tag filter: author must have ALL selected tags
      const matchesTags = selectedTagSlugs.size === 0 || (() => {
        const authorTags = authorTagsMap.get(canonicalName(a.name).toLowerCase());
        if (!authorTags) return false;
        return Array.from(selectedTagSlugs).every((slug) => authorTags.has(slug));
      })();
      return matchesCat && matchesQ && matchesTags;
    }).sort((a, b) => {
      switch (authorSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "books-desc": return b.books.length - a.books.length;
        case "category": return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case "quality-desc": {
          const aQ = researchQualityMap.get(canonicalName(a.name).toLowerCase()) ?? "undefined";
          const bQ = researchQualityMap.get(canonicalName(b.name).toLowerCase()) ?? "undefined";
          const diff = (QUALITY_ORDER[aQ] ?? 3) - (QUALITY_ORDER[bQ] ?? 3);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case "favorites-first": {
          const aFav = (authorFavoritesQuery.data ?? {})[canonicalName(a.name).toLowerCase()] ? 0 : 1;
          const bFav = (authorFavoritesQuery.data ?? {})[canonicalName(b.name).toLowerCase()] ? 0 : 1;
          return aFav !== bFav ? aFav - bFav : a.name.localeCompare(b.name);
        }
        case "most-popular": {
          const getPopScore = (author: typeof a): number => {
            const row = platformLinksMap.get(canonicalName(author.name).toLowerCase());
            if (!row?.socialStatsJson) return 0;
            try {
              const stats = JSON.parse(row.socialStatsJson) as {
                wikipedia?: { avgMonthlyViews?: number };
                substack?: { postCount?: number };
                github?: { followers?: number };
              };
              return (stats.wikipedia?.avgMonthlyViews ?? 0)
                + (stats.substack?.postCount ?? 0) * 100
                + (stats.github?.followers ?? 0) * 10;
            } catch { return 0; }
          };
          return getPopScore(b) - getPopScore(a);
        }
        case "tags": {
          // Group by first tag slug alphabetically; authors with no tags go last
          const aTags = authorTagsMap.get(canonicalName(a.name).toLowerCase());
          const bTags = authorTagsMap.get(canonicalName(b.name).toLowerCase());
          const aFirst = aTags && aTags.size > 0 ? Array.from(aTags).sort()[0] : "\uFFFF";
          const bFirst = bTags && bTags.size > 0 ? Array.from(bTags).sort()[0] : "\uFFFF";
          return aFirst.localeCompare(bFirst) || a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, authorSort, researchQualityMap, authorFavoritesQuery.data, platformLinksMap, selectedTagSlugs, authorTagsMap]);

  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase();
    const seen = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) {
      const titleKey = normalizeTitleKey(b.name);
      const existing = seen.get(titleKey);
      if (!existing) {
        seen.set(titleKey, b);
      } else {
        const hasAuthor = b.name.includes(" - ");
        const existingHasAuthor = existing.name.includes(" - ");
        if (hasAuthor && !existingHasAuthor) seen.set(titleKey, b);
        else if (Object.keys(b.contentTypes).length > Object.keys(existing.contentTypes).length) seen.set(titleKey, b);
      }
    }
    return Array.from(seen.values()).filter((b) => {
      const matchesCat = selectedCategories.size === 0 || selectedCategories.has(b.category);
      const matchesQ = !q || b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
      const tk = normalizeTitleKey(b.name);
      const profile = bookCoversQuery.data?.find((p) => p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase() === tk) ?? null;
      const level = getBookEnrichmentLevel(profile as Parameters<typeof getBookEnrichmentLevel>[0]);
      const matchesEnrich = enrichFilter === "all" || level === enrichFilter;
      // Possession/format filter
      const bookInfo = bookInfoMap.get(tk);
      const matchesPossession = possessionFilter === "all" || bookInfo?.possessionStatus === possessionFilter;
      // Tag filter: book must have ALL selected tags
      const matchesTags = selectedTagSlugs.size === 0 || (() => {
        const bookTags = bookTagsMap.get(tk);
        if (!bookTags) return false;
        return Array.from(selectedTagSlugs).every((slug) => bookTags.has(slug));
      })();
      return matchesCat && matchesQ && matchesEnrich && matchesPossession && matchesTags;
    }).sort((a, b) => {
      switch (bookSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "author": {
          const aA = a.name.includes(" - ") ? a.name.split(" - ").slice(1).join(" - ") : "";
          const bA = b.name.includes(" - ") ? b.name.split(" - ").slice(1).join(" - ") : "";
          return aA.localeCompare(bA) || a.name.localeCompare(b.name);
        }
        case "content-desc": return Object.keys(b.contentTypes).length - Object.keys(a.contentTypes).length;
        case "enrich-desc": {
          const tkA = normalizeTitleKey(a.name);
          const tkB = normalizeTitleKey(b.name);
          const profA = bookCoversQuery.data?.find((p) => p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase() === tkA) ?? null;
          const profB = bookCoversQuery.data?.find((p) => p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase() === tkB) ?? null;
          const lvA = getBookEnrichmentLevel(profA as Parameters<typeof getBookEnrichmentLevel>[0]);
          const lvB = getBookEnrichmentLevel(profB as Parameters<typeof getBookEnrichmentLevel>[0]);
          return (ENRICH_ORDER[lvB] ?? 0) - (ENRICH_ORDER[lvA] ?? 0) || a.name.localeCompare(b.name);
        }
        case "favorites-first": {
          const tkA = normalizeTitleKey(a.name);
          const tkB = normalizeTitleKey(b.name);
          const aFav = (bookFavoritesQuery.data ?? {})[tkA] ? 0 : 1;
          const bFav = (bookFavoritesQuery.data ?? {})[tkB] ? 0 : 1;
          return aFav !== bFav ? aFav - bFav : a.name.localeCompare(b.name);
        }
        case "tags": {
          // Group by first tag slug alphabetically; books with no tags go last
          const tkA = normalizeTitleKey(a.name);
          const tkB = normalizeTitleKey(b.name);
          const aBookTags = bookTagsMap.get(tkA);
          const bBookTags = bookTagsMap.get(tkB);
          const aFirst = aBookTags && aBookTags.size > 0 ? Array.from(aBookTags).sort()[0] : "\uFFFF";
          const bFirst = bBookTags && bBookTags.size > 0 ? Array.from(bBookTags).sort()[0] : "\uFFFF";
          return aFirst.localeCompare(bFirst) || a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, bookSort, enrichFilter, possessionFilter, bookCoversQuery.data, bookFavoritesQuery.data, bookInfoMap, selectedTagSlugs, bookTagsMap]);

  const filteredAudio = useMemo(() => {
    const q = query.toLowerCase();
    return AUDIO_BOOKS.filter((a) => {
      const matchesQ = !q || a.title.toLowerCase().includes(q) || a.bookAuthors.toLowerCase().includes(q) || Object.keys(a.formats).some((f) => f.toLowerCase().includes(q));
      return matchesQ;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [query]);

  const authorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    AUTHORS.forEach((a) => { counts[a.category] = (counts[a.category] ?? 0) + 1; });
    return counts;
  }, []);

  const bookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    BOOKS.forEach((b) => { counts[b.category] = (counts[b.category] ?? 0) + 1; });
    return counts;
  }, []);

  // ── Bio lookup helper ───────────────────────────────────────────────────

  function getBio(author: AuthorEntry): string | null {
    return (authorBios as Record<string, string>)[canonicalName(author.name)]
      ?? dbBioMap.get(canonicalName(author.name).toLowerCase())
      ?? null;
  }

  return {
    // queries (for raw data access / refetch)
    authorAvatarMapQuery,
    authorFavoritesQuery,
    bookFavoritesQuery,
    recentlyEnrichedQuery,
    // memoised maps
    enrichedSet,
    enrichedTitlesSet,
    bookCoverMap,
    amazonUrlMap,
    goodreadsUrlMap,
    wikipediaUrlMap,
    richSummarySet,
    richBioSet,
    dbAvatarMap,
    researchQualityMap,
    platformLinksMap,
    bookInfoMap,
    authorFreshnessMap,
    bookFreshnessMap,
    // filtered lists
    filteredAuthors,
    filteredBooks,
    filteredAudio,
    authorCounts,
    bookCounts,
    // tag maps (for inline pickers)
    bookTagsMap,
    authorTagsMap,
    // all tags list (for filter chip labels)
    allTags: allTagsQuery.data ?? [],
    // helpers
    getBio,
    isAuthenticated,
  };
}
