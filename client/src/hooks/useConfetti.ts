/**
 * useConfetti - Confetti celebration stub.
 * canvas-confetti was removed during dependency cleanup.
 * This file preserves the API so existing call sites don't break.
 * To re-enable confetti, install canvas-confetti and restore the original implementation.
 */

type ConfettiMode =
  | "portrait"
  | "batch"
  | "scrape"
  | "mirror"
  | "upload"
  | "enrich";

/**
 * No-op confetti function. Call sites remain unchanged.
 */
export function fireConfetti(_mode: ConfettiMode = "portrait"): void {
  // Intentionally empty — confetti dependency removed
}

/**
 * React hook version — returns a stable fireConfetti function.
 */
export function useConfetti() {
  return { fireConfetti };
}
