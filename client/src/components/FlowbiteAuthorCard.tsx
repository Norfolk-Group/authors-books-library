/**
 * FlowbiteAuthorCard — 4-Zone Grid Layout
 *
 * ┌─ 3px category color left-border ──────────────────────────────────────┐
 * │  ZONE 1+2: Top row (h-[112px])                                        │
 * │  ┌─────────────────┐  ┌──────────────────────────────────────────────┐│
 * │  │  Avatar 88×88px │  │  Category label · Badges row                ││
 * │  │  (square, HOTSPOT│  │  Quality · Digital Me · Rich Bio            ││
 * │  │   1 click)      │  │  Platform pills                             ││
 * │  └─────────────────┘  └──────────────────────────────────────────────┘│
 * │  ZONE 3: Author info (h-[80px])                                       │
 * │  Name · Specialty · Bio snippet                                       │
 * │  ZONE 4: Interest pills (h-[32px])                                    │
 * │  ZONE 5: Content shelf (h-[120px])                                    │
 * │  Horizontal scrolling book covers                                     │
 * │  ZONE 6: Actions bar (h-[40px])                                       │
 * │  Why this author? · Chat · Profile →                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN RULES (webdev-card-system + webdev-theme-aware-cards skills):
 *   - Zero hardcoded hex/rgb on backgrounds — CSS variable tokens only
 *   - Category identity via 3px left border stripe (CATEGORY_COLORS) + icon
 *   - All zones have fixed heights → uniform grid alignment
 *   - Apple fluid glass: backdrop-blur + semi-transparent bg-card/80
 *   - 3-hotspot model: avatar, book cover, card surface
 */
