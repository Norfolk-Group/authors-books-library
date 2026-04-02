/**
 * LibraryHeader — sticky top bar with breadcrumb + search input.
 * Extracted from Home.tsx to keep the orchestrator lean.
 */
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, X, ChevronRight } from "lucide-react";
import type { TabType } from "@/components/library/LibrarySidebar";

interface LibraryHeaderProps {
  activeTab: TabType;
  tabDisplayName: (tab: TabType) => string;
  selectedCategoriesSize: number;
  query: string;
  setQuery: (q: string) => void;
}

export function LibraryHeader({
  activeTab,
  tabDisplayName,
  selectedCategoriesSize,
  query,
  setQuery,
}: LibraryHeaderProps) {
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
      <div className="ml-auto relative w-full sm:w-64 max-w-xs search-glow rounded-md border border-transparent">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search authors, books, topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-8 h-8 text-sm bg-background"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}
