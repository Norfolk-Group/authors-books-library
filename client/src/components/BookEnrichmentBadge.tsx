/**
 * BookEnrichmentBadge
 *
 * Displays the data-completeness level of a book profile as a coloured pill.
 * Mirrors the ResearchQualityBadge pattern used on Author cards.
 *
 * Tiers (based on getBookEnrichmentLevel scoring):
 *   complete  (5-6 fields) → amber/gold  → BookCheck icon
 *   enriched  (3-4 fields) → emerald     → BookOpen icon
 *   basic     (1-2 fields) → sky blue    → BookDashed icon
 *   none      → badge is not rendered
 */

import { BookCheck, BookOpen, BookDashed } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BookEnrichmentLevel } from "@/components/library/libraryConstants";

interface BookEnrichmentBadgeProps {
  level: BookEnrichmentLevel;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<
  Exclude<BookEnrichmentLevel, "none">,
  {
    label: string;
    Icon: React.FC<{ className?: string }>;
    badge: string;
    icon: string;
    tooltip: string;
  }
> = {
  complete: {
    label: "Complete",
    Icon: BookCheck,
    badge:
      "bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
    icon: "text-amber-600 dark:text-amber-400",
    tooltip:
      "Fully enriched — cover, summary, rating, themes, Amazon link, and publication date are all present.",
  },
  enriched: {
    label: "Enriched",
    Icon: BookOpen,
    badge:
      "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    tooltip:
      "Mostly enriched — most key fields are present (cover, summary, rating, or themes).",
  },
  basic: {
    label: "Basic",
    Icon: BookDashed,
    badge:
      "bg-sky-500/15 text-sky-700 border border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40",
    icon: "text-sky-600 dark:text-sky-400",
    tooltip:
      "Partially enriched — only one or two data fields have been populated so far.",
  },
};

export function BookEnrichmentBadge({
  level,
  size = "sm",
  className = "",
}: BookEnrichmentBadgeProps) {
  if (level === "none") return null;

  const cfg = CONFIG[level];
  const { Icon } = cfg;
  const isSm = size === "sm";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`
            inline-flex items-center gap-1 rounded-full font-semibold cursor-default select-none
            transition-opacity duration-150 hover:opacity-90
            ${isSm ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"}
            ${cfg.badge}
            ${className}
          `}
          aria-label={`Book data: ${cfg.label}`}
        >
          <Icon className={`flex-shrink-0 ${isSm ? "w-2.5 h-2.5" : "w-3 h-3"} ${cfg.icon}`} />
          <span className="uppercase tracking-wider leading-none">{cfg.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-[220px] p-3 z-50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.icon}`} />
          <p className="text-xs font-semibold">Data {cfg.label}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{cfg.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
