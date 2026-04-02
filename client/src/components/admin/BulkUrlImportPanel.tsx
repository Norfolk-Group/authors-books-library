/**
 * BulkUrlImportPanel — Admin panel for bulk-importing content items from URLs.
 * Supports YouTube videos/channels (via YouTube Data API) and generic URLs
 * (via LLM enrichment). Podcast episodes are searched via iTunes Search API.
 *
 * Usage: paste one URL per line, click "Import All".
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Link,
  Youtube,
  Mic,
  Globe,
  Upload,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type UrlStatus = "pending" | "processing" | "success" | "error";

interface UrlEntry {
  url: string;
  status: UrlStatus;
  message?: string;
  title?: string;
  type?: "youtube" | "podcast_query" | "generic";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectUrlType(url: string): "youtube" | "podcast_query" | "generic" {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/spotify\.com\/episode|podcasts\.apple\.com|anchor\.fm/.test(url)) return "podcast_query";
  return "generic";
}

function getTypeIcon(type: UrlEntry["type"]) {
  if (type === "youtube") return <Youtube className="w-3.5 h-3.5 text-red-500" />;
  if (type === "podcast_query") return <Mic className="w-3.5 h-3.5 text-purple-500" />;
  return <Globe className="w-3.5 h-3.5 text-blue-500" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BulkUrlImportPanel() {
  const { toast } = useToast();
  const [rawInput, setRawInput] = useState("");
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const enrichYouTubeMutation = trpc.contentItems.enrichFromYouTube.useMutation();
  const createMutation = trpc.contentItems.create.useMutation();
  const utils = trpc.useUtils();

  // Parse the textarea into URL entries
  function parseUrls() {
    const lines = rawInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.startsWith("http://") || l.startsWith("https://")));
    const unique = [...new Set(lines)];
    setEntries(
      unique.map((url) => ({
        url,
        status: "pending",
        type: detectUrlType(url),
      }))
    );
  }

  function clearAll() {
    setRawInput("");
    setEntries([]);
  }

  function updateEntry(url: string, patch: Partial<UrlEntry>) {
    setEntries((prev) => prev.map((e) => (e.url === url ? { ...e, ...patch } : e)));
  }

  async function importAll() {
    if (entries.length === 0) return;
    setIsRunning(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      if (entry.status === "success") continue; // skip already done
      updateEntry(entry.url, { status: "processing" });

      try {
        if (entry.type === "youtube") {
          const result = await enrichYouTubeMutation.mutateAsync({ url: entry.url });
          updateEntry(entry.url, {
            status: "success",
            title: result.title,
            message: `Created as ${result.contentType}`,
          });
          successCount++;
        } else {
          // Generic URL: create a minimal content item with the URL
          // The admin can enrich it later via the MediaItemFormDialog
          const domain = new URL(entry.url).hostname.replace("www.", "");
          await createMutation.mutateAsync({
            title: domain,
            contentType: "website",
            url: entry.url,
            authorNames: [],
          });
          updateEntry(entry.url, {
            status: "success",
            title: domain,
            message: "Created as website — enrich manually",
          });
          successCount++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateEntry(entry.url, { status: "error", message: msg });
        errorCount++;
      }
    }

    await utils.contentItems.list.invalidate();
    setIsRunning(false);

    toast({
      title: `Import complete`,
      description: `${successCount} imported, ${errorCount} failed`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  }

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const successCount = entries.filter((e) => e.status === "success").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-4 h-4 text-primary" />
          Bulk URL Import
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste one URL per line. YouTube videos and channels are enriched automatically via the
          YouTube Data API. Other URLs are created as website stubs for manual enrichment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input area */}
        <div className="space-y-2">
          <Textarea
            placeholder={`https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/@channel\nhttps://example.com/article`}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            className="font-mono text-xs resize-none"
            disabled={isRunning}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={parseUrls}
              disabled={!rawInput.trim() || isRunning}
            >
              <Link className="w-3.5 h-3.5 mr-1.5" />
              Parse URLs
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAll}
              disabled={isRunning}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* URL list */}
        {entries.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div
                  key={entry.url}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-xs"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {entry.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />
                    )}
                    {entry.status === "processing" && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {entry.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {entry.status === "error" && (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>

                  {/* URL + type badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getTypeIcon(entry.type)}
                      <span className="truncate text-muted-foreground font-mono">
                        {entry.url.length > 60 ? entry.url.slice(0, 60) + "…" : entry.url}
                      </span>
                    </div>
                    {entry.title && (
                      <div className="font-medium text-foreground truncate">{entry.title}</div>
                    )}
                    {entry.message && (
                      <div
                        className={
                          entry.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {entry.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + action */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {pendingCount} pending
                </Badge>
                {successCount > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                    {successCount} done
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {errorCount} failed
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                onClick={importAll}
                disabled={isRunning || pendingCount === 0}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Import All ({pendingCount})
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
