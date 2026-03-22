/**
 * BookDetailPanel -- modal panel showing book details, cover, summary, themes, links.
 * Extracted from Home.tsx for file size management.
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
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
  BookMarked as BookMarkedIcon,
} from "lucide-react";
import { BOOKS, CATEGORY_COLORS, CATEGORY_ICONS, CONTENT_TYPE_ICONS, CONTENT_TYPE_COLORS } from "@/lib/libraryData";
import { ICON_MAP, CT_ICON_MAP } from "./libraryConstants";
import { fireConfetti } from "@/hooks/useConfetti";
import { useAppSettings } from "@/contexts/AppSettingsContext";

type BookRecord = typeof BOOKS[number];

interface BookDetailPanelProps {
  book: BookRecord;
  onClose: () => void;
}

export function BookDetailPanel({ book, onClose }: BookDetailPanelProps) {
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
  }, [isLoading, profile]);

  const isLoadingProfile = isLoading || enrichMutation.isPending;

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

  const effectiveCoverUrl = scrapedCoverUrl ?? profile?.coverImageUrl ?? null;
  const displayAsin = scrapedAsin;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Header */}
      <DialogHeader>
        <div className="flex items-start gap-4 mb-1">
          <div className="flex-shrink-0 relative">
            {effectiveCoverUrl ? (
              <img
                src={effectiveCoverUrl}
                alt={displayTitle}
                className="w-20 h-28 object-cover rounded-md shadow-md ring-1 ring-border book-cover-3d"
                loading="lazy"
              />
            ) : (
              <div
                className="w-20 h-28 rounded-md flex items-center justify-center shadow-md ring-1 ring-border"
                style={{ backgroundColor: color + "18" }}
              >
                {isLoadingProfile || scrapeMutation.isPending ? (
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color }} />
                ) : (
                  <Icon className="w-8 h-8" style={{ color, opacity: 0.5 }} />
                )}
              </div>
            )}
            {displayAsin && (
              <span className="absolute -bottom-1 -right-1 text-[9px] bg-background border border-border rounded px-1 py-0.5 font-mono opacity-70">
                {displayAsin}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{book.category}</span>
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
          </div>
        </div>
      </DialogHeader>

      {/* Summary */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
        {isLoadingProfile ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Loading book info...
          </div>
        ) : profile?.summary ? (
          <p className="text-sm leading-relaxed text-foreground/80">{profile.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary available.</p>
        )}
      </div>

      {/* Key themes */}
      {profile?.keyThemes && (
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
