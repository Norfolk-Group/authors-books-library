/**
 * FavoritesTab — Admin Console tab for managing user favorites.
 *
 * Shows:
 *   - Top favorited authors and books (aggregate counts)
 *   - Current user's favorites (if logged in)
 *   - Quick actions: remove favorite, open in library
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  HeartOff,
  Users,
  BookOpen,
  Star,
  TrendingUp,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { getLoginUrl } from "@/const";

// ── Helpers ────────────────────────────────────────────────────────────────────

function EntityAvatar({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
      {name.charAt(0)}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FavoritesTab() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"mine" | "top">("mine");

  // Current user's favorites
  const { data: myFavorites, refetch: refetchMine, isLoading: mineLoading } = trpc.favorites.list.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 30_000 }
  );

  // Top favorited entities
  const { data: topAuthors, refetch: refetchTopAuthors } = trpc.favorites.topFavorited.useQuery(
    { entityType: "author", limit: 20 },
    { staleTime: 60_000 }
  );
  const { data: topBooks, refetch: refetchTopBooks } = trpc.favorites.topFavorited.useQuery(
    { entityType: "book", limit: 20 },
    { staleTime: 60_000 }
  );

  const toggleMutation = trpc.favorites.toggle.useMutation({
    onSuccess: (result) => {
      toast.success(result.isFavorite ? "Added to favorites" : "Removed from favorites");
      refetchMine();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const myAuthors = myFavorites?.filter((f) => f.entityType === "author") ?? [];
  const myBooks = myFavorites?.filter((f) => f.entityType === "book") ?? [];

  const handleRefresh = () => {
    refetchMine();
    refetchTopAuthors();
    refetchTopBooks();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Favorites</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage favorited authors and books — favorites prioritize enrichment pipeline runs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        <button
          onClick={() => setActiveTab("mine")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "mine"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Heart className="w-3 h-3" />
            My Favorites
            {isAuthenticated && myFavorites && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-0.5">
                {myFavorites.length}
              </Badge>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("top")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "top"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            Top Favorited
          </span>
        </button>
      </div>

      {/* My Favorites tab */}
      {activeTab === "mine" && (
        <div className="space-y-4">
          {!isAuthenticated ? (
            <div className="text-center py-10 text-muted-foreground">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Sign in to see your favorites</p>
              <p className="text-xs mt-1 mb-4">Favorites are saved to your account</p>
              <Button size="sm" variant="outline" asChild>
                <a href={getLoginUrl()}>
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Sign In
                </a>
              </Button>
            </div>
          ) : mineLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-40" />
              <p className="text-xs">Loading favorites...</p>
            </div>
          ) : myFavorites?.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No favorites yet</p>
              <p className="text-xs mt-1">Click the heart icon on any author or book card to add it here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Favorited Authors */}
              {myAuthors.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    Authors ({myAuthors.length})
                  </h4>
                  <div className="grid gap-2">
                    {myAuthors.map((fav) => (
                      <Card key={fav.id} className="border-border/60">
                        <CardContent className="p-2.5">
                          <div className="flex items-center gap-2.5">
                            <EntityAvatar imageUrl={fav.imageUrl} name={fav.displayName ?? fav.entityKey} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{fav.displayName ?? fav.entityKey}</p>
                              <p className="text-[10px] text-muted-foreground">Author</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({
                                  entityType: "author",
                                  entityKey: fav.entityKey,
                                  displayName: fav.displayName ?? undefined,
                                  imageUrl: fav.imageUrl ?? undefined,
                                })}
                                disabled={toggleMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors text-red-400 hover:text-red-500"
                                title="Remove from favorites"
                              >
                                <HeartOff className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorited Books */}
              {myBooks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" />
                    Books ({myBooks.length})
                  </h4>
                  <div className="grid gap-2">
                    {myBooks.map((fav) => (
                      <Card key={fav.id} className="border-border/60">
                        <CardContent className="p-2.5">
                          <div className="flex items-center gap-2.5">
                            <EntityAvatar imageUrl={fav.imageUrl} name={fav.displayName ?? fav.entityKey} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{fav.displayName ?? fav.entityKey}</p>
                              <p className="text-[10px] text-muted-foreground">Book</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => toggleMutation.mutate({
                                  entityType: "book",
                                  entityKey: fav.entityKey,
                                  displayName: fav.displayName ?? undefined,
                                  imageUrl: fav.imageUrl ?? undefined,
                                })}
                                disabled={toggleMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors text-red-400 hover:text-red-500"
                                title="Remove from favorites"
                              >
                                <HeartOff className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Favorited tab */}
      {activeTab === "top" && (
        <div className="space-y-4">
          {/* Top Authors */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              Top Favorited Authors
            </h4>
            {topAuthors && topAuthors.length > 0 ? (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Author</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Favorites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAuthors.map((item, i) => (
                      <tr key={item.entityKey} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.entityKey}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <Heart className="w-3 h-3 fill-current" />
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No author favorites yet.</p>
            )}
          </div>

          {/* Top Books */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="w-3 h-3" />
              Top Favorited Books
            </h4>
            {topBooks && topBooks.length > 0 ? (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Book</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Favorites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBooks.map((item, i) => (
                      <tr key={item.entityKey} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.entityKey}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <Heart className="w-3 h-3 fill-current" />
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No book favorites yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
