/**
 * AuthorBioPanel — Comprehensive Author Detail Modal
 *
 * Sections:
 *   1. Header: avatar, name, category pill, specialty
 *   2. Wikipedia summary card (thumbnail + description + monthly views)
 *   3. Bio (JSON cache → DB → LLM enrichment)
 *   4. Platform Presence (PlatformPills with stat badges)
 *   5. Social Stats row (GitHub followers, Substack posts, Wikipedia views)
 *   6. Books in Library
 *   7. Reference photo + Drive link + Close
 *
 * THEME RULES: zero hardcoded colours — CSS tokens only.
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Camera,
  Eye,
  FileText,
  Users,
  BarChart2,
} from "lucide-react";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { AvatarUpload } from "@/components/AvatarUpload";
import { fireConfetti } from "@/hooks/useConfetti";
import authorBios from "@/lib/authorBios.json";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { PlatformPills } from "@/components/library/PlatformPills";
import type { SocialStatsResult } from "../../../../server/enrichment/socialStats";

type AuthorEntry = typeof AUTHORS[number];

interface AuthorBioPanelProps {
  author: AuthorEntry;
  onClose: () => void;
}

// ── Stat badge helper ──────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface StatBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatBadge({ icon, label, value }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/50">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none">{label}</p>
        <p className="text-sm font-semibold text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthorBioPanel({ author, onClose }: AuthorBioPanelProps) {
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ") ? author.name.slice(author.name.indexOf(" - ") + 3) : "";
  const avatarUrl = getAuthorAvatar(displayName);
  const color = CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))";
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  // Full profile (bio, links, platform URLs, socialStatsJson)
  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { staleTime: 60_000 }
  );

  const { settings } = useAppSettings();
  const enrichMutation = trpc.authorProfiles.enrich.useMutation({
    onError: (e) => toast.error("Failed to load bio: " + e.message),
  });

  const [generatedPhotoUrl, setGeneratedPhotoUrl] = useState<string | null>(null);
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation({
    onSuccess: (data) => {
      setGeneratedPhotoUrl(data.url);
      toast.success("AI avatar generated and saved!");
      fireConfetti("avatar");
    },
    onError: (e) => toast.error("Avatar generation failed: " + e.message),
  });

  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({
        authorName: displayName,
        model: settings.authorResearchModel || settings.primaryModel || undefined,
        secondaryModel: settings.authorResearchSecondaryEnabled && settings.authorResearchSecondaryModel
          ? settings.authorResearchSecondaryModel
          : undefined,
      });
    }
  }, [jsonBio, isLoading, profile]);

  const effectiveAvatarUrl = generatedPhotoUrl ?? profile?.s3AvatarUrl ?? profile?.avatarUrl ?? avatarUrl;

  // Parse social stats
  const socialStats: SocialStatsResult | null = (() => {
    try {
      return profile?.socialStatsJson ? JSON.parse(profile.socialStatsJson) : null;
    } catch {
      return null;
    }
  })();

  // Wikipedia data from social stats
  const wiki = socialStats?.wikipedia;
  const wikiViews = formatCount(wiki?.avgMonthlyViews);

  // Platform links from profile
  const platformLinks = profile ? {
    websiteUrl: profile.websiteUrl,
    businessWebsiteUrl: profile.businessWebsiteUrl,
    youtubeUrl: profile.youtubeUrl,
    twitterUrl: profile.twitterUrl,
    linkedinUrl: profile.linkedinUrl,
    substackUrl: profile.substackUrl,
    facebookUrl: profile.facebookUrl,
    instagramUrl: profile.instagramUrl,
    tiktokUrl: profile.tiktokUrl,
    githubUrl: profile.githubUrl,
    podcastUrl: profile.podcastUrl,
    newsletterUrl: profile.newsletterUrl,
    speakingUrl: profile.speakingUrl,
    blogUrl: profile.blogUrl,
  } : null;

  const hasPlatformLinks = platformLinks && Object.values(platformLinks).some(Boolean);

  // Collect stat badges
  const statBadges: StatBadgeProps[] = [];
  if (socialStats?.github?.followers) {
    const fmt = formatCount(socialStats.github.followers);
    if (fmt) statBadges.push({ icon: <Users className="w-3.5 h-3.5" />, label: "GitHub", value: `${fmt} followers` });
  }
  if (socialStats?.substack?.postCount) {
    statBadges.push({ icon: <FileText className="w-3.5 h-3.5" />, label: "Substack", value: `${socialStats.substack.postCount} posts` });
  }
  if (wikiViews) {
    statBadges.push({ icon: <Eye className="w-3.5 h-3.5" />, label: "Wikipedia", value: `${wikiViews}/mo views` });
  }
  if (socialStats?.linkedin?.followerCount) {
    const fmt = formatCount(socialStats.linkedin.followerCount);
    if (fmt) statBadges.push({ icon: <BarChart2 className="w-3.5 h-3.5" />, label: "LinkedIn", value: `${fmt} followers` });
  }

  const bioText = jsonBio ?? profile?.bio ?? null;
  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* ── Header ── */}
      <DialogHeader>
        <div className="flex items-center gap-4 mb-1">
          <div className="relative group/avatar">
            <AvatarUpload authorName={displayName} currentAvatarUrl={effectiveAvatarUrl} size={80}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2 author-avatar-3d"
                    style={{ '--tw-ring-color': color + '66' } as React.CSSProperties}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ backgroundColor: color + '22', color }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>
            {!effectiveAvatarUrl && (
              <button
                onClick={() => generateAvatarMutation.mutate({
                  authorName: displayName,
                  bgColor: settings.avatarBgColor,
                  avatarGenVendor: settings.avatarGenVendor,
                  avatarGenModel: settings.avatarGenModel,
                  avatarResearchVendor: settings.avatarResearchVendor,
                  avatarResearchModel: settings.avatarResearchModel,
                })}
                disabled={generateAvatarMutation.isPending}
                title="Generate AI avatar"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
              >
                {generateAvatarMutation.isPending
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3 sparkle-spin" style={{ color }} />}
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '22', color }}>{author.category}</span>
            </div>
            <DialogTitle className="text-xl font-bold font-display leading-snug">{displayName}</DialogTitle>
            {specialty && <DialogDescription className="text-sm mt-0.5">{specialty}</DialogDescription>}
          </div>
        </div>
      </DialogHeader>

      {/* ── Wikipedia Summary Card ── */}
      {wiki && (wiki.description || wiki.extract || wiki.thumbnailUrl) && (
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <div className="flex gap-3 p-3">
            {wiki.thumbnailUrl && (
              <a href={wiki.pageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <img
                  src={wiki.thumbnailUrl}
                  alt={`${displayName} on Wikipedia`}
                  className="w-16 h-16 rounded-lg object-cover ring-1 ring-border hover:ring-primary transition-all duration-200 hover:scale-105"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current text-muted-foreground shrink-0" aria-hidden="true">
                  <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005 1.225 2.405 4.189 8.543 5.365 10.944.198-.4 2.378-4.771 2.588-5.2-.22-.42-1.667-3.368-1.667-3.368-.393-.787-.753-1.1-1.271-1.1-.267 0-.42-.045-.42-.124v-.475l.055-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73l1.061 2.115c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73l1.061 2.115c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73L16.5 8.5c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73L24 13.119z"/>
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wikipedia</span>
                {wikiViews && (
                  <span className="text-[10px] text-muted-foreground ml-auto">· {wikiViews}/mo views</span>
                )}
              </div>
              {wiki.description && (
                <p className="text-xs font-medium text-foreground leading-snug mb-1">{wiki.description}</p>
              )}
              {wiki.extract && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{wiki.extract}</p>
              )}
              {wiki.pageUrl && (
                <a
                  href={wiki.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1.5"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Read on Wikipedia
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bio ── */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {isBioLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading bio...
          </div>
        ) : bioText ? (
          <p className="text-sm leading-relaxed text-foreground/80">{bioText}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No bio available.</p>
        )}
      </div>

      {/* ── Social Stats Badges ── */}
      {statBadges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Social Presence</h4>
          <div className="flex flex-wrap gap-2">
            {statBadges.map((badge) => (
              <StatBadge key={badge.label} {...badge} />
            ))}
          </div>
        </div>
      )}

      {/* ── Platform Presence (PlatformPills) ── */}
      {hasPlatformLinks && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Platform Presence</h4>
          <PlatformPills
            links={platformLinks!}
            socialStats={socialStats}
            maxVisible={20}
            size="md"
          />
        </div>
      )}

      {/* ── Books in Library ── */}
      {author.books.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Books in Library ({author.books.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {author.books.map((book) => (
              <a
                key={book.id}
                href={`https://drive.google.com/drive/folders/${book.id}?view=grid`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
              >
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                <span className="flex-1 leading-snug">{book.name.split(" - ")[0]}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Reference Photo ── */}
      {profile?.bestReferencePhotoUrl && (
        <div data-ref-photo>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Camera className="w-3 h-3" />
            Reference Photo Used
          </h4>
          <div className="flex items-start gap-3">
            <a
              href={profile.bestReferencePhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 group"
              title="View reference photo source"
            >
              <img
                src={profile.bestReferencePhotoUrl}
                alt={`Reference photo for ${displayName}`}
                className="w-16 h-16 rounded-lg object-cover ring-1 ring-border group-hover:ring-primary transition-all duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget.closest('[data-ref-photo]') as HTMLElement | null)?.style.setProperty('display', 'none');
                }}
              />
            </a>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This photo was used as the visual reference for the AI-generated portrait above.
              </p>
              <a
                href={profile.bestReferencePhotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View source
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Drive link ── */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in Google Drive
      </a>

      {/* ── Close ── */}
      <button
        onClick={onClose}
        className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
      >
        Close
      </button>
    </div>
  );
}
