/**
 * BookCardActions
 *
 * A compact dropdown action menu for book cards.
 * Provides per-book operations:
 *   - Edit Book (opens BookFormDialog in parent)
 *   - Enrich Book (cover + summary via Google Books / LLM)
 *   - Delete Book (opens DeleteBookDialog in parent)
 *
 * Usage: Rendered inside BookCard header area.
 */

import { useState, useCallback, useEffect } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ActionStatus = "idle" | "loading" | "success" | "error";

interface BookCardActionsProps {
  bookTitle: string;
  /** Called when Edit Book is clicked — parent opens BookFormDialog */
  onEditClick?: () => void;
  /** Called when Delete Book is clicked — parent opens DeleteBookDialog */
  onDeleteClick?: () => void;
  /** Called whenever any mutation starts or finishes — use for per-card loading overlay */
  onMutatingChange?: (isMutating: boolean) => void;
}

export function BookCardActions({
  bookTitle,
  onEditClick,
  onDeleteClick,
  onMutatingChange,
}: BookCardActionsProps) {
  const utils = trpc.useUtils();
  const [enrichStatus, setEnrichStatus] = useState<ActionStatus>("idle");

  // ── Book enrichment ──────────────────────────────────────────────────────────
  const enrichMutation = trpc.bookProfiles.enrich.useMutation({
    onSuccess: () => {
      setEnrichStatus("success");
      toast.success(`Book enriched`, { description: bookTitle });
      void utils.bookProfiles.getMany.invalidate();
      void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      setTimeout(() => setEnrichStatus("idle"), 3000);
    },
    onError: (err) => {
      setEnrichStatus("error");
      toast.error(`Enrichment failed`, { description: err.message });
      setTimeout(() => setEnrichStatus("idle"), 3000);
    },
  });

  const handleEnrich = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (enrichStatus === "loading") return;
      setEnrichStatus("loading");
      enrichMutation.mutate({ bookTitle });
    },
    [bookTitle, enrichStatus, enrichMutation]
  );

  const isAnyLoading = enrichStatus === "loading";

  useEffect(() => {
    onMutatingChange?.(isAnyLoading);
  }, [isAnyLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
          title="Book actions"
          disabled={isAnyLoading}
        >
          {isAnyLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="w-3.5 h-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1 truncate max-w-[180px]">
          {bookTitle}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Enrich Book */}
        <DropdownMenuItem
          onClick={handleEnrich}
          disabled={enrichStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={enrichStatus} icon={<Sparkles className="w-3.5 h-3.5" />} />
          <span className="text-xs">Enrich Book</span>
          {enrichStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Enriching…</span>
          )}
        </DropdownMenuItem>

        {(onEditClick || onDeleteClick) && (
          <>
            <DropdownMenuSeparator />
            {onEditClick && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onEditClick(); }}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">Edit Book</span>
              </DropdownMenuItem>
            )}
            {onDeleteClick && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-xs">Delete Book</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionIcon({
  status,
  icon,
}: {
  status: ActionStatus;
  icon: React.ReactNode;
}) {
  if (status === "loading") return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  if (status === "success") return <Check className="w-3.5 h-3.5 text-green-500" />;
  if (status === "error") return <X className="w-3.5 h-3.5 text-destructive" />;
  return <span className="text-muted-foreground">{icon}</span>;
}

export default BookCardActions;
