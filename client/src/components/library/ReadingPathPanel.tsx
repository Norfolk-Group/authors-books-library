/**
 * ReadingPathPanel.tsx
 *
 * Curated Reading Path — a guided sequence of books starting from a seed book.
 *
 * Two modes:
 *   - "Quick" (default): same-author books + related books from DB. Loads instantly.
 *   - "Semantic" (on-demand): Neon vector similarity + LLM rationale. ~3-8s.
 *
 * Features:
 *   - Horizontal scrollable step cards with cover images
 *   - Similarity score badge per step
 *   - LLM-generated "why read this next" rationale
 *   - Thematic bridge between consecutive books
 *   - Overall path theme label
 *   - Multi-step loading indicator with estimated time (C1, M6)
 *   - 15-second timeout fallback to quick path (C1)
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Zap,
  RefreshCw,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  bookId: number;
  bookTitle: string;
  accentColor?: string;
}

/** Multi-step loading messages shown during the AI path generation */
const LOADING_STEPS = [
  { label: "Analyzing themes…", ms: 0 },
  { label: "Finding vector neighbors…", ms: 2500 },
  { label: "Building path structure…", ms: 5000 },
  { label: "Generating AI rationale…", ms: 8000 },
  { label: "Almost ready…", ms: 12000 },
];

const SEMANTIC_TIMEOUT_MS = 15_000;

export function ReadingPathPanel({ bookId, bookTitle, accentColor = "#6366f1" }: Props) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"quick" | "semantic">("quick");
  const [pathLength] = useState(5);
  const [loadingStep, setLoadingStep] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Quick path (fast, no Neon)
  const {
    data: quickPath,
    isLoading: quickLoading,
  } = trpc.readingPath.getQuick.useQuery(
    { seedBookId: bookId, pathLength },
    { staleTime: 1000 * 60 * 10 }
  );

  // Semantic path (on-demand)
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const {
    data: semanticPath,
    isLoading: semanticLoading,
    refetch: refetchSemantic,
  } = trpc.readingPath.getPath.useQuery(
    { seedBookId: bookId, pathLength, withRationale: true },
    { enabled: semanticEnabled, staleTime: 1000 * 60 * 30 }
  );

  // Clear timers when semantic loading finishes or component unmounts
  useEffect(() => {
    if (!semanticLoading && semanticEnabled) {
      clearAllTimers();
    }
  }, [semanticLoading, semanticEnabled]);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function clearAllTimers() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
  }

  function handleComputeSemantic() {
    setMode("semantic");
    setSemanticEnabled(true);
    setTimedOut(false);
    setLoadingStep(0);
    clearAllTimers();
    refetchSemantic();

    // Schedule loading step label transitions
    LOADING_STEPS.forEach((step, i) => {
      if (step.ms > 0) {
        const t = setTimeout(() => setLoadingStep(i), step.ms);
        stepTimersRef.current.push(t);
      }
    });

    // 15-second timeout fallback
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      setMode("quick");
      clearAllTimers();
    }, SEMANTIC_TIMEOUT_MS);
  }

  const activePath = mode === "semantic" && semanticPath
    ? semanticPath
    : quickPath;

  const isLoading = mode === "quick" ? quickLoading : semanticLoading;

  if (quickLoading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Reading Path
          </h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-32 h-48 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!activePath || activePath.steps.length === 0) return null;

  return (
    <section>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Reading Path
            </h2>
            {activePath.theme && (
              <p className="text-sm font-medium text-foreground mt-0.5">
                {activePath.theme}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mode badge */}
          <Badge
            variant="outline"
            className="text-xs gap-1"
            style={{ borderColor: accentColor + "40", color: accentColor }}
          >
            {activePath.mode === "semantic" ? (
              <><Sparkles className="w-3 h-3" />Semantic</>
            ) : (
              <><Zap className="w-3 h-3" />Quick</>
            )}
          </Badge>
          {/* Compute semantic button */}
          {activePath.mode !== "semantic" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleComputeSemantic}
                  disabled={semanticLoading}
                >
                  {semanticLoading ? (
                    <><RefreshCw className="w-3 h-3 animate-spin" />Computing…</>
                  ) : (
                    <><Sparkles className="w-3 h-3" />AI Path</>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Use Neon vector similarity + AI to generate a smarter reading path (~8s)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Timeout fallback notice */}
      {timedOut && (
        <div className="flex items-center gap-2 mb-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>AI path timed out — showing quick path instead. Try again in a moment.</span>
        </div>
      )}

      {/* Path visualization */}
      {isLoading ? (
        <div>
          {/* Multi-step loading indicator (C1, M6) */}
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: accentColor }} />
            <span className="font-medium" style={{ color: accentColor }}>
              {LOADING_STEPS[loadingStep]?.label ?? "Generating path…"}
            </span>
            <span className="text-muted-foreground/60 ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~8s
            </span>
          </div>
          {/* Step progress dots */}
          <div className="flex gap-1 mb-3">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i <= loadingStep ? "24px" : "8px",
                  backgroundColor: i <= loadingStep ? accentColor : accentColor + "30",
                }}
              />
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-32 h-48 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-0 overflow-x-auto pb-3 -mx-1 px-1">
          {activePath.steps.map((step: (typeof activePath.steps)[number], idx: number) => (
            <div key={step.bookId || step.bookTitle} className="flex items-center gap-0 flex-shrink-0">
              {/* Step card */}
              <div
                className="group relative w-32 cursor-pointer rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden flex-shrink-0"
                onClick={() => {
                  if (step.bookId) setLocation(`/books/${step.bookId}`);
                }}
              >
                {/* Cover image */}
                <div className="relative w-full aspect-[2/3] bg-muted overflow-hidden">
                  {step.coverUrl ? (
                    <img
                      src={step.coverUrl}
                      alt={step.bookTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `${accentColor}15` }}
                    >
                      <BookOpen
                        className="w-8 h-8 opacity-30"
                        style={{ color: accentColor }}
                      />
                    </div>
                  )}
                  {/* Step number badge */}
                  <div
                    className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {step.stepNumber}
                  </div>
                  {/* Similarity score */}
                  {step.similarityScore > 0 && (
                    <div className="absolute bottom-1.5 right-1.5">
                      <Badge
                        className="text-[9px] px-1 py-0 h-4 font-semibold border-0"
                        style={{
                          backgroundColor: accentColor + "cc",
                          color: "white",
                        }}
                      >
                        {(step.similarityScore * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-2">
                  <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-foreground">
                    {step.bookTitle}
                  </p>
                  {step.authorName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {step.authorName}
                    </p>
                  )}
                  {/* Bridge label */}
                  {step.bridge && (
                    <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2 italic leading-tight">
                      {step.bridge}
                    </p>
                  )}
                </div>

                {/* Hover overlay with rationale */}
                {step.rationale && (
                  <div className="absolute inset-0 bg-background/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 flex flex-col justify-center">
                    <p className="text-[10px] leading-relaxed text-foreground line-clamp-6">
                      {step.rationale}
                    </p>
                    {step.bookId ? (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-medium" style={{ color: accentColor }}>
                        <span>View book</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Arrow connector between steps */}
              {idx < activePath.steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-muted-foreground mt-1">
        {activePath.mode === "semantic"
          ? "Powered by Neon pgvector semantic similarity. Hover cards for AI rationale."
          : "Quick path based on author and library data. Click \"AI Path\" for semantic recommendations."}
      </p>
    </section>
  );
}
