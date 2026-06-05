import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
// Trainer client list must NEVER be cached — when an athlete accepts
// the coaching request, the trainer's next fetch has to see the new
// row immediately or they'll think the accept didn't land. Per @maaiz
// 2026-05-26 recurring report. (qa: trainer-request-pending-state)
function json(data: object, status = 200) {
  const res = NextResponse.json(data, { status });
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    // Self-heal: reconcile accepted requests into roster rows. Older
    // accepts (pre-atomic-transaction) and any accept whose insert was
    // rolled back left "accepted" TrainerRequests with no TrainerClient
    // row, so the athlete accepted but never appeared here — the
    // recurring Amanii report. Backfill the missing rows before reading.
    // createMany + skipDuplicates honours the clientId unique, so a
    // client already rostered to ANOTHER trainer is left untouched (we
    // fill genuine gaps, never silently steal). (qa: trainer-request-pending-state)
    const acceptedReqs = await prisma.trainerRequest.findMany({
      where: { trainerId: uid, status: "accepted" },
      select: { userId: true },
    });
    if (acceptedReqs.length > 0) {
      const acceptedClientIds = acceptedReqs.map(r => r.userId);
      const existingRows = await prisma.trainerClient.findMany({
        where: { clientId: { in: acceptedClientIds } },
        select: { clientId: true },
      });
      const rostered = new Set(existingRows.map(r => r.clientId));
      const missing = acceptedClientIds.filter(id => !rostered.has(id));
      if (missing.length > 0) {
        await prisma.trainerClient.createMany({
          data: missing.map(clientId => ({ trainerId: uid, clientId })),
          skipDuplicates: true,
        });
      }
    }

    const records = await prisma.trainerClient.findMany({
      where: { trainerId: uid },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            createdAt: true,
            workoutLogs: {
              orderBy: { date: "desc" },
              take: 1,
              select: { date: true, duration: true },
            },
            _count: { select: { workoutLogs: true } },
            profile: { select: { avatarId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute each client's full tier + sub-rank breakdown so the
    // trainer can see the breakdown inline without opening each
    // client's detail view. (qa: trainer-client-subranks)
    const clientIds = records.map(r => r.client.id);
    const statsByUser = clientIds.length > 0 ? await computeStatsForUsers(clientIds) : new Map();

    const clients = records.map(r => {
      const stats = statsByUser.get(r.client.id) ?? null;
      return {
        id: r.client.id,
        username: r.client.username,
        avatarId: (r.client as any)?.profile?.avatarId ?? null,
        joinedAt: r.client.createdAt,
        logCount: r.client._count.workoutLogs,
        lastWorkout: r.client.workoutLogs[0] ?? null,
        clientSince: r.createdAt,
        // Engagement type — 'individual' (1-on-1) or 'group'. Lets
        // the trainer scan their roster by engagement model.
        // (qa: trainer-client-engagement-type)
        engagementType: (r as any).engagementType ?? "individual",
        tier: stats?.tier ?? null,
      };
    });

    return json({ clients });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
