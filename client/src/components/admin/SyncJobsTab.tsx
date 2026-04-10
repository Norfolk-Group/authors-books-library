/**
 * SyncJobsTab.tsx
 *
 * Admin tab for the S3-to-Dropbox / S3-to-Google-Drive sync engine.
 * Features:
 *   - Trigger sync jobs (target, scope, content types)
 *   - Live job history table with status, progress, file counts
 *   - Cancel running jobs
 *   - Credential status indicators
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Cloud,
  RefreshCw,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Image,
  Brain,
  BookOpen,
  HardDrive,
  FileJson,
  Zap,
  Headphones,
} from "lucide-react";

type SyncTarget = "dropbox" | "google_drive" | "both";
type ContentType = "avatars" | "books" | "audio" | "rag_files";

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; icon: React.ReactNode; streaming?: boolean }[] = [
  { value: "avatars", label: "Author Avatars", icon: <Image className="w-3.5 h-3.5" /> },
  { value: "books", label: "Book Covers", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { value: "audio", label: "Audio Files", icon: <Headphones className="w-3.5 h-3.5" />, streaming: true },
  { value: "rag_files", label: "Digital Me Files", icon: <Brain className="w-3.5 h-3.5" /> },
];

function JobStatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="text-xs gap-1 bg-emerald-600 text-white"><CheckCircle2 className="w-3 h-3" />Completed</Badge>;
  if (status === "running") return <Badge className="text-xs gap-1 bg-blue-500 text-white"><Loader2 className="w-3 h-3 animate-spin" />Running</Badge>;
  if (status === "failed") return <Badge className="text-xs gap-1 bg-red-500 text-white"><AlertCircle className="w-3 h-3" />Failed</Badge>;
  if (status === "cancelled") return <Badge className="text-xs gap-1 bg-gray-400 text-white"><XCircle className="w-3 h-3" />Cancelled</Badge>;
  return <Badge variant="outline" className="text-xs gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SyncJobsTab() {
  const [target, setTarget] = useState<SyncTarget>("dropbox");
  const [scope, setScope] = useState("all");
  const [contentTypes, setContentTypes] = useState<ContentType[]>(["avatars", "books", "rag_files"]);
  const [overwrite, setOverwrite] = useState(false);
  const [generateSidecars, setGenerateSidecars] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [generatingSidecars, setGeneratingSidecars] = useState(false);

  const { data: jobs = [], refetch: refetchJobs } = trpc.syncJobs.listJobs.useQuery({ limit: 30 });
  const { data: dropboxStatus, refetch: refetchDropboxStatus } = trpc.syncJobs.getDropboxStatus.useQuery(undefined, { refetchInterval: 10000 });
  const { data: driveStatus, refetch: refetchDriveStatus } = trpc.syncJobs.getDriveStatus.useQuery();
  const triggerMutation = trpc.syncJobs.triggerSync.useMutation();
  const cancelMutation = trpc.syncJobs.cancelJob.useMutation();
  const sidecarMutation = trpc.syncJobs.generateSidecars.useMutation();

  async function handleConnectDropbox() {
    // Open the OAuth flow in a new tab; the callback will redirect back to /admin?tab=sync
    window.open("/api/dropbox/connect", "_blank", "width=600,height=700");
    // Poll for connection status after a short delay
    setTimeout(() => refetchDropboxStatus(), 3000);
  }

  async function handleDisconnectDropbox() {
    try {
      await fetch("/api/dropbox/disconnect", { method: "POST" });
      await refetchDropboxStatus();
      toast.success("Dropbox disconnected");
    } catch (err) {
      toast.error(`Disconnect failed: ${String(err)}`);
    }
  }

  function toggleContentType(ct: ContentType) {
    setContentTypes((prev) =>
      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
    );
  }

  async function handleGenerateSidecars() {
    setGeneratingSidecars(true);
    try {
      const result = await sidecarMutation.mutateAsync({ target, scope, overwrite: true });
      if (result.success) {
        const failedCount = ('failed' in result ? result.failed : undefined) ?? 0;
        const syncedCount = ('synced' in result ? result.synced : undefined) ?? 0;
        toast.success(`Generated ${syncedCount} sidecars${failedCount > 0 ? `, ${failedCount} failed` : ""}`);
      } else {
        toast.error((result as { message?: string }).message ?? "Sidecar generation failed");
      }
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setGeneratingSidecars(false);
    }
  }

  async function handleTrigger() {
    if (contentTypes.length === 0) { toast.error("Select at least one content type"); return; }
    setTriggering(true);
    try {
      const result = await triggerMutation.mutateAsync({ target, scope, contentTypes, overwrite, generateSidecars });
      if (result.success) {
        toast.success(`Sync job #${result.jobId} started`);
        await refetchJobs();
      } else {
        toast.error((result as { message?: string }).message ?? "Failed to start sync job");
      }
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setTriggering(false);
    }
  }

  async function handleCancel(id: number) {
    try {
      await cancelMutation.mutateAsync({ id });
      toast.success(`Job #${id} cancelled`);
      await refetchJobs();
    } catch (err) {
      toast.error(`Cancel failed: ${String(err)}`);
    }
  }

  const runningJob = jobs.find((j) => j.status === "running");
  const hasAudio = contentTypes.includes("audio");

  return (
    <div className="space-y-4">
      {/* Connection status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Dropbox Connection
          </CardTitle>
          <CardDescription className="text-xs">
            Connect Dropbox once — the app uses OAuth 2 refresh tokens for permanent, non-expiring access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dropboxStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">Connected</span>
                  {dropboxStatus.hasRefreshToken && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Permanent Token</Badge>
                  )}
                  {!dropboxStatus.hasRefreshToken && dropboxStatus.hasStaticToken && (
                    <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">Static Token (expires)</Badge>
                  )}
                </div>
                {dropboxStatus.accountEmail && (
                  <p className="text-xs text-muted-foreground ml-6">{dropboxStatus.accountEmail}</p>
                )}
                {dropboxStatus.connectedAt && (
                  <p className="text-xs text-muted-foreground ml-6">Connected {new Date(dropboxStatus.connectedAt).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!dropboxStatus.hasRefreshToken && (
                  <Button size="sm" variant="outline" onClick={handleConnectDropbox} className="text-xs h-7">
                    Upgrade to Permanent
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleDisconnectDropbox} className="text-xs h-7 text-red-600 hover:text-red-700">
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Not connected</span>
              </div>
              <Button size="sm" onClick={handleConnectDropbox} className="text-xs h-7 gap-1.5">
                <Cloud className="w-3.5 h-3.5" />
                Connect Dropbox
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Drive status card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Google Drive Connection
            </CardTitle>
            <CardDescription className="text-xs">
              Resumable upload API — streams files to Drive. Set GOOGLE_DRIVE_ACCESS_TOKEN + GOOGLE_DRIVE_PARENT_FOLDER_ID in secrets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {driveStatus?.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  )}
                  <span className={`text-sm font-medium ${driveStatus?.connected ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {driveStatus?.connected ? "Configured" : "Not configured"}
                  </span>
                  {driveStatus?.connected && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Ready</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {driveStatus?.connected
                    ? `Parent folder: ${driveStatus.parentFolderId}`
                    : !driveStatus?.hasParentFolderId
                    ? "GOOGLE_DRIVE_PARENT_FOLDER_ID not set in secrets"
                    : "GOOGLE_DRIVE_ACCESS_TOKEN not available"}
                </p>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={() => refetchDriveStatus()}>
                <RefreshCw className="w-3 h-3" />
                Recheck
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streaming upload info banner */}
      {hasAudio && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs">
          <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Streaming upload enabled</strong> — Audio files use the Dropbox Upload Session API (50 MB chunks) and Google Drive Resumable Upload API.
            Large audiobooks are piped directly from S3 without loading the full file into memory.
          </div>
        </div>
      )}

      {/* Trigger form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="w-4 h-4" />
            Trigger Sync Job
          </CardTitle>
          <CardDescription className="text-xs">
            Push files from S3 to Dropbox or Google Drive in author-based folder structure.
            Folder: /AuthorName/content-type/filename
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Target</label>
              <Select value={target} onValueChange={(v) => setTarget(v as SyncTarget)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dropbox" className="text-xs">Dropbox</SelectItem>
                  <SelectItem value="google_drive" className="text-xs">Google Drive</SelectItem>
                  <SelectItem value="both" className="text-xs">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Scope</label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Authors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block">Content Types</label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleContentType(opt.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
                    contentTypes.includes(opt.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="overwrite"
              onClick={() => setOverwrite(!overwrite)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                overwrite ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {overwrite && <span className="text-primary-foreground text-xs">✓</span>}
            </button>
            <label htmlFor="overwrite" className="text-xs text-muted-foreground cursor-pointer" onClick={() => setOverwrite(!overwrite)}>
              Overwrite existing files (slower but ensures latest versions)
            </label>
          </div>

          {/* Sidecar toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGenerateSidecars(!generateSidecars)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                generateSidecars ? "bg-primary border-primary" : "border-border"
              }`}
            >
              {generateSidecars && <span className="text-primary-foreground text-xs">✓</span>}
            </button>
            <label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1" onClick={() => setGenerateSidecars(!generateSidecars)}>
              <FileJson className="w-3 h-3" />
              Generate _metadata.json sidecars for books
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleTrigger}
              disabled={triggering || !!runningJob || contentTypes.length === 0}
              className="gap-1.5"
            >
              {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {triggering ? "Starting…" : runningJob ? "Job Running…" : "Start Sync"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateSidecars}
              disabled={generatingSidecars || !!runningJob}
              className="gap-1.5 text-xs"
            >
              {generatingSidecars ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
              Generate Sidecars Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job history */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Sync Job History</CardTitle>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => refetchJobs()}>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">No sync jobs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Target</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Files</th>
                    <th className="text-left px-3 py-2 font-medium">Transferred</th>
                    <th className="text-left px-3 py-2 font-medium">Started</th>
                    <th className="text-left px-3 py-2 font-medium">Message</th>
                    <th className="text-left px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground">#{job.id}</td>
                      <td className="px-3 py-2 capitalize">{job.target.replace("_", " ")}</td>
                      <td className="px-3 py-2"><JobStatusBadge status={job.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {job.syncedFiles}/{job.totalFiles}
                        {job.failedFiles > 0 && <span className="text-red-500 ml-1">({job.failedFiles} failed)</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatBytes(job.bytesTransferred)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={job.message ?? ""}>
                        {job.message ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {job.status === "running" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2 gap-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleCancel(job.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <Square className="w-3 h-3" />
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
