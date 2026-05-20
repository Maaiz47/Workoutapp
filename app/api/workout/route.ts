import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// Re-link any workout logs whose dayId no longer exists in the user's current
// plan. Happens after a saved-routine restore (which deletes + recreates the
// plan with fresh ids). We match each orphan log to the current plan day whose
// exercises overlap most with the log's recorded sets. Idempotent — does
// nothing if there are no orphan logs.
async function repairOrphanLogs(uid: string): Promise<number> {
  const plan = await prisma.workoutPlan.findUnique({
    where: { userId: uid },
    include: { days: { include: { exercises: true } } },
  });
  if (!plan || plan.days.length === 0) return 0;

  const validDayIds = plan.days.map(d => d.id);
  const orphans = await prisma.workoutLog.findMany({
    where: { userId: uid, dayId: { notIn: validDayIds } },
  });
  if (orphans.length === 0) return 0;

  // Pre-compute the exercise-id list for each current plan day.
  const dayExerciseSets = plan.days.map(d => ({
    id: d.id,
    exerciseIds: d.exercises.map(e => e.exerciseId),
  }));

  let relinked = 0;
  for (const log of orphans) {
    const sets = log.sets as any;
    const loggedExerciseIds: string[] = [];
    try {
      if (Array.isArray(sets)) {
        for (const s of sets) if (s?.exerciseId) loggedExerciseIds.push(String(s.exerciseId));
      } else if (sets && typeof sets === "object") {
        for (const key of Object.keys(sets)) loggedExerciseIds.push(String(key));
      }
    } catch {}
    if (loggedExerciseIds.length === 0) continue;

    let bestDayId: string | null = null;
    let bestScore = 0;
    for (const d of dayExerciseSets) {
      let score = 0;
      for (const eid of loggedExerciseIds) if (d.exerciseIds.indexOf(eid) >= 0) score++;
      if (score > bestScore) { bestScore = score; bestDayId = d.id; }
    }
    if (bestDayId && bestScore > 0) {
      await prisma.workoutLog.update({ where: { id: log.id }, data: { dayId: bestDayId } });
      relinked++;
    }
  }
  return relinked;
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("ironlog-uid")?.value;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Self-heal orphaned logs before grouping.
    try { await repairOrphanLogs(uid); } catch (e) { console.error("repairOrphanLogs failed:", e); }

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
