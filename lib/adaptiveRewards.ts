// Per-exercise recency status — drives the "neglected / over-trained"
// dots in the exercise picker and feeds the adaptive bonus that nudges
// the user toward variety. The intent is variable-reward variety: log
// something you haven't touched in a while and your next contribution
// counts more. (qa: adaptive-exercise-rewards)
//
// Per the design call ("no separate XP/coin currency, keep the effect
// within tier progression") the multiplier here is metadata only in
// slice 1 — it's surfaced to the picker and to the detail popover, but
// it does NOT alter the tier-score formula yet. A later slice can
// blend the multiplier into the volume sub-rank if it tests well.

export type RecencyStatus = "neglected" | "cooling" | "baseline" | "warm" | "over-trained" | "never";

export type ExerciseRecency = {
  exerciseId: string;
  status: RecencyStatus;
  daysSinceLast: number | null;    // null when never logged
  timesLast7Days: number;
  multiplier: number;              // tier-score multiplier if logged now
  label: string;                   // short human-readable status
  bonusText: string;               // "+25% bonus" / "-30% dampener" / etc.
};

const NEVER_MULT      = 1.30;
const NEGLECTED_MULT  = 1.25;
const COOLING_MULT    = 1.10;
const BASELINE_MULT   = 1.00;
const WARM_MULT       = 0.90;
const OVERTRAINED_MULT = 0.75;

// Walk the user's WorkoutLog history map (the dayId → sessions[] shape
// the app already keeps in state) and return a Map of exerciseId →
// recency record. Exercises NEVER logged are NOT in the map — callers
// should treat absence as `{ status: "never", multiplier: NEVER_MULT }`.
export function computeExerciseRecencies(
  history: Record<string, any[]>,
): Map<string, ExerciseRecency> {
  const result = new Map<string, ExerciseRecency>();
  const lastByEx = new Map<string, number>();     // ms timestamp of last set
  const count7d = new Map<string, number>();      // count of distinct days an exercise was logged in last 7d

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;
  const dayKeyByEx = new Map<string, Set<string>>();

  for (const dayId in history) {
    const sessions = history[dayId] ?? [];
    for (const session of sessions) {
      const sets = (session.sets ?? {}) as Record<string, any>;
      const t = new Date(session.date ?? "").getTime();
      const isValid = !Number.isNaN(t);
      const dayKey = (session.date ?? "").slice(0, 10);
      for (const k in sets) {
        const v = sets[k];
        if (!v || v.skipped) continue;
        // Mirror the eid extraction used elsewhere (see
        // computeStatsFromLogs in lib/leaderboardStats.ts):
        // strip trailing -<setNum> and optional -d<dropNum>.
        const parts = k.split("-");
        const last = parts[parts.length - 1];
        if (/^d\d+$/.test(last) && parts.length >= 3) {
          parts.pop(); parts.pop();
        } else {
          parts.pop();
        }
        const eid = parts.join("-");
        if (!eid) continue;
        if (isValid) {
          const prev = lastByEx.get(eid) ?? 0;
          if (t > prev) lastByEx.set(eid, t);
          if (t >= sevenDaysAgo) {
            const s = dayKeyByEx.get(eid) ?? new Set<string>();
            s.add(dayKey);
            dayKeyByEx.set(eid, s);
          }
        }
      }
    }
  }
  dayKeyByEx.forEach((set, eid) => { count7d.set(eid, set.size); });

  lastByEx.forEach((ts, eid) => {
    const daysSince = Math.max(0, Math.floor((now - ts) / 86400000));
    const t7 = count7d.get(eid) ?? 0;
    let status: RecencyStatus;
    let multiplier: number;
    if (t7 >= 3) { status = "over-trained"; multiplier = OVERTRAINED_MULT; }
    else if (daysSince <= 3) { status = "warm"; multiplier = WARM_MULT; }
    else if (daysSince <= 7) { status = "baseline"; multiplier = BASELINE_MULT; }
    else if (daysSince <= 13) { status = "cooling"; multiplier = COOLING_MULT; }
    else { status = "neglected"; multiplier = NEGLECTED_MULT; }
    result.set(eid, {
      exerciseId: eid,
      status,
      daysSinceLast: daysSince,
      timesLast7Days: t7,
      multiplier,
      label: labelFor(status, daysSince, t7),
      bonusText: bonusTextFor(multiplier),
    });
  });
  return result;
}

export function recencyForExercise(
  exerciseId: string,
  recencies: Map<string, ExerciseRecency>,
): ExerciseRecency {
  const hit = recencies.get(exerciseId);
  if (hit) return hit;
  return {
    exerciseId,
    status: "never",
    daysSinceLast: null,
    timesLast7Days: 0,
    multiplier: NEVER_MULT,
    label: "Never logged — try it!",
    bonusText: bonusTextFor(NEVER_MULT),
  };
}

// Dot colour + label hex used by the picker UI. Single source of truth
// so the dot, the popover, and any future detail screens stay aligned.
export function recencyDotColor(status: RecencyStatus): string | null {
  switch (status) {
    case "never":        return "#60a5fa";   // bright blue
    case "neglected":    return "#3b82f6";   // blue
    case "cooling":      return "#7dd3fc";   // pale blue
    case "baseline":     return null;        // no dot — neutral
    case "warm":         return "#fbbf24";   // amber
    case "over-trained": return "#ef4444";   // red
  }
}

function labelFor(status: RecencyStatus, daysSince: number, t7: number): string {
  switch (status) {
    case "neglected":    return `${daysSince}d since — bonus available`;
    case "cooling":      return `${daysSince}d since — small bonus`;
    case "baseline":     return `${daysSince}d ago`;
    case "warm":         return `${daysSince}d ago — recently trained`;
    case "over-trained": return `${t7}× last 7d — give it a rest`;
    case "never":        return "Never logged — try it!";
  }
}

function bonusTextFor(multiplier: number): string {
  if (multiplier > 1) return `+${Math.round((multiplier - 1) * 100)}% variety bonus`;
  if (multiplier < 1) return `${Math.round((multiplier - 1) * 100)}% over-train dampener`;
  return "Baseline";
}
