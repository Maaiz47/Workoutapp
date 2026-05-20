import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const routine = await prisma.savedRoutine.findUnique({ where: { id: params.id } });
  if (!routine || routine.userId !== uid) return json({ error: "Not found" }, 404);

  await prisma.savedRoutine.delete({ where: { id: params.id } });
  return json({ ok: true });
}

// Restore a saved routine as the active plan
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const routine = await prisma.savedRoutine.findUnique({ where: { id: params.id } });
    if (!routine || routine.userId !== uid) return json({ error: "Not found" }, 404);

    const days = routine.planJson as any[];

    await prisma.$transaction(async (tx) => {
      // Snapshot the old plan days BEFORE deleting so we can carry workout
      // history forward by title match where possible.
      const oldPlan = await tx.workoutPlan.findUnique({
        where: { userId: uid },
        include: { days: { include: { exercises: true } } },
      });
      const oldDays = oldPlan?.days ?? [];

      await tx.workoutPlan.deleteMany({ where: { userId: uid } });
      await tx.workoutPlan.create({
        data: {
          userId: uid,
          days: {
            create: days.map((day: any, i: number) => ({
              dayIndex: i,
              title: day.title,
              subtitle: day.subtitle ?? day.focus ?? "",
              focus: day.focus ?? day.subtitle ?? "",
              exercises: {
                create: (day.exercises ?? []).map((ex: any, j: number) => ({
                  order: j,
                  exerciseId: ex.exerciseId,
                  name: ex.name,
                  sets: ex.sets,
                  reps: ex.reps,
                  rest: ex.rest ?? 60,
                  notes: ex.notes ?? null,
                })),
              },
            })),
          },
        },
      });

      // Re-link existing workout logs to the new plan day ids. Prefer
      // exact title match; fall back to exercise-overlap scoring.
      const newPlan = await tx.workoutPlan.findUnique({
        where: { userId: uid },
        include: { days: { include: { exercises: true } } },
      });
      const newDays = newPlan?.days ?? [];
      if (oldDays.length && newDays.length) {
        const newTitleToId: Record<string, string> = {};
        for (const d of newDays) newTitleToId[d.title.toLowerCase()] = d.id;
        const newDayExLists = newDays.map(d => ({ id: d.id, ex: d.exercises.map(e => e.exerciseId) }));

        for (const od of oldDays) {
          // 1) Title-match first.
          let target: string | null = newTitleToId[od.title.toLowerCase()] ?? null;
          // 2) Otherwise pick the new day with the most exercise overlap.
          if (!target) {
            const oldEx = od.exercises.map(e => e.exerciseId);
            let best = 0;
            for (const nd of newDayExLists) {
              let score = 0;
              for (const eid of oldEx) if (nd.ex.indexOf(eid) >= 0) score++;
              if (score > best) { best = score; target = nd.id; }
            }
          }
          if (target) {
            await tx.workoutLog.updateMany({
              where: { userId: uid, dayId: od.id },
              data: { dayId: target },
            });
          }
        }
      }
    });

    const plan = await prisma.workoutPlan.findUnique({
      where: { userId: uid },
      include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
    });

    return json({ plan });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
