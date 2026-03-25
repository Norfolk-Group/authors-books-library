/**
 * sseProgress.test.ts — Tests for SSE batch progress stream
 *
 * Covers:
 *   - BatchProgressEmitter: emit, subscribe, history, job lifecycle
 *   - sseProgressHandler: SSE headers, event streaming, heartbeat
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { batchProgress, sseProgressHandler, type BatchProgressEvent } from "./lib/sseProgress";

describe("BatchProgressEmitter", () => {
  it("should export batchProgress singleton", () => {
    expect(batchProgress).toBeDefined();
    expect(typeof batchProgress.emit).toBe("function");
    expect(typeof batchProgress.subscribe).toBe("function");
    expect(typeof batchProgress.getHistory).toBe("function");
    expect(typeof batchProgress.getActiveJobs).toBe("function");
    expect(typeof batchProgress.createJobId).toBe("function");
  });

  it("createJobId should generate unique IDs with prefix", () => {
    const id1 = batchProgress.createJobId("test");
    const id2 = batchProgress.createJobId("test");
    expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^test_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("createJobId should use default prefix", () => {
    const id = batchProgress.createJobId();
    expect(id).toMatch(/^batch_\d+_[a-z0-9]+$/);
  });

  it("emit should broadcast events to subscribers", () => {
    const events: BatchProgressEvent[] = [];
    const unsub = batchProgress.subscribe((e) => events.push(e));

    const jobId = batchProgress.createJobId("test");
    batchProgress.emit(jobId, { type: "started" });
    batchProgress.emit(jobId, { type: "progress", current: 1, total: 10, authorName: "Adam Grant" });
    batchProgress.emit(jobId, { type: "complete", succeeded: 9, failed: 1 });

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("started");
    expect(events[1].type).toBe("progress");
    expect(events[1].current).toBe(1);
    expect(events[1].total).toBe(10);
    expect(events[1].authorName).toBe("Adam Grant");
    expect(events[2].type).toBe("complete");
    expect(events[2].succeeded).toBe(9);
    expect(events[2].failed).toBe(1);

    unsub();
  });

  it("unsubscribe should stop receiving events", () => {
    const events: BatchProgressEvent[] = [];
    const unsub = batchProgress.subscribe((e) => events.push(e));

    const jobId = batchProgress.createJobId("test");
    batchProgress.emit(jobId, { type: "started" });
    unsub();
    batchProgress.emit(jobId, { type: "progress", current: 1, total: 10 });

    expect(events).toHaveLength(1);
  });

  it("getHistory should return events for a specific job", () => {
    const jobId = batchProgress.createJobId("hist");
    batchProgress.emit(jobId, { type: "started" });
    batchProgress.emit(jobId, { type: "progress", current: 1, total: 5 });

    const history = batchProgress.getHistory(jobId);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[history.length - 2].type).toBe("started");
    expect(history[history.length - 1].type).toBe("progress");
  });

  it("getHistory should return empty array for unknown job", () => {
    const history = batchProgress.getHistory("nonexistent_job_12345");
    expect(history).toEqual([]);
  });

  it("getActiveJobs should include emitted job IDs", () => {
    const jobId = batchProgress.createJobId("active");
    batchProgress.emit(jobId, { type: "started" });

    const jobs = batchProgress.getActiveJobs();
    expect(jobs).toContain(jobId);
  });

  it("events should include timestamp", () => {
    const events: BatchProgressEvent[] = [];
    const unsub = batchProgress.subscribe((e) => events.push(e));

    const jobId = batchProgress.createJobId("ts");
    batchProgress.emit(jobId, { type: "started" });

    expect(events[0].timestamp).toBeTruthy();
    expect(new Date(events[0].timestamp).getTime()).toBeGreaterThan(0);

    unsub();
  });

  it("events should include jobId", () => {
    const events: BatchProgressEvent[] = [];
    const unsub = batchProgress.subscribe((e) => events.push(e));

    const jobId = batchProgress.createJobId("jid");
    batchProgress.emit(jobId, { type: "started" });

    expect(events[0].jobId).toBe(jobId);

    unsub();
  });
});

describe("sseProgressHandler", () => {
  it("should export sseProgressHandler function", () => {
    expect(typeof sseProgressHandler).toBe("function");
  });

  it("should set SSE headers on response", () => {
    const headers: Record<string, string> = {};
    const written: string[] = [];

    const req = { query: {} };
    const res = {
      writeHead: (status: number, h: Record<string, string>) => {
        Object.assign(headers, h);
      },
      write: (data: string) => {
        written.push(data);
        return true;
      },
      end: () => {},
      on: (_event: string, _cb: () => void) => {},
      flush: () => {},
    };

    sseProgressHandler(req, res);

    expect(headers["Content-Type"]).toBe("text/event-stream");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["Connection"]).toBe("keep-alive");
    expect(headers["X-Accel-Buffering"]).toBe("no");
  });

  it("should send initial connected event", () => {
    const written: string[] = [];

    const req = { query: {} };
    const res = {
      writeHead: () => {},
      write: (data: string) => {
        written.push(data);
        return true;
      },
      end: () => {},
      on: (_event: string, _cb: () => void) => {},
      flush: () => {},
    };

    sseProgressHandler(req, res);

    expect(written.length).toBeGreaterThanOrEqual(1);
    const firstEvent = JSON.parse(written[0].replace("data: ", "").trim());
    expect(firstEvent.type).toBe("connected");
  });

  it("should stream events matching jobId filter", () => {
    const written: string[] = [];
    let closeCallback: (() => void) | null = null;

    const jobId = batchProgress.createJobId("sse");
    const req = { query: { jobId } };
    const res = {
      writeHead: () => {},
      write: (data: string) => {
        written.push(data);
        return true;
      },
      end: () => {},
      on: (event: string, cb: () => void) => {
        if (event === "close") closeCallback = cb;
      },
      flush: () => {},
    };

    sseProgressHandler(req, res);
    const initialCount = written.length;

    // Emit matching event
    batchProgress.emit(jobId, { type: "progress", current: 1, total: 5 });
    expect(written.length).toBe(initialCount + 1);

    // Emit non-matching event
    batchProgress.emit("other_job_999", { type: "progress", current: 1, total: 5 });
    expect(written.length).toBe(initialCount + 1); // Should not increase

    // Clean up
    if (closeCallback) closeCallback();
  });
});
