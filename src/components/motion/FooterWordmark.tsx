"use client";

import { useLayoutEffect, useRef } from "react";
import { ensureGsap, prefersReducedMotion } from "./gsapSetup";

type FooterWordmarkProps = {
  text?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Oversized display wordmark. Letters rise from below on scroll
 * (yPercent 120 -> 0, 1.2s, power4.inOut, staggered) and pop with an
 * elastic scale on hover (scale -> 0.05 -> elastic.out(1, 0.8)),
 * mirroring the Mock.html footer SVG signature.
 */
export default function FooterWordmark({
  text = "FDFS",
  className,
  style,
}: FooterWordmarkProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.querySelectorAll<HTMLElement>(".wordmark-letter").forEach((l) => {
        l.style.transform = "none";
      });
      return;
    }

    const { gsap } = ensureGsap();

    const ctx = gsap.context(() => {
      const letters = el.querySelectorAll<HTMLElement>(".wordmark-letter");

      // y: 0 clears the inline translateY(120%) fallback (GSAP parses it as px)
      gsap.fromTo(
        letters,
        { y: 0, yPercent: 120 },
        {
          yPercent: 0,
          duration: 1.2,
          ease: "power4.inOut",
          stagger: 0.07,
          delay: 0.2,
          scrollTrigger: {
            trigger: el,
            start: "top 95%",
            once: true,
          },
        },
      );

      letters.forEach((letter) => {
        let animating = false;
        letter.addEventListener("mouseenter", () => {
          if (animating) return;
          animating = true;
          gsap
            .timeline({ onComplete: () => (animating = false) })
            .to(letter, { scale: 0.05, duration: 0.6, ease: "power2.inOut" })
            .to(letter, { scale: 1, duration: 1.8, ease: "elastic.out(1, 0.8)" });
        });
      });
    }, el);

    return () => ctx.revert();
  }, [text]);

  return (
    <div ref={ref} className={className} style={style} aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          aria-hidden
          style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}
        >
          <span className="wordmark-letter" style={{ transform: "translateY(120%)" }}>
            {char}
          </span>
        </span>
      ))}
    </div>
  );
}
