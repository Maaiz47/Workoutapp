// Lightweight gamification extras — Daily Quest, Full-Stack Day combo
// detector, Balanced Week variety badge, hidden achievements list.
// All localStorage-backed.
//
// The de-gamify theme (settings toggle) gates the entire gamification UI
// stack — when ON, none of this surfaces to the user. Tracking +
// telemetry features (wellness, recap stats) stay because they aren't
// "game" elements, they're observation.

const todayIso = () => new Date().toISOString().slice(0, 10);

// ── DE-GAMIFY TOGGLE ────────────────────────────────────────────────
// localStorage flag. When true, gamification UI is suppressed
// (tier card, daily quest, challenges, achievements, milestone overlays,
// combo bonuses). The user still gets workouts, history, graphs, and
// wellness logging — none of that is touched.
export const DEGAMIFY_KEY = "ironlog-degamify-v1";

export function isDeGamified(): boolean {
  try { return localStorage.getItem(DEGAMIFY_KEY) === "1"; } catch { return false; }
}
export function setDeGamified(on: boolean): void {
  try { localStorage.setItem(DEGAMIFY_KEY, on ? "1" : "0"); } catch {}
}

// ── DAILY QUEST ─────────────────────────────────────────────────────
// One quest per day, deterministically picked from the pool by date.
// Completion is checked against the user's state (history + wellness)
// when the home view renders.

export type DailyQuest = {
  id: string;
  title: string;
  body: string;
  icon: string;
  // Returns true if today's state satisfies the quest.
  isDone: (state: QuestState) => boolean;
};

export type QuestState = {
  todaySessionsCount: number;
  todayHasPR: boolean;
  todayHasRpeLogged: boolean;
  hydrationToday: number;
  hydrationTarget: number;
  sleepLoggedToday: boolean;
  energyLoggedToday: boolean;
  totalSessionsLifetime: number;
  // ── Slice 1 of daily-quest-rework expansion (qa: daily-quest-rework) ──
  // Optional fields — undefined = caller couldn't compute. Quests that
  // need missing data evaluate to false (don't show up as done if we
  // can't tell). Keep these all OPTIONAL so legacy QuestState callers
  // still type-check.
  todayDistinctExercises?: number;       // distinct exercises trained today
  todayWorkingSetsCount?: number;        // total working sets logged today (non-skipped, non-warmup)
  todayHasSuperset?: boolean;            // any superset locked today
  todayHasDropSet?: boolean;             // any drop chain today
  todayHasCardio?: boolean;              // any cardio set logged today
  todayWarmupsPerfect?: boolean;         // every warmup set marked ✓ today
  todayBodyMetricLogged?: boolean;       // logged weight or BF today
  todayLongestSessionMin?: number;       // longest single session duration today (minutes)
  todayHasMaxRpe?: boolean;              // at least one set logged at RPE 10
};

// Pool now ~14 quests, was 7. New quests are technique- and
// variety-flavoured to give the rotation more dimensions. Per-user
// random rotation lives in `pickTodayQuest()` below — different users
// can see different quests on the same day.
// (qa: daily-quest-rework — slice 1: pool expansion + rotation)
export const QUEST_POOL: DailyQuest[] = [
  // Foundational
  { id: "q-hydrate",       title: "Hydrate",        body: "Hit your hydration target today.",                       icon: "💧", isDone: s => s.hydrationToday >= s.hydrationTarget },
  { id: "q-train",         title: "Train",          body: "Log at least one session today.",                        icon: "🏋", isDone: s => s.todaySessionsCount >= 1 },
  { id: "q-rpe",           title: "Tag effort",     body: "Log RPE on any set today.",                              icon: "🎯", isDone: s => s.todayHasRpeLogged },
  { id: "q-sleep",         title: "Sleep check-in", body: "Log how you slept this morning.",                        icon: "😴", isDone: s => s.sleepLoggedToday },
  { id: "q-energy",        title: "Energy check",   body: "Tap your energy level for today.",                       icon: "⚡", isDone: s => s.energyLoggedToday },
  { id: "q-pr-hunt",       title: "PB hunt",        body: "Beat a personal best in any lift today.",                icon: "🥇", isDone: s => s.todayHasPR },
  { id: "q-double",        title: "Double up",      body: "Log a session AND hit your hydration target.",           icon: "🔥", isDone: s => s.todaySessionsCount >= 1 && s.hydrationToday >= s.hydrationTarget },

  // ── Slice 1 additions ──
  { id: "q-variety",       title: "Variety",        body: "Train 3+ distinct exercises today.",                     icon: "🎲", isDone: s => (s.todayDistinctExercises ?? 0) >= 3 },
  { id: "q-volume",        title: "Volume push",    body: "Log 15+ working sets today.",                            icon: "📈", isDone: s => (s.todayWorkingSetsCount ?? 0) >= 15 },
  { id: "q-superset",      title: "Superset day",   body: "Complete a superset today.",                             icon: "⟳", isDone: s => !!s.todayHasSuperset },
  { id: "q-dropset",       title: "Drop set day",   body: "Run a drop chain today.",                                icon: "🔻", isDone: s => !!s.todayHasDropSet },
  { id: "q-cardio",        title: "Get cardio in",  body: "Log a cardio set today (machine OR outdoor).",          icon: "🏃", isDone: s => !!s.todayHasCardio },
  { id: "q-warmup-perfect",title: "Warmup pro",     body: "Mark every warmup set as ✓ DONE today.",                icon: "🤸", isDone: s => !!s.todayWarmupsPerfect },
  { id: "q-body-metric",   title: "Tracker check",  body: "Log a weight or body-fat reading today.",                icon: "⚖️", isDone: s => !!s.todayBodyMetricLogged },
];

