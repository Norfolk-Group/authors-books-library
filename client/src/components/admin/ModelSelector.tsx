import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ScanSearch,
  Play,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { type AppSettings } from "@/contexts/AppSettingsContext";
import { BackgroundSelector } from "./BackgroundSelector";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PurposeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  vendorKey: keyof AppSettings;
  modelKey: keyof AppSettings;
  secondaryEnabledKey?: keyof AppSettings;
  secondaryVendorKey?: keyof AppSettings;
  secondaryModelKey?: keyof AppSettings;
  imageGenOnly?: boolean;
  hideTextModels?: boolean;
  defaultVendor?: string;
  defaultModel?: string;
}

interface ModelSelectorProps {
  purpose: PurposeConfig;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

export function ModelSelector({ purpose, settings, updateSettings }: ModelSelectorProps) {
  const vendorsQuery = trpc.llm.listVendors.useQuery();
  const refreshVendorsMutation = trpc.llm.refreshVendors.useMutation();
  const testModelMutation = trpc.llm.testModel.useMutation();
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation();
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testPortraitUrl, setTestPortraitUrl] = useState<string | null>(null);
  const [testPortraitError, setTestPortraitError] = useState<string | null>(null);

  const vendors = vendorsQuery.data ?? [];

  const primaryVendorId = (settings[purpose.vendorKey] as string) ?? purpose.defaultVendor ?? "";
  const primaryModelId = (settings[purpose.modelKey] as string) ?? purpose.defaultModel ?? "";
  const secondaryEnabled = purpose.secondaryEnabledKey
    ? (settings[purpose.secondaryEnabledKey] as boolean) ?? false
    : false;
  const secondaryVendorId = purpose.secondaryVendorKey
    ? (settings[purpose.secondaryVendorKey] as string) ?? ""
    : "";
  const secondaryModelId = purpose.secondaryModelKey
    ? (settings[purpose.secondaryModelKey] as string) ?? ""
    : "";

