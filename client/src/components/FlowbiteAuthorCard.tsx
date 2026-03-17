/**
 * FlowbiteAuthorCard
 *
 * Theme-compliant author card using flowbite-react Card + Badge.
 *
 * ── DESIGN RULES (absolute — no exceptions without explicit user request) ──
 *   - Zero hardcoded hex / rgb / rgba / hsl values
 *   - Zero Tailwind colour classes (rose-*, emerald-*, indigo-*, amber-*, slate-*, gray-*, etc.)
 *   - All colours from CSS variable tokens: bg-card, bg-muted, text-foreground,
 *     text-muted-foreground, border-border, shadow-sm/md/lg, ring-border
 *   - Category identity via icon + label only (no coloured stripes or tints)
 *   - Shadows are neutral — no RGBA colour tinting
 *   - Card content is top-justified (flex-col, items start at top)
 *
 * ── INTERACTION MODEL (exactly 3 hotspots) ──
 *   1. Avatar / author name group  → click opens AuthorModal (bio, links)
 *   2. Book cover / book title row → click opens BookModal (summary, Amazon, Drive)
 *   3. Card surface                → click calls onBioClick (opens full bio panel in parent)
 *
 *   Everything else (category chip, Bio-ready badge, resource pills, watermark)
 *   is purely presentational — cursor-default, no onClick.
 *
 *   Avatar hover: scale-[1.15] — subtle, doesn't break layout.
 *   Book cover hover: scale-[1.2] — subtle, doesn't break layout.
 */
import { useState, useCallback, useRef, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Card, Badge } from "flowbite-react";
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
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_ICONS,
  CONTENT_TYPE_ICONS,
  type AuthorEntry,
  type BookEntry,
} from "@/lib/libraryData";
import { AuthorModal } from "@/components/AuthorModal";
import { BookModal, type BookModalBook } from "@/components/BookModal";

// ── Shared LucideIcon type ─────────────────────────────────────────────────────
type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// ── Icon maps ──────────────────────────────────────────────────────────────────
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

// ── Content-type normalisation ─────────────────────────────────────────────────
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

// ── Search highlight ───────────────────────────────────────────────────────────
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

// ── Resource pill — presentational only, no onClick ───────────────────────────
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

// ── HOTSPOT 2: Book row — clicking opens BookModal ────────────────────────────
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

