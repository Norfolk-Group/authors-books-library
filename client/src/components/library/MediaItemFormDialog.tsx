/**
 * MediaItemFormDialog — Create or Edit a content_items record.
 * Supports all key fields: type, title, subtitle, description, URL, cover, date, language, authors.
 * Styled with the Noir Dark Executive palette; buttons have 3D appearance + hover effects.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ImagePlus, Loader2, Plus, Save, X } from "lucide-react";

// ── Content type options ──────────────────────────────────────────────────────
const CONTENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "paper",           label: "Research Paper" },
  { value: "article",         label: "Article" },
  { value: "substack",        label: "Substack" },
  { value: "newsletter",      label: "Newsletter" },
  { value: "blog_post",       label: "Blog Post" },
  { value: "social_post",     label: "Social Post" },
  { value: "website",         label: "Website" },
  { value: "speech",          label: "Speech" },
  { value: "interview",       label: "Interview" },
  { value: "podcast",         label: "Podcast" },
  { value: "podcast_episode", label: "Podcast Episode" },
  { value: "youtube_video",   label: "YouTube Video" },
  { value: "youtube_channel", label: "YouTube Channel" },
  { value: "ted_talk",        label: "TED Talk" },
  { value: "radio",           label: "Radio" },
  { value: "masterclass",     label: "Masterclass" },
  { value: "online_course",   label: "Online Course" },
  { value: "tool",            label: "Tool" },
  { value: "tv_show",         label: "TV Show" },
  { value: "tv_episode",      label: "TV Episode" },
  { value: "film",            label: "Film" },
  { value: "photography",     label: "Photography" },
  { value: "other",           label: "Other" },
];

interface MediaItemFormData {
  contentType: string;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  coverImageUrl: string;
  publishedDate: string;
  language: string;
  authorNames: string; // comma-separated
}

const EMPTY_FORM: MediaItemFormData = {
  contentType: "article",
  title: "",
  subtitle: "",
  description: "",
  url: "",
  coverImageUrl: "",
  publishedDate: "",
  language: "en",
  authorNames: "",
};

interface MediaItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the dialog is in edit mode */
  editItem?: {
    id: number;
    contentType: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    url?: string | null;
    coverImageUrl?: string | null;
    publishedDate?: string | null;
    language?: string | null;
    authorNames?: string[];
  } | null;
  onSuccess?: () => void;
}

