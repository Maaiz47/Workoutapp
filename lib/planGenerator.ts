import { EXERCISES, filterExercises, Equipment, MuscleGroup, Goal, Location } from "./exercises";

export interface UserProfileInput {
  daysPerWeek: number;
  goals: Goal[];
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  location: Location;
  equipment: Equipment[];
  gender: string;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  targetArea?: string;
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

// ── Goal helpers ────────────────────────────────────────────────────────────

const GOAL_PRIORITY: Goal[] = ["strength", "muscle", "fat_loss", "fitness"];

function primaryGoal(goals: Goal[]): Goal {
  for (const g of GOAL_PRIORITY) if (goals.includes(g)) return g;
  return goals[0] ?? "muscle";
}

// ── Sets / reps / rest — blended across all selected goals ─────────────────

function volumeForGoals(goals: Goal[], level: "beginner" | "intermediate" | "advanced") {
  const configs: Record<Goal, { sets: number; repsLow: number; repsHigh: number; rest: number }> = {
    muscle:   { sets: 4, repsLow: 8,  repsHigh: 12, rest: 75 },
    strength: { sets: 5, repsLow: 3,  repsHigh: 6,  rest: 180 },
    fat_loss: { sets: 3, repsLow: 12, repsHigh: 20, rest: 45 },
    fitness:  { sets: 3, repsLow: 10, repsHigh: 15, rest: 60 },
  };

  const selected = goals.map(g => configs[g]);
  const n = selected.length;

  let sets     = Math.round(selected.reduce((s, v) => s + v.sets,     0) / n);
  let repsLow  = Math.round(selected.reduce((s, v) => s + v.repsLow,  0) / n);
  let repsHigh = Math.round(selected.reduce((s, v) => s + v.repsHigh, 0) / n);
  let rest     = Math.round(selected.reduce((s, v) => s + v.rest,     0) / n / 15) * 15;

  if (level === "beginner") sets = Math.max(2, sets - 1);
  if (level === "advanced")  sets = Math.min(6, sets + 1);
  return { sets, repsLow, repsHigh, rest };
}

function makeEx(
  id: string,
  goals: Goal[],
  level: "beginner" | "intermediate" | "advanced",
  overrides?: Partial<GeneratedExercise>
): GeneratedExercise | null {
  const ex = EXERCISES.find(e => e.id === id);
  if (!ex) return null;
  const v = volumeForGoals(goals, level);
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
  preferences: string[] = [],
  exclude: Set<string> = new Set()
): string | null {
  const pg = primaryGoal(profile.goals);

  for (const id of preferences) {
    const ex = EXERCISES.find(e => e.id === id);
    if (!ex || exclude.has(id)) continue;
    if (ex.location !== "both" && ex.location !== profile.location) continue;
    const needsEquip = ex.equipment.filter(eq => eq !== "bodyweight");
    if (needsEquip.length > 0 && !needsEquip.some(eq => profile.equipment.includes(eq))) continue;
    if (profile.fitnessLevel !== "advanced" && ex.difficulty === "advanced") continue;
    return id;
  }

  const results = filterExercises({
    primaryMuscle,
    equipment: profile.equipment,
    location: profile.location as Location,
    difficulty: profile.fitnessLevel === "beginner"
      ? ["beginner"]
      : profile.fitnessLevel === "intermediate"
      ? ["beginner", "intermediate"]
      : ["beginner", "intermediate", "advanced"],
    goal: pg,
  }).filter(e => !exclude.has(e.id));

  return results[0]?.id ?? null;
}

// ── Day builders ────────────────────────────────────────────────────────────

function buildPushDay(profile: UserProfileInput, variant: "heavy" | "volume", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const chestCompounds = variant === "heavy"
    ? ["barbell-bench-press", "dumbbell-bench-press", "chest-press-machine", "pushups"]
    : ["incline-barbell-press", "incline-dumbbell-press", "dumbbell-bench-press", "pushups"];
  const chestMain = pickExercise("chest", profile, chestCompounds, used);
  if (chestMain) { exs.push(makeEx(chestMain, goals, level)); used.add(chestMain); }

  const shoulderCompounds = ["overhead-press", "dumbbell-shoulder-press", "arnold-press", "machine-shoulder-press", "resistance-band-shoulder-press", "pike-pushup"];
  const shoulderMain = pickExercise("shoulders", profile, shoulderCompounds, used);
  if (shoulderMain) { exs.push(makeEx(shoulderMain, goals, level)); used.add(shoulderMain); }

  if (level !== "beginner") {
    const chestIso = pickExercise("chest", profile, ["cable-crossover", "dumbbell-flyes", "incline-dumbbell-flyes", "pec-deck", "resistance-band-chest-press"], used);
    if (chestIso) { exs.push(makeEx(chestIso, goals, level)); used.add(chestIso); }
  }

  const shoulderIso = pickExercise("shoulders", profile, ["lateral-raise", "cable-lateral-raise", "resistance-band-lateral-raise", "rear-delt-fly"], used);
  if (shoulderIso) { exs.push(makeEx(shoulderIso, goals, level)); used.add(shoulderIso); }

  const tricepExs = ["tricep-pushdown", "overhead-tricep-extension", "skull-crushers", "tricep-dips", "bench-dips", "resistance-band-pushdown", "tricep-kickback"];
  const tricep = pickExercise("triceps", profile, tricepExs, used);
  if (tricep) { exs.push(makeEx(tricep, goals, level)); used.add(tricep); }

  if (level === "advanced") {
    const tricep2 = pickExercise("triceps", profile, tricepExs, used);
    if (tricep2) { exs.push(makeEx(tricep2, goals, level)); used.add(tricep2); }
  }

  // Fat loss: add cardio finisher
  if (goals.includes("fat_loss")) {
    const cardio = pickExercise("cardio", profile, ["mountain-climbers", "burpees", "jumping-jacks", "high-knees"], used);
    if (cardio) { exs.push(makeEx(cardio, goals, level, { sets: 3, reps: "30–45 sec", rest: 30, notes: "Cardio finisher" })); used.add(cardio); }
  }

  const title = variant === "heavy" ? "Push Day — Heavy" : "Push Day — Volume";
  return { title, subtitle: "Chest · Shoulders · Triceps", focus: "chest, shoulders, triceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildPullDay(profile: UserProfileInput, variant: "width" | "thickness", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const backCompounds = variant === "width"
    ? ["lat-pulldown", "pullups", "chinups", "wide-grip-lat-pulldown", "resistance-band-pulldown", "inverted-row"]
    : ["barbell-row", "seated-cable-row", "t-bar-row", "single-arm-dumbbell-row", "resistance-band-row"];
  const backMain = pickExercise("back", profile, backCompounds, used);
  if (backMain) { exs.push(makeEx(backMain, goals, level)); used.add(backMain); }

  const backSecond = pickExercise("back", profile, ["seated-cable-row", "single-arm-dumbbell-row", "barbell-row", "t-bar-row", "resistance-band-row", "inverted-row"], used);
  if (backSecond) { exs.push(makeEx(backSecond, goals, level)); used.add(backSecond); }

  if (variant === "thickness" && level !== "beginner" && goals.includes("strength")) {
    const heavy = pickExercise("back", profile, ["barbell-deadlift", "sumo-deadlift"], used);
    if (heavy) { exs.push(makeEx(heavy, goals, level, { reps: "3–5", rest: 180 })); used.add(heavy); }
  }

  const backIso = pickExercise("back", profile, ["face-pull", "straight-arm-pulldown", "rear-delt-fly", "hyperextension"], used);
  if (backIso) { exs.push(makeEx(backIso, goals, level)); used.add(backIso); }

  const bicepExs = ["barbell-curl", "dumbbell-curl", "hammer-curl", "cable-curl", "preacher-curl", "ez-bar-curl", "incline-dumbbell-curl", "resistance-band-curl", "concentration-curl"];
  const bicep = pickExercise("biceps", profile, bicepExs, used);
  if (bicep) { exs.push(makeEx(bicep, goals, level)); used.add(bicep); }

  if (level !== "beginner") {
    const bicep2 = pickExercise("biceps", profile, bicepExs, used);
    if (bicep2) { exs.push(makeEx(bicep2, goals, level)); used.add(bicep2); }
  }

  const title = variant === "width" ? "Pull Day — Width" : "Pull Day — Thickness";
  return { title, subtitle: "Back · Biceps", focus: "back, biceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildLegDay(profile: UserProfileInput, variant: "main" | "secondary", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const quadCompounds = variant === "main"
    ? ["barbell-squat", "leg-press", "hack-squat", "goblet-squat", "bodyweight-squat"]
    : ["front-squat", "bulgarian-split-squat", "lunges", "step-ups", "jump-squat", "sumo-squat", "resistance-band-squat"];
  const quadMain = pickExercise("quads", profile, quadCompounds, used);
  if (quadMain) { exs.push(makeEx(quadMain, goals, level)); used.add(quadMain); }

  const post = pickExercise("hamstrings", profile, ["romanian-deadlift", "romanian-deadlift-db", "leg-curl", "sumo-deadlift", "good-morning", "nordic-curl"], used);
  if (post) { exs.push(makeEx(post, goals, level)); used.add(post); }

  const glute = pickExercise("glutes", profile, ["hip-thrust-barbell", "hip-thrust-db", "glute-bridge", "glute-kickback", "donkey-kick", "bulgarian-split-squat"], used);
  if (glute) { exs.push(makeEx(glute, goals, level)); used.add(glute); }

  if (level !== "beginner") {
    const quadIso = pickExercise("quads", profile, ["leg-extension", "lunges", "step-ups"], used);
    if (quadIso) { exs.push(makeEx(quadIso, goals, level)); used.add(quadIso); }
  }

  const calf = pickExercise("calves", profile, ["standing-calf-raise", "dumbbell-calf-raise", "seated-calf-raise"], used);
  if (calf) { exs.push(makeEx(calf, goals, level, { sets: 3, reps: "15–20", rest: 45 })); used.add(calf); }

  return { title: "Leg Day", subtitle: "Quads · Hamstrings · Glutes · Calves", focus: "quads, hamstrings, glutes, calves", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildUpperDay(profile: UserProfileInput, variant: "A" | "B", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const chestCompounds = variant === "A"
    ? ["barbell-bench-press", "dumbbell-bench-press", "chest-press-machine", "pushups"]
    : ["incline-barbell-press", "incline-dumbbell-press", "dumbbell-bench-press", "decline-pushups"];
  const chest = pickExercise("chest", profile, chestCompounds, used);
  if (chest) { exs.push(makeEx(chest, goals, level)); used.add(chest); }

  const backCompounds = variant === "A"
    ? ["barbell-row", "seated-cable-row", "single-arm-dumbbell-row", "resistance-band-row", "inverted-row"]
    : ["lat-pulldown", "pullups", "chinups", "wide-grip-lat-pulldown", "resistance-band-pulldown"];
  const back = pickExercise("back", profile, backCompounds, used);
  if (back) { exs.push(makeEx(back, goals, level)); used.add(back); }

  const shoulder = pickExercise("shoulders", profile, ["overhead-press", "dumbbell-shoulder-press", "machine-shoulder-press", "resistance-band-shoulder-press", "pike-pushup"], used);
  if (shoulder) { exs.push(makeEx(shoulder, goals, level)); used.add(shoulder); }

  if (level !== "beginner") {
    const shoulderIso = pickExercise("shoulders", profile, ["lateral-raise", "cable-lateral-raise", "resistance-band-lateral-raise"], used);
    if (shoulderIso) { exs.push(makeEx(shoulderIso, goals, level)); used.add(shoulderIso); }
  }

  const bicep = pickExercise("biceps", profile, ["barbell-curl", "dumbbell-curl", "hammer-curl", "resistance-band-curl", "cable-curl"], used);
  if (bicep) { exs.push(makeEx(bicep, goals, level)); used.add(bicep); }

  const tricep = pickExercise("triceps", profile, ["tricep-pushdown", "overhead-tricep-extension", "bench-dips", "tricep-dips", "resistance-band-pushdown"], used);
  if (tricep) { exs.push(makeEx(tricep, goals, level)); used.add(tricep); }

  return { title: `Upper Body ${variant}`, subtitle: "Chest · Back · Shoulders · Arms", focus: "chest, back, shoulders, biceps, triceps", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildLowerDay(profile: UserProfileInput, variant: "A" | "B", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const quadCompounds = variant === "A"
    ? ["barbell-squat", "leg-press", "goblet-squat", "bodyweight-squat", "resistance-band-squat"]
    : ["front-squat", "bulgarian-split-squat", "hack-squat", "lunges", "sumo-squat"];
  const quad = pickExercise("quads", profile, quadCompounds, used);
  if (quad) { exs.push(makeEx(quad, goals, level)); used.add(quad); }

  const post = pickExercise("hamstrings", profile, ["romanian-deadlift", "romanian-deadlift-db", "sumo-deadlift", "leg-curl", "good-morning"], used);
  if (post) { exs.push(makeEx(post, goals, level)); used.add(post); }

  const glute = pickExercise("glutes", profile, ["hip-thrust-barbell", "hip-thrust-db", "glute-bridge", "glute-kickback"], used);
  if (glute) { exs.push(makeEx(glute, goals, level)); used.add(glute); }

  if (level !== "beginner") {
    const quadIso = pickExercise("quads", profile, ["leg-extension", "lunges", "step-ups", "wall-sit"], used);
    if (quadIso) { exs.push(makeEx(quadIso, goals, level)); used.add(quadIso); }
  }

  const calf = pickExercise("calves", profile, ["standing-calf-raise", "dumbbell-calf-raise", "seated-calf-raise"], used);
  if (calf) { exs.push(makeEx(calf, goals, level, { sets: 3, reps: "15–20", rest: 45 })); used.add(calf); }

  return { title: `Lower Body ${variant}`, subtitle: "Quads · Hamstrings · Glutes · Calves", focus: "quads, hamstrings, glutes, calves", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

function buildFullBodyDay(profile: UserProfileInput, variant: "A" | "B" | "C", used: Set<string>): GeneratedDay {
  const { goals, fitnessLevel: level } = profile;
  const exs: (GeneratedExercise | null)[] = [];

  const quadCompounds = { A: ["barbell-squat", "goblet-squat", "bodyweight-squat"], B: ["leg-press", "lunges", "bulgarian-split-squat"], C: ["romanian-deadlift-db", "step-ups", "sumo-squat"] }[variant];
  const quad = pickExercise("quads", profile, quadCompounds, used);
  if (quad) { exs.push(makeEx(quad, goals, level)); used.add(quad); }

  const pushCompounds = { A: ["barbell-bench-press", "dumbbell-bench-press", "pushups"], B: ["overhead-press", "dumbbell-shoulder-press", "pike-pushup"], C: ["incline-dumbbell-press", "incline-barbell-press", "decline-pushups"] }[variant];
  const push = pickExercise("chest", profile, pushCompounds, used);
  if (push) { exs.push(makeEx(push, goals, level)); used.add(push); }

  const pullCompounds = { A: ["barbell-row", "seated-cable-row", "resistance-band-row", "inverted-row"], B: ["lat-pulldown", "pullups", "chinups", "resistance-band-pulldown"], C: ["single-arm-dumbbell-row", "t-bar-row", "resistance-band-row"] }[variant];
  const pull = pickExercise("back", profile, pullCompounds, used);
  if (pull) { exs.push(makeEx(pull, goals, level)); used.add(pull); }

  if (level !== "beginner") {
    const glute = pickExercise("glutes", profile, ["hip-thrust-db", "glute-bridge", "glute-kickback", "donkey-kick"], used);
    if (glute) { exs.push(makeEx(glute, goals, level)); used.add(glute); }
  }

  const core = pickExercise("core", profile, ["plank", "russian-twist", "crunches", "dead-bug", "mountain-climbers"], used);
  if (core) { exs.push(makeEx(core, goals, level, { sets: 3, reps: "30–45 sec", rest: 45 })); used.add(core); }

  if (goals.includes("fat_loss")) {
    const cardio = pickExercise("cardio", profile, ["mountain-climbers", "burpees", "jumping-jacks", "high-knees", "treadmill", "cycling"], used);
    if (cardio) { exs.push(makeEx(cardio, goals, level, { sets: 3, reps: "30–45 sec", rest: 30, notes: "Cardio finisher" })); used.add(cardio); }
  }

  return { title: `Full Body ${variant}`, subtitle: "Full Body", focus: "full body", exercises: exs.filter(Boolean) as GeneratedExercise[] };
}

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
  const pg = primaryGoal(profile.goals);
  if (profile.fitnessLevel === "beginner" && days > 4) days = 4;
  if (pg === "strength" && days > 5) days = 5;
  return Math.max(2, Math.min(6, days));
}

// ── Target area post-processing ─────────────────────────────────────────────

function applyTargetArea(days: GeneratedDay[], profile: UserProfileInput): GeneratedDay[] {
  const ta = profile.targetArea;
  if (!ta || ta === "none") return days;
  const { goals, fitnessLevel: level } = profile;

  return days.map(day => {
    const used = new Set(day.exercises.map(e => e.exerciseId));
    const extras: GeneratedExercise[] = [];
    const inFocus = (patterns: string[]) => patterns.some(p => day.focus.includes(p));

    if (ta === "glutes" && inFocus(["glutes", "quads", "full body"])) {
      const id = pickExercise("glutes", profile, ["hip-thrust-barbell", "hip-thrust-db", "clamshell", "resistance-band-hip-abduction", "glute-bridge", "glute-kickback", "donkey-kick"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Glute focus — hold the squeeze at the top" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "shoulders" && inFocus(["chest", "shoulders", "triceps", "full body"])) {
      const id = pickExercise("shoulders", profile, ["lateral-raise", "cable-lateral-raise", "front-raise", "rear-delt-fly", "resistance-band-lateral-raise", "upright-row"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Shoulder focus — slow eccentric, controlled" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "back" && inFocus(["back", "biceps", "full body"])) {
      const id = pickExercise("back", profile, ["straight-arm-pulldown", "dumbbell-shrugs", "barbell-shrugs", "hyperextension", "face-pull", "superman"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Back focus — mind-muscle connection on each rep" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "chest" && inFocus(["chest", "full body"])) {
      const id = pickExercise("chest", profile, ["cable-crossover", "pec-deck", "dumbbell-flyes", "incline-dumbbell-flyes", "wide-pushups"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Chest focus — full stretch at the bottom" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "arms" && inFocus(["back", "biceps", "full body"])) {
      const id = pickExercise("biceps", profile, ["concentration-curl", "incline-dumbbell-curl", "preacher-curl", "hammer-curl", "ez-bar-curl"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Arms focus" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "arms" && inFocus(["chest", "shoulders", "triceps", "full body"])) {
      const id = pickExercise("triceps", profile, ["overhead-tricep-extension", "skull-crushers", "tricep-kickback", "diamond-pushups"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Arms focus" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "core") {
      const id = pickExercise("core", profile, ["hanging-leg-raise", "bicycle-crunch", "v-ups", "ab-rollout", "cable-crunch", "leg-raises", "side-plank", "dead-bug", "bird-dog"], used);
      if (id) { const ex = makeEx(id, goals, level, { sets: 3, reps: "12–15", rest: 45, notes: "Core focus" }); if (ex) { extras.push(ex); used.add(id); } }
    }
    if (ta === "legs" && inFocus(["quads", "hamstrings", "full body"])) {
      const id = pickExercise("quads", profile, ["leg-extension", "lunges", "step-ups", "wall-sit", "straight-leg-raise"], used);
      if (id) { const ex = makeEx(id, goals, level, { notes: "Legs focus — full range of motion" }); if (ex) { extras.push(ex); used.add(id); } }
    }

    if (ta === "rehab_knee") {
      const modified = day.exercises.map(ex => {
        const risky = ["barbell-squat", "front-squat", "jump-squat", "box-jumps", "bulgarian-split-squat"];
        return risky.includes(ex.exerciseId) ? { ...ex, notes: (ex.notes ? ex.notes + " · " : "") + "Rehab: reduce load, controlled tempo, stop if pain" } : ex;
      });
      if (inFocus(["quads", "hamstrings", "glutes", "full body"])) {
        const id = pickExercise("quads", profile, ["straight-leg-raise", "terminal-knee-extension", "wall-sit"], used);
        if (id) { const ex = makeEx(id, goals, level, { sets: 3, reps: "15–20", rest: 45, notes: "Knee rehab: light resistance, controlled movement" }); if (ex) extras.push(ex); }
      }
      return { ...day, exercises: [...modified, ...extras] };
    }
    if (ta === "rehab_shoulder") {
      const modified = day.exercises.map(ex => {
        const risky = ["overhead-press", "barbell-bench-press", "incline-barbell-press", "upright-row"];
        return risky.includes(ex.exerciseId) ? { ...ex, notes: (ex.notes ? ex.notes + " · " : "") + "Rehab: switch to dumbbell variation, lighter weight" } : ex;
      });
      if (inFocus(["chest", "shoulders", "triceps", "full body"])) {
        const id = pickExercise("shoulders", profile, ["shoulder-external-rotation", "wall-slide", "face-pull", "rear-delt-fly"], used);
        if (id) { const ex = makeEx(id, goals, level, { sets: 3, reps: "15–20", rest: 45, notes: "Shoulder rehab: very light, pain-free range only" }); if (ex) extras.push(ex); }
      }
      return { ...day, exercises: [...modified, ...extras] };
    }
    if (ta === "rehab_lower_back") {
      const modified = day.exercises.map(ex => {
        const risky = ["barbell-deadlift", "good-morning", "barbell-row", "t-bar-row"];
        return risky.includes(ex.exerciseId) ? { ...ex, notes: (ex.notes ? ex.notes + " · " : "") + "Rehab: brace core, lighter load, no rounding" } : ex;
      });
      const id = pickExercise("core", profile, ["bird-dog", "dead-bug", "plank", "superman"], used);
      if (id) { const ex = makeEx(id, goals, level, { sets: 3, reps: "30–45 sec", rest: 45, notes: "Lower back rehab: core stability work" }); if (ex) extras.push(ex); }
      return { ...day, exercises: [...modified, ...extras] };
    }

    return { ...day, exercises: [...day.exercises, ...extras] };
  });
}

const TARGET_AREA_LABELS: Record<string, string> = {
  shoulders: "shoulder development", glutes: "glute growth", back: "back width and thickness",
  chest: "chest development", arms: "arm size", core: "core strength", legs: "leg development",
  rehab_knee: "knee rehabilitation", rehab_shoulder: "shoulder rehabilitation", rehab_lower_back: "lower back rehabilitation",
};

// ── Plan note ───────────────────────────────────────────────────────────────

function buildPlanNote(profile: UserProfileInput, days: number): string {
  const { goals } = profile;
  if (goals.length === 1) {
    const notes: Record<Goal, string> = {
      muscle:   "Plan optimised for hypertrophy — moderate reps, progressive overload.",
      strength: "Plan optimised for strength — heavy compound lifts, low reps, long rest.",
      fat_loss: "Plan optimised for fat loss — higher volume, shorter rest, cardio finishers.",
      fitness:  "Balanced plan for overall fitness and conditioning.",
    };
    return notes[goals[0]];
  }
  if (goals.includes("strength") && goals.includes("muscle")) return "Powerbuilding approach — heavy compound work for strength with moderate rep ranges for hypertrophy.";
  if (goals.includes("muscle") && goals.includes("fat_loss")) return "Body recomposition plan — sufficient volume to build muscle while keeping rest periods short for fat burning.";
  if (goals.includes("strength") && goals.includes("fat_loss")) return "Strength and conditioning hybrid — heavy lifts with cardio finishers to burn fat while building strength.";
  return "Multi-goal plan blending volume, intensity, and conditioning across all your selected goals.";
}

// ── Main export ─────────────────────────────────────────────────────────────

export function generatePlan(profile: UserProfileInput): GeneratedPlan {
  const days = decideDays(profile);
  const pg = primaryGoal(profile.goals);
  const hasFatLoss = profile.goals.includes("fat_loss");
  const planDays: GeneratedDay[] = [];

  if (days <= 2) {
    planDays.push(buildFullBodyDay(profile, "A", new Set()));
    if (days === 2) planDays.push(buildFullBodyDay(profile, "B", new Set()));
  } else if (days === 3) {
    if (pg === "strength") {
      planDays.push(buildFullBodyDay(profile, "A", new Set()));
      planDays.push(buildFullBodyDay(profile, "B", new Set()));
      planDays.push(buildFullBodyDay(profile, "C", new Set()));
    } else {
      planDays.push(buildPushDay(profile, "heavy", new Set()));
      planDays.push(buildPullDay(profile, "width", new Set()));
      planDays.push(buildLegDay(profile, "main", new Set()));
    }
  } else if (days === 4) {
    planDays.push(buildUpperDay(profile, "A", new Set()));
    planDays.push(buildLowerDay(profile, "A", new Set()));
    planDays.push(buildUpperDay(profile, "B", new Set()));
    planDays.push(buildLowerDay(profile, "B", new Set()));
  } else if (days === 5) {
    planDays.push(buildPushDay(profile, "heavy", new Set()));
    planDays.push(buildPullDay(profile, "width", new Set()));
    planDays.push(buildLegDay(profile, "main", new Set()));
    planDays.push(buildPushDay(profile, "volume", new Set()));
    planDays.push(buildPullDay(profile, "thickness", new Set()));
  } else {
    planDays.push(buildPushDay(profile, "heavy", new Set()));
    planDays.push(buildPullDay(profile, "width", new Set()));
    planDays.push(buildLegDay(profile, "main", new Set()));
    planDays.push(buildPushDay(profile, "volume", new Set()));
    planDays.push(buildPullDay(profile, "thickness", new Set()));
    planDays.push(buildLegDay(profile, "secondary", new Set()));
  }

  if (hasFatLoss && profile.daysPerWeek > days) {
    planDays.push(buildCardioDay(profile, new Set()));
  }

  const finalDays = applyTargetArea(planDays, profile);
  let planNote = buildPlanNote(profile, days);

  if (profile.targetArea && profile.targetArea !== "none") {
    const label = TARGET_AREA_LABELS[profile.targetArea] ?? profile.targetArea;
    planNote += ` Extra work added for ${label}.`;
  }

  return { days: finalDays, planNote };
}
