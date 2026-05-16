import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { generatePlan, UserProfileInput } from "../../../lib/planGenerator";
import { Equipment, Location, Goal } from "../../../lib/exercises";
import { WORKOUT_DATA } from "../../../lib/workouts";

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
    const body = await req.json().catch(() => ({}));

    // ── Init from WORKOUT_DATA defaults (for existing users without a profile) ──
    if (body.action === "init") {
      const existing = await prisma.workoutPlan.findUnique({ where: { userId: uid } });
      if (existing) {
        const plan = await prisma.workoutPlan.findUnique({
          where: { userId: uid },
          include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
        });
        return json({ plan });
      }

      const plan = await prisma.workoutPlan.create({
        data: {
          userId: uid,
          days: {
            create: WORKOUT_DATA.map((wd, i) => ({
              id: wd.id, // preserve WORKOUT_DATA IDs so history still matches
              dayIndex: i,
              title: wd.title,
              subtitle: wd.focus,
              focus: wd.focus,
              exercises: {
                create: wd.sections
                  .flatMap(s => s.exercises)
                  .filter(e => e.trackable !== false)
                  .map((ex, j) => ({
                    order: j,
                    exerciseId: ex.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest: ex.rest ?? 60,
                    notes: ex.note ?? null,
                  })),
              },
            })),
          },
        },
        include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
      });

      return json({ plan });
    }

    // ── Generate from profile ──
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
      targetArea: profile.targetArea ?? "none",
    };

    const generated = generatePlan(input);

    await prisma.workoutPlan.deleteMany({ where: { userId: uid } });

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
    console.error("Plan error:", e);
    return json({ error: "Failed" }, 500);
  }
}

// ── Update a day's exercises (reorder / add / remove) ──────────────────────
export async function PUT(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { dayId, exercises } = await req.json();
    if (!dayId || !Array.isArray(exercises)) return json({ error: "Invalid payload" }, 400);

    // Verify day belongs to this user
    const day = await prisma.planDay.findFirst({
      where: { id: dayId, plan: { userId: uid } },
    });
    if (!day) return json({ error: "Not found" }, 404);

    // Delete existing exercises and recreate in new order
    await prisma.planExercise.deleteMany({ where: { dayId } });
    await prisma.planExercise.createMany({
      data: exercises.map((ex: any, i: number) => ({
        dayId,
        order: i,
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        notes: ex.notes ?? null,
      })),
    });

    const updated = await prisma.planDay.findUnique({
      where: { id: dayId },
      include: { exercises: { orderBy: { order: "asc" } } },
    });

    return json({ day: updated });
  } catch (e) {
    console.error("Plan update error:", e);
    return json({ error: "Failed to update" }, 500);
  }
}
