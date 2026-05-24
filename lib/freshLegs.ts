// Fresh Legs bonus + weekly target-cap helpers for IP scoring.
//
// Goals:
//   1. Reward proper recovery — +5 IP on the first session after at
//      least one full rest day. Counters the "train every day to farm
//      IP" pattern by making rested sessions more rewarding than
//      consecutive-day sessions.
//   2. Cap IP earnable per ISO week at (daysPerWeek + 1) distinct
//      training DAYS. Sessions beyond that earn 0 IP — extra
//      training is for love, not score. The +1 buffer lets users on
//      a 4/wk target hit 5 without being capped (schedule shifts).
//
// Used at BOTH save-time (api/workout) for immediate feedback +
// stored-IP correctness, AND read-time (leaderboardStats) so RPE
// bonus is also gated by the cap and historical IP matches stored.
//
// (qa: tier-ip-fresh-legs-and-cap)

export const FRESH_LEGS_BONUS = 5;

// Cap is daysPerWeek + 1 to absorb schedule noise. daysPerWeek is
// clamped to ≥1 so a misconfigured 0 doesn't permanently zero IP.
export function weeklyTargetCap(daysPerWeek: number | null | undefined): number {
  return Math.max(1, daysPerWeek ?? 4) + 1;
}

// ISO-week-Monday start (00:00:00) for a given date. Matches the
// week boundary used by the existing Consistency adherence and
// weeklyVolumes computations. Returns ms.
export function isoWeekStartMs(d: Date): number {
  const back = (d.getDay() + 6) % 7;
  return d.getTime()
    - back * 86400000
    - d.getHours() * 3600000
    - d.getMinutes() * 60000
    - d.getSeconds() * 1000
    - d.getMilliseconds();
}

// Local-iso day string ("YYYY-MM-DD") — same convention used by the
// session log key elsewhere. Anchors all Fresh Legs / cap checks.
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// True iff the user had NO logged session on the calendar day
// immediately before `sessionDate`. priorIsoDays is the set of iso
// day strings already trained — caller passes the relevant set
// (last 7d at save time, full log at read time).
export function isFreshLegsSession(sessionDate: Date, priorIsoDays: Set<string>): boolean {
  const yesterday = new Date(sessionDate.getTime() - 86400000);
  return !priorIsoDays.has(isoDay(yesterday));
}

// True iff adding `sessionDate` to the user's week-so-far would
// push the distinct-training-days count above the cap. Calls with
// the iso day strings already trained THIS WEEK (excluding the
// session being evaluated). New same-day sessions never push over.
export function exceedsWeeklyCap(
  sessionDate: Date,
  thisWeekIsoDays: Set<string>,
  daysPerWeek: number | null | undefined,
): boolean {
  const cap = weeklyTargetCap(daysPerWeek);
  const today = isoDay(sessionDate);
  if (thisWeekIsoDays.has(today)) return false; // not a new training day
  return thisWeekIsoDays.size + 1 > cap;
}
