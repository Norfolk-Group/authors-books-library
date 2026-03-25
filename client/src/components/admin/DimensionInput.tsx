/**
 * DimensionInput — Width/Height input pair with 64px step validation for avatar generation.
 * Validates that dimensions are multiples of 64 and within allowed range.
 */
import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Maximize2 } from "lucide-react";

interface DimensionInputProps {
  width: number;
  height: number;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  /** If true, the control is dimmed and non-interactive */
  disabled?: boolean;
  /** Optional badge text (e.g. "Replicate") for vendor-specific controls */
  vendorBadge?: string;
  /** Min dimension (default: 0 = auto) */
  minDimension?: number;
  /** Max dimension (default: 2048) */
  maxDimension?: number;
}

function validate64(value: number, max: number): { valid: boolean; error?: string } {
  if (value === 0) return { valid: true }; // 0 = auto
  if (value < 64) return { valid: false, error: "Min 64px" };
  if (value > max) return { valid: false, error: `Max ${max}px` };
  if (value % 64 !== 0) return { valid: false, error: "Must be multiple of 64" };
  return { valid: true };
}

export function DimensionInput({
  width,
  height,
  onWidthChange,
  onHeightChange,
  disabled,
  vendorBadge,
  minDimension = 0,
  maxDimension = 2048,
}: DimensionInputProps) {
  const [widthError, setWidthError] = useState<string | undefined>();
  const [heightError, setHeightError] = useState<string | undefined>();

  const handleWidth = useCallback(
    (raw: string) => {
      const num = parseInt(raw, 10) || 0;
      const { valid, error } = validate64(num, maxDimension);
      setWidthError(error);
      if (valid) onWidthChange(num);
    },
    [maxDimension, onWidthChange]
  );

  const handleHeight = useCallback(
    (raw: string) => {
      const num = parseInt(raw, 10) || 0;
      const { valid, error } = validate64(num, maxDimension);
      setHeightError(error);
      if (valid) onHeightChange(num);
    },
    [maxDimension, onHeightChange]
  );

  const snap = (value: number): number => {
    if (value === 0) return 0;
    return Math.round(value / 64) * 64;
  };

  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-1.5">
        <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">Custom Dimensions</Label>
        {vendorBadge && (
          <Badge variant="outline" className="text-[8px] px-1 py-0">
            {vendorBadge}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Width */}
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Width (px)</Label>
          <input
            type="number"
            min={minDimension}
            max={maxDimension}
            step={64}
            value={width}
            onChange={(e) => handleWidth(e.target.value)}
            onBlur={() => {
              const snapped = snap(width);
              if (snapped !== width) onWidthChange(snapped);
              setWidthError(undefined);
            }}
            disabled={disabled}
            placeholder="0 = auto"
            className={`w-full h-7 text-xs px-2 rounded border bg-background transition-colors
              focus:outline-none focus:ring-1 focus:ring-primary
              ${widthError ? "border-destructive" : "border-border"}`}
          />
          {widthError && (
            <div className="flex items-center gap-1 text-[9px] text-destructive">
              <AlertCircle className="w-2.5 h-2.5" />
              {widthError}
            </div>
          )}
        </div>

        {/* Height */}
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Height (px)</Label>
          <input
            type="number"
            min={minDimension}
            max={maxDimension}
            step={64}
            value={height}
            onChange={(e) => handleHeight(e.target.value)}
            onBlur={() => {
              const snapped = snap(height);
              if (snapped !== height) onHeightChange(snapped);
              setHeightError(undefined);
            }}
            disabled={disabled}
            placeholder="0 = auto"
            className={`w-full h-7 text-xs px-2 rounded border bg-background transition-colors
              focus:outline-none focus:ring-1 focus:ring-primary
              ${heightError ? "border-destructive" : "border-border"}`}
          />
          {heightError && (
            <div className="flex items-center gap-1 text-[9px] text-destructive">
              <AlertCircle className="w-2.5 h-2.5" />
              {heightError}
            </div>
          )}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground">
        Set to 0 for auto (uses aspect ratio). Must be multiples of 64.
        {width > 0 && height > 0 && (
          <span className="ml-1 font-medium text-foreground">
            → {width}×{height}px ({(width * height / 1_000_000).toFixed(1)}MP)
          </span>
        )}
      </p>
    </div>
  );
}
