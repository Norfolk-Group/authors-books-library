/**
 * InformationToolsTab — Admin Console external tools configuration panel.
 *
 * Sections:
 *   1. Apify — web scraping configuration (API token status, actor settings)
 *   2. Replicate — AI image generation configuration (API token status, model settings)
 *   3. Perplexity — web-grounded research (API token status, model selection)
 *   4. Google Books — book metadata (API key status)
 *   5. Wikipedia — author research (no API key needed, usage info)
 *
 * Each section shows:
 *   - Connection status (green/red dot based on env var presence)
 *   - Configuration options relevant to that tool
 *   - Links to documentation
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Image,
  Search,
  BookOpen,
  Globe,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";

interface InformationToolsTabProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

// ── Perplexity model options ──────────────────────────────────────────────────
const PERPLEXITY_MODELS = [
  { id: "sonar-pro", label: "Sonar Pro", description: "Best quality, web-grounded research" },
  { id: "sonar", label: "Sonar", description: "Fast, cost-effective web search" },
  { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro", description: "Deep reasoning with citations" },
  { id: "sonar-reasoning", label: "Sonar Reasoning", description: "Reasoning with web search" },
];

// ── Apify actor options ───────────────────────────────────────────────────────
const APIFY_ACTORS = [
  { id: "apify/cheerio-scraper", label: "Cheerio Scraper", description: "Fast HTML scraping (default)" },
  { id: "apify/puppeteer-scraper", label: "Puppeteer Scraper", description: "Full browser rendering" },
];

// ── Replicate model options ───────────────────────────────────────────────────
const REPLICATE_MODELS = [
  { id: "black-forest-labs/flux-1.1-pro", label: "FLUX 1.1 Pro", description: "Best quality portraits (default)" },
  { id: "black-forest-labs/flux-schnell", label: "FLUX Schnell", description: "Fast generation, lower quality" },
  { id: "stability-ai/sdxl", label: "SDXL", description: "Stable Diffusion XL" },
];

// ── Tool status check ─────────────────────────────────────────────────────────
function ToolStatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge variant="outline" className="gap-1 text-[10px] border-green-500/30 text-green-600">
      <CheckCircle2 className="w-3 h-3" />
      Configured
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-[10px] border-red-500/30 text-red-500">
      <XCircle className="w-3 h-3" />
      Not configured
    </Badge>
  );
}

// ── Tool section card ─────────────────────────────────────────────────────────
function ToolCard({
  title,
  description,
  icon: Icon,
  configured,
  docsUrl,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  configured: boolean;
  docsUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {title}
                <ToolStatusBadge configured={configured} />
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="View documentation"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </CardHeader>
      {children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function InformationToolsTab({ settings, updateSettings }: InformationToolsTabProps) {
  const toolStatusQuery = trpc.admin.getToolStatus.useQuery(undefined, { staleTime: 30_000 });
  const [testingApify] = useState(false);

  const toolStatus = toolStatusQuery.data ?? {
    apify: false,
    replicate: false,
    perplexity: false,
    googleBooks: false,
    tavily: false,
    youtube: false,
    twitter: false,
  };
  const ytSummaryQuery = trpc.admin.getYouTubeStatsSummary.useQuery(undefined, {
    staleTime: 60_000,
    enabled: toolStatus.youtube ?? false,
  });
  const enrichSocialStatsMutation = trpc.authorProfiles.enrichSocialStatsBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`YouTube/Social enrichment complete`, {
        description: `Processed ${data.processed} authors — ${data.succeeded} succeeded`,
      });
    },
    onError: (err) => {
      toast.error(`Enrichment failed`, { description: err.message });
    },
  });

  const handleTestApify = () => {
    toast.info("Apify connection test", {
      description: toolStatus.apify
        ? "APIFY_API_TOKEN is configured."
        : "APIFY_API_TOKEN is not set. Add it in project secrets.",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Information Tools</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure external APIs and services used for data enrichment, web scraping, and image generation.
          API keys are managed as environment secrets in the project settings.
        </p>
      </div>

      <Separator />

      {/* ── Apify ── */}
      <ToolCard
        title="Apify"
        description="Web scraping platform used to fetch book covers from Amazon and other sources. Uses the Cheerio Scraper actor by default."
        icon={Zap}
        configured={toolStatus.apify}
        docsUrl="https://docs.apify.com"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Default Actor</Label>
            <Select
              value={settings.apifyActor ?? "apify/cheerio-scraper"}
              onValueChange={(v) => updateSettings({ apifyActor: v } as Partial<AppSettings>)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APIFY_ACTORS.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <div>
                      <div className="font-medium">{a.label}</div>
                      <div className="text-muted-foreground text-[10px]">{a.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={handleTestApify}
              disabled={testingApify || !toolStatus.apify}
            >
              {testingApify ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Test Connection
            </Button>
            {!toolStatus.apify && (
              <p className="text-[10px] text-muted-foreground">
                Set APIFY_API_TOKEN in project secrets to enable.
              </p>
            )}
          </div>
        </div>
      </ToolCard>

      {/* ── Replicate ── */}
      <ToolCard
        title="Replicate"
        description="AI model hosting platform used for author avatar generation. Runs FLUX 1.1 Pro for photorealistic headshots."
        icon={Image}
        configured={toolStatus.replicate}
        docsUrl="https://replicate.com/docs"
      >
        <div className="space-y-2">
          <Label className="text-xs font-medium">Default Model</Label>
          <Select
            value={settings.replicateModel ?? "black-forest-labs/flux-1.1-pro"}
            onValueChange={(v) => updateSettings({ replicateModel: v } as Partial<AppSettings>)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPLICATE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-muted-foreground text-[10px]">{m.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!toolStatus.replicate && (
            <p className="text-[10px] text-muted-foreground">
              Set REPLICATE_API_TOKEN in project secrets to enable.
            </p>
          )}
        </div>
      </ToolCard>

      {/* ── Perplexity ── */}
      <ToolCard
        title="Perplexity"
        description="Web-grounded AI research API used for author bio enrichment, link discovery, and book summary generation. Provides real-time web citations."
        icon={Search}
        configured={toolStatus.perplexity}
        docsUrl="https://docs.perplexity.ai"
      >
        <div className="space-y-2">
          <Label className="text-xs font-medium">Default Research Model</Label>
          <Select
            value={settings.perplexityModel ?? "sonar-pro"}
            onValueChange={(v) => updateSettings({ perplexityModel: v } as Partial<AppSettings>)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERPLEXITY_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-muted-foreground text-[10px]">{m.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!toolStatus.perplexity && (
            <p className="text-[10px] text-muted-foreground">
              Set PERPLEXITY_API_KEY in project secrets to enable.
            </p>
          )}
        </div>
      </ToolCard>

      {/* ── Google Books ── */}
      <ToolCard
        title="Google Books API"
        description="Used to fetch book metadata including covers, descriptions, ratings, and publication details. Free tier available."
        icon={BookOpen}
        configured={toolStatus.googleBooks}
        docsUrl="https://developers.google.com/books"
      >
        {!toolStatus.googleBooks && (
          <p className="text-[10px] text-muted-foreground">
            Set GOOGLE_BOOKS_API_KEY in project secrets to enable. Without it, the app falls back to Open Library.
          </p>
        )}
        {toolStatus.googleBooks && (
          <p className="text-[10px] text-muted-foreground">
            Google Books API is active. Book enrichment will use it as the primary metadata source.
          </p>
        )}
      </ToolCard>

      {/* ── Wikipedia ── */}
      <ToolCard
        title="Wikipedia"
        description="Used for author biography research, photo sourcing, and factual verification. No API key required — uses the public Wikipedia REST API."
        icon={Globe}
        configured={true}
        docsUrl="https://www.mediawiki.org/wiki/API:Main_page"
      >
        <p className="text-[10px] text-muted-foreground">
          Wikipedia access is always available. Author research uses it to extract bios, photos, and key facts before passing to the LLM for synthesis.
        </p>
      </ToolCard>

      {/* ── Tavily ── */}
      <ToolCard
        title="Tavily"
        description="AI-optimized search API used for image discovery (author headshots, book covers) and supplementary web research."
        icon={Link2}
        configured={toolStatus.tavily ?? false}
        docsUrl="https://docs.tavily.com"
      >
        {!(toolStatus.tavily ?? false) && (
          <p className="text-[10px] text-muted-foreground">
            Set TAVILY_API_KEY in project secrets to enable enhanced image search.
          </p>
        )}
        {(toolStatus.tavily ?? false) && (
          <p className="text-[10px] text-muted-foreground">
            Tavily is active. Image search for author headshots and book covers will use it as a supplementary source.
          </p>
        )}
      </ToolCard>

      {/* ── YouTube ── */}
      <ToolCard
        title="YouTube Data API"
        description="Fetches channel subscriber counts, video counts, and view stats for authors with YouTube channels. Used in Social Stats enrichment."
        icon={Zap}
        configured={toolStatus.youtube ?? false}
        docsUrl="https://developers.google.com/youtube/v3"
      >
        {!(toolStatus.youtube ?? false) && (
          <p className="text-[10px] text-muted-foreground">
            Set YOUTUBE_API_KEY in project secrets to enable YouTube channel stats enrichment.
          </p>
        )}
        {(toolStatus.youtube ?? false) && (
          <div className="space-y-3">
            {ytSummaryQuery.data && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{ytSummaryQuery.data.withYouTube}</p>
                  <p className="text-[10px] text-muted-foreground">Authors with YouTube</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{ytSummaryQuery.data.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total enriched</p>
                </div>
              </div>
            )}
            {ytSummaryQuery.data?.topAuthors && ytSummaryQuery.data.topAuthors.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Top Channels</p>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {ytSummaryQuery.data.topAuthors.map((a) => (
                    <a
                      key={a.authorName}
                      href={a.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors group"
                    >
                      {(a.s3AvatarUrl || a.avatarUrl) ? (
                        <img
                          src={a.s3AvatarUrl || a.avatarUrl || ""}
                          alt={a.authorName}
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted shrink-0 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-muted-foreground">
                            {a.authorName.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="flex-1 text-[11px] font-medium truncate">{a.authorName}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {a.subscriberCount >= 1_000_000
                          ? `${(a.subscriberCount / 1_000_000).toFixed(1)}M`
                          : a.subscriberCount >= 1_000
                          ? `${(a.subscriberCount / 1_000).toFixed(0)}K`
                          : a.subscriberCount.toString()}
                        {" subs"}
                      </span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {ytSummaryQuery.isLoading && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading stats…
              </div>
            )}
            {ytSummaryQuery.data?.withYouTube === 0 && !ytSummaryQuery.isLoading && (
              <p className="text-[10px] text-muted-foreground">
                No YouTube channel data yet. Run enrichment below to populate.
              </p>
            )}
            <Separator className="my-1" />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={enrichSocialStatsMutation.isPending}
                onClick={() =>
                  enrichSocialStatsMutation.mutate(
                    { phases: ["A"], limit: 20, onlyMissing: true },
                    { onSuccess: () => ytSummaryQuery.refetch() }
                  )
                }
              >
                {enrichSocialStatsMutation.isPending ? (
                  <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Enriching…</>
                ) : (
                  <><Zap className="w-3 h-3 mr-1.5" />Enrich Missing (up to 20)</>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={ytSummaryQuery.isFetching}
                onClick={() => ytSummaryQuery.refetch()}
              >
                {ytSummaryQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>
        )}
      </ToolCard>

      {/* ── Twitter/X ── */}
      <ToolCard
        title="Twitter / X API"
        description="Fetches follower counts and tweet stats for authors with Twitter/X profiles. Requires a Bearer Token with Basic ($100/mo) or Pro tier access."
        icon={Globe}
        configured={toolStatus.twitter ?? false}
        docsUrl="https://developer.twitter.com/en/portal/dashboard"
      >
        {!(toolStatus.twitter ?? false) && (
          <p className="text-[10px] text-muted-foreground">
            Set TWITTER_BEARER_TOKEN in project secrets to enable Twitter/X follower count enrichment.
          </p>
        )}
        {(toolStatus.twitter ?? false) && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Twitter Bearer Token is configured. Note: the Twitter Free tier does not include user lookup credits.
              A Basic ($100/mo) or Pro ($5,000/mo) plan is required to fetch follower counts.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={enrichSocialStatsMutation.isPending}
              onClick={() => enrichSocialStatsMutation.mutate({ phases: ["A"], limit: 20, onlyMissing: true })}
            >
              {enrichSocialStatsMutation.isPending ? (
                <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Enriching…</>
              ) : (
                <><Zap className="w-3 h-3 mr-1.5" />Enrich Missing (up to 20)</>
              )}
            </Button>
          </div>
        )}
      </ToolCard>
    </div>
  );
}

export default InformationToolsTab;
