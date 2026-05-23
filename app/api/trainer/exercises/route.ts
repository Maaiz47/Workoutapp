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
      weightInputType = null,
    } = body ?? {};

    if (!name || typeof name !== "string" || name.trim() === "") {
      return json({ error: "name is required" }, 400);
    }
    if (name.length > 80) return json({ error: "name too long (80 max)" }, 400);
    // Validate weightInputType — null = auto (legacy default). All
    // other values must match the canonical convention strings used
    // by the session weight-input hint. (qa: custom-exercise-weight-input-type)
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

    // Photos must be Cloudinary HTTPS URLs from this account's cloud
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

    const exercise = await (prisma.customExercise.create as any)({
      data: {
        trainerId: uid,
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

    return json({ exercise }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
