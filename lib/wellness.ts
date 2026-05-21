// Wellness trackers — hydration / sleep / energy / soreness / injuries.
// All localStorage-backed for now (no DB migration). Each tracker is a
// small daily-keyed map so future history/charting is easy without a
// schema change. Storage shape is intentionally JSON-serialisable.

const todayIso = () => new Date().toISOString().slice(0, 10);

// ── HYDRATION ────────────────────────────────────────────────────────
// Stored as { "YYYY-MM-DD": glassesCount }. Default target = 8 glasses.

const HYDRATION_KEY = "ironlog-hydration-v1";
export const HYDRATION_TARGET = 8;

export function readHydrationToday(): number {
  try {
    const m = JSON.parse(localStorage.getItem(HYDRATION_KEY) ?? "{}");
    return (m[todayIso()] ?? 0) as number;
  } catch { return 0; }
}

export function writeHydrationToday(glasses: number): void {
  try {
    const m = JSON.parse(localStorage.getItem(HYDRATION_KEY) ?? "{}");
    m[todayIso()] = Math.max(0, Math.round(glasses));
    localStorage.setItem(HYDRATION_KEY, JSON.stringify(m));
  } catch {}
}

// ── SLEEP + ENERGY ──────────────────────────────────────────────────
// Stored as { "YYYY-MM-DD": { sleepHours, energy } }. Both optional —
// users can log just one. Energy is 1-5 (😴 → ⚡). No nag.

const SLEEP_KEY = "ironlog-sleep-v1";
export type SleepEntry = { sleepHours?: number | null; energy?: number | null };

export function readSleepToday(): SleepEntry {
  try {
    const m = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? "{}");
    return (m[todayIso()] ?? {}) as SleepEntry;
  } catch { return {}; }
}

export function writeSleepToday(patch: Partial<SleepEntry>): void {
  try {
    const m = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? "{}");
    const today = todayIso();
    m[today] = { ...(m[today] ?? {}), ...patch };
    localStorage.setItem(SLEEP_KEY, JSON.stringify(m));
  } catch {}
}

// ── SORENESS ─────────────────────────────────────────────────────────
// Stored as { "YYYY-MM-DD": { muscleGroup: rating 0-5 } }. Opt-in tap-
// per-muscle. Used by the planner heuristic to suggest substitutions /
// lighter loads when a muscle is rated ≥ 4.

const SORENESS_KEY = "ironlog-soreness-v1";
export type SorenessMap = Record<string, number>;

export function readSorenessToday(): SorenessMap {
  try {
    const m = JSON.parse(localStorage.getItem(SORENESS_KEY) ?? "{}");
    return (m[todayIso()] ?? {}) as SorenessMap;
  } catch { return {}; }
}

export function writeSorenessToday(muscle: string, rating: number): void {
  try {
    const m = JSON.parse(localStorage.getItem(SORENESS_KEY) ?? "{}");
    const today = todayIso();
    const day: SorenessMap = m[today] ?? {};
    if (rating <= 0) delete day[muscle];
    else day[muscle] = Math.min(5, Math.max(1, Math.round(rating)));
    m[today] = day;
    localStorage.setItem(SORENESS_KEY, JSON.stringify(m));
  } catch {}
}

// ── INJURY LOG ───────────────────────────────────────────────────────
// Persistent list of currently-active injuries. Each is a body part
// (matches the muscle-group taxonomy) plus a start date and an optional
// note. Used by the active session to flag exercises hitting an injured
// muscle and offer a skip/substitute.

const INJURY_KEY = "ironlog-injuries-v1";
export type Injury = {
  id: string;          // cuid-ish
  muscle: string;      // chest|back|shoulders|biceps|triceps|quads|hamstrings|glutes|calves|core|knee|elbow|wrist|ankle|lower-back|neck
  startedIso: string;
  note?: string;
};

export function readInjuries(): Injury[] {
  try {
    const arr = JSON.parse(localStorage.getItem(INJURY_KEY) ?? "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function writeInjuries(list: Injury[]): void {
  try { localStorage.setItem(INJURY_KEY, JSON.stringify(list)); } catch {}
}

export function addInjury(muscle: string, note?: string): Injury {
  const inj: Injury = {
    id: Math.random().toString(36).slice(2, 10),
    muscle,
    startedIso: todayIso(),
    note: note?.trim() || undefined,
  };
  const list = readInjuries();
  list.push(inj);
  writeInjuries(list);
  return inj;
}

export function removeInjury(id: string): void {
  writeInjuries(readInjuries().filter(i => i.id !== id));
}

// Does this exercise hit an injured muscle? Returns the matching
// Injury entries (empty array = safe).
export function injuriesFor(exerciseMuscles: string[], injuries: Injury[]): Injury[] {
  const set = new Set(exerciseMuscles.map(m => m.toLowerCase()));
  return injuries.filter(i => set.has(i.muscle.toLowerCase()));
}

// Aggregate last-N-days wellness counts for the tier system's Habits
// sub-rank. Walks each tracker's daily map and counts qualifying days.
export function wellnessLast14Days(): {
  hydrationGoalDays: number;
  sleepLoggedDays: number;
  energyLoggedDays: number;
} {
  let hydrationGoalDays = 0, sleepLoggedDays = 0, energyLoggedDays = 0;
  try {
    const hydra = JSON.parse(localStorage.getItem(HYDRATION_KEY) ?? "{}") as Record<string, number>;
    const sleep = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? "{}") as Record<string, SleepEntry>;
    for (let i = 0; i < 14; i++) {
      const iso = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if ((hydra[iso] ?? 0) >= HYDRATION_TARGET) hydrationGoalDays++;
      const se = sleep[iso] ?? {};
      if (se.sleepHours != null) sleepLoggedDays++;
      if (se.energy != null) energyLoggedDays++;
    }
  } catch {}
  return { hydrationGoalDays, sleepLoggedDays, energyLoggedDays };
}
