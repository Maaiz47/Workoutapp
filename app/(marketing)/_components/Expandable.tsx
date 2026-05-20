"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ReactNode, useState } from "react";

interface ExpandableProps {
  children?: ReactNode;
  detail: ReactNode;
  className?: string;
  /** Optional label override for the expand button. Default "See more detail". */
  label?: string;
  /** Optional override for the collapsed-state label. Default "Hide detail". */
  collapsedLabel?: string;
  defaultOpen?: boolean;
}

/**
 * Click-to-expand card. The summary content is always visible; tapping the
 * footer chevron reveals an inline detail panel that animates open.
 */
export function Expandable({ children, detail, className, label = "See in action", collapsedLabel = "Show less", defaultOpen = false }: ExpandableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const prefersReduced = useReducedMotion();

  return (
    <div className={`expandable${open ? " open" : ""}${className ? " " + className : ""}`}>
      {children}
      <button
        type="button"
        className="expandable-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? collapsedLabel : label}</span>
        <span className="expandable-chevron" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="expandable-detail">
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
