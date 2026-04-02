/**
 * BookFilterBar — extracted from Home.tsx
 * Renders the three filter chip rows shown in the Books tab:
 *   1. Possession/Status chips (All / Owned / Read / Reading / Unread / Wishlist / Reference / Borrowed)
 *   2. Format chips (All Formats / Physical / Digital-eBook / Audiobook)
 *   3. Enrichment chips (All / Fully Enriched / Well Enriched / Partially Enriched / Basic)
 */
import type { BookEnrichmentLevel } from "@/components/library/libraryConstants";

interface BookFilterBarProps {
  possessionFilter: string;
  setPossessionFilter: (v: string) => void;
  formatFilter: string;
  setFormatFilter: (v: string) => void;
  enrichFilter: BookEnrichmentLevel | "all";
  setEnrichFilter: (v: BookEnrichmentLevel | "all") => void;
}

const POSSESSION_OPTIONS = [
  { value: "all",       label: "All Books",  icon: "📚" },
  { value: "owned",     label: "Owned",      icon: "✅" },
  { value: "read",      label: "Read",       icon: "📖" },
  { value: "reading",   label: "Reading",    icon: "🔖" },
  { value: "unread",    label: "Unread",     icon: "📕" },
  { value: "wishlist",  label: "Wishlist",   icon: "⭐" },
  { value: "reference", label: "Reference",  icon: "🔍" },
  { value: "borrowed",  label: "Borrowed",   icon: "🤝" },
] as const;

const FORMAT_OPTIONS = [
  { value: "all",      label: "All Formats",    icon: "📦" },
  { value: "physical", label: "Physical",        icon: "📗" },
  { value: "digital",  label: "Digital / eBook", icon: "💻" },
  { value: "audio",    label: "Audiobook",       icon: "🎧" },
] as const;

const ENRICH_OPTIONS = [
  { value: "all",      label: "All",               color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))" },
  { value: "complete", label: "Fully Enriched",    color: "#d97706",                      bg: "#fef3c7" },
  { value: "enriched", label: "Well Enriched",     color: "#059669",                      bg: "#d1fae5" },
  { value: "basic",    label: "Partially Enriched",color: "#0284c7",                      bg: "#e0f2fe" },
  { value: "none",     label: "Basic",             color: "#6b7280",                      bg: "#f3f4f6" },
] as const;

function FilterChip({
  isActive,
  onClick,
  children,
  activeColor,
  activeBg,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor?: string;
  activeBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
      style={{
        backgroundColor: isActive ? (activeBg ?? "hsl(var(--primary) / 0.12)") : "transparent",
        color: isActive ? (activeColor ?? "hsl(var(--primary))") : "hsl(var(--muted-foreground))",
        borderColor: isActive ? (activeColor ?? "hsl(var(--primary))") : "hsl(var(--border))",
      }}
    >
      {children}
    </button>
  );
}

export function BookFilterBar({
  possessionFilter,
  setPossessionFilter,
  formatFilter,
  setFormatFilter,
  enrichFilter,
  setEnrichFilter,
}: BookFilterBarProps) {
  return (
    <>
      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground font-medium">Status:</span>
        {POSSESSION_OPTIONS.map(({ value, label, icon }) => (
          <FilterChip key={value} isActive={possessionFilter === value} onClick={() => setPossessionFilter(value)}>
            <span>{icon}</span> {label}
          </FilterChip>
        ))}
        {possessionFilter !== "all" && (
          <button onClick={() => setPossessionFilter("all")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">
            Clear
          </button>
        )}
      </div>

      {/* Format chips */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground font-medium">Format:</span>
        {FORMAT_OPTIONS.map(({ value, label, icon }) => (
          <FilterChip key={value} isActive={formatFilter === value} onClick={() => setFormatFilter(value)}>
            <span>{icon}</span> {label}
          </FilterChip>
        ))}
        {formatFilter !== "all" && (
          <button onClick={() => setFormatFilter("all")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">
            Clear
          </button>
        )}
      </div>

      {/* Enrichment chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground font-medium">Enrichment:</span>
        {ENRICH_OPTIONS.map(({ value, label, color, bg }) => (
          <FilterChip
            key={value}
            isActive={enrichFilter === value}
            onClick={() => setEnrichFilter(value as BookEnrichmentLevel | "all")}
            activeColor={color}
            activeBg={bg}
          >
            {label}
          </FilterChip>
        ))}
        {enrichFilter !== "all" && (
          <button onClick={() => setEnrichFilter("all")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">
            Clear
          </button>
        )}
      </div>
    </>
  );
}
