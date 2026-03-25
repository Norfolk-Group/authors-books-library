/**
 * Ricardo Cidale's Library - Home Page
 * Design: Editorial Intelligence - sidebar-07 layout + card grid
 * Fonts: Inter Tight (ExtraBold H1, SemiBold H2/H3, Regular body)
 * Palette: NCG Brand - Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B
 * Tabs: Authors | Books | Books Audio
 *
 * This file is the orchestrator. All card/panel components live in:
 *   client/src/components/library/
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { trpc } from "@/lib/trpc";
import { CoverLightbox } from "@/components/CoverLightbox";
import { BackToTop } from "@/components/BackToTop";
import authorBios from "@/lib/authorBios.json";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  AUTHORS,
  BOOKS,
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { AUDIO_BOOKS } from "@/lib/audioData";
import { FlowbiteAuthorCard } from "@/components/FlowbiteAuthorCard";
import { canonicalName } from "@/lib/authorAliases";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/_core/hooks/useAuth";

// Extracted library sub-components
import { BookCard } from "@/components/library/BookCard";
import { AudioCard } from "@/components/library/AudioCard";
import { AuthorBioPanel } from "@/components/library/AuthorBioPanel";
import { BookDetailPanel } from "@/components/library/BookDetailPanel";
import { StatCard, EmptyState } from "@/components/library/LibraryPrimitives";
import { FloatingBooks } from "@/components/FloatingBooks";
import { buildAuthorDimensions, buildBookDimensions, type FreshnessDimension } from "@/components/library/FreshnessDot";
import { ICON_MAP, FORMAT_CLASSES, FORMAT_LABEL, STATS, getBookEnrichmentLevel, type BookEnrichmentLevel } from "@/components/library/libraryConstants";

import {
  Search,
  BookOpen,
  Users,
  LayoutGrid,
  Briefcase,
  ExternalLink,
  ChevronRight,
  X,
  Headphones,
  ArrowUpDown,
  ShieldCheck,
  Heart,
  Trophy,
  BarChart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type TabType = "authors" | "books" | "audio" | "favorites";
type AuthorSort = "name-asc" | "name-desc" | "books-desc" | "category" | "quality-desc" | "favorites-first" | "most-popular";
type BookSort = "name-asc" | "name-desc" | "author" | "content-desc" | "enrich-desc" | "favorites-first";

// ── Module-level constants (never recreated on render) ──────────────────────
const QUALITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, undefined: 3 };
const ENRICH_ORDER: Record<string, number> = { complete: 3, enriched: 2, basic: 1, none: 0 };
const ENRICH_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  complete: { label: "Fully Enriched",     color: "#d97706", bg: "#fef3c7" },
  enriched: { label: "Well Enriched",      color: "#059669", bg: "#d1fae5" },
  basic:    { label: "Partially Enriched", color: "#0284c7", bg: "#e0f2fe" },
  none:     { label: "Basic",              color: "#6b7280", bg: "#f3f4f6" },
};

/**
 * Normalise a raw book name into a stable lookup key.
 * Strips the " - Author" suffix, trims whitespace, removes trailing
 * punctuation (?, !, ., ,) and lowercases — so "Do You Talk Funny" and
 * "Do You Talk Funny?" resolve to the same key and deduplicate correctly.
 */
function normalizeTitleKey(raw: string): string {
  return raw
    .split(" - ")[0]
    .trim()
    .replace(/[?!.,;:]+$/, "")
    .toLowerCase();
}

