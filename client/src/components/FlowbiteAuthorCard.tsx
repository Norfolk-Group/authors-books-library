/**
 * FlowbiteAuthorCard
 *
 * Theme-compliant author card using flowbite-react Card + Badge.
 *
 * -- DESIGN RULES (absolute - no exceptions without explicit user request) --
 *   - Zero hardcoded hex / rgb / rgba / hsl values
 *   - Zero Tailwind colour classes (rose-*, emerald-*, indigo-*, amber-*, slate-*, gray-*, etc.)
 *   - All colours from CSS variable tokens: bg-card, bg-muted, text-foreground,
 *     text-muted-foreground, border-border, shadow-sm/md/lg, ring-border
 *   - Category identity via icon + label only (no coloured stripes or tints)
 *   - Shadows are neutral - no RGBA colour tinting
 *   - Card content is top-justified (flex-col, items start at top)
 *
 * -- INTERACTION MODEL (exactly 3 hotspots) --
 *   1. Avatar / author name group  → click opens AuthorModal (bio, links)
 *   2. Book cover / book title row → click opens BookModal (summary, Amazon, Drive)
 *   3. Card surface                → click calls onBioClick (opens full bio panel in parent)
 *
 *   Everything else (category chip, Bio-ready badge, resource pills, watermark)
 *   is purely presentational - cursor-default, no onClick.
 *
 *   Avatar hover: scale-[1.15] - subtle, doesn't break layout.
 *   Book cover hover: scale-[1.2] - subtle, doesn't break layout.
 */
import { useState, useCallback, useRef, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
// Card replaced with plain div — Flowbite removed
import {
  BookOpen,
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
  UserCheck,
  Users,
  FileText,
  AlignLeft,
  Book,
  List,
  Package,
  Video,
  Image,
  Folder,
  Scroll,
  Newspaper,
  Link,
  File,
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_ICONS,
  CONTENT_TYPE_ICONS,
  type AuthorEntry,
  type BookEntry,
} from "@/lib/libraryData";
import { AuthorModal } from "@/components/AuthorModal";
import { BookModal, type BookModalBook } from "@/components/BookModal";

// -- Shared LucideIcon type -----------------------------------------------------
type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// -- Icon maps ------------------------------------------------------------------
const ICON_MAP: Record<string, LucideIcon> = {
  briefcase:        Briefcase as LucideIcon,
  brain:            Brain as LucideIcon,
  handshake:        Handshake as LucideIcon,
  users:            Users2 as LucideIcon,
  zap:              Zap as LucideIcon,
  "message-circle": MessageCircle as LucideIcon,
  cpu:              Cpu as LucideIcon,
  "trending-up":    TrendingUp as LucideIcon,
  "book-open":      BookMarked as LucideIcon,
};

const CT_ICON_MAP: Record<string, LucideIcon> = {
  "file-text":  FileText as LucideIcon,
  "book":       Book as LucideIcon,
  "file":       File as LucideIcon,
  "align-left": AlignLeft as LucideIcon,
  "video":      Video as LucideIcon,
  "image":      Image as LucideIcon,
  "package":    Package as LucideIcon,
  "scroll":     Scroll as LucideIcon,
  "newspaper":  Newspaper as LucideIcon,
  "link":       Link as LucideIcon,
  "list":       List as LucideIcon,
  "folder":     Folder as LucideIcon,
};

// -- Content-type normalisation -------------------------------------------------
const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC":       "Supplemental",
  "PDF Extra":            "PDF",
  "PDF Extra 2":          "PDF",
  "PDF Extras":           "PDF",
  "Complete Book in PDF": "PDF",
  "DOC":                  "Transcript",
  "ChatGPT":              "Supplemental",
  "Sana AI":              "Supplemental",
  "Notes":                "Supplemental",
  "Knowledge Base":       "Supplemental",
  "temp":                 "Supplemental",
  "Temp":                 "Supplemental",
  "TEMP":                 "Supplemental",
};
function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// -- Search highlight -----------------------------------------------------------
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-bold text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// -- Resource pill - presentational only, no onClick ---------------------------
function ResourcePill({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground cursor-default select-none">
      <Icon className="w-3 h-3" />
      {type}
      {count > 1 && <span className="opacity-60 ml-0.5">{count}</span>}
    </span>
  );
}

