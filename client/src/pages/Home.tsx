/**
 * NCG Library — Home Page
 * Design: Editorial Modernism — sidebar-07 layout + card grid
 * Fonts: Playfair Display (headings) + DM Sans (body)
 * Palette: Warm off-white paper, deep charcoal, 9 category accents
 * Tabs: Authors | Books | Books Audio
 */

import { useState, useMemo, useCallback } from "react";
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
  AUTHORS,
  BOOKS,
  CATEGORIES,
  STATS,
  getCategoryMeta,
  type Author,
  type Book,
} from "@/lib/libraryData";
import { AUDIO_BOOKS, type AudioBook } from "@/lib/audioData";
import {
  Search,
  BookOpen,
  Users,
  LayoutGrid,
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
  Activity,
  ExternalLink,
  ChevronRight,
  Library,
  X,
  Headphones,
} from "lucide-react";
import { FileTypeIcons } from "@/components/FileTypeIcons";

// ── Icon map for categories ──────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  brain: Brain,
  handshake: Handshake,
  users: Users2,
  zap: Zap,
  "message-circle": MessageCircle,
  cpu: Cpu,
  "trending-up": TrendingUp,
  "book-open": BookMarked,
  activity: Activity,
};

// ── Audio format color map ───────────────────────────────────
const FORMAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  MP3:  { bg: "#fef3c7", text: "#92400e", label: "MP3" },
  M4B:  { bg: "#dbeafe", text: "#1e40af", label: "M4B" },
  AAX:  { bg: "#f3e8ff", text: "#6b21a8", label: "AAX" },
  M4A:  { bg: "#dcfce7", text: "#166534", label: "M4A" },
  WAV:  { bg: "#fce7f3", text: "#9d174d", label: "WAV" },
};

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 bg-white rounded-lg border border-border shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
        {value}
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────
function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BookMarked className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">
        {query ? `No results for "${query}"` : "Nothing here yet."}
      </p>
    </div>
  );
}

// ── Author Card ──────────────────────────────────────────────
function AuthorCard({ author, query }: { author: Author; query: string }) {
  const cat = getCategoryMeta(author.category);
  const Icon = ICON_MAP[cat.icon] ?? Briefcase;
  const driveUrl = `https://drive.google.com/drive/folders/${author.driveId}?view=grid`;

  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card-animate group bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 card-category-border overflow-hidden block cursor-pointer"
      style={{ borderLeftColor: cat.color }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: cat.color + "18" }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: cat.color }}
            >
              {author.category}
            </span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
        </div>
        <h3
          className="text-sm font-semibold leading-snug mb-1"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {highlight(author.displayName)}
        </h3>
        {author.specialty && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {highlight(author.specialty)}
          </p>
        )}
        {author.fileTypes && author.fileTypes.length > 0 && (
          <FileTypeIcons fileTypes={author.fileTypes} size={20} />
        )}
      </div>
    </a>
  );
}

