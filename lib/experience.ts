// Experience level — auto-derived from training history and time on app.
// The user's onboarding-recorded experience is a starting point; after
// enough time on the app, only what they've actually done counts.
//
// Lifecycle:
//   - First 6 months: max(recorded, auto-derived) — user's claim is trusted
//   - After 6 months:  only auto-derived — claim is no longer valid

export type ExperienceLevel = "newcomer" | "beginner" | "intermediate" | "advanced";

const EXP_ORDER: ExperienceLevel[] = ["newcomer", "beginner", "intermediate", "advanced"];

function expRank(e: ExperienceLevel): number {
  return EXP_ORDER.indexOf(e);
}

// Auto-derived: how experienced is the user purely based on what they've
// done on the app? Conservative thresholds — biased to keep newer users
// at lower levels until they've genuinely accumulated training.
export function autoExperience(opts: {
  monthsOnApp: number;
  totalSessions: number;
  prCount: number;
}): ExperienceLevel {
  const { monthsOnApp, totalSessions, prCount } = opts;
  if (monthsOnApp >= 12 && totalSessions >= 180 && prCount >= 30) return "advanced";
  if (monthsOnApp >= 6  && totalSessions >= 80  && prCount >= 10) return "intermediate";
  if (monthsOnApp >= 3  || totalSessions >= 30) return "beginner";
  return "newcomer";
}

// Combine the user's recorded experience and the auto-derived one. After
// the trust window (6 months) the recorded value is discarded.
export function effectiveExperience(opts: {
  recorded: ExperienceLevel | null | undefined;
  monthsOnApp: number;
  totalSessions: number;
  prCount: number;
}): { level: ExperienceLevel; source: "recorded" | "auto" | "blended" } {
  const auto = autoExperience(opts);
  const TRUST_MONTHS = 6;
  if (opts.monthsOnApp >= TRUST_MONTHS || !opts.recorded) {
    return { level: auto, source: "auto" };
  }
  const recRank = expRank(opts.recorded);
  const autoRank = expRank(auto);
  if (autoRank >= recRank) return { level: auto, source: "auto" };
  return { level: opts.recorded, source: "blended" };
}

// How long until the user's recorded experience expires? Used by the UI
// to say "your recorded level is valid for another X months". Returns 0
// after the trust window.
export function monthsUntilExpRecordedExpires(monthsOnApp: number): number {
  return Math.max(0, 6 - monthsOnApp);
}

// What does this level mean for training pace? Returned values are
// sourced from lib/principles.ts DELOAD_POLICY so the deload detector
// reads the same numbers training science has settled on.
import { DELOAD_POLICY } from "./principles";
export function experienceProfile(level: ExperienceLevel): {
  // How many weeks of stacking before a deload is suggested.
  deloadWindowWeeks: number;
  // How many sessions in that window need to be hit.
  deloadSessionThreshold: number;
  // Recommended top-set RPE on heavy lifts (lower for newcomers).
  recommendedRpe: number;
} {
  const p = DELOAD_POLICY[level];
  const sessionThreshold = level === "newcomer" ? 15 : level === "beginner" ? 12 : level === "intermediate" ? 10 : 8;
  const recommendedRpe = level === "newcomer" || level === "beginner" ? 7 : 8;
  return { deloadWindowWeeks: p.weeksBetween, deloadSessionThreshold: sessionThreshold, recommendedRpe };
}

// Compact label-and-icon meta for the UI badge.
export function experienceMeta(level: ExperienceLevel): { label: string; icon: string; color: string } {
  switch (level) {
    case "newcomer":     return { label: "NEWCOMER",     icon: "🌱", color: "#94a3b8" };
    case "beginner":     return { label: "BEGINNER",     icon: "🌿", color: "#55efc4" };
    case "intermediate": return { label: "INTERMEDIATE", icon: "🌳", color: "#74b9ff" };
    case "advanced":     return { label: "ADVANCED",     icon: "🔥", color: "#FF6B6B" };
  }
}
