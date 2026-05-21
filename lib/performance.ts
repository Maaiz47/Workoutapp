// Performance helpers — estimated 1RM, RPE/RIR scale meta. Kept separate
// from app/page.tsx because Next.js route files can only export the
// component-related symbols (default, metadata, etc).

// Estimated 1-rep-max via Epley: weight × (1 + reps/30). For reps = 1
// this returns the weight unchanged. Useful for plotting strength gains
// over time without ever asking the user to actually test a 1RM.
// Returns 0 for invalid inputs.
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Suggest the next weight for an exercise based on the previous session's
// top set. Combines RPE (if logged) and rep performance to bias up, hold,
// or back off. Returns null when there's no prior data or the input is
// nonsense — caller falls back to the existing pre-fill behaviour.
//
// Heuristic:
//   - RPE present:
//       ≤ 5  → +5kg     (way too light)
//       6-7  → +2.5kg   (could've done more)
//       8    → hold     (right at target)
//       9    → -1.25kg or hold (too heavy)
//       10   → -2.5kg   (failed)
//   - No RPE, fall back to rep count vs target range:
//       reps ≥ topRange → +2.5kg
//       reps < bottomRange → -2.5kg
//       else hold
export type ProgressionSuggestion = {
  suggestedWeight: number;
  delta: number;               // +/- vs last
  reason: string;              // short label for the UI chip
  basis: "rpe" | "reps";
};
export function suggestProgression(
  prev: { weight: number; reps: number; rpe?: number | null } | null,
  targetReps: { low: number; high: number } | null,
): ProgressionSuggestion | null {
  if (!prev || !prev.weight || prev.weight <= 0) return null;
  let delta = 0;
  let reason = "";
  let basis: "rpe" | "reps" = "rpe";
  const rpe = typeof prev.rpe === "number" ? prev.rpe : null;
  if (rpe != null) {
    if (rpe <= 5) { delta = 5; reason = `last set was RPE ${rpe} (too easy)`; }
    else if (rpe <= 7) { delta = 2.5; reason = `last set was RPE ${rpe} — could push more`; }
    else if (rpe === 8) { delta = 0; reason = `last set was RPE 8 — right at target`; }
    else if (rpe === 9) { delta = 0; reason = `last set was RPE 9 — hold here`; }
    else { delta = -2.5; reason = `last set was RPE ${rpe} — back off slightly`; }
  } else {
    basis = "reps";
    const r = prev.reps;
    const lo = targetReps?.low ?? 8;
    const hi = targetReps?.high ?? 12;
    if (r >= hi) { delta = 2.5; reason = `hit ${r} reps last session — push up`; }
    else if (r < lo) { delta = -2.5; reason = `only ${r} reps last session — back off`; }
    else { delta = 0; reason = `held ${r} reps — repeat`; }
  }
  const suggestedWeight = Math.max(0, Math.round((prev.weight + delta) * 4) / 4);
  return { suggestedWeight, delta, reason, basis };
}

// Parse a target-reps string like "8-12" or "10–12" or "10" into a range.
export function parseTargetReps(reps: string | null | undefined): { low: number; high: number } | null {
  if (!reps) return null;
  const m = String(reps).match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (m) return { low: parseInt(m[1], 10), high: parseInt(m[2], 10) };
  const single = String(reps).match(/^\s*(\d+)\s*$/);
  if (single) { const v = parseInt(single[1], 10); return { low: v, high: v }; }
  return null;
}

// Detect a plateau for a single exercise. Walks the last N sessions
// chronologically (oldest → newest) and checks whether the user's max
// est-1RM has improved over that window. Threshold is 3 stale sessions
// by default — picked to be sensitive enough to catch real stalls
// without flagging single off days.
export type Plateau = { sessions: number; lastBestEst1RM: number; suggestedReason: string };
export function detectPlateau(
  history: Array<{ weight: number; reps: number }>,
  staleThreshold = 3,
): Plateau | null {
  if (history.length < staleThreshold + 1) return null;
  const recent = history.slice(-staleThreshold - 1);
  let bestSeen = 0;
  const ests = recent.map(h => estimate1RM(h.weight, h.reps));
  for (let i = 0; i < ests.length - staleThreshold; i++) bestSeen = Math.max(bestSeen, ests[i]);
  // If none of the last `staleThreshold` sessions exceeded bestSeen → plateau
  const stale = ests.slice(-staleThreshold).every(e => e <= bestSeen);
  if (!stale) return null;
  return {
    sessions: staleThreshold,
    lastBestEst1RM: bestSeen,
    suggestedReason: `Est 1RM hasn't moved in ${staleThreshold} sessions`,
  };
}

