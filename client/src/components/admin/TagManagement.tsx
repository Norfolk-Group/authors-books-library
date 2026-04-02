/**
 * TagManagement.tsx
 * Full CRUD UI for the global tags table.
 * Allows admins to create, rename, change color, delete tags.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export function TagManagement() {
  const utils = trpc.useUtils();
  const { data: tags = [], isLoading } = trpc.tags.list.useQuery();
  const createMutation = trpc.tags.create.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate();
      setNewTagName("");
      setNewTagColor("#6366F1");
      toast.success("Tag created");
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });
  const updateMutation = trpc.tags.update.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate();
      setEditingId(null);
      toast.success("Tag updated");
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });
  const deleteMutation = trpc.tags.delete.useMutation({
    onSuccess: () => {
      utils.tags.list.invalidate();
      toast.success("Tag deleted");
    },
    onError: (err) => toast.error("Error", { description: err.message }),
  });

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366F1");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = () => {
    if (!newTagName.trim()) return;
    createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const startEdit = (tag: typeof tags[0]) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, name: editName.trim(), color: editColor });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Delete tag "${name}"? This will remove it from all authors and books.`)) {
      deleteMutation.mutate({ id });
    }
  };

  if (isLoading) return <div className="p-4">Loading tags...</div>;

  return (
    <div className="space-y-6">
      {/* Create New Tag */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Create New Tag</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label htmlFor="new-tag-name">Tag Name</Label>
            <Input
              id="new-tag-name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. Must Read, Leadership, AI"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <Label htmlFor="new-tag-color">Color</Label>
            <Input
              id="new-tag-color"
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-20 h-10"
            />
          </div>
          <Button onClick={handleCreate} disabled={!newTagName.trim() || createMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
      </Card>

      {/* Tags List */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">All Tags ({tags.length})</h3>
        {tags.length === 0 ? (
          <p className="text-muted-foreground">No tags yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition"
              >
                {editingId === tag.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    />
                    <Input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-16 h-9"
                    />
                    <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge
                      style={{ backgroundColor: tag.color, color: "#fff" }}
                      className="cursor-pointer"
                      onClick={() => startEdit(tag)}
                    >
                      {tag.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex-1">
                      {tag.slug} • {tag.usageCount} uses
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(tag.id, tag.name)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
