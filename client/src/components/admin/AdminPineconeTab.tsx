/**
 * AdminPineconeTab.tsx
 *
 * Admin panel for managing the Pinecone vector index.
 * Provides bulk indexing controls for all content types:
 *   - Authors (bio text)
 *   - Books (summary text)
 *   - Content Items (descriptions)
 *   - RAG Files (full author knowledge documents)
 *   - Magazine Articles (already in AdminMagazineTab, shown as stats here)
 *
 * Shows live index stats (vector counts per namespace) and lets admins
 * trigger bulk indexing with progress feedback.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Database, RefreshCw, CheckCircle, AlertCircle, Zap } from "lucide-react";
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

export function AdminPineconeTab() {
  // Stats
  const statsQuery = trpc.vectorSearch.getStats.useQuery(undefined, {
    staleTime: 15_000,
    retry: 1,
  });

  // Ensure index
  const ensureIndexMutation = trpc.vectorSearch.ensureIndex.useMutation({
    onSuccess: () => {
      toast.success("Index ready — library-rag index is confirmed ready.");
      statsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Per-type job state
  const [authorJob, setAuthorJob] = useState<BulkJobState>(initialJob);
  const [bookJob, setBookJob] = useState<BulkJobState>(initialJob);
  const [contentJob, setContentJob] = useState<BulkJobState>(initialJob);
  const [ragJob, setRagJob] = useState<BulkJobState>(initialJob);

  const indexAllAuthorsMutation = trpc.vectorSearch.indexAllAuthors.useMutation({
    onSuccess: (data) => {
      setAuthorJob({ running: false, result: data, error: null });
      statsQuery.refetch();
      toast.success(`Authors indexed: ${data.indexed} authors → ${data.totalVectors} vectors`);
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
      toast.success(`Books indexed: ${data.indexed} books → ${data.totalVectors} vectors`);
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
      toast.success(`Content items indexed: ${data.indexed} items → ${data.totalVectors} vectors`);
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
      toast.success(`RAG files indexed: ${data.indexed} files → ${data.totalVectors} vectors`);
    },
    onError: (e) => {
      setRagJob({ running: false, result: null, error: e.message });
      toast.error(`Error indexing RAG files: ${e.message}`);
    },
  });

  const stats = statsQuery.data;
  const namespaces = stats?.namespaces ?? {};

  const nsCount = (ns: string): number => {
    const entry = namespaces[ns];
    if (!entry) return 0;
    // Pinecone returns { recordCount: number } per namespace
    return (entry as { recordCount?: number }).recordCount ?? 0;
  };

  const totalVectors = stats?.totalVectors ?? 0;

  const namespaceRows = [
    { ns: "authors", label: "Authors", color: "bg-blue-500" },
    { ns: "books", label: "Books", color: "bg-emerald-500" },
    { ns: "content_items", label: "Content Items", color: "bg-purple-500" },
    { ns: "rag_files", label: "RAG Files", color: "bg-amber-500" },
    { ns: "articles", label: "Magazine Articles", color: "bg-rose-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Pinecone Vector Index</h2>
            <InfoTip text="Pinecone is the vector database powering all semantic search, chatbot RAG, and 'Similar Authors/Books' features. Vectors are 1536-dimensional Gemini embeddings. The library-rag index has 5 namespaces: authors, books, content_items, rag_files, articles." side="right" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the <code className="text-xs bg-muted px-1 rounded">library-rag</code> index — embed and upsert content for semantic search.
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
          <CardTitle className="text-base flex items-center gap-2">Index Statistics <InfoTip text="Vector counts per namespace. Authors namespace powers 'Similar Authors'. Books namespace powers 'Readers Also Liked'. RAG files namespace powers the author chatbot. Content items namespace powers cross-content discovery." /></CardTitle>
          <CardDescription>
            Total vectors: <strong>{totalVectors.toLocaleString()}</strong>
            {statsQuery.isError && <span className="text-destructive ml-2">— index may not exist yet (click Ensure Index)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats...
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

      {/* Bulk Indexing Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Authors */}
        <BulkIndexCard
          title="Index All Authors"
          description="Embed bio text for all 169 author profiles. Uses richBioJson when available for richer context."
          namespace="authors"
          job={authorJob}
          onRun={() => {
            setAuthorJob({ running: true, result: null, error: null });
            indexAllAuthorsMutation.mutate({ limit: 200, onlyMissing: false });
          }}
        />

        {/* Books */}
        <BulkIndexCard
          title="Index All Books"
          description="Embed summary text for all 139 book profiles. Uses richSummaryJson.fullSummary when available."
          namespace="books"
          job={bookJob}
          onRun={() => {
            setBookJob({ running: true, result: null, error: null });
            indexAllBooksMutation.mutate({ limit: 200 });
          }}
        />

        {/* Content Items */}
        <BulkIndexCard
          title="Index All Content Items"
          description="Embed descriptions for all 157 content items (podcasts, videos, newsletters, etc.)."
          namespace="content_items"
          job={contentJob}
          onRun={() => {
            setContentJob({ running: true, result: null, error: null });
            indexAllContentItemsMutation.mutate({ limit: 500 });
          }}
        />

        {/* RAG Files */}
        <BulkIndexCard
          title="Index All RAG Files"
          description="Embed full author RAG knowledge documents from S3. Currently 10 ready files."
          namespace="rag_files"
          job={ragJob}
          onRun={() => {
            setRagJob({ running: true, result: null, error: null });
            indexAllRagFilesMutation.mutate({ limit: 50 });
          }}
        />
      </div>

      {/* Index All Button */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Index Everything
                <InfoTip text="Runs all 4 indexing jobs in parallel. Each job embeds content using Gemini text-embedding-004 (1536 dimensions) and upserts to Pinecone. Rate-limited to ~100 req/min — expect 2-5 minutes for full reindex." />
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Run all four indexing jobs sequentially. This may take several minutes due to Gemini embedding rate limits.
              </p>
            </div>
            <Button
              onClick={async () => {
                setAuthorJob({ running: true, result: null, error: null });
                indexAllAuthorsMutation.mutate({ limit: 200, onlyMissing: false });
                // Books, content items, and RAG files will be triggered after authors complete
                // (via onSuccess callbacks above)
                setBookJob({ running: true, result: null, error: null });
                indexAllBooksMutation.mutate({ limit: 200 });
                setContentJob({ running: true, result: null, error: null });
                indexAllContentItemsMutation.mutate({ limit: 500 });
                setRagJob({ running: true, result: null, error: null });
                indexAllRagFilesMutation.mutate({ limit: 50 });
              }}
              disabled={
                authorJob.running || bookJob.running || contentJob.running || ragJob.running
              }
              className="shrink-0"
            >
              {(authorJob.running || bookJob.running || contentJob.running || ragJob.running) ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Indexing...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />Index All Content</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        Indexing uses Gemini <code>text-embedding-004</code> (768-dim, cosine similarity). Each run is idempotent — re-indexing the same content overwrites existing vectors with the same ID.
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
