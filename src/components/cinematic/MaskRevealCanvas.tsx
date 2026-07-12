"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uProgress;
  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5, 0.48);
    float dist = distance(vUv, center);
    float edge = 0.22;
    float reveal = smoothstep(1.0 - uProgress - edge, 1.0 - uProgress + 0.02, 1.0 - dist);
    float alpha = 1.0 - reveal;
    gl_FragColor = vec4(0.04, 0.04, 0.06, alpha);
  }
`;

function RevealPlane({ progress }: { progress: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uProgress.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uProgress.value,
        progress,
        0.12,
      );
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        uniforms={{
          uProgress: { value: 0 },
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

type MaskRevealCanvasProps = {
  active: boolean;
  progress: number;
};

export default function MaskRevealCanvas({
  active,
  progress,
}: MaskRevealCanvasProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[25]">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <RevealPlane progress={progress} />
      </Canvas>
    </div>
  );
}
