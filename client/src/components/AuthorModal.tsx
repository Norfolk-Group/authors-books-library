/**
 * AuthorModal - shared author bio dialog
 *
 * Used by both FlowbiteAuthorCard (Kanban) and AuthorAccordionRow (accordion).
 * Opens when the user clicks the avatar or author name.
 *
 * THEME RULES: zero hardcoded colours - CSS tokens only.
 */
import { useRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase, Brain, Handshake, Users2, Zap, MessageCircle,
  Cpu, TrendingUp, BookMarked, Globe, Twitter, Linkedin, RefreshCw, Search, X,
  Mic, Rss, Newspaper, ExternalLink, BookOpen,
} from "lucide-react";
import { getAuthorAvatar } from "@/lib/authorAvatars";
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
  /** Override avatar URL (e.g. from DB map). Falls back to static map. */
  avatarUrl?: string | null;
  onClose: () => void;
}

// -- Component -----------------------------------------------------------------
export function AuthorModal({ author, avatarUrl: photoOverride, onClose }: AuthorModalProps) {
  const open = !!author;
  const displayName = author ? canonicalName(author.name) : "";
  const specialty = author?.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const category = author?.category ?? "";
  const iconName = CATEGORY_ICONS[category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;

  // Avatar: scraped live > override > static map
  const [scrapedPhotoUrl, setScrapedPhotoUrl] = useState<string | null>(null);
  const resolvedPhoto =
    scrapedPhotoUrl ??
    photoOverride ??
    (displayName ? getAuthorAvatar(displayName) : null) ??
    null;

  // Reset scraped avatar when author changes
  useEffect(() => {
    if (!open) setScrapedPhotoUrl(null);
  }, [open, displayName]);

  // Bio: JSON first, then DB, then auto-enrich
  const jsonBio = displayName
    ? (authorBios as Record<string, string>)[displayName] ?? null
    : null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    {
      enabled: open,
      // Short staleTime so the modal always shows fresh data after an Update Links action
      staleTime: 30 * 1000,
    }
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

  // Find Real Avatar - Apify Wikipedia scrape
  const scrapePhotoMutation = trpc.apify.scrapeAuthorAvatar.useMutation({
    onSuccess: (data) => {
      if (data.success && data.avatarUrl) {
        setScrapedPhotoUrl(data.avatarUrl);
        toast.success(`Avatar found from ${data.sourceName ?? "Wikipedia"}`);
      } else {
        toast.error("No avatar found on Wikipedia for this author.");
      }
    },
    onError: (e) => toast.error("Avatar search failed: " + e.message),
  });

  const bioText = jsonBio ?? profile?.bio ?? null;
  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
      {author && (
        <>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-card-foreground">{displayName}</DialogTitle>
          </DialogHeader>
          <div>
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
              {/* Author header: avatar + category + specialty */}
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
                  {/* Find Real Avatar button - small overlay on avatar */}
                  <button
                    onClick={() => scrapePhotoMutation.mutate({ authorName: displayName })}
                    disabled={scrapePhotoMutation.isPending}
                    title="Find real avatar from Wikipedia"
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
                    aria-label="Find real avatar"
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
              {profile && (
                profile.websiteUrl || profile.twitterUrl || profile.linkedinUrl ||
                profile.podcastUrl || profile.blogUrl || profile.substackUrl ||
                profile.mediumUrl || profile.newspaperArticlesJson || profile.otherLinksJson
              ) && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Links
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {profile.websiteUrl && (
                        <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                          {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      )}
                      {profile.twitterUrl && (
                        <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Twitter className="w-3.5 h-3.5 flex-shrink-0" />
                          Twitter / X
                        </a>
                      )}
                      {profile.linkedinUrl && (
                        <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Linkedin className="w-3.5 h-3.5 flex-shrink-0" />
                          LinkedIn
                        </a>
                      )}
                      {profile.podcastUrl && (
                        <a href={profile.podcastUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                          Podcast
                        </a>
                      )}
                      {profile.blogUrl && (
                        <a href={profile.blogUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          Blog
                        </a>
                      )}
                      {profile.substackUrl && (
                        <a href={profile.substackUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <Rss className="w-3.5 h-3.5 flex-shrink-0" />
                          Substack
                        </a>
                      )}
                      {profile.mediumUrl && (
                        <a href={profile.mediumUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:underline">
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          Medium
                        </a>
                      )}
                      {profile.newspaperArticlesJson && (() => {
                        try {
                          const articles = JSON.parse(profile.newspaperArticlesJson) as { title: string; url: string }[];
                          return articles.slice(0, 3).map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-primary hover:underline">
                              <Newspaper className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{a.title}</span>
                            </a>
                          ));
                        } catch { return null; }
                      })()}
                      {profile.otherLinksJson && (() => {
                        try {
                          const others = JSON.parse(profile.otherLinksJson) as { title: string; url: string }[];
                          return others.slice(0, 2).map((l, i) => (
                            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-primary hover:underline">
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{l.title}</span>
                            </a>
                          ));
                        } catch { return null; }
                      })()}
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
          </div>
        </>
      )}
      </DialogContent>
    </Dialog>
  );
}
