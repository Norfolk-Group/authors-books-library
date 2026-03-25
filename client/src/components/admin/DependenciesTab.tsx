/**
 * DependenciesTab — Admin Console "Dependencies" tab
 *
 * Two clear sections:
 *   1. Manus Native — platform services bundled with every Manus deployment
 *   2. Third-Party / Optional — external APIs the app can use but doesn't require
 *
 * Each dependency shows: name, type badge, description, features that use it,
 * environment variable(s), and a live status indicator.
 */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Zap,
  Clock,
  Activity,
  Database,
  Shield,
  HardDrive,
  BrainCircuit,
  Image,
  Bell,
  BarChart3,
  Map as MapIcon,
  Globe,
  ExternalLink,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ─── Dependency Classification ───────────────────────────────────────────────

type DependencyType = "native" | "optional";
type StatusValue = "ok" | "degraded" | "error" | "unconfigured" | "unknown";

interface Dependency {
  id: string;
  name: string;
  type: DependencyType;
  description: string;
  features: string[];
  envVars: string[];
  requiresKey: boolean;
  docsUrl?: string;
  freeApi?: boolean;
  /** For native services that are always available */
  alwaysAvailable?: boolean;
  /** Health check service key (maps to healthCheck.checkService) */
  healthCheckKey?: string;
}

interface DependencyStatus {
  status: StatusValue;
  latencyMs: number | null;
  message: string;
  detail?: string;
  checkedAt: string;
}

// ─── Manus Native Dependencies ───────────────────────────────────────────────

const NATIVE_DEPENDENCIES: Dependency[] = [
  {
    id: "database",
    name: "TiDB Database",
    type: "native",
    description:
      "Managed MySQL-compatible database for all persistent data — author profiles, book profiles, user accounts, favorites, and enrichment results.",
    features: [
      "Author profiles",
      "Book profiles",
      "User accounts",
      "Favorites",
      "Enrichment cache",
      "Admin action log",
    ],
    envVars: ["DATABASE_URL"],
    requiresKey: false,
    alwaysAvailable: true,
    docsUrl: "https://docs.pingcap.com/tidb/stable",
  },
  {
    id: "oauth",
    name: "Manus OAuth",
    type: "native",
    description:
      "Single sign-on authentication via Manus accounts. Handles login, session cookies, and user identity.",
    features: ["User login", "Session management", "Role-based access (admin/user)"],
    envVars: ["VITE_APP_ID", "OAUTH_SERVER_URL", "VITE_OAUTH_PORTAL_URL", "JWT_SECRET"],
    requiresKey: false,
    alwaysAvailable: true,
    docsUrl: "https://docs.manus.im",
  },
  {
    id: "s3_storage",
    name: "Manus S3 Storage",
    type: "native",
    description:
      "Object storage for author avatars, book covers, and mirrored images. Files are served via public CDN URLs.",
    features: [
      "Author avatar storage",
      "Book cover mirroring",
      "Image CDN delivery",
      "File uploads",
    ],
    envVars: ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"],
    requiresKey: false,
    alwaysAvailable: true,
  },
  {
    id: "llm",
    name: "Manus LLM Gateway",
    type: "native",
    description:
      "Built-in LLM proxy (invokeLLM) for text generation — author bios, book summaries, research synthesis, and structured data extraction.",
    features: [
      "Author bio generation",
      "Book summary generation",
      "Research synthesis",
      "Author link discovery",
      "Structured JSON extraction",
    ],
    envVars: ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"],
    requiresKey: false,
    alwaysAvailable: true,
  },
  {
    id: "image_gen",
    name: "Manus Image Generation",
    type: "native",
    description:
      "Built-in image generation service for creating and editing author avatar backgrounds.",
    features: ["Avatar background editing", "Image post-processing"],
    envVars: ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"],
    requiresKey: false,
    alwaysAvailable: true,
  },
  {
    id: "notifications",
    name: "Manus Notifications",
    type: "native",
    description:
      "Push notifications to the project owner for operational alerts (enrichment completions, errors).",
    features: ["Owner alerts", "Batch completion notifications"],
    envVars: ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"],
    requiresKey: false,
    alwaysAvailable: true,
  },
  {
    id: "analytics",
    name: "Manus Analytics",
    type: "native",
    description:
      "Built-in page view and unique visitor tracking for the published site.",
    features: ["Page views (PV)", "Unique visitors (UV)", "Dashboard metrics"],
    envVars: ["VITE_ANALYTICS_ENDPOINT", "VITE_ANALYTICS_WEBSITE_ID"],
    requiresKey: false,
    alwaysAvailable: true,
  },
];