// ── 3-D tilt hook ─────────────────────────────────────────────────────────────
function useCardTilt(maxDeg = 10) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [maxDeg, -maxDeg]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-maxDeg, maxDeg]), { stiffness: 200, damping: 20 });
  const scale   = useSpring(1, { stiffness: 200, damping: 20 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    rawX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawY.set((e.clientY - rect.top) / rect.height - 0.5);
    scale.set(1.02);
  }, [rawX, rawY, scale]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
    scale.set(1);
  }, [rawX, rawY, scale]);

  return { ref, rotateX, rotateY, scale, handleMouseMove, handleMouseLeave };
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface FlowbiteAuthorCardProps {
  author: AuthorEntry;
  query: string;
  /** HOTSPOT 3: called when the user clicks the card surface */
  onBioClick: (a: AuthorEntry) => void;
  isEnriched?: boolean;
  coverMap?: Map<string, string>;
  /** Kept for API compatibility — not used for navigation */
  onBookClick?: (bookId: string, titleKey: string) => void;
  dbPhotoMap?: Map<string, string>;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function FlowbiteAuthorCard({
  author,
  query,
  onBioClick,
  isEnriched,
  coverMap,
  dbPhotoMap,
}: FlowbiteAuthorCardProps) {
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const photoUrl =
    dbPhotoMap?.get(displayName.toLowerCase()) ?? getAuthorPhoto(displayName) ?? null;
  const hasBooks = author.books && author.books.length > 0;

  // ── HOTSPOT 1: Author modal ──
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAuthorModalOpen(true);
  }, []);

  // ── HOTSPOT 2: Book modal ──
  const [activeBook, setActiveBook] = useState<BookModalBook | null>(null);
  const handleBookClick = useCallback((b: BookModalBook) => {
    setActiveBook(b);
  }, []);

  // ── Resource totals across all books ──
  const resourceTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const book of author.books ?? []) {
      for (const [type, count] of Object.entries(normalizeContentTypes(book.contentTypes ?? {}))) {
        totals[type] = (totals[type] ?? 0) + count;
      }
    }
    return totals;
  }, [author.books]);

  // ── Deduplicated books for the cover strip ──
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

  const { ref, rotateX, rotateY, scale, handleMouseMove, handleMouseLeave } = useCardTilt(10);

  return (
    <>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="card-animate group h-full"
        style={{ rotateX, rotateY, scale, willChange: "transform" }}
      >
        {/*
         * HOTSPOT 3: clicking the Card surface calls onBioClick.
         * Child interactive elements stop propagation so they don't
         * accidentally trigger this handler.
         */}
        <Card
          onClick={() => onBioClick(author)}
          className="
            h-full overflow-hidden relative !p-0
            bg-card text-card-foreground
            border border-border rounded-2xl
            shadow-sm hover:shadow-md
            transition-shadow duration-200
            flex flex-col items-stretch justify-start
            cursor-pointer
          "
        >
          {/* Category watermark — presentational, no pointer events */}
          <div
            className="pointer-events-none absolute bottom-2 right-2 select-none"
            aria-hidden
          >
            <Icon className="w-16 h-16 text-foreground opacity-[0.04]" strokeWidth={1} />
          </div>

          {/* ── SECTION 1: Header ── */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            {/* Category row — presentational */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {author.category}
                </p>
              </div>
              {isEnriched && (
                <Badge color="success" className="text-[10px] shrink-0">
                  Bio ready
                </Badge>
              )}
            </div>

            {/* HOTSPOT 1: Avatar + name group — stopPropagation so card click doesn't fire */}
            <div
              className="flex items-center gap-3 mb-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Avatar — 1.15× hover scale, click opens AuthorModal */}
              <div className="relative h-9 w-9 flex-shrink-0">
                <AvatarUpload authorName={displayName} currentPhotoUrl={photoUrl} size={40}>
                  {(url) =>
                    url ? (
                      <img
                        src={url}
                        alt={displayName}
                        onClick={handleAvatarClick}
                        className="
                          h-9 w-9 rounded-full object-cover shadow-sm
                          ring-2 ring-border ring-offset-1
                          transition-transform duration-300 ease-out
                          hover:scale-[1.15]
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
                          h-9 w-9 rounded-full bg-muted text-muted-foreground
                          flex items-center justify-center text-sm font-bold
                          ring-2 ring-border ring-offset-1
                          transition-transform duration-300 ease-out
                          hover:scale-[1.15]
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                      >
                        {displayName.charAt(0)}
                      </div>
                    )
                  }
                </AvatarUpload>
              </div>

              {/* Name + specialty — clicking name also opens AuthorModal */}
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={handleAvatarClick}
              >
                <h3 className="text-sm font-semibold text-card-foreground leading-snug tracking-tight">
                  <Highlight text={displayName} query={query} />
                </h3>
                {specialty && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    <Highlight text={specialty} query={query} />
                  </p>
                )}
              </div>
            </div>

            {/* Bio status — presentational */}
            <div className="text-[11px]">
              {isEnriched ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCheck className="w-3 h-3" />
                  <span className="font-medium">Bio ready</span>
                  <span className="opacity-60">· click to view</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>Click to view bio &amp; links</span>
                </span>
              )}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="mx-4 h-px bg-border flex-shrink-0" />

          {/* ── SECTION 2: Books ── */}
          {hasBooks && (
            <div className="px-4 py-3 relative z-10 flex flex-col items-start gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground cursor-default">
                Books ({author.books.length})
              </p>

              {/* Resource pills — presentational */}
              {Object.keys(resourceTotals).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resourceTotals).map(([type, count]) => (
                    <ResourcePill key={type} type={type} count={count} />
                  ))}
                </div>
              )}

              {/* Cover strip — HOTSPOT 2: each cover opens BookModal */}
              {coverMap && (
                <div className="flex flex-wrap gap-2 w-full">
                  {dedupedBooks.map((book) => {
                    const rawTitle = book.name.includes(" - ")
                      ? book.name.slice(0, book.name.lastIndexOf(" - "))
                      : book.name;
                    const titleKey = rawTitle.trim().toLowerCase();
                    const coverUrl = coverMap.get(titleKey);
                    const bookMini: BookModalBook = {
                      id: book.id,
                      titleKey,
                      coverUrl,
                      contentTypes: book.contentTypes ?? {},
                    };
                    return (
                      <div
                        key={book.id}
                        className="relative h-11 w-8 flex-shrink-0 cursor-pointer"
                        title={rawTitle.trim()}
                        onClick={(e) => { e.stopPropagation(); handleBookClick(bookMini); }}
                      >
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={rawTitle.trim()}
                            className="
                              h-full w-full rounded-sm object-cover shadow-sm
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
                              h-full w-full rounded-sm bg-muted shadow-sm
                              ring-1 ring-border
                              flex items-center justify-center
                              transition-transform duration-300 ease-out
                              hover:scale-[1.2]
                              origin-center
                              relative z-20
                            "
                          >
                            <BookOpen className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Book rows — HOTSPOT 2: each row opens BookModal */}
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto w-full">
                {author.books.map((book) => (
                  <BookRow key={book.id} book={book} onBookClick={handleBookClick} />
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── HOTSPOT 1 modal: Author bio ── */}
      <AuthorModal
        author={authorModalOpen ? author : null}
        photoUrl={photoUrl}
        onClose={() => setAuthorModalOpen(false)}
      />

      {/* ── HOTSPOT 2 modal: Book detail ── */}
      <BookModal
        book={activeBook}
        onClose={() => setActiveBook(null)}
      />
    </>
  );
}

export default FlowbiteAuthorCard;
