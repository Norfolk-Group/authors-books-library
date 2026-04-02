/**
 * MediaTab.tsx
 * Media tab content for the Home page.
 * Shows content_items (non-book) with sub-filter chips and a card grid.
 * Sub-filters: All | Written | Audio & Video | Courses | Film & TV | Other
 * Features: favorites-only toggle, admin create/edit/delete actions.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FileText,
  Headphones,
  GraduationCap,
  Film,
  MoreHorizontal,
  LayoutGrid,
  ExternalLink,
  Star,
  Calendar,
  Globe,
  Loader2,
  Heart,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MediaItemFormDialog } from "@/components/library/MediaItemFormDialog";

// ── Sub-filter config ─────────────────────────────────────────────────────────
const MEDIA_GROUPS = [
  { key: "all",         label: "All Media",     icon: LayoutGrid },
  { key: "written",     label: "Written",        icon: FileText },
  { key: "audio_video", label: "Audio & Video",  icon: Headphones },
  { key: "courses",     label: "Courses",        icon: GraduationCap },
  { key: "film_tv",     label: "Film & TV",      icon: Film },
  { key: "other",       label: "Other",          icon: MoreHorizontal },
] as const;

type MediaGroup = typeof MEDIA_GROUPS[number]["key"];
type SortOption = "newest" | "oldest" | "title-asc" | "title-desc" | "rating-desc";

// ── Content type display labels ───────────────────────────────────────────────
const CONTENT_TYPE_LABELS: Record<string, string> = {
  paper:           "Research Paper",
  article:         "Article",
  substack:        "Substack",
  newsletter:      "Newsletter",
  blog_post:       "Blog Post",
  social_post:     "Social Post",
  website:         "Website",
  speech:          "Speech",
  interview:       "Interview",
  podcast:         "Podcast",
  podcast_episode: "Podcast Episode",
  youtube_video:   "YouTube Video",
  youtube_channel: "YouTube Channel",
  ted_talk:        "TED Talk",
  radio:           "Radio",
  masterclass:     "Masterclass",
  online_course:   "Online Course",
  tool:            "Tool",
  tv_show:         "TV Show",
  tv_episode:      "TV Episode",
  film:            "Film",
  photography:     "Photography",
  other:           "Other",
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  paper:           "#0284c7",
  article:         "#0891b2",
  substack:        "#f97316",
  newsletter:      "#d97706",
  blog_post:       "#7c3aed",
  social_post:     "#db2777",
  website:         "#059669",
  speech:          "#6366f1",
  interview:       "#8b5cf6",
  podcast:         "#ec4899",
  podcast_episode: "#f43f5e",
  youtube_video:   "#ef4444",
  youtube_channel: "#dc2626",
  ted_talk:        "#e11d48",
  radio:           "#64748b",
  masterclass:     "#f59e0b",
  online_course:   "#10b981",
  tool:            "#3b82f6",
  tv_show:         "#8b5cf6",
  tv_episode:      "#7c3aed",
  film:            "#6d28d9",
  photography:     "#0891b2",
  other:           "#6b7280",
};

// ── MediaItemCard ─────────────────────────────────────────────────────────────
interface MediaItemData {
  id: number;
  contentType: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  url?: string | null;
  coverImageUrl?: string | null;
  s3CoverUrl?: string | null;
  publishedDate?: string | null;
  rating?: string | null;
  ratingCount?: number | null;
  language?: string | null;
  authors: string[];
}
interface MediaItemCardProps {
  item: MediaItemData;
  isAdmin?: boolean;
  onEdit?: (item: MediaItemData) => void;
  onDelete?: (id: number) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
}

function MediaItemCard({ item, isAdmin, onEdit, onDelete, isFavorite, onToggleFavorite }: MediaItemCardProps) {
  const coverUrl = item.s3CoverUrl || item.coverImageUrl || null;
  const typeLabel = CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType;
  const typeColor = CONTENT_TYPE_COLORS[item.contentType] ?? "#6b7280";
  const rating = item.rating ? parseFloat(String(item.rating)) : null;

  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-md transition-all overflow-hidden">
      {/* Cover / placeholder */}
      <div className="relative w-full aspect-[16/9] bg-muted/30 overflow-hidden flex-shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: typeColor + "18" }}
          >
            <span className="text-4xl font-black opacity-20" style={{ color: typeColor }}>
              {item.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Type badge */}
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: typeColor }}
        >
          {typeLabel}
        </span>
        {/* Action buttons (top-right) */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {/* Favorite toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(item.id); }}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              isFavorite
                ? "bg-rose-500/90 hover:bg-rose-600"
                : "bg-black/40 hover:bg-black/70"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`w-3 h-3 ${isFavorite ? "fill-white stroke-white" : "text-white"}`} />
          </button>
          {/* External link */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition-colors"
              title="Open link"
            >
              <ExternalLink className="w-3 h-3 text-white" />
            </a>
          )}
          {/* Admin edit/delete (visible on hover) */}
          {isAdmin && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
                className="w-6 h-6 rounded-full bg-black/40 hover:bg-blue-600/90 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                title="Edit"
              >
                <Pencil className="w-3 h-3 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(item.id); }}
                className="w-6 h-6 rounded-full bg-black/40 hover:bg-destructive/90 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <h3 className="text-sm font-semibold line-clamp-2 leading-tight">{item.title}</h3>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.subtitle}</p>
        )}
        {item.authors.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {item.authors.join(", ")}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-auto pt-1.5 flex-wrap">
          {rating !== null && rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
              <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
              {rating.toFixed(1)}
              {item.ratingCount ? (
                <span className="text-muted-foreground font-normal ml-0.5">
                  ({item.ratingCount.toLocaleString()})
                </span>
              ) : null}
            </span>
          )}
          {item.publishedDate && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {item.publishedDate.slice(0, 4)}
            </span>
          )}
          {item.language && item.language !== "en" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Globe className="w-3 h-3" />
              {item.language.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MediaTab ──────────────────────────────────────────────────────────────────
interface MediaTabProps {
  query: string;
}

export function MediaTab({ query }: MediaTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeGroup, setActiveGroup] = useLocalStorage<MediaGroup>("lib:mediaGroup", "all");
  const [sort, setSort] = useLocalStorage<SortOption>("lib:mediaSort", "newest");
  const [offset, setOffset] = useState(0);
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage<boolean>("lib:mediaFavoritesOnly", false);
  const [mediaFavorites, setMediaFavorites] = useLocalStorage<number[]>("lib:mediaFavorites", []);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItemData | null>(null);

  const PAGE_SIZE = 48;
  const utils = trpc.useUtils();

  const groupCountsQuery = trpc.contentItems.getGroupCounts.useQuery(undefined, {
    staleTime: 2 * 60_000,
  });

  const { data, isLoading, isFetching } = trpc.contentItems.list.useQuery(
    {
      group: activeGroup,
      query,
      sort,
      limit: PAGE_SIZE,
      offset,
      includedOnly: true,
    },
    { staleTime: 60_000 }
  );

  const deleteMutation = trpc.contentItems.delete.useMutation({
    onSuccess: () => {
      toast.success("Media item deleted");
      utils.contentItems.list.invalidate();
      utils.contentItems.getGroupCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGroupChange = useCallback((g: MediaGroup) => {
    setActiveGroup(g);
    setOffset(0);
  }, [setActiveGroup]);

  const handleToggleFavorite = useCallback((id: number) => {
    setMediaFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, [setMediaFavorites]);

  const handleEdit = useCallback((item: MediaItemData) => {
    setEditItem(item);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: number) => {
    if (!confirm("Delete this media item? This cannot be undone.")) return;
    deleteMutation.mutate({ id });
  }, [deleteMutation]);

  const counts = groupCountsQuery.data;
  const allItems = data?.items ?? [];
  const total = data?.total ?? 0;

  // Apply favorites filter client-side
  const items = showFavoritesOnly
    ? allItems.filter((item) => mediaFavorites.includes(item.id))
    : allItems;

  return (
    <div className="space-y-4">
      {/* Sub-filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {MEDIA_GROUPS.map(({ key, label, icon: Icon }) => {
          const isActive = activeGroup === key;
          const count = counts ? counts[key as keyof typeof counts] : undefined;
          return (
            <button
              key={key}
              onClick={() => handleGroupChange(key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{
                backgroundColor: isActive ? "hsl(var(--primary) / 0.12)" : "transparent",
                color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: isActive ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted))",
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              showFavoritesOnly
                ? "bg-rose-500/10 text-rose-600 border-rose-400"
                : "bg-transparent text-muted-foreground border-border hover:border-rose-300 hover:text-rose-500"
            }`}
            title={showFavoritesOnly ? "Showing favorites only — click to show all" : "Show favorites only"}
          >
            <Heart className={`w-3 h-3 transition-all ${showFavoritesOnly ? "fill-rose-500 stroke-rose-500" : ""}`} />
            Favorites
          </button>

          {/* Admin: New item button */}
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => { setEditItem(null); setFormOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Item
            </Button>
          )}

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title-asc">Title A → Z</SelectItem>
              <SelectItem value="title-desc">Title Z → A</SelectItem>
              <SelectItem value="rating-desc">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results header */}
      {!isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {items.length === 0
              ? showFavoritesOnly ? "No favorited items" : "No media items found"
              : `${items.length.toLocaleString()} item${items.length !== 1 ? "s" : ""}${showFavoritesOnly ? " (favorites)" : ""}`}
          </span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-muted/20 animate-pulse">
              <div className="aspect-[16/9] bg-muted/40 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted/60 rounded w-3/4" />
                <div className="h-2.5 bg-muted/40 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Film className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">
            {showFavoritesOnly ? "No favorites yet" : "No media items yet"}
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            {showFavoritesOnly
              ? "Click the heart icon on any media card to add it to your favorites."
              : "Articles, papers, podcasts, videos, courses, films, and other non-book content will appear here."}
          </p>
          {isAdmin && !showFavoritesOnly && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => { setEditItem(null); setFormOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" /> Add First Item
            </Button>
          )}
        </div>
      )}

      {/* Card grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <MediaItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isFavorite={mediaFavorites.includes(item.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Pagination (only when not filtering favorites) */}
      {!isLoading && !showFavoritesOnly && total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Create / Edit dialog */}
      <MediaItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editItem={editItem ? {
          id: editItem.id,
          contentType: editItem.contentType,
          title: editItem.title,
          subtitle: editItem.subtitle,
          description: editItem.description,
          url: editItem.url,
          coverImageUrl: editItem.coverImageUrl,
          publishedDate: editItem.publishedDate,
          language: editItem.language,
          authorNames: editItem.authors,
        } : null}
      />
    </div>
  );
}