export function MediaItemFormDialog({
  open,
  onOpenChange,
  editItem,
  onSuccess,
}: MediaItemFormDialogProps) {
  const isEdit = !!editItem;
  const utils = trpc.useUtils();

  const [form, setForm] = useState<MediaItemFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof MediaItemFormData, string>>>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload cover image to S3 (edit mode only — we need an item id)
  const uploadCoverMutation = trpc.contentItems.uploadCoverImage.useMutation({
    onSuccess: ({ url }) => {
      setField("coverImageUrl", url);
      toast.success("Cover image uploaded");
      setUploadingCover(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploadingCover(false);
    },
  });

  async function handleFileUpload(file: File) {
    if (!editItem?.id) {
      toast.info("Save the item first, then upload a cover image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large — maximum 5 MB");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    if (!allowed.includes(file.type as typeof allowed[number])) {
      toast.error("Unsupported format — use JPEG, PNG, WebP, or GIF");
      return;
    }
    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadCoverMutation.mutate({
        id: editItem.id,
        imageBase64: base64,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      });
    };
    reader.readAsDataURL(file);
  }

  // Populate form when editing
  useEffect(() => {
    if (editItem) {
      setForm({
        contentType: editItem.contentType,
        title: editItem.title,
        subtitle: editItem.subtitle ?? "",
        description: editItem.description ?? "",
        url: editItem.url ?? "",
        coverImageUrl: editItem.coverImageUrl ?? "",
        publishedDate: editItem.publishedDate ?? "",
        language: editItem.language ?? "en",
        authorNames: (editItem.authorNames ?? []).join(", "),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editItem, open]);

  const createMutation = trpc.contentItems.create.useMutation({
    onSuccess: () => {
      toast.success("Media item created");
      utils.contentItems.list.invalidate();
      utils.contentItems.getGroupCounts.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.contentItems.update.useMutation({
    onSuccess: () => {
      toast.success("Media item updated");
      utils.contentItems.list.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const errs: Partial<Record<keyof MediaItemFormData, string>> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.contentType) errs.contentType = "Type is required";
    if (form.url && !/^https?:\/\//.test(form.url)) errs.url = "Must be a valid URL";
    if (form.coverImageUrl && !/^https?:\/\//.test(form.coverImageUrl)) errs.coverImageUrl = "Must be a valid URL";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const authorNames = form.authorNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (isEdit && editItem) {
      updateMutation.mutate({
        id: editItem.id,
        contentType: form.contentType as Parameters<typeof updateMutation.mutate>[0]["contentType"],
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        url: form.url.trim() || null,
        coverImageUrl: form.coverImageUrl.trim() || null,
        publishedDate: form.publishedDate.trim() || null,
        language: form.language.trim() || null,
        authorNames,
      });
    } else {
      createMutation.mutate({
        contentType: form.contentType as Parameters<typeof createMutation.mutate>[0]["contentType"],
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        description: form.description.trim() || undefined,
        url: form.url.trim() || undefined,
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        publishedDate: form.publishedDate.trim() || undefined,
        language: form.language.trim() || undefined,
        authorNames,
      });
    }
  }

  function setField<K extends keyof MediaItemFormData>(key: K, value: MediaItemFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isEdit ? (
              <><Save className="w-4 h-4 text-primary" /> Edit Media Item</>
            ) : (
              <><Plus className="w-4 h-4 text-primary" /> New Media Item</>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-4 py-1">
            {/* Content type */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-type" className="text-xs font-medium">
                Content Type <span className="text-destructive">*</span>
              </Label>
              <Select value={form.contentType} onValueChange={(v) => setField("contentType", v)}>
                <SelectTrigger id="mi-type" className="h-8 text-sm">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contentType && <p className="text-xs text-destructive">{errors.contentType}</p>}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-title" className="text-xs font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mi-title"
                className="h-8 text-sm"
                placeholder="e.g. The Courage to Be Disliked"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            {/* Subtitle */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-subtitle" className="text-xs font-medium">Subtitle</Label>
              <Input
                id="mi-subtitle"
                className="h-8 text-sm"
                placeholder="Optional subtitle or episode title"
                value={form.subtitle}
                onChange={(e) => setField("subtitle", e.target.value)}
              />
            </div>

            {/* Author names */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-authors" className="text-xs font-medium">Author(s)</Label>
              <Input
                id="mi-authors"
                className="h-8 text-sm"
                placeholder="Adam Grant, Brené Brown (comma-separated)"
                value={form.authorNames}
                onChange={(e) => setField("authorNames", e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="mi-desc"
                className="text-sm resize-none"
                rows={3}
                placeholder="2–3 sentence summary"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label htmlFor="mi-url" className="text-xs font-medium">Primary URL</Label>
              <Input
                id="mi-url"
                className="h-8 text-sm"
                placeholder="https://…"
                value={form.url}
                onChange={(e) => setField("url", e.target.value)}
              />
              {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
            </div>

            {/* Cover image URL + upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cover Image</Label>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    id="mi-cover"
                    className="h-8 text-sm"
                    placeholder="https://… or upload a file →"
                    value={form.coverImageUrl}
                    onChange={(e) => setField("coverImageUrl", e.target.value)}
                  />
                  {errors.coverImageUrl && <p className="text-xs text-destructive">{errors.coverImageUrl}</p>}
                </div>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 flex-shrink-0 gap-1"
                  disabled={uploadingCover || !isEdit}
                  title={isEdit ? "Upload cover image" : "Save the item first to upload a cover"}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingCover ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  <span className="text-xs">{uploadingCover ? "Uploading…" : "Upload"}</span>
                </Button>
              </div>
              {/* Cover preview */}
              {form.coverImageUrl && /^https?:\/\//.test(form.coverImageUrl) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <img
                    src={form.coverImageUrl}
                    alt="Cover preview"
                    className="h-16 w-12 object-cover rounded border border-border shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <p className="text-[10px] text-muted-foreground">Preview</p>
                </div>
              )}
            </div>

            {/* Published date + language */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mi-date" className="text-xs font-medium">Published Date</Label>
                <Input
                  id="mi-date"
                  className="h-8 text-sm"
                  placeholder="2024-01-15"
                  value={form.publishedDate}
                  onChange={(e) => setField("publishedDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mi-lang" className="text-xs font-medium">Language</Label>
                <Input
                  id="mi-lang"
                  className="h-8 text-sm"
                  placeholder="en"
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value)}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="gap-1.5 bg-gradient-to-b from-primary to-primary/80 shadow-md hover:shadow-lg active:translate-y-px transition-all"
          >
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            ) : isEdit ? (
              <><Save className="w-3.5 h-3.5" /> Save Changes</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> Create Item</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