import { useState, useCallback, useRef, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  UserCheck,
  Users,
  MessageCircle,
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { AuthorModal } from "@/components/AuthorModal";
import { AuthorCardActions } from "@/components/AuthorCardActions";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { PlatformPills } from "@/components/library/PlatformPills";
import { InterestAlignmentPills } from "@/components/library/InterestAlignmentPills";
import { WhyThisAuthor } from "@/components/library/WhyThisAuthor";
import { FreshnessDot, type FreshnessDimension, computeOverallFreshness } from "@/components/library/FreshnessDot";
import { ICON_MAP } from "@/components/library/libraryConstants";

// -- Shared LucideIcon type ---------------------------------------------------
type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// -- Search highlight ---------------------------------------------------------
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-[2px] px-[1px]">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// -- Card hover ref hook ------------------------------------------------------
function useCardHover() {
  const ref = useRef<HTMLDivElement>(null);
  return { ref };
}

// -- Props --------------------------------------------------------------------
export interface FlowbiteAuthorCardProps {
  author: AuthorEntry;
  query: string;
  /** HOTSPOT 3: called when the user clicks the card surface */
  onBioClick: (a: AuthorEntry) => void;
  isEnriched?: boolean;
  coverMap?: Map<string, string>;
  /** Kept for API compatibility */
  onBookClick?: (bookId: string, titleKey: string) => void;
  dbAvatarMap?: Map<string, string>;
  bio?: string | null;
  bookInfoMap?: Map<string, { summary?: string; rating?: string; ratingCount?: number }>;
  onNavigateToBook?: (titleKey: string) => void;
  isHighlighted?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  researchQualityMap?: Map<string, "high" | "medium" | "low">;
  isFavorite?: boolean;
  hasRichBio?: boolean;
  freshnessDimensions?: FreshnessDimension[];
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  platformLinks?: {
    websiteUrl?: string | null;
    businessWebsiteUrl?: string | null;
    youtubeUrl?: string | null;
    twitterUrl?: string | null;
    linkedinUrl?: string | null;
    substackUrl?: string | null;
    mediumUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    tiktokUrl?: string | null;
    githubUrl?: string | null;
    podcastUrl?: string | null;
    newsletterUrl?: string | null;
    speakingUrl?: string | null;
    blogUrl?: string | null;
  } | null;
}

// -- Main component -----------------------------------------------------------
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
  platformLinks,
  hasRichBio,
  freshnessDimensions,
  onEditClick,
  onDeleteClick,
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

  // Category color for left border stripe (theme-aware-cards skill rule)
  const categoryColor = (CATEGORY_COLORS as Record<string, string>)[author.category] ?? "#6b7280";

  // -- HOTSPOT 1: Author modal --
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

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

  // Bio snippet (first ~200 chars)
  const bioSnippet = useMemo(() => {
    if (!bio || !isEnriched) return null;
    const trimmed = bio.trim();
    if (trimmed.length <= 200) return trimmed;
    const cut = trimmed.slice(0, 200);
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return lastDot > 80 ? trimmed.slice(0, lastDot + 1) : cut + '…';
  }, [bio, isEnriched]);

  // Research quality badge
  const qualityBadge = useMemo(() => {
    const confidence = researchQualityMap?.get(displayName.toLowerCase());
    if (!confidence) return null;
    const cfg = {
      high: { label: "High", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
      medium: { label: "Med", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
      low: { label: "Low", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
    };
    return cfg[confidence] ?? null;
  }, [researchQualityMap, displayName]);

  // Overall freshness
  const overallFreshness = useMemo(
    () => (freshnessDimensions ? computeOverallFreshness(freshnessDimensions) : null),
    [freshnessDimensions]
  );

  // Digital Me RAG status
  const { data: ragStatus } = trpc.ragPipeline.getStatus.useQuery(
    { authorName: displayName },
    { staleTime: 60_000 }
  );
  const hasDigitalMe = ragStatus?.ragStatus === "ready";

  return (
    <>
      <motion.div
        ref={(el) => {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          cardRef?.(el);
        }}
        className="card-animate group h-full"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* HOTSPOT 3: card surface click */}
        <div
          onClick={() => onBioClick(author)}
          tabIndex={0}
          role="button"
          aria-label={`View bio for ${displayName}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onBioClick(author);
            }
          }}
          className={[
            "h-full overflow-hidden relative",
            "bg-card/80 backdrop-blur-md text-card-foreground",
            "border border-border rounded-2xl",
            "shadow-sm hover:shadow-lg",
            "transition-all duration-200",
            "flex flex-col items-stretch",
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isHighlighted ? "ring-2 ring-offset-2 ring-primary" : "",
          ].join(" ")}
          style={{ borderLeft: `3px solid ${categoryColor}` }}
        >
          {/* Loading overlay */}
          {isMutating && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-1.5">
                <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[9px] font-medium text-muted-foreground">Enriching…</span>
              </div>
            </div>
          )}

          {/* Category watermark */}
          <div className="pointer-events-none absolute bottom-10 right-2 select-none" aria-hidden>
            <Icon className="w-14 h-14 text-foreground opacity-[0.035]" strokeWidth={1} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 1 + 2: Top row — Avatar (left) + Metadata (right)
              Fixed height: 112px
          ═══════════════════════════════════════════════════════════ */}
          <div className="flex flex-row items-start gap-3 p-3 h-[112px] flex-shrink-0">

            {/* ZONE 1: Avatar square 88×88 — HOTSPOT 1 */}
            <div
              className="flex-shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden bg-muted ring-1 ring-border shadow-sm cursor-pointer"
              onClick={handleAvatarClick}
            >
              <AvatarUpload authorName={displayName} currentAvatarUrl={avatarUrl} size={88}>
                {(url) => url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-3xl font-bold select-none">
                    {displayName.charAt(0)}
                  </div>
                )}
              </AvatarUpload>
            </div>

            {/* ZONE 2: Metadata panel */}
            <div
              className="flex-1 min-w-0 flex flex-col gap-1 h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Row 1: Category label + controls */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Icon
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: categoryColor }}
                    strokeWidth={2}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.08em] truncate"
                    style={{ color: categoryColor }}
                    title={author.category}
                  >
                    {author.category.split(" & ")[0]}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <FavoriteToggle
                    entityType="author"
                    entityKey={displayName.toLowerCase()}
                    displayName={displayName}
                    imageUrl={avatarUrl ?? undefined}
                    initialIsFavorite={isFavorite ?? false}
                    size="sm"
                  />
                  {freshnessDimensions ? (
                    <FreshnessDot
                      overall={computeOverallFreshness(freshnessDimensions)}
                      dimensions={freshnessDimensions}
                      size="sm"
                    />
                  ) : isEnriched ? (
                    <span
                      title="Bio ready"
                      className="w-2 h-2 rounded-full bg-chart-5 flex-shrink-0"
                      aria-label="Bio ready"
                    />
                  ) : (
                    <span className="w-2 h-2" aria-hidden />
                  )}
                  <AuthorCardActions
                    authorName={displayName}
                    hasAvatar={!!avatarUrl}
                    onBioUpdated={() => void utils.authorProfiles.getAllBios.invalidate()}
                    onLinksUpdated={() => void utils.authorProfiles.get.invalidate({ authorName: displayName })}
                    onMutatingChange={setIsMutating}
                    onEditClick={onEditClick}
                    onDeleteClick={onDeleteClick}
                  />
                </div>
              </div>

              {/* Row 2: Status badges */}
              <div className="flex items-center gap-1 flex-wrap">
                {qualityBadge && (
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${qualityBadge.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityBadge.dot} flex-shrink-0`} />
                    {qualityBadge.label}
                  </span>
                )}
                {hasRichBio && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    <span className="w-1 h-1 rounded-full bg-teal-500 flex-shrink-0" />
                    Rich
                  </span>
                )}
                {hasDigitalMe && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <span className="w-1 h-1 rounded-full bg-violet-500 flex-shrink-0" />
                    Digital Me
                  </span>
                )}
              </div>

              {/* Row 3: Platform pills (fills remaining height) */}
              <div className="flex-1 flex items-end">
                {platformLinks && <PlatformPills links={platformLinks} maxVisible={6} size="sm" />}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 3: Author Info — full-width, fixed h-[80px]
          ═══════════════════════════════════════════════════════════ */}
          <div className="px-3 h-[80px] flex-shrink-0 flex flex-col justify-start gap-0.5 border-t border-border/50 pt-2 pb-1">
            {/* Name — HOTSPOT 1 */}
            <h3
              className="text-sm font-bold text-card-foreground leading-tight tracking-tight line-clamp-1 cursor-pointer hover:text-primary transition-colors"
              onClick={handleAvatarClick}
            >
              <Highlight text={displayName} query={query} />
            </h3>
            {/* Specialty */}
            {specialty && (
              <p className="text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
                <Highlight text={specialty} query={query} />
              </p>
            )}
            {/* Bio snippet or status */}
            <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
              {bioSnippet ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">{bioSnippet}</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-[280px] p-3 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="font-semibold text-xs mb-1">{displayName}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{bioSnippet}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">Click the card to view full profile →</p>
                  </TooltipContent>
                </Tooltip>
              ) : isEnriched ? (
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 flex-shrink-0" />
                  <span>Bio ready · click to view</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 flex-shrink-0" />
                  <span>Click to view bio &amp; links</span>
                </span>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 4: Interest Alignment Pills — fixed h-[32px]
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="px-3 h-[32px] flex-shrink-0 flex items-center border-t border-border/50"
            onClick={(e) => e.stopPropagation()}
          >
            <InterestAlignmentPills authorName={displayName} maxPills={4} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 5: Content Shelf — fixed h-[120px]
              Horizontal scrolling book covers — HOTSPOT 2
          ═══════════════════════════════════════════════════════════ */}
          <div className="border-t border-border/50 flex-shrink-0">
            {hasBooks ? (
              <div className="px-3 py-2 h-[120px] flex flex-col gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground flex-shrink-0">
                  Books ({dedupedBooks.length})
                </p>
                <div
                  className="flex gap-2 overflow-x-auto scrollbar-none flex-1 items-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {dedupedBooks.map((book) => {
                    const rawTitle = book.name.includes(" - ")
                      ? book.name.slice(0, book.name.lastIndexOf(" - "))
                      : book.name;
                    const titleKey = rawTitle.trim().toLowerCase();
                    const coverUrl = coverMap?.get(titleKey);
                    const bookInfo = bookInfoMap?.get(titleKey);
                    const rating = bookInfo?.rating ? parseFloat(bookInfo.rating) : null;
                    const ratingCount = bookInfo?.ratingCount ?? null;
                    const summary = bookInfo?.summary ?? null;
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
                        className="relative h-[80px] w-[56px] flex-shrink-0 cursor-pointer rounded-md overflow-hidden shadow-sm ring-1 ring-border"
                        whileHover={{ scale: 1.1, y: -2 }}
                        whileTap={{ scale: 0.94 }}
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
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-muted flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        {/* Title overlay on hover */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <p className="text-white text-[8px] font-medium leading-tight line-clamp-2">{rawTitle.trim()}</p>
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
                          className="max-w-[240px] p-2.5 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-semibold text-xs mb-1 leading-snug">{rawTitle.trim()}</p>
                          {rating !== null && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-amber-400 text-xs">{"★".repeat(Math.round(rating))}{"☆".repeat(Math.max(0, 5 - Math.round(rating)))}</span>
                              <span className="text-xs font-medium">{rating.toFixed(1)}</span>
                              {ratingCount !== null && ratingCount > 0 && (
                                <span className="text-xs text-muted-foreground">({ratingCount.toLocaleString()})</span>
                              )}
                            </div>
                          )}
                          {summarySnippet && (
                            <p className="text-xs leading-relaxed text-muted-foreground">{summarySnippet}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5 italic">Click to view in Books tab →</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[120px] flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/50 italic">No books yet</span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 6: Actions bar — fixed h-[40px]
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="border-t border-border/50 h-[40px] flex-shrink-0 flex items-center justify-between px-3 gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Why this author? */}
            <WhyThisAuthor authorName={displayName} />

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Chat with Digital Me */}
              {hasDigitalMe && (
                <Link
                  href={`/chat/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/60 transition-colors no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-3 h-3" />
                  Chat
                </Link>
              )}
              {/* View Full Profile */}
              <Link
                href={`/author/${encodeURIComponent(displayName)}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Profile
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* HOTSPOT 1 modal */}
      <AuthorModal
        author={authorModalOpen ? author : null}
        avatarUrl={avatarUrl}
        onClose={() => setAuthorModalOpen(false)}
      />
    </>
  );
}

export default FlowbiteAuthorCard;
