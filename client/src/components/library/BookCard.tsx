/**
 * BookCard — individual book card for the Books tab.
 *
 * -- DESIGN RULES (mirrors FlowbiteAuthorCard) --
 *   - Centered cover as the visual anchor (like the author avatar)
 *   - Category pill at top (same row layout as author cards)
 *   - Title + author name below cover
 *   - Content-type badges in lower section (moved here from author cards)
 *   - Zero hardcoded hex/rgb values — CSS variable tokens only
 *
 * -- INTERACTION MODEL --
 *   1. Cover image     → click opens cover lightbox (zoom)
 *   2. Author name     → click navigates to author card in Authors tab
 *   3. Card surface    → click opens BookDetailPanel
 *   4. Drive icon      → opens Google Drive folder
 *
 * -- ANIMATIONS (framer-motion, already installed) --
 *   - Card: whileHover scale-up + shadow lift, whileTap scale-down
 *   - Cover: hover scale-[1.08], active scale-[0.94] (press feel)
 */

import { motion } from "framer-motion";
import {
  BookOpen,
  ExternalLink,
  BookMarked as BookMarkedIcon,
  Star,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS, type BookRecord } from "@/lib/libraryData";
import { ICON_MAP, getBookEnrichmentLevel } from "./libraryConstants";
import { ContentTypeBadge } from "./LibraryPrimitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookEnrichmentBadge } from "@/components/BookEnrichmentBadge";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { Link } from "wouter";

