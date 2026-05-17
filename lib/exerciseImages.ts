const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export function getExerciseImageUrls(exerciseId: string): [string, string] | null {
  const dbId = EXERCISE_DB_MAP[exerciseId];
  if (!dbId) return null;
  return [
    `${BASE}/${encodeURIComponent(dbId)}/0.jpg`,
    `${BASE}/${encodeURIComponent(dbId)}/1.jpg`,
  ];
}

const EXERCISE_DB_MAP: Record<string, string> = {
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
