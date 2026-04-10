/**
 * AuthorInTheNewsSection — "In the News" panel for the Author Detail page.
 *
 * Fetches news articles mentioning the author via enrichment.news.searchAuthorNews
 * (Google News RSS + CNBC RapidAPI). Shows article cards with source badge,
 * headline, date, and "Read" link.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Newspaper, ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Source → badge color mapping
const SOURCE_COLORS: Record<string, string> = {
  CNBC: "bg-red-500/15 text-red-700 dark:text-red-400 ring-red-500/30",
  "The New York Times": "bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30",
  Bloomberg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30",
  "The Wall Street Journal": "bg-gray-500/15 text-gray-700 dark:text-gray-300 ring-gray-500/30",
  "The Atlantic": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 ring-indigo-500/30",
  BBC: "bg-red-600/15 text-red-800 dark:text-red-300 ring-red-600/30",
  CNN: "bg-red-700/15 text-red-900 dark:text-red-300 ring-red-700/30",
  "Washington Post": "bg-violet-500/15 text-violet-700 dark:text-violet-400 ring-violet-500/30",
  Forbes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30",
  "Harvard Business Review": "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30",
};

function sourceBadgeClass(source: string): string {
  return (
    SOURCE_COLORS[source] ??
    "bg-muted text-muted-foreground ring-border"
  );
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

interface Props {
  authorName: string;
}

export function AuthorInTheNewsSection({ authorName }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, refetch, isFetching } = trpc.enrichment.news.searchAuthorNews.useQuery(
    { authorName, limit: 20 },
    {
      enabled,
      staleTime: 5 * 60 * 1000, // 5 min cache
      retry: 1,
    }
  );

  const articles = data ?? [];
  const visible = showAll ? articles : articles.slice(0, 6);
  const hasMore = articles.length > 6;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Newspaper className="w-3.5 h-3.5" />
          In the News
        </h2>
        <div className="flex items-center gap-2">
          {enabled && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Refresh news"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          )}
          {!enabled && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEnabled(true)}
              className="h-7 text-xs"
            >
              <Newspaper className="w-3 h-3 mr-1" />
              Load News
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Searching news sources…
        </div>
      )}

      {/* Empty state */}
      {enabled && !isLoading && articles.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          No recent news articles found for {authorName}.
        </div>
      )}

      {/* Prompt to load */}
      {!enabled && (
        <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Click "Load News" to search Google News, CNBC, and other sources for recent articles mentioning {authorName}.
        </div>
      )}

      {/* Article cards */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/30 transition-all"
            >
              {/* Source badge */}
              <div className="flex-shrink-0 pt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ${sourceBadgeClass(article.source)}`}
                >
                  {article.source.length > 12 ? article.source.slice(0, 12) + "…" : article.source}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                  {article.title}
                </p>
                {article.snippet && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.snippet}</p>
                )}
                {article.publishedAt && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1">{formatDate(article.publishedAt)}</p>
                )}
              </div>

              {/* Arrow */}
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}

          {/* Show more */}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Show {articles.length - 6} more articles
            </button>
          )}
        </div>
      )}
    </section>
  );
}
