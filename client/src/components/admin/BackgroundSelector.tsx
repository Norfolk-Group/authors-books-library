import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Palette, Wand2 } from "lucide-react";
import { type AppSettings } from "@/contexts/AppSettingsContext";

// ── Background presets ───────────────────────────────────────────────────────

export const BG_PRESETS: { id: string; label: string; hex: string; description: string }[] = [
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

interface BackgroundSelectorProps {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export function BackgroundSelector({ settings, updateSettings }: BackgroundSelectorProps) {
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
