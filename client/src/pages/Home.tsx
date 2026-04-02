/**
 * Ricardo Cidale's Library — Home Page
 * Design: Editorial Intelligence — sidebar-07 layout + card grid
 * Fonts: Inter Tight (ExtraBold H1, SemiBold H2/H3, Regular body)
 * Palette: NCG Brand — Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B
 * Tabs: Authors | Books (unified, includes audiobooks) | Media | Favorites
 *
 * This file is the orchestrator. Data hooks live in useLibraryData.
 * Sidebar lives in LibrarySidebar. Card components live in
 *   client/src/components/library/
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { CoverLightbox } from "@/components/CoverLightbox";
import { BackToTop } from "@/components/BackToTop";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AUTHORS,
  BOOKS,
  CATEGORY_COLORS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { AUDIO_BOOKS } from "@/lib/audioData";
import { FlowbiteAuthorCard } from "@/components/FlowbiteAuthorCard";
import { canonicalName } from "@/lib/authorAliases";

import { BookCard } from "@/components/library/BookCard";
import { AudioCard } from "@/components/library/AudioCard";
import { AuthorBioPanel } from "@/components/library/AuthorBioPanel";
import { BookDetailPanel } from "@/components/library/BookDetailPanel";
import { StatCard, EmptyState } from "@/components/library/LibraryPrimitives";
import { FloatingBooks } from "@/components/FloatingBooks";
import { STATS, type BookEnrichmentLevel } from "@/components/library/libraryConstants";
import { LibrarySidebar, type TabType } from "@/components/library/LibrarySidebar";
import { LibraryHeader } from "@/components/library/LibraryHeader";
import { TagGroupHeader, groupByFirstTag } from "@/components/library/TagGroupHeader";
import { MediaTab } from "@/components/library/MediaTab";
import { BookFilterBar } from "@/components/library/BookFilterBar";
import { useLibraryCrud } from "@/hooks/useLibraryCrud";
import { PlusCircle } from "lucide-react";
import {
  useLibraryData,
  normalizeTitleKey,
  type AuthorSort,
  type BookSort,
} from "@/hooks/useLibraryData";
import { trpc } from "@/lib/trpc";

import {
  BookOpen,
  Users,
  LayoutGrid,
  Headphones,
  ArrowUpDown,
  Heart,
  Sparkles,
  Film,
  X,
} from "lucide-react";

// ── Enrichment label config ───────────────────────────────────────────────────
const ENRICH_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  complete: { label: "Fully Enriched",     color: "#d97706", bg: "#fef3c7" },
  enriched: { label: "Well Enriched",      color: "#059669", bg: "#d1fae5" },
  basic:    { label: "Partially Enriched", color: "#0284c7", bg: "#e0f2fe" },
  none:     { label: "Basic",              color: "#6b7280", bg: "#f3f4f6" },
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("authors");
  const [_savedCategories, _setSavedCategories] = useLocalStorage<string[]>("lib:selectedCategories", []);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set(_savedCategories));
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
  const [possessionFilter, setPossessionFilter] = useLocalStorage<string>("lib:possessionFilter", "all");
  const [formatFilter, setFormatFilter] = useLocalStorage<string>("lib:formatFilter", "all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage<boolean>("lib:showFavoritesOnly", false);
  const [_savedTagSlugs, _setSavedTagSlugs] = useLocalStorage<string[]>("lib:selectedTagSlugs", []);
  // URL search params for shareable tag-filtered views
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const urlTagSlugs = (() => {
    const params = new URLSearchParams(searchString);
    const t = params.get("tags");
    return t ? t.split(",").filter(Boolean) : null;
  })();
  // Initialise from URL if present, otherwise fall back to localStorage
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<Set<string>>(
    () => new Set(urlTagSlugs ?? _savedTagSlugs)
  );
  // Keep URL + localStorage in sync whenever selectedTagSlugs changes
  const _setSelectedTagSlugsAndPersist = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedTagSlugs((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      _setSavedTagSlugs(Array.from(next));
      // Update URL query param
      const params = new URLSearchParams(window.location.search);
      if (next.size > 0) {
        params.set("tags", Array.from(next).join(","));
      } else {
        params.delete("tags");
      }
      const newSearch = params.toString();
      setLocation(newSearch ? `/?${newSearch}` : "/", { replace: true });
      return next;
    });
  }, [_setSavedTagSlugs, setLocation]);
  const toggleTagSlug = useCallback((slug: string) => {
    _setSelectedTagSlugsAndPersist((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, [_setSelectedTagSlugsAndPersist]);
  const clearTagFilters = useCallback(() => _setSelectedTagSlugsAndPersist(new Set()), [_setSelectedTagSlugsAndPersist]);

  // Modal state
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorEntry | null>(null);
  const [bioSheetOpen, setBioSheetOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<typeof BOOKS[number] | null>(null);
  const [bookSheetOpen, setBookSheetOpen] = useState(false);
  const [lightboxCover, setLightboxCover] = useState<{ url: string | null; title: string; author?: string; color?: string; amazonUrl?: string } | null>(null);

  // CRUD dialog orchestration
  const {
    openAddAuthor, openEditAuthor, openDeleteAuthor,
    openAddBook, openPhysicalBook, openEditBook, openDeleteBook,
    CrudDialogs,
  } = useLibraryCrud();

  // Live DB stats (falls back to static STATS if DB unavailable)
  const liveStatsQuery = trpc.library.getStats.useQuery(undefined, { staleTime: 5 * 60_000 });
  const liveStats = liveStatsQuery.data;

  // Scroll + highlight refs
  const mainRef = useRef<HTMLElement>(null);
  const [highlightedBookTitle, setHighlightedBookTitle] = useState<string | null>(null);
  const [highlightedAuthorName, setHighlightedAuthorName] = useState<string | null>(null);
  const bookCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const authorCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  const navigateToBook = useCallback((titleKey: string) => {
    setActiveTab("books");
    _setSelectedCategoriesAndPersist(new Set());
    const tk = titleKey.trim().toLowerCase();
    setHighlightedBookTitle(tk);
    setTimeout(() => {
      const el = bookCardRefs.current.get(tk);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [_setSelectedCategoriesAndPersist]);

  const navigateToAuthor = useCallback((authorName: string) => {
    setActiveTab("authors");
    _setSelectedCategoriesAndPersist(new Set());
    const key = authorName.trim().toLowerCase();
    setHighlightedAuthorName(key);
    setTimeout(() => {
      const el = authorCardRefs.current.get(key);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [_setSelectedCategoriesAndPersist]);

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

  // ── Data ────────────────────────────────────────────────────────────────
  const data = useLibraryData({ query, selectedCategories, authorSort, bookSort, enrichFilter, possessionFilter, formatFilter, showFavoritesOnly, selectedTagSlugs });
  const {
    authorAvatarMapQuery, authorFavoritesQuery, bookFavoritesQuery, recentlyEnrichedQuery,
    enrichedSet, enrichedTitlesSet, bookCoverMap, amazonUrlMap, goodreadsUrlMap, wikipediaUrlMap,
    richSummarySet, richBioSet, dbAvatarMap, researchQualityMap, platformLinksMap, bookInfoMap,
    authorFreshnessMap, bookFreshnessMap,
    filteredAuthors, filteredBooks, filteredAudio, authorCounts, bookCounts,
    bookTagsMap, authorTagsMap,
    getBio, isAuthenticated,
  } = data;
  const allTags: Array<{ slug: string; name: string; color?: string | null }> = data.allTags ?? [];

  const recentlyTaggedQuery = trpc.tags.getRecentlyTagged.useQuery(undefined, { staleTime: 30_000 });

  const hasFilters = selectedCategories.size > 0 || query.length > 0 || enrichFilter !== "all" || selectedTagSlugs.size > 0 || formatFilter !== "all" || showFavoritesOnly;

  // Compute category counts for the active tab
  const categoryCounts = activeTab === "authors" ? authorCounts : bookCounts;

  // Tab display names
  const tabDisplayName = (tab: TabType) => {
    switch (tab) {
      case "authors": return "Authors";
      case "books": return "Books";
      case "media": return "Media";
      case "favorites": return "Favorites";
    }
  };

  return (
    <>
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <LibrarySidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          clearCategoryFilters={() => _setSelectedCategoriesAndPersist(new Set())}
          selectedCategories={selectedCategories}
          toggleCategory={toggleCategory}
          categoryCounts={categoryCounts}
          filteredAuthorsCount={filteredAuthors.length}
          filteredBooksCount={filteredBooks.length}
          filteredMediaCount={0}
          favoriteCount={Object.values(authorFavoritesQuery.data ?? {}).filter(Boolean).length + Object.values(bookFavoritesQuery.data ?? {}).filter(Boolean).length}
          isAuthenticated={isAuthenticated}
          authorAvatarData={authorAvatarMapQuery.data as { avatarUrl?: string | null }[] | undefined}
          selectedTagSlugs={selectedTagSlugs}
          toggleTagSlug={toggleTagSlug}
          clearTagFilters={clearTagFilters}
        />

        {/* -- Main Content -- */}
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <LibraryHeader
            activeTab={activeTab}
            tabDisplayName={tabDisplayName}
            selectedCategoriesSize={selectedCategories.size}
            query={query}
            setQuery={setQuery}
          />

          <main ref={mainRef} className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-auto">
            {/* Stats strip */}
            <div className="relative mb-6">
              <div className="absolute inset-0 -top-4 -bottom-4 overflow-hidden rounded-xl opacity-40">
                <FloatingBooks count={6} className="w-full h-full" />
              </div>
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Authors" value={liveStats?.authors ?? STATS.totalAuthors} icon={Users} />
                <StatCard label="Books" value={liveStats?.books ?? STATS.totalBooks} icon={BookOpen} />
                <StatCard label="Audiobooks" value={AUDIO_BOOKS.length} icon={Headphones} />
                <StatCard label="Categories" value={liveStats?.categories ?? STATS.totalCategories} icon={LayoutGrid} />
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
                {Array.from(selectedTagSlugs).map((slug) => {
                  const tag = (data.allTags ?? []).find((t: { slug: string; name: string; color: string }) => t.slug === slug);
                  if (!tag) return null;
                  return (
                    <Badge key={slug} variant="secondary" className="gap-1 text-xs" style={{ borderColor: tag.color, color: tag.color, backgroundColor: tag.color + "22" }}>
                      {tag.name}
                      <button onClick={() => toggleTagSlug(slug)}><X className="w-3 h-3" /></button>
                    </Badge>
                  );
                })}
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear all</button>
              </div>
            )}

            {/* Section header + sort */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-extrabold font-display tracking-tight">
                  {tabDisplayName(activeTab)}
                </h1>
                <span className="text-sm text-muted-foreground">
                  {activeTab === "authors" ? `${filteredAuthors.length} of ${liveStats?.authors ?? STATS.totalAuthors}` :
                   activeTab === "books" ? `${filteredBooks.length} of ${liveStats?.books ?? STATS.totalBooks}` :
                   activeTab === "media" ? "Coming soon" :
                   ""}
                </span>
              </div>
              {(activeTab === "authors" || activeTab === "books") && (
                <div className="flex items-center gap-2">
                  {/* Add Author / Add Book button — admin only */}
                  {isAuthenticated && activeTab === "authors" && (
                    <button
                      onClick={openAddAuthor}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#c9b96e]/50 text-[#c9b96e] bg-[#c9b96e]/5 hover:bg-[#c9b96e]/15 hover:border-[#c9b96e] shadow-[0_2px_0_#8a7a3a] hover:shadow-[0_1px_0_#8a7a3a] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add Author
                    </button>
                  )}
                  {isAuthenticated && activeTab === "books" && (
                    <>
                      <button
                        onClick={openPhysicalBook}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:border-amber-500 shadow-[0_2px_0_#92400e] hover:shadow-[0_1px_0_#92400e] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
                        title="Quick-add a physical book you own"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Physical
                      </button>
                      <button
                        onClick={openAddBook}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-[#c9b96e]/50 text-[#c9b96e] bg-[#c9b96e]/5 hover:bg-[#c9b96e]/15 hover:border-[#c9b96e] shadow-[0_2px_0_#8a7a3a] hover:shadow-[0_1px_0_#8a7a3a] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add Book
                      </button>
                    </>
                  )}
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
                  {/* Favorites-only toggle — Authors and Books tabs */}
                  {isAuthenticated && (activeTab === "authors" || activeTab === "books") && (
                    <button
                      onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        showFavoritesOnly
                          ? "bg-rose-50 text-rose-600 border-rose-400 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-600"
                          : "bg-transparent text-muted-foreground border-border hover:border-rose-400 hover:text-rose-500"
                      }`}
                      title={showFavoritesOnly ? "Showing favorites only — click to show all" : "Show favorites only"}
                    >
                      <Heart className={`w-3 h-3 transition-all ${showFavoritesOnly ? "fill-rose-500 stroke-rose-500" : ""}`} />
                      {showFavoritesOnly ? "Favorites" : "Favorites"}
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
                        <SelectItem value="tags">Group by Tag</SelectItem>
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
                        <SelectItem value="tags">Group by Tag</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {/* Favorites sort badge — shows count when favorites-first is active */}
                  {isAuthenticated && activeTab === "authors" && authorSort === "favorites-first" && (() => {
                    const count = Object.values(authorFavoritesQuery.data ?? {}).filter(Boolean).length;
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                        <Heart className="w-3 h-3 fill-rose-500 stroke-rose-500" />
                        {count} saved
                      </span>
                    );
                  })()}
                  {isAuthenticated && activeTab === "books" && bookSort === "favorites-first" && (() => {
                    const count = Object.values(bookFavoritesQuery.data ?? {}).filter(Boolean).length;
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                        <Heart className="w-3 h-3 fill-rose-500 stroke-rose-500" />
                        {count} saved
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Books filter bar — Status / Format / Enrichment chips */}
            {activeTab === "books" && (
              <BookFilterBar
                possessionFilter={possessionFilter}
                setPossessionFilter={setPossessionFilter}
                formatFilter={formatFilter}
                setFormatFilter={setFormatFilter}
                enrichFilter={enrichFilter}
                setEnrichFilter={setEnrichFilter}
              />
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
                            <img src={avatarUrl} alt={author.authorName} className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400/40 group-hover:ring-amber-400/80 transition-all" />
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

            {/* Recently Tagged strip */}
            {activeTab === "authors" && !query && selectedCategories.size === 0 && selectedTagSlugs.size === 0 && (recentlyTaggedQuery.data?.length ?? 0) > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🏷️</span>
                  <h2 className="text-sm font-semibold">Recently Tagged</h2>
                  <span className="text-xs text-muted-foreground">Entities with tags applied recently</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {recentlyTaggedQuery.data?.map((item) => {
                    const avatarUrl = item.s3AvatarUrl || item.avatarUrl || null;
                    return (
                      <button
                        key={`${item.entityType}::${item.entityKey}`}
                        onClick={() => {
                          if (item.entityType === "author") {
                            const found = AUTHORS.find((a) => canonicalName(a.name).toLowerCase() === item.entityKey.toLowerCase());
                            if (found) { setSelectedAuthor(found); setBioSheetOpen(true); }
                          }
                        }}
                        className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[100px] group"
                      >
                        <div className="relative">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={item.entityKey} className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-400/40 group-hover:ring-violet-400/80 transition-all" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400/20 to-violet-600/20 flex items-center justify-center text-lg font-bold text-violet-600">
                              {item.entityKey.charAt(0)}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                            {item.entityType === "author" ? "A" : "B"}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                          {item.entityKey.split(" ").slice(0, 2).join(" ")}
                        </span>
                        {item.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.slug}
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-medium truncate max-w-full"
                            style={{ backgroundColor: (tag.color ?? "#6366F1") + "22", color: tag.color ?? "#6366F1" }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card grid */}
            <div className="relative">
              {activeTab === "authors" ? (
                filteredAuthors.length === 0 ? <EmptyState query={query} /> : (
                  authorSort === "tags" ? (
                    // Tag-group view: insert sticky section headers between groups
                    <div className="space-y-0">
                      {groupByFirstTag(
                        filteredAuthors,
                        (a) => {
                          const tags = authorTagsMap.get(canonicalName(a.name).toLowerCase());
                          return tags && tags.size > 0 ? Array.from(tags).sort()[0] : null;
                        },
                        allTags
                      ).map((group) => (
                        <div key={group.tagSlug ?? "__untagged__"} className="mb-6">
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <TagGroupHeader tagName={group.tagName} tagColor={group.tagColor} count={group.items.length} />
                            {group.items.map((a, i) => (
                              <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                                <FlowbiteAuthorCard
                                  author={a}
                                  query={query}
                                  onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                                  isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                                  bio={getBio(a)}
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
                                  onEditClick={isAuthenticated ? () => openEditAuthor(canonicalName(a.name)) : undefined}
                                  onDeleteClick={isAuthenticated ? () => openDeleteAuthor(canonicalName(a.name)) : undefined}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 tab-content-enter">
                    {filteredAuthors.map((a, i) => (
                      <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                        <FlowbiteAuthorCard
                          author={a}
                          query={query}
                          onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                          isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                          bio={getBio(a)}
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
                          onEditClick={isAuthenticated ? () => openEditAuthor(canonicalName(a.name)) : undefined}
                          onDeleteClick={isAuthenticated ? () => openDeleteAuthor(canonicalName(a.name)) : undefined}
                        />
                      </div>
                    ))}
                  </div>
                  )
                )
              ) : activeTab === "books" ? (
                filteredBooks.length === 0 ? <EmptyState query={query} /> : (
                  <>
                    {/* Recently Tagged strip — Books tab */}
                    {!query && selectedCategories.size === 0 && selectedTagSlugs.size === 0 && (recentlyTaggedQuery.data?.filter(i => i.entityType === "book").length ?? 0) > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">🏷️</span>
                          <h2 className="text-sm font-semibold">Recently Tagged</h2>
                          <span className="text-xs text-muted-foreground">Books with tags applied recently</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                          {recentlyTaggedQuery.data?.filter(i => i.entityType === "book").map((item) => {
                            const coverUrl = item.s3AvatarUrl || item.avatarUrl || null;
                            return (
                              <button
                                key={`book::${item.entityKey}`}
                                onClick={() => {
                                  const found = filteredBooks.find((b) => normalizeTitleKey(b.name) === item.entityKey || b.name.toLowerCase().includes(item.entityKey.toLowerCase()));
                                  if (found) { setSelectedBook(found); setBookSheetOpen(true); }
                                }}
                                className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[100px] group"
                              >
                                <div className="relative">
                                  {coverUrl ? (
                                    <img src={coverUrl} alt={item.entityKey} className="w-12 h-16 rounded-md object-cover ring-2 ring-violet-400/40 group-hover:ring-violet-400/80 transition-all" />
                                  ) : (
                                    <div className="w-12 h-16 rounded-md bg-gradient-to-br from-violet-400/20 to-violet-600/20 flex items-center justify-center text-lg font-bold text-violet-600">
                                      {item.entityKey.charAt(0)}
                                    </div>
                                  )}
                                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">B</span>
                                </div>
                                <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                                  {item.entityKey.split(" ").slice(0, 3).join(" ")}
                                </span>
                                {item.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.slug}
                                    className="text-[8px] px-1.5 py-0.5 rounded-full font-medium truncate max-w-full"
                                    style={{ backgroundColor: (tag.color ?? "#6366F1") + "22", color: tag.color ?? "#6366F1" }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Digital Books grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 tab-content-enter">
                      {filteredBooks.map((b, i) => {
                        const titleKey = b.name.split(" - ")[0].trim().replace(/[?!.,;:]+$/, "");
                        const tk = normalizeTitleKey(b.name);
                        return (
                          <div key={b.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
                            ref={(el) => { if (el) bookCardRefs.current.set(tk, el); else bookCardRefs.current.delete(tk); }}
                          >
                            <BookCard
                              book={b} query={query}
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
                              format={bookInfoMap.get(tk)?.format ?? null}
                              possessionStatus={bookInfoMap.get(tk)?.possessionStatus ?? null}
                              onEditClick={isAuthenticated ? () => openEditBook(titleKey) : undefined}
                              onDeleteClick={isAuthenticated ? () => openDeleteBook(titleKey) : undefined}
                              currentTagSlugs={Array.from(bookTagsMap.get(tk) ?? [])}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Audiobooks section within Books tab */}
                    {filteredAudio.length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                          <Headphones className="w-4 h-4 text-muted-foreground" />
                          <h2 className="text-base font-semibold">Audiobooks</h2>
                          <span className="text-xs text-muted-foreground">({filteredAudio.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {filteredAudio.map((a, i) => (
                            <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                              <AudioCard audio={a} query={query} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : activeTab === "media" ? (
                <MediaTab query={query} />
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
                                  author={a} query={query}
                                  onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                                  isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                                  bio={getBio(a)}
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
                                  onEditClick={isAuthenticated ? () => openEditAuthor(canonicalName(a.name)) : undefined}
                                  onDeleteClick={isAuthenticated ? () => openDeleteAuthor(canonicalName(a.name)) : undefined}
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
                                    book={b} query={query}
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
                                    format={bookInfoMap.get(tk)?.format ?? null}
                                    possessionStatus={bookInfoMap.get(tk)?.possessionStatus ?? null}
                                    onEditClick={isAuthenticated ? () => openEditBook(titleKey) : undefined}
                                    onDeleteClick={isAuthenticated ? () => openDeleteBook(titleKey) : undefined}
                                    currentTagSlugs={Array.from(bookTagsMap.get(tk) ?? [])}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}
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
        {selectedAuthor && <AuthorBioPanel author={selectedAuthor} onClose={() => setBioSheetOpen(false)} />}
      </DialogContent>
    </Dialog>

    {/* Book Detail Modal */}
    <Dialog open={bookSheetOpen} onOpenChange={setBookSheetOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedBook && <BookDetailPanel book={selectedBook} onClose={() => setBookSheetOpen(false)} />}
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

    <BackToTop scrollContainerRef={mainRef} />

    {/* ── CRUD Dialogs ─────────────────────────────────────────────────────── */}
    <CrudDialogs />
    </>
  );
}
