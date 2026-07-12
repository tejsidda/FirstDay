"use client";

import {
  createElement,
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";
import { ensureGsap, prefersReducedMotion } from "./gsapSetup";

type SplitRevealProps = {
  children: ReactNode;
  /** Wrapping element, e.g. "h1", "p". Defaults to "div". */
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
  /** "lines" (default) or "chars" — the Mock.html [line]/[letter] patterns. */
  split?: "lines" | "chars";
  /** Play immediately on mount instead of waiting for scroll. */
  immediate?: boolean;
  delay?: number;
};

/**
 * Masked text reveal: content is split into lines/chars, each wrapped in an
 * overflow-clipped mask, then slid up from yPercent 100 -> 0.
 * Recipe: duration 1, power4.inOut, stagger 0.05 (lines) / 0.03 (chars),
 * ScrollTrigger start "top 95%".
 */
export default function SplitReveal({
  children,
  as = "div",
  className,
  style,
  split = "lines",
  immediate = false,
  delay = 0,
}: SplitRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const { gsap, SplitText } = ensureGsap();

    const ctx = gsap.context(() => {
      const splitter = SplitText.create(el, {
        type: split,
        mask: split,
        autoSplit: true,
        onSplit(self) {
          const targets = split === "lines" ? self.lines : self.chars;
          return gsap.fromTo(
            targets,
            { yPercent: 100 },
            {
              yPercent: 0,
              duration: 1,
              ease: "power4.inOut",
              stagger: split === "lines" ? 0.05 : 0.03,
              delay,
              ...(immediate
                ? {}
                : {
                    scrollTrigger: {
                      trigger: el,
                      start: "top 95%",
                      once: true,
                    },
                  }),
            },
          );
        },
      });

      return () => splitter.revert();
    }, el);

    return () => ctx.revert();
  }, [split, immediate, delay]);

  return createElement(as, { ref, className, style }, children);
}
