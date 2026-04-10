/**
 * ApiManagementTab — Admin section for managing all external APIs used in the app.
 *
 * Layout: responsive 3-column card grid (1 col on mobile, 2 on md, 3 on lg)
 * Each card shows: API name, category badge, source, status dot (green/yellow/red),
 * description, last check time, and an enable/disable switch.
 *
 * Actions: "Seed" to populate from the built-in list, "Check All" to ping all APIs,
 * and per-card "Ping" to test a single API.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Database,
  Newspaper,
  Users,
  ChartBar,
  Airplane,
  Wrench,
  Brain,
  Globe,
  ArrowsClockwise,
  CheckCircle,
  Warning,
  XCircle,
  Play,
  Plus,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type ApiEntry = {
  id: number;
  apiKey: string;
  name: string;
  description: string | null;
  category: string;
  source: string;
  sourceUrl: string | null;
  rapidApiHost: string | null;
  healthCheckUrl: string | null;
  enabled: number;
  statusColor: "green" | "yellow" | "red";
  lastStatusCode: number | null;
  lastStatusMessage: string | null;
  lastCheckedAt: Date | null;
  notes: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; icon: PhosphorIcon; color: string; renderIcon: (cls: string) => React.ReactNode }> = {
  books:      { label: "Books",      icon: Database,  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",  renderIcon: (cls) => <Database  weight="bold" className={cls} /> },
  news:       { label: "News",       icon: Newspaper, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", renderIcon: (cls) => <Newspaper weight="bold" className={cls} /> },
  social:     { label: "Social",     icon: Users,     color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", renderIcon: (cls) => <Users     weight="bold" className={cls} /> },
  finance:    { label: "Finance",    icon: ChartBar,  color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",  renderIcon: (cls) => <ChartBar  weight="bold" className={cls} /> },
  travel:     { label: "Travel",     icon: Airplane,  color: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",         renderIcon: (cls) => <Airplane  weight="bold" className={cls} /> },
  utilities:  { label: "Utilities",  icon: Wrench,    color: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",  renderIcon: (cls) => <Wrench    weight="bold" className={cls} /> },
  ai:         { label: "AI",         icon: Brain,     color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300", renderIcon: (cls) => <Brain    weight="bold" className={cls} /> },
  other:      { label: "Other",      icon: Globe,     color: "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",      renderIcon: (cls) => <Globe    weight="bold" className={cls} /> },
};

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ color, message }: { color: "green" | "yellow" | "red"; message?: string | null }) {
  const dotClass =
    color === "green"  ? "bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.5)]" :
    color === "yellow" ? "bg-amber-400  shadow-[0_0_6px_1px_rgba(251,191,36,0.5)]" :
                         "bg-red-500    shadow-[0_0_6px_1px_rgba(239,68,68,0.5)]";
  const label =
    color === "green"  ? "Working" :
    color === "yellow" ? "Issues" :
                         "Down / Not subscribed";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-default">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {message ?? label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Status icon (for the header row) ─────────────────────────────────────────
function StatusIcon({ color }: { color: "green" | "yellow" | "red" }) {
  if (color === "green")  return <CheckCircle weight="fill" className="w-4 h-4 text-emerald-500" />;
  if (color === "yellow") return <Warning     weight="fill" className="w-4 h-4 text-amber-400" />;
  return                         <XCircle     weight="fill" className="w-4 h-4 text-red-500" />;
}

// ── Single API card ───────────────────────────────────────────────────────────
function ApiCard({ entry, onToggle, onPing }: {
  entry: ApiEntry;
  onToggle: (id: number, enabled: boolean) => void;
  onPing: (id: number) => void;
}) {
  const cat = CATEGORY_CONFIG[entry.category] ?? CATEGORY_CONFIG.other;
  const [pinging, setPinging] = useState(false);

  const handlePing = async () => {
    setPinging(true);
    try { await onPing(entry.id); } finally { setPinging(false); }
  };

  const lastChecked = entry.lastCheckedAt
    ? new Date(entry.lastCheckedAt).toLocaleString()
    : null;

  return (
    <div className={`
      relative flex flex-col gap-3 rounded-xl border bg-card p-4
      shadow-sm transition-all duration-200
      hover:shadow-md hover:-translate-y-0.5
      ${!entry.enabled ? "opacity-60 grayscale-[30%]" : ""}
    `}>
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon color={entry.statusColor} />
          <span className="font-semibold text-sm text-foreground truncate">{entry.name}</span>
        </div>
        {/* Enable / disable switch */}
        <Switch
          checked={!!entry.enabled}
          onCheckedChange={(checked) => onToggle(entry.id, checked)}
          className="shrink-0 data-[state=checked]:bg-emerald-500"
        />
      </div>

      {/* ── Category + source ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>
          {cat.renderIcon("w-3 h-3")}
          {cat.label}
        </span>
        {entry.rapidApiHost && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
            RapidAPI
          </span>
        )}
      </div>

      {/* ── Description ── */}
      {entry.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {entry.description}
        </p>
      )}

      {/* ── Source link ── */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Globe weight="regular" className="w-3 h-3 shrink-0" />
        {entry.sourceUrl ? (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:text-foreground hover:underline transition-colors"
          >
            {entry.source}
          </a>
        ) : (
          <span className="truncate">{entry.source}</span>
        )}
      </div>

      {/* ── Status row ── */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        <StatusDot color={entry.statusColor} message={entry.lastStatusMessage} />
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-[10px] text-muted-foreground/60 hidden sm:block">
              {lastChecked}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handlePing}
                disabled={pinging}
                className="
                  inline-flex items-center justify-center w-6 h-6 rounded
                  border border-border/60 bg-background text-muted-foreground
                  hover:bg-accent hover:text-foreground hover:border-border
                  active:translate-y-[1px] active:shadow-none
                  shadow-[0_1px_0_0_hsl(var(--border))]
                  transition-all duration-150 disabled:opacity-50
                "
              >
                {pinging ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play weight="fill" className="w-3 h-3" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Ping this API</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────
export function ApiManagementTab() {
  const utils = trpc.useUtils();

  const { data: apis = [], isLoading } = trpc.apiRegistry.list.useQuery();

  const toggleMutation = trpc.apiRegistry.toggle.useMutation({
    onMutate: async ({ id, enabled }) => {
      await utils.apiRegistry.list.cancel();
      const prev = utils.apiRegistry.list.getData();
        utils.apiRegistry.list.setData(undefined, (old) =>
        (old ?? []).map((a) => a.id === id ? { ...a, enabled: enabled ? 1 : 0 } : a)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.apiRegistry.list.setData(undefined, ctx.prev);
      toast.error("Failed to update");
    },
  });

  const pingMutation = trpc.apiRegistry.ping.useMutation({
    onSuccess: (result, { id }) => {
      utils.apiRegistry.list.setData(undefined, (old) =>
        (old ?? []).map((a) =>
          a.id === id
            ? { ...a, statusColor: (result.statusColor ?? "yellow") as "green" | "yellow" | "red", lastStatusMessage: result.message ?? null, lastCheckedAt: new Date() }
            : a
        )
      );
      const title = result.statusColor === "green" ? "API is working" : result.statusColor === "yellow" ? "API has issues" : "API is down";
      if (result.statusColor === "red") {
        toast.error(title, { description: result.message ?? undefined });
      } else {
        toast.success(title, { description: result.message ?? undefined });
      }
    },
  });

  const pingAllMutation = trpc.apiRegistry.pingAll.useMutation({
    onSuccess: () => {
      utils.apiRegistry.list.invalidate();
      toast.success("Health check complete", { description: "All API statuses updated." });
    },
    onError: () => toast.error("Health check failed"),
  });

  const seedMutation = trpc.apiRegistry.seed.useMutation({
    onSuccess: (result) => {
      utils.apiRegistry.list.invalidate();
      toast.success("Registry seeded", { description: `${result.inserted} APIs added.` });
    },
    onError: () => toast.error("Seed failed"),
  });

  // Group by category
  const grouped = (apis as ApiEntry[]).reduce<Record<string, ApiEntry[]>>((acc, api) => {
    if (!acc[api.category]) acc[api.category] = [];
    acc[api.category].push(api);
    return acc;
  }, {});

  const categoryOrder = ["books", "news", "social", "finance", "ai", "utilities", "travel", "other"];

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">API Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All external APIs used in the app — toggle, monitor, and health-check from one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apis.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="shadow-[0_2px_0_0_hsl(var(--border))] active:translate-y-[1px] active:shadow-none transition-all"
            >
              {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus weight="bold" className="w-3.5 h-3.5 mr-1.5" />}
              Seed Registry
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => pingAllMutation.mutate()}
            disabled={pingAllMutation.isPending}
            className="shadow-[0_2px_0_0_hsl(var(--border))] active:translate-y-[1px] active:shadow-none transition-all"
          >
            {pingAllMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ArrowsClockwise weight="bold" className="w-3.5 h-3.5 mr-1.5" />
            )}
            Check All
          </Button>
        </div>
      </div>

      {/* ── Summary badges ── */}
      {apis.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[
            { color: "green",  label: "Working",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
            { color: "yellow", label: "Issues",       cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" },
            { color: "red",    label: "Down",         cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" },
          ].map(({ color, label, cls }) => {
            const count = (apis as ApiEntry[]).filter((a) => a.statusColor === color).length;
            return (
              <span key={color} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
                <span className={`w-2 h-2 rounded-full ${color === "green" ? "bg-emerald-500" : color === "yellow" ? "bg-amber-400" : "bg-red-500"}`} />
                {count} {label}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium bg-muted/50 text-muted-foreground">
            {(apis as ApiEntry[]).filter((a) => a.enabled).length} / {apis.length} Enabled
          </span>
        </div>
      )}

      {/* ── Loading state ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading API registry…</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && apis.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-dashed border-border/60">
          <Database weight="thin" className="w-12 h-12 text-muted-foreground/40" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No APIs registered yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Seed Registry" to populate with all known APIs.</p>
          </div>
          <Button
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="shadow-[0_2px_0_0_hsl(var(--border))] active:translate-y-[1px] active:shadow-none transition-all"
          >
            {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus weight="bold" className="w-3.5 h-3.5 mr-1.5" />}
            Seed Registry
          </Button>
        </div>
      )}

      {/* ── Category sections ── */}
      {!isLoading && categoryOrder
        .filter((cat) => grouped[cat]?.length > 0)
        .map((cat) => {
          const catCfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.other;
          const entries = grouped[cat];
          return (
            <section key={cat} className="space-y-3">
              {/* Section header */}
              <div className="flex items-center gap-2">
                {catCfg.renderIcon("w-4 h-4 text-muted-foreground")}
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{catCfg.label}</h3>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-muted-foreground">{entries.length} API{entries.length !== 1 ? "s" : ""}</span>
              </div>

              {/* 3-column card grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entries.map((entry) => (
                  <ApiCard
                    key={entry.id}
                    entry={entry}
                    onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                    onPing={(id) => pingMutation.mutateAsync({ id })}
                  />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
