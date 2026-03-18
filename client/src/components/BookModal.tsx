/**
 * BookModal — shared book detail dialog
 *
 * Used by both FlowbiteAuthorCard (Kanban) and AuthorAccordionRow (accordion).
 * Opens when the user clicks a mini book cover or a book title.
 *
 * Shows enriched metadata from Amazon: cover, summary, rating, ISBN, publisher,
 * page count, publication date, categories/themes, and action links.
 *
 * THEME RULES: zero hardcoded colours — CSS tokens only.
 */
import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  BookOpen, FileText, AlignLeft, Book, File, Video, Image,
  Package, Scroll, Newspaper, Link, List, Folder, ExternalLink,
  ShoppingCart, RefreshCw, Camera, Star, Hash, Building2,
  Calendar, FileStack, Tag, Sparkles,
} from "lucide-react";
import { CONTENT_TYPE_ICONS } from "@/lib/libraryData";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

// ── Icon map ──────────────────────────────────────────────────────────────────
type LucideIcon = React.FC<{ className?: string }>;
const CT_ICON_MAP: Record<string, LucideIcon> = {
  "file-text":  FileText as LucideIcon,
  "book":       Book as LucideIcon,
  "file":       File as LucideIcon,
  "align-left": AlignLeft as LucideIcon,
  "video":      Video as LucideIcon,
  "image":      Image as LucideIcon,
  "package":    Package as LucideIcon,
  "scroll":     Scroll as LucideIcon,
  "newspaper":  Newspaper as LucideIcon,
  "link":       Link as LucideIcon,
  "list":       List as LucideIcon,
  "folder":     Folder as LucideIcon,
};

// ── Content-type normalisation (mirrors FlowbiteAuthorCard) ───────────────────
const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC":       "Supplemental",
  "PDF Extra":            "PDF",
  "PDF Extra 2":          "PDF",
  "PDF Extras":           "PDF",
  "Complete Book in PDF": "PDF",
  "DOC":                  "Transcript",
  "ChatGPT":              "Supplemental",
  "Sana AI":              "Supplemental",
  "Notes":                "Supplemental",
  "Knowledge Base":       "Supplemental",
  "temp":                 "Supplemental",
  "Temp":                 "Supplemental",
  "TEMP":                 "Supplemental",
};
function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// ── Content-type pill ─────────────────────────────────────────────────────────
function ContentTypePill({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="w-3 h-3" />
      {type}
      {count > 1 && <span className="opacity-60 ml-0.5">{count}</span>}
    </span>
  );
}

// ── Star rating display ───────────────────────────────────────────────────────
function StarRating({ rating, count }: { rating: string; count?: string }) {
  const numRating = parseFloat(rating);
  if (isNaN(numRating)) return null;
  const fullStars = Math.floor(numRating);
  const hasHalf = numRating - fullStars >= 0.3;
  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < fullStars
              ? "text-amber-500 fill-amber-500"
              : i === fullStars && hasHalf
              ? "text-amber-500 fill-amber-500/50"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="text-xs font-medium text-card-foreground ml-0.5">{numRating.toFixed(1)}</span>
      {count && (
        <span className="text-[10px] text-muted-foreground">({count})</span>
      )}
    </div>
  );
}

// ── Metadata row ──────────────────────────────────────────────────────────────
function MetaRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-card-foreground font-medium truncate">{value}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface BookModalBook {
  /** Drive folder ID */
  id: string;
  /** Normalised title key (lower-case, no author suffix) */
  titleKey: string;
  /** Pre-resolved cover URL (may be undefined) */
  coverUrl?: string;
  /** Raw content-type counts from Drive scan */
  contentTypes: Record<string, number>;
  /** Author name (used for Amazon scraping context) */
  authorName?: string;
}