// ── Book Card ────────────────────────────────────────────────
function BookCard({ book, query }: { book: Book; query: string }) {
  const cat = getCategoryMeta(book.category);
  const Icon = ICON_MAP[cat.icon] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.driveId}?view=grid`;

  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card-animate group bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 card-category-border overflow-hidden block cursor-pointer"
      style={{ borderLeftColor: cat.color }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: cat.color + "18" }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: cat.color }}
            >
              {book.category}
            </span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
        </div>
        <h3
          className="text-sm font-semibold leading-snug mb-1"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {highlight(book.displayTitle)}
        </h3>
        {book.authors && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium">by</span> {highlight(book.authors)}
          </p>
        )}
        {book.fileTypes && book.fileTypes.length > 0 && (
          <FileTypeIcons fileTypes={book.fileTypes} size={20} />
        )}
      </div>
    </a>
  );
}

// ── Audio Book Card ──────────────────────────────────────────
function AudioCard({ audio, query }: { audio: AudioBook; query: string }) {
  const driveUrl = `https://drive.google.com/drive/folders/${audio.id}?view=grid`;

  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const totalFiles = Object.values(audio.formats).reduce((sum, f) => sum + f.fileCount, 0);

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card-animate group bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden block cursor-pointer"
      style={{ borderLeftWidth: 3, borderLeftColor: "#7c3aed" }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#7c3aed18" }}>
              <Headphones className="w-3.5 h-3.5" style={{ color: "#7c3aed" }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7c3aed" }}>
              Audiobook
            </span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
        </div>

        <h3
          className="text-sm font-semibold leading-snug mb-1"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {highlight(audio.title)}
        </h3>
        {audio.bookAuthors && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            <span className="font-medium">by</span> {highlight(audio.bookAuthors)}
          </p>
        )}

        {/* Format badges with file counts */}
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
          {Object.entries(audio.formats).map(([fmt, info]) => {
            const colors = FORMAT_COLORS[fmt] ?? { bg: "#f3f4f6", text: "#374151", label: fmt };
            return (
              <a
                key={fmt}
                href={`https://drive.google.com/drive/folders/${info.folderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80 transition-opacity"
                style={{ backgroundColor: colors.bg, color: colors.text }}
                title={`Open ${fmt} folder in Drive`}
              >
                {colors.label}
                <span className="opacity-70">·{info.fileCount}</span>
              </a>
            );
          })}
          <span className="text-[10px] text-muted-foreground ml-auto self-center">
            {totalFiles} file{totalFiles !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </a>
  );
}

// ── Main Page ────────────────────────────────────────────────
type TabType = "authors" | "books" | "audio";

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("authors");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

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

  const filteredAuthors = useMemo(() => {
    const q = query.toLowerCase();
    return AUTHORS.filter((a) => {
      const matchesCat = selectedCategories.size === 0 || selectedCategories.has(a.category);
      const matchesQ =
        !q ||
        a.displayName.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [query, selectedCategories]);

  const filteredBooks = useMemo(() => {
    const q = query.toLowerCase();
    return BOOKS.filter((b) => {
      const matchesCat = selectedCategories.size === 0 || selectedCategories.has(b.category);
      const matchesQ =
        !q ||
        b.displayTitle.toLowerCase().includes(q) ||
        b.authors.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    }).sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  }, [query, selectedCategories]);

  const filteredAudio = useMemo(() => {
    const q = query.toLowerCase();
    return AUDIO_BOOKS.filter((a) => {
      const matchesQ =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.bookAuthors.toLowerCase().includes(q) ||
        Object.keys(a.formats).some((f) => f.toLowerCase().includes(q));
      return matchesQ;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [query]);

  // Per-category counts for sidebar badges
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
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        {/* ── Sidebar ── */}
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Library className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Norfolk CG</p>
                <p className="text-sm font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Knowledge Library
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-3">
            {/* View toggle */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeTab === "authors"}
                      onClick={() => { setActiveTab("authors"); setSelectedCategories(new Set()); }}
                      tooltip="Authors"
                    >
                      <Users className="w-4 h-4" />
                      <span>Authors</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {filteredAuthors.length}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeTab === "books"}
                      onClick={() => { setActiveTab("books"); setSelectedCategories(new Set()); }}
                      tooltip="Books"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Books</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {filteredBooks.length}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeTab === "audio"}
                      onClick={() => { setActiveTab("audio"); setSelectedCategories(new Set()); }}
                      tooltip="Books Audio"
                    >
                      <Headphones className="w-4 h-4" />
                      <span>Books Audio</span>
                      <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {filteredAudio.length}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <Separator className="my-2 group-data-[collapsible=icon]:hidden" />

            {/* Category filters (Authors & Books only) */}
            {showCategoryFilter && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 mb-1">
                  Filter by Category
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {CATEGORIES.map((cat) => {
                      const Icon = ICON_MAP[cat.icon] ?? Briefcase;
                      const count = activeTab === "authors"
                        ? (authorCounts[cat.name] ?? 0)
                        : (bookCounts[cat.name] ?? 0);
                      if (count === 0) return null;
                      const isActive = selectedCategories.has(cat.name);
                      return (
                        <SidebarMenuItem key={cat.name}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => toggleCategory(cat.name)}
                            className="h-auto py-1.5"
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? cat.color : undefined }} />
                            <span className="text-xs leading-tight flex-1 truncate">{cat.name}</span>
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: isActive ? cat.color + "20" : undefined,
                                color: isActive ? cat.color : undefined,
                              }}
                            >
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

            {/* Audio format legend */}
            {activeTab === "audio" && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2 mb-1">
                  Audio Formats
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  {Object.entries(FORMAT_COLORS).map(([fmt, colors]) => (
                    <div key={fmt} className="flex items-center gap-2 py-1">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {colors.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmt === "MP3" ? "Standard audio" : fmt === "M4B" ? "Chapters + bookmarks" : fmt === "AAX" ? "Audible DRM" : fmt === "M4A" ? "Apple audio" : "Lossless audio"}
                      </span>
                    </div>
                  ))}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="px-4 py-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] text-muted-foreground">
              Last updated {STATS.lastUpdated}
            </p>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main Content ── */}
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                NCG Library
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="capitalize">{activeTab === "audio" ? "Books Audio" : activeTab}</span>
              {selectedCategories.size > 0 && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{selectedCategories.size} filter{selectedCategories.size > 1 ? "s" : ""}</span>
                </>
              )}
            </div>

            {/* Search */}
            <div className="ml-auto relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={activeTab === "audio" ? "Search audiobooks, authors…" : "Search authors, books, topics…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-8 h-8 text-sm bg-white"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </header>

          {/* Body */}
          <main className="flex-1 px-6 py-6 overflow-auto">
            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3 mb-6">
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
                  const meta = getCategoryMeta(cat);
                  return (
                    <Badge
                      key={cat}
                      variant="secondary"
                      className="gap-1 text-xs"
                      style={{ borderColor: meta.color, color: meta.color, backgroundColor: meta.color + "12" }}
                    >
                      {cat}
                      <button onClick={() => toggleCategory(cat)}><X className="w-3 h-3" /></button>
                    </Badge>
                  );
                })}
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Section header */}
            <div className="flex items-baseline justify-between mb-4">
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {activeTab === "authors" ? "Authors" : activeTab === "books" ? "Books" : "Books Audio"}
              </h1>
              <span className="text-sm text-muted-foreground">
                {activeTab === "authors"
                  ? `${filteredAuthors.length} of ${STATS.totalAuthors}`
                  : activeTab === "books"
                  ? `${filteredBooks.length} of ${STATS.totalBooks}`
                  : `${filteredAudio.length} of ${AUDIO_BOOKS.length}`}
              </span>
            </div>

            {/* Card grid */}
            {activeTab === "authors" ? (
              filteredAuthors.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAuthors.map((a, i) => (
                    <div key={a.driveId + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <AuthorCard author={a} query={query} />
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === "books" ? (
              filteredBooks.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredBooks.map((b, i) => (
                    <div key={b.driveId + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <BookCard book={b} query={query} />
                    </div>
                  ))}
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
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
