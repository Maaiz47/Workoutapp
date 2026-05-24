import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const rel = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!rel) return json({ error: "Not your client" }, 403);

    const [client, profile, logs, plan, bodyMetrics, statsMap] = await Promise.all([
      prisma.user.findUnique({ where: { id: params.clientId }, select: { username: true, createdAt: true } }),
      prisma.userProfile.findUnique({ where: { userId: params.clientId } }),
      prisma.workoutLog.findMany({
        where: { userId: params.clientId },
        orderBy: { date: "desc" },
        take: 200,
      }),
      prisma.workoutPlan.findUnique({
        where: { userId: params.clientId },
        include: {
          days: {
            orderBy: { dayIndex: "asc" },
            include: { exercises: { orderBy: { order: "asc" } } },
          },
        },
      }),
      // Body metric trend — weight + BF% over time. Powers the Stats
      // tab's body chart so trainers can see weight cuts/gains at a
      // glance. (qa: trainer client metrics)
      prisma.bodyMetric.findMany({
        where: { userId: params.clientId },
        select: { date: true, weightKg: true, bodyFatPct: true },
        orderBy: { date: "asc" },
      }),
      // Canonical athlete-tier breakdown via computeStatsForUsers so
      // the trainer sees the same headline tier the client sees on
      // their own dashboard.
      computeStatsForUsers([params.clientId]),
    ]);

    if (!client) return json({ error: "Client not found" }, 404);

    const history: Record<string, any[]> = {};
    for (const log of logs) {
      if (!history[log.dayId]) history[log.dayId] = [];
      history[log.dayId].push({
        id: log.id,
        date: log.date.toISOString().slice(0, 10),
        duration: log.duration,
        sets: log.sets,
      });
    }

    const stats = statsMap.get(params.clientId) ?? null;

    return json({
      username: client.username,
      createdAt: client.createdAt,
      profile,
      history,
      plan,
      bodyMetrics: bodyMetrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        weightKg: m.weightKg,
        bodyFatPct: m.bodyFatPct,
      })),
      stats,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// Disown a client — removes the TrainerClient relation. The user
// keeps their workout history + everything else; just the coaching
// link is severed. Either side can re-adopt later via the normal
// trainer-request flow. Naming per @maaiz: 'adopting and disowning'.
// (qa: trainer-disown-client)
// PATCH — update the engagement type on the trainer-client link.
// Only 'individual' or 'group' accepted. Trainer-only.
// (qa: trainer-client-engagement-type)
export async function PATCH(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const rel = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!rel) return json({ error: "Not your client" }, 403);

    const body = await req.json().catch(() => ({}));
    const engagementType: string | undefined = body?.engagementType;
    if (engagementType !== "individual" && engagementType !== "group") {
      return json({ error: "engagementType must be 'individual' or 'group'" }, 400);
    }

    await (prisma.trainerClient as any).update({
      where: { id: rel.id },
      data: { engagementType },
    });

    return json({ ok: true, engagementType });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const rel = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!rel) return json({ error: "Not your client" }, 403);

    await prisma.trainerClient.delete({ where: { id: rel.id } });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
