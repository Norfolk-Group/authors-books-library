/**
 * DigitalMeTab.tsx
 *
 * Admin tab for the Digital Me RAG pipeline:
 * - Status overview table (all authors, RAG status, word count, version)
 * - "Generate All" batch action with progress
 * - Per-author "Generate" / "Regenerate" buttons
 * - Bio completeness scores
 * - Contextual intelligence enrichment controls
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Brain,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Zap,
  FileText,
  BarChart3,
  Play,
} from "lucide-react";

type RagStatus = "pending" | "generating" | "ready" | "stale";

interface RagStatusRow {
  authorName: string;
  ragStatus: RagStatus | null;
  ragVersion: number | null;
  ragGeneratedAt: Date | null;
  ragWordCount: number | null;
  ragModel: string | null;
  contentItemCount: number | null;
  bioCompletenessAtGeneration: number | null;
}

function StatusBadge({ status }: { status: RagStatus | null }) {
  if (!status || status === "pending") {
    return <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
  }
  if (status === "generating") {
    return <Badge className="text-xs gap-1 bg-amber-500 text-white"><Loader2 className="w-3 h-3 animate-spin" />Generating</Badge>;
  }
  if (status === "ready") {
    return <Badge className="text-xs gap-1 bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" />Ready</Badge>;
  }
  if (status === "stale") {
    return <Badge className="text-xs gap-1 bg-orange-500 text-white"><AlertCircle className="w-3 h-3" />Stale</Badge>;
  }
  return null;
}

function BioBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-500";
  return <span className={`text-xs font-medium ${color}`}>{score}%</span>;
}

export function DigitalMeTab() {
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allProgress, setAllProgress] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);

  const { data: allStatuses = [], refetch: refetchStatuses } = trpc.ragPipeline.getAllStatuses.useQuery();
  const { data: completenessScores = [] } = trpc.contextualIntelligence.getCompletenessScores.useQuery();

  const generateMutation = trpc.ragPipeline.generate.useMutation();
  const seedAllMutation = trpc.ragPipeline.seedAllPending.useMutation();
  const [seeding, setSeeding] = useState(false);

  async function handleSeedAll() {
    setSeeding(true);
    try {
      const result = await seedAllMutation.mutateAsync();
      if (result.seeded > 0) {
        toast.success(`Seeded ${result.seeded} authors as pending — click "Generate Pending" to start building`);
      } else {
        toast.info(result.message);
      }
      await refetchStatuses();
    } catch (err) {
      toast.error(`Seed failed: ${String(err)}`);
    } finally {
      setSeeding(false);
    }
  }

  // Build a map of bio completeness by author name
  const completenessMap = new Map(completenessScores.map((s) => [s.authorName, s.bioCompleteness]));

  // Merge RAG statuses with bio completeness
  const rows: RagStatusRow[] = allStatuses.map((r) => ({
    ...r,
    bioCompletenessAtGeneration: r.bioCompletenessAtGeneration ?? completenessMap.get(r.authorName) ?? null,
  }));

  const readyCount = rows.filter((r) => r.ragStatus === "ready").length;
  const staleCount = rows.filter((r) => r.ragStatus === "stale").length;
  const pendingCount = rows.filter((r) => !r.ragStatus || r.ragStatus === "pending").length;

  async function handleGenerateSingle(authorName: string, force = false) {
    setGeneratingSingle(authorName);
    try {
      const result = await generateMutation.mutateAsync({ authorName, force });
      if (result.success) {
        toast.success(`Digital Me Ready — ${authorName}: v${result.ragVersion}, ${result.wordCount?.toLocaleString()} words, ${result.bookCount} books`);
      } else {
        toast.error(`Generation skipped: ${(result as { message?: string }).message ?? ""}`);
      }
      await refetchStatuses();
    } catch (err) {
      toast.error(`Generation failed: ${String(err)}`);
    } finally {
      setGeneratingSingle(null);
    }
  }

  async function handleGenerateAll() {
    // Get all authors that need generation (pending, stale, or no RAG yet)
    const targets = rows.filter((r) => !r.ragStatus || r.ragStatus === "pending" || r.ragStatus === "stale");
    if (targets.length === 0) {
      toast.success("All Digital Me files are up to date");
      return;
    }

    setGeneratingAll(true);
    setAllProgress(0);
    setAllTotal(targets.length);

    let done = 0;
    for (const row of targets) {
      try {
        await generateMutation.mutateAsync({ authorName: row.authorName });
        done++;
        setAllProgress(Math.round((done / targets.length) * 100));
      } catch {
        done++;
        setAllProgress(Math.round((done / targets.length) * 100));
      }
    }

    await refetchStatuses();
    setGeneratingAll(false);
    toast.success(`Batch generation complete — ${done} Digital Me files processed`);
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Authors</p>
                <p className="text-xl font-bold">{rows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Ready</p>
                <p className="text-xl font-bold text-emerald-600">{readyCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Stale / Pending</p>
                <p className="text-xl font-bold text-orange-500">{staleCount + pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Words</p>
                <p className="text-xl font-bold">
                  {rows.filter((r) => r.ragWordCount).length > 0
                    ? Math.round(
                        rows.filter((r) => r.ragWordCount).reduce((s, r) => s + (r.ragWordCount ?? 0), 0) /
                          rows.filter((r) => r.ragWordCount).length
                      ).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch generate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Batch Generate Digital Me Files
          </CardTitle>
          <CardDescription className="text-xs">
            Generates RAG knowledge files for all authors that are pending or stale.
            Uses Claude Opus for synthesis. Each file takes ~30–90 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {generatingAll && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Generating Digital Me files…</span>
                <span>{allProgress}% ({Math.round((allProgress / 100) * allTotal)}/{allTotal})</span>
              </div>
              <Progress value={allProgress} className="h-2" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedAll}
              disabled={seeding || generatingAll}
              className="gap-1.5"
              title="Create pending rows for all authors not yet in the RAG pipeline"
            >
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {seeding ? "Seeding…" : "Seed All Authors"}
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateAll}
              disabled={generatingAll || seeding || (staleCount + pendingCount === 0)}
              className="gap-1.5"
            >
              {generatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {generatingAll ? "Generating…" : `Generate ${staleCount + pendingCount} Pending`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchStatuses()}
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Author status table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Author Digital Me Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium">Author</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Version</th>
                  <th className="text-left px-3 py-2 font-medium">Words</th>
                  <th className="text-left px-3 py-2 font-medium">Books</th>
                  <th className="text-left px-3 py-2 font-medium">Bio %</th>
                  <th className="text-left px-3 py-2 font-medium">Generated</th>
                  <th className="text-left px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.authorName} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium max-w-[160px] truncate">{row.authorName}</td>
                    <td className="px-3 py-2"><StatusBadge status={row.ragStatus} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{row.ragVersion ? `v${row.ragVersion}` : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.ragWordCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.contentItemCount ?? "—"}</td>
                    <td className="px-3 py-2"><BioBadge score={row.bioCompletenessAtGeneration} /></td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.ragGeneratedAt
                        ? new Date(row.ragGeneratedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant={row.ragStatus === "ready" ? "outline" : "default"}
                        className="h-6 text-xs px-2 gap-1"
                        disabled={generatingSingle === row.authorName || generatingAll}
                        onClick={() => handleGenerateSingle(row.authorName, row.ragStatus === "ready")}
                      >
                        {generatingSingle === row.authorName ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : row.ragStatus === "ready" ? (
                          <RefreshCw className="w-3 h-3" />
                        ) : (
                          <Brain className="w-3 h-3" />
                        )}
                        {row.ragStatus === "ready" ? "Regen" : "Generate"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No authors found. Regenerate the database first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
