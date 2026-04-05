/**
 * LibraryHeader — sticky top bar with breadcrumb + search input.
 * Extracted from Home.tsx to keep the orchestrator lean.
 *
 * Now includes SemanticSearchDropdown: when the user types 3+ characters,
 * a Pinecone-powered semantic search overlay appears below the search bar.
 */
import { useRef, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, X, ChevronRight } from "lucide-react";
import type { TabType } from "@/components/library/LibrarySidebar";
import { SemanticSearchDropdown } from "@/components/library/SemanticSearchDropdown";

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
  const [semanticOpen, setSemanticOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setSemanticOpen(val.trim().length >= 3);
    },
    [setQuery]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setSemanticOpen(false);
    inputRef.current?.focus();
  }, [setQuery]);

  const handleSemanticClose = useCallback(() => {
    setSemanticOpen(false);
  }, []);

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

      {/* Search bar + semantic dropdown wrapper */}
      <div className="ml-auto relative w-full sm:w-64 max-w-xs">
        <div className="search-glow rounded-md border border-transparent">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search authors, books, topics..."
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim().length >= 3) setSemanticOpen(true);
            }}
            className="pl-9 pr-8 h-8 text-sm bg-background"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Semantic search results dropdown */}
        {semanticOpen && (
          <SemanticSearchDropdown
            query={query}
            onClose={handleSemanticClose}
            onNavigateAuthor={onNavigateAuthor}
            onNavigateBook={onNavigateBook}
          />
        )}
      </div>
    </header>
  );
}
