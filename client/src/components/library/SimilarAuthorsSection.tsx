/**
 * SimilarAuthorsSection — "You Might Also Like" powered by Neon vector similarity.
 * Shown at the bottom of the AuthorDetail page.
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Users, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SimilarAuthorsSectionProps {
  authorName: string;
  accentColor?: string;
}

export function SimilarAuthorsSection({ authorName, accentColor = "#6366f1" }: SimilarAuthorsSectionProps) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.recommendations.similarAuthors.useQuery(
    { authorName, topK: 5 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users size={20} style={{ color: accentColor }} />
          Similar Authors
        </h2>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-36 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const authors = data?.authors ?? [];
  if (authors.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Users size={20} style={{ color: accentColor }} />
        Similar Authors
      </h2>
      <div className="flex flex-wrap gap-3">
        {authors.map((author) => {
          const avatarUrl = author.s3AvatarUrl ?? author.avatarUrl;
          return (
            <button
              key={author.id}
              onClick={() => setLocation(`/author/${encodeURIComponent(author.authorName)}`)}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60",
                "bg-card hover:bg-accent/30 transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                "text-left max-w-[200px]"
              )}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={author.authorName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserCircle size={20} className="text-muted-foreground/60" />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight line-clamp-2 text-card-foreground">
                  {author.authorName}
                </p>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 mt-0.5 bg-muted text-muted-foreground border-0"
                >
                  {Math.round((author.score ?? 0) * 100)}% match
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
