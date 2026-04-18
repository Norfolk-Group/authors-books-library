/**
 * ThematicSearch — Conceptual/thematic search powered by Neon pgvector.
 * Allows users to search by idea, theme, or concept (e.g., "books about resilience",
 * "authors who write about leadership", "content on deep work").
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Brain, Search, BookOpen, UserCircle, FileText, Video, Headphones, Mic, X, ArrowLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
type Namespace = "all" | "books" | "authors" | "articles" | "content_items" | "rag_files";

const NAMESPACE_OPTIONS: { value: Namespace; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "books", label: "Books" },
  { value: "authors", label: "Authors" },
  { value: "content_items", label: "Media" },
  { value: "articles", label: "Articles" },
];

const EXAMPLE_QUERIES = [
  "books about building habits",
  "authors who write about decision making",
  "content on deep focus and flow state",
  "leadership and emotional intelligence",
  "startup failure lessons",
  "negotiation and persuasion",
  "creativity and innovation frameworks",
  "stoicism and resilience",
];

type ThematicMeta = { icon: React.FC<{ size?: number; className?: string }>; label: string; color: string; badgeClass: string };
const CONTENT_TYPE_META: Record<string, ThematicMeta> = {
  book: { icon: BookOpen, label: "Book", color: "text-emerald-600", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  author: { icon: UserCircle, label: "Author", color: "text-violet-600", badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  article: { icon: FileText, label: "Article", color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  youtube_video: { icon: Video, label: "Video", color: "text-red-600", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  podcast: { icon: Headphones, label: "Podcast", color: "text-orange-600", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  podcast_episode: { icon: Headphones, label: "Episode", color: "text-orange-600", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  ted_talk: { icon: Mic, label: "TED Talk", color: "text-red-700", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  rag_file: { icon: Brain, label: "Deep Dive", color: "text-purple-600", badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

function getContentMeta(contentType: string): ThematicMeta {
  return CONTENT_TYPE_META[contentType] ?? { icon: FileText, label: contentType, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ThematicSearch() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [namespace, setNamespace] = useState<Namespace>("all");

  const { data, isLoading, isFetching } = trpc.recommendations.thematicSearch.useQuery(
    { query: activeQuery, namespace, topK: 20 },
    {
      enabled: activeQuery.length >= 2,
      staleTime: 2 * 60 * 1000,
    }
  );

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= 2) {
      setActiveQuery(inputValue.trim());
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleExampleClick = (query: string) => {
    setInputValue(query);
    setActiveQuery(query);
  };

  const handleResultClick = (result: NonNullable<typeof data>["results"][number]) => {
    if (result.contentType === "book") {
      setLocation(`/book/${encodeURIComponent(result.title)}`);
    } else if (result.contentType === "author") {
      setLocation(`/author/${encodeURIComponent(result.authorName ?? result.title)}`);
    } else if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  };

  const results = data?.results ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 relative">
            <Brain size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by concept, theme, or idea…"
              className="pl-9 pr-9"
              autoFocus
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(""); setActiveQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={inputValue.trim().length < 2} className="gap-2 flex-shrink-0">
            <Search size={15} />
            Search
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Namespace filter */}
        <div className="flex flex-wrap gap-2">
          {NAMESPACE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setNamespace(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                namespace === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Example queries (shown when no active search) */}
        {!activeQuery && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles size={14} />
              <span>Try searching by concept or theme:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-accent border border-border/60 transition-colors text-foreground/80"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-violet-500" />
                <h3 className="font-semibold text-sm">How Thematic Search Works</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Unlike keyword search, thematic search understands the <em>meaning</em> behind your query.
                It uses Neon pgvector embeddings to find books, authors, and media that are conceptually
                related — even if they don't share exact words. Ask about ideas, frameworks, or themes
                and discover content you didn't know existed in your library.
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {(isLoading || isFetching) && activeQuery && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Results */}
        {!isLoading && !isFetching && activeQuery && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {results.length > 0
                  ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${activeQuery}"`
                  : `No results found for "${activeQuery}"`}
              </p>
              {results.length > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Sparkles size={10} />
                  AI-powered
                </Badge>
              )}
            </div>

            {results.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <Brain size={40} className="mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">
                  No semantically similar content found. Try rephrasing your query or broadening the scope.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {results.map((result, i) => {
                const meta = getContentMeta(result.contentType ?? "other");
                const Icon = meta.icon;
                const isNavigable = result.contentType === "book" || result.contentType === "author" || !!result.url;
                const coverUrl = (result as any).coverUrl ?? (result as any).avatarUrl;
                return (
                  <button
                    key={`${result.contentType}-${result.id}-${i}`}
                    onClick={() => handleResultClick(result)}
                    disabled={!isNavigable}
                    className={cn(
                      "w-full group flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60",
                      "bg-card text-left transition-all duration-200",
                      isNavigable && "hover:bg-accent/30 hover:shadow-sm hover:scale-[1.005] cursor-pointer",
                      !isNavigable && "opacity-70 cursor-default"
                    )}
                  >
                    {/* Rank */}
                    <div className="w-6 text-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                    </div>
                    {/* Cover/avatar */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {coverUrl ? (
                        <img src={coverUrl} alt={result.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Icon size={18} className={meta.color} />
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold leading-tight line-clamp-1 text-card-foreground">
                        {result.title}
                      </p>
                      {result.authorName && (
                        <p className="text-xs text-muted-foreground">{result.authorName}</p>
                      )}
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed mt-1">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                    {/* Score + type */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge className={cn("text-[10px] px-1.5 py-0.5 border-0", meta.badgeClass)}>
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {Math.round((result.score ?? 0) * 100)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
