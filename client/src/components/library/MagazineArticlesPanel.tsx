/**
 * MagazineArticlesPanel.tsx
 *
 * Shows magazine articles by an author from The Atlantic, The New Yorker,
 * Wired, NYT, and The Washington Post.
 *
 * Features:
 * - Grouped by publication with colored source badges
 * - "Sync Feed" button to pull latest RSS articles
 * - "Scrape Full Text" button per article (admin only)
 * - Expandable article preview (summary or full text snippet)
 * - External link to the original article
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ExternalLink, RefreshCw, FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Publication metadata ──────────────────────────────────────────────────────

const SOURCE_META: Record<string, { name: string; color: string; bgColor: string }> = {
  "the-atlantic": {
    name: "The Atlantic",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  },
  "the-new-yorker": {
    name: "The New Yorker",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  },
  wired: {
    name: "Wired",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800",
  },
  nyt: {
    name: "New York Times",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700",
  },
  "washington-post": {
    name: "Washington Post",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Article = {
  id: number;
  articleId: string;
  title: string;
  source: string;
  url: string;
  authorName: string | null;
  summaryText: string | null;
  fullText: string | null;
  publishedAt: Date | null;
  scrapeAttempted: boolean;
  scrapedAt: Date | null;
  ragIndexed: boolean;
};

// ── Article Card ──────────────────────────────────────────────────────────────

function ArticleCard({ article, isAdmin }: { article: Article; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const scrapeMutation = trpc.magazine.scrapeArticle.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Scraped ${result.charCount.toLocaleString()} characters`);
        utils.magazine.getByAuthor.invalidate();
      } else {
        toast.error("Scrape failed — article may be paywalled");
      }
    },
    onError: () => toast.error("Scrape failed"),
  });

  const indexMutation = trpc.vectorSearch.indexArticle.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Indexed ${result.vectors} vectors in Pinecone`);
        utils.magazine.getByAuthor.invalidate();
      } else {
        toast.error(result.reason ?? "Index failed");
      }
    },
    onError: () => toast.error("Index failed"),
  });

  const meta = SOURCE_META[article.source] ?? {
    name: article.source,
    color: "text-muted-foreground",
    bgColor: "bg-muted border-border",
  };

  const previewText = article.fullText
    ? article.fullText.slice(0, 600)
    : article.summaryText ?? "";

  const hasContent = previewText.length > 0;

  return (
    <div className={`rounded-xl border p-4 ${meta.bgColor} transition-all`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
              {meta.name}
            </span>
            {article.publishedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(article.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {article.fullText && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-green-400 text-green-600 dark:text-green-400">
                Full Text
              </Badge>
            )}
            {article.ragIndexed && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-violet-400 text-violet-600 dark:text-violet-400">
                RAG
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {article.title}
          </h4>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-background/60 transition-colors"
          title="Open article"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
      </div>

      {/* Preview text */}
      {hasContent && (
        <div className="mt-2">
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
            {previewText}
            {article.fullText && article.fullText.length > 600 && !expanded && "…"}
          </p>
          {hasContent && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show more</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {!article.scrapeAttempted && !article.fullText && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              disabled={scrapeMutation.isPending}
              onClick={() => scrapeMutation.mutate({ articleId: article.articleId })}
            >
              {scrapeMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              Scrape Full Text
            </Button>
          )}
          {!article.ragIndexed && (article.fullText || article.summaryText) && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              disabled={indexMutation.isPending}
              onClick={() => indexMutation.mutate({ articleId: article.articleId })}
            >
              {indexMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="text-violet-600">⬡</span>
              )}
              Index in RAG
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function MagazineArticlesPanel({ authorName }: { authorName: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [syncingSource, setSyncingSource] = useState<string | null>(null);

  const { data, isLoading } = trpc.magazine.getByAuthor.useQuery(
    { authorName, limit: 50 },
    { enabled: authorName.length > 2 }
  );

  const syncAllMutation = trpc.magazine.syncAll.useMutation({
    onMutate: () => setSyncingSource("all"),
    onSuccess: (results) => {
      setSyncingSource(null);
      const total = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0);
      toast.success(`Synced all feeds — ${total} new articles`);
      utils.magazine.getByAuthor.invalidate();
    },
    onError: () => {
      setSyncingSource(null);
      toast.error("Sync failed");
    },
  });

  const articles = data?.articles ?? [];
  const total = data?.total ?? 0;

  // Group by source
  const grouped = articles.reduce<Record<string, Article[]>>((acc, a) => {
    const src = a.source;
    if (!acc[src]) acc[src] = [];
    acc[src].push(a as Article);
    return acc;
  }, {});

  const sourceOrder = ["the-atlantic", "the-new-yorker", "wired", "nyt", "washington-post"];
  const sortedSources = Object.keys(grouped).sort(
    (a, b) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b)
  );

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (articles.length === 0 && !isAdmin) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Magazine Articles
          {total > 0 && <span className="ml-1.5 font-normal">({total})</span>}
        </h2>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1"
            disabled={syncAllMutation.isPending}
            onClick={() => syncAllMutation.mutate()}
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Sync All Feeds
          </Button>
        )}
      </div>

      {/* Empty state for admin */}
      {articles.length === 0 && isAdmin && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No articles yet. Sync the magazine feeds to find articles by {authorName}.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={syncAllMutation.isPending}
            onClick={() => syncAllMutation.mutate()}
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync All Feeds
          </Button>
        </div>
      )}

      {/* Grouped articles */}
      {sortedSources.map(source => {
        const sourceArticles = grouped[source];
        const meta = SOURCE_META[source];
        return (
          <div key={source} className="mb-6">
            <div className={`flex items-center gap-2 mb-2 px-1`}>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${meta?.color ?? "text-muted-foreground"}`}>
                {meta?.name ?? source}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {sourceArticles.length} article{sourceArticles.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {sourceArticles.map(article => (
                <ArticleCard key={article.articleId} article={article} isAdmin={isAdmin} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
