/**
 * ReadingStats — Personal reading dashboard for Ricardo Cidale's Library.
 * Route: /stats
 *
 * Sections:
 *   1. Summary KPI cards (total books, read, reading, wishlist, avg rating)
 *   2. Books by Status (donut-style bar)
 *   3. Books by Format (horizontal bar chart)
 *   4. Reading Progress (books currently in progress with percent bars)
 *   5. Books Read Over Time (monthly timeline)
 *   6. Recently Finished books list
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { BookOpen, TrendingUp, Star, CheckCircle, Clock, Bookmark } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0 truncate capitalize">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground w-6 text-right flex-shrink-0">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReadingStats() {
  const { data: stats, isLoading } = trpc.bookProfiles.getReadingStats.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Books currently in progress (have a readingProgressPercent > 0 and not finished)
  const inProgress = useMemo(() => {
    if (!stats) return [];
    return stats.books
      .filter((b) => b.readingProgressPercent != null && b.readingProgressPercent > 0 && !b.readingFinishedAt)
      .sort((a, b) => (b.readingProgressPercent ?? 0) - (a.readingProgressPercent ?? 0));
  }, [stats]);

  // Recently finished books (last 10)
  const recentlyFinished = useMemo(() => {
    if (!stats) return [];
    return stats.books
      .filter((b) => b.readingFinishedAt != null)
      .sort((a, b) => new Date(b.readingFinishedAt!).getTime() - new Date(a.readingFinishedAt!).getTime())
      .slice(0, 10);
  }, [stats]);

  // Books read per year (from readDates)
  const byYear = useMemo(() => {
    if (!stats) return [];
    const map: Record<string, number> = {};
    for (const d of stats.readDates) {
      const year = new Date(d).getFullYear().toString();
      map[year] = (map[year] ?? 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [stats]);

  const maxByYear = useMemo(() => Math.max(...byYear.map(([, v]) => v), 1), [byYear]);

  const STATUS_COLORS: Record<string, string> = {
    read: "bg-emerald-500",
    reading: "bg-blue-500",
    wishlist: "bg-amber-400",
    owned: "bg-violet-500",
    unknown: "bg-muted-foreground/30",
  };

  const FORMAT_COLORS: Record<string, string> = {
    physical: "bg-chart-1",
    ebook: "bg-chart-2",
    audio: "bg-chart-3",
    pdf: "bg-chart-4",
    unknown: "bg-muted-foreground/30",
  };

  const maxStatus = stats ? Math.max(...Object.values(stats.byStatus), 1) : 1;
  const maxFormat = stats ? Math.max(...Object.values(stats.byFormat), 1) : 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading reading stats…</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No data available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Library", href: "/" }, { label: "Reading Stats" }]} />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* ── Title ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Reading Stats</h1>
            <p className="text-sm text-muted-foreground">Your personal library at a glance</p>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard icon={<BookOpen className="w-5 h-5" />} label="Total Books" value={stats.total} />
          <KpiCard icon={<CheckCircle className="w-5 h-5" />} label="Read" value={stats.readCount} sub={`${Math.round((stats.readCount / stats.total) * 100)}% of library`} />
          <KpiCard icon={<Clock className="w-5 h-5" />} label="Reading Now" value={stats.readingCount} />
          <KpiCard icon={<Bookmark className="w-5 h-5" />} label="Wishlist" value={stats.wishlistCount} />
          <KpiCard
            icon={<Star className="w-5 h-5" />}
            label="Avg Rating"
            value={stats.avgRating != null ? `${stats.avgRating}★` : "—"}
          />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="In Progress" value={inProgress.length} />
        </div>

        {/* ── Books by Status ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Books by Status</h2>
          <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
            {Object.entries(stats.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <HorizontalBar
                  key={status}
                  label={status}
                  value={count}
                  max={maxStatus}
                  color={STATUS_COLORS[status] ?? "bg-primary"}
                />
              ))}
          </div>
        </section>

        {/* ── Books by Format ── */}
        {Object.keys(stats.byFormat).length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Books by Format</h2>
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
              {Object.entries(stats.byFormat)
                .sort(([, a], [, b]) => b - a)
                .map(([format, count]) => (
                  <HorizontalBar
                    key={format}
                    label={format}
                    value={count}
                    max={maxFormat}
                    color={FORMAT_COLORS[format] ?? "bg-primary"}
                  />
                ))}
            </div>
          </section>
        )}

        {/* ── Currently Reading ── */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Currently Reading ({inProgress.length})
            </h2>
            <div className="space-y-3">
              {inProgress.map((book) => (
                <a
                  key={book.bookTitle}
                  href={`/book/${encodeURIComponent(book.bookTitle)}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {book.bookTitle}
                    </p>
                    {book.authorName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{book.authorName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${book.readingProgressPercent ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                        {book.readingProgressPercent ?? 0}%
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Books Read by Year ── */}
        {byYear.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Books Read by Year</h2>
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
              {byYear.map(([year, count]) => (
                <HorizontalBar
                  key={year}
                  label={year}
                  value={count}
                  max={maxByYear}
                  color="bg-primary"
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently Finished ── */}
        {recentlyFinished.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Recently Finished
            </h2>
            <div className="space-y-2">
              {recentlyFinished.map((book) => (
                <a
                  key={book.bookTitle}
                  href={`/book/${encodeURIComponent(book.bookTitle)}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {book.bookTitle}
                    </p>
                    {book.authorName && (
                      <p className="text-xs text-muted-foreground">{book.authorName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {book.rating && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {book.rating.toFixed(1)}
                      </span>
                    )}
                    {book.readingFinishedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(book.readingFinishedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div className="pb-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors border border-border"
          >
            ← Back to Library
          </a>
        </div>

      </main>
    </div>
  );
}
