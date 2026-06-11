import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { safeFloat } from "../../../lib/num";

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
    const { targetWeightKg, targetBodyFatPct, hiitPreference, hiitIntensity, cardioPreference, targetSessionMinutes, tierTheme, hideFromGlobalLeaderboard } = await req.json();
    const profile = await prisma.userProfile.update({
      where: { userId: uid },
      data: {
        // safeFloat → invalid input clears the goal (null) instead of
        // storing NaN, which would break goal-reached detection. (qa: numeric-nan-guards)
        targetWeightKg:   targetWeightKg   !== undefined ? safeFloat(targetWeightKg)   : undefined,
        targetBodyFatPct: targetBodyFatPct !== undefined ? safeFloat(targetBodyFatPct) : undefined,
        hiitPreference:   hiitPreference   !== undefined ? hiitPreference   : undefined,
        hiitIntensity:    hiitIntensity    !== undefined ? hiitIntensity    : undefined,
        cardioPreference: cardioPreference !== undefined ? cardioPreference : undefined,
        targetSessionMinutes: targetSessionMinutes !== undefined ? (Number(targetSessionMinutes) || null) : undefined,
        // Whitelist tierTheme to known values so a stray patch can't
        // store junk that breaks `getAthleteTiers`. (qa: tier-themes)
        tierTheme:        tierTheme        !== undefined ? (tierTheme === "simple" ? "simple" : tierTheme === "vivid" ? "vivid" : null) : undefined,
        hideFromGlobalLeaderboard: hideFromGlobalLeaderboard !== undefined ? !!hideFromGlobalLeaderboard : undefined,
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
    const { dob, gender, heightCm, weightKg, bodyFatPct, goals, fitnessLevel, location, equipment, equipmentHome, equipmentGym, daysPerWeek, targetArea, targetAreas, modalities, targetSessionMinutes, cardioPreference } = body;

    // Support both goals[] (new) and goal string (legacy)
    const goalsArr: string[] = Array.isArray(goals) && goals.length > 0 ? goals : body.goal ? [body.goal] : [];
    const primaryGoal = goalsArr[0] ?? "muscle";

    if (!dob || !gender || !heightCm || !weightKg || goalsArr.length === 0 || !fitnessLevel || !location || !daysPerWeek)
      return json({ error: "Missing required fields" }, 400);

    // NaN-guard all numeric body stats — required ones must parse to a
    // finite number, optional body fat clears to null. (qa: numeric-nan-guards)
    const newHeightCm = safeFloat(heightCm);
    const newWeightKg = safeFloat(weightKg);
    const newBodyFatPct = safeFloat(bodyFatPct);
    const newDaysPerWeek = parseInt(daysPerWeek);
    if (newHeightCm === null || newWeightKg === null || !Number.isFinite(newDaysPerWeek))
      return json({ error: "Height, weight and days/week must be numbers" }, 400);

    // Check existing values to detect body stat changes
    const existing = await prisma.userProfile.findUnique({ where: { userId: uid } });

    // Gender is locked once set — drives body-composition mission
    // thresholds + (future) gender-specific achievements, so silent
    // flipping mid-arc would corrupt those records. Server rejects
    // mismatches even though the UI also gates the buttons.
    // (qa: mission-unlock-abs)
    if (existing && existing.gender && existing.gender !== gender) {
      return json({ error: "Gender is locked once set — contact support to change." }, 400);
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        dob: new Date(dob),
        gender,
        heightCm: newHeightCm,
        weightKg: newWeightKg,
        bodyFatPct: newBodyFatPct,
        goal: primaryGoal,
        goals: goalsArr,
        fitnessLevel,
        location,
        equipment: equipment || [],
        ...(equipmentHome !== undefined && { equipmentHome: equipmentHome || [] } as any),
        ...(equipmentGym !== undefined && { equipmentGym: equipmentGym || [] } as any),
        daysPerWeek: newDaysPerWeek,
        targetArea: targetArea || "none",
        ...((targetAreas !== undefined) && { targetAreas: targetAreas || [] } as any),
        ...((modalities !== undefined) && { modalities: Array.isArray(modalities) ? modalities : [] } as any),
        ...((targetSessionMinutes !== undefined) && { targetSessionMinutes: Number(targetSessionMinutes) || null } as any),
        ...((cardioPreference !== undefined) && { cardioPreference: cardioPreference || null } as any),
      },
      update: {
        heightCm: newHeightCm,
        weightKg: newWeightKg,
        bodyFatPct: newBodyFatPct,
        goal: primaryGoal,
        goals: goalsArr,
        fitnessLevel,
        location,
        equipment: equipment || [],
        ...(equipmentHome !== undefined && { equipmentHome: equipmentHome || [] } as any),
        ...(equipmentGym !== undefined && { equipmentGym: equipmentGym || [] } as any),
        daysPerWeek: newDaysPerWeek,
        targetArea: targetArea || "none",
        ...((targetAreas !== undefined) && { targetAreas: targetAreas || [] } as any),
        ...((modalities !== undefined) && { modalities: Array.isArray(modalities) ? modalities : [] } as any),
        ...((targetSessionMinutes !== undefined) && { targetSessionMinutes: Number(targetSessionMinutes) || null } as any),
        ...((cardioPreference !== undefined) && { cardioPreference: cardioPreference || null } as any),
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
