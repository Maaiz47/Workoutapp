const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Locally-hosted custom stretch/warmup demos. Drop frames at
// /public/stretches/<id>/0.png and /1.png and add the id below to
// override the free-exercise-db lookup. Lets us ship demos for
// stretches that don't exist in the open library (doorway chest
// stretch, pigeon pose, figure-four, etc.). See PATCHLOG entry
// "Stretch form-image plan" for the generation prompts.
//
// 2026-05-22: shipped placeholder PNGs for 26 movements via
// scripts/generate-stretch-placeholders.ts — each pair is a black
// text card showing START / END instructions. Covers:
//   • 7 stretches not in the open library
//   • 12 plyometric / conditioning movements
//   • 7 movements that previously pointed to an unrelated DB entry
//     (jumping-jacks, burpees, high-knees, wall-sit, wall-slide,
//      terminal-knee-extension, bird-dog) — local now takes
//      precedence over the wrong DB mapping.
// To replace a pair with real photos, just overwrite the 0.png /
// 1.png files.
const LOCAL_STRETCH_IDS = new Set<string>([
  // Stretches / warmups
  "cd-chest-doorway",
  "cd-pigeon",
  "cd-hamstring-lay",
  "cd-lat-stretch",
  "cd-glute-pretzel",
  "wu-leg-swings",
  // The following ids are temporarily removed pending image
  // regeneration (qa: exercise-local-images; CLAUDE.md pending
  // reminder):
  //   • wu-scap-shrugs       — frames show a man standing, not plank scap push-up
  //   • cd-glute-pretzel     — frame 1 not a figure-four pull (single-knee-to-chest)
  //   • terminal-knee-extension — both frames identical (no motion shown)
  //   • high-knees           — frame 1 doesn't mirror frame 0, won't read as running
  // Each falls back to the emoji icon until correct frames land.
  // Re-add the id below once regenerated.
  // Plyometric / conditioning (no DB mapping)
  "bear-crawl",
  "broad-jump",
  "elliptical",
  "inchworm",
  "lateral-bounds",
  "lateral-shuffle",
  "plyo-pushup",
  "speed-skaters",
  "split-jumps",
  "squat-thrust",
  "star-jump",
  "tuck-jumps",
  // Previously wrong DB mapping — local placeholder is more accurate
  "jumping-jacks",
  "burpees",
  "wall-sit",
  "wall-slide",
  "bird-dog",
]);

// Centralized blacklist for remote free-exercise-db entries whose
// shipped frames don't actually depict the named exercise. Listing
// the DB id here pulls EVERY local id that maps to it (via
// EXERCISE_DB_MAP or NAME_OVERRIDES) back to the emoji fallback in
// one place, instead of tracking individual mapping rows. Reviewed
// frames go in here; once we ship correct local frames at
// /public/stretches/<id>/{0,1}.png we can remove the entry and add
// the id to LOCAL_STRETCH_IDS instead. (qa: form-preview-images-wrong)
const BROKEN_DB_MAPPINGS = new Set<string>([
  // Frames don't show hanging leg raise — wrong action depicted.
  // Flagged by @maaiz 2026-05-24.
  "Hanging_Leg_Raise",
  // Frames show a side-lying mat stretch, not a standing quad stretch
  // (which should be a single-leg balance pulling heel to glute).
  // Flagged by @maaiz 2026-05-24.
  "Quad_Stretch",
  // Plie_Dumbbell_Squat depicts a goblet-hold plie (weight in front,
  // toes wide). Our sumo-squat is the high-bar barbell sumo stance —
  // different setup. Only used by `sumo-squat` so blacklisting kills
  // just that mapping. (qa: exercise-audit-2026-05-27)
  "Plie_Dumbbell_Squat",
  // Thigh_Abductor depicts the seated abductor machine (straight-leg
  // hip abduction). Our `clamshell` is the side-lying hip external-
  // rotation drill — different movement pattern entirely. Only used
  // by `clamshell`. (qa: exercise-audit-2026-05-27)
  "Thigh_Abductor",
  // Barbell_Glute_Bridge depicts a barbell loaded across the hips. Our
  // `glute-bridge` is the BODYWEIGHT bridge (a no-equipment home move) —
  // showing a barbell misled a no-equipment user into thinking they needed
  // one (@amanii 2026-06-19). Only `glute-bridge` maps here (the loaded
  // variants use Barbell_Hip_Thrust), so blacklisting kills just that demo.
  // A bodyweight bilateral bridge isn't in the open DB — custom asset queued
  // in image-prompts-v2.md Batch 10. (qa: form-preview-equipment-mismatch)
  "Barbell_Glute_Bridge",
]);