// ─── Third-Party / Optional Dependencies ─────────────────────────────────────

const OPTIONAL_DEPENDENCIES: Dependency[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    type: "optional",
    description:
      "Primary LLM for bio enrichment, research cascade, and structured output. Also powers Google Imagen avatar generation.",
    features: [
      "Rich bio generation",
      "Research cascade",
      "Avatar generation (Imagen 3)",
      "Structured JSON output",
    ],
    envVars: ["GEMINI_API_KEY"],
    requiresKey: true,
    healthCheckKey: "gemini",
    docsUrl: "https://aistudio.google.com",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    type: "optional",
    description:
      "Secondary LLM for double-pass research verification and fallback bio enrichment.",
    features: ["Secondary LLM processing", "Research verification", "Bio fallback"],
    envVars: ["ANTHROPIC_API_KEY"],
    requiresKey: true,
    healthCheckKey: "anthropic",
    docsUrl: "https://console.anthropic.com",
  },
  {
    id: "apify",
    name: "Apify",
    type: "optional",
    description:
      "Web scraping platform for extracting data from Amazon (book covers), TED talks, Substack, and LinkedIn.",
    features: [
      "Amazon book cover scraping",
      "TED talk stats",
      "Substack subscriber counts",
      "LinkedIn profile data",
    ],
    envVars: ["APIFY_API_TOKEN"],
    requiresKey: true,
    healthCheckKey: "apify",
    docsUrl: "https://console.apify.com",
  },
  {
    id: "replicate",
    name: "Replicate",
    type: "optional",
    description:
      "AI image generation platform for creating photorealistic author avatars (Flux, SDXL models).",
    features: ["Author avatar generation", "Portrait style variations"],
    envVars: ["REPLICATE_API_TOKEN"],
    requiresKey: true,
    healthCheckKey: "replicate",
    docsUrl: "https://replicate.com",
  },
  {
    id: "tavily",
    name: "Tavily Search",
    type: "optional",
    description:
      "AI-optimized web search for enrichment research — finds author photos, websites, and biographical data.",
    features: [
      "Author photo search",
      "Website discovery",
      "Biographical research",
    ],
    envVars: ["TAVILY_API_KEY"],
    requiresKey: true,
    healthCheckKey: "tavily",
    docsUrl: "https://app.tavily.com",
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    type: "optional",
    description:
      "Real-time web search with citations for grounded author bios and fact-checked research.",
    features: [
      "Web-grounded bios",
      "Cited research",
      "Real-time fact checking",
    ],
    envVars: ["PERPLEXITY_API_KEY"],
    requiresKey: true,
    healthCheckKey: "perplexity",
    docsUrl: "https://www.perplexity.ai",
  },
  {
    id: "youtube",
    name: "YouTube Data API",
    type: "optional",
    description:
      "Fetches subscriber counts and channel discovery for author social stats.",
    features: ["YouTube subscriber counts", "Channel discovery"],
    envVars: ["YOUTUBE_API_KEY"],
    requiresKey: true,
    healthCheckKey: "youtube",
    docsUrl: "https://console.cloud.google.com",
  },
  {
    id: "twitter",
    name: "Twitter / X API",
    type: "optional",
    description:
      "Fetches follower counts for author social profiles. Requires Twitter Basic plan ($100/mo).",
    features: ["Twitter follower counts", "Tweet counts"],
    envVars: ["TWITTER_BEARER_TOKEN"],
    requiresKey: true,
    healthCheckKey: "twitter",
    docsUrl: "https://developer.twitter.com",
  },
  {
    id: "rapidapi",
    name: "RapidAPI Hub",
    type: "optional",
    description:
      "Gateway to Yahoo Finance, CNBC, LinkedIn, and Seeking Alpha endpoints for business and financial data.",
    features: [
      "Yahoo Finance data",
      "CNBC article search",
      "LinkedIn profile data",
      "Seeking Alpha mentions",
    ],
    envVars: ["RAPIDAPI_KEY"],
    requiresKey: true,
    healthCheckKey: "rapidapi",
    docsUrl: "https://rapidapi.com",
  },
  {
    id: "google_books",
    name: "Google Books API",
    type: "optional",
    description:
      "Fetches book metadata, covers, and ISBNs from the Google Books catalog. Free tier available.",
    features: ["Book cover images", "Book metadata", "ISBN lookup"],
    envVars: ["GOOGLE_BOOKS_API_KEY"],
    requiresKey: false,
    freeApi: true,
    docsUrl: "https://developers.google.com/books",
  },
  {
    id: "wikipedia",
    name: "Wikipedia / Wikidata",
    type: "optional",
    description:
      "Free public APIs for author bios, photos, social links (P856/P2002/P6634), and monthly page views.",
    features: [
      "Author bios",
      "Author photos",
      "Social link discovery",
      "Monthly page views",
    ],
    envVars: [],
    requiresKey: false,
    freeApi: true,
    docsUrl: "https://www.mediawiki.org/wiki/API:Main_page",
  },
  {
    id: "sec_edgar",
    name: "SEC EDGAR",
    type: "optional",
    description:
      "Full-text search of SEC filings (10-K, 10-Q, 8-K) for enterprise impact scoring.",
    features: ["Filing mention search", "Enterprise impact scoring"],
    envVars: [],
    requiresKey: false,
    freeApi: true,
    healthCheckKey: "sec_edgar",
    docsUrl: "https://efts.sec.gov/LATEST/",
  },
  {
    id: "openalex",
    name: "OpenAlex",
    type: "optional",
    description:
      "Open academic research database for citation counts, h-index, and publication history.",
    features: [
      "Citation counts",
      "h-index",
      "Publication history",
      "Academic profile",
    ],
    envVars: [],
    requiresKey: false,
    freeApi: true,
    healthCheckKey: "openalex",
    docsUrl: "https://openalex.org",
  },
  {
    id: "github",
    name: "GitHub API",
    type: "optional",
    description:
      "Repository search for technical book references, code examples, and framework documentation.",
    features: [
      "Technical book references",
      "Code repository search",
      "Framework documentation links",
    ],
    envVars: [],
    requiresKey: false,
    freeApi: true,
    healthCheckKey: "github",
    docsUrl: "https://docs.github.com/en/rest",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    type: "optional",
    description:
      "Document archive for author content — transcripts, papers, chapter samples. Uses gws CLI (sandbox-only).",
    features: [
      "Author document archive",
      "Library folder scanning",
      "Avatar/cover Drive backup",
    ],
    envVars: ["DRIVE_AUTHORS_FOLDER_ID", "DRIVE_BOOKS_AUDIO_FOLDER_ID", "DRIVE_AVATARS_FOLDER_ID"],
    requiresKey: false,
    docsUrl: "https://drive.google.com",
  },
  {
    id: "notion",
    name: "Notion",
    type: "optional",
    description:
      "Bidirectional sync for reading notes — push book profiles to Notion, pull highlights and annotations back.",
    features: [
      "Push books to Notion",
      "Pull reading notes",
      "Sync highlights",
    ],
    envVars: [],
    requiresKey: false,
    docsUrl: "https://www.notion.so",
  },
  {
    id: "context7",
    name: "Context7",
    type: "optional",
    description:
      "Up-to-date library documentation and code examples for technical books. Fetches versioned docs from GitHub repositories to enrich technical references.",
    features: [
      "Technical book references",
      "Library documentation lookup",
      "Code example enrichment",
      "Framework version detection",
    ],
    envVars: [],
    requiresKey: false,
    freeApi: true,
    healthCheckKey: "context7",
    docsUrl: "https://context7.com",
  },
];