// -- HOTSPOT 2: Book row - clicking opens BookModal ----------------------------
function BookRow({
  book,
  onBookClick,
}: {
  book: BookEntry;
  onBookClick: (b: BookModalBook) => void;
}) {
  const rawTitle = book.name.includes(" - ")
    ? book.name.slice(0, book.name.lastIndexOf(" - "))
    : book.name;
  const titleKey = rawTitle.trim().toLowerCase();
  const displayTitle = rawTitle.trim();
  const normalised = normalizeContentTypes(book.contentTypes ?? {});
  const hasContent = Object.keys(normalised).length > 0;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onBookClick({ id: book.id, titleKey, contentTypes: book.contentTypes ?? {} });
    },
    [book, titleKey, onBookClick]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-accent transition-colors group/book w-full text-left"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover/book:text-foreground transition-colors" />
        <span className="text-[11px] font-medium leading-tight text-muted-foreground group-hover/book:text-foreground transition-colors line-clamp-1 flex-1">
          {displayTitle}
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/book:opacity-50 transition-opacity flex-shrink-0" />
      </div>
      {hasContent && (
        <div className="flex flex-wrap gap-1 pl-4">
          {Object.entries(normalised).map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium"
            >
              {type}{count > 1 && <span className="opacity-60">·{count}</span>}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// -- 3-D tilt hook -------------------------------------------------------------
// Simple expand-on-hover, contract-on-click card interaction
function useCardHover() {
  const ref = useRef<HTMLDivElement>(null);
  return { ref };
}

// -- Props ----------------------------------------------------------------------
export interface FlowbiteAuthorCardProps {
  author: AuthorEntry;
  query: string;
  /** HOTSPOT 3: called when the user clicks the card surface */
  onBioClick: (a: AuthorEntry) => void;
  isEnriched?: boolean;
  coverMap?: Map<string, string>;
  /** Kept for API compatibility - not used for navigation */
  onBookClick?: (bookId: string, titleKey: string) => void;
  dbAvatarMap?: Map<string, string>;
  /** Short bio text to show in hover tooltip (first ~200 chars). Only shown when isEnriched is true. */
  bio?: string | null;
  /** Map of lowercase book title → { summary, rating, ratingCount } for cover thumbnail tooltips. */
  bookInfoMap?: Map<string, { summary?: string; rating?: string; ratingCount?: string }>;
}

// -- Main component -------------------------------------------------------------
export function FlowbiteAuthorCard({
  author,
  query,
  onBioClick,
  isEnriched,
  coverMap,
  dbAvatarMap,
  bio,
  bookInfoMap,
}: FlowbiteAuthorCardProps) {
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const avatarUrl =
    dbAvatarMap?.get(displayName.toLowerCase()) ?? getAuthorAvatar(displayName) ?? null;
  const hasBooks = author.books && author.books.length > 0;

  // -- HOTSPOT 1: Author modal --
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAuthorModalOpen(true);
  }, []);

  // -- HOTSPOT 2: Book modal --
  const [activeBook, setActiveBook] = useState<BookModalBook | null>(null);
  const handleBookClick = useCallback((b: BookModalBook) => {
    setActiveBook(b);
  }, []);

  // -- Resource totals across all books --
  const resourceTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const book of author.books ?? []) {
      for (const [type, count] of Object.entries(normalizeContentTypes(book.contentTypes ?? {}))) {
        totals[type] = (totals[type] ?? 0) + count;
      }
    }
    return totals;
  }, [author.books]);

  // -- Deduplicated books for the cover strip --
  const dedupedBooks = useMemo(() => {
    const seen = new Set<string>();
    return (author.books ?? []).filter((book) => {
      const tk = book.name.includes(" - ")
        ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim().toLowerCase()
        : book.name.trim().toLowerCase();
      if (seen.has(tk)) return false;
      seen.add(tk);
      return true;
    });
  }, [author.books]);

  const { ref } = useCardHover();

  // Bio tooltip: first 200 chars, trimmed at sentence boundary if possible
  const bioSnippet = useMemo(() => {
    if (!bio || !isEnriched) return null;
    const trimmed = bio.trim();
    if (trimmed.length <= 200) return trimmed;
    // Try to cut at last sentence end within 200 chars
    const cut = trimmed.slice(0, 200);
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return lastDot > 80 ? trimmed.slice(0, lastDot + 1) : cut + '…';
  }, [bio, isEnriched]);

  return (
    <>
      <motion.div
        ref={ref}
        className="card-animate group h-full"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
      >
        {/*
         * HOTSPOT 3: clicking the Card surface calls onBioClick.
         * Child interactive elements stop propagation so they don't
         * accidentally trigger this handler.
         */}
        <div
          onClick={() => onBioClick(author)}
          className="
            h-full overflow-hidden relative p-0
            bg-card text-card-foreground
            border border-border rounded-2xl
            shadow-sm hover:shadow-md
            transition-shadow duration-200
            flex flex-col items-stretch justify-start
            cursor-pointer
          "
        >
          {/* Category watermark - presentational, no pointer events */}
          <div
            className="pointer-events-none absolute bottom-2 right-2 select-none"
            aria-hidden
          >
            <Icon className="w-16 h-16 text-foreground opacity-[0.04]" strokeWidth={1} />
          </div>

          {/* -- SECTION 1: Header -- */}
          {/*
           * The header uses a 2-row CSS grid with fixed row heights so that
           * author name titles align at the same Y position across every card
           * in the same grid row, regardless of badge presence or label length.
           *
           * Row 1 (h-[28px]): category icon + label + badge slot (always rendered)
           * Row 2 (auto):     avatar + name group
           */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0 grid grid-rows-[28px_auto] gap-y-3">
            {/* Row 1: Category + badge - always exactly 28px tall */}
            <div className="flex items-center justify-between gap-2 h-[28px]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate min-w-0"
                  title={author.category}
                >
                  {author.category}
                </p>
              </div>
              {/* Bio-ready dot - always rendered to keep row height constant */}
              <div className="shrink-0 h-[20px] flex items-center">
                {isEnriched ? (
                  <span
                    title="Bio ready"
                    className="w-2 h-2 rounded-full bg-chart-5 flex-shrink-0"
                    aria-label="Bio ready"
                  />
                ) : (
                  <span className="w-2 h-2" aria-hidden />
                )}
              </div>
            </div>

              {/* HOTSPOT 1: Avatar + name group - stopPropagation so card click doesn't fire */}
            <div
              className="flex flex-col items-center gap-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Avatar - tripled to 108px, expand-on-hover */}
              <div className="relative h-28 w-28 flex-shrink-0">
                <AvatarUpload authorName={displayName} currentPhotoUrl={avatarUrl} size={112}>
                  {(url) => {
                    const avatarEl = url ? (
                      <img
                        src={url}
                        alt={displayName}
                        onClick={handleAvatarClick}
                        className="
                          h-28 w-28 rounded-full object-cover shadow-md
                          ring-2 ring-border ring-offset-2
                          transition-transform duration-200 ease-out
                          hover:scale-110
                          active:scale-95
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                        loading="lazy"
                      />
                    ) : (
                      <div
                        onClick={handleAvatarClick}
                        className="
                          h-28 w-28 rounded-full bg-muted text-muted-foreground
                          flex items-center justify-center text-3xl font-bold
                          ring-2 ring-border ring-offset-2
                          transition-transform duration-200 ease-out
                          hover:scale-110
                          active:scale-95
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                      >
                        {displayName.charAt(0)}
                      </div>
                    );
                    if (!bioSnippet) return avatarEl;
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>{avatarEl}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="max-w-[260px] p-3 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-semibold text-xs mb-1">{displayName}</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">{bioSnippet}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }}
                </AvatarUpload>
              </div>

              {/* Name + specialty - clicking name also opens AuthorModal */}
              <div
                className="min-w-0 w-full cursor-pointer"
                onClick={handleAvatarClick}
              >
                <h3 className="text-base font-bold text-card-foreground leading-snug tracking-tight text-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
                  <Highlight text={displayName} query={query} />
                </h3>
                {specialty && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed text-center">
                    <Highlight text={specialty} query={query} />
                  </p>
                )}
              </div>
            </div>

            {/* Bio status - presentational (with tooltip on bio-ready label) */}
            <div className="text-[11px] flex justify-center">
              {isEnriched ? (
                bioSnippet ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                        <UserCheck className="w-3 h-3" />
                        <span className="font-medium">Bio ready</span>
                        <span className="opacity-60">· click to view</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-[260px] p-3 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="font-semibold text-xs mb-1">{displayName}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{bioSnippet}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                    <UserCheck className="w-3 h-3" />
                    <span className="font-medium">Bio ready</span>
                    <span className="opacity-60">· click to view</span>
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>Click to view bio &amp; links</span>
                </span>
              )}
            </div>
          </div>

          {/* -- Divider -- */}
          <div className="mx-4 h-px bg-border flex-shrink-0" />

          {/* -- SECTION 2: Books -- */}
          {hasBooks && (
            <div className="px-4 py-3 relative z-10 flex flex-col items-start gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground cursor-default">
                Books ({author.books.length})
              </p>

              {/* Resource pills - presentational */}
              {Object.keys(resourceTotals).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resourceTotals).map(([type, count]) => (
                    <ResourcePill key={type} type={type} count={count} />
                  ))}
                </div>
              )}

              {/* Cover strip - HOTSPOT 2: each cover opens BookModal */}
              {coverMap && (
                <div className="flex flex-wrap gap-2 w-full">
                  {dedupedBooks.map((book) => {
                    const rawTitle = book.name.includes(" - ")
                      ? book.name.slice(0, book.name.lastIndexOf(" - "))
                      : book.name;
                    const titleKey = rawTitle.trim().toLowerCase();
                    const coverUrl = coverMap.get(titleKey);
                    const bookInfo = bookInfoMap?.get(titleKey);
                    const summary = bookInfo?.summary;
                    const rating = bookInfo?.rating ? parseFloat(bookInfo.rating) : null;
                    const ratingCount = bookInfo?.ratingCount ? parseInt(bookInfo.ratingCount, 10) : null;
                    // Trim summary to first sentence (up to ~120 chars)
                    const summarySnippet = summary
                      ? (() => {
                          const s = summary.trim();
                          const dot = Math.min(
                            s.indexOf('. ') > 0 ? s.indexOf('. ') + 1 : s.length,
                            120
                          );
                          return s.slice(0, dot) + (dot < s.length ? '' : '');
                        })()
                      : null;
                    const bookMini: BookModalBook = {
                      id: book.id,
                      titleKey,
                      coverUrl,
                      contentTypes: book.contentTypes ?? {},
                    };
                    const coverEl = (
                      <div
                        key={book.id}
                        className="relative h-[88px] w-16 flex-shrink-0 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleBookClick(bookMini); }}
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={rawTitle.trim()}
                            className="
                              h-full w-full rounded object-cover shadow-sm
                              ring-1 ring-border
                              transition-transform duration-300 ease-out
                              hover:scale-[1.2]
                              origin-center
                              relative z-20
                            "
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="
                              h-full w-full rounded bg-muted shadow-sm
                              ring-1 ring-border
                              flex items-center justify-center
                              transition-transform duration-300 ease-out
                              hover:scale-[1.2]
                              origin-center
                              relative z-20
                            "
                          >
                            <BookOpen className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                    if (!summarySnippet && !rating) {
                      return <div key={book.id}>{coverEl}</div>;
                    }
                    return (
                      <Tooltip key={book.id}>
                        <TooltipTrigger asChild>{coverEl}</TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[220px] p-2.5 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-semibold text-xs mb-1 leading-snug">{rawTitle.trim()}</p>
                          {rating !== null && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-amber-400 text-xs">{"\u2605".repeat(Math.round(rating))}{"\u2606".repeat(Math.max(0, 5 - Math.round(rating)))}</span>
                              <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
                              {ratingCount !== null && ratingCount > 0 && (
                                <span className="text-xs text-muted-foreground">({ratingCount.toLocaleString()})</span>
                              )}
                            </div>
                          )}
                          {summarySnippet && (
                            <p className="text-xs leading-relaxed text-muted-foreground">{summarySnippet}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}

              {/* Book rows - HOTSPOT 2: each row opens BookModal */}
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto w-full">
                {author.books.map((book) => (
                  <BookRow key={book.id} book={book} onBookClick={handleBookClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* -- HOTSPOT 1 modal: Author bio -- */}
      <AuthorModal
        author={authorModalOpen ? author : null}
        avatarUrl={avatarUrl}
        onClose={() => setAuthorModalOpen(false)}
      />

      {/* -- HOTSPOT 2 modal: Book detail -- */}
      <BookModal
        book={activeBook}
        onClose={() => setActiveBook(null)}
      />
    </>
  );
}

export default FlowbiteAuthorCard;
