/**
 * Preferences Page
 * Four tabs: Themes | Icons | Storage | About
 * Uses AppSettingsContext for persistent theme + icon set selection.
 * Storage tab gives power users access to S3 mirror controls.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { fireConfetti } from "@/hooks/useConfetti";
import { useAppSettings, type ThemeName, type IconSetId } from "@/contexts/AppSettingsContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
  CheckIcon,
  HardDrivesIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ImageIcon,
  UserCircleIcon,
  RocketLaunchIcon,
  LightningIcon,
  BrainIcon,
  TimerIcon,
} from "@phosphor-icons/react";

// ── Theme definitions ─────────────────────────────────────────────────────────

const THEMES: {
  id: ThemeName;
  label: string;
  description: string;
  palette: { bg: string; fg: string; primary: string; accent: string; sidebar: string };
}[] = [
  {
    id: "manus",
    label: "Manus",
    description: "Indigo-blue primary, warm off-white surface, deep indigo sidebar. Modern and focused.",
    palette: {
      bg: "#F4F6FA",
      fg: "#1A2340",
      primary: "#4F6EF7",
      accent: "#7C3AED",
      sidebar: "#1A2340",
    },
  },
  {
    id: "norfolk-ai",
    label: "Norfolk AI",
    description: "NCG brand: deep navy sidebar, yellow accent. Bold and institutional.",
    palette: {
      bg: "#F5F8FA",
      fg: "#34475B",
      primary: "#112548",
      accent: "#FDB817",
      sidebar: "#112548",
    },
  },
  {
    id: "noir-dark",
    label: "Noir Dark",
    description: "Executive monochrome: white background, black typography and buttons.",
    palette: {
      bg: "#FFFFFF",
      fg: "#0A0A0A",
      primary: "#0A0A0A",
      accent: "#374151",
      sidebar: "#FFFFFF",
    },
  },
];

// ── Icon set definitions ──────────────────────────────────────────────────────

const ICON_SETS: {
  id: IconSetId;
  label: string;
  description: string;
  weight: "regular" | "duotone";
}[] = [
  {
    id: "phosphor-regular",
    label: "Phosphor Regular",
    description: "1.5px stroke, rounded caps. Matches the Manus icon style exactly.",
    weight: "regular",
  },
  {
    id: "phosphor-duotone",
    label: "Phosphor Duotone",
    description: "Two-tone fill style. Richer on dark themes and executive palettes.",
    weight: "duotone",
  },
];

// Preview icons for the icon set selector
const PREVIEW_ICON_COMPONENTS = [
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
];

// ── Color swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-6 h-6 rounded border border-border/50 shadow-sm"
        style={{ backgroundColor: color }}
        title={`${label}: ${color}`}
      />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: (typeof THEMES)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) scale(1.02)`;
  };
  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)";
  };
  return (
    <Card
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`p-4 cursor-pointer transition-all border-2 pref-card-3d ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      style={{ transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease", willChange: "transform" }}
      onClick={onSelect}
    >
      {/* Preview strip */}
      <div
        className="w-full h-10 rounded-md mb-3 overflow-hidden flex"
        style={{ backgroundColor: theme.palette.bg }}
      >
        {/* Sidebar strip */}
        <div className="w-8 h-full" style={{ backgroundColor: theme.palette.sidebar }} />
        {/* Content area */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-2">
          <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: theme.palette.fg + "30" }} />
          <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: theme.palette.accent + "60" }} />
        </div>
        {/* Primary button preview */}
        <div
          className="m-1.5 px-2 rounded flex items-center"
          style={{ backgroundColor: theme.palette.primary, minWidth: 20 }}
        />
      </div>

      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold font-display text-foreground">{theme.label}</span>
          {selected && (
            <span className="ml-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{theme.description}</p>

      {/* Color palette swatches */}
      <div className="flex gap-2">
        <ColorSwatch color={theme.palette.bg} label="BG" />
        <ColorSwatch color={theme.palette.fg} label="FG" />
        <ColorSwatch color={theme.palette.primary} label="Primary" />
        <ColorSwatch color={theme.palette.accent} label="Accent" />
        <ColorSwatch color={theme.palette.sidebar} label="Sidebar" />
      </div>
    </Card>
  );
}

// ── Icon set card ─────────────────────────────────────────────────────────────

