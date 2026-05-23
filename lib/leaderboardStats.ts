// Per-user leaderboard stats — totalSessions, current streak, PR count,
// total volume, total intensity points. Shared between the trainer
// client leaderboard, the "my groups" leaderboard, and the group
// management endpoint.

import { prisma } from "./prisma";
import { computeAthleteTier, ATHLETE_TIERS, AnimalTier, RecentSet } from "./tiers";

// Canonical athlete tier label shipped on every leaderboard row so
// the frontend doesn't have to re-derive (or worse, fall back to the
// legacy session-count ladder). Wellness data is still localStorage-
// only so this is computed with hydration/sleep/energy = 0; the
// resulting tier may be one rung below the user's own dashboard
// view, but it uses the same ladder & labels — single source of
// truth from the user's perspective.
export interface CanonicalTier {
  label: string;
  icon: string;
  iconPath?: string;
  color: string;
  bg: string;
  border: string;
  min: number;
  score: number; // 0-100 headlineScore
  idx: number;   // position on the ladder, 0-indexed
  // 1-based tierNum so leaderboard API + frontend code can use the
  // canonical AnimalTier.tierNum field directly. Previously only
  // `idx` was carried, which made API consumers fall back to
  // tierNum=1 (Kitten) for everyone. (qa: tier-num-on-canonical)
  tierNum: number;
}

export interface LeaderboardMemberStats {
  totalSessions: number;
  streak: number;
  prCount: number;
  totalVolume: number;
  totalIntensityPoints: number;
  lastSession: string | null;
  // Inputs that feed the canonical tier — exposed so callers that
  // want to display "distinct exercises trained" or "months on app"
  // don't have to recompute.
  distinctExercises: number;
  // Distinct exercises trained in the last 180 days. Feeds the
  // Mastery sub-rank for tier scoring; lifetime `distinctExercises`
  // is kept for display alongside. (qa: tier-decay)
  recentDistinctExercises: number;
  monthsOnApp: number;
  // Canonical athlete tier (computed via computeAthleteTier). Always
  // present; new users land at Kitten with score 0.
  tier: CanonicalTier;
  // Body metrics for the group leaderboard's WEIGHT / BF views. Each value
  // is the first vs latest entry from BodyMetric, plus the signed delta.
  // null = no recorded data.
  weightStart: number | null;
  weightCurrent: number | null;
  weightChangeKg: number | null;
  weightStartDate: string | null;
  bfStart: number | null;
  bfCurrent: number | null;
  bfChangePct: number | null;
  bfStartDate: string | null;
}

type LogLike = {
  date: Date;
  sets: unknown;
  intensityPoints: number | null;
};

// Build a CanonicalTier record from the stats we have. Wellness
// inputs default to 0 (server can't read localStorage); when the
// frontend has full local data it can override on the visitor's
// OWN row via the same lib/tiers.ts function — both surfaces still
// agree on the LADDER (Kitten/Monkey/Fox/Tiger/Lion/Gorilla on the
// 0-100 score).
function buildCanonicalTier(s: {
  totalSessions: number;
  streak: number;
  totalVolumeKg: number;
  prCount: number;
  distinctExercises: number;
  recentDistinctExercises?: number;
  monthsOnApp: number;
  sessionsLast4Weeks?: number;
  daysPerWeek?: number;
  // v2 inputs (qa: tier-scoring-v2)
  sessions180d?: number;
  weeklyStreak?: number;
  recentSetsByExercise?: Record<string, RecentSet[]>;
  weeklyVolumes?: Array<{ weekStartMs: number; volumeKg: number }>;
  weightCurrentKg?: number | null;
  bfCurrentPct?: number | null;
  weightChange90dKg?: number | null;
  bfChange90dPct?: number | null;
  gender?: string | null;
  totalIntensityPointsLifetime?: number;
}): CanonicalTier {
  const breakdown = computeAthleteTier({
    totalSessions: s.totalSessions,
    streak: s.streak,
    totalVolumeKg: s.totalVolumeKg,
    prCount: s.prCount,
    distinctExercises: s.distinctExercises,
    recentDistinctExercises: s.recentDistinctExercises,
    monthsOnApp: s.monthsOnApp,
    hydrationGoalDays: 0,
    sleepLoggedDays: 0,
    energyLoggedDays: 0,
    sessionsLast4Weeks: s.sessionsLast4Weeks ?? 0,
    daysPerWeek: s.daysPerWeek ?? 4,
    sessions180d: s.sessions180d,
    weeklyStreak: s.weeklyStreak,
    recentSetsByExercise: s.recentSetsByExercise,
    weeklyVolumes: s.weeklyVolumes,
    weightCurrentKg: s.weightCurrentKg,
    bfCurrentPct: s.bfCurrentPct,
    weightChange90dKg: s.weightChange90dKg,
    bfChange90dPct: s.bfChange90dPct,
    gender: s.gender,
    totalIntensityPointsLifetime: s.totalIntensityPointsLifetime,
  });
  // tierScoreBonus is no longer blended into the canonical headline
  // (qa: tier-scoring-v2) — the lucky-drop reward was a silent
  // injection that broke the single-source-of-truth principle. If we
  // want to surface random bonuses again it should be its own visible
  // sub-rank, not a hidden buff.
  const score = breakdown.headlineScore;
  let resolvedIdx = 0;
  for (let i = ATHLETE_TIERS.length - 1; i >= 0; i--) {
    if (score >= ATHLETE_TIERS[i].min) { resolvedIdx = i; break; }
  }
  const t: AnimalTier = ATHLETE_TIERS[resolvedIdx];
  return {
    label: t.label,
    icon: t.icon,
    iconPath: t.iconPath,
    color: t.color,
    bg: t.bg,
    border: t.border,
    min: t.min,
    score,
    idx: resolvedIdx,
    tierNum: t.tierNum,
  };
}