// Deload-week detector. Walks the user's session dates (ISO YYYY-MM-DD)
// and the list of past deload events, returns true if it's been ≥ 4 weeks
// since the last deload AND the user has trained ≥ 10 sessions in that
// window. Picks a sensible "you're stacking enough volume to deserve a
// recovery break" threshold without nagging users who only train once a
// week.
export function shouldSuggestDeload(opts: {
  sessionDates: string[];   // ISO dates of all logged sessions, any order
  pastDeloads: string[];    // ISO dates of accepted deloads
  snoozeUntilIso?: string | null;  // dismiss snooze
  // New: experience-aware tuning. Advanced lifters get tighter windows
  // (deload more often); newcomers get looser (less stacking).
  weeksWindow?: number;     // default 4
  sessionThreshold?: number;// default 10
  // Optional recent-RPE average — pushes the suggestion sooner if the
  // user has been grinding RPE 9-10. < 6 = chill, > 8 = grinding.
  recentAvgRpe?: number | null;
}): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (opts.snoozeUntilIso && opts.snoozeUntilIso > today) return false;
  let weeksWindow = opts.weeksWindow ?? 4;
  let sessionThreshold = opts.sessionThreshold ?? 10;
  // High recent RPE → shave a week off the window and 2 off the threshold.
  if (typeof opts.recentAvgRpe === "number" && opts.recentAvgRpe >= 8.5) {
    weeksWindow = Math.max(2, weeksWindow - 1);
    sessionThreshold = Math.max(6, sessionThreshold - 2);
  }
  const lastDeload = opts.pastDeloads.sort().slice(-1)[0] ?? null;
  const cutoffIso = new Date(Date.now() - weeksWindow * 7 * 86400000).toISOString().slice(0, 10);
  // If no deload ever, look at first session date as the anchor.
  if (!lastDeload) {
    const firstSession = [...opts.sessionDates].sort()[0];
    if (!firstSession || firstSession > cutoffIso) return false;
  } else if (lastDeload > cutoffIso) {
    return false;
  }
  const anchor = lastDeload ?? [...opts.sessionDates].sort()[0] ?? today;
  const sessionsSince = opts.sessionDates.filter(d => d > anchor).length;
  return sessionsSince >= sessionThreshold;
}

// Aggregate volume by muscle group across the user's history. Returns a
// Record keyed by muscle group, where each value is the total kg-reps
// lifted that hit that primary muscle in the given window. Walks every
// logged set, looks up the exercise's primaryMuscles, and credits the
// volume to each of them.
export function volumeByMuscle(
  history: Record<string, any[]>,
  exerciseMuscles: Record<string, string[]>,
  windowDays: number = 14,
): Record<string, number> {
  const cutoff = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const totals: Record<string, number> = {};
  for (const dayId in history) {
    for (const session of history[dayId]) {
      const iso = (() => {
        const d = new Date(session.date);
        return isNaN(+d) ? session.date : d.toISOString().slice(0, 10);
      })();
      if (iso < cutoff) continue;
      const sets = session.sets ?? {};
      for (const k in sets) {
        const s = sets[k];
        if (!s || s.skipped) continue;
        const exKey = k.replace(/-\d+(-d\d+)?$/, "");
        const muscles = exerciseMuscles[exKey] ?? [];
        const vol = (s.weight ?? 0) * (s.reps ?? 0);
        for (const m of muscles) {
          totals[m] = (totals[m] ?? 0) + vol;
        }
      }
    }
  }
  return totals;
}

// Build a CSV string from a workout history map. One row per logged set
// across every session, columns: date, dayId, exercise, setKey, weight,
// reps, RPE, note, est1RM. Used by the Settings "Export CSV" button.
export function buildHistoryCSV(history: Record<string, any[]>): string {
  const rows: string[] = [];
  rows.push("date,dayId,exerciseKey,setKey,weight,reps,rpe,est1RM,note");
  const esc = (s: any) => {
    const v = s == null ? "" : String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  for (const dayId in history) {
    for (const session of history[dayId]) {
      const date = session.date ?? "";
      const sets = session.sets ?? {};
      for (const setKey in sets) {
        const s = sets[setKey];
        if (!s) continue;
        const exKey = setKey.replace(/-\d+(-d\d+)?$/, "");
        const w = s.weight ?? 0, r = s.reps ?? 0;
        const e1 = estimate1RM(w, r);
        rows.push([
          esc(date), esc(dayId), esc(exKey), esc(setKey),
          esc(w), esc(r),
          esc(s.rpe ?? ""), esc(e1),
          esc(s.note ?? ""),
        ].join(","));
      }
    }
  }
  return rows.join("\n") + "\n";
}

// Combined effort scale meta — what to show under each 1-10 chip. Maps the
// classic RPE (Rate of Perceived Exertion) and RIR (Reps in Reserve)
// interpretations onto the same 1-10 scale so the UI works for both schools
// of thought without forcing a Settings toggle.
export const EFFORT_SCALE: Array<{ value: number; rpe: string; rir: string; color: string }> = [
  { value: 1,  rpe: "WARM-UP",   rir: "many left", color: "rgba(255,255,255,0.3)" },
  { value: 2,  rpe: "VERY EASY", rir: "9+ RIR",    color: "rgba(255,255,255,0.4)" },
  { value: 3,  rpe: "EASY",      rir: "8 RIR",     color: "#74b9ff" },
  { value: 4,  rpe: "LIGHT",     rir: "7 RIR",     color: "#74b9ff" },
  { value: 5,  rpe: "MODERATE",  rir: "5 RIR",     color: "#55efc4" },
  { value: 6,  rpe: "SOMEWHAT",  rir: "4 RIR",     color: "#55efc4" },
  { value: 7,  rpe: "HARD",      rir: "3 RIR",     color: "#fdcb6e" },
  { value: 8,  rpe: "VERY HARD", rir: "2 RIR",     color: "#fdcb6e" },
  { value: 9,  rpe: "NEAR MAX",  rir: "1 RIR",     color: "#FF6B6B" },
  { value: 10, rpe: "FAILURE",   rir: "0 RIR",     color: "#FF6B6B" },
];