export function getExerciseImageUrls(exerciseId: string, exerciseName?: string): [string, string] | null {
  if (LOCAL_STRETCH_IDS.has(exerciseId)) {
    return [`/stretches/${exerciseId}/0.png`, `/stretches/${exerciseId}/1.png`];
  }
  let dbId = EXERCISE_DB_MAP[exerciseId];
  if (!dbId && exerciseName) {
    const key = norm(exerciseName);
    for (const [ourId, id] of Object.entries(EXERCISE_DB_MAP)) {
      if (norm(ourId.replace(/-/g, " ")) === key) { dbId = id; break; }
    }
    if (!dbId) dbId = NAME_OVERRIDES[key];
  }
  if (!dbId) return null;
  // Known-wrong DB entry → emoji fallback. Single source of truth
  // so adding more wrong frames is a one-line change above.
  if (BROKEN_DB_MAPPINGS.has(dbId)) return null;
  return [
    `${BASE}/${encodeURIComponent(dbId)}/0.jpg`,
    `${BASE}/${encodeURIComponent(dbId)}/1.jpg`,
  ];
}

const NAME_OVERRIDES: Record<string, string> = {
  // Chest
  [norm("Flat Barbell Bench Press")]:          "Barbell_Bench_Press_-_Medium_Grip",
  [norm("Barbell Bench Press")]:               "Barbell_Bench_Press_-_Medium_Grip",
  [norm("Flat Bench Press")]:                  "Barbell_Bench_Press_-_Medium_Grip",
  [norm("Incline Barbell Bench Press")]:        "Barbell_Incline_Bench_Press_-_Medium_Grip",
  [norm("Incline Press")]:                     "Barbell_Incline_Bench_Press_-_Medium_Grip",
  [norm("Flat Dumbbell Press")]:               "Dumbbell_Bench_Press",
  [norm("Pec Deck / Machine Fly")]:            "Butterfly",
  [norm("Pec Deck Machine Fly")]:              "Butterfly",
  [norm("Machine Fly")]:                       "Butterfly",
  [norm("Cable Flyes")]:                       "Cable_Crossover",
  [norm("Cable Flyes (Low-to-High)")]:         "Low_Cable_Crossover",
  [norm("Cable Flyes Low-to-High")]:           "Low_Cable_Crossover",
  [norm("Low Cable Fly")]:                     "Low_Cable_Crossover",
  [norm("Low Cable Flyes")]:                   "Low_Cable_Crossover",
  [norm("Cable Flyes (High-to-Low)")]:         "Cable_Crossover",
  [norm("Cable Flyes High-to-Low")]:           "Cable_Crossover",
  // Back
  [norm("Barbell Bent-Over Row")]:             "Bent_Over_Barbell_Row",
  [norm("Bent Over Row")]:                     "Bent_Over_Barbell_Row",
  [norm("Bent-Over Row")]:                     "Bent_Over_Barbell_Row",
  [norm("Lat Pulldown (Wide)")]:               "Wide-Grip_Lat_Pulldown",
  [norm("Lat Pulldown Wide")]:                 "Wide-Grip_Lat_Pulldown",
  [norm("Wide Grip Lat Pulldown")]:            "Wide-Grip_Lat_Pulldown",
  [norm("Seated Cable Row (Close)")]:          "Seated_Cable_Rows",
  [norm("Seated Cable Row Close")]:            "Seated_Cable_Rows",
  [norm("Seated Row")]:                        "Seated_Cable_Rows",
  [norm("Cable Row")]:                         "Seated_Cable_Rows",
  [norm("T-Bar Row / Chest-Supported Row")]:   "T-Bar_Row_with_Handle",
  [norm("T-Bar Row")]:                         "T-Bar_Row_with_Handle",
  [norm("Chest Supported Row")]:               "T-Bar_Row_with_Handle",
  [norm("Straight-Arm Pulldown")]:             "Straight-Arm_Pulldown",
  [norm("RDL")]:                               "Romanian_Deadlift",
  [norm("Stiff Leg Deadlift")]:                "Romanian_Deadlift",
  [norm("DB Romanian Deadlift")]:              "Romanian_Deadlift",
  [norm("Dumbbell RDL")]:                      "Romanian_Deadlift",
  [norm("Pull-Ups / Assisted Pull-Ups")]:      "Pullups",
  [norm("Pull Ups")]:                          "Pullups",
  [norm("Pull-Ups")]:                          "Pullups",
  [norm("Assisted Pull-Ups")]:                 "Pullups",
  // Shoulders
  [norm("Overhead Press")]:                    "Barbell_Shoulder_Press",
  [norm("OHP")]:                               "Barbell_Shoulder_Press",
  [norm("Military Press")]:                    "Barbell_Shoulder_Press",
  [norm("Lateral Raises")]:                    "Side_Lateral_Raise",
  [norm("Side Lateral Raise")]:                "Side_Lateral_Raise",
  // Triceps
  [norm("Tricep Rope Pushdowns")]:             "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Tricep Rope Pushdown")]:              "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Rope Pushdown")]:                     "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Rope Pushdowns")]:                    "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Rope Tricep Pushdown")]:              "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Rope Triceps Pushdown")]:             "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Triceps Rope Pushdown")]:             "Triceps_Pushdown_-_Rope_Attachment",
  [norm("Tricep Pushdown")]:                   "Triceps_Pushdown",
  // "Overhead Tricep Extension" is the standing single-dumbbell variant
  // (one arm at a time, raised behind the head). The lying double-
  // dumbbell variant lives under "Double Dumbbell Skull Crusher" and
  // the EZ-bar variant under "EZ-Bar Skull Crusher".
  [norm("Overhead Tricep Extension")]:         "Standing_Dumbbell_Triceps_Extension",
  [norm("Single Arm Overhead Tricep Extension")]: "Standing_Dumbbell_Triceps_Extension",
  [norm("Standing Overhead Tricep Extension")]:   "Standing_Dumbbell_Triceps_Extension",
  [norm("Double Dumbbell Skull Crusher")]:     "Lying_Dumbbell_Tricep_Extension",
  [norm("Double Dumbbell Skull Crushers")]:    "Lying_Dumbbell_Tricep_Extension",
  [norm("Lying Dumbbell Tricep Extension")]:   "Lying_Dumbbell_Tricep_Extension",
  [norm("EZ Bar Skull Crusher")]:              "EZ-Bar_Skullcrusher",
  [norm("EZ-Bar Skull Crusher")]:              "EZ-Bar_Skullcrusher",
  [norm("EZ Bar Skull Crushers")]:             "EZ-Bar_Skullcrusher",
  [norm("EZ-Bar Skull Crushers")]:             "EZ-Bar_Skullcrusher",
  [norm("Z Bar Skull Crusher")]:               "EZ-Bar_Skullcrusher",
  [norm("Z-Bar Skull Crusher")]:               "EZ-Bar_Skullcrusher",
  [norm("Skull Crushers")]:                    "EZ-Bar_Skullcrusher",
  [norm("Skull Crusher")]:                     "EZ-Bar_Skullcrusher",
  [norm("Close-Grip Bench Press")]:            "Close-Grip_Barbell_Bench_Press",
  [norm("Close Grip Bench Press")]:            "Close-Grip_Barbell_Bench_Press",
  [norm("Tricep Dips (or Machine)")]:          "Dips_-_Triceps_Version",
  [norm("Tricep Dips")]:                       "Dips_-_Triceps_Version",
  [norm("Dips")]:                              "Dips_-_Triceps_Version",
  [norm("Push Ups")]:                          "Pushups",
  // Biceps
  [norm("Bicep Curl")]:                        "Barbell_Curl",
  [norm("Bicep Curls")]:                       "Barbell_Curl",
  [norm("Hammer Curls")]:                      "Hammer_Curls",
  [norm("Incline DB Curl")]:                   "Incline_Dumbbell_Curl",
  [norm("Cable Curl (Rope)")]:                 "Standing_Biceps_Cable_Curl",
  [norm("Cable Curl Rope")]:                   "Standing_Biceps_Cable_Curl",
  // Legs
  [norm("Back Squat")]:                        "Barbell_Squat",
  [norm("Barbell Back Squat")]:                "Barbell_Squat",
  [norm("Low Bar Squat")]:                     "Barbell_Squat",
  [norm("High Bar Squat")]:                    "Barbell_Squat",
  [norm("Squat")]:                             "Barbell_Squat",
  [norm("Deadlift")]:                          "Barbell_Deadlift",
  [norm("Conventional Deadlift")]:             "Barbell_Deadlift",
  [norm("Leg Curl Machine")]:                  "Lying_Leg_Curls",
  [norm("Standing Calf Raises")]:              "Standing_Dumbbell_Calf_Raise",
  [norm("Bulgarian Split Squat")]:             "Split_Squats",
  // Glutes
  [norm("Hip Thrust")]:                        "Barbell_Hip_Thrust",
  // Core
  [norm("Hanging Leg Raises")]:                "Hanging_Leg_Raise",
  [norm("Hanging Leg Raise")]:                 "Hanging_Leg_Raise",
  [norm("Face Pulls")]:                        "Face_Pull",
};

