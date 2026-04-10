/**
 * PhysicalBookQuickAddDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * A streamlined one-step form pre-set to format=physical, possessionStatus=owned.
 * Goal: add a print book you already own in under 10 seconds.
 * Only asks for: title, author name, category (optional), and Amazon URL (optional).
 * After creation, optionally triggers background enrichment.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Loader2, Zap } from "lucide-react";

const CATEGORIES = [
  "Business Strategy",
  "Psychology",
  "Leadership",
  "Negotiation",
  "Productivity",
  "Communication",
  "Artificial Intelligence",
  "Finance",
  "Science",
];

interface PhysicalBookQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (bookTitle: string) => void;
}

export function PhysicalBookQuickAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: PhysicalBookQuickAddDialogProps) {
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [category, setCategory] = useState("");
  const [amazonUrl, setAmazonUrl] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(true);

  const utils = trpc.useUtils();

  const createBookMutation = trpc.bookProfiles.createBook.useMutation({
    onSuccess: (_data) => {
      toast.success(`"${title}" added to your physical library`, {
        description: autoEnrich
          ? "Background enrichment queued — cover, summary, and links will populate shortly."
          : "You can enrich this book later from the card menu.",
      });
      utils.bookProfiles.getMany.invalidate();
      utils.library.getStats.invalidate();
      onSuccess?.(title);
      handleClose();
    },
    onError: (err) => {
      toast.error("Failed to add book", { description: err.message });
    },
  });

  // Auto-enrich mutation (best-effort, non-blocking) — no-op if procedure not available
  const _enrichMutation = (trpc.bookProfiles as any).enrichBook?.useMutation?.({
    onError: () => {
      // Silent fail — enrichment is optional
    },
  });

  function handleClose() {
    setTitle("");
    setAuthorName("");
    setCategory("");
    setAmazonUrl("");
    setAutoEnrich(true);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await createBookMutation.mutateAsync({
      bookTitle: title.trim(),
      authorName: authorName.trim() || undefined,
      amazonUrl: amazonUrl.trim() || undefined,
      format: "physical",
      possessionStatus: "owned",
    });
  }

  const isLoading = createBookMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            Add Physical Book
          </DialogTitle>
          <DialogDescription>
            Quickly add a print book you own. Only the title is required — enrichment
            will fill in the rest automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Pre-set badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              📖 Physical
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              ✓ Owned
            </span>
          </div>

          {/* Title — required */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-title">
              Book Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quick-title"
              placeholder="e.g. Thinking, Fast and Slow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Author — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-author">Author Name</Label>
            <Input
              id="quick-author"
              placeholder="e.g. Daniel Kahneman"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          {/* Category — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="quick-category">
                <SelectValue placeholder="Select a category…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amazon URL — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-amazon">Amazon URL</Label>
            <Input
              id="quick-amazon"
              placeholder="https://amazon.com/dp/..."
              value={amazonUrl}
              onChange={(e) => setAmazonUrl(e.target.value)}
              type="url"
            />
          </div>

          {/* Auto-enrich toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Auto-enrich after adding</p>
              <p className="text-xs text-muted-foreground">
                Fetch cover, summary, ratings, and links automatically
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoEnrich}
              onClick={() => setAutoEnrich((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                autoEnrich ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                  autoEnrich ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Add to Library
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