function IconSetCard({
  iconSet,
  selected,
  onSelect,
}: {
  iconSet: (typeof ICON_SETS)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) scale(1.02)`;
  };
  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)";
  };
  return (
    <Card
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`p-4 cursor-pointer transition-all border-2 pref-card-3d ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      style={{ transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease", willChange: "transform" }}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold font-display text-foreground">{iconSet.label}</span>
            {selected && (
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{iconSet.description}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      {/* Live icon preview row */}
      <div className="flex items-center gap-3 text-foreground mt-3 p-2 bg-muted/40 rounded-md">
        {PREVIEW_ICON_COMPONENTS.map((Icon, i) => (
          <Icon key={i} size={20} weight={iconSet.weight} />
        ))}
      </div>
    </Card>
  );
}

// ── Storage mirror card ───────────────────────────────────────────────────────

type MirrorJobStatus = "idle" | "running" | "done" | "error";

function MirrorCard({
  title,
  description,
  icon: Icon,
  stats,
  onRun,
  status,
  done,
  total,
}: {
  title: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  stats: { withCover?: number; mirrored?: number; pending?: number; withPhoto?: number } | undefined;
  onRun: () => void;
  status: MirrorJobStatus;
  done: number;
  total: number;
}) {
  const pending = stats?.pending ?? null;
  const mirrored = stats?.mirrored ?? null;
  const allDone = pending === 0;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-0.5">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        {mirrored !== null && (
          <span className="flex items-center gap-1">
            <CheckCircleIcon size={13} className="text-green-500" />
            {mirrored} on S3
          </span>
        )}
        {pending !== null && pending > 0 && (
          <span className="flex items-center gap-1">
            <WarningCircleIcon size={13} className="text-amber-500" />
            {pending} pending
          </span>
        )}
        {allDone && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircleIcon size={13} />
            All images on S3
          </span>
        )}
      </div>

      {/* Progress bar (while running) */}
      {status === "running" && total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Mirroring {done} of {total}…</span>
            <span>{Math.round((done / total) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full progress-shimmer"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={onRun}
        disabled={status === "running" || allDone}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "running" ? (
          <ArrowsClockwiseIcon size={14} className="animate-spin" />
        ) : status === "done" || allDone ? (
          <CheckCircleIcon size={14} className="text-green-600" />
        ) : (
          <ArrowsClockwiseIcon size={14} />
        )}
        {status === "running"
          ? `Mirroring… ${done} done`
          : status === "done"
          ? "Mirror complete"
          : allDone
          ? "All images on S3 ✓"
          : `Run Mirror${pending !== null ? ` (${pending} pending)` : ""}`}
      </button>
    </Card>
  );
}

// ── Storage tab ───────────────────────────────────────────────────────────────

type AvatarJobStatus = "idle" | "running" | "done" | "error";

function StorageTab() {
  const [coverStatus, setCoverStatus] = useState<MirrorJobStatus>("idle");
  const [coverDone, setCoverDone] = useState(0);
  const [coverTotal, setCoverTotal] = useState(0);
  const [photoStatus, setPhotoStatus] = useState<MirrorJobStatus>("idle");
  const [photoDone, setPhotoDone] = useState(0);
  const [photoTotal, setPhotoTotal] = useState(0);

  // Avatar generation state
  const [avatarStatus, setAvatarStatus] = useState<AvatarJobStatus>("idle");
  const [avatarDone, setAvatarDone] = useState(0);
  const [avatarTotal, setAvatarTotal] = useState(0);
  const [avatarLog, setAvatarLog] = useState<Array<{ name: string; source: string; tier: number; success: boolean }>>([]);

  const mirrorCoversMutation = trpc.bookProfiles.mirrorCovers.useMutation();
  const mirrorPhotosMutation = trpc.authorProfiles.mirrorPhotos.useMutation();
  const generateAllAvatarsMutation = trpc.authorProfiles.generateAllMissingAvatars.useMutation();
  const coverStats = trpc.bookProfiles.getMirrorCoverStats.useQuery(undefined, { staleTime: 30_000 });
  const photoStats = trpc.authorProfiles.getMirrorPhotoStats.useQuery(undefined, { staleTime: 30_000 });
  const avatarStats = trpc.authorProfiles.getAvatarStats.useQuery(undefined, { staleTime: 30_000 });

  const runMirrorCovers = useCallback(async () => {
    if (coverStatus === "running") return;
    const total = coverStats.data?.pending ?? 0;
    if (total === 0) return;
    setCoverStatus("running");
    setCoverDone(0);
    setCoverTotal(total);
    let done = 0;
    try {
      while (true) {
        const result = await mirrorCoversMutation.mutateAsync({ batchSize: 10 });
        done += result.mirrored;
        setCoverDone(done);
        if (result.total === 0 || result.mirrored === 0) break;
      }
      setCoverStatus("done");
      void coverStats.refetch();
      toast.success(`Mirrored ${done} book covers to S3 CDN.`);
      if (done > 0) fireConfetti("enrich");
    } catch {
      setCoverStatus("error");
      toast.error("Cover mirroring failed. Check the console for details.");
    }
  }, [coverStatus, mirrorCoversMutation, coverStats]);

  const runMirrorPhotos = useCallback(async () => {
    if (photoStatus === "running") return;
    const total = photoStats.data?.pending ?? 0;
    if (total === 0) return;
    setPhotoStatus("running");
    setPhotoDone(0);
    setPhotoTotal(total);
    let done = 0;
    try {
      while (true) {
        const result = await mirrorPhotosMutation.mutateAsync({ batchSize: 10 });
        done += result.mirrored;
        setPhotoDone(done);
        if (result.total === 0 || result.mirrored === 0) break;
      }
      setPhotoStatus("done");
      void photoStats.refetch();
      toast.success(`Mirrored ${done} author photos to S3 CDN.`);
      if (done > 0) fireConfetti("enrich");
    } catch {
      setPhotoStatus("error");
      toast.error("Photo mirroring failed. Check the console for details.");
    }
  }, [photoStatus, mirrorPhotosMutation, photoStats]);

  const runGenerateAvatars = useCallback(async () => {
    if (avatarStatus === "running") return;
    const missing = avatarStats.data?.missing ?? 0;
    if (missing === 0) {
      toast.info("All authors already have photos.");
      return;
    }
    setAvatarStatus("running");
    setAvatarDone(0);
    setAvatarTotal(missing);
    setAvatarLog([]);

    // We need the list of authors without photos — fetch from the server
    // by calling generateAvatarsBatch with empty names to get the full list
    // Instead, we'll pass a sentinel value to trigger "all missing" mode
    let done = 0;
    try {
      const result = await generateAllAvatarsMutation.mutateAsync({
        batchSize: 5,
        maxTier: 5,
        skipValidation: false,
      });
      done = result.succeeded;
      setAvatarDone(done);
      setAvatarLog(result.results.map((r) => ({ name: r.name, source: r.source, tier: r.tier, success: r.success })));
      setAvatarStatus("done");
      void avatarStats.refetch();
      toast.success(`Generated ${done} author avatars via waterfall.`);
      if (done > 0) fireConfetti("batch");
    } catch {
      setAvatarStatus("error");
      toast.error("Avatar generation failed. Check the console for details.");
    }
  }, [avatarStatus, avatarStats, generateAllAvatarsMutation]);

  const avatarPct = useMemo(
    () => (avatarTotal > 0 ? Math.round((avatarDone / avatarTotal) * 100) : 0),
    [avatarDone, avatarTotal]
  );

  // ── Enrich All Missing Summaries ──
  type EnrichSummaryStatus = "idle" | "running" | "done" | "error";
  const [summaryStatus, setSummaryStatus] = useState<EnrichSummaryStatus>("idle");
  const [summaryResult, setSummaryResult] = useState<{ total: number; enriched: number; skipped: number; failed: number } | null>(null);
  const enrichAllSummariesMutation = trpc.bookProfiles.enrichAllMissingSummaries.useMutation();
  const summaryStats = trpc.bookProfiles.getSummaryStats.useQuery(undefined, { staleTime: 30_000 });

  const runEnrichAllSummaries = useCallback(async () => {
    if (summaryStatus === "running") return;
    const missing = summaryStats.data?.missingSummary ?? 0;
    if (missing === 0) {
      toast.info("All books already have summaries.");
      return;
    }
    setSummaryStatus("running");
    setSummaryResult(null);
    try {
      const result = await enrichAllSummariesMutation.mutateAsync({});
      setSummaryResult(result);
      setSummaryStatus("done");
      void summaryStats.refetch();
      toast.success(`Enriched ${result.enriched} book summaries (${result.skipped} skipped, ${result.failed} failed).`);
      if (result.enriched > 0) fireConfetti("enrich");
    } catch {
      setSummaryStatus("error");
      toast.error("Summary enrichment failed. Check the console for details.");
    }
  }, [summaryStatus, summaryStats, enrichAllSummariesMutation]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
          S3 CDN Mirror
        </p>
        <p className="text-xs text-muted-foreground">
          Book covers and author photos are fetched from external sources (Amazon, Wikipedia) and mirrored
          to the Manus S3 CDN for reliable, fast delivery. Mirroring runs automatically after enrichment.
          Use these controls to force a manual sync if images appear broken or missing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MirrorCard
          title="Book Covers"
          description="Mirror book cover images from Amazon and Google Books to the S3 CDN."
          icon={ImageIcon}
          stats={coverStats.data}
          onRun={runMirrorCovers}
          status={coverStatus}
          done={coverDone}
          total={coverTotal}
        />
        <MirrorCard
          title="Author Photos"
          description="Mirror author headshots from Wikipedia and publisher sites to the S3 CDN."
          icon={UserCircleIcon}
          stats={photoStats.data}
          onRun={runMirrorPhotos}
          status={photoStatus}
          done={photoDone}
          total={photoTotal}
        />
      </div>

      <p className="text-xs text-muted-foreground pt-1">
        Mirrored images are served from the Manus CDN and will not be affected by third-party rate limits or hotlink blocks.
        Original source URLs are preserved in the database as a fallback.
      </p>

      {/* ── Avatar Generation ── */}
      <div className="mt-6 pt-5 border-t border-border">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
          Author Avatar Generation
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Automatically finds real author photos using a 5-tier waterfall: Wikipedia → Tavily image search →
          Open Library → Gemini-validated web images → AI-generated portrait (Replicate). Results are saved
          to S3 and displayed in author cards.
        </p>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <UserCircleIcon size={18} className="text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">Generate All Author Avatars</h3>
              <p className="text-xs text-muted-foreground">Run the waterfall for all authors missing a photo.</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            {avatarStats.data && (
              <>
                <span className="flex items-center gap-1">
                  <CheckCircleIcon size={13} className="text-green-500" />
                  {avatarStats.data.hasPhoto} have photos
                </span>
                {avatarStats.data.missing > 0 && (
                  <span className="flex items-center gap-1">
                    <WarningCircleIcon size={13} className="text-amber-500" />
                    {avatarStats.data.missing} missing
                  </span>
                )}
                {avatarStats.data.missing === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircleIcon size={13} />
                    All authors have photos
                  </span>
                )}
              </>
            )}
          </div>

          {/* Progress bar (while running) */}
          {avatarStatus === "running" && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Processing {avatarDone} of {avatarTotal} authors…</span>
                <span>{avatarPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${avatarPct}%`, backgroundColor: "var(--primary)" }}
                />
              </div>
            </div>
          )}

          {/* Results log (after done) */}
          {avatarStatus === "done" && avatarLog.length > 0 && (
            <div className="mb-3 max-h-32 overflow-y-auto rounded-md bg-muted/40 p-2 space-y-1">
              {avatarLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  {entry.success ? (
                    <CheckCircleIcon size={11} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <WarningCircleIcon size={11} className="text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-foreground truncate">{entry.name}</span>
                  <span className="text-muted-foreground ml-auto flex-shrink-0">T{entry.tier} · {entry.source}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={runGenerateAvatars}
            disabled={avatarStatus === "running" || (avatarStats.data?.missing ?? 1) === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {avatarStatus === "running" ? (
              <ArrowsClockwiseIcon size={14} className="animate-spin" />
            ) : avatarStatus === "done" ? (
              <CheckCircleIcon size={14} className="text-green-600" />
            ) : (
              <UserCircleIcon size={14} />
            )}
            {avatarStatus === "running"
              ? `Generating… ${avatarDone} done`
              : avatarStatus === "done"
              ? `Done — ${avatarDone} avatars generated`
              : (avatarStats.data?.missing ?? 0) === 0
              ? "All authors have photos ✓"
              : `Generate Avatars (${avatarStats.data?.missing ?? "?"} missing)`}
          </button>
        </Card>
      </div>

      {/* ── Book Summary Enrichment ── */}
      <div className="mt-6 pt-5 border-t border-border">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
          Book Summary Enrichment
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Fetches 2–3 sentence summaries for books that are missing one, using Google Books API with
          an LLM fallback. Summaries appear in hover tooltips on book cover thumbnails.
        </p>

        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <BooksIcon size={18} className="text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-0.5">Enrich All Missing Summaries</h3>
              <p className="text-xs text-muted-foreground">Run Google Books + LLM enrichment for all books without a summary.</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            {summaryStats.data && (
              <>
                <span className="flex items-center gap-1">
                  <CheckCircleIcon size={13} className="text-green-500" />
                  {summaryStats.data.withSummary} have summaries
                </span>
                {summaryStats.data.missingSummary > 0 && (
                  <span className="flex items-center gap-1">
                    <WarningCircleIcon size={13} className="text-amber-500" />
                    {summaryStats.data.missingSummary} missing
                  </span>
                )}
                {summaryStats.data.missingSummary === 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircleIcon size={13} />
                    All books have summaries
                  </span>
                )}
              </>
            )}
          </div>

          {/* Running spinner */}
          {summaryStatus === "running" && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowsClockwiseIcon size={13} className="animate-spin" />
              <span>Enriching summaries… this may take a few minutes.</span>
            </div>
          )}

          {/* Results after done */}
          {summaryStatus === "done" && summaryResult && (
            <div className="mb-3 rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={13} className="text-green-500" />
                <span>{summaryResult.enriched} enriched</span>
              </div>
              {summaryResult.skipped > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-3" />
                  <span>{summaryResult.skipped} skipped (no data found)</span>
                </div>
              )}
              {summaryResult.failed > 0 && (
                <div className="flex items-center gap-2 text-amber-600">
                  <WarningCircleIcon size={13} />
                  <span>{summaryResult.failed} failed</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={runEnrichAllSummaries}
            disabled={summaryStatus === "running" || (summaryStats.data?.missingSummary ?? 1) === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {summaryStatus === "running" ? (
              <ArrowsClockwiseIcon size={14} className="animate-spin" />
            ) : summaryStatus === "done" ? (
              <CheckCircleIcon size={14} className="text-green-600" />
            ) : (
              <BooksIcon size={14} />
            )}
            {summaryStatus === "running"
              ? "Enriching summaries…"
              : summaryStatus === "done"
              ? `Done — ${summaryResult?.enriched ?? 0} summaries added`
              : (summaryStats.data?.missingSummary ?? 0) === 0
              ? "All books have summaries ✓"
              : `Enrich All Missing Summaries (${summaryStats.data?.missingSummary ?? "?"} books)`}
          </button>
        </Card>
      </div>
    </div>
  );
}

// ── LLM Tab ───────────────────────────────────────────────────────────────────

function LlmTab() {
  const { settings, updateSettings } = useAppSettings();
  const modelsQuery = trpc.llm.listModels.useQuery();
  const testModel = trpc.llm.testModel.useMutation();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; response?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const models = modelsQuery.data ?? [];

  // Group by tier
  const stable = models.filter((m) => m.tier === "stable");
  const preview = models.filter((m) => m.tier === "preview");
  const latest = models.filter((m) => m.tier === "latest");

  const speedIcon = (speed: string) => {
    if (speed === "fast") return <LightningIcon size={12} className="text-amber-500" />;
    if (speed === "powerful") return <BrainIcon size={12} className="text-violet-500" />;
    return <RocketLaunchIcon size={12} className="text-blue-500" />;
  };

  const tierBadge = (tier: string) => {
    if (tier === "stable") return <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Stable</Badge>;
    if (tier === "preview") return <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-400 text-amber-600">Preview</Badge>;
    return <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-blue-400 text-blue-600">Latest</Badge>;
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testModel.mutateAsync({ modelId: settings.geminiModel });
      setTestResult(result);
      if (result.success) {
        toast.success(`${settings.geminiModel} responded in ${result.latencyMs}ms`);
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch (err) {
      setTestResult({ success: false, latencyMs: 0, error: String(err) });
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  };

  const ModelSection = ({ title, items }: { title: string; items: typeof models }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
        <div className="space-y-1.5">
          {items.map((model) => {
            const isSelected = settings.geminiModel === model.id;
            return (
              <label
                key={model.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all pref-card-3d ${
                  isSelected
                    ? "border-foreground bg-muted/40 shadow-sm"
                    : "border-border hover:border-muted-foreground hover:bg-muted/20"
                }`}
                style={{ transition: "all 0.15s ease" }}
              >
                {/* Radio input */}
                <input
                  type="radio"
                  name="gemini-model"
                  value={model.id}
                  checked={isSelected}
                  onChange={() => updateSettings({ geminiModel: model.id })}
                  className="mt-0.5 accent-foreground"
                />
                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{model.displayName}</span>
                    {tierBadge(model.tier)}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      {speedIcon(model.speed)}
                      {model.speed}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{model.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{(model.inputTokens / 1000).toFixed(0)}K context</span>
                    <span>{(model.outputTokens / 1000).toFixed(0)}K output</span>
                    <code className="font-mono opacity-60">{model.id}</code>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircleIcon size={16} className="text-foreground mt-0.5 flex-shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">AI Model</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selected model is used for portrait validation and AI-powered enrichment.
          </p>
        </div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
        >
          {testing ? (
            <ArrowsClockwiseIcon size={12} className="animate-spin" />
          ) : (
            <TimerIcon size={12} />
          )}
          Test selected model
        </button>
      </div>

      {/* Test result */}
      {testResult && (
        <Card className={`p-3 mb-4 text-xs flex items-center gap-2 ${
          testResult.success ? "border-green-400/50 bg-green-50/50 dark:bg-green-950/20" : "border-red-400/50 bg-red-50/50 dark:bg-red-950/20"
        }`}>
          {testResult.success ? (
            <CheckCircleIcon size={14} className="text-green-600 flex-shrink-0" />
          ) : (
            <WarningCircleIcon size={14} className="text-red-500 flex-shrink-0" />
          )}
          <div>
            {testResult.success ? (
              <span className="text-green-700 dark:text-green-400">
                Responded in <strong>{testResult.latencyMs}ms</strong> — "{testResult.response}"
              </span>
            ) : (
              <span className="text-red-700 dark:text-red-400">{testResult.error}</span>
            )}
          </div>
        </Card>
      )}

      {/* Loading state */}
      {modelsQuery.isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Model groups */}
      {!modelsQuery.isLoading && (
        <>
          <ModelSection title="Gemini 3.x Preview" items={preview} />
          <ModelSection title="Gemini 2.5 Stable" items={stable} />
          <ModelSection title="Latest Aliases" items={latest} />
        </>
      )}

      <p className="text-xs text-muted-foreground pt-3 border-t border-border">
        Model selection is saved to your browser. Preview models may have different rate limits.
        The default is <code className="font-mono">gemini-2.5-flash</code>.
      </p>
    </div>
  );
}

// ── Main Preferences page ─────────────────────────────────────────────────────

export default function Preferences() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Preferences" }]} />
      <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Customize the appearance and behaviour of the Ricardo Cidale's Library.
        </p>
      </div>

      <Tabs defaultValue="themes">
        <TabsList className="mb-6">
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="icons">Icons</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="llm">AI Model</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* ── Themes tab ── */}
        <TabsContent value="themes" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Select Theme
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={settings.theme === theme.id}
                onSelect={() => updateSettings({ theme: theme.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Theme changes apply instantly and are saved to your browser.
          </p>
        </TabsContent>

        {/* ── Icons tab ── */}
        <TabsContent value="icons" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Icon Style
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ICON_SETS.map((iconSet) => (
              <IconSetCard
                key={iconSet.id}
                iconSet={iconSet}
                selected={settings.iconSet === iconSet.id}
                onSelect={() => updateSettings({ iconSet: iconSet.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Icon style changes apply to navigation and UI icons throughout the app.
          </p>
        </TabsContent>

        {/* ── Storage tab ── */}
        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>

        {/* ── LLM tab ── */}
        <TabsContent value="llm">
          <LlmTab />
        </TabsContent>

        {/* ── About tab ── */}
        <TabsContent value="about">
          <Card className="p-6">
            <h2 className="text-base font-semibold font-display text-foreground mb-4">About</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Application</span>
                <span className="text-foreground font-medium">Ricardo Cidale's Library</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Organisation</span>
                <span className="text-foreground font-medium">Norfolk Consulting Group</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Powered by</span>
                <span className="text-foreground font-medium">Norfolk AI</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Icon Library</span>
                <span className="text-foreground font-medium">Phosphor Icons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground font-medium">March 2026</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
