/**
 * InfoTip — a small question-mark icon that shows a descriptive tooltip on hover.
 * Used across all Admin panels to explain every menu item, field, button, and stat.
 *
 * Usage:
 *   <InfoTip text="This field controls the maximum number of results returned." />
 *   <InfoTip text="..." side="right" />
 */

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  /** The tooltip text to display */
  text: string;
  /** Tooltip placement relative to the trigger icon */
  side?: "top" | "right" | "bottom" | "left";
  /** Additional className for the icon wrapper */
  className?: string;
  /** Icon size in pixels (default 13) */
  size?: number;
}

export function InfoTip({ text, side = "top", className, size = 13 }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-150 shrink-0",
            className
          )}
          aria-label={`Info: ${text}`}
        >
          <Info style={{ width: size, height: size }} />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs text-xs leading-relaxed"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * LabelWithTip — a label + InfoTip pair for form fields and config rows.
 * Usage:
 *   <LabelWithTip label="Max Results" tip="Maximum number of search results to return per query." />
 */
export function LabelWithTip({
  label,
  tip,
  side = "top",
  className,
}: {
  label: string;
  tip: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span>{label}</span>
      <InfoTip text={tip} side={side} />
    </span>
  );
}
