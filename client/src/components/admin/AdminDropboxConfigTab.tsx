/**
 * AdminDropboxConfigTab — Dropbox Folder Configuration
 *
 * Professional UX for managing all Dropbox folder connections:
 * - View all configured folders with live validation status
 * - Add / edit / delete folder configs
 * - Toggle enabled/disabled with animated switch
 * - Validate individual paths or all paths at once
 * - Open folder directly in Dropbox web
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  Link,
  CloudArrowUp,
  ArrowUp,
  Tray,
  Archive,
  PaintBrush,
  Database,
  Question,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InfoTip } from "@/components/admin/InfoTip";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FolderConfig {
  id: number;
  folderKey: string;
  label: string;
  description: string | null;
  dropboxPath: string;
  dropboxWebUrl: string | null;
  category: string;
  enabled: boolean;
  validationStatus: "valid" | "invalid" | "unchecked";
  validationError: string | null;
  lastValidatedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Category icon / label / color maps ───────────────────────────────────────

const CAT_ICONS: Record<string, React.ReactNode> = {
  backup: <Archive size={16} weight="duotone" />,
  inbox: <Tray size={16} weight="duotone" />,
  source: <Database size={16} weight="duotone" />,
  design: <PaintBrush size={16} weight="duotone" />,
  export: <ArrowUp size={16} weight="duotone" />,
  other: <FolderOpen size={16} weight="duotone" />,
};

const CAT_LABELS: Record<string, string> = {
  backup: "Backup",
  inbox: "Inbox",
  source: "Source",
  design: "Design",
  export: "Export",
  other: "Other",
};

const CAT_COLORS: Record<string, string> = {
  backup: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  inbox: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  source: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300",
  design: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300",
  export: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  other: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300",
};

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  folderKey: "",
  label: "",
  description: "",
  dropboxPath: "",
  dropboxWebUrl: "",
  category: "other" as const,
  enabled: true,
  sortOrder: 100,
};

type FormState = typeof EMPTY_FORM;

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminDropboxConfigTab() {
  const utils = trpc.useUtils();

  const { data: folders = [], isLoading } = trpc.dropboxConfig.list.useQuery();

  const createMutation = trpc.dropboxConfig.create.useMutation({
    onSuccess: () => {
      utils.dropboxConfig.list.invalidate();
      toast.success("Folder configuration created");
      setShowCreate(false);
    },
    onError: (err) => toast.error(`Create failed: ${err.message}`),
  });

  const updateMutation = trpc.dropboxConfig.update.useMutation({
    onSuccess: () => {
      utils.dropboxConfig.list.invalidate();
      toast.success("Changes saved");
      setShowEdit(false);
    },
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  const deleteMutation = trpc.dropboxConfig.delete.useMutation({
    onSuccess: () => {
      utils.dropboxConfig.list.invalidate();
      toast.success("Folder configuration deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const toggleMutation = trpc.dropboxConfig.toggleEnabled.useMutation({
    onSuccess: () => utils.dropboxConfig.list.invalidate(),
    onError: (err) => toast.error(`Toggle failed: ${err.message}`),
  });

  const validateOneMutation = trpc.dropboxConfig.validatePath.useMutation({
    onSuccess: (result) => {
      utils.dropboxConfig.list.invalidate();
      if (result.valid) {
        toast.success("Path is valid and accessible in Dropbox");
      } else {
        toast.error(`Path invalid: ${result.error ?? "Not found"}`);
      }
      setValidatingId(null);
    },
    onError: (err) => {
      toast.error(`Validation failed: ${err.message}`);
      setValidatingId(null);
    },
  });

  const validateAllMutation = trpc.dropboxConfig.validateAll.useMutation({
    onSuccess: (result) => {
      utils.dropboxConfig.list.invalidate();
      if (result.invalid === 0) {
        toast.success(`All ${result.valid} paths validated successfully`);
      } else {
        toast.warning(`${result.valid} valid, ${result.invalid} invalid paths found`);
      }
    },
    onError: (err) => toast.error(`Validation failed: ${err.message}`),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<FolderConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderConfig | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const openEdit = (f: FolderConfig) => {
    setEditTarget(f);
    setForm({
      folderKey: f.folderKey,
      label: f.label,
      description: f.description ?? "",
      dropboxPath: f.dropboxPath,
      dropboxWebUrl: f.dropboxWebUrl ?? "",
      category: f.category as any,
      enabled: f.enabled,
      sortOrder: f.sortOrder,
    });
    setShowEdit(true);
  };

  const handleValidateOne = (f: FolderConfig) => {
    setValidatingId(f.id);
    validateOneMutation.mutate({ id: f.id, path: f.dropboxPath });
  };

  const handleToggle = (f: FolderConfig) => {
    toggleMutation.mutate({ id: f.id, enabled: !f.enabled });
  };

  const openDropbox = (f: FolderConfig) => {
    const url = f.dropboxWebUrl || `https://www.dropbox.com/home${encodeURIComponent(f.dropboxPath)}`;
    window.open(url, "_blank");
  };

  const typedFolders = folders as FolderConfig[];
  const enabledCount = typedFolders.filter((f) => f.enabled).length;
  const validCount = typedFolders.filter((f) => f.validationStatus === "valid").length;
  const invalidCount = typedFolders.filter((f) => f.validationStatus === "invalid").length;

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Dropbox Folder Configuration</h2>
            <InfoTip text="These folder connections are stored in the DB (dropbox_folder_configs table). Paths are relative to the Dropbox account root (e.g. /Apps NAI/RC Library App Data/...). Disabling a folder prevents the app from reading/writing to it without deleting the config." side="right" />
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage every Dropbox folder connection used for backup, content ingestion, and export.
            Folders can be enabled or disabled independently without losing their configuration.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => validateAllMutation.mutate()}
            disabled={validateAllMutation.isPending || typedFolders.length === 0}
            className="gap-2"
          >
            {validateAllMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowsClockwise size={14} weight="bold" />
            )}
            Validate All
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus size={14} weight="bold" />
            Add Folder
          </Button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Folders", value: typedFolders.length, color: "", tip: "Total number of Dropbox folder connections configured in the database." },
          { label: "Enabled", value: enabledCount, color: "text-green-600", tip: "Folders currently active — the app will read/write to these." },
          { label: "Validated OK", value: validCount, color: "text-blue-600", tip: "Folders confirmed accessible via live Dropbox API check. Click 'Validate All' to refresh." },
          {
            label: "Issues",
            value: invalidCount,
            color: invalidCount > 0 ? "text-red-600" : "text-muted-foreground",
            tip: "Folders that returned an error during validation — path may not exist or access was denied.",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <InfoTip text={s.tip} size={11} />
            </div>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Folder list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : typedFolders.length === 0 ? (
        <Card className="p-14 text-center">
          <CloudArrowUp size={48} className="mx-auto text-muted-foreground mb-4" weight="thin" />
          <p className="text-muted-foreground mb-4">No folder configurations yet.</p>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={16} />
            Add your first folder
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {typedFolders.map((f) => (
            <Card
              key={f.id}
              className={`transition-opacity duration-200 ${!f.enabled ? "opacity-55" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Validation status icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {f.validationStatus === "valid" ? (
                      <CheckCircle size={20} weight="fill" className="text-green-500" />
                    ) : f.validationStatus === "invalid" ? (
                      <XCircle size={20} weight="fill" className="text-red-500" />
                    ) : (
                      <Question size={20} weight="fill" className="text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.label}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${CAT_COLORS[f.category] ?? CAT_COLORS.other}`}
                      >
                        {CAT_ICONS[f.category] ?? CAT_ICONS.other}
                        {CAT_LABELS[f.category] ?? f.category}
                      </Badge>
                      {!f.enabled && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                      {f.validationStatus === "invalid" && (
                        <Badge variant="destructive" className="text-xs">
                          {f.validationError ?? "Path not found"}
                        </Badge>
                      )}
                    </div>

                    {f.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <FolderOpen size={12} className="text-muted-foreground flex-shrink-0" />
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-md">
                        {f.dropboxPath}
                      </code>
                    </div>

                    {f.lastValidatedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Validated {new Date(f.lastValidatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={() => handleToggle(f)}
                      disabled={toggleMutation.isPending}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <Separator orientation="vertical" className="h-5 mx-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Validate path"
                      onClick={() => handleValidateOne(f)}
                      disabled={validatingId === f.id}
                    >
                      {validatingId === f.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowsClockwise size={14} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Open in Dropbox"
                      onClick={() => openDropbox(f)}
                    >
                      <Link size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={() => openEdit(f)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteTarget(f)}
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <FolderFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Folder Configuration"
        description="Connect a new Dropbox folder to the RC Library app."
        form={form}
        setForm={setForm}
        onSubmit={() =>
          createMutation.mutate({
            folderKey: form.folderKey,
            label: form.label,
            description: form.description || undefined,
            dropboxPath: form.dropboxPath,
            dropboxWebUrl: form.dropboxWebUrl || undefined,
            category: form.category,
            enabled: form.enabled,
            sortOrder: form.sortOrder,
          })
        }
        isPending={createMutation.isPending}
        submitLabel="Create Folder"
        showKey
      />

      {/* ── Edit Dialog ── */}
      <FolderFormDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Folder Configuration"
        description="Update the Dropbox folder connection settings."
        form={form}
        setForm={setForm}
        onSubmit={() =>
          editTarget &&
          updateMutation.mutate({
            id: editTarget.id,
            label: form.label,
            description: form.description || undefined,
            dropboxPath: form.dropboxPath,
            dropboxWebUrl: form.dropboxWebUrl || undefined,
            category: form.category,
            enabled: form.enabled,
            sortOrder: form.sortOrder,
          })
        }
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        showKey={false}
      />

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.label}</strong>? This removes only the configuration
              record — no files in Dropbox will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Folder Form Dialog ────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "backup", label: "Backup — primary backup destination" },
  { value: "inbox", label: "Inbox — new files to ingest" },
  { value: "source", label: "Source — reference data" },
  { value: "design", label: "Design Assets — logos, banners, graphics" },
  { value: "other", label: "Other" },
];

