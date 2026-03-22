/**
 * ResearchQualityBadge
 *
 * A visually prominent badge that communicates the research quality level
 * of an author's AI-generated portrait and profile data.
 *
 * Three tiers:
 *   - High   → emerald  → ShieldCheck icon  → "5+ verified reference photos"
 *   - Medium → amber    → ShieldAlert icon  → "2–4 reference photos"
 *   - Low    → rose     → ShieldX icon      → "Limited reference photos"
 *
 * Design principles:
 *   - Icon + label always visible (no icon-only mode)
 *   - Solid colour fill for immediate recognition
 *   - Tooltip on hover with a plain-language explanation
 *   - Scales cleanly at sm and default sizes
 */

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ResearchQuality = "high" | "medium" | "low";

interface ResearchQualityBadgeProps {
  confidence: ResearchQuality;
  /** "sm" renders a compact inline pill; "md" (default) renders a slightly larger badge */
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<
  ResearchQuality,
  {
    label: string;
    shortLabel: string;
    Icon: React.FC<{ className?: string }>;
    /** Tailwind classes for the badge container */
    badge: string;
    /** Tailwind classes for the icon */
    icon: string;
    tooltip: string;
  }
> = {
  high: {
    label: "High Research Quality",
    shortLabel: "High Quality",
    Icon: ShieldCheck,
    badge:
      "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    tooltip:
      "Portrait generated from 5 or more verified, high-resolution reference photos. Feature accuracy is high — face shape, colouring, and distinctive details are well-preserved.",
  },
  medium: {
    label: "Medium Research Quality",
    shortLabel: "Medium Quality",
    Icon: ShieldAlert,
    badge:
      "bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
    icon: "text-amber-600 dark:text-amber-400",
    tooltip:
      "Portrait generated from 2–4 reference photos. Most key features are captured, though some details may vary slightly from the real person.",
  },
  low: {
    label: "Low Research Quality",
    shortLabel: "Low Quality",
    Icon: ShieldX,
    badge:
      "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40",
    icon: "text-rose-600 dark:text-rose-400",
    tooltip:
      "Only one or no suitable reference photos were found. The portrait is AI-generated from text descriptions and may not closely resemble the real person.",
  },
};

export function ResearchQualityBadge({
  confidence,
  size = "md",
  className = "",
}: ResearchQualityBadgeProps) {
  const cfg = CONFIG[confidence];
  const { Icon } = cfg;

  const isSm = size === "sm";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`
            inline-flex items-center gap-1.5 rounded-full font-semibold cursor-default select-none
            transition-opacity duration-150 hover:opacity-90
            ${isSm
              ? "px-2 py-0.5 text-[10px]"
              : "px-2.5 py-1 text-[11px]"
            }
            ${cfg.badge}
            ${className}
          `}
          aria-label={cfg.label}
        >
          <Icon
            className={`flex-shrink-0 ${isSm ? "w-3 h-3" : "w-3.5 h-3.5"} ${cfg.icon}`}
          />
          <span className="uppercase tracking-wider leading-none">
            {isSm ? cfg.shortLabel : cfg.label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={6}
        className="max-w-[240px] p-3 z-50"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.icon}`} />
          <p className="text-xs font-semibold">{cfg.label}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {cfg.tooltip}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
