/**
 * InterestHeatmap
 *
 * A full-page matrix view showing how every author with a ready RAG file
 * aligns with each of the user's defined interests.
 *
 * Rows = authors (sorted by total alignment score desc)
 * Cols = interests (sorted by user-defined display order)
 * Cell = color-coded score badge (0–10)
 *
 * Features:
 *   - Sort by total score, name, or specific interest column
 *   - Filter to show only authors with at least one score
 *   - Trigger "Score All Authors" batch job
 *   - Click a cell to see the rationale tooltip
 *   - Navigate to author profile or chatbot from row
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowUpDown, MessageCircle, User } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

// ── Score color helpers ────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 9) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 7) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25";
  if (score >= 5) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25";
  if (score >= 3) return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25";
  return "bg-muted/50 text-muted-foreground border-border";
}

function scoreBg(score: number): string {
  if (score >= 9) return "#10b98122";
  if (score >= 7) return "#22c55e18";
  if (score >= 5) return "#eab30818";
  if (score >= 3) return "#f9731618";
  return "transparent";
}

type SortMode = "total-desc" | "name-asc" | string; // string for interest column sort

export default function InterestHeatmap() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [sortMode, setSortMode] = useState<SortMode>("total-desc");
  const [filterScored, setFilterScored] = useState(false);

  const interestsQuery = trpc.userInterests.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const scoresQuery = trpc.userInterests.getScores.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const ragQuery = trpc.ragPipeline.getAllStatuses.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const scoreAllMutation = trpc.userInterests.scoreAllAuthors.useMutation({
    onSuccess: (data: { scored: number }) => {
      toast.success(`Scored ${data.scored} authors against your interests`);
      void scoresQuery.refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const interests = interestsQuery.data ?? [];
  const allScores = scoresQuery.data ?? [];
  const ragProfiles = ragQuery.data ?? [];

  // Build a map: authorName → interestId → { score, rationale }
  const scoreMap = useMemo(() => {
    const map = new Map<string, Map<number, { score: number; rationale: string | null }>>();
    for (const s of allScores) {
      if (!map.has(s.authorName)) map.set(s.authorName, new Map());
      map.get(s.authorName)!.set(s.interestId, { score: s.score, rationale: s.rationale ?? null });
    }
    return map;
  }, [allScores]);

  // Authors with ready RAG files
  const readyAuthors = useMemo(() =>
    ragProfiles
      .filter((r: { ragStatus: string; authorName: string }) => r.ragStatus === "ready")
      .map((r: { ragStatus: string; authorName: string }) => r.authorName),
    [ragProfiles]
  );

  // Compute total score per author
  const authorTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const authorName of readyAuthors) {
      const authorScores = scoreMap.get(authorName);
      if (!authorScores) { totals.set(authorName, 0); continue; }
      let total = 0;
      for (const entry of Array.from(authorScores.values())) total += entry.score;
      totals.set(authorName, total);
    }
    return totals;
  }, [readyAuthors, scoreMap]);

  // Sorted and filtered author list
  const displayAuthors = useMemo(() => {
    let authors = [...readyAuthors];
    if (filterScored) authors = authors.filter((a) => scoreMap.has(a));
    if (sortMode === "total-desc") {
      authors.sort((a, b) => (authorTotals.get(b) ?? 0) - (authorTotals.get(a) ?? 0));
    } else if (sortMode === "name-asc") {
      authors.sort((a, b) => a.localeCompare(b));
    } else {
      // Sort by specific interest column
      const interestId = parseInt(sortMode.replace("interest-", ""), 10);
      authors.sort((a, b) => {
        const sa = scoreMap.get(a)?.get(interestId)?.score ?? -1;
        const sb = scoreMap.get(b)?.get(interestId)?.score ?? -1;
        return sb - sa;
      });
    }
    return authors;
  }, [readyAuthors, filterScored, sortMode, scoreMap, authorTotals]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Sign in to view your interest alignment heatmap.</p>
        <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
      </div>
    );
  }

  const isLoading = interestsQuery.isLoading || scoresQuery.isLoading || ragQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              ← Library
            </Link>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h1 className="font-semibold text-foreground">Interest Alignment Heatmap</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort control */}
            <Select value={sortMode} onValueChange={setSortMode}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1.5" />
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total-desc">Total Score (High → Low)</SelectItem>
                <SelectItem value="name-asc">Author Name (A → Z)</SelectItem>
                {interests.map((i) => (
                  <SelectItem key={i.id} value={`interest-${i.id}`}>
                    {i.topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Filter toggle */}
            <Button
              variant={filterScored ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilterScored(!filterScored)}
            >
              {filterScored ? "Scored only" : "All ready authors"}
            </Button>
            {/* Score all */}
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={scoreAllMutation.isPending || interests.length === 0}
              onClick={() => scoreAllMutation.mutate({})}
            >
              {scoreAllMutation.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Scoring...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1.5" />Score All Authors</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : interests.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No interests defined yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <Link href="/admin" className="underline text-primary">Admin → My Interests</Link> to add topics you care about.
            </p>
          </div>
        ) : displayAuthors.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-medium">No authors with ready Digital Me files.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to <Link href="/admin" className="underline text-primary">Admin → Digital Me</Link> to generate RAG files.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide whitespace-nowrap sticky left-0 bg-muted/50 border-b border-border min-w-[200px]">
                    Author
                  </th>
                  <th className="px-3 py-3 font-semibold text-foreground text-xs uppercase tracking-wide whitespace-nowrap border-b border-border text-center">
                    Total
                  </th>
                  {interests.map((interest) => (
                    <th
                      key={interest.id}
                      className="px-3 py-3 font-medium text-xs whitespace-nowrap border-b border-border text-center cursor-pointer hover:bg-muted/70 transition-colors"
                      style={{ color: interest.color ?? "#6366F1" }}
                      onClick={() => setSortMode(`interest-${interest.id}`)}
                      title={interest.description ?? interest.topic}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{interest.topic}</span>
                        {interest.category && (
                          <span className="text-[9px] text-muted-foreground font-normal">{interest.category}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-xs border-b border-border text-center whitespace-nowrap text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayAuthors.map((authorName, idx) => {
                  const authorScores = scoreMap.get(authorName);
                  const total = authorTotals.get(authorName) ?? 0;
                  const maxPossible = interests.length * 10;
                  const pct = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

                  return (
                    <tr
                      key={authorName}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      {/* Author name cell */}
                      <td className="px-4 py-2.5 sticky left-0 bg-card border-r border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/author/${encodeURIComponent(authorName)}`}
                              className="font-medium text-foreground hover:text-primary transition-colors text-sm no-underline line-clamp-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {authorName}
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* Total score cell */}
                      <td className="px-3 py-2.5 text-center">
                        {authorScores ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-0.5 cursor-default">
                                <span className="font-bold text-sm text-foreground">{total}</span>
                                <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{pct}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {total} / {maxPossible} total alignment points
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Per-interest score cells */}
                      {interests.map((interest) => {
                        const cell = authorScores?.get(interest.id);
                        return (
                          <td key={interest.id} className="px-2 py-2.5 text-center">
                            {cell ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`inline-flex items-center justify-center w-9 h-7 rounded-lg border text-xs font-bold cursor-default transition-colors ${scoreColor(cell.score)}`}
                                    style={{ backgroundColor: scoreBg(cell.score) }}
                                  >
                                    {cell.score}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[240px] p-2.5">
                                  <p className="font-semibold text-xs mb-1">{interest.topic}: {cell.score}/10</p>
                                  {cell.rationale && (
                                    <p className="text-xs text-muted-foreground leading-relaxed">{cell.rationale}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">·</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/author/${encodeURIComponent(authorName)}`}>
                                <Button variant="ghost" size="icon" className="w-7 h-7">
                                  <User className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>View Profile</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/chat/${encodeURIComponent(authorName)}`}>
                                <Button variant="ghost" size="icon" className="w-7 h-7">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Chat with {authorName.split(" ")[0]}</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary stats */}
        {!isLoading && displayAuthors.length > 0 && (
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <Badge variant="outline">{displayAuthors.length} authors</Badge>
            <Badge variant="outline">{interests.length} interests</Badge>
            <Badge variant="outline">{allScores.length} scores computed</Badge>
            <span className="ml-auto">
              Click an interest column header to sort by that topic · Click a cell to see the rationale
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
