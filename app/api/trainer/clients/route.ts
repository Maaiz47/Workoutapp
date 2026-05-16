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
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const clients = records.map(r => ({
      id: r.client.id,
      username: r.client.username,
      joinedAt: r.client.createdAt,
      logCount: r.client._count.workoutLogs,
      lastWorkout: r.client.workoutLogs[0] ?? null,
      clientSince: r.createdAt,
    }));

    return json({ clients });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
