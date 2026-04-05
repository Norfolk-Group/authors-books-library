/**
 * BooksTabContent
 * Extracted from Home.tsx — renders the full Books tab:
 *   - Recently Tagged strip (books only)
 *   - Digital Books grid (BookCard)
 *   - Audiobooks section (AudioCard)
 *
 * All data is passed as props from Home.tsx to keep the parent as the
 * single source of truth for state and data fetching.
 */
import { BookCard } from "@/components/library/BookCard";
import { AudioCard } from "@/components/library/AudioCard";
import { EmptyState } from "@/components/library/LibraryPrimitives";
import { normalizeTitleKey } from "@/hooks/useLibraryData";
import { type BookRecord } from "@/lib/libraryData";
import { type AudioBook } from "@/lib/audioData";
import { Headphones } from "lucide-react";
import type { FreshnessDimension } from "@/components/library/FreshnessDot";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentlyTaggedItem = {
  entityKey: string;
  entityType: "author" | "book";
  avatarUrl?: string | null;
  s3AvatarUrl?: string | null;
  tags: { slug: string; name: string; color: string | null }[];
};

type BookInfo = {
  rating?: string | null;
  ratingCount?: number | null;
  publishedDate?: string | null;
  keyThemes?: string | null;
  summary?: string | null;
  format?: string | null;
  possessionStatus?: string | null;
  readingProgressPercent?: number | null;
  readingStartedAt?: Date | null;
  readingFinishedAt?: Date | null;
};

export interface BooksTabContentProps {
  // Filter state
  query: string;
  selectedCategories: Set<string>;
  selectedTagSlugs: Set<string>;
  isAuthenticated: boolean;

  // Data
  filteredBooks: BookRecord[];
  filteredAudio: AudioBook[];
  enrichedTitlesSet: Set<string>;
  richSummarySet: Set<string>;
  bookCoverMap: Map<string, string | undefined>;
  amazonUrlMap: Map<string, string | undefined>;
  goodreadsUrlMap: Map<string, string | undefined>;
  wikipediaUrlMap: Map<string, string | undefined>;
  bookInfoMap: Map<string, BookInfo | undefined>;
  bookFreshnessMap: Map<string, FreshnessDimension[] | undefined>;
  bookTagsMap: Map<string, Set<string>>;
  bookFavoritesData: Record<string, boolean> | undefined;
  recentlyTaggedData: RecentlyTaggedItem[] | undefined;
  highlightedBookTitle: string | null;
  bookCardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;

  // Callbacks
  onDetailClick: (book: BookRecord) => void;
  onCoverClick: (url: string, title: string, color: string) => void;
  onAuthorClick: (authorName: string) => void;
  onEditBook: (titleKey: string) => void;
  onDeleteBook: (titleKey: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BooksTabContent({
  query,
  selectedCategories,
  selectedTagSlugs,
  isAuthenticated,
  filteredBooks,
  filteredAudio,
  enrichedTitlesSet,
  richSummarySet,
  bookCoverMap,
  amazonUrlMap,
  goodreadsUrlMap,
  wikipediaUrlMap,
  bookInfoMap,
  bookFreshnessMap,
  bookTagsMap,
  bookFavoritesData,
  recentlyTaggedData,
  highlightedBookTitle,
  bookCardRefs,
  onDetailClick,
  onCoverClick,
  onAuthorClick,
  onEditBook,
  onDeleteBook,
}: BooksTabContentProps) {
  if (filteredBooks.length === 0) return <EmptyState query={query} />;

  const bookRecentlyTagged = recentlyTaggedData?.filter((i) => i.entityType === "book") ?? [];

  return (
    <>
      {/* Recently Tagged strip — Books tab */}
      {!query && selectedCategories.size === 0 && selectedTagSlugs.size === 0 && bookRecentlyTagged.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🏷️</span>
            <h2 className="text-sm font-semibold">Recently Tagged</h2>
            <span className="text-xs text-muted-foreground">Books with tags applied recently</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {bookRecentlyTagged.map((item) => {
              const coverUrl = item.s3AvatarUrl || item.avatarUrl || null;
              return (
                <button
                  key={`book::${item.entityKey}`}
                  onClick={() => {
                    const found = filteredBooks.find(
                      (b) =>
                        normalizeTitleKey(b.name) === item.entityKey ||
                        b.name.toLowerCase().includes(item.entityKey.toLowerCase())
                    );
                    if (found) onDetailClick(found);
                  }}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all w-[100px] group"
                >
                  <div className="relative">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={item.entityKey}
                        className="w-12 h-16 rounded-md object-cover ring-2 ring-blue-400/40 group-hover:ring-blue-400/80 transition-all"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-md bg-gradient-to-br from-blue-400/20 to-blue-600/20 flex items-center justify-center text-lg font-bold text-blue-600">
                        {item.entityKey.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">
                    {item.entityKey.split(" ").slice(0, 3).join(" ")}
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
        </div>
      )}

      {/* Digital Books grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 tab-content-enter">
        {filteredBooks.map((b, i) => {
          const titleKey = b.name.split(" - ")[0].trim().replace(/[?!.,;:]+$/, "");
          const tk = normalizeTitleKey(b.name);
          const info = bookInfoMap.get(tk);
          return (
            <div
              key={b.id + i}
              style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
              ref={(el) => {
                if (el) bookCardRefs.current.set(tk, el);
                else bookCardRefs.current.delete(tk);
              }}
            >
              <BookCard
                book={b}
                query={query}
                onDetailClick={onDetailClick}
                coverImageUrl={bookCoverMap.get(titleKey)}
                isEnriched={enrichedTitlesSet.has(titleKey)}
                amazonUrl={amazonUrlMap.get(titleKey)}
                goodreadsUrl={goodreadsUrlMap.get(titleKey)}
                wikipediaUrl={wikipediaUrlMap.get(titleKey)}
                onCoverClick={onCoverClick}
                onAuthorClick={onAuthorClick}
                isHighlighted={highlightedBookTitle === tk}
                rating={info?.rating ?? undefined}
                ratingCount={info?.ratingCount ?? undefined}
                publishedDate={info?.publishedDate ?? undefined}
                keyThemes={info?.keyThemes ?? undefined}
                summary={info?.summary ?? undefined}
                isFavorite={(bookFavoritesData ?? {})[tk] ?? false}
                hasRichSummary={richSummarySet.has(titleKey)}
                freshnessDimensions={bookFreshnessMap.get(tk)}
                format={info?.format ?? null}
                possessionStatus={info?.possessionStatus ?? null}
                readingProgressPercent={info?.readingProgressPercent ?? null}
                readingStartedAt={info?.readingStartedAt ?? null}
                readingFinishedAt={info?.readingFinishedAt ?? null}
                onEditClick={isAuthenticated ? () => onEditBook(titleKey) : undefined}
                onDeleteClick={isAuthenticated ? () => onDeleteBook(titleKey) : undefined}
                currentTagSlugs={Array.from(bookTagsMap.get(tk) ?? [])}
              />
            </div>
          );
        })}
      </div>

      {/* Audiobooks section within Books tab */}
      {filteredAudio.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Headphones className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Audiobooks</h2>
            <span className="text-xs text-muted-foreground">({filteredAudio.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredAudio.map((a, i) => (
              <div key={a.id + i} style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                <AudioCard audio={a} query={query} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
