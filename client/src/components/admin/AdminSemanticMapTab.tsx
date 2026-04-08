/**
 * AdminSemanticMapTab.tsx
 *
 * Semantic Interest Heatmap — visualizes all authors as a 2D scatter plot
 * grouped by their primary tag/category.
 *
 * Two modes:
 *   - Fast (default): deterministic category-based layout, loads instantly
 *   - Semantic: Gemini embeddings + PCA projection, computed on demand (~30s)
 *
 * Features:
 *   - SVG scatter plot with zoom/pan (mouse wheel + drag)
 *   - Dots colored by category, sized by book count
 *   - Hover tooltip showing author name, category, book count
 *   - Category legend with toggle to highlight/dim
 *   - "Compute Semantic Map" button for full embedding-based layout
 */

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Cpu, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";

// ── Category color palette ─────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Leadership":           "#3B82F6",  // blue-500
  "Management":           "#60A5FA",  // blue-400
  "Psychology":           "#8B5CF6",  // violet-500
  "Behavior":             "#A78BFA",  // violet-400
  "Business":             "#F59E0B",  // amber-500
  "Entrepreneurship":     "#FBBF24",  // amber-400
  "Communication":        "#10B981",  // emerald-500
  "Influence":            "#34D399",  // emerald-400
  "Self-Help":            "#EC4899",  // pink-500
  "Personal Development": "#F472B6",  // pink-400
  "Productivity":         "#06B6D4",  // cyan-500
  "Performance":          "#22D3EE",  // cyan-400
  "Technology":           "#6366F1",  // indigo-500
  "AI":                   "#818CF8",  // indigo-400
  "Science":              "#14B8A6",  // teal-500
  "Research":             "#2DD4BF",  // teal-400
  "Philosophy":           "#64748B",  // slate-500
  "Ethics":               "#94A3B8",  // slate-400
  "Finance":              "#EF4444",  // red-500
  "Economics":            "#F87171",  // red-400
  "Health":               "#22C55E",  // green-500
  "Wellbeing":            "#4ADE80",  // green-400
  "Creativity":           "#F97316",  // orange-500
  "Innovation":           "#FB923C",  // orange-400
  "Social Impact":        "#A855F7",  // purple-500
  "Spirituality":         "#C084FC",  // purple-400
  "Mindfulness":          "#D8B4FE",  // purple-300
  "History":              "#78716C",  // stone-500
  "Culture":              "#A8A29E",  // stone-400
  "Marketing":            "#0EA5E9",  // sky-500
  "Sales":                "#38BDF8",  // sky-400
  "Strategy":             "#D97706",  // amber-600
  "Negotiation":          "#B45309",  // amber-700
  "Neuroscience":         "#7C3AED",  // violet-600
  "Sociology":            "#6D28D9",  // violet-700
  "Politics":             "#1D4ED8",  // blue-700
  "Journalism":           "#0369A1",  // sky-700
  "Uncategorized":        "#9CA3AF",  // gray-400
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#9CA3AF";
}

// ── Tooltip component ─────────────────────────────────────────────────────

type TooltipData = {
  name: string;
  category: string;
  bookCount: number;
  x: number;
  y: number;
};

// ── Main component ────────────────────────────────────────────────────────

