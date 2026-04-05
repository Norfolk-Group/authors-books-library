/**
 * FlowbiteAuthorCard — Filing-Folder Tab Layout (v3)
 *
 * ┌─ 3px category color left-border ──────────────────────────────────────┐
 * │  ┌──────────┐ ┌────────────┐   ← Filing-folder tabs (raised/recessed) │
 * │  │  ● Info  │ │  Books ▸   │                                           │
 * │  └──────────┘ └────────────┘                                           │
 * │  ─────────────────────────────────────────────────────────────────────│
 * │  TAB 1 — Info                                                          │
 * │    ZONE A: Avatar + Metadata (category, controls, badges)              │
 * │    ZONE B: Name + Specialty + Bio snippet                              │
 * │    ZONE C: Platform pills + Interest alignment + Tags                  │
 * │  TAB 2 — Books & Substack                                              │
 * │    ZONE A: Book cover shelf (scrollable)                               │
 * │    ZONE B: Substack latest 2 posts preview                             │
 * │  ─────────────────────────────────────────────────────────────────────│
 * │  ZONE 6: Actions bar (always visible)                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN RULES:
 *   - Zero hardcoded hex/rgb on backgrounds — CSS variable tokens only
 *   - Category identity via 3px left border stripe (CATEGORY_COLORS) + icon
 *   - Apple fluid glass: backdrop-blur-xl + semi-transparent bg-card/85
 *   - Tab labels styled as physical filing folder tabs (rounded-t, raised active)
 *   - Smooth cross-fade animation between tabs
 */
import { useState, useCallback, useRef, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  UserCheck,
  Users,
  MessageCircle,
  ArrowRight,
  Star,
  ExternalLink,
  Rss,
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
    authorId?: number | null;
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
    /** Raw JSON string from socialStatsJson column — parsed for Substack post count */
    socialStatsJson?: string | null;
  } | null;
}

// -- Tab type -----------------------------------------------------------------
type CardTab = "info" | "books";

