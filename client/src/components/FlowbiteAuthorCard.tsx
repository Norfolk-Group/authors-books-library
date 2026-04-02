/**
 * FlowbiteAuthorCard — Strict 4-Zone Grid Layout (Redesigned)
 *
 * ┌─ 3px category color left-border ──────────────────────────────────────┐
 * │  ZONE 1+2: Top row (h-[124px])                                        │
 * │  ┌──────────────────┐  ┌─────────────────────────────────────────────┐│
 * │  │  Avatar 96×96px  │  │  Category label · Controls row             ││
 * │  │  (square, HOTSPOT│  │  Quality · Rich · Digital Me badges        ││
 * │  │   1 click)       │  │  Platform pills (fills remaining height)   ││
 * │  └──────────────────┘  └─────────────────────────────────────────────┘│
 * │  ZONE 3: Author info (h-[84px])                                       │
 * │  Name · Specialty · Bio snippet                                       │
 * │  ZONE 4: Tags + Interest pills (h-[36px])                             │
 * │  ZONE 5: Content shelf (h-[120px])                                    │
 * │  Horizontal scrolling book covers with always-visible title labels    │
 * │  ZONE 6: Actions bar (h-[40px])                                       │
 * │  Why this author? · Chat · Profile →                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN RULES (webdev-card-system + webdev-theme-aware-cards skills):
 *   - Zero hardcoded hex/rgb on backgrounds — CSS variable tokens only
 *   - Category identity via 3px left border stripe (CATEGORY_COLORS) + icon
 *   - Category-tinted gradient overlay (8% opacity) on card background
 *   - All zones have fixed heights → uniform grid alignment
 *   - Apple fluid glass: backdrop-blur-xl + semi-transparent bg-card/85
 *   - 3-hotspot model: avatar, book cover, card surface
 *   - All buttons have 3D appearance + hover/click effects
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
  ArrowRight,
  Star,
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
import { TagPicker } from "@/components/TagPicker";
import { WhyThisAuthor } from "@/components/library/WhyThisAuthor";
import { FreshnessDot, type FreshnessDimension, computeOverallFreshness } from "@/components/library/FreshnessDot";
import { ICON_MAP } from "@/components/library/libraryConstants";
import { isLikelyAuthorName } from "@shared/authorNameValidator";
import { AlertTriangle, Brain, Cpu } from "lucide-react";

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
  /** Tag slugs currently applied to this author — passed from authorTagsMap */
  currentTagSlugs?: string[];
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
  currentTagSlugs = [],
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

  // Bio snippet (first ~180 chars)
  const bioSnippet = useMemo(() => {
    if (!bio || !isEnriched) return null;
    const trimmed = bio.trim();
    if (trimmed.length <= 180) return trimmed;
    const cut = trimmed.slice(0, 180);
    const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return lastDot > 60 ? trimmed.slice(0, lastDot + 1) : cut + '…';
  }, [bio, isEnriched]);

  // Research quality badge
  const qualityBadge = useMemo(() => {
    const confidence = researchQualityMap?.get(displayName.toLowerCase());
    if (!confidence) return null;
    const cfg = {
      high: {
        label: "High",
        bg: "bg-emerald-500/12 dark:bg-emerald-500/20",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        ring: "ring-emerald-500/30",
      },
      medium: {
        label: "Med",
        bg: "bg-amber-500/12 dark:bg-amber-500/20",
        text: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
        ring: "ring-amber-500/30",
      },
      low: {
        label: "Low",
        bg: "bg-rose-500/12 dark:bg-rose-500/20",
        text: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
        ring: "ring-rose-500/30",
      },
    };
    return cfg[confidence] ?? null;
  }, [researchQualityMap, displayName]);

  // Suspicious name detection
  const isSuspiciousName = useMemo(() => !isLikelyAuthorName(displayName), [displayName]);

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

  // Hex to rgba helper for category tint
  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(107,114,128,${alpha})`;
    return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
  }, []);

  return (
    <>
      <motion.div
        ref={(el) => {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          cardRef?.(el);
        }}
        className="card-animate group h-full"
        whileHover={{ scale: 1.018, y: -3 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
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
            "bg-card/85 backdrop-blur-xl text-card-foreground",
            "border border-border/60 rounded-2xl",
            "shadow-sm hover:shadow-xl",
            "transition-all duration-200",
            "flex flex-col items-stretch",
            "cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isHighlighted ? "ring-2 ring-offset-2 ring-primary" : "",
          ].join(" ")}
          style={{ borderLeft: `3px solid ${categoryColor}` }}
        >
          {/* Category-tinted gradient overlay — soft nuanced background per category */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${hexToRgba(categoryColor, 0.07)} 0%, ${hexToRgba(categoryColor, 0.02)} 45%, transparent 70%)`,
            }}
            aria-hidden
          />

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

          {/* Category watermark — bottom-right ghost icon */}
          <div className="pointer-events-none absolute bottom-10 right-2 select-none" aria-hidden>
            <Icon className="w-16 h-16 text-foreground opacity-[0.03]" strokeWidth={1} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 1 + 2: Top row — Avatar (left) + Metadata (right)
              Fixed height: 124px
          ═══════════════════════════════════════════════════════════ */}
          <div className="flex flex-row items-start gap-3 p-3 h-[124px] flex-shrink-0 relative z-[1]">

            {/* ZONE 1: Avatar square 96×96 — HOTSPOT 1 */}
            <div
              className="flex-shrink-0 w-[96px] h-[96px] rounded-xl overflow-hidden bg-muted ring-1 ring-border/80 shadow-md cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
              onClick={handleAvatarClick}
              title={`View ${displayName}'s profile`}
            >
              <AvatarUpload authorName={displayName} currentAvatarUrl={avatarUrl} size={96}>
                {(url) => url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-3xl font-bold select-none"
                    style={{
                      background: `linear-gradient(135deg, ${hexToRgba(categoryColor, 0.18)} 0%, ${hexToRgba(categoryColor, 0.08)} 100%)`,
                      color: categoryColor,
                    }}
                  >
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

              {/* Row 2: Status badges — pill style with ring */}
              <div className="flex items-center gap-1 flex-wrap">
                {qualityBadge && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 ${qualityBadge.bg} ${qualityBadge.text} ${qualityBadge.ring}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${qualityBadge.dot} flex-shrink-0`} />
                    {qualityBadge.label}
                  </span>
                )}
                {hasRichBio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-teal-500/30 cursor-help">
                        <Brain className="w-2.5 h-2.5" />
                        Rich
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[180px]">
                      Full biography available
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasDigitalMe && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-violet-500/10 text-violet-700 dark:text-violet-400 ring-violet-500/30 cursor-help">
                        <Cpu className="w-2.5 h-2.5" />
                        Digital Me
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[180px]">
                      AI persona ready — chat with this author
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Row 3: Platform pills (fills remaining height) */}
              <div className="flex-1 flex items-end">
                {platformLinks && <PlatformPills links={platformLinks} maxVisible={6} size="sm" />}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 3: Author Info — full-width, fixed h-[84px]
          ═══════════════════════════════════════════════════════════ */}
          <div className="px-3 h-[84px] flex-shrink-0 flex flex-col justify-start gap-0.5 border-t border-border/40 pt-2 pb-1 relative z-[1]">
            {/* Name row — HOTSPOT 1 */}
            <div className="flex items-center gap-1.5">
              <h3
                className="text-[13px] font-bold text-card-foreground leading-tight tracking-tight line-clamp-1 cursor-pointer hover:text-primary transition-colors flex-1 min-w-0"
                onClick={handleAvatarClick}
              >
                <Highlight text={displayName} query={query} />
              </h3>
              {isSuspiciousName && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30 cursor-help">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      ??
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    This name may be a book title or topic phrase rather than a person. Check the Drive folder and delete if incorrect.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Specialty — italic, muted */}
            {specialty && (
              <p className="text-[11px] text-muted-foreground/80 italic line-clamp-1 leading-relaxed">
                <Highlight text={specialty} query={query} />
              </p>
            )}

            {/* Bio snippet or status hint */}
            <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
              {bioSnippet ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">{bioSnippet}</span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-[300px] p-3 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="font-semibold text-xs mb-1">{displayName}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{bioSnippet}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">Click the card to view full profile →</p>
                  </TooltipContent>
                </Tooltip>
              ) : isEnriched ? (
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  <UserCheck className="w-3 h-3 flex-shrink-0" />
                  <span>Bio ready · click to view</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground/60">
                  <Users className="w-3 h-3 flex-shrink-0" />
                  <span>Click to view bio &amp; links</span>
                </span>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 4: Tags + Interest Alignment — fixed h-[36px]
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="px-3 h-[36px] flex-shrink-0 flex items-center gap-2 border-t border-border/40 relative z-[1]"
            onClick={(e) => e.stopPropagation()}
          >
            <InterestAlignmentPills authorName={displayName} maxPills={3} />
            <div className="flex-1" />
            <TagPicker
              entityType="author"
              entityKey={displayName}
              currentTagSlugs={currentTagSlugs}
              showApplied
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 5: Content Shelf — fixed h-[120px]
              Horizontal scrolling book covers — HOTSPOT 2
          ═══════════════════════════════════════════════════════════ */}
          <div className="border-t border-border/40 flex-shrink-0 relative z-[1]">
            {hasBooks ? (
              <div className="px-3 py-2 h-[120px] flex flex-col gap-1.5">
                {/* Shelf header with count badge */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Books
                  </p>
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                    style={{
                      background: hexToRgba(categoryColor, 0.15),
                      color: categoryColor,
                    }}
                  >
                    {dedupedBooks.length}
                  </span>
                </div>
                {/* Cover strip */}
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
                        className="relative h-[80px] w-[56px] flex-shrink-0 cursor-pointer rounded-md overflow-hidden shadow-sm ring-1 ring-border/70 group/cover"
                        whileHover={{ scale: 1.1, y: -3 }}
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
                          <div
                            className="h-full w-full flex flex-col items-center justify-center gap-1 px-1"
                            style={{
                              background: `linear-gradient(160deg, ${hexToRgba(categoryColor, 0.12)} 0%, ${hexToRgba(categoryColor, 0.06)} 100%)`,
                            }}
                          >
                            <BookOpen className="w-4 h-4" style={{ color: categoryColor }} />
                            <p
                              className="text-[7px] font-medium text-center leading-tight line-clamp-3"
                              style={{ color: categoryColor }}
                            >
                              {rawTitle.trim()}
                            </p>
                          </div>
                        )}
                        {/* Hover overlay with title */}
                        {coverUrl && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-1 py-0.5 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <p className="text-white text-[7px] font-medium leading-tight line-clamp-2">{rawTitle.trim()}</p>
                          </div>
                        )}
                      </motion.div>
                    );

                    if (!summarySnippet && !rating) {
                      return <div key={book.id}>{coverEl}</div>;
                    }
                    return (
                      <Tooltip key={book.id}>
                        <TooltipTrigger asChild>
                          <div>{coverEl}</div>
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
                <span className="text-[10px] text-muted-foreground/40 italic">No books yet</span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 6: Actions bar — fixed h-[40px]
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="border-t border-border/40 h-[40px] flex-shrink-0 flex items-center justify-between px-3 gap-2 relative z-[1]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Why this author? */}
            <WhyThisAuthor authorName={displayName} />

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Chat with Digital Me — violet 3D button */}
              {hasDigitalMe && (
                <Link
                  href={`/chat/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}`}
                  className={[
                    "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold no-underline",
                    "bg-violet-600 text-white",
                    "shadow-[0_2px_0_0_rgba(109,40,217,0.8),0_1px_2px_rgba(0,0,0,0.2)]",
                    "hover:bg-violet-500 hover:shadow-[0_3px_0_0_rgba(109,40,217,0.8),0_2px_4px_rgba(0,0,0,0.2)]",
                    "active:shadow-none active:translate-y-[1px]",
                    "transition-all duration-100",
                  ].join(" ")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle className="w-3 h-3" />
                  Chat
                </Link>
              )}
              {/* View Full Profile — 3D button */}
              <Link
                href={`/author/${encodeURIComponent(displayName)}`}
                className={[
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold no-underline",
                  "bg-secondary text-secondary-foreground",
                  "shadow-[0_2px_0_0_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]",
                  "hover:bg-secondary/80 hover:shadow-[0_3px_0_0_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.08)]",
                  "active:shadow-none active:translate-y-[1px]",
                  "transition-all duration-100",
                ].join(" ")}
                onClick={(e) => e.stopPropagation()}
              >
                <ArrowRight className="w-3 h-3" />
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
