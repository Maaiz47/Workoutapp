// Test-user generator — synthetic users with varied behaviour profiles
// so the admin can observe how tiers evolve over time and how client
// data is presented to trainers long-term.
// (qa: test-user-generator)
//
// Lifecycle:
//   • SEED — create the canonical 15 users (13 athletes + 2 trainers
//     with adopted rosters), backfill each one's training history up
//     to their archetype's "starting age".
//   • TICK — once per day via Vercel cron (and on-demand from the admin
//     UI). For each test user, roll the dice based on archetype to
//     decide whether they train today (and how intensely), whether
//     they log wellness, whether they log a body metric.
//   • ADVANCE — manual "fast forward by N days" admin button. Same
//     logic as TICK but loops backwards (most-recent-day-last).
//   • WIPE — bulk-delete all isTestUser=true rows. Prisma cascades
//     handle related data (WorkoutLog, BodyMetric, TrainerClient, etc.).

import { hashPassword } from "./crypto";
import { prisma } from "./prisma";

// Shared password across every test user — listed in the admin UI for
// copy-paste. Not a secret in any meaningful sense; these are test
// accounts on a dev environment.
export const TEST_USER_PASSWORD = "IronlogTest2026!";

// Marker prefix on every test username so they're recognisable in any
// surface (admin tables, leaderboards if the toggle is on, group
// memberships, etc.).
export const TEST_USERNAME_PREFIX = "test_";

// Archetypes — keep each one small + named so the admin can scan the
// roster at a glance. Numbers are tuned for "see meaningful variance
// over 30 days" not "be realistic across years".
export type TestArchetype = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  // How many days of history to backfill at seed time. Older history
  // means tier dimensions like Mastery / Volume have signal from day 1
  // instead of needing weeks of cron ticks.
  backfillDays: number;
  // 0-1 probability of training on any given day during their "active"
  // window. Multiply by ~7 to get expected sessions/week.
  dailyTrainProb: number;
  // 0-1 probability of logging wellness (hydration + sleep + energy)
  // alongside a training day.
  wellnessProb: number;
  // 0-1 probability of logging a body metric (weight + BF) on a given
  // training day. Most users log weekly-ish.
  bodyMetricProb: number;
  // Average RPE per logged set. Higher = more intense training,
  // boosts the IP RPE bonus AND e1RM if reps stay constant.
  avgRpe: number;
  // Strength progression rate per week — multiplier applied to working
  // weights. 1.005 = +0.5% per week (slow), 1.015 = +1.5% per week
  // (fast initial gains, beginner-style).
  weeklyStrengthMult: number;
  // Daily probability of supersetting / drop-setting a working set.
  techniqueProb: number;
  // If set, the archetype goes inactive after this many days from
  // their seed date — simulates a quitter. Activity drops to 0 past
  // that point.
  quitAfterDays?: number;
  // Profile defaults — feed onboarding fields so the user has a
  // believable starting state.
  profile: {
    daysPerWeek: number;
    gender: "male" | "female";
    heightCm: number;
    startWeightKg: number;
    startBodyFatPct: number | null;
    fitnessLevel: "beginner" | "intermediate" | "advanced";
    goal: string;
  };
};

