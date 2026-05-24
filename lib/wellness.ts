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
    const v = Math.max(0, Math.round(glasses));
    const iso = todayIso();
    m[iso] = v;
    localStorage.setItem(HYDRATION_KEY, JSON.stringify(m));
    // Fire-and-forget mirror to server so leaderboard Habits sees
    // it. (qa: wellness-sync-v1)
    pushWellnessToServer(iso, { glasses: v });
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
    // Fire-and-forget mirror to server. Push only the fields the
    // caller supplied so we don't accidentally clear an existing
    // server value with undefined. (qa: wellness-sync-v1)
    const serverPatch: { sleepHours?: number | null; energy?: number | null } = {};
    if ("sleepHours" in patch) serverPatch.sleepHours = patch.sleepHours ?? null;
    if ("energy" in patch) serverPatch.energy = patch.energy ?? null;
    if (Object.keys(serverPatch).length > 0) pushWellnessToServer(today, serverPatch);
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

// Read the per-muscle soreness history for the last N days,
// most-recent-first. Returns an array of {iso, rating} where rating is
// missing/0 when nothing was logged that day. Used by the soreness
// table to show whether each muscle's soreness is trending up or
// down over time (qa: maaiz — "doesn't remember the last entry or
// show history of last entry to see if the soreness per body part
// is going up or down over time").
export function readSorenessHistory(muscle: string, days: number = 14): Array<{ iso: string; rating: number }> {
  try {
    const m = JSON.parse(localStorage.getItem(SORENESS_KEY) ?? "{}");
    const out: Array<{ iso: string; rating: number }> = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const day = m[iso] ?? {};
      out.push({ iso, rating: typeof day[muscle] === "number" ? day[muscle] : 0 });
    }
    return out;
  } catch { return []; }
}

// Most-recent non-zero rating for a muscle BEFORE today (so the user
// can compare today's pick against their last actual entry). Returns
// null if there's nothing logged yet.
export function readSorenessLast(muscle: string): { iso: string; rating: number } | null {
  try {
    const m = JSON.parse(localStorage.getItem(SORENESS_KEY) ?? "{}");
    const todayKey = todayIso();
    const dates = Object.keys(m).filter(k => k < todayKey).sort().reverse();
    for (const iso of dates) {
      const r = m[iso]?.[muscle];
      if (typeof r === "number" && r > 0) return { iso, rating: r };
    }
    return null;
  } catch { return null; }
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

// ── SERVER SYNC ──────────────────────────────────────────────────────
// Wellness used to be 100% localStorage, which meant server-side
// leaderboard compute couldn't see it. v3.5 syncs hydration / sleep /
// energy to WellnessLog so the Habits sub-rank works on leaderboards
// AND across devices. Soreness + injuries stay local-only — they're
// for the user's own reference, not tier compute. (qa: wellness-sync-v1)

const SERVER_SYNC_FLAG = "ironlog-wellness-synced-v1";

// Fire-and-forget POST. Failures are silent — localStorage stays
// the source of truth for the UI and the next syncFromServer call
// will reconcile. Network blips don't break wellness logging.
export function pushWellnessToServer(
  date: string,
  patch: { glasses?: number | null; sleepHours?: number | null; energy?: number | null },
): void {
  try {
    fetch("/api/wellness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, ...patch }),
      // Don't block UI on this — the user's already seen the change
      // applied locally.
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// Pull the last 30 days from the server and merge into localStorage.
// Server-side rows are authoritative: anything present on the server
// for a date overwrites the corresponding local entry. Local-only
// entries (dates the server doesn't know about) are preserved and
// uploaded by syncWellnessToServerOnce on the same load.
export async function syncWellnessFromServer(): Promise<void> {
  try {
    const r = await fetch("/api/wellness", { credentials: "same-origin" });
    if (!r.ok) return;
    const data = await r.json();
    const logs: Array<{ date: string; glasses: number | null; sleepHours: number | null; energy: number | null }> = data?.logs ?? [];
    if (!Array.isArray(logs) || logs.length === 0) return;

    const hydra: Record<string, number> = JSON.parse(localStorage.getItem(HYDRATION_KEY) ?? "{}");
    const sleep: Record<string, SleepEntry> = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? "{}");
    for (const log of logs) {
      if (typeof log.glasses === "number") hydra[log.date] = log.glasses;
      if (typeof log.sleepHours === "number" || typeof log.energy === "number") {
        sleep[log.date] = {
          ...(sleep[log.date] ?? {}),
          ...(typeof log.sleepHours === "number" ? { sleepHours: log.sleepHours } : {}),
          ...(typeof log.energy === "number" ? { energy: log.energy } : {}),
        };
      }
    }
    localStorage.setItem(HYDRATION_KEY, JSON.stringify(hydra));
    localStorage.setItem(SLEEP_KEY, JSON.stringify(sleep));
  } catch {}
}

// One-time migration on first load after the wellness-sync deploy.
// Pushes every localStorage hydration + sleep entry up to the server
// in one batch POST so existing users don't lose history. Subsequent
// loads no-op because the flag is set. (qa: wellness-sync-v1)
export async function syncWellnessToServerOnce(): Promise<void> {
  try {
    if (localStorage.getItem(SERVER_SYNC_FLAG)) return;
    const hydra: Record<string, number> = JSON.parse(localStorage.getItem(HYDRATION_KEY) ?? "{}");
    const sleep: Record<string, SleepEntry> = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? "{}");

    const allDatesSet: Record<string, true> = {};
    for (const d of Object.keys(hydra)) allDatesSet[d] = true;
    for (const d of Object.keys(sleep)) allDatesSet[d] = true;
    const allDates = Object.keys(allDatesSet);
    if (allDates.length === 0) {
      // Nothing to upload, but flag as synced so we don't recheck on every load.
      localStorage.setItem(SERVER_SYNC_FLAG, "1");
      return;
    }
    // Cap to last 30 days — the server only retains that window for
    // tier compute, and the batch endpoint caps at 60 entries per
    // call. Older history stays in localStorage as a personal record.
    const cutoffMs = Date.now() - 30 * 86400000;
    const entries: Array<{ date: string; glasses?: number; sleepHours?: number; energy?: number }> = [];
    for (const date of allDates) {
      const ms = Date.parse(`${date}T00:00:00.000Z`);
      if (!Number.isFinite(ms) || ms < cutoffMs) continue;
      const e: any = { date };
      if (typeof hydra[date] === "number") e.glasses = hydra[date];
      const s = sleep[date];
      if (s && typeof s.sleepHours === "number") e.sleepHours = s.sleepHours;
      if (s && typeof s.energy === "number") e.energy = s.energy;
      // Only push if at least one field is set.
      if (e.glasses != null || e.sleepHours != null || e.energy != null) entries.push(e);
    }
    if (entries.length === 0) {
      localStorage.setItem(SERVER_SYNC_FLAG, "1");
      return;
    }
    const r = await fetch("/api/wellness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries.slice(0, 60) }),
      credentials: "same-origin",
    });
    if (r.ok) localStorage.setItem(SERVER_SYNC_FLAG, "1");
  } catch {}
}
