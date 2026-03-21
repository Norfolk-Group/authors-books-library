/**
 * useConfetti - Reusable confetti celebration hook.
 * Wraps canvas-confetti with named celebration modes for different task completions.
 */
import confetti from "canvas-confetti";

type ConfettiMode =
  | "portrait"      // Single portrait generated - small burst
  | "batch"         // Batch operation complete - full celebration
  | "scrape"        // Amazon scrape success - quick pop
  | "mirror"        // Mirror covers/photos done - gentle rain
  | "upload"        // Avatar uploaded - sparkle burst
  | "enrich";       // Bio enrichment done - medium burst

/**
 * Fire a confetti burst appropriate to the completed task.
 * Call this directly - no React state needed.
 */
export function fireConfetti(mode: ConfettiMode = "portrait"): void {
  switch (mode) {
    case "portrait":
      // Single portrait: quick star burst from center-top
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.3, x: 0.5 },
        colors: ["#4F6EF7", "#7C3AED", "#F59E0B", "#10B981", "#F43F5E"],
        shapes: ["star", "circle"],
        scalar: 1.1,
        gravity: 1.2,
        ticks: 200,
      });
      break;

    case "batch":
      // Batch complete: double cannon from both sides
      const duration = 1800;
      const end = Date.now() + duration;
      const colors = ["#4F6EF7", "#7C3AED", "#F59E0B", "#10B981", "#F43F5E", "#06B6D4"];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.65 },
          colors,
          shapes: ["star", "circle", "square"],
          scalar: 1.2,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.65 },
          colors,
          shapes: ["star", "circle", "square"],
          scalar: 1.2,
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
      break;

    case "scrape":
      // Amazon scrape: orange/gold pop
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.4, x: 0.5 },
        colors: ["#FF9900", "#FFB347", "#FFD700", "#FFA500", "#FFFFFF"],
        shapes: ["circle", "square"],
        scalar: 0.9,
        gravity: 1.4,
        ticks: 180,
      });
      break;

    case "mirror":
      // Mirror done: gentle rain from top
      confetti({
        particleCount: 80,
        spread: 120,
        startVelocity: 20,
        origin: { y: -0.1, x: 0.5 },
        colors: ["#4F6EF7", "#7C3AED", "#06B6D4", "#10B981"],
        shapes: ["circle"],
        scalar: 0.7,
        gravity: 0.6,
        ticks: 300,
        drift: 0.5,
      });
      break;

    case "upload":
      // Avatar upload: sparkle burst from center
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.35, x: 0.5 },
        colors: ["#FBBF24", "#F59E0B", "#FCD34D", "#FDE68A", "#FFFFFF"],
        shapes: ["star"],
        scalar: 1.3,
        gravity: 1.0,
        ticks: 220,
      });
      break;

    case "enrich":
      // Bio enrichment: medium burst, green/teal
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.35, x: 0.5 },
        colors: ["#10B981", "#34D399", "#06B6D4", "#22D3EE", "#4F6EF7"],
        shapes: ["circle", "square"],
        scalar: 1.0,
        gravity: 1.1,
        ticks: 250,
      });
      break;
  }
}

/**
 * React hook version - returns a stable fireConfetti function bound to the mode.
 * Use when you want to call confetti from a component without importing the util directly.
 */
export function useConfetti() {
  return { fireConfetti };
}