// Inputs computed by computeStatsForUsers and passed in. Wraps the
// body-comp + gender data that the per-log walker can't see.
type ExtraStatsInputs = {
  weightCurrentKg?: number | null;
  bfCurrentPct?: number | null;
  weightChange90dKg?: number | null;
  bfChange90dPct?: number | null;
  gender?: string | null;
};

// `monthsOnApp` + `daysPerWeek` are passed by computeStatsForUsers
// (which has the User.createdAt + UserProfile.daysPerWeek); single-
// log callers default to 0 / 4.
export function computeStatsFromLogs(
  logs: LogLike[],
  monthsOnApp: number = 0,
  daysPerWeek: number = 4,
  _tierScoreBonus: number = 0,  // accepted for backward-compat; no longer blended (qa: tier-scoring-v2)
  extra: ExtraStatsInputs = {},
): LeaderboardMemberStats {
  const totalSessions = logs.length;
  void _tierScoreBonus;

  // Sessions logged in the last 4 weeks — feeds the adherence
  // dimension of the consistency sub-rank. Counted as DISTINCT days
  // so doing two sessions in a day still counts as one training
  // day vs the weekly target. (qa: tier-scoring-fairness)
  const todayMs = Date.now();
  const fourWeeksAgo = todayMs - 28 * 86400000;
  const ninetyDaysAgo = todayMs - 90 * 86400000;
  const oneEightyDaysAgo = todayMs - 180 * 86400000;
  const sessionsLast4Weeks = new Set(
    logs
      .filter(l => l.date.getTime() >= fourWeeksAgo)
      .map(l => l.date.toISOString().slice(0, 10))
  ).size;
  const sessions180d = new Set(
    logs
      .filter(l => l.date.getTime() >= oneEightyDaysAgo)
      .map(l => l.date.toISOString().slice(0, 10))
  ).size;

  // Streak: consecutive days with at least one session, anchored on today/yesterday
  const dateStrings = Array.from(new Set(logs.map(l => l.date.toISOString().slice(0, 10)))).sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStrings[0] === today || dateStrings[0] === yesterday) {
    streak = 1;
    for (let i = 1; i < dateStrings.length; i++) {
      const prev = new Date(dateStrings[i - 1]);
      const curr = new Date(dateStrings[i]);
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diff === 1) streak++;
      else break;
    }
  }

  // PR count + total volume + distinct exercises + recent per-
  // exercise set lists + weekly volumes + RPE intensity bonus in
  // one pass. (qa: tier-scoring-v2, tier-decay)
  const prs: Record<string, { weight: number; reps: number }> = {};
  const distinctEx = new Set<string>();
  const recentDistinctEx = new Set<string>();
  const recentSetsByExercise: Record<string, RecentSet[]> = {};
  const volumeByWeek = new Map<number, number>();
  let totalVolume = 0;
  let rpeBonusIP = 0;
  for (const log of logs) {
    const ms = log.date.getTime();
    const isRecent = ms >= oneEightyDaysAgo;
    const sets = (log.sets ?? {}) as Record<string, { weight?: number; reps?: number; skipped?: boolean; rpe?: number } | null>;
    for (const [k, v] of Object.entries(sets)) {
      if (!v || v.skipped) continue;
      const w = v.weight ?? 0;
      const r = v.reps ?? 0;
      const rpe = typeof v.rpe === "number" ? v.rpe : null;
      totalVolume += w * r;
      // IP bonus: max(0, RPE - 7) per set. RPE 8 = +1, RPE 9 = +2,
      // RPE 10 = +3. Genuinely hard sets earn intensity credit.
      // (qa: tier-scoring-v2 — IP RPE expansion)
      if (rpe != null) rpeBonusIP += Math.max(0, rpe - 7);
      const parts = k.split("-");
      const last = parts[parts.length - 1];
      const isDropSet = /^d\d+$/.test(last) && parts.length >= 3;
      if (isDropSet) { parts.pop(); parts.pop(); } else { parts.pop(); }
      const eid = parts.join("-");
      if (eid) {
        distinctEx.add(eid);
        if (isRecent) {
          recentDistinctEx.add(eid);
          if (!recentSetsByExercise[eid]) recentSetsByExercise[eid] = [];
          recentSetsByExercise[eid].push({ dateMs: ms, weight: w, reps: r, rpe });
        }
      }
      if (!prs[eid] || w > prs[eid].weight || (w === prs[eid].weight && r > prs[eid].reps)) {
        prs[eid] = { weight: w, reps: r };
      }
      // Volume bucketed by Monday-start week for the Progression
      // regression. Only collect within the 180d window (anything
      // older isn't going to be in the slope).
      if (isRecent) {
        const d = new Date(ms);
        // ISO day-of-week: Sunday=0..Saturday=6 in JS; we want
        // weekStart on Monday so subtract (d.getDay()+6)%7 days.
        const dow = d.getDay();
        const back = (dow + 6) % 7;
        const weekStartMs = ms - back * 86400000 - (d.getHours() * 3600000) - (d.getMinutes() * 60000) - (d.getSeconds() * 1000) - d.getMilliseconds();
        volumeByWeek.set(weekStartMs, (volumeByWeek.get(weekStartMs) ?? 0) + w * r);
      }
    }
  }
  const weeklyVolumes = Array.from(volumeByWeek.entries())
    .map(([weekStartMs, volumeKg]) => ({ weekStartMs, volumeKg }))
    .sort((a, b) => a.weekStartMs - b.weekStartMs);

  // Weekly streak — consecutive weeks (ending in current week)
  // where session count ≥ daysPerWeek target. Rest-day-friendly.
  // (qa: tier-scoring-v2)
  const sessionsByWeek = new Map<number, Set<string>>();
  for (const log of logs) {
    if (log.date.getTime() < oneEightyDaysAgo) continue;
    const d = log.date;
    const back = (d.getDay() + 6) % 7;
    const weekStartMs = d.getTime() - back * 86400000 - (d.getHours() * 3600000) - (d.getMinutes() * 60000) - (d.getSeconds() * 1000) - d.getMilliseconds();
    if (!sessionsByWeek.has(weekStartMs)) sessionsByWeek.set(weekStartMs, new Set());
    sessionsByWeek.get(weekStartMs)!.add(d.toISOString().slice(0, 10));
  }
  let weeklyStreak = 0;
  {
    const now = new Date();
    const back = (now.getDay() + 6) % 7;
    const todayStartMs = now.getTime() - back * 86400000 - (now.getHours() * 3600000) - (now.getMinutes() * 60000) - (now.getSeconds() * 1000) - now.getMilliseconds();
    let cursor = todayStartMs;
    // Walk backwards. Current week counts if user is on pace; past
    // weeks must have met target.
    let isCurrentWeek = true;
    while (true) {
      const hit = (sessionsByWeek.get(cursor)?.size ?? 0);
      if (isCurrentWeek) {
        if (hit > 0) weeklyStreak += 1;
        else if (weeklyStreak === 0) {
          // No sessions this week yet → don't break; check past weeks.
        }
        isCurrentWeek = false;
        cursor -= 7 * 86400000;
        continue;
      }
      if (hit >= daysPerWeek) {
        weeklyStreak += 1;
        cursor -= 7 * 86400000;
      } else {
        break;
      }
    }
  }

  // Total intensity: base awards (supersets/drop sets stored on the
  // log) + per-set RPE bonus computed above.
  const storedIP = logs.reduce((sum, l) => sum + (l.intensityPoints ?? 0), 0);
  const totalIntensityPoints = storedIP + rpeBonusIP;
  const prCount = Object.keys(prs).length;
  const distinctExercises = distinctEx.size;
  const recentDistinctExercises = recentDistinctEx.size;

  const tier = buildCanonicalTier({
    totalSessions, streak,
    totalVolumeKg: totalVolume,
    prCount,
    distinctExercises,
    recentDistinctExercises,
    monthsOnApp,
    sessionsLast4Weeks,
    daysPerWeek,
    sessions180d,
    weeklyStreak,
    recentSetsByExercise,
    weeklyVolumes,
    weightCurrentKg: extra.weightCurrentKg,
    bfCurrentPct: extra.bfCurrentPct,
    weightChange90dKg: extra.weightChange90dKg,
    bfChange90dPct: extra.bfChange90dPct,
    gender: extra.gender,
    totalIntensityPointsLifetime: totalIntensityPoints,
  });

  void ninetyDaysAgo;
  return {
    totalSessions,
    streak,
    prCount,
    totalVolume: Math.round(totalVolume),
    totalIntensityPoints,
    lastSession: logs[0]?.date.toISOString().slice(0, 10) ?? null,
    distinctExercises,
    recentDistinctExercises,
    monthsOnApp,
    tier,
    weightStart: null,
    weightCurrent: null,
    weightChangeKg: null,
    weightStartDate: null,
    bfStart: null,
    bfCurrent: null,
    bfChangePct: null,
    bfStartDate: null,
  };
}

