/**
 * Simple in-memory sliding-window rate limiter for tRPC procedures.
 * Limits expensive LLM/API enrichment calls per user and globally.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const userWindows = new Map<string, WindowEntry>();
const globalWindow: WindowEntry = { count: 0, resetAt: Date.now() + 60_000 };

function getOrCreate(map: Map<string, WindowEntry>, key: string, windowMs: number): WindowEntry {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    map.set(key, entry);
  }
  return entry;
}

export interface RateLimitOptions {
  /** Max calls per user per windowMs */
  perUser: number;
  /** Max calls globally per windowMs */
  global: number;
  /** Window duration in ms (default: 60 000) */
  windowMs?: number;
}

/**
 * Returns true if the call is allowed, false if rate-limited.
 */
export function checkRateLimit(userId: string, opts: RateLimitOptions): { allowed: boolean; reason?: string } {
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();

  // Global window
  if (now > globalWindow.resetAt) {
    globalWindow.count = 0;
    globalWindow.resetAt = now + windowMs;
  }
  if (globalWindow.count >= opts.global) {
    return { allowed: false, reason: `Global rate limit exceeded (${opts.global} calls/${windowMs / 1000}s). Try again later.` };
  }

  // Per-user window
  const userEntry = getOrCreate(userWindows, userId, windowMs);
  if (userEntry.count >= opts.perUser) {
    return { allowed: false, reason: `Rate limit exceeded (${opts.perUser} calls/${windowMs / 1000}s per user). Please wait before retrying.` };
  }

  // Increment counters
  globalWindow.count++;
  userEntry.count++;

  return { allowed: true };
}

/** Cleanup stale entries every 5 minutes */
setInterval(() => {
  const now = Date.now();
  Array.from(userWindows.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) userWindows.delete(key);
  });
}, 5 * 60_000);