interface FolderFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
  showKey: boolean;
}

function FolderFormDialog({
  open,
  onClose,
  title,
  description,
  form,
  setForm,
  onSubmit,
  isPending,
  submitLabel,
  showKey,
}: FolderFormDialogProps) {
  const set = (k: keyof FormState, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const isValid = form.label.trim().length > 0 && form.dropboxPath.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {showKey && (
            <div className="space-y-1.5">
              <Label htmlFor="folderKey">
                Folder Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="folderKey"
                placeholder="backup_main"
                value={form.folderKey}
                onChange={(e) => set("folderKey", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Unique machine identifier. Lowercase, numbers, underscores only.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="label">
              Display Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="label"
              placeholder="Authors & Books Backup"
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What is this folder used for?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dropboxPath">
              Dropbox Path <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dropboxPath"
              placeholder="/Apps NAI/RC Library App Data/Authors and Books Backup"
              value={form.dropboxPath}
              onChange={(e) => set("dropboxPath", e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Full path from Dropbox root. Must start with /.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dropboxWebUrl">Dropbox Web URL (optional)</Label>
            <Input
              id="dropboxWebUrl"
              placeholder="https://www.dropbox.com/scl/fo/..."
              value={form.dropboxWebUrl}
              onChange={(e) => set("dropboxWebUrl", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shared link for direct browser access. Paste from Dropbox "Share folder" button.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => set("category", e.target.value as any)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch
              id="enabled"
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
              className="data-[state=checked]:bg-green-500"
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              {form.enabled ? "Enabled — active in app" : "Disabled — inactive"}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !isValid}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
