/**
 * NCG Library — Home Page
 * Design: Editorial Intelligence — sidebar-07 layout + card grid
 * Fonts: Inter Tight (ExtraBold H1, SemiBold H2/H3, Regular body)
 * Palette: NCG Brand — Navy #112548, Yellow #FDB817, Teal #0091AE, Orange #F4795B
 * Tabs: Authors | Books | Books Audio
 * Cards: Show book subfolders with content-type icons
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  CATEGORY_BG,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  type AuthorEntry,
  type BookRecord,
} from "@/lib/libraryData";
import { AUDIO_BOOKS, type AudioBook } from "@/lib/audioData";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { useTheme, type AppTheme } from "@/contexts/ThemeContext";
import { CategoryChart } from "@/components/CategoryChart";
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
    <div className="flex flex-col gap-1 px-3 sm:px-5 py-3 sm:py-4 bg-card rounded-lg border border-border shadow-sm">
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
function AuthorCard({ author, query, onBioClick, isEnriched }: { author: AuthorEntry; query: string; onBioClick: (a: AuthorEntry) => void; isEnriched?: boolean }) {
  const color = CATEGORY_COLORS[author.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = ICON_MAP[iconName] ?? Briefcase;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;
  const { appTheme } = useTheme();
  const isNoir = appTheme === "noir-dark";

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

  const bg = isNoir ? undefined : (CATEGORY_BG[author.category] ?? "#fafaf9");

  return (
    <div
      className="card-animate group rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative bg-card"
      style={{ borderLeftWidth: 3, borderLeftColor: color, ...(bg ? { backgroundColor: bg } : {}) }}
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
}// ── Book Card ──────────────────────────────────────────────
function BookCard({ book, query, onDetailClick, coverImageUrl, isEnriched }: { book: BookRecord; query: string; onDetailClick?: (b: BookRecord) => void; coverImageUrl?: string; isEnriched?: boolean }) {
  const color = CATEGORY_COLORS[book.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const { appTheme } = useTheme();
  const isNoir = appTheme === "noir-dark";

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
  const bg = isNoir ? undefined : (CATEGORY_BG[book.category] ?? "#fafaf9");

  return (
    <div
      className="card-animate group rounded-lg border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer relative bg-card"
      style={{ borderLeftWidth: 3, borderLeftColor: color, ...(bg ? { backgroundColor: bg } : {}) }}
      onClick={() => onDetailClick?.(book)}
    >
      {/* Watermark (only when no cover) */}
      {!coverImageUrl && (
        <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
          <Icon style={{ width: 72, height: 72, color, opacity: 0.07 }} strokeWidth={1} />
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
            <img
              src={coverImageUrl}
              alt={displayTitle}
              className="w-12 h-16 object-cover rounded shadow-sm ring-1 ring-border flex-shrink-0"
              loading="lazy"
            />
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

// ── Author Bio Modal ──────────────────────────────────────
function AuthorBioPanel({ author, onClose }: { author: typeof AUTHORS[number]; onClose: () => void }) {
  const dashIdx = author.name.indexOf(" - ");
  const displayName = dashIdx !== -1 ? author.name.slice(0, dashIdx) : author.name;
  const specialty = dashIdx !== -1 ? author.name.slice(dashIdx + 3) : "";
  const photoUrl = getAuthorPhoto(displayName);
  const color = CATEGORY_COLORS[author.category] ?? "#374151";
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

  // Auto-trigger DB enrichment only if no JSON bio and no DB profile
  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ authorName: displayName });
    }
  }, [jsonBio, isLoading, profile]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-center gap-4 mb-1">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2 flex-shrink-0" style={{ '--tw-ring-color': color + '66' } as React.CSSProperties} />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{ backgroundColor: color + '22', color }}>
              {displayName.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '22', color }}>{author.category}</span>
            </div>
            <DialogTitle className="text-xl font-bold leading-snug">{displayName}</DialogTitle>
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
  const color = CATEGORY_COLORS[book.category] ?? "#374151";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarked;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const totalItems = Object.values(book.contentTypes).reduce((s, n) => s + n, 0);

  // Fetch enriched profile from DB
  const { data: profile, isLoading } = trpc.bookProfiles.get.useQuery({ bookTitle: displayTitle });
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

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-start gap-4 mb-1">
          {/* Book cover */}
          <div className="flex-shrink-0">
            {profile?.coverImageUrl ? (
              <img
                src={profile.coverImageUrl}
                alt={displayTitle}
                className="w-20 h-28 object-cover rounded-md shadow-md ring-1 ring-border"
                loading="lazy"
              />
            ) : (
              <div
                className="w-20 h-28 rounded-md flex items-center justify-center shadow-md ring-1 ring-border"
                style={{ backgroundColor: color + "18" }}
              >
                {isLoadingProfile ? (
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color }} />
                ) : (
                  <Icon className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{book.category}</span>
            </div>
            <DialogTitle className="text-lg font-bold leading-snug">{displayTitle}</DialogTitle>
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

      {/* External links */}
      {profile && (profile.amazonUrl || profile.goodreadsUrl || profile.resourceUrl) && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Find This Book</h4>
          <div className="flex flex-col gap-1.5">
            {profile.amazonUrl && (
              <a href={profile.amazonUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <ShoppingCart className="w-3.5 h-3.5" />
                Search on Amazon
              </a>
            )}
            {profile.goodreadsUrl && (
              <a href={profile.goodreadsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <BookMarkedIcon className="w-3.5 h-3.5" />
                Search on Goodreads
              </a>
            )}
            {profile.resourceUrl && (
              <a href={profile.resourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Globe className="w-3.5 h-3.5" />
                {profile.resourceLabel || "More Info"}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Library content */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In Your Library ({totalItems} files)</h4>
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
  const { appTheme, setAppTheme } = useTheme();
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
      if (p.coverImageUrl) map.set(p.bookTitle, p.coverImageUrl);
    }
    return map;
  }, [bookCoversQuery.data]);

  // ── Batch enrich books state ──────────────────────────────────
  const [bookEnrichStatus, setBookEnrichStatus] = useState<EnrichStatus>("idle");
  const [bookEnrichProgress, setBookEnrichProgress] = useState(0);
  const [bookEnrichDone, setBookEnrichDone] = useState(0);
  const [bookEnrichTotal, setBookEnrichTotal] = useState(0);
  const [bookEnrichFailed, setBookEnrichFailed] = useState(0);
  const bookEnrichBatchMutation = trpc.bookProfiles.enrichBatch.useMutation();

  const utils = trpc.useUtils();
  const enrichAllBios = useCallback(async () => {
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
      void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      void utils.bookProfiles.getMany.invalidate();
    } catch (err) {
      setBookEnrichStatus("error");
      toast.error("Book enrichment failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [bookEnrichStatus, bookEnrichBatchMutation, utils]);

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
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${enrichProgress}%`, backgroundColor: "var(--accent)" }}
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
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bookEnrichProgress}%`, backgroundColor: "var(--primary)" }}
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

            {/* ── Preferences: Theme Switcher ── */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Preferences</p>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setAppTheme("norfolk-ai")}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${
                    appTheme === "norfolk-ai"
                      ? "bg-accent/20 text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 flex-shrink-0" />
                  Norfolk AI
                  {appTheme === "norfolk-ai" && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ncg-yellow" />
                  )}
                </button>
                <button
                  onClick={() => setAppTheme("noir-dark")}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${
                    appTheme === "noir-dark"
                      ? "bg-accent/20 text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 flex-shrink-0" />
                  Noir Dark Executive
                  {appTheme === "noir-dark" && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "oklch(0.78 0.14 85)" }} />
                  )}
                </button>
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAuthors.map((a, i) => (
                    <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                      <AuthorCard
                        author={a}
                        query={query}
                        onBioClick={(author) => { setSelectedAuthor(author); setBioSheetOpen(true); }}
                        isEnriched={enrichedSet.has(
                          a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name
                        )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
