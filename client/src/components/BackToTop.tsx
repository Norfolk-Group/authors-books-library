/**
 * BackToTop — floating "back to top" button
 *
 * Attaches to a scrollable container via a ref.
 * Appears after the user scrolls down 300px, fades in/out with Framer Motion.
 * Clicking smoothly scrolls the container back to the top.
 *
 * Usage:
 *   const mainRef = useRef<HTMLElement>(null);
 *   <main ref={mainRef} className="overflow-auto">...</main>
 *   <BackToTop scrollContainerRef={mainRef} />
 */
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface BackToTopProps {
  /** Ref to the scrollable container element */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  /** Scroll distance in px before the button appears. Default: 300 */
  threshold?: number;
}

export function BackToTop({ scrollContainerRef, threshold = 300 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisible(el.scrollTop > threshold);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, threshold]);

  const handleClick = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          onClick={handleClick}
          initial={{ opacity: 0, y: 16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center
                     bg-primary text-primary-foreground
                     shadow-[0_4px_0_0_hsl(var(--primary)/0.5),0_6px_16px_rgba(0,0,0,0.25)]
                     hover:shadow-[0_6px_0_0_hsl(var(--primary)/0.5),0_8px_20px_rgba(0,0,0,0.3)]
                     active:shadow-[0_1px_0_0_hsl(var(--primary)/0.5),0_2px_8px_rgba(0,0,0,0.2)]
                     transition-shadow border border-primary/20"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
