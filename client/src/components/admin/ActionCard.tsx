/**
 * ActionCard - Reusable card for admin pipeline operations.
 * Shows title, description, run button, progress bar, and last-run metadata.
 */
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
import { Loader2, CheckCircle2, AlertCircle, Clock, type LucideIcon } from "lucide-react";
import { type ActionStatus, type ActionState, type LastRunInfo, formatTimeAgo } from "./adminTypes";

function StatusIcon({ status }: { status: ActionStatus }) {
  switch (status) {
    case "running": return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case "done": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
    default: return null;
  }
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  actionKey: string;
  state: ActionState;
  lastRun?: LastRunInfo | null;
  destructive?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onRun: () => void;
  buttonLabel?: string;
  disabled?: boolean;
}

export function ActionCard({
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
        <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Running...</>
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
                    {confirmDescription ?? `This will execute "${title}". This operation may take a while and cannot be interrupted once started.`}
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
        {isRunning && (
          <div className="space-y-1.5 mb-2">
            <Progress value={state.progress} className="h-1.5" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="truncate max-w-[200px]">{state.message || "Processing..."}</span>
              <span className="flex-shrink-0 ml-2">{state.progress}%</span>
            </div>
          </div>
        )}
        {state.status === "done" && state.done > 0 && (
          <p className="text-xs text-green-600 mb-2">
            Completed: {state.done} processed{state.failed > 0 ? `, ${state.failed} failed` : ""}
          </p>
        )}
        {state.status === "error" && state.message && (
          <p className="text-xs text-red-500 mb-2">{state.message}</p>
        )}
        {lastRun?.lastRunAt && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Last run: {formatTimeAgo(lastRun.lastRunAt)}</span>
            {lastRun.lastRunResult && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{lastRun.lastRunResult}</Badge>
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
