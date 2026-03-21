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

import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { CoverLightbox } from "@/components/CoverLightbox";
import CardGridSparkles from "@/components/CardGridSparkles";
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

// Extracted library sub-components
import { AuthorCard } from "@/components/library/AuthorCard";
import { BookCard } from "@/components/library/BookCard";
import { AudioCard } from "@/components/library/AudioCard";
import { AuthorBioPanel } from "@/components/library/AuthorBioPanel";
import { BookDetailPanel } from "@/components/library/BookDetailPanel";
import { StatCard, EmptyState } from "@/components/library/LibraryPrimitives";
import { ICON_MAP, FORMAT_CLASSES, FORMAT_LABEL, STATS } from "@/components/library/libraryConstants";

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
  type LucideIcon,
} from "lucide-react";

type TabType = "authors" | "books" | "audio";
type AuthorSort = "name-asc" | "name-desc" | "books-desc" | "category";
type BookSort = "name-asc" | "name-desc" | "author" | "content-desc";

export default function Home() {
  const { settings: { colorMode: appTheme, viewMode: savedViewMode }, updateSettings } = useAppSettings();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("authors");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [authorSort, setAuthorSort] = useState<AuthorSort>("name-asc");
  const [bookSort, setBookSort] = useState<BookSort>("name-asc");
  const authorViewMode = savedViewMode === "accordion" ? "accordion" : "card";
  const setAuthorViewMode = (mode: "card" | "accordion") => updateSettings({ viewMode: mode === "card" ? "cards" : "accordion" });

  // Modal state
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorEntry | null>(null);
  const [bioSheetOpen, setBioSheetOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<typeof BOOKS[number] | null>(null);
  const [bookSheetOpen, setBookSheetOpen] = useState(false);
  const [lightboxCover, setLightboxCover] = useState<{ url: string | null; title: string; author?: string; color?: string; amazonUrl?: string } | null>(null);

  // Scroll container ref for BackToTop
  const mainRef = useRef<HTMLElement>(null);

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

  const allBookTitles = useMemo(() => Array.from(new Set(BOOKS.map((b) => b.name.split(" - ")[0].trim()))), []);
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

  const bookInfoMap = useMemo(() => {
    const map = new Map<string, { summary?: string; rating?: string; ratingCount?: string }>();
    for (const p of bookCoversQuery.data ?? []) {
      const hasRating = p.rating && String(p.rating).trim() !== '' && parseFloat(String(p.rating)) > 0;
      if (p.summary || hasRating) {
        map.set(p.bookTitle.toLowerCase(), {
          summary: p.summary ?? undefined,
          rating: hasRating ? String(p.rating) : undefined,
          ratingCount: hasRating && p.ratingCount ? String(p.ratingCount) : undefined,
        });
      }
    }
    return map;
  }, [bookCoversQuery.data]);

  const booksByIdMap = useMemo(() => {
    const map = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) map.set(b.id, b);
    return map;
  }, []);

  const authorPhotoMapQuery = trpc.authorProfiles.getPhotoMap.useQuery(undefined, { staleTime: 60_000 });
  const dbPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    const splitSep = /\s+(?:and|&)\s+/i;
    for (const r of authorPhotoMapQuery.data ?? []) {
      if (!r.photoUrl) continue;
      map.set(r.authorName.toLowerCase(), r.photoUrl);
      const parts = r.authorName.split(splitSep).map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) {
          const key = part.toLowerCase();
          if (!map.has(key)) map.set(key, r.photoUrl);
        }
      }
    }
    return map;
  }, [authorPhotoMapQuery.data]);

  // --- Callbacks ---
  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategories(new Set());
    setQuery("");
  }, []);

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
        const titleKey = book.name.split(" - ")[0].trim().toLowerCase();
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
      switch (authorSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "books-desc": return b.books.length - a.books.length;
        case "category": return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, authorSort]);

  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase();
    const seen = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) {
      const titleKey = b.name.split(" - ")[0].trim().toLowerCase();
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
      return matchesCat && matchesQ;
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
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, bookSort]);

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

  const hasFilters = selectedCategories.size > 0 || query.length > 0;
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
                    <SidebarMenuButton isActive={activeTab === "authors"} onClick={() => { setActiveTab("authors"); setSelectedCategories(new Set()); }} tooltip="Authors">
                      <Users className="w-4 h-4" />
                      <span>Authors</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredAuthors.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeTab === "books"} onClick={() => { setActiveTab("books"); setSelectedCategories(new Set()); }} tooltip="Books">
                      <BookOpen className="w-4 h-4" />
                      <span>Books</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredBooks.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeTab === "audio"} onClick={() => { setActiveTab("audio"); setSelectedCategories(new Set()); }} tooltip="Books Audio">
                      <Headphones className="w-4 h-4" />
                      <span>Books Audio</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredAudio.length}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
            {authorPhotoMapQuery.data && (() => {
              const withPhoto = (authorPhotoMapQuery.data as { photoUrl?: string | null }[]).filter(r => r.photoUrl).length;
              const total = STATS.totalAuthors;
              const pct = Math.round((withPhoto / total) * 100);
              return (
                <div className="flex items-center gap-1.5 mb-2" title={`${withPhoto} of ${total} authors have headshots`}>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-chart-5" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{withPhoto}/{total} photos</span>
                </div>
              );
            })()}
            <div className="mt-3 pt-3 border-t border-border/50">
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
                  Author Pictures
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
            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Authors" value={STATS.totalAuthors} icon={Users} />
              <StatCard label="Books" value={STATS.totalBooks} icon={BookOpen} />
              <StatCard label="Audiobooks" value={AUDIO_BOOKS.length} icon={Headphones} />
              <StatCard label="Categories" value={STATS.totalCategories} icon={LayoutGrid} />
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
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  {activeTab === "authors" ? (
                    <Select value={authorSort} onValueChange={(v) => setAuthorSort(v as AuthorSort)}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Name A to Z</SelectItem>
                        <SelectItem value="name-desc">Name Z to A</SelectItem>
                        <SelectItem value="books-desc">Most Books</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
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
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Card grid */}
            <div className="relative">
              <CardGridSparkles />
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
                          dbPhotoMap={dbPhotoMap}
                          bookInfoMap={bookInfoMap}
                          onBookClick={(bookId, titleKey) => {
                            const found = booksByIdMap.get(bookId) ?? BOOKS.find((b) => b.name.split(" - ")[0].trim().toLowerCase() === titleKey.toLowerCase());
                            const coverUrl = bookCoverMap?.get(titleKey) ?? null;
                            const color = found ? (CATEGORY_COLORS[found.category] ?? undefined) : undefined;
                            setLightboxCover({ url: coverUrl, title: titleKey, color });
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
                      const titleKey = b.name.split(" - ")[0].trim();
                      return (
                        <div key={b.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                          <BookCard
                            book={b}
                            query={query}
                            onDetailClick={(book) => { setSelectedBook(book); setBookSheetOpen(true); }}
                            coverImageUrl={bookCoverMap.get(titleKey)}
                            isEnriched={enrichedTitlesSet.has(titleKey)}
                            amazonUrl={amazonUrlMap.get(titleKey)}
                            onCoverClick={(url, title, color) => setLightboxCover({ url, title, color })}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              ) : filteredAudio.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAudio.map((a, i) => (
                    <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <AudioCard audio={a} query={query} />
                    </div>
                  ))}
                </div>
              )}
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
