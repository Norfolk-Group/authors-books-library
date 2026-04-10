/**
 * AuthorAccordionRow - compact single-row author entry for the accordion/list view.
 *
 * Collapsed: chevron · avatar · name · category icon · book count · file count · bio indicator
 * Expanded:  + specialty · mini cover strip (HOTSPOT 2) · content-type pills · action row
 *
 * -- INTERACTION MODEL (exactly 3 hotspots, same as FlowbiteAuthorCard) --
 *   1. Avatar / author name → click opens AuthorModal (bio, links)
 *   2. Book cover (in expanded panel) → click opens BookModal
 *   3. Row toggle button → click expands/collapses the row
 *   "View bio" button in expanded panel → calls onBioClick (opens full bio panel in parent)
 *
 * -- DESIGN RULES --
 *   - Zero hardcoded colours - CSS tokens only
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
  Folder,
  Briefcase,
} from "lucide-react";
import { CATEGORY_ICONS, CONTENT_TYPE_ICONS, type AuthorEntry } from "@/lib/libraryData";
import { useAuthorAliases } from "@/hooks/useAuthorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { AuthorModal } from "@/components/AuthorModal";
import { BookDetailPanel } from "@/components/library/BookDetailPanel";
import type { BookRecord } from "@/lib/libraryData";
import {
  ICON_MAP,
  CT_ICON_MAP,
  normalizeContentTypes,
} from "@/components/library/libraryConstants";
import { LazyImage, CircularLazyImage } from "@/components/ui/LazyImage";

// -- LucideIcon type ------------------------------------------------------------
type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// -- Search highlight -----------------------------------------------------------
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

// -- Resource pill - presentational --------------------------------------------
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

// -- Props ----------------------------------------------------------------------
export interface AuthorAccordionRowProps {
  author: AuthorEntry;
  query: string;
  isEnriched: boolean;
  coverMap?: Map<string, string>;
  dbAvatarMap?: Map<string, string>;
  /** Called when user clicks "View bio & links" in the expanded panel */
  onBioClick: (author: AuthorEntry) => void;
}

// -- Component -----------------------------------------------------------------
export function AuthorAccordionRow({
  author,
  query,
  isEnriched,
  coverMap,
  dbAvatarMap,
  onBioClick,
}: AuthorAccordionRowProps) {
  const { canonicalName } = useAuthorAliases();
  const [open, setOpen] = useState(false);

  // -- HOTSPOT 1: Author modal --
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAuthorModalOpen(true);
  }, []);

  // -- HOTSPOT 2: Book modal --
  const [activeBook, setActiveBook] = useState<BookRecord | null>(null);
  const handleBookCoverClick = useCallback(
    (e: React.MouseEvent, book: BookRecord) => {
      e.stopPropagation();
      setActiveBook(book);
    },
    []
  );

  const displayName = useMemo(() => canonicalName(author.name), [author.name, canonicalName]);

  const specialty = useMemo(() => {
    if (!author.name.includes(" - ")) return undefined;
    const raw = author.name.slice(author.name.indexOf(" - ") + 3);
    return raw.trim() || undefined;
  }, [author.name]);

  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;

  const avatarUrl = useMemo(() => {
    return (
      dbAvatarMap?.get(displayName.toLowerCase()) ??
      getAuthorAvatar(displayName) ??
      null
    );
  }, [displayName, dbAvatarMap]);

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
        {/* -- HOTSPOT 3: Row toggle -- */}
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

          {/* HOTSPOT 1: Avatar - click opens AuthorModal */}
          <div
            className="relative h-[84px] w-[84px] flex-shrink-0 cursor-pointer"
            onClick={handleAvatarClick}
          >
            <CircularLazyImage
              src={avatarUrl}
              alt={displayName}
              size={84}
              fallbackText={displayName}
              eager
              className="ring-2 ring-border ring-offset-1 transition-transform duration-200 ease-out hover:scale-110 active:scale-95 origin-center"
            />
          </div>

          {/* HOTSPOT 1: Name + specialty - click opens AuthorModal */}
          <button
            type="button"
            onClick={handleAvatarClick}
            className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className="text-base font-bold text-card-foreground leading-snug tracking-tight block">
              <Highlight text={displayName} query={query} />
            </span>
            {specialty && (
              <span className="text-xs text-muted-foreground leading-relaxed line-clamp-1 block mt-0.5">
                <Highlight text={specialty} query={query} />
              </span>
            )}
          </button>

          {/* Category icon - presentational */}
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />

          {/* Book count - presentational */}
          <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
            <BookOpen className="w-3 h-3" />
            {dedupedBooks.length}
          </span>

          {/* File count - presentational */}
          {totalFiles > 0 && (
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
              {totalFiles} files
            </span>
          )}

          {/* Bio indicator - presentational */}
          {isEnriched && (
            <UserCheck className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          )}
        </div>

        {/* -- Expanded panel -- */}
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
                {/* Specialty - presentational */}
                {specialty && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{specialty}</p>
                )}

                {/* HOTSPOT 2: Mini cover strip - each cover opens BookModal */}
                {coverMap && dedupedBooks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dedupedBooks.map((book) => {
                      const rawTitle = book.name.includes(" - ")
                        ? book.name.slice(0, book.name.lastIndexOf(" - "))
                        : book.name;
                      const titleKey = rawTitle.trim().toLowerCase();
                      const coverUrl = coverMap.get(titleKey);
                      // Build a BookRecord-compatible shape for BookDetailPanel
                      const bookMini: BookRecord = {
                        id: book.id,
                        name: rawTitle.trim() + (displayName ? " - " + displayName : ""),
                        category: author.category,
                        contentTypes: book.contentTypes ?? {},
                      };
                      void coverUrl; // cover resolved inside BookDetailPanel via profile query
                      return (
                        <div
                          key={book.id}
                          className="relative h-20 w-14 flex-shrink-0 cursor-pointer"
                          title={rawTitle.trim()}
                          onClick={(e) => handleBookCoverClick(e, bookMini)}
                        >
                          {coverUrl ? (
                            <LazyImage
                              src={coverUrl}
                              alt={rawTitle.trim()}
                              wrapperClassName="h-full w-full rounded"
                              className="
                                h-full w-full rounded object-cover shadow-sm
                                ring-1 ring-border
                                transition-transform duration-300 ease-out
                                hover:scale-[1.2]
                                origin-center relative z-20
                              "
                            />
                          ) : (
                            <div className="
                              h-full w-full rounded bg-muted ring-1 ring-border
                              flex items-center justify-center
                              transition-transform duration-300 ease-out
                              hover:scale-[1.2]
                              origin-center
                            ">
                              <BookOpen className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Content-type pills - presentational */}
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

      {/* -- HOTSPOT 1 modal: Author bio -- */}
      <AuthorModal
        author={authorModalOpen ? author : null}
        avatarUrl={avatarUrl}
        onClose={() => setAuthorModalOpen(false)}
      />

      {/* -- HOTSPOT 2 modal: Book detail (unified BookDetailPanel, compact variant) -- */}
      {activeBook && (
        <BookDetailPanel
          book={activeBook}
          variant="compact"
          asDialog
          open={!!activeBook}
          onClose={() => setActiveBook(null)}
        />
      )}
    </>
  );
}

export default AuthorAccordionRow;
