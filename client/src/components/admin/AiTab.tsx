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
  Palette,
  ScanSearch,
  Wand2,
  Play,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Settings2,
  Ratio,
} from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";
import { AspectRatioSelector } from "./AspectRatioSelector";
import { QualitySlider } from "./QualitySlider";
import { DimensionInput } from "./DimensionInput";
import { VendorCapabilityAlert } from "./VendorCapabilityAlert";

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
      "Graphics LLM used to generate author avatar images from a meticulous prompt. Nano Banana (Google Imagen) is the recommended default for photorealistic headshots. The pipeline first researches the author deeply, builds a detailed visual description, then passes it to this model.",
    icon: ImageIcon,
    vendorKey: "avatarGenVendor",
    modelKey: "avatarGenModel",
    imageGenOnly: true,
    defaultVendor: "google",
    defaultModel: "nano-banana",
  },
  {
    label: "Avatar Research",
    description:
      "Research LLM used in the meticulous avatar pipeline to deeply analyze the author, synthesize information from Amazon, Wikipedia, and Apify scraping, and build a precise visual description that drives the image generation prompt.",
    icon: Users,
    vendorKey: "avatarResearchVendor",
    modelKey: "avatarResearchModel",
    defaultVendor: "google",
    defaultModel: "gemini-2.5-flash",
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

// ── Background presets ───────────────────────────────────────────────────────

const BG_PRESETS: { id: string; label: string; hex: string; description: string }[] = [
  {
    id: "bokeh-gold",
    label: "Bokeh Gold",
    hex: "#c8960c",
    description: "Warm golden bokeh with amber/cream light orbs — canonical default",
  },
  {
    id: "bokeh-blue",
    label: "Bokeh Blue",
    hex: "#0091ae",
    description: "Cool teal-blue bokeh, professional and calm",
  },
  {
    id: "office",
    label: "Office",
    hex: "#6b7280",
    description: "Soft neutral office environment, blurred background",
  },
  {
    id: "library",
    label: "Library",
    hex: "#92400e",
    description: "Warm brown bookshelves, intellectual atmosphere",
  },
  {
    id: "gradient-dark",
    label: "Gradient Dark",
    hex: "#1e293b",
    description: "Deep charcoal-to-navy gradient, executive look",
  },
  {
    id: "gradient-light",
    label: "Gradient Light",
    hex: "#f1f5f9",
    description: "Clean off-white gradient, minimal and modern",
  },
];

// ── Sub-component: BackgroundSelector ────────────────────────────────────────

interface BackgroundSelectorProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

function BackgroundSelector({ settings, updateSettings }: BackgroundSelectorProps) {
  const [customHex, setCustomHex] = useState("");
  const [hexError, setHexError] = useState("");

  const activeHex = settings.avatarBgColor ?? "#c8960c";
  const activePreset = BG_PRESETS.find((p) => p.hex.toLowerCase() === activeHex.toLowerCase());

  function handlePresetClick(hex: string) {
    setCustomHex("");
    setHexError("");
    updateSettings({ avatarBgColor: hex });
  }

  function handleCustomHexChange(val: string) {
    setCustomHex(val);
    setHexError("");
    const clean = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      updateSettings({ avatarBgColor: clean });
    } else if (clean.length > 0) {
      setHexError("Enter a valid 6-digit hex color, e.g. #ff8800");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">Avatar Background</span>
      </div>

      {/* Active preview */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border">
        <div
          className="w-10 h-10 rounded-full border-2 border-border shadow-sm shrink-0"
          style={{ backgroundColor: activeHex }}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">
            {activePreset ? activePreset.label : "Custom"}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">{activeHex}</p>
          {activePreset && (
            <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
              {activePreset.description}
            </p>
          )}
        </div>
      </div>

      {/* Swatch grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {BG_PRESETS.map((preset) => (
          <button
            key={preset.id}
            title={preset.description}
            onClick={() => handlePresetClick(preset.hex)}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-md border text-center transition-all ${
              activeHex.toLowerCase() === preset.hex.toLowerCase()
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div
              className="w-7 h-7 rounded-full border border-border/60 shadow-sm"
              style={{ backgroundColor: preset.hex }}
            />
            <span className="text-[9px] leading-tight font-medium">{preset.label}</span>
          </button>
        ))}
      </div>

      {/* Custom hex input */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Custom Hex Color</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={activeHex}
            onChange={(e) => handlePresetClick(e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent p-0.5"
            title="Pick a color"
          />
          <input
            type="text"
            placeholder="#c8960c"
            value={customHex}
            onChange={(e) => handleCustomHexChange(e.target.value)}
            className="flex-1 h-8 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </div>
        {hexError && <p className="text-[9px] text-destructive">{hexError}</p>}
      </div>

      {/* Canonical note */}
      <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
        <div className="flex items-start gap-1.5">
          <Wand2 className="w-3 h-3 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[9px] text-amber-700 dark:text-amber-300 leading-relaxed">
            <strong>Bokeh Gold</strong> is the canonical default. All new avatars use this
            background. Use <em>Normalize All</em> in the Authors tab to re-generate
            existing avatars with the current background.
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation();
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testPortraitUrl, setTestPortraitUrl] = useState<string | null>(null);
  const [testPortraitError, setTestPortraitError] = useState<string | null>(null);

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
          // Avatar Generation: Background Selector
          <BackgroundSelector settings={settings} updateSettings={updateSettings} />
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

        {/* Test Avatar button — Avatar Generation only */}
        {purpose.imageGenOnly && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-2"
              onClick={() => {
                setTestPortraitUrl(null);
                setTestPortraitError(null);
                generateAvatarMutation.mutate(
                  {
                    authorName: "Adam Grant",
                    bgColor: settings.avatarBgColor,
                    avatarGenVendor: settings.avatarGenVendor,
                    avatarGenModel: settings.avatarGenModel,
                    avatarResearchVendor: settings.avatarResearchVendor,
                    avatarResearchModel: settings.avatarResearchModel,
                  },
                  {
                    onSuccess: (data) => {
                      setTestPortraitUrl(data.url);
                      toast.success("Test avatar generated successfully!");
                    },
                    onError: (err) => {
                      setTestPortraitError(err.message);
                      toast.error(`Avatar test failed: ${err.message}`);
                    },
                  }
                );
              }}
              disabled={generateAvatarMutation.isPending}
            >
              {generateAvatarMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              {generateAvatarMutation.isPending ? "Generating…" : "Test Avatar"}
            </Button>

            {/* Inline test result */}
            {testPortraitUrl && (
              <div className="rounded-lg border border-border overflow-hidden">
                <img
                  src={testPortraitUrl}
                  alt="Test avatar"
                  className="w-full object-cover max-h-48"
                />
                <div className="px-2 py-1.5 bg-muted/50 flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">
                    {settings.avatarGenVendor} / {settings.avatarGenModel}
                  </span>
                  <span className="text-[9px] text-green-600 font-medium">✓ Success</span>
                </div>
              </div>
            )}
            {testPortraitError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-2 py-1.5">
                <p className="text-[9px] text-destructive">{testPortraitError}</p>
              </div>
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

//// ── Avatar Resolution & Output Controls ────────────────────────────────────

const OUTPUT_FORMATS = [
  { value: "webp", label: "WebP", desc: "Best compression, modern browsers" },
  { value: "png", label: "PNG", desc: "Lossless, larger files" },
  { value: "jpeg", label: "JPEG", desc: "Universal, lossy" },
];

function AvatarResolutionControls({
  settings,
  updateSettings,
}: {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}) {
  const vendor = settings.avatarGenVendor ?? "google";
  const isReplicate = vendor === "replicate";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Avatar Resolution & Output
        </CardTitle>
        <CardDescription className="text-xs">
          Fine-tune the quality, format, and dimensions of generated avatars.
          Some options are vendor-specific (marked accordingly).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Row 1: Aspect Ratio (visual grid) ──────────────────────────── */}
        <AspectRatioSelector
          value={settings.avatarAspectRatio ?? "1:1"}
          onChange={(v) => updateSettings({ avatarAspectRatio: v })}
        />

        {/* ── Row 2: Sliders ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Output Format */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <Label className="text-xs">Output Format</Label>
            </div>
            <Select
              value={settings.avatarOutputFormat ?? "webp"}
              onValueChange={(v) => updateSettings({ avatarOutputFormat: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground ml-1">— {f.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Output Quality */}
          <QualitySlider
            label="Output Quality"
            value={settings.avatarOutputQuality ?? 90}
            onChange={(v) => updateSettings({ avatarOutputQuality: v })}
            min={10}
            max={100}
            step={5}
            formatValue={(v) => `${v}%`}
            scaleLabels={{ min: "10 (fast)", mid: "50", max: "100 (best)" }}
          />

          {/* Guidance Scale */}
          <QualitySlider
            label="Guidance Scale"
            value={settings.avatarGuidanceScale ?? 7.5}
            onChange={(v) => updateSettings({ avatarGuidanceScale: v })}
            min={1}
            max={20}
            step={0.5}
            formatValue={(v) => v.toFixed(1)}
            scaleLabels={{ min: "1 (creative)", mid: "7.5 (balanced)", max: "20 (strict)" }}
          />

          {/* Inference Steps (Replicate only) */}
          <QualitySlider
            label="Inference Steps"
            value={settings.avatarInferenceSteps ?? 28}
            onChange={(v) => updateSettings({ avatarInferenceSteps: v })}
            min={1}
            max={50}
            step={1}
            vendorBadge="Replicate"
            disabled={!isReplicate}
            scaleLabels={{ min: "1 (fast)", mid: "28 (default)", max: "50 (max quality)" }}
          />
        </div>

        {/* ── Row 3: Custom Dimensions (Replicate only) ──────────────────── */}
        <DimensionInput
          width={settings.avatarWidth ?? 0}
          height={settings.avatarHeight ?? 0}
          onWidthChange={(v) => updateSettings({ avatarWidth: v })}
          onHeightChange={(v) => updateSettings({ avatarHeight: v })}
          disabled={!isReplicate}
          vendorBadge="Replicate"
          maxDimension={2048}
        />

        {/* ── Row 4: Vendor capability alert ──────────────────────────────── */}
        <VendorCapabilityAlert
          vendor={vendor}
          selectedRatio={settings.avatarAspectRatio ?? "1:1"}
          customWidth={settings.avatarWidth ?? 0}
          customHeight={settings.avatarHeight ?? 0}
        />

        {/* Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-[10px] text-muted-foreground">
            <strong>Current:</strong>{" "}
            {settings.avatarAspectRatio ?? "1:1"} ·{" "}
            {(settings.avatarOutputFormat ?? "webp").toUpperCase()} @{settings.avatarOutputQuality ?? 90}% ·{" "}
            Guidance {(settings.avatarGuidanceScale ?? 7.5).toFixed(1)}
            {isReplicate && ` · ${settings.avatarInferenceSteps ?? 28} steps`}
            {isReplicate && (settings.avatarWidth ?? 0) > 0 && ` · ${settings.avatarWidth}×${settings.avatarHeight}px`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Batch Regeneration Section ───────────────────────────────────────────

function BatchRegenSection() {
  const utils = trpc.useUtils();
  const { data: progress, isLoading } = trpc.authorProfiles.getBatchRegenProgress.useQuery(
    undefined,
    {
      // Poll every 5s when a batch is running
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return false;
        if (d.finishedAt) return false; // done
        if (d.total > 0 && d.completed < d.total) return 5000; // running
        return false;
      },
    }
  );

  const triggerMutation = trpc.authorProfiles.triggerBatchRegen.useMutation({
    onSuccess: () => {
      toast.success("Batch regeneration started in background!");
      utils.authorProfiles.getBatchRegenProgress.invalidate();
    },
    onError: (e) => toast.error("Failed to start batch: " + e.message),
  });

  const isRunning = progress && !progress.finishedAt && progress.total > 0;
  const isDone = progress?.finishedAt != null;
  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Batch Avatar Regeneration
        </CardTitle>
        <CardDescription className="text-xs">
          Upgrade all authors to the Tier 5 meticulous pipeline. Runs serially in the background
          (~35s per author). Progress updates every 5 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        {progress && progress.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isRunning && progress.current ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing: <strong>{progress.current}</strong>
                  </span>
                ) : isDone ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Idle
                  </span>
                )}
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {progress.completed}/{progress.total} ({pct}%)
              </span>
            </div>
            {/* Progress bar track */}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                {progress.succeeded} succeeded
              </span>
              {progress.failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  {progress.failed} failed
                </span>
              )}
              {isDone && progress.finishedAt && (
                <span className="flex items-center gap-1 ml-auto">
                  <Clock className="w-3 h-3" />
                  Finished {new Date(progress.finishedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* No progress yet */}
        {!progress && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            No batch has been run yet. Click "Regenerate All" to start.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => triggerMutation.mutate({ forceRegenerate: true })}
            disabled={triggerMutation.isPending || !!isRunning}
          >
            {triggerMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            {isRunning ? "Running…" : "Regenerate All"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => utils.authorProfiles.getBatchRegenProgress.invalidate()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Avatar Detail Table component ───────────────────────────────────────────
function AvatarDetailTable() {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const { data: rows, isLoading } = trpc.authorProfiles.getAvatarDetailedStats.useQuery(
    undefined,
    { enabled: expanded }
  );

  const filtered = (rows ?? []).filter((r) =>
    !search || r.authorName.toLowerCase().includes(search.toLowerCase())
  );

  const withRef = (rows ?? []).filter((r) => r.bestReferencePhotoUrl).length;
  const withS3 = (rows ?? []).filter((r) => r.s3AvatarUrl).length;

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Author Avatar Details
          </div>
          <div className="flex items-center gap-3">
            {rows && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-normal">
                <span className="bg-muted rounded px-1.5 py-0.5">{withS3}/{rows.length} in S3</span>
                <span className="bg-muted rounded px-1.5 py-0.5">{withRef}/{rows.length} have ref photo</span>
              </div>
            )}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          Per-author avatar status with reference photo used during AI generation.
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search authors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 text-xs px-2.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-auto max-h-[400px] rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Author</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Avatar</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ref Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.authorName} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 font-medium truncate max-w-[160px]" title={row.authorName}>
                          {row.authorName}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            row.avatarSource === 'google-imagen' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            (row.avatarSource === 'ai' || row.avatarSource === 'apify') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            row.avatarSource === 'drive' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            (row.avatarSource === 'wikipedia' || row.avatarSource === 'tavily') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {row.avatarSource ?? 'none'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          {row.s3AvatarUrl ? (
                            <a href={row.s3AvatarUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img src={row.s3AvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.bestReferencePhotoUrl ? (
                            <a
                              href={row.bestReferencePhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img src={row.bestReferencePhotoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                          No authors found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main AiTab component ──────────────────────────────────────────────────────

export function AiTab({ settings, updateSettings }: AiTabProps) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="avatar-generation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto">
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

      {/* ── Batch Avatar Regeneration ──────────────────────────────────────── */}
      <BatchRegenSection />

      {/* ── Avatar Resolution & Output Controls ──────────────────────────────── */}
      <AvatarResolutionControls settings={settings} updateSettings={updateSettings} />

      {/* ── Author Avatar Details Table ──────────────────────────────────────── */}
      <AvatarDetailTable />

      {/* ── Batch Concurrency Slider ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Batch Concurrency
          </CardTitle>
          <CardDescription className="text-xs">
            Maximum number of authors or books processed simultaneously during batch operations.
            Higher values are faster but increase API rate-limit risk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Parallel tasks</Label>
              <span className="text-sm font-bold tabular-nums">
                {settings.batchConcurrency ?? 3}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.batchConcurrency ?? 3}
              onChange={(e) => updateSettings({ batchConcurrency: Number(e.target.value) })}
              className="w-full h-2 rounded-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1 (sequential)</span>
              <span>5 (balanced)</span>
              <span>10 (max)</span>
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
              Current: <strong>{settings.batchConcurrency ?? 3} authors/books at a time</strong>.
              Default is 3. Increase to 5–7 for faster batch runs; keep at 1–2 if hitting rate limits.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
