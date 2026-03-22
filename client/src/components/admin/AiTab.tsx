/**
 * AiTab — Admin Console AI configuration panel.
 *
 * Four sub-tabs, each with an independent vendor + model selector:
 *   1. Avatar Generation  — defaults to Google / Nano Banana (image gen)
 *   2. Author Research    — primary + optional secondary LLM
 *   3. Book Research      — primary + optional secondary LLM
 *   4. Other              — primary + optional secondary LLM for misc tasks
 *
 * Each sub-tab persists its own settings independently in AppSettings.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Loader2,
  Cpu,
  RefreshCw,
  Zap,
  CheckCircle2,
  ImageIcon,
  BookOpen,
  Users,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiTabProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

// Keys for each purpose's settings in AppSettings
interface PurposeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  vendorKey: keyof AppSettings;
  modelKey: keyof AppSettings;
  secondaryEnabledKey?: keyof AppSettings;
  secondaryVendorKey?: keyof AppSettings;
  secondaryModelKey?: keyof AppSettings;
  /** If true, only show image-gen models */
  imageGenOnly?: boolean;
  /** If true, hide text LLM models */
  hideTextModels?: boolean;
  defaultVendor?: string;
  defaultModel?: string;
}

const PURPOSES: PurposeConfig[] = [
  {
    label: "Avatar Generation",
    description:
      "AI model used to generate author portrait images. Nano Banana is the recommended default for high-quality headshots.",
    icon: ImageIcon,
    vendorKey: "avatarGenVendor",
    modelKey: "avatarGenModel",
    imageGenOnly: true,
    defaultVendor: "google",
    defaultModel: "nano-banana",
  },
  {
    label: "Author Research",
    description:
      "Models used for author bio enrichment, Wikipedia lookups, and Perplexity research. Supports a secondary LLM for cross-validation.",
    icon: Users,
    vendorKey: "authorResearchVendor",
    modelKey: "authorResearchModel",
    secondaryEnabledKey: "authorResearchSecondaryEnabled",
    secondaryVendorKey: "authorResearchSecondaryVendor",
    secondaryModelKey: "authorResearchSecondaryModel",
    defaultVendor: "google",
    defaultModel: "gemini-2.5-flash",
  },
  {
    label: "Book Research",
    description:
      "Models used for book summary enrichment, Google Books lookups, and metadata generation. Supports a secondary LLM for refinement.",
    icon: BookOpen,
    vendorKey: "bookResearchVendor",
    modelKey: "bookResearchModel",
    secondaryEnabledKey: "bookResearchSecondaryEnabled",
    secondaryVendorKey: "bookResearchSecondaryVendor",
    secondaryModelKey: "bookResearchSecondaryModel",
    defaultVendor: "google",
    defaultModel: "gemini-2.5-flash",
  },
  {
    label: "Other",
    description:
      "Fallback model for miscellaneous AI tasks not covered by the specific categories above.",
    icon: Sparkles,
    vendorKey: "otherAiVendor",
    modelKey: "otherAiModel",
    secondaryEnabledKey: "otherAiSecondaryEnabled",
    secondaryVendorKey: "otherAiSecondaryVendor",
    secondaryModelKey: "otherAiSecondaryModel",
    defaultVendor: "google",
    defaultModel: "gemini-2.5-flash",
  },
];

// ── Sub-component: ModelSelector ─────────────────────────────────────────────

interface ModelSelectorProps {
  purpose: PurposeConfig;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

function ModelSelector({ purpose, settings, updateSettings }: ModelSelectorProps) {
  const vendorsQuery = trpc.llm.listVendors.useQuery();
  const refreshVendorsMutation = trpc.llm.refreshVendors.useMutation();
  const testModelMutation = trpc.llm.testModel.useMutation();
  const [testingModel, setTestingModel] = useState<string | null>(null);

  const vendors = vendorsQuery.data ?? [];

  const primaryVendorId = settings[purpose.vendorKey] as string;
  const primaryModelId = settings[purpose.modelKey] as string;
  const secondaryEnabled = purpose.secondaryEnabledKey
    ? (settings[purpose.secondaryEnabledKey] as boolean)
    : false;
  const secondaryVendorId = purpose.secondaryVendorKey
    ? (settings[purpose.secondaryVendorKey] as string)
    : "";
  const secondaryModelId = purpose.secondaryModelKey
    ? (settings[purpose.secondaryModelKey] as string)
    : "";

  // Filter models based on purpose
  const filterModels = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    const all = vendor?.models ?? [];
    if (purpose.imageGenOnly) return all.filter((m) => m.imageGen);
    return all.filter((m) => !m.imageGen);
  };