// -- Substack mini-preview (Tab 2) -------------------------------------------
function SubstackMiniPreview({ authorId, substackUrl }: { authorId: number; substackUrl: string }) {
  const { data, isLoading } = trpc.substack.getPostsByAuthor.useQuery(
    { authorId, limit: 2 },
    { staleTime: 10 * 60_000, enabled: !!authorId }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.posts?.length) {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/60 italic">
        <Rss className="w-3 h-3" />
        No recent posts
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex items-center gap-1 mb-0.5">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-orange-500 flex-shrink-0" aria-hidden="true">
          <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-orange-600 dark:text-orange-400">
          {data.publicationName || "Substack"}
        </span>
        <a
          href={substackUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title="Open Substack"
        >
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
      {data.posts.map((post) => (
        <a
          key={post.id}
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="group/post flex flex-col gap-0.5 p-1.5 rounded-md hover:bg-muted/60 transition-colors no-underline"
        >
          <span className="text-[10px] font-semibold text-card-foreground group-hover/post:text-primary transition-colors line-clamp-1 leading-snug">
            {post.title}
          </span>
          {post.publishedAt && (
            <span className="text-[9px] text-muted-foreground/70">
              {new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </a>
      ))}
    </div>
  );
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

  // Category color for left border stripe
  const categoryColor = (CATEGORY_COLORS as Record<string, string>)[author.category] ?? "#6b7280";

  // Active tab state
  const [activeTab, setActiveTab] = useState<CardTab>("info");

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
      high: { label: "High", bg: "bg-emerald-500/12 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
      medium: { label: "Med", bg: "bg-amber-500/12 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", ring: "ring-amber-500/30" },
      low: { label: "Low", bg: "bg-rose-500/12 dark:bg-rose-500/20", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500", ring: "ring-rose-500/30" },
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

  // Substack badge
  const substackBadge = useMemo(() => {
    if (!platformLinks?.substackUrl) return null;
    let postCount: number | null = null;
    if (platformLinks.socialStatsJson) {
      try {
        const stats = JSON.parse(platformLinks.socialStatsJson as string);
        postCount = stats?.substack?.postCount ?? null;
      } catch { /* ignore */ }
    }
    return { url: platformLinks.substackUrl, postCount };
  }, [platformLinks]);

  // LinkedIn follower count badge
  const linkedinBadge = useMemo(() => {
    if (!platformLinks?.socialStatsJson) return null;
    try {
      const stats = JSON.parse(platformLinks.socialStatsJson as string);
      const count = stats?.linkedin?.followerCount;
      if (!count || count <= 0) return null;
      const fmt = count >= 1_000_000
        ? `${(count / 1_000_000).toFixed(1)}M`
        : count >= 1_000
        ? `${Math.round(count / 1_000)}K`
        : `${count}`;
      return { count: fmt, url: platformLinks.linkedinUrl ?? null };
    } catch { return null; }
  }, [platformLinks]);

  // CNBC article count badge
  const cnbcBadge = useMemo(() => {
    if (!platformLinks?.socialStatsJson) return null;
    try {
      const stats = JSON.parse(platformLinks.socialStatsJson as string);
      const count = stats?.cnbc?.articleCount;
      if (!count || count <= 0) return null;
      return { count };
    } catch { return null; }
  }, [platformLinks]);

  // Hex to rgba helper
  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(107,114,128,${alpha})`;
    return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
  }, []);

  // Books tab badge count
  const bookCount = dedupedBooks.length;
  const hasSubstack = !!platformLinks?.substackUrl && !!platformLinks?.authorId;

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
        <div
          className={[
            "h-full overflow-hidden relative",
            "bg-card/85 backdrop-blur-xl text-card-foreground",
            "border border-border/60 rounded-2xl",
            "shadow-sm hover:shadow-xl",
            "transition-all duration-200",
            "flex flex-col items-stretch",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isHighlighted ? "ring-2 ring-offset-2 ring-primary" : "",
          ].join(" ")}
          style={{ borderLeft: `3px solid ${categoryColor}` }}
        >
          {/* Category-tinted gradient overlay */}
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

          {/* Category watermark */}
          <div className="pointer-events-none absolute bottom-10 right-2 select-none" aria-hidden>
            <Icon className="w-16 h-16 text-foreground opacity-[0.03]" strokeWidth={1} />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              FILING-FOLDER TABS — raised tab strip
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="flex items-end gap-0 px-3 pt-2.5 flex-shrink-0 relative z-[2]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tab 1: Info */}
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={[
                "relative flex items-center gap-1 px-3 py-1 rounded-t-lg text-[10px] font-semibold transition-all duration-150 select-none",
                "border border-b-0",
                activeTab === "info"
                  ? "bg-card/95 border-border/70 text-foreground shadow-[0_-1px_3px_rgba(0,0,0,0.06)] z-[2] -mb-px pb-[calc(0.25rem+1px)]"
                  : "bg-muted/40 border-border/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground z-[1]",
              ].join(" ")}
              aria-selected={activeTab === "info"}
            >
              <Users className="w-2.5 h-2.5 flex-shrink-0" />
              Info
            </button>

            {/* Tab 2: Books & Substack */}
            <button
              type="button"
              onClick={() => setActiveTab("books")}
              className={[
                "relative flex items-center gap-1 px-3 py-1 rounded-t-lg text-[10px] font-semibold transition-all duration-150 select-none ml-0.5",
                "border border-b-0",
                activeTab === "books"
                  ? "bg-card/95 border-border/70 text-foreground shadow-[0_-1px_3px_rgba(0,0,0,0.06)] z-[2] -mb-px pb-[calc(0.25rem+1px)]"
                  : "bg-muted/40 border-border/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground z-[1]",
              ].join(" ")}
              aria-selected={activeTab === "books"}
            >
              <BookOpen className="w-2.5 h-2.5 flex-shrink-0" />
              Books
              {bookCount > 0 && (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold"
                  style={{ background: hexToRgba(categoryColor, 0.2), color: categoryColor }}
                >
                  {bookCount}
                </span>
              )}
              {hasSubstack && (
                <svg viewBox="0 0 24 24" className="w-2 h-2 fill-orange-500 flex-shrink-0 ml-0.5" aria-hidden="true">
                  <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
                </svg>
              )}
            </button>

            {/* Tab bar bottom border fill — connects tabs to card body */}
            <div className="flex-1 border-b border-border/60 self-end" />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              TAB CONTENT AREA — animated cross-fade
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="flex-1 flex flex-col min-h-0 relative z-[1] cursor-pointer"
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
          >
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "info" ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col flex-1"
                >
                  {/* ── ZONE A: Avatar + Metadata ── */}
                  <div className="flex flex-row items-start gap-3 p-3 h-[124px] flex-shrink-0">
                    {/* Avatar — HOTSPOT 1 */}
                    <div
                      className="flex-shrink-0 w-[96px] h-[96px] rounded-xl overflow-hidden bg-muted ring-1 ring-border/80 shadow-md cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
                      onClick={handleAvatarClick}
                      title={`View ${displayName}'s profile`}
                    >
                      <AvatarUpload authorName={displayName} currentAvatarUrl={avatarUrl} size={96}>
                        {(url) => url ? (
                          <img src={url} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
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

                    {/* Metadata panel */}
                    <div
                      className="flex-1 min-w-0 flex flex-col gap-1 h-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Row 1: Category label + controls */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Icon className="w-3 h-3 flex-shrink-0" style={{ color: categoryColor }} strokeWidth={2} />
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
                            <span title="Bio ready" className="w-2 h-2 rounded-full bg-chart-5 flex-shrink-0" aria-label="Bio ready" />
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
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 ${qualityBadge.bg} ${qualityBadge.text} ${qualityBadge.ring}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${qualityBadge.dot} flex-shrink-0`} />
                            {qualityBadge.label}
                          </span>
                        )}
                        {hasRichBio && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-teal-500/30 cursor-help">
                                <Brain className="w-2.5 h-2.5" />Rich
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[180px]">Full biography available</TooltipContent>
                          </Tooltip>
                        )}
                        {hasDigitalMe && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-violet-500/10 text-violet-700 dark:text-violet-400 ring-violet-500/30 cursor-help">
                                <Cpu className="w-2.5 h-2.5" />Digital Me
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[180px]">AI persona ready — chat with this author</TooltipContent>
                          </Tooltip>
                        )}
                        {substackBadge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={substackBadge.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/30 hover:bg-orange-500/20 transition-colors"
                              >
                                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current flex-shrink-0" aria-hidden="true">
                                  <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
                                </svg>
                                {substackBadge.postCount ? `${substackBadge.postCount} posts` : "Substack"}
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              {substackBadge.postCount ? `${substackBadge.postCount} Substack posts` : "Has a Substack newsletter"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {linkedinBadge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {linkedinBadge.url ? (
                                <a
                                  href={linkedinBadge.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/30 hover:bg-blue-500/20 transition-colors"
                                >
                                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current flex-shrink-0" aria-hidden="true">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                  {linkedinBadge.count} followers
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/30">
                                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current flex-shrink-0" aria-hidden="true">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                  {linkedinBadge.count} followers
                                </span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">{linkedinBadge.count} LinkedIn followers</TooltipContent>
                          </Tooltip>
                        )}
                        {cnbcBadge && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/30">
                                <span className="font-black text-[8px] tracking-tight leading-none">CNBC</span>
                                {cnbcBadge.count} articles
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">{cnbcBadge.count} articles on CNBC</TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {/* Row 3: Platform pills */}
                      <div className="flex-1 flex items-end">
                        {platformLinks && <PlatformPills links={platformLinks} maxVisible={6} size="sm" />}
                      </div>
                    </div>
                  </div>

                  {/* ── ZONE B: Author Info ── */}
                  <div className="px-3 flex-shrink-0 flex flex-col justify-start gap-0.5 border-t border-border/40 pt-2 pb-1">
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
                              <AlertTriangle className="w-2.5 h-2.5" />??
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            This name may be a book title or topic phrase rather than a person.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {specialty && (
                      <p className="text-[11px] text-muted-foreground/80 italic line-clamp-1 leading-relaxed">
                        <Highlight text={specialty} query={query} />
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
                      {bioSnippet ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">{bioSnippet}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[300px] p-3 z-50" onClick={(e) => e.stopPropagation()}>
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

                  {/* ── ZONE C: Tags + Interest Alignment ── */}
                  <div
                    className="px-3 h-[36px] flex-shrink-0 flex items-center gap-2 border-t border-border/40"
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
                </motion.div>
              ) : (
                <motion.div
                  key="books"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col flex-1 px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* ── Book cover shelf ── */}
                  {hasBooks ? (
                    <>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Books</p>
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                          style={{ background: hexToRgba(categoryColor, 0.15), color: categoryColor }}
                        >
                          {bookCount}
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none items-end flex-shrink-0" style={{ height: 96 }}>
                        {dedupedBooks.map((book) => {
                          const rawTitle = book.name.includes(" - ")
                            ? book.name.slice(0, book.name.lastIndexOf(" - "))
                            : book.name;
                          const titleKey = rawTitle.trim().toLowerCase();
                          const coverUrl = coverMap?.get(titleKey);
                          const bookInfo = bookInfoMap?.get(titleKey);
                          const rating = bookInfo?.rating ? parseFloat(bookInfo.rating) : null;
                          const summary = bookInfo?.summary ?? null;
                          const summarySnippet = summary
                            ? (() => {
                                const s = summary.trim();
                                const dot = Math.min(s.indexOf('. ') > 0 ? s.indexOf('. ') + 1 : s.length, 120);
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
                                <img src={coverUrl} alt={rawTitle.trim()} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div
                                  className="h-full w-full flex flex-col items-center justify-center gap-1 px-1"
                                  style={{ background: `linear-gradient(160deg, ${hexToRgba(categoryColor, 0.12)} 0%, ${hexToRgba(categoryColor, 0.06)} 100%)` }}
                                >
                                  <BookOpen className="w-4 h-4" style={{ color: categoryColor }} />
                                  <p className="text-[7px] font-medium text-center leading-tight line-clamp-3" style={{ color: categoryColor }}>
                                    {rawTitle.trim()}
                                  </p>
                                </div>
                              )}
                              {coverUrl && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-1 py-0.5 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                  <p className="text-white text-[7px] font-medium leading-tight line-clamp-2">{rawTitle.trim()}</p>
                                </div>
                              )}
                            </motion.div>
                          );

                          if (!summarySnippet && !rating) return <div key={book.id}>{coverEl}</div>;
                          return (
                            <Tooltip key={book.id}>
                              <TooltipTrigger asChild><div>{coverEl}</div></TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] p-2.5 z-50" onClick={(e) => e.stopPropagation()}>
                                <p className="font-semibold text-xs mb-1 leading-snug">{rawTitle.trim()}</p>
                                {rating !== null && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span className="text-xs font-medium">{rating.toFixed(1)}</span>
                                  </div>
                                )}
                                {summarySnippet && <p className="text-xs leading-relaxed text-muted-foreground">{summarySnippet}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1.5 italic">Click to view in Books tab →</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[96px]">
                      <span className="text-[10px] text-muted-foreground/40 italic">No books yet</span>
                    </div>
                  )}

                  {/* ── Substack mini-preview ── */}
                  {hasSubstack && platformLinks?.authorId && platformLinks?.substackUrl && (
                    <div className="border-t border-border/40 mt-2 pt-2 flex-1">
                      <SubstackMiniPreview
                        authorId={platformLinks.authorId}
                        substackUrl={platformLinks.substackUrl}
                      />
                    </div>
                  )}
                  {!hasSubstack && !hasBooks && (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/40 italic">No content yet</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              ZONE 6: Actions bar — always visible
          ═══════════════════════════════════════════════════════════ */}
          <div
            className="border-t border-border/40 h-[40px] flex-shrink-0 flex items-center justify-between px-3 gap-2 relative z-[1]"
            onClick={(e) => e.stopPropagation()}
          >
            <WhyThisAuthor authorName={displayName} />
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
