/**
 * AuthorCardActions
 *
 * A compact dropdown action menu for author cards.
 * Provides granular per-author enrichment operations:
 *   - Generate / Regenerate Avatar (meticulous AI pipeline)
 *   - Update Bio (Wikipedia + LLM enrichment)
 *   - Update Links (Perplexity web-grounded research)
 *   - Refresh All Data (runs all three sequentially)
 *
 * Usage: Rendered inside FlowbiteAuthorCard header area.
 * All mutations use current AppSettings for LLM configuration.
 */

import { useState, useCallback, useEffect } from "react";
import { MoreHorizontal, Sparkles, RefreshCw, Link2, BookUser, Loader2, Check, X, Pencil, Trash2 } from "lucide-react";
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
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { toast } from "sonner";

type ActionStatus = "idle" | "loading" | "success" | "error";

interface AuthorCardActionsProps {
  authorName: string;
  hasAvatar: boolean;
  /** Called after a successful avatar generation so the card can refresh */
  onAvatarUpdated?: (newUrl: string) => void;
  /** Called when avatar regeneration starts — use to show spinner overlay */
  onAvatarRegenerating?: () => void;
  /** Called after a successful bio update */
  onBioUpdated?: () => void;
  /** Called after a successful links update */
  onLinksUpdated?: () => void;
  /** Called whenever any mutation starts or finishes — use for per-card loading overlay */
  onMutatingChange?: (isMutating: boolean) => void;
  /** Called when Edit Author is clicked — parent opens AuthorFormDialog */
  onEditClick?: () => void;
  /** Called when Delete Author is clicked — parent opens DeleteAuthorDialog */
  onDeleteClick?: () => void;
}

