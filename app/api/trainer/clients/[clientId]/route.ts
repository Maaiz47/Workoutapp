import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

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

    const [client, profile, logs, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: params.clientId }, select: { username: true } }),
      prisma.userProfile.findUnique({ where: { userId: params.clientId } }),
      prisma.workoutLog.findMany({
        where: { userId: params.clientId },
        orderBy: { date: "desc" },
        take: 100,
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

    return json({ username: client.username, profile, history, plan });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
