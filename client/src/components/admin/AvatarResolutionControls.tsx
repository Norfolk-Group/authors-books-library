import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, ImageIcon } from "lucide-react";
import { type AppSettings } from "@/contexts/AppSettingsContext";
import { AspectRatioSelector } from "./AspectRatioSelector";
import { QualitySlider } from "./QualitySlider";
import { DimensionInput } from "./DimensionInput";
import { VendorCapabilityAlert } from "./VendorCapabilityAlert";

const OUTPUT_FORMATS = [
  { value: "webp", label: "WebP", desc: "Best compression, modern browsers" },
  { value: "png", label: "PNG", desc: "Lossless, larger files" },
  { value: "jpeg", label: "JPEG", desc: "Universal, lossy" },
];

export function AvatarResolutionControls({
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
