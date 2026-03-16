/**
 * CategoryChart — horizontal bar chart showing books per category.
 * Uses Recharts (already in project deps).
 * Clicking a bar filters the books grid to that category.
 * Theme-aware: uses CSS custom properties for all colors.
 */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { BOOKS, CATEGORIES, CATEGORY_COLORS } from "@/lib/libraryData";

interface CategoryChartProps {
  /** Currently active category filter (empty string = all) */
  activeCategory: string;
  /** Called when user clicks a bar — pass the category name or "" to clear */
  onCategoryClick: (category: string) => void;
}

interface ChartEntry {
  category: string;
  count: number;
  color: string;
  shortLabel: string;
}

// Shorten long category names for the Y-axis
const SHORT_LABELS: Record<string, string> = {
  "Behavioral Science & Psychology": "Behavioral Science",
  "Business & Entrepreneurship": "Business & Entrepr.",
  "Communication & Storytelling": "Communication",
  "History & Biography": "History & Biography",
  "Leadership & Management": "Leadership",
  "Sales & Negotiation": "Sales & Negotiation",
  "Self-Help & Productivity": "Self-Help",
  "Strategy & Economics": "Strategy & Economics",
  "Technology & Futurism": "Technology",
};

// Custom tooltip — uses CSS vars for full theme compatibility
const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-card-foreground">{d.category}</p>
      <p className="text-muted-foreground">
        <span className="font-bold text-card-foreground">{d.count}</span> books
      </p>
    </div>
  );
};

export function CategoryChart({ activeCategory, onCategoryClick }: CategoryChartProps) {
  const data: ChartEntry[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) counts[cat] = 0;
    for (const book of BOOKS) {
      if (book.category in counts) counts[book.category]++;
    }
    return CATEGORIES.map((cat) => ({
      category: cat,
      count: counts[cat] ?? 0,
      color: CATEGORY_COLORS[cat] ?? "var(--muted-foreground)",
      shortLabel: SHORT_LABELS[cat] ?? cat,
    })).sort((a, b) => b.count - a.count);
  }, []);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Books by Category
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} books across {data.length} categories · click a bar to filter
          </p>
        </div>
        {activeCategory && (
          <button
            onClick={() => onCategoryClick("")}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, "dataMax + 4"]}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={130}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            />
            <Bar
              dataKey="count"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry: ChartEntry) => {
                onCategoryClick(
                  activeCategory === entry.category ? "" : entry.category
                );
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={entry.color}
                  opacity={
                    !activeCategory || activeCategory === entry.category ? 1 : 0.25
                  }
                />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
