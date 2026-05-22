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

    // ── Append a new (typically empty) day to the user's plan ──
    // Used by the "+ ADD DAY" button on the customise view so users
    // can drop in an extra cardio / mobility / custom session on top
    // of the planGenerator output. Bootstraps a plan from
    // WORKOUT_DATA first if the user has none yet.
    // (qa: maaiz — "Able to manually add session days from
    // customise? One user wants to add an extra cardio day on top
    // of the workouts built manually")
    if (body.action === "add-day") {
      let plan = await prisma.workoutPlan.findUnique({ where: { userId: uid } });
      if (!plan) {
        plan = await prisma.workoutPlan.create({
          data: {
            userId: uid,
            days: {
              create: WORKOUT_DATA.map((wd, i) => ({
                id: wd.id,
                dayIndex: i,
                title: wd.title,
                subtitle: wd.focus,
                focus: wd.focus,
                exercises: {
                  create: wd.sections.flatMap(s => s.exercises).filter(e => e.trackable !== false).map((ex, j) => ({
                    order: j, exerciseId: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest ?? 60, notes: ex.note ?? null,
                  })),
                },
              })),
            },
          },
        });
      }
      const last = await prisma.planDay.findFirst({ where: { planId: plan.id }, orderBy: { dayIndex: "desc" } });
      const nextIdx = last ? last.dayIndex + 1 : 0;
      const created = await prisma.planDay.create({
        data: {
          planId: plan.id,
          dayIndex: nextIdx,
          title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Day",
          subtitle: typeof body.focus === "string" ? body.focus : "",
          focus: typeof body.focus === "string" ? body.focus : "",
        },
        include: { exercises: true },
      });
      return json({ day: created });
    }

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
      goals: (profile.goals?.length ? profile.goals : [profile.goal]) as Goal[],
      fitnessLevel: profile.fitnessLevel as "newcomer" | "beginner" | "intermediate" | "advanced",
      location: profile.location as Location,
      equipment: profile.equipment as Equipment[],
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      ageYears,
      targetArea: profile.targetArea ?? "none",
      targetAreas: (profile as any).targetAreas ?? [],
      hiitPreference: (profile as any).hiitPreference ?? null,
      hiitIntensity: (profile as any).hiitIntensity ?? null,
      modalities: (profile as any).modalities ?? [],
    };

    const generated = generatePlan(input);

    // Atomic replace: delete + create in a single transaction so the user
    // never ends up with no plan if the create errors.
    const plan = await prisma.$transaction(async tx => {
      await tx.workoutPlan.deleteMany({ where: { userId: uid } });
      return tx.workoutPlan.create({
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
                  kind: (ex as any).kind === "warmup" || (ex as any).kind === "cooldown" ? (ex as any).kind : "main",
                })),
              },
            })),
          },
        },
        include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
      });
    });

    return json({ plan, planNote: generated.planNote });
  } catch (e) {
    console.error("Plan error:", e);
    return json({ error: "Failed" }, 500);
  }
}

// ── Revert to default (delete custom plan) ────────────────────────────────
export async function DELETE(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  await prisma.workoutPlan.deleteMany({ where: { userId: uid } });
  return json({ ok: true });
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
        groupId: ex.groupId ?? null,
        groupType: ex.groupType ?? null,
        dropSets: ex.dropSets ?? 0,
        dropSet: ex.dropSet === true,
        kind: ex.kind === "warmup" || ex.kind === "cooldown" ? ex.kind : "main",
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