function slugifyBook(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface BookCardProps {
  book: BookRecord;
  query: string;
  onDetailClick?: (b: BookRecord) => void;
  coverImageUrl?: string;
  isEnriched?: boolean;
  amazonUrl?: string;
  /** Goodreads URL for the book */
  goodreadsUrl?: string;
  /** Wikipedia article URL for the book */
  wikipediaUrl?: string;
  onCoverClick?: (url: string, title: string, color: string) => void;
  /** Called when user clicks the author name — navigates to author in Authors tab */
  onAuthorClick?: (authorName: string) => void;
  /** Used for scroll-to highlight — set to true when this card is the navigation target */
  isHighlighted?: boolean;
  /** Star rating string, e.g. "4.6" */
  rating?: string;
  /** Number of ratings/reviews */
  ratingCount?: number;
  /** Published date string, e.g. "2023-04-18" */
  publishedDate?: string;
  /** Comma-separated key themes */
  keyThemes?: string;
  /** Short summary for hover tooltip */
  summary?: string;
  /** Whether this book is currently favorited by the logged-in user */
  isFavorite?: boolean;
  /** Whether this book has a full double-pass LLM rich summary available */
  hasRichSummary?: boolean;
}

export function BookCard({
  book,
  query,
  onDetailClick,
  coverImageUrl,
  isEnriched,
  amazonUrl,
  goodreadsUrl,
  wikipediaUrl,
  onCoverClick,
  onAuthorClick,
  isHighlighted,
  rating,
  ratingCount,
  publishedDate,
  keyThemes,
  summary,
  isFavorite,
  hasRichSummary,
}: BookCardProps) {
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = (ICON_MAP[iconName] ?? BookMarkedIcon) as LucideIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const hasContent = Object.keys(book.contentTypes).length > 0;

  // Compute enrichment level from available props
  const enrichmentLevel = getBookEnrichmentLevel(
    isEnriched
      ? {
          summary: summary ?? null,
          rating: rating ?? null,
          s3CoverUrl: coverImageUrl ?? null,
          keyThemes: keyThemes ?? null,
          amazonUrl: amazonUrl ?? null,
          publishedDate: publishedDate ?? null,
        }
      : null
  );

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-transparent font-bold text-foreground">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <motion.div
      className="card-animate group relative cursor-pointer h-full"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={() => onDetailClick?.(book)}
    >
      <div
        className={`
          h-full overflow-hidden relative
          bg-card text-card-foreground
          border border-border rounded-2xl
          shadow-sm hover:shadow-md
          transition-shadow duration-200
          flex flex-col items-stretch justify-start
          ${isHighlighted ? "ring-2 ring-offset-2" : ""}
        `}
        style={isHighlighted ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
      >
        {/* Category watermark — presentational */}
        {!coverImageUrl && (
          <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
            <Icon className="w-16 h-16 text-foreground opacity-[0.04]" strokeWidth={1} />
          </div>
        )}

        {/* ── Row 1: Category pill + Drive link ───────────────────────────── */}
        <div className="px-4 pt-4 pb-0 flex items-center justify-between gap-2 h-[28px] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate min-w-0"
              title={book.category}
            >
              {book.category}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <FavoriteToggle
              entityType="book"
              entityKey={displayTitle.toLowerCase()}
              displayName={displayTitle}
              imageUrl={coverImageUrl}
              initialIsFavorite={isFavorite ?? false}
              size="sm"
            />
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Open in Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>
          </div>
        </div>

        {/* ── Row 2: Cover (centered, like author avatar) ─────────────────── */}
        <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0">
          {/* Cover image — HOTSPOT 1: click opens lightbox */}
          <div className="relative flex-shrink-0">
            {coverImageUrl ? (
              <motion.div
                className="cursor-zoom-in"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCoverClick?.(coverImageUrl, displayTitle, color);
                }}
              >
                <img
                  src={coverImageUrl}
                  alt={displayTitle}
                  className="
                    h-[103px] w-[76px] object-cover rounded-lg shadow-md
                    ring-2 ring-border ring-offset-2
                  "
                  loading="lazy"
                />
              </motion.div>
            ) : (
              <motion.div
                className="
                  h-[103px] w-[76px] rounded-lg bg-muted shadow-md
                  ring-2 ring-border ring-offset-2
                  flex items-center justify-center
                "
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </motion.div>
            )}
          </div>

          {/* Title + author name */}
          <div className="min-w-0 w-full text-center">
            {/* Title — hover shows summary tooltip if available */}
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <h3 className="text-sm font-bold text-card-foreground leading-snug tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)] cursor-default">
                  {highlight(displayTitle)}
                </h3>
              </TooltipTrigger>
              {summary && (
                <TooltipContent side="top" className="max-w-xs p-3 z-50">
                  <p className="font-semibold text-xs mb-1">{displayTitle}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {summary.length > 160 ? summary.slice(0, 160) + "…" : summary}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* HOTSPOT 2: author name + publication year */}
            {bookAuthor && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthorClick?.(bookAuthor);
                }}
                className="
                  mt-1 text-xs text-muted-foreground hover:text-foreground
                  transition-colors underline-offset-2 hover:underline
                  cursor-pointer leading-relaxed
                "
              >
                <span className="font-medium">by</span> {highlight(bookAuthor)}
                {publishedDate && (
                  <span className="text-muted-foreground not-italic"> · {publishedDate.slice(0, 4)}</span>
                )}
              </button>
            )}
          </div>

          {/* Star rating row — replaces the old "Cover ready" status line */}
          {rating ? (
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-foreground">{rating}</span>
              {ratingCount && (
                <span className="text-[10px] text-muted-foreground">({ratingCount.toLocaleString()})</span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              <BookOpen className="w-3 h-3" />
              <span>Click for details</span>
            </div>
          )}

          {/* Book enrichment level badge + Rich Summary indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            {enrichmentLevel !== 'none' && (
              <BookEnrichmentBadge level={enrichmentLevel} size="sm" />
            )}
            {hasRichSummary && (
              <span
                className="inline-flex items-center gap-1 rounded-full font-semibold cursor-default select-none px-1.5 py-0.5 text-[9px] bg-teal-500/15 text-teal-700 border border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40"
                title="Full AI-generated rich summary available on the book detail page"
                aria-label="Rich summary available"
              >
                <FileText className="w-2.5 h-2.5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
                <span className="uppercase tracking-wider leading-none">Rich</span>
              </span>
            )}
          </div>

          {/* Key themes pills — shown when enriched */}
          {keyThemes && (
            <div className="flex flex-wrap justify-center gap-1 px-2 mt-1">
              {keyThemes.split(",").slice(0, 2).map((t) => t.trim()).filter(Boolean).map((theme) => (
                <span
                  key={theme}
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground"
                >
                  {theme}
                </span>
              ))}
              {keyThemes.split(",").length > 2 && (
                <span className="text-[9px] text-muted-foreground self-center">
                  +{keyThemes.split(",").length - 2}
                </span>
              )}
            </div>
          )}

          {/* Resource pills — Amazon, Goodreads, Wikipedia */}
          {(amazonUrl || goodreadsUrl || wikipediaUrl) && (
            <div className="flex items-center justify-center flex-wrap gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
              {amazonUrl && (
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="View on Amazon"
                >
                  {/* Amazon smile icon */}
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.047-.872-1.234-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.66C6.265 1.862 9.316.5 12.073.5c1.407 0 3.245.374 4.354 1.44 1.407 1.312 1.273 3.063 1.273 4.969v4.5c0 1.353.561 1.948 1.089 2.678.186.261.226.574-.009.769l-1.636 1.939z"/>
                  </svg>
                  Amazon
                </a>
              )}
              {goodreadsUrl && (
                <a
                  href={goodreadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="View on Goodreads"
                >
                  {/* Goodreads G icon */}
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.43 23.995c-3.608-.208-6.274-2.077-6.448-5.078.695.007 1.375-.013 2.07-.006.224 1.342 1.065 2.43 2.683 3.026 1.583.496 3.737.46 5.082-.174 1.351-.636 2.145-1.822 2.503-3.577.212-1.042.236-1.734.231-2.92l-.005-1.631h-.059c-1.245 2.564-3.315 3.53-5.59 3.475-5.74-.054-7.68-4.534-7.681-8.684-.001-4.906 2.763-8.958 7.925-8.948 2.216.033 4.1 1.04 5.24 3.022h.058V.736h2.055c.016 1.32.04 2.665.04 3.985v12.76c-.004 6.768-3.995 6.767-8.104 6.514zm.166-9.084c3.698-.04 5.576-2.903 5.553-6.27-.022-3.272-1.747-6.218-5.457-6.272-3.735-.054-5.634 2.95-5.634 6.271 0 3.272 1.673 6.313 5.538 6.271z"/>
                  </svg>
                  Goodreads
                </a>
              )}
              {wikipediaUrl && (
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="View on Wikipedia"
                >
                  {/* Wikipedia W icon */}
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005 1.225 2.405 2.501 4.771 3.852 7.12l.828-1.569-2.947-5.542c-.238-.465-.557-.74-.927-.826-.127-.031-.198-.077-.198-.149v-.468l.055-.045h4.78l.05.045v.437c0 .084-.1.133-.198.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l-4.147 8.334c-.617 1.074-1.127.931-1.532.029l-2.854-5.728z"/>
                  </svg>
                  Wikipedia
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        {hasContent && <div className="mx-4 h-px bg-border flex-shrink-0" />}

        {/* ── Row 3: Content-type badges (moved from Author card) ──────────── */}
        {hasContent && (
          <div className="px-4 py-3 relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 cursor-default">
              Resources
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(book.contentTypes).map(([type, count]) => (
                <ContentTypeBadge key={type} type={type} count={count} />
              ))}
            </div>
          </div>
        )}

        {/* Discreet link — View Full Book Profile */}
        <div className="px-4 pb-3 pt-1 relative z-10" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/book/${slugifyBook(book.name)}`}
            className="flex items-center justify-center gap-1 w-full py-1.5 px-3 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 no-underline"
          >
            <BookOpen size={11} />
            View Full Book Profile
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
