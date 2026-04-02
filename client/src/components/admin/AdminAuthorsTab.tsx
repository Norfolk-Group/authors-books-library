/**
 * AdminAuthorsTab — Author management operations in Admin Console
 */
import { Badge } from "@/components/ui/badge";
import { ActionCard } from "@/components/admin/ActionCard";
import { AUTHORS } from "@/lib/libraryData";
import {
  PencilSimple,
  Camera,
  CloudArrowUp,
  MagicWand,
  ShareNetwork,
  ChartBar,
  Buildings,
  Briefcase,
  Palette,
  Sparkle,
  Link,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import type { ActionState } from "@/hooks/useAdminActions";

interface AdminAuthorsTabProps {
  anyRunning: boolean;
  enrichBiosState: ActionState;
  portraitState: ActionState;
  mirrorAvatarsState: ActionState;
  auditBgState: ActionState;
  normalizeBgState: ActionState;
  updateLinksState: ActionState;
  enrichRichBioState: ActionState;
  discoverPlatformsState: ActionState;
  enrichSocialStatsState: ActionState;
  enrichEnterpriseState: ActionState;
  enrichProfessionalState: ActionState;
  bgMismatchList: string[];
  getLastRun: (key: string) => {
    lastRunAt: Date | string | null;
    lastRunResult: string | null;
    lastRunDurationMs: number | null;
    lastRunItemCount: number | null;
  } | null;
  handleEnrichBios: () => void;
  handleGeneratePortraits: () => void;
  handleMirrorPhotos: () => void;
  handleAuditAvatarBackgrounds: () => void;
  handleNormalizeAvatarBackgrounds: () => void;
  handleUpdateAllAuthorLinks: () => void;
  handleEnrichRichBio: () => void;
  handleDiscoverPlatforms: () => void;
  handleEnrichSocialStats: () => void;
  handleEnrichEnterprise: () => void;
  handleEnrichProfessional: () => void;
}

export function AdminAuthorsTab({
  anyRunning,
  enrichBiosState,
  portraitState,
  mirrorAvatarsState,
  auditBgState,
  normalizeBgState,
  updateLinksState,
  enrichRichBioState,
  discoverPlatformsState,
  enrichSocialStatsState,
  enrichEnterpriseState,
  enrichProfessionalState,
  bgMismatchList,
  getLastRun,
  handleEnrichBios,
  handleGeneratePortraits,
  handleMirrorPhotos,
  handleAuditAvatarBackgrounds,
  handleNormalizeAvatarBackgrounds,
  handleUpdateAllAuthorLinks,
  handleEnrichRichBio,
  handleDiscoverPlatforms,
  handleEnrichSocialStats,
  handleEnrichEnterprise,
  handleEnrichProfessional,
}: AdminAuthorsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <UsersThree className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Authors</h1>
          <p className="text-muted-foreground text-sm">Manage author profiles, enrich bios, and generate AI portraits</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{AUTHORS.length} authors</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Enrich Author Bios"
          description={`AI-powered bios for all ${AUTHORS.length} authors via Wikipedia + Perplexity. Already-enriched (30 days) are skipped.`}
          icon={PencilSimple}
          actionKey="enrich-bios"
          state={enrichBiosState}
          lastRun={getLastRun("enrich-bios")}
          destructive
          confirmTitle="Enrich all author bios?"
          confirmDescription="This will call the AI enrichment pipeline for every author. Already-enriched authors (within 30 days) will be skipped."
          onRun={handleEnrichBios}
          buttonLabel="Enrich Bios"
          disabled={anyRunning}
        />
        <ActionCard
          title="Update Author Links"
          description="Research and update website, social media, podcast, blog, Substack, and newspaper links for all authors."
          icon={Link}
          actionKey="update-author-links"
          state={updateLinksState}
          lastRun={getLastRun("update-author-links")}
          destructive
          confirmTitle="Update all author links?"
          confirmDescription="This will research and update links for all authors missing link data. Uses Perplexity web search."
          onRun={handleUpdateAllAuthorLinks}
          buttonLabel="Update Links"
          disabled={anyRunning}
        />
        <ActionCard
          title="Generate AI Portraits"
          description="Use AI (Replicate Flux) to generate professional headshots for authors without an avatar."
          icon={Camera}
          actionKey="generate-avatars"
          state={portraitState}
          lastRun={getLastRun("generate-avatars")}
          destructive
          confirmTitle="Generate AI avatars?"
          confirmDescription="This will generate AI avatars for all authors missing an avatar. Each avatar takes 5-15 seconds."
          onRun={handleGeneratePortraits}
          buttonLabel="Generate Portraits"
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
          title="Enrich Rich Bios"
          description="Double-pass LLM enrichment: research pass + structured bio with career entries and achievements. Processes 10 authors per run."
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
          title="Discover Platforms"
          description="Discover YouTube, Twitter/X, LinkedIn, Substack, Instagram, TikTok, GitHub presence for up to 20 authors."
          icon={ShareNetwork}
          actionKey="discover-platforms"
          state={discoverPlatformsState}
          lastRun={getLastRun("discover-platforms")}
          confirmTitle="Discover platform presence?"
          confirmDescription="Queries Perplexity for each author's social profiles. Processes 20 authors per run."
          onRun={handleDiscoverPlatforms}
          buttonLabel="Discover Platforms"
          disabled={anyRunning}
        />
        <ActionCard
          title="Enrich Social Stats"
          description="Fetch live stats from GitHub, Wikipedia, Substack, YouTube, LinkedIn, and more."
          icon={ChartBar}
          actionKey="enrich-social-stats"
          state={enrichSocialStatsState}
          lastRun={getLastRun("enrich-social-stats")}
          confirmTitle="Enrich social stats?"
          confirmDescription="Calls up to 10 external APIs per author. Processes 30 authors per run."
          onRun={handleEnrichSocialStats}
          buttonLabel="Enrich Stats"
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
          confirmDescription="Searches SEC EDGAR for each author's mentions in corporate filings. Processes 20 authors per run."
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
        <ActionCard
          title="Audit Avatar Backgrounds"
          description="Use Gemini Vision to scan all author avatars and identify non-standard backgrounds. Run before Normalize."
          icon={Palette}
          actionKey="audit-avatar-backgrounds"
          state={auditBgState}
          lastRun={getLastRun("audit-avatar-backgrounds")}
          onRun={handleAuditAvatarBackgrounds}
          buttonLabel="Audit Backgrounds"
          disabled={anyRunning}
        />
        {bgMismatchList.length > 0 && (
          <div className="col-span-full px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">{bgMismatchList.length} avatars need background normalization</p>
            <p className="text-amber-700 dark:text-amber-400 line-clamp-2 font-mono text-xs">{bgMismatchList.join(", ")}</p>
          </div>
        )}
        <ActionCard
          title="Normalize Avatar Backgrounds"
          description={`Re-generate avatars for ${bgMismatchList.length > 0 ? bgMismatchList.length + " queued authors" : "authors identified by audit"} using the current background color.`}
          icon={Sparkle}
          actionKey="normalize-avatar-backgrounds"
          state={normalizeBgState}
          lastRun={getLastRun("normalize-avatar-backgrounds")}
          destructive
          confirmTitle="Normalize all avatar backgrounds?"
          confirmDescription={`Re-generates AI avatars for ${bgMismatchList.length} authors. Each takes 10-30 seconds. Run audit first.`}
          onRun={handleNormalizeAvatarBackgrounds}
          buttonLabel="Normalize All"
          disabled={anyRunning || bgMismatchList.length === 0}
        />
      </div>
    </div>
  );
}
