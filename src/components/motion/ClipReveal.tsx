"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ensureGsap, prefersReducedMotion } from "./gsapSetup";

/** Directional clip-path wipe variants cycled per item (from Mock.html). */
const CLIP_VARIANTS = [
  "inset(100% 100% 0% 0%)",
  "inset(100% 0% 0% 100%)",
  "inset(100% 0% 0% 0%)",
  "inset(0% 100% 100% 0%)",
  "inset(0% 0% 100% 100%)",
  "inset(100% 0% 0% 0%)",
];

type ClipRevealProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Index used to cycle the wipe direction (e.g. grid position). */
  variant?: number;
  duration?: number;
};

/**
 * Image/content wrapper that wipes in via clip-path.
 * Recipe: inset(100% ...) -> inset(0), 1.2s power4.inOut, start "top 88%", once.
 */
export default function ClipReveal({
  children,
  className,
  style,
  variant = 0,
  duration = 1.2,
}: ClipRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const { gsap } = ensureGsap();
    const from = CLIP_VARIANTS[Math.abs(variant) % CLIP_VARIANTS.length];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { clipPath: from },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration,
          ease: "power4.inOut",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        },
      );
    }, el);

    return () => ctx.revert();
  }, [variant, duration]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
