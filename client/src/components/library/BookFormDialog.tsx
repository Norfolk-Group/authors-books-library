/**
 * BookFormDialog — Create or Edit a book profile.
 * Supports all key fields including format, possessionStatus, and all link types.
 * Styled with the Noir Dark Executive palette; buttons have 3D appearance + hover effects.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { InlineTagSelector } from "@/components/InlineTagSelector";
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
import { Loader2, BookPlus, Save } from "lucide-react";

type BookFormat = "physical" | "digital" | "audio" | "physical_digital" | "physical_audio" | "digital_audio" | "all" | "none";
type PossessionStatus = "owned" | "wishlist" | "reference" | "borrowed" | "gifted" | "read" | "reading" | "unread";

interface BookFormData {
  bookTitle: string;
  authorName: string;
  summary: string;
  keyThemes: string;
  isbn: string;
  publishedDate: string;
  publisher: string;
  coverImageUrl: string;
  amazonUrl: string;
  goodreadsUrl: string;
  wikipediaUrl: string;
  publisherUrl: string;
  format: BookFormat | "";
  possessionStatus: PossessionStatus | "";
}

interface BookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<BookFormData> & { bookTitle: string };
  onSuccess?: (bookTitle: string) => void;
}

const EMPTY: BookFormData = {
  bookTitle: "",
  authorName: "",
  summary: "",
  keyThemes: "",
  isbn: "",
  publishedDate: "",
  publisher: "",
  coverImageUrl: "",
  amazonUrl: "",
  goodreadsUrl: "",
  wikipediaUrl: "",
  publisherUrl: "",
  format: "",
  possessionStatus: "",
};

const FORMAT_OPTIONS: { value: BookFormat; label: string }[] = [
  { value: "physical", label: "Physical (print)" },
  { value: "digital", label: "Digital (PDF / EPUB)" },
  { value: "audio", label: "Audio" },
  { value: "physical_digital", label: "Physical + Digital" },
  { value: "physical_audio", label: "Physical + Audio" },
  { value: "digital_audio", label: "Digital + Audio" },
  { value: "all", label: "All formats" },
  { value: "none", label: "None (reference only)" },
];

const POSSESSION_OPTIONS: { value: PossessionStatus; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
  { value: "reference", label: "Reference (tracking only)" },
  { value: "borrowed", label: "Borrowed" },
  { value: "gifted", label: "Gifted" },
  { value: "read", label: "Read" },
  { value: "reading", label: "Currently reading" },
  { value: "unread", label: "Unread" },
];

export function BookFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: BookFormDialogProps) {
  const isEdit = !!initialData;
  const utils = trpc.useUtils();

  const [form, setForm] = useState<BookFormData>(() => ({
    ...EMPTY,
    ...initialData,
    format: (initialData?.format as BookFormat) ?? "",
    possessionStatus: (initialData?.possessionStatus as PossessionStatus) ?? "",
  }));

  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);

  const applyTagMutation = trpc.tags.applyToEntity.useMutation();

  const enrichBookMutation = trpc.bookProfiles.enrich.useMutation({
    onSuccess: (data) => {
      if (!data?.skipped) {
        toast.success(`"${form.bookTitle}" enriched`, {
          description: "Cover, summary, ratings, and links fetched from Google Books.",
        });
        utils.bookProfiles.get.invalidate({ bookTitle: form.bookTitle });
        utils.bookProfiles.getMany.invalidate();
      }
    },
    // Silent fail — enrichment is best-effort
  });

  const createMutation = trpc.bookProfiles.createBook.useMutation({
    onSuccess: async (data) => {
      toast.success(`"${data?.bookTitle}" added to your library.`, {
        description: "Enrichment running in background — cover and summary will populate shortly.",
      });
      utils.bookProfiles.getMany.invalidate();
      utils.library.getStats.invalidate();
      // Apply selected tags after creation
      for (const slug of selectedTagSlugs) {
        applyTagMutation.mutate({
          entityType: "book",
          entityKey: form.bookTitle,
          tagSlug: slug,
          action: "add",
        });
      }
      // Fire-and-forget enrichment
      enrichBookMutation.mutate({ bookTitle: form.bookTitle, authorName: form.authorName || undefined });
      onSuccess?.(form.bookTitle);
      onOpenChange(false);
      setForm(EMPTY);
      setSelectedTagSlugs([]);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.bookProfiles.updateBook.useMutation({
    onSuccess: async () => {
      toast.success(`"${form.bookTitle}" saved successfully.`);
      // Apply any newly selected tags
      for (const slug of selectedTagSlugs) {
        applyTagMutation.mutate({
          entityType: "book",
          entityKey: form.bookTitle,
          tagSlug: slug,
          action: "add",
        });
      }
      utils.bookProfiles.get.invalidate({ bookTitle: form.bookTitle });
      utils.bookProfiles.getMany.invalidate();
      utils.tags.getAllBookTagSlugs.invalidate();
      onSuccess?.(form.bookTitle);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange(key: keyof BookFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bookTitle.trim()) {
      toast.error("Please enter the book title.");
      return;
    }
    const payload = {
      bookTitle: form.bookTitle,
      authorName: form.authorName || undefined,
      summary: form.summary || undefined,
      keyThemes: form.keyThemes || undefined,
      isbn: form.isbn || undefined,
      publishedDate: form.publishedDate || undefined,
      publisher: form.publisher || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      amazonUrl: form.amazonUrl || undefined,
      goodreadsUrl: form.goodreadsUrl || undefined,
      wikipediaUrl: form.wikipediaUrl || undefined,
      publisherUrl: form.publisherUrl || undefined,
      format: (form.format || undefined) as BookFormat | undefined,
      possessionStatus: (form.possessionStatus || undefined) as PossessionStatus | undefined,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#1a1a2e] border border-[#2a2a4a] text-[#e8e8f0] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#c9b96e]">
            {isEdit ? <Save className="w-5 h-5" /> : <BookPlus className="w-5 h-5" />}
            {isEdit ? `Edit Book — ${initialData?.bookTitle}` : "Add New Book"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-5 py-2">
              {/* Core identity */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bookTitle" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Title <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="bookTitle"
                    value={form.bookTitle}
                    onChange={(e) => handleChange("bookTitle", e.target.value)}
                    placeholder="e.g. Thinking, Fast and Slow"
                    disabled={isEdit}
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e] disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="authorName" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Author Name
                  </Label>
                  <Input
                    id="authorName"
                    value={form.authorName}
                    onChange={(e) => handleChange("authorName", e.target.value)}
                    placeholder="e.g. Daniel Kahneman"
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="format" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                      Format
                    </Label>
                    <Select value={form.format} onValueChange={(v) => handleChange("format", v)}>
                      <SelectTrigger className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] focus:border-[#c9b96e]">
                        <SelectValue placeholder="Select format…" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a] text-[#e8e8f0]">
                        {FORMAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#2a2a4a]">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="possessionStatus" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                      Status
                    </Label>
                    <Select value={form.possessionStatus} onValueChange={(v) => handleChange("possessionStatus", v)}>
                      <SelectTrigger className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] focus:border-[#c9b96e]">
                        <SelectValue placeholder="Select status…" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a] text-[#e8e8f0]">
                        {POSSESSION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#2a2a4a]">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="summary" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Summary
                  </Label>
                  <Textarea
                    id="summary"
                    value={form.summary}
                    onChange={(e) => handleChange("summary", e.target.value)}
                    placeholder="Brief description of the book…"
                    rows={3}
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e] resize-none"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <InlineTagSelector
                    selectedSlugs={selectedTagSlugs}
                    onChange={setSelectedTagSlugs}
                    dark
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="keyThemes" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Key Themes
                  </Label>
                  <Input
                    id="keyThemes"
                    value={form.keyThemes}
                    onChange={(e) => handleChange("keyThemes", e.target.value)}
                    placeholder="e.g. decision-making, cognitive bias, behavioral economics"
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e]"
                  />
                </div>
              </div>

              {/* Publication details */}
              <div>
                <p className="text-[#a0a0c0] text-xs uppercase tracking-wider mb-3 border-b border-[#2a2a4a] pb-1">
                  Publication Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="isbn" className="text-[#7a7a9a] text-xs">ISBN</Label>
                    <Input id="isbn" value={form.isbn} onChange={(e) => handleChange("isbn", e.target.value)} placeholder="978-…" className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#3a3a5a] focus:border-[#c9b96e] text-sm h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="publishedDate" className="text-[#7a7a9a] text-xs">Published</Label>
                    <Input id="publishedDate" value={form.publishedDate} onChange={(e) => handleChange("publishedDate", e.target.value)} placeholder="2011" className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#3a3a5a] focus:border-[#c9b96e] text-sm h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="publisher" className="text-[#7a7a9a] text-xs">Publisher</Label>
                    <Input id="publisher" value={form.publisher} onChange={(e) => handleChange("publisher", e.target.value)} placeholder="Farrar, Straus and Giroux" className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#3a3a5a] focus:border-[#c9b96e] text-sm h-8" />
                  </div>
                </div>
              </div>

              {/* Links */}
              <div>
                <p className="text-[#a0a0c0] text-xs uppercase tracking-wider mb-3 border-b border-[#2a2a4a] pb-1">
                  Links
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "coverImageUrl" as const, label: "Cover Image URL", placeholder: "https://images-na.ssl-images-amazon.com/…" },
                    { key: "amazonUrl" as const, label: "Amazon", placeholder: "https://amazon.com/dp/…" },
                    { key: "goodreadsUrl" as const, label: "Goodreads", placeholder: "https://goodreads.com/book/show/…" },
                    { key: "wikipediaUrl" as const, label: "Wikipedia", placeholder: "https://en.wikipedia.org/wiki/…" },
                    { key: "publisherUrl" as const, label: "Publisher Page", placeholder: "https://publisher.com/book/…" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={key} className="text-[#7a7a9a] text-xs">{label}</Label>
                      <Input
                        id={key}
                        value={form[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder={placeholder}
                        className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#3a3a5a] focus:border-[#c9b96e] text-sm h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="border-[#2a2a4a] text-[#a0a0c0] hover:bg-[#2a2a4a] hover:text-[#e8e8f0] transition-all active:scale-95"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#c9b96e] hover:bg-[#d4c47a] text-[#0a0a1a] font-semibold shadow-[0_4px_0_#8a7a3a] hover:shadow-[0_2px_0_#8a7a3a] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : isEdit ? (
                <><Save className="w-4 h-4 mr-2" /> Save Changes</>
              ) : (
                <><BookPlus className="w-4 h-4 mr-2" /> Add Book</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
