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

    const exercises = await prisma.customExercise.findMany({
      where: { trainerId: uid },
      orderBy: { createdAt: "desc" },
    });

    return json({ exercises });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      name,
      primaryMuscles = [],
      secondaryMuscles = [],
      equipment = [],
      type = "compound",
      difficulty = "intermediate",
      photoUrls = [],
    } = body ?? {};

    if (!name || typeof name !== "string" || name.trim() === "") {
      return json({ error: "name is required" }, 400);
    }

    const exercise = await prisma.customExercise.create({
      data: {
        trainerId: uid,
        name: name.trim(),
        primaryMuscles,
        secondaryMuscles,
        equipment,
        type,
        difficulty,
        photoUrls,
      },
    });

    return json({ exercise }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
