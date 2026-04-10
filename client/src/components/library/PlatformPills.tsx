/**
 * PlatformPills — Displays a row of clickable platform presence badges for an author.
 *
 * Each pill shows:
 *   - A service-specific SVG logo (inline, no external CDN dependency)
 *   - A branded label (e.g. "Wharton School", "TED", "MasterClass" — not just "Website")
 *   - An optional stat badge (e.g. "42.1K followers", "127 posts")
 *   - Opens the URL in a new tab on click
 *
 * Platforms supported:
 *   Websites: multiple named entries from websitesJson (personal, company, speaking, course, etc.)
 *   Social: youtube, twitter/X, linkedin, substack, facebook, instagram, tiktok, github, podcast, newsletter, blog
 *   Media:  wikipedia, ycombinator, cnbc, cnn, bloomberg/seekingAlpha, yahooFinance
 */

import { Globe, Mic, Mail, Presentation, BookOpen } from "lucide-react";
import type { SocialStatsResult } from "../../../../server/enrichment/socialStats";

// ── Named website entry (from websitesJson column) ────────────────────────────

export interface NamedWebsite {
  label: string;
  url: string;
  type: "personal" | "company" | "speaking" | "podcast" | "course" | "blog" | "newsletter" | "ted" | "masterclass" | "other";
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const SubstackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const MediumIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

const WikipediaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005 1.225 2.405 4.189 8.543 5.365 10.944.198-.4 2.378-4.771 2.588-5.2-.22-.42-1.667-3.368-1.667-3.368-.393-.787-.753-1.1-1.271-1.1-.267 0-.42-.045-.42-.124v-.475l.055-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73l1.061 2.115c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73l1.061 2.115c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73L16.5 8.5c.225-.445 1.235-2.458 1.235-2.458.196-.4.298-.71.298-.905 0-.336-.239-.539-.716-.539-.18 0-.28-.045-.28-.124v-.475l.056-.045c.641-.005 3.966 0 3.966 0l.056.045v.458c0 .079-.1.124-.267.124-.421 0-.677.195-.677.457 0 .154.098.38.28.73L24 13.119z"/>
  </svg>
);

const YCIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M11.1 0L6.6 8.4 0 9.3l4.8 4.7-1.1 6.6L10 17.4l6.3 3.2-1.1-6.6L20 9.3l-6.6-.9L11.1 0z"/>
  </svg>
);

const CNBCIcon = () => (
  <svg viewBox="0 0 36 14" className="w-6 h-3.5 fill-current shrink-0" aria-hidden="true">
    <text x="0" y="12" fontSize="11" fontWeight="bold" fontFamily="Arial,sans-serif">CNBC</text>
  </svg>
);

const CNNIcon = () => (
  <svg viewBox="0 0 32 14" className="w-5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <text x="0" y="12" fontSize="12" fontWeight="bold" fontFamily="Arial,sans-serif">CNN</text>
  </svg>
);

const BloombergIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/>
  </svg>
);

const YahooFinanceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

const TEDIcon = () => (
  <svg viewBox="0 0 36 14" className="w-6 h-3.5 fill-current shrink-0" aria-hidden="true">
    <text x="0" y="12" fontSize="13" fontWeight="bold" fontFamily="Arial,sans-serif">TED</text>
  </svg>
);

const MasterClassIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

// ── Icon by website type ──────────────────────────────────────────────────────

function getWebsiteIcon(type: NamedWebsite["type"], label: string): React.ReactNode {
  const lowerLabel = label.toLowerCase();
  if (type === "ted" || lowerLabel.includes("ted")) return <TEDIcon />;
  if (type === "masterclass" || lowerLabel.includes("masterclass")) return <MasterClassIcon />;
  if (type === "podcast" || lowerLabel.includes("podcast") || lowerLabel.includes("spotify") || lowerLabel.includes("apple")) return <Mic className="w-3.5 h-3.5 shrink-0" />;
  if (type === "newsletter" || lowerLabel.includes("newsletter") || lowerLabel.includes("substack") || lowerLabel.includes("beehiiv")) return <Mail className="w-3.5 h-3.5 shrink-0" />;
  if (type === "speaking" || lowerLabel.includes("speak") || lowerLabel.includes("bureau") || lowerLabel.includes("booking")) return <Presentation className="w-3.5 h-3.5 shrink-0" />;
  if (type === "blog" || lowerLabel.includes("blog")) return <BookOpen className="w-3.5 h-3.5 shrink-0" />;
  return <Globe className="w-3.5 h-3.5 shrink-0" />;
}

