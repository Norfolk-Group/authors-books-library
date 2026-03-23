/**
 * FreshnessDot — a small colored indicator showing how fresh/stale
 * an entity's enrichment data is. Renders as a tiny dot with a tooltip
 * showing the breakdown of each enrichment dimension.
 *
 * Freshness levels:
 * - fresh  (green)  → enriched within 7 days
 * - recent (amber)  → enriched within 30 days
 * - stale  (red)    → enriched more than 30 days ago
 * - never  (gray)   → never enriched
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type FreshnessLevel = "fresh" | "recent" | "stale" | "never";

/** Thresholds in milliseconds */
const FRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const RECENT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

export function getFreshnessLevel(enrichedAt: Date | string | null | undefined): FreshnessLevel {
  if (!enrichedAt) return "never";
  const ts = typeof enrichedAt === "string" ? new Date(enrichedAt).getTime() : enrichedAt.getTime();
  if (isNaN(ts)) return "never";
  const ageMs = Date.now() - ts;
  if (ageMs <= FRESH_THRESHOLD_MS) return "fresh";
  if (ageMs <= RECENT_THRESHOLD_MS) return "recent";
  return "stale";
}

export function getAgeLabel(enrichedAt: Date | string | null | undefined): string {
  if (!enrichedAt) return "never";
  const ts = typeof enrichedAt === "string" ? new Date(enrichedAt).getTime() : enrichedAt.getTime();
  if (isNaN(ts)) return "never";
  const ageMs = Date.now() - ts;
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return "1 week ago";
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

const DOT_COLORS: Record<FreshnessLevel, string> = {
  fresh:  "bg-emerald-500",
  recent: "bg-amber-400",
  stale:  "bg-red-400",
  never:  "bg-zinc-400",
};

const LABEL_COLORS: Record<FreshnessLevel, string> = {
  fresh:  "text-emerald-400",
  recent: "text-amber-400",
  stale:  "text-red-400",
  never:  "text-zinc-500",
};

const LEVEL_LABELS: Record<FreshnessLevel, string> = {
  fresh:  "Fresh",
  recent: "Recent",
  stale:  "Stale",
  never:  "Never",
};

export interface FreshnessDimension {
  label: string;
  level: FreshnessLevel;
  age: string;
}

interface FreshnessDotProps {
  /** The overall freshness level (worst of all dimensions) */
  overall: FreshnessLevel;
  /** Breakdown of each enrichment dimension */
  dimensions?: FreshnessDimension[];
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS class */
  className?: string;
}

/**
 * Compute overall freshness from an array of dimensions.
 * Returns the worst (stalest) level.
 */
export function computeOverallFreshness(dimensions: FreshnessDimension[]): FreshnessLevel {
  const priority: FreshnessLevel[] = ["never", "stale", "recent", "fresh"];
  let overall: FreshnessLevel = "fresh";
  for (const d of dimensions) {
    if (priority.indexOf(d.level) < priority.indexOf(overall)) {
      overall = d.level;
    }
  }
  return overall;
}

/**
 * Build author freshness dimensions from the getAllFreshness query result.
 */
export function buildAuthorDimensions(row: {
  enrichedAt?: Date | string | null;
  socialStatsEnrichedAt?: Date | string | null;
  lastLinksEnrichedAt?: Date | string | null;
  authorDescriptionCachedAt?: Date | string | null;
  richBioEnrichedAt?: string | null;
}): FreshnessDimension[] {
  return [
    { label: "Bio/Metadata", level: getFreshnessLevel(row.enrichedAt), age: getAgeLabel(row.enrichedAt) },
    { label: "Social Stats", level: getFreshnessLevel(row.socialStatsEnrichedAt), age: getAgeLabel(row.socialStatsEnrichedAt) },
    { label: "Platform Links", level: getFreshnessLevel(row.lastLinksEnrichedAt), age: getAgeLabel(row.lastLinksEnrichedAt) },
    { label: "Avatar Research", level: getFreshnessLevel(row.authorDescriptionCachedAt), age: getAgeLabel(row.authorDescriptionCachedAt) },
    { label: "Rich Bio", level: getFreshnessLevel(row.richBioEnrichedAt), age: getAgeLabel(row.richBioEnrichedAt) },
  ];
}

/**
 * Build book freshness dimensions from the getAllFreshness query result.
 */
export function buildBookDimensions(row: {
  enrichedAt?: Date | string | null;
  lastSummaryEnrichedAt?: Date | string | null;
  richSummaryEnrichedAt?: string | null;
}): FreshnessDimension[] {
  return [
    { label: "Metadata", level: getFreshnessLevel(row.enrichedAt), age: getAgeLabel(row.enrichedAt) },
    { label: "Summary", level: getFreshnessLevel(row.lastSummaryEnrichedAt), age: getAgeLabel(row.lastSummaryEnrichedAt) },
    { label: "Rich Summary", level: getFreshnessLevel(row.richSummaryEnrichedAt), age: getAgeLabel(row.richSummaryEnrichedAt) },
  ];
}

export function FreshnessDot({ overall, dimensions, size = "sm", className = "" }: FreshnessDotProps) {
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  const dot = (
    <span
      className={`inline-block rounded-full ${DOT_COLORS[overall]} ${dotSize} ${className}`}
      aria-label={`Enrichment freshness: ${LEVEL_LABELS[overall]}`}
    />
  );

  if (!dimensions || dimensions.length === 0) return dot;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center cursor-help ${className}`}>
          {dot}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-zinc-900 border-zinc-700 text-zinc-200 p-3 max-w-[240px]"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`inline-block rounded-full ${DOT_COLORS[overall]} w-2 h-2`} />
            <span className="text-xs font-medium text-zinc-100">
              {LEVEL_LABELS[overall]} overall
            </span>
          </div>
          {dimensions.map((dim) => (
            <div key={dim.label} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-zinc-400">{dim.label}</span>
              <span className={`font-medium ${LABEL_COLORS[dim.level]}`}>
                {dim.age}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default FreshnessDot;
