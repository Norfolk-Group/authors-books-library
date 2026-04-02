/**
 * useAdminActions — Centralized action handlers for Admin Console
 * Extracted from Admin.tsx to reduce file size and improve maintainability.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AUTHORS, BOOKS } from "@/lib/libraryData";
import type { AppSettings } from "@/contexts/AppSettingsContext";

// -- Types ------------------------------------------------------
export type ActionStatus = "idle" | "running" | "done" | "error";

export interface ActionState {
  status: ActionStatus;
  progress: number;
  message: string;
  done: number;
  total: number;
  failed: number;
}

export const INITIAL_STATE: ActionState = {
  status: "idle",
  progress: 0,
  message: "",
  done: 0,
  total: 0,
  failed: 0,
};

export function useAdminActions(settings: AppSettings) {
  const utils = trpc.useUtils();

  // -- Action logs (last-run timestamps) --
  const actionLogsQuery = trpc.admin.getActionLogs.useQuery(undefined, { staleTime: 30_000 });
  const recordActionMutation = trpc.admin.recordAction.useMutation({
    onSuccess: () => void actionLogsQuery.refetch(),
  });

  const getLastRun = useCallback(
    (key: string) => {
      const logs = actionLogsQuery.data ?? [];
      return (
        (
          logs as Array<{
            actionKey: string;
            lastRunAt: Date | string | null;
            lastRunResult: string | null;
            lastRunDurationMs: number | null;
            lastRunItemCount: number | null;
          }>
        ).find((l) => l.actionKey === key) ?? null
      );
    },
    [actionLogsQuery.data],
  );

  // -- Mutations --
  const regenerateMutation = trpc.library.regenerate.useMutation();
  const enrichBiosMutation = trpc.authorProfiles.enrichBatch.useMutation();
  const enrichBooksMutation = trpc.bookProfiles.enrichBatch.useMutation();
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation();
  const generateAllMissingAvatarsMutation = trpc.authorProfiles.generateAllMissingAvatars.useMutation();
  const scrapeNextMutation = trpc.apify.scrapeNextMissingCover.useMutation();
  const mirrorCoversMutation = trpc.bookProfiles.mirrorCovers.useMutation();
  const mirrorAvatarsMutation = trpc.authorProfiles.mirrorAvatars.useMutation();
  const updateAllAuthorLinksMutation = trpc.authorProfiles.updateAllAuthorLinks.useMutation();
  const updateAllBookSummariesMutation = trpc.bookProfiles.updateAllBookSummaries.useMutation();
  const rebuildAllBookCoversMutation = trpc.bookProfiles.rebuildAllBookCovers.useMutation();
  const auditAvatarBackgroundsMutation = trpc.authorProfiles.auditAvatarBackgrounds.useMutation();
  const normalizeAvatarBackgroundsMutation = trpc.authorProfiles.normalizeAvatarBackgrounds.useMutation();
  const discoverPlatformsMutation = trpc.authorProfiles.discoverPlatformsBatch.useMutation();
  const enrichSocialStatsMutation = trpc.authorProfiles.enrichSocialStatsBatch.useMutation();
  const enrichRichBioMutation = trpc.authorProfiles.enrichRichBioBatch.useMutation();
  const enrichRichSummaryMutation = trpc.bookProfiles.enrichRichSummaryBatch.useMutation();
  const enrichEnterpriseBatchMutation = trpc.authorProfiles.enrichEnterpriseImpactBatch.useMutation();
  const enrichProfessionalBatchMutation = trpc.authorProfiles.enrichProfessionalProfileBatch.useMutation();

  // -- Action states --
  const [regenerateState, setRegenerateState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBiosState, setEnrichBiosState] = useState<ActionState>(INITIAL_STATE);
  const [enrichBooksState, setEnrichBooksState] = useState<ActionState>(INITIAL_STATE);
  const [portraitState, setPortraitState] = useState<ActionState>(INITIAL_STATE);
  const [scrapeState, setScrapeState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorCoversState, setMirrorCoversState] = useState<ActionState>(INITIAL_STATE);
  const [mirrorAvatarsState, setMirrorAvatarsState] = useState<ActionState>(INITIAL_STATE);
  const [updateLinksState, setUpdateLinksState] = useState<ActionState>(INITIAL_STATE);
  const [updateBookSummariesState, setUpdateBookSummariesState] = useState<ActionState>(INITIAL_STATE);
  const [auditBgState, setAuditBgState] = useState<ActionState>(INITIAL_STATE);
  const [normalizeBgState, setNormalizeBgState] = useState<ActionState>(INITIAL_STATE);
  const [bgMismatchList, setBgMismatchList] = useState<string[]>([]);
  const [rebuildCoversState, setRebuildCoversState] = useState<ActionState>(INITIAL_STATE);
  const [discoverPlatformsState, setDiscoverPlatformsState] = useState<ActionState>(INITIAL_STATE);
  const [enrichSocialStatsState, setEnrichSocialStatsState] = useState<ActionState>(INITIAL_STATE);
  const [enrichRichBioState, setEnrichRichBioState] = useState<ActionState>(INITIAL_STATE);
  const [enrichRichSummaryState, setEnrichRichSummaryState] = useState<ActionState>(INITIAL_STATE);
  const [enrichEnterpriseState, setEnrichEnterpriseState] = useState<ActionState>(INITIAL_STATE);
  const [enrichProfessionalState, setEnrichProfessionalState] = useState<ActionState>(INITIAL_STATE);

  // -- Research Cascade stats --
  const authorStats = trpc.cascade.authorStats.useQuery(undefined, { staleTime: 60_000 });
  const bookStats = trpc.cascade.bookStats.useQuery(undefined, { staleTime: 60_000 });
  const batchScrapeStats = trpc.apify.getBatchScrapeStats.useQuery(undefined, { staleTime: 60_000 });

  // -- Helpers --
  const anyRunning = [
    regenerateState,
    enrichBiosState,
    enrichBooksState,
    portraitState,
    scrapeState,
    mirrorCoversState,
    mirrorAvatarsState,
    updateLinksState,
    updateBookSummariesState,
    auditBgState,
    normalizeBgState,
    discoverPlatformsState,
    enrichSocialStatsState,
    enrichRichBioState,
    enrichRichSummaryState,
    enrichEnterpriseState,
    enrichProfessionalState,
  ].some((s) => s.status === "running");

  const recordAction = useCallback(
    async (actionKey: string, label: string, startTime: number, result: string, itemCount?: number) => {
      const durationMs = Date.now() - startTime;
      try {
        await recordActionMutation.mutateAsync({
          actionKey,
          label,
          durationMs,
          result,
          itemCount: itemCount ?? null,
        });
      } catch {
        // silently ignore logging errors
      }
    },
    [recordActionMutation],
  );

  // -- 1. Regenerate Database --
  const handleRegenerate = useCallback(async () => {
    if (regenerateState.status === "running") return;
    setRegenerateState({ ...INITIAL_STATE, status: "running", message: "Scanning Google Drive..." });
    const start = Date.now();
    try {
      const result = await regenerateMutation.mutateAsync();
      if (result.success && result.stats) {
        setRegenerateState({
          status: "done",
          progress: 100,
          message: `${result.stats.authors} authors, ${result.stats.books} books, ${result.stats.audioBooks} audiobooks`,
          done: result.stats.authors + result.stats.books,
          total: result.stats.authors + result.stats.books,
          failed: 0,
        });
        toast.success(
          `Library rebuilt - ${result.stats.authors} authors, ${result.stats.books} books (${result.stats.elapsedSeconds}s). Reload to see changes.`,
          { duration: 8000 },
        );
        await recordAction(
          "regenerate",
          "Regenerate Database",
          start,
          "success",
          result.stats.authors + result.stats.books,
        );
      } else {
        const errMsg = (result as { error?: string }).error ?? "Unknown error";
        setRegenerateState({ ...INITIAL_STATE, status: "error", message: errMsg });
        toast.error(`Regeneration failed: ${errMsg}`);
        await recordAction("regenerate", "Regenerate Database", start, `error: ${errMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRegenerateState({ ...INITIAL_STATE, status: "error", message: msg });
      toast.error(`Regeneration error: ${msg}`);
      await recordAction("regenerate", "Regenerate Database", start, `error: ${msg}`);
    }
  }, [regenerateState.status, regenerateMutation, recordAction]);

  // -- 2. Enrich All Bios --
  const handleEnrichBios = useCallback(async () => {
    if (enrichBiosState.status === "running") return;
    const names = Array.from(
      new Set(
        AUTHORS.map((a) => {
          const d = a.name.indexOf(" - ");
          return d !== -1 ? a.name.slice(0, d) : a.name;
        }),
      ),
    );
    const total = names.length;
    setEnrichBiosState({
      status: "running",
      progress: 0,
      message: `0/${total} authors`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let done = 0;
    let failed = 0;
    const batchSize = 5;
    try {
      for (let i = 0; i < names.length; i += batchSize) {
        const batch = names.slice(i, i + batchSize);
        const result = await enrichBiosMutation.mutateAsync({
          authorNames: batch,
          model: settings.authorResearchModel ?? settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.authorResearchSecondaryEnabled
            ? settings.authorResearchSecondaryModel
            : undefined,
          concurrency: settings.batchConcurrency ?? 3,
        });
        done += result.succeeded;
        failed += result.total - result.succeeded;
        const pct = Math.round(((i + batch.length) / total) * 100);
        setEnrichBiosState((s) => ({
          ...s,
          progress: pct,
          done,
          failed,
          message: `${done}/${total} authors enriched`,
        }));
      }
      setEnrichBiosState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${done} enriched, ${failed} failed`,
      }));
      toast.success(`Enriched ${done} author bios${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.authorProfiles.getAllEnrichedNames.invalidate();
      await recordAction("enrich-bios", "Enrich All Bios", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichBiosState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Bio enrichment failed: " + msg);
      await recordAction("enrich-bios", "Enrich All Bios", start, `error: ${msg}`, done);
    }
  }, [enrichBiosState.status, enrichBiosMutation, settings.geminiModel, settings.authorResearchModel, settings.primaryModel, settings.authorResearchSecondaryEnabled, settings.authorResearchSecondaryModel, settings.batchConcurrency, utils, recordAction]);

  // -- 3. Enrich All Books --
  const handleEnrichBooks = useCallback(async () => {
    if (enrichBooksState.status === "running") return;
    const books = Array.from(new Set(BOOKS.map((b) => b.name.split(" - ")[0].trim()))).map(
      (title) => {
        const match = BOOKS.find((b) => b.name.split(" - ")[0].trim() === title);
        const authorName = match
          ? match.name.includes(" - ")
            ? match.name.split(" - ").slice(1).join(" - ").trim()
            : ""
          : "";
        return { bookTitle: title, authorName };
      },
    );
    const total = books.length;
    setEnrichBooksState({
      status: "running",
      progress: 0,
      message: `0/${total} books`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let done = 0;
    let failed = 0;
    const batchSize = 5;
    try {
      for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);
        const result = await enrichBooksMutation.mutateAsync({
          books: batch,
          model: settings.bookResearchModel ?? settings.primaryModel ?? settings.geminiModel,
          secondaryModel: settings.bookResearchSecondaryEnabled
            ? settings.bookResearchSecondaryModel
            : undefined,
        });
        done += result.filter((r) => r.status === "enriched").length;
        failed += result.filter((r) => r.status === "error").length;
        const pct = Math.round(((i + batch.length) / total) * 100);
        setEnrichBooksState((s) => ({
          ...s,
          progress: pct,
          done,
          failed,
          message: `${done}/${total} books enriched`,
        }));
      }
      setEnrichBooksState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${done} enriched, ${failed} failed`,
      }));
      toast.success(`Enriched ${done} books${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("enrich-books", "Enrich All Books", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichBooksState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Book enrichment failed: " + msg);
      await recordAction("enrich-books", "Enrich All Books", start, `error: ${msg}`, done);
    }
  }, [enrichBooksState.status, enrichBooksMutation, settings.geminiModel, settings.bookResearchModel, settings.primaryModel, settings.bookResearchSecondaryEnabled, settings.bookResearchSecondaryModel, utils, recordAction]);

  // -- 4. Generate All Avatars --
  const handleGeneratePortraits = useCallback(async () => {
    if (portraitState.status === "running") return;

    setPortraitState({
      status: "running",
      progress: 0,
      message: "Starting batch generation...",
      done: 0,
      total: 0,
      failed: 0,
    });

    const start = Date.now();
    try {
      const result = await generateAllMissingAvatarsMutation.mutateAsync({
        concurrency: settings.batchConcurrency ?? 3,
        maxTier: 5,
        skipValidation: true,
        avatarGenVendor: settings.avatarGenVendor,
        avatarGenModel: settings.avatarGenModel,
        avatarResearchVendor: settings.avatarResearchVendor,
        avatarResearchModel: settings.avatarResearchModel,
        avatarBgColor: settings.avatarBgColor,
      });

      const done = result.succeeded;
      const failed = result.total - result.succeeded;

      setPortraitState({
        status: "done",
        progress: 100,
        message: `${done} generated, ${failed} failed`,
        done,
        total: result.total,
        failed,
      });

      toast.success(`Generated ${done} avatars${failed > 0 ? ` (${failed} failed)` : ""}.`);
      void utils.authorProfiles.getAvatarMap.invalidate();
      await recordAction("generate-avatars", "Generate Avatars", start, "success", done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortraitState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar generation failed: " + msg);
      await recordAction("generate-avatars", "Generate Avatars", start, `error: ${msg}`, 0);
    }
  }, [portraitState.status, generateAllMissingAvatarsMutation, settings, utils, recordAction]);

  // -- 5. Scrape All Covers --
  const handleScrapeCovers = useCallback(async () => {
    if (scrapeState.status === "running") return;
    const stats = batchScrapeStats.data;
    const total = stats?.needsScrape ?? 0;
    if (total === 0) {
      toast.info("No books need cover scraping!");
      return;
    }
    setScrapeState({
      status: "running",
      progress: 0,
      message: `0/${total} books`,
      done: 0,
      total,
      failed: 0,
    });
    const start = Date.now();
    let scraped = 0;
    try {
      for (let i = 0; i < total; i++) {
        const result = await scrapeNextMutation.mutateAsync({ mirrorBatch: 3 });
        if (result.scraped > 0) scraped++;
        const remaining = result.remainingScrape;
        const pct = Math.round(((i + 1) / total) * 100);
        setScrapeState((s) => ({
          ...s,
          progress: pct,
          done: scraped,
          message: remaining > 0 ? `${scraped} scraped - ${remaining} remaining` : `${scraped} scraped - done!`,
        }));
        if (remaining === 0) break;
      }
      setScrapeState((s) => ({
        ...s,
        status: "done",
        progress: 100,
        message: `${scraped} covers scraped`,
      }));
      toast.success(`Scraped ${scraped} book covers.`);
      void utils.apify.getBatchScrapeStats.invalidate();
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("scrape-covers", "Scrape Covers", start, "success", scraped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setScrapeState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Cover scraping failed: " + msg);
      await recordAction("scrape-covers", "Scrape Covers", start, `error: ${msg}`, scraped);
    }
  }, [scrapeState.status, scrapeNextMutation, batchScrapeStats.data, utils, recordAction]);

  // -- 6. Mirror Covers to S3 --
  const handleMirrorCovers = useCallback(async () => {
    if (mirrorCoversState.status === "running") return;
    setMirrorCoversState({ ...INITIAL_STATE, status: "running", message: "Mirroring covers..." });
    const start = Date.now();
    let totalMirrored = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const result = await mirrorCoversMutation.mutateAsync({ batchSize: 10 });
        totalMirrored += result.mirrored;
        setMirrorCoversState((s) => ({
          ...s,
          done: totalMirrored,
          message: `${totalMirrored} covers mirrored...`,
        }));
        if (result.mirrored === 0) break;
      }
      setMirrorCoversState({
        status: "done",
        progress: 100,
        message: `${totalMirrored} covers mirrored to S3`,
        done: totalMirrored,
        total: totalMirrored,
        failed: 0,
      });
      toast.success(`Mirrored ${totalMirrored} covers to S3.`);
      await recordAction("mirror-covers", "Mirror Covers to S3", start, "success", totalMirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMirrorCoversState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Mirror covers failed: " + msg);
      await recordAction("mirror-covers", "Mirror Covers to S3", start, `error: ${msg}`, totalMirrored);
    }
  }, [mirrorCoversState.status, mirrorCoversMutation, recordAction]);

  // -- 7. Rebuild All Book Covers --
  const handleRebuildCovers = useCallback(async () => {
    if (rebuildCoversState.status === "running") return;
    setRebuildCoversState({ ...INITIAL_STATE, status: "running", message: "Rebuilding book covers..." });
    const start = Date.now();
    try {
      const result = await rebuildAllBookCoversMutation.mutateAsync({
        concurrency: settings.batchConcurrency ?? 2,
        rescrapeAll: false,
      });
      const summary = `Upgraded ${result.upgraded} URLs, scraped ${result.scraped} new covers, mirrored ${result.mirrored} to S3`;
      setRebuildCoversState({
        status: "done",
        progress: 100,
        message: summary,
        done: result.mirrored,
        total: result.total,
        failed: result.mirrorFailed + result.notFound,
      });
      toast.success("Book cover rebuild complete.");
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("rebuild-covers", "Rebuild Book Covers", start, "success", result.mirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRebuildCoversState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rebuild covers failed: " + msg);
      await recordAction("rebuild-covers", "Rebuild Book Covers", start, `error: ${msg}`, 0);
    }
  }, [rebuildCoversState.status, rebuildAllBookCoversMutation, settings, utils, recordAction]);

  // -- 8. Mirror Avatars to S3 --
  const handleMirrorPhotos = useCallback(async () => {
    if (mirrorAvatarsState.status === "running") return;
    setMirrorAvatarsState({ ...INITIAL_STATE, status: "running", message: "Mirroring avatars..." });
    const start = Date.now();
    let totalMirrored = 0;
    try {
      for (let round = 0; round < 20; round++) {
        const result = await mirrorAvatarsMutation.mutateAsync({ batchSize: 10 });
        totalMirrored += result.mirrored;
        setMirrorAvatarsState((s) => ({
          ...s,
          done: totalMirrored,
          message: `${totalMirrored} avatars mirrored...`,
        }));
        if (result.mirrored === 0) break;
      }
      setMirrorAvatarsState({
        status: "done",
        progress: 100,
        message: `${totalMirrored} avatars mirrored to S3`,
        done: totalMirrored,
        total: totalMirrored,
        failed: 0,
      });
      toast.success(`Mirrored ${totalMirrored} avatars to S3.`);
      await recordAction("mirror-avatars", "Mirror Avatars to S3", start, "success", totalMirrored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMirrorAvatarsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Mirror avatars failed: " + msg);
      await recordAction("mirror-avatars", "Mirror Avatars to S3", start, `error: ${msg}`, totalMirrored);
    }
  }, [mirrorAvatarsState.status, mirrorAvatarsMutation, recordAction]);

  // -- 9. Update All Author Links --
  const handleUpdateAllAuthorLinks = useCallback(async () => {
    if (updateLinksState.status === "running") return;
    setUpdateLinksState({ ...INITIAL_STATE, status: "running", message: "Starting author links update..." });
    const start = Date.now();
    try {
      const result = await updateAllAuthorLinksMutation.mutateAsync({
        researchVendor: settings.authorResearchVendor,
        researchModel: settings.authorResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setUpdateLinksState({
        status: "done",
        progress: 100,
        message: `${result.enriched} authors updated, ${result.failed} failed`,
        done: result.enriched,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Author links updated: ${result.enriched} authors processed.`);
      void utils.authorProfiles.get.invalidate();
      await recordAction("update-author-links", "Update All Author Links", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateLinksState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Author links update failed: " + msg);
      await recordAction("update-author-links", "Update All Author Links", start, `error: ${msg}`);
    }
  }, [updateLinksState.status, updateAllAuthorLinksMutation, settings, utils, recordAction]);

  // -- 10. Update All Book Summaries --
  const handleUpdateAllBookSummaries = useCallback(async () => {
    if (updateBookSummariesState.status === "running") return;
    setUpdateBookSummariesState({ ...INITIAL_STATE, status: "running", message: "Starting book summaries update..." });
    const start = Date.now();
    try {
      const result = await updateAllBookSummariesMutation.mutateAsync({
        researchVendor: settings.bookResearchVendor,
        researchModel: settings.bookResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setUpdateBookSummariesState({
        status: "done",
        progress: 100,
        message: `${result.enriched} books updated, ${result.failed} failed`,
        done: result.enriched,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Book summaries updated: ${result.enriched} books processed.`);
      void utils.bookProfiles.getMany.invalidate();
      await recordAction("update-book-summaries", "Update All Book Summaries", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateBookSummariesState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Book summaries update failed: " + msg);
      await recordAction("update-book-summaries", "Update All Book Summaries", start, `error: ${msg}`);
    }
  }, [updateBookSummariesState.status, updateAllBookSummariesMutation, settings, utils, recordAction]);

  // -- 11. Audit Avatar Backgrounds --
  const handleAuditAvatarBackgrounds = useCallback(async () => {
    if (auditBgState.status === "running") return;
    setAuditBgState({ ...INITIAL_STATE, status: "running", message: "Scanning avatars with Gemini Vision..." });
    setBgMismatchList([]);
    const start = Date.now();
    try {
      const result = await auditAvatarBackgroundsMutation.mutateAsync({
        targetBgDescription: "bokeh-gold warm golden bokeh with amber and cream light orbs",
      });
      setBgMismatchList(result.mismatch ?? []);
      setAuditBgState({
        status: "done",
        progress: 100,
        message: `${result.audited} audited, ${result.mismatch.length} need normalization`,
        done: result.audited - result.mismatch.length,
        total: result.audited,
        failed: result.mismatch.length,
      });
      if (result.mismatch.length === 0) {
        toast.success("All avatars already have the canonical bokeh-gold background!");
      } else {
        toast.info(`${result.mismatch.length} avatars need background normalization.`);
      }
      await recordAction("audit-avatar-backgrounds", "Audit Avatar Backgrounds", start, "success", result.audited);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuditBgState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar background audit failed: " + msg);
      await recordAction("audit-avatar-backgrounds", "Audit Avatar Backgrounds", start, `error: ${msg}`);
    }
  }, [auditBgState.status, auditAvatarBackgroundsMutation, recordAction]);

  // -- 12. Normalize Avatar Backgrounds --
  const handleNormalizeAvatarBackgrounds = useCallback(async () => {
    if (normalizeBgState.status === "running") return;
    const targets = bgMismatchList.length > 0 ? bgMismatchList : [];
    if (targets.length === 0) {
      toast.info("Run the audit first to identify which avatars need normalization.");
      return;
    }
    setNormalizeBgState({ ...INITIAL_STATE, status: "running", message: `Normalizing ${targets.length} avatars...`, total: targets.length });
    const start = Date.now();
    try {
      const result = await normalizeAvatarBackgroundsMutation.mutateAsync({
        authorNames: targets,
        bgColor: settings.avatarBgColor ?? "#c8960c",
        avatarGenVendor: settings.avatarGenVendor,
        avatarGenModel: settings.avatarGenModel,
        avatarResearchVendor: settings.avatarResearchVendor,
        avatarResearchModel: settings.avatarResearchModel,
        concurrency: settings.batchConcurrency ?? 3,
      });
      setNormalizeBgState({
        status: "done",
        progress: 100,
        message: `${result.normalized} normalized, ${result.failed} failed`,
        done: result.normalized,
        total: result.total,
        failed: result.failed,
      });
      toast.success(`Normalized ${result.normalized} avatar backgrounds.`);
      void utils.authorProfiles.getAvatarMap.invalidate();
      await recordAction("normalize-avatar-backgrounds", "Normalize Avatar Backgrounds", start, "success", result.normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNormalizeBgState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Avatar normalization failed: " + msg);
      await recordAction("normalize-avatar-backgrounds", "Normalize Avatar Backgrounds", start, `error: ${msg}`);
    }
  }, [normalizeBgState.status, normalizeAvatarBackgroundsMutation, bgMismatchList, settings, utils, recordAction]);

  // -- 13. Discover Author Platforms --
  const handleDiscoverPlatforms = useCallback(async () => {
    if (discoverPlatformsState.status === "running") return;
    setDiscoverPlatformsState({ ...INITIAL_STATE, status: "running", message: "Discovering platform presence for authors..." });
    const start = Date.now();
    try {
      const result = await discoverPlatformsMutation.mutateAsync({ limit: 20 });
      setDiscoverPlatformsState({
        status: "done",
        progress: 100,
        message: `${result.succeeded} authors enriched, ${result.failed} failed`,
        done: result.succeeded,
        total: result.processed,
        failed: result.failed,
      });
      toast.success(`Discovered platforms for ${result.succeeded} authors.`);
      await recordAction("discover-platforms", "Discover Author Platforms", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiscoverPlatformsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Platform discovery failed: " + msg);
      await recordAction("discover-platforms", "Discover Author Platforms", start, `error: ${msg}`);
    }
  }, [discoverPlatformsState.status, discoverPlatformsMutation, recordAction]);

  // -- 14. Enrich Social Stats --
  const handleEnrichSocialStats = useCallback(async () => {
    if (enrichSocialStatsState.status === "running") return;
    setEnrichSocialStatsState({ ...INITIAL_STATE, status: "running", message: "Fetching social stats from GitHub, Wikipedia, Substack, YouTube, CNN, Y Combinator..." });
    const start = Date.now();
    try {
      const result = await enrichSocialStatsMutation.mutateAsync({
        phases: ["A", "B"],
        limit: 30,
        onlyMissing: true,
      });
      setEnrichSocialStatsState({
        status: "done",
        progress: 100,
        message: `${result.succeeded} authors enriched, ${result.failed} failed`,
        done: result.succeeded,
        total: result.processed,
        failed: result.failed,
      });
      toast.success(`Social stats enriched for ${result.succeeded} authors.`);
      await recordAction("enrich-social-stats", "Enrich Social Stats", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichSocialStatsState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Social stats enrichment failed: " + msg);
      await recordAction("enrich-social-stats", "Enrich Social Stats", start, `error: ${msg}`);
    }
  }, [enrichSocialStatsState.status, enrichSocialStatsMutation, recordAction]);

  // -- 15. Enrich Rich Bio (double-pass LLM) --
  const handleEnrichRichBio = useCallback(async () => {
    if (enrichRichBioState.status === "running") return;
    const start = Date.now();
    setEnrichRichBioState({ status: "running", progress: 0, message: "Running double-pass LLM bio enrichment…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichRichBioMutation.mutateAsync({ limit: 10, forceAll: false });
      setEnrichRichBioState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} author bios`, done: result.succeeded, total: result.succeeded + result.failed, failed: result.failed });
      toast.success(`Rich bio enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-rich-bio", "Enrich Rich Bios", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichRichBioState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rich bio enrichment failed: " + msg);
      await recordAction("enrich-rich-bio", "Enrich Rich Bios", start, `error: ${msg}`);
    }
  }, [enrichRichBioState.status, enrichRichBioMutation, recordAction]);

  // -- 16. Enrich Rich Summary (double-pass LLM for books) --
  const handleEnrichRichSummary = useCallback(async () => {
    if (enrichRichSummaryState.status === "running") return;
    const start = Date.now();
    setEnrichRichSummaryState({ status: "running", progress: 0, message: "Running double-pass book summary enrichment…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichRichSummaryMutation.mutateAsync({ limit: 10, force: false });
      setEnrichRichSummaryState({ status: "done", progress: 100, message: `Enriched ${result.enriched} book summaries`, done: result.enriched, total: result.total, failed: result.failed });
      toast.success(`Rich summary enrichment complete: ${result.enriched} books`);
      await recordAction("enrich-rich-summary", "Enrich Rich Summaries", start, "success", result.enriched);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichRichSummaryState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Rich summary enrichment failed: " + msg);
      await recordAction("enrich-rich-summary", "Enrich Rich Summaries", start, `error: ${msg}`);
    }
  }, [enrichRichSummaryState.status, enrichRichSummaryMutation, recordAction]);

  // -- 17. Enrich Enterprise Impact (SEC EDGAR + Quartr) --
  const handleEnrichEnterprise = useCallback(async () => {
    if (enrichEnterpriseState.status === "running") return;
    const start = Date.now();
    setEnrichEnterpriseState({ status: "running", progress: 0, message: "Searching SEC EDGAR for author mentions in filings…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichEnterpriseBatchMutation.mutateAsync({ limit: 20, onlyMissing: true });
      setEnrichEnterpriseState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} authors`, done: result.succeeded, total: result.processed, failed: result.failed });
      toast.success(`Enterprise impact enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-enterprise-impact", "Enrich Enterprise Impact", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichEnterpriseState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Enterprise impact enrichment failed: " + msg);
      await recordAction("enrich-enterprise-impact", "Enrich Enterprise Impact", start, `error: ${msg}`);
    }
  }, [enrichEnterpriseState.status, enrichEnterpriseBatchMutation, recordAction]);

  // -- 18. Enrich Professional Profiles (Wikidata + Apollo) --
  const handleEnrichProfessional = useCallback(async () => {
    if (enrichProfessionalState.status === "running") return;
    const start = Date.now();
    setEnrichProfessionalState({ status: "running", progress: 0, message: "Fetching professional data from Wikidata…", done: 0, total: 0, failed: 0 });
    try {
      const result = await enrichProfessionalBatchMutation.mutateAsync({ limit: 20, onlyMissing: true });
      setEnrichProfessionalState({ status: "done", progress: 100, message: `Enriched ${result.succeeded} authors`, done: result.succeeded, total: result.processed, failed: result.failed });
      toast.success(`Professional profile enrichment complete: ${result.succeeded} authors`);
      await recordAction("enrich-professional-profile", "Enrich Professional Profiles", start, "success", result.succeeded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEnrichProfessionalState((s) => ({ ...s, status: "error", message: msg }));
      toast.error("Professional profile enrichment failed: " + msg);
      await recordAction("enrich-professional-profile", "Enrich Professional Profiles", start, `error: ${msg}`);
    }
  }, [enrichProfessionalState.status, enrichProfessionalBatchMutation, recordAction]);

  return {
    // State
    regenerateState,
    enrichBiosState,
    enrichBooksState,
    portraitState,
    scrapeState,
    mirrorCoversState,
    mirrorAvatarsState,
    updateLinksState,
    updateBookSummariesState,
    auditBgState,
    normalizeBgState,
    bgMismatchList,
    rebuildCoversState,
    discoverPlatformsState,
    enrichSocialStatsState,
    enrichRichBioState,
    enrichRichSummaryState,
    enrichEnterpriseState,
    enrichProfessionalState,
    anyRunning,
    // Stats
    authorStats: authorStats.data,
    bookStats: bookStats.data,
    batchScrapeStats: batchScrapeStats.data,
    // Handlers
    handleRegenerate,
    handleEnrichBios,
    handleEnrichBooks,
    handleGeneratePortraits,
    handleScrapeCovers,
    handleMirrorCovers,
    handleRebuildCovers,
    handleMirrorPhotos,
    handleUpdateAllAuthorLinks,
    handleUpdateAllBookSummaries,
    handleAuditAvatarBackgrounds,
    handleNormalizeAvatarBackgrounds,
    handleDiscoverPlatforms,
    handleEnrichSocialStats,
    handleEnrichRichBio,
    handleEnrichRichSummary,
    handleEnrichEnterprise,
    handleEnrichProfessional,
    // Utilities
    getLastRun,
  };
}
