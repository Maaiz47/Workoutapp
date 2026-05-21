// Warm-up + cool-down library and pickers. Used to suggest focus-aware
// movements before & after a workout. Items shaped like the rest of the
// exercise data so they can render with the same components (form cues,
// thumbnails) when wired up.

export type StretchExercise = {
  id: string;
  name: string;
  reps: string;        // "5 min", "30s each side", "10 reps each leg"
  type: "cardio" | "stretch" | "mobility";
  kind: "warmup" | "cooldown";
  primaryMuscles: string[];
  cues: string[];      // 2-3 short form cues
  icon?: string;       // single emoji used in absence of an image
};

// ── WARM-UP LIBRARY ─────────────────────────────────────────────────────
// Each warm-up routine is built from one cardio primer + 2-3 dynamic moves
// targeted at the muscles you're about to train.

const WARMUP_CARDIO: Record<string, StretchExercise> = {
  treadmill: { id: "wu-treadmill", name: "Incline Treadmill Walk", reps: "5 min", type: "cardio", kind: "warmup", primaryMuscles: ["cardio"], cues: ["Set incline 5-8%, brisk pace.", "Breath should be slightly elevated, not laboured.", "Aim for a light sweat by minute 4."], icon: "🚶" },
  rower:     { id: "wu-rower",     name: "Rowing Machine",          reps: "5 min", type: "cardio", kind: "warmup", primaryMuscles: ["cardio", "back"], cues: ["Drive with the legs first, then pull with the arms.", "Smooth stroke rate — 22-26 spm.", "Keep core engaged, don't round the back."], icon: "🚣" },
  bike:      { id: "wu-bike",      name: "Stationary Bike",         reps: "5 min", type: "cardio", kind: "warmup", primaryMuscles: ["cardio", "quads"], cues: ["Moderate resistance, 80-90 RPM cadence.", "Sit tall, soft elbows on the bars.", "Bring HR to ~110-120 bpm before lifting."], icon: "🚴" },
};

const WARMUP_DYNAMIC: Record<string, StretchExercise> = {
  armCircles:    { id: "wu-arm-circles",    name: "Arm Circles",                  reps: "10 fwd + 10 back", type: "mobility", kind: "warmup", primaryMuscles: ["shoulders"], cues: ["Straight arms, full circles.", "Start small, expand each rep."], icon: "🔄" },
  bandPullApart: { id: "wu-band-pullapart", name: "Band Pull-Apart",              reps: "2×15",            type: "mobility", kind: "warmup", primaryMuscles: ["shoulders", "back"], cues: ["Light band, palms down.", "Squeeze shoulder blades.", "Slow + controlled."], icon: "🎯" },
  legSwings:     { id: "wu-leg-swings",     name: "Leg Swings",                   reps: "10 each leg",     type: "mobility", kind: "warmup", primaryMuscles: ["hips", "hamstrings"], cues: ["Hold a wall for balance.", "Front-to-back, then side-to-side.", "Full range of motion."], icon: "🦵" },
  hipOpeners:    { id: "wu-hip-openers",    name: "World's Greatest Stretch",     reps: "5 each side",     type: "mobility", kind: "warmup", primaryMuscles: ["hips", "quads", "thoracic"], cues: ["Lunge, hand inside foot.", "Open thoracic — rotate up.", "Hold 2 sec at the top."], icon: "🌍" },
  catCow:        { id: "wu-cat-cow",        name: "Cat-Cow",                      reps: "10 reps",         type: "mobility", kind: "warmup", primaryMuscles: ["spine", "core"], cues: ["Hands under shoulders, knees under hips.", "Inhale arch, exhale round.", "Slow, controlled."], icon: "🐈" },
  scapShrugs:    { id: "wu-scap-shrugs",    name: "Scap Push-Ups",                reps: "2×10",            type: "mobility", kind: "warmup", primaryMuscles: ["shoulders", "chest"], cues: ["Plank position, locked elbows.", "Pinch shoulder blades together.", "Push the floor away to protract."], icon: "🤸" },
  bodyweightSquat: { id: "wu-bw-squat",     name: "Bodyweight Squat",             reps: "15 reps",         type: "mobility", kind: "warmup", primaryMuscles: ["quads", "glutes"], cues: ["Feet shoulder-width, toes slightly out.", "Sit back into the heels.", "Full depth."], icon: "🧎" },
  inchworm:      { id: "wu-inchworm",       name: "Inchworm Walkout",             reps: "6 reps",          type: "mobility", kind: "warmup", primaryMuscles: ["hamstrings", "shoulders", "core"], cues: ["Stand, hinge, walk hands to plank.", "Hold plank for 1 sec.", "Walk feet back to hands."], icon: "🐛" },
};

// ── COOL-DOWN LIBRARY ───────────────────────────────────────────────────
// Static stretches matched to muscle groups actually trained. Hold for the
// listed time — slow breathing, no bouncing.

