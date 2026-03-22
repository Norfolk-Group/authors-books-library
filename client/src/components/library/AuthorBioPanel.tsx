/**
 * AuthorBioPanel -- modal panel showing author bio, links, and books.
 * Extracted from Home.tsx for file size management.
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
  Globe,
  Twitter,
  Linkedin,
  RefreshCw,
  Sparkles,
  Camera,
} from "lucide-react";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { AvatarUpload } from "@/components/AvatarUpload";
import { fireConfetti } from "@/hooks/useConfetti";
import authorBios from "@/lib/authorBios.json";
import { useAppSettings } from "@/contexts/AppSettingsContext";

type AuthorEntry = typeof AUTHORS[number];

interface AuthorBioPanelProps {
  author: AuthorEntry;
  onClose: () => void;
}

export function AuthorBioPanel({ author, onClose }: AuthorBioPanelProps) {
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ") ? author.name.slice(author.name.indexOf(" - ") + 3) : "";
  const avatarUrl = getAuthorAvatar(displayName);
  const color = CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))";
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { enabled: !jsonBio }
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

  const effectiveAvatarUrl = generatedPhotoUrl ?? avatarUrl;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
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

      {/* Bio */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {jsonBio ? (
          <p className="text-sm leading-relaxed text-foreground/80">{jsonBio}</p>
        ) : isLoading || enrichMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading bio...
          </div>
        ) : profile?.bio ? (
          <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No bio available.</p>
        )}
      </div>

      {/* Links */}
      {profile && (profile.websiteUrl || profile.twitterUrl || profile.linkedinUrl) && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</h4>
          <div className="flex flex-col gap-1.5">
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Globe className="w-3.5 h-3.5" />
                {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            )}
            {profile.twitterUrl && (
              <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Twitter className="w-3.5 h-3.5" />
                {profile.twitterUrl.replace(/^https?:\/\/(www\.)?twitter\.com\//, "@")}
              </a>
            )}
            {profile.linkedinUrl && (
              <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Linkedin className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            )}
          </div>
        </div>
      )}

      {/* Books */}
      {author.books.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Books in Library ({author.books.length})</h4>
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

      {/* Reference photo used for avatar generation */}
      {profile?.bestReferencePhotoUrl && (
        <div>
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
                  // Hide the whole section if the image fails to load
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

      {/* Drive link */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open in Google Drive
      </a>

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
      >
        Close
      </button>
    </div>
  );
}
