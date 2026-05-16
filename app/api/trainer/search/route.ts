import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const trainer = await prisma.user.findUnique({ where: { id: uid } });
  if (!trainer || trainer.role !== "trainer") return json({ error: "Trainer account required" }, 403);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ results: [] });

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: "insensitive" },
      role: "user",
      id: { not: uid },
      clientOf: { is: null },
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
      _count: { select: { workoutLogs: true } },
    },
    orderBy: { username: "asc" },
    take: 10,
  });

  return json({
    results: users.map(u => ({
      id: u.id,
      username: u.username,
      joinedAt: u.createdAt,
      logCount: u._count.workoutLogs,
    })),
  });
}
