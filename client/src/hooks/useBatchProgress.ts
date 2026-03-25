/**
 * useBatchProgress — React hook for consuming SSE batch progress events
 *
 * Usage:
 *   const { events, latestEvent, isConnected, progress } = useBatchProgress(jobId);
 *
 * The hook connects to /api/batch-progress?jobId=xxx and streams events in real time.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface BatchProgressEvent {
  type: "connected" | "started" | "progress" | "error" | "complete";
  jobId?: string;
  current?: number;
  total?: number;
  authorName?: string;
  bookTitle?: string;
  message?: string;
  succeeded?: number;
  failed?: number;
  timestamp: string;
}

interface UseBatchProgressReturn {
  /** All events received so far */
  events: BatchProgressEvent[];
  /** The most recent event */
  latestEvent: BatchProgressEvent | null;
  /** Whether the SSE connection is active */
  isConnected: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current item being processed */
  currentItem: string | null;
  /** Whether the batch is complete */
  isComplete: boolean;
  /** Summary stats (only available after completion) */
  summary: { succeeded: number; failed: number } | null;
  /** Disconnect from the SSE stream */
  disconnect: () => void;
}

export function useBatchProgress(jobId: string | null): UseBatchProgressReturn {
  const [events, setEvents] = useState<BatchProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      disconnect();
      setEvents([]);
      return;
    }

    // Close any existing connection
    disconnect();

    const url = `/api/batch-progress?jobId=${encodeURIComponent(jobId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BatchProgressEvent;
        setEvents((prev) => [...prev, data]);

        // Auto-disconnect on completion
        if (data.type === "complete" || data.type === "error") {
          setTimeout(() => {
            es.close();
            setIsConnected(false);
          }, 1000);
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects, so we don't need to handle this
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [jobId, disconnect]);

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const progress =
    latestEvent?.current && latestEvent?.total
      ? Math.round((latestEvent.current / latestEvent.total) * 100)
      : 0;

  const currentItem = latestEvent?.authorName || latestEvent?.bookTitle || null;

  const isComplete = latestEvent?.type === "complete";

  const summary =
    isComplete && latestEvent
      ? {
          succeeded: latestEvent.succeeded ?? 0,
          failed: latestEvent.failed ?? 0,
        }
      : null;

  return {
    events,
    latestEvent,
    isConnected,
    progress,
    currentItem,
    isComplete,
    summary,
    disconnect,
  };
}
