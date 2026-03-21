/**
 * Admin Console - Consolidated admin operations for the NCG Library.
 *
 * Tabs:
 *   1. Data Pipeline - Regenerate DB, Enrich Bios, Enrich Books
 *   2. Media - Generate Portraits, Scrape Covers, Mirror to S3
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
  type LucideIcon,
} from "lucide-react";
import { AUTHORS, BOOKS } from "@/lib/libraryData";
import { AUDIO_BOOKS } from "@/lib/audioData";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import { CascadeTab } from "@/components/admin/CascadeTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AboutTab } from "@/components/admin/AboutTab";

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
  const generatePortraitMutation = trpc.authorProfiles.generatePortrait.useMutation();
  const scrapeNextMutation = trpc.apify.scrapeNextMissingCover.useMutation();
  const mirrorCoversMutation = trpc.bookProfiles.mirrorCovers.useMutation();
  const mirrorPhotosMutation = trpc.authorProfiles.mirrorPhotos.useMutation();

  // -- Action states --
  const [regenerateState, setRegenerateState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBiosState, setEnrichBiosState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBooksState, setEnrichBooksState] = useState<ActionState>(INITIAL_STATE);
  const [portraitState, setPortraitState] = useState<ActionState>(INITIAL_STATE);
  const [scrapeState, setScrapeState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorCoversState, setMirrorCoversState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorPhotosState, setMirrorPhotosState] = useState<ActionState>(INITIAL_STATE);

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
    mirrorPhotosState,
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
          model: settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.secondaryLlmEnabled ? settings.secondaryModel : undefined,
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
          model: settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.secondaryLlmEnabled ? settings.secondaryModel : undefined,
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

  // -- 4. Generate All Portraits --
  const handleGeneratePortraits = useCallback(async () => {
    if (portraitState.status === "running") return;
    const allNames = Array.from(
      new Set(
        AUTHORS.map((a) => {
          const d = a.name.indexOf(" - ");
          return d !== -1 ? a.name.slice(0, d) : a.name;
        }),
      ),
    );
    // Filter to only those without a photo
    const photoMap = utils.authorProfiles.getPhotoMap.getData() ?? [];
    const photoSet = new Set(
      (photoMap as Array<{ authorName: string; photoUrl?: string | null }>)
        .filter((r) => r.photoUrl)
        .map((r) => r.authorName.toLowerCase()),
    );
    const missing = allNames.filter(
      (n) => !photoSet.has(n.toLowerCase()) && !getAuthorPhoto(canonicalName(n)),
    );
    if (missing.length === 0) {
      toast.info("All authors already have photos!");
      return;
    }
    const total = missing.length;
    setPortraitState({
      status: "running",
      progress: 0,
      message: `0/${total} portraits`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let done = 0;
    let failed = 0;
    try {
      for (let i = 0; i < missing.length; i++) {
        const authorName = missing[i];
        try {
          await generatePortraitMutation.mutateAsync({ authorName, bgColor: settings.avatarBgColor });
          done++;
        } catch {
          failed++;
        }
        const pct = Math.round(((i + 1) / total) * 100);
        setPortraitState((s) => ({
          ...s,
          progress: pct,
          done,
          failed,
          message: `${done}/${total} - ${authorName}`,
        }));
      }
      setPortraitState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${done} generated, ${failed} failed`,
      }));
      toast.success(`Generated ${done} portraits${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.authorProfiles.getPhotoMap.invalidate();
      await recordAction("generate-portraits", "Generate Portraits", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortraitState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Portrait generation failed: " + msg);
      await recordAction("generate-portraits", "Generate Portraits", start, `error: ${msg}`, done);
    }
  }, [portraitState.status, generatePortraitMutation, utils, recordAction]);

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

  // -- 7. Mirror Photos to S3 --
  const handleMirrorPhotos = useCallback(async () => {
    if (mirrorPhotosState.status === "running") return;
    setMirrorPhotosState({ ...INITIAL_STATE, status: "running", message: "Mirroring photos..." });
    const start = Date.now();
    let totalMirrored = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const result = await mirrorPhotosMutation.mutateAsync({ batchSize: 10 });
        totalMirrored += result.mirrored;
        setMirrorPhotosState((s) => ({
          ...s,
          done: totalMirrored,
          message: `${totalMirrored} photos mirrored...`,
        }));
        if (result.mirrored === 0) break;
      }
      setMirrorPhotosState({
        status: "done",
        progress: 100,
        message: `${totalMirrored} photos mirrored to S3`,
        done: totalMirrored,
        total: totalMirrored,
        failed: 0,
      });
      toast.success(`Mirrored ${totalMirrored} photos to S3.`);
      await recordAction("mirror-photos", "Mirror Photos to S3", start, "success", totalMirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMirrorPhotosState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Mirror photos failed: " + msg);
      await recordAction("mirror-photos", "Mirror Photos to S3", start, `error: ${msg}`, totalMirrored);
    }
  }, [mirrorPhotosState.status, mirrorPhotosMutation, recordAction]);

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

        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="pipeline" className="text-xs py-2 gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Data Pipeline</span>
              <span className="sm:hidden">Data</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="text-xs py-2 gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Media</span>
              <span className="sm:hidden">Media</span>
            </TabsTrigger>
            <TabsTrigger value="cascade" className="text-xs py-2 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Research Cascade</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs py-2 gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="text-xs py-2 gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">About</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
          </TabsList>

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
              title="Generate Missing Portraits"
              description="Use AI (Replicate Flux) to generate headshots for authors who don't have a photo."
              icon={Camera}
              actionKey="generate-portraits"
              state={portraitState}
              lastRun={getLastRun("generate-portraits")}
              destructive
              confirmTitle="Generate AI portraits?"
              confirmDescription="This will generate AI portraits for all authors missing a photo. Each portrait takes 5-15 seconds. This may take a while for many authors."
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
              title="Mirror Photos to S3"
              description="Copy external author photo URLs to the S3 CDN for stable hosting."
              icon={Upload}
              actionKey="mirror-photos"
              state={mirrorPhotosState}
              lastRun={getLastRun("mirror-photos")}
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

          {/* -- Tab 5: About -- */}
          <TabsContent value="about">
            <AboutTab settings={settings} />
          </TabsContent>

                </Tabs>
      </div>
    </div>
  );
}
