// Per-user leaderboard stats — totalSessions, current streak, PR count,
// total volume, total intensity points. Shared between the trainer
// client leaderboard, the "my groups" leaderboard, and the group
// management endpoint.

import { prisma } from "./prisma";
import { computeAthleteTier, ATHLETE_TIERS, AnimalTier } from "./tiers";

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
  color: string;
  bg: string;
  border: string;
  min: number;
  score: number; // 0-100 headlineScore
  idx: number;   // position on the ladder, 0-indexed
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
  // 180-day distinct-exercise count for the Mastery sub-rank. Optional
  // because legacy callers may not pass it. (qa: tier-decay)
  recentDistinctExercises?: number;
  monthsOnApp: number;
  // Optional adherence inputs — passed through to computeAthleteTier
  // so the consistency sub-rank rewards target-hitting + rest days.
  // (qa: tier-scoring-fairness)
  sessionsLast4Weeks?: number;
  daysPerWeek?: number;
  // Cumulative lucky-drop tier score bonus. Added on top of the
  // computed headline so rare random rewards actually move the
  // metric users care about. Capped on the source side.
  // (qa: random-rare-rewards)
  tierScoreBonus?: number;
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
  });
  const bonus = Math.max(0, s.tierScoreBonus ?? 0);
  const blendedScore = Math.min(100, breakdown.headlineScore + bonus);
  // Re-resolve the tier if the bonus pushed us up a rung. Theme isn't
  // available here (single-source-of-truth lives on the visitor's
  // profile in the page-level computeAthleteTier call) — but the
  // tier IDX is what every surface uses to render the label, so
  // recompute against ATHLETE_TIERS (vivid) which has the same minima
  // as every other theme.
  let resolvedIdx = ATHLETE_TIERS.findIndex(x => x.label === breakdown.headline.label);
  for (let i = ATHLETE_TIERS.length - 1; i >= 0; i--) {
    if (blendedScore >= ATHLETE_TIERS[i].min) { resolvedIdx = i; break; }
  }
  const t: AnimalTier = ATHLETE_TIERS[resolvedIdx];
  return {
    label: t.label,
    icon: t.icon,
    color: t.color,
    bg: t.bg,
    border: t.border,
    min: t.min,
    score: blendedScore,
    idx: resolvedIdx,
  };
}

