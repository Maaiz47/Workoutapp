// Per-user leaderboard stats — totalSessions, current streak, PR count,
// total volume, total intensity points. Shared between the trainer
// client leaderboard, the "my groups" leaderboard, and the group
// management endpoint.

import { prisma } from "./prisma";

export interface LeaderboardMemberStats {
  totalSessions: number;
  streak: number;
  prCount: number;
  totalVolume: number;
  totalIntensityPoints: number;
  lastSession: string | null;
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

export function computeStatsFromLogs(logs: LogLike[]): LeaderboardMemberStats {
  const totalSessions = logs.length;

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

  // PR count: max (weight, reps) per exercise across all logged sets
  const prs: Record<string, { weight: number; reps: number }> = {};
  let totalVolume = 0;
  for (const log of logs) {
    const sets = (log.sets ?? {}) as Record<string, { weight?: number; reps?: number } | null>;
    for (const [k, v] of Object.entries(sets)) {
      const w = v?.weight ?? 0;
      const r = v?.reps ?? 0;
      totalVolume += w * r;
      const parts = k.split("-");
      const last = parts[parts.length - 1];
      const isDropSet = /^d\d+$/.test(last) && parts.length >= 3;
      if (isDropSet) { parts.pop(); parts.pop(); } else { parts.pop(); }
      const eid = parts.join("-");
      if (!prs[eid] || w > prs[eid].weight || (w === prs[eid].weight && r > prs[eid].reps)) {
        prs[eid] = { weight: w, reps: r };
      }
    }
  }

  const totalIntensityPoints = logs.reduce((sum, l) => sum + (l.intensityPoints ?? 0), 0);

  return {
    totalSessions,
    streak,
    prCount: Object.keys(prs).length,
    totalVolume: Math.round(totalVolume),
    totalIntensityPoints,
    lastSession: logs[0]?.date.toISOString().slice(0, 10) ?? null,
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
 */
export async function computeStatsForUsers(userIds: string[]): Promise<Map<string, LeaderboardMemberStats>> {
  if (userIds.length === 0) return new Map();
  const [allLogs, allMetrics] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, date: true, sets: true, intensityPoints: true },
      orderBy: { date: "desc" },
    }),
    prisma.bodyMetric.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, date: true, weightKg: true, bodyFatPct: true },
      orderBy: { date: "asc" },
    }),
  ]);
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
  const result = new Map<string, LeaderboardMemberStats>();
  for (const userId of userIds) {
    const base = computeStatsFromLogs(byUser.get(userId) ?? []);
    const body = computeBodyStats(metricsByUser.get(userId) ?? []);
    result.set(userId, { ...base, ...body });
  }
  return result;
}

export const CLIENT_TIERS = [
  { label: "Kitten",  emoji: "🐱", min: 0   },
  { label: "Monkey",  emoji: "🐒", min: 5   },
  { label: "Fox",     emoji: "🦊", min: 15  },
  { label: "Tiger",   emoji: "🐯", min: 30  },
  { label: "Lion",    emoji: "🦁", min: 60  },
  { label: "Gorilla", emoji: "🦍", min: 100 },
];

export function getTier(totalSessions: number) {
  let t = CLIENT_TIERS[0];
  for (const tier of CLIENT_TIERS) if (totalSessions >= tier.min) t = tier;
  return t;
}
