/**
 * GroupContrast
 *
 * Select 2–5 authors and one interest topic, then run a Claude Opus
 * comparative analysis across their RAG files.
 *
 * Features:
 *   - Multi-select author picker (only shows authors with ready RAG files)
 *   - Interest selector
 *   - Streaming-style display of the analysis using Streamdown
 *   - Save analysis to clipboard or navigate to individual author profiles
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, GitCompare, X, Copy, Check, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { getLoginUrl } from "@/const";

export default function GroupContrast() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedInterestId, setSelectedInterestId] = useState<string>("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const interestsQuery = trpc.userInterests.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const ragQuery = trpc.ragPipeline.getAllStatuses.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const compareMutation = trpc.userInterests.compareAuthors.useMutation({
    onSuccess: (data: { analysis: string; authorsWithRag: string[] }) => {
      setAnalysis(data.analysis);
      if (data.authorsWithRag.length < selectedAuthors.length) {
        const missing = selectedAuthors.filter((a) => !data.authorsWithRag.includes(a));
        toast.warning(`No RAG file for: ${missing.join(", ")}. Analysis used available authors.`);
      }
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const interests = interestsQuery.data ?? [];
  const ragProfiles = ragQuery.data ?? [];

  const readyAuthors = useMemo(() =>
    ragProfiles
      .filter((r: { ragStatus: string; authorName: string }) => r.ragStatus === "ready")
      .map((r: { ragStatus: string; authorName: string }) => r.authorName)
      .sort((a: string, b: string) => a.localeCompare(b)),
    [ragProfiles]
  );

  const toggleAuthor = (name: string) => {
    setSelectedAuthors((prev) => {
      if (prev.includes(name)) return prev.filter((a) => a !== name);
      if (prev.length >= 5) { toast.warning("Maximum 5 authors for comparison"); return prev; }
      return [...prev, name];
    });
    setAnalysis(null);
  };

  const handleCompare = () => {
    if (selectedAuthors.length < 2) { toast.error("Select at least 2 authors"); return; }
    if (!selectedInterestId) { toast.error("Select an interest topic"); return; }
    setAnalysis(null);
    compareMutation.mutate({
      authorNames: selectedAuthors,
      interestId: parseInt(selectedInterestId, 10),
    });
  };

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Sign in to compare authors.</p>
        <Button asChild><a href={getLoginUrl()}>Sign In</a></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            ← Library
          </Link>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-primary" />
            <h1 className="font-semibold text-foreground">Group Author Contrast</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Setup panel */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-foreground mb-1">Select Authors (2–5)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Only authors with a ready Digital Me file are available.
            </p>
            {readyAuthors.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No authors with ready RAG files yet. Go to{" "}
                <Link href="/admin" className="underline text-primary">Admin → Digital Me</Link> to generate them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {readyAuthors.map((name: string) => {
                  const isSelected = selectedAuthors.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleAuthor(name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-foreground border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <User className="w-3 h-3" />
                      {name}
                      {isSelected && <X className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedAuthors.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Selected:</span>
                {selectedAuthors.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name}
                    <button onClick={() => toggleAuthor(name)} className="hover:text-destructive">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Interest selector */}
          <div>
            <h2 className="font-semibold text-foreground mb-1">Select Interest Topic</h2>
            <p className="text-sm text-muted-foreground mb-3">
              The analysis will compare how each author approaches this topic.
            </p>
            {interests.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No interests defined. Go to{" "}
                <Link href="/admin" className="underline text-primary">Admin → My Interests</Link> to add topics.
              </p>
            ) : (
              <Select value={selectedInterestId} onValueChange={(v) => { setSelectedInterestId(v); setAnalysis(null); }}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose an interest..." />
                </SelectTrigger>
                <SelectContent>
                  {interests.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: i.color ?? "#6366F1" }}
                        />
                        {i.topic}
                        {i.category && (
                          <span className="text-muted-foreground text-xs">({i.category})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Run button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleCompare}
              disabled={
                compareMutation.isPending ||
                selectedAuthors.length < 2 ||
                !selectedInterestId
              }
              className="gap-2"
            >
              {compareMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Analyzing with Claude Opus...</>
              ) : (
                <><Sparkles className="w-4 h-4" />Compare Authors</>
              )}
            </Button>
            {selectedAuthors.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedAuthors.length} author{selectedAuthors.length > 1 ? "s" : ""} selected
                {selectedAuthors.length < 2 && " (need at least 2)"}
              </span>
            )}
          </div>
        </div>

        {/* Analysis result */}
        {compareMutation.isPending && (
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Claude Opus is reading each author's Digital Me file and synthesizing a comparative analysis...
            </p>
            <p className="text-xs text-muted-foreground">This typically takes 15–30 seconds</p>
          </div>
        )}

        {analysis && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Analysis header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground text-sm">
                  Comparative Analysis
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {selectedAuthors.join(" vs. ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={handleCopy}>
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            {/* Analysis content */}
            <div className="px-6 py-5 prose prose-sm dark:prose-invert max-w-none">
              <Streamdown>{analysis}</Streamdown>
            </div>
            {/* Author links */}
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">View profiles:</span>
              {selectedAuthors.map((name) => (
                <Link
                  key={name}
                  href={`/author/${encodeURIComponent(name)}`}
                  className="text-xs text-primary hover:underline no-underline"
                >
                  {name}
                </Link>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">Powered by Claude Opus</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
