import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { generatePlan, UserProfileInput } from "../../../../../../lib/planGenerator";
import { Equipment, Location, Goal } from "../../../../../../lib/exercises";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

const LEVEL_BUMP: Record<string, string> = {
  newcomer: "beginner",
  beginner: "intermediate",
  intermediate: "advanced",
  advanced: "advanced",
};

function boostPlan(days: ReturnType<typeof generatePlan>["days"]) {
  return days.map(day => ({
    ...day,
    exercises: day.exercises.map(ex => {
      const isCompound = (ex as any).type === "compound";
      const maxSets = isCompound ? 6 : 4;
      return { ...ex, sets: Math.min(ex.sets + 1, maxSets) };
    }),
  }));
}

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Forbidden" }, 403);

    const rel = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!rel) return json({ error: "Not your client" }, 403);

    const profile = await prisma.userProfile.findUnique({ where: { userId: params.clientId } });
    if (!profile) return json({ error: "Client has no profile yet" }, 400);

    const dob = profile.dob ? new Date(profile.dob) : null;
    const ageYears = dob
      ? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : 28;

    const baseLevel = (profile.fitnessLevel ?? "beginner") as string;
    const boostedLevel = LEVEL_BUMP[baseLevel] ?? baseLevel;

    const input: UserProfileInput = {
      daysPerWeek: profile.daysPerWeek,
      goals: (profile.goals?.length ? profile.goals : [profile.goal]) as Goal[],
      fitnessLevel: boostedLevel as UserProfileInput["fitnessLevel"],
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
    };

    const generated = generatePlan(input);
    const boostedDays = boostPlan(generated.days);

    return json({
      days: boostedDays.map((day, i) => ({
        id: `trainer-gen-${i}`,
        dayIndex: i,
        title: day.title,
        subtitle: day.subtitle,
        focus: day.focus,
        exercises: day.exercises.map((ex, j) => ({
          id: `tge-${i}-${j}`,
          order: j,
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          notes: ex.notes ?? null,
        })),
      })),
      planNote: generated.planNote,
    });
  } catch (e: any) {
    console.error("Trainer generate-plan error:", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
