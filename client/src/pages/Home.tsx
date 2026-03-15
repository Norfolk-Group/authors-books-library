/**
 * NCG Library — Home Page
 * Design: Editorial Intelligence — sidebar-07 layout + card grid
 * Fonts: Inter Tight (ExtraBold H1, SemiBold H2/H3, Regular body)
 * Palette: NCG Brand — Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B
 * Tabs: Authors | Books | Books Audio
 * Cards: Show book subfolders with content-type icons
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  CATEGORY_BG,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  type AuthorEntry,
  type BookRecord,
} from "@/lib/libraryData";
import { AUDIO_BOOKS, type AudioBook } from "@/lib/audioData";
import { getAuthorPhoto } from "@/lib/authorPhotos";
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
    <div className="flex flex-col gap-1 px-3 sm:px-5 py-3 sm:py-4 bg-white rounded-lg border border-border shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl sm:text-2xl font-extrabold tracking-tight">
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
function AuthorCard({ author, query, onBioClick }: { author: AuthorEntry; query: string; onBioClick: (a: AuthorEntry) => void }) {
  const color = CATEGORY_COLORS[author.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = ICON_MAP[iconName] ?? Briefcase;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  // Extract display name (before the dash) and specialty (after the dash)
  const dashIdx = author.name.indexOf(" - ");
  const displayName = dashIdx !== -1 ? author.name.slice(0, dashIdx) : author.name;
  const specialty = dashIdx !== -1 ? author.name.slice(dashIdx + 3) : "";

  // Look up author photo
  const photoUrl = getAuthorPhoto(displayName);

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

  const bg = CATEGORY_BG[author.category] ?? "#fafaf9";

  return (
    <div
      className="card-animate group rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative"
      style={{ borderLeftWidth: 3, borderLeftColor: color, backgroundColor: bg }}
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

      {/* Card header — clickable to open author Drive folder */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 pb-2 cursor-pointer relative z-10"
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
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
        </div>
        {/* Author photo + name row */}
        <div className="flex items-center gap-2.5 mb-1">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-offset-1"
              style={{ '--tw-ring-color': color + '55' } as React.CSSProperties}
              loading="lazy"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ backgroundColor: color + '22', color }}
            >
              {displayName.charAt(0)}
            </div>
          )}
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
      </a>

      {/* Bio button */}
      <div className="px-3 pb-2 relative z-10">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBioClick(author); }}
          className="text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <Users className="w-3 h-3" />
          View bio &amp; links
        </button>
      </div>
      {/* Book subfolders */}
      {hasBooks && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 mt-1 relative z-10">
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
  );
}

