/**
 * MyInterestsTab.tsx
 *
 * Admin panel for managing the user's personal interest graph.
 * Features:
 *   - Add / Edit / Delete interests with topic, description, category, weight, color
 *   - Drag-to-reorder (visual order via up/down buttons)
 *   - Score one author or all authors against interests
 *   - Interest heatmap: matrix of authors × interests with color-coded scores
 *   - Group compare: select 2–5 authors and compare on a chosen interest
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  BarChart3,
  Zap,
  Brain,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

// ── Weight config ─────────────────────────────────────────────────────────────
const WEIGHT_OPTIONS = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "low", label: "Low", color: "bg-gray-400" },
] as const;

const DEFAULT_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#14B8A6",
];

// ── Score cell ────────────────────────────────────────────────────────────────
function ScoreCell({ score }: { score: number | undefined }) {
  if (score === undefined) return <td className="px-2 py-1.5 text-center text-muted-foreground text-xs">—</td>;
  const bg =
    score >= 8 ? "bg-emerald-100 text-emerald-800" :
    score >= 6 ? "bg-green-50 text-green-700" :
    score >= 4 ? "bg-amber-50 text-amber-700" :
    score >= 2 ? "bg-orange-50 text-orange-700" :
    "bg-red-50 text-red-700";
  return <td className={`px-2 py-1.5 text-center text-xs font-medium rounded ${bg}`}>{score}</td>;
}

// ── Interest form ─────────────────────────────────────────────────────────────
interface InterestFormData {
  topic: string;
  description: string;
  category: string;
  weight: "low" | "medium" | "high" | "critical";
  color: string;
}

const EMPTY_FORM: InterestFormData = {
  topic: "",
  description: "",
  category: "",
  weight: "medium",
  color: DEFAULT_COLORS[0],
};

// ── Main component ────────────────────────────────────────────────────────────
export function MyInterestsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InterestFormData>(EMPTY_FORM);
  const [scoringAuthor, setScoringAuthor] = useState("");
  const [scoringAll, setScoringAll] = useState(false);
  const [compareAuthors, setCompareAuthors] = useState<string[]>([]);
  const [compareInterestId, setCompareInterestId] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: interests = [], refetch: refetchInterests } = trpc.userInterests.list.useQuery();
  const { data: allScores = [] } = trpc.userInterests.getScores.useQuery();
  const { data: ragStatuses = [] } = trpc.ragPipeline.getAllStatuses.useQuery();

  const createMutation = trpc.userInterests.create.useMutation();
  const updateMutation = trpc.userInterests.update.useMutation();
  const deleteMutation = trpc.userInterests.delete.useMutation();
  const reorderMutation = trpc.userInterests.reorder.useMutation();
  const scoreAuthorMutation = trpc.userInterests.scoreAuthor.useMutation();
  const compareMutation = trpc.userInterests.compareAuthors.useMutation();

  // Authors with ready RAG files
  const readyAuthors = ragStatuses.filter((r) => r.ragStatus === "ready").map((r) => r.authorName);

  // Build heatmap data: authors × interests → score
  const scoreMap = new Map<string, Map<number, number>>();
  for (const score of allScores) {
    if (!scoreMap.has(score.authorName)) scoreMap.set(score.authorName, new Map());
    scoreMap.get(score.authorName)!.set(score.interestId, score.score);
  }
  const heatmapAuthors = Array.from(scoreMap.keys()).sort();

  async function handleSave() {
    if (!form.topic.trim()) { toast.error("Topic is required"); return; }
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success("Interest updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Interest added");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await refetchInterests();
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`);
    }
  }

  function handleEdit(interest: typeof interests[number]) {
    setEditingId(interest.id);
    setForm({
      topic: interest.topic,
      description: interest.description ?? "",
      category: interest.category ?? "",
      weight: (interest.weight as InterestFormData["weight"]) ?? "medium",
      color: interest.color ?? DEFAULT_COLORS[0],
    });
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Interest deleted");
      setDeleteConfirmId(null);
      await refetchInterests();
      utils.userInterests.getScores.invalidate();
    } catch (err) {
      toast.error(`Delete failed: ${String(err)}`);
    }
  }

  async function handleReorder(id: number, direction: "up" | "down") {
    const idx = interests.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const newOrder = [...interests.map((i) => i.id)];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await reorderMutation.mutateAsync({ orderedIds: newOrder });
    await refetchInterests();
  }

  async function handleScoreAuthor() {
    if (!scoringAuthor) { toast.error("Select an author first"); return; }
    try {
      const result = await scoreAuthorMutation.mutateAsync({ authorName: scoringAuthor });
      if (result.success) {
        toast.success(`Scored ${result.scoresComputed} interests for ${result.authorName}`);
        utils.userInterests.getScores.invalidate();
      } else {
        toast.error((result as { message?: string }).message ?? "Scoring failed");
      }
    } catch (err) {
      toast.error(`Scoring failed: ${String(err)}`);
    }
  }

  async function handleScoreAll() {
    setScoringAll(true);
    let done = 0;
    for (const authorName of readyAuthors) {
      try {
        await scoreAuthorMutation.mutateAsync({ authorName });
        done++;
      } catch { done++; }
    }
    setScoringAll(false);
    toast.success(`Scored ${done} authors against your interests`);
    utils.userInterests.getScores.invalidate();
  }

  async function handleCompare() {
    if (compareAuthors.length < 2) { toast.error("Select at least 2 authors"); return; }
    if (!compareInterestId) { toast.error("Select an interest to compare on"); return; }
    setComparing(true);
    try {
      const result = await compareMutation.mutateAsync({
        authorNames: compareAuthors,
        interestId: compareInterestId,
      });
      setCompareResult(result.analysis);
    } catch (err) {
      toast.error(`Comparison failed: ${String(err)}`);
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">My Interest Graph</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define topics you care about. The system will score each author's Digital Me against your interests.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Interest
        </Button>
      </div>

      {/* Interest list */}
      <Card>
        <CardContent className="p-0">
          {interests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No interests yet. Add your first interest above.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium">Topic</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Weight</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Order</th>
                  <th className="text-left px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {interests.map((interest, idx) => {
                  const weightCfg = WEIGHT_OPTIONS.find((w) => w.value === interest.weight);
                  return (
                    <tr key={interest.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: interest.color ?? "#6366F1" }}
                          />
                          <span className="font-medium">{interest.topic}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{interest.category ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${weightCfg?.color ?? "bg-gray-400"}`} />
                          {weightCfg?.label ?? interest.weight}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                        {interest.description ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-0.5">
                          <Button
                            size="sm" variant="ghost" className="h-5 w-5 p-0"
                            disabled={idx === 0}
                            onClick={() => handleReorder(interest.id, "up")}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-5 w-5 p-0"
                            disabled={idx === interests.length - 1}
                            onClick={() => handleReorder(interest.id, "down")}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(interest)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(interest.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Scoring controls */}
      {interests.length > 0 && readyAuthors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Score Authors Against Your Interests
            </CardTitle>
            <CardDescription className="text-xs">
              Uses Claude Opus to score each author's alignment with your interests (0–10 per interest).
              Requires a ready Digital Me file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Score single author</label>
                <Select value={scoringAuthor} onValueChange={setScoringAuthor}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select author…" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyAuthors.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm" className="gap-1.5 h-8"
                onClick={handleScoreAuthor}
                disabled={!scoringAuthor || scoreAuthorMutation.isPending}
              >
                {scoreAuthorMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                Score
              </Button>
              <Button
                size="sm" variant="outline" className="gap-1.5 h-8"
                onClick={handleScoreAll}
                disabled={scoringAll}
              >
                {scoringAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Score All ({readyAuthors.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      {heatmapAuthors.length > 0 && interests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Interest Alignment Heatmap
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowHeatmap(!showHeatmap)}>
                {showHeatmap ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showHeatmap && (
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium sticky left-0 bg-background">Author</th>
                    {interests.map((i) => (
                      <th key={i.id} className="px-2 py-2 font-medium text-center max-w-[80px]">
                        <div className="truncate" title={i.topic}>{i.topic}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapAuthors.map((authorName) => (
                    <tr key={authorName} className="border-b hover:bg-muted/10">
                      <td className="px-3 py-1.5 font-medium sticky left-0 bg-background max-w-[140px] truncate">
                        {authorName}
                      </td>
                      {interests.map((interest) => (
                        <ScoreCell
                          key={interest.id}
                          score={scoreMap.get(authorName)?.get(interest.id)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Group compare */}
      {interests.length > 0 && readyAuthors.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Compare Authors on an Interest
            </CardTitle>
            <CardDescription className="text-xs">
              Select 2–5 authors and one interest. Claude Opus will produce a structured comparative analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Authors (select 2–5)</label>
              <div className="flex flex-wrap gap-1.5">
                {readyAuthors.slice(0, 30).map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setCompareAuthors((prev) =>
                        prev.includes(name)
                          ? prev.filter((a) => a !== name)
                          : prev.length < 5 ? [...prev, name] : prev
                      );
                    }}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      compareAuthors.includes(name)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Interest to compare on</label>
                <Select value={compareInterestId?.toString() ?? ""} onValueChange={(v) => setCompareInterestId(Number(v))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select interest…" />
                  </SelectTrigger>
                  <SelectContent>
                    {interests.map((i) => (
                      <SelectItem key={i.id} value={i.id.toString()} className="text-xs">{i.topic}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm" className="gap-1.5 h-8"
                onClick={handleCompare}
                disabled={comparing || compareAuthors.length < 2 || !compareInterestId}
              >
                {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                Compare
              </Button>
            </div>
            {compareResult && (
              <div className="mt-3 p-3 bg-muted/30 rounded text-xs whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {compareResult}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Interest" : "Add Interest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Topic *</label>
              <Input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. Leadership, Behavioral Economics, Neuroscience"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional: what specifically interests you about this topic?"
                className="text-sm resize-none h-16"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Business, Science"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Priority</label>
                <Select value={form.weight} onValueChange={(v) => setForm((f) => ({ ...f, weight: v as InterestFormData["weight"] }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEIGHT_OPTIONS.map((w) => (
                      <SelectItem key={w.value} value={w.value} className="text-xs">{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {editingId !== null ? "Save Changes" : "Add Interest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Interest?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will also delete all alignment scores for this interest. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => deleteConfirmId !== null && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
