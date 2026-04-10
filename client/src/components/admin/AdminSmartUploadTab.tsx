/**
 * AdminSmartUploadTab — Smart Upload with AI Classification
 *
 * Three-panel workflow:
 *   1. Drop Zone — drag-and-drop or file picker, supports multi-file
 *   2. Upload Queue — live progress while files upload and AI classifies
 *   3. Review Queue — admin reviews AI decisions, overrides, commits or rejects
 *
 * Supported file types: PDF, images (JPG/PNG/WebP), audio (MP3/M4A/WAV), video (MP4), EPUB, DOCX
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CloudArrowUp,
  FilePdf,
  Image,
  MusicNote,
  Video,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Spinner,
  MagnifyingGlass,
  Pencil,
  Trash,
  CheckSquare,
  X,
  ArrowsClockwise,
  Robot,
  User,
  BookOpen,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadStatus = "pending" | "classifying" | "review" | "committed" | "rejected" | "error";

interface UploadRecord {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  stagingS3Url: string | null;
  finalS3Url: string | null;
  status: UploadStatus;
  aiContentType: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiSuggestedAuthorName: string | null;
  aiSuggestedBookTitle: string | null;
  overrideContentType: string | null;
  matchedAuthorId: number | null;
  confirmedAuthorId: number | null;
  matchedBookId: number | null;
  confirmedBookId: number | null;
  targetTable: string | null;
  shouldIndexPinecone: boolean | null;
  pineconeNamespace: string | null;
  shouldMirrorDropbox: boolean | null;
  suggestedDropboxPath: string | null;
  adminNotes: string | null;
  errorMessage: string | null;
  classifiedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: "uploading" | "classifying" | "done" | "error";
  error?: string;
  uploadId?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FilePdf size={18} weight="duotone" className="text-red-500" />;
  if (mimeType.startsWith("image/")) return <Image size={18} weight="duotone" className="text-blue-500" />;
  if (mimeType.startsWith("audio/")) return <MusicNote size={18} weight="duotone" className="text-purple-500" />;
  if (mimeType.startsWith("video/")) return <Video size={18} weight="duotone" className="text-amber-500" />;
  return <FileText size={18} weight="duotone" className="text-gray-500" />;
}

const STATUS_CONFIG: Record<UploadStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700", icon: <Clock size={12} /> },
  classifying: { label: "Classifying…", color: "bg-blue-100 text-blue-700", icon: <Spinner size={12} className="animate-spin" /> },
  review: { label: "Needs Review", color: "bg-amber-100 text-amber-700", icon: <MagnifyingGlass size={12} /> },
  committed: { label: "Committed", color: "bg-green-100 text-green-700", icon: <CheckCircle size={12} /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: <XCircle size={12} /> },
  error: { label: "Error", color: "bg-red-100 text-red-700", icon: <Warning size={12} /> },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  author_avatar: "Author Photo / Avatar",
  book_cover: "Book Cover Image",
  book_pdf: "Book PDF",
  book_audio: "Audiobook",
  book_video: "Book Video",
  author_bio_doc: "Author Bio Document",
  book_summary_doc: "Book Summary Document",
  magazine_article: "Magazine Article",
  other_document: "Other Document",
  other_media: "Other Media",
};

const ACCEPTED_TYPES =
  "application/pdf,image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4,video/quicktime,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip";

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminSmartUploadTab() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: stats } = trpc.smartUpload.stats.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: reviewItems = [] } = trpc.smartUpload.list.useQuery(
    { status: "review", limit: 50 },
    { refetchInterval: 8000 }
  );
  const { data: allItems = [] } = trpc.smartUpload.list.useQuery(
    { status: "all", limit: 100 }
  );
  const { data: authors = [] } = trpc.smartUpload.listAuthors.useQuery();
  const { data: books = [] } = trpc.smartUpload.listBooks.useQuery();

  // Mutations
  const classifyMutation = trpc.smartUpload.classify.useMutation({
    onSuccess: () => {
      utils.smartUpload.list.invalidate();
      utils.smartUpload.stats.invalidate();
      toast.success("Re-classification complete");
    },
    onError: (err) => toast.error(`Classification failed: ${err.message}`),
  });

  const commitMutation = trpc.smartUpload.commit.useMutation({
    onSuccess: () => {
      utils.smartUpload.list.invalidate();
      utils.smartUpload.stats.invalidate();
      toast.success("Upload committed to database");
      setReviewTarget(null);
    },
    onError: (err) => toast.error(`Commit failed: ${err.message}`),
  });

  const rejectMutation = trpc.smartUpload.reject.useMutation({
    onSuccess: () => {
      utils.smartUpload.list.invalidate();
      utils.smartUpload.stats.invalidate();
      toast.success("Upload rejected");
      setReviewTarget(null);
    },
    onError: (err) => toast.error(`Reject failed: ${err.message}`),
  });

  const overrideMutation = trpc.smartUpload.updateOverride.useMutation({
    onSuccess: () => {
      utils.smartUpload.list.invalidate();
      toast.success("Override saved");
    },
    onError: (err) => toast.error(`Override failed: ${err.message}`),
  });

  const deleteMutation = trpc.smartUpload.delete.useMutation({
    onSuccess: () => {
      utils.smartUpload.list.invalidate();
      utils.smartUpload.stats.invalidate();
      toast.success("Upload deleted");
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [reviewTarget, setReviewTarget] = useState<UploadRecord | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    overrideContentType: "",
    confirmedAuthorId: null as number | null,
    confirmedBookId: null as number | null,
    shouldIndexPinecone: true,
    pineconeNamespace: "",
    shouldMirrorDropbox: true,
    suggestedDropboxPath: "",
    adminNotes: "",
  });

  // ── Upload handler ──────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const newEntries: UploadingFile[] = fileArray.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        file: f,
        progress: "uploading",
      }));

      setUploadingFiles((prev) => [...prev, ...newEntries]);

      const formData = new FormData();
      fileArray.forEach((f) => formData.append("files", f));

      try {
        const response = await fetch("/api/upload/smart", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error ?? "Upload failed");
        }

        const result = await response.json();

        // Update each file entry with its result
        setUploadingFiles((prev) =>
          prev.map((entry) => {
            const match = result.uploads?.find((u: any) => u.filename === entry.file.name);
            if (!match) return entry;
            if (match.status === "error") {
              return { ...entry, progress: "error", error: match.error };
            }
            return { ...entry, progress: "classifying", uploadId: match.id };
          })
        );

        // Poll until all are classified
        const pollInterval = setInterval(async () => {
          await utils.smartUpload.list.invalidate();
          await utils.smartUpload.stats.invalidate();

          // After 30s, move all "classifying" to "done"
          setUploadingFiles((prev) => {
            return prev.map((e) => {
              if (e.progress === "classifying") {
                return { ...e, progress: "done" };
              }
              return e;
            });
          });
        }, 5000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setUploadingFiles((prev) =>
            prev.map((e) =>
              e.progress === "classifying" ? { ...e, progress: "done" } : e
            )
          );
        }, 35000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploadingFiles((prev) =>
          prev.map((e) =>
            newEntries.some((n) => n.id === e.id) ? { ...e, progress: "error", error: msg } : e
          )
        );
        toast.error(msg);
      }
    },
    [utils]
  );

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Review dialog opener ────────────────────────────────────────────────────

  const openReview = (item: UploadRecord) => {
    setReviewTarget(item);
    setOverrideForm({
      overrideContentType: item.overrideContentType ?? item.aiContentType ?? "",
      confirmedAuthorId: item.confirmedAuthorId ?? item.matchedAuthorId,
      confirmedBookId: item.confirmedBookId ?? item.matchedBookId,
      shouldIndexPinecone: item.shouldIndexPinecone ?? true,
      pineconeNamespace: item.pineconeNamespace ?? "",
      shouldMirrorDropbox: item.shouldMirrorDropbox ?? true,
      suggestedDropboxPath: item.suggestedDropboxPath ?? "",
      adminNotes: item.adminNotes ?? "",
    });
  };

  const handleSaveOverride = async () => {
    if (!reviewTarget) return;
    await overrideMutation.mutateAsync({
      id: reviewTarget.id,
      overrideContentType: overrideForm.overrideContentType || undefined,
      confirmedAuthorId: overrideForm.confirmedAuthorId,
      confirmedBookId: overrideForm.confirmedBookId,
      shouldIndexPinecone: overrideForm.shouldIndexPinecone,
      pineconeNamespace: overrideForm.pineconeNamespace || undefined,
      shouldMirrorDropbox: overrideForm.shouldMirrorDropbox,
      suggestedDropboxPath: overrideForm.suggestedDropboxPath || undefined,
      adminNotes: overrideForm.adminNotes || undefined,
    });
  };

  const typedReview = reviewItems as { items: UploadRecord[]; total: number };
  const typedAll = allItems as { items: UploadRecord[]; total: number };
  const reviewList = typedReview.items ?? [];
  const allList = typedAll.items ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-semibold">Smart Upload</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Upload any file from your computer — Claude AI will automatically classify it, match it
          to the correct author or book, and route it to the right database table and Pinecone
          namespace. Review and confirm before committing.
        </p>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: (stats as any).total ?? 0, color: "" },
            { label: "Classifying", value: (stats as any).classifying ?? 0, color: "text-blue-600" },
            { label: "Review", value: (stats as any).review ?? 0, color: "text-amber-600" },
            { label: "Committed", value: (stats as any).committed ?? 0, color: "text-green-600" },
            { label: "Rejected", value: (stats as any).rejected ?? 0, color: "text-muted-foreground" },
            { label: "Errors", value: (stats as any).error ?? 0, color: (stats as any).error > 0 ? "text-red-600" : "text-muted-foreground" },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="upload">
        <TabsList className="mb-4">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="review" className="relative">
            Review Queue
            {(stats as any)?.review > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {(stats as any).review}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── Upload tab ── */}
        <TabsContent value="upload" className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-200 select-none
              ${isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />

            <CloudArrowUp
              size={52}
              weight="thin"
              className={`mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`}
            />
            <p className="text-base font-medium text-foreground">
              {isDragging ? "Drop files here" : "Drag & drop files, or click to browse"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, images, audio, video, EPUB, DOCX — up to 100 MB per file, 10 files at once
            </p>

            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[
                { icon: <FilePdf size={14} />, label: "PDF", color: "text-red-600" },
                { icon: <Image size={14} />, label: "Images", color: "text-blue-600" },
                { icon: <MusicNote size={14} />, label: "Audio", color: "text-purple-600" },
                { icon: <Video size={14} />, label: "Video", color: "text-amber-600" },
                { icon: <FileText size={14} />, label: "Docs", color: "text-gray-600" },
              ].map((t) => (
                <span
                  key={t.label}
                  className={`flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded-full ${t.color}`}
                >
                  {t.icon}
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Active upload queue */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Upload Progress</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadingFiles([])}
                  className="text-xs h-7"
                >
                  Clear
                </Button>
              </div>
              {uploadingFiles.map((entry) => (
                <Card key={entry.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {getMimeIcon(entry.file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {entry.progress === "uploading" && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading…
                        </div>
                      )}
                      {entry.progress === "classifying" && (
                        <div className="flex items-center gap-1.5 text-xs text-purple-600">
                          <Robot size={14} className="animate-pulse" />
                          AI classifying…
                        </div>
                      )}
                      {entry.progress === "done" && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle size={14} weight="fill" />
                          Ready for review
                        </div>
                      )}
                      {entry.progress === "error" && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600">
                          <XCircle size={14} weight="fill" />
                          {entry.error ?? "Failed"}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Review tab ── */}
        <TabsContent value="review" className="space-y-3">
          {reviewList.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle size={44} weight="thin" className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No uploads awaiting review.</p>
            </Card>
          ) : (
            reviewList.map((item) => (
              <UploadReviewCard
                key={item.id}
                item={item}
                onReview={() => openReview(item)}
                onCommit={() => commitMutation.mutate({ id: item.id })}
                onReject={() => rejectMutation.mutate({ id: item.id })}
                onReclassify={() => classifyMutation.mutate({ id: item.id })}
                isCommitting={commitMutation.isPending}
                isRejecting={rejectMutation.isPending}
              />
            ))
          )}
        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history" className="space-y-3">
          {allList.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock size={44} weight="thin" className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No upload history yet.</p>
            </Card>
          ) : (
            allList.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-center gap-3">
                  {getMimeIcon(item.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.originalFilename}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{formatBytes(item.fileSizeBytes)}</span>
                      {item.aiContentType && (
                        <span className="text-xs text-muted-foreground">
                          {CONTENT_TYPE_LABELS[item.aiContentType] ?? item.aiContentType}
                        </span>
                      )}
                      {item.aiSuggestedAuthorName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <User size={10} />
                          {item.aiSuggestedAuthorName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={item.status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: item.id })}
                    >
                      <Trash size={13} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Review / Override Dialog ── */}
      {reviewTarget && (
        <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getMimeIcon(reviewTarget.mimeType)}
                {reviewTarget.originalFilename}
              </DialogTitle>
              <DialogDescription>
                Review the AI classification and override if needed before committing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* AI Classification result */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Robot size={16} weight="duotone" className="text-purple-600" />
                  <span className="text-sm font-semibold">AI Classification</span>
                  {reviewTarget.aiConfidence != null && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(reviewTarget.aiConfidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Content Type</p>
                    <p className="font-medium">
                      {reviewTarget.aiContentType
                        ? CONTENT_TYPE_LABELS[reviewTarget.aiContentType] ?? reviewTarget.aiContentType
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Target Table</p>
                    <p className="font-medium font-mono text-xs">{reviewTarget.targetTable ?? "—"}</p>
                  </div>
                  {reviewTarget.aiSuggestedAuthorName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Suggested Author</p>
                      <p className="font-medium">{reviewTarget.aiSuggestedAuthorName}</p>
                    </div>
                  )}
                  {reviewTarget.aiSuggestedBookTitle && (
                    <div>
                      <p className="text-xs text-muted-foreground">Suggested Book</p>
                      <p className="font-medium">{reviewTarget.aiSuggestedBookTitle}</p>
                    </div>
                  )}
                </div>
                {reviewTarget.aiReasoning && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">
                    {reviewTarget.aiReasoning}
                  </p>
                )}
              </div>

              {/* Admin Overrides */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Pencil size={14} />
                  <span className="text-sm font-semibold">Admin Override</span>
                  <span className="text-xs text-muted-foreground">(optional — leave blank to accept AI decision)</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="overrideType">Override Content Type</Label>
                    <select
                      id="overrideType"
                      value={overrideForm.overrideContentType}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, overrideContentType: e.target.value }))
                      }
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— Use AI decision —</option>
                      {Object.entries(CONTENT_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmedAuthor">Confirmed Author</Label>
                    <select
                      id="confirmedAuthor"
                      value={overrideForm.confirmedAuthorId ?? ""}
                      onChange={(e) =>
                        setOverrideForm((p) => ({
                          ...p,
                          confirmedAuthorId: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— None / AI match —</option>
                      {(authors as any[]).map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmedBook">Confirmed Book</Label>
                    <select
                      id="confirmedBook"
                      value={overrideForm.confirmedBookId ?? ""}
                      onChange={(e) =>
                        setOverrideForm((p) => ({
                          ...p,
                          confirmedBookId: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— None / AI match —</option>
                      {(books as any[]).map((b) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pineconeNs">Pinecone Namespace</Label>
                    <Input
                      id="pineconeNs"
                      placeholder={reviewTarget.pineconeNamespace ?? "authors / books / content_items"}
                      value={overrideForm.pineconeNamespace}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, pineconeNamespace: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dropboxPath">Dropbox Destination Path</Label>
                  <Input
                    id="dropboxPath"
                    placeholder={reviewTarget.suggestedDropboxPath ?? "/Apps NAI/RC Library App Data/..."}
                    value={overrideForm.suggestedDropboxPath}
                    onChange={(e) =>
                      setOverrideForm((p) => ({ ...p, suggestedDropboxPath: e.target.value }))
                    }
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={overrideForm.shouldIndexPinecone}
                      onCheckedChange={(v) =>
                        setOverrideForm((p) => ({ ...p, shouldIndexPinecone: v }))
                      }
                      className="data-[state=checked]:bg-purple-500"
                    />
                    <Label className="cursor-pointer text-sm">Index in Pinecone</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={overrideForm.shouldMirrorDropbox}
                      onCheckedChange={(v) =>
                        setOverrideForm((p) => ({ ...p, shouldMirrorDropbox: v }))
                      }
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <Label className="cursor-pointer text-sm">Mirror to Dropbox</Label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminNotes">Admin Notes</Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Optional notes about this upload…"
                    value={overrideForm.adminNotes}
                    onChange={(e) =>
                      setOverrideForm((p) => ({ ...p, adminNotes: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate({ id: reviewTarget.id })}
                disabled={rejectMutation.isPending}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveOverride}
                disabled={overrideMutation.isPending}
              >
                {overrideMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Override
              </Button>
              <Button
                onClick={() => commitMutation.mutate({ id: reviewTarget.id })}
                disabled={commitMutation.isPending}
              >
                {commitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Commit to Database
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Upload Review Card ────────────────────────────────────────────────────────

function UploadReviewCard({
  item,
  onReview,
  onCommit,
  onReject,
  onReclassify,
  isCommitting,
  isRejecting,
}: {
  item: UploadRecord;
  onReview: () => void;
  onCommit: () => void;
  onReject: () => void;
  onReclassify: () => void;
  isCommitting: boolean;
  isRejecting: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getMimeIcon(item.mimeType)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{item.originalFilename}</span>
            <StatusBadge status={item.status} />
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
            <span>{formatBytes(item.fileSizeBytes)}</span>
            {item.aiContentType && (
              <span className="flex items-center gap-0.5">
                <Robot size={11} className="text-purple-500" />
                {CONTENT_TYPE_LABELS[item.aiContentType] ?? item.aiContentType}
                {item.aiConfidence != null && (
                  <span className="ml-1 text-muted-foreground/70">
                    ({Math.round(item.aiConfidence * 100)}%)
                  </span>
                )}
              </span>
            )}
            {item.aiSuggestedAuthorName && (
              <span className="flex items-center gap-0.5">
                <UsersThree size={11} />
                {item.aiSuggestedAuthorName}
              </span>
            )}
            {item.aiSuggestedBookTitle && (
              <span className="flex items-center gap-0.5">
                <BookOpen size={11} />
                {item.aiSuggestedBookTitle}
              </span>
            )}
          </div>

          {item.aiReasoning && (
            <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
              {item.aiReasoning}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Re-classify" onClick={onReclassify}>
            <ArrowsClockwise size={13} />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onReview}>
            <Pencil size={12} />
            Review
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onCommit}
            disabled={isCommitting}
          >
            {isCommitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare size={12} />}
            Commit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onReject}
            disabled={isRejecting}
          >
            <X size={13} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UploadStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
