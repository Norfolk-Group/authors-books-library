/**
 * AdminNeonTab.tsx — Neon pgvector Index management
 *
 * Admin panel for managing the Neon pgvector index.
 * Features:
 *   - Per-type bulk indexing cards (Authors, Books, Content Items, RAG Files)
 *   - "Re-index All" button with real-time per-stage progress bar (polling)
 *   - Index stats (vector counts per namespace)
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Database, RefreshCw, CheckCircle, AlertCircle, Zap,
  Users, BookOpen, Layers, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { InfoTip } from "@/components/admin/InfoTip";

type IndexResult = {
  indexed: number;
  skipped: number;
  totalVectors: number;
  attempted: number;
};

type BulkJobState = {
  running: boolean;
  result: IndexResult | null;
  error: string | null;
};

const initialJob: BulkJobState = { running: false, result: null, error: null };

// ── Stage status badge ────────────────────────────────────────────────────────

function StageBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  if (status === "running")
    return <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Running</Badge>;
  if (status === "done")
    return <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-400">Done</Badge>;
  return <Badge variant="destructive" className="text-xs">Error</Badge>;
}

// ── Re-index All progress panel ───────────────────────────────────────────────

interface ReindexStage {
  name: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  indexed: number;
  skipped: number;
  total: number;
  error?: string;
}

interface ReindexJob {
  jobId: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  stages: ReindexStage[];
}

function stagePercent(stage: ReindexStage): number {
  if (stage.status === "done") return 100;
  if (stage.status === "pending") return 0;
  if (stage.total === 0) return 5; // running but total not known yet
  return Math.round(((stage.indexed + stage.skipped) / stage.total) * 100);
}

function stageIcon(name: string) {
  if (name === "authors") return <Users className="h-4 w-4 text-blue-500" />;
  if (name === "books") return <BookOpen className="h-4 w-4 text-emerald-500" />;
  if (name === "content_items") return <Layers className="h-4 w-4 text-purple-500" />;
  return <FileText className="h-4 w-4 text-amber-500" />;
}

function ReindexProgressPanel({
  jobId,
  onDone,
}: {
  jobId: string;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [job, setJob] = useState<ReindexJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await utils.vectorSearch.getReindexProgress.fetch({ jobId });
        if (data) {
          setJob(data as ReindexJob);
          if (data.status !== "running") {
            if (pollRef.current) clearInterval(pollRef.current);
            onDone();
          }
        }
      } catch {
        // ignore transient errors
      }
    };

    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Starting re-index job…
      </div>
    );
  }

  const totalIndexed = job.stages.reduce((s, st) => s + st.indexed, 0);
  const totalSkipped = job.stages.reduce((s, st) => s + st.skipped, 0);
  const elapsed = job.finishedAt
    ? ((job.finishedAt - job.startedAt) / 1000).toFixed(1)
    : ((Date.now() - job.startedAt) / 1000).toFixed(0);

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          {job.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
          {job.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-500" />}
          {job.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
          {job.status === "running" ? "Re-indexing…" : job.status === "done" ? "Re-index complete" : "Re-index finished with errors"}
        </span>
        <span className="text-muted-foreground text-xs">{elapsed}s elapsed</span>
      </div>

      {/* Per-stage rows */}
      {job.stages.map((stage) => (
        <div key={stage.name} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              {stageIcon(stage.name)}
              {stage.label}
            </span>
            <div className="flex items-center gap-2">
              <StageBadge status={stage.status} />
              {stage.total > 0 && (
                <span className="text-muted-foreground">
                  {stage.indexed + stage.skipped}/{stage.total}
                </span>
              )}
            </div>
          </div>
          <Progress value={stagePercent(stage)} className="h-1.5" />
          {stage.status !== "pending" && (
            <p className="text-xs text-muted-foreground">
              {stage.indexed} indexed · {stage.skipped} skipped
              {stage.error && <span className="text-destructive ml-2">{stage.error}</span>}
            </p>
          )}
        </div>
      ))}

      {/* Summary */}
      {job.status !== "running" && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Total: <strong>{totalIndexed}</strong> indexed · <strong>{totalSkipped}</strong> skipped
          {job.status === "done" && <span className="text-emerald-600 ml-2">✓ All stages complete</span>}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminNeonTab() {
  // Stats
  const statsQuery = trpc.vectorSearch.getStats.useQuery(undefined, {
    staleTime: 15_000,
    retry: 1,
  });

  // Ensure index
  const ensureIndexMutation = trpc.vectorSearch.ensureIndex.useMutation({
    onSuccess: () => {
      toast.success("Index ready — vector_embeddings table confirmed.");
      statsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Per-type job state
  const [authorJob, setAuthorJob] = useState<BulkJobState>(initialJob);
  const [bookJob, setBookJob] = useState<BulkJobState>(initialJob);
  const [contentJob, setContentJob] = useState<BulkJobState>(initialJob);
  const [ragJob, setRagJob] = useState<BulkJobState>(initialJob);

  // Re-index All state
  const [reindexJobId, setReindexJobId] = useState<string | null>(null);
  const [reindexRunning, setReindexRunning] = useState(false);

  const indexAllAuthorsMutation = trpc.vectorSearch.indexAllAuthors.useMutation({
    onSuccess: (data) => {
      setAuthorJob({ running: false, result: data, error: null });
      statsQuery.refetch();
      toast.success(`Authors indexed: ${data.indexed} → ${data.totalVectors} vectors`);
    },
    onError: (e) => {
      setAuthorJob({ running: false, result: null, error: e.message });
      toast.error(`Error indexing authors: ${e.message}`);
    },
  });

  const indexAllBooksMutation = trpc.vectorSearch.indexAllBooks.useMutation({
    onSuccess: (data) => {
      setBookJob({ running: false, result: data, error: null });
      statsQuery.refetch();
      toast.success(`Books indexed: ${data.indexed} → ${data.totalVectors} vectors`);
    },
    onError: (e) => {
      setBookJob({ running: false, result: null, error: e.message });
      toast.error(`Error indexing books: ${e.message}`);
    },
  });

  const indexAllContentItemsMutation = trpc.vectorSearch.indexAllContentItems.useMutation({
    onSuccess: (data) => {
      setContentJob({ running: false, result: data, error: null });
      statsQuery.refetch();
      toast.success(`Content items indexed: ${data.indexed} → ${data.totalVectors} vectors`);
    },
    onError: (e) => {
      setContentJob({ running: false, result: null, error: e.message });
      toast.error(`Error indexing content items: ${e.message}`);
    },
  });

  const indexAllRagFilesMutation = trpc.vectorSearch.indexAllRagFiles.useMutation({
    onSuccess: (data) => {
      setRagJob({ running: false, result: data, error: null });
      statsQuery.refetch();
      toast.success(`RAG files indexed: ${data.indexed} → ${data.totalVectors} vectors`);
    },
    onError: (e) => {
      setRagJob({ running: false, result: null, error: e.message });
      toast.error(`Error indexing RAG files: ${e.message}`);
    },
  });

  const startReindexMutation = trpc.vectorSearch.startReindex.useMutation({
    onSuccess: (data) => {
      setReindexJobId(data.jobId);
    },
    onError: (e) => {
      setReindexRunning(false);
      toast.error(`Failed to start re-index: ${e.message}`);
    },
  });

  const stats = statsQuery.data;
  const namespaces = stats?.namespaces ?? {};

  const nsCount = (ns: string): number => {
    const entry = namespaces[ns];
    if (!entry) return 0;
    return (entry as { recordCount?: number }).recordCount ?? 0;
  };

  const totalVectors = stats?.totalVectors ?? 0;

  const namespaceRows = [
    { ns: "authors",       label: "Authors",          color: "bg-blue-500" },
    { ns: "books",         label: "Books",             color: "bg-emerald-500" },
    { ns: "content_items", label: "Content Items",     color: "bg-purple-500" },
    { ns: "rag_files",     label: "RAG Files",         color: "bg-amber-500" },
    { ns: "articles",      label: "Magazine Articles", color: "bg-rose-500" },
  ];

  const anyJobRunning =
    authorJob.running || bookJob.running || contentJob.running || ragJob.running || reindexRunning;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Neon pgvector Index</h2>
            <InfoTip
              text="Neon pgvector is the vector database powering all semantic search, chatbot RAG, and 'Similar Authors/Books' features. Vectors are 1536-dimensional Gemini embeddings stored in the vector_embeddings table."
              side="right"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the <code className="text-xs bg-muted px-1 rounded">vector_embeddings</code> index — embed and upsert content for semantic search.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => statsQuery.refetch()}
            disabled={statsQuery.isFetching}
          >
            {statsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ensureIndexMutation.mutate()}
            disabled={ensureIndexMutation.isPending}
          >
            {ensureIndexMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            <span className="ml-1">Ensure Index</span>
          </Button>
        </div>
      </div>

      {/* Index Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Index Statistics
            <InfoTip text="Vector counts per namespace. Authors powers 'Similar Authors'. Books powers 'Readers Also Liked'. RAG files powers the author chatbot. Content items powers cross-content discovery." />
          </CardTitle>
          <CardDescription>
            Total vectors: <strong>{totalVectors.toLocaleString()}</strong>
            {statsQuery.isError && (
              <span className="text-destructive ml-2">— index may not exist yet (click Ensure Index)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats…
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {namespaceRows.map(({ ns, label, color }) => (
                <div key={ns} className="flex flex-col items-center p-3 rounded-lg border bg-card gap-1">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-lg font-bold">{nsCount(ns).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">vectors</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Re-index All — primary CTA */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Re-index All Content
            <InfoTip text="Runs Authors then Books sequentially with live progress. Each record is embedded using Gemini gemini-embedding-001 (1536 dims) and upserted to Neon. Idempotent — safe to run multiple times." />
          </CardTitle>
          <CardDescription>
            Re-embed and upsert all authors and books in one click. Progress updates every 2 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress panel — shown while job is active */}
          {reindexJobId && (
            <ReindexProgressPanel
              jobId={reindexJobId}
              onDone={() => {
                setReindexRunning(false);
                statsQuery.refetch();
                toast.success("Re-index complete — all stages finished.");
              }}
            />
          )}

          {/* Launch button */}
          {!reindexRunning ? (
            <Button
              onClick={() => {
                setReindexRunning(true);
                setReindexJobId(null);
                startReindexMutation.mutate();
              }}
              disabled={anyJobRunning}
              className="w-full sm:w-auto"
            >
              <Zap className="h-4 w-4 mr-2" />
              {reindexJobId ? "Re-run Re-index All" : "Start Re-index All"}
            </Button>
          ) : (
            <Button disabled className="w-full sm:w-auto">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Re-indexing in progress…
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Per-type bulk indexing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BulkIndexCard
          title="Index All Authors"
          description="Embed bio text for all author profiles. Uses richBioJson when available."
          namespace="authors"
          job={authorJob}
          onRun={() => {
            setAuthorJob({ running: true, result: null, error: null });
            indexAllAuthorsMutation.mutate({ limit: 200, onlyMissing: false });
          }}
        />
        <BulkIndexCard
          title="Index All Books"
          description="Embed summary text for all book profiles. Uses richSummaryJson.fullSummary when available."
          namespace="books"
          job={bookJob}
          onRun={() => {
            setBookJob({ running: true, result: null, error: null });
            indexAllBooksMutation.mutate({ limit: 200 });
          }}
        />
        <BulkIndexCard
          title="Index All Content Items"
          description="Embed descriptions for all content items (podcasts, videos, newsletters, etc.)."
          namespace="content_items"
          job={contentJob}
          onRun={() => {
            setContentJob({ running: true, result: null, error: null });
            indexAllContentItemsMutation.mutate({ limit: 500 });
          }}
        />
        <BulkIndexCard
          title="Index All RAG Files"
          description="Embed full author RAG knowledge documents from S3."
          namespace="rag_files"
          job={ragJob}
          onRun={() => {
            setRagJob({ running: true, result: null, error: null });
            indexAllRagFilesMutation.mutate({ limit: 50 });
          }}
        />
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground">
        Indexing uses Gemini <code>gemini-embedding-001</code> (1536-dim, cosine similarity). Each run is idempotent — re-indexing the same content overwrites existing vectors with the same ID.
      </p>
    </div>
  );
}

// ── BulkIndexCard ─────────────────────────────────────────────────────────────

function BulkIndexCard({
  title,
  description,
  namespace,
  job,
  onRun,
}: {
  title: string;
  description: string;
  namespace: string;
  job: BulkJobState;
  onRun: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {job.running && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Embedding and upserting to <code className="text-xs">{namespace}</code>…
          </div>
        )}
        {job.result && !job.running && (
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">Done</p>
              <p className="text-muted-foreground text-xs">
                {job.result.indexed} indexed · {job.result.skipped} skipped · {job.result.totalVectors} vectors upserted
              </p>
            </div>
          </div>
        )}
        {job.error && !job.running && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-destructive text-xs">{job.error}</p>
          </div>
        )}
        <Button
          size="sm"
          variant={job.result ? "outline" : "default"}
          onClick={onRun}
          disabled={job.running}
          className="w-full"
        >
          {job.running ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" />Running…</>
          ) : job.result ? (
            "Re-index"
          ) : (
            "Run Now"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
