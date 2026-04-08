/**
 * AdminIntelligenceDashboard.tsx
 *
 * The command center for all autonomous enrichment pipelines.
 * Shows live job status, coverage heatmap, pipeline controls, and review queue stats.
 *
 * Design: Dark command-center aesthetic with status indicators, coverage bars, and job logs.
 */

import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Play,
  Square,
  RefreshCw,
  Activity,
  Database,
  Users,
  BookOpen,
  Link,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
  Settings2,
} from "lucide-react";
import { InfoTip } from "@/components/admin/InfoTip";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PipelineInfo {
  key: string;
  label: string;
  description: string;
  category: "author" | "book" | "content" | "index" | "review";
  icon: React.ElementType;
}

const PIPELINE_META: Record<string, PipelineInfo> = {
  "wikipedia-bios": {
    key: "wikipedia-bios",
    label: "Wikipedia Bios",
    description: "Fetch author bios from Wikipedia API",
    category: "author",
    icon: Users,
  },
  "social-stats": {
    key: "social-stats",
    label: "Social Stats",
    description: "Collect follower counts from YouTube, Twitter, Substack, GitHub",
    category: "author",
    icon: Activity,
  },
  "platform-discovery": {
    key: "platform-discovery",
    label: "Platform Discovery",
    description: "Discover all author websites via Perplexity sonar-pro",
    category: "author",
    icon: Link,
  },
  "rich-bios": {
    key: "rich-bios",
    label: "Rich Bios (LLM)",
    description: "Generate deep 2-pass LLM biographies for authors without richBioJson",
    category: "author",
    icon: Zap,
  },
  "open-library": {
    key: "open-library",
    label: "Open Library",
    description: "Enrich books with publisher, page count, ISBN from Open Library",
    category: "book",
    icon: BookOpen,
  },
  "rich-summaries": {
    key: "rich-summaries",
    label: "Rich Summaries (LLM)",
    description: "Generate deep 2-pass LLM book summaries for books without richSummaryJson",
    category: "book",
    icon: Zap,
  },
  "url-quality": {
    key: "url-quality",
    label: "URL Quality Scoring",
    description: "LLM-score all content item URLs for relevance, authority, freshness",
    category: "content",
    icon: BarChart3,
  },
  "pinecone-index-books": {
    key: "pinecone-index-books",
    label: "Index Books → Pinecone",
    description: "Embed and upsert all books to Pinecone for semantic search",
    category: "index",
    icon: Database,
  },
  "pinecone-index-authors": {
    key: "pinecone-index-authors",
    label: "Index Authors → Pinecone",
    description: "Embed and upsert all authors to Pinecone for semantic search",
    category: "index",
    icon: Database,
  },
  "chatbot-candidates": {
    key: "chatbot-candidates",
    label: "Chatbot Candidate Scan",
    description: "Score all authors for RAG readiness and queue top candidates",
    category: "review",
    icon: Zap,
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  author: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  book: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  content: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  index: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  review: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  running: "text-blue-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
  queued: "text-amber-400",
  cancelled: "text-gray-400",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  running: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  queued: Clock,
  cancelled: Square,
};

// ── Coverage Bar Component ────────────────────────────────────────────────────

function CoverageBar({
  label,
  value,
  total,
  color = "bg-blue-500",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {value.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Job Row Component ─────────────────────────────────────────────────────────

function JobRow({ job }: { job: Record<string, unknown> }) {
  const status = String(job.status ?? "queued");
  const StatusIconComp = (STATUS_ICONS[status] ?? Clock) as React.ComponentType<{ className?: string }>;
  const pipelineKey = String(job.pipelineKey ?? "");
  const meta = PIPELINE_META[pipelineKey];
  const total = Number(job.totalItems ?? 0);
  const processed = Number(job.processedItems ?? 0);
  const succeeded = Number(job.succeededItems ?? 0);
  const failed = Number(job.failedItems ?? 0);
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const startedAt = job.startedAt ? new Date(job.startedAt as string) : null;
  const completedAt = job.completedAt ? new Date(job.completedAt as string) : null;
  const duration =
    startedAt && completedAt
      ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
      <StatusIconComp
        className={["w-4 h-4 mt-0.5 flex-shrink-0", STATUS_COLORS[status] ?? "text-muted-foreground", status === "running" ? "animate-spin" : ""].join(" ")}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {meta?.label ?? pipelineKey}
          </span>
          {meta && (
            <span
                        className={["text-xs px-1.5 py-0.5 rounded border", CATEGORY_COLORS[meta.category] ?? ""].join(" ")}
            >
              {meta.category}
            </span>
          )}
          <span className={["text-xs font-mono", STATUS_COLORS[status] ?? ""].join(" ")}>{status}</span>
          {duration !== null && (
            <span className="text-xs text-muted-foreground">{duration}s</span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-1.5 space-y-1">
            <Progress value={pct} className="h-1" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-400">✓ {succeeded}</span>
              {failed > 0 && <span className="text-red-400">✗ {failed}</span>}
              <span>{processed}/{total} processed</span>
            </div>
          </div>
        )}
        {!!job.errorMessage && (
          <p className="mt-1 text-xs text-red-400 truncate">{String(job.errorMessage ?? "")}</p>
        )}
      </div>
    </div>
  );
}

// ── Pipeline Card Component ───────────────────────────────────────────────────

function PipelineCard({
  schedule,
  onToggle,
  onTrigger,
  isTriggering,
}: {
  schedule: Record<string, unknown>;
  onToggle: (id: number, enabled: boolean) => void;
  onTrigger: (key: string) => void;
  isTriggering: boolean;
}) {
  const key = String(schedule.pipelineKey ?? "");
  const meta = PIPELINE_META[key];
  const enabled = Boolean(schedule.enabled);
  const lastRunAt = schedule.lastRunAt ? new Date(schedule.lastRunAt as string) : null;
  const nextRunAt = schedule.nextRunAt ? new Date(schedule.nextRunAt as string) : null;
  const intervalHours = Number(schedule.intervalHours ?? 24);

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 ${
        enabled
          ? "border-border bg-card hover:border-primary/30"
          : "border-border/40 bg-muted/20 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {meta && (() => { const MetaIcon = meta.icon as React.ComponentType<{ className?: string }>; return (
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <MetaIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          ); })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {meta?.label ?? key}
              </span>
              {meta && (
                <span
                                className={["text-xs px-1.5 py-0.5 rounded border", CATEGORY_COLORS[meta.category] ?? ""].join(" ")}
            >
              {meta.category}
            </span>
          )}
          <span className="text-xs text-muted-foreground">every {intervalHours}h</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {meta?.description ?? ""}
            </p>
            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
              {lastRunAt && (
                <span>Last: {lastRunAt.toLocaleString()}</span>
              )}
              {nextRunAt && enabled && (
                <span className="text-primary/70">Next: {nextRunAt.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onTrigger(key)}
            disabled={isTriggering}
            title="Run now"
          >
            <Play className="w-3 h-3" />
          </Button>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => onToggle(Number(schedule.id), v)}
            title={enabled ? "Disable auto-run" : "Enable auto-run"}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminIntelligenceDashboard() {
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: schedules, refetch: refetchSchedules } = trpc.orchestrator.listSchedules.useQuery();
  const { data: coverageStats, refetch: refetchCoverage } = trpc.orchestrator.getCoverageStats.useQuery();
  const { data: recentJobs, refetch: refetchJobs } = trpc.orchestrator.listJobs.useQuery({ limit: 20 });
  const { data: activeJob } = trpc.orchestrator.getJob.useQuery(
    { jobId: activeJobId! },
    { enabled: pollingEnabled && activeJobId !== null, refetchInterval: 2000 }
  );

  // Stop polling when job completes
  useEffect(() => {
    if (activeJob && ["completed", "failed", "cancelled"].includes(String(activeJob.status))) {
      setPollingEnabled(false);
      refetchJobs();
      refetchCoverage();
    }
  }, [activeJob, refetchJobs, refetchCoverage]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const toggleMutation = trpc.orchestrator.toggleSchedule.useMutation({
    onSuccess: () => refetchSchedules(),
    onError: (err) => toast.error(err.message),
  });

  const triggerMutation = trpc.orchestrator.triggerPipeline.useMutation({
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setPollingEnabled(true);
      refetchJobs();
      toast.success(`Pipeline started — Job #${data.jobId} is running`);
    },
    onError: (err) => toast.error(err.message),
  });

  const runAllMutation = trpc.orchestrator.runAllPipelines.useMutation({
    onSuccess: (data) => {
      setPollingEnabled(true);
      refetchJobs();
      toast.success(`All pipelines started — ${data.triggered} of ${data.total} jobs queued`);
    },
    onError: (err) => toast.error(`Run All failed: ${err.message}`),
  });

  const handleToggle = useCallback(
    (id: number, enabled: boolean) => toggleMutation.mutate({ id, enabled }),
    [toggleMutation]
  );

  const handleTrigger = useCallback(
    (key: string) => triggerMutation.mutate({ pipelineKey: key }),
    [triggerMutation]
  );

  // ── Coverage stats helpers ────────────────────────────────────────────────
  const authors = coverageStats?.authors as Record<string, number> | undefined;
  const books = coverageStats?.books as Record<string, number> | undefined;
  const content = coverageStats?.content as Record<string, number> | undefined;
  const queue = coverageStats?.queue as Record<string, number> | undefined;

  // ── Group schedules by category ───────────────────────────────────────────
  const schedulesByCategory: Record<string, (typeof schedules)> = {};
  (schedules ?? []).forEach((s) => {
    const key = String((s as Record<string, unknown>).pipelineKey ?? "");
    const cat = PIPELINE_META[key]?.category ?? "other";
    if (!schedulesByCategory[cat]) schedulesByCategory[cat] = [] as typeof schedules;
    (schedulesByCategory[cat] as NonNullable<typeof schedules>).push(s);
  });

  const categoryOrder = ["author", "book", "content", "index", "review"];
  const categoryLabels: Record<string, string> = {
    author: "Author Enrichment",
    book: "Book Enrichment",
    content: "Content Intelligence",
    index: "Vector Indexing",
    review: "AI Review",
  };

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Intelligence Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Autonomous enrichment pipelines — the app does the research, not you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => runAllMutation.mutate({ batchSize: 20, concurrency: 2 })}
            disabled={runAllMutation.isPending || triggerMutation.isPending}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            {runAllMutation.isPending ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running All…</>
            ) : (
              <><Zap className="w-3.5 h-3.5" />Run All Pipelines</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchSchedules(); refetchJobs(); refetchCoverage(); }}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Coverage Heatmap ── */}
      {coverageStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Authors */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold">Authors</span>
              <InfoTip text="Coverage metrics for all author profiles. 'Has bio' = any bio text. 'Rich bio' = LLM-generated deep biography. Social stats include YouTube, Twitter, Substack, GitHub follower counts." />
              <Badge variant="outline" className="ml-auto text-xs">
                {authors?.total ?? 0} total
              </Badge>
            </div>
            <div className="space-y-2">
              <CoverageBar label="Has bio" value={authors?.withBio ?? 0} total={authors?.total ?? 0} color="bg-blue-500" />
              <CoverageBar label="Rich bio (LLM)" value={authors?.withRichBio ?? 0} total={authors?.total ?? 0} color="bg-blue-600" />
              <CoverageBar label="Avatar" value={authors?.withAvatar ?? 0} total={authors?.total ?? 0} color="bg-indigo-500" />
              <CoverageBar label="Social stats" value={authors?.withSocialStats ?? 0} total={authors?.total ?? 0} color="bg-violet-500" />
              <CoverageBar label="LinkedIn" value={authors?.withLinkedin ?? 0} total={authors?.total ?? 0} color="bg-sky-500" />
            </div>
          </div>

          {/* Books */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold">Books</span>
              <InfoTip text="Coverage metrics for all book profiles. 'Rich summary' = LLM-generated 500-word analysis. ISBN and Amazon link are sourced from Open Library enrichment." />
              <Badge variant="outline" className="ml-auto text-xs">
                {books?.total ?? 0} total
              </Badge>
            </div>
            <div className="space-y-2">
              <CoverageBar label="Has summary" value={books?.withSummary ?? 0} total={books?.total ?? 0} color="bg-purple-500" />
              <CoverageBar label="Rich summary (LLM)" value={books?.withRichSummary ?? 0} total={books?.total ?? 0} color="bg-purple-600" />
              <CoverageBar label="Cover image" value={books?.withCover ?? 0} total={books?.total ?? 0} color="bg-fuchsia-500" />
              <CoverageBar label="ISBN" value={books?.withIsbn ?? 0} total={books?.total ?? 0} color="bg-pink-500" />
              <CoverageBar label="Amazon link" value={books?.withAmazon ?? 0} total={books?.total ?? 0} color="bg-orange-500" />
            </div>
          </div>

          {/* Content & Queue */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold">Content & Queue</span>
              <InfoTip text="Content items are URLs (YouTube, Spotify, PDFs, articles) linked to authors. Quality score = weighted average of relevance (40%), authority (25%), freshness (15%), depth (20%). Dead links = URLs that returned 4xx/5xx." />
            </div>
            <div className="space-y-2">
              <CoverageBar label="Content items w/ URL" value={content?.withUrl ?? 0} total={content?.total ?? 0} color="bg-amber-500" />
              <CoverageBar label="Quality scored" value={content?.withQualityScore ?? 0} total={content?.total ?? 0} color="bg-amber-600" />
              {(content?.deadLinks ?? 0) > 0 && (
                <CoverageBar label="Dead links" value={content?.deadLinks ?? 0} total={content?.withUrl ?? 0} color="bg-red-500" />
              )}
            </div>
            {(content?.avgQualityScore ?? 0) > 0 && (
              <div className="flex items-center justify-between py-1.5 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Avg Quality Score</span>
                <span className={`text-sm font-bold font-mono ${
                  (content?.avgQualityScore ?? 0) >= 70 ? 'text-emerald-400' :
                  (content?.avgQualityScore ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>{content?.avgQualityScore ?? 0}/100</span>
              </div>
            )}
            {queue && (
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Review Queue</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-mono text-amber-400">{queue.pending ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved</span>
                    <span className="font-mono text-emerald-400">{queue.approved ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chatbot</span>
                    <span className="font-mono text-blue-400">{queue.chatbotCandidates ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duplicates</span>
                    <span className="font-mono text-rose-400">{queue.nearDuplicates ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pipeline Controls ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Pipeline Controls</h3>
          <InfoTip text="Each pipeline runs on a configurable schedule (every 6h–7d). Toggle the switch to enable/disable auto-run. Click ▶ to trigger immediately. Pipelines are idempotent — safe to run multiple times." />
          <span className="text-xs text-muted-foreground ml-1">
            Toggle auto-run schedules or trigger pipelines manually
          </span>
        </div>

        {categoryOrder.map((cat) => {
          const catSchedules = schedulesByCategory[cat];
          if (!catSchedules || catSchedules.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-1">
                {categoryLabels[cat] ?? cat}
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {catSchedules.map((s) => (
                  <PipelineCard
                    key={String((s as Record<string, unknown>).id)}
                    schedule={s as Record<string, unknown>}
                    onToggle={handleToggle}
                    onTrigger={handleTrigger}
                    isTriggering={triggerMutation.isPending}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {(!schedules || schedules.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No pipeline schedules found.</p>
            <p className="text-xs mt-1">They will be seeded automatically on next server restart.</p>
          </div>
        )}
      </div>

      {/* ── Live Job Monitor ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Jobs</h3>
          {activeJob && String(activeJob.status) === "running" && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs animate-pulse">
              Live
            </Badge>
          )}
        </div>

        {/* Active job progress (if any) */}
        {activeJob && String(activeJob.status) === "running" && (
          <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
            <JobRow job={activeJob as Record<string, unknown>} />
          </div>
        )}

        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {(recentJobs ?? []).map((job) => (
            <JobRow key={String((job as Record<string, unknown>).id)} job={job as Record<string, unknown>} />
          ))}
          {(!recentJobs || recentJobs.length === 0) && (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No jobs have run yet.</p>
              <p className="text-xs mt-1 text-muted-foreground">Click <strong>Run All Pipelines</strong> above to start the first autonomous enrichment pass.</p>
              <Button
                size="sm"
                variant="default"
                className="mt-3 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => runAllMutation.mutate({ batchSize: 20, concurrency: 2 })}
                disabled={runAllMutation.isPending}
              >
                {runAllMutation.isPending ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Starting…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" />Run All Pipelines Now</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
