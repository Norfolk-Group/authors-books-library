/**
 * SettingsTab - Theme and AI model settings tab for the Admin Console.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Palette, Cpu, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";

const THEMES = [
  { id: "manus" as const, label: "Manus", desc: "Clean light theme" },
  { id: "norfolk-ai" as const, label: "Norfolk AI", desc: "Green-accented dark" },
  { id: "noir-dark" as const, label: "Noir Dark", desc: "Violet-accented dark" },
];

interface SettingsTabProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export function SettingsTab({ settings, updateSettings }: SettingsTabProps) {
  const modelsQuery = trpc.llm.listModels.useQuery();
  const testModelMutation = trpc.llm.testModel.useMutation();
  const [testingModel, setTestingModel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Theme
          </CardTitle>
          <CardDescription className="text-xs">Choose the visual theme for the library</CardDescription>
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
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                {settings.theme === t.id && <Badge className="mt-1.5 text-[9px]">Active</Badge>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Avatar Background Color */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Avatar Background Color
          </CardTitle>
          <CardDescription className="text-xs">
            Background color injected into AI portrait generation prompts. Pick a color that complements your theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Preset swatches */}
            <div className="flex flex-wrap gap-2">
              {[
                { hex: "#1e293b", label: "Slate" },
                { hex: "#0f172a", label: "Navy" },
                { hex: "#1c1917", label: "Charcoal" },
                { hex: "#14532d", label: "Forest" },
                { hex: "#1e3a5f", label: "Ocean" },
                { hex: "#4a1942", label: "Plum" },
                { hex: "#7c6f5c", label: "Warm Grey" },
                { hex: "#f8f4ef", label: "Cream" },
                { hex: "#ffffff", label: "White" },
              ].map(({ hex, label }) => (
                <button
                  key={hex}
                  title={label}
                  onClick={() => updateSettings({ avatarBgColor: hex })}
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    settings.avatarBgColor === hex
                      ? "border-primary scale-110 shadow-md"
                      : "border-border hover:border-primary/60"
                  }`}
                  style={{ backgroundColor: hex }}
                />
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
              <span className="text-xs font-mono text-muted-foreground">{settings.avatarBgColor}</span>
              {/* Live preview swatch */}
              <div
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center"
                style={{ backgroundColor: settings.avatarBgColor }}
              >
                <span className="text-[8px]" style={{ color: settings.avatarBgColor === "#ffffff" || settings.avatarBgColor === "#f8f4ef" ? "#000" : "#fff" }}>Aa</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Model */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            AI Model
          </CardTitle>
          <CardDescription className="text-xs">Select the Gemini model for enrichment operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(modelsQuery.data ?? []).map((m) => (
              <button
                key={m.id}
                onClick={() => updateSettings({ geminiModel: m.id })}
                className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                  settings.geminiModel === m.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{m.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">{m.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {settings.geminiModel === m.id && <Badge className="text-[9px]">Active</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    disabled={testingModel === m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTestingModel(m.id);
                      testModelMutation.mutate(
                        { modelId: m.id },
                        {
                          onSuccess: (data) => {
                            setTestingModel(null);
                            if (data.success) {
                              toast.success(`${m.displayName}: ${data.latencyMs}ms - "${data.response}"`);
                            } else {
                              toast.error(`${m.displayName}: ${(data as { error?: string }).error ?? "Failed"}`);
                            }
                          },
                          onError: (err) => {
                            setTestingModel(null);
                            toast.error(`Test failed: ${err.message}`);
                          },
                        },
                      );
                    }}
                  >
                    {testingModel === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
                  </Button>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