export function AdminSemanticMapTab() {
  // Map state
  const [mode, setMode] = useState<"fast" | "semantic">("fast");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [highlightedCategories, setHighlightedCategories] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Data fetching
  const { data: fastMap, isLoading: fastLoading, refetch: refetchFast } = trpc.semanticMap.getFastMap.useQuery();

  const semanticMutation = trpc.semanticMap.getSemanticMap.useMutation({
    onSuccess: () => {
      toast.success("Semantic map computed", { description: "PCA projection complete." });
      setMode("semantic");
    },
    onError: (err) => {
      toast.error("Semantic map failed", { description: err.message });
    },
  });

  const activeData = mode === "semantic" && semanticMutation.data
    ? semanticMutation.data
    : fastMap;

  const isLoading = fastLoading || (mode === "semantic" && semanticMutation.isPending);

  // Category toggle
  const toggleCategory = useCallback((cat: string) => {
    setHighlightedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearHighlights = useCallback(() => setHighlightedCategories(new Set()), []);

  // Zoom/pan handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(5, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // SVG dimensions
  const SVG_W = 800;
  const SVG_H = 600;

  // Compute dot radius from book count
  const dotRadius = (bookCount: number) => Math.max(4, Math.min(12, 4 + bookCount * 0.8));

  // Sorted categories for legend
  const categories = useMemo(() => activeData?.categories ?? [], [activeData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Semantic Interest Heatmap</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "fast"
              ? "Category-based layout — authors grouped by primary tag. Instant load."
              : "Semantic layout — authors positioned by Gemini embedding similarity (PCA projection)."}
            {activeData && (
              <span className="ml-2 text-xs text-muted-foreground/70">
                {activeData.points.length} authors · computed {new Date(activeData.computedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchFast(); setMode("fast"); }}
            disabled={fastLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => semanticMutation.mutate({ limit: 150 })}
            disabled={semanticMutation.isPending}
            title="Compute full semantic map using Gemini embeddings + PCA (~30-60s)"
          >
            {semanticMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
            )}
            {semanticMutation.isPending ? "Computing…" : "Compute Semantic Map"}
          </Button>
        </div>
      </div>

      {/* Main visualization area */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {semanticMutation.isPending
                  ? "Computing semantic embeddings… this may take 30-60 seconds"
                  : "Loading author map…"}
              </p>
            </div>
          </div>
        ) : !activeData || activeData.points.length === 0 ? (
          <div className="flex items-center justify-center h-[600px]">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="relative">
            {/* Zoom controls */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                onClick={() => setZoom(z => Math.min(5, z * 1.2))}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                onClick={resetView}
                title="Reset view"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* SVG scatter plot */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ height: 600, cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="80" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 80 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-border" />
                </pattern>
              </defs>
              <rect width={SVG_W} height={SVG_H} fill="url(#grid)" opacity="0.4" />

              {/* Transformed group for zoom/pan */}
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
                 style={{ transformOrigin: `${SVG_W / 2}px ${SVG_H / 2}px` }}>

                {/* Category cluster labels (fast mode only) */}
                {mode === "fast" && categories.map(cat => {
                  const catPoints = activeData.points.filter(p => p.category === cat);
                  if (catPoints.length === 0) return null;
                  const cx = catPoints.reduce((s, p) => s + p.x, 0) / catPoints.length;
                  const cy = catPoints.reduce((s, p) => s + p.y, 0) / catPoints.length;
                  const isHighlighted = highlightedCategories.size === 0 || highlightedCategories.has(cat);
                  return (
                    <text
                      key={cat}
                      x={cx * SVG_W}
                      y={cy * SVG_H - 18}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="600"
                      fill={getCategoryColor(cat)}
                      opacity={isHighlighted ? 0.7 : 0.15}
                      style={{ pointerEvents: "none" }}
                    >
                      {cat}
                    </text>
                  );
                })}

                {/* Dots */}
                {activeData.points.map(point => {
                  const isHighlighted = highlightedCategories.size === 0 || highlightedCategories.has(point.category);
                  const r = dotRadius(point.bookCount);
                  const color = getCategoryColor(point.category);
                  return (
                    <circle
                      key={point.id}
                      cx={point.x * SVG_W}
                      cy={point.y * SVG_H}
                      r={r}
                      fill={color}
                      fillOpacity={isHighlighted ? 0.85 : 0.15}
                      stroke={color}
                      strokeWidth={isHighlighted ? 1.5 : 0.5}
                      strokeOpacity={isHighlighted ? 1 : 0.3}
                      style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                      onMouseEnter={(e) => {
                        const svg = svgRef.current;
                        if (!svg) return;
                        const rect = svg.getBoundingClientRect();
                        setTooltip({
                          name: point.name,
                          category: point.category,
                          bookCount: point.bookCount,
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            </svg>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute z-20 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm"
                style={{
                  left: Math.min(tooltip.x + 12, SVG_W - 180),
                  top: Math.max(tooltip.y - 60, 8),
                  maxWidth: 200,
                }}
              >
                <p className="font-semibold leading-tight">{tooltip.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tooltip.category}</p>
                {tooltip.bookCount > 0 && (
                  <p className="text-xs text-muted-foreground">{tooltip.bookCount} book{tooltip.bookCount !== 1 ? "s" : ""}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {categories.length > 0 && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Categories</h3>
            {highlightedCategories.size > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearHighlights}>
                Clear filter
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const count = activeData?.points.filter(p => p.category === cat).length ?? 0;
              const isHighlighted = highlightedCategories.size === 0 || highlightedCategories.has(cat);
              const color = getCategoryColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all duration-150 ${
                    isHighlighted
                      ? "border-transparent shadow-sm"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  style={isHighlighted ? { backgroundColor: color + "22", borderColor: color + "66", color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isHighlighted ? color : "#9CA3AF" }}
                  />
                  {cat}
                  <span className={`ml-0.5 ${isHighlighted ? "opacity-70" : "opacity-50"}`}>({count})</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Click categories to highlight · Scroll to zoom · Drag to pan · Dot size = book count
          </p>
        </div>
      )}

      {/* Mode info */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        <strong>Fast mode:</strong> Authors are grouped by their primary tag in a deterministic layout.
        Click <strong>Compute Semantic Map</strong> to use Gemini embeddings + PCA for a true semantic layout
        where proximity reflects topical similarity (takes ~30-60 seconds for 150 authors).
      </div>
    </div>
  );
}
