/**
 * SettingsTab - Theme and Avatar settings for the Admin Console.
 *
 * Sections:
 *  1. Theme selector (Manus | Norfolk AI | Noir Dark)
 *  2. Avatar Background Color — Norfolk AI palette swatches + custom picker
 *
 * Note: AI Model settings have been moved to the dedicated AI tab.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, ImageIcon, CheckCircle2 } from "lucide-react";
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
// Special photographic styles use a sentinel key (not a hex) to trigger
// a full photographic background description in the portrait prompt.
const AVATAR_BG_SWATCHES = [
  { hex: "bokeh-gold", label: "Golden Bokeh", preview: "#C4A46B", isSpecial: true }, // Drive avatar style
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
              {AVATAR_BG_SWATCHES.map((swatch) => {
                const displayColor = (swatch as { preview?: string }).preview ?? swatch.hex;
                const isSelected = settings.avatarBgColor === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    title={swatch.label}
                    onClick={() => updateSettings({ avatarBgColor: swatch.hex })}
                    className={`w-9 h-9 rounded-md border-2 transition-all relative overflow-hidden ${
                      isSelected
                        ? "border-primary scale-110 shadow-md"
                        : "border-border hover:border-primary/60"
                    }`}
                    style={{ backgroundColor: displayColor }}
                  >
                    {/* Golden Bokeh: show a subtle gradient overlay to hint at bokeh style */}
                    {(swatch as { isSpecial?: boolean }).isSpecial && (
                      <div
                        className="absolute inset-0 opacity-60"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 30%, #FDEFC5 0%, transparent 40%), " +
                            "radial-gradient(circle at 70% 60%, #FDB817 0%, transparent 35%), " +
                            "radial-gradient(circle at 50% 80%, #C4A46B 0%, transparent 50%)",
                        }}
                      />
                    )}
                    {isSelected && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 absolute top-0.5 right-0.5 z-10"
                        style={{ color: needsLightText(displayColor) ? "#fff" : "#111" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Custom color picker — disabled for special styles */}
            {(() => {
              const currentSwatch = AVATAR_BG_SWATCHES.find((s) => s.hex === settings.avatarBgColor);
              const isSpecial = (currentSwatch as { isSpecial?: boolean } | undefined)?.isSpecial;
              const previewColor =
                (currentSwatch as { preview?: string } | undefined)?.preview ?? settings.avatarBgColor;
              return (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">Custom:</label>
                  {isSpecial ? (
                    <div className="w-10 h-8 rounded border border-border flex items-center justify-center text-[10px] text-muted-foreground italic">
                      n/a
                    </div>
                  ) : (
                    <input
                      type="color"
                      value={settings.avatarBgColor}
                      onChange={(e) => updateSettings({ avatarBgColor: e.target.value })}
                      className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent"
                    />
                  )}
                  <span className="text-xs font-mono text-muted-foreground uppercase">
                    {isSpecial ? currentSwatch?.label : settings.avatarBgColor}
                  </span>
                  {/* Live preview swatch */}
                  <div
                    className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-[10px] font-bold overflow-hidden relative"
                    style={{
                      backgroundColor: previewColor,
                      color: needsLightText(previewColor) ? "#fff" : "#111",
                    }}
                  >
                    {isSpecial && (
                      <div
                        className="absolute inset-0 opacity-60"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 30%, #FDEFC5 0%, transparent 40%), " +
                            "radial-gradient(circle at 70% 60%, #FDB817 0%, transparent 35%), " +
                            "radial-gradient(circle at 50% 80%, #C4A46B 0%, transparent 50%)",
                        }}
                      />
                    )}
                    <span className="relative z-10">Aa</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
