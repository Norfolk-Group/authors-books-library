/**
 * FavoriteToggle — Heart button that marks an author or book as a favorite.
 *
 * - Optimistic update: the heart fills/unfills instantly on click.
 * - Requires the user to be authenticated; renders nothing if not logged in.
 * - Uses trpc.favorites.toggle mutation backed by the favorites DB table.
 */
import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FavoriteToggleProps {
  entityType: "author" | "book";
  entityKey: string;
  displayName?: string;
  imageUrl?: string;
  /** Initial state — pass from a checkMany query result */
  initialIsFavorite?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
}

export function FavoriteToggle({
  entityType,
  entityKey,
  displayName,
  imageUrl,
  initialIsFavorite = false,
  size = "sm",
  className,
}: FavoriteToggleProps) {
  const { isAuthenticated } = useAuth();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const utils = trpc.useUtils();

  const toggleMutation = trpc.favorites.toggle.useMutation({
    onMutate: () => {
      // Optimistic update
      setIsFavorite((prev) => !prev);
    },
    onError: () => {
      // Rollback on error
      setIsFavorite((prev) => !prev);
    },
    onSuccess: (data) => {
      // Sync with server truth
      setIsFavorite(data.isFavorite);
      // Invalidate counts so sidebar/header badges update
      utils.favorites.counts.invalidate();
      utils.favorites.list.invalidate();
    },
  });

  if (!isAuthenticated) return null;

  const iconSize = size === "sm" ? 13 : 16;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${displayName ?? entityKey} from favorites` : `Add ${displayName ?? entityKey} to favorites`}
          aria-pressed={isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleMutation.mutate({ entityType, entityKey, displayName, imageUrl });
          }}
          disabled={toggleMutation.isPending}
          className={cn(
            "inline-flex items-center justify-center rounded-full transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            size === "sm" ? "w-5 h-5" : "w-7 h-7",
            isFavorite
              ? "text-rose-500 hover:text-rose-400"
              : "text-muted-foreground hover:text-rose-400",
            toggleMutation.isPending && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <Heart
            size={iconSize}
            className={cn(
              "transition-all duration-150",
              isFavorite ? "fill-rose-500 stroke-rose-500" : "fill-none"
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {isFavorite ? "Remove from favorites" : "Add to favorites"}
      </TooltipContent>
    </Tooltip>
  );
}
