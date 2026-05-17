const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getExerciseImageUrls(exerciseId: string, exerciseName?: string): [string, string] | null {
  let dbId = EXERCISE_DB_MAP[exerciseId];
  if (!dbId && exerciseName) {
    const key = norm(exerciseName);
    for (const [ourId, id] of Object.entries(EXERCISE_DB_MAP)) {
      if (norm(ourId.replace(/-/g, " ")) === key) { dbId = id; break; }
    }
    if (!dbId) dbId = NAME_OVERRIDES[key];
  }
  if (!dbId) return null;
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
  [norm("Pec Deck / Machine Fly")]:            "Pec_Deck_Fly",
  [norm("Pec Deck Machine Fly")]:              "Pec_Deck_Fly",
  [norm("Machine Fly")]:                       "Pec_Deck_Fly",
  [norm("Cable Flyes")]:                       "Cable_Crossover",
  [norm("Cable Flyes (Low-to-High)")]:         "Cable_Crossover",
  [norm("Cable Flyes Low-to-High")]:           "Cable_Crossover",
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
  [norm("T-Bar Row / Chest-Supported Row")]:   "T-Bar_Row",
  [norm("T-Bar Row")]:                         "T-Bar_Row",
  [norm("Chest Supported Row")]:               "T-Bar_Row",
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
  [norm("Tricep Rope Pushdowns")]:             "Tricep_Pushdown",
  [norm("Rope Pushdown")]:                     "Tricep_Pushdown",
  [norm("Rope Tricep Pushdown")]:              "Tricep_Pushdown",
  [norm("Tricep Pushdown")]:                   "Tricep_Pushdown",
  [norm("Overhead Tricep Extension")]:         "Dumbbell_Lying_Triceps_Extension",
  [norm("Close-Grip Bench Press")]:            "Close-Grip_Barbell_Bench_Press",
  [norm("Close Grip Bench Press")]:            "Close-Grip_Barbell_Bench_Press",
  [norm("Tricep Dips (or Machine)")]:          "Dips_-_Triceps_Version",
  [norm("Tricep Dips")]:                       "Dips_-_Triceps_Version",
  [norm("Dips")]:                              "Dips_-_Triceps_Version",
  [norm("Push Ups")]:                          "Pushups",
  // Biceps
  [norm("Bicep Curl")]:                        "Barbell_Curl",
  [norm("Bicep Curls")]:                       "Barbell_Curl",
  [norm("Hammer Curls")]:                      "Hammer_Curl",
  [norm("Incline DB Curl")]:                   "Incline_Dumbbell_Curl",
  [norm("Cable Curl (Rope)")]:                 "Cable_Curl",
  [norm("Cable Curl Rope")]:                   "Cable_Curl",
  // Legs
  [norm("Back Squat")]:                        "Barbell_Squat",
  [norm("Barbell Back Squat")]:                "Barbell_Squat",
  [norm("Low Bar Squat")]:                     "Barbell_Squat",
  [norm("High Bar Squat")]:                    "Barbell_Squat",
  [norm("Squat")]:                             "Barbell_Squat",
  [norm("Deadlift")]:                          "Barbell_Deadlift",
  [norm("Conventional Deadlift")]:             "Barbell_Deadlift",
  [norm("Leg Curl Machine")]:                  "Leg_Curl",
  [norm("Standing Calf Raises")]:              "Standing_Dumbbell_Calf_Raise",
  // Glutes
  [norm("Hip Thrust")]:                        "Barbell_Hip_Thrust",
  // Core
  [norm("Hanging Leg Raises")]:                "Hanging_Leg-Hip_Raise",
  [norm("Hanging Leg Raise")]:                 "Hanging_Leg-Hip_Raise",
  [norm("Face Pulls")]:                        "Face_Pull",
};

// Call norm() at module load — values computed once
Object.keys(NAME_OVERRIDES).forEach(() => {});