export const ARCHETYPES: TestArchetype[] = [
  {
    id: "completionist",
    label: "The Completionist",
    emoji: "💯",
    description: "Logs everything — workouts, wellness, body comp, supersets, RPE. High tier ceiling.",
    backfillDays: 180,
    dailyTrainProb: 0.72,   // ~5/week target
    wellnessProb: 0.85,
    bodyMetricProb: 0.18,    // ~weekly
    avgRpe: 8.2,
    weeklyStrengthMult: 1.008,
    techniqueProb: 0.35,
    profile: { daysPerWeek: 5, gender: "male", heightCm: 178, startWeightKg: 78, startBodyFatPct: 16, fitnessLevel: "intermediate", goal: "muscle" },
  },
  {
    id: "completionist_f",
    label: "The Completionist (♀)",
    emoji: "💯",
    description: "Female counterpart — tests sex-aware Body Comp curve.",
    backfillDays: 150,
    dailyTrainProb: 0.65,
    wellnessProb: 0.8,
    bodyMetricProb: 0.20,
    avgRpe: 8.0,
    weeklyStrengthMult: 1.007,
    techniqueProb: 0.30,
    profile: { daysPerWeek: 4, gender: "female", heightCm: 165, startWeightKg: 60, startBodyFatPct: 24, fitnessLevel: "intermediate", goal: "muscle" },
  },
  {
    id: "grinder",
    label: "The Workout-Only Grinder",
    emoji: "🏋️",
    description: "Lifts hard, never logs wellness or body comp. Tests hasData weighting.",
    backfillDays: 100,
    dailyTrainProb: 0.6,
    wellnessProb: 0,
    bodyMetricProb: 0,
    avgRpe: 8.5,
    weeklyStrengthMult: 1.01,
    techniqueProb: 0.5,
    profile: { daysPerWeek: 4, gender: "male", heightCm: 182, startWeightKg: 85, startBodyFatPct: 18, fitnessLevel: "intermediate", goal: "strength" },
  },
  {
    id: "inconsistent",
    label: "The Inconsistent",
    emoji: "🌪️",
    description: "Skips 2-3 weeks at a time, comes back. Tests adherence + weekly streak decay.",
    backfillDays: 90,
    dailyTrainProb: 0.28,   // ~2/week effective
    wellnessProb: 0.3,
    bodyMetricProb: 0.05,
    avgRpe: 7.0,
    weeklyStrengthMult: 1.002,
    techniqueProb: 0.1,
    profile: { daysPerWeek: 4, gender: "male", heightCm: 175, startWeightKg: 80, startBodyFatPct: 22, fitnessLevel: "beginner", goal: "general" },
  },
  {
    id: "beginner",
    label: "The Beginner",
    emoji: "🐣",
    description: "Just started. 2-3 weeks of logs. Tests new-user UX (Progression hasData=false).",
    backfillDays: 18,
    dailyTrainProb: 0.5,
    wellnessProb: 0.6,
    bodyMetricProb: 0.15,
    avgRpe: 7.5,
    weeklyStrengthMult: 1.018,    // beginner gains
    techniqueProb: 0.1,
    profile: { daysPerWeek: 3, gender: "female", heightCm: 162, startWeightKg: 65, startBodyFatPct: 28, fitnessLevel: "beginner", goal: "general" },
  },
  {
    id: "veteran",
    label: "The Veteran",
    emoji: "🦏",
    description: "8+ months of history, slow steady gains. Tests e1RM trend reward.",
    backfillDays: 270,
    dailyTrainProb: 0.7,
    wellnessProb: 0.4,
    bodyMetricProb: 0.10,
    avgRpe: 8.7,
    weeklyStrengthMult: 1.004,    // tiny steady progress
    techniqueProb: 0.4,
    profile: { daysPerWeek: 5, gender: "male", heightCm: 180, startWeightKg: 92, startBodyFatPct: 14, fitnessLevel: "advanced", goal: "strength" },
  },
  {
    id: "plateauer",
    label: "The Plateauer",
    emoji: "📏",
    description: "Consistent but no strength gains. Tests 'don't crash maintainers' floor.",
    backfillDays: 150,
    dailyTrainProb: 0.6,
    wellnessProb: 0.3,
    bodyMetricProb: 0.08,
    avgRpe: 7.5,
    weeklyStrengthMult: 1.0,        // flat
    techniqueProb: 0.15,
    profile: { daysPerWeek: 4, gender: "male", heightCm: 174, startWeightKg: 76, startBodyFatPct: 19, fitnessLevel: "intermediate", goal: "muscle" },
  },
  {
    id: "quitter",
    label: "The Quitter",
    emoji: "🏃‍♀️",
    description: "Active 3 months, then nothing for 2 months. Tests decay behaviour.",
    backfillDays: 150,
    dailyTrainProb: 0.55,
    wellnessProb: 0.5,
    bodyMetricProb: 0.10,
    avgRpe: 7.8,
    weeklyStrengthMult: 1.005,
    techniqueProb: 0.2,
    quitAfterDays: 90,
    profile: { daysPerWeek: 4, gender: "female", heightCm: 168, startWeightKg: 70, startBodyFatPct: 26, fitnessLevel: "beginner", goal: "general" },
  },
];

