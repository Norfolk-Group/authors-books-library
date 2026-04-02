/**
 * Admin Console — Thin orchestrator
 *
 * All action handlers live in useAdminActions hook.
 * All tab content lives in focused components under components/admin/.
 *
 * Navigation groups:
 *   Content  → Authors | Books | Tags | Data Pipeline
 *   Media    → Media Assets | Sync & Storage
 *   Intelligence → Digital Me | Research | AI Settings | AI Models
 *   Personalization → My Interests | Favorites
 *   System   → Health | Dependencies | Schedules | Info Tools
 *   Configuration → App Settings | About
 */
import { useState, useCallback } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowsClockwise,
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
import { Loader2, ChevronRight, Link } from "lucide-react";
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

// Tab components
import { AdminAuthorsTab } from "@/components/admin/AdminAuthorsTab";
import { AdminBooksTab } from "@/components/admin/AdminBooksTab";
import { AdminMediaTab } from "@/components/admin/AdminMediaTab";
import { AdminPipelineTab } from "@/components/admin/AdminPipelineTab";
import { TagManagement } from "@/components/admin/TagManagement";
import { TagTaxonomyMatrix } from "@/components/admin/TagTaxonomyMatrix";
import { TagStatisticsCard } from "@/components/admin/TagStatisticsCard";
import { CascadeTab } from "@/components/admin/CascadeTab";
import { DigitalMeTab } from "@/components/admin/DigitalMeTab";
import { AiTab } from "@/components/admin/AiTab";
import { AIModelConfigTab } from "@/components/admin/AIModelConfigTab";
import { MyInterestsTab } from "@/components/admin/MyInterestsTab";
import { FavoritesTab } from "@/components/admin/FavoritesTab";
import { ToolHealthCheckTab } from "@/components/admin/ToolHealthCheckTab";
import { DependenciesTab } from "@/components/admin/DependenciesTab";
import { SchedulingTab } from "@/components/admin/SchedulingTab";
import { InformationToolsTab } from "@/components/admin/InformationToolsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AboutTab } from "@/components/admin/AboutTab";
import { SyncJobsTab } from "@/components/admin/SyncJobsTab";
import { BulkUrlImportPanel } from "@/components/admin/BulkUrlImportPanel";

// Hook
import { useAdminActions } from "@/hooks/useAdminActions";

// -- Types ------------------------------------------------------
type NavItem = { id: string; label: string; icon: PhosphorIcon };
type NavGroup = { label: string; icon: PhosphorIcon; items: NavItem[] };

// -- Navigation -------------------------------------------------
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