export interface BookModalProps {
  /** The book to show. Pass null to hide the modal. */
  book: BookModalBook | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BookModal({ book, onClose }: BookModalProps) {
  const utils = trpc.useUtils();
  const [scrapedCoverUrl, setScrapedCoverUrl] = useState<string | null>(null);

  const { data: profile, isLoading } = trpc.bookProfiles.get.useQuery(
    { bookTitle: book?.titleKey ?? "" },
    { enabled: !!book, staleTime: 5 * 60 * 1000 }
  );

  const scrapeBookMutation = trpc.apify.scrapeBook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setScrapedCoverUrl(data.coverUrl ?? null);
        utils.bookProfiles.get.invalidate({ bookTitle: book?.titleKey ?? "" });
        toast.success(`Cover found: "${data.matchedTitle ?? book?.titleKey}"`);
      } else {
        toast.error(data.message ?? "No cover found on Amazon");
      }
    },
    onError: (err) => {
      toast.error(`Scrape failed: ${err.message}`);
    },
  });

  const enrichFromAmazonMutation = trpc.bookProfiles.enrichFromAmazon.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.bookProfiles.get.invalidate({ bookTitle: book?.titleKey ?? "" });
        toast.success(`Enriched "${book?.titleKey}" from Amazon`);
      } else {
        toast.error(data.message ?? "No results found on Amazon");
      }
    },
    onError: (err) => {
      toast.error(`Enrichment failed: ${err.message}`);
    },
  });

  const amazonUrl =
    profile?.amazonUrl ??
    (book ? `https://www.amazon.com/s?k=${encodeURIComponent(book.titleKey)}` : undefined);
  const goodreadsUrl = profile?.goodreadsUrl ?? undefined;
  const summary = profile?.summary ?? null;
  const coverUrl = scrapedCoverUrl ?? profile?.s3CoverUrl ?? profile?.coverImageUrl ?? book?.coverUrl;
  const driveUrl = book
    ? `https://drive.google.com/drive/folders/${book.id}?view=grid`
    : undefined;

  // Normalise content types for display
  const normalised = book ? normalizeContentTypes(book.contentTypes) : {};

  // Check if book has rich metadata
  const hasRichMeta = !!(profile?.rating || profile?.isbn || profile?.publisher || profile?.publishedDate || profile?.keyThemes);

  return (
    <Modal show={!!book} size="lg" onClose={onClose} popup>
      {book && (
        <>
          <ModalHeader>
            <span className="text-sm font-semibold text-card-foreground capitalize">
              {book.titleKey}
            </span>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4 text-sm">
              {/* Cover + meta row */}
              <div className="flex items-start gap-4">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={book.titleKey}
                    className="h-36 w-24 rounded-md object-cover shadow-md flex-shrink-0 ring-1 ring-border book-cover-3d"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-36 w-24 rounded-md bg-muted flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                    <BookOpen className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  {/* Rating */}
                  {profile?.rating && (
                    <StarRating rating={profile.rating} count={profile.ratingCount ?? undefined} />
                  )}

                  {/* Content-type pills */}
                  {Object.keys(normalised).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(normalised).map(([type, count]) => (
                        <ContentTypePill key={type} type={type} count={count} />
                      ))}
                    </div>
                  )}

                  {/* Rich metadata */}
                  {hasRichMeta && (
                    <div className="flex flex-col gap-1 mt-1">
                      <MetaRow icon={Building2 as LucideIcon} label="Publisher" value={profile?.publisher ?? ""} />
                      <MetaRow icon={Hash as LucideIcon} label="ISBN" value={profile?.isbn ?? ""} />
                      <MetaRow icon={Calendar as LucideIcon} label="Published" value={profile?.publishedDate ?? ""} />

                    </div>
                  )}

                  {/* Key themes / categories */}
                  {profile?.keyThemes && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.keyThemes.split(",").map((theme) => (
                        <span
                          key={theme.trim()}
                          className="inline-flex items-center gap-1 rounded-full bg-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {theme.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {(isLoading || summary) && (
                <>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Summary
                    </p>
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs">Loading…</span>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-card-foreground">{summary}</p>
                    )}
                  </div>
                </>
              )}

              {/* Action links */}
              <div className="h-px bg-border" />
              <div className="flex flex-wrap gap-3">
                {driveUrl && (
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline hover-glow rounded px-1 py-0.5"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    Google Drive
                  </a>
                )}
                {amazonUrl && (
                  <a
                    href={amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline hover-glow rounded px-1 py-0.5"
                  >
                    <ShoppingCart className="w-3 h-3 flex-shrink-0" />
                    {profile?.amazonUrl ? "Amazon" : "Search Amazon"}
                  </a>
                )}
                {goodreadsUrl && (
                  <a
                    href={goodreadsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline hover-glow rounded px-1 py-0.5"
                  >
                    <BookOpen className="w-3 h-3 flex-shrink-0" />
                    Goodreads
                  </a>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Scrape cover from Amazon */}
                <button
                  onClick={() =>
                    scrapeBookMutation.mutate({
                      title: book.titleKey,
                      author: book.authorName ?? "",
                    })
                  }
                  disabled={scrapeBookMutation.isPending}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md border border-border px-2.5 py-1.5 hover-lift"
                >
                  {scrapeBookMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3 flex-shrink-0" />
                  )}
                  {scrapeBookMutation.isPending ? "Scraping…" : "Scrape Cover"}
                </button>

                {/* Enrich from Amazon — full metadata */}
                <button
                  onClick={() =>
                    enrichFromAmazonMutation.mutate({
                      bookTitle: book.titleKey,
                      authorName: book.authorName,
                    })
                  }
                  disabled={enrichFromAmazonMutation.isPending}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md border border-border px-2.5 py-1.5 hover-lift"
                >
                  {enrichFromAmazonMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 flex-shrink-0" />
                  )}
                  {enrichFromAmazonMutation.isPending ? "Enriching…" : "Enrich from Amazon"}
                </button>
              </div>
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
