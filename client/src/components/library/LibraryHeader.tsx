/**
 * LibraryHeader — sticky top bar with breadcrumb + search input.
 * Extracted from Home.tsx to keep the orchestrator lean.
 *
 * Search modes:
 *   - "keyword" (default): instant local filter, no network call
 *   - "ai":  Neon-powered semantic search via SemanticSearchDropdown
 *
 * The mode toggle is a compact two-segment pill to the left of the search bar.
 * The selected mode is persisted to localStorage so it survives page refreshes.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, X, ChevronRight, Keyboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabType } from "@/components/library/LibrarySidebar";
import { SemanticSearchDropdown } from "@/components/library/SemanticSearchDropdown";

type SearchMode = "keyword" | "ai";

const STORAGE_KEY = "library-search-mode";

function useSearchMode(): [SearchMode, (m: SearchMode) => void] {
  const [mode, setModeState] = useState<SearchMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "ai" ? "ai" : "keyword";
    } catch {
      return "keyword";
    }
  });

  const setMode = useCallback((m: SearchMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  return [mode, setMode];
}

interface LibraryHeaderProps {
  activeTab: TabType;
  tabDisplayName: (tab: TabType) => string;
  selectedCategoriesSize: number;
  query: string;
  setQuery: (q: string) => void;
  /** Optionally navigate to an author card */
  onNavigateAuthor?: (name: string) => void;
  /** Optionally navigate to a book card */
  onNavigateBook?: (titleKey: string) => void;
}

export function LibraryHeader({
  activeTab,
  tabDisplayName,
  selectedCategoriesSize,
  query,
  setQuery,
  onNavigateAuthor,
  onNavigateBook,
}: LibraryHeaderProps) {
  const [searchMode, setSearchMode] = useSearchMode();
  const [semanticOpen, setSemanticOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // When switching to keyword mode, close the semantic dropdown
  const handleModeChange = useCallback(
    (mode: SearchMode) => {
      setSearchMode(mode);
      if (mode === "keyword") {
        setSemanticOpen(false);
      } else if (query.trim().length >= 3) {
        setSemanticOpen(true);
      }
    },
    [setSearchMode, query]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (searchMode === "ai") {
        setSemanticOpen(val.trim().length >= 3);
      }
    },
    [setQuery, searchMode]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setSemanticOpen(false);
    inputRef.current?.focus();
  }, [setQuery]);

  const handleSemanticClose = useCallback(() => {
    setSemanticOpen(false);
  }, []);

  // Re-open dropdown when switching to AI mode with existing query
  useEffect(() => {
    if (searchMode === "ai" && query.trim().length >= 3) {
      setSemanticOpen(true);
    }
  }, [searchMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Ricardo Cidale's Library</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="capitalize">{tabDisplayName(activeTab)}</span>
        {selectedCategoriesSize > 0 && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>{selectedCategoriesSize} filter{selectedCategoriesSize > 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      {/* Search mode toggle + search bar */}
      <div className="ml-auto flex items-center gap-2">
        {/* Mode toggle pill */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center rounded-full border border-border bg-muted/50 p-0.5 gap-0.5 shrink-0"
              role="group"
              aria-label="Search mode"
            >
              <button
                onClick={() => handleModeChange("keyword")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-150",
                  searchMode === "keyword"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={searchMode === "keyword"}
              >
                <Keyboard className="w-2.5 h-2.5" />
                <span className="hidden xs:inline">Keyword</span>
              </button>
              <button
                onClick={() => handleModeChange("ai")}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-150",
                  searchMode === "ai"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={searchMode === "ai"}
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span className="hidden xs:inline">AI</span>
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[220px]">
            {searchMode === "keyword"
              ? "Keyword mode: instant local filter. Switch to AI for Neon semantic search."
              : "AI mode: Neon semantic search — finds conceptually related content. Switch to Keyword for instant local filter."}
          </TooltipContent>
        </Tooltip>

        {/* Search bar + semantic dropdown wrapper */}
        <div className="relative w-full sm:w-64 max-w-xs">
          <div className="search-glow rounded-md border border-transparent">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder={
                searchMode === "ai"
                  ? "Semantic search…"
                  : "Search authors, books, topics…"
              }
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchMode === "ai" && query.trim().length >= 3) {
                  setSemanticOpen(true);
                }
              }}
              className={cn(
                "pl-9 pr-8 h-8 text-sm bg-background",
                searchMode === "ai" && "ring-1 ring-indigo-500/40"
              )}
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Semantic search results dropdown — only in AI mode */}
          {searchMode === "ai" && semanticOpen && (
            <SemanticSearchDropdown
              query={query}
              onClose={handleSemanticClose}
              onNavigateAuthor={onNavigateAuthor}
              onNavigateBook={onNavigateBook}
            />
          )}
        </div>
      </div>
    </header>
  );
}
