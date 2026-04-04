/**
 * LibrarySidebar — Left navigation panel for the Home page.
 * 4 tabs: Authors, Books, Media, Favorites
 * Filter button opens a popover with category toggle switches.
 */
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Users,
  ExternalLink,
  ChevronRight,
  Heart,
  ShieldCheck,
  Trophy,
  BarChart,
  RefreshCw,
  Film,
  Flame,
  GitCompare,
  Tag,
  X,
  TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { STATS } from "@/components/library/libraryConstants";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { FilterPopover } from "@/components/library/FilterPopover";

export type TabType = "authors" | "books" | "media" | "favorites";

interface LibrarySidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  clearCategoryFilters: () => void;
  selectedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  /** Counts per category for the active tab */
  categoryCounts: Record<string, number>;
  filteredAuthorsCount: number;
  filteredBooksCount: number;
  filteredMediaCount: number;
  favoriteCount: number;
  isAuthenticated: boolean;
  authorAvatarData: { avatarUrl?: string | null }[] | undefined;
  /** Currently selected tag slugs for filtering */
  selectedTagSlugs?: Set<string>;
  toggleTagSlug?: (slug: string) => void;
  clearTagFilters?: () => void;
}

export function LibrarySidebar({
  activeTab,
  setActiveTab,
  clearCategoryFilters,
  selectedCategories,
  toggleCategory,
  categoryCounts,
  filteredAuthorsCount,
  filteredBooksCount,
  filteredMediaCount,
  favoriteCount,
  isAuthenticated,
  authorAvatarData,
  selectedTagSlugs = new Set(),
  toggleTagSlug,
  clearTagFilters,
}: LibrarySidebarProps) {
  const { settings: { colorMode: appTheme } } = useAppSettings();

  // Live last-sync timestamp
  const lastSyncQuery = trpc.admin.getLastSync.useQuery(undefined, { staleTime: 5 * 60_000 });

  // Drive Sync (admin only)
  const utils = trpc.useUtils();
  const regenerateMutation = trpc.library.regenerate.useMutation();
  const [syncState, setSyncState] = useState<"idle" | "running" | "done" | "error">("idle");
  const handleDriveSync = async () => {
    if (syncState === "running") return;
    setSyncState("running");
    try {
      const result = await regenerateMutation.mutateAsync();
      if (result.success && result.stats) {
        setSyncState("done");
        await utils.library.getStats.invalidate();
        await utils.admin.getLastSync.invalidate();
        toast.success(`Drive synced — ${result.stats.authors} authors, ${result.stats.books} books`, { duration: 8000 });
        setTimeout(() => setSyncState("idle"), 5000);
      } else {
        setSyncState("error");
        toast.error("Drive sync failed");
        setTimeout(() => setSyncState("idle"), 4000);
      }
    } catch (err) {
      setSyncState("error");
      toast.error(err instanceof Error ? err.message : "Drive sync error");
      setTimeout(() => setSyncState("idle"), 4000);
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 pt-6 pb-5 border-b border-sidebar-border">
        {/* Expanded: centered logo + app name */}
        <div className="group-data-[collapsible=icon]:hidden flex flex-col items-center gap-2">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png"
            alt="Ricardo Cidale's Library"
            className="w-20 h-20 object-contain"
          />
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70 leading-tight">
              Ricardo Cidale's
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70 leading-tight">
              Library
            </p>
          </div>
        </div>
        {/* Collapsed: centered logo icon only */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-1">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo0464x64_b5df2d76.png"
            alt="Library Logo"
            className="w-8 h-8 object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Navigation tabs */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "authors"} onClick={() => { setActiveTab("authors"); clearCategoryFilters(); }} tooltip="Authors">
                  <Users className="w-4 h-4" />
                  <span>Authors</span>
                  <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredAuthorsCount}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "books"} onClick={() => { setActiveTab("books"); clearCategoryFilters(); }} tooltip="Books">
                  <BookOpen className="w-4 h-4" />
                  <span>Books</span>
                  <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredBooksCount}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeTab === "media"} onClick={() => { setActiveTab("media"); clearCategoryFilters(); }} tooltip="Media">
                  <Film className="w-4 h-4" />
                  <span>Media</span>
                  <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{filteredMediaCount}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAuthenticated && (
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={activeTab === "favorites"} onClick={() => { setActiveTab("favorites"); clearCategoryFilters(); }} tooltip="Favorites">
                    <Heart className="w-4 h-4" />
                    <span>Favorites</span>
                    <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                      {favoriteCount}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2 group-data-[collapsible=icon]:hidden" />

        {/* Filter button */}
        {activeTab !== "favorites" && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2">
            <FilterPopover
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              clearCategoryFilters={clearCategoryFilters}
              categoryCounts={categoryCounts}
            />
          </SidebarGroup>
        )}

        {/* Tag filter */}
        <TagFilterSection
          selectedTagSlugs={selectedTagSlugs}
          toggleTagSlug={toggleTagSlug}
          clearTagFilters={clearTagFilters}
        />
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        {/* Live sync timestamp */}
        {(() => {
          const ts = lastSyncQuery.data;
          let label: string;
          if (lastSyncQuery.isLoading) {
            label = "Data as of …";
          } else if (ts) {
            const d = new Date(ts);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / 60_000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            let relative: string;
            if (diffMins < 2) relative = "just now";
            else if (diffMins < 60) relative = `${diffMins}m ago`;
            else if (diffHours < 24) relative = `${diffHours}h ago`;
            else if (diffDays === 1) relative = "yesterday";
            else relative = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            label = `Synced ${relative}`;
          } else {
            label = `Data as of ${STATS.lastUpdated}`;
          }
          return (
            <p className="text-[10px] text-muted-foreground mb-1" title={ts ? new Date(ts).toLocaleString() : undefined}>
              {label}
            </p>
          );
        })()}

        {/* Avatar progress bar */}
        {authorAvatarData && (() => {
          const withAvatar = authorAvatarData.filter(r => r.avatarUrl).length;
          const total = STATS.totalAuthors;
          const pct = Math.round((withAvatar / total) * 100);
          return (
            <div className="flex items-center gap-1.5 mb-2" title={`${withAvatar} of ${total} authors have avatars`}>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-chart-5" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{withAvatar}/{total} avatars</span>
            </div>
          );
        })()}

        {/* Footer links */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <a href="/stats" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
            Reading Stats
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          <a href="/leaderboard" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
            Leaderboard
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          <a href="/compare" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <BarChart className="w-3.5 h-3.5 flex-shrink-0" />
            Compare Authors
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          <a href="/interests/heatmap" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <Flame className="w-3.5 h-3.5 flex-shrink-0" />
            Interest Heatmap
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          <a href="/interests/contrast" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <GitCompare className="w-3.5 h-3.5 flex-shrink-0" />
            Group Contrast
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          <a href="/admin" className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            Admin Console
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </a>
          {isAuthenticated && (
            <button
              onClick={handleDriveSync}
              disabled={syncState === "running"}
              className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors ${
                syncState === "running"
                  ? "text-muted-foreground cursor-wait"
                  : syncState === "done"
                  ? "text-emerald-600 hover:bg-muted/60"
                  : syncState === "error"
                  ? "text-rose-500 hover:bg-muted/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              title="Re-scan Google Drive and rebuild the library"
            >
              <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${syncState === "running" ? "animate-spin" : ""}`} />
              {syncState === "running" ? "Syncing Drive…" : syncState === "done" ? "Sync complete" : syncState === "error" ? "Sync failed" : "Sync Drive"}
              {syncState === "idle" && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </button>
          )}
        </div>

        {/* Media Folders */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Media Folders</p>
          <div className="flex flex-col gap-1">
            <a href="https://drive.google.com/drive/folders/1_sTZD5m4dfP4byryghw9XgeDyPnYWNiH" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60">
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              Author Avatars
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>
            <a href="https://drive.google.com/drive/folders/1qzmgRdCQr98fxVs6Bvnqi3J-tS574GY1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/60">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
              Book Covers
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>
          </div>
        </div>

        {/* User identity */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2.5 px-1">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/ricardocidalecartoon_330eb604.png"
            alt="Ricardo Cidale"
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20 avatar-bob"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground/80 truncate">Ricardo Cidale</p>
            <p className="text-[10px] text-muted-foreground truncate">Library Owner</p>
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-2 flex items-center justify-center gap-3">
          <a href="/privacy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Privacy
          </a>
          <span className="text-[10px] text-muted-foreground/40">·</span>
          <a href="/terms" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Terms
          </a>
          <span className="text-[10px] text-muted-foreground/40">·</span>
          <a href="/cookies" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            Cookies
          </a>
        </div>

        {/* Norfolk AI branding */}
        <div className="mt-3 pt-3 border-t border-border/30">
          <a href="https://norfolkai.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:opacity-90 transition-opacity norfolk-logo-pulse" title="Powered by Norfolk AI">
            <img
              src={appTheme === "dark"
                ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-white_d92c1722.png"
                : "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-blue_9ed63fc7.png"
              }
              alt="Norfolk AI"
              className="w-4 h-4 object-contain"
            />
            <span className="text-[10px] text-muted-foreground tracking-wide">Powered by Norfolk AI</span>
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ── Tag Filter Section ────────────────────────────────────────────────────────
function TagFilterSection({
  selectedTagSlugs,
  toggleTagSlug,
  clearTagFilters,
}: {
  selectedTagSlugs: Set<string>;
  toggleTagSlug?: (slug: string) => void;
  clearTagFilters?: () => void;
}) {
  const { data: allTags = [] } = trpc.tags.list.useQuery();

  // Sort by usageCount desc so most-used tags appear first (Tag Cloud ordering)
  const sortedTags = useMemo(
    () => [...allTags].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0)),
    [allTags]
  );

  const maxCount = useMemo(
    () => Math.max(1, ...sortedTags.map((t) => t.usageCount ?? 0)),
    [sortedTags]
  );

  if (allTags.length === 0 || !toggleTagSlug) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Tag className="w-3 h-3" />
          Tag Cloud
          <span className="text-[10px] text-muted-foreground/60 font-normal">({allTags.length})</span>
        </p>
        {selectedTagSlugs.size > 0 && clearTagFilters && (
          <button
            onClick={clearTagFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Clear tag filters"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 px-2 py-1">
        {sortedTags.map((tag) => {
          const isSelected = selectedTagSlugs.has(tag.slug);
          const count = tag.usageCount ?? 0;
          // Scale font size between 10px (min) and 14px (max) based on usage
          const fontSize = count > 0 ? Math.round(10 + (count / maxCount) * 4) : 10;
          return (
            <button
              key={tag.slug}
              onClick={() => toggleTagSlug(tag.slug)}
              style={{
                backgroundColor: isSelected ? tag.color + "22" : "transparent",
                color: isSelected ? tag.color : "var(--muted-foreground)",
                borderColor: isSelected ? tag.color + "44" : "var(--border)",
                fontSize: `${fontSize}px`,
              }}
              className="px-2 py-0.5 rounded border transition-all hover:scale-105 font-medium leading-snug"
              title={`Filter by ${tag.name}${count > 0 ? ` (${count} items)` : ""}`}
            >
              {tag.name}
              {count > 0 && (
                <span
                  style={{ color: isSelected ? tag.color + "99" : "var(--muted-foreground)" }}
                  className="ml-1 text-[9px] font-normal"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </SidebarGroup>
  );
}
