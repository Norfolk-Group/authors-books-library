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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  Sparkles,
  BookOpen,
  Camera,
  ImageIcon,
  Upload,
  Database,
  BarChart3,
  Settings,
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  BrainCircuit,
  Users,
  Link2,
  BookUser,
  FileText,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AUTHORS, BOOKS } from "@/lib/libraryData";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import { CascadeTab } from "@/components/admin/CascadeTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AboutTab } from "@/components/admin/AboutTab";
import { AiTab } from "@/components/admin/AiTab";
import { InformationToolsTab } from "@/components/admin/InformationToolsTab";

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
  icon: LucideIcon;
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
  const auditAvatarBackgroundsMutation = trpc.authorProfiles.auditAvatarBackgrounds.useMutation();
  const normalizeAvatarBackgroundsMutation = trpc.authorProfiles.normalizeAvatarBackgrounds.useMutation();

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

  // -- 7. Mirror Avatars to S3 --
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

  // -- Stats for Research Cascade --
  const aStats = authorStats.data;
  const bStats = bookStats.data;
  const scrapeStats = batchScrapeStats.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader crumbs={[{ label: "Admin Console" }]} />

      <div className="container max-w-5xl py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage data pipelines, media operations, and application settings.
            {anyRunning && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Operations running
              </Badge>
            )}
          </p>
        </div>

        <Tabs defaultValue="authors" className="space-y-4">
          <TabsList className="flex flex-wrap w-full h-auto gap-0.5">
            <TabsTrigger value="authors" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <Users className="w-3.5 h-3.5" />
              <span>Authors</span>
            </TabsTrigger>
            <TabsTrigger value="books" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Books</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Data Pipeline</span>
              <span className="sm:hidden">Data</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media</span>
            </TabsTrigger>
            <TabsTrigger value="cascade" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Research</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>AI</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Info Tools</span>
              <span className="sm:hidden">Tools</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="text-xs py-2 gap-1.5 flex-1 min-w-[80px]">
              <Info className="w-3.5 h-3.5" />
              <span>About</span>
            </TabsTrigger>
          </TabsList>

          {/* -- Tab: Authors -- */}
          <TabsContent value="authors" className="space-y-3">
            <div className="mb-2">
              <h2 className="text-sm font-semibold">Author Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Batch operations for all {AUTHORS.length} authors in the Google Drive + database.
              </p>
            </div>
            <ActionCard
              title="Enrich All Author Bios"
              description={`Generate AI-powered bios and metadata for all ${AUTHORS.length} authors via Wikipedia + Perplexity. Already-enriched authors (within 30 days) are skipped.`}
              icon={BookUser}
              actionKey="enrich-bios"
              state={enrichBiosState}
              lastRun={getLastRun("enrich-bios")}
              destructive
              confirmTitle="Enrich all author bios?"
              confirmDescription="This will call the AI enrichment pipeline for every author. Already-enriched authors (within 30 days) will be skipped. This may take several minutes."
              onRun={handleEnrichBios}
              buttonLabel="Enrich Bios"
              disabled={anyRunning}
            />
            <ActionCard
              title="Update All Author Links"
              description="Research and update website, social media, podcast, blog, Substack, and newspaper article links for all authors via Perplexity."
              icon={Link2}
              actionKey="update-author-links"
              state={updateLinksState}
              lastRun={getLastRun("update-author-links")}
              destructive
              confirmTitle="Update all author links?"
              confirmDescription="This will research and update links for all authors missing link data. Uses Perplexity web search. May take several minutes."
              onRun={handleUpdateAllAuthorLinks}
              buttonLabel="Update Links"
              disabled={anyRunning}
            />
            <ActionCard
              title="Generate Missing Avatars"
              description="Use AI (Replicate Flux) to generate headshots for authors who don't have an avatar."
              icon={Camera}
              actionKey="generate-avatars"
              state={portraitState}
              lastRun={getLastRun("generate-avatars")}
              destructive
              confirmTitle="Generate AI avatars?"
              confirmDescription="This will generate AI avatars for all authors missing an avatar. Each avatar takes 5-15 seconds. This may take a while for many authors."
              onRun={handleGeneratePortraits}
              buttonLabel="Generate Avatars"
              disabled={anyRunning}
            />
            <ActionCard
              title="Mirror Avatars to S3"
              description="Copy external author avatar URLs to the S3 CDN for stable hosting."
              icon={Upload}
              actionKey="mirror-avatars"
              state={mirrorAvatarsState}
              lastRun={getLastRun("mirror-avatars")}
              onRun={handleMirrorPhotos}
              buttonLabel="Mirror Avatars"
              disabled={anyRunning}
            />
            <ActionCard
              title="Audit Avatar Backgrounds"
              description="Use Gemini Vision to scan all author avatars and identify which ones do not have the canonical bokeh-gold background. Run this before Normalize All."
              icon={Sparkles}
              actionKey="audit-avatar-backgrounds"
              state={auditBgState}
              lastRun={getLastRun("audit-avatar-backgrounds")}
              onRun={handleAuditAvatarBackgrounds}
              buttonLabel="Audit Backgrounds"
              disabled={anyRunning}
            />
            {bgMismatchList.length > 0 && (
              <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs">
                <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  {bgMismatchList.length} avatars need background normalization:
                </p>
                <p className="text-amber-700 dark:text-amber-400 line-clamp-3 font-mono text-[10px]">
                  {bgMismatchList.join(", ")}
                </p>
              </div>
            )}
            <ActionCard
              title="Normalize All Avatar Backgrounds"
              description={`Re-generate avatars for all authors identified by the audit (${bgMismatchList.length > 0 ? bgMismatchList.length + " queued" : "run audit first"}) using the current background color from AI Settings.`}
              icon={Zap}
              actionKey="normalize-avatar-backgrounds"
              state={normalizeBgState}
              lastRun={getLastRun("normalize-avatar-backgrounds")}
              destructive
              confirmTitle="Normalize all avatar backgrounds?"
              confirmDescription={`This will re-generate AI avatars for ${bgMismatchList.length} authors using the current background setting. Each avatar takes 10-30 seconds. Run the audit first to populate the list.`}
              onRun={handleNormalizeAvatarBackgrounds}
              buttonLabel="Normalize All"
              disabled={anyRunning || bgMismatchList.length === 0}
            />
          </TabsContent>

          {/* -- Tab: Books -- */}
          <TabsContent value="books" className="space-y-3">
            <div className="mb-2">
              <h2 className="text-sm font-semibold">Book Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Batch operations for all {BOOKS.length} books in the Google Drive + database.
              </p>
            </div>
            <ActionCard
              title="Enrich All Books"
              description={`Generate summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`}
              icon={BookOpen}
              actionKey="enrich-books"
              state={enrichBooksState}
              lastRun={getLastRun("enrich-books")}
              destructive
              confirmTitle="Enrich all books?"
              confirmDescription="This will call the AI enrichment pipeline for every book. Already-enriched books (within 30 days) will be skipped. This may take several minutes."
              onRun={handleEnrichBooks}
              buttonLabel="Enrich Books"
              disabled={anyRunning}
            />
            <ActionCard
              title="Update All Book Summaries"
              description="Research and update summaries for all books missing one via Perplexity web search."
              icon={FileText}
              actionKey="update-book-summaries"
              state={updateBookSummariesState}
              lastRun={getLastRun("update-book-summaries")}
              destructive
              confirmTitle="Update all book summaries?"
              confirmDescription="This will research and update summaries for all books missing one. Uses Perplexity web search. May take several minutes."
              onRun={handleUpdateAllBookSummaries}
              buttonLabel="Update Summaries"
              disabled={anyRunning}
            />
            <ActionCard
              title="Scrape Book Covers"
              description={`Search Amazon for cover images for books missing one. ${scrapeStats ? `${scrapeStats.needsScrape} books need covers.` : ""}`}
              icon={ImageIcon}
              actionKey="scrape-covers"
              state={scrapeState}
              lastRun={getLastRun("scrape-covers")}
              destructive
              confirmTitle="Scrape covers from Amazon?"
              confirmDescription="This will search Amazon for book covers one at a time. Each scrape includes a mirror step. This may take several minutes."
              onRun={handleScrapeCovers}
              buttonLabel="Scrape Covers"
              disabled={anyRunning}
            />
            <ActionCard
              title="Mirror Covers to S3"
              description="Copy external cover image URLs to the S3 CDN for stable hosting."
              icon={Upload}
              actionKey="mirror-covers"
              state={mirrorCoversState}
              lastRun={getLastRun("mirror-covers")}
              onRun={handleMirrorCovers}
              buttonLabel="Mirror Covers"
              disabled={anyRunning}
            />
          </TabsContent>

          {/* -- Tab 1: Data Pipeline -- */}
          <TabsContent value="pipeline" className="space-y-3">
            <ActionCard
              title="Regenerate Database"
              description="Re-scan Google Drive and rebuild the entire library (authors, books, audiobooks)."
              icon={RefreshCw}
              actionKey="regenerate"
              state={regenerateState}
              lastRun={getLastRun("regenerate")}
              destructive
              confirmTitle="Regenerate the entire database?"
              confirmDescription="This will re-scan Google Drive and rebuild all library data. The operation takes 30-60 seconds and will replace existing data."
              onRun={handleRegenerate}
              buttonLabel="Regenerate"
              disabled={anyRunning}
            />
            <ActionCard
              title="Enrich All Author Bios"
              description={`Generate AI-powered bios, social links, and metadata for all ${AUTHORS.length} authors via Wikipedia + Perplexity.`}
              icon={Sparkles}
              actionKey="enrich-bios"
              state={enrichBiosState}
              lastRun={getLastRun("enrich-bios")}
              destructive
              confirmTitle="Enrich all author bios?"
              confirmDescription="This will call the AI enrichment pipeline for every author. Already-enriched authors (within 30 days) will be skipped. This may take several minutes."
              onRun={handleEnrichBios}
              buttonLabel="Enrich Bios"
              disabled={anyRunning}
            />
            <ActionCard
              title="Enrich All Books"
              description={`Generate summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`}
              icon={BookOpen}
              actionKey="enrich-books"
              state={enrichBooksState}
              lastRun={getLastRun("enrich-books")}
              destructive
              confirmTitle="Enrich all books?"
              confirmDescription="This will call the AI enrichment pipeline for every book. Already-enriched books (within 30 days) will be skipped. This may take several minutes."
              onRun={handleEnrichBooks}
              buttonLabel="Enrich Books"
              disabled={anyRunning}
            />
          </TabsContent>

          {/* -- Tab 2: Media -- */}
          <TabsContent value="media" className="space-y-3">
            <ActionCard
              title="Generate Missing Avatars"
              description="Use AI (Replicate Flux) to generate headshots for authors who don't have an avatar."
              icon={Camera}
              actionKey="generate-avatars"
              state={portraitState}
              lastRun={getLastRun("generate-avatars")}
              destructive
              confirmTitle="Generate AI avatars?"
              confirmDescription="This will generate AI avatars for all authors missing an avatar. Each avatar takes 5-15 seconds. This may take a while for many authors."
              onRun={handleGeneratePortraits}
              buttonLabel="Generate"
              disabled={anyRunning}
            />
            <ActionCard
              title="Scrape Book Covers"
              description={`Search Amazon for cover images for books missing one. ${scrapeStats ? `${scrapeStats.needsScrape} books need covers.` : ""}`}
              icon={ImageIcon}
              actionKey="scrape-covers"
              state={scrapeState}
              lastRun={getLastRun("scrape-covers")}
              destructive
              confirmTitle="Scrape covers from Amazon?"
              confirmDescription="This will search Amazon for book covers one at a time. Each scrape includes a mirror step. This may take several minutes."
              onRun={handleScrapeCovers}
              buttonLabel="Scrape"
              disabled={anyRunning}
            />
            <ActionCard
              title="Mirror Covers to S3"
              description="Copy external cover image URLs to the S3 CDN for stable hosting."
              icon={Upload}
              actionKey="mirror-covers"
              state={mirrorCoversState}
              lastRun={getLastRun("mirror-covers")}
              onRun={handleMirrorCovers}
              buttonLabel="Mirror"
              disabled={anyRunning}
            />
            <ActionCard
              title="Mirror Avatars to S3"
              description="Copy external author avatar URLs to the S3 CDN for stable hosting."
              icon={Upload}
              actionKey="mirror-avatars"
              state={mirrorAvatarsState}
              lastRun={getLastRun("mirror-avatars")}
              onRun={handleMirrorPhotos}
              buttonLabel="Mirror"
              disabled={anyRunning}
            />
          </TabsContent>

          {/* -- Tab 3: Research Cascade -- */}
          <TabsContent value="cascade">
            <CascadeTab aStats={aStats} bStats={bStats} scrapeStats={scrapeStats} />
          </TabsContent>

          {/* -- Tab 4: Settings -- */}
          <TabsContent value="settings">
            <SettingsTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          {/* -- Tab 5: AI -- */}
          <TabsContent value="ai">
            <AiTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          {/* -- Tab: Information Tools -- */}
          <TabsContent value="tools">
            <InformationToolsTab settings={settings} updateSettings={updateSettings} />
          </TabsContent>

          {/* -- Tab 6: About -- */}
          <TabsContent value="about">
            <AboutTab settings={settings} />
          </TabsContent>

                </Tabs>
      </div>
    </div>
  );
}