// ─── All dependencies for export (used by tests) ────────────────────────────

export const ALL_DEPENDENCIES = [...NATIVE_DEPENDENCIES, ...OPTIONAL_DEPENDENCIES];

// ─── Status Helpers ──────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: StatusValue }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "unconfigured":
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    case "unknown":
      return <HelpCircle className="w-4 h-4 text-muted-foreground/50" />;
  }
}

function StatusBadge({ status }: { status: StatusValue }) {
  const variants: Record<StatusValue, string> = {
    ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    degraded:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    unconfigured: "bg-muted text-muted-foreground",
    unknown: "bg-muted/50 text-muted-foreground/60",
  };
  const labels: Record<StatusValue, string> = {
    ok: "Connected",
    degraded: "Degraded",
    error: "Error",
    unconfigured: "Not configured",
    unknown: "Not checked",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function LatencyBadge({ latencyMs }: { latencyMs: number | null }) {
  if (latencyMs === null) return null;
  const color =
    latencyMs < 500
      ? "text-green-600 dark:text-green-400"
      : latencyMs < 1500
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <Zap className="w-3 h-3" />
      {latencyMs}ms
    </span>
  );
}

// ─── Category Icons ──────────────────────────────────────────────────────────

function getNativeIcon(id: string) {
  switch (id) {
    case "database":
      return <Database className="w-5 h-5" />;
    case "oauth":
      return <Shield className="w-5 h-5" />;
    case "s3_storage":
      return <HardDrive className="w-5 h-5" />;
    case "llm":
      return <BrainCircuit className="w-5 h-5" />;
    case "image_gen":
      return <Image className="w-5 h-5" />;
    case "notifications":
      return <Bell className="w-5 h-5" />;
    case "analytics":
      return <BarChart3 className="w-5 h-5" />;
    case "maps":
      return <MapIcon className="w-5 h-5" />;
    default:
      return <Package className="w-5 h-5" />;
  }
}

// ─── Section Summary ─────────────────────────────────────────────────────────

function SectionSummary({
  deps,
  statuses,
}: {
  deps: Dependency[];
  statuses: Map<string, DependencyStatus>;
}) {
  const counts = { ok: 0, degraded: 0, error: 0, unconfigured: 0, unknown: 0 };
  deps.forEach((d) => {
    const s = statuses.get(d.id);
    if (!s) {
      if (d.alwaysAvailable) counts.ok++;
      else counts.unknown++;
    } else {
      counts[s.status]++;
    }
  });

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">{deps.length} services</span>
      {counts.ok > 0 && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {counts.ok} active
        </span>
      )}
      {counts.degraded > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {counts.degraded} degraded
        </span>
      )}
      {counts.error > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          {counts.error} error
        </span>
      )}
      {counts.unconfigured > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
          {counts.unconfigured} not configured
        </span>
      )}
    </div>
  );
}

