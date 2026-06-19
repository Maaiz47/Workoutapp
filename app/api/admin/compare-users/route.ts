import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// GET /api/admin/compare-users?usernames=maaiz,alla,munchy
// Pulls each user's canonical tier breakdown + key inputs side-by-
// side. One-shot tool for tier-calibration analysis ("is maaiz really
// a Lion?"). Same `computeStatsForUsers` pipeline the leaderboard
// uses, so the numbers match what's on screen.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  const usernames = (req.nextUrl.searchParams.get("usernames") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (usernames.length === 0) return json({ error: "Missing usernames=a,b,c" }, 400);

  try {
    const users = await prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { id: true, username: true, createdAt: true, profile: { select: { daysPerWeek: true, gender: true, weightKg: true, bodyFatPct: true, tierTheme: true, location: true, equipment: true, targetArea: true } } },
    });
    const userIds = users.map(u => u.id);
    if (userIds.length === 0) return json({ users: [] });

    const statsByUser = await computeStatsForUsers(userIds);

    // Recent body metrics + wellness count for each user. PRs are
    // computed at read-time by computeStatsForUsers — no separate
    // ExercisePR table to query — and the canonical sub-rank detail
    // strings already surface "best e1RM <kg> (<BW>× BW)" for the
    // Strength dimension, which is the calibration signal we want.
    const [metrics, wellness] = await Promise.all([
      prisma.bodyMetric.findMany({ where: { userId: { in: userIds } }, orderBy: { date: "desc" } }),
      prisma.wellnessLog.findMany({ where: { userId: { in: userIds }, date: { gte: new Date(Date.now() - 14 * 86400000) } } }),
    ]);

    const metricsByUser = new Map<string, typeof metrics>();
    for (const m of metrics) {
      if (!metricsByUser.has(m.userId)) metricsByUser.set(m.userId, []);
      metricsByUser.get(m.userId)!.push(m);
    }
    const wellnessCountByUser = new Map<string, number>();
    for (const w of wellness) {
      wellnessCountByUser.set(w.userId, (wellnessCountByUser.get(w.userId) ?? 0) + 1);
    }

    const result = users.map(u => {
      const s = statsByUser.get(u.id);
      const userMetrics = (metricsByUser.get(u.id) ?? []).slice(0, 5).map(m => ({
        date: m.date,
        weightKg: m.weightKg,
        bodyFatPct: m.bodyFatPct,
      }));
      return {
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        daysPerWeek: u.profile?.daysPerWeek ?? null,
        gender: u.profile?.gender ?? null,
        onboardingWeightKg: u.profile?.weightKg ?? null,
        onboardingBodyFatPct: u.profile?.bodyFatPct ?? null,
        tierTheme: u.profile?.tierTheme ?? null,
        location: (u.profile as any)?.location ?? null,
        equipment: (u.profile as any)?.equipment ?? null,
        targetArea: (u.profile as any)?.targetArea ?? null,
        stats: s ? {
          totalSessions: s.totalSessions,
          streak: s.streak,
          prCount: s.prCount,
          totalVolume: s.totalVolume,
          totalIntensityPoints: s.totalIntensityPoints,
          lastSession: s.lastSession,
          distinctExercises: s.distinctExercises,
          recentDistinctExercises: s.recentDistinctExercises,
          monthsOnApp: s.monthsOnApp,
          weightStart: s.weightStart,
          weightCurrent: s.weightCurrent,
          weightChangeKg: s.weightChangeKg,
          bfStart: s.bfStart,
          bfCurrent: s.bfCurrent,
          bfChangePct: s.bfChangePct,
        } : null,
        tier: s?.tier ? {
          label: s.tier.label,
          tierNum: s.tier.tierNum,
          score: s.tier.score,
          min: s.tier.min,
          subRanks: s.tier.subRanks ?? [],
        } : null,
        recentBodyMetrics: userMetrics,
        wellnessLogsLast14d: wellnessCountByUser.get(u.id) ?? 0,
      };
    });

    return json({ users: result });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
