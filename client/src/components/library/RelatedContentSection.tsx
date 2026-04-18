/**
 * RelatedContentSection — Cross-content discovery powered by Neon.
 * Finds podcasts, videos, articles, and other media related to a book.
 * Shown at the bottom of the BookDetail page.
 */
import { trpc } from "@/lib/trpc";
import { Layers, ExternalLink, Headphones, Video, FileText, Mic, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RelatedContentSectionProps {
  bookId: number;
  accentColor?: string;
}

type ContentMeta = { icon: React.FC<{ size?: number; className?: string }>; label: string; color: string };
const CONTENT_TYPE_META: Record<string, ContentMeta> = {
  podcast: { icon: Headphones, label: "Podcast", color: "text-orange-500" },
  podcast_episode: { icon: Headphones, label: "Episode", color: "text-orange-500" },
  youtube_video: { icon: Video, label: "Video", color: "text-red-500" },
  youtube_channel: { icon: Video, label: "Channel", color: "text-red-500" },
  ted_talk: { icon: Mic, label: "TED Talk", color: "text-red-600" },
  article: { icon: FileText, label: "Article", color: "text-blue-500" },
  blog_post: { icon: FileText, label: "Blog", color: "text-blue-500" },
  substack: { icon: FileText, label: "Substack", color: "text-orange-600" },
  book: { icon: BookOpen, label: "Book", color: "text-emerald-500" },
};

function getContentMeta(contentType: string): ContentMeta {
  return CONTENT_TYPE_META[contentType] ?? { icon: FileText, label: contentType, color: "text-muted-foreground" };
}

export function RelatedContentSection({ bookId, accentColor = "#6366f1" }: RelatedContentSectionProps) {
  const { data, isLoading } = trpc.recommendations.relatedContent.useQuery(
    { bookId: String(bookId), topK: 6 },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers size={20} style={{ color: accentColor }} />
          Related Media
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Layers size={20} style={{ color: accentColor }} />
        Related Media
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const meta = getContentMeta(item.contentType ?? "other");
          const Icon = meta.icon;
          const coverUrl = item.s3CoverUrl ?? item.coverImageUrl;
          return (
            <a
              key={item.id}
              href={item.url ?? "#"}
              target={item.url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60",
                "bg-card hover:bg-accent/30 transition-all duration-200 hover:shadow-sm",
                !item.url && "pointer-events-none opacity-70"
              )}
            >
              {/* Thumbnail or icon */}
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Icon size={18} className={meta.color} />
                )}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight line-clamp-1 text-card-foreground">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                )}
              </div>
              {/* Type badge + external link */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {meta.label}
                </Badge>
                {item.url && (
                  <ExternalLink size={12} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
