/**
 * BookMigrationPanel — Admin panel for migrating book_profiles rows into content_items.
 *
 * The migration is idempotent (skips books already in content_items by title).
 * Supports:
 *   - Dry-run mode to preview counts without writing
 *   - Batch-by-batch execution with progress tracking
 *   - Resume from last offset on partial runs
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Play,
  Eye,
  CheckCircle,
  XCircle,
  SkipForward,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  total: number;
  done: boolean;
}

export function BookMigrationPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [_offset, setOffset] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const migrateMutation = trpc.contentItems.migrateFromBookProfiles.useMutation();
  const utils = trpc.useUtils();

  const BATCH_SIZE = 50;

  // Aggregate totals from all batch results
  const totals = results.reduce(
    (acc, r) => ({
      migrated: acc.migrated + r.migrated,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
      total: r.total, // Use latest total
    }),
    { migrated: 0, skipped: 0, failed: 0, total: 0 }
  );

  const processed = totals.migrated + totals.skipped + totals.failed;
  const progressPct = totals.total > 0 ? Math.round((processed / totals.total) * 100) : 0;

  async function runDryRun() {
    setIsDryRunning(true);
    try {
      // Run dry-run on first batch to get total count
      const result = await migrateMutation.mutateAsync({
        dryRun: true,
        batchSize: 200,
        offset: 0,
      });
      toast.info(
        `Dry run: ${result.total} books in library — ~${result.migrated} would be migrated, ~${result.skipped} already exist`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dry run failed");
    } finally {
      setIsDryRunning(false);
    }
  }

  async function runMigration() {
    setIsRunning(true);
    setResults([]);
    setOffset(0);
    setIsDone(false);

    let currentOffset = 0;
    let done = false;

    while (!done) {
      try {
        const result = await migrateMutation.mutateAsync({
          dryRun: false,
          batchSize: BATCH_SIZE,
          offset: currentOffset,
        });

        setResults((prev) => [...prev, result]);
        setOffset(currentOffset + BATCH_SIZE);
        currentOffset += BATCH_SIZE;
        done = result.done;

        if (result.done) {
          setIsDone(true);
          await utils.contentItems.list.invalidate();
          await utils.contentItems.getGroupCounts.invalidate();
          toast.success(
            `Migration complete! Migrated ${result.migrated + (results.reduce((a, r) => a + r.migrated, 0))} books.`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Migration batch failed";
        toast.error(msg);
        done = true;
      }
    }

    setIsRunning(false);
  }

  function reset() {
    setResults([]);
    setOffset(0);
    setIsDone(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-primary" />
          Migrate Books to Content Items
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Copy all <code className="text-xs bg-muted px-1 py-0.5 rounded">book_profiles</code> rows
          into the universal <code className="text-xs bg-muted px-1 py-0.5 rounded">content_items</code> table.
          Idempotent — books already present are skipped. Author links are created automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={runDryRun}
            disabled={isRunning || isDryRunning}
          >
            {isDryRunning ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5 mr-1.5" />
            )}
            Dry Run
          </Button>

          <Button
            size="sm"
            onClick={runMigration}
            disabled={isRunning || isDryRunning}
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            {isRunning ? "Migrating…" : "Run Migration"}
          </Button>

          {(results.length > 0 || isDone) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={reset}
              disabled={isRunning}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          )}
        </div>

        {/* Progress bar */}
        {(isRunning || isDone) && totals.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress: {processed} / {totals.total} books</span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        )}

        {/* Running stats */}
        {results.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-300">
                <CheckCircle className="w-3 h-3" />
                {totals.migrated} migrated
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                <SkipForward className="w-3 h-3" />
                {totals.skipped} skipped (already exist)
              </Badge>
              {totals.failed > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <XCircle className="w-3 h-3" />
                  {totals.failed} failed
                </Badge>
              )}
            </div>

            {/* Batch log */}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono text-[10px] bg-muted px-1 rounded">
                    Batch {i + 1} (offset {i * BATCH_SIZE})
                  </span>
                  <span className="text-green-600">+{r.migrated}</span>
                  <span>skipped {r.skipped}</span>
                  {r.failed > 0 && <span className="text-destructive">failed {r.failed}</span>}
                  {r.done && <Badge variant="outline" className="text-[10px] py-0">done</Badge>}
                </div>
              ))}
            </div>

            {isDone && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Migration complete — {totals.migrated} books added to Content Items.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