  const filterModels = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return [];
    if (purpose.imageGenOnly) return vendor.models.filter((m) => m.imageGen);
    if (purpose.hideTextModels) return vendor.models.filter((m) => !m.imageGen);
    return vendor.models;
  };

  const primaryModels = filterModels(primaryVendorId);
  const secondaryModels = filterModels(secondaryVendorId);

  const vendorDisplayName = (id: string) =>
    vendors.find((v) => v.id === id)?.displayName ?? id;

  const modelDisplayName = (vendorId: string, modelId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.models.find((m) => m.id === modelId)?.displayName ?? modelId;
  };

  function handleRefreshVendors() {
    refreshVendorsMutation.mutate(undefined, {
      onSuccess: (data) => {
        vendorsQuery.refetch();
        const totalModels = data.vendors.reduce((sum, v) => sum + v.models.length, 0);
        toast.success(`Refreshed: ${data.vendors.length} vendors, ${totalModels} models`);
      },
      onError: (err) => toast.error("Refresh failed: " + err.message),
    });
  }

  function handleTestModel(vendorId: string, modelId: string) {
    setTestingModel(modelId);
    setTestPortraitUrl(null);
    setTestPortraitError(null);

    if (purpose.imageGenOnly) {
      generateAvatarMutation.mutate(
        { authorName: "Albert Einstein", forceRegenerate: true },
        {
          onSuccess: (data) => {
            setTestingModel(null);
            if (data.url) {
              setTestPortraitUrl(data.url);
              toast.success("Test portrait generated!");
            } else {
              setTestPortraitError("No image returned");
              toast.error("Test portrait returned no image");
            }
          },
          onError: (err) => {
            setTestingModel(null);
            setTestPortraitError(err.message);
            toast.error("Test portrait failed: " + err.message);
          },
        }
      );
    } else {
      testModelMutation.mutate(
        { vendorId, modelId },
        {
          onSuccess: (data) => {
            setTestingModel(null);
            if (data.success) {
              toast.success(`Model test passed: ${data.response?.slice(0, 80)}`);
            } else {
              toast.error(`Model test failed: ${data.error}`);
            }
          },
          onError: (err) => {
            setTestingModel(null);
            toast.error("Test failed: " + err.message);
          },
        }
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Primary Model ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Primary Model</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={handleRefreshVendors}
            disabled={refreshVendorsMutation.isPending}
          >
            {refreshVendorsMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Renew Vendors
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Vendor */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Vendor</Label>
            <Select
              value={primaryVendorId}
              onValueChange={(v) => {
                updateSettings({ [purpose.vendorKey]: v, [purpose.modelKey]: "" } as any);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors
                  .filter((v) => {
                    if (purpose.imageGenOnly) return v.models.some((m) => m.imageGen);
                    return true;
                  })
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="font-medium">{v.displayName}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        ({(purpose.imageGenOnly ? v.models.filter((m) => m.imageGen) : v.models).length} models)
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Model</Label>
            <Select
              value={primaryModelId}
              onValueChange={(v) => updateSettings({ [purpose.modelKey]: v } as any)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {primaryModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="font-medium">{m.displayName}</span>
                    {m.imageGen && (
                      <Badge variant="outline" className="ml-1 text-[8px] py-0 px-1">
                        Image
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Test</Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              disabled={!primaryVendorId || !primaryModelId || !!testingModel}
              onClick={() => handleTestModel(primaryVendorId, primaryModelId)}
            >
              {testingModel === primaryModelId ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ScanSearch className="w-3 h-3" />
              )}
              {purpose.imageGenOnly ? "Test Portrait" : "Test Model"}
            </Button>
          </div>
        </div>

        {/* Test portrait preview */}
        {testPortraitUrl && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
            <img
              src={testPortraitUrl}
              alt="Test portrait"
              className="w-16 h-16 rounded-lg object-cover border border-border"
            />
            <div className="text-xs space-y-0.5">
              <p className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                Test portrait generated
              </p>
              <p className="text-muted-foreground text-[10px]">
                {vendorDisplayName(primaryVendorId)} / {modelDisplayName(primaryVendorId, primaryModelId)}
              </p>
            </div>
          </div>
        )}
        {testPortraitError && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            {testPortraitError}
          </div>
        )}

        {/* Active model summary */}
        {primaryVendorId && primaryModelId && (
          <div className="p-2 rounded-md bg-muted/50 border border-border">
            <p className="text-[10px] text-muted-foreground">
              <strong>Active:</strong> {vendorDisplayName(primaryVendorId)} /{" "}
              {modelDisplayName(primaryVendorId, primaryModelId)}
            </p>
          </div>
        )}
      </div>

      {/* ── Background Selector (Avatar Generation only) ─────────────── */}
      {purpose.imageGenOnly && (
        <BackgroundSelector settings={settings} updateSettings={updateSettings} />
      )}

      {/* ── Secondary Model (if supported) ───────────────────────────── */}
      {purpose.secondaryEnabledKey && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={secondaryEnabled}
                onCheckedChange={(v) =>
                  updateSettings({ [purpose.secondaryEnabledKey!]: v } as any)
                }
              />
              <Label className="text-xs font-semibold">Secondary LLM</Label>
            </div>
            <Badge variant="outline" className="text-[9px]">
              Cross-validation
            </Badge>
          </div>

          {secondaryEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Vendor */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Vendor</Label>
                <Select
                  value={secondaryVendorId}
                  onValueChange={(v) => {
                    updateSettings({
                      [purpose.secondaryVendorKey!]: v,
                      [purpose.secondaryModelKey!]: "",
                    } as any);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors
                      .filter((v) => !purpose.imageGenOnly || v.models.some((m) => !m.imageGen))
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="font-medium">{v.displayName}</span>
                          <span className="text-muted-foreground ml-1 text-[10px]">
                            ({(v.models ?? []).filter((m) => !m.imageGen).length} models)
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Model</Label>
                <Select
                  value={secondaryModelId}
                  onValueChange={(v) =>
                    updateSettings({ [purpose.secondaryModelKey!]: v } as any)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {secondaryModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.displayName}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Test */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Test</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs gap-1.5"
                  disabled={!secondaryVendorId || !secondaryModelId || !!testingModel}
                  onClick={() => handleTestModel(secondaryVendorId, secondaryModelId)}
                >
                  {testingModel === secondaryModelId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Test
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