// The seed roster — 13 athletes + 2 trainers. Trainers get rosters
// of 4 each, drawn from the 13 athletes. Some athletes belong to
// BOTH trainers (overlapping rosters), some to neither (so the
// global board still has lone wolves).
type SeedSpec = {
  username: string;
  archetypeId: string;
  isTrainer?: boolean;
  // If trainer: list of athlete usernames they've adopted.
  rosterUsernames?: string[];
};

export const SEED_ROSTER: SeedSpec[] = [
  // Athletes
  { username: "test_completionist_alex",  archetypeId: "completionist" },
  { username: "test_completionist_sam",   archetypeId: "completionist_f" },
  { username: "test_grinder_marcus",      archetypeId: "grinder" },
  { username: "test_grinder_jay",         archetypeId: "grinder" },
  { username: "test_inconsistent_riley",  archetypeId: "inconsistent" },
  { username: "test_inconsistent_dev",    archetypeId: "inconsistent" },
  { username: "test_beginner_lila",       archetypeId: "beginner" },
  { username: "test_beginner_omar",       archetypeId: "beginner" },
  { username: "test_veteran_chen",        archetypeId: "veteran" },
  { username: "test_veteran_priya",       archetypeId: "veteran" },
  { username: "test_plateauer_noah",      archetypeId: "plateauer" },
  { username: "test_plateauer_maya",      archetypeId: "plateauer" },
  { username: "test_quitter_jess",        archetypeId: "quitter" },
  // Trainers — they share an archetype "completionist" so their
  // OWN training history looks credible (Discipline sub-rank rewards).
  // Different rosters so the admin can switch between accounts and see
  // different client mixes.
  {
    username: "test_trainer_morgan",
    archetypeId: "completionist",
    isTrainer: true,
    rosterUsernames: [
      "test_completionist_alex",
      "test_grinder_marcus",
      "test_inconsistent_riley",
      "test_beginner_lila",
    ],
  },
  {
    username: "test_trainer_taylor",
    archetypeId: "veteran",
    isTrainer: true,
    rosterUsernames: [
      "test_completionist_sam",
      "test_veteran_chen",
      "test_plateauer_noah",
      "test_quitter_jess",
    ],
  },
];

export function archetypeById(id: string): TestArchetype | null {
  return ARCHETYPES.find(a => a.id === id) ?? null;
}

// Deterministic PRNG so the same userId+date pair always produces the
// same activity decision. Stops the daily cron from being non-
// idempotent — if it runs twice on the same day, results are the same.
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h |= 0;
    h ^= h >>> 17;
    h ^= h << 5;  h |= 0;
    return (h >>> 0) / 4294967296;
  };
}

