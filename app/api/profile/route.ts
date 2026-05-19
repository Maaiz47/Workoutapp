import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: uid } });
    return json({ profile: profile ?? null });
  } catch {
    return json({ profile: null });
  }
}

export async function PATCH(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const { targetWeightKg, targetBodyFatPct, hiitPreference, hiitIntensity } = await req.json();
    const profile = await prisma.userProfile.update({
      where: { userId: uid },
      data: {
        targetWeightKg:   targetWeightKg   !== undefined ? (targetWeightKg   ? parseFloat(targetWeightKg)   : null) : undefined,
        targetBodyFatPct: targetBodyFatPct !== undefined ? (targetBodyFatPct ? parseFloat(targetBodyFatPct) : null) : undefined,
        hiitPreference:   hiitPreference   !== undefined ? hiitPreference   : undefined,
        hiitIntensity:    hiitIntensity    !== undefined ? hiitIntensity    : undefined,
      } as any,
    });
    return json({ profile });
  } catch {
    return json({ error: "Failed to update goals" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const { dob, gender, heightCm, weightKg, bodyFatPct, goals, fitnessLevel, location, equipment, daysPerWeek, targetArea } = body;

    // Support both goals[] (new) and goal string (legacy)
    const goalsArr: string[] = Array.isArray(goals) && goals.length > 0 ? goals : body.goal ? [body.goal] : [];
    const primaryGoal = goalsArr[0] ?? "muscle";

    if (!dob || !gender || !heightCm || !weightKg || goalsArr.length === 0 || !fitnessLevel || !location || !daysPerWeek)
      return json({ error: "Missing required fields" }, 400);

    const newWeightKg = parseFloat(weightKg);
    const newBodyFatPct = bodyFatPct ? parseFloat(bodyFatPct) : null;

    // Check existing values to detect body stat changes
    const existing = await prisma.userProfile.findUnique({ where: { userId: uid } });

    const profile = await prisma.userProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        dob: new Date(dob),
        gender,
        heightCm: parseFloat(heightCm),
        weightKg: newWeightKg,
        bodyFatPct: newBodyFatPct,
        goal: primaryGoal,
        goals: goalsArr,
        fitnessLevel,
        location,
        equipment: equipment || [],
        daysPerWeek: parseInt(daysPerWeek),
        targetArea: targetArea || "none",
      },
      update: {
        heightCm: parseFloat(heightCm),
        weightKg: newWeightKg,
        bodyFatPct: newBodyFatPct,
        goal: primaryGoal,
        goals: goalsArr,
        fitnessLevel,
        location,
        equipment: equipment || [],
        daysPerWeek: parseInt(daysPerWeek),
        targetArea: targetArea || "none",
      },
    });

    // Auto-log a BodyMetric whenever weight or body fat changes
    const weightChanged = !existing || existing.weightKg !== newWeightKg;
    const bfChanged = newBodyFatPct !== null && (!existing || existing.bodyFatPct !== newBodyFatPct);
    if (weightChanged || bfChanged) {
      await prisma.bodyMetric.create({
        data: { userId: uid, weightKg: newWeightKg, bodyFatPct: newBodyFatPct, date: new Date() },
      });
    }

    return json({ profile });
  } catch (e) {
    console.error("Profile save error:", e);
    return json({ error: "Failed to save profile" }, 500);
  }
}
