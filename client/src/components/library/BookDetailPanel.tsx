/**
 * BookDetailPanel -- modal panel showing book details, cover, summary, themes, links.
 * Extracted from Home.tsx for file size management.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Globe,
  RefreshCw,
  ShoppingCart,
  Star,
  File,
  BookOpen,
  BookMarked as BookMarkedIcon,
  X,
  Quote,
  Lightbulb,
  BookCopy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BOOKS, CATEGORY_COLORS, CATEGORY_ICONS, CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS } from "@/lib/libraryData";
import { ICON_MAP, CT_ICON_MAP, normalizeContentTypes, getBookEnrichmentLevel } from "./libraryConstants";
import { BookEnrichmentBadge } from "@/components/BookEnrichmentBadge";
import { fireConfetti } from "@/hooks/useConfetti";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useState as useStateLocal } from "react";
import { TagPicker } from "@/components/TagPicker";
import { useAuth } from "@/_core/hooks/useAuth";
import { normalizeTitleKey } from "@/hooks/useLibraryData";

// ── Rich Summary types ────────────────────────────────────────────────────────
interface RichTheme { theme: string; description: string; }
interface RichQuote { quote: string; context?: string; }
interface SimilarBook { title: string; author: string; reason?: string; }
interface RichSummary {
  fullSummary?: string;
  executiveSummary?: string;
  keyThemes?: RichTheme[];
  keyQuotes?: RichQuote[];
  similarBooks?: SimilarBook[];
}

type BookRecord = typeof BOOKS[number];

/**
 * compact: Matches the old BookModal layout — smaller cover, no "In Your Library" section,
 *          used from AuthorAccordionRow and FlowbiteAuthorCard mini book covers.
 * full:    Full detail panel with all sections, used from the Books tab.
 */
export type BookDetailVariant = 'full' | 'compact';

interface BookDetailPanelProps {
  book: BookRecord;
  onClose: () => void;
  /** Rendering variant. Defaults to 'full'. */
  variant?: BookDetailVariant;
  /** When variant='compact', wrap in a Dialog. Defaults to false. */
  asDialog?: boolean;
  /** Whether the dialog is open (only used when asDialog=true). */
  open?: boolean;
}