// Generate a "sets" JSON blob for a single training session, sized
// against the archetype's intensity. Returns the blob + the
// computed intensityPoints (supersets/dropsets bonus only — RPE is
// stored per-set in the blob and summed at read time).
function buildSession(arch: TestArchetype, dayDateMs: number, weeksSinceStart: number): { sets: Record<string, any>; intensityPoints: number } {
  // Cycle through a small set of canonical exercise IDs so the
  // Mastery filter (≥4 sets in 180d) actually engages.
  const exerciseRotation = [
    "barbell-back-squat",
    "barbell-bench-press",
    "barbell-deadlift",
    "barbell-overhead-press",
    "barbell-bent-row",
    "pull-up",
    "dumbbell-curl",
    "dumbbell-tricep-extension",
  ];
  const r = rng(`${arch.id}-${dayDateMs}-sets`);
  // 3-5 exercises per session depending on daysPerWeek (full body if
  // 3/wk, more focused if 5/wk).
  const exerciseCount = arch.profile.daysPerWeek <= 3 ? 5 : 4;
  const startIdx = Math.floor(r() * exerciseRotation.length);
  const chosen = Array.from({ length: exerciseCount }, (_, i) => exerciseRotation[(startIdx + i) % exerciseRotation.length]);
  const sets: Record<string, any> = {};
  let intensityPoints = 0;
  // Strength progression factor: starts at 1.0, grows by weeklyStrengthMult.
  const strengthFactor = Math.pow(arch.weeklyStrengthMult, Math.max(0, weeksSinceStart));
  for (const eid of chosen) {
    // Working weight scales by archetype + exercise. Cheat sheet:
    // squat starts ~80kg, bench 60kg, deadlift 100kg for the
    // "intermediate male" baseline. Adjust by fitnessLevel.
    const levelMult = arch.profile.fitnessLevel === "beginner" ? 0.55 : arch.profile.fitnessLevel === "advanced" ? 1.25 : 1.0;
    const sexMult = arch.profile.gender === "female" ? 0.75 : 1.0;
    const exerciseBase = eid.includes("deadlift") ? 100 : eid.includes("squat") ? 80 : eid.includes("bench") ? 60 : eid.includes("press") ? 45 : eid.includes("row") ? 55 : eid.includes("pull-up") ? 0 : 18;
    const baseWeight = Math.round(exerciseBase * levelMult * sexMult * strengthFactor / 2.5) * 2.5;
    const setCount = 4;
    for (let i = 1; i <= setCount; i++) {
      const reps = 6 + Math.floor(r() * 5);                       // 6-10 reps
      const rpe = Math.max(5, Math.min(10, Math.round((arch.avgRpe + (r() - 0.5) * 1.5) * 10) / 10));
      sets[`${eid}-${i}`] = { weight: baseWeight, reps, rpe, note: null };
    }
    // Technique probability — superset OR drop set on this exercise.
    if (r() < arch.techniqueProb) {
      const choice = r();
      if (choice < 0.5) {
        intensityPoints += 5;     // matches lib/page.tsx awardIP for supersets
      } else {
        // Drop set chain — add a couple of drop-set rows under the last set.
        const lastSetN = setCount;
        sets[`${eid}-${lastSetN}-d1`] = { weight: Math.round(sets[`${eid}-${lastSetN}`].weight * 0.7 / 2.5) * 2.5, reps: 6 + Math.floor(r() * 4), rpe: 9, note: null };
        sets[`${eid}-${lastSetN}-d2`] = { weight: Math.round(sets[`${eid}-${lastSetN}`].weight * 0.5 / 2.5) * 2.5, reps: 6 + Math.floor(r() * 4), rpe: 10, note: null };
        intensityPoints += 3;     // matches lib/page.tsx awardIP for drop chains
      }
    }
  }
  return { sets, intensityPoints };
}

// Decide whether this archetype trains on a given day. Pure function of
// (archetype, dayDateMs, seedDateMs) — deterministic so repeated calls
// for the same day give the same answer.
export function shouldTrainOn(arch: TestArchetype, dayDateMs: number, seedDateMs: number): boolean {
  const daysSinceSeed = Math.floor((dayDateMs - seedDateMs) / 86400000);
  if (arch.quitAfterDays && daysSinceSeed >= arch.quitAfterDays) return false;
  // "Inconsistent" archetype has blackout periods — every ~20 days, a
  // ~12-day gap.
  if (arch.id === "inconsistent") {
    const cycle = daysSinceSeed % 32;
    if (cycle >= 20) return false;
  }
  const r = rng(`${arch.id}-${dayDateMs}-train`);
  return r() < arch.dailyTrainProb;
}

// Compute the "weeks since seed" for body-weight progression. Use the
// archetype's backfill window as the anchor so a freshly-seeded
// veteran's first backfilled session uses week-0 weights even though
// the calendar date is 270 days ago.
function weeksSinceArchetypeStart(arch: TestArchetype, dayDateMs: number, anchorMs: number): number {
  return (dayDateMs - anchorMs) / (7 * 86400000);
}

