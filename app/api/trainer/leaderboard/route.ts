import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";

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
        profile: { select: { weightKg: true, bodyFatPct: true, goal: true, fitnessLevel: true } },
      },
    });

    // Single source of truth — computeStatsForUsers computes stats +
    // canonical athlete tier with the same logic the group
    // leaderboards use. Wellness is still localStorage-only, so the
    // resulting tier may sit one rung below what the client sees on
    // their own dashboard, but it's on the SAME ladder
    // (Kitten → Gorilla on the 0-100 score) and matches every other
    // leaderboard surface.
    const statsByUser = await computeStatsForUsers(clientIds);
    const leaderboard = clients.map(c => {
      const s = statsByUser.get(c.id);
      return {
        id: c.id,
        username: c.username,
        totalSessions: s?.totalSessions ?? 0,
        streak: s?.streak ?? 0,
        prCount: s?.prCount ?? 0,
        totalVolume: s?.totalVolume ?? 0,
        totalIntensityPoints: s?.totalIntensityPoints ?? 0,
        lastSession: s?.lastSession ?? null,
        tier: s?.tier ?? null,
        distinctExercises: s?.distinctExercises ?? 0,
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
