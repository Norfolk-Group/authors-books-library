/**
 * AuthorDetail — Dedicated full-page view for a single author.
 * Route: /author/:slug  (slug = URL-encoded canonical name)
 *
 * Sections:
 *   1. PageHeader breadcrumb (← Home › Authors › [Name])
 *   2. Hero: large avatar, name, category pill, specialty, Drive link
 *   3. Wikipedia summary card (thumbnail + description + monthly views)
 *   4. Rich Bio (from richBioJson or fallback to bio)
 *   5. Professional Entries (resume-style, from richBioJson)
 *   6. Social Stats badges row
 *   7. Platform Presence (PlatformPills — all links including multiple websites)
 *   8. Books grid with covers, ratings, summaries + "View Book" deep-link
 *   9. Footer with Drive link
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { PlatformPills } from "@/components/library/PlatformPills";
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Eye,
  FileText,
  Users,
  BarChart2,
  Star,
  Calendar,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Globe,
  ArrowRight,
  Mic,
  Mail,
  Presentation,
  Brain,
  MessageSquare,
  Video,
  Headphones,
  Newspaper,
  Play,
} from "lucide-react";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { AvatarUpload } from "@/components/AvatarUpload";
import { fireConfetti } from "@/hooks/useConfetti";
import authorBios from "@/lib/authorBios.json";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/_core/hooks/useAuth";
import type { SocialStatsResult } from "../../../server/enrichment/socialStats";
import type { RichBioResult, ProfessionalEntry } from "../../../server/enrichment/richBio";
import AcademicResearchPanel from "@/components/AcademicResearchPanel";
import { MagazineArticlesPanel } from "@/components/library/MagazineArticlesPanel";

// ── Author Media Section ─────────────────────────────────────────────────────

const CONTENT_TYPE_ICON: Record<string, React.ReactNode> = {
  ted_talk: <Play className="w-3.5 h-3.5" />,
  youtube_video: <Video className="w-3.5 h-3.5" />,
  youtube_channel: <Video className="w-3.5 h-3.5" />,
  podcast: <Headphones className="w-3.5 h-3.5" />,
  podcast_episode: <Headphones className="w-3.5 h-3.5" />,
  article: <Newspaper className="w-3.5 h-3.5" />,
  paper: <FileText className="w-3.5 h-3.5" />,
  masterclass: <Mic className="w-3.5 h-3.5" />,
  online_course: <Mic className="w-3.5 h-3.5" />,
  interview: <Mic className="w-3.5 h-3.5" />,
  speech: <Presentation className="w-3.5 h-3.5" />,
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  ted_talk: "TED Talk",
  youtube_video: "YouTube",
  youtube_channel: "YouTube Channel",
  podcast: "Podcast",
  podcast_episode: "Podcast Episode",
  article: "Article",
  paper: "Research Paper",
  masterclass: "Masterclass",
  online_course: "Course",
  interview: "Interview",
  speech: "Speech",
  other: "Other",
};

function AuthorMediaSection({ authorName }: { authorName: string }) {
  const { data: items, isLoading } = trpc.contentItems.getByAuthor.useQuery(
    { authorName },
    { staleTime: 300_000 }
  );

  if (isLoading) return null;
  if (!items || items.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Media & Resources ({items.length})
      </h2>
      <div className="space-y-2">
        {items.map((item) => {
          const icon = CONTENT_TYPE_ICON[item.contentType] ?? <Globe className="w-3.5 h-3.5" />;
          const label = CONTENT_TYPE_LABEL[item.contentType] ?? item.contentType;
          const cover = item.s3CoverUrl ?? item.coverImageUrl;
          return (
            <a
              key={item.id}
              href={item.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
                {cover ? (
                  <img src={cover} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">{icon}</span>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                    {icon}{label}
                  </span>
                  {item.publishedDate && (
                    <span className="text-[10px] text-muted-foreground">{item.publishedDate.slice(0, 4)}</span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary flex-shrink-0" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-bold text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Professional Entry card ───────────────────────────────────────────────────

function ProfessionalEntryCard({ entry }: { entry: ProfessionalEntry }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
        <Briefcase className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground leading-snug">{entry.title}</p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono bg-muted px-1.5 py-0.5 rounded">{entry.period}</span>
        </div>
        <p className="text-xs font-medium text-primary mt-0.5">{entry.org}</p>
        {entry.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{entry.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Digital Me Chat Button ──────────────────────────────────────────────────────
function DigitalMeChatButton({ authorName }: { authorName: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: ragInfo, isLoading: ragLoading } = trpc.ragPipeline.getStatus.useQuery(
    { authorName },
    {
      staleTime: 30_000,
      // Poll every 3 s while generating so the UI updates automatically
      refetchInterval: (q) => q.state.data?.ragStatus === "generating" ? 3000 : false,
    }
  );

  const generateMutation = trpc.ragPipeline.generate.useMutation({
    onSuccess: () => {
      utils.ragPipeline.getStatus.invalidate({ authorName });
      toast.success("Digital Me generation started — this takes ~30 seconds.");
    },
    onError: (err) => toast.error(err.message),
  });

  const isReady = ragInfo?.ragStatus === "ready";
  const isGenerating = ragInfo?.ragStatus === "generating" || generateMutation.isPending;
  const slug = encodeURIComponent(authorName);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Chat button — always shown, disabled when not ready */}
      <button
        onClick={() => navigate(`/chat/${slug}`)}
        disabled={!isReady}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:translate-y-px ${
          isReady
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
        }`}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Chat with {authorName.split(" ")[0]}
      </button>

      {/* Status indicator */}
      {isReady ? (
        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
          <Brain className="w-3 h-3" />
          Digital Me Active
        </span>
      ) : isGenerating ? (
        <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Generating…
        </span>
      ) : !ragLoading ? (
        /* Generate button when no RAG file exists yet */
        <button
          onClick={() => generateMutation.mutate({ authorName, force: false })}
          disabled={generateMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-300/40 transition-all active:translate-y-px shadow-sm"
          title="Generate the Digital Me RAG knowledge file for this author"
        >
          <Brain className="w-3.5 h-3.5" />
          Generate Digital Me
        </button>
      ) : null}

      {/* Regenerate button when already ready */}
      {isReady && (
        <button
          onClick={() => generateMutation.mutate({ authorName, force: true })}
          disabled={generateMutation.isPending}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          title="Regenerate Digital Me knowledge file"
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </button>
      )}
    </div>
  );
}

// ── Book card ─────────────────────────────────────────────────────────────────

interface BookCardProps {
  bookName: string;
  bookId: string;
  authorName: string;
}

function BookCard({ bookName, bookId, authorName }: BookCardProps) {
  const cleanTitle = bookName.split(" - ")[0];
  const driveUrl = `https://drive.google.com/drive/folders/${bookId}?view=grid`;
  const bookSlug = encodeURIComponent(cleanTitle);

  const { data: profile } = trpc.bookProfiles.get.useQuery(
    { bookTitle: cleanTitle },
    { staleTime: 300_000 }
  );

  const coverUrl = profile?.s3CoverUrl ?? profile?.coverImageUrl ?? null;
  const rating = profile?.rating ? parseFloat(String(profile.rating)) : null;
  const publishedYear = profile?.publishedDate ? profile.publishedDate.substring(0, 4) : null;

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Cover + Info row */}
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3"
      >
        {/* Cover */}
        <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={cleanTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <BookOpen className="w-6 h-6 text-muted-foreground/40" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {cleanTitle}
            </p>
            {profile?.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                {profile.summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {rating && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold">
                <Star className="w-2.5 h-2.5 fill-amber-500" />
                {rating.toFixed(1)}
              </span>
            )}
            {publishedYear && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="w-2.5 h-2.5" />
                {publishedYear}
              </span>
            )}
            {profile?.publisher && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Building2 className="w-2.5 h-2.5" />
                <span className="truncate max-w-[80px]">{profile.publisher}</span>
              </span>
            )}
          </div>
        </div>
      </a>

      {/* CTA row */}
      <div className="flex border-t border-border/50">
        <Link
          href={`/book/${bookSlug}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <BookOpen className="w-3 h-3" />
          View Book Profile
          <ArrowRight className="w-3 h-3" />
        </Link>
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors border-l border-border/50"
        >
          <ExternalLink className="w-3 h-3" />
          Drive
        </a>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuthorDetail() {
  const params = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const rawSlug = params.slug ?? "";
  const decodedName = decodeURIComponent(rawSlug);

  // Find the author entry from libraryData
  const author = useMemo(() => {
    const canonical = canonicalName(decodedName);
    return AUTHORS.find((a) => canonicalName(a.name) === canonical) ?? null;
  }, [decodedName]);

  const displayName = author ? canonicalName(author.name) : decodedName;
  const specialty = author?.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const color = author ? (CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))") : "hsl(var(--muted-foreground))";
  const avatarUrl = getAuthorAvatar(displayName);
  const driveUrl = author ? `https://drive.google.com/drive/folders/${author.id}?view=grid` : null;

  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { staleTime: 60_000 }
  );

  const { settings } = useAppSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
        secondaryModel:
          settings.authorResearchSecondaryEnabled && settings.authorResearchSecondaryModel
            ? settings.authorResearchSecondaryModel
            : undefined,
      });
    }
  }, [jsonBio, isLoading, profile]);

  const effectiveAvatarUrl =
    generatedPhotoUrl ?? profile?.s3AvatarUrl ?? profile?.avatarUrl ?? avatarUrl;

  // Parse social stats
  const socialStats: SocialStatsResult | null = useMemo(() => {
    try {
      return profile?.socialStatsJson ? JSON.parse(profile.socialStatsJson) : null;
    } catch {
      return null;
    }
  }, [profile?.socialStatsJson]);

  // Parse rich bio
  const richBio: RichBioResult | null = useMemo(() => {
    try {
      return profile?.richBioJson ? JSON.parse(profile.richBioJson) : null;
    } catch {
      return null;
    }
  }, [profile?.richBioJson]);

  // Parse multiple websites
  const namedWebsites: { label: string; url: string }[] = useMemo(() => {
    try {
      return profile?.websitesJson ? JSON.parse(profile.websitesJson) : [];
    } catch {
      return [];
    }
  }, [profile?.websitesJson]);

  const wiki = socialStats?.wikipedia;
  const wikiViews = formatCount(wiki?.avgMonthlyViews);

  const platformLinks = profile
    ? {
        websiteUrl: profile.websiteUrl,
        businessWebsiteUrl: profile.businessWebsiteUrl,
        youtubeUrl: profile.youtubeUrl,
        twitterUrl: profile.twitterUrl,
        linkedinUrl: profile.linkedinUrl,
        substackUrl: profile.substackUrl,
        mediumUrl: profile.mediumUrl,
        facebookUrl: profile.facebookUrl,
        instagramUrl: profile.instagramUrl,
        tiktokUrl: profile.tiktokUrl,
        githubUrl: profile.githubUrl,
        podcastUrl: profile.podcastUrl,
        newsletterUrl: profile.newsletterUrl,
        speakingUrl: profile.speakingUrl,
        blogUrl: profile.blogUrl,
        websitesJson: profile.websitesJson,
      }
    : null;

  const hasPlatformLinks = platformLinks && Object.values(platformLinks).some(Boolean);

  // Stat badges
  const statBadges: StatBadgeProps[] = useMemo(() => {
    const badges: StatBadgeProps[] = [];
    if (socialStats?.github?.followers) {
      const fmt = formatCount(socialStats.github.followers);
      if (fmt) badges.push({ icon: <Users className="w-4 h-4" />, label: "GitHub", value: `${fmt} followers` });
    }
    if (socialStats?.substack?.postCount) {
      badges.push({ icon: <FileText className="w-4 h-4" />, label: "Substack", value: `${socialStats.substack.postCount} posts` });
    }
    if (wikiViews) {
      badges.push({ icon: <Eye className="w-4 h-4" />, label: "Wikipedia", value: `${wikiViews}/mo views` });
    }
    if (socialStats?.linkedin?.followerCount) {
      const fmt = formatCount(socialStats.linkedin.followerCount);
      if (fmt) badges.push({ icon: <BarChart2 className="w-4 h-4" />, label: "LinkedIn", value: `${fmt} followers` });
    }
    return badges;
  }, [socialStats, wikiViews]);

  // Bio text: prefer rich bio fullBio, then jsonBio, then profile.bio
  const bioText = richBio?.fullBio ?? jsonBio ?? profile?.bio ?? null;
  const professionalSummary = richBio?.professionalSummary ?? null;
  const personalNote = richBio?.personalNote ?? null;
  const professionalEntries: ProfessionalEntry[] = richBio?.professionalEntries ?? [];

  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  const [showAllEntries, setShowAllEntries] = useState(false);
  const visibleEntries = showAllEntries ? professionalEntries : professionalEntries.slice(0, 4);

  // 404 guard
  if (!author && !isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Not Found" }]} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">Author Not Found</h1>
          <p className="text-muted-foreground mb-6">No author named "{decodedName}" exists in the library.</p>
          <button
            onClick={() => setLocation("/")}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Breadcrumb ── */}
      <PageHeader
        crumbs={[
          { label: "Authors", href: "/" },
          { label: displayName },
        ]}
      />

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* ── Hero ── */}
        <section className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0 group/avatar">
            <AvatarUpload authorName={displayName} currentAvatarUrl={effectiveAvatarUrl} size={96}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-24 h-24 rounded-2xl object-cover ring-2 ring-offset-2 shadow-lg"
                    style={{ "--tw-ring-color": color + "66" } as React.CSSProperties}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg"
                    style={{ backgroundColor: color + "22", color }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>
            {!effectiveAvatarUrl && (
              <button
                onClick={() =>
                  generateAvatarMutation.mutate({
                    authorName: displayName,
                    bgColor: settings.avatarBgColor,
                    avatarGenVendor: settings.avatarGenVendor,
                    avatarGenModel: settings.avatarGenModel,
                    avatarResearchVendor: settings.avatarResearchVendor,
                    avatarResearchModel: settings.avatarResearchModel,
                  })
                }
                disabled={generateAvatarMutation.isPending}
                title="Generate AI avatar"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
              >
                {generateAvatarMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 sparkle-spin" style={{ color }} />
                )}
              </button>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {author && (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: color + "22", color }}
                >
                  {author.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold font-display leading-tight text-foreground">{displayName}</h1>
            {professionalSummary ? (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{professionalSummary}</p>
            ) : specialty ? (
              <p className="text-sm text-muted-foreground mt-1">{specialty}</p>
            ) : null}
            {author && (
              <p className="text-xs text-muted-foreground mt-2">
                {author.books.length} book{author.books.length !== 1 ? "s" : ""} in library
              </p>
            )}
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Google Drive
              </a>
            )}
            {/* ── Digital Me Chat Button ── */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <DigitalMeChatButton authorName={displayName} />
            </div>
          </div>
        </section>

        {/* ── Wikipedia Summary Card ── */}
        {wiki && (wiki.description || wiki.extract || wiki.thumbnailUrl) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Wikipedia</h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex gap-4 p-4">
                {wiki.thumbnailUrl && (
                  <a href={wiki.pageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img
                      src={wiki.thumbnailUrl}
                      alt={`${displayName} on Wikipedia`}
                      className="w-20 h-20 rounded-xl object-cover ring-1 ring-border hover:ring-primary transition-all duration-200 hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wikipedia</span>
                    {wikiViews && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                        <Eye className="w-2.5 h-2.5" />
                        {wikiViews}/mo
                      </span>
                    )}
                  </div>
                  {wiki.description && (
                    <p className="text-sm font-semibold text-foreground leading-snug mb-1.5">{wiki.description}</p>
                  )}
                  {wiki.extract && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{wiki.extract}</p>
                  )}
                  {wiki.pageUrl && (
                    <a
                      href={wiki.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Read on Wikipedia
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Bio ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">About</h2>
          {isBioLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading bio…
            </div>
          ) : bioText ? (
            <div className="space-y-3">
              {bioText.split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground/85">{para}</p>
              ))}
              {personalNote && (
                <div className="mt-3 p-3 rounded-xl bg-muted/60 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Personal Note</p>
                  <p className="text-sm text-foreground/80 italic leading-relaxed">{personalNote}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No bio available yet.</p>
          )}
        </section>

        {/* ── Professional Entries (Resume) ── */}
        {professionalEntries.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Professional Background
            </h2>
            <div className="space-y-2">
              {visibleEntries.map((entry, i) => (
                <ProfessionalEntryCard key={i} entry={entry} />
              ))}
            </div>
            {professionalEntries.length > 4 && (
              <button
                onClick={() => setShowAllEntries(!showAllEntries)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {showAllEntries ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> Show {professionalEntries.length - 4} more entries</>
                )}
              </button>
            )}
          </section>
        )}

        {/* ── Named Websites ── */}
        {namedWebsites.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Websites</h2>
            <div className="flex flex-wrap gap-2">
              {namedWebsites.map((site, i) => (
                <a
                  key={i}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-medium text-foreground group"
                >
                  <Globe className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  {site.label}
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Social Stats Badges ── */}
        {statBadges.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Social Presence</h2>
            <div className="flex flex-wrap gap-2">
              {statBadges.map((badge) => (
                <StatBadge key={badge.label} {...badge} />
              ))}
            </div>
          </section>
        )}

        {/* ── Platform Presence ── */}
        {hasPlatformLinks && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Platform Presence</h2>
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
              <PlatformPills
                links={platformLinks!}
                socialStats={socialStats}
                maxVisible={30}
                size="md"
              />
            </div>
          </section>
        )}

        {/* ── Content Hub ── */}
        {(() => {
          // Build a list of all content destinations for this author
          const hubs: { icon: React.ReactNode; label: string; sublabel: string; url: string; color: string }[] = [];

          // Social / writing platforms
          if (profile?.substackUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg>, label: "Substack", sublabel: socialStats?.substack?.postCount ? `${socialStats.substack.postCount} posts` : "Newsletter & posts", url: profile.substackUrl, color: "#FF6719" });
          if (profile?.mediumUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>, label: "Medium", sublabel: "Articles & essays", url: profile.mediumUrl, color: "#000000" });
          if (profile?.youtubeUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, label: "YouTube", sublabel: "Videos & talks", url: profile.youtubeUrl, color: "#FF0000" });
          if (profile?.podcastUrl) hubs.push({ icon: <Mic className="w-5 h-5" />, label: "Podcast", sublabel: "Audio episodes", url: profile.podcastUrl, color: "#8B5CF6" });
          if (profile?.twitterUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, label: "X / Twitter", sublabel: "Posts & threads", url: profile.twitterUrl, color: "#000000" });
          if (profile?.linkedinUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, label: "LinkedIn", sublabel: socialStats?.linkedin?.followerCount ? `${formatCount(socialStats.linkedin.followerCount)} followers` : "Professional network", url: profile.linkedinUrl, color: "#0A66C2" });
          if (profile?.instagramUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>, label: "Instagram", sublabel: "Photos & stories", url: profile.instagramUrl, color: "#E4405F" });
          if (profile?.tiktokUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>, label: "TikTok", sublabel: "Short videos", url: profile.tiktokUrl, color: "#000000" });
          if (profile?.githubUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>, label: "GitHub", sublabel: socialStats?.github?.followers ? `${formatCount(socialStats.github.followers)} followers` : "Code & projects", url: profile.githubUrl, color: "#181717" });
          if (profile?.newsletterUrl) hubs.push({ icon: <Mail className="w-5 h-5" />, label: "Newsletter", sublabel: "Email updates", url: profile.newsletterUrl, color: "#059669" });
          if (profile?.blogUrl) hubs.push({ icon: <Globe className="w-5 h-5" />, label: "Blog", sublabel: "Long-form writing", url: profile.blogUrl, color: "#6366F1" });
          if (profile?.speakingUrl) hubs.push({ icon: <Presentation className="w-5 h-5" />, label: "Speaking", sublabel: "Talks & keynotes", url: profile.speakingUrl, color: "#F59E0B" });
          if (profile?.websiteUrl) hubs.push({ icon: <Globe className="w-5 h-5" />, label: "Website", sublabel: "Official site", url: profile.websiteUrl, color: "#64748B" });
          if (profile?.businessWebsiteUrl) hubs.push({ icon: <Globe className="w-5 h-5" />, label: "Company", sublabel: "Business site", url: profile.businessWebsiteUrl, color: "#0EA5E9" });
          // Named websites from websitesJson
          namedWebsites.forEach((site) => {
            if (!hubs.some((h) => h.url === site.url)) {
              hubs.push({ icon: <Globe className="w-5 h-5" />, label: site.label, sublabel: "Website", url: site.url, color: "#64748B" });
            }
          });
          // Wikipedia
          if (wiki?.pageUrl) hubs.push({ icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden><path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005 1.225 2.405 2.501 4.771 3.852 7.12l.828-1.569-2.947-5.542c-.238-.465-.557-.74-.927-.826-.127-.031-.198-.077-.198-.149v-.468l.055-.045h4.78l.05.045v.437c0 .084-.1.133-.198.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l-4.147 8.334c-.617 1.074-1.127.931-1.532.029l-2.854-5.728z"/></svg>, label: "Wikipedia", sublabel: wikiViews ? `${wikiViews}/mo views` : "Encyclopedia entry", url: wiki.pageUrl, color: "#000000" });

          if (hubs.length === 0) return null;

          return (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Content Hub</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {hubs.map((hub) => (
                  <a
                    key={hub.label}
                    href={hub.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-200 hover:border-primary/30 hover:-translate-y-0.5"
                  >
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: hub.color + "18", color: hub.color }}
                    >
                      {hub.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground leading-tight truncate">{hub.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{hub.sublabel}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </section>
          );
        })()}

        {/* ── Academic Research Foundation ── */}
        <AcademicResearchPanel authorName={displayName} isAdmin={isAdmin} />

        {/* ── Magazine Articles (Atlantic, New Yorker, Wired, NYT, WaPo) ── */}
        <MagazineArticlesPanel authorName={displayName} />

        {/* ── Books ── */}
        {author && author.books.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Books in Library ({author.books.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {author.books.map((book) => (
                <BookCard
                  key={book.id}
                  bookName={book.name}
                  bookId={book.id}
                  authorName={displayName}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Media & Resources ── */}
        <AuthorMediaSection authorName={displayName} />

        {/* ── Footer ── */}
        <div className="flex gap-3 pt-2 pb-8">
          <button
            onClick={() => setLocation("/")}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors border border-border"
          >
            ← Back to Library
          </button>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Drive
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