const EXERCISE_DB_MAP: Record<string, string> = {
  // ── WORKOUT_DATA short IDs (a1–e7) ──────────────────────────────────────
  "a1": "Barbell_Bench_Press_-_Medium_Grip",
  "a2": "Incline_Dumbbell_Press",
  "a3": "Cable_Crossover",
  "a4": "Tricep_Pushdown",
  "a5": "Dumbbell_Lying_Triceps_Extension",
  "a6": "Side_Lateral_Raise",
  "a7": "Hanging_Leg-Hip_Raise",
  "b1": "Bent_Over_Barbell_Row",
  "b2": "Wide-Grip_Lat_Pulldown",
  "b3": "Seated_Cable_Rows",
  "b4": "Barbell_Curl",
  "b5": "Incline_Dumbbell_Curl",
  "b6": "Hammer_Curl",
  "b7": "Face_Pull",
  "b8": "Hanging_Leg-Hip_Raise",
  "c1": "Barbell_Squat",
  "c2": "Romanian_Deadlift",
  "c3": "Leg_Press",
  "c4": "Bulgarian_Split_Squat",
  "c5": "Leg_Curl",
  "c6": "Standing_Dumbbell_Calf_Raise",
  "c7": "Hanging_Leg-Hip_Raise",
  "d1": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "d2": "Dumbbell_Bench_Press",
  "d3": "Pec_Deck_Fly",
  "d4": "Close-Grip_Barbell_Bench_Press",
  "d5": "Dips_-_Triceps_Version",
  "d6": "Side_Lateral_Raise",
  "d7": "Hanging_Leg-Hip_Raise",
  "e1": "Pullups",
  "e2": "T-Bar_Row",
  "e3": "Straight-Arm_Pulldown",
  "e4": "EZ-Bar_Curl",
  "e5": "Cable_Curl",
  "e6": "Face_Pull",
  "e7": "Hanging_Leg-Hip_Raise",

  // ── Named IDs ────────────────────────────────────────────────────────────
  // Chest
  "barbell-bench-press":            "Barbell_Bench_Press_-_Medium_Grip",
  "incline-barbell-press":          "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "decline-barbell-press":          "Decline_Barbell_Bench_Press",
  "dumbbell-bench-press":           "Dumbbell_Bench_Press",
  "incline-dumbbell-press":         "Incline_Dumbbell_Press",
  "dumbbell-flyes":                 "Dumbbell_Flyes",
  "incline-dumbbell-flyes":         "Incline_Dumbbell_Flyes",
  "cable-crossover":                "Cable_Crossover",
  "chest-press-machine":            "Chest_Press",
  "pec-deck":                       "Pec_Deck_Fly",
  "chest-dips":                     "Dips_-_Chest_Version",
  "pushups":                        "Pushups",
  "wide-pushups":                   "Wide_Push-Ups",
  "decline-pushups":                "Decline_Push-up",
  "diamond-pushups":                "Diamond_Pushups",
  "resistance-band-chest-press":    "Resistance_Band_Chest_Press",

  // Back
  "barbell-deadlift":               "Barbell_Deadlift",
  "romanian-deadlift":              "Romanian_Deadlift",
  "romanian-deadlift-db":           "Romanian_Deadlift",
  "barbell-row":                    "Bent_Over_Barbell_Row",
  "t-bar-row":                      "T-Bar_Row",
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
  "resistance-band-row":            "Resistance_Band_Straight-Leg_Deadlift",

  // Shoulders
  "overhead-press":                 "Barbell_Shoulder_Press",
  "dumbbell-shoulder-press":        "Dumbbell_Shoulder_Press",
  "arnold-press":                   "Arnold_Dumbbell_Press",
  "lateral-raise":                  "Side_Lateral_Raise",
  "cable-lateral-raise":            "Cable_Lateral_Raise",
  "front-raise":                    "Front_Dumbbell_Raise",
  "upright-row":                    "Barbell_Upright_Row",
  "rear-delt-fly":                  "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "machine-shoulder-press":         "Machine_Shoulder_Press",
  "shoulder-external-rotation":     "Shoulder_External_Rotation",
  "resistance-band-shoulder-press": "Resistance_Band_Shoulder_Press",
  "resistance-band-lateral-raise":  "Resistance_Band_Lateral_Raise",

  // Biceps
  "barbell-curl":                   "Barbell_Curl",
  "dumbbell-curl":                  "Dumbbell_Curl",
  "hammer-curl":                    "Hammer_Curl",
  "incline-dumbbell-curl":          "Incline_Dumbbell_Curl",
  "concentration-curl":             "Concentration_Curl",
  "preacher-curl":                  "Preacher_Curl",
  "ez-bar-curl":                    "EZ-Bar_Curl",
  "cable-curl":                     "Cable_Curl",
  "chinups":                        "Chin-Up",
  "resistance-band-curl":           "Resistance_Band_Curl",

  // Triceps
  "close-grip-bench":               "Close-Grip_Barbell_Bench_Press",
  "overhead-tricep-extension":      "Dumbbell_Lying_Triceps_Extension",
  "tricep-pushdown":                "Tricep_Pushdown",
  "skull-crushers":                 "EZ-Bar_Skullcrusher",
  "tricep-kickback":                "Tricep_Dumbbell_Kickback",
  "tricep-dips":                    "Dips_-_Triceps_Version",
  "bench-dips":                     "Bench_Dips",
  "resistance-band-pushdown":       "Resistance_Band_Pushdown",

  // Legs
  "barbell-squat":                  "Barbell_Squat",
  "front-squat":                    "Barbell_Front_Squat",
  "sumo-squat":                     "Plie_Squat",
  "hack-squat":                     "Hack_Squat",
  "goblet-squat":                   "Goblet_Squat",
  "leg-press":                      "Leg_Press",
  "leg-extension":                  "Leg_Extensions",
  "leg-curl":                       "Leg_Curl",
  "lunges":                         "Barbell_Lunge",
  "bulgarian-split-squat":          "Bulgarian_Split_Squat",
  "sumo-deadlift":                  "Sumo_Deadlift",
  "bodyweight-squat":               "Bodyweight_Squat",
  "jump-squat":                     "Jump_Squat",
  "box-jumps":                      "Box_Jump",
  "step-ups":                       "Barbell_Step_Ups",
  "nordic-curl":                    "Natural_Glute_Ham_Raise",
  "resistance-band-squat":          "Resistance_Band_Squat",

  // Glutes
  "hip-thrust-barbell":             "Barbell_Hip_Thrust",
  "hip-thrust-db":                  "Barbell_Hip_Thrust",
  "glute-bridge":                   "Glute_Bridge",
  "donkey-kick":                    "Donkey_Kick",
  "glute-kickback":                 "Cable_Hip_Adduction",
  "clamshell":                      "Clamshell",
  "resistance-band-hip-abduction":  "Band_Hip_Adductions",

  // Calves
  "standing-calf-raise":            "Standing_Dumbbell_Calf_Raise",
  "seated-calf-raise":              "Seated_Calf_Raise",
  "dumbbell-calf-raise":            "Seated_Calf_Raise",

  // Abs / Core
  "crunches":                       "Crunch",
  "plank":                          "Plank",
  "side-plank":                     "Side_Bridge",
  "leg-raises":                     "Hanging_Leg-Hip_Raise",
  "hanging-leg-raise":              "Hanging_Leg-Hip_Raise",
  "russian-twist":                  "Russian_Twist",
  "bicycle-crunch":                 "Bicycle_Crunch",
  "cable-crunch":                   "Cable_Crunch",
  "v-ups":                          "V_Up",
  "mountain-climbers":              "Mountain_Climber",
  "ab-rollout":                     "Barbell_Ab_Rollout",
  "toe-touches":                    "Toe_Touches",
  "dead-bug":                       "Dead_Bug",
  "bird-dog":                       "Bird_Dog",
  "straight-leg-raise":             "Straight_Leg_Raise",
  "superman":                       "Superman",

  // Cardio / Full body
  "jumping-jacks":                  "Jumping_Jacks",
  "burpees":                        "Burpees",
  "high-knees":                     "High_Knees",
  "jump-rope":                      "Jump_Rope",
  "pullups":                        "Pullups",
  "rowing-machine":                 "Rowing,_Stationary",
  "treadmill":                      "Treadmill",
  "cycling":                        "Bicycling,_Stationary",

  // Misc
  "wall-sit":                       "Wall_Squat",
  "wall-slide":                     "Wall_Slide",
  "good-morning":                   "Good_Morning",
  "pike-pushup":                    "Pike_Push-up",
  "terminal-knee-extension":        "Terminal_Knee_Extension",
};
