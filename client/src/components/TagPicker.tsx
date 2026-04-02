/**
 * TagPicker.tsx
 * Compact popover tag picker for author and book cards.
 * Shows all available tags with checkboxes; clicking toggles the tag on/off.
 * Only visible to authenticated users.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tag, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TagPickerProps {
  entityType: "author" | "book";
  entityKey: string; // authorName or bookTitle
  /** Current tag slugs already applied to this entity */
  currentTagSlugs: string[];
  onTagsChanged?: (newSlugs: string[]) => void;
  /** If true, show the applied tags as pills (read-only display) */
  showApplied?: boolean;
}

export function TagPicker({
  entityType,
  entityKey,
  currentTagSlugs,
  onTagsChanged,
  showApplied = true,
}: TagPickerProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localSlugs, setLocalSlugs] = useState<string[]>(currentTagSlugs);

  const { data: allTags = [] } = trpc.tags.list.useQuery();
  const utils = trpc.useUtils();

  const applyMutation = trpc.tags.applyToEntity.useMutation({
    onError: (err) => toast.error("Failed to update tag", { description: err.message }),
  });

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const q = search.toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q));
  }, [allTags, search]);

  const appliedTags = useMemo(
    () => allTags.filter((t) => localSlugs.includes(t.slug)),
    [allTags, localSlugs]
  );

  const handleToggle = async (slug: string) => {
    const isApplied = localSlugs.includes(slug);
    const action = isApplied ? "remove" : "add";
    const newSlugs = isApplied
      ? localSlugs.filter((s) => s !== slug)
      : [...localSlugs, slug];

    // Optimistic update
    setLocalSlugs(newSlugs);
    onTagsChanged?.(newSlugs);

    try {
      await applyMutation.mutateAsync({ entityType, entityKey, tagSlug: slug, action });
      utils.tags.list.invalidate();
    } catch {
      // Rollback on error
      setLocalSlugs(localSlugs);
      onTagsChanged?.(localSlugs);
    }
  };

  if (allTags.length === 0 && !isAuthenticated) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Applied tag pills (read-only display) */}
      {showApplied && appliedTags.map((tag) => (
        <Badge
          key={tag.slug}
          style={{ backgroundColor: tag.color + "22", color: tag.color, borderColor: tag.color + "44" }}
          className="text-xs px-2 py-0.5 border font-medium"
        >
          {tag.name}
        </Badge>
      ))}

      {/* Tag picker trigger — only for authenticated users */}
      {isAuthenticated && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 rounded-full opacity-40 hover:opacity-100 transition-opacity"
              title="Add tags"
            >
              <Tag className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Tags</p>
            {allTags.length > 5 && (
              <Input
                placeholder="Search tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs mb-2"
              />
            )}
            {filteredTags.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No tags found</p>
            ) : (
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {filteredTags.map((tag) => {
                  const applied = localSlugs.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      onClick={() => handleToggle(tag.slug)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                        applied ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 truncate">{tag.name}</span>
                      {applied && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            {allTags.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-2">
                No tags yet. Create them in Admin → Tags.
              </p>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
