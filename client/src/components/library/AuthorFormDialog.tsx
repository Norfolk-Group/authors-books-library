/**
 * AuthorFormDialog — Create or Edit an author profile.
 * Used for both "Add Author" (no initialData) and "Edit Author" (with initialData).
 * Styled with the Noir Dark Executive palette; buttons have 3D appearance + hover effects.
 */
import { useState } from "react";
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
import { CATEGORIES } from "@/lib/libraryData";
import { Loader2, UserPlus, Save } from "lucide-react";

interface AuthorFormData {
  authorName: string;
  category: string;
  bio: string;
  avatarUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  substackUrl: string;
  mediumUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  githubUrl: string;
  podcastUrl: string;
  newsletterUrl: string;
  blogUrl: string;
  speakingUrl: string;
  businessWebsiteUrl: string;
}

interface AuthorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<AuthorFormData> & { authorName: string };
  onSuccess?: (authorName: string) => void;
}

const EMPTY: AuthorFormData = {
  authorName: "",
  category: "",
  bio: "",
  avatarUrl: "",
  websiteUrl: "",
  twitterUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
  substackUrl: "",
  mediumUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  githubUrl: "",
  podcastUrl: "",
  newsletterUrl: "",
  blogUrl: "",
  speakingUrl: "",
  businessWebsiteUrl: "",
};

const SOCIAL_FIELDS: { key: keyof AuthorFormData; label: string; placeholder: string }[] = [
  { key: "websiteUrl", label: "Website", placeholder: "https://example.com" },
  { key: "twitterUrl", label: "Twitter / X", placeholder: "https://x.com/username" },
  { key: "linkedinUrl", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
  { key: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/@channel" },
  { key: "substackUrl", label: "Substack", placeholder: "https://username.substack.com" },
  { key: "mediumUrl", label: "Medium", placeholder: "https://medium.com/@username" },
  { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/username" },
  { key: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@username" },
  { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/username" },
  { key: "githubUrl", label: "GitHub", placeholder: "https://github.com/username" },
  { key: "podcastUrl", label: "Podcast", placeholder: "https://podcast-url.com" },
  { key: "newsletterUrl", label: "Newsletter", placeholder: "https://newsletter-url.com" },
  { key: "blogUrl", label: "Blog", placeholder: "https://blog.example.com" },
  { key: "speakingUrl", label: "Speaking / Events", placeholder: "https://speaking-url.com" },
  { key: "businessWebsiteUrl", label: "Business Website", placeholder: "https://company.com" },
  { key: "avatarUrl", label: "Avatar / Photo URL", placeholder: "https://cdn.example.com/photo.jpg" },
];

export function AuthorFormDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: AuthorFormDialogProps) {
  const isEdit = !!initialData;

 const utils = trpc.useUtils();

  const [form, setForm] = useState<AuthorFormData>(() => ({
    ...EMPTY,
    ...initialData,
  }));

  const enrichMutation = trpc.authorProfiles.enrich.useMutation({
    onSuccess: (data) => {
      if (!data?.cached) {
        toast.success(`Bio and links enriched for "${form.authorName}"`, {
          description: "Wikipedia, social platforms, and academic data fetched.",
        });
        utils.authorProfiles.get.invalidate({ authorName: form.authorName });
        utils.authorProfiles.getMany.invalidate();
      }
    },
    // Silent fail — enrichment is best-effort
  });

  const createMutation = trpc.authorProfiles.createAuthor.useMutation({
    onSuccess: (data) => {
      toast.success(`"${data?.authorName}" added to your library.`, {
        description: "Enrichment running in background — bio and links will populate shortly.",
      });
      utils.authorProfiles.getMany.invalidate();
      utils.library.getStats.invalidate();
      // Fire-and-forget enrichment
      enrichMutation.mutate({ authorName: form.authorName });
      onSuccess?.(form.authorName);
      onOpenChange(false);
      setForm(EMPTY);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateMutation = trpc.authorProfiles.updateAuthor.useMutation({
    onSuccess: () => {
      toast.success(`"${form.authorName}" saved successfully.`);
      utils.authorProfiles.get.invalidate({ authorName: form.authorName });
      utils.authorProfiles.getMany.invalidate();
      onSuccess?.(form.authorName);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange(key: keyof AuthorFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.authorName.trim()) {
      toast.error("Please enter the author's full name.");
      return;
    }
    if (isEdit) {
      updateMutation.mutate({ ...form });
    } else {
      createMutation.mutate({ ...form });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#1a1a2e] border border-[#2a2a4a] text-[#e8e8f0] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#c9b96e]">
            {isEdit ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isEdit ? `Edit Author — ${initialData?.authorName}` : "Add New Author"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-5 py-2">
              {/* Core identity */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="authorName" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Full Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="authorName"
                    value={form.authorName}
                    onChange={(e) => handleChange("authorName", e.target.value)}
                    placeholder="e.g. Adam Grant"
                    disabled={isEdit}
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e] disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Category
                  </Label>
                  <Select value={form.category} onValueChange={(v) => handleChange("category", v)}>
                    <SelectTrigger className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] focus:border-[#c9b96e]">
                      <SelectValue placeholder="Select a category…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a] text-[#e8e8f0]">
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="focus:bg-[#2a2a4a]">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bio" className="text-[#a0a0c0] text-xs uppercase tracking-wider">
                    Short Bio
                  </Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(e) => handleChange("bio", e.target.value)}
                    placeholder="Brief description of the author's work and expertise…"
                    rows={3}
                    className="bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e] resize-none"
                  />
                </div>
              </div>

              {/* Platform links */}
              <div>
                <p className="text-[#a0a0c0] text-xs uppercase tracking-wider mb-3 border-b border-[#2a2a4a] pb-1">
                  Platform Links & Social Media
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={key} className="text-[#7a7a9a] text-xs">
                        {label}
                      </Label>
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
                <><UserPlus className="w-4 h-4 mr-2" /> Add Author</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
