/**
 * AdminMagazineTab — Admin Console: Magazine Feeds section.
 *
 * Provides:
 *   - Sync all 5 publication RSS feeds (Atlantic, New Yorker, Wired, NYT, WaPo)
 *   - Per-publication sync with article count display
 *   - Neon pgvector indexing of synced articles
 *   - Stats: total articles cached, indexed vectors
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Newspaper,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  Database,
  MagnifyingGlass,
  Brain,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PUBLICATIONS = [
  { source: "the-atlantic",    name: "The Atlantic",        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  { source: "the-new-yorker",  name: "The New Yorker",      color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { source: "wired",           name: "Wired",               color: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300" },
  { source: "nyt",             name: "The New York Times",  color: "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-300" },
  { source: "washington-post", name: "Washington Post",     color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
] as const;

type MagazineSource = typeof PUBLICATIONS[number]["source"];

// syncAll returns array of { source, fetched, inserted, updated } or { source, error, ... }
type SyncResult = { source: string; fetched: number; inserted: number; updated: number; error?: string };

export function AdminMagazineTab() {
  const utils = trpc.useUtils();
  const [syncingSource, setSyncingSource] = useState<MagazineSource | "all" | null>(null);
  const [indexingAll, setIndexingAll] = useState(false);

  // Stats — getStats returns array of { source, total, withFullText, withAuthor }
  const statsQuery = trpc.magazine.getStats.useQuery(undefined, { staleTime: 30_000 });
  const vectorStatsQuery = trpc.vectorSearch.getStats.useQuery(undefined, { staleTime: 30_000 });

  // Mutations
  const syncAllMutation = trpc.magazine.syncAll.useMutation({
    onSuccess: (results: SyncResult[]) => {
      const total = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0);
      const fetched = results.reduce((sum, r) => sum + (r.fetched ?? 0), 0);
      toast.success(`Synced ${fetched} articles (${total} new) across all publications`);
      utils.magazine.getStats.invalidate();
      setSyncingSource(null);
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
      setSyncingSource(null);
    },
  });

  const syncFeedMutation = trpc.magazine.syncFeed.useMutation({
    onSuccess: (result: { source: string; fetched: number; inserted: number; updated: number }) => {
      toast.success(`Synced ${result.fetched} articles (${result.inserted} new) from ${result.source}`);
      utils.magazine.getStats.invalidate();
      setSyncingSource(null);
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
      setSyncingSource(null);
    },
  });

  // indexBatchArticles requires authorName — we use a special "index all" procedure
  // We'll call indexAllArticles which we'll add to the router
  const indexAllMutation = trpc.vectorSearch.indexAllArticles.useMutation({
    onSuccess: (result: { indexed: number; totalVectors: number }) => {
      toast.success(`Indexed ${result.indexed} articles (${result.totalVectors} vectors) into Neon`);
      utils.vectorSearch.getStats.invalidate();
      setIndexingAll(false);
    },
    onError: (err) => {
      toast.error(`Indexing failed: ${err.message}`);
      setIndexingAll(false);
    },
  });

  const handleSyncAll = () => {
    setSyncingSource("all");
    syncAllMutation.mutate();
  };

  const handleSyncFeed = (source: MagazineSource) => {
    setSyncingSource(source);
    syncFeedMutation.mutate({ source });
  };

  const handleIndexAll = () => {
    setIndexingAll(true);
    indexAllMutation.mutate({ limit: 200 });
  };

  // Build per-source stats map
  const statsArray = statsQuery.data ?? [];
  const statsMap = Object.fromEntries(statsArray.map((s) => [s.source, s]));
  const totalArticles = statsArray.reduce((sum, s) => sum + s.total, 0);

  const vectorStats = vectorStatsQuery.data;
  const articleNs = (vectorStats?.namespaces as Record<string, { recordCount?: number }> | undefined)?.["articles"];
  const totalIndexed = articleNs?.recordCount ?? 0;
  const indexProgress = totalArticles > 0 ? Math.min(100, Math.round((totalIndexed / totalArticles) * 100)) : 0;

  const isBusy = syncingSource !== null || indexingAll;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Newspaper className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Magazine Feeds</h1>
          <p className="text-muted-foreground text-sm">
            Sync and index articles from The Atlantic, New Yorker, Wired, NYT, and Washington Post
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-muted-foreground" weight="duotone" />
              <span className="text-xs text-muted-foreground">Cached Articles</span>
            </div>
            <p className="text-2xl font-bold">{statsQuery.isLoading ? "…" : totalArticles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-muted-foreground" weight="duotone" />
              <span className="text-xs text-muted-foreground">Indexed (Neon)</span>
            </div>
            <p className="text-2xl font-bold">{vectorStatsQuery.isLoading ? "…" : totalIndexed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <MagnifyingGlass className="w-4 h-4 text-muted-foreground" weight="duotone" />
              <span className="text-xs text-muted-foreground">Index Coverage</span>
            </div>
            <p className="text-2xl font-bold">{indexProgress}%</p>
            {totalArticles > 0 && (
              <Progress value={indexProgress} className="h-1 mt-1" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Newspaper className="w-4 h-4 text-muted-foreground" weight="duotone" />
              <span className="text-xs text-muted-foreground">Publications</span>
            </div>
            <p className="text-2xl font-bold">5</p>
          </CardContent>
        </Card>
      </div>

      {/* Primary actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowsClockwise className="w-4 h-4" weight="bold" />
            Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Fetch the latest RSS articles from all 5 publications and cache them in the database.
            Then index them into Neon to enable semantic search across all magazine content.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleSyncAll}
              disabled={isBusy}
              className="gap-2"
            >
              {syncingSource === "all" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowsClockwise className="w-4 h-4" weight="bold" />
              )}
              {syncingSource === "all" ? "Syncing all feeds…" : "Sync All Publications"}
            </Button>
            <Button
              variant="outline"
              onClick={handleIndexAll}
              disabled={isBusy || totalArticles === 0}
              className="gap-2"
            >
              {indexingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" weight="bold" />
              )}
              {indexingAll ? "Indexing into Neon…" : "Index All into Neon"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Per-publication cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Individual Publications
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PUBLICATIONS.map((pub) => {
            const pubStats = statsMap[pub.source];
            const isSyncing = syncingSource === pub.source;
            const count = pubStats?.total ?? 0;
            return (
              <Card key={pub.source} className="relative overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Badge className={`text-xs mb-2 ${pub.color}`}>{pub.name}</Badge>
                      <p className="text-2xl font-bold">
                        {statsQuery.isLoading ? "…" : count}
                      </p>
                      <p className="text-xs text-muted-foreground">articles cached</p>
                    </div>
                    {count > 0 ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-1" weight="fill" />
                    ) : (
                      <Warning className="w-5 h-5 text-amber-400 mt-1" weight="fill" />
                    )}
                  </div>
                  {pubStats && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {pubStats.withFullText} with full text · {pubStats.withAuthor} with author
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={isBusy}
                    onClick={() => handleSyncFeed(pub.source)}
                  >
                    {isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowsClockwise className="w-3.5 h-3.5" weight="bold" />
                    )}
                    {isSyncing ? "Syncing…" : "Sync Feed"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Neon indexing info */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" weight="duotone" />
            <div>
              <p className="text-sm font-medium mb-1">Semantic Search Indexing</p>
              <p className="text-xs text-muted-foreground">
                After syncing, click "Index All into Neon" to generate Gemini embeddings for each
                article and store them in the Neon pgvector database. This enables semantic search
                across all magazine content from the library search bar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