// Deterministic but PER-USER rotation: hash(userId + iso). Different
// users see different quests the same day; the same user sees a stable
// quest each day. Falls back to global-deterministic when no userId is
// available (anon/preview sessions). (qa: daily-quest-rework slice 1)
export function pickTodayQuest(userId?: string | null): DailyQuest {
  const iso = todayIso();
  const seed = (userId ?? "anon") + "|" + iso;
  let hash = 5381;
  for (const ch of seed) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  return QUEST_POOL[hash % QUEST_POOL.length];
}

// ── FULL-STACK DAY COMBO ────────────────────────────────────────────
// Fires when the user has done all of: hit hydration target + logged
// sleep + logged energy + completed a session. localStorage tracks the
// last full-stack date so the celebration fires once per such day.

export const FULL_STACK_KEY = "ironlog-fullstack-days-v1";

export function isFullStackDay(state: QuestState): boolean {
  return (
    state.hydrationToday >= state.hydrationTarget &&
    state.sleepLoggedToday &&
    state.energyLoggedToday &&
    state.todaySessionsCount >= 1
  );
}

export function recordFullStackDay(): boolean {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(FULL_STACK_KEY) ?? "[]");
    const iso = todayIso();
    if (arr.includes(iso)) return false;
    arr.push(iso);
    localStorage.setItem(FULL_STACK_KEY, JSON.stringify(arr));
    return true;
  } catch { return false; }
}

export function fullStackDayCount(): number {
  try { return (JSON.parse(localStorage.getItem(FULL_STACK_KEY) ?? "[]") as string[]).length; } catch { return 0; }
}

// ── BALANCED WEEK VARIETY BADGE ─────────────────────────────────────
// Fires when the user hits all 5 muscle category buckets in a single
// ISO week. Categories: chest, back, shoulders, arms (biceps OR triceps),
// legs (any leg muscle). Stored per ISO week (Monday-anchored) so it
// fires at most once per week.

export const BALANCED_WEEK_KEY = "ironlog-balanced-weeks-v1";