export function AuthorCardActions({
  authorName,
  hasAvatar,
  onAvatarUpdated,
  onAvatarRegenerating,
  onBioUpdated,
  onLinksUpdated,
  onMutatingChange,
  onEditClick,
  onDeleteClick,
}: AuthorCardActionsProps) {
  const { settings } = useAppSettings();
  const utils = trpc.useUtils();

  const [avatarStatus, setAvatarStatus] = useState<ActionStatus>("idle");
  const [bioStatus, setBioStatus] = useState<ActionStatus>("idle");
  const [linksStatus, setLinksStatus] = useState<ActionStatus>("idle");
  const [refreshStatus, setRefreshStatus] = useState<ActionStatus>("idle");

  // ── Avatar generation ────────────────────────────────────────────────────────
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarStatus("success");
      toast.success(`Avatar generated for ${authorName}`, {
        description: `Source: ${data.source} · Tier ${data.tier}`,
      });
      if (data.url) onAvatarUpdated?.(data.url);
      void utils.authorProfiles.getAvatarMap.invalidate();
      setTimeout(() => setAvatarStatus("idle"), 3000);
    },
    onError: (err) => {
      setAvatarStatus("error");
      toast.error(`Avatar generation failed`, { description: err.message });
      setTimeout(() => setAvatarStatus("idle"), 3000);
    },
  });

  // ── Bio enrichment ───────────────────────────────────────────────────────────
  const enrichBioMutation = trpc.authorProfiles.enrich.useMutation({
    onSuccess: () => {
      setBioStatus("success");
      toast.success(`Bio updated for ${authorName}`);
      onBioUpdated?.();
      void utils.authorProfiles.getAllBios.invalidate();
      void utils.authorProfiles.getAllEnrichedNames.invalidate();
      setTimeout(() => setBioStatus("idle"), 3000);
    },
    onError: (err) => {
      setBioStatus("error");
      toast.error(`Bio update failed`, { description: err.message });
      setTimeout(() => setBioStatus("idle"), 3000);
    },
  });

  // ── Links enrichment ─────────────────────────────────────────────────────────
  const updateLinksMutation = trpc.authorProfiles.updateAuthorLinks.useMutation({
    onSuccess: (data) => {
      setLinksStatus("success");
      toast.success(`Links updated for ${authorName}`, {
        description: `Source: ${data.source}`,
      });
      onLinksUpdated?.();
      void utils.authorProfiles.get.invalidate({ authorName });
      setTimeout(() => setLinksStatus("idle"), 3000);
    },
    onError: (err) => {
      setLinksStatus("error");
      toast.error(`Links update failed`, { description: err.message });
      setTimeout(() => setLinksStatus("idle"), 3000);
    },
  });

  const handleGenerateAvatar = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (avatarStatus === "loading") return;
      setAvatarStatus("loading");
      onAvatarRegenerating?.();
      generateAvatarMutation.mutate({
        authorName,
        bgColor: settings.avatarBgColor,
        avatarGenVendor: settings.avatarGenVendor,
        avatarGenModel: settings.avatarGenModel,
        avatarResearchVendor: settings.avatarResearchVendor,
        avatarResearchModel: settings.avatarResearchModel,
        forceRegenerate: hasAvatar,
      });
    },
    [authorName, avatarStatus, generateAvatarMutation, settings, hasAvatar, onAvatarRegenerating]
  );

  const handleUpdateBio = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (bioStatus === "loading") return;
      setBioStatus("loading");
      enrichBioMutation.mutate({
        authorName,
        model: settings.authorResearchModel,
        secondaryModel: settings.authorResearchSecondaryEnabled
          ? settings.authorResearchSecondaryModel
          : undefined,
      });
    },
    [authorName, bioStatus, enrichBioMutation, settings]
  );

  const handleUpdateLinks = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (linksStatus === "loading") return;
      setLinksStatus("loading");
      updateLinksMutation.mutate({
        authorName,
        researchVendor: settings.authorResearchVendor,
        researchModel: settings.authorResearchModel,
      });
    },
    [authorName, linksStatus, updateLinksMutation, settings]
  );

  // ── Refresh All Data — runs bio → links → avatar sequentially ────────────────
  const handleRefreshAll = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (refreshStatus === "loading") return;
      setRefreshStatus("loading");
      onAvatarRegenerating?.();

      const toastId = toast.loading(`Refreshing all data for ${authorName}…`, {
        description: "Step 1/3: Updating bio…",
      });

      try {
        // Step 1: Bio
        await enrichBioMutation.mutateAsync({
          authorName,
          model: settings.authorResearchModel,
          secondaryModel: settings.authorResearchSecondaryEnabled
            ? settings.authorResearchSecondaryModel
            : undefined,
        });
        toast.loading(`Refreshing all data for ${authorName}…`, {
          id: toastId,
          description: "Step 2/3: Updating links…",
        });

        // Step 2: Links
        await updateLinksMutation.mutateAsync({
          authorName,
          researchVendor: settings.authorResearchVendor,
          researchModel: settings.authorResearchModel,
        });
        toast.loading(`Refreshing all data for ${authorName}…`, {
          id: toastId,
          description: "Step 3/3: Regenerating avatar…",
        });

        // Step 3: Avatar
        const avatarResult = await generateAvatarMutation.mutateAsync({
          authorName,
          bgColor: settings.avatarBgColor,
          avatarGenVendor: settings.avatarGenVendor,
          avatarGenModel: settings.avatarGenModel,
          avatarResearchVendor: settings.avatarResearchVendor,
          avatarResearchModel: settings.avatarResearchModel,
          forceRegenerate: true,
        });

        if (avatarResult.url) onAvatarUpdated?.(avatarResult.url);
        onBioUpdated?.();
        onLinksUpdated?.();

        // Invalidate all relevant caches
        void utils.authorProfiles.getAvatarMap.invalidate();
        void utils.authorProfiles.getAllBios.invalidate();
        void utils.authorProfiles.getAllEnrichedNames.invalidate();
        void utils.authorProfiles.get.invalidate({ authorName });

        toast.success(`All data refreshed for ${authorName}`, {
          id: toastId,
          description: `Bio · Links · Avatar (${avatarResult.source})`,
        });
        setRefreshStatus("success");
        setTimeout(() => setRefreshStatus("idle"), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Refresh failed for ${authorName}`, {
          id: toastId,
          description: msg,
        });
        setRefreshStatus("error");
        setTimeout(() => setRefreshStatus("idle"), 3000);
      }
    },
    [
      authorName,
      refreshStatus,
      enrichBioMutation,
      updateLinksMutation,
      generateAvatarMutation,
      settings,
      onAvatarUpdated,
      onAvatarRegenerating,
      onBioUpdated,
      onLinksUpdated,
      utils,
    ]
  );

  const isAnyLoading =
    avatarStatus === "loading" ||
    bioStatus === "loading" ||
    linksStatus === "loading" ||
    refreshStatus === "loading";

  // Notify parent whenever loading state changes
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
          title="Author actions"
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
        className="w-52 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
          {authorName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Generate / Regenerate Avatar */}
        <DropdownMenuItem
          onClick={handleGenerateAvatar}
          disabled={avatarStatus === "loading" || refreshStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={avatarStatus} icon={<Sparkles className="w-3.5 h-3.5" />} />
          <span className="text-xs">
            {hasAvatar ? "Regenerate Avatar" : "Generate Avatar"}
          </span>
          {avatarStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">AI…</span>
          )}
        </DropdownMenuItem>

        {/* Update Bio */}
        <DropdownMenuItem
          onClick={handleUpdateBio}
          disabled={bioStatus === "loading" || refreshStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={bioStatus} icon={<BookUser className="w-3.5 h-3.5" />} />
          <span className="text-xs">Update Bio</span>
          {bioStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Enriching…</span>
          )}
        </DropdownMenuItem>

        {/* Update Links */}
        <DropdownMenuItem
          onClick={handleUpdateLinks}
          disabled={linksStatus === "loading" || refreshStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={linksStatus} icon={<Link2 className="w-3.5 h-3.5" />} />
          <span className="text-xs">Update Links</span>
          {linksStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Researching…</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Refresh All Data */}
        <DropdownMenuItem
          onClick={(e) => { void handleRefreshAll(e); }}
          disabled={isAnyLoading}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={refreshStatus} icon={<RefreshCw className="w-3.5 h-3.5" />} />
          <span className="text-xs">
            {refreshStatus === "loading" ? "Refreshing…" : "Refresh All Data"}
          </span>
          {refreshStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Running…</span>
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
                <span className="text-xs">Edit Author</span>
              </DropdownMenuItem>
            )}
            {onDeleteClick && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-xs">Delete Author</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders the correct icon based on action status */
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

export default AuthorCardActions;
