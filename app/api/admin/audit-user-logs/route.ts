import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { EXERCISES, inferEquipmentFromName } from "../../../../lib/exercises";
import { WORKOUT_DATA } from "../../../../lib/workouts";
import { loadingKindFor } from "../../../../lib/plates";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// Per-set audit endpoint for fixing miscoded weights.
//
// Built for the alla'a case (qa: user-log-audit-allaa):
//   • Switched mid-history from one-side notation to both-sides
//     notation, never including the bar.
//   • Logged some cable/machine sets in LBs by accident.
//
// migrate-bar-weights already handles bulk single-formula bar-weight
// corrections, but a user who oscillated between conventions needs
// PER-SET review. This endpoint returns every barbell/EZ-bar/cable/
// machine set with proposed corrections, then accepts an explicit
// {logId, key, newWeight} array to apply. Nothing is auto-applied —
// the admin chooses which corrections to accept per row.
//
// CALL (audit):
//   POST /api/admin/audit-user-logs
//   headers: x-admin-key: <ADMIN_SECRET>
//   body: { username: "alla", mode: "audit", barKg: 15, ezBarKg: 10 }
//
// CALL (apply):
//   POST /api/admin/audit-user-logs
//   headers: x-admin-key: <ADMIN_SECRET>
//   body: { mode: "apply", corrections: [{logId, key, newWeight, reason}] }
//
// (qa: user-log-audit-allaa)

type SetProposal = {
  label: string;
  formula: string;
  newWeight: number;
};

type SetEntry = {
  logId: string;
  key: string;
  date: string;
  weight: number;
  reps: number;
  category: "ok" | "suspect-one-side" | "suspect-no-bar" | "suspect-lb" | "ambiguous";
  proposals: SetProposal[];
};

type ExerciseGroup = {
  exerciseId: string;
  name: string;
  kind: string;
  setCount: number;
  sets: SetEntry[];
};

const LB_TO_KG = 0.453592;

// Classify suspect barbell weights based on raw value ranges.
//   • ≤ 20kg on a barbell move (bench / squat / deadlift): could be
//     one-side plates only (e.g. 10kg per side = 35kg total + 15kg
//     bar), OR a brand-new lifter just lifting the bar. Flag for
//     review.
//   • 20-50kg: most likely both-sides without bar (e.g. 20+20 plates
//     = 40kg of plates, no bar). Could also be legitimately-light
//     real total. Flag.
//   • > 60kg: probably already a clean total including bar. Mark ok
//     but still surface proposals so admin can override.
function classifyBarbellSet(weight: number): "suspect-one-side" | "suspect-no-bar" | "ok" | "ambiguous" {
  if (weight <= 0) return "ambiguous";
  if (weight <= 25) return "suspect-one-side";
  if (weight < 60) return "suspect-no-bar";
  return "ok";
}

// Heuristic for "this cable/machine entry might be LBs miswritten as
// kg". LB plate stacks typically increment by 5-10 LBs (5, 10, 15,
// 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120,
// 130, 140, 150, 160, 170, 200). KG stacks usually go 5, 7.5, 10,
// 12.5, 15, 17.5, 20, 22.5, 25, etc. So values that are multiples
// of 5 AND not in the typical KG-stack progression are LB-suspects.
//
//   • 35, 45, 55, 65, 75, 85, 95, 105, 115, 125 → strong LB markers
//     (no 35kg or 45kg plate-stack increments exist on metric machines).
//   • Even multiples of 10 above 30 → moderate suspect (could be
//     either a 40kg metric or 40lb / 18kg).
//   • Anything under 25 with .5 / .25 increments → probably real kg.
function classifyCableMachineSet(weight: number): "suspect-lb" | "ok" | "ambiguous" {
  if (weight <= 0) return "ambiguous";
  // Strong LB indicators — exact LB-stack values that have no metric
  // equivalent.
  const lbExact = [35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195];
  if (lbExact.includes(weight)) return "suspect-lb";
  // Round multiples of 5 above 30 that look more LB than kg
  // (multiples of 10 above 80 are very unlikely as kg on cables).
  if (weight >= 80 && weight % 5 === 0) return "suspect-lb";
  // Sub-25 with fractional kg values → looks like real kg
  if (weight < 25 && weight % 1 !== 0) return "ok";
  return "ambiguous";
}