// ─── Dependency Card ─────────────────────────────────────────────────────────

interface DepCardProps {
  dep: Dependency;
  status: DependencyStatus | undefined;
  isChecking: boolean;
  onCheck: (id: string) => void;
}

function DependencyCard({ dep, status, isChecking, onCheck }: DepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const effectiveStatus: StatusValue = status
    ? status.status
    : dep.alwaysAvailable
    ? "ok"
    : "unknown";

  const accentColor =
    effectiveStatus === "ok"
      ? "bg-green-500"
      : effectiveStatus === "degraded"
      ? "bg-amber-500"
      : effectiveStatus === "error"
      ? "bg-red-500"
      : "bg-muted";

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentColor}`} />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-foreground/70 shrink-0">
              {dep.type === "native" ? getNativeIcon(dep.id) : <Globe className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-sm font-semibold leading-tight">
                  {dep.name}
                </CardTitle>
                <Badge
                  variant={dep.type === "native" ? "default" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {dep.type === "native" ? "NATIVE" : "OPTIONAL"}
                </Badge>
                {dep.freeApi && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                  >
                    FREE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {dep.description}
              </p>
            </div>
          </div>

          {/* Check button (only for services with health check) */}
          {dep.healthCheckKey && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 transition-transform hover:scale-110"
              onClick={() => onCheck(dep.id)}
              disabled={isChecking}
              title={`Check ${dep.name}`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 space-y-2">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusIcon status={effectiveStatus} />
          <StatusBadge status={effectiveStatus} />
          {status && <LatencyBadge latencyMs={status.latencyMs} />}
          {status && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(status.checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Status message */}
        {status?.message && effectiveStatus !== "ok" && (
          <p className="text-xs text-foreground/70">{status.message}</p>
        )}

        {/* Error detail */}
        {status?.detail && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground truncate cursor-help underline decoration-dotted">
                {status.detail.slice(0, 80)}
                {status.detail.length > 80 ? "…" : ""}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-xs text-xs break-words"
            >
              {status.detail}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Expand/collapse for features and env vars */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            {/* Features */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Features using this service
              </p>
              <div className="flex flex-wrap gap-1">
                {dep.features.map((f) => (
                  <Badge
                    key={f}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {f}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Environment variables */}
            {dep.envVars.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Environment variables
                </p>
                <div className="flex flex-wrap gap-1">
                  {dep.envVars.map((v) => (
                    <code
                      key={v}
                      className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Docs link */}
            {dep.docsUrl && (
              <a
                href={dep.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Documentation
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Tab Component ──────────────────────────────────────────────────────

export function DependenciesTab() {
  const [statuses, setStatuses] = useState<Map<string, DependencyStatus>>(
    new Map()
  );
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Map from dep.id → healthCheckKey for the tRPC call
  const healthKeyMap = useMemo(() => {
    const m = new Map<string, string>();
    ALL_DEPENDENCIES.forEach((d) => {
      if (d.healthCheckKey) m.set(d.id, d.healthCheckKey);
    });
    return m;
  }, []);

  const checkAllMutation = trpc.healthCheck.checkAll.useMutation({
    onSuccess: (data) => {
      const next = new Map<string, DependencyStatus>();
      // Mark all native as OK
      NATIVE_DEPENDENCIES.forEach((d) => {
        next.set(d.id, {
          status: "ok",
          latencyMs: null,
          message: "Platform service — always available",
          checkedAt: new Date().toISOString(),
        });
      });
      // Map health check results to dependency IDs
      data.forEach((r) => {
        const dep = OPTIONAL_DEPENDENCIES.find(
          (d) => d.healthCheckKey && SERVICE_LABEL_MAP[d.healthCheckKey] === r.service
        );
        if (dep) {
          next.set(dep.id, {
            status: r.status as StatusValue,
            latencyMs: r.latencyMs,
            message: r.message,
            detail: r.detail,
            checkedAt: r.checkedAt,
          });
        }
      });
      setStatuses(next);
      const errors = data.filter((r) => r.status === "error").length;
      const degraded = data.filter((r) => r.status === "degraded").length;
      if (errors === 0 && degraded === 0) {
        toast.success("All dependency checks complete");
      } else {
        toast.warning(
          `Checks complete: ${errors} error(s), ${degraded} degraded`
        );
      }
    },
    onError: (err) => toast.error(`Check failed: ${err.message}`),
    onSettled: () => setCheckingAll(false),
  });

  const checkServiceMutation = trpc.healthCheck.checkService.useMutation({
    onSuccess: (data, variables) => {
      const dep = OPTIONAL_DEPENDENCIES.find(
        (d) => d.healthCheckKey === variables.service
      );
      if (dep) {
        setStatuses((prev) => {
          const next = new Map(prev);
          next.set(dep.id, {
            status: data.status as StatusValue,
            latencyMs: data.latencyMs,
            message: data.message,
            detail: data.detail,
            checkedAt: data.checkedAt,
          });
          return next;
        });
      }
      if (data.status === "ok") toast.success(`${data.service}: Connected`);
      else if (data.status === "degraded")
        toast.warning(`${data.service}: ${data.message}`);
      else if (data.status === "error")
        toast.error(`${data.service}: ${data.message}`);
      else toast.info(`${data.service}: Not configured`);
    },
    onError: (err) => toast.error(`Check failed: ${err.message}`),
    onSettled: () => setCheckingId(null),
  });

  const handleCheckAll = useCallback(() => {
    setCheckingAll(true);
    checkAllMutation.mutate();
  }, [checkAllMutation]);

  const handleCheckOne = useCallback(
    (depId: string) => {
      const key = healthKeyMap.get(depId);
      if (!key) return;
      setCheckingId(depId);
      checkServiceMutation.mutate({ service: key as any });
    },
    [healthKeyMap, checkServiceMutation]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Application Dependencies</h2>
          <p className="text-sm text-muted-foreground">
            All services this application relies on, categorized by origin. Native services are
            bundled with the Manus platform; optional services require separate API keys or
            are free public APIs.
          </p>
        </div>
        <Button
          onClick={handleCheckAll}
          disabled={checkingAll}
          className="gap-2"
          size="sm"
        >
          <RefreshCw
            className={`w-4 h-4 ${checkingAll ? "animate-spin" : ""}`}
          />
          {checkingAll ? "Checking…" : "Check All Services"}
        </Button>
      </div>

      {/* ── Section 1: Manus Native ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Manus Native Services
          </h3>
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
            {NATIVE_DEPENDENCIES.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Platform services provided by Manus. These are always available and require no
          separate API keys or billing. They are automatically configured when the project is
          deployed.
        </p>
        <SectionSummary deps={NATIVE_DEPENDENCIES} statuses={statuses} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NATIVE_DEPENDENCIES.map((dep) => (
            <DependencyCard
              key={dep.id}
              dep={dep}
              status={statuses.get(dep.id)}
              isChecking={false}
              onCheck={handleCheckOne}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2: Third-Party / Optional ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-muted-foreground/50" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Third-Party / Optional Services
          </h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {OPTIONAL_DEPENDENCIES.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          External APIs and services that extend the application's capabilities. Some require
          paid API keys (configured in Settings &gt; Secrets); others are free public APIs.
          The app degrades gracefully when optional services are unavailable.
        </p>
        <SectionSummary deps={OPTIONAL_DEPENDENCIES} statuses={statuses} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {OPTIONAL_DEPENDENCIES.map((dep) => (
            <DependencyCard
              key={dep.id}
              dep={dep}
              status={statuses.get(dep.id)}
              isChecking={
                (checkingAll && !statuses.has(dep.id)) ||
                checkingId === dep.id
              }
              onCheck={handleCheckOne}
            />
          ))}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-3 border-t">
        <span className="flex items-center gap-1">
          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
            NATIVE
          </Badge>
          Bundled with Manus — no setup needed
        </span>
        <span className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            OPTIONAL
          </Badge>
          Requires API key or external account
        </span>
        <span className="flex items-center gap-1">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
          >
            FREE
          </Badge>
          Public API — no key required
        </span>
      </div>
    </div>
  );
}

// ─── Service label mapping (healthCheckKey → service label from checkAll) ────

const SERVICE_LABEL_MAP: Record<string, string> = {
  apify: "Apify",
  gemini: "Google Gemini",
  anthropic: "Anthropic (Claude)",
  replicate: "Replicate",
  youtube: "YouTube Data API",
  twitter: "Twitter/X API",
  tavily: "Tavily Search",
  perplexity: "Perplexity AI",
  rapidapi: "RapidAPI",
  sec_edgar: "SEC EDGAR",
  openalex: "OpenAlex",
  github: "GitHub API",
};