// `monthsOnApp` + `daysPerWeek` are passed by computeStatsForUsers
// (which has the User.createdAt + UserProfile.daysPerWeek); single-
// log callers default to 0 / 4.
export function computeStatsFromLogs(logs: LogLike[], monthsOnApp: number = 0, daysPerWeek: number = 4, tierScoreBonus: number = 0): LeaderboardMemberStats {
  const totalSessions = logs.length;

  // Sessions logged in the last 4 weeks — feeds the adherence
  // dimension of the consistency sub-rank. Counted as DISTINCT days
  // so doing two sessions in a day still counts as one training
  // day vs the weekly target. (qa: tier-scoring-fairness)
  const fourWeeksAgo = Date.now() - 28 * 86400000;
  const sessionsLast4Weeks = new Set(
    logs
      .filter(l => l.date.getTime() >= fourWeeksAgo)
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

  // PR count + total volume + distinct exercises in one pass. The
  // exercise key is everything before the trailing "-<setNum>"
  // (optionally followed by "-d<dropNum>" for drop sets) so the
  // same exercise across different set numbers collapses to one
  // entry in `distinctEx`.
  //
  // `recentDistinctEx` is the 180d-window cut of the same set —
  // feeds the Mastery sub-rank so a user stuck in a rut loses
  // mastery score until they re-broaden their training. Lifetime
  // count is kept for display ("X lifetime"). (qa: tier-decay)
  const prs: Record<string, { weight: number; reps: number }> = {};
  const distinctEx = new Set<string>();
  const recentDistinctEx = new Set<string>();
  const oneEightyDaysAgo = Date.now() - 180 * 86400000;
  let totalVolume = 0;
  for (const log of logs) {
    const isRecent = log.date.getTime() >= oneEightyDaysAgo;
    const sets = (log.sets ?? {}) as Record<string, { weight?: number; reps?: number; skipped?: boolean } | null>;
    for (const [k, v] of Object.entries(sets)) {
      if (!v || v.skipped) continue;
      const w = v.weight ?? 0;
      const r = v.reps ?? 0;
      totalVolume += w * r;
      const parts = k.split("-");
      const last = parts[parts.length - 1];
      const isDropSet = /^d\d+$/.test(last) && parts.length >= 3;
      if (isDropSet) { parts.pop(); parts.pop(); } else { parts.pop(); }
      const eid = parts.join("-");
      if (eid) {
        distinctEx.add(eid);
        if (isRecent) recentDistinctEx.add(eid);
      }
      if (!prs[eid] || w > prs[eid].weight || (w === prs[eid].weight && r > prs[eid].reps)) {
        prs[eid] = { weight: w, reps: r };
      }
    }
  }

  const totalIntensityPoints = logs.reduce((sum, l) => sum + (l.intensityPoints ?? 0), 0);
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
    tierScoreBonus,
  });

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
    // Body metrics filled in by computeStatsForUsers — placeholder values
    // here so single-log callers don't see undefined.
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
type MetricLike = { date: Date; weightKg: number | null; bodyFatPct: number | null };
function computeBodyStats(metrics: MetricLike[]) {
  const sorted = [...metrics].sort((a, b) => +a.date - +b.date);
  let weightStart: number | null = null, weightStartDate: string | null = null;
  let weightCurrent: number | null = null;
  let bfStart: number | null = null, bfStartDate: string | null = null;
  let bfCurrent: number | null = null;
  for (const m of sorted) {
    if (m.weightKg != null) {
      if (weightStart == null) { weightStart = m.weightKg; weightStartDate = m.date.toISOString().slice(0, 10); }
      weightCurrent = m.weightKg;
    }
    if (m.bodyFatPct != null) {
      if (bfStart == null) { bfStart = m.bodyFatPct; bfStartDate = m.date.toISOString().slice(0, 10); }
      bfCurrent = m.bodyFatPct;
    }
  }
  return {
    weightStart, weightCurrent,
    weightChangeKg: weightStart != null && weightCurrent != null ? Math.round((weightCurrent - weightStart) * 10) / 10 : null,
    weightStartDate,
    bfStart, bfCurrent,
    bfChangePct: bfStart != null && bfCurrent != null ? Math.round((bfCurrent - bfStart) * 10) / 10 : null,
    bfStartDate,
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
  // Fetch logs, body metrics, AND the users' createdAt timestamps in
  // one round-trip. createdAt feeds `monthsOnApp` into the canonical
  // tier computation — without it the "Consistency" sub-rank doesn't
  // get its time-on-app blend right.
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
    // Profiles fetched so daysPerWeek feeds the adherence dimension
    // of the consistency sub-rank. Users without a profile fall back
    // to 4 days/week (the most common default).
    // (qa: tier-scoring-fairness)
    prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, daysPerWeek: true, tierScoreBonus: true },
    }),
  ]);
  const dpwByUser = new Map<string, number>();
  const bonusByUser = new Map<string, number>();
  for (const p of profiles) {
    dpwByUser.set(p.userId, p.daysPerWeek);
    bonusByUser.set(p.userId, p.tierScoreBonus ?? 0);
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
    const base = computeStatsFromLogs(byUser.get(userId) ?? [], monthsOnApp, dpwByUser.get(userId) ?? 4, bonusByUser.get(userId) ?? 0);
    const body = computeBodyStats(metricsByUser.get(userId) ?? []);
    result.set(userId, { ...base, ...body });
  }
  return result;
}

// Legacy session-count tier ladder removed — see lib/tiers.ts
// (ATHLETE_TIERS + computeAthleteTier) for the canonical score-
// based ladder that every leaderboard surface now reads. The
// canonical tier is shipped on every row via
// computeStatsForUsers → stats.tier above.
