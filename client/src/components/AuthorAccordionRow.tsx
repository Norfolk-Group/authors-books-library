/**
 * AuthorAccordionRow — compact single-row author entry for the accordion/list view.
 *
 * Collapsed: chevron · avatar · name · category icon · book count · file count · bio indicator
 * Expanded:  + specialty · mini cover strip (HOTSPOT 2) · content-type pills · action row
 *
 * ── INTERACTION MODEL (exactly 3 hotspots, same as FlowbiteAuthorCard) ──
 *   1. Avatar / author name → click opens AuthorModal (bio, links)
 *   2. Book cover (in expanded panel) → click opens BookModal
 *   3. Row toggle button → click expands/collapses the row
 *   "View bio" button in expanded panel → calls onBioClick (opens full bio panel in parent)
 *
 * ── DESIGN RULES ──
 *   - Zero hardcoded colours — CSS tokens only
 *   - Category identity via icon only
 *   - Smooth height animation via Framer Motion AnimatePresence
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UserCheck,
  Users,
  FileText,
  AlignLeft,
  Book,
  File,
  Video,
  Image,
  Package,
  Folder,
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
  Scroll,
  Newspaper,
  Link,
  List,
} from "lucide-react";
import { CATEGORY_ICONS, CONTENT_TYPE_ICONS, type AuthorEntry } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { AuthorModal } from "@/components/AuthorModal";
import { BookModal, type BookModalBook } from "@/components/BookModal";

// ── LucideIcon type ────────────────────────────────────────────────────────────
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
      <mark className="bg-transparent font-bold text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Resource pill — presentational ────────────────────────────────────────────
function ResourcePill({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground cursor-default select-none">
      <Icon className="w-2.5 h-2.5" />
      {type} · {count}
    </span>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface AuthorAccordionRowProps {
  author: AuthorEntry;
  query: string;
  isEnriched: boolean;
  coverMap?: Map<string, string>;
  dbPhotoMap?: Map<string, string>;
  /** Called when user clicks "View bio & links" in the expanded panel */
  onBioClick: (author: AuthorEntry) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AuthorAccordionRow({
  author,
  query,
  isEnriched,
  coverMap,
  dbPhotoMap,
  onBioClick,
}: AuthorAccordionRowProps) {
  const [open, setOpen] = useState(false);

  // ── HOTSPOT 1: Author modal ──
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAuthorModalOpen(true);
  }, []);

  // ── HOTSPOT 2: Book modal ──
  const [activeBook, setActiveBook] = useState<BookModalBook | null>(null);
  const handleBookCoverClick = useCallback(
    (e: React.MouseEvent, book: BookModalBook) => {
      e.stopPropagation();
      setActiveBook(book);
    },
    []
  );

  const displayName = useMemo(() => canonicalName(author.name), [author.name]);

  const specialty = useMemo(() => {
    if (!author.name.includes(" - ")) return undefined;
    const raw = author.name.slice(author.name.indexOf(" - ") + 3);
    return raw.trim() || undefined;
  }, [author.name]);

  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;

  const photoUrl = useMemo(() => {
    return (
      dbPhotoMap?.get(displayName.toLowerCase()) ??
      getAuthorPhoto(displayName) ??
      null
    );
  }, [displayName, dbPhotoMap]);

  // Deduplicated books
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

  // Aggregate content-type totals
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const book of author.books ?? []) {
      for (const [k, v] of Object.entries(normalizeContentTypes(book.contentTypes ?? {}))) {
        t[k] = (t[k] ?? 0) + v;
      }
    }
    return t;
  }, [author.books]);

  const totalFiles = Object.values(totals).reduce((s, n) => s + n, 0);

  return (
    <>
      <div className="border-b border-border last:border-0">
        {/* ── HOTSPOT 3: Row toggle ── */}
        <div className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors">
          {/* Expand chevron */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex-shrink-0 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {/* HOTSPOT 1: Avatar — click opens AuthorModal */}
          <div
            className="relative h-7 w-7 flex-shrink-0 cursor-pointer"
            onClick={handleAvatarClick}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="
                  h-7 w-7 rounded-full object-cover ring-1 ring-border
                  transition-transform duration-300 ease-out hover:scale-[1.15]
                  origin-center
                "
                loading="lazy"
              />
            ) : (
              <div className="
                h-7 w-7 rounded-full bg-muted ring-1 ring-border
                flex items-center justify-center text-[10px] font-bold text-muted-foreground
                transition-transform duration-300 ease-out hover:scale-[1.15]
                origin-center
              ">
                {displayName.charAt(0)}
              </div>
            )}
          </div>

          {/* HOTSPOT 1: Name — click opens AuthorModal */}
          <button
            type="button"
            onClick={handleAvatarClick}
            className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className="text-sm font-medium text-card-foreground truncate block">
              <Highlight text={displayName} query={query} />
            </span>
          </button>

          {/* Category icon — presentational */}
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />

          {/* Book count — presentational */}
          <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
            <BookOpen className="w-3 h-3" />
            {dedupedBooks.length}
          </span>

          {/* File count — presentational */}
          {totalFiles > 0 && (
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
              {totalFiles} files
            </span>
          )}

          {/* Bio indicator — presentational */}
          {isEnriched && (
            <UserCheck className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          )}
        </div>

        {/* ── Expanded panel ── */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-10 pb-3 flex flex-col gap-3">
                {/* Specialty — presentational */}
                {specialty && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{specialty}</p>
                )}

                {/* HOTSPOT 2: Mini cover strip — each cover opens BookModal */}
                {coverMap && dedupedBooks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
                          className="relative h-10 w-7 flex-shrink-0 cursor-pointer"
                          title={rawTitle.trim()}
                          onClick={(e) => handleBookCoverClick(e, bookMini)}
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
                                origin-center relative z-20
                              "
                              loading="lazy"
                            />
                          ) : (
                            <div className="
                              h-full w-full rounded-sm bg-muted ring-1 ring-border
                              flex items-center justify-center
                              transition-transform duration-300 ease-out
                              hover:scale-[1.2]
                              origin-center
                            ">
                              <BookOpen className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Content-type pills — presentational */}
                {Object.keys(totals).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(totals).map(([type, count]) => (
                      <ResourcePill key={type} type={type} count={count} />
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBioClick(author); }}
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                  >
                    {isEnriched ? (
                      <><UserCheck className="w-3 h-3" /> View bio &amp; links</>
                    ) : (
                      <><Users className="w-3 h-3" /> View bio &amp; links</>
                    )}
                  </button>
                  <a
                    href={`https://drive.google.com/drive/folders/${author.id}?view=grid`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Drive
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

export default AuthorAccordionRow;