// -- Main Admin Page --------------------------------------------
export default function Admin() {
  const { settings, updateSettings } = useAppSettings();
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
          <SidebarHeader className="p-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <div className="flex items-center gap-3 cursor-default">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Gear className="size-4" weight="bold" />
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
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                            {filteredItems.length}
                          </Badge>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {filteredItems.map((item) => (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                isActive={activeSection === item.id}
                                onClick={() => { setActiveSection(item.id); setSidebarSearch(""); }}
                                tooltip={item.label}
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

              {/* ── Authors ── */}
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

              {/* ── Books ── */}
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

              {/* ── Tags ── */}
              {activeSection === "tags" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Tag className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Tag Management</h1>
                      <p className="text-muted-foreground text-sm">Create, rename, and delete tags for authors and books</p>
                    </div>
                  </div>
                  <TagStatisticsCard />
                  <TagManagement />
                  <TagTaxonomyMatrix />
                </div>
              )}

              {/* ── Data Pipeline ── */}
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

              {/* ── Media Assets ── */}
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

              {/* ── Sync & Storage ── */}
              {activeSection === "sync" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Cloud className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Sync & Storage</h1>
                      <p className="text-muted-foreground text-sm">Manage cloud storage connections and sync jobs</p>
                    </div>
                  </div>
                  <SyncJobsTab />
                </div>
              )}

              {/* ── Digital Me ── */}
              {activeSection === "digital-me" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Robot className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Digital Me</h1>
                      <p className="text-muted-foreground text-sm">Manage AI personas and RAG profiles for authors</p>
                    </div>
                  </div>
                  <DigitalMeTab />
                </div>
              )}

              {/* ── Research ── */}
              {activeSection === "cascade" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><ChartBar className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Research</h1>
                      <p className="text-muted-foreground text-sm">Live enrichment stats and cascade pipeline status</p>
                    </div>
                  </div>
                  <CascadeTab aStats={actions.authorStats} bStats={actions.bookStats} scrapeStats={actions.batchScrapeStats} />
                </div>
              )}

              {/* ── AI Settings ── */}
              {activeSection === "ai" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Cpu className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">AI Settings</h1>
                      <p className="text-muted-foreground text-sm">Configure AI generation parameters and prompts</p>
                    </div>
                  </div>
                  <AiTab settings={settings} updateSettings={updateSettings} />
                </div>
              )}

              {/* ── AI Models ── */}
              {activeSection === "ai-models" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><CircuitBoard className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">AI Models</h1>
                      <p className="text-muted-foreground text-sm">Select and configure LLM providers and models</p>
                    </div>
                  </div>
                  <AIModelConfigTab />
                </div>
              )}

              {/* ── My Interests ── */}
              {activeSection === "interests" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Heart className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">My Interests</h1>
                      <p className="text-muted-foreground text-sm">Manage your reading interests and preferences</p>
                    </div>
                  </div>
                  <MyInterestsTab />
                </div>
              )}

              {/* ── Favorites ── */}
              {activeSection === "favorites" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Star className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
                      <p className="text-muted-foreground text-sm">Your saved authors and books</p>
                    </div>
                  </div>
                  <FavoritesTab />
                </div>
              )}

              {/* ── Health ── */}
              {activeSection === "health" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Heartbeat className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Health</h1>
                      <p className="text-muted-foreground text-sm">Tool function checks and service status</p>
                    </div>
                  </div>
                  <ToolHealthCheckTab />
                </div>
              )}

              {/* ── Dependencies ── */}
              {activeSection === "dependencies" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Package className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Dependencies</h1>
                      <p className="text-muted-foreground text-sm">Package versions and dependency status</p>
                    </div>
                  </div>
                  <DependenciesTab />
                </div>
              )}

              {/* ── Schedules ── */}
              {activeSection === "scheduling" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><CalendarCheck className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
                      <p className="text-muted-foreground text-sm">Manage automated task schedules</p>
                    </div>
                  </div>
                  <SchedulingTab />
                </div>
              )}

              {/* ── Info Tools ── */}
              {activeSection === "tools" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Lightning className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Info Tools</h1>
                      <p className="text-muted-foreground text-sm">Research utilities and information lookup tools</p>
                    </div>
                  </div>
                  <InformationToolsTab settings={settings} updateSettings={updateSettings} />
                </div>
              )}

              {/* ── App Settings ── */}
              {activeSection === "settings" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Gear className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">App Settings</h1>
                      <p className="text-muted-foreground text-sm">Theme, display, and application preferences</p>
                    </div>
                  </div>
                  <SettingsTab settings={settings} updateSettings={updateSettings} />
                </div>
              )}

              {/* ── Content Items ── */}
              {activeSection === "content-items" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Globe className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Content Items</h1>
                      <p className="text-muted-foreground text-sm">Import and manage media content items (YouTube, podcasts, articles)</p>
                    </div>
                  </div>
                  <BulkUrlImportPanel />
                </div>
              )}

              {/* ── About ── */}
              {activeSection === "about" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10"><Info className="h-6 w-6 text-primary" weight="duotone" /></div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">About</h1>
                      <p className="text-muted-foreground text-sm">Application version, credits, and documentation</p>
                    </div>
                  </div>
                  <AboutTab settings={settings} />
                </div>
              )}

            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
