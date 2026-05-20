import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("ironlog-uid")?.value;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const logs = await prisma.workoutLog.findMany({
      where: { userId: uid },
      orderBy: { date: "desc" },
      take: 200,
    });

    const grouped: Record<string, any[]> = {};
    for (const log of logs) {
      if (!grouped[log.dayId]) grouped[log.dayId] = [];
      grouped[log.dayId].push({
        id: log.id,
        date: log.date.toISOString().slice(0, 10),
        time: log.date.toISOString().slice(11, 19),
        duration: log.duration,
        sets: log.sets,
        intensityPoints: log.intensityPoints,
      });
    }

    return NextResponse.json(grouped);
  } catch (e) {
    console.error("Workout GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("ironlog-uid")?.value;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { dayId, duration, sets, intensityPoints } = await req.json();
    if (!dayId || !sets) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const log = await prisma.workoutLog.create({
      data: { userId: uid, dayId, duration: duration || "00:00:00", sets, intensityPoints: typeof intensityPoints === 'number' ? intensityPoints : 0 },
    });

    return NextResponse.json({ success: true, id: log.id });
  } catch (e) {
    console.error("Workout POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const uid = req.cookies.get("ironlog-uid")?.value;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Only delete if it belongs to this user
    const log = await prisma.workoutLog.findUnique({ where: { id } });
    if (!log || log.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.workoutLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Workout DELETE error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
