/**
 * InlineTagPicker.tsx
 * Inline tag picker for author and book cards.
 * Shows current tags as badges, click to add/remove tags via popover.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

interface InlineTagPickerProps {
  entityType: "author" | "book";
  entityKey: string; // authorName or bookTitle
  currentTagSlugs?: string[];
  onTagsChange?: (newSlugs: string[]) => void;
}

export function InlineTagPicker({
  entityType,
  entityKey,
  currentTagSlugs = [],
  onTagsChange,
}: InlineTagPickerProps) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  // Fetch all available tags
  const { data: allTags = [] } = trpc.tags.list.useQuery();

  // Fetch current tags for the entity
  const { data: entityTags = [] } = trpc.tags.getForEntity.useQuery({
    entityType,
    entityKey,
  });

  // Apply/remove tag mutation
  const applyMutation = trpc.tags.applyToEntity.useMutation({
    onSuccess: (result) => {
      utils.tags.getForEntity.invalidate({ entityType, entityKey });
      utils.tags.list.invalidate();
      onTagsChange?.(result.tags);
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const handleToggleTag = (tagSlug: string, currentlyApplied: boolean) => {
    applyMutation.mutate({
      entityType,
      entityKey,
      tagSlug,
      action: currentlyApplied ? "remove" : "add",
    });
  };

  const appliedSlugs = new Set(entityTags.map((t) => t.slug));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Current tags as badges */}
      {entityTags.map((tag) => (
        <Badge
          key={tag.slug}
          style={{ backgroundColor: tag.color, color: "#fff" }}
          className="text-xs px-2 py-0.5 flex items-center gap-1 cursor-pointer hover:opacity-80 transition"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTag(tag.slug, true);
          }}
        >
          {tag.name}
          <X className="w-3 h-3" />
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3 h-3 mr-1" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3"
          onClick={(e) => e.stopPropagation()}
          align="start"
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold">Add Tags</p>
            {allTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags available. Create tags in Admin → Tags.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const isApplied = appliedSlugs.has(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTag(tag.slug, isApplied);
                      }}
                      disabled={applyMutation.isPending}
                      style={{
                        backgroundColor: isApplied ? tag.color : "transparent",
                        color: isApplied ? "#fff" : tag.color,
                        borderColor: tag.color,
                      }}
                      className="text-xs px-2 py-1 rounded border transition hover:scale-105 disabled:opacity-50"
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