export function BookDetailPanel({ book, onClose, variant = 'full', asDialog = false, open }: BookDetailPanelProps) {
  const { isAuthenticated: _isAuthenticated } = useAuth();
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = ICON_MAP[iconName] ?? BookMarkedIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const totalItems = Object.values(book.contentTypes).reduce((s, n) => s + n, 0);

  const { settings } = useAppSettings();
  const { data: profile, isLoading, refetch: refetchProfile } = trpc.bookProfiles.get.useQuery({ bookTitle: displayTitle });
  const enrichMutation = trpc.bookProfiles.enrich.useMutation({
    onError: (e) => toast.error("Failed to load book info: " + e.message),
  });

  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({
        bookTitle: displayTitle,
        authorName: bookAuthor,
        model: settings.bookResearchModel || settings.primaryModel || undefined,
        secondaryModel: settings.bookResearchSecondaryEnabled && settings.bookResearchSecondaryModel
          ? settings.bookResearchSecondaryModel
          : undefined,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- enrichMutation, displayTitle, bookAuthor, settings.* intentionally omitted: triggers once when book absent
  }, [isLoading, profile]);

  const isLoadingProfile = isLoading || enrichMutation.isPending;

  // Parse richSummaryJson once
  const richSummary: RichSummary | null = (() => {
    if (!profile?.richSummaryJson) return null;
    try { return JSON.parse(profile.richSummaryJson as string) as RichSummary; } catch { return null; }
  })();

  const [showFullSummary, setShowFullSummary] = useStateLocal(false);

  const [scrapedCoverUrl, setScrapedCoverUrl] = useState<string | null>(null);
  const [scrapedAsin, setScrapedAsin] = useState<string | null>(null);
  const utilsInner = trpc.useUtils();
  const scrapeMutation = trpc.apify.scrapeBook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        if (data.coverUrl) setScrapedCoverUrl(data.coverUrl);
        if (data.asin) setScrapedAsin(data.asin);
        toast.success(`Found on Amazon: ${data.matchedTitle ?? displayTitle}`);
        fireConfetti("scrape");
        refetchProfile();
        void utilsInner.bookProfiles.getMany.invalidate();
      } else {
        toast.error("Amazon scrape: " + ((data as { message?: string }).message ?? "No results found"));
      }
    },
    onError: (e) => toast.error("Amazon scrape failed: " + e.message),
  });

  const effectiveCoverUrl = scrapedCoverUrl ?? profile?.s3CoverUrl ?? profile?.coverImageUrl ?? null;
  const displayAsin = scrapedAsin;

  // Normalised content types for compact variant
  const normalisedTypes = normalizeContentTypes(book.contentTypes);
  const amazonUrl = profile?.amazonUrl ?? `https://www.amazon.com/s?k=${encodeURIComponent(displayTitle)}`;

  // ── COMPACT VARIANT (replaces BookModal) ─────────────────────────────────────
  const compactContent = (
    <div className="flex flex-col gap-4 text-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-muted/80 hover:bg-muted flex items-center justify-center shadow-sm border border-border transition-all hover:scale-105 active:scale-95"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>

      {/* Cover + meta row */}
      <div className="flex items-start gap-4">
        <AnimatePresence mode="wait">
          {effectiveCoverUrl ? (
            <motion.img
              key={effectiveCoverUrl}
              src={effectiveCoverUrl}
              alt={displayTitle}
              className="h-[169px] w-[113px] rounded object-cover shadow-sm flex-shrink-0 ring-1 ring-border"
              loading="lazy"
              initial={{ opacity: 0, scale: 0.88, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.8 }}
            />
          ) : (
            <motion.div
              key="placeholder"
              className="h-[169px] w-[113px] rounded bg-muted flex items-center justify-center flex-shrink-0 ring-1 ring-border"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              {isLoadingProfile ? (
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          {/* Rating */}
          {profile?.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">{profile.rating}</span>
              {profile.ratingCount && (
                <span className="text-xs text-muted-foreground">({profile.ratingCount})</span>
              )}
            </div>
          )}
          {/* Content-type pills */}
          {Object.keys(normalisedTypes).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(normalisedTypes).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {type}{count > 1 && <span className="opacity-60 ml-0.5">{count}</span>}
                </span>
              ))}
            </div>
          )}
          {/* Action links */}
          <div className="flex flex-col gap-1.5 mt-1">
            <a href={driveUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              Open in Google Drive
            </a>
            <a href={amazonUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ShoppingCart className="w-3 h-3 flex-shrink-0" />
              {profile?.amazonUrl ? "View on Amazon" : "Search on Amazon"}
            </a>
            {profile?.goodreadsUrl && (
              <a href={profile.goodreadsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <BookOpen className="w-3 h-3 flex-shrink-0" />
                View on Goodreads
              </a>
            )}
            <button
              onClick={() => scrapeMutation.mutate({ title: displayTitle, author: bookAuthor })}
              disabled={scrapeMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scrapeMutation.isPending ? (
                <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
              ) : (
                <ShoppingCart className="w-3 h-3 flex-shrink-0" />
              )}
              {scrapeMutation.isPending ? "Scraping…" : "Scrape Cover from Amazon"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {(isLoadingProfile || profile?.summary) && (
        <>
          <div className="h-px bg-border" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Summary</p>
            {isLoadingProfile ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-card-foreground">{profile?.summary}</p>
            )}
          </div>
        </>
      )}

      <div className="h-px bg-border" />
      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium text-foreground transition-all shadow-sm border border-border hover:shadow-md active:scale-[0.98]"
      >
        Close
      </button>
    </div>
  );

  if (asDialog) {
    return (
      <Dialog open={open ?? true} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-card-foreground capitalize pr-10">
              {displayTitle}
            </DialogTitle>
          </DialogHeader>
          {compactContent}
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === 'compact') {
    return compactContent;
  }

  // ── FULL VARIANT (default) ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-start gap-4 mb-1">
          <div className="flex-shrink-0 relative">
            <AnimatePresence mode="wait">
            {effectiveCoverUrl ? (
              <motion.img
                key={effectiveCoverUrl}
                src={effectiveCoverUrl}
                alt={displayTitle}
                className="w-[101px] h-[144px] object-cover rounded-md shadow-md ring-1 ring-border book-cover-3d"
                loading="lazy"
                initial={{ opacity: 0, scale: 0.88, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.8 }}
              />
            ) : (
              <motion.div
                key="placeholder"
                className="w-[101px] h-[144px] rounded-md flex items-center justify-center shadow-md ring-1 ring-border"
                style={{ backgroundColor: color + "18" }}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
                {isLoadingProfile || scrapeMutation.isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color }} />
                ) : (
                  <Icon className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                )}
              </motion.div>
            )}
            </AnimatePresence>
            {displayAsin && (
              <span className="absolute -bottom-1 -right-1 text-[9px] bg-background border border-border rounded px-1 py-0.5 font-mono opacity-70">
                {displayAsin}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{book.category}</span>
              <BookEnrichmentBadge
                level={getBookEnrichmentLevel(profile as Parameters<typeof getBookEnrichmentLevel>[0])}
                size="sm"
              />
            </div>
            <DialogTitle className="text-lg font-bold font-display leading-snug">{displayTitle}</DialogTitle>
            {bookAuthor && <DialogDescription className="text-sm mt-0.5">by {bookAuthor}</DialogDescription>}
            {profile?.rating && (
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{profile.rating}</span>
                {profile.ratingCount && (
                  <span className="text-xs text-muted-foreground">({profile.ratingCount} ratings)</span>
                )}
              </div>
            )}
            {(profile?.publishedDate || profile?.publisher) && (
              <p className="text-xs text-muted-foreground mt-1">
                {[profile.publisher, profile.publishedDate?.slice(0, 4)].filter(Boolean).join(" - ")}
              </p>
            )}
            {/* Tag picker */}
            <div className="mt-2">
              <TagPicker
                entityType="book"
                entityKey={normalizeTitleKey(book.name)}
                currentTagSlugs={profile?.tagsJson ? (() => { try { return JSON.parse(profile.tagsJson as string); } catch { return []; } })() : []}
                showApplied={true}
              />
            </div>
          </div>
        </div>
      </DialogHeader>

      {/* About / Executive Summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {isLoadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading book info...
          </div>
        ) : richSummary?.executiveSummary ? (
          <p className="text-sm leading-relaxed text-foreground/80">{richSummary.executiveSummary}</p>
        ) : profile?.summary ? (
          <p className="text-sm leading-relaxed text-foreground/80">{profile.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary available.</p>
        )}
      </div>

      {/* Rich Full Summary (collapsible) */}
      {richSummary?.fullSummary && (
        <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
          <button
            onClick={() => setShowFullSummary((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Summary</span>
            {showFullSummary ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
          {showFullSummary && (
            <div className="px-3 pb-3">
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{richSummary.fullSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Rich Key Themes (with descriptions) */}
      {richSummary?.keyThemes && richSummary.keyThemes.length > 0 ? (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3.5 h-3.5" style={{ color }} />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Themes</h4>
          </div>
          <div className="flex flex-col gap-2">
            {richSummary.keyThemes.map((t) => (
              <div key={t.theme} className="flex items-start gap-2">
                <span className="mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0" style={{ backgroundColor: color + "18", color }}>
                  {t.theme}
                </span>
                {t.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : profile?.keyThemes ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Themes</h4>
          <div className="flex flex-wrap gap-1.5">
            {profile.keyThemes.split(",").map((t) => t.trim()).filter(Boolean).map((theme) => (
              <span key={theme} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: color + "18", color }}>
                {theme}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Key Quotes */}
      {richSummary?.keyQuotes && richSummary.keyQuotes.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Quote className="w-3.5 h-3.5" style={{ color }} />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notable Quotes</h4>
          </div>
          <div className="flex flex-col gap-3">
            {richSummary.keyQuotes.map((q, i) => (
              <div key={i} className="pl-3 border-l-2" style={{ borderColor: color + "60" }}>
                <p className="text-sm italic text-foreground/80 leading-relaxed">"{q.quote}"</p>
                {q.context && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{q.context}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External links + Amazon scrape */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Find This Book</h4>
          <button
            onClick={() => scrapeMutation.mutate({ title: displayTitle, author: bookAuthor })}
            disabled={scrapeMutation.isPending}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            title="Scrape Amazon for cover image and buy link"
          >
            {scrapeMutation.isPending ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <ShoppingCart className="w-3 h-3" />
            )}
            {scrapeMutation.isPending ? "Searching..." : "Scrape Amazon"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {profile?.amazonUrl && (
            <a href={profile.amazonUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ShoppingCart className="w-3.5 h-3.5" />
              Buy on Amazon
            </a>
          )}
          {profile?.goodreadsUrl && (
            <a href={profile.goodreadsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <BookMarkedIcon className="w-3.5 h-3.5" />
              Search on Goodreads
            </a>
          )}
          {profile?.resourceUrl && (
            <a href={profile.resourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Globe className="w-3.5 h-3.5" />
              {profile.resourceLabel || "More Info"}
            </a>
          )}
          {!profile?.amazonUrl && !profile?.goodreadsUrl && !profile?.resourceUrl && !scrapeMutation.isPending && (
            <p className="text-xs text-muted-foreground">Click "Scrape Amazon" to find purchase links and cover art.</p>
          )}
        </div>
      </div>

      {/* Library content */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">In Your Library ({totalItems} files)</h4>
        <div className="flex flex-col gap-1.5">
          {Object.entries(book.contentTypes).map(([type, count]) => {
            const iconKey = CONTENT_TYPE_ICONS[type] ?? "file";
            const CtIcon = CT_ICON_MAP[iconKey] ?? File;
            const ctColor = CONTENT_TYPE_COLORS[type] ?? null;
            const subfolderUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
            return (
              <a
                key={type}
                href={subfolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${!ctColor ? "bg-muted" : ""}`}
                  style={ctColor ? { backgroundColor: ctColor + "18" } : undefined}
                >
                  <CtIcon
                    className={`w-3.5 h-3.5 ${!ctColor ? "text-muted-foreground" : ""}`}
                    style={ctColor ? { color: ctColor } : undefined}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{type}</p>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{count} file{count !== 1 ? "s" : ""}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Similar Books */}
      {richSummary?.similarBooks && richSummary.similarBooks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BookCopy className="w-3.5 h-3.5" style={{ color }} />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Readers Also Enjoy</h4>
          </div>
          <div className="flex flex-col gap-2">
            {richSummary.similarBooks.map((sb) => (
              <div key={sb.title} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                <BookOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{sb.title}</p>
                  <p className="text-[10px] text-muted-foreground">{sb.author}</p>
                  {sb.reason && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">{sb.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open in Drive */}
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
