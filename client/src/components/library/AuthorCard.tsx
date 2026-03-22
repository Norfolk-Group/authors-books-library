/**
 * AuthorCard
 * Card component for the Authors tab in the main library page.
 * Shows avatar, name, specialty, book cover strip, and book subfolder list.
 */

import { motion } from "framer-motion";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { BookSubfolderRow } from "@/components/library/LibraryPrimitives";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type AuthorEntry,
} from "@/lib/libraryData";
import {
  type LucideIcon,
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
  BookOpen,
  ExternalLink,
  UserCheck,
  Users,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
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

interface AuthorCardProps {
  author: AuthorEntry;
  query: string;
  onBioClick: (a: AuthorEntry) => void;
  isEnriched?: boolean;
  coverMap?: Map<string, string>;
  onBookClick?: (bookId: string, titleKey: string) => void;
  dbAvatarMap?: Map<string, string>;
}

function highlight(text: string, query: string) {
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
}

export function AuthorCard({ author, query, onBioClick, isEnriched, coverMap, onBookClick, dbAvatarMap }: AuthorCardProps) {
  const color = CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = ICON_MAP[iconName] ?? Briefcase;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;
  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ") ? author.name.slice(author.name.indexOf(" - ") + 3) : "";
  const avatarUrl = dbAvatarMap?.get(displayName.toLowerCase()) ?? getAuthorAvatar(displayName);
  const hasBooks = author.books && author.books.length > 0;

  return (
    <motion.div
      className="card-animate group relative"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
    >
      <div
        className="rounded-lg border border-border shadow-sm overflow-hidden relative bg-card h-full"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        {/* Watermark */}
        <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
          <Icon style={{ width: 72, height: 72, color, opacity: 0.07 }} strokeWidth={1} />
        </div>

        {/* Header - opens bio modal */}
        <button
          onClick={() => onBioClick(author)}
          className="block w-full text-left p-4 pb-2 cursor-pointer relative z-10 hover:bg-black/[0.02] transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "22" }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                {author.category}
              </span>
            </div>
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-0.5 rounded hover:bg-black/10 transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
            </a>
          </div>

          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-2 mb-1">
            <AvatarUpload authorName={displayName} currentPhotoUrl={avatarUrl} size={120}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-[120px] h-[120px] rounded-full object-cover ring-2 ring-offset-2 flex-shrink-0 transition-transform duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer"
                    style={{ "--tw-ring-color": color + "55" } as React.CSSProperties}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-[120px] h-[120px] rounded-full flex items-center justify-center text-3xl font-bold flex-shrink-0 transition-transform duration-200 ease-out hover:scale-110 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: color + "22", color }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>
            <div className="w-full text-center">
              <h3 className="text-base font-bold leading-snug tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
                {highlight(displayName, query)}
              </h3>
              {specialty && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
                  {highlight(specialty, query)}
                </p>
              )}
            </div>
          </div>
        </button>

        {/* Enrichment status */}
        <div className="px-3 pb-2 relative z-10 pointer-events-none">
          <span className="text-[10px] font-medium flex items-center gap-1.5">
            {isEnriched ? (
              <>
                <UserCheck className="w-3 h-3 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Bio ready &middot; click to view</span>
              </>
            ) : (
              <>
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Click to view bio &amp; links</span>
              </>
            )}
          </span>
        </div>

        {/* Book subfolders */}
        {hasBooks && (
          <div className="px-3 pb-3 pt-1 border-t border-border/40 mt-1 relative z-10">
            {/* Mini cover strip */}
            {coverMap && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5 cover-strip-scroll">
                {author.books.map((book) => {
                  const titleKey = book.name.includes(" - ")
                    ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
                    : book.name.trim();
                  const coverUrl = coverMap.get(titleKey);
                  return (
                    <Tooltip key={book.id} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookClick ? onBookClick(book.id, titleKey) : window.open(`https://drive.google.com/drive/folders/${book.id}?view=grid`, "_blank");
                          }}
                          className="flex-shrink-0 group/cover cursor-pointer"
                        >
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={titleKey}
                              className="w-16 h-[88px] object-cover rounded shadow-sm ring-1 ring-border group-hover/cover:ring-2 transition-all duration-150"
                              style={{ "--tw-ring-color": color + "55" } as React.CSSProperties}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-16 h-[88px] rounded shadow-sm ring-1 ring-border flex items-center justify-center group-hover/cover:ring-2 transition-all duration-150"
                              style={{ backgroundColor: color + "18", "--tw-ring-color": color + "55" } as React.CSSProperties}
                            >
                              <BookOpen className="w-5 h-5" style={{ color, opacity: 0.7 }} />
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none rounded-lg overflow-hidden">
                        <div className="flex flex-col items-center gap-1.5 p-2 bg-popover rounded-xl shadow-xl border border-border/60" style={{ backdropFilter: "blur(8px)" }}>
                          {coverUrl ? (
                            <img src={coverUrl} alt={titleKey} className="w-[90px] h-[126px] object-cover rounded-md shadow-md" loading="lazy" />
                          ) : (
                            <div className="w-[90px] h-[126px] rounded-md shadow-md flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
                              <BookOpen className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                            </div>
                          )}
                          <p className="text-[10px] font-medium text-popover-foreground text-center max-w-[90px] leading-tight line-clamp-2">{titleKey}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 px-2">
              Books ({author.books.length})
            </p>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {author.books.map((book) => (
                <BookSubfolderRow key={book.id} book={book} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
