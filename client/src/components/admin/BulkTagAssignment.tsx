/**
 * BulkTagAssignment — Multi-select author list with tag dropdown for bulk tagging
 * Placed in Admin → Authors section
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tag, MagnifyingGlass, Spinner } from "@phosphor-icons/react";
import { AUTHORS } from "@/lib/libraryData";

export function BulkTagAssignment() {
  const [search, setSearch] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(new Set());
  const [selectedTagSlug, setSelectedTagSlug] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);

  const tagsQuery = trpc.tags.list.useQuery();
  const authorTagSlugsQuery = trpc.tags.getAllAuthorTagSlugs.useQuery();
  const utils = trpc.useUtils();

  const applyMutation = trpc.tags.applyToEntity.useMutation({
    onSuccess: () => {
      utils.tags.getAllAuthorTagSlugs.invalidate();
      utils.tags.list.invalidate();
    },
  });

  // Build a map of authorName → current tag slugs
  const authorTagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of authorTagSlugsQuery.data ?? []) {
      map.set(row.authorName, row.tagSlugs);
    }
    return map;
  }, [authorTagSlugsQuery.data]);

  // All unique author names from static data
  const allAuthors = useMemo(() => {
    const names = Array.from(new Set(AUTHORS.map((a) => a.name))).sort();
    return names;
  }, []);

  const filteredAuthors = useMemo(() => {
    if (!search.trim()) return allAuthors;
    const q = search.toLowerCase();
    return allAuthors.filter((n) => n.toLowerCase().includes(q));
  }, [allAuthors, search]);

  const toggleAuthor = (name: string) => {
    setSelectedAuthors((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAuthors.size === filteredAuthors.length) {
      setSelectedAuthors(new Set());
    } else {
      setSelectedAuthors(new Set(Array.from(filteredAuthors)));
    }
  };

  const handleApply = async () => {
    if (!selectedTagSlug || selectedAuthors.size === 0) return;
    setIsApplying(true);
    let success = 0;
    let failed = 0;
    for (const authorName of Array.from(selectedAuthors)) {
      try {
        await applyMutation.mutateAsync({
          entityType: "author",
          entityKey: authorName,
          tagSlug: selectedTagSlug,
          action: "add",
        });
        success++;
      } catch {
        failed++;
      }
    }
    setIsApplying(false);
    setSelectedAuthors(new Set());
    if (failed === 0) {
      toast.success(`Tag applied to ${success} author${success !== 1 ? "s" : ""}`);
    } else {
      toast.error(`Applied to ${success}, failed for ${failed}`);
    }
  };

  const selectedTag = tagsQuery.data?.find((t) => t.slug === selectedTagSlug);
  const allSelected = filteredAuthors.length > 0 && selectedAuthors.size === filteredAuthors.length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Tag size={18} className="text-primary" weight="duotone" />
        <h3 className="font-semibold text-sm text-card-foreground">Bulk Tag Assignment</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {allAuthors.length} authors
        </span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter authors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={selectedTagSlug} onValueChange={setSelectedTagSlug}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="Select tag…" />
          </SelectTrigger>
          <SelectContent>
            {(tagsQuery.data ?? []).map((tag) => (
              <SelectItem key={tag.slug} value={tag.slug}>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: tag.color ?? "#888" }}
                  />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={selectedAuthors.size === 0 || !selectedTagSlug || isApplying}
          onClick={handleApply}
        >
          {isApplying ? (
            <Spinner size={14} className="animate-spin mr-1" />
          ) : (
            <Tag size={14} className="mr-1" />
          )}
          Apply to {selectedAuthors.size > 0 ? selectedAuthors.size : "selected"}
        </Button>
      </div>

      {/* Select all row */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          id="bulk-select-all"
          className="h-3.5 w-3.5"
        />
        <label htmlFor="bulk-select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
          {allSelected ? "Deselect all" : `Select all (${filteredAuthors.length})`}
        </label>
        {selectedAuthors.size > 0 && selectedTag && (
          <Badge
            className="ml-auto text-[10px] px-1.5 py-0"
            style={{ background: selectedTag.color ?? "#888", color: "#fff" }}
          >
            {selectedTag.name} → {selectedAuthors.size}
          </Badge>
        )}
      </div>

      {/* Author list */}
      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
        {filteredAuthors.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No authors match</p>
        )}
        {filteredAuthors.map((name) => {
          const tags = authorTagMap.get(name) ?? [];
          const isChecked = selectedAuthors.has(name);
          return (
            <div
              key={name}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isChecked ? "bg-primary/10" : "hover:bg-muted/50"
              }`}
              onClick={() => toggleAuthor(name)}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggleAuthor(name)}
                className="h-3.5 w-3.5 pointer-events-none"
              />
              <span className="text-xs font-medium text-card-foreground flex-1 truncate">{name}</span>
              <div className="flex gap-1 flex-wrap justify-end max-w-[140px]">
                {tags.map((slug) => {
                  const tag = tagsQuery.data?.find((t) => t.slug === slug);
                  return tag ? (
                    <span
                      key={slug}
                      className="text-[9px] px-1.5 py-0 rounded-full text-white leading-4"
                      style={{ background: tag.color ?? "#888" }}
                    >
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
