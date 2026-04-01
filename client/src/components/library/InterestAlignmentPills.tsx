/**
 * InterestAlignmentPills
 *
 * Shows the top 2–3 user interest alignment scores for an author card.
 * Renders colored pills with a mini score bar.
 * Only rendered when the user is authenticated and has interest scores.
 *
 * Usage: <InterestAlignmentPills authorName="Adam Grant" />
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

interface InterestAlignmentPillsProps {
  authorName: string;
  maxPills?: number;
}

export function InterestAlignmentPills({ authorName, maxPills = 3 }: InterestAlignmentPillsProps) {
  const { isAuthenticated } = useAuth();

  // Fetch scores for this author — only when authenticated
  const { data: scores } = trpc.userInterests.getAuthorScores.useQuery(
    { authorName },
    {
      enabled: isAuthenticated,
      staleTime: 5 * 60_000,
    }
  );

  // Fetch interest definitions for color/label lookup
  const { data: interests } = trpc.userInterests.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const interestMap = useMemo(() => {
    const map = new Map<number, { topic: string; color: string; category: string | null }>();
    for (const i of interests ?? []) {
      map.set(i.id, { topic: i.topic, color: i.color ?? "#6366F1", category: i.category });
    }
    return map;
  }, [interests]);

  const topScores = useMemo(() => {
    if (!scores || scores.length === 0) return [];
    return [...scores]
      .filter((s) => s.score >= 5) // Only show meaningful alignments
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPills);
  }, [scores, maxPills]);

  if (!isAuthenticated || topScores.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-1 mt-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {topScores.map((score) => {
        const interest = interestMap.get(score.interestId);
        if (!interest) return null;
        const pct = Math.round((score.score / 10) * 100);
        const color = interest.color;

        return (
          <Tooltip key={score.id}>
            <TooltipTrigger asChild>
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-default select-none"
                style={{
                  borderColor: color + "60",
                  backgroundColor: color + "18",
                  color: color,
                }}
              >
                <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate max-w-[80px]">{interest.topic}</span>
                {/* Mini score bar */}
                <div className="w-8 h-1 rounded-full bg-black/10 overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[9px] opacity-80">{score.score}/10</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] p-2.5">
              <p className="font-semibold text-xs mb-1">{interest.topic}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {score.rationale ?? `Alignment score: ${score.score}/10`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
