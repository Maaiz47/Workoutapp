import { EXERCISES, filterExercises, Equipment, MuscleGroup, Goal, Location } from "./exercises";

export interface UserProfileInput {
  daysPerWeek: number;
  goal: Goal;
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  location: Location;
  equipment: Equipment[];
  gender: string;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

export interface GeneratedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  rest: number;
  notes?: string;
}

export interface GeneratedDay {
  title: string;
  subtitle: string;
  focus: string;
  exercises: GeneratedExercise[];
}

export interface GeneratedPlan {
  days: GeneratedDay[];
  planNote: string;
}

// ── Sets / reps / rest by goal ──────────────────────────────────────────────

function volumeForGoal(goal: Goal, level: "beginner" | "intermediate" | "advanced") {
  const base = {
    muscle:    { sets: 4, repsLow: 8,  repsHigh: 12, rest: 75 },
    strength:  { sets: 5, repsLow: 3,  repsHigh: 6,  rest: 180 },
    fat_loss:  { sets: 3, repsLow: 12, repsHigh: 20, rest: 45 },
    fitness:   { sets: 3, repsLow: 10, repsHigh: 15, rest: 60 },
  }[goal];

  if (level === "beginner") base.sets = Math.max(2, base.sets - 1);
  if (level === "advanced")  base.sets = Math.min(6, base.sets + 1);
  return base;
}

function makeEx(
  id: string,
  goal: Goal,
  level: "beginner" | "intermediate" | "advanced",
  overrides?: Partial<GeneratedExercise>
): GeneratedExercise | null {
  const ex = EXERCISES.find(e => e.id === id);
  if (!ex) return null;
  const v = volumeForGoal(goal, level);
  // Isolation exercises get 1 fewer set
  const sets = ex.type === "isolation" ? Math.max(2, v.sets - 1) : v.sets;
  return {
    exerciseId: id,
    name: ex.name,
    sets,
    reps: `${v.repsLow}–${v.repsHigh}`,
    rest: v.rest,
    ...overrides,
  };
}

// ── Equipment-aware exercise picker ────────────────────────────────────────

function pickExercise(
  primaryMuscle: MuscleGroup,
  profile: UserProfileInput,
  preferences: string[] = [],    // ordered list of preferred exercise IDs
  exclude: Set<string> = new Set()
): string | null {
  // Try preferred IDs in order first
  for (const id of preferences) {
    const ex = EXERCISES.find(e => e.id === id);
    if (!ex || exclude.has(id)) continue;
    if (ex.location !== "both" && ex.location !== profile.location) continue;
    const needsEquip = ex.equipment.filter(eq => eq !== "bodyweight");
    if (needsEquip.length > 0 && !needsEquip.some(eq => profile.equipment.includes(eq))) continue;
    if (profile.fitnessLevel === "beginner" && ex.difficulty === "advanced") continue;
    if (profile.fitnessLevel !== "advanced" && ex.difficulty === "advanced") continue;
    return id;
  }

  // Fallback: filter database
  const results = filterExercises({
    primaryMuscle,
    equipment: profile.equipment,
    location: profile.location as Location,
    difficulty: profile.fitnessLevel === "beginner"
      ? ["beginner"]
      : profile.fitnessLevel === "intermediate"
      ? ["beginner", "intermediate"]
      : ["beginner", "intermediate", "advanced"],
    goal: profile.goal,
  }).filter(e => !exclude.has(e.id));

  return results[0]?.id ?? null;
}

// ── Day builders ────────────────────────────────────────────────────────────