// Walk a chronological list of BodyMetric rows for one user and return
// the first/latest non-null entries plus the signed delta. Used to
// power the WEIGHT / BF leaderboard views without forcing every caller
// to repeat the same null-handling.
// Also computes the 90-day deltas feeding the Body Comp sub-rank.
type MetricLike = { date: Date; weightKg: number | null; bodyFatPct: number | null };
function computeBodyStats(metrics: MetricLike[]): {
  weightStart: number | null;
  weightCurrent: number | null;
  weightChangeKg: number | null;
  weightStartDate: string | null;
  bfStart: number | null;
  bfCurrent: number | null;
  bfChangePct: number | null;
  bfStartDate: string | null;
  weightChange90dKg: number | null;
  bfChange90dPct: number | null;
} {
  const sorted = [...metrics].sort((a, b) => +a.date - +b.date);
  let weightStart: number | null = null, weightStartDate: string | null = null;
  let weightCurrent: number | null = null;
  let bfStart: number | null = null, bfStartDate: string | null = null;
  let bfCurrent: number | null = null;
  // Walk to find ≥90d-old "baseline" entries — used for the Body Comp
  // 90d maintenance trend. Pick the entry CLOSEST to 90 days ago
  // (within ±21d) as the baseline.
  const ninetyDaysAgo = Date.now() - 90 * 86400000;
  const baselineWindow = 21 * 86400000;
  let weightAt90: number | null = null;
  let bfAt90: number | null = null;
  let bestWeightDeltaToTarget = Infinity;
  let bestBFDeltaToTarget = Infinity;
  for (const m of sorted) {
    if (m.weightKg != null) {
      if (weightStart == null) { weightStart = m.weightKg; weightStartDate = m.date.toISOString().slice(0, 10); }
      weightCurrent = m.weightKg;
      const d = Math.abs(+m.date - ninetyDaysAgo);
      if (d <= baselineWindow && d < bestWeightDeltaToTarget) {
        weightAt90 = m.weightKg;
        bestWeightDeltaToTarget = d;
      }
    }
    if (m.bodyFatPct != null) {
      if (bfStart == null) { bfStart = m.bodyFatPct; bfStartDate = m.date.toISOString().slice(0, 10); }
      bfCurrent = m.bodyFatPct;
      const d = Math.abs(+m.date - ninetyDaysAgo);
      if (d <= baselineWindow && d < bestBFDeltaToTarget) {
        bfAt90 = m.bodyFatPct;
        bestBFDeltaToTarget = d;
      }
    }
  }
  return {
    weightStart, weightCurrent,
    weightChangeKg: weightStart != null && weightCurrent != null ? Math.round((weightCurrent - weightStart) * 10) / 10 : null,
    weightStartDate,
    bfStart, bfCurrent,
    bfChangePct: bfStart != null && bfCurrent != null ? Math.round((bfCurrent - bfStart) * 10) / 10 : null,
    bfStartDate,
    weightChange90dKg: weightAt90 != null && weightCurrent != null ? Math.round((weightCurrent - weightAt90) * 10) / 10 : null,
    bfChange90dPct: bfAt90 != null && bfCurrent != null ? Math.round((bfCurrent - bfAt90) * 10) / 10 : null,
  };
}

