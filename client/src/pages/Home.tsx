/**
 * Ricardo Cidale's Library — Home Page
 * Design: Editorial Intelligence — sidebar-07 layout + card grid
 * Fonts: Inter Tight (ExtraBold H1, SemiBold H2/H3, Regular body)
 * Palette: NCG Brand — Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B
 * Tabs: Authors | Books | Books Audio
 * Cards: Show book subfolders with content-type icons
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { fireConfetti } from "@/hooks/useConfetti";
import authorBios from "@/lib/authorBios.json";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AUTHORS,
  BOOKS,
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  type AuthorEntry,
  type BookRecord,
} from "@/lib/libraryData";
import { AUDIO_BOOKS, type AudioBook } from "@/lib/audioData";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import { useAppSettings, type ColorMode as AppTheme } from "@/contexts/AppSettingsContext";
import { CategoryChart } from "@/components/CategoryChart";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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
  ExternalLink,
  ChevronRight,
  Library,
  X,
  Headphones,
  FileText,
  File,
  AlignLeft,
  Video,
  Image,
  Package,
  Folder,
  Book,
  Scroll,
  Newspaper,
  Link,
  List,
  RefreshCw,
  CheckCircle2,
  ArrowUpDown,
  Globe,
  Twitter,
  Linkedin,
  ChevronDown,
  ChevronUp,
  Sparkles,
  UserCheck,
  AlertCircle,
  Star,
  BookMarked as BookMarkedIcon,
  ShoppingCart,
  Palette,
  Sun,
  Moon,
  Settings,
} from "lucide-react";

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
};

// ── Icon map for content types ───────────────────────────────
const CT_ICON_MAP: Record<string, React.ElementType> = {
  "file-text": FileText,
  "book": Book,
  "file": File,
  "align-left": AlignLeft,
  "headphones": Headphones,
  "video": Video,
  "image": Image,
  "package": Package,
  "scroll": Scroll,
  "newspaper": Newspaper,
  "link": Link,
  "list": List,
  "folder": Folder,
};

// ── Audio format color map ───────────────────────────────────
const FORMAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  MP3:  { bg: "#fef3c7", text: "#92400e", label: "MP3" },
  M4B:  { bg: "#dbeafe", text: "#1e40af", label: "M4B" },
  AAX:  { bg: "#f3e8ff", text: "#6b21a8", label: "AAX" },
  M4A:  { bg: "#dcfce7", text: "#166534", label: "M4A" },
};

const STATS = {
  totalAuthors: AUTHORS.length,
  totalBooks: BOOKS.length,
  totalCategories: 9,
  lastUpdated: "March 2026",
};

// Normalize raw content type names for display
const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC": "Supplemental",
  "PDF Extra": "PDF",
  "PDF Extra 2": "PDF",
  "PDF Extras": "PDF",
  "Complete Book in PDF": "PDF",
  "DOC": "Transcript",
  "ChatGPT": "Supplemental",
  "Sana AI": "Supplemental",
  "Notes": "Supplemental",
  "Knowledge Base": "Supplemental",
  "temp": "Supplemental",
  "Temp": "Supplemental",
  "TEMP": "Supplemental",
};

// Normalize content types for display — merge raw names into canonical types
function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// ── Content Type Badge ───────────────────────────────────────
function ContentTypeBadge({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const color = CONTENT_TYPE_COLORS[type] ?? "#9ca3af";
  const Icon = CT_ICON_MAP[iconName] ?? Folder;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: color + "18", color }}
      title={`${type}: ${count} file${count !== 1 ? "s" : ""}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {type}
      {count > 1 && <span className="opacity-60">·{count}</span>}
    </span>
  );
}

// ── Book Subfolder Row ───────────────────────────────────────
function BookSubfolderRow({ book }: { book: { name: string; id: string; contentTypes: Record<string, number> } }) {
  const hasContent = Object.keys(book.contentTypes).length > 0;
  return (
    <a
      href={`https://drive.google.com/drive/folders/${book.id}?view=grid`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group/book"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover/book:text-foreground transition-colors" />
        <span className="text-[11px] font-medium leading-tight text-foreground/80 group-hover/book:text-foreground transition-colors line-clamp-1 flex-1">
          {(() => {
            // Strip " - Author Name" suffix from book name if present
            const dashIdx = book.name.lastIndexOf(" - ");
            return dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
          })()}
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/book:opacity-60 transition-opacity flex-shrink-0" />
      </div>
      {hasContent && (
        <div className="flex flex-wrap gap-1 pl-4">
          {Object.entries(normalizeContentTypes(book.contentTypes)).map(([type, count]) => (
            <ContentTypeBadge key={type} type={type} count={count} />
          ))}
        </div>
      )}
    </a>
  );
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col gap-1 px-3 sm:px-5 py-3 sm:py-4 bg-card rounded-lg border border-border shadow-sm stat-card-3d">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl sm:text-2xl font-extrabold font-display tracking-tight stat-number">
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
function AuthorCard({ author, query, onBioClick, isEnriched, coverMap, onBookClick, dbPhotoMap }: { author: AuthorEntry; query: string; onBioClick: (a: AuthorEntry) => void; isEnriched?: boolean; coverMap?: Map<string, string>; onBookClick?: (bookId: string, titleKey: string) => void; dbPhotoMap?: Map<string, string> }) {
  const color = CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = ICON_MAP[iconName] ?? Briefcase;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;
  // Resolve canonical display name (handles aliases, suffix variants, misspellings)
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ") ? author.name.slice(author.name.indexOf(" - ") + 3) : "";

  // Look up author photo: DB-first (generated portraits) then static map fallback
  const photoUrl = dbPhotoMap?.get(displayName.toLowerCase()) ?? getAuthorPhoto(displayName);

  // Scale-up on hover + spring-back
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.06) translateZ(10px)`;
    el.style.boxShadow = "0 20px 60px -10px rgba(0,0,0,0.22), 0 8px 20px -4px rgba(0,0,0,0.12)";
    el.style.zIndex = "20";
  }, []);
  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1) translateZ(0px)";
    el.style.boxShadow = "";
    el.style.zIndex = "";
  }, []);

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const hasBooks = author.books && author.books.length > 0;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-animate group relative"
      style={{ transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease", willChange: "transform", transformStyle: "preserve-3d" }}
    >
    <div
      className="rounded-lg border border-border shadow-sm overflow-hidden relative bg-card h-full"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* Watermark illustration */}
      <div
        className="pointer-events-none absolute bottom-2 right-2 select-none"
        aria-hidden
      >
        <Icon
          style={{ width: 72, height: 72, color, opacity: 0.07 }}
          strokeWidth={1}
        />
      </div>

      {/* Card header — clickable to open bio modal */}
      <button
        onClick={() => onBioClick(author)}
        className="block w-full text-left p-4 pb-2 cursor-pointer relative z-10 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + "22" }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
              {author.category}
            </span>
          </div>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-black/10 transition-colors"
            title="Open in Google Drive"
          >
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
          </a>
        </div>
        {/* Author photo + name row */}
        <div className="flex items-center gap-2.5 mb-1">
          <AvatarUpload authorName={displayName} currentPhotoUrl={photoUrl} size={40}>
            {(url) =>
              url ? (
                <img
                  src={url}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-offset-1 flex-shrink-0"
                  style={{
                    '--tw-ring-color': color + '55',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease',
                    cursor: 'pointer',
                  } as React.CSSProperties}
                  loading="lazy"
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'scale(2) translateZ(0)';
                    el.style.boxShadow = `0 8px 24px -4px ${color}66`;
                    el.style.zIndex = '50';
                    el.style.position = 'relative';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'scale(1) translateZ(0)';
                    el.style.boxShadow = '';
                    el.style.zIndex = '';
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    backgroundColor: color + '22',
                    color,
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'scale(2) translateZ(0)';
                    el.style.boxShadow = `0 8px 24px -4px ${color}66`;
                    el.style.zIndex = '50';
                    el.style.position = 'relative';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'scale(1) translateZ(0)';
                    el.style.boxShadow = '';
                    el.style.zIndex = '';
                  }}
                >
                  {displayName.charAt(0)}
                </div>
              )
            }
          </AvatarUpload>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug tracking-tight">
              {highlight(displayName)}
            </h3>
            {specialty && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
                {highlight(specialty)}
              </p>
            )}
           </div>
        </div>
      </button>
      {/* Enrichment status indicator */}
      <div className="px-3 pb-2 relative z-10 pointer-events-none">
        <span className="text-[10px] font-medium flex items-center gap-1.5">
          {isEnriched ? (
            <>
              <UserCheck className="w-3 h-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Bio ready · click to view</span>
            </>
          ) : (
            <>
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Click to view bio &amp; links</span>
            </>
          )}
        </span>
      </div>
      {/* Book subfolders */}
      {hasBooks && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 mt-1 relative z-10">
          {/* Mini cover strip */}
          {coverMap && (
            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5 cover-strip-scroll">
              {author.books.map((book) => {
                const titleKey = book.name.includes(" - ")
                  ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
                  : book.name.trim();
                const coverUrl = coverMap.get(titleKey);
                return (
                  <Tooltip key={book.id} delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onBookClick ? onBookClick(book.id, titleKey) : window.open(`https://drive.google.com/drive/folders/${book.id}?view=grid`, "_blank"); }}
                        className="flex-shrink-0 group/cover cursor-pointer"
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={titleKey}
                            className="w-8 h-11 object-cover rounded shadow-sm ring-1 ring-border group-hover/cover:ring-2 transition-all duration-150"
                            style={{ '--tw-ring-color': color + '55' } as React.CSSProperties}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="w-8 h-11 rounded shadow-sm ring-1 ring-border flex items-center justify-center group-hover/cover:ring-2 transition-all duration-150"
                            style={{ backgroundColor: color + '18', '--tw-ring-color': color + '55' } as React.CSSProperties}
                          >
                            <BookOpen className="w-3.5 h-3.5" style={{ color, opacity: 0.7 }} />
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="p-0 bg-transparent border-0 shadow-none rounded-lg overflow-hidden"
                    >
                      <div className="flex flex-col items-center gap-1.5 p-2 bg-popover rounded-xl shadow-xl border border-border/60" style={{ backdropFilter: 'blur(8px)' }}>
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={titleKey}
                            className="w-[90px] h-[126px] object-cover rounded-md shadow-md"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="w-[90px] h-[126px] rounded-md shadow-md flex items-center justify-center"
                            style={{ backgroundColor: color + '22' }}
                          >
                            <BookOpen className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                          </div>
                        )}
                        <p className="text-[10px] font-medium text-popover-foreground text-center max-w-[90px] leading-tight line-clamp-2">{titleKey}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 px-2">
            Books ({author.books.length})
          </p>
          <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {author.books.map((book) => (
              <BookSubfolderRow key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}// ── Book Card ──────────────────────────────────────────────
function BookCard({ book, query, onDetailClick, coverImageUrl, isEnriched, amazonUrl }: { book: BookRecord; query: string; onDetailClick?: (b: BookRecord) => void; coverImageUrl?: string; isEnriched?: boolean; amazonUrl?: string }) {
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  // Extract title and author from book name (format: "Title - Author Name")
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";

  // Scale-up on hover + spring-back
  const bookCardRef = useRef<HTMLDivElement>(null);
  const handleBookMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = bookCardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.06) translateZ(10px)`;
    el.style.boxShadow = "0 20px 60px -10px rgba(0,0,0,0.22), 0 8px 20px -4px rgba(0,0,0,0.12)";
    el.style.zIndex = "20";
  }, []);
  const handleBookMouseLeave = useCallback(() => {
    const el = bookCardRef.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1) translateZ(0px)";
    el.style.boxShadow = "";
    el.style.zIndex = "";
  }, []);

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const hasContent = Object.keys(book.contentTypes).length > 0;
  return (
    <div
      ref={bookCardRef}
      onMouseMove={handleBookMouseMove}
      onMouseLeave={handleBookMouseLeave}
      className="card-animate group relative cursor-pointer"
      style={{ transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease", willChange: "transform", transformStyle: "preserve-3d" }}
      onClick={() => onDetailClick?.(book)}
    >
    <div
      className="rounded-lg border border-border shadow-sm overflow-hidden relative bg-card h-full"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      {/* Watermark (only when no cover) */}
      {!coverImageUrl && (
        <div className="pointer-events-none absolute bottom-2 right-2 select-none watermark-icon" aria-hidden>
          <Icon className="w-[72px] h-[72px]" style={{ color, opacity: 0.07 }} strokeWidth={1} />
        </div>
      )}
      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "22" }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
              {book.category}
            </span>
          </div>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Open in Drive"
          >
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
        </div>

        {/* Cover + title row */}
        <div className="flex items-start gap-3 mb-2">
          {coverImageUrl && (
            <div className="cover-zoom-wrap flex-shrink-0 w-12 h-16">
              <img
                src={coverImageUrl}
                alt={displayTitle}
                className="w-12 h-16 object-cover rounded shadow-sm ring-1 ring-border"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug mb-0.5 tracking-tight">
              {highlight(displayTitle)}
            </h3>
            {bookAuthor && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">by</span> {highlight(bookAuthor)}
              </p>
            )}
          </div>
        </div>

        {/* Enrichment status */}
        <div className="mb-1">
          <span className="text-[10px] font-medium flex items-center gap-1.5">
            {isEnriched ? (
              <>
                <BookMarkedIcon className="w-3 h-3 text-teal-500" />
                <span className="text-teal-600 dark:text-teal-400">Cover ready · click for details</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Click for details</span>
              </>
            )}
          </span>
        </div>

        {hasContent && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
            {Object.entries(book.contentTypes).map(([type, count]) => (
              <ContentTypeBadge key={type} type={type} count={count} />
            ))}
          </div>
        )}

        {/* Amazon badge */}
        {amazonUrl && (
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="amazon-badge absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide text-white"
            style={{ backgroundColor: "#FF9900" }}
            title="View on Amazon"
          >
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.047-.872-1.234-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.66C6.265 1.862 9.316.5 12.073.5c1.407 0 3.245.374 4.354 1.44 1.407 1.312 1.273 3.063 1.273 4.969v4.5c0 1.353.561 1.948 1.089 2.678.186.261.226.574-.009.769l-1.636 1.939z"/>
            </svg>
            Amazon
          </a>
        )}
      </div>
    </div>
    </div>
  );
}
// ── Audio Book Card ──────────────────────────────────────────────
function AudioCard({ audio, query }: { audio: AudioBook; query: string }) {
  const driveUrl = `https://drive.google.com/drive/folders/${audio.id}?view=grid`;

  // Scale-up on hover + spring-back
  const audioCardRef = useRef<HTMLDivElement>(null);
  const handleAudioMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioCardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.06) translateZ(10px)`;
    el.style.boxShadow = "0 20px 60px -10px rgba(0,0,0,0.22), 0 8px 20px -4px rgba(0,0,0,0.12)";
    el.style.zIndex = "20";
  }, []);
  const handleAudioMouseLeave = useCallback(() => {
    const el = audioCardRef.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1) translateZ(0px)";
    el.style.boxShadow = "";
    el.style.zIndex = "";
  }, []);

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
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
    <div
      ref={audioCardRef}
      onMouseMove={handleAudioMouseMove}
      onMouseLeave={handleAudioMouseLeave}
      className="card-animate group relative"
      style={{ transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease", willChange: "transform", transformStyle: "preserve-3d" }}
    >
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-border shadow-sm overflow-hidden block cursor-pointer relative bg-card border-l-[3px] border-l-primary h-full"
    >
      {/* Watermark */}
      <div className="pointer-events-none absolute bottom-2 right-2 select-none watermark-icon" aria-hidden>
        <Headphones className="w-[72px] h-[72px] text-primary opacity-[0.07]" strokeWidth={1} />
      </div>

      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
              <Headphones className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Audiobook
            </span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
        </div>

        <h3 className="text-sm font-semibold leading-snug mb-1 tracking-tight">
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
            const colors = FORMAT_COLORS[fmt] ?? { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", label: fmt };
            return (
              <a
                key={fmt}
                href={`https://drive.google.com/drive/folders/${info.folderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80 transition-opacity"
                style={{ backgroundColor: colors.bg, color: colors.text }}
                title={`Open ${fmt} folder in Drive`}
                onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}

// ── Author Bio Modal ──────────────────────────────────────
function AuthorBioPanel({ author, onClose }: { author: typeof AUTHORS[number]; onClose: () => void }) {
  // Resolve canonical display name (handles aliases, suffix variants, misspellings)
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ") ? author.name.slice(author.name.indexOf(" - ") + 3) : "";
  const photoUrl = getAuthorPhoto(displayName);
  const color = CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))";
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  // Check JSON bios first (rich bios from Claude Code research)
  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  // Fetch bio from DB only if not in JSON
  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { enabled: !jsonBio }
  );
  const enrichMutation = trpc.authorProfiles.enrich.useMutation({
    onSuccess: () => { /* profile will auto-refresh */ },
    onError: (e) => toast.error("Failed to load bio: " + e.message),
  });

  const [generatedPhotoUrl, setGeneratedPhotoUrl] = useState<string | null>(null);
  const generatePortraitMutation = trpc.authorProfiles.generatePortrait.useMutation({
    onSuccess: (data) => {
      setGeneratedPhotoUrl(data.url);
      toast.success("AI portrait generated and saved!");
      fireConfetti("portrait");
    },
    onError: (e) => toast.error("Portrait generation failed: " + e.message),
  });

  // Auto-trigger DB enrichment only if no JSON bio and no DB profile
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ authorName: displayName });
    }
  }, [jsonBio, isLoading, profile]);

  const effectivePhotoUrl = generatedPhotoUrl ?? photoUrl;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-center gap-4 mb-1">
          <div className="relative group/avatar">
            <AvatarUpload authorName={displayName} currentPhotoUrl={effectivePhotoUrl} size={80}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2 author-avatar-3d"
                    style={{ '--tw-ring-color': color + '66' } as React.CSSProperties}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ backgroundColor: color + '22', color }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>
            {/* Generate Portrait button — shown when no real photo exists */}
            {!effectivePhotoUrl && (
              <button
                onClick={() => generatePortraitMutation.mutate({ authorName: displayName })}
                disabled={generatePortraitMutation.isPending}
                title="Generate AI portrait"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
              >
                {generatePortraitMutation.isPending
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3 sparkle-spin" style={{ color }} />}
              </button>
            )}
          </div> {/* end relative wrapper */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '22', color }}>{author.category}</span>
            </div>
            <DialogTitle className="text-xl font-bold font-display leading-snug">{displayName}</DialogTitle>
            {specialty && <DialogDescription className="text-sm mt-0.5">{specialty}</DialogDescription>}
          </div>
        </div>
      </DialogHeader>

      {/* Bio */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {jsonBio ? (
          <p className="text-sm leading-relaxed text-foreground/80">{jsonBio}</p>
        ) : isLoading || enrichMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading bio…
          </div>
        ) : profile?.bio ? (
          <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No bio available.</p>
        )}
      </div>

      {/* Links */}
      {profile && (profile.websiteUrl || profile.twitterUrl || profile.linkedinUrl) && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</h4>
          <div className="flex flex-col gap-1.5">
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Globe className="w-3.5 h-3.5" />
                {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            )}
            {profile.twitterUrl && (
              <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Twitter className="w-3.5 h-3.5" />
                {profile.twitterUrl.replace(/^https?:\/\/(www\.)?twitter\.com\//, "@")}
              </a>
            )}
            {profile.linkedinUrl && (
              <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Linkedin className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            )}
          </div>
        </div>
      )}

      {/* Books */}
      {author.books.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Books in Library ({author.books.length})</h4>
          <div className="flex flex-col gap-1.5">
            {author.books.map((book) => (
              <a
                key={book.id}
                href={`https://drive.google.com/drive/folders/${book.id}?view=grid`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
              >
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                <span className="flex-1 leading-snug">{book.name.split(" - ")[0]}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Drive link */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in Google Drive
      </a>
    </div>
  );
}

// ── Book Detail Modal ─────────────────────────────────────────
function BookDetailPanel({ book, onClose }: { book: typeof BOOKS[number]; onClose: () => void }) {
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const totalItems = Object.values(book.contentTypes).reduce((s, n) => s + n, 0);

  // Fetch enriched profile from DB
  const { data: profile, isLoading, refetch: refetchProfile } = trpc.bookProfiles.get.useQuery({ bookTitle: displayTitle });
  const enrichMutation = trpc.bookProfiles.enrich.useMutation({
    onError: (e) => toast.error("Failed to load book info: " + e.message),
  });

  // Auto-trigger enrichment if no profile exists
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ bookTitle: displayTitle, authorName: bookAuthor });
    }
  }, [isLoading, profile]);

  const isLoadingProfile = isLoading || enrichMutation.isPending;

  // Apify Amazon scrape mutation — optimistic cover preview
  const [scrapedCoverUrl, setScrapedCoverUrl] = useState<string | null>(null);
  const [scrapedAsin, setScrapedAsin] = useState<string | null>(null);
  const utilsInner = trpc.useUtils();
  const scrapeMutation = trpc.apify.scrapeBook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Show cover immediately without waiting for DB refetch
        if (data.coverUrl) setScrapedCoverUrl(data.coverUrl);
        if (data.asin) setScrapedAsin(data.asin);
        toast.success(`Found on Amazon: ${data.matchedTitle ?? displayTitle}`);
        fireConfetti("scrape");
        refetchProfile();
        // Invalidate bookCovers so author card strips update too
        void utilsInner.bookProfiles.getMany.invalidate();
      } else {
        toast.error("Amazon scrape: " + ((data as { message?: string }).message ?? "No results found"));
      }
    },
    onError: (e) => toast.error("Amazon scrape failed: " + e.message),
  });
  // Effective cover: scraped > DB profile > null
  const effectiveCoverUrl = scrapedCoverUrl ?? profile?.coverImageUrl ?? null;
  // ASIN from scrape result only (not in DB schema)
  const displayAsin = scrapedAsin;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-start gap-4 mb-1">
          {/* Book cover */}
          <div className="flex-shrink-0 relative">
            {effectiveCoverUrl ? (
              <img
                src={effectiveCoverUrl}
                alt={displayTitle}
                className="w-20 h-28 object-cover rounded-md shadow-md ring-1 ring-border book-cover-3d"
                loading="lazy"
              />
            ) : (
              <div
                className="w-20 h-28 rounded-md flex items-center justify-center shadow-md ring-1 ring-border"
                style={{ backgroundColor: color + "18" }}
              >
                {isLoadingProfile || scrapeMutation.isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color }} />
                ) : (
                  <Icon className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                )}
              </div>
            )}
            {/* ASIN badge shown after successful scrape */}
            {displayAsin && (
              <span className="absolute -bottom-1 -right-1 text-[9px] bg-background border border-border rounded px-1 py-0.5 font-mono opacity-70">
                {displayAsin}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{book.category}</span>
            </div>
            <DialogTitle className="text-lg font-bold font-display leading-snug">{displayTitle}</DialogTitle>
            {bookAuthor && <DialogDescription className="text-sm mt-0.5">by {bookAuthor}</DialogDescription>}
            {/* Rating */}
            {profile?.rating && (
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{profile.rating}</span>
                {profile.ratingCount && (
                  <span className="text-xs text-muted-foreground">({profile.ratingCount} ratings)</span>
                )}
              </div>
            )}
            {/* Publication info */}
            {(profile?.publishedDate || profile?.publisher) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[profile.publisher, profile.publishedDate?.slice(0, 4)].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </DialogHeader>

      {/* Summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {isLoadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading book info…
          </div>
        ) : profile?.summary ? (
          <p className="text-sm leading-relaxed text-foreground/80">{profile.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary available.</p>
        )}
      </div>

      {/* Key themes */}
      {profile?.keyThemes && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Themes</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.keyThemes.split(",").map((t) => t.trim()).filter(Boolean).map((theme) => (
              <span key={theme} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: color + "18", color }}>
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* External links + Amazon scrape */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Find This Book</h4>
          <button
            onClick={() => scrapeMutation.mutate({ title: displayTitle, author: bookAuthor })}
            disabled={scrapeMutation.isPending}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            title="Scrape Amazon for cover image and buy link"
          >
            {scrapeMutation.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <ShoppingCart className="w-3 h-3" />
            )}
            {scrapeMutation.isPending ? "Searching..." : "Scrape Amazon"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {profile?.amazonUrl && (
            <a href={profile.amazonUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ShoppingCart className="w-3.5 h-3.5" />
              Buy on Amazon
            </a>
          )}
          {profile?.goodreadsUrl && (
            <a href={profile.goodreadsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <BookMarkedIcon className="w-3.5 h-3.5" />
              Search on Goodreads
            </a>
          )}
          {profile?.resourceUrl && (
            <a href={profile.resourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Globe className="w-3.5 h-3.5" />
              {profile.resourceLabel || "More Info"}
            </a>
          )}
          {!profile?.amazonUrl && !profile?.goodreadsUrl && !profile?.resourceUrl && !scrapeMutation.isPending && (
            <p className="text-xs text-muted-foreground">Click "Scrape Amazon" to find purchase links and cover art.</p>
          )}
        </div>
      </div>

      {/* Library content */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In Your Library ({totalItems} files)</h4>
        <div className="flex flex-col gap-1.5">
          {Object.entries(book.contentTypes).map(([type, count]) => {
            const iconKey = CONTENT_TYPE_ICONS[type] ?? "file";
            const CtIcon = CT_ICON_MAP[iconKey] ?? File;
            const ctColor = CONTENT_TYPE_COLORS[type] ?? null;
            const subfolderUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
            return (
              <a
                key={type}
                href={subfolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${!ctColor ? "bg-muted" : ""}`}
                  style={ctColor ? { backgroundColor: ctColor + "18" } : undefined}
                >
                  <CtIcon
                    className={`w-3.5 h-3.5 ${!ctColor ? "text-muted-foreground" : ""}`}
                    style={ctColor ? { color: ctColor } : undefined}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{type}</p>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{count} file{count !== 1 ? "s" : ""}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Open in Drive */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in Google Drive
      </a>
    </div>
  );
}

// ── Sort options ─────────────────────────────────────────────
type AuthorSort = "name-asc" | "name-desc" | "books-desc" | "category";
type BookSort = "name-asc" | "name-desc" | "author" | "content-desc";

// ── Main Page ────────────────────────────────────────────────
type TabType = "authors" | "books" | "audio";

export default function Home() {
  const { settings: { colorMode: appTheme } } = useAppSettings();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("authors");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [authorSort, setAuthorSort] = useState<AuthorSort>("name-asc");
  const [bookSort, setBookSort] = useState<BookSort>("name-asc");
  // Author bio panel state
  const [selectedAuthor, setSelectedAuthor] = useState<typeof AUTHORS[number] | null>(null);
  const [bioSheetOpen, setBioSheetOpen] = useState(false);
  // Book detail panel state
  const [selectedBook, setSelectedBook] = useState<typeof BOOKS[number] | null>(null);
  const [bookSheetOpen, setBookSheetOpen] = useState(false);

  // ── Batch enrich bios state ──────────────────────────────────
  type EnrichStatus = "idle" | "running" | "done" | "error";
  const [enrichStatus, setEnrichStatus] = useState<EnrichStatus>("idle");
  const [enrichProgress, setEnrichProgress] = useState(0); // 0–100
  const [enrichDone, setEnrichDone] = useState(0);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [enrichFailed, setEnrichFailed] = useState(0);
  const enrichBatchMutation = trpc.authorProfiles.enrichBatch.useMutation();
  // Fetch all enriched author names for indicators — refetch after batch completes
  const enrichedNamesQuery = trpc.authorProfiles.getAllEnrichedNames.useQuery(undefined, {
    staleTime: 60_000, // cache for 1 minute
  });
  const enrichedSet = useMemo(
    () => new Set(enrichedNamesQuery.data ?? []),
    [enrichedNamesQuery.data]
  );

  // Fetch all enriched book titles for indicators
  const enrichedTitlesQuery = trpc.bookProfiles.getAllEnrichedTitles.useQuery(undefined, {
    staleTime: 60_000,
  });
  const enrichedTitlesSet = useMemo(
    () => new Set(enrichedTitlesQuery.data ?? []),
    [enrichedTitlesQuery.data]
  );

  // Fetch all book cover URLs for card display
  const allBookTitles = useMemo(() => {
    return Array.from(new Set(BOOKS.map((b) => b.name.split(" - ")[0].trim())));
  }, []);
  const bookCoversQuery = trpc.bookProfiles.getMany.useQuery(
    { bookTitles: allBookTitles },
    { staleTime: 60_000 }
  );
  const bookCoverMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      // Prefer S3-mirrored URL (stable CDN) over external URL (may block hotlinking)
      const url = (p as { s3CoverUrl?: string | null }).s3CoverUrl || p.coverImageUrl;
      if (url) map.set(p.bookTitle, url);
    }
    return map;
  }, [bookCoversQuery.data]);
  // Amazon URL map: bookTitle → amazonUrl (built from same bookCoversQuery, no extra request)
  const amazonUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of bookCoversQuery.data ?? []) {
      if (p.amazonUrl) map.set(p.bookTitle, p.amazonUrl);
    }
    return map;
  }, [bookCoversQuery.data]);
  // Lookup map: book.id → BookRecord (for cover thumbnail click → detail dialog)
  const booksByIdMap = useMemo(() => {
    const map = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) map.set(b.id, b);
    return map;
  }, []);

  // DB-first author photo fallback: generated portraits (Replicate) appear on cards
  const authorPhotoMapQuery = trpc.authorProfiles.getPhotoMap.useQuery(
    undefined,
    { staleTime: 60_000 }
  );
  const dbPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of authorPhotoMapQuery.data ?? []) {
      if (r.photoUrl) map.set(r.authorName.toLowerCase(), r.photoUrl);
    }
    return map;
  }, [authorPhotoMapQuery.data]);

  // ── Book enrich state ────────────────────────────────────────────
  const [bookEnrichStatus, setBookEnrichStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [bookEnrichProgress, setBookEnrichProgress] = useState(0);
  const [bookEnrichDone, setBookEnrichDone] = useState(0);
  const [bookEnrichTotal, setBookEnrichTotal] = useState(0);
  const [bookEnrichFailed, setBookEnrichFailed] = useState(0);
  const bookEnrichBatchMutation = trpc.bookProfiles.enrichBatch.useMutation();
  const utils = trpc.useUtils();

  // ── Batch portrait generation state ─────────────────────────────────────
  const [portraitStatus, setPortraitStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [portraitProgress, setPortraitProgress] = useState(0);
  const [portraitDone, setPortraitDone] = useState(0);
  const [portraitTotal, setPortraitTotal] = useState(0);
  const [portraitFailed, setPortraitFailed] = useState(0);
  const [portraitCurrent, setPortraitCurrent] = useState<string | null>(null);
  const generatePortraitMutationBatch = trpc.authorProfiles.generatePortrait.useMutation();
  const enrichAllBios= useCallback(async () => {
    if (enrichStatus === "running") return;
    // Build unique author names from the library data
    const names = Array.from(
      new Set(
        AUTHORS.map((a) => {
          const d = a.name.indexOf(" - ");
          return d !== -1 ? a.name.slice(0, d) : a.name;
        })
      )
    );
    const BATCH_SIZE = 10;
    setEnrichStatus("running");
    setEnrichProgress(0);
    setEnrichDone(0);
    setEnrichFailed(0);
    setEnrichTotal(names.length);
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < names.length; i += BATCH_SIZE) {
        const batch = names.slice(i, i + BATCH_SIZE);
        const result = await enrichBatchMutation.mutateAsync({ authorNames: batch });
        done += result.succeeded;
        failed += result.total - result.succeeded;
        setEnrichDone(done);
        setEnrichFailed(failed);
        setEnrichProgress(Math.round(((i + batch.length) / names.length) * 100));
      }
      setEnrichStatus("done");
      toast.success(`Enriched ${done} author bios${failed > 0 ? ` (${failed} failed)` : ""}.`);
      if (done > 0) fireConfetti("enrich");
      // Refresh the enrichment indicators
      void utils.authorProfiles.getAllEnrichedNames.invalidate();
    } catch (err) {
      setEnrichStatus("error");
      toast.error("Bio enrichment failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [enrichStatus, enrichBatchMutation, utils]);

  const enrichAllBooks = useCallback(async () => {
    if (bookEnrichStatus === "running") return;
    const titles = Array.from(
      new Set(BOOKS.map((b) => {
        const d = b.name.indexOf(" - ");
        return d !== -1 ? b.name.slice(0, d) : b.name;
      }))
    );
    const BATCH_SIZE = 10;
    setBookEnrichStatus("running");
    setBookEnrichProgress(0);
    setBookEnrichDone(0);
    setBookEnrichFailed(0);
    setBookEnrichTotal(titles.length);
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < titles.length; i += BATCH_SIZE) {
        const batch = titles.slice(i, i + BATCH_SIZE).map((bookTitle) => {
          const book = BOOKS.find((b) => b.name.startsWith(bookTitle));
          const authorName = book?.name.includes(" - ") ? book.name.split(" - ").slice(1).join(" - ") : "";
          return { bookTitle, authorName };
        });
        const result = await bookEnrichBatchMutation.mutateAsync(batch);
        const succeeded = result.filter((r) => r.status === "enriched").length;
        const batchFailed = result.filter((r) => r.status === "error").length;
        done += succeeded;
        failed += batchFailed;
        setBookEnrichDone(done);
        setBookEnrichFailed(failed);
        setBookEnrichProgress(Math.round(((i + batch.length) / titles.length) * 100));
      }
      setBookEnrichStatus("done");
      toast.success(`Enriched ${done} book profiles${failed > 0 ? ` (${failed} failed)` : ""}.`);
      if (done > 0) fireConfetti("enrich");
      void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      void utils.bookProfiles.getMany.invalidate();
    } catch (err) {
      setBookEnrichStatus("error");
      toast.error("Book enrichment failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [bookEnrichStatus, bookEnrichBatchMutation, utils]);

  // ── Generate AI portraits for all authors missing one ───────────────────────
  const generateAllPortraits = useCallback(async () => {
    if (portraitStatus === "running") return;

    // Collect unique canonical author names that have no photo in the static map
    const allNames = Array.from(
      new Set(
        AUTHORS.map((a) => {
          const d = a.name.indexOf(" - ");
          return d !== -1 ? a.name.slice(0, d) : a.name;
        })
      )
    );
    // Filter to only those without a photo in the static map
    const missing = allNames.filter((name) => !getAuthorPhoto(name));

    if (missing.length === 0) {
      toast.success("All authors already have portraits!");
      return;
    }

    setPortraitStatus("running");
    setPortraitProgress(0);
    setPortraitDone(0);
    setPortraitFailed(0);
    setPortraitTotal(missing.length);
    setPortraitCurrent(null);

    let done = 0;
    let failed = 0;

    try {
      for (let i = 0; i < missing.length; i++) {
        const authorName = missing[i];
        setPortraitCurrent(authorName);
        try {
          await generatePortraitMutationBatch.mutateAsync({ authorName });
          done++;
        } catch {
          failed++;
        }
        setPortraitDone(done);
        setPortraitFailed(failed);
        setPortraitProgress(Math.round(((i + 1) / missing.length) * 100));
        // 2s delay between requests to respect Replicate rate limits
        if (i < missing.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      setPortraitCurrent(null);
      setPortraitStatus("done");
      toast.success(
        `Generated ${done} portrait${done !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}.`
      );
      if (done > 0) fireConfetti("batch");
    } catch (err) {
      setPortraitStatus("error");
      setPortraitCurrent(null);
      toast.error("Portrait generation failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [portraitStatus, generatePortraitMutationBatch]);

  const regenerate = trpc.library.regenerate.useMutation({
    onSuccess: (data) => {
      if (data.success && data.stats) {
        setLastSynced(new Date());
        toast.success(
          `Library rebuilt — ${data.stats.authors} authors, ${data.stats.books} books, ${data.stats.audioBooks} audiobooks (${data.stats.elapsedSeconds}s). Reload to see changes.`,
          { duration: 8000 }
        );
      } else {
        toast.error(`Regeneration failed: ${(data as { error?: string }).error ?? "Unknown error"}`);
      }
    },
    onError: (err) => {
      toast.error(`Regeneration error: ${err.message}`);
    },
  });

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
    // Deduplicate authors by base name (before " - "), merging all book lists
    const seen = new Map<string, typeof AUTHORS[number]>();
    const booksSeen = new Map<string, Set<string>>(); // track book IDs per author
    for (const a of AUTHORS) {
      const baseName = canonicalName(a.name).toLowerCase();
      const existing = seen.get(baseName);
      if (!existing) {
        seen.set(baseName, { ...a, books: [...a.books] });
        booksSeen.set(baseName, new Set(a.books.map((b) => b.id)));
      } else {
        // Merge books from this duplicate entry, avoiding duplicates by ID
        const seenIds = booksSeen.get(baseName)!;
        for (const book of a.books) {
          if (!seenIds.has(book.id)) {
            existing.books.push(book);
            seenIds.add(book.id);
          }
        }
        // Keep the entry with the longer specialty description
        const existingSpecialty = existing.name.includes(" - ") ? existing.name.split(" - ").slice(1).join(" - ") : "";
        const newSpecialty = a.name.includes(" - ") ? a.name.split(" - ").slice(1).join(" - ") : "";
        if (newSpecialty.length > existingSpecialty.length) {
          existing.name = a.name;
          existing.id = a.id;
          existing.category = a.category;
        }
      }
    }
    // Second pass: deduplicate books within each author by title
    // (same book may appear as "Title" and "Title - Author" with different Drive IDs)
    for (const author of Array.from(seen.values())) {
      const bookByTitle = new Map<string, typeof author.books[number]>();
      for (const book of author.books) {
        const titleKey = book.name.split(" - ")[0].trim().toLowerCase();
        const existing = bookByTitle.get(titleKey);
        if (!existing) {
          bookByTitle.set(titleKey, book);
        } else {
          // Prefer the entry with more content types; tie-break: prefer "Title - Author" format
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
      const matchesQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.books.some((b) => b.name.toLowerCase().includes(q));
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
    // Deduplicate books: prefer "Title - Author" format over plain "Title"
    const seen = new Map<string, typeof BOOKS[number]>();
    for (const b of BOOKS) {
      const titleKey = b.name.split(" - ")[0].trim().toLowerCase();
      const existing = seen.get(titleKey);
      if (!existing) {
        seen.set(titleKey, b);
      } else {
        // Prefer the entry with more content types or with author suffix
        const hasAuthor = b.name.includes(" - ");
        const existingHasAuthor = existing.name.includes(" - ");
        if (hasAuthor && !existingHasAuthor) seen.set(titleKey, b);
        else if (Object.keys(b.contentTypes).length > Object.keys(existing.contentTypes).length) {
          seen.set(titleKey, b);
        }
      }
    }
    const deduped = Array.from(seen.values());
    return deduped.filter((b) => {
      const matchesCat = selectedCategories.size === 0 || selectedCategories.has(b.category);
      const matchesQ =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
     }).sort((a, b) => {
      switch (bookSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "author": {
          const aAuthor = a.name.includes(" - ") ? a.name.split(" - ").slice(1).join(" - ") : "";
          const bAuthor = b.name.includes(" - ") ? b.name.split(" - ").slice(1).join(" - ") : "";
          return aAuthor.localeCompare(bAuthor) || a.name.localeCompare(b.name);
        }
        case "content-desc": return Object.keys(b.contentTypes).length - Object.keys(a.contentTypes).length;
        default: return a.name.localeCompare(b.name);
      }
    });
  }, [query, selectedCategories, bookSort]);
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
    <>
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full overflow-hidden">
        {/* ── Sidebar ── */}
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
                      const color = CATEGORY_COLORS[cat] ?? "hsl(var(--muted-foreground))";
                      const iconName = CATEGORY_ICONS[cat] ?? "briefcase";
                      const Icon = ICON_MAP[iconName] ?? Briefcase;
                      const count = activeTab === "authors"
                        ? (authorCounts[cat] ?? 0)
                        : (bookCounts[cat] ?? 0);
                      if (count === 0) return null;
                      const isActive = selectedCategories.has(cat);
                      return (
                        <SidebarMenuItem key={cat}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => toggleCategory(cat)}
                            className="h-auto py-1.5"
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActive ? color : undefined }} />
                            <span className="text-xs leading-tight flex-1 truncate">{cat}</span>
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: isActive ? color + "20" : undefined,
                                color: isActive ? color : undefined,
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
                        {fmt === "MP3" ? "Standard audio" : fmt === "M4B" ? "Chapters + bookmarks" : fmt === "AAX" ? "Audible DRM" : "Apple audio"}
                      </span>
                    </div>
                  ))}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="px-4 py-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] text-muted-foreground mb-2">
              {lastSynced
                ? `Last synced ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${lastSynced.toLocaleDateString([], { month: "short", day: "numeric" })}`
                : `Data as of ${STATS.lastUpdated}`
              }
            </p>
            <button
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending || enrichStatus === "running"}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Re-scan Google Drive and rebuild the library data"
            >
              {regenerate.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : regenerate.isSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {regenerate.isPending ? "Scanning Drive…" : "Regenerate Database"}
            </button>

            {/* Enrich All Bios button */}
            <button
              onClick={enrichAllBios}
              disabled={enrichStatus === "running" || regenerate.isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1.5"
              title="Generate AI bios and links for all authors"
            >
              {enrichStatus === "running" ? (
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              ) : enrichStatus === "done" ? (
                <UserCheck className="w-3.5 h-3.5 text-green-600" />
              ) : enrichStatus === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {enrichStatus === "running"
                ? `Enriching… ${enrichDone}/${enrichTotal}`
                : enrichStatus === "done"
                ? `Bios enriched (${enrichDone})`
                : enrichStatus === "error"
                ? "Enrichment failed — retry"
                : "Enrich All Bios"}
            </button>

            {/* Progress bar — only visible while running */}
            {enrichStatus === "running" && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{enrichDone} of {enrichTotal} authors</span>
                  <span>{enrichProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full progress-shimmer"
                    style={{ width: `${enrichProgress}%` }}
                  />
                </div>
                {enrichFailed > 0 && (
                  <p className="text-[10px] text-red-500 mt-1">{enrichFailed} failed</p>
                )}
              </div>
            )}

            {/* Done summary */}
            {enrichStatus === "done" && enrichFailed > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{enrichFailed} authors could not be enriched.</p>
            )}

            {/* Enrich All Books button */}
            <button
              onClick={enrichAllBooks}
              disabled={bookEnrichStatus === "running" || regenerate.isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1.5"
              title="Fetch book covers, summaries, and links for all books"
            >
              {bookEnrichStatus === "running" ? (
                <BookOpen className="w-3.5 h-3.5 animate-pulse" />
              ) : bookEnrichStatus === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : bookEnrichStatus === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <BookOpen className="w-3.5 h-3.5" />
              )}
              {bookEnrichStatus === "running"
                ? `Enriching… ${bookEnrichDone}/${bookEnrichTotal}`
                : bookEnrichStatus === "done"
                ? `Books enriched (${bookEnrichDone})`
                : bookEnrichStatus === "error"
                ? "Enrichment failed — retry"
                : "Enrich All Books"}
            </button>

            {/* Book enrichment progress bar */}
            {bookEnrichStatus === "running" && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{bookEnrichDone} of {bookEnrichTotal} books</span>
                  <span>{bookEnrichProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full progress-shimmer"
                    style={{ width: `${bookEnrichProgress}%` }}
                  />
                </div>
                {bookEnrichFailed > 0 && (
                  <p className="text-[10px] text-red-500 mt-1">{bookEnrichFailed} failed</p>
                )}
              </div>
            )}

            {bookEnrichStatus === "done" && bookEnrichFailed > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{bookEnrichFailed} books could not be enriched.</p>
            )}

            {/* Generate Missing Portraits button */}
            <button
              onClick={generateAllPortraits}
              disabled={portraitStatus === "running" || regenerate.isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1.5"
              title="Generate AI portraits for authors without a headshot"
            >
              {portraitStatus === "running" ? (
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              ) : portraitStatus === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              ) : portraitStatus === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {portraitStatus === "running"
                ? `Generating… ${portraitDone}/${portraitTotal}`
                : portraitStatus === "done"
                ? `Portraits done (${portraitDone})`
                : portraitStatus === "error"
                ? "Generation failed — retry"
                : "Generate Missing Portraits"}
            </button>

            {/* Portrait generation progress bar */}
            {portraitStatus === "running" && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span className="truncate max-w-[140px]">{portraitCurrent ?? "Starting…"}</span>
                  <span className="flex-shrink-0 ml-1">{portraitProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full progress-shimmer"
                    style={{ width: `${portraitProgress}%` }}
                  />
                </div>
                {portraitFailed > 0 && (
                  <p className="text-[10px] text-red-500 mt-1">{portraitFailed} failed</p>
                )}
              </div>
            )}

            {portraitStatus === "done" && portraitFailed > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{portraitFailed} portraits could not be generated.</p>
            )}

            {/* ── Preferences link ── */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <a
                href="/preferences"
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                Preferences
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </a>
            </div>

            {/* Drive Media Folders */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Media Folders</p>
              <div className="flex flex-col gap-1">
                <a
                  href="https://drive.google.com/drive/folders/1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60"
                >
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  Author Pictures
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
                <a
                  href="https://drive.google.com/drive/folders/1qzmgRdCQr98fxVs6Bvnqi3J-tS574GY1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60"
                >
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  Book Covers
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
              </div>
            </div>
            {/* Powered by Norfolk AI */}
            <div className="mt-3 pt-3 border-t border-border/30">
              <a
                href="https://norfolkai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 hover:opacity-90 transition-opacity norfolk-logo-pulse"
                title="Powered by Norfolk AI"
              >
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

        {/* ── Main Content ── */}
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Ricardo Cidale's Library
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
            <div className="ml-auto relative w-full sm:w-64 max-w-xs search-glow rounded-md border border-transparent">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={activeTab === "audio" ? "Search audiobooks, authors…" : "Search authors, books, topics…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-8 h-8 text-sm bg-background"
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
          <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-auto">
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
                    <Badge
                      key={cat}
                      variant="secondary"
                      className="gap-1 text-xs"
                      style={{ borderColor: color, color, backgroundColor: color + "12" }}
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
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-baseline gap-3">
                <h1 className="text-xl font-extrabold font-display tracking-tight">
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
              {activeTab !== "audio" && (
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                  {activeTab === "authors" ? (
                    <Select value={authorSort} onValueChange={(v) => setAuthorSort(v as AuthorSort)}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Name A → Z</SelectItem>
                        <SelectItem value="name-desc">Name Z → A</SelectItem>
                        <SelectItem value="books-desc">Most Books</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={bookSort} onValueChange={(v) => setBookSort(v as BookSort)}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Title A → Z</SelectItem>
                        <SelectItem value="name-desc">Title Z → A</SelectItem>
                        <SelectItem value="author">Author</SelectItem>
                        <SelectItem value="content-desc">Most Content</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Card grid */}
            {activeTab === "authors" ? (
              filteredAuthors.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 tab-content-enter">
                  {filteredAuthors.map((a, i) => (
                    <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <AuthorCard
                        author={a}
                        query={query}
                        onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                        isEnriched={enrichedSet.has(
                          a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name
                        )}
                        coverMap={bookCoverMap}
                        dbPhotoMap={dbPhotoMap}
                        onBookClick={(bookId, titleKey) => {
                          // Try to find the BookRecord by id first, then by title key
                          const found = booksByIdMap.get(bookId)
                            ?? BOOKS.find((b) => b.name.split(" - ")[0].trim().toLowerCase() === titleKey.toLowerCase());
                          if (found) { setSelectedBook(found); setBookSheetOpen(true); }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === "books" ? (
              <>
                {/* Category distribution chart — only shown when no search query */}
                {!query && (
                  <CategoryChart
                    activeCategory={selectedCategories.size === 1 ? Array.from(selectedCategories)[0] : ""}
                    onCategoryClick={(cat) => {
                      if (!cat) {
                        setSelectedCategories(new Set());
                      } else {
                        setSelectedCategories(new Set([cat]));
                      }
                    }}
                  />
                )}
                {filteredBooks.length === 0 ? (
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
                        />
                      </div>
                    );
                  })}
                </div>
                )}
              </>
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

    {/* ── Author Bio Modal ───────────────────── */}
    <Dialog open={bioSheetOpen} onOpenChange={setBioSheetOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedAuthor && (
          <AuthorBioPanel
            author={selectedAuthor}
            onClose={() => setBioSheetOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* ── Book Detail Modal ────────────────────── */}
    <Dialog open={bookSheetOpen} onOpenChange={setBookSheetOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {selectedBook && (
          <BookDetailPanel
            book={selectedBook}
            onClose={() => setBookSheetOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