const COOLDOWN: Record<string, StretchExercise> = {
  chestDoorway:  { id: "cd-chest-doorway",  name: "Doorway Chest Stretch",    reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["chest"],     cues: ["Forearm vertical against the doorframe.", "Step through gently, feel chest stretch.", "Don't shrug — keep shoulder down."], icon: "🚪" },
  childsPose:    { id: "cd-childs-pose",    name: "Child's Pose",             reps: "45 sec",        type: "stretch", kind: "cooldown", primaryMuscles: ["back", "lats"], cues: ["Sit hips back to heels.", "Reach arms forward, palms down.", "Relax forehead to floor."], icon: "🧘" },
  pigeon:        { id: "cd-pigeon",         name: "Pigeon Pose",              reps: "45s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["glutes", "hips"], cues: ["Front shin parallel to the top of the mat.", "Hips square, sink down.", "Breathe into the tight side."], icon: "🦅" },
  hamstringLay:  { id: "cd-hamstring-lay",  name: "Lying Hamstring Stretch",  reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["hamstrings"], cues: ["On back, loop a strap around the foot.", "Leg straight, pull gently toward chest.", "Keep opposite leg flat."], icon: "🦵" },
  quadStanding:  { id: "cd-quad-standing",  name: "Standing Quad Stretch",    reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["quads"],     cues: ["Hold ankle, pull heel toward glute.", "Knees together, hips forward.", "Hold a wall for balance."], icon: "🦿" },
  calfWall:      { id: "cd-calf-wall",      name: "Wall Calf Stretch",        reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["calves"],    cues: ["Hands on wall, one leg back.", "Heel pressed to the floor.", "Bend front knee, lean in."], icon: "🧱" },
  latStretch:    { id: "cd-lat-stretch",    name: "Overhead Lat Stretch",     reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["lats", "back"], cues: ["Reach one arm overhead, grab opposite hand.", "Lean to the side, away from raised arm.", "Feel stretch down the side."], icon: "🙆" },
  tricepOverhead:{ id: "cd-tri-overhead",   name: "Overhead Tricep Stretch",  reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["triceps"],   cues: ["Arm overhead, bend elbow behind head.", "Other hand gently pulls elbow.", "Don't shrug shoulder up."], icon: "💪" },
  bicepWall:     { id: "cd-bicep-wall",     name: "Wall Bicep Stretch",       reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["biceps"],    cues: ["Palm on wall, arm straight behind you.", "Rotate body away from wall.", "Don't lock the elbow."], icon: "🧱" },
  glutePretzel:  { id: "cd-glute-pretzel",  name: "Figure-Four Stretch",      reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["glutes", "hips"], cues: ["Lying on back, ankle over opposite knee.", "Pull underside knee toward chest.", "Both glutes should feel a stretch."], icon: "🔢" },
  catCowCool:    { id: "cd-cat-cow",        name: "Cat-Cow (slow)",           reps: "8 slow reps",   type: "stretch", kind: "cooldown", primaryMuscles: ["spine", "core"], cues: ["Slow, breath-driven.", "Inhale arch, exhale round.", "Cool-down version — half the speed of the warm-up."], icon: "🐈" },
  shoulderCross: { id: "cd-shoulder-cross", name: "Cross-Body Shoulder Stretch", reps: "30s each side", type: "stretch", kind: "cooldown", primaryMuscles: ["shoulders", "rear delts"], cues: ["Arm straight across body.", "Other hand pulls elbow gently.", "Don't shrug."], icon: "🤲" },
};

// Match a focus string ("chest, shoulders, triceps", "back, biceps", etc.)
// against a list of muscle keywords. Used by the pickers.
function focusIncludes(focus: string, keywords: string[]): boolean {
  const hay = focus.toLowerCase();
  return keywords.some(k => hay.includes(k));
}

// ── PICKERS ─────────────────────────────────────────────────────────────

export type DayContext = {
  title?: string;
  focus?: string;
  // Optional extras for refinement. Defaults assume gym + general fitness.
  goals?: string[];           // ["fat_loss" | "strength" | "muscle" | "mobility" | ...]
  equipment?: string[];       // available equipment ids
  rehab?: "knee" | "shoulder" | "lower_back" | null;
};

// Returns a 3-4 item warm-up sequence: 1 cardio primer + 2-3 dynamic moves.
export function pickWarmups(ctx: DayContext): StretchExercise[] {
  const focus = `${ctx.title ?? ""} ${ctx.focus ?? ""}`.toLowerCase();
  const hasEq = (id: string) => !ctx.equipment || ctx.equipment.length === 0 || ctx.equipment.includes(id);
  const out: StretchExercise[] = [];

  // 1) Cardio primer — pick by equipment availability + focus.
  if (focusIncludes(focus, ["chest", "shoulder", "tricep", "push", "upper"]) && hasEq("rower")) out.push(WARMUP_CARDIO.rower);
  else if (focusIncludes(focus, ["leg", "quad", "hamstring", "glute", "calf", "lower"]) && hasEq("bike")) out.push(WARMUP_CARDIO.bike);
  else if (hasEq("treadmill")) out.push(WARMUP_CARDIO.treadmill);
  else out.push(WARMUP_CARDIO.bike); // fallback

  // 2-3) Dynamic stretches — keyed off focus.
  if (focusIncludes(focus, ["chest", "shoulder", "tricep", "push", "upper"])) {
    out.push(WARMUP_DYNAMIC.armCircles);
    out.push(WARMUP_DYNAMIC.bandPullApart);
    out.push(WARMUP_DYNAMIC.scapShrugs);
  } else if (focusIncludes(focus, ["back", "bicep", "pull"])) {
    out.push(WARMUP_DYNAMIC.bandPullApart);
    out.push(WARMUP_DYNAMIC.catCow);
    out.push(WARMUP_DYNAMIC.scapShrugs);
  } else if (focusIncludes(focus, ["leg", "quad", "hamstring", "glute", "calf", "lower"])) {
    out.push(WARMUP_DYNAMIC.legSwings);
    out.push(WARMUP_DYNAMIC.bodyweightSquat);
    out.push(WARMUP_DYNAMIC.hipOpeners);
  } else if (focusIncludes(focus, ["upper"])) {
    out.push(WARMUP_DYNAMIC.armCircles);
    out.push(WARMUP_DYNAMIC.bandPullApart);
    out.push(WARMUP_DYNAMIC.catCow);
  } else {
    // full body / cardio / anything else
    out.push(WARMUP_DYNAMIC.inchworm);
    out.push(WARMUP_DYNAMIC.hipOpeners);
    out.push(WARMUP_DYNAMIC.armCircles);
  }

  // Mobility-focused goal → bias toward more stretching, fewer cardio min.
  if (ctx.goals?.includes("mobility") && out[0]) {
    out[0] = { ...out[0], reps: "3 min" };
  }

  // Rehab: drop loaded moves that may aggravate.
  if (ctx.rehab === "knee") {
    return out.filter(e => !["wu-bw-squat", "wu-leg-swings"].includes(e.id));
  }
  if (ctx.rehab === "lower_back") {
    return out.filter(e => !["wu-bw-squat"].includes(e.id));
  }

  return out;
}

// Returns 3-5 cool-down stretches matched to the muscles trained.
export function pickCooldowns(ctx: DayContext): StretchExercise[] {
  const focus = `${ctx.title ?? ""} ${ctx.focus ?? ""}`.toLowerCase();
  const out: StretchExercise[] = [];

  if (focusIncludes(focus, ["chest", "push"])) out.push(COOLDOWN.chestDoorway);
  if (focusIncludes(focus, ["shoulder", "push", "upper"])) out.push(COOLDOWN.shoulderCross);
  if (focusIncludes(focus, ["tricep", "push"])) out.push(COOLDOWN.tricepOverhead);
  if (focusIncludes(focus, ["back", "lat", "pull", "upper"])) out.push(COOLDOWN.latStretch);
  if (focusIncludes(focus, ["back", "pull"])) out.push(COOLDOWN.childsPose);
  if (focusIncludes(focus, ["bicep", "pull"])) out.push(COOLDOWN.bicepWall);
  if (focusIncludes(focus, ["quad", "leg", "lower"])) out.push(COOLDOWN.quadStanding);
  if (focusIncludes(focus, ["hamstring", "leg", "lower"])) out.push(COOLDOWN.hamstringLay);
  if (focusIncludes(focus, ["glute", "hip", "leg", "lower"])) out.push(COOLDOWN.pigeon);
  if (focusIncludes(focus, ["calf", "leg", "lower"])) out.push(COOLDOWN.calfWall);

  // Fallback: at least a general spine + glute stretch.
  if (out.length === 0) {
    out.push(COOLDOWN.childsPose, COOLDOWN.glutePretzel, COOLDOWN.catCowCool);
  }
  // Cap at 5 entries to keep cool-down under ~5 min total.
  return out.slice(0, 5);
}

// Convenience: get a single auto-picked warm-up if no specifics are saved.
// Used as a backwards-compat hook by the existing pickWarmupForDay() shim.
export function pickPrimaryWarmup(ctx: DayContext): StretchExercise {
  const list = pickWarmups(ctx);
  return list[0] ?? WARMUP_CARDIO.bike;
}

// Full flat arrays for the customise stretch-library picker.
export const ALL_WARMUPS: StretchExercise[] = [
  ...Object.values(WARMUP_CARDIO),
  ...Object.values(WARMUP_DYNAMIC),
];
export const ALL_COOLDOWNS: StretchExercise[] = Object.values(COOLDOWN);

// Look up by id (the warm-up/cool-down ids are stable across sessions).
export function findStretchById(id: string): StretchExercise | null {
  return ALL_WARMUPS.find(s => s.id === id) ?? ALL_COOLDOWNS.find(s => s.id === id) ?? null;
}
