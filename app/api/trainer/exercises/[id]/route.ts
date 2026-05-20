import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    const exercise = await prisma.customExercise.findUnique({
      where: { id: params.id },
      select: { trainerId: true },
    });

    if (!exercise) return json({ error: "Not found" }, 404);
    if (exercise.trainerId !== uid) return json({ error: "Forbidden" }, 403);

    await prisma.customExercise.delete({ where: { id: params.id } });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