export function weekKey(d: Date): string {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function checkBalancedWeek(historyMuscles: string[]): boolean {
  const lower = new Set(historyMuscles.map(m => m.toLowerCase()));
  return ["chest", "back", "shoulders"].every(m => lower.has(m)) &&
         (lower.has("biceps") || lower.has("triceps")) &&
         ["quads", "hamstrings", "glutes", "calves"].some(m => lower.has(m));
}

export function recordBalancedWeek(): boolean {
  try {
    const key = weekKey(new Date());
    const arr: string[] = JSON.parse(localStorage.getItem(BALANCED_WEEK_KEY) ?? "[]");
    if (arr.includes(key)) return false;
    arr.push(key);
    localStorage.setItem(BALANCED_WEEK_KEY, JSON.stringify(arr));
    return true;
  } catch { return false; }
}

// ── BALANCED FORTNIGHT REWARD ───────────────────────────────────────
// Fires when the user covers all 7 Balance sub-rank buckets in the
// rolling 14-day window (chest / back / shoulders / arms / quads /
// posterior / core, each with ≥3 sets). Counterpart to the Balance
// sub-rank's neglect penalty — celebrates the positive case.
//
// Keyed by ISO week (Monday) so the user earns at most ONE balanced
// fortnight per week even if the rolling Balance score sits at 100
// for multiple days running. Earning every week = 52 / year max.
// (qa: tier-balance-subrank — reward counterpart)

export const BALANCED_FORTNIGHT_KEY = "ironlog-balanced-fortnights-v1";

const BALANCE_BUCKETS = ["chest", "back", "shoulders", "arms", "quads", "posterior", "core"] as const;
const MIN_SETS_PER_BUCKET = 3;

export function isBalancedFortnight(setsByMuscleGroup: Record<string, number> | undefined | null): boolean {
  if (!setsByMuscleGroup) return false;
  return BALANCE_BUCKETS.every(b => (setsByMuscleGroup[b] ?? 0) >= MIN_SETS_PER_BUCKET);
}

export function recordBalancedFortnight(): { earned: boolean; isFirst: boolean; totalCount: number } {
  try {
    const key = weekKey(new Date());
    const arr: string[] = JSON.parse(localStorage.getItem(BALANCED_FORTNIGHT_KEY) ?? "[]");
    if (arr.includes(key)) return { earned: false, isFirst: false, totalCount: arr.length };
    const isFirst = arr.length === 0;
    arr.push(key);
    localStorage.setItem(BALANCED_FORTNIGHT_KEY, JSON.stringify(arr));
    return { earned: true, isFirst, totalCount: arr.length };
  } catch { return { earned: false, isFirst: false, totalCount: 0 }; }
}

export function balancedFortnightCount(): number {
  try { return (JSON.parse(localStorage.getItem(BALANCED_FORTNIGHT_KEY) ?? "[]") as string[]).length; } catch { return 0; }
}

// ── HIDDEN ACHIEVEMENTS ─────────────────────────────────────────────
// Surprise badges — don't appear in the wall until earned. Stored
// alongside the main milestone-achieved list.

export type HiddenAchievement = {
  id: string;
  label: string;
  body: string;
  icon: string;
  // Returns true if state satisfies. Caller provides the state and
  // persists the earned id.
  check: (state: HiddenState) => boolean;
};

export type HiddenState = {
  hour: number;                 // current hour 0-23
  isUserBirthday: boolean;      // dob == today
  hydrationStreakDays: number;  // consecutive days hitting hydration target
  fullStackCount: number;
  balancedWeekCount: number;
  totalSessionsLifetime: number;
};

export const HIDDEN_ACHIEVEMENTS: HiddenAchievement[] = [
  { id: "h-dawn",       label: "Dawn Patrol",       body: "Trained before 6am. Brutal.",                    icon: "🌅", check: s => s.hour < 6 && s.totalSessionsLifetime >= 1 },
  { id: "h-night-owl",  label: "Night Owl",         body: "Logged a workout after midnight.",                icon: "🦉", check: s => s.hour >= 22 || s.hour <= 1 },
  { id: "h-birthday",   label: "Birthday Lift",     body: "Logged a session on your birthday. Hell yes.",   icon: "🎂", check: s => s.isUserBirthday },
  { id: "h-hydra-30",   label: "30-Day Hydra",      body: "30 consecutive days hitting your hydration target.", icon: "💎", check: s => s.hydrationStreakDays >= 30 },
  { id: "h-full-7",     label: "Full Stack × 7",    body: "7 lifetime Full Stack Days. Insane balance.",    icon: "🏛", check: s => s.fullStackCount >= 7 },
  { id: "h-balanced-4", label: "Quarter Balanced",  body: "4 Balanced Weeks lifetime. Real programming.",   icon: "⚖️", check: s => s.balancedWeekCount >= 4 },
];

export const HIDDEN_STORAGE_KEY = "ironlog-hidden-achievements-v1";

export function readHiddenEarned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) ?? "[]")); }
  catch { return new Set(); }
}

export function writeHiddenEarned(set: Set<string>): void {
  try { localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(set))); } catch {}
}

export function detectNewHidden(state: HiddenState): HiddenAchievement[] {
  const earned = readHiddenEarned();
  const out: HiddenAchievement[] = [];
  for (const h of HIDDEN_ACHIEVEMENTS) {
    if (earned.has(h.id)) continue;
    if (h.check(state)) { out.push(h); earned.add(h.id); }
  }
  if (out.length > 0) writeHiddenEarned(earned);
  return out;
}