  const primaryModels = filterModels(primaryVendorId);
  const secondaryModels = filterModels(secondaryVendorId);

  const vendorDisplayName = (id: string) =>
    vendors.find((v) => v.id === id)?.shortName ?? id;

  const modelDisplayName = (vendorId: string, modelId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.models.find((m) => m.id === modelId)?.displayName ?? modelId;
  };

  function handleRefreshVendors() {
    refreshVendorsMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Catalogue refreshed — ${data.vendors.length} vendors loaded.`);
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
            toast.success(
              `${modelDisplayName(vendorId, modelId)}: ${data.latencyMs}ms — "${data.response}"`
            );
          } else {
            toast.error(
              `${modelDisplayName(vendorId, modelId)}: ${"error" in data ? data.error : "Failed"}`
            );
          }
        },
        onError: (err) => {
          setTestingModel(null);
          toast.error(`Test failed: ${err.message}`);
        },
      }
    );
  }

  const hasSecondary =
    !!purpose.secondaryEnabledKey &&
    !!purpose.secondaryVendorKey &&
    !!purpose.secondaryModelKey;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ── Column 1: Primary Model ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">
            {purpose.imageGenOnly ? "Image Generation Model" : "Primary LLM"}
          </span>
        </div>

        {/* Vendor selector */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Vendor</Label>
          <Select
            value={primaryVendorId}
            onValueChange={(v) => {
              const vendor = vendors.find((vd) => vd.id === v);
              const models = purpose.imageGenOnly
                ? (vendor?.models ?? []).filter((m) => m.imageGen)
                : (vendor?.models ?? []).filter((m) => !m.imageGen);
              const firstModel = models[0]?.id ?? "";
              updateSettings({
                [purpose.vendorKey]: v,
                [purpose.modelKey]: firstModel,
              } as Partial<AppSettings>);
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
            {vendorsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading models…
              </div>
            ) : primaryModels.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No models available</p>
            ) : (
              primaryModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() =>
                    updateSettings({ [purpose.modelKey]: m.id } as Partial<AppSettings>)
                  }
                  className={`w-full p-2 rounded-md border text-left transition-all text-xs ${
                    primaryModelId === m.id
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{m.displayName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {primaryModelId === m.id && (
                        <Badge className="text-[8px] px-1 py-0">Active</Badge>
                      )}
                      {!purpose.imageGenOnly && (
                        <button
                          className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded border border-border/50 hover:border-border"
                          disabled={testingModel === m.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestModel(primaryVendorId, m.id);
                          }}
                        >
                          {testingModel === m.id ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            "Test"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
                    {m.description}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Column 2: Secondary LLM (text-only purposes) ─────────────────── */}
      <div className="space-y-3">
        {hasSecondary ? (
          <>
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Secondary LLM</span>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`secondary-toggle-${purpose.vendorKey}`}
                  className="text-[10px] text-muted-foreground"
                >
                  {secondaryEnabled ? "On" : "Off"}
                </Label>
                <Switch
                  id={`secondary-toggle-${purpose.vendorKey}`}
                  checked={secondaryEnabled}
                  onCheckedChange={(v) =>
                    updateSettings({
                      [purpose.secondaryEnabledKey!]: v,
                    } as Partial<AppSettings>)
                  }
                  className="scale-75"
                />
              </div>
            </div>

            {!secondaryEnabled ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Cpu className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">Enable to use a second AI model</p>
                <p className="text-[10px] mt-1 opacity-70">
                  Useful for cross-validation and richer enrichment
                </p>
              </div>
            ) : (
              <>
                {/* Secondary vendor */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vendor</Label>
                  <Select
                    value={secondaryVendorId}
                    onValueChange={(v) => {
                      const vendor = vendors.find((vd) => vd.id === v);
                      const models = (vendor?.models ?? []).filter((m) => !m.imageGen);
                      const firstModel = models[0]?.id ?? "";
                      updateSettings({
                        [purpose.secondaryVendorKey!]: v,
                        [purpose.secondaryModelKey!]: firstModel,
                      } as Partial<AppSettings>);
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
                    {vendorsQuery.isLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading models…
                      </div>
                    ) : secondaryModels.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No models available</p>
                    ) : (
                      secondaryModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() =>
                            updateSettings({
                              [purpose.secondaryModelKey!]: m.id,
                            } as Partial<AppSettings>)
                          }
                          className={`w-full p-2 rounded-md border text-left transition-all text-xs ${
                            secondaryModelId === m.id
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
                                <Badge className="text-[8px] px-1 py-0 bg-amber-500 hover:bg-amber-500 text-white border-0">
                                  ★ Rec
                                </Badge>
                              )}
                              {secondaryModelId === m.id && (
                                <Badge className="text-[8px] px-1 py-0">Active</Badge>
                              )}
                              <button
                                className="text-[9px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded border border-border/50 hover:border-border"
                                disabled={testingModel === m.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTestModel(secondaryVendorId, m.id);
                                }}
                              >
                                {testingModel === m.id ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  "Test"
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                            {m.recommended === "refinement"
                              ? m.recommendedReason ?? m.description
                              : m.description}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          // Avatar Generation: no secondary — show info panel instead
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">About Image Generation</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Nano Banana</strong> is Google's latest
                state-of-the-art image generation model, optimized for photorealistic portraits
                and headshots.
              </p>
              <p>
                It is the recommended default for generating author avatars. The background color
                and style are controlled by the <strong className="text-foreground">Avatar Background Color</strong> setting
                in the Settings tab.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Column 3: Active Configuration Summary ───────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Active Configuration</span>
        </div>

        {/* Primary summary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {purpose.imageGenOnly ? "Image Model" : "Primary"}
          </p>
          <p className="text-xs font-semibold">{vendorDisplayName(primaryVendorId)}</p>
          <p className="text-[11px] text-foreground/80">
            {modelDisplayName(primaryVendorId, primaryModelId)}
          </p>
        </div>

        {/* Secondary summary (text-only purposes) */}
        {hasSecondary && (
          <div
            className={`p-3 rounded-lg border space-y-1 transition-opacity ${
              secondaryEnabled
                ? "bg-muted/50 border-border"
                : "bg-muted/20 border-border/40 opacity-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Secondary
              </p>
              {secondaryEnabled ? (
                <Badge
                  variant="outline"
                  className="text-[8px] px-1 py-0 text-green-600 border-green-300"
                >
                  Enabled
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[8px] px-1 py-0 text-muted-foreground"
                >
                  Disabled
                </Badge>
              )}
            </div>
            {secondaryEnabled ? (
              <>
                <p className="text-xs font-semibold">{vendorDisplayName(secondaryVendorId)}</p>
                <p className="text-[11px] text-foreground/80">
                  {modelDisplayName(secondaryVendorId, secondaryModelId)}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">Not configured</p>
            )}
          </div>
        )}

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
          {vendors.length} vendors · {vendors.reduce((s, v) => s + v.models.length, 0)} models
        </p>
      </div>
    </div>
  );
}

// ── Main AiTab component ──────────────────────────────────────────────────────

export function AiTab({ settings, updateSettings }: AiTabProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="avatar-generation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          {PURPOSES.map((p) => {
            const tabValue = p.label.toLowerCase().replace(/\s+/g, "-");
            const Icon = p.icon;
            return (
              <TabsTrigger
                key={tabValue}
                value={tabValue}
                className="text-xs py-2 gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PURPOSES.map((p) => {
          const tabValue = p.label.toLowerCase().replace(/\s+/g, "-");
          const Icon = p.icon;
          return (
            <TabsContent key={tabValue} value={tabValue}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {p.label}
                  </CardTitle>
                  <CardDescription className="text-xs">{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ModelSelector
                    purpose={p}
                    settings={settings}
                    updateSettings={updateSettings}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
