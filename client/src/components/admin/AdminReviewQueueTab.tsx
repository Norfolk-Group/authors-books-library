/**
 * AdminReviewQueueTab.tsx
 *
 * AI Review Queue — the human-in-the-loop interface for the AI pipeline.
 *
 * The AI pipeline automatically flags items that need human judgment:
 *   - Chatbot Candidates: authors with sufficient RAG content to enable chatbot
 *   - Near Duplicates: semantically similar books or authors (Pinecone > 0.92)
 *   - RAG Readiness: computed scores for all authors
 *
 * Admins can:
 *   - Approve / Reject / Skip individual items
 *   - Bulk approve/reject selected items
 *   - Trigger AI scans to populate the queue
 *   - View the full RAG readiness leaderboard
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Brain,
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  Users,
  BookOpen,
  Zap,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Play,
  BarChart3,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReviewItem = {
  id: number;
  reviewType: string;
  status: string;
  entityName: string;
  entityType: string;
  secondaryEntityName: string | null;
  secondaryEntityType: string | null;
  aiConfidence: string | null;
  aiReason: string | null;
  aiSuggestedAction: string | null;
  metadataJson: string | null;
  adminNotes: string | null;
  reviewedAt: Date | null;
  priority: number;
  createdAt: Date;
};


// ── Helpers ────────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const pct = Math.round(parseFloat(confidence) * 100);
  const color = pct >= 90 ? "bg-emerald-600" : pct >= 70 ? "bg-amber-500" : "bg-slate-500";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${color}`}>
      {pct}% confidence
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const labels: Record<number, { label: string; color: string }> = {
    1: { label: "Critical", color: "bg-red-600 text-white" },
    2: { label: "High", color: "bg-orange-500 text-white" },
    3: { label: "Medium", color: "bg-amber-500 text-white" },
    4: { label: "Low", color: "bg-slate-400 text-white" },
    5: { label: "Minimal", color: "bg-slate-300 text-slate-700" },
  };
  const { label, color } = labels[priority] ?? labels[3];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

// ── Review Item Card ───────────────────────────────────────────────────────────

function ReviewItemCard({ item, onAction }: {
  item: ReviewItem;
  onAction: (id: number, status: "approved" | "rejected" | "skipped", notes?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(item.adminNotes ?? "");
  const [acting, setActing] = useState(false);

  const metadata = useMemo(() => {
    try { return item.metadataJson ? JSON.parse(item.metadataJson) : null; }
    catch { return null; }
  }, [item.metadataJson]);

  const handleAction = async (status: "approved" | "rejected" | "skipped") => {
    setActing(true);
    try {
      await onAction(item.id, status, notes || undefined);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card/50 hover:bg-card transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{item.entityName}</span>
            {item.secondaryEntityName && (
              <>
                <span className="text-muted-foreground text-xs">↔</span>
                <span className="font-medium text-sm text-muted-foreground truncate">{item.secondaryEntityName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PriorityBadge priority={item.priority} />
            <ConfidenceBadge confidence={item.aiConfidence} />
            <span className="text-xs text-muted-foreground capitalize">{item.entityType}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* AI reason */}
      {item.aiReason && (
        <p className="text-xs text-muted-foreground leading-relaxed">{item.aiReason}</p>
      )}

      {/* AI suggested action */}
      {item.aiSuggestedAction && (
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          <Brain className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary font-medium">{item.aiSuggestedAction}</p>
        </div>
      )}

      {/* Expanded metadata */}
      {expanded && metadata && (
        <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1.5">
          {item.reviewType === "chatbot_candidate" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RAG Readiness Score</span>
                <span className="font-mono font-semibold">{metadata.ragReadinessScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Books</span>
                <span className="font-mono">{metadata.bookCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Content Items</span>
                <span className="font-mono">{metadata.contentItemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bio Words</span>
                <span className="font-mono">{metadata.bioWordCount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bio Completeness</span>
                <span className="font-mono">{metadata.bioCompleteness}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RAG Status</span>
                <span className="font-mono capitalize">{metadata.ragStatus ?? "pending"}</span>
              </div>
            </>
          )}
          {item.reviewType === "near_duplicate" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Similarity Score</span>
                <span className="font-mono font-semibold">{(metadata.similarityScore * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Namespace</span>
                <span className="font-mono capitalize">{metadata.namespace}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary</span>
                <span className="font-mono truncate max-w-[180px]">{metadata.primaryTitle ?? metadata.primaryName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Secondary</span>
                <span className="font-mono truncate max-w-[180px]">{metadata.secondaryTitle ?? metadata.secondaryName}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Admin notes */}
      {expanded && (
        <Textarea
          placeholder="Add admin notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs h-16 resize-none"
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={acting}
          onClick={() => handleAction("approved")}
        >
          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
          disabled={acting}
          onClick={() => handleAction("rejected")}
        >
          <XCircle className="w-3 h-3" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-muted-foreground"
          disabled={acting}
          onClick={() => handleAction("skipped")}
        >
          <SkipForward className="w-3 h-3" />
          Skip
        </Button>
      </div>
    </div>
  );
}

// ── Chatbot Candidates Tab ─────────────────────────────────────────────────────

function ChatbotCandidatesTab() {
  const [scanning, setScanning] = useState(false);
  const utils = trpc.useUtils();

  const { data: queueData, isLoading } = trpc.humanReviewQueue.getQueue.useQuery({
    reviewType: "chatbot_candidate",
    status: "pending",
    limit: 100,
  });

  const { data: readinessData, isLoading: readinessLoading } = trpc.humanReviewQueue.getAllReadiness.useQuery({
    limit: 200,
  });

  const runScanMutation = trpc.humanReviewQueue.runChatbotScan.useMutation({
    onSuccess: (data) => {
      toast.success(`Scan complete — ${data.added} new candidate(s) flagged`);
      utils.humanReviewQueue.getQueue.invalidate();
      utils.humanReviewQueue.getStats.invalidate();
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  const updateStatusMutation = trpc.humanReviewQueue.updateStatus.useMutation({
    onSuccess: () => {
      utils.humanReviewQueue.getQueue.invalidate();
      utils.humanReviewQueue.getStats.invalidate();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const handleAction = async (id: number, status: "approved" | "rejected" | "skipped", notes?: string) => {
    await updateStatusMutation.mutateAsync({ id, status, adminNotes: notes });
    toast.success(`Item ${status}`);
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await runScanMutation.mutateAsync();
    } finally {
      setScanning(false);
    }
  };

  const items = queueData?.items ?? [];
  const readiness = readinessData ?? [];
  const chatbotReady = readiness.filter(r => r.isChatbotReady);
  const highQuality = readiness.filter(r => r.isHighQuality);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{chatbotReady.length}</p>
                <p className="text-xs text-muted-foreground">Chatbot Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highQuality.length}</p>
                <p className="text-xs text-muted-foreground">High Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Brain className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Chatbot Candidate Queue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Authors with RAG readiness score ≥ 50 are flagged for chatbot enablement review.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={scanning}
          onClick={handleScan}
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run AI Scan
        </Button>
      </div>

      {/* Pending review items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pending chatbot candidates.</p>
          <p className="text-xs mt-1">Run an AI scan to detect authors ready for chatbot enablement.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <ReviewItemCard key={item.id} item={item as ReviewItem} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* RAG Readiness Leaderboard */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">RAG Readiness Leaderboard</h3>
        </div>
        {readinessLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {readiness.slice(0, 50).map((r, i) => (
              <div key={r.authorName} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-xs text-muted-foreground w-6 text-right font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{r.authorName}</span>
                    {r.isHighQuality && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white">High Quality</Badge>
                    )}
                    {r.isChatbotReady && !r.isHighQuality && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white">Ready</Badge>
                    )}
                  </div>
                  <ScoreBar score={r.score} />
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0 space-y-0.5">
                  <div>{r.bookCount}b · {r.contentItemCount}c</div>
                  <div className="text-[10px]">{r.bioCompleteness}% bio</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Near Duplicates Tab ────────────────────────────────────────────────────────

function NearDuplicatesTab() {
  const [scanning, setScanning] = useState(false);
  const [namespace, setNamespace] = useState<"books" | "authors">("books");
  const utils = trpc.useUtils();

  const { data: queueData, isLoading } = trpc.humanReviewQueue.getQueue.useQuery({
    reviewType: "near_duplicate",
    status: "pending",
    limit: 100,
  });

  const runScanMutation = trpc.humanReviewQueue.runDuplicateScan.useMutation({
    onSuccess: (data) => {
      toast.success(`Scan complete — ${data.flagged} duplicate(s) flagged out of ${data.checked} checked`);
      utils.humanReviewQueue.getQueue.invalidate();
      utils.humanReviewQueue.getStats.invalidate();
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  const updateStatusMutation = trpc.humanReviewQueue.updateStatus.useMutation({
    onSuccess: () => {
      utils.humanReviewQueue.getQueue.invalidate();
      utils.humanReviewQueue.getStats.invalidate();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const handleAction = async (id: number, status: "approved" | "rejected" | "skipped", notes?: string) => {
    await updateStatusMutation.mutateAsync({ id, status, adminNotes: notes });
    toast.success(`Item ${status}`);
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await runScanMutation.mutateAsync({ namespace });
    } finally {
      setScanning(false);
    }
  };

  const items = queueData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Scan controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Near-Duplicate Detection</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI uses Pinecone semantic similarity (≥ 92%) to detect potential duplicates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${namespace === "books" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setNamespace("books")}
            >
              Books
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${namespace === "authors" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setNamespace("authors")}
            >
              Authors
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={scanning}
            onClick={handleScan}
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Scan {namespace === "books" ? "Books" : "Authors"}
          </Button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-medium">How near-duplicate detection works</p>
            <p>When you save a book or author, the system automatically embeds its text and queries Pinecone for semantically similar entries. Items with cosine similarity ≥ 92% are flagged here for review.</p>
            <p>You can also trigger a full scan across all books or authors using the button above.</p>
          </div>
        </div>
      </div>

      {/* Pending items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No near-duplicates detected.</p>
          <p className="text-xs mt-1">Run a scan to check for semantically similar entries in Pinecone.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <ReviewItemCard key={item.id} item={item as ReviewItem} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function AdminReviewQueueTab() {
  const { data: stats } = trpc.humanReviewQueue.getStats.useQuery();

  const chatbotCount = stats?.byType.find(t => t.reviewType === "chatbot_candidate")?.count ?? 0;
  const duplicateCount = stats?.byType.find(t => t.reviewType === "near_duplicate")?.count ?? 0;
  const totalPending = stats?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Review Queue</h1>
          <p className="text-muted-foreground text-sm">
            Human-in-the-loop decisions for AI-flagged items
            {totalPending > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">
                {totalPending} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      {stats && stats.byType.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.byType.map(t => (
            <div key={t.reviewType} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs">
              <span className="font-semibold">{Number(t.count)}</span>
              <span className="text-muted-foreground capitalize">{t.reviewType.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="chatbot-candidates">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="chatbot-candidates" className="gap-2 text-xs">
            <Users className="w-3.5 h-3.5" />
            Chatbot Candidates
            {Number(chatbotCount) > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                {Number(chatbotCount)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="near-duplicates" className="gap-2 text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            Near Duplicates
            {Number(duplicateCount) > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                {Number(duplicateCount)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatbot-candidates" className="mt-6">
          <ChatbotCandidatesTab />
        </TabsContent>

        <TabsContent value="near-duplicates" className="mt-6">
          <NearDuplicatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
