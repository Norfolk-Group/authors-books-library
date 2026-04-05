/**
 * AdminDropboxTab — Dropbox Backup & Content Ingestion
 *
 * Two sections:
 *   1. Content Inbox — scan Dropbox Inbox for new PDFs and ingest them
 *   2. Backup Management — back up avatars, covers, PDFs to Dropbox
 *
 * Backup folder: /Cidale Interests/Company/Norfolk AI/Apps/RC Library/
 * Inbox folder:  /Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox/
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  CloudArrowUp,
  FolderOpen,
  Image,
  FilePdf,
  Users,
  ArrowsClockwise,
  Tray,
  FileArrowUp,
  MagnifyingGlass,
  BookOpen,
  UserPlus,
  CheckSquare,
  Warning,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BackupResult {
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

interface IngestResult {
  filename: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  metadata?: {
    bookTitle: string;
    authors: string[];
    category: string;
    confidence: "high" | "medium" | "low";
  } | null;
  authorResults?: Array<{
    authorName: string;
    action: "created" | "existing" | "skipped";
    error?: string;
  }>;
  movedToProcessed?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BackupResultBadges({ result }: { result: BackupResult }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <Badge variant="outline" className="text-xs gap-1">
        <span className="font-medium">{result.total}</span> total
      </Badge>
      {result.uploaded > 0 && (
        <Badge className="text-xs gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <CheckCircle className="w-3 h-3" />
          {result.uploaded} uploaded
        </Badge>
      )}
      {result.skipped > 0 && (
        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
          {result.skipped} skipped
        </Badge>
      )}
      {result.failed > 0 && (
        <Badge className="text-xs gap-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <XCircle className="w-3 h-3" />
          {result.failed} failed
        </Badge>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminDropboxTab() {
  // Backup state
  const [avatarResult, setAvatarResult] = useState<BackupResult | null>(null);
  const [coverResult, setCoverResult] = useState<BackupResult | null>(null);
  const [pdfResult, setPdfResult] = useState<BackupResult | null>(null);
  const [allResult, setAllResult] = useState<{
    avatars: BackupResult;
    bookCovers: BackupResult;
    pdfs: BackupResult;
    summary: { totalAssets: number; totalUploaded: number; totalSkipped: number; totalFailed: number };
  } | null>(null);

  // Ingest state
  const [ingestingFile, setIngestingFile] = useState<string | null>(null);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [ingestResults, setIngestResults] = useState<IngestResult[]>([]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = trpc.dropbox.status.useQuery();

  const inboxQuery = trpc.dropbox.scanInbox.useQuery(
    { dryRun: true },
    { refetchOnWindowFocus: false, enabled: status?.connected === true }
  );

  // ── Backup Mutations ──────────────────────────────────────────────────────────

  const backupAvatarsMutation = trpc.dropbox.backupAvatars.useMutation({
    onSuccess: (data) => { setAvatarResult(data); toast.success(`Avatars: ${data.uploaded} uploaded, ${data.skipped} skipped`); },
    onError: (err) => toast.error(`Avatar backup failed: ${err.message}`),
  });

  const backupCoversMutation = trpc.dropbox.backupBookCovers.useMutation({
    onSuccess: (data) => { setCoverResult(data); toast.success(`Book covers: ${data.uploaded} uploaded, ${data.skipped} skipped`); },
    onError: (err) => toast.error(`Cover backup failed: ${err.message}`),
  });

  const backupPdfsMutation = trpc.dropbox.backupPdfs.useMutation({
    onSuccess: (data) => { setPdfResult(data); toast.success(`PDFs: ${data.uploaded} uploaded, ${data.skipped} skipped`); },
    onError: (err) => toast.error(`PDF backup failed: ${err.message}`),
  });

  const backupAllMutation = trpc.dropbox.backupAll.useMutation({
    onSuccess: (data) => {
      setAllResult(data);
      setAvatarResult(data.avatars);
      setCoverResult(data.bookCovers);
      setPdfResult(data.pdfs);
      toast.success(`Full backup: ${data.summary.totalUploaded} uploaded, ${data.summary.totalSkipped} skipped`);
    },
    onError: (err) => toast.error(`Full backup failed: ${err.message}`),
  });

  // ── Ingest Mutations ──────────────────────────────────────────────────────────

  const ingestFileMutation = trpc.dropbox.ingestFile.useMutation({
    onSuccess: (data) => {
      setIngestingFile(null);
      setIngestResults((prev) => [data as IngestResult, ...prev]);
      if (data.status === "success") {
        toast.success(`Ingested: ${data.filename}`);
        inboxQuery.refetch();
      } else {
        toast.warning(`Skipped: ${data.filename} — ${data.reason}`);
      }
    },
    onError: (err, vars) => {
      setIngestingFile(null);
      toast.error(`Ingest failed for ${vars.dropboxPath}: ${err.message}`);
    },
  });

  const ingestAllMutation = trpc.dropbox.ingestAll.useMutation({
    onSuccess: (data) => {
      setIngestingAll(false);
      setIngestResults(data.results as IngestResult[]);
      toast.success(`Ingest complete: ${data.succeeded} succeeded, ${data.skipped} skipped, ${data.failed} failed`);
      inboxQuery.refetch();
    },
    onError: (err) => {
      setIngestingAll(false);
      toast.error(`Ingest all failed: ${err.message}`);
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────────────

  const isAnyBackupRunning = backupAvatarsMutation.isPending || backupCoversMutation.isPending || backupPdfsMutation.isPending || backupAllMutation.isPending;
  const inboxFiles = inboxQuery.data?.files ?? [];
  const pdfFiles = inboxFiles.filter((f) => f.isPdf);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Connection Status ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CloudArrowUp className="w-5 h-5 text-blue-500" />
                Dropbox Connection
              </CardTitle>
              <CardDescription className="mt-1">Permanent refresh token — never expires</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchStatus()} disabled={statusLoading}>
              <ArrowsClockwise className={`w-4 h-4 ${statusLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />Checking connection...
            </div>
          ) : status?.connected ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div><span className="font-medium">Account:</span> {status.displayName} ({status.email})</div>
                <div className="font-mono text-xs bg-muted px-2 py-1 rounded">{status.backupFolder}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" weight="fill" />
              <span className="text-sm text-red-600 dark:text-red-400">
                {(status as { error?: string } | undefined)?.error ?? "Not connected"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Content Inbox ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Tray className="w-5 h-5 text-violet-500" />
                Content Inbox
                {inboxQuery.data && pdfFiles.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {pdfFiles.length} PDF{pdfFiles.length !== 1 ? "s" : ""} waiting
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Drop new PDFs into the Inbox folder below. The app will detect them, extract metadata,
                create author cards, generate avatars, and upload everything to the cloud.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone path */}
          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs">
            <span className="font-medium text-muted-foreground">Drop zone: </span>
            <code className="text-foreground">
              {inboxQuery.data?.inboxFolder ?? "/Cidale Interests/Company/Norfolk AI/Apps/RC Library/Inbox"}
            </code>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inboxQuery.refetch()}
              disabled={inboxQuery.isFetching || !status?.connected}
            >
              {inboxQuery.isFetching
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <MagnifyingGlass size={14} className="mr-1.5" />
              }
              Scan Inbox
            </Button>
            {pdfFiles.length > 0 && (
              <Button
                size="sm"
                onClick={() => { setIngestingAll(true); setIngestResults([]); ingestAllMutation.mutate({ moveToProcessed: true, fetchBookCover: true }); }}
                disabled={ingestingAll || !status?.connected}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {ingestingAll
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <FileArrowUp size={14} className="mr-1.5" />
                }
                Ingest All ({pdfFiles.length})
              </Button>
            )}
          </div>

          {/* File list */}
          {inboxQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />Scanning inbox…
            </div>
          ) : inboxFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Tray size={32} className="mx-auto mb-2 opacity-30" />
              <p>Inbox is empty</p>
              <p className="text-xs mt-1">Drop PDFs into the Dropbox folder above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inboxFiles.map((file) => (
                <div key={file.dropboxPath} className="rounded-lg border bg-card p-3 flex items-start gap-3">
                  <FilePdf
                    size={20}
                    weight="duotone"
                    className={`mt-0.5 shrink-0 ${file.isPdf ? "text-red-500" : "text-muted-foreground"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                      {file.serverModified && ` · ${new Date(file.serverModified).toLocaleDateString()}`}
                    </p>
                    {/* LLM metadata preview */}
                    {file.metadata && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-foreground">
                          <BookOpen size={11} className="inline mr-1" />
                          {file.metadata.bookTitle}
                        </p>
                        {file.metadata.authors.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <Users size={11} className="inline mr-1" />
                            {file.metadata.authors.join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">{file.metadata.category}</Badge>
                          <Badge
                            variant={file.metadata.confidence === "high" ? "default" : file.metadata.confidence === "medium" ? "secondary" : "outline"}
                            className="text-xs py-0 px-1.5 h-4"
                          >
                            {file.metadata.confidence} confidence
                          </Badge>
                        </div>
                      </div>
                    )}
                    {(file as { reason?: string }).reason && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{(file as { reason?: string }).reason}</p>
                    )}
                  </div>
                  {file.isPdf && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 text-xs"
                      onClick={() => {
                        setIngestingFile(file.dropboxPath);
                        ingestFileMutation.mutate({ dropboxPath: file.dropboxPath, moveToProcessed: true, fetchBookCover: true });
                      }}
                      disabled={ingestingFile === file.dropboxPath || ingestingAll || !status?.connected}
                    >
                      {ingestingFile === file.dropboxPath
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><FileArrowUp size={12} className="mr-1" />Ingest</>
                      }
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Ingest results */}
          {ingestResults.length > 0 && (
            <div className="space-y-2 mt-2">
              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingest Results</p>
              {ingestResults.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-md border px-3 py-2 text-xs ${
                    r.status === "success"
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : r.status === "error"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                      : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {r.status === "success"
                      ? <CheckSquare size={13} weight="fill" className="text-green-600" />
                      : r.status === "error"
                      ? <XCircle size={13} weight="fill" className="text-red-600" />
                      : <Warning size={13} weight="fill" className="text-amber-600" />
                    }
                    <span className="font-medium truncate">{r.filename}</span>
                  </div>
                  {r.metadata && (
                    <p className="text-muted-foreground">Book: <strong>{r.metadata.bookTitle}</strong></p>
                  )}
                  {r.authorResults && r.authorResults.length > 0 && (
                    <p className="text-muted-foreground">
                      Authors:{" "}
                      {r.authorResults.map((a) => (
                        <span key={a.authorName} className="mr-2">
                          {a.authorName}
                          <span className={`ml-1 ${a.action === "created" ? "text-green-600" : "text-muted-foreground"}`}>
                            ({a.action === "created" ? <><UserPlus size={10} className="inline" /> new</> : a.action})
                          </span>
                        </span>
                      ))}
                    </p>
                  )}
                  {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
                  {r.movedToProcessed && <p className="text-green-600 dark:text-green-400">✓ Moved to Processed</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Full Backup ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Full Backup</CardTitle>
          <CardDescription>
            Backup all avatars, book covers, and PDFs to Dropbox in one operation.
            Already-backed-up files are skipped by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => backupAllMutation.mutate({ skipExisting: true })}
            disabled={isAnyBackupRunning || !status?.connected}
            className="w-full sm:w-auto"
          >
            {backupAllMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Running full backup...</>
              : <><CloudArrowUp className="w-4 h-4 mr-2" />Backup All Assets</>
            }
          </Button>

          {allResult && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-sm font-medium">Last backup results</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><div className="text-muted-foreground mb-1">Avatars</div><BackupResultBadges result={allResult.avatars} /></div>
                <div><div className="text-muted-foreground mb-1">Book Covers</div><BackupResultBadges result={allResult.bookCovers} /></div>
                <div><div className="text-muted-foreground mb-1">PDFs</div><BackupResultBadges result={allResult.pdfs} /></div>
              </div>
              <Separator />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{allResult.summary.totalUploaded}</strong> uploaded</span>
                <span><strong className="text-foreground">{allResult.summary.totalSkipped}</strong> skipped</span>
                {allResult.summary.totalFailed > 0 && (
                  <span className="text-red-500"><strong>{allResult.summary.totalFailed}</strong> failed</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Individual Backup Controls ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />Author Avatars
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Author headshots from S3 CDN → Dropbox Avatars/</p>
            <Button size="sm" variant="outline" onClick={() => backupAvatarsMutation.mutate({ skipExisting: true })} disabled={isAnyBackupRunning || !status?.connected} className="w-full">
              {backupAvatarsMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Backing up...</> : <><CloudArrowUp className="w-3 h-3 mr-1" />Backup Avatars</>}
            </Button>
            {avatarResult && <BackupResultBadges result={avatarResult} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Image className="w-4 h-4 text-orange-500" />Book Covers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Book cover images from S3 CDN → Dropbox Book Covers/</p>
            <Button size="sm" variant="outline" onClick={() => backupCoversMutation.mutate({ skipExisting: true })} disabled={isAnyBackupRunning || !status?.connected} className="w-full">
              {backupCoversMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Backing up...</> : <><CloudArrowUp className="w-3 h-3 mr-1" />Backup Covers</>}
            </Button>
            {coverResult && <BackupResultBadges result={coverResult} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FilePdf className="w-4 h-4 text-red-500" />PDF Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">All PDFs from content_files table → Dropbox PDFs/</p>
            <Button size="sm" variant="outline" onClick={() => backupPdfsMutation.mutate({ skipExisting: true })} disabled={isAnyBackupRunning || !status?.connected} className="w-full">
              {backupPdfsMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Backing up...</> : <><CloudArrowUp className="w-3 h-3 mr-1" />Backup PDFs</>}
            </Button>
            {pdfResult && <BackupResultBadges result={pdfResult} />}
          </CardContent>
        </Card>
      </div>

      {/* ── Folder Structure ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-yellow-500" />Dropbox Folder Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono text-muted-foreground bg-muted/50 rounded p-3 leading-relaxed">
{`📁 Cidale Interests/
  📁 Company/
    📁 Norfolk AI/
      📁 Apps/
        📁 RC Library/
          📁 Avatars/        ← author headshots
          📁 Book Covers/    ← book cover images
          📁 PDFs/           ← book & resource PDFs
          📁 Inbox/          ← drop new PDFs here
          📁 Inbox/Processed ← processed PDFs moved here`}
          </pre>
        </CardContent>
      </Card>

    </div>
  );
}
