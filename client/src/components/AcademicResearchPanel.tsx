/**
 * AcademicResearchPanel — Displays an author's academic research profile
 * sourced from OpenAlex / Semantic Scholar.
 *
 * Shows: h-index, citation count, works count, affiliations, top papers,
 * and book-related papers with DOI links.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  BookOpen,
  Quote,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  RefreshCw,
  FileText,
} from "lucide-react";

interface AcademicAuthorProfile {
  source: "openalex" | "semantic_scholar";
  authorId: string;
  name: string;
  affiliations: string[];
  hIndex: number;
  i10Index: number;
  citationCount: number;
  worksCount: number;
  orcid: string | null;
}

interface AcademicPaper {
  source: string;
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  doi: string | null;
  isOpenAccess: boolean;
  pdfUrl: string | null;
  journal: string | null;
  type: string | null;
  authors: string[];
}

interface AcademicEnrichmentResult {
  authorProfile: AcademicAuthorProfile | null;
  topPapers: AcademicPaper[];
  bookRelatedPapers: AcademicPaper[];
  fetchedAt: string;
  error?: string;
}

interface Props {
  authorName: string;
  isAdmin?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function PaperRow({ paper }: { paper: AcademicPaper }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2">
            {paper.title}
          </span>
          {paper.isOpenAccess && (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-green-500/40 text-green-600">
              OA
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {paper.year && <span>{paper.year}</span>}
          {paper.journal && (
            <>
              <span className="text-border">·</span>
              <span className="truncate max-w-[200px]">{paper.journal}</span>
            </>
          )}
          <span className="text-border">·</span>
          <span>{formatNumber(paper.citationCount)} citations</span>
          {paper.doi && (
            <>
              <span className="text-border">·</span>
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                DOI <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
          {paper.pdfUrl && (
            <>
              <span className="text-border">·</span>
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                PDF <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcademicResearchPanel({ authorName, isAdmin }: Props) {
  const [showAllPapers, setShowAllPapers] = useState(false);

  const { data, isLoading } = trpc.authorProfiles.getAcademicResearch.useQuery(
    { authorName },
    { enabled: !!authorName }
  );

  const enrichMutation = trpc.authorProfiles.enrichAcademicResearch.useMutation({
    onSuccess: () => {
      utils.authorProfiles.getAcademicResearch.invalidate({ authorName });
    },
  });
  const utils = trpc.useUtils();

  const research: AcademicEnrichmentResult | null = useMemo(() => {
    if (!data?.data) return null;
    return data.data as AcademicEnrichmentResult;
  }, [data]);

  if (isLoading) {
    return (
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Research Foundation
        </h2>
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm animate-pulse">
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      </section>
    );
  }

  // Show enrich button for admin if no data
  if (!research) {
    if (!isAdmin) return null;
    return (
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Research Foundation
        </h2>
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
          <p className="text-sm text-muted-foreground mb-3">
            No academic research data yet.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => enrichMutation.mutate({ authorName })}
            disabled={enrichMutation.isPending}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${enrichMutation.isPending ? "animate-spin" : ""}`} />
            {enrichMutation.isPending ? "Fetching..." : "Fetch Academic Profile"}
          </Button>
        </div>
      </section>
    );
  }

  const profile = research.authorProfile;
  const topPapers = research.topPapers ?? [];
  const bookPapers = research.bookRelatedPapers ?? [];
  const visiblePapers = showAllPapers ? topPapers : topPapers.slice(0, 5);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Research Foundation
        </h2>
        {isAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => enrichMutation.mutate({ authorName })}
            disabled={enrichMutation.isPending}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${enrichMutation.isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        {/* ── Metrics Row ── */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <GraduationCap className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{profile.hIndex}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">h-index</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <Quote className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{formatNumber(profile.citationCount)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Citations</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{formatNumber(profile.worksCount)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Publications</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <FileText className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{profile.i10Index}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">i10-index</div>
            </div>
          </div>
        )}

        {/* ── Affiliations ── */}
        {profile && profile.affiliations.length > 0 && (
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {profile.affiliations.map((aff) => (
                <Badge key={aff} variant="secondary" className="text-xs">
                  {aff}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── ORCID ── */}
        {profile?.orcid && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">ORCID:</span>
            <a
              href={`https://orcid.org/${profile.orcid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              {profile.orcid} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* ── Top Papers ── */}
        {topPapers.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Most-Cited Publications ({topPapers.length})
            </h3>
            <div className="divide-y divide-border/50">
              {visiblePapers.map((paper) => (
                <PaperRow key={paper.paperId} paper={paper} />
              ))}
            </div>
            {topPapers.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => setShowAllPapers(!showAllPapers)}
              >
                {showAllPapers ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" /> Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" /> Show All {topPapers.length} Papers
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* ── Book-Related Papers ── */}
        {bookPapers.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Research Behind the Books ({bookPapers.length})
            </h3>
            <div className="divide-y divide-border/50">
              {bookPapers.slice(0, 5).map((paper) => (
                <PaperRow key={paper.paperId} paper={paper} />
              ))}
            </div>
          </div>
        )}

        {/* ── Source Attribution ── */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50">
          <span>
            Source: {profile?.source === "openalex" ? "OpenAlex" : "Semantic Scholar"}
          </span>
          {research.fetchedAt && (
            <span>
              Updated: {new Date(research.fetchedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
