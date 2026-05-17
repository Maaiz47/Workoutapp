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
