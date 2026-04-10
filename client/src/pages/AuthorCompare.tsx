/**
 * AuthorCompare — Side-by-side comparison of 2–4 authors.
 * Route: /compare?a=Adam+Grant&b=Malcolm+Gladwell&c=...
 *
 * Sections per column:
 *   - Avatar + name + category
 *   - Bio snippet
 *   - Social stats badges (Wikipedia views, GitHub followers, Substack posts, YouTube subs)
 *   - Platform presence count
 *   - Books count
 *   - Platform pills
 *
 * URL-driven: authors are encoded in query params (a, b, c, d).
 * Shareable deep links work out of the box.
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { PlatformPills, countPlatformLinks } from "@/components/library/PlatformPills";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { useAuthorAliases } from "@/hooks/useAuthorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Users,
  BookOpen,
  BarChart2,
  Globe,
  X,
  Plus,
  Share2,
  GitFork,
} from "lucide-react";
import { toast } from "sonner";
import type { SocialStatsResult } from "../../../server/enrichment/socialStats";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCount(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseQueryParams(): string[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  return ["a", "b", "c", "d"]
    .map((k) => params.get(k))
    .filter((v): v is string => !!v);
}

function buildQueryString(names: string[]): string {
  const keys = ["a", "b", "c", "d"];
  return names.map((n, i) => `${keys[i]}=${encodeURIComponent(n)}`).join("&");
}

// ── Stat row ──────────────────────────────────────────────────────────────────
interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  values: (string | null)[];
  highlight?: boolean;
}
function StatRow({ icon, label, values, highlight }: StatRowProps) {
  // Find the max numeric value for highlighting
  const nums = values.map((v) => {
    if (!v || v === "—") return 0;
    const n = parseFloat(v.replace(/[KMB]/g, (m) => m === "K" ? "e3" : m === "M" ? "e6" : "e9"));
    return isNaN(n) ? 0 : n;
  });
  const maxNum = Math.max(...nums);

  return (
    <div className={`grid gap-0 border-b border-border last:border-0 ${highlight ? "bg-muted/30" : ""}`}
      style={{ gridTemplateColumns: `180px repeat(${values.length}, 1fr)` }}>
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground font-medium border-r border-border">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {values.map((val, i) => {
        const isTop = nums[i] > 0 && nums[i] === maxNum && maxNum > 0;
        return (
          <div key={i} className={`flex items-center justify-center px-3 py-3 text-sm font-semibold border-r border-border last:border-0 ${isTop ? "text-primary" : "text-foreground"}`}>
            {isTop && <span className="mr-1 text-xs">★</span>}
            {val ?? "—"}
          </div>
        );
      })}
    </div>
  );
}

// ── Author column header ──────────────────────────────────────────────────────
interface AuthorHeaderProps {
  authorName: string;
  onRemove: () => void;
  canRemove: boolean;
}
function AuthorHeader({ authorName, onRemove, canRemove }: AuthorHeaderProps) {
  const { canonicalName } = useAuthorAliases();
  const author = AUTHORS.find((a) => canonicalName(a.name) === canonicalName(authorName));
  const avatar = getAuthorAvatar(authorName);
  const catColor = author ? CATEGORY_COLORS[author.category] ?? "#6b7280" : "#6b7280";

  return (
    <div className="flex flex-col items-center gap-2 p-4 relative">
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-muted hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remove ${authorName}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <a href={`/author/${encodeURIComponent(authorName)}`} className="block">
        <img
          src={avatar}
          alt={authorName}
          className="w-20 h-20 rounded-full object-cover border-2 shadow-md hover:scale-105 transition-transform"
          style={{ borderColor: catColor }}
        />
      </a>
      <div className="text-center">
        <a href={`/author/${encodeURIComponent(authorName)}`} className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-2 leading-tight">
          {authorName}
        </a>
        {author && (
          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0" style={{ borderColor: catColor, color: catColor }}>
            {author.category.split(" & ")[0]}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AuthorCompare() {
  const { canonicalName } = useAuthorAliases();
  const [, setLocation] = useLocation();
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>(() => parseQueryParams());
  const [addingAuthor, setAddingAuthor] = useState<string>("");

  // All author names for the selector
  const allAuthorNames = useMemo(
    () => Array.from(new Set(AUTHORS.map((a) => canonicalName(a.name)))).sort(),
    [canonicalName]
  );

  // Fetch platform links for all selected authors
  const platformLinksQuery = trpc.authorProfiles.getAllPlatformLinks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const platformLinksData = platformLinksQuery.data;
  const platformLinksMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof platformLinksData>[number]>();
    for (const row of platformLinksData ?? []) {
      map.set(canonicalName(row.authorName), row);
    }
    return map;
  }, [platformLinksData, canonicalName]);

  // Fetch social stats for selected authors
  const socialStatsQuery = trpc.authorProfiles.getSocialStats.useQuery(
    { authorName: undefined },
    { staleTime: 5 * 60 * 1000 }
  );
  const socialStatsMap = useMemo(() => {
    const map = new Map<string, SocialStatsResult | null>();
    for (const row of socialStatsQuery.data ?? []) {
      map.set(canonicalName(row.authorName), row.socialStats as SocialStatsResult | null);
    }
    return map;
  }, [socialStatsQuery.data, canonicalName]);

  // Fetch bios
  const biosQuery = trpc.authorProfiles.getAllBios.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });
  const biosMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of biosQuery.data ?? []) {
      if (row.bio) map.set(canonicalName(row.authorName), row.bio);
    }
    return map;
  }, [biosQuery.data, canonicalName]);

  // Update URL when selection changes
  const updateUrl = useCallback((names: string[]) => {
    const qs = buildQueryString(names);
    setLocation(`/compare${qs ? "?" + qs : ""}`, { replace: true });
  }, [setLocation]);

  const addAuthor = useCallback(() => {
    if (!addingAuthor || selectedAuthors.includes(addingAuthor) || selectedAuthors.length >= 4) return;
    const next = [...selectedAuthors, addingAuthor];
    setSelectedAuthors(next);
    updateUrl(next);
    setAddingAuthor("");
  }, [addingAuthor, selectedAuthors, updateUrl]);

  const removeAuthor = useCallback((name: string) => {
    const next = selectedAuthors.filter((a) => a !== name);
    setSelectedAuthors(next);
    updateUrl(next);
  }, [selectedAuthors, updateUrl]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Comparison link copied to clipboard");
  }, []);

  // Per-author data
  const authorData = useMemo(() => selectedAuthors.map((name) => {
    const canonical = canonicalName(name);
    const links = platformLinksMap.get(canonical);
    const stats = socialStatsMap.get(canonical);
    const bio = biosMap.get(canonical);
    const author = AUTHORS.find((a) => canonicalName(a.name) === canonical);
    return { name, links, stats, bio, author };
  }), [selectedAuthors, platformLinksMap, socialStatsMap, biosMap, canonicalName]);

  const colCount = selectedAuthors.length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Compare" }]} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-[Playfair_Display]">Author Comparison</h1>
            <p className="text-sm text-muted-foreground mt-1">Compare up to 4 authors side by side</p>
          </div>
          <div className="flex items-center gap-2">
            {colCount >= 2 && (
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </Button>
            )}
          </div>
        </div>

        {/* Add author row */}
        {colCount < 4 && (
          <div className="flex items-center gap-2 mb-6 p-4 rounded-xl border border-dashed border-border bg-muted/20">
            <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={addingAuthor} onValueChange={setAddingAuthor}>
              <SelectTrigger className="w-64 h-8 text-sm">
                <SelectValue placeholder="Add an author to compare…" />
              </SelectTrigger>
              <SelectContent>
                {allAuthorNames
                  .filter((n) => !selectedAuthors.includes(n))
                  .map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addAuthor} disabled={!addingAuthor} className="h-8">
              Add
            </Button>
          </div>
        )}

        {colCount === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No authors selected</p>
            <p className="text-sm mt-1">Use the selector above to add authors to compare</p>
          </div>
        )}

        {colCount >= 1 && (
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            {/* Column headers */}
            <div
              className="grid bg-card border-b border-border"
              style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
            >
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border flex items-center">
                Metric
              </div>
              {authorData.map(({ name }) => (
                <AuthorHeader
                  key={name}
                  authorName={name}
                  onRemove={() => removeAuthor(name)}
                  canRemove={colCount > 1}
                />
              ))}
            </div>

            {/* Bio row */}
            <div
              className="grid border-b border-border bg-muted/10"
              style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
            >
              <div className="flex items-start gap-2 px-4 py-3 text-sm text-muted-foreground font-medium border-r border-border">
                <BookOpen className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Bio</span>
              </div>
              {authorData.map(({ name, bio }) => (
                <div key={name} className="px-3 py-3 text-xs text-muted-foreground leading-relaxed border-r border-border last:border-0 line-clamp-4">
                  {bio ?? "No bio available."}
                </div>
              ))}
            </div>

            {/* Stats rows */}
            <StatRow
              icon={<Eye className="w-4 h-4" />}
              label="Wikipedia Views/mo"
              values={authorData.map(({ stats }) => formatCount(stats?.wikipedia?.avgMonthlyViews))}
            />
            <StatRow
              icon={<Users className="w-4 h-4" />}
              label="GitHub Followers"
              values={authorData.map(({ stats }) => formatCount(stats?.github?.followers))}
            />
            <StatRow
              icon={<BarChart2 className="w-4 h-4" />}
              label="Substack Posts"
              values={authorData.map(({ stats }) => formatCount(stats?.substack?.postCount))}
            />

            <StatRow
              icon={<Globe className="w-4 h-4" />}
              label="Platform Links"
              values={authorData.map(({ links }) => links ? String(countPlatformLinks(links)) : "—")}
            />
            <StatRow
              icon={<BookOpen className="w-4 h-4" />}
              label="Books in Library"
              values={authorData.map(({ author }) => author ? String(author.books.length) : "—")}
            />
            <StatRow
              icon={<GitFork className="w-4 h-4" />}
              label="GitHub Repos"
              values={authorData.map(({ stats }) => formatCount(stats?.github?.publicRepos))}
            />

            {/* Platform pills row */}
            <div
              className="grid border-t border-border"
              style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
            >
              <div className="flex items-start gap-2 px-4 py-4 text-sm text-muted-foreground font-medium border-r border-border">
                <Globe className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Platforms</span>
              </div>
              {authorData.map(({ name, links, stats }) => (
                <div key={name} className="px-3 py-4 border-r border-border last:border-0">
                  {links ? (
                    <PlatformPills
                      links={links}
                      socialStats={stats as SocialStatsResult | null}
                      maxVisible={12}
                      size="sm"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No platforms discovered</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
