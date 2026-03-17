/**
 * AuthorModal — shared author bio dialog
 *
 * Used by both FlowbiteAuthorCard (Kanban) and AuthorAccordionRow (accordion).
 * Opens when the user clicks the avatar or author name.
 *
 * THEME RULES: zero hardcoded colours — CSS tokens only.
 */
import { useRef, useEffect } from "react";
import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  Briefcase, Brain, Handshake, Users2, Zap, MessageCircle,
  Cpu, TrendingUp, BookMarked, Globe, Twitter, Linkedin, RefreshCw,
} from "lucide-react";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import { CATEGORY_ICONS, type AuthorEntry } from "@/lib/libraryData";
import { trpc } from "@/lib/trpc";
import authorBios from "@/lib/authorBios.json";

// ── Icon map ──────────────────────────────────────────────────────────────────
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

// ── Props ─────────────────────────────────────────────────────────────────────
export interface AuthorModalProps {
  /** The author whose bio to show. Pass null to hide the modal. */
  author: AuthorEntry | null;
  /** Override photo URL (e.g. from DB map). Falls back to static map. */
  photoUrl?: string | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AuthorModal({ author, photoUrl: photoOverride, onClose }: AuthorModalProps) {
  const open = !!author;
  const displayName = author ? canonicalName(author.name) : "";
  const specialty = author?.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const category = author?.category ?? "";
  const iconName = CATEGORY_ICONS[category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;

  // Photo: override → static map
  const resolvedPhoto =
    photoOverride ??
    (displayName ? getAuthorPhoto(displayName) : null) ??
    null;

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
              {/* Author header: photo + category + specialty */}
              <div className="flex items-center gap-3">
                {resolvedPhoto ? (
                  <img
                    src={resolvedPhoto}
                    alt={displayName}
                    className="h-14 w-14 rounded-full object-cover shadow-sm ring-2 ring-border ring-offset-1 flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground flex-shrink-0 ring-2 ring-border ring-offset-1">
                    {displayName.charAt(0)}
                  </div>
                )}
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
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
