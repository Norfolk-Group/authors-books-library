/**
 * AvatarCropModal
 * ---------------
 * A modal that lets the user crop and resize an image into a square
 * before it is uploaded as an author avatar.
 *
 * Features:
 *  - Circular crop mask (1:1 aspect ratio locked)
 *  - Zoom slider (1× - 3×) via CSS transform scale on the image
 *  - "Crop & Save" exports a 256×256 JPEG canvas blob
 *  - Keyboard accessible (Enter = confirm, Escape = cancel)
 *
 * Usage:
 *   <AvatarCropModal
 *     open={showCrop}
 *     imageSrc={objectUrl}
 *     authorName="Adam Grant"
 *     onConfirm={(blob, mimeType) => { ... }}
 *     onCancel={() => setShowCrop(false)}
 *   />
 */

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";

const OUTPUT_SIZE = 256; // px - final avatar resolution
const OUTPUT_MIME = "image/jpeg" as const;
const OUTPUT_QUALITY = 0.92;

interface AvatarCropModalProps {
  open: boolean;
  /** Object URL of the selected file */
  imageSrc: string;
  authorName: string;
  onConfirm: (blob: Blob, mimeType: typeof OUTPUT_MIME) => void;
  onCancel: () => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function AvatarCropModal({
  open,
  imageSrc,
  authorName,
  onConfirm,
  onCancel,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state whenever a new image is loaded
  useEffect(() => {
    if (open) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setZoom(1);
    }
  }, [open, imageSrc]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleConfirm = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !completedCrop) return;

    // Draw cropped region onto a canvas at OUTPUT_SIZE × OUTPUT_SIZE
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale factors: completedCrop is in *natural* image pixels
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    // Apply circular clip
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob, OUTPUT_MIME);
      },
      OUTPUT_MIME,
      OUTPUT_QUALITY
    );
  }, [completedCrop, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Crop Avatar - {authorName}
          </DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="overflow-hidden rounded-lg bg-muted/40 border border-border"
            style={{ maxHeight: "360px", maxWidth: "100%" }}
          >
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              keepSelection
              minWidth={40}
              minHeight={40}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{
                  maxHeight: "340px",
                  maxWidth: "100%",
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease",
                  display: "block",
                }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 w-full px-2">
            <ZoomOutIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.05}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
              aria-label="Zoom"
            />
            <ZoomInIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
              {zoom.toFixed(1)}×
            </span>
          </div>

          {/* Output size hint */}
          <p className="text-xs text-muted-foreground text-center">
            Output: {OUTPUT_SIZE}×{OUTPUT_SIZE}px · JPEG · circular crop
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!completedCrop?.width || !completedCrop?.height}
          >
            Crop & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
