/**
 * Leaderboard — Top-10 authors ranked by social stats.
 * Route: /leaderboard
 *
 * Tabs:
 *   - Wikipedia Views (monthly)
 *   - Substack Posts
 *   - GitHub Followers
 *   - GitHub Stars
 *   - Platform Count (most connected)
 *
 * Each row shows:
 *   - Rank badge (1st = gold, 2nd = silver, 3rd = bronze)
 *   - Avatar + name + category
 *   - Stat value with a visual progress bar relative to #1
 *   - "Compare" button
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { PlatformPills, countPlatformLinks } from "@/components/library/PlatformPills";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Users,
  BarChart2,
  Globe,
  Star,
  GitFork,
  Trophy,
  BarChart,
  BookOpen,
  Tag,
} from "lucide-react";
import { Link } from "wouter";
import type { SocialStatsResult } from "../../../server/enrichment/socialStats";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCount(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const RANK_LABELS = ["1st", "2nd", "3rd"];

interface LeaderboardEntry {
  authorName: string;
  value: number;
  rawStats: SocialStatsResult | null;
  platformCount: number;
  bookCount: number;
  tagCount: number;
}

type MetricKey = "wikipedia" | "substack" | "githubFollowers" | "githubStars" | "platforms" | "books" | "tags";

interface MetricDef {
  key: MetricKey;
  label: string;
  icon: React.ReactNode;
  description: string;
  getValue: (stats: SocialStatsResult | null, platformCount: number) => number;
}

const METRICS: MetricDef[] = [
  {
    key: "wikipedia",
    label: "Wikipedia Views",
    icon: <Eye className="w-4 h-4" />,
    description: "Average monthly Wikipedia page views",
    getValue: (s) => s?.wikipedia?.avgMonthlyViews ?? 0,
  },
  {
    key: "substack",
    label: "Substack Posts",
    icon: <BarChart2 className="w-4 h-4" />,
    description: "Total posts published on Substack",
    getValue: (s) => s?.substack?.postCount ?? 0,
  },
  {
    key: "githubFollowers",
    label: "GitHub Followers",
    icon: <Users className="w-4 h-4" />,
    description: "GitHub follower count",
    getValue: (s) => s?.github?.followers ?? 0,
  },
  {
    key: "githubStars",
    label: "GitHub Stars",
    icon: <Star className="w-4 h-4" />,
    description: "Total stars across all GitHub repositories",
    getValue: (s) => s?.github?.totalStars ?? 0,
  },
  {
    key: "platforms",
    label: "Platform Presence",
    icon: <Globe className="w-4 h-4" />,
    description: "Number of social/media platforms with a confirmed link",
    getValue: (_s, platformCount) => platformCount,
  },
  {
    key: "books",
    label: "Books Count",
    icon: <BookOpen className="w-4 h-4" />,
    description: "Number of books in the library for this author",
    getValue: () => 0, // overridden in leaderboard useMemo
  },
  {
    key: "tags",
    label: "Tag Count",
    icon: <Tag className="w-4 h-4" />,
    description: "Number of tags applied to this author's profile",
    getValue: () => 0, // overridden in leaderboard useMemo
  },
];

// ── Row component ─────────────────────────────────────────────────────────────
interface LeaderRowProps {
  rank: number;
  entry: LeaderboardEntry;
  maxValue: number;
  metric: MetricDef;
  platformLinks: { authorId?: number | null; [key: string]: string | number | null | undefined } | null;
  socialStats: SocialStatsResult | null;
}

function LeaderRow({ rank, entry, maxValue, metric, platformLinks, socialStats }: LeaderRowProps) {
  const author = AUTHORS.find((a) => canonicalName(a.name) === canonicalName(entry.authorName));
  const avatar = getAuthorAvatar(entry.authorName);
  const catColor = author ? CATEGORY_COLORS[author.category] ?? "#6b7280" : "#6b7280";
  const pct = maxValue > 0 ? Math.max(2, (entry.value / maxValue) * 100) : 0;
  const rankColor = RANK_COLORS[rank - 1];
  const rankLabel = RANK_LABELS[rank - 1];
  const isTop3 = rank <= 3;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isTop3 ? "bg-muted/10" : ""}`}>
      {/* Rank badge */}
      <div className="w-10 shrink-0 flex flex-col items-center">
        {isTop3 ? (
          <>
            <Trophy className="w-5 h-5" style={{ color: rankColor }} />
            <span className="text-[10px] font-bold mt-0.5" style={{ color: rankColor }}>{rankLabel}</span>
          </>
        ) : (
          <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
        )}
      </div>

      {/* Avatar + name */}
      <Link href={`/author/${encodeURIComponent(entry.authorName)}`} className="flex items-center gap-3 min-w-0 w-56 shrink-0">
        <img
          src={avatar}
          alt={entry.authorName}
          className="w-10 h-10 rounded-full object-cover border-2 shrink-0"
          style={{ borderColor: catColor }}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">{entry.authorName}</p>
          {author && (
            <p className="text-[10px] text-muted-foreground truncate">{author.category.split(" & ")[0]}</p>
          )}
        </div>
      </Link>

      {/* Progress bar + value */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: isTop3 ? rankColor : catColor,
              }}
            />
          </div>
          <span className="text-sm font-bold text-foreground w-16 text-right shrink-0">
            {formatCount(entry.value)}
          </span>
        </div>
      </div>

      {/* Compare button */}
      <Link href={`/compare?a=${encodeURIComponent(entry.authorName)}`} className="shrink-0">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
          <BarChart className="w-3 h-3" />
          Compare
        </Button>
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("wikipedia");

  // Fetch social stats for all authors
  const socialStatsQuery = trpc.authorProfiles.getSocialStats.useQuery(
    { authorName: undefined },
    { staleTime: 5 * 60 * 1000 }
  );

  // Fetch platform links for platform count
  const platformLinksQuery = trpc.authorProfiles.getAllPlatformLinks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Fetch per-author tag slugs for tag count metric
  const authorTagSlugsQuery = trpc.tags.getAllAuthorTagSlugs.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const platformCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of platformLinksQuery.data ?? []) {
      map.set(canonicalName(row.authorName), countPlatformLinks(row));
    }
    return map;
  }, [platformLinksQuery.data]);

  const platformLinksMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof platformLinksQuery.data>[number]>();
    for (const row of platformLinksQuery.data ?? []) {
      map.set(canonicalName(row.authorName), row);
    }
    return map;
  }, [platformLinksQuery.data]);

  const socialStatsMap = useMemo(() => {
    const map = new Map<string, SocialStatsResult | null>();
    for (const row of socialStatsQuery.data ?? []) {
      map.set(canonicalName(row.authorName), row.socialStats as SocialStatsResult | null);
    }
    return map;
  }, [socialStatsQuery.data]);

  const metric = METRICS.find((m) => m.key === activeMetric)!;

  // Build per-author tag count map
  const authorTagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of authorTagSlugsQuery.data ?? []) {
      map.set(canonicalName(row.authorName), row.tagSlugs.length);
    }
    return map;
  }, [authorTagSlugsQuery.data]);

  const leaderboard = useMemo((): LeaderboardEntry[] => {
    const entries: LeaderboardEntry[] = AUTHORS.map((author) => {
      const canonical = canonicalName(author.name);
      const stats = socialStatsMap.get(canonical) ?? null;
      const platformCount = platformCountMap.get(canonical) ?? 0;
      const bookCount = author.books.length;
      const tagCount = authorTagCountMap.get(canonical) ?? 0;
      // Override getValue for book/tag metrics since they don't use socialStats
      let value: number;
      if (activeMetric === "books") value = bookCount;
      else if (activeMetric === "tags") value = tagCount;
      else value = metric.getValue(stats, platformCount);
      return {
        authorName: author.name,
        value,
        rawStats: stats,
        platformCount,
        bookCount,
        tagCount,
      };
    });
    return entries
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [socialStatsMap, platformCountMap, authorTagCountMap, metric, activeMetric]);

  const maxValue = leaderboard[0]?.value ?? 1;
  const isLoading = socialStatsQuery.isLoading || platformLinksQuery.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Leaderboard" }]} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground font-[Playfair_Display] flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Author Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Top authors ranked by social presence and reach</p>
        </div>

        {/* Metric tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeMetric === m.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-4 italic">{metric.description}</p>

        {/* Leaderboard table */}
        <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading stats…</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No data available for this metric yet.</p>
              <p className="text-xs mt-1">Run "Enrich Social Stats" from the Admin Console to populate data.</p>
            </div>
          ) : (
            leaderboard.map((entry, i) => (
              <LeaderRow
                key={entry.authorName}
                rank={i + 1}
                entry={entry}
                maxValue={maxValue}
                metric={metric}
                platformLinks={platformLinksMap.get(canonicalName(entry.authorName)) ?? null}
                socialStats={entry.rawStats}
              />
            ))
          )}
        </div>

        {leaderboard.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing top {leaderboard.length} authors with data. Stats sourced from Wikipedia, GitHub, and Substack public APIs.
          </p>
        )}
      </div>
    </div>
  );
}
