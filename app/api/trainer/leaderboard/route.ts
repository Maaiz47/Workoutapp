import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    const clientLinks = await prisma.trainerClient.findMany({
      where: { trainerId: uid },
      select: { clientId: true },
    });
    const clientIds = clientLinks.map(c => c.clientId);

    const clients = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: {
        id: true,
        username: true,
        workoutLogs: {
          select: { date: true, duration: true, sets: true, intensityPoints: true },
          orderBy: { date: "desc" },
          take: 200,
        },
        profile: { select: { weightKg: true, bodyFatPct: true, goal: true, fitnessLevel: true } },
      },
    });

    const leaderboard = clients.map(c => {
      const logs = c.workoutLogs;
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

      const totalIntensityPoints = logs.reduce((sum, log) => sum + ((log as any).intensityPoints ?? 0), 0);

      return {
        id: c.id,
        username: c.username,
        totalSessions,
        streak,
        prCount,
        totalVolume: Math.round(totalVolume),
        totalIntensityPoints,
        lastSession: logs[0]?.date.toISOString().slice(0, 10) ?? null,
        profile: c.profile,
      };
    });

    // Sort by total sessions desc
    leaderboard.sort((a, b) => b.totalSessions - a.totalSessions);

    return json({ leaderboard });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