const EXERCISE_DB_MAP: Record<string, string> = {
  // ── WORKOUT_DATA short IDs (a1–e7) ──────────────────────────────────────
  "a1": "Barbell_Bench_Press_-_Medium_Grip",
  "a2": "Incline_Dumbbell_Press",
  "a3": "Low_Cable_Crossover",
  "a4": "Triceps_Pushdown_-_Rope_Attachment",
  "a5": "Lying_Dumbbell_Tricep_Extension",
  "a6": "Side_Lateral_Raise",
  "a7": "Hanging_Leg_Raise",
  "b1": "Bent_Over_Barbell_Row",
  "b2": "Wide-Grip_Lat_Pulldown",
  "b3": "Seated_Cable_Rows",
  "b4": "Barbell_Curl",
  "b5": "Incline_Dumbbell_Curl",
  "b6": "Hammer_Curls",
  "b7": "Face_Pull",
  "b8": "Cable_Crunch",
  "c1": "Barbell_Squat",
  "c2": "Romanian_Deadlift",
  "c3": "Leg_Press",
  "c4": "Split_Squats",
  "c5": "Lying_Leg_Curls",
  "c6": "Standing_Dumbbell_Calf_Raise",
  "c7": "Plank",
  "d1": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "d2": "Dumbbell_Bench_Press",
  "d3": "Butterfly",
  "d4": "Close-Grip_Barbell_Bench_Press",
  "d5": "Dips_-_Triceps_Version",
  "d6": "Side_Lateral_Raise",
  "d7": "Russian_Twist",
  "e1": "Pullups",
  "e2": "T-Bar_Row_with_Handle",
  "e3": "Straight-Arm_Pulldown",
  "e4": "EZ-Bar_Curl",
  "e5": "Standing_Biceps_Cable_Curl",
  "e6": "Face_Pull",
  "e7": "Air_Bike",

  // ── Chest ────────────────────────────────────────────────────────────────
  "barbell-bench-press":            "Barbell_Bench_Press_-_Medium_Grip",
  "incline-barbell-press":          "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "decline-barbell-press":          "Decline_Barbell_Bench_Press",
  "dumbbell-bench-press":           "Dumbbell_Bench_Press",
  "incline-dumbbell-press":         "Incline_Dumbbell_Press",
  "dumbbell-flyes":                 "Dumbbell_Flyes",
  "incline-dumbbell-flyes":         "Incline_Dumbbell_Flyes",
  "cable-crossover":                "Cable_Crossover",
  "chest-press-machine":            "Machine_Bench_Press",
  "pec-deck":                       "Butterfly",
  "chest-dips":                     "Dips_-_Chest_Version",
  "pushups":                        "Pushups",
  "wide-pushups":                   "Push-Up_Wide",
  "decline-pushups":                "Decline_Push-Up",
  "diamond-pushups":                "Pushups_Close_and_Wide_Hand_Positions",
  // resistance-band-chest-press — emoji fallback (was Barbell_Bench_Press: a
  //   band move should not show a barbell/bench). Custom band asset queued in
  //   image-prompts-v2.md Batch 10. (qa: form-preview-equipment-mismatch)

  // ── Back ─────────────────────────────────────────────────────────────────
  "barbell-deadlift":               "Barbell_Deadlift",
  "romanian-deadlift":              "Romanian_Deadlift",
  "romanian-deadlift-db":           "Romanian_Deadlift",
  "barbell-row":                    "Bent_Over_Barbell_Row",
  "t-bar-row":                      "T-Bar_Row_with_Handle",
  "seated-cable-row":               "Seated_Cable_Rows",
  "lat-pulldown":                   "Wide-Grip_Lat_Pulldown",
  "wide-grip-lat-pulldown":         "Wide-Grip_Lat_Pulldown",
  "single-arm-dumbbell-row":        "One-Arm_Dumbbell_Row",
  "face-pull":                      "Face_Pull",
  "straight-arm-pulldown":          "Straight-Arm_Pulldown",
  "barbell-shrugs":                 "Barbell_Shrug",
  "dumbbell-shrugs":                "Dumbbell_Shrug",
  "inverted-row":                   "Inverted_Row",
  "hyperextension":                 "Hyperextensions_With_No_Hyperextension_Bench",
  // resistance-band-pulldown / resistance-band-row — emoji fallback (were
  //   Wide-Grip_Lat_Pulldown / Bent_Over_Barbell_Row: cable/barbell demos for
  //   band moves). Custom band assets queued in image-prompts-v2.md Batch 10.
  //   (qa: form-preview-equipment-mismatch)

  // ── Shoulders ────────────────────────────────────────────────────────────
  "overhead-press":                 "Barbell_Shoulder_Press",
  "dumbbell-shoulder-press":        "Dumbbell_Shoulder_Press",
  "arnold-press":                   "Arnold_Dumbbell_Press",
  "lateral-raise":                  "Side_Lateral_Raise",
  "cable-lateral-raise":            "Bent_Over_Low-Pulley_Side_Lateral",
  "front-raise":                    "Front_Dumbbell_Raise",
  "upright-row":                    "Upright_Barbell_Row",
  "rear-delt-fly":                  "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "machine-shoulder-press":         "Machine_Shoulder_Military_Press",
  "shoulder-external-rotation":     "External_Rotation",
  // resistance-band-shoulder-press / resistance-band-lateral-raise — emoji
  //   fallback (were Barbell_Shoulder_Press / Side_Lateral_Raise: barbell/
  //   dumbbell demos for band moves). Custom band assets queued in
  //   image-prompts-v2.md Batch 10. (qa: form-preview-equipment-mismatch)

  // ── Biceps ───────────────────────────────────────────────────────────────
  "barbell-curl":                   "Barbell_Curl",
  "dumbbell-curl":                  "Dumbbell_Bicep_Curl",
  "hammer-curl":                    "Hammer_Curls",
  "incline-dumbbell-curl":          "Incline_Dumbbell_Curl",
  "concentration-curl":             "Concentration_Curls",
  "preacher-curl":                  "Preacher_Curl",
  "ez-bar-curl":                    "EZ-Bar_Curl",
  "cable-curl":                     "Standing_Biceps_Cable_Curl",
  "chinups":                        "Chin-Up",
  // resistance-band-curl — emoji fallback (was Barbell_Curl). Custom band
  //   asset queued in image-prompts-v2.md Batch 10. (qa: form-preview-equipment-mismatch)

  // ── Triceps ──────────────────────────────────────────────────────────────
  "close-grip-bench":               "Close-Grip_Barbell_Bench_Press",
  "overhead-tricep-extension":      "Standing_Dumbbell_Triceps_Extension",
  "tricep-pushdown":                "Triceps_Pushdown",
  "skull-crushers":                 "EZ-Bar_Skullcrusher",
  "double-dumbbell-skull-crushers": "Lying_Dumbbell_Tricep_Extension",
  "tricep-kickback":                "Tricep_Dumbbell_Kickback",
  "tricep-dips":                    "Dips_-_Triceps_Version",
  "bench-dips":                     "Bench_Dips",
  // resistance-band-pushdown — emoji fallback (was Triceps_Pushdown: a cable
  //   demo). Custom band asset queued in image-prompts-v2.md Batch 10.
  //   (qa: form-preview-equipment-mismatch)

  // ── Legs ─────────────────────────────────────────────────────────────────
  "barbell-squat":                  "Barbell_Squat",
  "front-squat":                    "Front_Barbell_Squat",
  "sumo-squat":                     "Plie_Dumbbell_Squat",
  "hack-squat":                     "Hack_Squat",
  "goblet-squat":                   "Goblet_Squat",
  "leg-press":                      "Leg_Press",
  "leg-extension":                  "Leg_Extensions",
  "leg-curl":                       "Lying_Leg_Curls",
  "lunges":                         "Barbell_Lunge",
  "bulgarian-split-squat":          "Split_Squats",
  "sumo-deadlift":                  "Sumo_Deadlift",
  "bodyweight-squat":               "Bodyweight_Squat",
  "jump-squat":                     "Freehand_Jump_Squat",
  "box-jumps":                      "Front_Box_Jump",
  "step-ups":                       "Barbell_Step_Ups",
  "nordic-curl":                    "Natural_Glute_Ham_Raise",
  // resistance-band-squat — emoji fallback (was Barbell_Squat). Custom band
  //   asset queued in image-prompts-v2.md Batch 10. (qa: form-preview-equipment-mismatch)

  // ── Glutes ───────────────────────────────────────────────────────────────
  "hip-thrust-barbell":             "Barbell_Hip_Thrust",
  "hip-thrust-db":                  "Barbell_Hip_Thrust",
  "glute-bridge":                   "Barbell_Glute_Bridge",
  "donkey-kick":                    "Glute_Kickback",
  "glute-kickback":                 "Glute_Kickback",
  "clamshell":                      "Thigh_Abductor",
  "resistance-band-hip-abduction":  "Band_Hip_Adductions",

  // ── Calves ───────────────────────────────────────────────────────────────
  "standing-calf-raise":            "Standing_Dumbbell_Calf_Raise",
  "seated-calf-raise":              "Seated_Calf_Raise",
  "dumbbell-calf-raise":            "Standing_Dumbbell_Calf_Raise",

  // ── Abs / Core ───────────────────────────────────────────────────────────
  "crunches":                       "Crunches",
  "plank":                          "Plank",
  "side-plank":                     "Side_Bridge",
  "leg-raises":                     "Hanging_Leg_Raise",
  "hanging-leg-raise":              "Hanging_Leg_Raise",
  "russian-twist":                  "Russian_Twist",
  "bicycle-crunch":                 "Air_Bike",
  "cable-crunch":                   "Cable_Crunch",
  "v-ups":                          "Jackknife_Sit-Up",
  "mountain-climbers":              "Mountain_Climbers",
  "ab-rollout":                     "Barbell_Ab_Rollout",
  "toe-touches":                    "Toe_Touchers",
  "dead-bug":                       "Dead_Bug",
  // bird-dog uses a local placeholder (was wrongly mapped to Dead_Bug,
  //   which is a different supine exercise).
  "straight-leg-raise":             "Flat_Bench_Lying_Leg_Raise",
  "superman":                       "Superman",

  // ── Cardio / Full body ───────────────────────────────────────────────────
  // jumping-jacks, burpees, high-knees — local placeholders (no good
  //   DB match); previously mapped to Air_Bike / Mountain_Climbers
  //   which were semantically wrong.
  "jump-rope":                      "Rope_Jumping",
  "pullups":                        "Pullups",
  "rowing-machine":                 "Rowing_Stationary",
  "treadmill":                      "Jogging_Treadmill",
  "cycling":                        "Bicycling_Stationary",

  // ── Misc ─────────────────────────────────────────────────────────────────
  // wall-sit, wall-slide, terminal-knee-extension — local placeholders
  //   (previously mapped to unrelated Plank / External_Rotation /
  //   Lying_Leg_Curls, which showed the wrong movement entirely).
  "good-morning":                   "Good_Morning",
  "pike-pushup":                    "Pushups",

  // ── Warmups (lib/stretching.ts → ALL_WARMUPS) ───────────────────────────
  // Maps each warmup's `id` to a free-exercise-db model so the FORM
  // modal animates a real demo instead of falling back to the
  // decorative chained-circles icon. Missing entries fall through to
  // the icon (logged in PATCHLOG plan for sourcing).
  "wu-treadmill":                   "Jogging_Treadmill",
  "wu-rower":                       "Rowing_Stationary",
  "wu-bike":                        "Bicycling_Stationary",
  "wu-arm-circles":                 "Arm_Circles",
  "wu-band-pullapart":              "Band_Pull_Apart",
  "wu-hip-openers":                 "Worlds_Greatest_Stretch",
  "wu-cat-cow":                     "Cat_Stretch",
  "wu-bw-squat":                    "Bodyweight_Squat",
  "wu-inchworm":                    "Inchworm",
  // wu-leg-swings, wu-scap-shrugs — pending custom asset (see PATCHLOG)

  // ── Cooldowns / Stretches (lib/stretching.ts → ALL_COOLDOWNS) ───────────
  "cd-childs-pose":                 "Childs_Pose",
  "cd-quad-standing":               "Quad_Stretch",
  "cd-calf-wall":                   "Calf_Stretch_Hands_Against_Wall",
  "cd-tri-overhead":                "Triceps_Stretch",
  "cd-bicep-wall":                  "Standing_Biceps_Stretch",
  "cd-cat-cow":                     "Cat_Stretch",
  "cd-shoulder-cross":              "Shoulder_Stretch",
  // cd-chest-doorway, cd-pigeon, cd-hamstring-lay, cd-lat-stretch,
  // cd-glute-pretzel — pending custom asset (see PATCHLOG)
};
