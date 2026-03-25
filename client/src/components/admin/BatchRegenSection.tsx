import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  Play,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export function BatchRegenSection() {
  const utils = trpc.useUtils();
  const { data: progress, isLoading } = trpc.authorProfiles.getBatchRegenProgress.useQuery(
    undefined,
    {
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return false;
        if (d.finishedAt) return false;
        if (d.total > 0 && d.completed < d.total) return 5000;
        return false;
      },
    }
  );

  const triggerMutation = trpc.authorProfiles.triggerBatchRegen.useMutation({
    onSuccess: () => {
      toast.success("Batch regeneration started in background!");
      utils.authorProfiles.getBatchRegenProgress.invalidate();
    },
    onError: (e) => toast.error("Failed to start batch: " + e.message),
  });

  const isRunning = progress && !progress.finishedAt && progress.total > 0;
  const isDone = progress?.finishedAt != null;
  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Batch Avatar Regeneration
        </CardTitle>
        <CardDescription className="text-xs">
          Upgrade all authors to the Tier 5 meticulous pipeline. Runs serially in the background
          (~35s per author). Progress updates every 5 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        {progress && progress.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isRunning && progress.current ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing: <strong>{progress.current}</strong>
                  </span>
                ) : isDone ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Idle
                  </span>
                )}
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {progress.completed}/{progress.total} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                {progress.succeeded} succeeded
              </span>
              {progress.failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  {progress.failed} failed
                </span>
              )}
              {isDone && progress.finishedAt && (
                <span className="flex items-center gap-1 ml-auto">
                  <Clock className="w-3 h-3" />
                  Finished {new Date(progress.finishedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {!progress && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            No batch has been run yet. Click "Regenerate All" to start.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => triggerMutation.mutate({ forceRegenerate: true })}
            disabled={triggerMutation.isPending || !!isRunning}
          >
            {triggerMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            {isRunning ? "Running…" : "Regenerate All"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => utils.authorProfiles.getBatchRegenProgress.invalidate()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
