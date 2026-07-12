"use client";

import { motion, MotionValue, useScroll, useTransform } from "framer-motion";
import { RefObject, useRef, type ReactNode } from "react";

type ScrollParallaxLayerProps = {
  children: ReactNode;
  className?: string;
  scrollTarget?: RefObject<HTMLElement | null>;
  yRange?: [number, number];
  scaleRange?: [number, number];
  opacityRange?: [number, number];
};

export default function ScrollParallaxLayer({
  children,
  className,
  scrollTarget,
  yRange = [0, 120],
  scaleRange = [1.1, 1.22],
  opacityRange = [0.06, 0.1],
}: ScrollParallaxLayerProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const target = scrollTarget ?? localRef;
  const { scrollYProgress } = useScroll({
    target,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], yRange);
  const scale = useTransform(scrollYProgress, [0, 1], scaleRange);
  const opacity = useTransform(scrollYProgress, [0, 1], opacityRange);

  return (
    <ParallaxMotion
      className={className}
      y={y}
      scale={scale}
      opacity={opacity}
    >
      {children}
    </ParallaxMotion>
  );
}

function ParallaxMotion({
  children,
  className,
  y,
  scale,
  opacity,
}: {
  children: ReactNode;
  className?: string;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
}) {
  return (
    <motion.div className={className} style={{ y, scale, opacity }}>
      {children}
    </motion.div>
  );
}
