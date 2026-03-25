/**
 * VendorCapabilityAlert — Shows vendor-specific capability warnings for resolution settings.
 * Alerts users when selected resolution options may not be supported by their chosen vendor.
 */
import { AlertTriangle, Info } from "lucide-react";

/** Vendor capability matrix */
const VENDOR_CAPS: Record<string, {
  supportsAspectRatio: boolean;
  supportedRatios: string[];
  supportsCustomDimensions: boolean;
  supportsGuidanceScale: boolean;
  supportsInferenceSteps: boolean;
  supportsOutputFormat: boolean;
  maxDimension: number;
  notes: string;
}> = {
  google: {
    supportsAspectRatio: true,
    supportedRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    supportsCustomDimensions: false,
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsOutputFormat: false,
    maxDimension: 1024,
    notes: "Google Imagen 3 supports 5 aspect ratios. Custom dimensions, guidance scale, and inference steps are not available.",
  },
  replicate: {
    supportsAspectRatio: true,
    supportedRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"],
    supportsCustomDimensions: true,
    supportsGuidanceScale: true,
    supportsInferenceSteps: true,
    supportsOutputFormat: true,
    maxDimension: 2048,
    notes: "Replicate supports all resolution controls. Custom dimensions must be multiples of 64.",
  },
};

interface VendorCapabilityAlertProps {
  vendor: string;
  selectedRatio?: string;
  customWidth?: number;
  customHeight?: number;
}

export function VendorCapabilityAlert({
  vendor,
  selectedRatio,
  customWidth,
  customHeight,
}: VendorCapabilityAlertProps) {
  const caps = VENDOR_CAPS[vendor];
  if (!caps) return null;

  const warnings: string[] = [];

  // Check if selected ratio is supported
  if (selectedRatio && !caps.supportedRatios.includes(selectedRatio)) {
    warnings.push(`${vendor} does not support ${selectedRatio} ratio — will fall back to 1:1`);
  }

  // Check custom dimensions
  if ((customWidth || customHeight) && !caps.supportsCustomDimensions) {
    warnings.push(`${vendor} does not support custom dimensions — aspect ratio will be used instead`);
  }

  // Check dimension limits
  if (customWidth && customWidth > caps.maxDimension) {
    warnings.push(`Width ${customWidth}px exceeds ${vendor} max of ${caps.maxDimension}px`);
  }
  if (customHeight && customHeight > caps.maxDimension) {
    warnings.push(`Height ${customHeight}px exceeds ${vendor} max of ${caps.maxDimension}px`);
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border">
        <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[9px] text-muted-foreground leading-relaxed">{caps.notes}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {warnings.map((w, i) => (
          <p key={i} className="text-[9px] text-amber-600 dark:text-amber-400 leading-relaxed">
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}
