/**
 * AdminS3AuditTab — S3 CDN Coverage Audit
 *
 * Shows which author avatars and book covers are NOT yet on the S3 CDN,
 * and provides one-click migration buttons to re-upload them.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CloudArrowUp,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  Image,
  User,
  BookOpen,
  Warning,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminS3AuditTab() {
  const [migratingAvatars, setMigratingAvatars] = useState(false);
  const [migratingCovers, setMigratingCovers] = useState(false);
  const [avatarMigrationResult, setAvatarMigrationResult] = useState<{
    processed: number; succeeded: number; failed: number; errors: string[];
  } | null>(null);
  const [coverMigrationResult, setCoverMigrationResult] = useState<{
    processed: number; succeeded: number; failed: number; errors: string[];
  } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const auditQuery = trpc.s3Audit.auditAssets.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const migrateAvatarsMutation = trpc.s3Audit.migrateAvatarsToS3.useMutation({
    onSuccess: (data) => {
      setMigratingAvatars(false);
      setAvatarMigrationResult(data);
      toast.success(`Avatars: ${data.succeeded} migrated, ${data.failed} failed`);
      auditQuery.refetch();
    },
    onError: (err) => {
      setMigratingAvatars(false);
      toast.error(`Avatar migration failed: ${err.message}`);
    },
  });

  const migrateCoversMutation = trpc.s3Audit.migrateCoversToS3.useMutation({
    onSuccess: (data) => {
      setMigratingCovers(false);
      setCoverMigrationResult(data);
      toast.success(`Covers: ${data.succeeded} migrated, ${data.failed} failed`);
      auditQuery.refetch();
    },
    onError: (err) => {
      setMigratingCovers(false);
      toast.error(`Cover migration failed: ${err.message}`);
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────────────

  const audit = auditQuery.data;
  const isLoading = auditQuery.isLoading;

  const avatarItems = audit?.notOnS3Items.filter((i) => i.type === "avatar") ?? [];
  const coverItems = audit?.notOnS3Items.filter((i) => i.type === "cover") ?? [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Summary Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CloudArrowUp className="w-5 h-5 text-blue-500" />
                S3 CDN Coverage Audit
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Identifies author avatars and book covers that are not yet mirrored to the S3 CDN.
                Non-S3 images may load slowly or break if the source URL expires.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => auditQuery.refetch()}
              disabled={isLoading}
            >
              <ArrowsClockwise className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning assets...
            </div>
          ) : audit ? (
            <div className="space-y-4">
              {/* Coverage bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>CDN Coverage</span>
                  <span className="font-medium text-foreground">{audit.summary.coveragePercent}%</span>
                </div>
                <Progress value={audit.summary.coveragePercent} className="h-2" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Assets" value={audit.summary.total} color="text-foreground" />
                <StatCard label="On S3 CDN" value={audit.summary.onS3} color="text-green-600 dark:text-green-400" />
                <StatCard label="Not on S3" value={audit.summary.notOnS3} color="text-amber-600 dark:text-amber-400" />
                <StatCard label="No Image" value={audit.summary.noImage} color="text-muted-foreground" />
              </div>

              {audit.summary.notOnS3 === 0 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                  <CheckCircle size={16} weight="fill" />
                  All assets are on the S3 CDN — no migration needed.
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No audit data available.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Avatar Migration ── */}
      {audit && avatarItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-violet-500" />
              Author Avatars Not on S3
              <Badge variant="secondary" className="ml-1 text-xs">{avatarItems.length} shown</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              These author avatars have a source URL but have not been mirrored to S3.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                setMigratingAvatars(true);
                migrateAvatarsMutation.mutate({ limit: 50 });
              }}
              disabled={migratingAvatars}
              size="sm"
            >
              {migratingAvatars ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Migrating...</>
              ) : (
                <><CloudArrowUp className="w-4 h-4 mr-2" />Migrate 50 Avatars to S3</>
              )}
            </Button>

            {avatarMigrationResult && (
              <div className="rounded-md border px-3 py-2 text-xs space-y-1">
                <p className="font-medium">Migration result:</p>
                <p className="text-green-600 dark:text-green-400">✓ {avatarMigrationResult.succeeded} succeeded</p>
                {avatarMigrationResult.failed > 0 && (
                  <p className="text-red-600 dark:text-red-400">✗ {avatarMigrationResult.failed} failed</p>
                )}
                {avatarMigrationResult.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-muted-foreground">{e}</p>
                ))}
              </div>
            )}

            <Separator />
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {avatarItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                  <Warning size={12} className="text-amber-500 shrink-0" />
                  <span className="font-medium truncate flex-1">{item.name}</span>
                  {item.currentUrl && (
                    <a
                      href={item.currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline shrink-0"
                    >
                      source
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Cover Migration ── */}
      {audit && coverItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              Book Covers Not on S3
              <Badge variant="secondary" className="ml-1 text-xs">{coverItems.length} shown</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              These book covers have a source URL but have not been mirrored to S3.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                setMigratingCovers(true);
                migrateCoversMutation.mutate({ limit: 50 });
              }}
              disabled={migratingCovers}
              size="sm"
            >
              {migratingCovers ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Migrating...</>
              ) : (
                <><CloudArrowUp className="w-4 h-4 mr-2" />Migrate 50 Covers to S3</>
              )}
            </Button>

            {coverMigrationResult && (
              <div className="rounded-md border px-3 py-2 text-xs space-y-1">
                <p className="font-medium">Migration result:</p>
                <p className="text-green-600 dark:text-green-400">✓ {coverMigrationResult.succeeded} succeeded</p>
                {coverMigrationResult.failed > 0 && (
                  <p className="text-red-600 dark:text-red-400">✗ {coverMigrationResult.failed} failed</p>
                )}
                {coverMigrationResult.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-muted-foreground">{e}</p>
                ))}
              </div>
            )}

            <Separator />
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {coverItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                  <Warning size={12} className="text-amber-500 shrink-0" />
                  <span className="font-medium truncate flex-1">{item.name}</span>
                  {item.currentUrl && (
                    <a
                      href={item.currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline shrink-0"
                    >
                      source
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── No Image Items ── */}
      {audit && audit.noImageItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-5 h-5 text-muted-foreground" />
              Assets With No Image URL
              <Badge variant="outline" className="ml-1 text-xs">{audit.noImageItems.length} shown</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              These items have no avatar or cover image at all. Use the enrichment pipeline to fetch them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {audit.noImageItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 text-xs py-1">
                  <XCircle size={12} className="text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="text-xs shrink-0">{item.type}</Badge>
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
