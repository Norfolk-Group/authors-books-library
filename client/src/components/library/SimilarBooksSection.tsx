/**
 * SimilarBooksSection — "Readers Also Liked" powered by Pinecone vector similarity.
 * Shown at the bottom of the BookDetail page.
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Sparkles, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SimilarBooksSectionProps {
  bookId: number;
  accentColor?: string;
}

export function SimilarBooksSection({ bookId, accentColor = "#6366f1" }: SimilarBooksSectionProps) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.recommendations.similarBooks.useQuery(
    { bookId: String(bookId), topK: 6 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={20} style={{ color: accentColor }} />
          Readers Also Liked
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const books = data?.books ?? [];
  if (books.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Sparkles size={20} style={{ color: accentColor }} />
        Readers Also Liked
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {books.map((book) => {
          const coverUrl = book.s3CoverUrl ?? book.coverImageUrl;
          return (
            <button
              key={book.id}
              onClick={() => setLocation(`/book/${encodeURIComponent(book.bookTitle)}`)}
              className={cn(
                "group relative flex flex-col rounded-xl border border-border/60 overflow-hidden",
                "bg-card hover:bg-accent/30 transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
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
                    <BookOpen size={32} className="text-muted-foreground/40" />
                  </div>
                )}
                {/* Score badge */}
                <div className="absolute top-1.5 right-1.5">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0.5 bg-black/60 text-white border-0 backdrop-blur-sm"
                  >
                    {Math.round((book.score ?? 0) * 100)}%
                  </Badge>
                </div>
              </div>
              {/* Info */}
              <div className="p-2.5 space-y-0.5 flex-1">
                <p className="text-xs font-semibold leading-tight line-clamp-2 text-card-foreground">
                  {book.bookTitle}
                </p>
                {book.authorName && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{book.authorName}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
