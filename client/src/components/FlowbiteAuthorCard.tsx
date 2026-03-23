/**
 * FlowbiteAuthorCard
 *
 * Theme-compliant author card.
 *
 * -- DESIGN RULES --
 *   - Zero hardcoded hex/rgb values — CSS variable tokens only
 *   - Category identity via icon + label only
 *   - Card content is top-justified
 *
 * -- INTERACTION MODEL (3 hotspots) --
 *   1. Avatar / author name  → opens AuthorModal (bio, links)
 *   2. Book cover strip      → navigates to Books tab, highlights the book card
 *   3. Card surface          → calls onBioClick (opens bio panel in parent)
 */
import { useState, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
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
  UserCheck,
  Users,
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_ICONS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { AuthorModal } from "@/components/AuthorModal";
import { AuthorCardActions } from "@/components/AuthorCardActions";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import {
  ICON_MAP,
} from "@/components/library/libraryConstants";

// -- Shared LucideIcon type -----------------------------------------------------
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
      <mark className="bg-transparent font-bold text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// -- Card hover ref hook -------------------------------------------------------
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
  bookInfoMap?: Map<string, { summary?: string; rating?: string; ratingCount?: number }>;
  /** Navigate to the Books tab and highlight the book card with this titleKey */
  onNavigateToBook?: (titleKey: string) => void;
  /** When true, renders a highlight ring (navigation target) */
  isHighlighted?: boolean;
  /** Ref callback for scroll-to support from parent */
  cardRef?: (el: HTMLDivElement | null) => void;
  /** Map of lowercase author name -> research quality confidence level */
  researchQualityMap?: Map<string, "high" | "medium" | "low">;
  /** Whether this author is currently favorited by the logged-in user */
  isFavorite?: boolean;
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
  onNavigateToBook,
  isHighlighted,
  cardRef,
  researchQualityMap,
  isFavorite,
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
  const utils = trpc.useUtils();

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
        ref={(el) => { (ref as React.MutableRefObject<HTMLDivElement | null>).current = el; cardRef?.(el); }}
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
          className={`
            h-full overflow-hidden relative p-0
            bg-card text-card-foreground
            border border-border rounded-2xl
            shadow-sm hover:shadow-md
            transition-shadow duration-200
            flex flex-col items-stretch justify-start
            cursor-pointer
            ${isHighlighted ? "ring-2 ring-offset-2 ring-primary" : ""}
          `}
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
              {/* Right side: Bio-ready dot + favorite + actions menu */}
              <div className="shrink-0 h-[20px] flex items-center gap-1.5">
                <FavoriteToggle
                  entityType="author"
                  entityKey={displayName.toLowerCase()}
                  displayName={displayName}
                  imageUrl={avatarUrl ?? undefined}
                  initialIsFavorite={isFavorite ?? false}
                  size="sm"
                />
                {isEnriched ? (
                  <span
                    title="Bio ready"
                    className="w-2 h-2 rounded-full bg-chart-5 flex-shrink-0"
                    aria-label="Bio ready"
                  />
                ) : (
                  <span className="w-2 h-2" aria-hidden />
                )}
                {/* Per-card action menu — visible on card hover */}
                <AuthorCardActions
                  authorName={displayName}
                  hasAvatar={!!avatarUrl}
                  onBioUpdated={() => void utils.authorProfiles.getAllBios.invalidate()}
                  onLinksUpdated={() => void utils.authorProfiles.get.invalidate({ authorName: displayName })}
                />
              </div>
            </div>

              {/* HOTSPOT 1: Avatar + name group - stopPropagation so card click doesn't fire */}
            <div
              className="flex flex-col items-center gap-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Avatar - tripled to 108px, expand-on-hover */}
              <div className="relative h-28 w-28 flex-shrink-0">
                <AvatarUpload authorName={displayName} currentAvatarUrl={avatarUrl} size={112}>
                  {(url) => {
                    const springProps = {
                      whileHover: { scale: 1.12 },
                      whileTap: { scale: 0.90 },
                      transition: { type: "spring" as const, stiffness: 400, damping: 20 },
                    };
                    const avatarEl = url ? (
                      <motion.img
                        src={url}
                        alt={displayName}
                        onClick={handleAvatarClick}
                        {...springProps}
                        className="
                          h-28 w-28 rounded-full object-cover shadow-md
                          ring-2 ring-border ring-offset-2
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                        loading="lazy"
                      />
                    ) : (
                      <motion.div
                        onClick={handleAvatarClick}
                        {...springProps}
                        className="
                          h-28 w-28 rounded-full bg-muted text-muted-foreground
                          flex items-center justify-center text-3xl font-bold
                          ring-2 ring-border ring-offset-2
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                      >
                        {displayName.charAt(0)}
                      </motion.div>
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

            {/* Research Quality badge — shown only for authors processed by meticulous pipeline */}
            {(() => {
              const confidence = researchQualityMap?.get(displayName.toLowerCase());
              if (!confidence) return null;
              const badgeConfig = {
                high: { label: "High Quality", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
                medium: { label: "Medium Quality", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" },
                low: { label: "Low Quality", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
              }[confidence];
              return (
                <div className="flex justify-center mt-1 mb-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider cursor-default ${badgeConfig.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badgeConfig.dot}`} />
                        {badgeConfig.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] p-2.5">
                      <p className="text-xs font-semibold mb-0.5">Research Quality</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {confidence === "high" ? "Portrait generated from 5+ verified reference photos with consistent features." :
                         confidence === "medium" ? "Portrait generated from 2–4 reference photos; some features may vary." :
                         "Limited reference photos found; portrait accuracy may be lower."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })()}

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

          {/* -- SECTION 2: Book cover strip ─ clicking navigates to Books tab -- */}
          {hasBooks && (
            <div className="px-4 py-3 relative z-10 flex flex-col items-start gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground cursor-default">
                Books ({dedupedBooks.length})
              </p>

              {/* Cover strip — HOTSPOT 2: each cover navigates to the book card in Books tab */}
              <div className="flex flex-wrap gap-2 w-full">
                {dedupedBooks.map((book) => {
                  const rawTitle = book.name.includes(" - ")
                    ? book.name.slice(0, book.name.lastIndexOf(" - "))
                    : book.name;
                  const titleKey = rawTitle.trim().toLowerCase();
                  const coverUrl = coverMap?.get(titleKey);
                  const bookInfo = bookInfoMap?.get(titleKey);
                  const summary = bookInfo?.summary;
                  const rating = bookInfo?.rating ? parseFloat(bookInfo.rating) : null;
                  const ratingCount = bookInfo?.ratingCount ?? null;
                  const summarySnippet = summary
                    ? (() => {
                        const s = summary.trim();
                        const dot = Math.min(
                          s.indexOf('. ') > 0 ? s.indexOf('. ') + 1 : s.length,
                          120
                        );
                        return s.slice(0, dot);
                      })()
                    : null;

                  const coverEl = (
                    <motion.div
                      key={book.id}
                      className="relative h-[140px] w-[102px] flex-shrink-0 cursor-pointer"
                      whileHover={{ scale: 1.12, y: -3 }}
                      whileTap={{ scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToBook?.(titleKey);
                      }}
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={rawTitle.trim()}
                          className="
                            h-full w-full rounded-lg object-cover shadow-md
                            ring-1 ring-border
                          "
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="
                            h-full w-full rounded-lg bg-muted shadow-md
                            ring-1 ring-border
                            flex items-center justify-center
                          "
                        >
                          <BookOpen className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      {/* Book title overlay on hover */}
                      <div className="
                        absolute inset-x-0 bottom-0 rounded-b-lg
                        bg-gradient-to-t from-black/70 to-transparent
                        px-1.5 py-1
                        opacity-0 group-hover/cover:opacity-100
                        transition-opacity duration-200
                        pointer-events-none
                      ">
                        <p className="text-white text-[9px] font-medium leading-tight line-clamp-2">{rawTitle.trim()}</p>
                      </div>
                    </motion.div>
                  );

                  if (!summarySnippet && !rating) {
                    return <div key={book.id} className="group/cover">{coverEl}</div>;
                  }
                  return (
                    <Tooltip key={book.id}>
                      <TooltipTrigger asChild>
                        <div className="group/cover">{coverEl}</div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[220px] p-2.5 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="font-semibold text-xs mb-1 leading-snug">{rawTitle.trim()}</p>
                        {rating !== null && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-amber-400 text-xs">{"★".repeat(Math.round(rating))}{"☆".repeat(Math.max(0, 5 - Math.round(rating)))}</span>
                            <span className="text-xs font-medium text-foreground">{rating.toFixed(1)}</span>
                            {ratingCount !== null && ratingCount > 0 && (
                              <span className="text-xs text-muted-foreground">({ratingCount.toLocaleString()})</span>
                            )}
                          </div>
                        )}
                        {summarySnippet && (
                          <p className="text-xs leading-relaxed text-muted-foreground">{summarySnippet}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 italic">Click to view in Books tab</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
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

      {/* Book modal removed — covers now navigate to Books tab via onNavigateToBook */}
    </>
  );
}

export default FlowbiteAuthorCard;
