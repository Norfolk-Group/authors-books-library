/**
 * InlineTagSelector.tsx
 * A local-only tag selector for use inside CRUD dialogs.
 * Does NOT persist to the database — just manages a list of selected slugs
 * that the parent form can apply after the entity is created/updated.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tag, X, Check } from "lucide-react";

interface InlineTagSelectorProps {
  /** Currently selected tag slugs */
  selectedSlugs: string[];
  /** Called whenever the selection changes */
  onChange: (slugs: string[]) => void;
  /** Optional label override */
  label?: string;
  /** Dark theme class names (matches AuthorFormDialog / BookFormDialog palette) */
  dark?: boolean;
}

export function InlineTagSelector({
  selectedSlugs,
  onChange,
  label = "Tags",
  dark = false,
}: InlineTagSelectorProps) {
  const [search, setSearch] = useState("");
  const { data: allTags = [] } = trpc.tags.list.useQuery();

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const q = search.toLowerCase();
    return allTags.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.includes(q)
    );
  }, [allTags, search]);

  const selectedTags = useMemo(
    () => allTags.filter((t) => selectedSlugs.includes(t.slug)),
    [allTags, selectedSlugs]
  );

  function toggle(slug: string) {
    if (selectedSlugs.includes(slug)) {
      onChange(selectedSlugs.filter((s) => s !== slug));
    } else {
      onChange([...selectedSlugs, slug]);
    }
  }

  function remove(slug: string) {
    onChange(selectedSlugs.filter((s) => s !== slug));
  }

  const inputCls = dark
    ? "bg-[#12122a] border-[#2a2a4a] text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:border-[#c9b96e] text-sm h-8"
    : "text-sm h-8";

  const labelCls = dark
    ? "text-[#a0a0c0] text-xs uppercase tracking-wider"
    : "text-xs uppercase tracking-wider text-muted-foreground";

  const pillContainerCls = dark
    ? "min-h-[36px] flex flex-wrap gap-1.5 p-2 rounded-md border border-[#2a2a4a] bg-[#12122a]"
    : "min-h-[36px] flex flex-wrap gap-1.5 p-2 rounded-md border bg-muted/30";

  const dropdownCls = dark
    ? "mt-1 rounded-md border border-[#2a2a4a] bg-[#1a1a2e] max-h-40 overflow-y-auto"
    : "mt-1 rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md";

  const itemBaseCls = "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors";
  const itemDarkCls = "hover:bg-[#2a2a4a] text-[#e8e8f0]";
  const itemLightCls = "hover:bg-accent text-foreground";

  return (
    <div className="space-y-1.5">
      <Label className={labelCls}>
        <Tag className="inline w-3 h-3 mr-1 opacity-70" />
        {label}
      </Label>

      {/* Selected tag pills */}
      {selectedTags.length > 0 && (
        <div className={pillContainerCls}>
          {selectedTags.map((tag) => (
            <Badge
              key={tag.slug}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-xs font-medium"
              style={{
                backgroundColor: tag.color ? `${tag.color}22` : undefined,
                borderColor: tag.color ?? undefined,
                color: tag.color ?? undefined,
                border: `1px solid ${tag.color ?? "#6366F1"}44`,
              }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => remove(tag.slug)}
                className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tags…"
        className={inputCls}
      />

      {allTags.length > 0 && (
        <div className={dropdownCls}>
          {filteredTags.length === 0 ? (
            <p className={cn("px-3 py-2 text-xs opacity-50", dark ? "text-[#a0a0c0]" : "text-muted-foreground")}>
              No tags found
            </p>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selectedSlugs.includes(tag.slug);
              return (
                <div
                  key={tag.slug}
                  className={cn(itemBaseCls, dark ? itemDarkCls : itemLightCls)}
                  onClick={() => toggle(tag.slug)}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "border-transparent"
                        : dark
                        ? "border-[#4a4a6a]"
                        : "border-border"
                    )}
                    style={isSelected ? { backgroundColor: tag.color ?? "#6366F1" } : undefined}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color ?? "#6366F1" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