// Build one day of activity for a given test user. Returns the
// records to insert (or nothing if the user takes the day off). All
// operations are idempotent at the (userId, date) level — callers
// must check for existing rows before inserting.
export function rollDay(arch: TestArchetype, userId: string, dayDateMs: number, anchorMs: number): {
  workout: { sets: Record<string, any>; intensityPoints: number } | null;
  wellness: { hydration: boolean; sleep: boolean; energy: boolean } | null;
  bodyMetric: { weightKg: number; bodyFatPct: number | null } | null;
} {
  void userId;
  if (!shouldTrainOn(arch, dayDateMs, anchorMs)) {
    return { workout: null, wellness: null, bodyMetric: null };
  }
  const weeks = weeksSinceArchetypeStart(arch, dayDateMs, anchorMs);
  const workout = buildSession(arch, dayDateMs, weeks);
  const r = rng(`${arch.id}-${dayDateMs}-meta`);
  const wellness = r() < arch.wellnessProb
    ? { hydration: true, sleep: true, energy: true }
    : null;
  let bodyMetric: { weightKg: number; bodyFatPct: number | null } | null = null;
  if (r() < arch.bodyMetricProb) {
    // Slow drift around starting weight. Plateauers stay flat; everyone
    // else drifts ~0.5kg/month either way (deterministic noise).
    const driftRng = rng(`${arch.id}-${dayDateMs}-body`);
    const drift = (driftRng() - 0.5) * 4;   // ±2kg total spread
    const trendKg = arch.id === "plateauer" ? 0 : (weeks / 4) * -0.3;  // gentle leaning lean
    const weightKg = Math.round((arch.profile.startWeightKg + trendKg + drift) * 10) / 10;
    const bfTrend = arch.id === "plateauer" ? 0 : (weeks / 4) * -0.2;
    const bf = arch.profile.startBodyFatPct == null ? null : Math.round((arch.profile.startBodyFatPct + bfTrend + (driftRng() - 0.5) * 2) * 10) / 10;
    bodyMetric = { weightKg, bodyFatPct: bf };
  }
  return { workout, wellness, bodyMetric };
}

// ── DB OPERATIONS ──────────────────────────────────────────────────────

export async function seedTestUsers(): Promise<{ created: number; existed: number }> {
  const passwordHash = await hashPassword(TEST_USER_PASSWORD);
  const usernameToId = new Map<string, string>();
  let created = 0;
  let existed = 0;
  // 1. Create users + profiles + minimal workout plans.
  for (const spec of SEED_ROSTER) {
    const arch = archetypeById(spec.archetypeId);
    if (!arch) continue;
    const existing = await prisma.user.findUnique({ where: { username: spec.username } });
    if (existing) {
      usernameToId.set(spec.username, existing.id);
      existed += 1;
      continue;
    }
    const user = await prisma.user.create({
      data: {
        username: spec.username,
        passwordHash,
        role: spec.isTrainer ? "trainer" : "user",
        isTestUser: true,
        testArchetype: spec.archetypeId,
        profile: {
          create: {
            dob: new Date(new Date().getFullYear() - 28, 0, 1),
            gender: arch.profile.gender,
            heightCm: arch.profile.heightCm,
            weightKg: arch.profile.startWeightKg,
            bodyFatPct: arch.profile.startBodyFatPct ?? undefined,
            fitnessLevel: arch.profile.fitnessLevel,
            location: "gym",
            equipment: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
            daysPerWeek: arch.profile.daysPerWeek,
            goal: arch.profile.goal,
            goals: [arch.profile.goal],
          },
        },
      },
    });
    usernameToId.set(spec.username, user.id);
    created += 1;
  }
  // 2. Wire up trainer-client relationships.
  for (const spec of SEED_ROSTER) {
    if (!spec.isTrainer) continue;
    const trainerId = usernameToId.get(spec.username);
    if (!trainerId) continue;
    for (const clientUsername of spec.rosterUsernames ?? []) {
      const clientId = usernameToId.get(clientUsername);
      if (!clientId) continue;
      // TrainerClient.clientId is unique — if the client is already
      // attached to a different test trainer, skip (first trainer wins).
      const existing = await prisma.trainerClient.findUnique({ where: { clientId } });
      if (!existing) {
        await prisma.trainerClient.create({ data: { trainerId, clientId } });
      }
    }
  }
  // 3. Backfill workout history for each user.
  const now = Date.now();
  for (const spec of SEED_ROSTER) {
    const arch = archetypeById(spec.archetypeId);
    if (!arch) continue;
    const userId = usernameToId.get(spec.username);
    if (!userId) continue;
    const anchorMs = now - arch.backfillDays * 86400000;
    const inserts: Array<{ userId: string; date: Date; sets: any; intensityPoints: number }> = [];
    const bodyInserts: Array<{ userId: string; date: Date; weightKg: number | null; bodyFatPct: number | null }> = [];
    for (let dayOffset = arch.backfillDays; dayOffset >= 0; dayOffset--) {
      const dayMs = now - dayOffset * 86400000;
      const result = rollDay(arch, userId, dayMs, anchorMs);
      if (result.workout) {
        inserts.push({
          userId,
          date: new Date(dayMs),
          sets: result.workout.sets,
          intensityPoints: result.workout.intensityPoints,
        });
      }
      if (result.bodyMetric) {
        bodyInserts.push({
          userId,
          date: new Date(dayMs),
          weightKg: result.bodyMetric.weightKg,
          bodyFatPct: result.bodyMetric.bodyFatPct,
        });
      }
    }
    if (inserts.length > 0) {
      await prisma.workoutLog.createMany({
        data: inserts.map(i => ({
          userId: i.userId,
          dayId: `test-${spec.archetypeId}-day`,
          date: i.date,
          duration: "45m",
          sets: i.sets,
          intensityPoints: i.intensityPoints,
        })),
      });
    }
    if (bodyInserts.length > 0) {
      await prisma.bodyMetric.createMany({ data: bodyInserts });
    }
  }
  return { created, existed };
}