function getWebsiteColors(type: NamedWebsite["type"]): { color: string; textColor: string } {
  switch (type) {
    case "personal":    return { color: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600", textColor: "text-slate-800 dark:text-slate-100" };
    case "company":     return { color: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50", textColor: "text-indigo-800 dark:text-indigo-200" };
    case "speaking":    return { color: "bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50", textColor: "text-teal-800 dark:text-teal-200" };
    case "podcast":     return { color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50", textColor: "text-purple-800 dark:text-purple-200" };
    case "course":      return { color: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50", textColor: "text-amber-800 dark:text-amber-200" };
    case "blog":        return { color: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50", textColor: "text-emerald-800 dark:text-emerald-200" };
    case "newsletter":  return { color: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50", textColor: "text-amber-800 dark:text-amber-200" };
    case "ted":         return { color: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600", textColor: "text-white" };
    case "masterclass": return { color: "bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700", textColor: "text-white" };
    default:            return { color: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600", textColor: "text-slate-800 dark:text-slate-100" };
  }
}

// ── Stat formatter ─────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Social platform definitions ───────────────────────────────────────────────

interface PlatformDef {
  key: string;
  label: string;
  color: string;
  textColor: string;
  icon: React.ReactNode;
  getStat?: (stats: SocialStatsResult | null) => string | null;
}

const PLATFORM_DEFS: PlatformDef[] = [
  {
    key: "youtubeUrl",
    label: "YouTube",
    color: "bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50",
    textColor: "text-red-800 dark:text-red-200",
    icon: <YouTubeIcon />,
  },
  {
    key: "twitterUrl",
    label: "X / Twitter",
    color: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600",
    textColor: "text-gray-900 dark:text-gray-100",
    icon: <TwitterIcon />,
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50",
    textColor: "text-blue-800 dark:text-blue-200",
    icon: <LinkedInIcon />,
    getStat: (s) => {
      const count = s?.linkedin?.followerCount;
      const fmt = formatCount(count);
      return fmt ? `${fmt} followers` : null;
    },
  },
  {
    key: "substackUrl",
    label: "Substack",
    color: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50",
    textColor: "text-orange-800 dark:text-orange-200",
    icon: <SubstackIcon />,
    getStat: (s) => {
      if (!s?.substack) return null;
      const { postCount, subscriberRange } = s.substack;
      if (subscriberRange) return subscriberRange;
      if (postCount) return `${postCount} posts`;
      return null;
    },
  },
  {
    key: "facebookUrl",
    label: "Facebook",
    color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50",
    textColor: "text-blue-800 dark:text-blue-200",
    icon: <FacebookIcon />,
  },
  {
    key: "instagramUrl",
    label: "Instagram",
    color: "bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/30 dark:hover:bg-pink-900/50",
    textColor: "text-pink-800 dark:text-pink-200",
    icon: <InstagramIcon />,
  },
  {
    key: "tiktokUrl",
    label: "TikTok",
    color: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600",
    textColor: "text-gray-900 dark:text-gray-100",
    icon: <TikTokIcon />,
  },
  {
    key: "githubUrl",
    label: "GitHub",
    color: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600",
    textColor: "text-gray-900 dark:text-gray-100",
    icon: <GitHubIcon />,
    getStat: (s) => {
      const count = s?.github?.followers;
      const fmt = formatCount(count);
      return fmt ? `${fmt} followers` : null;
    },
  },
  {
    key: "mediumUrl",
    label: "Medium",
    color: "bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50",
    textColor: "text-green-800 dark:text-green-200",
    icon: <MediumIcon />,
  },
  // Legacy fallback fields — shown only if websitesJson is empty
  {
    key: "websiteUrl",
    label: "Personal Site",
    color: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600",
    textColor: "text-slate-800 dark:text-slate-100",
    icon: <Globe className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    key: "businessWebsiteUrl",
    label: "Company Site",
    color: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50",
    textColor: "text-indigo-800 dark:text-indigo-200",
    icon: <Globe className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    key: "podcastUrl",
    label: "Podcast",
    color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50",
    textColor: "text-purple-800 dark:text-purple-200",
    icon: <Mic className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    key: "newsletterUrl",
    label: "Newsletter",
    color: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50",
    textColor: "text-amber-800 dark:text-amber-200",
    icon: <Mail className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    key: "speakingUrl",
    label: "Speaking",
    color: "bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50",
    textColor: "text-teal-800 dark:text-teal-200",
    icon: <Presentation className="w-3.5 h-3.5 shrink-0" />,
  },
  {
    key: "blogUrl",
    label: "Blog",
    color: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50",
    textColor: "text-emerald-800 dark:text-emerald-200",
    icon: <BookOpen className="w-3.5 h-3.5 shrink-0" />,
  },
];

// ── Media presence pills ──────────────────────────────────────────────────────

interface MediaPresenceDef {
  key: keyof SocialStatsResult;
  label: string;
  color: string;
  textColor: string;
  icon: React.ReactNode;
  getUrl: (stats: SocialStatsResult) => string | null;
  getStat: (stats: SocialStatsResult) => string | null;
}

const MEDIA_PRESENCE_DEFS: MediaPresenceDef[] = [
  {
    key: "wikipedia",
    label: "Wikipedia",
    color: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600",
    textColor: "text-gray-900 dark:text-gray-100",
    icon: <WikipediaIcon />,
    getUrl: (s) => s.wikipedia?.pageUrl || null,
    getStat: (s) => {
      const views = s.wikipedia?.avgMonthlyViews;
      const fmt = formatCount(views);
      return fmt ? `${fmt}/mo` : null;
    },
  },
  {
    key: "ycombinator",
    label: "Y Combinator",
    color: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50",
    textColor: "text-orange-800 dark:text-orange-200",
    icon: <YCIcon />,
    getUrl: (s) => s.ycombinator?.ycPageUrl || null,
    getStat: (s) => {
      if (!s.ycombinator?.isYCFounder) return null;
      return s.ycombinator.batch ? `YC ${s.ycombinator.batch}` : "YC Founder";
    },
  },
  {
    key: "cnbc",
    label: "CNBC",
    color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50",
    textColor: "text-blue-800 dark:text-blue-200",
    icon: <CNBCIcon />,
    getUrl: (s) => {
      const articles = (s as any).cnbc?.recentArticles;
      return articles?.[0]?.url || null;
    },
    getStat: (s) => {
      const count = (s as any).cnbc?.articleCount;
      return count ? `${count} articles` : null;
    },
  },
  {
    key: "cnn",
    label: "CNN",
    color: "bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50",
    textColor: "text-red-800 dark:text-red-200",
    icon: <CNNIcon />,
    getUrl: (s) => {
      const articles = (s as any).cnn?.recentArticles;
      return articles?.[0]?.url || null;
    },
    getStat: (s) => {
      const count = (s as any).cnn?.articleCount;
      return count ? `${count} articles` : null;
    },
  },
  {
    key: "seekingAlpha",
    label: "Bloomberg",
    color: "bg-black hover:bg-gray-900 dark:bg-gray-900 dark:hover:bg-gray-800",
    textColor: "text-white",
    icon: <BloombergIcon />,
    getUrl: (s) => {
      const articles = s.seekingAlpha?.recentArticles;
      return articles?.[0]?.url || null;
    },
    getStat: (s) => {
      const count = s.seekingAlpha?.articleCount;
      return count ? `${count} articles` : null;
    },
  },
  {
    key: "yahooFinance",
    label: "Yahoo Finance",
    color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50",
    textColor: "text-purple-800 dark:text-purple-200",
    icon: <YahooFinanceIcon />,
    getUrl: (s) => {
      const ticker = s.yahooFinance?.ticker;
      return ticker ? `https://finance.yahoo.com/quote/${ticker}` : null;
    },
    getStat: (s) => {
      const price = s.yahooFinance?.regularMarketPrice;
      const ticker = s.yahooFinance?.ticker;
      if (price && ticker) return `${ticker} $${price.toFixed(2)}`;
      return null;
    },
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformLinks {
  /** Parsed websitesJson — multiple named websites */
  websites?: NamedWebsite[] | null;
  websiteUrl?: string | null;
  businessWebsiteUrl?: string | null;
  youtubeUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  substackUrl?: string | null;
  mediumUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  githubUrl?: string | null;
  podcastUrl?: string | null;
  newsletterUrl?: string | null;
  speakingUrl?: string | null;
  blogUrl?: string | null;
}

interface PlatformPillsProps {
  links: PlatformLinks;
  /** Parsed social stats from socialStatsJson column */
  socialStats?: SocialStatsResult | null;
  /** Maximum number of pills to display before collapsing. Default: 10 */
  maxVisible?: number;
  /** Size variant: 'sm' for compact cards, 'md' for detail panels */
  size?: "sm" | "md";
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlatformPills({
  links,
  socialStats,
  maxVisible = 10,
  size = "sm",
  className = "",
}: PlatformPillsProps) {
  const pillBase =
    size === "sm"
      ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer select-none"
      : "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer select-none";

  // 1. Named websites from websitesJson (preferred — branded labels)
  const websitePills: React.ReactNode[] = [];
  if (links.websites && links.websites.length > 0) {
    for (const site of links.websites) {
      const { color, textColor } = getWebsiteColors(site.type);
      const icon = getWebsiteIcon(site.type, site.label);
      websitePills.push(
        <a
          key={`ws-${site.url}`}
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
          aria-label={`${site.label} website`}
          className={`${pillBase} ${color} ${textColor} no-underline`}
          onClick={(e) => e.stopPropagation()}
        >
          {icon}
          <span>{site.label}</span>
        </a>
      );
    }
  } else {
    // Legacy fallback: show websiteUrl / businessWebsiteUrl / speakingUrl / podcastUrl / newsletterUrl / blogUrl
    const legacyWebsiteKeys = ["websiteUrl", "businessWebsiteUrl", "speakingUrl", "podcastUrl", "newsletterUrl", "blogUrl"] as const;
    for (const key of legacyWebsiteKeys) {
      const url = links[key];
      if (!url) continue;
      const def = PLATFORM_DEFS.find(d => d.key === key);
      if (!def) continue;
      websitePills.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
          aria-label={`${def.label}`}
          className={`${pillBase} ${def.color} ${def.textColor} no-underline`}
          onClick={(e) => e.stopPropagation()}
        >
          {def.icon}
          <span>{def.label}</span>
        </a>
      );
    }
  }

  // 2. Social platform pills (YouTube, Twitter, LinkedIn, Substack, etc.)
  const socialPills: React.ReactNode[] = [];
  const socialKeys = ["youtubeUrl", "twitterUrl", "linkedinUrl", "substackUrl", "mediumUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "githubUrl"] as const;
  for (const key of socialKeys) {
    const url = links[key];
    if (!url) continue;
    const def = PLATFORM_DEFS.find(d => d.key === key);
    if (!def) continue;
    const stat = def.getStat ? def.getStat(socialStats || null) : null;
    socialPills.push(
      <a
        key={key}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        role="listitem"
        aria-label={`${def.label} profile`}
        className={`${pillBase} ${def.color} ${def.textColor} no-underline`}
        onClick={(e) => e.stopPropagation()}
      >
        {def.icon}
        <span>{def.label}</span>
        {stat && <span className="opacity-70 font-normal">· {stat}</span>}
      </a>
    );
  }

  // 3. Media presence pills (Wikipedia, YC, CNBC, CNN, Bloomberg, Yahoo Finance)
  const mediaPills: React.ReactNode[] = [];
  if (socialStats) {
    for (const def of MEDIA_PRESENCE_DEFS) {
      const url = def.getUrl(socialStats);
      const stat = def.getStat(socialStats);
      if (!url && !stat) continue;
      const content = (
        <>
          {def.icon}
          <span>{def.label}</span>
          {stat && <span className="opacity-70 font-normal">· {stat}</span>}
        </>
      );
      if (url) {
        mediaPills.push(
          <a
            key={def.key as string}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            role="listitem"
            aria-label={`${def.label} presence`}
            className={`${pillBase} ${def.color} ${def.textColor} no-underline`}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </a>
        );
      } else {
        mediaPills.push(
          <span
            key={def.key as string}
            role="listitem"
            className={`${pillBase} ${def.color} ${def.textColor} cursor-default`}
          >
            {content}
          </span>
        );
      }
    }
  }

  const allPills = [...websitePills, ...socialPills, ...mediaPills];
  if (allPills.length === 0) return null;

  const visible = allPills.slice(0, maxVisible);
  const overflow = allPills.length - visible.length;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`} role="list" aria-label="Platform presence">
      {visible}
      {overflow > 0 && (
        <span
          className={`${pillBase} bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-default`}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}

/**
 * Count how many platform links are present (websites + social + media).
 */
export function countPlatformLinks(links: PlatformLinks): number {
  const websiteCount = links.websites?.length ?? PLATFORM_DEFS
    .filter(d => ["websiteUrl", "businessWebsiteUrl", "speakingUrl", "podcastUrl", "newsletterUrl", "blogUrl"].includes(d.key))
    .filter(d => links[d.key as keyof PlatformLinks])
    .length;
  const socialCount = PLATFORM_DEFS
    .filter(d => ["youtubeUrl", "twitterUrl", "linkedinUrl", "substackUrl", "mediumUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "githubUrl"].includes(d.key))
    .filter(d => links[d.key as keyof PlatformLinks])
    .length;
  return (websiteCount ?? 0) + socialCount;
}
