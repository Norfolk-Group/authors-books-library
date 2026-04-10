/**
 * TagTaxonomyMatrix — Admin Tags section
 * Shows a matrix of all tags × all tagged entities (authors + books).
 * Clicking a cell toggles the tag on that entity (add/remove) via applyToEntity mutation.
 * Optimistic updates for instant feedback.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MagnifyingGlass, Tag, User, BookOpen, Check, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

type EntityRow = {
  key: string;
  label: string;
  type: "author" | "book";
  tagSlugs: Set<string>;
};

export function TagTaxonomyMatrix() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<"all" | "author" | "book">("all");
  const utils = trpc.useUtils();

  const tagsQuery = trpc.tags.list.useQuery(undefined, { staleTime: 60_000 });
  const authorTagsQuery = trpc.tags.getAllAuthorTagSlugs.useQuery(undefined, { staleTime: 30_000 });
  const bookTagsQuery = trpc.tags.getAllBookTagSlugs.useQuery(undefined, { staleTime: 30_000 });

  const tags = tagsQuery.data ?? [];
  const isLoading = tagsQuery.isLoading || authorTagsQuery.isLoading || bookTagsQuery.isLoading;

  // Track pending cell toggles for optimistic UI
  const [pending, setPending] = useState<Set<string>>(new Set());

  const applyMutation = trpc.tags.applyToEntity.useMutation({
    onMutate: ({ entityKey, tagSlug }) => {
      const cellKey = `${entityKey}::${tagSlug}`;
      setPending((prev) => new Set(Array.from(prev).concat(cellKey)));
    },
    onSuccess: (_, { entityKey, tagSlug, action: _action }) => {
      const cellKey = `${entityKey}::${tagSlug}`;
      setPending((prev) => {
        const next = new Set(Array.from(prev).filter(k => k !== cellKey));
        return next;
      });
      utils.tags.getAllAuthorTagSlugs.invalidate();
      utils.tags.getAllBookTagSlugs.invalidate();
      utils.tags.list.invalidate();
    },
    onError: (err, { entityKey, tagSlug }) => {
      const cellKey = `${entityKey}::${tagSlug}`;
      setPending((prev) => {
        const next = new Set(Array.from(prev).filter(k => k !== cellKey));
        return next;
      });
      toast.error(`Failed to update tag: ${err.message}`);
    },
  });

  const entities: EntityRow[] = useMemo(() => {
    const rows: EntityRow[] = [];
    if (entityType !== "book") {
      for (const a of authorTagsQuery.data ?? []) {
        rows.push({ key: a.authorName, label: a.authorName, type: "author", tagSlugs: new Set(a.tagSlugs) });
      }
    }
    if (entityType !== "author") {
      for (const b of bookTagsQuery.data ?? []) {
        rows.push({ key: b.bookTitle, label: b.bookTitle, type: "book", tagSlugs: new Set(b.tagSlugs) });
      }
    }
    return rows;
  }, [authorTagsQuery.data, bookTagsQuery.data, entityType]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entities;
    const q = search.toLowerCase();
    return entities.filter((e) => e.label.toLowerCase().includes(q));
  }, [entities, search]);

  const handleCellClick = (entity: EntityRow, tagSlug: string) => {
    const cellKey = `${entity.key}::${tagSlug}`;
    if (pending.has(cellKey)) return; // debounce
    const hasTag = entity.tagSlugs.has(tagSlug);
    applyMutation.mutate({
      entityType: entity.type,
      entityKey: entity.key,
      tagSlug,
      action: hasTag ? "remove" : "add",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="mt-6 text-center text-muted-foreground text-sm py-8">
        No tags created yet. Create tags above to see the taxonomy matrix.
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="mt-4 space-y-3">
        <MatrixControls search={search} setSearch={setSearch} entityType={entityType} setEntityType={setEntityType} />
        <div className="text-center text-muted-foreground text-sm py-8">No tagged entities match your search.</div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Tag Taxonomy Matrix</h3>
        <span className="text-xs text-muted-foreground">{filtered.length} entities × {tags.length} tags · click a cell to toggle</span>
      </div>
      <MatrixControls search={search} setSearch={setSearch} entityType={entityType} setEntityType={setEntityType} />

      {/* Scrollable matrix table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border/60">
              <th className="sticky left-0 bg-muted/80 backdrop-blur-sm px-3 py-2 text-left font-semibold text-muted-foreground min-w-[200px] z-10">
                Entity
              </th>
              {tags.map((tag) => (
                <th
                  key={tag.slug}
                  className="px-2 py-2 text-center font-medium whitespace-nowrap"
                  style={{ color: tag.color ?? "#6b7280" }}
                  title={tag.name}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Tag className="w-3 h-3" />
                    <span className="max-w-[64px] truncate block">{tag.name}</span>
                    <span className="text-muted-foreground font-normal">({tag.usageCount ?? 0})</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entity, rowIdx) => (
              <tr
                key={entity.key}
                className={`border-b border-border/40 transition-colors hover:bg-muted/20 ${rowIdx % 2 === 0 ? "" : "bg-muted/10"}`}
              >
                <td className="sticky left-0 bg-background/95 backdrop-blur-sm px-3 py-1.5 font-medium z-10">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {entity.type === "author" ? (
                      <User className="w-3 h-3 text-blue-500 shrink-0" />
                    ) : (
                      <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate max-w-[160px]" title={entity.label}>{entity.label}</span>
                  </div>
                </td>
                {tags.map((tag) => {
                  const hasTag = entity.tagSlugs.has(tag.slug);
                  const cellKey = `${entity.key}::${tag.slug}`;
                  const isPending = pending.has(cellKey);
                  return (
                    <td key={tag.slug} className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleCellClick(entity, tag.slug)}
                        disabled={isPending}
                        title={hasTag ? `Remove "${tag.name}" from ${entity.label}` : `Add "${tag.name}" to ${entity.label}`}
                        className={`
                          inline-flex items-center justify-center w-6 h-6 rounded-full transition-all duration-150
                          ${isPending ? "opacity-50 cursor-wait scale-90" : "cursor-pointer hover:scale-110 active:scale-95"}
                          ${hasTag
                            ? "text-white shadow-sm hover:opacity-80"
                            : "bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/60 hover:border-border"
                          }
                        `}
                        style={hasTag ? { backgroundColor: tag.color ?? "#6b7280" } : undefined}
                      >
                        {isPending ? (
                          <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
                        ) : hasTag ? (
                          <Check className="w-3 h-3" weight="bold" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3 text-blue-500" />
          <span>{(authorTagsQuery.data ?? []).length} tagged authors</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 text-amber-500" />
          <span>{(bookTagsQuery.data ?? []).length} tagged books</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px]"
            style={{ backgroundColor: "#6366F1" }}
          >
            <Check className="w-2.5 h-2.5" weight="bold" />
          </span>
          <span>Tag applied — click to remove</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/30 border border-border/40 text-muted-foreground">
            <Plus className="w-2.5 h-2.5" />
          </span>
          <span>Not tagged — click to add</span>
        </div>
      </div>
    </div>
  );
}

function MatrixControls({
  search,
  setSearch,
  entityType,
  setEntityType,
}: {
  search: string;
  setSearch: (v: string) => void;
  entityType: "all" | "author" | "book";
  setEntityType: (v: "all" | "author" | "book") => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[180px]">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-xs"
          placeholder="Filter entities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-1">
        {(["all", "author", "book"] as const).map((t) => (
          <Badge
            key={t}
            variant={entityType === t ? "default" : "outline"}
            className="cursor-pointer capitalize text-xs"
            onClick={() => setEntityType(t)}
          >
            {t === "all" ? "All" : t === "author" ? "Authors" : "Books"}
          </Badge>
        ))}
      </div>
    </div>
  );
}
