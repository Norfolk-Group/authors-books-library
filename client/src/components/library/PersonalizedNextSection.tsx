/**
 * PersonalizedNextSection — "What to Read Next" powered by Neon + user favorites.
 * Shown at the top of the Favorites tab on the Home page.
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Sparkles, BookOpen, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PersonalizedNextSection() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.recommendations.personalizedNext.useQuery(
    { topK: 8 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <section className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-500" />
          <span className="text-sm font-semibold text-foreground/80">What to Read Next</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-28 h-44 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  const books = data?.books ?? [];
  const reason = data?.reason;

  if (books.length === 0) {
    // Show a prompt to add favorites if none exist
    if (reason?.includes("No favorite books")) {
      return (
        <div className="mb-6 rounded-xl border border-dashed border-border/60 bg-muted/30 p-5 text-center space-y-2">
          <Heart size={24} className="mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Add books to your favorites to get personalized "What to Read Next" recommendations.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <section className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-500" />
          <span className="text-sm font-semibold text-foreground/80">What to Read Next</span>
        </div>
        {reason && (
          <span className="text-xs text-muted-foreground">{reason}</span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {books.map((book) => {
          const coverUrl = book.s3CoverUrl ?? book.coverImageUrl;
          return (
            <button
              key={book.id}
              onClick={() => setLocation(`/book/${encodeURIComponent(book.bookTitle)}`)}
              className={cn(
                "group flex-shrink-0 w-28 flex flex-col rounded-xl border border-border/60 overflow-hidden",
                "bg-card hover:bg-accent/30 transition-all duration-200 hover:shadow-md hover:scale-[1.03]",
                "text-left"
              )}
            >
              {/* Cover */}
              <div className="relative w-full aspect-[2/3] bg-muted overflow-hidden">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={book.bookTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={24} className="text-muted-foreground/40" />
                  </div>
                )}
                {/* Score badge */}
                <div className="absolute top-1 right-1">
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1 py-0 bg-black/60 text-white border-0 backdrop-blur-sm"
                  >
                    {Math.round((book.score ?? 0) * 100)}%
                  </Badge>
                </div>
              </div>
              {/* Info */}
              <div className="p-2 space-y-0.5">
                <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-card-foreground">
                  {book.bookTitle}
                </p>
                {book.authorName && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{book.authorName}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
