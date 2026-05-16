import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const profile = await prisma.userProfile.findUnique({ where: { userId: uid } });
  return json({ profile: profile ?? null });
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const { dob, gender, heightCm, weightKg, bodyFatPct, goal, fitnessLevel, location, equipment, daysPerWeek } = body;

    if (!dob || !gender || !heightCm || !weightKg || !goal || !fitnessLevel || !location || !daysPerWeek)
      return json({ error: "Missing required fields" }, 400);

    const profile = await prisma.userProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        dob: new Date(dob),
        gender,
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        goal,
        fitnessLevel,
        location,
        equipment: equipment || [],
        daysPerWeek: parseInt(daysPerWeek),
      },
      update: {
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        goal,
        fitnessLevel,
        location,
        equipment: equipment || [],
        daysPerWeek: parseInt(daysPerWeek),
      },
    });

    return json({ profile });
  } catch (e) {
    console.error("Profile save error:", e);
    return json({ error: "Failed to save profile" }, 500);
  }
}
