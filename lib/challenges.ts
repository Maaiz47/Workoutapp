// Monthly challenges — opt-in goals that reset each month. v1 keeps the
// catalogue hardcoded so we don't need an admin UI yet. Progress is
// computed client-side from the user's workout history; opt-ins are
// localStorage-backed (a future slice can promote to a DB table for the
// global-leaderboard ranking).

export type ChallengeMetric =
  | "total_reps"          // sum of reps across all sets that hit a target exercise
  | "total_sessions"      // count of logged sessions
  | "total_volume_kg"     // weight × reps total
  | "exercise_distinct";  // distinct exercises logged

export type Challenge = {
  id: string;             // stable, never reused
  monthIso: string;       // "YYYY-MM" — the challenge's active month
  title: string;
  body: string;
  icon: string;
  metric: ChallengeMetric;
  target: number;         // value needed to "complete"
  // For exercise-targeted metrics, filter by exercise key contains.
  exerciseSubstrings?: string[];
};

// Helper to produce the current YYYY-MM string (UTC-safe enough).
export function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Active challenges — only the ones for the current month are surfaced.
// Update this list each month, or add 2-3 evergreens that re-fire each
// month with a new monthIso. v1 keeps it simple: replace before each month.
export const CHALLENGES: Challenge[] = [
  {
    id: "may-2026-pushups",
    monthIso: currentMonthIso(),
    title: "Push-Up Monster",
    body: "Log 1,000 push-up reps across the month.",
    icon: "💥",
    metric: "total_reps",
    target: 1000,
    exerciseSubstrings: ["push-up", "pushup"],
  },
  {
    id: "may-2026-sessions",
    monthIso: currentMonthIso(),
    title: "Showing Up",
    body: "20 logged sessions this month.",
    icon: "📅",
    metric: "total_sessions",
    target: 20,
  },
  {
    id: "may-2026-volume",
    monthIso: currentMonthIso(),
    title: "Heavy Hauler",
    body: "Move 50,000 kg of total volume (weight × reps).",
    icon: "🏋",
    metric: "total_volume_kg",
    target: 50_000,
  },
];

// Compute the user's current progress against a challenge from their
// workout history. Caller passes the same `history` map the rest of the
// app uses (dayId → sessions[]).
export function computeChallengeProgress(
  challenge: Challenge,
  history: Record<string, any[]>,
): number {
  const monthPrefix = challenge.monthIso; // "YYYY-MM"
  let total = 0;
  let sessionCount = 0;
  const distinct = new Set<string>();
  for (const dayId in history) {
    for (const session of history[dayId]) {
      const dateStr = session.date as string;
      let iso = dateStr;
      const parsed = new Date(dateStr);
      if (!isNaN(+parsed)) iso = parsed.toISOString().slice(0, 7);
      else iso = dateStr.slice(0, 7);
      if (iso !== monthPrefix) continue;
      sessionCount += 1;
      const sets = (session.sets ?? {}) as Record<string, any>;
      for (const k in sets) {
        const v = sets[k];
        if (!v || v.skipped) continue;
        const exKey = k.replace(/-\d+(-d\d+)?$/, "");
        if (challenge.exerciseSubstrings) {
          const matches = challenge.exerciseSubstrings.some(s => exKey.toLowerCase().includes(s.toLowerCase()));
          if (!matches) continue;
        }
        distinct.add(exKey);
        if (challenge.metric === "total_reps") total += v.reps ?? 0;
        if (challenge.metric === "total_volume_kg") total += (v.weight ?? 0) * (v.reps ?? 0);
      }
    }
  }
  if (challenge.metric === "total_sessions") return sessionCount;
  if (challenge.metric === "exercise_distinct") return distinct.size;
  return total;
}

const OPTIN_KEY = "ironlog-challenge-optin-v1";

export function isOptedIn(challengeId: string): boolean {
  try {
    const arr = JSON.parse(localStorage.getItem(OPTIN_KEY) ?? "[]") as string[];
    return arr.includes(challengeId);
  } catch { return false; }
}

export function toggleOptIn(challengeId: string): boolean {
  try {
    const arr = JSON.parse(localStorage.getItem(OPTIN_KEY) ?? "[]") as string[];
    const has = arr.includes(challengeId);
    const next = has ? arr.filter(id => id !== challengeId) : [...arr, challengeId];
    localStorage.setItem(OPTIN_KEY, JSON.stringify(next));
    return !has;
  } catch { return false; }
}

// ── WEEKLY RECAP ────────────────────────────────────────────────────
// Lightweight client-side recap shown on the first home-open after Sunday
// midnight. Stored in localStorage as the ISO of the last recap week.

const RECAP_KEY = "ironlog-recap-week-v1";

export type WeeklyRecap = {
  sessions: number;
  totalVolumeKg: number;
  prCount: number;
  topExercise: { name: string; volume: number } | null;
};

export function buildWeeklyRecap(history: Record<string, any[]>): WeeklyRecap {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  let sessions = 0, totalVolume = 0, prCount = 0;
  const perEx: Record<string, number> = {};
  for (const dayId in history) {
    for (const session of history[dayId]) {
      const d = new Date(session.date);
      if (isNaN(+d) || d < weekAgo) continue;
      sessions += 1;
      const sets = (session.sets ?? {}) as Record<string, any>;
      for (const k in sets) {
        const v = sets[k];
        if (!v || v.skipped) continue;
        const exKey = k.replace(/-\d+(-d\d+)?$/, "");
        const vol = (v.weight ?? 0) * (v.reps ?? 0);
        totalVolume += vol;
        perEx[exKey] = (perEx[exKey] ?? 0) + vol;
      }
    }
  }
  // For PR count we'd need historical comparison — for the recap we
  // approximate by counting exercises that had positive volume this week.
  prCount = Object.keys(perEx).length;
  const top = Object.entries(perEx).sort(([, a], [, b]) => b - a)[0];
  return {
    sessions,
    totalVolumeKg: totalVolume,
    prCount,
    topExercise: top ? { name: top[0], volume: top[1] } : null,
  };
}

// Returns true if the recap should be shown right now (Sunday or later
// since last shown, recap not yet seen this week).
export function shouldShowWeeklyRecap(): boolean {
  try {
    const lastShown = localStorage.getItem(RECAP_KEY);
    const now = new Date();
    // Compute the ISO week-start (Monday-anchored) for now.
    const day = now.getDay(); // 0 = Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    if (lastShown === weekKey) return false;
    // Only show after Sunday — i.e. day === 0 (Sunday) of the new week.
    // Anchor: show on Sunday or the first home-open on/after.
    return day === 0;
  } catch { return false; }
}

export function markRecapShown(): void {
  try {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    localStorage.setItem(RECAP_KEY, monday.toISOString().slice(0, 10));
  } catch {}
}
