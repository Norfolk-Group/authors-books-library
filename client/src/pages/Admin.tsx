/**
 * Admin Console — Thin orchestrator
 *
 * All action handlers live in useAdminActions hook.
 * All tab content lives in focused components under components/admin/.
 *
 * Navigation groups:
 *   Content        → Authors | Books | Tags | Data Pipeline
 *   Media          → Media Assets | Content Items | Sync & Storage
 *   Intelligence   → Digital Me | Research | AI Settings | AI Models
 *   Personalization → My Interests | Favorites
 *   System         → Health | Dependencies | Schedules | Info Tools
 *   Configuration  → App Settings | About
 */
import { useState, useCallback } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import PageHeader from "@/components/PageHeader";
import {
  Books,
  Image,
  Database,
  ChartBar,
  Gear,
  Info,
  Brain,
  UsersThree,
  Lightning,
  Globe,
  Cloud,
  Heart,
  Package,
  CalendarCheck,
  Robot,
  Cpu,
  Wrench,
  Star,
  Heartbeat,
  MagnifyingGlass,
  Tag,
  Cpu as CircuitBoard,
} from "@phosphor-icons/react";
import { Loader2, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// ── Tab components ────────────────────────────────────────────────────────────
// Content
import { AdminAuthorsTab } from "@/components/admin/AdminAuthorsTab";
import { AdminBooksTab } from "@/components/admin/AdminBooksTab";
import { AdminTagsTab } from "@/components/admin/AdminTagsTab";
import { AdminPipelineTab } from "@/components/admin/AdminPipelineTab";
// Media
import { AdminMediaTab } from "@/components/admin/AdminMediaTab";
import { AdminContentItemsTab } from "@/components/admin/AdminContentItemsTab";
import { AdminSyncTab } from "@/components/admin/AdminSyncTab";
// Intelligence
import { AdminDigitalMeTab } from "@/components/admin/AdminDigitalMeTab";
import { AdminResearchTab } from "@/components/admin/AdminResearchTab";
import { AdminAiSettingsTab } from "@/components/admin/AdminAiSettingsTab";
import { AdminAiModelsTab } from "@/components/admin/AdminAiModelsTab";
// Personalization
import { AdminInterestsTab } from "@/components/admin/AdminInterestsTab";
import { AdminFavoritesTab } from "@/components/admin/AdminFavoritesTab";
// System
import { AdminHealthTab } from "@/components/admin/AdminHealthTab";
import { AdminDependenciesTab } from "@/components/admin/AdminDependenciesTab";
import { AdminSchedulesTab } from "@/components/admin/AdminSchedulesTab";
import { AdminInfoToolsTab } from "@/components/admin/AdminInfoToolsTab";
// Configuration
import { AdminAppSettingsTab } from "@/components/admin/AdminAppSettingsTab";
import { AdminAboutTab } from "@/components/admin/AdminAboutTab";

// ── Hook ──────────────────────────────────────────────────────────────────────
import { useAdminActions } from "@/hooks/useAdminActions";

// ── Types ─────────────────────────────────────────────────────────────────────
type NavItem = { id: string; label: string; icon: PhosphorIcon };
type NavGroup = { label: string; icon: PhosphorIcon; items: NavItem[] };

// ── Navigation ────────────────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Content",
    icon: Books,
    items: [
      { id: "authors", label: "Authors", icon: UsersThree },
      { id: "books", label: "Books", icon: Books },
      { id: "tags", label: "Tags", icon: Tag },
      { id: "pipeline", label: "Data Pipeline", icon: Database },
    ],
  },
  {
    label: "Media",
    icon: Image,
    items: [
      { id: "media", label: "Media Assets", icon: Image },
      { id: "content-items", label: "Content Items", icon: Globe },
      { id: "sync", label: "Sync & Storage", icon: Cloud },
    ],
  },
  {
    label: "Intelligence",
    icon: Brain,
    items: [
      { id: "digital-me", label: "Digital Me", icon: Robot },
      { id: "cascade", label: "Research", icon: ChartBar },
      { id: "ai", label: "AI Settings", icon: Cpu },
      { id: "ai-models", label: "AI Models", icon: CircuitBoard },
    ],
  },
  {
    label: "Personalization",
    icon: Heart,
    items: [
      { id: "interests", label: "My Interests", icon: Heart },
      { id: "favorites", label: "Favorites", icon: Star },
    ],
  },
  {
    label: "System",
    icon: Wrench,
    items: [
      { id: "health", label: "Health", icon: Heartbeat },
      { id: "dependencies", label: "Dependencies", icon: Package },
      { id: "scheduling", label: "Schedules", icon: CalendarCheck },
      { id: "tools", label: "Info Tools", icon: Lightning },
    ],
  },
  {
    label: "Configuration",
    icon: Gear,
    items: [
      { id: "settings", label: "App Settings", icon: Gear },
      { id: "about", label: "About", icon: Info },
    ],
  },
];

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function Admin() {
  const { settings } = useAppSettings();
  const actions = useAdminActions(settings);

  const [activeSection, setActiveSection] = useState("authors");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => { initial[g.label] = true; });
    return initial;
  });

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // Running state per group for sidebar badges
  const groupRunningMap: Record<string, boolean> = {
    Content: [
      actions.enrichBiosState, actions.enrichBooksState, actions.regenerateState,
      actions.updateLinksState, actions.enrichRichBioState, actions.discoverPlatformsState,
      actions.enrichSocialStatsState, actions.enrichEnterpriseState, actions.enrichProfessionalState,
      actions.updateBookSummariesState, actions.enrichRichSummaryState, actions.rebuildCoversState,
    ].some((s) => s.status === "running"),
    Media: [
      actions.portraitState, actions.mirrorAvatarsState, actions.auditBgState,
      actions.normalizeBgState, actions.scrapeState, actions.mirrorCoversState, actions.rebuildCoversState,
    ].some((s) => s.status === "running"),
    Intelligence: false,
    Personalization: false,
    System: false,
    Configuration: false,
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PageHeader crumbs={[{ label: "Admin Console" }]} />

      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-3 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50/30 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-transparent border-b border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <div className="flex items-center gap-3 cursor-default">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background border border-border/60 overflow-hidden">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo0464x64_b5df2d76.png"
                        alt="Library Logo"
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold text-sm">Admin Console</span>
                      <span className="text-[10px] text-muted-foreground">Manage operations</span>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {/* Search bar */}
            <div className="relative mt-2 group-data-[collapsible=icon]:hidden">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sections…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {actions.anyRunning && (
              <div className="mt-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 group-data-[collapsible=icon]:hidden">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Operations running…</span>
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            {NAV_GROUPS.map((group) => {
              const filteredItems = sidebarSearch.trim()
                ? group.items.filter((item) =>
                    item.label.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                    group.label.toLowerCase().includes(sidebarSearch.toLowerCase())
                  )
                : group.items;
              if (filteredItems.length === 0) return null;
              const isGroupRunning = groupRunningMap[group.label] ?? false;
              const isExpanded = expandedGroups[group.label] ?? true;

              return (
                <Collapsible
                  key={group.label}
                  open={isExpanded}
                  onOpenChange={() => toggleGroup(group.label)}
                  className="group/collapsible"
                >
                  <SidebarGroup>
                    <SidebarGroupLabel asChild>
                      <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                        <group.icon className="h-4 w-4 shrink-0" weight="duotone" />
                        <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">{group.label}</span>
                        <span className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                          {isGroupRunning && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          )}
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </span>
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {filteredItems.map((item) => (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                isActive={activeSection === item.id}
                                onClick={() => setActiveSection(item.id)}
                                className="transition-all duration-150"
                              >
                                <item.icon
                                  className="h-4 w-4 shrink-0"
                                  weight={activeSection === item.id ? "fill" : "regular"}
                                />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              );
            })}
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          {/* Breadcrumb header */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border" />
            <span className="text-sm text-muted-foreground">
              {NAV_GROUPS.find((g) => g.items.some((i) => i.id === activeSection))?.label}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeSection)?.label}
            </span>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-5xl mx-auto space-y-6">

              {/* ── Content ── */}
              {activeSection === "authors" && (
                <AdminAuthorsTab
                  anyRunning={actions.anyRunning}
                  enrichBiosState={actions.enrichBiosState}
                  portraitState={actions.portraitState}
                  mirrorAvatarsState={actions.mirrorAvatarsState}
                  auditBgState={actions.auditBgState}
                  normalizeBgState={actions.normalizeBgState}
                  updateLinksState={actions.updateLinksState}
                  enrichRichBioState={actions.enrichRichBioState}
                  discoverPlatformsState={actions.discoverPlatformsState}
                  enrichSocialStatsState={actions.enrichSocialStatsState}
                  enrichEnterpriseState={actions.enrichEnterpriseState}
                  enrichProfessionalState={actions.enrichProfessionalState}
                  bgMismatchList={actions.bgMismatchList}
                  getLastRun={actions.getLastRun}
                  handleEnrichBios={actions.handleEnrichBios}
                  handleGeneratePortraits={actions.handleGeneratePortraits}
                  handleMirrorPhotos={actions.handleMirrorPhotos}
                  handleAuditAvatarBackgrounds={actions.handleAuditAvatarBackgrounds}
                  handleNormalizeAvatarBackgrounds={actions.handleNormalizeAvatarBackgrounds}
                  handleUpdateAllAuthorLinks={actions.handleUpdateAllAuthorLinks}
                  handleEnrichRichBio={actions.handleEnrichRichBio}
                  handleDiscoverPlatforms={actions.handleDiscoverPlatforms}
                  handleEnrichSocialStats={actions.handleEnrichSocialStats}
                  handleEnrichEnterprise={actions.handleEnrichEnterprise}
                  handleEnrichProfessional={actions.handleEnrichProfessional}
                />
              )}
              {activeSection === "books" && (
                <AdminBooksTab
                  anyRunning={actions.anyRunning}
                  enrichBooksState={actions.enrichBooksState}
                  updateBookSummariesState={actions.updateBookSummariesState}
                  enrichRichSummaryState={actions.enrichRichSummaryState}
                  scrapeState={actions.scrapeState}
                  mirrorCoversState={actions.mirrorCoversState}
                  rebuildCoversState={actions.rebuildCoversState}
                  batchScrapeStats={actions.batchScrapeStats}
                  getLastRun={actions.getLastRun}
                  handleEnrichBooks={actions.handleEnrichBooks}
                  handleUpdateAllBookSummaries={actions.handleUpdateAllBookSummaries}
                  handleEnrichRichSummary={actions.handleEnrichRichSummary}
                  handleScrapeCovers={actions.handleScrapeCovers}
                  handleMirrorCovers={actions.handleMirrorCovers}
                  handleRebuildCovers={actions.handleRebuildCovers}
                />
              )}
              {activeSection === "tags" && <AdminTagsTab />}
              {activeSection === "pipeline" && (
                <AdminPipelineTab
                  anyRunning={actions.anyRunning}
                  regenerateState={actions.regenerateState}
                  enrichBiosState={actions.enrichBiosState}
                  enrichBooksState={actions.enrichBooksState}
                  discoverPlatformsState={actions.discoverPlatformsState}
                  enrichSocialStatsState={actions.enrichSocialStatsState}
                  enrichRichBioState={actions.enrichRichBioState}
                  enrichRichSummaryState={actions.enrichRichSummaryState}
                  enrichEnterpriseState={actions.enrichEnterpriseState}
                  enrichProfessionalState={actions.enrichProfessionalState}
                  authorStats={actions.authorStats}
                  bookStats={actions.bookStats}
                  batchScrapeStats={actions.batchScrapeStats}
                  getLastRun={actions.getLastRun}
                  handleRegenerate={actions.handleRegenerate}
                  handleEnrichBios={actions.handleEnrichBios}
                  handleEnrichBooks={actions.handleEnrichBooks}
                  handleDiscoverPlatforms={actions.handleDiscoverPlatforms}
                  handleEnrichSocialStats={actions.handleEnrichSocialStats}
                  handleEnrichRichBio={actions.handleEnrichRichBio}
                  handleEnrichRichSummary={actions.handleEnrichRichSummary}
                  handleEnrichEnterprise={actions.handleEnrichEnterprise}
                  handleEnrichProfessional={actions.handleEnrichProfessional}
                />
              )}

              {/* ── Media ── */}
              {activeSection === "media" && (
                <AdminMediaTab
                  anyRunning={actions.anyRunning}
                  portraitState={actions.portraitState}
                  mirrorAvatarsState={actions.mirrorAvatarsState}
                  auditBgState={actions.auditBgState}
                  normalizeBgState={actions.normalizeBgState}
                  scrapeState={actions.scrapeState}
                  mirrorCoversState={actions.mirrorCoversState}
                  rebuildCoversState={actions.rebuildCoversState}
                  bgMismatchList={actions.bgMismatchList}
                  batchScrapeStats={actions.batchScrapeStats}
                  getLastRun={actions.getLastRun}
                  handleGeneratePortraits={actions.handleGeneratePortraits}
                  handleMirrorPhotos={actions.handleMirrorPhotos}
                  handleAuditAvatarBackgrounds={actions.handleAuditAvatarBackgrounds}
                  handleNormalizeAvatarBackgrounds={actions.handleNormalizeAvatarBackgrounds}
                  handleScrapeCovers={actions.handleScrapeCovers}
                  handleMirrorCovers={actions.handleMirrorCovers}
                  handleRebuildCovers={actions.handleRebuildCovers}
                />
              )}
              {activeSection === "content-items" && <AdminContentItemsTab />}
              {activeSection === "sync" && <AdminSyncTab />}

              {/* ── Intelligence ── */}
              {activeSection === "digital-me" && <AdminDigitalMeTab />}
              {activeSection === "cascade" && <AdminResearchTab />}
              {activeSection === "ai" && <AdminAiSettingsTab />}
              {activeSection === "ai-models" && <AdminAiModelsTab />}

              {/* ── Personalization ── */}
              {activeSection === "interests" && <AdminInterestsTab />}
              {activeSection === "favorites" && <AdminFavoritesTab />}

              {/* ── System ── */}
              {activeSection === "health" && <AdminHealthTab />}
              {activeSection === "dependencies" && <AdminDependenciesTab />}
              {activeSection === "scheduling" && <AdminSchedulesTab />}
              {activeSection === "tools" && <AdminInfoToolsTab />}

              {/* ── Configuration ── */}
              {activeSection === "settings" && <AdminAppSettingsTab />}
              {activeSection === "about" && <AdminAboutTab />}

            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
