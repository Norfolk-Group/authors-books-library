/**
 * AuthorModal - shared author bio dialog
 *
 * Used by both FlowbiteAuthorCard (Kanban) and AuthorAccordionRow (accordion).
 * Opens when the user clicks the avatar or author name.
 *
 * THEME RULES: zero hardcoded colours - CSS tokens only.
 */
import { useRef, useEffect, useState } from "react";
import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  Briefcase, Brain, Handshake, Users2, Zap, MessageCircle,
  Cpu, TrendingUp, BookMarked, Globe, Twitter, Linkedin, RefreshCw, Search, X,
} from "lucide-react";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import { CATEGORY_ICONS, type AuthorEntry } from "@/lib/libraryData";
import { trpc } from "@/lib/trpc";
import authorBios from "@/lib/authorBios.json";
import { toast } from "sonner";

// -- Icon map ------------------------------------------------------------------
type LucideIcon = React.FC<{ className?: string; style?: React.CSSProperties }>;
const ICON_MAP: Record<string, LucideIcon> = {
  briefcase:        Briefcase as LucideIcon,
  brain:            Brain as LucideIcon,
  handshake:        Handshake as LucideIcon,
  users:            Users2 as LucideIcon,
  zap:              Zap as LucideIcon,
  "message-circle": MessageCircle as LucideIcon,
  cpu:              Cpu as LucideIcon,
  "trending-up":    TrendingUp as LucideIcon,
  "book-open":      BookMarked as LucideIcon,
};

// -- Props ---------------------------------------------------------------------
export interface AuthorModalProps {
  /** The author whose bio to show. Pass null to hide the modal. */
  author: AuthorEntry | null;
  /** Override photo URL (e.g. from DB map). Falls back to static map. */
  photoUrl?: string | null;
  onClose: () => void;
}

// -- Component -----------------------------------------------------------------
export function AuthorModal({ author, photoUrl: photoOverride, onClose }: AuthorModalProps) {
  const open = !!author;
  const displayName = author ? canonicalName(author.name) : "";
  const specialty = author?.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const category = author?.category ?? "";
  const iconName = CATEGORY_ICONS[category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;

  // Photo: scraped live > override > static map
  const [scrapedPhotoUrl, setScrapedPhotoUrl] = useState<string | null>(null);
  const resolvedPhoto =
    scrapedPhotoUrl ??
    photoOverride ??
    (displayName ? getAuthorPhoto(displayName) : null) ??
    null;

  // Reset scraped photo when author changes
  useEffect(() => {
    if (!open) setScrapedPhotoUrl(null);
  }, [open, displayName]);

  // Bio: JSON first, then DB, then auto-enrich
  const jsonBio = displayName
    ? (authorBios as Record<string, string>)[displayName] ?? null
    : null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { enabled: open && !jsonBio, staleTime: 5 * 60 * 1000 }
  );

  const enrichMutation = trpc.authorProfiles.enrich.useMutation();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!open) { hasTriggered.current = false; return; }
    if (!jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ authorName: displayName });
    }
  }, [open, jsonBio, isLoading, profile, displayName]);

  // Find Real Photo - Apify Wikipedia scrape
  const scrapePhotoMutation = trpc.apify.scrapeAuthorPhoto.useMutation({
    onSuccess: (data) => {
      if (data.success && data.photoUrl) {
        setScrapedPhotoUrl(data.photoUrl);
        toast.success(`Photo found from ${data.sourceName ?? "Wikipedia"}`);
      } else {
        toast.error("No photo found on Wikipedia for this author.");
      }
    },
    onError: (e) => toast.error("Photo search failed: " + e.message),
  });

  const bioText = jsonBio ?? profile?.bio ?? null;
  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  return (
    <Modal show={open} size="md" onClose={onClose} popup>
      {author && (
        <>
          <ModalHeader>
            <span className="text-sm font-semibold text-card-foreground">{displayName}</span>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4 text-sm">
              {/* Prominent close button - top right */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-muted/80 hover:bg-muted flex items-center justify-center shadow-sm border border-border transition-all hover:scale-105 active:scale-95"
                aria-label="Close"
                title="Close (Esc)"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
              {/* Author header: photo + category + specialty */}
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  {resolvedPhoto ? (
                    <img
                      src={resolvedPhoto}
                      alt={displayName}
                      className="h-14 w-14 rounded-full object-cover shadow-sm ring-2 ring-border ring-offset-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground ring-2 ring-border ring-offset-1">
                      {displayName.charAt(0)}
                    </div>
                  )}
                  {/* Find Real Photo button - small overlay on avatar */}
                  <button
                    onClick={() => scrapePhotoMutation.mutate({ authorName: displayName })}
                    disabled={scrapePhotoMutation.isPending}
                    title="Find real photo from Wikipedia"
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
                    aria-label="Find real photo"
                  >
                    {scrapePhotoMutation.isPending ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Search className="w-2.5 h-2.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </span>
                  </div>
                  {specialty && (
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                      {specialty}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Bio */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  About
                </p>
                {isBioLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Loading bio…</span>
                  </div>
                ) : bioText ? (
                  <p className="text-sm leading-relaxed text-card-foreground">{bioText}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No bio available yet.</p>
                )}
              </div>

              {/* Links */}
              {profile && (profile.websiteUrl || profile.twitterUrl || profile.linkedinUrl) && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Links
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {profile.websiteUrl && (
                        <a
                          href={profile.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                          {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      )}
                      {profile.twitterUrl && (
                        <a
                          href={profile.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <Twitter className="w-3.5 h-3.5 flex-shrink-0" />
                          Twitter / X
                        </a>
                      )}
                      {profile.linkedinUrl && (
                        <a
                          href={profile.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <Linkedin className="w-3.5 h-3.5 flex-shrink-0" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
              {/* Close button at bottom */}
              <div className="h-px bg-border" />
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-all shadow-sm border border-border hover:shadow-md active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