function parseSetKey(k: string): string {
  return k.replace(/-d\d+$/, "").replace(/-\d+$/, "");
}

// Resolve an exerciseId to {name, kind} using catalog + WORKOUT_DATA
// + user plan + custom exercises + name-inference fallback. Same
// chain as the workout-log UI uses, so the audit classification
// matches what the user sees in-app.
function buildClassifier(idToName: Record<string, string>) {
  return (exId: string): { name: string; kind: string } => {
    const name = idToName[exId] ?? exId;
    // Prefer the catalog entry's equipment when available, otherwise
    // infer from name.
    const catalog = (EXERCISES as any[]).find((e: any) => e.id === exId);
    const equipment: string[] = (catalog?.equipment?.length ? catalog.equipment : inferEquipmentFromName(name)) ?? [];
    let kind = loadingKindFor(equipment);
    // Tag ez-bar separately so the audit can apply the smaller bar.
    if (equipment.includes("ez-bar")) kind = "ez-bar" as any;
    return { name, kind };
  };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode: string = (body.mode ?? "audit").toString();
  const barKg: number = typeof body.barKg === "number" ? body.barKg : 15;
  const ezBarKg: number = typeof body.ezBarKg === "number" ? body.ezBarKg : 10;

  // ── APPLY ────────────────────────────────────────────────────────
  if (mode === "apply") {
    const corrections: Array<{ logId: string; key: string; newWeight: number; reason?: string }> = Array.isArray(body.corrections) ? body.corrections : [];
    if (corrections.length === 0) return json({ error: "corrections array required" }, 400);
    if (corrections.length > 500) return json({ error: "too many corrections in one call (max 500)" }, 400);

    // Group corrections by logId so we read each WorkoutLog once.
    const byLog = new Map<string, Array<{ key: string; newWeight: number; reason?: string }>>();
    for (const c of corrections) {
      if (!c.logId || !c.key || !Number.isFinite(c.newWeight) || c.newWeight < 0) continue;
      const arr = byLog.get(c.logId) ?? [];
      arr.push({ key: c.key, newWeight: Math.round(c.newWeight * 100) / 100, reason: c.reason });
      byLog.set(c.logId, arr);
    }

    const audit: Array<{ logId: string; key: string; before: number; after: number; reason?: string }> = [];
    let appliedSets = 0;
    let touchedLogs = 0;
    for (const [logId, edits] of Array.from(byLog.entries())) {
      const log = await prisma.workoutLog.findUnique({ where: { id: logId }, select: { id: true, sets: true } });
      if (!log) continue;
      const sets = { ...((log.sets ?? {}) as Record<string, any>) };
      let touched = false;
      for (const e of edits) {
        const cur = sets[e.key];
        if (!cur || typeof cur !== "object") continue;
        const before = Number(cur.weight) || 0;
        sets[e.key] = { ...cur, weight: e.newWeight };
        audit.push({ logId, key: e.key, before, after: e.newWeight, reason: e.reason });
        appliedSets++;
        touched = true;
      }
      if (touched) {
        await prisma.workoutLog.update({ where: { id: logId }, data: { sets: sets as any } });
        touchedLogs++;
      }
    }
    console.log(`[admin/audit-user-logs APPLY] touched-logs=${touchedLogs} sets=${appliedSets} ts=${new Date().toISOString()}`);
    return json({ mode: "apply", touchedLogs, appliedSets, audit });
  }

  // ── AUDIT (default) ──────────────────────────────────────────────
  const username: string = (body.username ?? "").toString().trim().toLowerCase().replace(/^@+/, "");
  if (!username) return json({ error: "username required for audit mode" }, 400);

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true, createdAt: true },
  });
  if (!user) return json({ error: `No user @${username}` }, 404);

  // Build the id → name resolver. Same chain as migrate-bar-weights:
  // WORKOUT_DATA defaults, user's WorkoutPlan, EXERCISES catalog,
  // all CustomExercises.
  const idToName: Record<string, string> = {};
  for (const day of WORKOUT_DATA) for (const sec of day.sections) for (const ex of sec.exercises) idToName[ex.id] = ex.name;
  const userPlan = await prisma.workoutPlan.findUnique({
    where: { userId: user.id },
    include: { days: { include: { exercises: { select: { id: true, name: true } } } } },
  });
  if (userPlan) for (const day of userPlan.days) for (const ex of day.exercises) idToName[ex.id] = ex.name;
  for (const ex of EXERCISES as any[]) idToName[ex.id] = ex.name;
  const customEx = await prisma.customExercise.findMany({ select: { id: true, name: true } });
  for (const ex of customEx) idToName[ex.id] = ex.name;

  const classify = buildClassifier(idToName);

  const logs = await prisma.workoutLog.findMany({
    where: { userId: user.id },
    select: { id: true, date: true, dayId: true, sets: true },
    orderBy: { date: "asc" },
  });

  // Group sets by exercise id so the admin can review one movement
  // at a time. Sets are sorted by date within each group so the
  // chronological progression (which exposes notation shifts) is
  // visible at a glance.
  const groups = new Map<string, ExerciseGroup>();
  let totalSets = 0;
  for (const log of logs) {
    const sets = (log.sets ?? {}) as Record<string, any>;
    for (const k in sets) {
      const v = sets[k];
      if (!v || typeof v !== "object") continue;
      const weight = Number((v as any).weight) || 0;
      const reps = Number((v as any).reps) || 0;
      const exId = parseSetKey(k);
      const { name, kind } = classify(exId);
      totalSets++;
      // Skip exercises we don't have any correction strategy for.
      if (kind !== "barbell" && kind !== "ez-bar" && kind !== "machine" && kind !== "cable") continue;

      let category: SetEntry["category"] = "ok";
      const proposals: SetProposal[] = [];

      if (kind === "barbell" || kind === "ez-bar") {
        category = classifyBarbellSet(weight);
        const bar = kind === "ez-bar" ? ezBarKg : barKg;
        // Always offer all three reinterpretations so admin can
        // pick — heuristic category is just a sort hint.
        proposals.push({ label: `One-side plates → both sides + ${bar}kg bar`, formula: "double-plus-bar", newWeight: +(weight * 2 + bar).toFixed(2) });
        proposals.push({ label: `Both sides (no bar) → add ${bar}kg bar`, formula: "plus-bar", newWeight: +(weight + bar).toFixed(2) });
        proposals.push({ label: "Leave as-is", formula: "noop", newWeight: weight });
      } else if (kind === "cable" || kind === "machine") {
        category = classifyCableMachineSet(weight);
        proposals.push({ label: "Convert LBs → kg (÷ 2.205)", formula: "lb-to-kg", newWeight: +(weight * LB_TO_KG).toFixed(2) });
        proposals.push({ label: "Leave as-is", formula: "noop", newWeight: weight });
      }

      let group = groups.get(exId);
      if (!group) {
        group = { exerciseId: exId, name, kind: kind as string, setCount: 0, sets: [] };
        groups.set(exId, group);
      }
      group.setCount++;
      group.sets.push({
        logId: log.id,
        key: k,
        date: log.date.toISOString().slice(0, 10),
        weight,
        reps,
        category,
        proposals,
      });
    }
  }

  const perExercise: ExerciseGroup[] = Array.from(groups.values())
    .sort((a, b) => {
      // Barbell/ez-bar first (highest blast-radius), then cable/machine.
      const order: Record<string, number> = { barbell: 0, "ez-bar": 1, cable: 2, machine: 3 };
      return (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.name.localeCompare(b.name);
    });

  // Per-category summary so admin can see at a glance what's likely
  // suspect before diving into the per-set list.
  const summary = {
    suspectOneSide: 0,
    suspectNoBar: 0,
    suspectLb: 0,
    barbellSets: 0,
    ezBarSets: 0,
    cableSets: 0,
    machineSets: 0,
  };
  for (const g of perExercise) {
    for (const s of g.sets) {
      if (s.category === "suspect-one-side") summary.suspectOneSide++;
      if (s.category === "suspect-no-bar") summary.suspectNoBar++;
      if (s.category === "suspect-lb") summary.suspectLb++;
      if (g.kind === "barbell") summary.barbellSets++;
      if (g.kind === "ez-bar") summary.ezBarSets++;
      if (g.kind === "cable") summary.cableSets++;
      if (g.kind === "machine") summary.machineSets++;
    }
  }

  return json({
    mode: "audit",
    user: { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() },
    barKg,
    ezBarKg,
    totalLogs: logs.length,
    totalSets,
    summary,
    perExercise,
  });
}
