/**
 * sseProgress.ts — Server-Sent Events (SSE) progress stream for batch operations
 *
 * Provides a lightweight SSE mechanism for streaming batch operation progress
 * from the server to the Admin Console in real time.
 *
 * Architecture:
 *   1. BatchProgressEmitter — in-memory event bus that batch procedures write to
 *   2. Express SSE endpoint — long-lived HTTP response that streams events to the client
 *   3. useBatchProgress hook — React hook that subscribes to the SSE stream
 *
 * Usage (server-side):
 *   import { batchProgress } from "../lib/sseProgress";
 *   batchProgress.emit(jobId, { type: "progress", current: 5, total: 20, authorName: "..." });
 *   batchProgress.emit(jobId, { type: "complete", succeeded: 18, failed: 2 });
 *
 * Usage (client-side):
 *   const { progress, isConnected } = useBatchProgress(jobId);
 */

import { EventEmitter } from "events";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BatchProgressEvent {
  type: "started" | "progress" | "error" | "complete";
  jobId: string;
  current?: number;
  total?: number;
  authorName?: string;
  bookTitle?: string;
  message?: string;
  succeeded?: number;
  failed?: number;
  timestamp: string;
}

export type BatchProgressData = Omit<BatchProgressEvent, "jobId" | "timestamp">;

// ── Server-side emitter ──────────────────────────────────────────────────────

class BatchProgressEmitter {
  private emitter = new EventEmitter();
  private activeJobs = new Map<string, BatchProgressEvent[]>();

  constructor() {
    // Allow many listeners (one per connected admin client)
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a progress event for a batch job.
   */
  emit(jobId: string, data: BatchProgressData): void {
    const event: BatchProgressEvent = {
      ...data,
      jobId,
      timestamp: new Date().toISOString(),
    };

    // Store event history for late-joining clients
    if (!this.activeJobs.has(jobId)) {
      this.activeJobs.set(jobId, []);
    }
    this.activeJobs.get(jobId)!.push(event);

    // Trim history to last 100 events per job
    const history = this.activeJobs.get(jobId)!;
    if (history.length > 100) {
      this.activeJobs.set(jobId, history.slice(-100));
    }

    // Broadcast to all listeners
    this.emitter.emit("progress", event);

    // Clean up completed jobs after 5 minutes
    if (data.type === "complete" || data.type === "error") {
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Subscribe to progress events. Returns unsubscribe function.
   */
  subscribe(callback: (event: BatchProgressEvent) => void): () => void {
    this.emitter.on("progress", callback);
    return () => {
      this.emitter.off("progress", callback);
    };
  }

  /**
   * Get event history for a specific job (for late-joining clients).
   */
  getHistory(jobId: string): BatchProgressEvent[] {
    return this.activeJobs.get(jobId) ?? [];
  }

  /**
   * Get all active job IDs.
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  /**
   * Generate a unique job ID.
   */
  createJobId(prefix: string = "batch"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Singleton instance
export const batchProgress = new BatchProgressEmitter();

// ── Express SSE handler ──────────────────────────────────────────────────────

/**
 * Express middleware that creates an SSE endpoint for batch progress.
 *
 * Mount on your Express app:
 *   app.get("/api/batch-progress", sseProgressHandler);
 *
 * Client connects with:
 *   new EventSource("/api/batch-progress?jobId=xxx")
 */
export function sseProgressHandler(
  req: { query: Record<string, string | undefined> },
  res: {
    writeHead: (status: number, headers: Record<string, string>) => void;
    write: (data: string) => boolean;
    end: () => void;
    on: (event: string, callback: () => void) => void;
    flush?: () => void;
  }
): void {
  const jobId = req.query.jobId;

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);
  if (res.flush) res.flush();

  // If a specific jobId is requested, send its history
  if (jobId) {
    const history = batchProgress.getHistory(jobId);
    for (const event of history) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (res.flush) res.flush();
  }

  // Subscribe to new events
  const unsubscribe = batchProgress.subscribe((event) => {
    // If jobId filter is set, only send matching events
    if (jobId && event.jobId !== jobId) return;

    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (res.flush) res.flush();
  });

  // Heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
    if (res.flush) res.flush();
  }, 30_000);

  // Clean up on client disconnect
  res.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
    res.end();
  });
}