function buildPushDay(
  profile: UserProfileInput,
  variant: "heavy" | "volume",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  // Primary chest compound
  const chestCompounds = variant === "heavy"
    ? ["barbell-bench-press", "dumbbell-bench-press", "chest-press-machine", "pushups"]
    : ["incline-barbell-press", "incline-dumbbell-press", "dumbbell-bench-press", "pushups"];
  const chestMain = pickExercise("chest", profile, chestCompounds, used);
  if (chestMain) { exs.push(makeEx(chestMain, goal, level)); used.add(chestMain); }

  // Shoulder compound
  const shoulderCompounds = ["overhead-press", "dumbbell-shoulder-press", "arnold-press", "machine-shoulder-press", "resistance-band-shoulder-press", "pike-pushup"];
  const shoulderMain = pickExercise("shoulders", profile, shoulderCompounds, used);
  if (shoulderMain) { exs.push(makeEx(shoulderMain, goal, level)); used.add(shoulderMain); }

  // Chest isolation (intermediate+)
  if (level !== "beginner") {
    const chestIso = pickExercise("chest", profile, ["cable-crossover", "dumbbell-flyes", "incline-dumbbell-flyes", "pec-deck", "resistance-band-chest-press"], used);
    if (chestIso) { exs.push(makeEx(chestIso, goal, level)); used.add(chestIso); }
  }

  // Shoulder isolation
  const shoulderIso = pickExercise("shoulders", profile, ["lateral-raise", "cable-lateral-raise", "resistance-band-lateral-raise", "rear-delt-fly"], used);
  if (shoulderIso) { exs.push(makeEx(shoulderIso, goal, level)); used.add(shoulderIso); }

  // Tricep
  const tricepExs = ["tricep-pushdown", "overhead-tricep-extension", "skull-crushers", "tricep-dips", "bench-dips", "resistance-band-pushdown", "tricep-kickback"];
  const tricep = pickExercise("triceps", profile, tricepExs, used);
  if (tricep) { exs.push(makeEx(tricep, goal, level)); used.add(tricep); }

  // Second tricep for advanced
  if (level === "advanced") {
    const tricep2 = pickExercise("triceps", profile, tricepExs, used);
    if (tricep2) { exs.push(makeEx(tricep2, goal, level)); used.add(tricep2); }
  }

  const title = variant === "heavy" ? "Push Day — Heavy" : "Push Day — Volume";
  const subtitle = variant === "heavy" ? "Chest · Shoulders · Triceps" : "Chest · Shoulders · Triceps";
  return { title, subtitle, focus: "chest, shoulders, triceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildPullDay(
  profile: UserProfileInput,
  variant: "width" | "thickness",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  // Primary back compound
  const backCompounds = variant === "width"
    ? ["lat-pulldown", "pullups", "chinups", "wide-grip-lat-pulldown", "resistance-band-pulldown", "inverted-row"]
    : ["barbell-row", "seated-cable-row", "t-bar-row", "single-arm-dumbbell-row", "resistance-band-row"];
  const backMain = pickExercise("back", profile, backCompounds, used);
  if (backMain) { exs.push(makeEx(backMain, goal, level)); used.add(backMain); }

  // Second back compound
  const backSecond = pickExercise("back", profile, [
    "seated-cable-row", "single-arm-dumbbell-row", "barbell-row", "t-bar-row", "resistance-band-row", "inverted-row",
  ], used);
  if (backSecond) { exs.push(makeEx(backSecond, goal, level)); used.add(backSecond); }

  // Heavy pull (deadlift) for thickness on intermediate+
  if (variant === "thickness" && level !== "beginner") {
    const heavy = pickExercise("back", profile, ["barbell-deadlift", "sumo-deadlift"], used);
    if (heavy) { exs.push(makeEx(heavy, goal, level, { reps: "3–5", rest: 180 })); used.add(heavy); }
  }

  // Back isolation
  const backIso = pickExercise("back", profile, ["face-pull", "straight-arm-pulldown", "rear-delt-fly", "hyperextension"], used);
  if (backIso) { exs.push(makeEx(backIso, goal, level)); used.add(backIso); }

  // Bicep isolation
  const bicepExs = ["barbell-curl", "dumbbell-curl", "hammer-curl", "cable-curl", "preacher-curl", "ez-bar-curl", "incline-dumbbell-curl", "resistance-band-curl", "concentration-curl"];
  const bicep = pickExercise("biceps", profile, bicepExs, used);
  if (bicep) { exs.push(makeEx(bicep, goal, level)); used.add(bicep); }

  // Second bicep for intermediate+
  if (level !== "beginner") {
    const bicep2 = pickExercise("biceps", profile, bicepExs, used);
    if (bicep2) { exs.push(makeEx(bicep2, goal, level)); used.add(bicep2); }
  }

  const title = variant === "width" ? "Pull Day — Width" : "Pull Day — Thickness";
  return { title, subtitle: "Back · Biceps", focus: "back, biceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildLegDay(
  profile: UserProfileInput,
  variant: "main" | "secondary",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  // Quad compound
  const quadCompounds = variant === "main"
    ? ["barbell-squat", "leg-press", "hack-squat", "goblet-squat", "bodyweight-squat"]
    : ["front-squat", "bulgarian-split-squat", "lunges", "step-ups", "jump-squat", "sumo-squat", "resistance-band-squat"];
  const quadMain = pickExercise("quads", profile, quadCompounds, used);
  if (quadMain) { exs.push(makeEx(quadMain, goal, level)); used.add(quadMain); }

  // Posterior chain
  const postChain = ["romanian-deadlift", "romanian-deadlift-db", "leg-curl", "sumo-deadlift", "good-morning", "nordic-curl"];
  const post = pickExercise("hamstrings", profile, postChain, used);
  if (post) { exs.push(makeEx(post, goal, level)); used.add(post); }

  // Glute work
  const gluteExs = ["hip-thrust-barbell", "hip-thrust-db", "glute-bridge", "glute-kickback", "donkey-kick", "bulgarian-split-squat"];
  const glute = pickExercise("glutes", profile, gluteExs, used);
  if (glute) { exs.push(makeEx(glute, goal, level)); used.add(glute); }

  // Quad isolation
  const quadIso = pickExercise("quads", profile, ["leg-extension", "lunges", "step-ups"], used);
  if (quadIso && level !== "beginner") { exs.push(makeEx(quadIso, goal, level)); used.add(quadIso); }

  // Calves
  const calfExs = ["standing-calf-raise", "dumbbell-calf-raise", "seated-calf-raise"];
  const calf = pickExercise("calves", profile, calfExs, used);
  if (calf) { exs.push(makeEx(calf, goal, level, { sets: 3, reps: "15–20", rest: 45 })); used.add(calf); }

  return { title: "Leg Day", subtitle: "Quads · Hamstrings · Glutes · Calves", focus: "quads, hamstrings, glutes, calves", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildUpperDay(
  profile: UserProfileInput,
  variant: "A" | "B",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const chestCompounds = variant === "A"
    ? ["barbell-bench-press", "dumbbell-bench-press", "chest-press-machine", "pushups"]
    : ["incline-barbell-press", "incline-dumbbell-press", "dumbbell-bench-press", "decline-pushups"];
  const chest = pickExercise("chest", profile, chestCompounds, used);
  if (chest) { exs.push(makeEx(chest, goal, level)); used.add(chest); }

  const backCompounds = variant === "A"
    ? ["barbell-row", "seated-cable-row", "single-arm-dumbbell-row", "resistance-band-row", "inverted-row"]
    : ["lat-pulldown", "pullups", "chinups", "wide-grip-lat-pulldown", "resistance-band-pulldown"];
  const back = pickExercise("back", profile, backCompounds, used);
  if (back) { exs.push(makeEx(back, goal, level)); used.add(back); }

  const shoulder = pickExercise("shoulders", profile, ["overhead-press", "dumbbell-shoulder-press", "machine-shoulder-press", "resistance-band-shoulder-press", "pike-pushup"], used);
  if (shoulder) { exs.push(makeEx(shoulder, goal, level)); used.add(shoulder); }

  if (level !== "beginner") {
    const shoulderIso = pickExercise("shoulders", profile, ["lateral-raise", "cable-lateral-raise", "resistance-band-lateral-raise"], used);
    if (shoulderIso) { exs.push(makeEx(shoulderIso, goal, level)); used.add(shoulderIso); }
  }

  const bicep = pickExercise("biceps", profile, ["barbell-curl", "dumbbell-curl", "hammer-curl", "resistance-band-curl", "cable-curl"], used);
  if (bicep) { exs.push(makeEx(bicep, goal, level)); used.add(bicep); }

  const tricep = pickExercise("triceps", profile, ["tricep-pushdown", "overhead-tricep-extension", "bench-dips", "tricep-dips", "resistance-band-pushdown"], used);
  if (tricep) { exs.push(makeEx(tricep, goal, level)); used.add(tricep); }

  return { title: `Upper Body ${variant}`, subtitle: "Chest · Back · Shoulders · Arms", focus: "chest, back, shoulders, biceps, triceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildLowerDay(
  profile: UserProfileInput,
  variant: "A" | "B",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const quadCompounds = variant === "A"
    ? ["barbell-squat", "leg-press", "goblet-squat", "bodyweight-squat", "resistance-band-squat"]
    : ["front-squat", "bulgarian-split-squat", "hack-squat", "lunges", "sumo-squat"];
  const quad = pickExercise("quads", profile, quadCompounds, used);
  if (quad) { exs.push(makeEx(quad, goal, level)); used.add(quad); }

  const post = pickExercise("hamstrings", profile, ["romanian-deadlift", "romanian-deadlift-db", "sumo-deadlift", "leg-curl", "good-morning"], used);
  if (post) { exs.push(makeEx(post, goal, level)); used.add(post); }

  const glute = pickExercise("glutes", profile, ["hip-thrust-barbell", "hip-thrust-db", "glute-bridge", "glute-kickback"], used);
  if (glute) { exs.push(makeEx(glute, goal, level)); used.add(glute); }

  if (level !== "beginner") {
    const quadIso = pickExercise("quads", profile, ["leg-extension", "lunges", "step-ups", "wall-sit"], used);
    if (quadIso) { exs.push(makeEx(quadIso, goal, level)); used.add(quadIso); }
  }

  const calf = pickExercise("calves", profile, ["standing-calf-raise", "dumbbell-calf-raise", "seated-calf-raise"], used);
  if (calf) { exs.push(makeEx(calf, goal, level, { sets: 3, reps: "15–20", rest: 45 })); used.add(calf); }

  return { title: `Lower Body ${variant}`, subtitle: "Quads · Hamstrings · Glutes · Calves", focus: "quads, hamstrings, glutes, calves", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildFullBodyDay(
  profile: UserProfileInput,
  variant: "A" | "B" | "C",
  used: Set<string>
): GeneratedDay {
  const { goal, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const quadCompounds = { A: ["barbell-squat", "goblet-squat", "bodyweight-squat"], B: ["leg-press", "lunges", "bulgarian-split-squat"], C: ["romanian-deadlift-db", "step-ups", "sumo-squat"] }[variant];
  const quad = pickExercise("quads", profile, quadCompounds, used);
  if (quad) { exs.push(makeEx(quad, goal, level)); used.add(quad); }

  const pushCompounds = { A: ["barbell-bench-press", "dumbbell-bench-press", "pushups"], B: ["overhead-press", "dumbbell-shoulder-press", "pike-pushup"], C: ["incline-dumbbell-press", "incline-barbell-press", "decline-pushups"] }[variant];
  const push = pickExercise("chest", profile, pushCompounds, used);
  if (push) { exs.push(makeEx(push, goal, level)); used.add(push); }

  const pullCompounds = { A: ["barbell-row", "seated-cable-row", "resistance-band-row", "inverted-row"], B: ["lat-pulldown", "pullups", "chinups", "resistance-band-pulldown"], C: ["single-arm-dumbbell-row", "t-bar-row", "resistance-band-row"] }[variant];
  const pull = pickExercise("back", profile, pullCompounds, used);
  if (pull) { exs.push(makeEx(pull, goal, level)); used.add(pull); }

  if (level !== "beginner") {
    const glute = pickExercise("glutes", profile, ["hip-thrust-db", "glute-bridge", "glute-kickback", "donkey-kick"], used);
    if (glute) { exs.push(makeEx(glute, goal, level)); used.add(glute); }
  }

  const core = pickExercise("core", profile, ["plank", "russian-twist", "crunches", "dead-bug", "mountain-climbers"], used);
  if (core) { exs.push(makeEx(core, goal, level, { sets: 3, reps: "30–45 sec", rest: 45 })); used.add(core); }

  // Fat loss: add cardio finisher
  if (goal === "fat_loss") {
    const cardio = pickExercise("cardio", profile, ["mountain-climbers", "burpees", "jumping-jacks", "high-knees", "treadmill", "cycling"], used);
    if (cardio) { exs.push(makeEx(cardio, goal, level, { sets: 3, reps: "30–45 sec", rest: 30, notes: "Cardio finisher" })); used.add(cardio); }
  }

  return { title: `Full Body ${variant}`, subtitle: "Full Body", focus: "full body", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

// ── Cardio / conditioning day ───────────────────────────────────────────────

function buildCardioDay(profile: UserProfileInput, used: Set<string>): GeneratedDay {
  const exs: GeneratedExercise[] = [];
  const cardioOptions = profile.location === "gym"
    ? ["treadmill", "cycling", "rowing-machine", "burpees", "box-jumps"]
    : ["burpees", "jumping-jacks", "high-knees", "mountain-climbers", "jump-rope", "jump-squat"];

  for (const id of cardioOptions.slice(0, 3)) {
    const ex = EXERCISES.find(e => e.id === id);
    if (ex) exs.push({ exerciseId: id, name: ex.name, sets: 3, reps: "45 sec", rest: 30, notes: "Active rest between rounds" });
  }

  const core = EXERCISES.find(e => e.id === "plank");
  if (core) exs.push({ exerciseId: "plank", name: "Plank", sets: 3, reps: "45–60 sec", rest: 30 });

  return { title: "Cardio & Conditioning", subtitle: "HIIT · Core", focus: "cardio, core", exercises: exs };
}

// ── Split selector ──────────────────────────────────────────────────────────

function decideDays(profile: UserProfileInput): number {
  let days = profile.daysPerWeek;

  // Beginners should not over-train
  if (profile.fitnessLevel === "beginner" && days > 4) days = 4;

  // Strength goals don't benefit from >5 days
  if (profile.goal === "strength" && days > 5) days = 5;

  // Fat loss can sustain up to 6 days with conditioning
  return Math.max(2, Math.min(6, days));
}

export function generatePlan(profile: UserProfileInput): GeneratedPlan {
  const days = decideDays(profile);
  const planDays: GeneratedDay[] = [];
  const used = new Set<string>(); // reset per day below

  let planNote = "";

  if (days <= 2) {
    planNote = "Full-body training maximises frequency and recovery for your schedule.";
    planDays.push(buildFullBodyDay(profile, "A", new Set()));
    if (days === 2) planDays.push(buildFullBodyDay(profile, "B", new Set()));
  } else if (days === 3) {
    if (profile.goal === "strength") {
      planNote = "Three-day full-body strength training with progressive overload on the main lifts.";
      planDays.push(buildFullBodyDay(profile, "A", new Set()));
      planDays.push(buildFullBodyDay(profile, "B", new Set()));
      planDays.push(buildFullBodyDay(profile, "C", new Set()));
    } else if (profile.goal === "fat_loss") {
      planNote = "Push/Pull/Legs with cardio finishers — effective for fat loss while preserving muscle.";
      planDays.push(buildPushDay(profile, "heavy", new Set()));
      planDays.push(buildPullDay(profile, "width", new Set()));
      planDays.push(buildLegDay(profile, "main", new Set()));
    } else {
      planNote = "Push/Pull/Legs is one of the most proven splits for building muscle efficiently.";
      planDays.push(buildPushDay(profile, "heavy", new Set()));
      planDays.push(buildPullDay(profile, "width", new Set()));
      planDays.push(buildLegDay(profile, "main", new Set()));
    }
  } else if (days === 4) {
    planNote = "Upper/Lower split trains each muscle group twice per week — ideal for your schedule.";
    planDays.push(buildUpperDay(profile, "A", new Set()));
    planDays.push(buildLowerDay(profile, "A", new Set()));
    planDays.push(buildUpperDay(profile, "B", new Set()));
    planDays.push(buildLowerDay(profile, "B", new Set()));
  } else if (days === 5) {
    planNote = "5-day Push/Pull/Legs targets each muscle group with optimal volume and frequency.";
    planDays.push(buildPushDay(profile, "heavy", new Set()));
    planDays.push(buildPullDay(profile, "width", new Set()));
    planDays.push(buildLegDay(profile, "main", new Set()));
    planDays.push(buildPushDay(profile, "volume", new Set()));
    planDays.push(buildPullDay(profile, "thickness", new Set()));
  } else {
    planNote = "6-day PPL trains each muscle group twice per week with high overall volume.";
    planDays.push(buildPushDay(profile, "heavy", new Set()));
    planDays.push(buildPullDay(profile, "width", new Set()));
    planDays.push(buildLegDay(profile, "main", new Set()));
    planDays.push(buildPushDay(profile, "volume", new Set()));
    planDays.push(buildPullDay(profile, "thickness", new Set()));
    planDays.push(buildLegDay(profile, "secondary", new Set()));
  }

  // Append cardio day for fat loss with extra requested days
  if (profile.goal === "fat_loss" && profile.daysPerWeek > days) {
    planDays.push(buildCardioDay(profile, new Set()));
  }

  return { days: planDays, planNote };
}
