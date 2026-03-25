/**
 * AiTab — Admin Console AI configuration panel.
 *
 * Five sub-tabs, each with an independent vendor + model selector:
 *   1. Avatar Generation  — defaults to Google / Nano Banana (image gen)
 *   2. Avatar Research    — research LLM for meticulous avatar pipeline
 *   3. Author Research    — primary + optional secondary LLM
 *   4. Book Research      — primary + optional secondary LLM
 *   5. Other              — primary + optional secondary LLM for misc tasks
 *
 * Each sub-tab persists its own settings independently in AppSettings.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ImageIcon, BookOpen, Users, Sparkles, Zap } from "lucide-react";
import { type AppSettings } from "@/contexts/AppSettingsContext";
import { ModelSelector, type PurposeConfig } from "./ModelSelector";
import { AvatarResolutionControls } from "./AvatarResolutionControls";
import { BatchRegenSection } from "./BatchRegenSection";
import { AvatarDetailTable } from "./AvatarDetailTable";

// ── Purpose Configs ──────────────────────────────────────────────────────────

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
    // No recommendUseCase — image-gen models are not scored by the text recommendation engine
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
    recommendUseCase: "avatar_research",
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
    recommendUseCase: "research",
    secondaryRecommendUseCase: "refinement",
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
    recommendUseCase: "research",
    secondaryRecommendUseCase: "refinement",
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
    recommendUseCase: "structured",
    secondaryRecommendUseCase: "refinement",
  },
];

// ── Main AiTab component ──────────────────────────────────────────────────────

interface AiTabProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

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
