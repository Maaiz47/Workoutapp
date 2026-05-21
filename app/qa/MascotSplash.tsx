"use client";

// Full-screen Baki-style mascot splash that greets testers on /qa.
// Triggers once per session (sessionStorage), can be re-summoned from the
// leaderboard. Looks for /qa-mascot.png; falls back to a placeholder card
// if the image isn't there yet.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MascotProps {
  username: string | null;          // logged-in username, if any
  points: number;                   // visitor's total leaderboard points
  rank: number | null;              // 1-based rank, null if no comments yet
  totalTesters: number;
  bugs: number;                     // verified bugs they found
  comments: number;                 // total comments they submitted
  onDismiss: () => void;
}

// Pick a dialogue arc based on the visitor's state. Every line is its own
// string so the typewriter can take a breath between them. Lean into the
// Baki melodrama — over-the-top intensity is the point.
function pickDialogue(p: MascotProps): string[] {
  const name = p.username ? "@" + p.username : "STRANGER";
  if (p.comments === 0) {
    return [
      "...So. You have finally arrived.",
      "I am DOPPO. Sensei of the IRONLOG dojo.",
      "Slayer of regressions. Devourer of bugs.",
      `${name}. Your record is EMPTY.`,
      "Find a flaw. Submit it. Or do not return.",
    ];
  }
  if (p.rank === 1) {
    return [
      `AHHH. ${name}. I felt your presence.`,
      `RANK #1 of ${p.totalTesters}. ${p.points.toFixed(0)} points.`,
      `${p.bugs} bugs slain by your hand.`,
      "...few have walked this path.",
      "But the dojo is never satisfied. NEVER.",
    ];
  }
  if (p.rank && p.rank <= 3) {
    return [
      `${name}. Welcome back to the dojo.`,
      `RANK #${p.rank}. ${p.points.toFixed(0)} points. ${p.bugs} bugs.`,
      "The top is within REACH.",
      "Crush more bugs. Climb. CLIMB.",
    ];
  }
  if (p.bugs === 0 && p.comments > 0) {
    return [
      `${name}.`,
      `${p.comments} comments. ZERO verified bugs.`,
      "Are you AFRAID of the FAILING button?",
      "COWARDLY. Break something. PROVE YOURSELF.",
    ];
  }
  return [
    `${name}. You return.`,
    `${p.comments} comments. ${p.bugs} bugs. ${p.points.toFixed(0)} points.`,
    `Rank #${p.rank ?? "?"} of ${p.totalTesters}.`,
    "It is NOT ENOUGH. Test again. CRUSH MORE BUGS.",
  ];
}

export default function MascotSplash(props: MascotProps) {
  const lines = pickDialogue(props);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Typewriter — advances char-by-char, pauses between lines.
  useEffect(() => {
    if (done) return;
    if (lineIdx >= lines.length) { setDone(true); return; }
    const line = lines[lineIdx];
    if (charIdx >= line.length) {
      const t = setTimeout(() => { setLineIdx(i => i + 1); setCharIdx(0); }, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCharIdx(c => c + 1), 28);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, lines, done]);

  // Tap anywhere: if mid-typing, skip to end. If done, dismiss.
  const onTap = () => {
    if (!done) { setLineIdx(lines.length); setDone(true); return; }
    props.onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onTap}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at center, rgba(60,0,0,0.85) 0%, rgba(0,0,0,0.97) 70%, #000 100%)",
        display: "flex", flexDirection: "column",
        cursor: "pointer", overflow: "hidden",
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {/* Sun-rays backdrop (manga speed-lines) */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: "repeating-conic-gradient(from 0deg at 50% 40%, rgba(255,107,107,0.04) 0deg 4deg, transparent 4deg 12deg)",
        opacity: 0.6,
        animation: "doppo-spin 60s linear infinite",
      }} />

      {/* Mascot */}
      <div style={{
        flex: "1 1 auto",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        position: "relative", zIndex: 1,
        padding: "20px 16px 0",
      }}>
        {!imgFailed ? (
          <motion.img
            src="/qa-mascot.png"
            alt="Doppo, the IRONLOG QA sensei"
            onError={() => setImgFailed(true)}
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            style={{
              maxHeight: "60vh", maxWidth: "90vw",
              filter: "drop-shadow(0 20px 40px rgba(255,107,107,0.35)) drop-shadow(0 4px 8px rgba(0,0,0,0.6))",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div style={{
            maxWidth: 320, padding: "32px 20px",
            background: "rgba(0,0,0,0.5)",
            border: "1px dashed rgba(255,107,107,0.4)",
            borderRadius: 16, textAlign: "center",
            color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.7,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🥋</div>
            <div style={{ color: "#FF6B6B", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
              DOPPO IS TRAINING
            </div>
            <div>
              Drop a transparent PNG at<br />
              <code style={{ color: "#FFD700" }}>/public/qa-mascot.png</code><br />
              and he&apos;ll appear here.
            </div>
          </div>
        )}
      </div>

      {/* Manga speech bubble */}
      <div style={{
        position: "relative", zIndex: 1,
        margin: "0 12px 16px",
        background: "linear-gradient(180deg, #fff 0%, #f5f5f5 100%)",
        color: "#0a0a0a",
        border: "3px solid #000",
        borderRadius: 14,
        padding: "18px 18px 14px",
        boxShadow: "0 8px 0 #000, 0 12px 24px rgba(0,0,0,0.5)",
        minHeight: 160,
      }}>
        {/* speech-bubble tail */}
        <div aria-hidden style={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderBottom: "14px solid #000",
        }} />
        <div aria-hidden style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "11px solid transparent",
          borderRight: "11px solid transparent",
          borderBottom: "11px solid #fff",
        }} />

        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2,
          color: "#FF6B6B", marginBottom: 8,
        }}>DOPPO · QA SENSEI</div>

        <div style={{
          fontSize: 15, lineHeight: 1.55, fontWeight: 600,
          minHeight: 84,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {lines.slice(0, lineIdx).map((l, i) => (
            <div key={i} style={{ marginBottom: 4 }}>{l}</div>
          ))}
          {lineIdx < lines.length && (
            <div>
              {lines[lineIdx].slice(0, charIdx)}
              <span style={{ opacity: charIdx % 2 ? 1 : 0.3 }}>▌</span>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: "1px dashed rgba(0,0,0,0.15)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 10, letterSpacing: 1.5, color: "rgba(0,0,0,0.55)",
        }}>
          <span>{done ? "TAP TO ENTER ▸" : "TAP TO SKIP"}</span>
          <span>IRONLOG · QA DOJO</span>
        </div>
      </div>

      <style>{`
        @keyframes doppo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
}
