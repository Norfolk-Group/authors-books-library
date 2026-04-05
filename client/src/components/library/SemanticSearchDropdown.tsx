/**
 * SemanticSearchDropdown — Pinecone-powered semantic search results overlay.
 *
 * Appears below the LibraryHeader search bar when the user types a query of
 * 3+ characters and waits 500 ms.  Shows up to 8 results grouped by content
 * type (articles / books / authors) with a relevance score badge.
 *
 * Usage:
 *   <SemanticSearchDropdown query={query} onClose={() => setQuery("")} />
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import {
  Article,
  Books,
  UserCircle,
  ArrowSquareOut,
  Brain,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SemanticResult {
  id: string;
  score: number;
  snippet: string;
  metadata: {
    contentType: "article" | "book" | "author";
    title: string;
    authorName?: string;
    source?: string;
    url?: string;
    publishedAt?: string;
  };
}

interface SemanticSearchDropdownProps {
  query: string;
  /** Called when the user clicks a result or presses Escape */
  onClose: () => void;
  /** Optionally navigate to an author card */
  onNavigateAuthor?: (name: string) => void;
  /** Optionally navigate to a book card */
  onNavigateBook?: (titleKey: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const CONTENT_TYPE_META = {
  article: {
    label: "Articles",
    icon: Article,
    color: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  book: {
    label: "Books",
    icon: Books,
    color: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  author: {
    label: "Authors",
    icon: UserCircle,
    color: "text-violet-600 dark:text-violet-400",
    badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
} as const;

function scoreLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.70) return "Good";
  return "Fair";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SemanticSearchDropdown({
  query,
  onClose,
  onNavigateAuthor,
  onNavigateBook,
}: SemanticSearchDropdownProps) {
  const debouncedQuery = useDebounce(query, 500);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only fire when query is 3+ chars
  const enabled = debouncedQuery.trim().length >= 3;

  const { data, isFetching, error } = trpc.vectorSearch.search.useQuery(
    { query: debouncedQuery.trim(), topK: 8 },
    {
      enabled,
      staleTime: 30_000,
      retry: false,
    }
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!enabled) return null;

  const results = (data as SemanticResult[] | undefined) ?? [];

  // Group results by content type
  const grouped = {
    article: results.filter((r) => r.metadata.contentType === "article"),
    book: results.filter((r) => r.metadata.contentType === "book"),
    author: results.filter((r) => r.metadata.contentType === "author"),
  };

  const hasResults = results.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute top-full right-0 mt-1 w-full sm:w-[520px] max-h-[480px] overflow-y-auto",
        "rounded-xl border border-border bg-background shadow-xl z-50",
        "animate-in fade-in slide-in-from-top-2 duration-150"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Brain className="w-3.5 h-3.5 text-indigo-500" weight="duotone" />
        <span className="text-xs font-medium text-muted-foreground">
          Semantic search
          {debouncedQuery !== query && " (typing…)"}
        </span>
        {isFetching && <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />}
      </div>

      {/* Loading state */}
      {isFetching && !hasResults && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching across books, authors, and articles…
        </div>
      )}

      {/* Error state */}
      {error && !isFetching && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Semantic search unavailable — Pinecone index may not be populated yet.
          <br />
          <span className="text-xs">Visit Admin → Magazine Feeds to index content.</span>
        </div>
      )}

      {/* Empty state */}
      {!isFetching && !error && enabled && hasResults === false && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No semantic matches found for "{debouncedQuery}".
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="py-1">
          {(["article", "book", "author"] as const).map((type) => {
            const group = grouped[type];
            if (group.length === 0) return null;
            const meta = CONTENT_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Icon className={cn("w-3.5 h-3.5", meta.color)} weight="duotone" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
                {group.map((result) => (
                  <ResultRow
                    key={result.id}
                    result={result}
                    badgeClass={meta.badgeClass}
                    onNavigateAuthor={onNavigateAuthor}
                    onNavigateBook={onNavigateBook}
                    onClose={onClose}
                  />
                ))}
                <Separator className="my-1" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ResultRow ─────────────────────────────────────────────────────────────────
function ResultRow({
  result,
  badgeClass,
  onNavigateAuthor,
  onNavigateBook,
  onClose,
}: {
  result: SemanticResult;
  badgeClass: string;
  onNavigateAuthor?: (name: string) => void;
  onNavigateBook?: (titleKey: string) => void;
  onClose: () => void;
}) {
  const { metadata, score, snippet } = result;
  const isClickable =
    (metadata.contentType === "author" && !!onNavigateAuthor) ||
    (metadata.contentType === "book" && !!onNavigateBook) ||
    (metadata.contentType === "article" && !!metadata.url);

  const handleClick = () => {
    if (metadata.contentType === "author" && onNavigateAuthor) {
      onNavigateAuthor(metadata.title);
      onClose();
    } else if (metadata.contentType === "book" && onNavigateBook) {
      onNavigateBook(metadata.title.toLowerCase());
      onClose();
    } else if (metadata.contentType === "article" && metadata.url) {
      window.open(metadata.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      onClick={isClickable ? handleClick : undefined}
      className={cn(
        "w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors",
        isClickable && "cursor-pointer",
        !isClickable && "cursor-default"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate">{metadata.title}</span>
            <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", badgeClass)}>
              {scoreLabel(score)}
            </Badge>
          </div>
          {metadata.authorName && metadata.contentType !== "author" && (
            <p className="text-xs text-muted-foreground mb-0.5">{metadata.authorName}</p>
          )}
          {metadata.source && (
            <p className="text-[10px] text-muted-foreground/70 mb-0.5 uppercase tracking-wide">
              {metadata.source}
            </p>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">{snippet}</p>
        </div>
        {metadata.contentType === "article" && metadata.url && (
          <ArrowSquareOut className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" weight="bold" />
        )}
      </div>
    </button>
  );
}
