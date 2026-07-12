"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import LandingLoader from "@/components/cinematic/LandingLoader";
import ScrollParallaxLayer from "@/components/cinematic/ScrollParallaxLayer";

const MaskRevealCanvas = dynamic(
  () => import("@/components/cinematic/MaskRevealCanvas"),
  { ssr: false },
);

type LandingCinematicShellProps = {
  posters: string[];
  children: (props: {
    heroRevealed: boolean;
    readyForInteraction: boolean;
  }) => React.ReactNode;
};

export default function LandingCinematicShell({
  posters,
  children,
}: LandingCinematicShellProps) {
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const [heroRevealed, setHeroRevealed] = useState(!!reduceMotion);
  const [readyForInteraction, setReadyForInteraction] = useState(!!reduceMotion);
  const [maskActive, setMaskActive] = useState(!reduceMotion);
  const [maskProgress, setMaskProgress] = useState(reduceMotion ? 1 : 0);

  const [revealStarted, setRevealStarted] = useState(false);

  const handleRevealStart = useCallback(() => {
    window.dispatchEvent(new CustomEvent("loader:hero-reveal-start"));
    setMaskActive(true);
    setRevealStarted(true);

    if (reduceMotion) {
      setMaskProgress(1);
    }
  }, [reduceMotion]);

  useEffect(() => {
    if (!revealStarted || reduceMotion) return;

    const start = performance.now();
    const duration = 900;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = Math.min(1, elapsed / duration);
      setMaskProgress(next);

      if (elapsed < duration) {
        frame = requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => setMaskActive(false), 350);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealStarted, reduceMotion]);

  const handleRevealComplete = useCallback(() => {
    setHeroRevealed(true);
    setReadyForInteraction(true);
    window.dispatchEvent(new CustomEvent("loader:hero-revealed"));
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      window.dispatchEvent(new CustomEvent("loader:hero-revealed"));
    }
  }, [reduceMotion]);

  return (
    <main
      ref={mainRef}
      className="relative min-h-[180vh] text-white"
      style={{
        fontFamily: "var(--font-display)",
        background: "var(--background-base)",
      }}
    >
      {!reduceMotion && (
        <LandingLoader
          onRevealStart={handleRevealStart}
          onRevealComplete={handleRevealComplete}
        />
      )}

      <section className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <ScrollParallaxLayer
            className="absolute inset-0"
            scrollTarget={mainRef}
            yRange={[0, 180]}
            scaleRange={[1.08, 1.24]}
            opacityRange={[0.05, 0.09]}
          >
            <div className="grid h-full grid-cols-5 gap-6 blur-sm">
              {posters.concat(posters).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  className="h-full w-full rounded-md object-cover"
                  alt=""
                />
              ))}
            </div>
          </ScrollParallaxLayer>

          <ScrollParallaxLayer
            className="pointer-events-none absolute inset-0"
            scrollTarget={mainRef}
            yRange={[0, 80]}
            scaleRange={[1, 1.08]}
            opacityRange={[0.02, 0.05]}
          >
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 55%)",
              }}
            />
          </ScrollParallaxLayer>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(212,175,55,0.02) 0%, transparent 60%), radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 78%, var(--background-base) 100%)",
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[5] opacity-[0.05] mix-blend-soft-light film-grain" />

        <MaskRevealCanvas active={maskActive} progress={maskProgress} />

        <motion.div
          className="relative z-10 h-full w-full"
          initial={
            reduceMotion
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: 28, filter: "blur(8px)" }
          }
          animate={
            heroRevealed
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: 28, filter: "blur(8px)" }
          }
          transition={{ duration: 0.85, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            pointerEvents: readyForInteraction ? "auto" : "none",
          }}
        >
          {children({ heroRevealed, readyForInteraction })}
        </motion.div>
      </section>

      <div className="h-[80vh]" aria-hidden />
    </main>
  );
}
