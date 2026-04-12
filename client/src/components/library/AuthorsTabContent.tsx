/**
 * AuthorsTabContent
 * Extracted from Home.tsx — renders the full Authors tab:
 *   - Recently Enriched strip
 *   - Recently Tagged strip
 *   - Author card grid (flat or tag-grouped)
 *
 * All data is passed as props from Home.tsx to keep the parent as the
 * single source of truth for state and data fetching.
 */
import { useRef, useCallback, useEffect, useState } from "react";
import { FlowbiteAuthorCard } from "@/components/FlowbiteAuthorCard";
import { LazyImage } from "@/components/ui/LazyImage";
import { EmptyState } from "@/components/library/LibraryPrimitives";
import { TagGroupHeader, groupByFirstTag } from "@/components/library/TagGroupHeader";
import { AUTHORS, type AuthorEntry } from "@/lib/libraryData";
import { useAuthorAliases } from "@/hooks/useAuthorAliases";
import { Input } from "@/components/ui/input";
import { Search, X, Users, ChevronDown, Tag } from "lucide-react";
import { Sparkles } from "lucide-react";
import type { FreshnessDimension } from "@/components/library/FreshnessDot";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentlyEnrichedItem = {
  authorName: string;
  avatarUrl?: string | null;
  s3AvatarUrl?: string | null;
  enrichedAt?: string | Date | null;
};

type RecentlyTaggedItem = {
  entityKey: string;
  entityType: "author" | "book";
  avatarUrl?: string | null;
  s3AvatarUrl?: string | null;
  tags: { slug: string; name: string; color: string | null }[];
};

type PlatformLinks = {
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
  socialStatsJson?: string | null;
  newsCacheJson?: string | null;
  authorName?: string | null;
};

export interface AuthorsTabContentProps {
  // Filter state
  query: string;
  setQuery: (q: string) => void;
  selectedCategories: Set<string>;
  selectedTagSlugs: Set<string>;
  authorSort: string;
  isAuthenticated: boolean;

  // Data
  filteredAuthors: AuthorEntry[];
  enrichedSet: Set<string>;
  richBioSet: Set<string>;
  bookCoverMap: Map<string, string | undefined>;
  dbAvatarMap: Map<string, string | null | undefined>;
  researchQualityMap: Map<string, string | null | undefined>;
  bookInfoMap: Map<string, { summary?: string; rating?: string; ratingCount?: number } | undefined>;
  // Note: FlowbiteAuthorCard expects narrower Map types; we cast at call sites below
  platformLinksMap: Map<string, PlatformLinks | null | undefined>;
  authorFreshnessMap: Map<string, FreshnessDimension[] | undefined>;
  authorTagsMap: Map<string, Set<string>>;
  authorFavoritesData: Record<string, boolean> | undefined;
  recentlyEnrichedData: RecentlyEnrichedItem[] | undefined;
  recentlyTaggedData: RecentlyTaggedItem[] | undefined;
  allTags: Array<{ slug: string; name: string; color?: string | null }>;
  highlightedAuthorName: string | null;
  authorCardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;

  // Callbacks
  getBio: (author: AuthorEntry) => string | null | undefined;
  onBioClick: (author: AuthorEntry) => void;
  onNavigateToBook: (titleKey: string) => void;
  onEditAuthor: (name: string) => void;
  onDeleteAuthor: (name: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthorsTabContent({
  query,
  setQuery,
  selectedCategories,
  selectedTagSlugs,
  authorSort,
  isAuthenticated,
  filteredAuthors,
  enrichedSet,
  richBioSet,
  bookCoverMap,
  dbAvatarMap,
  researchQualityMap,
  bookInfoMap,
  platformLinksMap,
  authorFreshnessMap,
  authorTagsMap,
  authorFavoritesData,
  recentlyEnrichedData,
  recentlyTaggedData,
  highlightedAuthorName,
  authorCardRefs,
  allTags,
  getBio,
  onBioClick,
  onNavigateToBook,
  onEditAuthor,
  onDeleteAuthor,
}: AuthorsTabContentProps) {
  const { canonicalName } = useAuthorAliases();

  // Collapsible strip state — default collapsed so the grid is immediately visible
  const [enrichedOpen, setEnrichedOpen] = useState(false);
  const [taggedOpen, setTaggedOpen] = useState(false);

  // Local debounced input state — shows immediate feedback while the parent
  // query (used for filtering) updates after a short delay.
  const [localInput, setLocalInput] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local input in sync when parent clears the query externally
  useEffect(() => {
    setLocalInput(query);
  }, [query]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalInput(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setQuery(val);
      }, 150);
    },
    [setQuery]
  );

