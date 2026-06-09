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

// Edit an existing custom exercise. The home "My Exercises" list now
// opens a row into the same form the creator uses, then saves via this
// handler — previously the only action was DELETE so a trainer couldn't
// open/edit one they'd made. Validation mirrors POST exactly.
// (qa: trainer-custom-exercises)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    const existing = await prisma.customExercise.findUnique({
      where: { id: params.id },
      select: { trainerId: true },
    });
    if (!existing) return json({ error: "Not found" }, 404);
    if (existing.trainerId !== uid) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      name,
      primaryMuscles = [],
      secondaryMuscles = [],
      equipment = [],
      type = "compound",
      difficulty = "intermediate",
      photoUrls = [],
      weightInputType = null,
    } = body ?? {};

    if (!name || typeof name !== "string" || name.trim() === "") {
      return json({ error: "name is required" }, 400);
    }
    if (name.length > 80) return json({ error: "name too long (80 max)" }, 400);

    const VALID_WEIGHT_TYPES = ["barbell-total", "dumbbell-per", "stack-pin", "bodyweight-added", "time-only", "reps-only"];
    if (weightInputType != null && (typeof weightInputType !== "string" || !VALID_WEIGHT_TYPES.includes(weightInputType))) {
      return json({ error: "Invalid weightInputType" }, 400);
    }

    const okStrArr = (a: unknown, max: number) =>
      Array.isArray(a) && a.length <= max && a.every(x => typeof x === "string" && x.length <= 40);
    if (!okStrArr(primaryMuscles, 12) || !okStrArr(secondaryMuscles, 12) || !okStrArr(equipment, 12)) {
      return json({ error: "Invalid muscle/equipment arrays" }, 400);
    }

    if (!["compound", "isolation", "cardio", "isometric"].includes(type)) {
      return json({ error: "Invalid type" }, 400);
    }
    if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
      return json({ error: "Invalid difficulty" }, 400);
    }

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (!Array.isArray(photoUrls) || photoUrls.length > 5) {
      return json({ error: "Up to 5 photos allowed" }, 400);
    }
    const photosOk = photoUrls.every((u: unknown) =>
      typeof u === "string" &&
      u.length <= 500 &&
      u.startsWith(`https://res.cloudinary.com/${cloud}/`)
    );
    if (!photosOk) return json({ error: "Photo URLs must come from our Cloudinary account" }, 400);

    const exercise = await (prisma.customExercise.update as any)({
      where: { id: params.id },
      data: {
        name: name.trim(),
        primaryMuscles,
        secondaryMuscles,
        equipment,
        type,
        difficulty,
        photoUrls,
        weightInputType: weightInputType ?? null,
      },
    });

    return json({ exercise });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
