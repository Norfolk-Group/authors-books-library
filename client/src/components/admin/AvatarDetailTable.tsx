import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { LazyImage } from "@/components/ui/LazyImage";

export function AvatarDetailTable() {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const { data: rows, isLoading } = trpc.authorProfiles.getAvatarDetailedStats.useQuery(
    undefined,
    { enabled: expanded }
  );

  const filtered = (rows ?? []).filter((r) =>
    !search || r.authorName.toLowerCase().includes(search.toLowerCase())
  );

  const withRef = (rows ?? []).filter((r) => r.bestReferencePhotoUrl).length;
  const withS3 = (rows ?? []).filter((r) => r.s3AvatarUrl).length;

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Author Avatar Details
          </div>
          <div className="flex items-center gap-3">
            {rows && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-normal">
                <span className="bg-muted rounded px-1.5 py-0.5">{withS3}/{rows.length} in S3</span>
                <span className="bg-muted rounded px-1.5 py-0.5">{withRef}/{rows.length} have ref photo</span>
              </div>
            )}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          Per-author avatar status with reference photo used during AI generation.
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search authors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 text-xs px-2.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-auto max-h-[400px] rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Author</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Avatar</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ref Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.authorName} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 font-medium truncate max-w-[160px]" title={row.authorName}>
                          {row.authorName}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            row.avatarSource === 'google-imagen' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            (row.avatarSource === 'ai' || row.avatarSource === 'apify') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            row.avatarSource === 'drive' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            (row.avatarSource === 'wikipedia' || row.avatarSource === 'tavily') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {row.avatarSource ?? 'none'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          {row.s3AvatarUrl ? (
                            <a href={row.s3AvatarUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <LazyImage src={row.s3AvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.bestReferencePhotoUrl ? (
                            <a
                              href={row.bestReferencePhotoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <LazyImage src={row.bestReferencePhotoUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                          No authors found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