  const handleClear = useCallback(() => {
    setLocalInput("");
    setQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [setQuery]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
      {/* Recently Enriched — collapsible pill */}
      {!query && selectedCategories.size === 0 && (recentlyEnrichedData?.length ?? 0) > 0 && (
        <div className="mb-3">
          {/* Toggle pill */}
          <button
            type="button"
            onClick={() => setEnrichedOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all select-none
              bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300
              dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-400 dark:hover:bg-amber-950/50
              active:scale-95 shadow-sm"
            aria-expanded={enrichedOpen}
          >
            <Sparkles className="w-3 h-3" />
            Recently Enriched
            <span className="ml-0.5 px-1.5 py-px rounded-full bg-amber-200/60 dark:bg-amber-800/40 text-[10px] font-semibold">
              {recentlyEnrichedData?.length ?? 0}
            </span>
            <ChevronDown
              className={[
                "w-3 h-3 transition-transform duration-200",
                enrichedOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {/* Collapsible content */}
          {enrichedOpen && (
            <div className="mt-2 mb-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {recentlyEnrichedData?.map((author) => {
                const avatarUrl = author.s3AvatarUrl || author.avatarUrl || null;
                return (
                  <button
                    key={author.authorName}
                    onClick={() => {
                      const found = AUTHORS.find((a) => canonicalName(a.name).toLowerCase() === author.authorName.toLowerCase());
                      if (found) onBioClick(found);
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[90px] group"
                  >
                    <div className="relative">
                      {avatarUrl ? (
                        <LazyImage src={avatarUrl} alt={author.authorName} className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400/40 group-hover:ring-amber-400/80 transition-all" eager />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center text-lg font-bold text-amber-600">
                          {author.authorName.charAt(0)}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-amber-900" />
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                      {author.authorName.split(" ").slice(0, 2).join(" ")}
                    </span>
                    {author.enrichedAt && (
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(author.enrichedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recently Tagged — collapsible pill */}
      {!query && selectedCategories.size === 0 && selectedTagSlugs.size === 0 && (recentlyTaggedData?.length ?? 0) > 0 && (
        <div className="mb-3">
          {/* Toggle pill */}
          <button
            type="button"
            onClick={() => setTaggedOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all select-none
              bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300
              dark:bg-violet-950/30 dark:border-violet-800/50 dark:text-violet-400 dark:hover:bg-violet-950/50
              active:scale-95 shadow-sm"
            aria-expanded={taggedOpen}
          >
            <Tag className="w-3 h-3" />
            Recently Tagged
            <span className="ml-0.5 px-1.5 py-px rounded-full bg-violet-200/60 dark:bg-violet-800/40 text-[10px] font-semibold">
              {recentlyTaggedData?.length ?? 0}
            </span>
            <ChevronDown
              className={[
                "w-3 h-3 transition-transform duration-200",
                taggedOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {/* Collapsible content */}
          {taggedOpen && (
            <div className="mt-2 mb-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {recentlyTaggedData?.map((item) => {
                const avatarUrl = item.s3AvatarUrl || item.avatarUrl || null;
                return (
                  <button
                    key={`${item.entityType}::${item.entityKey}`}
                    onClick={() => {
                      if (item.entityType === "author") {
                        const found = AUTHORS.find((a) => canonicalName(a.name).toLowerCase() === item.entityKey.toLowerCase());
                        if (found) onBioClick(found);
                      }
                    }}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[100px] group"
                  >
                    <div className="relative">
                      {avatarUrl ? (
                        <LazyImage src={avatarUrl} alt={item.entityKey} className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-400/40 group-hover:ring-violet-400/80 transition-all" eager />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400/20 to-violet-600/20 flex items-center justify-center text-lg font-bold text-violet-600">
                          {item.entityKey.charAt(0)}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                        {item.entityType === "author" ? "A" : "B"}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                      {item.entityKey.split(" ").slice(0, 2).join(" ")}
                    </span>
                    {item.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.slug}
                        className="text-[8px] px-1.5 py-0.5 rounded-full font-medium truncate max-w-full"
                        style={{ backgroundColor: (tag.color ?? "#6366F1") + "22", color: tag.color ?? "#6366F1" }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Author Search Bar ──────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="relative group">
          {/* Search icon */}
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-primary" />

          <Input
            type="text"
            value={localInput}
            onChange={handleInputChange}
            placeholder="Search authors by name…"
            className="pl-10 pr-24 h-11 text-sm rounded-xl border-border/60 bg-muted/30 hover:bg-muted/50 focus:bg-background transition-colors shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Right side: match count + clear button */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Match count badge */}
            <span
              className={[
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all",
                query
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted/60 text-muted-foreground border border-border/40",
              ].join(" ")}
            >
              <Users className="w-3 h-3" />
              {filteredAuthors.length}
            </span>

            {/* Clear button — only visible when there's input */}
            {localInput && (
              <button
                onClick={handleClear}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-all active:scale-95"
                aria-label="Clear search"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active search feedback */}
        {query && (
          <p className="mt-1.5 text-xs text-muted-foreground pl-1">
            {filteredAuthors.length === 0
              ? `No authors match "${query}"`
              : `Showing ${filteredAuthors.length} author${filteredAuthors.length !== 1 ? "s" : ""} matching "${query}"`}
          </p>
        )}
      </div>

      {/* Author card grid */}
      {filteredAuthors.length === 0 ? (
        <EmptyState query={query} />
      ) : authorSort === "tags" ? (
        <div className="space-y-0">
          {groupByFirstTag(
            filteredAuthors,
            (a) => {
              const tags = authorTagsMap.get(canonicalName(a.name).toLowerCase());
              return tags && tags.size > 0 ? Array.from(tags).sort()[0] : null;
            },
            allTags
          ).map((group) => (
            <div key={group.tagSlug ?? "__untagged__"} className="mb-6">
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-background/80 backdrop-blur-sm">
                <TagGroupHeader tagName={group.tagName} tagColor={group.tagColor} count={group.items.length} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-2">
                {group.items.map((a, i) => (
                  <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                    <FlowbiteAuthorCard
                      author={a}
                      query={query}
                      onBioClick={onBioClick}
                      isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                      bio={getBio(a)}
                      coverMap={bookCoverMap as Map<string, string>}
                      dbAvatarMap={dbAvatarMap as Map<string, string>}
                      researchQualityMap={researchQualityMap as Map<string, "high" | "medium" | "low">}
                      bookInfoMap={bookInfoMap as Map<string, { summary?: string; rating?: string; ratingCount?: number }>}
                      onNavigateToBook={onNavigateToBook}
                      isHighlighted={highlightedAuthorName === canonicalName(a.name).toLowerCase()}
                      isFavorite={(authorFavoritesData ?? {})[canonicalName(a.name).toLowerCase()] ?? false}
                      hasRichBio={richBioSet.has(canonicalName(a.name).toLowerCase())}
                      platformLinks={platformLinksMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                      freshnessDimensions={authorFreshnessMap.get(canonicalName(a.name).toLowerCase())}
                      cardRef={(el) => {
                        const key = canonicalName(a.name).toLowerCase();
                        if (el) authorCardRefs.current.set(key, el);
                        else authorCardRefs.current.delete(key);
                      }}
                      currentTagSlugs={Array.from(authorTagsMap.get(canonicalName(a.name).toLowerCase()) ?? [])}
                      onEditClick={isAuthenticated ? () => onEditAuthor(canonicalName(a.name)) : undefined}
                      onDeleteClick={isAuthenticated ? () => onDeleteAuthor(canonicalName(a.name)) : undefined}
                      priority={i < 4}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 tab-content-enter">
          {filteredAuthors.map((a, i) => (
            <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
              <FlowbiteAuthorCard
                author={a}
                query={query}
                onBioClick={onBioClick}
                isEnriched={enrichedSet.has(a.name.includes(" - ") ? a.name.slice(0, a.name.indexOf(" - ")) : a.name)}
                bio={getBio(a)}
                coverMap={bookCoverMap as Map<string, string>}
                dbAvatarMap={dbAvatarMap as Map<string, string>}
                researchQualityMap={researchQualityMap as Map<string, "high" | "medium" | "low">}
                bookInfoMap={bookInfoMap as Map<string, { summary?: string; rating?: string; ratingCount?: number }>}
                onNavigateToBook={onNavigateToBook}
                isHighlighted={highlightedAuthorName === canonicalName(a.name).toLowerCase()}
                isFavorite={(authorFavoritesData ?? {})[canonicalName(a.name).toLowerCase()] ?? false}
                hasRichBio={richBioSet.has(canonicalName(a.name).toLowerCase())}
                platformLinks={platformLinksMap.get(canonicalName(a.name).toLowerCase()) ?? null}
                freshnessDimensions={authorFreshnessMap.get(canonicalName(a.name).toLowerCase())}
                cardRef={(el) => {
                  const key = canonicalName(a.name).toLowerCase();
                  if (el) authorCardRefs.current.set(key, el);
                  else authorCardRefs.current.delete(key);
                }}
                currentTagSlugs={Array.from(authorTagsMap.get(canonicalName(a.name).toLowerCase()) ?? [])}
                onEditClick={isAuthenticated ? () => onEditAuthor(canonicalName(a.name)) : undefined}
                onDeleteClick={isAuthenticated ? () => onDeleteAuthor(canonicalName(a.name)) : undefined}
                priority={i < 4}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
