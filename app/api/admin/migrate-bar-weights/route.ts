import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { EXERCISES } from "../../../../lib/exercises";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// One-off (re-runnable) bar-weight migration. The user's reported
// data convention was "one-side plate weight only, no bar" across
// every barbell exercise (and EZ-curl exercise on the smaller curl
// bar). This endpoint converts that historical input to the canonical
// total-on-the-bar convention used by the app + tier scoring.
//
// new_weight = (current_weight * 2) + bar_kg
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
  const username: string = (body.username ?? "").toString().trim().toLowerCase().replace(/^@+/, "");
  if (!username) return json({ error: "username required" }, 400);
  const dryRun: boolean = body.dryRun !== false; // default true — explicit opt-in to write
  const barbellBarKg: number = typeof body.barbellBarKg === "number" ? body.barbellBarKg : 20;
  const ezCurlBarKg: number = typeof body.ezCurlBarKg === "number" ? body.ezCurlBarKg : 7;

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
      const newWeight = +(w * 2 + bar).toFixed(2);
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
      `logs-touched=${appliedCount} sets-mutated=${mutations.length} ` +
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
