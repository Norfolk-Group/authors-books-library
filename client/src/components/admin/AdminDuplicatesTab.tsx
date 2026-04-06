/**
 * AdminDuplicatesTab.tsx
 *
 * Admin panel for reviewing and resolving duplicate books detected by the
 * Duplicate Detection System.
 *
 * Features:
 * - Run a full duplicate scan (books + files)
 * - View scan summary (scanned, flagged, duration)
 * - Review pending book duplicates in a side-by-side comparison table
 * - Resolve each duplicate: Keep (not a dupe), Discard (remove candidate), Replace
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, CheckCircle, XCircle, RefreshCw } from "lucide-react";

type ScanResult = {
  bookDuplicates: Array<{
    candidateId: number;
    canonicalId: number;
    candidateTitle: string;
    canonicalTitle: string;
    detectionMethod: string;
    score?: number;
  }>;
  fileDuplicates: Array<{
    candidateId: number;
    canonicalId: number;
    candidateFilename: string;
    canonicalFilename: string;
    detectionMethod: string;
  }>;
  scannedBooks: number;
  scannedFiles: number;
  flaggedBooks: number;
  flaggedFiles: number;
  durationMs: number;
};

function PendingBookRow({ book, onResolved }: {
  book: {
    id: number;
    bookTitle: string | null;
    authorName: string | null;
    isbn: string | null;
    duplicateOfId: number | null;
    duplicateDetectionMethod: string | null;
    duplicateStatus: string | null;
    duplicateFlaggedAt: Date | null;
  };
  onResolved: () => void;
}) {
  const utils = trpc.useUtils();
  const resolveMutation = trpc.duplicateDetection.resolveBook.useMutation({
    onSuccess: () => {
      toast.success("Duplicate resolved");
      utils.duplicateDetection.getPending.invalidate();
      onResolved();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{book.bookTitle ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{book.authorName ?? "—"}</div>
        {book.isbn && <div className="text-xs text-muted-foreground font-mono mt-0.5">ISBN: {book.isbn}</div>}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant="outline" className="text-xs">
          {book.duplicateDetectionMethod === "isbn" ? "ISBN" : "Fuzzy Title"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
        #{book.duplicateOfId}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ candidateId: book.id, action: "keep" })}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Keep
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 text-destructive hover:text-destructive"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ candidateId: book.id, action: "discard" })}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Discard
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function AdminDuplicatesTab() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const { data: pendingBooks, isLoading: loadingPending, refetch: refetchPending } =
    trpc.duplicateDetection.getPending.useQuery();

  const scanMutation = trpc.duplicateDetection.scan.useMutation({
    onSuccess: (data) => {
      setScanResult(data as ScanResult);
      refetchPending();
      toast.success(`Scan complete: ${data.flaggedBooks} book duplicates found`);
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Duplicate Detection</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scan for duplicate books using ISBN matching and fuzzy title similarity.
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="gap-2"
        >
          {scanMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {scanMutation.isPending ? "Scanning…" : "Run Scan"}
        </Button>
      </div>

      {/* Scan Summary */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{scanResult.scannedBooks}</div>
              <div className="text-xs text-muted-foreground mt-1">Books Scanned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-500">{scanResult.flaggedBooks}</div>
              <div className="text-xs text-muted-foreground mt-1">Book Duplicates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{scanResult.scannedFiles}</div>
              <div className="text-xs text-muted-foreground mt-1">Files Scanned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-500">{scanResult.flaggedFiles}</div>
              <div className="text-xs text-muted-foreground mt-1">File Duplicates</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scan Result Details */}
      {scanResult && scanResult.bookDuplicates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detected Book Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Candidate</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Canonical</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Method</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResult.bookDuplicates.map((dup) => (
                    <tr key={`${dup.candidateId}-${dup.canonicalId}`} className="border-b border-border">
                      <td className="px-4 py-2 text-sm">{dup.candidateTitle}</td>
                      <td className="px-4 py-2 text-sm">{dup.canonicalTitle}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {dup.detectionMethod === "isbn" ? "ISBN" : "Fuzzy"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {dup.score ? `${(dup.score * 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Review Queue */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Pending Review
              {pendingBooks && pendingBooks.length > 0 && (
                <Badge className="ml-2 text-xs">{pendingBooks.length}</Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchPending()}
              disabled={loadingPending}
              className="h-7 gap-1 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading pending duplicates…
            </div>
          ) : !pendingBooks || pendingBooks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No pending duplicates. Run a scan to detect new duplicates.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Book</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-center">Method</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-center">Canonical ID</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBooks.map((book) => (
                    <PendingBookRow key={book.id} book={book} onResolved={() => refetchPending()} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
