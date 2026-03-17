/**
 * ResearchCascade.tsx
 * Visual documentation of the enrichment waterfall used to populate
 * author photos, author bios, book covers, and book metadata.
 *
 * Shows live DB counts for each tier so you can see exactly how many
 * authors/books were resolved at each stage.
 */
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Database, Globe, Bot, Camera, BookOpen, FileText, Star, Link2, Hash, type LucideIcon } from "lucide-react";

// ── Colour palette for tier badges ───────────────────────────────────────────
const TIER_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-700" },
  2: { bg: "bg-violet-50 dark:bg-violet-950", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-700" },
  3: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-700" },
  4: { bg: "bg-rose-50 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-700" },
  5: { bg: "bg-gray-50 dark:bg-gray-900", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
};

// ── Stat pill component ───────────────────────────────────────────────────────
function StatPill({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 min-w-[90px]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="font-semibold text-foreground ml-1">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ── Tier card component ───────────────────────────────────────────────────────
function TierCard({
  tier,
  title,
  description,
  icon: Icon,
  stats,
  fallbackNote,
}: {
  tier: number;
  title: string;
  description: string;
  icon: LucideIcon;
  stats: { label: string; value: number; total: number; barColor: string }[];
  fallbackNote?: string;
}) {
  const c = TIER_COLORS[tier] ?? TIER_COLORS[5];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${c.border} bg-background`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>Tier {tier}</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-border">
          {stats.map((s) => (
            <StatPill key={s.label} label={s.label} value={s.value} total={s.total} color={s.barColor} />
          ))}
        </div>
      )}
      {/* Fallback note */}
      {fallbackNote && (
        <p className="text-[11px] text-muted-foreground italic border-t border-border pt-2">{fallbackNote}</p>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResearchCascade() {
  const [, navigate] = useLocation();
  const { data: authorStats, isLoading: authorLoading, refetch: refetchAuthors } = trpc.cascade.authorStats.useQuery();
  const { data: bookStats, isLoading: bookLoading, refetch: refetchBooks } = trpc.cascade.bookStats.useQuery();

  const isLoading = authorLoading || bookLoading;
  const aTotal = authorStats?.total ?? 0;
  const bTotal = bookStats?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Library
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Research Cascade</h1>
            <p className="text-[11px] text-muted-foreground">Enrichment waterfall — sources, tiers, and live DB counts</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchAuthors(); refetchBooks(); }}
          disabled={isLoading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">

        {/* ── Overview strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Authors in DB", value: aTotal, icon: Camera, color: "text-blue-600" },
            { label: "With Photo", value: authorStats?.withPhoto ?? 0, icon: CheckCircle2, color: "text-green-600" },
            { label: "Books in DB", value: bTotal, icon: BookOpen, color: "text-violet-600" },
            { label: "With Cover", value: bookStats?.withCover ?? 0, icon: CheckCircle2, color: "text-green-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-2xl font-bold text-foreground">{item.value}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── Author Photo Waterfall ── */}
        <section>
          <SectionHeader icon={Camera} title="Author Photo Waterfall" subtitle="5-tier cascade — each tier is tried in order; first success wins" />
          <div className="space-y-3">
            <TierCard
              tier={1}
              title="Wikipedia REST API"
              description="Fetches the author's Wikipedia page summary photo via the REST v1 /page/summary endpoint. Validated with Gemini vision (confidence ≥ 0.6)."
              icon={Globe}
              stats={[
                { label: "From Wikipedia", value: authorStats?.fromWikipedia ?? 0, total: aTotal, barColor: "bg-blue-500" },
                { label: "Source unknown", value: authorStats?.sourceUnknown ?? 0, total: aTotal, barColor: "bg-blue-200" },
              ]}
            />
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">if not found ↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <TierCard
              tier={2}
              title="Tavily Image Search"
              description="Searches the web for a professional headshot using Tavily's image search API. Validated with Gemini vision (confidence ≥ 0.5)."
              icon={Globe}
              stats={[
                { label: "From Tavily", value: authorStats?.fromTavily ?? 0, total: aTotal, barColor: "bg-violet-500" },
              ]}
            />
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">if not found ↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <TierCard
              tier={3}
              title="Apify Web Scraper"
              description="Runs a Cheerio-based Apify actor to scrape the author's official website, publisher page, or LinkedIn profile for a headshot. Validated with Gemini (confidence ≥ 0.4)."
              icon={Database}
              stats={[
                { label: "From Apify", value: authorStats?.fromApify ?? 0, total: aTotal, barColor: "bg-amber-500" },
              ]}
            />
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">if not found ↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <TierCard
              tier={5}
              title="Replicate AI Portrait (fallback)"
              description="If all real-photo sources fail, generates a professional AI portrait using Replicate's Stable Diffusion model. Marked as AI-generated in S3 key (ai- prefix)."
              icon={Bot}
              stats={[
                { label: "AI Generated", value: authorStats?.fromAI ?? 0, total: aTotal, barColor: "bg-gray-500" },
                { label: "S3 Mirrored", value: authorStats?.withS3Photo ?? 0, total: aTotal, barColor: "bg-gray-400" },
                { label: "No Photo Yet", value: authorStats?.noPhoto ?? 0, total: aTotal, barColor: "bg-rose-400" },
              ]}
              fallbackNote="All photos (real or AI) are mirrored to Manus S3 for stable CDN serving."
            />
          </div>
        </section>

        {/* ── Author Bio Waterfall ── */}
        <section>
          <SectionHeader icon={FileText} title="Author Bio Waterfall" subtitle="Wikipedia first, LLM fallback — social links via Wikidata" />
          <div className="space-y-3">
            <TierCard
              tier={1}
              title="Wikipedia REST API + Wikidata"
              description="Fetches the first 2 sentences of the author's Wikipedia extract as the bio. Also queries Wikidata for the author's website, Twitter, and LinkedIn URLs."
              icon={Globe}
              stats={[
                { label: "With Bio", value: authorStats?.withBio ?? 0, total: aTotal, barColor: "bg-blue-500" },
                { label: "Social Links", value: authorStats?.withSocialLinks ?? 0, total: aTotal, barColor: "bg-blue-400" },
                { label: "No Bio Yet", value: authorStats?.noBio ?? 0, total: aTotal, barColor: "bg-rose-400" },
              ]}
            />
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">if Wikipedia returns nothing ↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <TierCard
              tier={2}
              title="LLM Fallback (Built-in Forge)"
              description="If Wikipedia returns no extract, the built-in LLM generates a 2-sentence professional bio based on the author's name and known works. Kept under 300 characters."
              icon={Bot}
              stats={[]}
              fallbackNote="LLM bios are merged into the 'With Bio' count above — no separate source column in DB yet."
            />
          </div>
        </section>

        {/* ── Book Cover Waterfall ── */}
        <section>
          <SectionHeader icon={BookOpen} title="Book Cover Waterfall" subtitle="Google Books first, Amazon Apify scrape as fallback" />
          <div className="space-y-3">
            <TierCard
              tier={1}
              title="Google Books API"
              description="Queries the Google Books Volumes API with title + author. Extracts the thumbnail cover URL, summary, ISBN, publisher, published date, and rating. Falls back to a broader title-only query if the first search returns no match."
              icon={Globe}
              stats={[
                { label: "With Cover", value: bookStats?.withCover ?? 0, total: bTotal, barColor: "bg-violet-500" },
                { label: "With Summary", value: bookStats?.withSummary ?? 0, total: bTotal, barColor: "bg-violet-400" },
                { label: "With ISBN", value: bookStats?.withIsbn ?? 0, total: bTotal, barColor: "bg-blue-400" },
                { label: "With Rating", value: bookStats?.withRating ?? 0, total: bTotal, barColor: "bg-amber-400" },
                { label: "With Publisher", value: bookStats?.withPublisher ?? 0, total: bTotal, barColor: "bg-green-400" },
              ]}
            />
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">if no cover found ↓</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <TierCard
              tier={2}
              title="Amazon.com Apify Scraper"
              description="Runs a Cheerio-based Apify actor to scrape Amazon search results for the book. Extracts the product cover image, ASIN, and Amazon product URL. Triggered manually via the 'Scrape Cover' button in the book detail panel."
              icon={Database}
              stats={[
                { label: "With Amazon URL", value: bookStats?.withAmazonUrl ?? 0, total: bTotal, barColor: "bg-amber-500" },
                { label: "S3 Mirrored", value: bookStats?.withS3Cover ?? 0, total: bTotal, barColor: "bg-green-500" },
                { label: "No Cover Yet", value: bookStats?.noCover ?? 0, total: bTotal, barColor: "bg-rose-400" },
              ]}
              fallbackNote="All covers (Google Books or Amazon) are mirrored to Manus S3 for stable CDN serving."
            />
          </div>
        </section>

        {/* ── Book Metadata Summary ── */}
        <section>
          <SectionHeader icon={Hash} title="Book Metadata Summary" subtitle="All metadata sourced from Google Books API" />
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[
                { label: "Total Books in DB", value: bTotal, icon: BookOpen, color: "text-violet-600" },
                { label: "Enriched (any field)", value: bookStats?.withEnrichedAt ?? 0, icon: CheckCircle2, color: "text-green-600" },
                { label: "With Cover", value: bookStats?.withCover ?? 0, icon: Camera, color: "text-blue-600" },
                { label: "S3 Mirrored", value: bookStats?.withS3Cover ?? 0, icon: Database, color: "text-green-600" },
                { label: "With Summary", value: bookStats?.withSummary ?? 0, icon: FileText, color: "text-violet-600" },
                { label: "With ISBN", value: bookStats?.withIsbn ?? 0, icon: Hash, color: "text-gray-600" },
                { label: "With Amazon URL", value: bookStats?.withAmazonUrl ?? 0, icon: Link2, color: "text-amber-600" },
                { label: "With Rating", value: bookStats?.withRating ?? 0, icon: Star, color: "text-amber-500" },
                { label: "No Cover Yet", value: bookStats?.noCover ?? 0, icon: AlertCircle, color: "text-rose-500" },
                { label: "No Summary Yet", value: bookStats?.noSummary ?? 0, icon: AlertCircle, color: "text-rose-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                  <div>
                    <div className="text-base font-bold text-foreground">{item.value}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── S3 Mirroring note ── */}
        <section>
          <div className="rounded-xl border border-border bg-card p-5 flex gap-4 items-start">
            <Database className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">S3 Mirroring — Why it matters</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All sourced images (author photos and book covers) are mirrored to Manus S3 storage immediately after retrieval.
                This prevents broken images caused by source URL changes, CDN expiry, or third-party rate limits.
                The S3 URL is served as the primary image URL in the UI; the original source URL is kept in the DB for auditing.
                Mirror jobs run automatically after each enrichment pass, or can be triggered manually from the Preferences page.
              </p>
            </div>
          </div>
        </section>

        {/* Norfolk AI branding */}
        <div className="flex justify-center pt-4 pb-2">
          <span className="text-[11px] text-muted-foreground">Powered by Norfolk AI</span>
        </div>

      </div>
    </div>
  );
}
