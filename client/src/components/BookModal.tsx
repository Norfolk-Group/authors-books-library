/**
 * BookModal — shared book detail dialog
 *
 * Used by both FlowbiteAuthorCard (Kanban) and AuthorAccordionRow (accordion).
 * Opens when the user clicks a mini book cover or a book title.
 *
 * THEME RULES: zero hardcoded colours — CSS tokens only.
 */
import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import {
  BookOpen, FileText, AlignLeft, Book, File, Video, Image,
  Package, Scroll, Newspaper, Link, List, Folder, ExternalLink,
  ShoppingCart, RefreshCw, Camera,
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

  const amazonUrl =
    profile?.amazonUrl ??
    (book ? `https://www.amazon.com/s?k=${encodeURIComponent(book.titleKey)}` : undefined);
  const goodreadsUrl = profile?.goodreadsUrl ?? undefined;
  const summary = profile?.summary ?? null;
  const coverUrl = scrapedCoverUrl ?? profile?.s3CoverUrl ?? book?.coverUrl;
  const driveUrl = book
    ? `https://drive.google.com/drive/folders/${book.id}?view=grid`
    : undefined;

  // Normalise content types for display
  const normalised = book ? normalizeContentTypes(book.contentTypes) : {};

  return (
    <Modal show={!!book} size="md" onClose={onClose} popup>
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
                    className="h-24 w-16 rounded object-cover shadow-sm flex-shrink-0 ring-1 ring-border"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-24 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                    <BookOpen className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  {/* Content-type pills */}
                  {Object.keys(normalised).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(normalised).map(([type, count]) => (
                        <ContentTypePill key={type} type={type} count={count} />
                      ))}
                    </div>
                  )}
                  {/* Action links */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    {driveUrl && (
                      <a
                        href={driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        Open in Google Drive
                      </a>
                    )}
                    {amazonUrl && (
                      <a
                        href={amazonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ShoppingCart className="w-3 h-3 flex-shrink-0" />
                        {profile?.amazonUrl ? "View on Amazon" : "Search on Amazon"}
                      </a>
                    )}
                    {goodreadsUrl && (
                      <a
                        href={goodreadsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <BookOpen className="w-3 h-3 flex-shrink-0" />
                        View on Goodreads
                      </a>
                    )}
                    {/* Scrape cover from Amazon button */}
                    <button
                      onClick={() =>
                        scrapeBookMutation.mutate({
                          title: book.titleKey,
                          author: book.authorName ?? "",
                        })
                      }
                      disabled={scrapeBookMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {scrapeBookMutation.isPending ? (
                        <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
                      ) : (
                        <Camera className="w-3 h-3 flex-shrink-0" />
                      )}
                      {scrapeBookMutation.isPending ? "Scraping…" : "Scrape Cover from Amazon"}
                    </button>
                  </div>
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
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