export default function Home() {
  const { settings: { colorMode: appTheme } } = useAppSettings();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("authors");
  // selectedCategories is persisted as an array in localStorage and converted to/from Set
  const [_savedCategories, _setSavedCategories] = useLocalStorage<string[]>("lib:selectedCategories", []);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set(_savedCategories));
  // Sync selectedCategories changes back to localStorage
  const _setSelectedCategoriesAndPersist = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedCategories((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      _setSavedCategories(Array.from(next));
      return next;
    });
  }, [_setSavedCategories]);
  const [authorSort, setAuthorSort] = useLocalStorage<AuthorSort>("lib:authorSort", "name-asc");
  const [bookSort, setBookSort] = useLocalStorage<BookSort>("lib:bookSort", "name-asc");
  const [enrichFilter, setEnrichFilter] = useLocalStorage<BookEnrichmentLevel | "all">("lib:enrichFilter", "all");
  // Modal state
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorEntry | null>(null);
  const [bioSheetOpen, setBioSheetOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<typeof BOOKS[number] | null>(null);
  const [bookSheetOpen, setBookSheetOpen] = useState(false);
  const [lightboxCover, setLightboxCover] = useState<{ url: string | null; title: string; author?: string; color?: string; amazonUrl?: string } | null>(null);

  // Scroll container ref for BackToTop
  const mainRef = useRef<HTMLElement>(null);
  // Bidirectional navigation: highlight target card after tab switch
  const [highlightedBookTitle, setHighlightedBookTitle] = useState<string | null>(null);
  const [highlightedAuthorName, setHighlightedAuthorName] = useState<string | null>(null);
  const bookCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const authorCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Clear highlight after 2 seconds
  useEffect(() => {
    if (!highlightedBookTitle) return;
    const t = setTimeout(() => setHighlightedBookTitle(null), 2000);
    return () => clearTimeout(t);
  }, [highlightedBookTitle]);
  useEffect(() => {
    if (!highlightedAuthorName) return;
    const t = setTimeout(() => setHighlightedAuthorName(null), 2000);
    return () => clearTimeout(t);
  }, [highlightedAuthorName]);

  // Navigate from author card → book card in Books tab
  const navigateToBook = useCallback((titleKey: string) => {
    setActiveTab("books");
    _setSelectedCategoriesAndPersist(new Set());
    const tk = titleKey.trim().toLowerCase();
    setHighlightedBookTitle(tk);
    // Scroll after tab renders
    setTimeout(() => {
      const el = bookCardRefs.current.get(tk);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, []);

  // Navigate from book card → author card in Authors tab
  const navigateToAuthor = useCallback((authorName: string) => {
    setActiveTab("authors");
    _setSelectedCategoriesAndPersist(new Set());
    const key = authorName.trim().toLowerCase();
    setHighlightedAuthorName(key);
    setTimeout(() => {
      const el = authorCardRefs.current.get(key);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, []);

  // --- Data queries ---
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

  // Set of lowercase author names that have a double-pass LLM rich bio
  const richBioNamesQuery = trpc.authorProfiles.getAllRichBioNames.useQuery(undefined, { staleTime: 5 * 60_000 });
  const richBioSet = useMemo(
    () => new Set((richBioNamesQuery.data ?? []).map((n) => n.toLowerCase())),
    [richBioNamesQuery.data]
  );

  // Freshness data for author and book cards
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
    const map = new Map<string, { summary?: string; rating?: string; ratingCount?: number; publishedDate?: string; keyThemes?: string }>();
    for (const p of bookCoversQuery.data ?? []) {
      const hasRating = p.rating && String(p.rating).trim() !== '' && parseFloat(String(p.rating)) > 0;
      // Normalise stored title to match the key used during deduplication
      map.set(p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase(), {
        summary: p.summary ?? undefined,
        rating: hasRating ? String(p.rating) : undefined,
        ratingCount: hasRating && p.ratingCount ? Number(p.ratingCount) : undefined,
        publishedDate: p.publishedDate ?? undefined,
        keyThemes: p.keyThemes ?? undefined,
      });
    }
    return map;
  }, [bookCoversQuery.data]);

  const booksByIdMap = useMemo(() => {
    const map = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) map.set(b.id, b);
    return map;
  }, []);

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
  // Recently enriched authors — for the "Featured" section
  const recentlyEnrichedQuery = trpc.authorProfiles.getRecentlyEnriched.useQuery(
    { limit: 6 },
    { staleTime: 5 * 60_000 }
  );
  const platformLinksMap = useMemo(() => {
    type PlatformRow = typeof platformLinksQuery.data extends (infer T)[] | undefined ? T : never;
    const map = new Map<string, PlatformRow>();
    for (const r of platformLinksQuery.data ?? []) {
      map.set(r.authorName.toLowerCase(), r);
    }
    return map;
  }, [platformLinksQuery.data]);

  // --- Favorites ---
  const { isAuthenticated } = useAuth();
  const allAuthorKeys = useMemo(
    () => Array.from(new Set(AUTHORS.map((a) => canonicalName(a.name).toLowerCase()))),
    []
  );
  const authorFavoritesQuery = trpc.favorites.checkMany.useQuery(
    { entityType: "author", entityKeys: allAuthorKeys },
    { enabled: isAuthenticated, staleTime: 60_000 }
  );
  const bookFavoritesQuery = trpc.favorites.checkMany.useQuery(
    { entityType: "book", entityKeys: allBookTitles.map((t) => t.toLowerCase()) },
    { enabled: isAuthenticated, staleTime: 60_000 }
  );
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

  // --- Callbacks ---
  const toggleCategory = useCallback((cat: string) => {
    _setSelectedCategoriesAndPersist((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, [_setSelectedCategoriesAndPersist]);

  const clearFilters = useCallback(() => {
    _setSelectedCategoriesAndPersist(new Set());
    setQuery("");
    setEnrichFilter("all");
  }, [_setSelectedCategoriesAndPersist, setEnrichFilter]);

  // --- Filtered + sorted data ---
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
      return matchesCat && matchesQ;
    }).sort((a, b) => {
      const qualityOrder = QUALITY_ORDER;
      switch (authorSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "books-desc": return b.books.length - a.books.length;
        case "category": return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case "quality-desc": {
          const aQ = researchQualityMap.get(canonicalName(a.name).toLowerCase()) ?? "undefined";
          const bQ = researchQualityMap.get(canonicalName(b.name).toLowerCase()) ?? "undefined";
          const diff = (qualityOrder[aQ] ?? 3) - (qualityOrder[bQ] ?? 3);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case "favorites-first": {
          const aFav = (authorFavoritesQuery.data ?? {})[canonicalName(a.name).toLowerCase()] ? 0 : 1;
          const bFav = (authorFavoritesQuery.data ?? {})[canonicalName(b.name).toLowerCase()] ? 0 : 1;
          return aFav !== bFav ? aFav - bFav : a.name.localeCompare(b.name);
        }
        case "most-popular": {
          // Score = Wikipedia avg monthly views + (Substack post count * 100) + (GitHub followers * 10)
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
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, authorSort, researchQualityMap, authorFavoritesQuery.data, platformLinksMap]);

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
      return matchesCat && matchesQ && matchesEnrich;
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
          const enrichOrder = ENRICH_ORDER;
          const tkA = normalizeTitleKey(a.name);
          const tkB = normalizeTitleKey(b.name);
          const profA = bookCoversQuery.data?.find((p) => p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase() === tkA) ?? null;
          const profB = bookCoversQuery.data?.find((p) => p.bookTitle.replace(/[?!.,;:]+$/, "").toLowerCase() === tkB) ?? null;
          const lvA = getBookEnrichmentLevel(profA as Parameters<typeof getBookEnrichmentLevel>[0]);
          const lvB = getBookEnrichmentLevel(profB as Parameters<typeof getBookEnrichmentLevel>[0]);
          return (enrichOrder[lvB] ?? 0) - (enrichOrder[lvA] ?? 0) || a.name.localeCompare(b.name);
        }
        case "favorites-first": {
          const tkA = normalizeTitleKey(a.name);
          const tkB = normalizeTitleKey(b.name);
          const aFav = (bookFavoritesQuery.data ?? {})[tkA] ? 0 : 1;
          const bFav = (bookFavoritesQuery.data ?? {})[tkB] ? 0 : 1;
          return aFav !== bFav ? aFav - bFav : a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, bookSort, enrichFilter, bookCoversQuery.data, bookFavoritesQuery.data]);

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

  const hasFilters = selectedCategories.size > 0 || query.length > 0 || enrichFilter !== "all";

  // ENRICH_LABELS is a module-level constant (see top of file)
  const showCategoryFilter = activeTab !== "audio";

  return (
    <>
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-hidden">
        {/* -- Sidebar -- */}
        <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
          <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/ricardocidalecartoon_330eb604.png"
                alt="Ricardo Cidale"
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20 avatar-bob"
              />
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ricardo Cidale</p>
                <p className="text-sm font-bold font-display leading-tight tracking-tight">
                  Personal Library
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeTab === "authors"} onClick={() => { setActiveTab("authors"); _setSelectedCategoriesAndPersist(new Set()); }} tooltip="Authors">
                      <Users className="w-4 h-4" />
                      <span>Authors</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredAuthors.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeTab === "books"} onClick={() => { setActiveTab("books"); _setSelectedCategoriesAndPersist(new Set()); }} tooltip="Books">
                      <BookOpen className="w-4 h-4" />
                      <span>Books</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredBooks.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeTab === "audio"} onClick={() => { setActiveTab("audio"); _setSelectedCategoriesAndPersist(new Set()); }} tooltip="Books Audio">
                      <Headphones className="w-4 h-4" />
                      <span>Books Audio</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredAudio.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isAuthenticated && (
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive={activeTab === "favorites"} onClick={() => { setActiveTab("favorites"); _setSelectedCategoriesAndPersist(new Set()); }} tooltip="Favorites">
                        <Heart className="w-4 h-4" />
                        <span>Favorites</span>
                        <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                          {Object.values(authorFavoritesQuery.data ?? {}).filter(Boolean).length + Object.values(bookFavoritesQuery.data ?? {}).filter(Boolean).length}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <Separator className="my-2 group-data-[collapsible=icon]:hidden" />

            {showCategoryFilter && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 mb-1">
                  Filter by Category
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {CATEGORIES.map((cat) => {
                      const color = CATEGORY_COLORS[cat] ?? "hsl(var(--muted-foreground))";
                      const iconName = CATEGORY_ICONS[cat] ?? "briefcase";
                      const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
                      const count = activeTab === "authors" ? (authorCounts[cat] ?? 0) : (bookCounts[cat] ?? 0);
                      if (count === 0) return null;
                      const isActive = selectedCategories.has(cat);
                      return (
                        <SidebarMenuItem key={cat}>
                          <SidebarMenuButton isActive={isActive} onClick={() => toggleCategory(cat)} className="h-auto py-1.5">
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? color : undefined }} />
                            <span className="text-xs leading-tight flex-1 truncate">{cat}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? color + "20" : undefined, color: isActive ? color : undefined }}>
                              {count}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {activeTab === "audio" && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 mb-1">
                  Audio Formats
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  {Object.entries(FORMAT_CLASSES).map(([fmt, cls]) => (
                    <div key={fmt} className="flex items-center gap-2 py-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
                        {FORMAT_LABEL[fmt] ?? fmt}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmt === "MP3" ? "Standard audio" : fmt === "M4B" ? "Chapters + bookmarks" : fmt === "AAX" ? "Audible DRM" : "Apple audio"}
                      </span>
                    </div>
                  ))}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="px-4 py-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] text-muted-foreground mb-1">{`Data as of ${STATS.lastUpdated}`}</p>
            {authorAvatarMapQuery.data && (() => {
              const withAvatar = (authorAvatarMapQuery.data as { avatarUrl?: string | null }[]).filter(r => r.avatarUrl).length;
              const total = STATS.totalAuthors;
              const pct = Math.round((withAvatar / total) * 100);
              return (
                <div className="flex items-center gap-1.5 mb-2" title={`${withAvatar} of ${total} authors have avatars`}>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-chart-5" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{withAvatar}/{total} avatars</span>
                </div>
              );
            })()}
            <div className="mt-3 pt-3 border-t border-border/50">
              <a href="/leaderboard" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                Leaderboard
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </a>
              <a href="/compare" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <BarChart className="w-3.5 h-3.5 flex-shrink-0" />
                Compare Authors
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </a>
              <a href="/admin" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                Admin Console
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </a>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Media Folders</p>
              <div className="flex flex-col gap-1">
                <a href="https://drive.google.com/drive/folders/1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  Author Avatars
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
                <a href="https://drive.google.com/drive/folders/1qzmgRdCQr98fxVs6Bvnqi3J-tS574GY1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60">
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  Book Covers
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <a href="https://norfolkai.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:opacity-90 transition-opacity norfolk-logo-pulse" title="Powered by Norfolk AI">
                <img
                  src={appTheme === "dark"
                    ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-white_d92c1722.png"
                    : "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-blue_9ed63fc7.png"
                  }
                  alt="Norfolk AI"
                  className="w-4 h-4 object-contain"
                />
                <span className="text-[10px] text-muted-foreground tracking-wide">Powered by Norfolk AI</span>
              </a>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* -- Main Content -- */}
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ricardo Cidale's Library</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="capitalize">{activeTab === "audio" ? "Books Audio" : activeTab}</span>
              {selectedCategories.size > 0 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{selectedCategories.size} filter{selectedCategories.size > 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            <div className="ml-auto relative w-full sm:w-64 max-w-xs search-glow rounded-md border border-transparent">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={activeTab === "audio" ? "Search audiobooks, authors..." : "Search authors, books, topics..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-8 h-8 text-sm bg-background"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </header>

          <main ref={mainRef} className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-auto">
            {/* Stats strip with 3D floating books background */}
            <div className="relative mb-6">
              <div className="absolute inset-0 -top-4 -bottom-4 overflow-hidden rounded-xl opacity-40">
                <FloatingBooks count={6} className="w-full h-full" />
              </div>
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Authors" value={STATS.totalAuthors} icon={Users} />
              <StatCard label="Books" value={STATS.totalBooks} icon={BookOpen} />
              <StatCard label="Audiobooks" value={AUDIO_BOOKS.length} icon={Headphones} />
              <StatCard label="Categories" value={STATS.totalCategories} icon={LayoutGrid} />
              </div>
            </div>

            {/* Active filters */}
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
                {query && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    "{query}"
                    <button onClick={() => setQuery("")}><X className="w-3 h-3" /></button>
                  </Badge>
                )}
                {Array.from(selectedCategories).map((cat) => {
                  const color = CATEGORY_COLORS[cat] ?? "hsl(var(--muted-foreground))";
                  return (
                    <Badge key={cat} variant="secondary" className="gap-1 text-xs" style={{ borderColor: color, color, backgroundColor: color + "12" }}>
                      {cat}
                      <button onClick={() => toggleCategory(cat)}><X className="w-3 h-3" /></button>
                    </Badge>
                  );
                })}
                {enrichFilter !== "all" && (() => {
                  const e = ENRICH_LABELS[enrichFilter];
                  return e ? (
                    <Badge variant="secondary" className="gap-1 text-xs" style={{ borderColor: e.color, color: e.color, backgroundColor: e.bg }}>
                      {e.label}
                      <button onClick={() => setEnrichFilter("all")}><X className="w-3 h-3" /></button>
                    </Badge>
                  ) : null;
                })()}
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear all</button>
              </div>
            )}

            {/* Section header */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-extrabold font-display tracking-tight">
                  {activeTab === "authors" ? "Authors" : activeTab === "books" ? "Books" : "Books Audio"}
                </h1>
                <span className="text-sm text-muted-foreground">
                  {activeTab === "authors" ? `${filteredAuthors.length} of ${STATS.totalAuthors}` : activeTab === "books" ? `${filteredBooks.length} of ${STATS.totalBooks}` : `${filteredAudio.length} of ${AUDIO_BOOKS.length}`}
                </span>
              </div>
              {activeTab !== "audio" && (
                <div className="flex items-center gap-2">
                  {activeTab === "books" && (
                    <button
                      onClick={() => setEnrichFilter(enrichFilter === "complete" ? "all" : "complete")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        enrichFilter === "complete"
                          ? "bg-amber-50 text-amber-700 border-amber-400"
                          : "bg-transparent text-muted-foreground border-border hover:border-amber-400 hover:text-amber-700"
                      }`}
                      title="Show only Fully Enriched books"
                    >
                      <span>⭐</span>
                      {enrichFilter === "complete" ? "Best only" : "Show best"}
                    </button>
                  )}
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  {activeTab === "authors" ? (
                    <Select value={authorSort} onValueChange={(v) => setAuthorSort(v as AuthorSort)}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Name A to Z</SelectItem>
                        <SelectItem value="name-desc">Name Z to A</SelectItem>
                        <SelectItem value="books-desc">Most Books</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="quality-desc">Research Quality</SelectItem>
                        <SelectItem value="most-popular">Most Popular</SelectItem>
                        {isAuthenticated && <SelectItem value="favorites-first">Favorites First</SelectItem>}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={bookSort} onValueChange={(v) => setBookSort(v as BookSort)}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Title A to Z</SelectItem>
                        <SelectItem value="name-desc">Title Z to A</SelectItem>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="content-desc">Most Content</SelectItem>
                        <SelectItem value="enrich-desc">Enrichment Level</SelectItem>
                        {isAuthenticated && <SelectItem value="favorites-first">Favorites First</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Enrichment Level filter chips — Books tab only */}
            {activeTab === "books" && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground font-medium">Enrichment:</span>
                {([
                  { value: "all",      label: "All",              color: "hsl(var(--muted-foreground))",  bg: "hsl(var(--muted))" },
                  { value: "complete", label: "Fully Enriched",   color: "#d97706",                       bg: "#fef3c7" },
                  { value: "enriched", label: "Well Enriched",    color: "#059669",                       bg: "#d1fae5" },
                  { value: "basic",    label: "Partially Enriched",color: "#0284c7",                      bg: "#e0f2fe" },
                  { value: "none",     label: "Basic",            color: "#6b7280",                       bg: "#f3f4f6" },
                ] as const).map(({ value, label, color, bg }) => {
                  const isActive = enrichFilter === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setEnrichFilter(value)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                      style={{
                        backgroundColor: isActive ? bg : "transparent",
                        color: isActive ? color : "hsl(var(--muted-foreground))",
                        borderColor: isActive ? color : "hsl(var(--border))",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                {enrichFilter !== "all" && (
                  <button onClick={() => setEnrichFilter("all")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Featured: Recently Enriched Authors */}
            {activeTab === "authors" && !query && selectedCategories.size === 0 && (recentlyEnrichedQuery.data?.length ?? 0) > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold">Recently Enriched</h2>
                  <span className="text-xs text-muted-foreground">Authors with fresh research data</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {recentlyEnrichedQuery.data?.map((author) => {
                    const avatarUrl = author.s3AvatarUrl || author.avatarUrl || null;
                    return (
                      <button
                        key={author.authorName}
                        onClick={() => {
                          const found = AUTHORS.find((a) => canonicalName(a.name).toLowerCase() === author.authorName.toLowerCase());
                          if (found) { setSelectedAuthor(found); setBioSheetOpen(true); }
                        }}
                        className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[90px] group"
                      >
                        <div className="relative">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={author.authorName}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400/40 group-hover:ring-amber-400/80 transition-all"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center text-lg font-bold text-amber-600">
                              {author.authorName.charAt(0)}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <Sparkles className="w-2.5 h-2.5 text-amber-900" />
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                          {author.authorName.split(" ").slice(0, 2).join(" ")}
                        </span>
                        {author.enrichedAt && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(author.enrichedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Card grid */}
            <div className="relative">
              {activeTab === "authors" ? (
                filteredAuthors.length === 0 ? (
                  <EmptyState query={query} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 tab-content-enter">
                    {filteredAuthors.map((a, i) => (
                      <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                        <FlowbiteAuthorCard
                          author={a}
                          query={query}
                          onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                          isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                          bio={(authorBios as Record<string, string>)[canonicalName(a.name)] ?? dbBioMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                          coverMap={bookCoverMap}
                          dbAvatarMap={dbAvatarMap}
                          researchQualityMap={researchQualityMap}
                          bookInfoMap={bookInfoMap}
                          onNavigateToBook={navigateToBook}
                          isHighlighted={highlightedAuthorName === canonicalName(a.name).toLowerCase()}
                          isFavorite={(authorFavoritesQuery.data ?? {})[canonicalName(a.name).toLowerCase()] ?? false}
                          hasRichBio={richBioSet.has(canonicalName(a.name).toLowerCase())}
                          platformLinks={platformLinksMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                          freshnessDimensions={authorFreshnessMap.get(canonicalName(a.name).toLowerCase())}
                          cardRef={(el) => {
                            const key = canonicalName(a.name).toLowerCase();
                            if (el) authorCardRefs.current.set(key, el);
                            else authorCardRefs.current.delete(key);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "books" ? (
                filteredBooks.length === 0 ? (
                  <EmptyState query={query} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 tab-content-enter">
                    {filteredBooks.map((b, i) => {
                      const titleKey = b.name.split(" - ")[0].trim().replace(/[?!.,;:]+$/, "");
                      const tk = normalizeTitleKey(b.name);
                      return (
                        <div
                          key={b.id + i}
                          style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
                          ref={(el) => {
                            if (el) bookCardRefs.current.set(tk, el);
                            else bookCardRefs.current.delete(tk);
                          }}
                        >
                          <BookCard
                            book={b}
                            query={query}
                            onDetailClick={(book) => { setSelectedBook(book); setBookSheetOpen(true); }}
                            coverImageUrl={bookCoverMap.get(titleKey)}
                            isEnriched={enrichedTitlesSet.has(titleKey)}
                            amazonUrl={amazonUrlMap.get(titleKey)}
                            goodreadsUrl={goodreadsUrlMap.get(titleKey)}
                            wikipediaUrl={wikipediaUrlMap.get(titleKey)}
                            onCoverClick={(url, title, color) => setLightboxCover({ url, title, color })}
                            onAuthorClick={navigateToAuthor}
                            isHighlighted={highlightedBookTitle === tk}
                            rating={bookInfoMap.get(tk)?.rating}
                            ratingCount={bookInfoMap.get(tk)?.ratingCount}
                            publishedDate={bookInfoMap.get(tk)?.publishedDate}
                            keyThemes={bookInfoMap.get(tk)?.keyThemes}
                            summary={bookInfoMap.get(tk)?.summary}
                            isFavorite={(bookFavoritesQuery.data ?? {})[tk] ?? false}
                            hasRichSummary={richSummarySet.has(titleKey)}
                            freshnessDimensions={bookFreshnessMap.get(tk)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === "audio" ? (
                filteredAudio.length === 0 ? (
                  <EmptyState query={query} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredAudio.map((a, i) => (
                      <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                        <AudioCard audio={a} query={query} />
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "favorites" ? (
                !isAuthenticated ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <Heart className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-lg font-semibold text-muted-foreground">Sign in to see your favorites</p>
                    <p className="text-sm text-muted-foreground/70">Favorites are saved to your account.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Favorite Authors */}
                    {(() => {
                      const favAuthors = filteredAuthors.filter((a) =>
                        (authorFavoritesQuery.data ?? {})[canonicalName(a.name).toLowerCase()]
                      );
                      return favAuthors.length > 0 ? (
                        <div>
                          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Heart className="w-4 h-4 text-rose-500" />
                            Favorite Authors
                            <span className="text-xs text-muted-foreground font-normal">({favAuthors.length})</span>
                          </h2>
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {favAuthors.map((a, i) => (
                              <div key={a.id + i}>
                                <FlowbiteAuthorCard
                                  author={a}
                                  query={query}
                                  onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                                  isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                                  bio={(authorBios as Record<string, string>)[canonicalName(a.name)] ?? dbBioMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                                  coverMap={bookCoverMap}
                                  dbAvatarMap={dbAvatarMap}
                                  researchQualityMap={researchQualityMap}
                                  bookInfoMap={bookInfoMap}
                                  onNavigateToBook={navigateToBook}
                                  isHighlighted={false}
                                  isFavorite={true}
                                  hasRichBio={richBioSet.has(canonicalName(a.name).toLowerCase())}
                                  platformLinks={platformLinksMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                                  freshnessDimensions={authorFreshnessMap.get(canonicalName(a.name).toLowerCase())}
                                />
                              </div>
                            ))}  
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Favorite Books */}
                    {(() => {
                      const favBooks = filteredBooks.filter((b) => {
                        const tk = normalizeTitleKey(b.name);
                        return (bookFavoritesQuery.data ?? {})[tk];
                      });
                      return favBooks.length > 0 ? (
                        <div>
                          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                            <Heart className="w-4 h-4 text-rose-500" />
                            Favorite Books
                            <span className="text-xs text-muted-foreground font-normal">({favBooks.length})</span>
                          </h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {favBooks.map((b, i) => {
                              const titleKey = b.name.split(" - ")[0].trim().replace(/[?!.,;:]+$/, "");
                              const tk = normalizeTitleKey(b.name);
                              return (
                                <div key={b.id + i}>
                                  <BookCard
                                    book={b}
                                    query={query}
                                    onDetailClick={(book) => { setSelectedBook(book); setBookSheetOpen(true); }}
                                    coverImageUrl={bookCoverMap.get(titleKey)}
                                    isEnriched={enrichedTitlesSet.has(titleKey)}
                                    amazonUrl={amazonUrlMap.get(titleKey)}
                                    goodreadsUrl={goodreadsUrlMap.get(titleKey)}
                                    wikipediaUrl={wikipediaUrlMap.get(titleKey)}
                                    onCoverClick={(url, title, color) => setLightboxCover({ url, title, color })}
                                    onAuthorClick={navigateToAuthor}
                                    isHighlighted={false}
                                    rating={bookInfoMap.get(tk)?.rating}
                                    ratingCount={bookInfoMap.get(tk)?.ratingCount}
                                    publishedDate={bookInfoMap.get(tk)?.publishedDate}
                                    keyThemes={bookInfoMap.get(tk)?.keyThemes}
                                    summary={bookInfoMap.get(tk)?.summary}
                                    isFavorite={true}
                                    hasRichSummary={richSummarySet.has(titleKey)}
                                    freshnessDimensions={bookFreshnessMap.get(tk)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {/* Empty state */}
                    {Object.values(authorFavoritesQuery.data ?? {}).filter(Boolean).length === 0 &&
                     Object.values(bookFavoritesQuery.data ?? {}).filter(Boolean).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <Heart className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-lg font-semibold text-muted-foreground">No favorites yet</p>
                        <p className="text-sm text-muted-foreground/70">Click the heart icon on any author or book card to add it here.</p>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>

    {/* Author Bio Modal */}
    <Dialog open={bioSheetOpen} onOpenChange={setBioSheetOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedAuthor && (
          <AuthorBioPanel author={selectedAuthor} onClose={() => setBioSheetOpen(false)} />
        )}
      </DialogContent>
    </Dialog>

    {/* Book Detail Modal */}
    <Dialog open={bookSheetOpen} onOpenChange={setBookSheetOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedBook && (
          <BookDetailPanel book={selectedBook} onClose={() => setBookSheetOpen(false)} />
        )}
      </DialogContent>
    </Dialog>

    {/* Cover Lightbox */}
    {lightboxCover && (
      <CoverLightbox
        coverUrl={lightboxCover.url}
        title={lightboxCover.title}
        author={lightboxCover.author}
        color={lightboxCover.color}
        amazonUrl={lightboxCover.amazonUrl}
        onClose={() => setLightboxCover(null)}
      />
    )}

    {/* Back to Top */}
    <BackToTop scrollContainerRef={mainRef} />
    </>
  );
}
