/**
 * AdminBooksTab — Book management operations in Admin Console
 */
import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/admin/ActionCard";
import { BOOKS } from "@/lib/libraryData";
import {
  Books,
  FileText,
  MagicWand,
  ImageSquare,
  CloudArrowUp,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import type { ActionState } from "@/hooks/useAdminActions";

interface AdminBooksTabProps {
  anyRunning: boolean;
  enrichBooksState: ActionState;
  updateBookSummariesState: ActionState;
  enrichRichSummaryState: ActionState;
  scrapeState: ActionState;
  mirrorCoversState: ActionState;
  rebuildCoversState: ActionState;
  batchScrapeStats: { needsScrape: number } | undefined;
  getLastRun: (key: string) => {
    lastRunAt: Date | string | null;
    lastRunResult: string | null;
    lastRunDurationMs: number | null;
    lastRunItemCount: number | null;
  } | null;
  handleEnrichBooks: () => void;
  handleUpdateAllBookSummaries: () => void;
  handleEnrichRichSummary: () => void;
  handleScrapeCovers: () => void;
  handleMirrorCovers: () => void;
  handleRebuildCovers: () => void;
}

export function AdminBooksTab({
  anyRunning,
  enrichBooksState,
  updateBookSummariesState,
  enrichRichSummaryState,
  scrapeState,
  mirrorCoversState,
  rebuildCoversState,
  batchScrapeStats,
  getLastRun,
  handleEnrichBooks,
  handleUpdateAllBookSummaries,
  handleEnrichRichSummary,
  handleScrapeCovers,
  handleMirrorCovers,
  handleRebuildCovers,
}: AdminBooksTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Books className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm">Manage book catalog, covers, and AI-generated summaries</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{BOOKS.length} books</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Enrich All Books"
          description={`Generate summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`}
          icon={Books}
          actionKey="enrich-books"
          state={enrichBooksState}
          lastRun={getLastRun("enrich-books")}
          destructive
          confirmTitle="Enrich all books?"
          confirmDescription="Calls the AI enrichment pipeline for every book. Already-enriched books (within 30 days) are skipped."
          onRun={handleEnrichBooks}
          buttonLabel="Enrich Books"
          disabled={anyRunning}
        />
        <ActionCard
          title="Update Book Summaries"
          description="Research and update summaries for all books missing one via Perplexity web search."
          icon={FileText}
          actionKey="update-book-summaries"
          state={updateBookSummariesState}
          lastRun={getLastRun("update-book-summaries")}
          destructive
          confirmTitle="Update all book summaries?"
          confirmDescription="Researches and updates summaries for all books missing one. Uses Perplexity web search."
          onRun={handleUpdateAllBookSummaries}
          buttonLabel="Update Summaries"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Rich Summaries"
          description="Double-pass LLM enrichment: research pass + structured summary with themes, quotes, and similar books. 10 books per run."
          icon={MagicWand}
          actionKey="enrich-rich-summary"
          state={enrichRichSummaryState}
          lastRun={getLastRun("enrich-rich-summary")}
          confirmTitle="Enrich rich book summaries?"
          confirmDescription="Two LLM calls per book (research + write). Books with existing rich summaries are skipped."
          onRun={handleEnrichRichSummary}
          buttonLabel="Enrich Rich Summaries"
          disabled={anyRunning}
        />
        <ActionCard
          title="Scrape Book Covers"
          description={`Search Amazon for cover images for books missing one.${batchScrapeStats ? ` ${batchScrapeStats.needsScrape} books need covers.` : ""}`}
          icon={ImageSquare}
          actionKey="scrape-covers"
          state={scrapeState}
          lastRun={getLastRun("scrape-covers")}
          destructive
          confirmTitle="Scrape covers from Amazon?"
          confirmDescription="Searches Amazon for book covers one at a time. Each scrape includes a mirror step."
          onRun={handleScrapeCovers}
          buttonLabel="Scrape Covers"
          disabled={anyRunning}
        />
        <ActionCard
          title="Mirror Covers to CDN"
          description="Copy external cover image URLs to the S3 CDN for stable hosting."
          icon={CloudArrowUp}
          actionKey="mirror-covers"
          state={mirrorCoversState}
          lastRun={getLastRun("mirror-covers")}
          onRun={handleMirrorCovers}
          buttonLabel="Mirror Covers"
          disabled={anyRunning}
        />
        <ActionCard
          title="Rebuild All Book Covers"
          description="Upgrade all Amazon cover URLs to high-resolution (_SX600_), re-scrape failed covers, and re-mirror to S3."
          icon={ArrowsClockwise}
          actionKey="rebuild-covers"
          state={rebuildCoversState}
          lastRun={getLastRun("rebuild-covers")}
          destructive
          confirmTitle="Rebuild all book covers?"
          confirmDescription="Upgrades all low-res Amazon URLs to _SX600_, re-scrapes failed covers, and re-mirrors to S3. This may take 2-5 minutes."
          onRun={handleRebuildCovers}
          buttonLabel="Rebuild Covers"
          disabled={anyRunning}
        />
      </div>
    </div>
  );
}
