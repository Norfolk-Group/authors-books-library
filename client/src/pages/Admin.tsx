/**
 * Admin Console - Consolidated admin operations for the NCG Library.
 *
 * Tabs:
 *   1. Data Pipeline - Regenerate DB, Enrich Bios, Enrich Books
 *   2. Media - Generate Avatars, Scrape Covers, Mirror to S3
 *   3. Research Cascade - Live DB enrichment stats
 *   4. Settings - Theme, Icon Set, AI Model
 *   5. About - App info
 *
 * Every action:
 *   - Wired to real tRPC mutations
 *   - Shows confirmation dialog for destructive/batch ops
 *   - Records last-run timestamp via admin.recordAction
 *   - Shows real-time progress
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  Sparkle,
  Books,
  Camera,
  Image,
  CloudArrowUp,
  Database,
  ChartBar,
  Gear,
  Info,
  Spinner,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  UsersThree,
  Link,
  UserCircle,
  FileText,
  Lightning,
  Globe,
  Cloud,
  ChartLine,
  Heart,
  Briefcase,
  Package,
  PencilSimple,
  MagicWand,
  ShareNetwork,
  Buildings,
  ImageSquare,
  Palette,
  CalendarCheck,
  Robot,
  Cpu,
  Wrench,
  Star,
  Heartbeat,
  ArrowSquareOut,
  Cpu as CircuitBoard,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
// Alias for semantic clarity
const CheckCircle2 = CheckCircle;
const AlertCircle = XCircle;
import { AUTHORS, BOOKS } from "@/lib/libraryData";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import { CascadeTab } from "@/components/admin/CascadeTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AboutTab } from "@/components/admin/AboutTab";
import { AiTab } from "@/components/admin/AiTab";
import { InformationToolsTab } from "@/components/admin/InformationToolsTab";
import { SchedulingTab } from "@/components/admin/SchedulingTab";
import { FavoritesTab } from "@/components/admin/FavoritesTab";
import { ToolHealthCheckTab } from "@/components/admin/ToolHealthCheckTab";
import { DependenciesTab } from "@/components/admin/DependenciesTab";
import { DigitalMeTab } from "@/components/admin/DigitalMeTab";
import { MyInterestsTab } from "@/components/admin/MyInterestsTab";
import { SyncJobsTab } from "@/components/admin/SyncJobsTab";
import { AIModelConfigTab } from "@/components/admin/AIModelConfigTab";

// -- Types ------------------------------------------------------
type ActionStatus = "idle" | "running" | "done" | "error";

interface ActionState {
  status: ActionStatus;
  progress: number;
  message: string;
  done: number;
  total: number;
  failed: number;
}

const INITIAL_STATE: ActionState = {
  status: "idle",
  progress: 0,
  message: "",
  done: 0,
  total: 0,
  failed: 0,
};

// -- Helpers ----------------------------------------------------
function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function StatusIcon({ status }: { status: ActionStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

// -- Action Card Component --------------------------------------
interface ActionCardProps {
  title: string;
  description: string;
  icon: PhosphorIcon;
  actionKey: string;
  state: ActionState;
  lastRun?: {
    lastRunAt: Date | string | null;
    lastRunResult: string | null;
    lastRunDurationMs: number | null;
    lastRunItemCount: number | null;
  } | null;
  destructive?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onRun: () => void;
  buttonLabel?: string;
  disabled?: boolean;
}

function ActionCard({
  title,
  description,
  icon: Icon,
  state,
  lastRun,
  destructive = false,
  confirmTitle,
  confirmDescription,
  onRun,
  buttonLabel = "Run",
  disabled = false,
}: ActionCardProps) {
  const isRunning = state.status === "running";

  const runButton = (
    <Button
      size="sm"
      variant={destructive ? "destructive" : "default"}
      disabled={isRunning || disabled}
      onClick={destructive ? undefined : onRun}
      className="min-w-[80px]"
    >
      {isRunning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          Running...
        </>
      ) : (
        buttonLabel
      )}
    </Button>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {title}
                <StatusIcon status={state.status} />
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {destructive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>{runButton}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{confirmTitle ?? `Run ${title}?`}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirmDescription ??
                      `This will execute "${title}". This operation may take a while and cannot be interrupted once started.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRun}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            runButton
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Progress bar */}
        {isRunning && (
          <div className="space-y-1.5 mb-2">
            <Progress value={state.progress} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="truncate max-w-[200px]">{state.message || "Processing..."}</span>
              <span className="flex-shrink-0 ml-2">{state.progress}%</span>
            </div>
          </div>
        )}
        {/* Done summary */}
        {state.status === "done" && state.done > 0 && (
          <p className="text-xs text-green-600 mb-2">
            Completed: {state.done} processed{state.failed > 0 ? `, ${state.failed} failed` : ""}
          </p>
        )}
        {state.status === "error" && state.message && (
          <p className="text-xs text-red-500 mb-2">{state.message}</p>
        )}
        {/* Last run info */}
        {lastRun?.lastRunAt && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Last run: {formatTimeAgo(lastRun.lastRunAt)}</span>
            {lastRun.lastRunResult && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                {lastRun.lastRunResult}
              </Badge>
            )}
            {lastRun.lastRunDurationMs != null && (
              <span className="opacity-60">({(lastRun.lastRunDurationMs / 1000).toFixed(1)}s)</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -- Main Admin Page --------------------------------------------
export default function Admin() {
  const { settings, updateSettings } = useAppSettings();
  const utils = trpc.useUtils();

  // -- Action logs (last-run timestamps) --
  const actionLogsQuery = trpc.admin.getActionLogs.useQuery(undefined, { staleTime: 30_000 });
  const recordActionMutation = trpc.admin.recordAction.useMutation({
    onSuccess: () => void actionLogsQuery.refetch(),
  });

  const getLastRun = useCallback(
    (key: string) => {
      const logs = actionLogsQuery.data ?? [];
      return (
        (
          logs as Array<{
            actionKey: string;
            lastRunAt: Date | string | null;
            lastRunResult: string | null;
            lastRunDurationMs: number | null;
            lastRunItemCount: number | null;
          }>
        ).find((l) => l.actionKey === key) ?? null
      );
    },
    [actionLogsQuery.data],
  );

  // -- Mutations --
  const regenerateMutation = trpc.library.regenerate.useMutation();
  const enrichBiosMutation = trpc.authorProfiles.enrichBatch.useMutation();
  const enrichBooksMutation = trpc.bookProfiles.enrichBatch.useMutation();
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation();
  const generateAllMissingAvatarsMutation = trpc.authorProfiles.generateAllMissingAvatars.useMutation();
  const scrapeNextMutation = trpc.apify.scrapeNextMissingCover.useMutation();
  const mirrorCoversMutation = trpc.bookProfiles.mirrorCovers.useMutation();
  const mirrorAvatarsMutation = trpc.authorProfiles.mirrorAvatars.useMutation();
  const updateAllAuthorLinksMutation = trpc.authorProfiles.updateAllAuthorLinks.useMutation();
  const updateAllBookSummariesMutation = trpc.bookProfiles.updateAllBookSummaries.useMutation();
  const rebuildAllBookCoversMutation = trpc.bookProfiles.rebuildAllBookCovers.useMutation();
  const auditAvatarBackgroundsMutation = trpc.authorProfiles.auditAvatarBackgrounds.useMutation();
  const normalizeAvatarBackgroundsMutation = trpc.authorProfiles.normalizeAvatarBackgrounds.useMutation();
  const discoverPlatformsMutation = trpc.authorProfiles.discoverPlatformsBatch.useMutation();
  const enrichSocialStatsMutation = trpc.authorProfiles.enrichSocialStatsBatch.useMutation();
  const enrichRichBioMutation = trpc.authorProfiles.enrichRichBioBatch.useMutation();
  const enrichRichSummaryMutation = trpc.bookProfiles.enrichRichSummaryBatch.useMutation();
  const enrichEnterpriseBatchMutation = trpc.authorProfiles.enrichEnterpriseImpactBatch.useMutation();
  const enrichProfessionalBatchMutation = trpc.authorProfiles.enrichProfessionalProfileBatch.useMutation();

  // -- Action states --
  const [regenerateState, setRegenerateState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBiosState, setEnrichBiosState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBooksState, setEnrichBooksState] = useState<ActionState>(INITIAL_STATE);
  const [portraitState, setPortraitState] = useState<ActionState>(INITIAL_STATE);
  const [scrapeState, setScrapeState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorCoversState, setMirrorCoversState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorAvatarsState, setMirrorAvatarsState] = useState<ActionState>(INITIAL_STATE);
  const [updateLinksState, setUpdateLinksState] = useState<ActionState>(INITIAL_STATE);
  const [updateBookSummariesState, setUpdateBookSummariesState] = useState<ActionState>(INITIAL_STATE);
  const [auditBgState, setAuditBgState] = useState<ActionState>(INITIAL_STATE);
  const [normalizeBgState, setNormalizeBgState] = useState<ActionState>(INITIAL_STATE);
  const [bgMismatchList, setBgMismatchList] = useState<string[]>([]);
  const [rebuildCoversState, setRebuildCoversState] = useState<ActionState>(INITIAL_STATE);
  const [discoverPlatformsState, setDiscoverPlatformsState] = useState<ActionState>(INITIAL_STATE);
  const [enrichSocialStatsState, setEnrichSocialStatsState] = useState<ActionState>(INITIAL_STATE);
  const [enrichRichBioState, setEnrichRichBioState] = useState<ActionState>(INITIAL_STATE);
  const [enrichRichSummaryState, setEnrichRichSummaryState] = useState<ActionState>(INITIAL_STATE);
  const [enrichEnterpriseState, setEnrichEnterpriseState] = useState<ActionState>(INITIAL_STATE);
  const [enrichProfessionalState, setEnrichProfessionalState] = useState<ActionState>(INITIAL_STATE);

  // -- Research Cascade stats --
  const authorStats = trpc.cascade.authorStats.useQuery(undefined, { staleTime: 60_000 });
  const bookStats = trpc.cascade.bookStats.useQuery(undefined, { staleTime: 60_000 });
  const batchScrapeStats = trpc.apify.getBatchScrapeStats.useQuery(undefined, { staleTime: 60_000 });

  // -- LLM models --

  // -- Helpers --
  const anyRunning = [
    regenerateState,
    enrichBiosState,
    enrichBooksState,
    portraitState,
    scrapeState,
    mirrorCoversState,
    mirrorAvatarsState,
    updateLinksState,
    updateBookSummariesState,
    auditBgState,
    normalizeBgState,
    discoverPlatformsState,
    enrichSocialStatsState,
    enrichRichBioState,
    enrichRichSummaryState,
    enrichEnterpriseState,
    enrichProfessionalState,
  ].some((s) => s.status === "running");

  const recordAction = useCallback(
    async (actionKey: string, label: string, startTime: number, result: string, itemCount?: number) => {
      const durationMs = Date.now() - startTime;
      try {
        await recordActionMutation.mutateAsync({
          actionKey,
          label,
          durationMs,
          result,
          itemCount: itemCount ?? null,
        });
      } catch {
        // silently ignore logging errors
      }
    },
    [recordActionMutation],
  );

  // -- 1. Regenerate Database --
  const handleRegenerate = useCallback(async () => {
    if (regenerateState.status === "running") return;
    setRegenerateState({ ...INITIAL_STATE, status: "running", message: "Scanning Google Drive..." });
    const start = Date.now();
    try {
      const result = await regenerateMutation.mutateAsync();
      if (result.success && result.stats) {
        setRegenerateState({
          status: "done",
          progress: 100,
          message: `${result.stats.authors} authors, ${result.stats.books} books, ${result.stats.audioBooks} audiobooks`,
          done: result.stats.authors + result.stats.books,
          total: result.stats.authors + result.stats.books,
          failed: 0,
        });
        toast.success(
          `Library rebuilt - ${result.stats.authors} authors, ${result.stats.books} books (${result.stats.elapsedSeconds}s). Reload to see changes.`,
          { duration: 8000 },
        );
        await recordAction(
          "regenerate",
          "Regenerate Database",
          start,
          "success",
          result.stats.authors + result.stats.books,
        );
      } else {
        const errMsg = (result as { error?: string }).error ?? "Unknown error";
        setRegenerateState({ ...INITIAL_STATE, status: "error", message: errMsg });
        toast.error(`Regeneration failed: ${errMsg}`);
        await recordAction("regenerate", "Regenerate Database", start, `error: ${errMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRegenerateState({ ...INITIAL_STATE, status: "error", message: msg });
      toast.error(`Regeneration error: ${msg}`);
      await recordAction("regenerate", "Regenerate Database", start, `error: ${msg}`);
    }
  }, [regenerateState.status, regenerateMutation, recordAction]);

  // -- 2. Enrich All Bios --
  const handleEnrichBios = useCallback(async () => {
    if (enrichBiosState.status === "running") return;
    const names = Array.from(
      new Set(
        AUTHORS.map((a) => {
          const d = a.name.indexOf(" - ");
          return d !== -1 ? a.name.slice(0, d) : a.name;
        }),
      ),
    );
    const total = names.length;
    setEnrichBiosState({
      status: "running",
      progress: 0,
      message: `0/${total} authors`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let done = 0;
    let failed = 0;
    const batchSize = 5;
    try {
      for (let i = 0; i < names.length; i += batchSize) {
        const batch = names.slice(i, i + batchSize);
        const result = await enrichBiosMutation.mutateAsync({
          authorNames: batch,
          model: settings.authorResearchModel ?? settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.authorResearchSecondaryEnabled
            ? settings.authorResearchSecondaryModel
            : undefined,
          concurrency: settings.batchConcurrency ?? 3,
        });
        done += result.succeeded;
        failed += result.total - result.succeeded;
        const pct = Math.round(((i + batch.length) / total) * 100);
        setEnrichBiosState((s) => ({
          ...s,
          progress: pct,
          done,
          failed,
          message: `${done}/${total} authors enriched`,
        }));
      }
      setEnrichBiosState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${done} enriched, ${failed} failed`,
      }));
      toast.success(`Enriched ${done} author bios${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.authorProfiles.getAllEnrichedNames.invalidate();
      await recordAction("enrich-bios", "Enrich All Bios", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichBiosState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Bio enrichment failed: " + msg);
      await recordAction("enrich-bios", "Enrich All Bios", start, `error: ${msg}`, done);
    }
  }, [enrichBiosState.status, enrichBiosMutation, settings.geminiModel, utils, recordAction]);

  // -- 3. Enrich All Books --
  const handleEnrichBooks = useCallback(async () => {
    if (enrichBooksState.status === "running") return;
    const books = Array.from(new Set(BOOKS.map((b) => b.name.split(" - ")[0].trim()))).map(
      (title) => {
        const match = BOOKS.find((b) => b.name.split(" - ")[0].trim() === title);
        const authorName = match
          ? match.name.includes(" - ")
            ? match.name.split(" - ").slice(1).join(" - ").trim()
            : ""
          : "";
        return { bookTitle: title, authorName };
      },
    );
    const total = books.length;
    setEnrichBooksState({
      status: "running",
      progress: 0,
      message: `0/${total} books`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let done = 0;
    let failed = 0;
    const batchSize = 5;
    try {
      for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);
        const result = await enrichBooksMutation.mutateAsync({
          books: batch,
          model: settings.bookResearchModel ?? settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.bookResearchSecondaryEnabled
            ? settings.bookResearchSecondaryModel
            : undefined,
        });
        done += result.filter((r) => r.status === "enriched").length;
        failed += result.filter((r) => r.status === "error").length;
        const pct = Math.round(((i + batch.length) / total) * 100);
        setEnrichBooksState((s) => ({
          ...s,
          progress: pct,
          done,
          failed,
          message: `${done}/${total} books enriched`,
        }));
      }
      setEnrichBooksState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${done} enriched, ${failed} failed`,
      }));
      toast.success(`Enriched ${done} books${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("enrich-books", "Enrich All Books", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichBooksState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Book enrichment failed: " + msg);
      await recordAction("enrich-books", "Enrich All Books", start, `error: ${msg}`, done);
    }
  }, [enrichBooksState.status, enrichBooksMutation, settings.geminiModel, utils, recordAction]);

  // -- 4. Generate All Avatars --
  // Uses generateAllMissingAvatars which runs parallelBatch server-side (Claude Opus recommendation).
  // This replaces the old sequential client-side loop (~102 min) with a single server call (~34 min at concurrency=3).
  const handleGeneratePortraits = useCallback(async () => {
    if (portraitState.status === "running") return;

    setPortraitState({
      status: "running",
      progress: 0,
      message: "Starting batch generation...",
      done: 0,
      total: 0,
      failed: 0,
    });

    const start = Date.now();
    try {
      const result = await generateAllMissingAvatarsMutation.mutateAsync({
        concurrency: settings.batchConcurrency ?? 3,
        maxTier: 5,
        skipValidation: true,
        avatarGenVendor: settings.avatarGenVendor,
        avatarGenModel: settings.avatarGenModel,
        avatarResearchVendor: settings.avatarResearchVendor,
        avatarResearchModel: settings.avatarResearchModel,
        avatarBgColor: settings.avatarBgColor,
      });

      const done = result.succeeded;
      const failed = result.total - result.succeeded;

      setPortraitState({
        status: "done",
        progress: 100,
        message: `${done} generated, ${failed} failed`,
        done,
        total: result.total,
        failed,
      });

      toast.success(`Generated ${done} avatars${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.authorProfiles.getAvatarMap.invalidate();
      await recordAction("generate-avatars", "Generate Avatars", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortraitState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar generation failed: " + msg);
      await recordAction("generate-avatars", "Generate Avatars", start, `error: ${msg}`, 0);
    }
  }, [portraitState.status, generateAllMissingAvatarsMutation, settings, utils, recordAction]);

  // -- 5. Scrape All Covers --
  const handleScrapeCovers = useCallback(async () => {
    if (scrapeState.status === "running") return;
    const stats = batchScrapeStats.data;
    const total = stats?.needsScrape ?? 0;
    if (total === 0) {
      toast.info("No books need cover scraping!");
      return;
    }
    setScrapeState({
      status: "running",
      progress: 0,
      message: `0/${total} books`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let scraped = 0;
    try {
      for (let i = 0; i < total; i++) {
        const result = await scrapeNextMutation.mutateAsync({ mirrorBatch: 3 });
        if (result.scraped > 0) scraped++;
        const remaining = result.remainingScrape;
        const pct = Math.round(((i + 1) / total) * 100);
        setScrapeState((s) => ({
          ...s,
          progress: pct,
          done: scraped,
          message: remaining > 0 ? `${scraped} scraped - ${remaining} remaining` : `${scraped} scraped - done!`,
        }));
        if (remaining === 0) break;
      }
      setScrapeState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${scraped} covers scraped`,
      }));
      toast.success(`Scraped ${scraped} book covers.`);
      void utils.apify.getBatchScrapeStats.invalidate();
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("scrape-covers", "Scrape Covers", start, "success", scraped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setScrapeState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Cover scraping failed: " + msg);
      await recordAction("scrape-covers", "Scrape Covers", start, `error: ${msg}`, scraped);
    }
  }, [scrapeState.status, scrapeNextMutation, batchScrapeStats.data, utils, recordAction]);

  // -- 6. Mirror Covers to S3 --
  const handleMirrorCovers = useCallback(async () => {
    if (mirrorCoversState.status === "running") return;
    setMirrorCoversState({ ...INITIAL_STATE, status: "running", message: "Mirroring covers..." });
    const start = Date.now();
    let totalMirrored = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const result = await mirrorCoversMutation.mutateAsync({ batchSize: 10 });
        totalMirrored += result.mirrored;
        setMirrorCoversState((s) => ({
          ...s,
          done: totalMirrored,
          message: `${totalMirrored} covers mirrored...`,
        }));
        if (result.mirrored === 0) break;
      }
      setMirrorCoversState({
        status: "done",
        progress: 100,
        message: `${totalMirrored} covers mirrored to S3`,
        done: totalMirrored,
        total: totalMirrored,
        failed: 0,
      });
      toast.success(`Mirrored ${totalMirrored} covers to S3.`);
      await recordAction("mirror-covers", "Mirror Covers to S3", start, "success", totalMirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMirrorCoversState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Mirror covers failed: " + msg);
      await recordAction("mirror-covers", "Mirror Covers to S3", start, `error: ${msg}`, totalMirrored);
    }
  }, [mirrorCoversState.status, mirrorCoversMutation, recordAction]);

  // -- 7. Rebuild All Book Covers (upgrade resolution + re-scrape failed + re-mirror) --
  const handleRebuildCovers = useCallback(async () => {
    if (rebuildCoversState.status === "running") return;
    setRebuildCoversState({ ...INITIAL_STATE, status: "running", message: "Rebuilding book covers..." });
    const start = Date.now();
    try {
      const result = await rebuildAllBookCoversMutation.mutateAsync({
        concurrency: settings.batchConcurrency ?? 2,
        rescrapeAll: false,
      });
      const summary = `Upgraded ${result.upgraded} URLs, scraped ${result.scraped} new covers, mirrored ${result.mirrored} to S3`;
      setRebuildCoversState({
        status: "done",
        progress: 100,
        message: summary,
        done: result.mirrored,
        total: result.total,
        failed: result.mirrorFailed + result.notFound,
      });
      toast.success("Book cover rebuild complete.");
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("rebuild-covers", "Rebuild Book Covers", start, "success", result.mirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRebuildCoversState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rebuild covers failed: " + msg);
      await recordAction("rebuild-covers", "Rebuild Book Covers", start, `error: ${msg}`, 0);
    }
  }, [rebuildCoversState.status, rebuildAllBookCoversMutation, settings, utils, recordAction]);

  // -- 8. Mirror Avatars to S3 --
  const handleMirrorPhotos = useCallback(async () => {
    if (mirrorAvatarsState.status === "running") return;
    setMirrorAvatarsState({ ...INITIAL_STATE, status: "running", message: "Mirroring avatars..." });
    const start = Date.now();
    let totalMirrored = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const result = await mirrorAvatarsMutation.mutateAsync({ batchSize: 10 });
        totalMirrored += result.mirrored;
        setMirrorAvatarsState((s) => ({
          ...s,
          done: totalMirrored,
          message: `${totalMirrored} avatars mirrored...`,
        }));
        if (result.mirrored === 0) break;
      }
      setMirrorAvatarsState({
        status: "done",
        progress: 100,
        message: `${totalMirrored} avatars mirrored to S3`,
        done: totalMirrored,
        total: totalMirrored,
        failed: 0,
      });
      toast.success(`Mirrored ${totalMirrored} avatars to S3.`);
      await recordAction("mirror-avatars", "Mirror Avatars to S3", start, "success", totalMirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMirrorAvatarsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Mirror avatars failed: " + msg);
      await recordAction("mirror-avatars", "Mirror Avatars to S3", start, `error: ${msg}`, totalMirrored);
    }
  }, [mirrorAvatarsState.status, mirrorAvatarsMutation, recordAction]);

  // -- 8. Update All Author Links --
  const handleUpdateAllAuthorLinks = useCallback(async () => {
    if (updateLinksState.status === "running") return;
    setUpdateLinksState({ ...INITIAL_STATE, status: "running", message: "Starting author links update..." });
    const start = Date.now();
    try {
      const result = await updateAllAuthorLinksMutation.mutateAsync({
        researchVendor: settings.authorResearchVendor,
        researchModel: settings.authorResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setUpdateLinksState({
        status: "done",
        progress: 100,
        message: `${result.enriched} authors updated, ${result.failed} failed`,
        done: result.enriched,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Author links updated: ${result.enriched} authors processed.`);
      void utils.authorProfiles.get.invalidate();
      await recordAction("update-author-links", "Update All Author Links", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateLinksState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Author links update failed: " + msg);
      await recordAction("update-author-links", "Update All Author Links", start, `error: ${msg}`);
    }
  }, [updateLinksState.status, updateAllAuthorLinksMutation, settings, utils, recordAction]);

  // -- 9. Update All Book Summaries --
  const handleUpdateAllBookSummaries = useCallback(async () => {
    if (updateBookSummariesState.status === "running") return;
    setUpdateBookSummariesState({ ...INITIAL_STATE, status: "running", message: "Starting book summaries update..." });
    const start = Date.now();
    try {
      const result = await updateAllBookSummariesMutation.mutateAsync({
        researchVendor: settings.bookResearchVendor,
        researchModel: settings.bookResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setUpdateBookSummariesState({
        status: "done",
        progress: 100,
        message: `${result.enriched} books updated, ${result.failed} failed`,
        done: result.enriched,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Book summaries updated: ${result.enriched} books processed.`);
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("update-book-summaries", "Update All Book Summaries", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateBookSummariesState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Book summaries update failed: " + msg);
      await recordAction("update-book-summaries", "Update All Book Summaries", start, `error: ${msg}`);
    }
  }, [updateBookSummariesState.status, updateAllBookSummariesMutation, settings, utils, recordAction]);

  // -- 10. Audit Avatar Backgrounds --
  const handleAuditAvatarBackgrounds = useCallback(async () => {
    if (auditBgState.status === "running") return;
    setAuditBgState({ ...INITIAL_STATE, status: "running", message: "Scanning avatars with Gemini Vision..." });
    setBgMismatchList([]);
    const start = Date.now();
    try {
      const result = await auditAvatarBackgroundsMutation.mutateAsync({
        targetBgDescription: "bokeh-gold warm golden bokeh with amber and cream light orbs",
      });
      setBgMismatchList(result.mismatch ?? []);
      setAuditBgState({
        status: "done",
        progress: 100,
        message: `${result.audited} audited, ${result.mismatch.length} need normalization`,
        done: result.audited - result.mismatch.length,
        total: result.audited,
        failed: result.mismatch.length,
      });
      if (result.mismatch.length === 0) {
        toast.success("All avatars already have the canonical bokeh-gold background!");
      } else {
        toast.info(`${result.mismatch.length} avatars need background normalization.`);
      }
      await recordAction("audit-avatar-backgrounds", "Audit Avatar Backgrounds", start, "success", result.audited);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuditBgState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar background audit failed: " + msg);
      await recordAction("audit-avatar-backgrounds", "Audit Avatar Backgrounds", start, `error: ${msg}`);
    }
  }, [auditBgState.status, auditAvatarBackgroundsMutation, recordAction]);

  // -- 11. Normalize Avatar Backgrounds --
  const handleNormalizeAvatarBackgrounds = useCallback(async () => {
    if (normalizeBgState.status === "running") return;
    const targets = bgMismatchList.length > 0 ? bgMismatchList : [];
    if (targets.length === 0) {
      toast.info("Run the audit first to identify which avatars need normalization.");
      return;
    }
    setNormalizeBgState({ ...INITIAL_STATE, status: "running", message: `Normalizing ${targets.length} avatars...`, total: targets.length });
    const start = Date.now();
    try {
      const result = await normalizeAvatarBackgroundsMutation.mutateAsync({
        authorNames: targets,
        bgColor: settings.avatarBgColor ?? "#c8960c",
        avatarGenVendor: settings.avatarGenVendor,
        avatarGenModel: settings.avatarGenModel,
        avatarResearchVendor: settings.avatarResearchVendor,
        avatarResearchModel: settings.avatarResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setNormalizeBgState({
        status: "done",
        progress: 100,
        message: `${result.normalized} normalized, ${result.failed} failed`,
        done: result.normalized,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Normalized ${result.normalized} avatar backgrounds.`);
      void utils.authorProfiles.getAvatarMap.invalidate();
      await recordAction("normalize-avatar-backgrounds", "Normalize Avatar Backgrounds", start, "success", result.normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNormalizeBgState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar normalization failed: " + msg);
      await recordAction("normalize-avatar-backgrounds", "Normalize Avatar Backgrounds", start, `error: ${msg}`);
    }
  }, [normalizeBgState.status, normalizeAvatarBackgroundsMutation, bgMismatchList, settings, utils, recordAction]);

  // -- Discover Author Platforms --
  const handleDiscoverPlatforms = useCallback(async () => {
    if (discoverPlatformsState.status === "running") return;
    setDiscoverPlatformsState({ ...INITIAL_STATE, status: "running", message: "Discovering platform presence for authors..." });
    const start = Date.now();
    try {
      const result = await discoverPlatformsMutation.mutateAsync({ limit: 20 });
      setDiscoverPlatformsState({
        status: "done",
        progress: 100,
        message: `${result.succeeded} authors enriched, ${result.failed} failed`,
        done: result.succeeded,
        total: result.processed,
        failed: result.failed,
      });
      toast.success(`Discovered platforms for ${result.succeeded} authors.`);
      await recordAction("discover-platforms", "Discover Author Platforms", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiscoverPlatformsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Platform discovery failed: " + msg);
      await recordAction("discover-platforms", "Discover Author Platforms", start, `error: ${msg}`);
    }
  }, [discoverPlatformsState.status, discoverPlatformsMutation, recordAction]);

  // -- Enrich Social Stats --
  const handleEnrichSocialStats = useCallback(async () => {
    if (enrichSocialStatsState.status === "running") return;
    setEnrichSocialStatsState({ ...INITIAL_STATE, status: "running", message: "Fetching social stats from GitHub, Wikipedia, Substack, YouTube, CNN, Y Combinator..." });
    const start = Date.now();
    try {
      const result = await enrichSocialStatsMutation.mutateAsync({
        phases: ["A", "B"],
        limit: 30,
        onlyMissing: true,
      });
      setEnrichSocialStatsState({
        status: "done",
        progress: 100,
        message: `${result.succeeded} authors enriched, ${result.failed} failed`,
        done: result.succeeded,
        total: result.processed,
        failed: result.failed,
      });
      toast.success(`Social stats enriched for ${result.succeeded} authors.`);
      await recordAction("enrich-social-stats", "Enrich Social Stats", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichSocialStatsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Social stats enrichment failed: " + msg);
      await recordAction("enrich-social-stats", "Enrich Social Stats", start, `error: ${msg}`);
    }
  }, [enrichSocialStatsState.status, enrichSocialStatsMutation, recordAction]);

  // -- Enrich Rich Bio (double-pass LLM) --
  const handleEnrichRichBio = useCallback(async () => {
    if (enrichRichBioState.status === "running") return;
    const start = Date.now();
    setEnrichRichBioState({ status: "running", progress: 0, message: "Running double-pass LLM bio enrichment…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichRichBioMutation.mutateAsync({ limit: 10, forceAll: false });
      setEnrichRichBioState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} author bios`, done: result.succeeded, total: result.succeeded + result.failed, failed: result.failed });
      toast.success(`Rich bio enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-rich-bio", "Enrich Rich Bios", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichRichBioState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rich bio enrichment failed: " + msg);
      await recordAction("enrich-rich-bio", "Enrich Rich Bios", start, `error: ${msg}`);
    }
  }, [enrichRichBioState.status, enrichRichBioMutation, recordAction]);

  // -- Enrich Rich Summary (double-pass LLM for books) --
  const handleEnrichRichSummary = useCallback(async () => {
    if (enrichRichSummaryState.status === "running") return;
    const start = Date.now();
    setEnrichRichSummaryState({ status: "running", progress: 0, message: "Running double-pass book summary enrichment…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichRichSummaryMutation.mutateAsync({ limit: 10, force: false });
      setEnrichRichSummaryState({ status: "done", progress: 100, message: `Enriched ${result.enriched} book summaries`, done: result.enriched, total: result.total, failed: result.failed });
      toast.success(`Rich summary enrichment complete: ${result.enriched} books`);
      await recordAction("enrich-rich-summary", "Enrich Rich Summaries", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichRichSummaryState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rich summary enrichment failed: " + msg);
      await recordAction("enrich-rich-summary", "Enrich Rich Summaries", start, `error: ${msg}`);
    }
  }, [enrichRichSummaryState.status, enrichRichSummaryMutation, recordAction]);

  // -- Enrich Enterprise Impact (SEC EDGAR + Quartr) --
  const handleEnrichEnterprise = useCallback(async () => {
    if (enrichEnterpriseState.status === "running") return;
    const start = Date.now();
    setEnrichEnterpriseState({ status: "running", progress: 0, message: "Searching SEC EDGAR for author mentions in filings…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichEnterpriseBatchMutation.mutateAsync({ limit: 20, onlyMissing: true });
      setEnrichEnterpriseState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} authors`, done: result.succeeded, total: result.processed, failed: result.failed });
      toast.success(`Enterprise impact enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-enterprise-impact", "Enrich Enterprise Impact", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichEnterpriseState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Enterprise impact enrichment failed: " + msg);
      await recordAction("enrich-enterprise-impact", "Enrich Enterprise Impact", start, `error: ${msg}`);
    }
  }, [enrichEnterpriseState.status, enrichEnterpriseBatchMutation, recordAction]);

  // -- Enrich Professional Profiles (Wikidata + Apollo) --
  const handleEnrichProfessional = useCallback(async () => {
    if (enrichProfessionalState.status === "running") return;
    const start = Date.now();
    setEnrichProfessionalState({ status: "running", progress: 0, message: "Fetching professional data from Wikidata…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichProfessionalBatchMutation.mutateAsync({ limit: 20, onlyMissing: true });
      setEnrichProfessionalState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} authors`, done: result.succeeded, total: result.processed, failed: result.failed });
      toast.success(`Professional profile enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-professional-profile", "Enrich Professional Profiles", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichProfessionalState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Professional profile enrichment failed: " + msg);
      await recordAction("enrich-professional-profile", "Enrich Professional Profiles", start, `error: ${msg}`);
    }
  }, [enrichProfessionalState.status, enrichProfessionalBatchMutation, recordAction]);

  // -- Stats for Research Cascade --
  const aStats = authorStats.data;
  const bStats = bookStats.data;
  const scrapeStats = batchScrapeStats.data;

  const [activeSection, setActiveSection] = useState("authors");

  type NavItem = { id: string; label: string; icon: PhosphorIcon };
  type NavGroup = { label: string; icon: PhosphorIcon; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: "Content",
      icon: Books,
      items: [
        { id: "authors", label: "Authors", icon: UsersThree },
        { id: "books", label: "Books", icon: Books },
        { id: "pipeline", label: "Data Pipeline", icon: Database },
      ],
    },
    {
      label: "Media",
      icon: Image,
      items: [
        { id: "media", label: "Media Assets", icon: Image },
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PageHeader crumbs={[{ label: "Admin Console" }]} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r bg-muted/30 overflow-y-auto py-4 px-2 space-y-5">
          {anyRunning && (
            <div className="mx-1 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Operations running…</span>
            </div>
          )}
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <group.icon className="h-3 w-3" weight="bold" />
                {group.label}
              </div>
              <div className="space-y-0.5 mt-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-all duration-150",
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "hover:bg-muted text-foreground/80 hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className="h-4 w-4 shrink-0"
                      weight={activeSection === item.id ? "fill" : "regular"}
                    />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-5xl mx-auto space-y-6">

          {/* ── Authors ── */}
          {activeSection === "authors" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <UsersThree className="h-6 w-6 text-primary" weight="duotone" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Authors</h1>
                <p className="text-muted-foreground text-sm">Manage author profiles, enrich bios, and generate AI portraits</p>
              </div>
              <Badge variant="secondary" className="ml-auto">{AUTHORS.length} authors</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionCard title="Enrich Author Bios" description={`AI-powered bios for all ${AUTHORS.length} authors via Wikipedia + Perplexity. Already-enriched (30 days) are skipped.`} icon={PencilSimple} actionKey="enrich-bios" state={enrichBiosState} lastRun={getLastRun("enrich-bios")} destructive confirmTitle="Enrich all author bios?" confirmDescription="This will call the AI enrichment pipeline for every author. Already-enriched authors (within 30 days) will be skipped." onRun={handleEnrichBios} buttonLabel="Enrich Bios" disabled={anyRunning} />
              <ActionCard title="Update Author Links" description="Research and update website, social media, podcast, blog, Substack, and newspaper links for all authors." icon={Link} actionKey="update-author-links" state={updateLinksState} lastRun={getLastRun("update-author-links")} destructive confirmTitle="Update all author links?" confirmDescription="This will research and update links for all authors missing link data. Uses Perplexity web search." onRun={handleUpdateAllAuthorLinks} buttonLabel="Update Links" disabled={anyRunning} />
              <ActionCard title="Generate AI Portraits" description="Use AI (Replicate Flux) to generate professional headshots for authors without an avatar." icon={Camera} actionKey="generate-avatars" state={portraitState} lastRun={getLastRun("generate-avatars")} destructive confirmTitle="Generate AI avatars?" confirmDescription="This will generate AI avatars for all authors missing an avatar. Each avatar takes 5-15 seconds." onRun={handleGeneratePortraits} buttonLabel="Generate Portraits" disabled={anyRunning} />
              <ActionCard title="Mirror Avatars to CDN" description="Copy external author avatar URLs to the S3 CDN for stable hosting." icon={CloudArrowUp} actionKey="mirror-avatars" state={mirrorAvatarsState} lastRun={getLastRun("mirror-avatars")} onRun={handleMirrorPhotos} buttonLabel="Mirror Avatars" disabled={anyRunning} />
              <ActionCard title="Enrich Rich Bios" description="Double-pass LLM enrichment: research pass + structured bio with career entries and achievements. Processes 10 authors per run." icon={MagicWand} actionKey="enrich-rich-bio" state={enrichRichBioState} lastRun={getLastRun("enrich-rich-bio")} confirmTitle="Enrich rich author bios?" confirmDescription="Two LLM calls per author (research + write). Authors with existing rich bios are skipped." onRun={handleEnrichRichBio} buttonLabel="Enrich Rich Bios" disabled={anyRunning} />
              <ActionCard title="Discover Platforms" description="Discover YouTube, Twitter/X, LinkedIn, Substack, Instagram, TikTok, GitHub presence for up to 20 authors." icon={ShareNetwork} actionKey="discover-platforms" state={discoverPlatformsState} lastRun={getLastRun("discover-platforms")} confirmTitle="Discover platform presence?" confirmDescription="Queries Perplexity for each author's social profiles. Processes 20 authors per run." onRun={handleDiscoverPlatforms} buttonLabel="Discover Platforms" disabled={anyRunning} />
              <ActionCard title="Enrich Social Stats" description="Fetch live stats from GitHub, Wikipedia, Substack, YouTube, LinkedIn, and more." icon={ChartBar} actionKey="enrich-social-stats" state={enrichSocialStatsState} lastRun={getLastRun("enrich-social-stats")} confirmTitle="Enrich social stats?" confirmDescription="Calls up to 10 external APIs per author. Processes 30 authors per run." onRun={handleEnrichSocialStats} buttonLabel="Enrich Stats" disabled={anyRunning} />
              <ActionCard title="Enrich Enterprise Impact" description="Search SEC EDGAR for author mentions in corporate filings, earnings calls, and annual reports." icon={Buildings} actionKey="enrich-enterprise-impact" state={enrichEnterpriseState} lastRun={getLastRun("enrich-enterprise-impact")} confirmTitle="Enrich enterprise impact?" confirmDescription="Searches SEC EDGAR for each author's mentions in corporate filings. Processes 20 authors per run." onRun={handleEnrichEnterprise} buttonLabel="Enrich Enterprise" disabled={anyRunning} />
              <ActionCard title="Enrich Professional Profiles" description="Fetch structured professional data from Wikidata: alma mater, employers, awards, board memberships." icon={Briefcase} actionKey="enrich-professional-profile" state={enrichProfessionalState} lastRun={getLastRun("enrich-professional-profile")} confirmTitle="Enrich professional profiles?" confirmDescription="Queries Wikidata for each author's professional background. Processes 20 authors per run." onRun={handleEnrichProfessional} buttonLabel="Enrich Profiles" disabled={anyRunning} />
              <ActionCard title="Audit Avatar Backgrounds" description="Use Gemini Vision to scan all author avatars and identify non-standard backgrounds. Run before Normalize." icon={Palette} actionKey="audit-avatar-backgrounds" state={auditBgState} lastRun={getLastRun("audit-avatar-backgrounds")} onRun={handleAuditAvatarBackgrounds} buttonLabel="Audit Backgrounds" disabled={anyRunning} />
              {bgMismatchList.length > 0 && (
                <div className="col-span-full px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">{bgMismatchList.length} avatars need background normalization</p>
                  <p className="text-amber-700 dark:text-amber-400 line-clamp-2 font-mono text-xs">{bgMismatchList.join(", ")}</p>
                </div>
              )}
              <ActionCard title="Normalize Avatar Backgrounds" description={`Re-generate avatars for ${bgMismatchList.length > 0 ? bgMismatchList.length + " queued authors" : "authors identified by audit"} using the current background color.`} icon={Sparkle} actionKey="normalize-avatar-backgrounds" state={normalizeBgState} lastRun={getLastRun("normalize-avatar-backgrounds")} destructive confirmTitle="Normalize all avatar backgrounds?" confirmDescription={`Re-generates AI avatars for ${bgMismatchList.length} authors. Each takes 10-30 seconds. Run audit first.`} onRun={handleNormalizeAvatarBackgrounds} buttonLabel="Normalize All" disabled={anyRunning || bgMismatchList.length === 0} />
            </div>
          </div>
          )}

          {/* ── Books ── */}
          {activeSection === "books" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10"><Books className="h-6 w-6 text-primary" weight="duotone" /></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Books</h1>
                <p className="text-muted-foreground text-sm">Manage book catalog, covers, and AI-generated summaries</p>
              </div>
              <Badge variant="secondary" className="ml-auto">{BOOKS.length} books</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionCard title="Enrich All Books" description={`Generate summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`} icon={Books} actionKey="enrich-books" state={enrichBooksState} lastRun={getLastRun("enrich-books")} destructive confirmTitle="Enrich all books?" confirmDescription="Calls the AI enrichment pipeline for every book. Already-enriched books (within 30 days) are skipped." onRun={handleEnrichBooks} buttonLabel="Enrich Books" disabled={anyRunning} />
              <ActionCard title="Update Book Summaries" description="Research and update summaries for all books missing one via Perplexity web search." icon={FileText} actionKey="update-book-summaries" state={updateBookSummariesState} lastRun={getLastRun("update-book-summaries")} destructive confirmTitle="Update all book summaries?" confirmDescription="Researches and updates summaries for all books missing one. Uses Perplexity web search." onRun={handleUpdateAllBookSummaries} buttonLabel="Update Summaries" disabled={anyRunning} />
              <ActionCard title="Enrich Rich Summaries" description="Double-pass LLM enrichment: research pass + structured summary with themes, quotes, and similar books. 10 books per run." icon={MagicWand} actionKey="enrich-rich-summary" state={enrichRichSummaryState} lastRun={getLastRun("enrich-rich-summary")} confirmTitle="Enrich rich book summaries?" confirmDescription="Two LLM calls per book (research + write). Books with existing rich summaries are skipped." onRun={handleEnrichRichSummary} buttonLabel="Enrich Rich Summaries" disabled={anyRunning} />
              <ActionCard title="Scrape Book Covers" description={`Search Amazon for cover images for books missing one.${scrapeStats ? ` ${scrapeStats.needsScrape} books need covers.` : ""}`} icon={ImageSquare} actionKey="scrape-covers" state={scrapeState} lastRun={getLastRun("scrape-covers")} destructive confirmTitle="Scrape covers from Amazon?" confirmDescription="Searches Amazon for book covers one at a time. Each scrape includes a mirror step." onRun={handleScrapeCovers} buttonLabel="Scrape Covers" disabled={anyRunning} />
              <ActionCard title="Mirror Covers to CDN" description="Copy external cover image URLs to the S3 CDN for stable hosting." icon={CloudArrowUp} actionKey="mirror-covers" state={mirrorCoversState} lastRun={getLastRun("mirror-covers")} onRun={handleMirrorCovers} buttonLabel="Mirror Covers" disabled={anyRunning} />
              <ActionCard title="Rebuild All Book Covers" description="Upgrade all Amazon cover URLs to high-resolution (_SX600_), re-scrape failed covers, and re-mirror to S3." icon={ArrowsClockwise} actionKey="rebuild-covers" state={rebuildCoversState} lastRun={getLastRun("rebuild-covers")} destructive confirmTitle="Rebuild all book covers?" confirmDescription="Upgrades all low-res Amazon URLs to _SX600_, re-scrapes failed covers, and re-mirrors to S3. This may take 2-5 minutes." onRun={handleRebuildCovers} buttonLabel="Rebuild Covers" disabled={anyRunning} />
            </div>
          </div>
          )}

          {/* ── Data Pipeline ── */}
          {activeSection === "pipeline" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10"><Database className="h-6 w-6 text-primary" weight="duotone" /></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Data Pipeline</h1>
                <p className="text-muted-foreground text-sm">Run cascade operations and manage data transformation workflows</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionCard title="Regenerate Database" description="Re-scan Google Drive and rebuild the entire library (authors, books, audiobooks)." icon={ArrowsClockwise} actionKey="regenerate" state={regenerateState} lastRun={getLastRun("regenerate")} destructive confirmTitle="Regenerate the entire database?" confirmDescription="Re-scans Google Drive and rebuilds all library data. Takes 30-60 seconds and replaces existing data." onRun={handleRegenerate} buttonLabel="Regenerate" disabled={anyRunning} />
              <ActionCard title="Enrich Author Bios" description={`AI-powered bios for all ${AUTHORS.length} authors via Wikipedia + Perplexity.`} icon={PencilSimple} actionKey="enrich-bios" state={enrichBiosState} lastRun={getLastRun("enrich-bios")} destructive confirmTitle="Enrich all author bios?" confirmDescription="Calls the AI enrichment pipeline for every author. Already-enriched (within 30 days) are skipped." onRun={handleEnrichBios} buttonLabel="Enrich Bios" disabled={anyRunning} />
              <ActionCard title="Enrich All Books" description={`Summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`} icon={Books} actionKey="enrich-books" state={enrichBooksState} lastRun={getLastRun("enrich-books")} destructive confirmTitle="Enrich all books?" confirmDescription="Calls the AI enrichment pipeline for every book. Already-enriched (within 30 days) are skipped." onRun={handleEnrichBooks} buttonLabel="Enrich Books" disabled={anyRunning} />
              <ActionCard title="Discover Platforms" description="Discover YouTube, Twitter/X, LinkedIn, Substack, Instagram, TikTok, GitHub presence for up to 20 authors." icon={ShareNetwork} actionKey="discover-platforms" state={discoverPlatformsState} lastRun={getLastRun("discover-platforms")} confirmTitle="Discover platform presence?" confirmDescription="Queries Perplexity for each author's official social profiles. Processes 20 authors per run." onRun={handleDiscoverPlatforms} buttonLabel="Discover Platforms" disabled={anyRunning} />
              <ActionCard title="Enrich Social Stats" description="Live stats from GitHub, Wikipedia, Substack, YouTube, LinkedIn, CNBC, Yahoo Finance, and more." icon={ChartBar} actionKey="enrich-social-stats" state={enrichSocialStatsState} lastRun={getLastRun("enrich-social-stats")} confirmTitle="Enrich social stats?" confirmDescription="Calls up to 10 external APIs per author. Processes 30 authors per run." onRun={handleEnrichSocialStats} buttonLabel="Enrich Social Stats" disabled={anyRunning} />
              <ActionCard title="Enrich Rich Author Bios" description="Double-pass LLM: research pass + structured bio with career entries and achievements. 10 authors per run." icon={MagicWand} actionKey="enrich-rich-bio" state={enrichRichBioState} lastRun={getLastRun("enrich-rich-bio")} confirmTitle="Enrich rich author bios?" confirmDescription="Two LLM calls per author (research + write). Authors with existing rich bios are skipped." onRun={handleEnrichRichBio} buttonLabel="Enrich Rich Bios" disabled={anyRunning} />
              <ActionCard title="Enrich Rich Book Summaries" description="Double-pass LLM: research pass + structured summary with themes, quotes, and similar books. 10 books per run." icon={FileText} actionKey="enrich-rich-summary" state={enrichRichSummaryState} lastRun={getLastRun("enrich-rich-summary")} confirmTitle="Enrich rich book summaries?" confirmDescription="Two LLM calls per book (research + write). Books with existing rich summaries are skipped." onRun={handleEnrichRichSummary} buttonLabel="Enrich Rich Summaries" disabled={anyRunning} />
              <ActionCard title="Enrich Enterprise Impact" description="Search SEC EDGAR for author mentions in corporate filings, earnings calls, and annual reports." icon={Buildings} actionKey="enrich-enterprise-impact" state={enrichEnterpriseState} lastRun={getLastRun("enrich-enterprise-impact")} confirmTitle="Enrich enterprise impact?" confirmDescription="Searches SEC EDGAR for each author's mentions. Processes 20 authors per run." onRun={handleEnrichEnterprise} buttonLabel="Enrich Enterprise" disabled={anyRunning} />
              <ActionCard title="Enrich Professional Profiles" description="Fetch structured professional data from Wikidata: alma mater, employers, awards, board memberships." icon={Briefcase} actionKey="enrich-professional-profile" state={enrichProfessionalState} lastRun={getLastRun("enrich-professional-profile")} confirmTitle="Enrich professional profiles?" confirmDescription="Queries Wikidata for each author's professional background. Processes 20 authors per run." onRun={handleEnrichProfessional} buttonLabel="Enrich Profiles" disabled={anyRunning} />
            </div>
            <CascadeTab aStats={aStats} bStats={bStats} scrapeStats={scrapeStats} />
          </div>
          )}

          {/* ── Media Assets ── */}
          {activeSection === "media" && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10"><Image className="h-6 w-6 text-primary" weight="duotone" /></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Media Assets</h1>
                <p className="text-muted-foreground text-sm">Manage images, avatars, and media file operations</p>
              </div>
            </div>
            {bgMismatchList.length > 0 && (
              <Card className="border-orange-500/50 bg-orange-500/5 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-orange-500 mt-0.5" weight="duotone" />
                  <div>
                    <p className="font-medium text-orange-700 dark:text-orange-400">Background Mismatches Detected</p>
                    <p className="text-sm text-muted-foreground mt-1">{bgMismatchList.length} avatar(s) have non-standard backgrounds</p>
                  </div>
                </div>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActionCard title="Generate Missing Avatars" description="Use AI (Replicate Flux) to generate professional headshots for authors without an avatar." icon={Camera} actionKey="generate-avatars" state={portraitState} lastRun={getLastRun("generate-avatars")} destructive confirmTitle="Generate AI avatars?" confirmDescription="Generates AI avatars for all authors missing one. Each takes 5-15 seconds." onRun={handleGeneratePortraits} buttonLabel="Generate Avatars" disabled={anyRunning} />
              <ActionCard title="Mirror Avatars to CDN" description="Copy external author avatar URLs to the S3 CDN for stable hosting." icon={CloudArrowUp} actionKey="mirror-avatars" state={mirrorAvatarsState} lastRun={getLastRun("mirror-avatars")} onRun={handleMirrorPhotos} buttonLabel="Mirror Avatars" disabled={anyRunning} />
              <ActionCard title="Audit Avatar Backgrounds" description="Use Gemini Vision to scan all avatars and detect non-standard background colors." icon={Palette} actionKey="audit-avatar-backgrounds" state={auditBgState} lastRun={getLastRun("audit-avatar-backgrounds")} onRun={handleAuditAvatarBackgrounds} buttonLabel="Audit Backgrounds" disabled={anyRunning} />
              <ActionCard title="Normalize Avatar Backgrounds" description={`Standardize all avatar backgrounds to the default color scheme. ${bgMismatchList.length > 0 ? bgMismatchList.length + " queued." : "Run audit first."}`} icon={Sparkle} actionKey="normalize-avatar-backgrounds" state={normalizeBgState} lastRun={getLastRun("normalize-avatar-backgrounds")} destructive confirmTitle="Normalize all backgrounds?" confirmDescription={`Re-generates AI avatars for ${bgMismatchList.length} authors. Run audit first.`} onRun={handleNormalizeAvatarBackgrounds} buttonLabel="Normalize All" disabled={anyRunning || bgMismatchList.length === 0} />
              <ActionCard title="Scrape Book Covers" description={`Search Amazon for cover images for books missing one.${scrapeStats ? ` ${scrapeStats.needsScrape} books need covers.` : ""}`} icon={ImageSquare} actionKey="scrape-covers" state={scrapeState} lastRun={getLastRun("scrape-covers")} destructive confirmTitle="Scrape covers from Amazon?" confirmDescription="Searches Amazon for book covers one at a time. Each scrape includes a mirror step." onRun={handleScrapeCovers} buttonLabel="Scrape Covers" disabled={anyRunning} />
              <ActionCard title="Mirror Covers to CDN" description="Copy external cover image URLs to the S3 CDN for stable hosting." icon={CloudArrowUp} actionKey="mirror-covers" state={mirrorCoversState} lastRun={getLastRun("mirror-covers")} onRun={handleMirrorCovers} buttonLabel="Mirror Covers" disabled={anyRunning} />
              <ActionCard title="Rebuild All Book Covers" description="Upgrade all Amazon cover URLs to high-resolution (_SX600_), re-scrape failed covers, and re-mirror to S3." icon={ArrowsClockwise} actionKey="rebuild-covers" state={rebuildCoversState} lastRun={getLastRun("rebuild-covers")} destructive confirmTitle="Rebuild all book covers?" confirmDescription="Upgrades all low-res Amazon URLs to _SX600_, re-scrapes failed covers, and re-mirrors to S3. Takes 2-5 minutes." onRun={handleRebuildCovers} buttonLabel="Rebuild Covers" disabled={anyRunning} />
            </div>
          </div>
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
            <CascadeTab aStats={aStats} bStats={bStats} scrapeStats={scrapeStats} />
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
      </div>
    </div>
  );
}
