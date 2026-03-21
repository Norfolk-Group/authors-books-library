/**
 * Shared types, helpers, and constants for Admin Console tab components.
 */

export type ActionStatus = "idle" | "running" | "done" | "error";

export interface ActionState {
  status: ActionStatus;
  progress: number;
  message: string;
  done: number;
  total: number;
  failed: number;
}

export const INITIAL_STATE: ActionState = {
  status: "idle",
  progress: 0,
  message: "",
  done: 0,
  total: 0,
  failed: 0,
};

export interface LastRunInfo {
  lastRunAt: Date | string | null;
  lastRunResult: string | null;
  lastRunDurationMs: number | null;
  lastRunItemCount: number | null;
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
