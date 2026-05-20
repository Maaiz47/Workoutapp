"use client";

import { motion, useReducedMotion, useScroll, useTransform, useMotionTemplate, useSpring, useMotionValue } from "framer-motion";
import { ReactNode, useRef } from "react";

interface Tilt3DProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Max rotateX in degrees applied at viewport edges. Default 8. */
  tilt?: number;
  /** Perspective in pixels. Default 1200. */
  perspective?: number;
  /** Translate-Z range in pixels at viewport edges. Default 24. */
  depth?: number;
}

/**
 * Wraps children in a perspective container that tilts subtly as it scrolls
 * through the viewport — entering from below tilts forward, leaving toward the
 * top tilts away. Matches the app's `.tilt-3d-item` aesthetic but ties to
 * scroll position rather than entry timing.
 */
export function Tilt3D({ children, className, style, tilt = 8, perspective = 1200, depth = 24 }: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const rawRotate = useTransform(scrollYProgress, [0, 0.5, 1], [tilt, 0, -tilt]);
  const rawZ = useTransform(scrollYProgress, [0, 0.5, 1], [-depth, 0, -depth]);

  const rotateX = useSpring(rawRotate, { stiffness: 120, damping: 22, mass: 0.5 });
  const translateZ = useSpring(rawZ, { stiffness: 120, damping: 22, mass: 0.5 });

  const transform = useMotionTemplate`perspective(${perspective}px) rotateX(${rotateX}deg) translateZ(${translateZ}px)`;

  if (prefersReduced) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, transform, transformStyle: "preserve-3d", willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

interface MouseTilt3DProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Max rotateY in degrees at edge of element. Default 12. */
  maxRotate?: number;
}

/**
 * Apple-style mouse-tracking 3D tilt. Used for hero phone mockups.
 */
export function MouseTilt3D({ children, className, style, maxRotate = 12 }: MouseTilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-1, 1], [maxRotate, -maxRotate]), { stiffness: 200, damping: 22 });
  const rotateY = useSpring(useTransform(x, [-1, 1], [-maxRotate, maxRotate]), { stiffness: 200, damping: 22 });

  const transform = useMotionTemplate`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    x.set(nx);
    y.set(ny);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (prefersReduced) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, transform, transformStyle: "preserve-3d", willChange: "transform" }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.div>
  );
}