/**
 * Batch-compute stats for many users with a single Prisma query.
 * Returns a Map keyed by userId.
 *
 * Pass `groupWorkoutId` to restrict the session count + PRs + volume
 * to logs tagged with that group workout — used by the filtered group
 * leaderboard so only "actually doing the prescribed work" counts.
 * Body metrics are NEVER filtered (weight/BF are user-wide signals).
 */
export async function computeStatsForUsers(userIds: string[], groupWorkoutId?: string): Promise<Map<string, LeaderboardMemberStats>> {
  if (userIds.length === 0) return new Map();
  const [allLogs, allMetrics, users, profiles] = await Promise.all([
    prisma.workoutLog.findMany({
      where: groupWorkoutId
        ? { userId: { in: userIds }, groupWorkoutId }
        : { userId: { in: userIds } },
      select: { userId: true, date: true, sets: true, intensityPoints: true },
      orderBy: { date: "desc" },
    }),
    prisma.bodyMetric.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, date: true, weightKg: true, bodyFatPct: true },
      orderBy: { date: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, createdAt: true },
    }),
    // Pull `gender` alongside daysPerWeek so the Body Comp sub-rank
    // picks the sex-calibrated curve. (qa: tier-scoring-v2)
    prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, daysPerWeek: true, gender: true },
    }),
  ]);
  const dpwByUser = new Map<string, number>();
  const genderByUser = new Map<string, string | null>();
  for (const p of profiles) {
    dpwByUser.set(p.userId, p.daysPerWeek);
    genderByUser.set(p.userId, p.gender ?? null);
  }
  const byUser = new Map<string, LogLike[]>();
  for (const log of allLogs) {
    const arr = byUser.get(log.userId) ?? [];
    arr.push({ date: log.date, sets: log.sets, intensityPoints: log.intensityPoints });
    byUser.set(log.userId, arr);
  }
  const metricsByUser = new Map<string, MetricLike[]>();
  for (const m of allMetrics) {
    const arr = metricsByUser.get(m.userId) ?? [];
    arr.push({ date: m.date, weightKg: m.weightKg, bodyFatPct: m.bodyFatPct });
    metricsByUser.set(m.userId, arr);
  }
  const createdAtByUser = new Map<string, Date>();
  for (const u of users) createdAtByUser.set(u.id, u.createdAt);
  const result = new Map<string, LeaderboardMemberStats>();
  for (const userId of userIds) {
    const createdAt = createdAtByUser.get(userId);
    const monthsOnApp = createdAt ? (Date.now() - +createdAt) / (30 * 86400000) : 0;
    const body = computeBodyStats(metricsByUser.get(userId) ?? []);
    const base = computeStatsFromLogs(
      byUser.get(userId) ?? [],
      monthsOnApp,
      dpwByUser.get(userId) ?? 4,
      0,
      {
        weightCurrentKg: body.weightCurrent,
        bfCurrentPct: body.bfCurrent,
        weightChange90dKg: body.weightChange90dKg,
        bfChange90dPct: body.bfChange90dPct,
        gender: genderByUser.get(userId) ?? null,
      },
    );
    result.set(userId, { ...base, ...body });
  }
  return result;
}

// Legacy session-count tier ladder removed — see lib/tiers.ts
// (ATHLETE_TIERS + computeAthleteTier) for the canonical score-
// based ladder that every leaderboard surface now reads. The
// canonical tier is shipped on every row via
// computeStatsForUsers → stats.tier above.
