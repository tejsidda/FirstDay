"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type LandingLoaderProps = {
  onRevealStart: () => void;
  onRevealComplete: () => void;
};

export default function LandingLoader({
  onRevealStart,
  onRevealComplete,
}: LandingLoaderProps) {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduceMotion) {
      onRevealStart();
      onRevealComplete();
      setVisible(false);
      return;
    }

    const duration = 2400;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);

      if (elapsed < duration) {
        frame = requestAnimationFrame(tick);
      } else {
        onRevealStart();
        window.setTimeout(() => {
          setVisible(false);
          onRevealComplete();
        }, 500);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onRevealComplete, onRevealStart, reduceMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--background-base)]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          aria-hidden={!visible}
        >
          <div className="flex flex-col items-center gap-8 px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[13px] uppercase tracking-[0.42em] text-[rgba(255,255,255,0.35)]"
            >
              F D F S
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="t-display text-[clamp(48px,12vw,96px)] text-[rgba(212,175,55,0.82)]"
            >
              {progress}
            </motion.div>

            <div className="h-px w-24 bg-[rgba(255,255,255,0.08)]" />

            <p className="max-w-xs text-[13px] italic text-[rgba(255,255,255,0.28)]">
              Rolling credits on your personal reel
            </p>

            <div className="h-1 w-48 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
              <motion.div
                className="h-full rounded-full bg-[rgba(212,175,55,0.55)]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.15, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
