/**
 * ToolHealthCheckTab — Admin Console "Health" tab
 * Shows a card per external service with status dot, latency badge,
 * last-checked timestamp, error detail, and per-service re-check button.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Zap,
  Clock,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = "ok" | "degraded" | "error" | "unconfigured";
type ServiceKey =
  | "apify"
  | "gemini"
  | "anthropic"
  | "replicate"
  | "youtube"
  | "twitter"
  | "tavily"
  | "perplexity"
  | "rapidapi"
  | "sec_edgar"
  | "openalex"
  | "github"
  | "context7";

interface ServiceHealthResult {
  service: string;
  status: ServiceStatus;
  latencyMs: number | null;
  message: string;
  detail?: string;
  checkedAt: string;
}

// ─── Service Metadata ─────────────────────────────────────────────────────────

const SERVICE_META: Record<
  ServiceKey,
  { label: string; description: string; icon: string; docsUrl?: string }
> = {
  apify: {
    label: "Apify",
    description: "Web scraping platform (TED talks, Substack, LinkedIn)",
    icon: "🕷️",
    docsUrl: "https://console.apify.com",
  },
  gemini: {
    label: "Google Gemini",
    description: "LLM for bio enrichment, research, and structured output",
    icon: "✨",
    docsUrl: "https://aistudio.google.com",
  },
  anthropic: {
    label: "Anthropic (Claude)",
    description: "Fallback LLM for bio enrichment and double-pass research",
    icon: "🤖",
    docsUrl: "https://console.anthropic.com",
  },
  replicate: {
    label: "Replicate",
    description: "AI image generation for author avatars",
    icon: "🎨",
    docsUrl: "https://replicate.com",
  },
  youtube: {
    label: "YouTube Data API",
    description: "Subscriber counts and channel discovery",
    icon: "▶️",
    docsUrl: "https://console.cloud.google.com",
  },
  twitter: {
    label: "Twitter/X API",
    description: "Follower counts (requires Basic plan, $100/mo)",
    icon: "𝕏",
    docsUrl: "https://developer.twitter.com",
  },
  tavily: {
    label: "Tavily Search",
    description: "AI-optimised web search for enrichment research",
    icon: "🔍",
    docsUrl: "https://app.tavily.com",
  },
  perplexity: {
    label: "Perplexity AI",
    description: "Real-time web search with citations",
    icon: "🌐",
    docsUrl: "https://www.perplexity.ai",
  },
  rapidapi: {
    label: "RapidAPI",
    description: "Yahoo Finance, CNBC, LinkedIn, Seeking Alpha endpoints",
    icon: "⚡",
    docsUrl: "https://rapidapi.com",
  },
  sec_edgar: {
    label: "SEC EDGAR",
    description: "Full-text search of SEC filings (free, no key required)",
    icon: "🏦",
    docsUrl: "https://efts.sec.gov/LATEST/",
  },
  openalex: {
    label: "OpenAlex",
    description: "Academic research database (free, no key required)",
    icon: "🎓",
    docsUrl: "https://openalex.org",
  },
  github: {
    label: "GitHub API",
    description: "Repository search for technical book references",
    icon: "🐙",
    docsUrl: "https://docs.github.com/en/rest",
  },
  context7: {
    label: "Context7",
    description: "Up-to-date library docs and code examples for technical books (free, no key)",
    icon: "📚",
    docsUrl: "https://context7.com",
  },
};

const SERVICE_KEYS = Object.keys(SERVICE_META) as ServiceKey[];

// ─── Status Helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "degraded":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "unconfigured":
      return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const variants: Record<ServiceStatus, string> = {
    ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    degraded: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    unconfigured: "bg-muted text-muted-foreground",
  };
  const labels: Record<ServiceStatus, string> = {
    ok: "OK",
    degraded: "Degraded",
    error: "Error",
    unconfigured: "Not configured",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[status]}`}>
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

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ results }: { results: Map<ServiceKey, ServiceHealthResult> }) {
  const counts = { ok: 0, degraded: 0, error: 0, unconfigured: 0 };
  results.forEach((r) => counts[r.status]++);
  const total = SERVICE_KEYS.length;
  const checked = results.size;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        {checked}/{total} checked
      </span>
      {counts.ok > 0 && (
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {counts.ok} OK
        </span>
      )}
      {counts.degraded > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {counts.degraded} Degraded
        </span>
      )}
      {counts.error > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          {counts.error} Error
        </span>
      )}
      {counts.unconfigured > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
          {counts.unconfigured} Not configured
        </span>
      )}
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  serviceKey: ServiceKey;
  result: ServiceHealthResult | undefined;
  isChecking: boolean;
  onRecheck: (key: ServiceKey) => void;
}

function ServiceCard({ serviceKey, result, isChecking, onRecheck }: ServiceCardProps) {
  const meta = SERVICE_META[serviceKey];

  return (
    <Card className="relative overflow-hidden">
      {/* Status accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 ${
          !result
            ? "bg-muted"
            : result.status === "ok"
            ? "bg-green-500"
            : result.status === "degraded"
            ? "bg-amber-500"
            : result.status === "error"
            ? "bg-red-500"
            : "bg-muted"
        }`}
      />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg leading-none" aria-hidden="true">
              {meta.icon}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight truncate">
                {meta.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                {meta.description}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onRecheck(serviceKey)}
            disabled={isChecking}
            title={`Re-check ${meta.label}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3 space-y-2">
        {!result && !isChecking && (
          <p className="text-xs text-muted-foreground italic">Not yet checked</p>
        )}

        {isChecking && !result && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Checking…
          </div>
        )}

        {result && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusIcon status={result.status} />
              <StatusBadge status={result.status} />
              <LatencyBadge latencyMs={result.latencyMs} />
            </div>

            <p className="text-xs text-foreground/80">{result.message}</p>

            {result.detail && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate cursor-help underline decoration-dotted">
                    {result.detail.slice(0, 60)}
                    {result.detail.length > 60 ? "…" : ""}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs break-words">
                  {result.detail}
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Checked at {formatCheckedAt(result.checkedAt)}
            </div>
          </>
        )}

        {meta.docsUrl && (
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            Open console ↗
          </a>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

export function ToolHealthCheckTab() {
  const [results, setResults] = useState<Map<ServiceKey, ServiceHealthResult>>(new Map());
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingService, setCheckingService] = useState<ServiceKey | null>(null);

  const checkAllMutation = trpc.healthCheck.checkAll.useMutation({
    onSuccess: (data) => {
      const map = new Map<ServiceKey, ServiceHealthResult>();
      data.forEach((r) => {
        // Map service name back to key
        const key = SERVICE_KEYS.find(
          (k) => SERVICE_META[k].label === r.service
        );
        if (key) map.set(key, r as ServiceHealthResult);
      });
      setResults(map);
      const errors = data.filter((r) => r.status === "error").length;
      const degraded = data.filter((r) => r.status === "degraded").length;
      if (errors === 0 && degraded === 0) {
        toast.success("All configured services are healthy");
      } else {
        toast.warning(
          `Health check complete: ${errors} error(s), ${degraded} degraded`
        );
      }
    },
    onError: (err) => {
      toast.error(`Health check failed: ${err.message}`);
    },
    onSettled: () => setCheckingAll(false),
  });

  const checkServiceMutation = trpc.healthCheck.checkService.useMutation({
    onSuccess: (data, variables) => {
      setResults((prev) => {
        const next = new Map(prev);
        next.set(variables.service, data as ServiceHealthResult);
        return next;
      });
      if (data.status === "ok") {
        toast.success(`${SERVICE_META[variables.service].label}: OK`);
      } else if (data.status === "degraded") {
        toast.warning(`${SERVICE_META[variables.service].label}: ${data.message}`);
      } else if (data.status === "error") {
        toast.error(`${SERVICE_META[variables.service].label}: ${data.message}`);
      } else {
        toast.info(`${SERVICE_META[variables.service].label}: Not configured`);
      }
    },
    onError: (err) => {
      toast.error(`Check failed: ${err.message}`);
    },
    onSettled: () => setCheckingService(null),
  });

  const handleCheckAll = useCallback(() => {
    setCheckingAll(true);
    checkAllMutation.mutate();
  }, [checkAllMutation]);

  const handleRecheck = useCallback(
    (key: ServiceKey) => {
      setCheckingService(key);
      checkServiceMutation.mutate({ service: key });
    },
    [checkServiceMutation]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Tool Health Check</h2>
          <p className="text-sm text-muted-foreground">
            Verify connectivity and credentials for all external services used by the enrichment pipeline.
          </p>
        </div>
        <Button
          onClick={handleCheckAll}
          disabled={checkingAll}
          className="gap-2"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 ${checkingAll ? "animate-spin" : ""}`} />
          {checkingAll ? "Checking all…" : "Run All Checks"}
        </Button>
      </div>

      {/* Summary */}
      {results.size > 0 && <SummaryBar results={results} />}

      {/* Service Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SERVICE_KEYS.map((key) => (
          <ServiceCard
            key={key}
            serviceKey={key}
            result={results.get(key)}
            isChecking={
              (checkingAll && !results.has(key)) ||
              checkingService === key
            }
            onRecheck={handleRecheck}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> OK — service reachable and key valid
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Degraded — key valid but limited (quota, tier)
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5 text-red-500" /> Error — unreachable or key invalid
        </span>
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /> Not configured — env var not set
        </span>
      </div>
    </div>
  );
}
