/**
 * BookCard -- individual book card for the Books tab.
 * Extracted from Home.tsx for file size management.
 */

import { motion } from "framer-motion";
import {
  BookOpen,
  ExternalLink,
  BookMarked as BookMarkedIcon,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS, CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS, type BookRecord } from "@/lib/libraryData";
import { ICON_MAP, CT_ICON_MAP } from "./libraryConstants";
import { ContentTypeBadge } from "./LibraryPrimitives";

interface BookCardProps {
  book: BookRecord;
  query: string;
  onDetailClick?: (b: BookRecord) => void;
  coverImageUrl?: string;
  isEnriched?: boolean;
  amazonUrl?: string;
  onCoverClick?: (url: string, title: string, color: string) => void;
}

export function BookCard({ book, query, onDetailClick, coverImageUrl, isEnriched, amazonUrl, onCoverClick }: BookCardProps) {
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = (ICON_MAP[iconName] ?? BookMarkedIcon) as LucideIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const hasContent = Object.keys(book.contentTypes).length > 0;

  return (
    <motion.div
      className="card-animate group relative cursor-pointer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={() => onDetailClick?.(book)}
    >
      <div
        className="rounded-lg border border-border shadow-sm overflow-hidden relative bg-card h-full"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        {/* Watermark (only when no cover) */}
        {!coverImageUrl && (
          <div className="pointer-events-none absolute bottom-2 right-2 select-none watermark-icon" aria-hidden>
            <Icon className="w-[72px] h-[72px]" style={{ color, opacity: 0.07 }} strokeWidth={1} />
          </div>
        )}
        <div className="p-4 relative z-10">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "22" }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                {book.category}
              </span>
            </div>
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Open in Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>
          </div>

          {/* Cover + title row */}
          <div className="flex items-start gap-3 mb-2">
            {coverImageUrl && (
              <div
                className="cover-zoom-wrap flex-shrink-0 w-12 h-16 cursor-zoom-in"
                onClick={(e) => { e.stopPropagation(); onCoverClick?.(coverImageUrl, displayTitle, color); }}
                title="Click to enlarge cover"
              >
                <img
                  src={coverImageUrl}
                  alt={displayTitle}
                  className="w-12 h-16 object-cover rounded shadow-sm ring-1 ring-border hover:ring-2 transition-all duration-150"
                  style={{ '--tw-ring-color': color + '55' } as React.CSSProperties}
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold leading-snug mb-0.5 tracking-tight">
                {highlight(displayTitle)}
              </h3>
              {bookAuthor && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium">by</span> {highlight(bookAuthor)}
                </p>
              )}
            </div>
          </div>

          {/* Enrichment status */}
          <div className="mb-1">
            <span className="text-[10px] font-medium flex items-center gap-1.5">
              {isEnriched ? (
                <>
                  <BookMarkedIcon className="w-3 h-3 text-teal-500" />
                  <span className="text-teal-600 dark:text-teal-400">Cover ready - click for details</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Click for details</span>
                </>
              )}
            </span>
          </div>

          {hasContent && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
              {Object.entries(book.contentTypes).map(([type, count]) => (
                <ContentTypeBadge key={type} type={type} count={count} />
              ))}
            </div>
          )}

          {/* Amazon badge */}
          {amazonUrl && (
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="amazon-badge absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide text-white"
              style={{ backgroundColor: "#FF9900" }}
              title="View on Amazon"
            >
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.047-.872-1.234-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.66C6.265 1.862 9.316.5 12.073.5c1.407 0 3.245.374 4.354 1.44 1.407 1.312 1.273 3.063 1.273 4.969v4.5c0 1.353.561 1.948 1.089 2.678.186.261.226.574-.009.769l-1.636 1.939z"/>
              </svg>
              Amazon
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
