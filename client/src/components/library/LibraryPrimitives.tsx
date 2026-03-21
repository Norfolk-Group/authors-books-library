/**
 * Library Primitives
 * Small, stateless UI building blocks shared across library card components.
 * Extracted from Home.tsx to keep each file focused.
 */

import {
  type LucideIcon,
  BookMarked,
  Folder,
  BookOpen,
  ExternalLink,
  FileText,
  File,
  AlignLeft,
  Headphones,
  Video,
  Image,
  Package,
  Scroll,
  Newspaper,
  Link,
  List,
  Book,
} from "lucide-react";
import {
  CONTENT_TYPE_ICONS,
} from "@/lib/libraryData";

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

// Normalize raw content type names for display
export const DISPLAY_NAME_MAP: Record<string, string> = {
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

export function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// -- Content Type Badge ---------------------------------------
export function ContentTypeBadge({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = CT_ICON_MAP[iconName] ?? Folder;

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
      title={`${type}: ${count} file${count !== 1 ? "s" : ""}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {type}
      {count > 1 && <span className="opacity-60">&middot;{count}</span>}
    </span>
  );
}

// -- Book Subfolder Row ---------------------------------------
export function BookSubfolderRow({ book }: { book: { name: string; id: string; contentTypes: Record<string, number> } }) {
  const hasContent = Object.keys(book.contentTypes).length > 0;
  return (
    <a
      href={`https://drive.google.com/drive/folders/${book.id}?view=grid`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group/book"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover/book:text-foreground transition-colors" />
        <span className="text-[11px] font-medium leading-tight text-foreground/80 group-hover/book:text-foreground transition-colors line-clamp-1 flex-1">
          {(() => {
            const dashIdx = book.name.lastIndexOf(" - ");
            return dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
          })()}
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/book:opacity-60 transition-opacity flex-shrink-0" />
      </div>
      {hasContent && (
        <div className="flex flex-wrap gap-1 pl-4">
          {Object.entries(normalizeContentTypes(book.contentTypes)).map(([type, count]) => (
            <ContentTypeBadge key={type} type={type} count={count} />
          ))}
        </div>
      )}
    </a>
  );
}

// -- Stat Card ------------------------------------------------
export function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col gap-1 px-3 sm:px-5 py-3 sm:py-4 bg-card rounded-lg border border-border shadow-sm stat-card-3d">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs font-medium uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl sm:text-2xl font-extrabold font-display tracking-tight stat-number">
        {value}
      </span>
    </div>
  );
}

// -- Empty State ----------------------------------------------
export function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BookMarked className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">
        {query ? `No results for "${query}"` : "Nothing here yet."}
      </p>
    </div>
  );
}
