/**
 * LibraryAvailabilitySection — Shows where a book can be found digitally or in libraries.
 *
 * Data sources:
 *  - HathiTrust: free full-text digital copies (public domain / open access)
 *  - Open Library: borrow/read online via Internet Archive
 *  - WorldCat: how many libraries worldwide hold this book
 *  - DPLA: free digital items from US libraries/archives (requires API key)
 *  - Semantic Scholar: academic citations and papers
 *
 * Used in BookDetail page (Tasks 13 & 14).
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ExternalLink,
  Library,
  Globe,
  BookMarked,
  Loader2,
  CheckCircle2,
  GraduationCap,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  bookTitle: string;
  authorName?: string;
  isbn?: string | null;
  accentColor?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AvailabilityRowProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  status: string;
  statusColor: string;
  href?: string;
  hrefLabel?: string;
  loading?: boolean;
}

function AvailabilityRow({
  icon: Icon,
  label,
  status,
  statusColor,
  href,
  hrefLabel,
  loading,
}: AvailabilityRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
          <Icon size={15} className="text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {loading ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <span className={`text-xs font-semibold ${statusColor}`}>{status}</span>
        )}
        {href && !loading && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {hrefLabel ?? "View"}
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Free Digital Copy Badge ──────────────────────────────────────────────────

export function FreeDigitalCopyBadge({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bookTitle,
  isbn,
}: {
  bookTitle: string;
  isbn?: string | null;
}) {
  // Check HathiTrust first (most reliable for free copies)
  const { data: htData, isLoading: htLoading } = trpc.enrichment.hathiTrust.checkAvailability.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 30 }
  );

  // Check Open Library for borrowable copies
  const { data: olData, isLoading: olLoading } = trpc.enrichment.openLibrary.getByISBN.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 30 }
  );

  const isLoading = htLoading || olLoading;

  const freeUrl = useMemo(() => {
    if (htData?.available && htData?.readUrl) return htData.readUrl;
    if (olData?.isbn13) return `https://openlibrary.org/isbn/${olData.isbn13}`;
    if (olData?.isbn10) return `https://openlibrary.org/isbn/${olData.isbn10}`;
    return null;
  }, [htData, olData]);

  const hasFree = !isLoading && freeUrl != null;

  if (isLoading) return null;
  if (!hasFree) return null;

  return (
    <a
      href={freeUrl!}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
    >
      <Download size={11} />
      Free Digital Copy
    </a>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function LibraryAvailabilitySection({ bookTitle, authorName, isbn, accentColor }: Props) {
  const color = accentColor ?? "hsl(var(--primary))";

  // HathiTrust availability
  const { data: htData, isLoading: htLoading } = trpc.enrichment.hathiTrust.checkAvailability.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 30 }
  );

  // HathiTrust full summary (library count)
  const { data: htSummary, isLoading: htSummaryLoading } = trpc.enrichment.hathiTrust.getAvailabilitySummary.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 30 }
  );

  // Open Library
  const { data: olData, isLoading: olLoading } = trpc.enrichment.openLibrary.getByISBN.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 30 }
  );

  // WorldCat holdings count
  const { data: wcData, isLoading: wcLoading } = trpc.enrichment.worldCat.getHoldingsCount.useQuery(
    { isbn: isbn! },
    { enabled: !!isbn, staleTime: 1000 * 60 * 60 }
  );

  // Academic papers (Semantic Scholar)
  const { data: academicData, isLoading: academicLoading } = trpc.enrichment.jstor.searchByAuthor.useQuery(
    { authorName: authorName ?? bookTitle, limit: 3 },
    { enabled: !!(authorName || bookTitle), staleTime: 1000 * 60 * 30 }
  );

  // HathiTrust status
  const htStatus = htLoading ? "Checking…" :
    (htData?.available && htData?.readUrl) ? "Full text available" :
    htSummary?.totalCopies ? `${htSummary.totalCopies} copies found` :
    "Not available";
  const htColor = (htData?.available && htData?.readUrl) ? "text-emerald-600 dark:text-emerald-400" :
    htSummary?.totalCopies ? "text-amber-600 dark:text-amber-400" :
    "text-muted-foreground";

  // Open Library status
  const olStatus = olLoading ? "Checking…" :
    olData ? "Available to borrow" :
    "Not listed";
  const olColor = olData ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
  const olUrl = olData?.isbn13
    ? `https://openlibrary.org/isbn/${olData.isbn13}`
    : olData?.isbn10
    ? `https://openlibrary.org/isbn/${olData.isbn10}`
    : undefined;

  // WorldCat status
  const wcStatus = wcLoading ? "Checking…" :
    wcData?.libraryCount ? `${wcData.libraryCount.toLocaleString()} libraries` :
    "Not found";
  const wcColor = wcData?.libraryCount ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground";

  // Academic papers status
  const paperCount = academicData?.papers?.length ?? 0;
  const academicStatus = academicLoading ? "Searching…" :
    paperCount > 0 ? `${paperCount} paper${paperCount !== 1 ? "s" : ""} found` :
    "No papers found";
  const academicColor = paperCount > 0 ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground";

  const anyLoading = htLoading || olLoading || wcLoading || academicLoading;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Library size={20} style={{ color }} />
        Library Availability
        {anyLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </h2>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* HathiTrust */}
        <div className="px-5">
          <AvailabilityRow
            icon={BookOpen}
            label="HathiTrust Digital Library"
            status={htStatus}
            statusColor={htColor}
            href={htData?.readUrl ?? htSummary?.bestReadUrl ?? htSummary?.recordUrl}
            hrefLabel={htData?.available && htData?.readUrl ? "Read free" : "View"}
            loading={htLoading || htSummaryLoading}
          />

          {/* Open Library */}
          <AvailabilityRow
            icon={Globe}
            label="Open Library (Internet Archive)"
            status={olStatus}
            statusColor={olColor}
            href={olUrl}
            hrefLabel="Borrow"
            loading={olLoading}
          />

          {/* WorldCat */}
          <AvailabilityRow
            icon={Library}
            label="WorldCat (Global Libraries)"
            status={wcStatus}
            statusColor={wcColor}
            href={wcData?.recordUrl ?? (isbn ? `https://www.worldcat.org/search?q=isbn:${isbn}` : undefined)}
            hrefLabel="Find nearby"
            loading={wcLoading}
          />

          {/* Academic Papers */}
          <AvailabilityRow
            icon={GraduationCap}
            label="Academic Papers (Semantic Scholar)"
            status={academicStatus}
            statusColor={academicColor}
            href={authorName ? `https://www.semanticscholar.org/search?q=${encodeURIComponent(authorName)}&sort=Relevance` : undefined}
            hrefLabel="Browse"
            loading={academicLoading}
          />
        </div>

        {/* Academic papers list */}
        {paperCount > 0 && (
          <div className="border-t border-border/40 px-5 py-4 bg-muted/20 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Related Academic Papers
            </p>
            {academicData!.papers.slice(0, 3).map((paper, i) => (
              <div key={i} className="flex items-start gap-3">
                <GraduationCap size={13} className="text-violet-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug truncate">
                    {paper.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {paper.year && (
                      <span className="text-xs text-muted-foreground">{paper.year}</span>
                    )}
                    {paper.citations != null && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {paper.citations} citations
                      </Badge>
                    )}
                    {paper.openAccess && (
                      <Badge className="text-xs px-1.5 py-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        Open Access
                      </Badge>
                    )}
                    {paper.url && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        Read <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HathiTrust full text CTA */}
        {htData?.available && htData?.readUrl && (
          <div className="border-t border-border/40 px-5 py-4 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Free full text available via HathiTrust
                </span>
              </div>
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                onClick={() => window.open(htData.readUrl!, "_blank")}
              >
                <BookMarked size={13} />
                Read Free
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search links */}
      <div className="flex flex-wrap gap-2">
        {isbn && (
          <a
            href={`https://www.worldcat.org/search?q=isbn:${isbn}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <Library size={12} />
            Find in a library near you
            <ExternalLink size={10} />
          </a>
        )}
        <a
          href={`https://openlibrary.org/search?q=${encodeURIComponent(bookTitle)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Globe size={12} />
          Search Open Library
          <ExternalLink size={10} />
        </a>
        {authorName && (
          <a
            href={`https://dp.la/search?q=${encodeURIComponent(bookTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <BookOpen size={12} />
            Search DPLA
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </section>
  );
}
