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

// ── LONG-RUNNING MISSIONS ──────────────────────────────────────────
// Multi-month opt-in goals that live alongside the monthly challenges.
// Used for things like body-composition arcs where 30 days isn't long
// enough — fat loss takes time. v1: hardcoded catalogue, localStorage
// opt-in records the start timestamp so the "ends on" date is per-user.
// (qa: mission-unlock-abs)
export type MissionMetric =
  | "body_fat_at_or_below"
  | "body_weight_at_or_below";

export type Mission = {
  id: string;
  title: string;
  body: string;
  icon: string;
  // Optional time cap. 0 / undefined = open-ended (no deadline) —
  // the user works toward the milestone at their own pace.
  durationDays?: number;
  metric: MissionMetric;
  target: number;           // default target (used when gender unknown / "other")
  // Per-gender target override. Used for body-composition missions
  // where the visible-abs threshold differs significantly between
  // men and women (essential fat is higher for women, so the
  // "abs reveal" BF% is higher). When set, the page reads the
  // gender-matched value via `resolveMissionTarget()`. Falls back
  // to `target` for "other" / unknown. (qa: mission-unlock-abs)
  targetByGender?: { male: number; female: number };
  // When set, joining this mission writes this value into
  // profile.targetBodyFatPct (or targetWeightKg, depending on metric)
  // so the user's goal everywhere else in the app aligns with the
  // mission's target. (qa: mission-unlock-abs)
  setsProfileGoal?: boolean;
};

// Resolve the per-user target for a mission given gender. Falls back
// to mission.target when no per-gender override is set, or when gender
// is missing/other.
export function resolveMissionTarget(m: Mission, gender?: string | null): number {
  if (!m.targetByGender) return m.target;
  if (gender === "male") return m.targetByGender.male;
  if (gender === "female") return m.targetByGender.female;
  return m.target;
}

// Resolved title/body for display — substitutes the per-gender target
// into the headline copy so the user reads the threshold that
// actually applies to them.
export function resolveMissionBody(m: Mission, gender?: string | null): string {
  const t = resolveMissionTarget(m, gender);
  if (m.id === "mission-unlock-abs-v1") {
    return `Drop your body fat to ${t}% or lower — that's where the six-pack reveals itself${gender === "female" ? " (women's essential fat is higher than men's, so this is calibrated for you)" : gender === "male" ? "" : " (we use a default threshold; set your gender in the profile for a tailored target)"}. No deadline. Joining sets your goal body fat to ${t}% across the app.`;
  }
  return m.body;
}

export const MISSIONS: Mission[] = [
  {
    id: "mission-unlock-abs-v1",
    title: "Unlock Your Abs",
    body: "Drop your body fat to the visible-abs threshold for your gender. No deadline. Joining sets your goal body fat across the app.",
    icon: "🔓",
    metric: "body_fat_at_or_below",
    // Default (used when gender is "other" / unknown). Men's threshold
    // is used as the conservative default since the mission was first
    // shipped calibrated for male users.
    target: 15,
    targetByGender: { male: 15, female: 22 },
    setsProfileGoal: true,
  },
];

export type MissionState = {
  optedIn: boolean;
  startTs: number | null;    // unix ms when user opted in
  endTs: number | null;      // startTs + durationDays
  daysLeft: number | null;   // null when not opted in
  daysIn: number | null;
  currentValue: number | null;
  target: number;
  // "achieved" once the user has hit the target at any point within the
  // window — sticky, doesn't un-flip if the next measurement regresses
  // (they hit the milestone; we don't punish a fluctuation day).
  achieved: boolean;
  achievedAt: number | null;
};

const MISSION_OPTIN_KEY = "ironlog-mission-state-v1";

type MissionStore = Record<string, { startTs: number; achievedAt?: number | null }>;
function readMissionStore(): MissionStore {
  try { return JSON.parse(localStorage.getItem(MISSION_OPTIN_KEY) ?? "{}") as MissionStore; }
  catch { return {}; }
}
function writeMissionStore(s: MissionStore) {
  try { localStorage.setItem(MISSION_OPTIN_KEY, JSON.stringify(s)); } catch {}
}

export function isMissionOptedIn(missionId: string): boolean {
  return !!readMissionStore()[missionId];
}

export function toggleMissionOptIn(missionId: string): boolean {
  const store = readMissionStore();
  if (store[missionId]) { delete store[missionId]; writeMissionStore(store); return false; }
  store[missionId] = { startTs: Date.now() };
  writeMissionStore(store);
  return true;
}

// Compute the live state of a mission for the user.
// `bodyMetrics` is the same array the Progress > Body tab shows
// (newest first; each has weightKg / bodyFatPct / date / timeOfDay).
export function computeMissionState(
  mission: Mission,
  bodyMetrics: { date: string; weightKg?: number | null; bodyFatPct?: number | null }[],
): MissionState {
  const store = readMissionStore();
  const entry = store[mission.id];
  // What metric to read off each measurement.
  const valueOf = (m: typeof bodyMetrics[number]): number | null => {
    if (mission.metric === "body_fat_at_or_below") return m.bodyFatPct ?? null;
    if (mission.metric === "body_weight_at_or_below") return m.weightKg ?? null;
    return null;
  };
  // Current value = latest non-null reading (any time, not gated by
  // opt-in start so the user can preview where they are before opting in).
  let currentValue: number | null = null;
  for (const m of bodyMetrics) {
    const v = valueOf(m);
    if (v != null) { currentValue = v; break; }
  }
  if (!entry) {
    return { optedIn: false, startTs: null, endTs: null, daysLeft: null, daysIn: null, currentValue, target: mission.target, achieved: currentValue != null && currentValue <= mission.target, achievedAt: null };
  }
  const startTs = entry.startTs;
  const hasDeadline = !!mission.durationDays && mission.durationDays > 0;
  const endTs = hasDeadline ? startTs + mission.durationDays! * 86400000 : null;
  const now = Date.now();
  const daysIn = Math.max(0, Math.floor((now - startTs) / 86400000));
  const daysLeft = hasDeadline ? Math.max(0, Math.ceil((endTs! - now) / 86400000)) : null;
  // Walk metrics after startTs to find the FIRST hit of the target.
  let achievedAt: number | null = entry.achievedAt ?? null;
  if (!achievedAt) {
    for (const m of [...bodyMetrics].reverse()) {
      const t = new Date(m.date).getTime();
      if (t < startTs) continue;
      const v = valueOf(m);
      if (v == null) continue;
      if (v <= mission.target) { achievedAt = t; break; }
    }
    if (achievedAt) {
      // Persist the milestone so a later regression doesn't unflip it.
      const s2 = readMissionStore();
      if (s2[mission.id]) { s2[mission.id].achievedAt = achievedAt; writeMissionStore(s2); }
    }
  }
  // "achieved" is sticky once hit at any post-opt-in measurement
  // (above). Also TREAT a current reading <= target as achieved
  // immediately so a user who already has visible abs at opt-in
  // unlocks the milestone without waiting for a new log.
  const achievedNow = currentValue != null && currentValue <= mission.target;
  return {
    optedIn: true, startTs, endTs, daysLeft, daysIn,
    currentValue, target: mission.target,
    achieved: !!achievedAt || achievedNow, achievedAt,
  };
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
