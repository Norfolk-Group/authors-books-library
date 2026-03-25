/**
 * AspectRatioSelector — Visual aspect ratio picker for avatar generation.
 * Shows ratio labels with visual previews and descriptions.
 */
import { Label } from "@/components/ui/label";
import { Ratio } from "lucide-react";

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1", desc: "Square — Profile pictures", w: 24, h: 24 },
  { value: "3:4", label: "3:4", desc: "Portrait — Book covers, cards", w: 18, h: 24 },
  { value: "4:3", label: "4:3", desc: "Landscape — Thumbnails, banners", w: 24, h: 18 },
  { value: "2:3", label: "2:3", desc: "Tall — Phone wallpaper", w: 16, h: 24 },
  { value: "3:2", label: "3:2", desc: "Wide — Desktop wallpaper", w: 24, h: 16 },
  { value: "9:16", label: "9:16", desc: "Story — Social stories", w: 13, h: 24 },
  { value: "16:9", label: "16:9", desc: "Cinema — Widescreen", w: 24, h: 13 },
];

interface AspectRatioSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AspectRatioSelector({ value, onChange, disabled }: AspectRatioSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Ratio className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">Aspect Ratio</Label>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {ASPECT_RATIOS.map((ar) => {
          const isSelected = value === ar.value;
          return (
            <button
              key={ar.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(ar.value)}
              className={`
                group relative flex flex-col items-center gap-1 p-2 rounded-lg border text-center
                transition-all duration-150 hover:shadow-sm active:scale-[0.97]
                ${isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                }
                ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}
              `}
            >
              {/* Visual ratio preview */}
              <div className="flex items-center justify-center h-7">
                <div
                  className={`rounded-[2px] transition-colors ${
                    isSelected ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
                  }`}
                  style={{ width: ar.w, height: ar.h }}
                />
              </div>
              <span className={`text-[10px] font-semibold tabular-nums ${isSelected ? "text-primary" : "text-foreground"}`}>
                {ar.label}
              </span>
              <span className="text-[8px] text-muted-foreground leading-tight line-clamp-1">
                {ar.desc.split(" — ")[1] || ar.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
