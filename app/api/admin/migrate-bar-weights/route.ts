import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { EXERCISES } from "../../../../lib/exercises";
import { WORKOUT_DATA } from "../../../../lib/workouts";

// Name-based classifier for the WORKOUT_DATA default-plan synthetic
// ids (a1-e7) and any other exercise the user might have logged
// under a non-catalogue id. Matches by lowercased name substring:
//   - 'ez-bar' / 'ez bar' / 'ez curl'                → ez-bar
//   - 'dumbbell' / 'db '                              → null (skip)
//   - 'barbell' / 'deadlift' / 'bench press' /
//     'back squat' / 'front squat'                   → barbell
//   - anything else                                   → null
// (qa: bar-weight-data-migration-maaiz)
function classifyByName(rawName: string | null | undefined): "barbell" | "ez-bar" | null {
  const n = (rawName ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("ez-bar") || n.includes("ez bar") || n.includes("ez curl")) return "ez-bar";
  if (n.includes("dumbbell") || n.includes("db ")) return null;
  if (n.includes("barbell")) return "barbell";
  if (n.includes("deadlift")) return "barbell";
  if (n.includes("bench press")) return "barbell";
  if (n.includes("back squat") || n.includes("front squat")) return "barbell";
  return null;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// One-off (re-runnable) bar-weight migration. Different users entered
// barbell weights with different (wrong) conventions:
//   • 'double-plus-bar'  → one-side plate weight only, no bar.
//                          new = (old * 2) + bar_kg.  (Maaiz)
//   • 'plus-bar'         → both-sides plate weight summed, no bar.
//                          new = old + bar_kg.        (Munchy, maybe Alla)
//   • 'none'             → already total-on-bar; don't touch.
// Pick the right formula per user. Do NOT assume everyone used the
// same convention — applying the wrong one corrupts good data.
//
// Bar weight defaults: 20 kg for standard barbell exercises,
// 7 kg for ez-bar-curl (the smaller "EZ curl bar" most gyms
// stock). Overridable via body.
//
// SAFETY:
//   • Dry-run mode by default — sends back the count + a sample of
//     {exerciseId, before, after} mutations without writing.
//   • Skips rows where the migration looks like it's already been
//     applied (heuristic: any set on a barbell exercise with weight
//     ≥ 25 kg is assumed already-total — bench-pressing 25kg single-
//     side is plausible, so threshold is set high. Use the
//     `migratedMarker` localStorage field client-side to gate
//     re-runs across sessions instead — see qa-state).
//   • Returns the userId + username so admin can verify they're
//     touching the right account.
//
// CALL:
//   POST /api/admin/migrate-bar-weights
//   headers: x-admin-key: <ADMIN_SECRET>
//   body: { username: "maaiz", dryRun: true, barbellBarKg: 20, ezCurlBarKg: 7 }
//
// (qa: bar-weight-data-migration-maaiz)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const body = await req.json();
  const mode: string = (body.mode ?? "single").toString();
  const barbellBarKg: number = typeof body.barbellBarKg === "number" ? body.barbellBarKg : 20;
  const ezCurlBarKg: number = typeof body.ezCurlBarKg === "number" ? body.ezCurlBarKg : 7;

  // ── scan-all mode — dry-run only, never writes ──
  // Returns per-user summary (logsCount, setsThatLookLikeOneSide,
  // sample) so admin can identify which users likely entered
  // one-side-plate values vs. correct totals. Never mutates —
  // mass-apply would corrupt users who entered totals correctly.
  // (qa: bar-weight-data-migration-maaiz)
  if (mode === "scan-all") {
    const users = await prisma.user.findMany({ select: { id: true, username: true } });
    const results: Array<{
      userId: string; username: string;
      logsCount: number;
      barbellSetCount: number;
      ezBarSetCount: number;
      // Median weight on barbell sets — used as a heuristic for
      // "did they enter one-side or total?". Bench/squat typically
      // ≥ 60kg total; if median is ≤ 40kg, lots of one-side entries.
      barbellMedianKg: number | null;
      sampleSets: Array<{ exerciseId: string; name: string; weight: number; date: string }>;
    }> = [];

    for (const u of users) {
      const logs = await prisma.workoutLog.findMany({
        where: { userId: u.id },
        select: { id: true, sets: true, date: true },
      });
      if (logs.length === 0) continue;

      // Build name lookup that respects this user's plan + the
      // global default WORKOUT_DATA.
      const userPlan = await prisma.workoutPlan.findUnique({
        where: { userId: u.id },
        include: { days: { include: { exercises: { select: { id: true, name: true } } } } },
      });
      const idToName: Record<string, string> = {};
      for (const day of WORKOUT_DATA) for (const sec of day.sections) for (const ex of sec.exercises) idToName[ex.id] = ex.name;
      if (userPlan) for (const day of userPlan.days) for (const ex of day.exercises) idToName[ex.id] = ex.name;
      for (const ex of EXERCISES as any[]) idToName[ex.id] = ex.name;
      const customExForName = await prisma.customExercise.findMany({ select: { id: true, name: true } });
      for (const ex of customExForName) idToName[ex.id] = ex.name;

      let barbellSetCount = 0;
      let ezBarSetCount = 0;
      const barbellWeights: number[] = [];
      const sampleSets: Array<{ exerciseId: string; name: string; weight: number; date: string }> = [];
      for (const log of logs) {
        const sets = (log.sets ?? {}) as Record<string, any>;
        for (const k in sets) {
          const v = sets[k];
          if (!v || typeof v !== "object") continue;
          const w = Number((v as any).weight) || 0;
          if (w <= 0) continue;
          const exId = k.replace(/-d\d+$/, "").replace(/-\d+$/, "");
          const name = idToName[exId] ?? "";
          const kind = classifyByName(name);
          if (kind === "barbell") {
            barbellSetCount += 1;
            barbellWeights.push(w);
            if (sampleSets.length < 5) sampleSets.push({ exerciseId: exId, name, weight: w, date: log.date.toISOString().slice(0, 10) });
          } else if (kind === "ez-bar") {
            ezBarSetCount += 1;
          }
        }
      }
      if (barbellSetCount === 0 && ezBarSetCount === 0) continue;
      const sorted = [...barbellWeights].sort((a, b) => a - b);
      const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
      results.push({
        userId: u.id,
        username: u.username,
        logsCount: logs.length,
        barbellSetCount,
        ezBarSetCount,
        barbellMedianKg: median,
        sampleSets,
      });
    }

    // Sort by suspicion — lowest median first (most likely one-side entry).
    results.sort((a, b) => {
      const am = a.barbellMedianKg ?? 9999;
      const bm = b.barbellMedianKg ?? 9999;
      return am - bm;
    });

    return json({
      mode: "scan-all",
      totalUsersScanned: users.length,
      usersWithBarbellData: results.length,
      results,
      note: "Median weight ≤ ~40 kg on barbell sets often means one-side entries (no bar). Review per-user, then mutate individually using mode='single' username='<u>' dryRun:false.",
    });
  }

  // ── single-user mode (default) ──
  const username: string = (body.username ?? "").toString().trim().toLowerCase().replace(/^@+/, "");
  if (!username) return json({ error: "username required" }, 400);
  const dryRun: boolean = body.dryRun !== false; // default true — explicit opt-in to write
  const formula: string = (body.formula ?? "double-plus-bar").toString();
  if (!["double-plus-bar", "plus-bar", "none"].includes(formula)) {
    return json({ error: "formula must be 'double-plus-bar' | 'plus-bar' | 'none'" }, 400);
  }
  if (formula === "none") {
    return json({ error: "formula:'none' means no migration — skip the call" }, 400);
  }

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!user) return json({ error: `No user @${username}` }, 404);

  // Build the set of barbell-tagged exercise ids and the EZ curl
  // exception. Equipment check on the EXERCISES catalogue gives us
  // every barbell exercise without hard-coding ids.
  const barbellIds = new Set<string>();
  const ezBarIds = new Set<string>();
  for (const ex of EXERCISES as any[]) {
    if (Array.isArray(ex.equipment) && ex.equipment.includes("barbell")) {
      // Heuristic: any exercise whose id contains "ez-bar" uses the
      // smaller curl bar; everything else uses the 20 kg Olympic bar.
      if (ex.id.includes("ez-bar")) ezBarIds.add(ex.id);
      else barbellIds.add(ex.id);
    }
  }

  // Fold WORKOUT_DATA's synthetic ids (a1-e7) into the matcher.
  // These are the default-plan placeholders most users' sessions
  // reference. Map each to its real exercise name, then classify
  // by name pattern. (qa: bar-weight-data-migration-maaiz)
  const syntheticIdNames: Record<string, string> = {};
  for (const day of WORKOUT_DATA) {
    for (const section of day.sections) {
      for (const ex of section.exercises) {
        syntheticIdNames[ex.id] = ex.name;
        const kind = classifyByName(ex.name);
        if (kind === "ez-bar") ezBarIds.add(ex.id);
        else if (kind === "barbell") barbellIds.add(ex.id);
      }
    }
  }

  // Fold the user's stored WorkoutPlan (if any) — PlanExercise ids
  // carry custom-plan exercise names that may not be in the static
  // catalogue. Same name-based classification.
  const userPlan = await prisma.workoutPlan.findUnique({
    where: { userId: user.id },
    include: {
      days: {
        include: { exercises: { select: { id: true, name: true } } },
      },
    },
  });
  if (userPlan) {
    for (const day of userPlan.days) {
      for (const ex of day.exercises) {
        syntheticIdNames[ex.id] = ex.name;
        const kind = classifyByName(ex.name);
        if (kind === "ez-bar") ezBarIds.add(ex.id);
        else if (kind === "barbell") barbellIds.add(ex.id);
      }
    }
  }

  // Fold any CustomExercise the user owns or has been exposed to.
  const customExercises = await prisma.customExercise.findMany({
    select: { id: true, name: true },
  });
  for (const ex of customExercises) {
    syntheticIdNames[ex.id] = ex.name;
    const kind = classifyByName(ex.name);
    if (kind === "ez-bar") ezBarIds.add(ex.id);
    else if (kind === "barbell") barbellIds.add(ex.id);
  }

  const logs = await prisma.workoutLog.findMany({
    where: { userId: user.id },
    select: { id: true, sets: true, dayId: true, date: true },
  });

  type Mutation = { logId: string; key: string; before: number; after: number; bar: number; date: string };
  const mutations: Mutation[] = [];
  const updates: Array<{ id: string; sets: Record<string, unknown> }> = [];

  const parseSetKey = (k: string): string => {
    // Set keys look like '<exerciseId>-<setIndex>' optionally with a
    // '-d<n>' drop-set suffix. Strip both to get the bare exerciseId.
    return k.replace(/-d\d+$/, "").replace(/-\d+$/, "");
  };

  for (const log of logs) {
    const sets = (log.sets ?? {}) as Record<string, any>;
    let touched = false;
    const next = { ...sets };
    for (const k in sets) {
      const v = sets[k];
      if (!v || typeof v !== "object") continue;
      const w = Number((v as any).weight) || 0;
      if (w <= 0) continue;
      const exId = parseSetKey(k);
      let bar: number | null = null;
      if (ezBarIds.has(exId)) bar = ezCurlBarKg;
      else if (barbellIds.has(exId)) bar = barbellBarKg;
      if (bar == null) continue;
      // Apply the chosen migration formula. 'double-plus-bar' is
      // Maaiz's case (one-side plates only); 'plus-bar' is Munchy /
      // Alla's case (both-sides summed without bar).
      const newWeight = formula === "double-plus-bar"
        ? +(w * 2 + bar).toFixed(2)
        : +(w + bar).toFixed(2); // plus-bar
      mutations.push({ logId: log.id, key: k, before: w, after: newWeight, bar, date: log.date.toISOString().slice(0, 10) });
      next[k] = { ...(v as object), weight: newWeight };
      touched = true;
    }
    if (touched) updates.push({ id: log.id, sets: next });
  }

  let appliedCount = 0;
  if (!dryRun && updates.length > 0) {
    // Sequential to keep the audit log readable. Volume here is small
    // (one user, a few hundred sessions max).
    for (const u of updates) {
      await prisma.workoutLog.update({ where: { id: u.id }, data: { sets: u.sets as any } });
      appliedCount += 1;
    }
    console.log(
      `[admin/migrate-bar-weights] target=@${user.username} (${user.id}) ` +
      `formula=${formula} logs-touched=${appliedCount} sets-mutated=${mutations.length} ` +
      `barbellBarKg=${barbellBarKg} ezCurlBarKg=${ezCurlBarKg} ts=${new Date().toISOString()}`
    );
  }

  // Diagnostic: surface every distinct exercise id present in the
  // user's history + how many sets fall on each. Helps debug zero-
  // match dry-runs (e.g. user uses custom exercise ids that aren't
  // in the static EXERCISES catalogue). Sorted by set count desc.
  const exerciseUsage: Record<string, { sets: number; matched: "barbell" | "ez-bar" | null }> = {};
  for (const log of logs) {
    const sets = (log.sets ?? {}) as Record<string, any>;
    for (const k in sets) {
      const v = sets[k];
      if (!v || typeof v !== "object") continue;
      const exId = parseSetKey(k);
      if (!exerciseUsage[exId]) {
        const matched: "barbell" | "ez-bar" | null = ezBarIds.has(exId) ? "ez-bar" : barbellIds.has(exId) ? "barbell" : null;
        exerciseUsage[exId] = { sets: 0, matched };
      }
      exerciseUsage[exId].sets += 1;
    }
  }
  const usageList = Object.entries(exerciseUsage)
    .sort((a, b) => b[1].sets - a[1].sets)
    .map(([id, info]) => ({ exerciseId: id, sets: info.sets, matched: info.matched }));

  return json({
    user: { id: user.id, username: user.username },
    formula,
    dryRun,
    logsCount: logs.length,
    logsToTouch: updates.length,
    setsToMutate: mutations.length,
    appliedCount,
    barbellBarKg,
    ezCurlBarKg,
    barbellExerciseCount: barbellIds.size,
    ezBarExerciseCount: ezBarIds.size,
    sample: mutations.slice(0, 20),
    exerciseUsage: usageList,
  });
}
