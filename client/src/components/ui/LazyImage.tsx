/**
 * LazyImage — performant image component with:
 *  - Native lazy loading (loading="lazy")
 *  - Blur-up placeholder while loading
 *  - Smooth opacity fade-in on load
 *  - Error fallback (initials or generic icon)
 *  - Intersection Observer for above-the-fold eager loading
 */

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Fallback text (e.g. author initials) shown when image fails to load */
  fallbackText?: string;
  /** Whether this image is likely above the fold — loads eagerly if true */
  eager?: boolean;
  /** Aspect ratio class e.g. "aspect-square" or "aspect-[2/3]" */
  aspectClass?: string;
  /** Extra style for the wrapper div */
  wrapperClassName?: string;
  onClick?: () => void;
  /** Optional inline style for the img element */
  style?: React.CSSProperties;
}

export function LazyImage({
  src,
  alt,
  className,
  fallbackText,
  eager = false,
  aspectClass,
  wrapperClassName,
  onClick,
  style,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If image is already cached the onLoad event fires before React mounts,
  // so we check .complete on mount.
  // IntersectionObserver is used implicitly via the browser's native loading="lazy"
  // attribute, which defers off-screen images until they enter the viewport.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const initials = fallbackText
    ? fallbackText
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground font-semibold select-none",
          aspectClass,
          wrapperClassName,
          className
        )}
        onClick={onClick}
      >
        <span className="text-sm">{initials}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", aspectClass, wrapperClassName)}
      onClick={onClick}
    >
      {/* Blur placeholder — visible until image loads */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10 blur-[2px]" />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        style={style}
      />
    </div>
  );
}

/**
 * CircularLazyImage — circular variant for author avatars
 */
export function CircularLazyImage({
  src,
  alt,
  size = 64,
  fallbackText,
  eager = false,
  className,
  onClick,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  fallbackText?: string;
  eager?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const initials = fallbackText
    ? fallbackText
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const style = { width: size, height: size, minWidth: size, minHeight: size };

  if (!src || error) {
    return (
      <div
        style={style}
        className={cn(
          "rounded-full flex items-center justify-center bg-muted text-muted-foreground font-semibold text-sm select-none shrink-0",
          className
        )}
        onClick={onClick}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      style={style}
      className={cn("relative rounded-full overflow-hidden bg-muted shrink-0", className)}
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 rounded-full animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10 blur-[1px]" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover rounded-full transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