export async function wipeTestUsers(): Promise<{ deleted: number }> {
  // Cascade deletes via onDelete: Cascade on the User row — workout
  // logs, body metrics, profile, trainer-client links, sent/received
  // messages all go with it.
  const deleted = await prisma.user.deleteMany({ where: { isTestUser: true } });
  return { deleted: deleted.count };
}

// Single-day tick — called by cron each day. Walks all test users
// and inserts "today's" activity for each one (if their archetype
// rolls a training day).
export async function tickAllTestUsers(forDateMs?: number): Promise<{ processed: number; trained: number; skipped: number }> {
  const targetMs = forDateMs ?? Date.now();
  const dayStart = new Date(targetMs);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = +dayStart;
  const dayEndMs = dayStartMs + 86400000;
  const users = await prisma.user.findMany({
    where: { isTestUser: true },
    select: { id: true, testArchetype: true, createdAt: true },
  });
  let trained = 0;
  let skipped = 0;
  for (const u of users) {
    const arch = archetypeById(u.testArchetype ?? "");
    if (!arch) continue;
    // Idempotency: skip if this user already has a log for this day.
    const existing = await prisma.workoutLog.findFirst({
      where: { userId: u.id, date: { gte: new Date(dayStartMs), lt: new Date(dayEndMs) } },
      select: { id: true },
    });
    if (existing) { skipped += 1; continue; }
    // Anchor = createdAt of the user, clamped to backfillDays-ago so
    // strength progression doesn't reset when the user was seeded
    // mid-cycle.
    const anchorMs = Math.min(+u.createdAt, dayStartMs - arch.backfillDays * 86400000);
    const result = rollDay(arch, u.id, dayStartMs, anchorMs);
    if (result.workout) {
      await prisma.workoutLog.create({
        data: {
          userId: u.id,
          dayId: `test-${arch.id}-day`,
          date: new Date(dayStartMs),
          duration: "45m",
          sets: result.workout.sets,
          intensityPoints: result.workout.intensityPoints,
        },
      });
      trained += 1;
    }
    if (result.bodyMetric) {
      await prisma.bodyMetric.create({
        data: {
          userId: u.id,
          date: new Date(dayStartMs),
          weightKg: result.bodyMetric.weightKg,
          bodyFatPct: result.bodyMetric.bodyFatPct,
        },
      });
    }
  }
  return { processed: users.length, trained, skipped };
}

// Walk back N days — used by the admin "fast forward" button. Each
// day's tick is independently idempotent so re-running is safe.
export async function advanceTestUsers(days: number): Promise<{ daysAdvanced: number; totalTrained: number }> {
  const safeDays = Math.max(0, Math.min(365, Math.floor(days)));
  const now = Date.now();
  let totalTrained = 0;
  for (let i = safeDays - 1; i >= 0; i--) {
    const targetMs = now - i * 86400000;
    const result = await tickAllTestUsers(targetMs);
    totalTrained += result.trained;
  }
  return { daysAdvanced: safeDays, totalTrained };
}

// AppConfig helpers — single source of truth for app-wide toggles.
export async function getAppConfigBool(key: string, defaultValue: boolean): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row) return defaultValue;
  return row.value === "true";
}

export async function setAppConfigBool(key: string, value: boolean): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value: value ? "true" : "false" },
    update: { value: value ? "true" : "false" },
  });
}

export const CONFIG_KEY_SHOW_TEST_USERS = "showTestUsersInLeaderboards";