// ── Book Card ────────────────────────────────────────────────
function BookCard({ book, query, onDetailClick }: { book: BookRecord; query: string; onDetailClick?: (b: BookRecord) => void }) {
  const color = CATEGORY_COLORS[book.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;

  // Extract title and author from book name (format: "Title - Author Name")
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";

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

  const bg = CATEGORY_BG[book.category] ?? "#fafaf9";

  return (
    <div
      className="card-animate group rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer relative"
      style={{ borderLeftWidth: 3, borderLeftColor: color, backgroundColor: bg }}
      onClick={() => onDetailClick?.(book)}
    >
      {/* Watermark */}
      <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
        <Icon
          style={{ width: 72, height: 72, color, opacity: 0.07 }}
          strokeWidth={1}
        />
      </div>
      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + "22" }}
            >
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
        <h3 className="text-sm font-semibold leading-snug mb-1 tracking-tight">
          {highlight(displayTitle)}
        </h3>
        {bookAuthor && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            <span className="font-medium">by</span> {highlight(bookAuthor)}
          </p>
        )}
        {hasContent && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
            {Object.entries(book.contentTypes).map(([type, count]) => (
              <ContentTypeBadge key={type} type={type} count={count} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// ── Audio Book Cardd ──────────────────────────────────────────
function AudioCard({ audio, query }: { audio: AudioBook; query: string }) {
  const driveUrl = `https://drive.google.com/drive/folders/${audio.id}?view=grid`;

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
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card-animate group rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden block cursor-pointer relative"
      style={{ borderLeftWidth: 3, borderLeftColor: "#d97706", backgroundColor: "#fffbeb" }}
    >
      {/* Watermark */}
      <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
        <Headphones style={{ width: 72, height: 72, color: "#d97706", opacity: 0.07 }} strokeWidth={1} />
      </div>

      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#d9770622" }}>
              <Headphones className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#d97706" }}>
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
  );
}

// ── Author Bio Panel (Sheet) ──────────────────────────────
function AuthorBioPanel({ author, onClose }: { author: typeof AUTHORS[number]; onClose: () => void }) {
  const dashIdx = author.name.indexOf(" - ");
  const displayName = dashIdx !== -1 ? author.name.slice(0, dashIdx) : author.name;
  const specialty = dashIdx !== -1 ? author.name.slice(dashIdx + 3) : "";
  const photoUrl = getAuthorPhoto(displayName);
  const color = CATEGORY_COLORS[author.category] ?? "#374151";
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  // Fetch bio from DB
  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery({ authorName: displayName });
  const enrichMutation = trpc.authorProfiles.enrich.useMutation({
    onSuccess: () => { /* profile will auto-refresh */ },
    onError: (e) => toast.error("Failed to load bio: " + e.message),
  });

  // Auto-trigger enrichment if no profile exists
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ authorName: displayName });
    }
  }, [isLoading, profile]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <SheetHeader>
        <div className="flex items-center gap-3 mb-1">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover ring-2 ring-offset-1" style={{ '--tw-ring-color': color + '55' } as React.CSSProperties} />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: color + '22', color }}>
              {displayName.charAt(0)}
            </div>
          )}
          <div>
            <SheetTitle className="text-base font-bold leading-snug">{displayName}</SheetTitle>
            {specialty && <SheetDescription className="text-xs">{specialty}</SheetDescription>}
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 block" style={{ color }}>{author.category}</span>
          </div>
        </div>
      </SheetHeader>

      {/* Bio */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {isLoading || enrichMutation.isPending ? (
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

// ── Book Detail Panel (Sheet) ──────────────────────────────
function BookDetailPanel({ book, onClose }: { book: typeof BOOKS[number]; onClose: () => void }) {
  const color = CATEGORY_COLORS[book.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const totalItems = Object.values(book.contentTypes).reduce((s, n) => s + n, 0);

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <SheetHeader>
        <div className="flex items-start gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "22" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-bold leading-snug">{displayTitle}</SheetTitle>
            {bookAuthor && <SheetDescription className="text-xs">by {bookAuthor}</SheetDescription>}
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 block" style={{ color }}>{book.category}</span>
          </div>
        </div>
      </SheetHeader>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-center">
          <p className="text-lg font-bold">{Object.keys(book.contentTypes).length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Content Types</p>
        </div>
        <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-center">
          <p className="text-lg font-bold">{totalItems}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Files</p>
        </div>
      </div>

      {/* Content types with Drive links */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Available Content</h4>
        <div className="flex flex-col gap-1.5">
          {Object.entries(book.contentTypes).map(([type, count]) => {
            const iconKey = CONTENT_TYPE_ICONS[type] ?? "file";
            const CtIcon = CT_ICON_MAP[iconKey] ?? File;
            const ctColorRaw = CONTENT_TYPE_COLORS[type];
            const ctColor = typeof ctColorRaw === "object" && ctColorRaw !== null
              ? ctColorRaw as { bg: string; text: string }
              : { bg: "#f3f4f6", text: "#374151" };
            const subfolderUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
            return (
              <a
                key={type}
                href={subfolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ctColor.bg }}>
                  <CtIcon className="w-3.5 h-3.5" style={{ color: ctColor.text }} />
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
      const baseName = a.name.split(" - ")[0].trim().toLowerCase();
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
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Library className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Norfolk CG</p>
                <p className="text-sm font-bold leading-tight tracking-tight">
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
                      const color = CATEGORY_COLORS[cat] ?? "#374151";
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
              disabled={regenerate.isPending}
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
            <div className="ml-auto relative w-full sm:w-64 max-w-xs">
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
                  const color = CATEGORY_COLORS[cat] ?? "#374151";
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
                <h1 className="text-xl font-extrabold tracking-tight">
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
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-white">
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
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-white">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAuthors.map((a, i) => (
                    <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <AuthorCard author={a} query={query} onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }} />
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
                    <div key={b.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <BookCard book={b} query={query} onDetailClick={(book) => { setSelectedBook(book); setBookSheetOpen(true); }} />
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

    {/* ── Author Bio Sheet ──────────────────────────────── */}
    <Sheet open={bioSheetOpen} onOpenChange={setBioSheetOpen}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {selectedAuthor && (
          <AuthorBioPanel
            author={selectedAuthor}
            onClose={() => setBioSheetOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>

    {/* ── Book Detail Sheet ──────────────────────────────── */}
    <Sheet open={bookSheetOpen} onOpenChange={setBookSheetOpen}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {selectedBook && (
          <BookDetailPanel
            book={selectedBook}
            onClose={() => setBookSheetOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
