/**
 * QualitySlider — Reusable slider with live value display for avatar generation settings.
 * Supports quality, guidance scale, and inference steps with customizable ranges.
 */
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface QualitySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Format function for the displayed value */
  formatValue?: (v: number) => string;
  /** Labels for the scale endpoints and midpoint */
  scaleLabels?: { min: string; mid: string; max: string };
  /** Optional badge text (e.g. "Replicate") for vendor-specific controls */
  vendorBadge?: string;
  /** If true, the control is dimmed and non-interactive */
  disabled?: boolean;
  /** Optional icon element */
  icon?: React.ReactNode;
}

export function QualitySlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
  scaleLabels,
  vendorBadge,
  disabled,
  icon,
}: QualitySliderProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <Label className="text-xs font-medium">{label}</Label>
          {vendorBadge && (
            <Badge variant="outline" className="text-[8px] px-1 py-0">
              {vendorBadge}
            </Badge>
          )}
        </div>
        <span className="text-xs font-bold tabular-nums text-primary">
          {displayValue}
        </span>
      </div>

      {/* Custom styled range input */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-2 rounded-full accent-primary cursor-pointer appearance-none bg-muted
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-95"
        />
        {/* Progress fill indicator */}
        <div
          className="absolute top-0 left-0 h-2 rounded-full bg-primary/20 pointer-events-none"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {scaleLabels && (
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>{scaleLabels.min}</span>
          <span>{scaleLabels.mid}</span>
          <span>{scaleLabels.max}</span>
        </div>
      )}
    </div>
  );
}
