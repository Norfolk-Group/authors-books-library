/**
 * AdminMediaTab — Media asset operations in Admin Console
 */
import { Card } from "@/components/ui/card";
import { ActionCard } from "@/components/admin/ActionCard";
import {
  Camera,
  CloudArrowUp,
  Palette,
  Sparkle,
  ImageSquare,
  ArrowsClockwise,
  Image,
  XCircle,
} from "@phosphor-icons/react";
import type { ActionState } from "@/hooks/useAdminActions";

interface AdminMediaTabProps {
  anyRunning: boolean;
  portraitState: ActionState;
  mirrorAvatarsState: ActionState;
  auditBgState: ActionState;
  normalizeBgState: ActionState;
  scrapeState: ActionState;
  mirrorCoversState: ActionState;
  rebuildCoversState: ActionState;
  bgMismatchList: string[];
  batchScrapeStats: { needsScrape: number } | undefined;
  getLastRun: (key: string) => {
    lastRunAt: Date | string | null;
    lastRunResult: string | null;
    lastRunDurationMs: number | null;
    lastRunItemCount: number | null;
  } | null;
  handleGeneratePortraits: () => void;
  handleMirrorPhotos: () => void;
  handleAuditAvatarBackgrounds: () => void;
  handleNormalizeAvatarBackgrounds: () => void;
  handleScrapeCovers: () => void;
  handleMirrorCovers: () => void;
  handleRebuildCovers: () => void;
}

export function AdminMediaTab({
  anyRunning,
  portraitState,
  mirrorAvatarsState,
  auditBgState,
  normalizeBgState,
  scrapeState,
  mirrorCoversState,
  rebuildCoversState,
  bgMismatchList,
  batchScrapeStats,
  getLastRun,
  handleGeneratePortraits,
  handleMirrorPhotos,
  handleAuditAvatarBackgrounds,
  handleNormalizeAvatarBackgrounds,
  handleScrapeCovers,
  handleMirrorCovers,
  handleRebuildCovers,
}: AdminMediaTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Image className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Media Assets</h1>
          <p className="text-muted-foreground text-sm">Manage images, avatars, and media file operations</p>
        </div>
      </div>

      {bgMismatchList.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/5 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-orange-500 mt-0.5" weight="duotone" />
            <div>
              <p className="font-medium text-orange-700 dark:text-orange-400">Background Mismatches Detected</p>
              <p className="text-sm text-muted-foreground mt-1">{bgMismatchList.length} avatar(s) have non-standard backgrounds</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Generate Missing Avatars"
          description="Use AI (Replicate Flux) to generate professional headshots for authors without an avatar."
          icon={Camera}
          actionKey="generate-avatars"
          state={portraitState}
          lastRun={getLastRun("generate-avatars")}
          destructive
          confirmTitle="Generate AI avatars?"
          confirmDescription="Generates AI avatars for all authors missing one. Each takes 5-15 seconds."
          onRun={handleGeneratePortraits}
          buttonLabel="Generate Avatars"
          disabled={anyRunning}
        />
        <ActionCard
          title="Mirror Avatars to CDN"
          description="Copy external author avatar URLs to the S3 CDN for stable hosting."
          icon={CloudArrowUp}
          actionKey="mirror-avatars"
          state={mirrorAvatarsState}
          lastRun={getLastRun("mirror-avatars")}
          onRun={handleMirrorPhotos}
          buttonLabel="Mirror Avatars"
          disabled={anyRunning}
        />
        <ActionCard
          title="Audit Avatar Backgrounds"
          description="Use Gemini Vision to scan all avatars and detect non-standard background colors."
          icon={Palette}
          actionKey="audit-avatar-backgrounds"
          state={auditBgState}
          lastRun={getLastRun("audit-avatar-backgrounds")}
          onRun={handleAuditAvatarBackgrounds}
          buttonLabel="Audit Backgrounds"
          disabled={anyRunning}
        />
        <ActionCard
          title="Normalize Avatar Backgrounds"
          description={`Standardize all avatar backgrounds to the default color scheme. ${bgMismatchList.length > 0 ? bgMismatchList.length + " queued." : "Run audit first."}`}
          icon={Sparkle}
          actionKey="normalize-avatar-backgrounds"
          state={normalizeBgState}
          lastRun={getLastRun("normalize-avatar-backgrounds")}
          destructive
          confirmTitle="Normalize all backgrounds?"
          confirmDescription={`Re-generates AI avatars for ${bgMismatchList.length} authors. Run audit first.`}
          onRun={handleNormalizeAvatarBackgrounds}
          buttonLabel="Normalize All"
          disabled={anyRunning || bgMismatchList.length === 0}
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
          confirmDescription="Upgrades all low-res Amazon URLs to _SX600_, re-scrapes failed covers, and re-mirrors to S3. Takes 2-5 minutes."
          onRun={handleRebuildCovers}
          buttonLabel="Rebuild Covers"
          disabled={anyRunning}
        />
      </div>
    </div>
  );
}
