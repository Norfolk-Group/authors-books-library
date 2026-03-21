/**
 * SettingsTab - Theme, Avatar, and AI Model settings for the Admin Console.
 *
 * Sections:
 *  1. Theme selector (Manus | Norfolk AI | Noir Dark)
 *  2. Avatar Background Color — Norfolk AI palette swatches + custom picker
 *  3. AI Model — 3-column layout:
 *       Col 1: Primary LLM (vendor → model list)
 *       Col 2: Secondary LLM toggle + vendor/model selectors
 *       Col 3: Active summary + Refresh Vendors button
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Palette, Cpu, ImageIcon, RefreshCw, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = [
  {
    id: "manus" as const,
    label: "Manus",
    desc: "Black / white / grey — clean default",
    preview: { bg: "#F2F2F2", card: "#FFFFFF", sidebar: "#E4E4E4", accent: "#111111" },
  },
  {
    id: "norfolk-ai" as const,
    label: "Norfolk AI",
    desc: "Navy + yellow gold — brand theme",
    preview: { bg: "#F5F8FA", card: "#FFFFFF", sidebar: "#112548", accent: "#FDB817" },
  },
  {
    id: "noir-dark" as const,
    label: "Noir Dark",
    desc: "Monochrome executive — white + black",
    preview: { bg: "#FFFFFF", card: "#FFFFFF", sidebar: "#FFFFFF", accent: "#111111" },
  },
];

// ── Norfolk AI palette swatches for avatar backgrounds ────────────────────────
// Seeded with darker Teal #0091AE as default
const AVATAR_BG_SWATCHES = [
  { hex: "#0091AE", label: "Teal (Norfolk AI)" },       // Teal 1 — seed/default
  { hex: "#00A9B8", label: "Teal 2 (Norfolk AI)" },     // Teal 2
  { hex: "#112548", label: "Navy (Norfolk AI)" },        // Blue/Navy
  { hex: "#21B9A3", label: "Green (Norfolk AI)" },       // Green selected
  { hex: "#6A9E56", label: "Forest Green (Norfolk AI)" },// Green alt
  { hex: "#F4795B", label: "Orange (Norfolk AI)" },      // Orange
  { hex: "#FDB817", label: "Yellow Gold (Norfolk AI)" }, // Yellow/Gold
  { hex: "#34475B", label: "Dark Grey (Norfolk AI)" },   // Gray dark font
  { hex: "#CCD6E2", label: "Light Grey (Norfolk AI)" },  // Gray unselected
  { hex: "#1c1917", label: "Charcoal" },
  { hex: "#FFFFFF", label: "White" },
];

interface SettingsTabProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export function SettingsTab({ settings, updateSettings }: SettingsTabProps) {
  // ── Vendor catalogue ─────────────────────────────────────────────────────
  const vendorsQuery = trpc.llm.listVendors.useQuery();
  const primaryModelsQuery = trpc.llm.listModels.useQuery(
    { vendorId: settings.primaryVendor },
    { enabled: !!settings.primaryVendor }
  );
  const secondaryModelsQuery = trpc.llm.listModels.useQuery(
    { vendorId: settings.secondaryVendor },
    { enabled: settings.secondaryLlmEnabled && !!settings.secondaryVendor }
  );
  const refreshVendorsMutation = trpc.llm.refreshVendors.useMutation();
  const testModelMutation = trpc.llm.testModel.useMutation();
  const [testingModel, setTestingModel] = useState<string | null>(null);

  const vendors = vendorsQuery.data ?? [];
  const primaryModels = primaryModelsQuery.data ?? [];
  const secondaryModels = secondaryModelsQuery.data ?? [];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const vendorDisplayName = (id: string) =>
    vendors.find((v) => v.id === id)?.shortName ?? id;

  const modelDisplayName = (vendorId: string, modelId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.models.find((m) => m.id === modelId)?.displayName ?? modelId;
  };

  function handleRefreshVendors() {
    refreshVendorsMutation.mutate(undefined, {
      onSuccess: (data) => {
        const rec = data.recommendations;
        const resModel = rec.research?.modelId ?? "";
        const refModel = rec.refinement?.modelId ?? "";
        const resVendor = rec.research?.vendorId ?? "";
        const refVendor = rec.refinement?.vendorId ?? "";
        toast.success(
          `Catalogue refreshed — ${data.vendors.length} vendors. ` +
          `Recommendations: LLM 1 → ${resModel || "none"}, LLM 2 → ${refModel || "none"}`
        );
        // Auto-apply updated recommendations
        if (resVendor && resModel) {
          updateSettings({ primaryVendor: resVendor, primaryModel: resModel, geminiModel: resModel });
        }
        if (refVendor && refModel) {
          updateSettings({ secondaryVendor: refVendor, secondaryModel: refModel });
        }
      },
      onError: (err) => toast.error(`Refresh failed: ${err.message}`),
    });
  }

  function handleTestModel(vendorId: string, modelId: string) {
    setTestingModel(modelId);
    testModelMutation.mutate(
      { modelId, vendorId },
      {
        onSuccess: (data) => {
          setTestingModel(null);
          if (data.success) {
            toast.success(`${modelDisplayName(vendorId, modelId)}: ${data.latencyMs}ms — "${data.response}"`);
          } else {
            toast.error(`${modelDisplayName(vendorId, modelId)}: ${"error" in data ? data.error : "Failed"}`);
          }
        },
        onError: (err) => {
          setTestingModel(null);
          toast.error(`Test failed: ${err.message}`);
        },
      }
    );
  }

  // ── Determine if a hex color needs light or dark text ─────────────────────
  function needsLightText(hex: string): boolean {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  return (
    <div className="space-y-5">

      {/* ── 1. Theme ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Theme
          </CardTitle>
          <CardDescription className="text-xs">
            Choose the visual theme. Manus is the default seed theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  const colorMode = t.id === "norfolk-ai" ? ("dark" as const) : ("light" as const);
                  updateSettings({ theme: t.id, colorMode });
                }}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  settings.theme === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {/* Mini palette preview */}
                <div className="flex gap-1 mb-2">
                  {[t.preview.bg, t.preview.card, t.preview.sidebar, t.preview.accent].map((c, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-sm border border-border/40"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                {settings.theme === t.id && (
                  <Badge className="mt-1.5 text-[9px]">Active</Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Avatar Background Color ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Avatar Background Color
          </CardTitle>
          <CardDescription className="text-xs">
            Background color injected into AI portrait generation prompts.
            Norfolk AI palette colors are shown — darker teal is the default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Norfolk AI palette swatches */}
            <div className="flex flex-wrap gap-2">
              {AVATAR_BG_SWATCHES.map(({ hex, label }) => (
                <button
                  key={hex}
                  title={label}
                  onClick={() => updateSettings({ avatarBgColor: hex })}
                  className={`w-9 h-9 rounded-md border-2 transition-all relative ${
                    settings.avatarBgColor === hex
                      ? "border-primary scale-110 shadow-md"
                      : "border-border hover:border-primary/60"
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {settings.avatarBgColor === hex && (
                    <CheckCircle2
                      className="w-3.5 h-3.5 absolute top-0.5 right-0.5"
                      style={{ color: needsLightText(hex) ? "#fff" : "#111" }}
                    />
                  )}
                </button>
              ))}
            </div>
            {/* Custom color picker */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Custom:</label>
              <input
                type="color"
                value={settings.avatarBgColor}
                onChange={(e) => updateSettings({ avatarBgColor: e.target.value })}
                className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono text-muted-foreground uppercase">
                {settings.avatarBgColor}
              </span>
              {/* Live preview swatch */}
              <div
                className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: settings.avatarBgColor,
                  color: needsLightText(settings.avatarBgColor) ? "#fff" : "#111",
                }}
              >
                Aa
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. AI Model — 3-column layout ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            AI Model
          </CardTitle>
          <CardDescription className="text-xs">
            Select vendors and models for enrichment operations.
            Primary is used for all tasks; Secondary is used in parallel for research processes when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Column 1: Primary LLM ──────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">Primary LLM</span>
              </div>

              {/* Vendor selector */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vendor</Label>
                <Select
                  value={settings.primaryVendor}
                  onValueChange={(v) => {
                    const vendor = vendors.find((vd) => vd.id === v);
                    const firstModel = vendor?.models[0]?.id ?? "";
                    updateSettings({ primaryVendor: v, primaryModel: firstModel, geminiModel: firstModel });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select vendor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">
                        {v.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model list */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {primaryModelsQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading models…
                    </div>
                  ) : primaryModels.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No models found</p>
                  ) : (
                    primaryModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => updateSettings({ primaryModel: m.id, geminiModel: m.id })}
                        className={`w-full p-2 rounded-md border text-left transition-all text-xs ${
                          settings.primaryModel === m.id
                            ? "border-primary bg-primary/5 font-medium"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{m.displayName}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {settings.primaryModel === m.id && (
                              <Badge className="text-[8px] px-1 py-0">Active</Badge>
                            )}
                            <button
                              className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded border border-border/50 hover:border-border"
                              disabled={testingModel === m.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestModel(settings.primaryVendor, m.id);
                              }}
                            >
                              {testingModel === m.id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : "Test"}
                            </button>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Column 2: Secondary LLM ────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Secondary LLM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="secondary-llm-toggle" className="text-[10px] text-muted-foreground">
                    {settings.secondaryLlmEnabled ? "On" : "Off"}
                  </Label>
                  <Switch
                    id="secondary-llm-toggle"
                    checked={settings.secondaryLlmEnabled}
                    onCheckedChange={(v) => updateSettings({ secondaryLlmEnabled: v })}
                    className="scale-75"
                  />
                </div>
              </div>

              {!settings.secondaryLlmEnabled ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Cpu className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs">Enable to use a second AI model for research processes</p>
                  <p className="text-[10px] mt-1 opacity-70">Useful for cross-validation and richer enrichment</p>
                </div>
              ) : (
                <>
                  {/* Secondary vendor */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vendor</Label>
                    <Select
                      value={settings.secondaryVendor}
                      onValueChange={(v) => {
                        const vendor = vendors.find((vd) => vd.id === v);
                        const firstModel = vendor?.models[0]?.id ?? "";
                        updateSettings({ secondaryVendor: v, secondaryModel: firstModel });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select vendor…" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            {v.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Secondary model list */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                      {secondaryModelsQuery.isLoading ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading models…
                        </div>
                      ) : secondaryModels.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No models found</p>
                      ) : (
                        secondaryModels.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => updateSettings({ secondaryModel: m.id })}
                            className={`w-full p-2 rounded-md border text-left transition-all text-xs ${
                              settings.secondaryModel === m.id
                                ? "border-primary bg-primary/5 font-medium"
                                : m.recommended === "refinement"
                                ? "border-amber-400/60 hover:border-amber-400"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{m.displayName}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {m.recommended === "refinement" && (
                                  <Badge className="text-[8px] px-1 py-0 bg-amber-500 hover:bg-amber-500 text-white border-0">★ Recommended</Badge>
                                )}
                                {settings.secondaryModel === m.id && (
                                  <Badge className="text-[8px] px-1 py-0">Active</Badge>
                                )}
                                <button
                                  className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded border border-border/50 hover:border-border"
                                  disabled={testingModel === m.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTestModel(settings.secondaryVendor, m.id);
                                  }}
                                >
                                  {testingModel === m.id ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : "Test"}
                                </button>
                              </div>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                              {m.recommended === "refinement" ? m.recommendedReason ?? m.description : m.description}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Column 3: Active Summary + Refresh ─────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">Active Configuration</span>
              </div>

              {/* Primary summary */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Primary</p>
                <p className="text-xs font-semibold">{vendorDisplayName(settings.primaryVendor)}</p>
                <p className="text-[11px] text-foreground/80">{modelDisplayName(settings.primaryVendor, settings.primaryModel)}</p>
              </div>

              {/* Secondary summary */}
              <div className={`p-3 rounded-lg border space-y-1 transition-opacity ${
                settings.secondaryLlmEnabled ? "bg-muted/50 border-border" : "bg-muted/20 border-border/40 opacity-50"
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Secondary</p>
                  {settings.secondaryLlmEnabled ? (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 text-green-600 border-green-300">Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 text-muted-foreground">Disabled</Badge>
                  )}
                </div>
                {settings.secondaryLlmEnabled ? (
                  <>
                    <p className="text-xs font-semibold">{vendorDisplayName(settings.secondaryVendor)}</p>
                    <p className="text-[11px] text-foreground/80">{modelDisplayName(settings.secondaryVendor, settings.secondaryModel)}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Not configured</p>
                )}
              </div>

              {/* Refresh vendors button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-2"
                onClick={handleRefreshVendors}
                disabled={refreshVendorsMutation.isPending}
              >
                {refreshVendorsMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh Vendors & Models
              </Button>

              <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                Catalogue includes {vendors.length} vendors.
                {vendors.length > 0 && ` ${vendors.reduce((s, v) => s + v.models.length, 0)} models total.`}
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

    </div>
  );
}
