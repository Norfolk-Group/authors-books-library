/**
 * SchedulingTab — Admin Console tab for enrichment pipeline scheduling.
 *
 * Shows all configured pipelines with:
 *   - Current schedule (interval, enabled/disabled)
 *   - Last run status (success/partial/failed)
 *   - Next scheduled run
 *   - Manual trigger button
 *   - Recent job history
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Zap,
  BookOpen,
  Users,
  BarChart2,
  Link2,
  FileText,
} from "lucide-react";

// ── Default pipeline definitions (seeded if DB is empty) ──────────────────────
const PIPELINE_DEFAULTS = [
  {
    pipelineKey: "enrich-author-bios",
    label: "Enrich Author Bios",
    entityType: "author" as const,
    intervalHours: 720,
    icon: Users,
    description: "Wikipedia + LLM bio enrichment for all authors",
  },
  {
    pipelineKey: "enrich-social-stats",
    label: "Enrich Social Stats",
    entityType: "author" as const,
    intervalHours: 168,
    icon: BarChart2,
    description: "GitHub, Substack, Wikipedia, LinkedIn stats",
  },
  {
    pipelineKey: "discover-platforms",
    label: "Discover Author Platforms",
    entityType: "author" as const,
    intervalHours: 720,
    icon: Link2,
    description: "Perplexity-powered platform URL discovery",
  },
  {
    pipelineKey: "enrich-rich-bios",
    label: "Enrich Rich Bios",
    entityType: "author" as const,
    intervalHours: 2160,
    icon: FileText,
    description: "Double-pass LLM rich bio generation",
  },
  {
    pipelineKey: "enrich-book-summaries",
    label: "Enrich Book Summaries",
    entityType: "book" as const,
    intervalHours: 720,
    icon: BookOpen,
    description: "Google Books + LLM book summary enrichment",
  },
  {
    pipelineKey: "enrich-rich-summaries",
    label: "Enrich Rich Summaries",
    entityType: "book" as const,
    intervalHours: 2160,
    icon: BookOpen,
    description: "Double-pass LLM rich summary generation",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatInterval(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return `${Math.floor(diffD / 7)}w ago`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline" className="text-[10px] text-muted-foreground">No runs yet</Badge>;
  const map: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
    success: { label: "Success", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", Icon: CheckCircle2 },
    partial: { label: "Partial", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", Icon: AlertCircle },
    failed: { label: "Failed", className: "bg-red-500/10 text-red-600 border-red-500/20", Icon: XCircle },
  };
  const cfg = map[status] ?? map.partial;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SchedulingTab() {
  const [triggering, setTriggering] = useState<string | null>(null);

  const { data: schedules, refetch } = trpc.scheduling.listSchedules.useQuery(undefined, {
    staleTime: 30_000,
  });
  const { data: recentJobs } = trpc.scheduling.listRecentJobs.useQuery(
    { limit: 20 },
    { staleTime: 30_000 }
  );

  const triggerMutation = trpc.scheduling.triggerPipeline.useMutation({
    onSuccess: (result) => {
      toast.success(`Pipeline triggered: ${result.message}`);
      refetch();
    },
    onError: (e) => toast.error(`Failed to trigger: ${e.message}`),
    onSettled: () => setTriggering(null),
  });

  const toggleMutation = trpc.scheduling.toggleSchedule.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(`Failed to toggle: ${e.message}`),
  });

  // Merge DB schedules with defaults for display
  const scheduleMap = new Map((schedules ?? []).map((s) => [s.pipelineKey, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Enrichment Pipelines</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automatic enrichment schedules and trigger manual runs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      {/* Pipeline cards */}
      <div className="grid gap-3">
        {PIPELINE_DEFAULTS.map((def) => {
          const schedule = scheduleMap.get(def.pipelineKey);
          const Icon = def.icon;
          const isEnabled = schedule?.enabled === 1;
          const isTriggeringThis = triggering === def.pipelineKey;

          return (
            <Card key={def.pipelineKey} className="border-border/60">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{def.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {def.entityType}
                      </Badge>
                      {schedule && (
                        <StatusBadge status={schedule.lastRunStatus} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Every {formatInterval(schedule?.intervalHours ?? def.intervalHours)}
                      </span>
                      {schedule?.lastRunAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Last: {formatRelative(schedule.lastRunAt)}
                          {schedule.lastRunItemCount != null && ` (${schedule.lastRunItemCount} items)`}
                        </span>
                      )}
                      {schedule?.nextRunAt && isEnabled && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Next: {formatRelative(schedule.nextRunAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Enable/disable toggle */}
                    <button
                      onClick={() => toggleMutation.mutate({ pipelineKey: def.pipelineKey, enabled: !isEnabled })}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        isEnabled
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                      title={isEnabled ? "Disable schedule" : "Enable schedule"}
                    >
                      {isEnabled ? "Enabled" : "Disabled"}
                    </button>
                    {/* Manual trigger */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-7 px-2"
                      disabled={isTriggeringThis}
                      onClick={() => {
                        setTriggering(def.pipelineKey);
                        triggerMutation.mutate({ pipelineKey: def.pipelineKey });
                      }}
                    >
                      {isTriggeringThis ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Run
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent job history */}
      {recentJobs && recentJobs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Recent Job History
          </h4>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pipeline</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Progress</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Triggered</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Started</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{job.pipelineKey}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={job.status === "completed" ? "success" : job.status === "failed" ? "failed" : "partial"} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {job.processedItems}/{job.totalItems}
                      {job.failedItems > 0 && <span className="text-red-500 ml-1">({job.failedItems} failed)</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{job.triggeredBy}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatRelative(job.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!recentJobs || recentJobs.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No job history yet.</p>
          <p className="text-xs mt-1">Trigger a pipeline manually to see results here.</p>
        </div>
      )}
    </div>
  );
}
