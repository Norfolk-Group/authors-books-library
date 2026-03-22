/**
 * Shared constants and utilities for library card components.
 * Extracted from Home.tsx to keep each component file focused.
 */

import {
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
  Headphones,
  FileText,
  File,
  AlignLeft,
  Video,
  Image,
  Package,
  Scroll,
  Newspaper,
  Link,
  List,
  Folder,
  Book,
  type LucideIcon,
} from "lucide-react";

// -- Icon map for categories ----------------------------------
export const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  brain: Brain,
  handshake: Handshake,
  users: Users2,
  zap: Zap,
  "message-circle": MessageCircle,
  cpu: Cpu,
  "trending-up": TrendingUp,
  "book-open": BookMarked,
};

// -- Icon map for content types -------------------------------
export const CT_ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileText,
  "book": Book,
  "file": File,
  "align-left": AlignLeft,
  "headphones": Headphones,
  "video": Video,
  "image": Image,
  "package": Package,
  "scroll": Scroll,
  "newspaper": Newspaper,
  "link": Link,
  "list": List,
  "folder": Folder,
};

// -- Audio format labels and Tailwind class sets --------------
export const FORMAT_LABEL: Record<string, string> = {
  MP3: "MP3", M4B: "M4B", AAX: "AAX", M4A: "M4A",
};

export const FORMAT_CLASSES: Record<string, string> = {
  MP3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  M4B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  AAX: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  M4A: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

// -- Content type display name normalization ------------------
const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC": "Supplemental",
  "PDF Extra": "PDF",
  "PDF Extra 2": "PDF",
  "PDF Extras": "PDF",
  "Complete Book in PDF": "PDF",
  "DOC": "Transcript",
  "ChatGPT": "Supplemental",
  "Sana AI": "Supplemental",
  "Notes": "Supplemental",
  "Knowledge Base": "Supplemental",
  "temp": "Supplemental",
  "Temp": "Supplemental",
  "TEMP": "Supplemental",
};

// -- Library stats (static snapshot) ------------------------
export const STATS = {
  totalAuthors: 87,
  totalBooks: 245,
  totalCategories: 9,
  lastUpdated: "March 2026",
};

// -- Book enrichment level scoring -------------------------
export type BookEnrichmentLevel = 'none' | 'basic' | 'enriched' | 'complete';

/**
 * Score a book profile's data completeness into four tiers.
 * Mirrors the Author Research Quality badge system.
 *   complete  (5-6 fields) → gold/amber
 *   enriched  (3-4 fields) → emerald
 *   basic     (1-2 fields) → sky blue
 *   none      (0 fields)   → gray (badge hidden)
 */
export function getBookEnrichmentLevel(
  profile: {
    summary?: string | null;
    rating?: string | null;
    s3CoverUrl?: string | null;
    coverImageUrl?: string | null;
    keyThemes?: string | null;
    amazonUrl?: string | null;
    publishedDate?: string | null;
  } | null
): BookEnrichmentLevel {
  if (!profile) return 'none';
  const score = [
    profile.summary,
    profile.rating,
    profile.s3CoverUrl ?? profile.coverImageUrl,
    profile.keyThemes,
    profile.amazonUrl,
    profile.publishedDate,
  ].filter(Boolean).length;
  if (score >= 5) return 'complete';
  if (score >= 3) return 'enriched';
  if (score >= 1) return 'basic';
  return 'none';
}

export function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}
