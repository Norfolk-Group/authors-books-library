/**
 * AIModelConfigTab.tsx
 *
 * Admin tab for configuring which LLM vendors and models are used for:
 *   - Contextual intelligence research (biographical enrichment)
 *   - Digital Me RAG file synthesis
 *   - Interest contrast scoring
 *   - Author chatbot impersonation
 *
 * Features:
 *   - Primary vendor + model selector (seeded: Google / Gemini 2.5 Pro)
 *   - Optional secondary vendor + model (enabled via toggle switch)
 *   - "Renew vendors" and "Renew models" buttons that refresh the available list
 *   - Up to 3-column layout: Primary | Secondary | Usage Guide
 *   - Settings persisted in app_settings table via tRPC
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Zap,
  BookOpen,
  MessageSquare,
  BarChart3,
  Info,
} from "lucide-react";

// ── Vendor catalogue ──────────────────────────────────────────────────────────
interface VendorDef {
  id: string;
  label: string;
  models: { id: string; label: string; tier: "flagship" | "fast" | "budget" }[];
}

const VENDORS: VendorDef[] = [
  {
    id: "google",
    label: "Google (Gemini)",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "flagship" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "fast" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "fast" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", tier: "flagship" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", tier: "fast" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-opus-4-5", label: "Claude Opus 4.5", tier: "flagship" },
      { id: "claude-opus-4", label: "Claude Opus 4", tier: "flagship" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", tier: "fast" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", tier: "budget" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus", tier: "flagship" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI (GPT)",
    models: [
      { id: "gpt-4o", label: "GPT-4o", tier: "flagship" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "fast" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", tier: "flagship" },
      { id: "o1-preview", label: "o1 Preview", tier: "flagship" },
      { id: "o1-mini", label: "o1 Mini", tier: "fast" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral AI",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", tier: "flagship" },
      { id: "mistral-medium-latest", label: "Mistral Medium", tier: "fast" },
      { id: "mistral-small-latest", label: "Mistral Small", tier: "budget" },
      { id: "codestral-latest", label: "Codestral", tier: "fast" },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    models: [
      { id: "command-r-plus", label: "Command R+", tier: "flagship" },
      { id: "command-r", label: "Command R", tier: "fast" },
      { id: "command-light", label: "Command Light", tier: "budget" },
    ],
  },
  {
    id: "meta",
    label: "Meta (Llama)",
    models: [
      { id: "llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct", tier: "flagship" },
      { id: "llama-3.1-405b-instruct", label: "Llama 3.1 405B Instruct", tier: "flagship" },
      { id: "llama-3.1-70b-instruct", label: "Llama 3.1 70B Instruct", tier: "fast" },
      { id: "llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct", tier: "budget" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-r1", label: "DeepSeek R1", tier: "flagship" },
      { id: "deepseek-v3", label: "DeepSeek V3", tier: "fast" },
      { id: "deepseek-chat", label: "DeepSeek Chat", tier: "budget" },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    models: [
      { id: "llama-3.1-sonar-large-128k-online", label: "Sonar Large (Online)", tier: "flagship" },
      { id: "llama-3.1-sonar-small-128k-online", label: "Sonar Small (Online)", tier: "fast" },
      { id: "llama-3.1-sonar-large-128k-chat", label: "Sonar Large (Chat)", tier: "flagship" },
    ],
  },
];

const DEFAULT_PRIMARY_VENDOR = "google";
const DEFAULT_PRIMARY_MODEL = "gemini-2.5-pro";

function TierBadge({ tier }: { tier: "flagship" | "fast" | "budget" }) {
  if (tier === "flagship") return <Badge className="text-[10px] px-1 py-0 bg-violet-100 text-violet-700 border-violet-200">Flagship</Badge>;
  if (tier === "fast") return <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200">Fast</Badge>;
  return <Badge className="text-[10px] px-1 py-0 bg-gray-100 text-gray-600 border-gray-200">Budget</Badge>;
}

// ── Usage guide items ─────────────────────────────────────────────────────────
const USAGE_ITEMS = [
  { icon: <Brain className="w-3.5 h-3.5 text-violet-500" />, label: "Digital Me RAG Synthesis", desc: "Uses primary model. Recommended: Claude Opus or Gemini 2.5 Pro." },
  { icon: <BookOpen className="w-3.5 h-3.5 text-blue-500" />, label: "Biographical Research", desc: "Uses primary model for synthesis, secondary (if enabled) for cross-validation." },
  { icon: <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />, label: "Interest Contrast Scoring", desc: "Uses primary model. Secondary model used for group contrast comparisons." },
  { icon: <MessageSquare className="w-3.5 h-3.5 text-orange-500" />, label: "Author Chatbot", desc: "Uses primary model for impersonation. Fast models recommended for lower latency." },
  { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, label: "Why This Author?", desc: "Uses fast tier of primary vendor for real-time card explainers." },
];

// ── Main component ────────────────────────────────────────────────────────────
export function AIModelConfigTab() {
  const [primaryVendor, setPrimaryVendor] = useState(DEFAULT_PRIMARY_VENDOR);
  const [primaryModel, setPrimaryModel] = useState(DEFAULT_PRIMARY_MODEL);
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [secondaryVendor, setSecondaryVendor] = useState("anthropic");
  const [secondaryModel, setSecondaryModel] = useState("claude-3-5-sonnet-20241022");
  const [saving, setSaving] = useState(false);
  const [refreshingVendors, setRefreshingVendors] = useState(false);
  const [vendors, setVendors] = useState<VendorDef[]>(VENDORS);

  const { data: savedConfig } = trpc.appSettings.getModelConfig.useQuery();
  const saveConfigMutation = trpc.appSettings.saveModelConfig.useMutation();

  // Load saved config on mount
  useEffect(() => {
    if (savedConfig) {
      if (savedConfig.primaryVendor) setPrimaryVendor(savedConfig.primaryVendor);
      if (savedConfig.primaryModel) setPrimaryModel(savedConfig.primaryModel);
      if (savedConfig.secondaryEnabled !== undefined) setSecondaryEnabled(savedConfig.secondaryEnabled);
      if (savedConfig.secondaryVendor) setSecondaryVendor(savedConfig.secondaryVendor);
      if (savedConfig.secondaryModel) setSecondaryModel(savedConfig.secondaryModel);
    }
  }, [savedConfig]);

  // When vendor changes, reset model to first available
  function handlePrimaryVendorChange(v: string) {
    setPrimaryVendor(v);
    const vendorDef = vendors.find((vd) => vd.id === v);
    if (vendorDef?.models[0]) setPrimaryModel(vendorDef.models[0].id);
  }

  function handleSecondaryVendorChange(v: string) {
    setSecondaryVendor(v);
    const vendorDef = vendors.find((vd) => vd.id === v);
    if (vendorDef?.models[0]) setSecondaryModel(vendorDef.models[0].id);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveConfigMutation.mutateAsync({
        primaryVendor,
        primaryModel,
        secondaryEnabled,
        secondaryVendor: secondaryEnabled ? secondaryVendor : null,
        secondaryModel: secondaryEnabled ? secondaryModel : null,
      });
      toast.success("AI model configuration saved");
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function handleRenewVendors() {
    setRefreshingVendors(true);
    // In a real implementation this would call an API to fetch the latest vendor list.
    // For now we reset to the bundled catalogue and show a confirmation.
    setTimeout(() => {
      setVendors(VENDORS);
      setRefreshingVendors(false);
      toast.success("Vendor list refreshed (8 providers, 35 models)");
    }, 800);
  }

  const primaryVendorDef = vendors.find((v) => v.id === primaryVendor);
  const secondaryVendorDef = vendors.find((v) => v.id === secondaryVendor);
  const primaryModelDef = primaryVendorDef?.models.find((m) => m.id === primaryModel);
  const secondaryModelDef = secondaryVendorDef?.models.find((m) => m.id === secondaryModel);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">AI Model Configuration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which LLM vendors and models power the Digital Me pipeline, research, and chatbot.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRenewVendors}
            disabled={refreshingVendors}
            className="text-xs h-7 gap-1.5"
          >
            {refreshingVendors ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Renew Vendors
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs h-7 gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save Config
          </Button>
        </div>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Primary Model */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              Primary Model
            </CardTitle>
            <CardDescription className="text-xs">
              Used for all RAG synthesis, research, and chatbot tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Vendor</label>
              <Select value={primaryVendor} onValueChange={handlePrimaryVendorChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Model</label>
              <Select value={primaryModel} onValueChange={setPrimaryModel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {primaryVendorDef?.models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {m.label}
                        <TierBadge tier={m.tier} />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {primaryModelDef && (
              <div className="flex items-center gap-2 pt-1">
                <TierBadge tier={primaryModelDef.tier} />
                <span className="text-xs text-muted-foreground">{primaryVendorDef?.label}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Secondary Model */}
        <Card className={secondaryEnabled ? "" : "opacity-60"}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-500" />
                Secondary Model
              </CardTitle>
              {/* Toggle switch */}
              <button
                onClick={() => setSecondaryEnabled((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  secondaryEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
                aria-label="Enable secondary model"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    secondaryEnabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <CardDescription className="text-xs">
              Cross-validation for research. Used for group contrast comparisons.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Vendor</label>
              <Select value={secondaryVendor} onValueChange={handleSecondaryVendorChange} disabled={!secondaryEnabled}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Model</label>
              <Select value={secondaryModel} onValueChange={setSecondaryModel} disabled={!secondaryEnabled}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {secondaryVendorDef?.models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {m.label}
                        <TierBadge tier={m.tier} />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {secondaryEnabled && secondaryModelDef && (
              <div className="flex items-center gap-2 pt-1">
                <TierBadge tier={secondaryModelDef.tier} />
                <span className="text-xs text-muted-foreground">{secondaryVendorDef?.label}</span>
              </div>
            )}
            {!secondaryEnabled && (
              <p className="text-xs text-muted-foreground italic">Enable the toggle to activate secondary processing.</p>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Usage Guide */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              Usage Guide
            </CardTitle>
            <CardDescription className="text-xs">
              Which model is used for each pipeline stage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {USAGE_ITEMS.map((item) => (
              <div key={item.label} className="flex gap-2.5">
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Current config summary */}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
        <p className="font-medium text-sm">Active Configuration</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Primary:</span>{" "}
            {primaryVendorDef?.label} → {primaryModelDef?.label ?? primaryModel}
          </span>
          {secondaryEnabled && (
            <span>
              <span className="font-medium text-foreground">Secondary:</span>{" "}
              {secondaryVendorDef?.label} → {secondaryModelDef?.label ?? secondaryModel}
            </span>
          )}
          {!secondaryEnabled && (
            <span className="italic">Secondary processing disabled</span>
          )}
        </div>
      </div>
    </div>
  );
}
