/**
 * CascadeTab - Research Cascade stats tab for the Admin Console.
 * Shows author enrichment, book enrichment, and cover pipeline stats.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AuthorStats {
  total: number;
  withPhoto: number;
  withS3Photo: number;
  withBio: number;
  withSocialLinks: number;
  withEnrichedAt: number;
  fromWikipedia: number;
  fromTavily: number;
  fromApify: number;
  fromAI: number;
  sourceUnknown: number;
}

interface BookStats {
  total: number;
  withCover: number;
  withS3Cover: number;
  withSummary: number;
  withRating: number;
  withEnrichedAt: number;
  enrichmentLevelCounts?: {
    fullyEnriched: number;
    wellEnriched: number;
    partiallyEnriched: number;
    basic: number;
  };
}

interface ScrapeStats {
  total: number;
  needsScrape: number;
  needsMirror: number;
  withS3: number;
}

interface CascadeTabProps {
  aStats?: AuthorStats | null;
  bStats?: BookStats | null;
  scrapeStats?: ScrapeStats | null;
}

function StatRow({ label, value, total }: { label: string; value: number; total?: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {total != null && total > 0 && (
          <>
            <Progress value={(value / total) * 100} className="w-16 h-1.5" />
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {Math.round((value / total) * 100)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function CascadeTab({ aStats, bStats, scrapeStats }: CascadeTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Author Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Author Enrichment</CardTitle>
            <CardDescription className="text-xs">Database coverage for author profiles</CardDescription>
          </CardHeader>
          <CardContent>
            {aStats ? (
              <div className="space-y-2">
                <StatRow label="Total Profiles" value={aStats.total} />
                <StatRow label="With Avatar" value={aStats.withPhoto} total={aStats.total} />
                <StatRow label="With S3 Avatar" value={aStats.withS3Photo} total={aStats.total} />
                <StatRow label="With Bio" value={aStats.withBio} total={aStats.total} />
                <StatRow label="With Social Links" value={aStats.withSocialLinks} total={aStats.total} />
                <StatRow label="Enriched" value={aStats.withEnrichedAt} total={aStats.total} />
                <div className="pt-2 mt-2 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Avatar Sources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Wikipedia", value: aStats.fromWikipedia },
                      { label: "Tavily", value: aStats.fromTavily },
                      { label: "Apify", value: aStats.fromApify },
                      { label: "AI Generated", value: aStats.fromAI },
                      { label: "Unknown", value: aStats.sourceUnknown },
                    ]
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <Badge key={s.label} variant="outline" className="text-[10px] px-1.5 py-0">
                          {s.label}: {s.value}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Book Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Book Enrichment</CardTitle>
            <CardDescription className="text-xs">Database coverage for book profiles</CardDescription>
          </CardHeader>
          <CardContent>
            {bStats ? (
              <div className="space-y-2">
                <StatRow label="Total Profiles" value={bStats.total} />
                <StatRow label="With Cover" value={bStats.withCover} total={bStats.total} />
                <StatRow label="With S3 Cover" value={bStats.withS3Cover} total={bStats.total} />
                <StatRow label="With Summary" value={bStats.withSummary} total={bStats.total} />
                <StatRow label="With Rating" value={bStats.withRating} total={bStats.total} />
                <StatRow label="Enriched" value={bStats.withEnrichedAt} total={bStats.total} />
                {bStats.enrichmentLevelCounts && bStats.total > 0 && (
                  <div className="pt-3 mt-2 border-t border-border/50">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-2">Enrichment Level Distribution</p>
                    {[
                      { label: "Fully Enriched", value: bStats.enrichmentLevelCounts.fullyEnriched, color: "bg-emerald-500" },
                      { label: "Well Enriched", value: bStats.enrichmentLevelCounts.wellEnriched, color: "bg-blue-500" },
                      { label: "Partially Enriched", value: bStats.enrichmentLevelCounts.partiallyEnriched, color: "bg-amber-500" },
                      { label: "Basic", value: bStats.enrichmentLevelCounts.basic, color: "bg-zinc-400" },
                    ].map((level) => (
                      <div key={level.label} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-muted-foreground w-28 shrink-0">{level.label}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${level.color} transition-all duration-500`}
                            style={{ width: `${Math.round((level.value / bStats.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium w-6 text-right">{level.value}</span>
                        <span className="text-[10px] text-muted-foreground w-7 text-right">
                          {Math.round((level.value / bStats.total) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scrape/Mirror Stats */}
      {scrapeStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Cover Pipeline</CardTitle>
            <CardDescription className="text-xs">Amazon scraping and S3 mirroring status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Books", value: scrapeStats.total },
                { label: "Need Scraping", value: scrapeStats.needsScrape },
                { label: "Need Mirroring", value: scrapeStats.needsMirror },
                { label: "In S3 CDN", value: scrapeStats.withS3 },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
