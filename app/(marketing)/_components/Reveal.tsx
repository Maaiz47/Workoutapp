"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: Direction;
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
  once?: boolean;
  amount?: number;
  as?: "div" | "section" | "article" | "li" | "header" | "footer";
  id?: string;
}

export function Reveal({
  children,
  delay = 0,
  duration = 0.55,
  direction = "up",
  distance = 28,
  className,
  style,
  once = true,
  amount = 0.15,
  as = "div",
  id,
}: RevealProps) {
  const prefersReduced = useReducedMotion();

  const offset = (() => {
    if (prefersReduced) return { x: 0, y: 0 };
    switch (direction) {
      case "up": return { x: 0, y: distance };
      case "down": return { x: 0, y: -distance };
      case "left": return { x: distance, y: 0 };
      case "right": return { x: -distance, y: 0 };
      default: return { x: 0, y: 0 };
    }
  })();

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const MotionTag = (motion as any)[as];

  return (
    <MotionTag
      id={id}
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  stagger?: number;
  once?: boolean;
  amount?: number;
  as?: "div" | "ul" | "section";
  id?: string;
}

export function Stagger({
  children,
  className,
  style,
  delay = 0,
  stagger = 0.08,
  once = true,
  amount = 0.15,
  as = "div",
  id,
}: StaggerProps) {
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };

  const MotionTag = (motion as any)[as];

  return (
    <MotionTag
      id={id}
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={container}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  distance?: number;
  as?: "div" | "li" | "article" | "section";
}

export function StaggerItem({
  children,
  className,
  style,
  distance = 20,
  as = "div",
}: StaggerItemProps) {
  const prefersReduced = useReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : distance },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const MotionTag = (motion as any)[as];

  return (
    <MotionTag className={className} style={style} variants={item}>
      {children}
    </MotionTag>
  );
}
