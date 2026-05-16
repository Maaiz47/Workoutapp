import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { generatePlan, UserProfileInput } from "../../../lib/planGenerator";
import { Equipment, Location, Goal } from "../../../lib/exercises";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const plan = await prisma.workoutPlan.findUnique({
    where: { userId: uid },
    include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
  });

  return json({ plan: plan ?? null });
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: uid } });
    if (!profile) return json({ error: "Complete your profile first" }, 400);

    const dob = new Date(profile.dob);
    const ageYears = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

    const input: UserProfileInput = {
      daysPerWeek: profile.daysPerWeek,
      goal: profile.goal as Goal,
      fitnessLevel: profile.fitnessLevel as "beginner" | "intermediate" | "advanced",
      location: profile.location as Location,
      equipment: profile.equipment as Equipment[],
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      ageYears,
    };

    const generated = generatePlan(input);

    // Delete existing plan + cascade
    await prisma.workoutPlan.deleteMany({ where: { userId: uid } });

    // Create new plan
    const plan = await prisma.workoutPlan.create({
      data: {
        userId: uid,
        days: {
          create: generated.days.map((day, i) => ({
            dayIndex: i,
            title: day.title,
            subtitle: day.subtitle,
            focus: day.focus,
            exercises: {
              create: day.exercises.map((ex, j) => ({
                order: j,
                exerciseId: ex.exerciseId,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                rest: ex.rest,
                notes: ex.notes ?? null,
              })),
            },
          })),
        },
      },
      include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
    });

    return json({ plan, planNote: generated.planNote });
  } catch (e) {
    console.error("Plan generation error:", e);
    return json({ error: "Failed to generate plan" }, 500);
  }
}
