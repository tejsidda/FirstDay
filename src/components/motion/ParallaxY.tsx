"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { ensureGsap, prefersReducedMotion } from "./gsapSetup";

type ParallaxYProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Target y offset in px reached as the element scrolls through the viewport. */
  y?: number;
  /** ScrollTrigger scrub smoothing (Mock.html uses 1.5-3). */
  scrub?: number;
  /** Only run at or above this viewport width (px). 0 = always. */
  minWidth?: number;
  /** ScrollTrigger start (default "top bottom"). Use "top top" for hero sections. */
  start?: string;
  /** ScrollTrigger end (default "bottom top"). */
  end?: string;
  /** ScrollTrigger trigger element. Defaults to the parallax element itself. */
  triggerRef?: RefObject<HTMLElement | null>;
};

/**
 * Scrubbed vertical parallax: y 0 -> `y` while the element passes through
 * the viewport ("top bottom" -> "bottom top"), ease none.
 */
export default function ParallaxY({
  children,
  className,
  style,
  y = -60,
  scrub = 1.5,
  minWidth = 0,
  start = "top bottom",
  end = "bottom top",
  triggerRef,
}: ParallaxYProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;

    const { gsap } = ensureGsap();
    const trigger = triggerRef?.current ?? el;

    const ctx = gsap.context(() => {
      const create = () =>
        gsap.fromTo(
          el,
          { y: 0 },
          {
            y,
            ease: "none",
            scrollTrigger: {
              trigger,
              start,
              end,
              scrub,
            },
          },
        );

      if (minWidth > 0) {
        const mm = gsap.matchMedia();
        mm.add(`(min-width: ${minWidth}px)`, () => {
          const tween = create();
          return () => tween.scrollTrigger?.kill();
        });
      } else {
        create();
      }
    }, el);

    return () => ctx.revert();
  }, [y, scrub, minWidth, start, end, triggerRef]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
