import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

const CLIENT_TIERS = [
  { name: "Kitten", min: 0 },
  { name: "Pup", min: 3 },
  { name: "Bear", min: 8 },
  { name: "Wolf", min: 15 },
  { name: "Gorilla", min: 25 },
];

function getTier(totalSessions: number): string {
  let tier = CLIENT_TIERS[0].name;
  for (const t of CLIENT_TIERS) {
    if (totalSessions >= t.min) tier = t.name;
  }
  return tier;
}

function computeStats(logs: { date: Date; duration: string; sets: any; intensityPoints: number }[]) {
  const totalSessions = logs.length;

  // Compute streak
  const dates = Array.from(new Set(logs.map(l => l.date.toISOString().slice(0, 10)))).sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dates[0] === today || dates[0] === yesterday) {
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diff === 1) streak++;
      else break;
    }
  }

  // Compute PRs per exercise
  const prs: Record<string, { weight: number; reps: number }> = {};
  for (const log of logs) {
    const sets = (log.sets ?? {}) as Record<string, { weight: number; reps: number }>;
    for (const [k, v] of Object.entries(sets)) {
      const parts = k.split("-");
      const last = parts[parts.length - 1];
      const isDropSet = /^d\d+$/.test(last) && parts.length >= 3;
      if (isDropSet) { parts.pop(); parts.pop(); } else { parts.pop(); }
      const eid = parts.join("-");
      if (!prs[eid] || v.weight > prs[eid].weight || (v.weight === prs[eid].weight && v.reps > prs[eid].reps)) {
        prs[eid] = { weight: v.weight, reps: v.reps };
      }
    }
  }
  const prCount = Object.keys(prs).length;

  const totalVolume = logs.reduce((sum, log) => {
    const sets = (log.sets ?? {}) as Record<string, { weight: number; reps: number }>;
    return sum + Object.values(sets).reduce((s, v) => s + (v.weight || 0) * (v.reps || 0), 0);
  }, 0);

  const totalIntensityPoints = logs.reduce((sum, log) => sum + (log.intensityPoints ?? 0), 0);

  return {
    totalSessions,
    streak,
    prCount,
    totalVolume: Math.round(totalVolume),
    totalIntensityPoints,
    lastSession: logs[0]?.date.toISOString().slice(0, 10) ?? null,
  };
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    // Get all groups this user is a member of
    const memberships = await prisma.leaderboardGroupMember.findMany({
      where: { userId: uid },
      select: { groupId: true },
    });
    const groupIds = memberships.map(m => m.groupId);

    const groups = await prisma.leaderboardGroup.findMany({
      where: { id: { in: groupIds } },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                workoutLogs: {
                  select: { date: true, duration: true, intensityPoints: true, sets: true },
                  orderBy: { date: "desc" },
                  take: 200,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = groups.map(group => {
      const rankedMembers = group.members
        .filter(m => m.includeInRank)
        .map(m => {
          const stats = computeStats(m.user.workoutLogs);
          return {
            userId: m.userId,
            username: m.user.username,
            role: m.role,
            tier: getTier(stats.totalSessions),
            ...stats,
          };
        })
        .sort((a, b) => b.totalSessions - a.totalSessions);

      return {
        id: group.id,
        name: group.name,
        privacy: group.privacy,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        leaderboard: rankedMembers,
      };
    });

    return json({ groups: result });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
