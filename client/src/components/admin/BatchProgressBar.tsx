/**
 * BatchProgressBar — Real-time progress indicator for batch operations
 *
 * Shows a progress bar with current item name, percentage, and success/failure counts.
 * Connects to the SSE stream via useBatchProgress hook.
 *
 * Usage:
 *   <BatchProgressBar jobId={activeJobId} onComplete={() => setActiveJobId(null)} />
 */

import { useBatchProgress } from "@/hooks/useBatchProgress";
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff } from "lucide-react";
import { useEffect } from "react";

interface BatchProgressBarProps {
  jobId: string | null;
  onComplete?: (summary: { succeeded: number; failed: number }) => void;
}

export function BatchProgressBar({ jobId, onComplete }: BatchProgressBarProps) {
  const { progress, currentItem, isConnected, isComplete, summary, latestEvent } =
    useBatchProgress(jobId);

  useEffect(() => {
    if (isComplete && summary && onComplete) {
      onComplete(summary);
    }
  }, [isComplete, summary, onComplete]);

  if (!jobId) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {isComplete ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          )}
          <span className="font-medium">
            {isComplete ? "Batch Complete" : "Processing..."}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>

      {/* Current item + stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate max-w-[60%]">
          {currentItem ? `Processing: ${currentItem}` : isComplete ? "Done" : "Starting..."}
        </span>
        {latestEvent && (
          <div className="flex items-center gap-2">
            {latestEvent.current !== undefined && latestEvent.total !== undefined && (
              <span>
                {latestEvent.current}/{latestEvent.total}
              </span>
            )}
            {summary && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {summary.succeeded}
                </span>
                {summary.failed > 0 && (
                  <span className="flex items-center gap-0.5 text-red-500">
                    <XCircle className="w-3 h-3" />
                    {summary.failed}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
