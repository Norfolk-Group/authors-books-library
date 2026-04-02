/**
 * AdminPipelineTab — Data Pipeline (Run All cascade) in Admin Console
 */
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ActionCard } from "@/components/admin/ActionCard";
import { CascadeTab } from "@/components/admin/CascadeTab";
import { AUTHORS, BOOKS } from "@/lib/libraryData";
import {
  Database,
  ArrowsClockwise,
  PencilSimple,
  Books,
  ShareNetwork,
  ChartBar,
  MagicWand,
  FileText,
  Buildings,
  Briefcase,
  Queue,
  Play,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/hooks/useAdminActions";

interface AdminPipelineTabProps {
  anyRunning: boolean;
  regenerateState: ActionState;
  enrichBiosState: ActionState;
  enrichBooksState: ActionState;
  discoverPlatformsState: ActionState;
  enrichSocialStatsState: ActionState;
  enrichRichBioState: ActionState;
  enrichRichSummaryState: ActionState;
  enrichEnterpriseState: ActionState;
  enrichProfessionalState: ActionState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authorStats: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookStats: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  batchScrapeStats: any;
  getLastRun: (key: string) => {
    lastRunAt: Date | string | null;
    lastRunResult: string | null;
    lastRunDurationMs: number | null;
    lastRunItemCount: number | null;
  } | null;
  handleRegenerate: () => void | Promise<void>;
  handleEnrichBios: () => void | Promise<void>;
  handleEnrichBooks: () => void | Promise<void>;
  handleDiscoverPlatforms: () => void | Promise<void>;
  handleEnrichSocialStats: () => void | Promise<void>;
  handleEnrichRichBio: () => void | Promise<void>;
  handleEnrichRichSummary: () => void | Promise<void>;
  handleEnrichEnterprise: () => void | Promise<void>;
  handleEnrichProfessional: () => void | Promise<void>;
}

const CASCADE_STEP_LABELS = ["Regenerate DB", "Enrich Bios", "Enrich Books", "Discover Platforms"];
const CASCADE_TOTAL_STEPS = 4;

export function AdminPipelineTab({
  anyRunning,
  regenerateState,
  enrichBiosState,
  enrichBooksState,
  discoverPlatformsState,
  enrichSocialStatsState,
  enrichRichBioState,
  enrichRichSummaryState,
  enrichEnterpriseState,
  enrichProfessionalState,
  authorStats,
  bookStats,
  batchScrapeStats,
  getLastRun,
  handleRegenerate,
  handleEnrichBios,
  handleEnrichBooks,
  handleDiscoverPlatforms,
  handleEnrichSocialStats,
  handleEnrichRichBio,
  handleEnrichRichSummary,
  handleEnrichEnterprise,
  handleEnrichProfessional,
}: AdminPipelineTabProps) {
  const [cascadeRunning, setCascadeRunning] = useState(false);
  const [cascadeStep, setCascadeStep] = useState(0);

  const handleRunAllCascade = useCallback(async () => {
    if (cascadeRunning || anyRunning) return;
    setCascadeRunning(true);
    setCascadeStep(0);
    try {
      setCascadeStep(1);
      toast.info("Cascade Step 1/4: Regenerating database...");
      await handleRegenerate();

      setCascadeStep(2);
      toast.info("Cascade Step 2/4: Enriching author bios...");
      await handleEnrichBios();

      setCascadeStep(3);
      toast.info("Cascade Step 3/4: Enriching books...");
      await handleEnrichBooks();

      setCascadeStep(4);
      toast.info("Cascade Step 4/4: Discovering platforms...");
      await handleDiscoverPlatforms();

      toast.success("Full cascade pipeline completed!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Cascade failed at step ${cascadeStep}: ${msg}`);
    } finally {
      setCascadeRunning(false);
      setCascadeStep(0);
    }
  }, [cascadeRunning, anyRunning, handleRegenerate, handleEnrichBios, handleEnrichBooks, handleDiscoverPlatforms, cascadeStep]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Database className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Pipeline</h1>
          <p className="text-muted-foreground text-sm">Run cascade operations and manage data transformation workflows</p>
        </div>
        <div className="ml-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={cascadeRunning || anyRunning}
                className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md"
              >
                {cascadeRunning ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Step {cascadeStep}/{CASCADE_TOTAL_STEPS}</>
                ) : (
                  <><Play className="w-3.5 h-3.5" weight="fill" /> Run All</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Queue className="h-5 w-5 text-violet-600" weight="duotone" />
                  Run Full Cascade Pipeline?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-3">This will execute 4 operations in sequence:</span>
                  <span className="space-y-1.5 block">
                    {CASCADE_STEP_LABELS.map((label, i) => (
                      <span key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                        {label}
                      </span>
                    ))}
                  </span>
                  <span className="block mt-3 text-amber-600 dark:text-amber-400">This may take 10-30 minutes depending on library size. Do not close the browser.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRunAllCascade} className="bg-violet-600 hover:bg-violet-700">Start Cascade</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Cascade progress indicator */}
      {cascadeRunning && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
              <span className="text-sm font-medium">Cascade Pipeline Running</span>
              <Badge variant="secondary" className="ml-auto">Step {cascadeStep} of {CASCADE_TOTAL_STEPS}</Badge>
            </div>
            <div className="flex gap-1">
              {CASCADE_STEP_LABELS.map((label, i) => (
                <div key={i} className="flex-1">
                  <div className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    i + 1 < cascadeStep ? "bg-green-500" :
                    i + 1 === cascadeStep ? "bg-violet-500 animate-pulse" :
                    "bg-muted"
                  )} />
                  <span className={cn(
                    "text-[9px] mt-1 block text-center",
                    i + 1 === cascadeStep ? "text-violet-600 font-medium" : "text-muted-foreground"
                  )}>{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Regenerate Database"
          description="Re-scan Google Drive and rebuild the entire library (authors, books, audiobooks)."
          icon={ArrowsClockwise}
          actionKey="regenerate"
          state={regenerateState}
          lastRun={getLastRun("regenerate")}
          destructive
          confirmTitle="Regenerate the entire database?"
          confirmDescription="Re-scans Google Drive and rebuilds all library data. Takes 30-60 seconds and replaces existing data."
          onRun={handleRegenerate}
          buttonLabel="Regenerate"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Author Bios"
          description={`AI-powered bios for all ${AUTHORS.length} authors via Wikipedia + Perplexity.`}
          icon={PencilSimple}
          actionKey="enrich-bios"
          state={enrichBiosState}
          lastRun={getLastRun("enrich-bios")}
          destructive
          confirmTitle="Enrich all author bios?"
          confirmDescription="Calls the AI enrichment pipeline for every author. Already-enriched (within 30 days) are skipped."
          onRun={handleEnrichBios}
          buttonLabel="Enrich Bios"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich All Books"
          description={`Summaries, ratings, and metadata for all ${BOOKS.length} books via Google Books + AI.`}
          icon={Books}
          actionKey="enrich-books"
          state={enrichBooksState}
          lastRun={getLastRun("enrich-books")}
          destructive
          confirmTitle="Enrich all books?"
          confirmDescription="Calls the AI enrichment pipeline for every book. Already-enriched (within 30 days) are skipped."
          onRun={handleEnrichBooks}
          buttonLabel="Enrich Books"
          disabled={anyRunning}
        />
        <ActionCard
          title="Discover Platforms"
          description="Discover YouTube, Twitter/X, LinkedIn, Substack, Instagram, TikTok, GitHub presence for up to 20 authors."
          icon={ShareNetwork}
          actionKey="discover-platforms"
          state={discoverPlatformsState}
          lastRun={getLastRun("discover-platforms")}
          confirmTitle="Discover platform presence?"
          confirmDescription="Queries Perplexity for each author's official social profiles. Processes 20 authors per run."
          onRun={handleDiscoverPlatforms}
          buttonLabel="Discover Platforms"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Social Stats"
          description="Live stats from GitHub, Wikipedia, Substack, YouTube, LinkedIn, CNBC, Yahoo Finance, and more."
          icon={ChartBar}
          actionKey="enrich-social-stats"
          state={enrichSocialStatsState}
          lastRun={getLastRun("enrich-social-stats")}
          confirmTitle="Enrich social stats?"
          confirmDescription="Calls up to 10 external APIs per author. Processes 30 authors per run."
          onRun={handleEnrichSocialStats}
          buttonLabel="Enrich Social Stats"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Rich Author Bios"
          description="Double-pass LLM: research pass + structured bio with career entries and achievements. 10 authors per run."
          icon={MagicWand}
          actionKey="enrich-rich-bio"
          state={enrichRichBioState}
          lastRun={getLastRun("enrich-rich-bio")}
          confirmTitle="Enrich rich author bios?"
          confirmDescription="Two LLM calls per author (research + write). Authors with existing rich bios are skipped."
          onRun={handleEnrichRichBio}
          buttonLabel="Enrich Rich Bios"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Rich Book Summaries"
          description="Double-pass LLM: research pass + structured summary with themes, quotes, and similar books. 10 books per run."
          icon={FileText}
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
          title="Enrich Enterprise Impact"
          description="Search SEC EDGAR for author mentions in corporate filings, earnings calls, and annual reports."
          icon={Buildings}
          actionKey="enrich-enterprise-impact"
          state={enrichEnterpriseState}
          lastRun={getLastRun("enrich-enterprise-impact")}
          confirmTitle="Enrich enterprise impact?"
          confirmDescription="Searches SEC EDGAR for each author's mentions. Processes 20 authors per run."
          onRun={handleEnrichEnterprise}
          buttonLabel="Enrich Enterprise"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Professional Profiles"
          description="Fetch structured professional data from Wikidata: alma mater, employers, awards, board memberships."
          icon={Briefcase}
          actionKey="enrich-professional-profile"
          state={enrichProfessionalState}
          lastRun={getLastRun("enrich-professional-profile")}
          confirmTitle="Enrich professional profiles?"
          confirmDescription="Queries Wikidata for each author's professional background. Processes 20 authors per run."
          onRun={handleEnrichProfessional}
          buttonLabel="Enrich Profiles"
          disabled={anyRunning}
        />
      </div>

      <CascadeTab aStats={authorStats} bStats={bookStats} scrapeStats={batchScrapeStats} />
    </div>
  );
}
