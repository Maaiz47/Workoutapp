export type Equipment =
  | "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight"
  | "pullup_bar" | "bench" | "kettlebell" | "resistance_band" | "dip_bar";

export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "biceps" | "triceps"
  | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "cardio" | "forearms";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ExerciseType = "compound" | "isolation" | "isometric" | "cardio";
export type Location = "gym" | "home" | "both";
export type Goal = "muscle" | "strength" | "fat_loss" | "fitness";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  location: Location;
  difficulty: Difficulty;
  type: ExerciseType;
  goals: Goal[];
  hiit?: boolean;
}

export const EXERCISES: Exercise[] = [

  // ── CHEST ──────────────────────────────────────────────────────────────

  { id: "barbell-bench-press", name: "Barbell Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "incline-barbell-press", name: "Incline Barbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "decline-barbell-press", name: "Decline Barbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "dumbbell-bench-press", name: "Dumbbell Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["dumbbell", "bench"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "strength", "fitness"] },
  { id: "incline-dumbbell-press", name: "Incline Dumbbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["dumbbell", "bench"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "dumbbell-flyes", name: "Dumbbell Flyes", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "incline-dumbbell-flyes", name: "Incline Dumbbell Flyes", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "cable-crossover", name: "Cable Crossover", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "chest-press-machine", name: "Chest Press Machine", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "pec-deck", name: "Pec Deck Machine", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "chest-dips", name: "Chest Dips", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], equipment: ["dip_bar"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "pushups", name: "Push-Ups", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps", "core"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "wide-pushups", name: "Wide Push-Ups", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "decline-pushups", name: "Decline Push-Ups", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "fitness"] },
  { id: "diamond-pushups", name: "Diamond Push-Ups", primaryMuscles: ["triceps"], secondaryMuscles: ["chest"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "fitness"] },
  { id: "resistance-band-chest-press", name: "Resistance Band Chest Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },

  // ── BACK ───────────────────────────────────────────────────────────────

  { id: "barbell-deadlift", name: "Barbell Deadlift", primaryMuscles: ["back"], secondaryMuscles: ["hamstrings", "glutes", "core", "forearms"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },
  { id: "romanian-deadlift", name: "Romanian Deadlift", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["back"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "barbell-row", name: "Barbell Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "shoulders", "forearms"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "t-bar-row", name: "T-Bar Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["machine"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "seated-cable-row", name: "Seated Cable Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "lat-pulldown", name: "Lat Pulldown", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "wide-grip-lat-pulldown", name: "Wide Grip Lat Pulldown", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle"] },
  { id: "single-arm-dumbbell-row", name: "Single-Arm Dumbbell Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "face-pull", name: "Face Pull", primaryMuscles: ["shoulders", "back"], secondaryMuscles: ["biceps"], equipment: ["cable", "resistance_band"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "straight-arm-pulldown", name: "Straight Arm Pulldown", primaryMuscles: ["back"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "barbell-shrugs", name: "Barbell Shrugs", primaryMuscles: ["back"], secondaryMuscles: [], equipment: ["barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "dumbbell-shrugs", name: "Dumbbell Shrugs", primaryMuscles: ["back"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "hyperextension", name: "Back Extension", primaryMuscles: ["back"], secondaryMuscles: ["glutes", "hamstrings"], equipment: ["machine", "bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "pullups", name: "Pull-Ups", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "forearms"], equipment: ["pullup_bar"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength", "fitness"] },
  { id: "chinups", name: "Chin-Ups", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "forearms"], equipment: ["pullup_bar"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "inverted-row", name: "Inverted Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "core"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "superman", name: "Superman Hold", primaryMuscles: ["back"], secondaryMuscles: ["glutes"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isometric", goals: ["fitness"] },
  { id: "resistance-band-row", name: "Resistance Band Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "resistance-band-pulldown", name: "Resistance Band Pulldown", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "compound", goals: ["fitness"] },

  // ── SHOULDERS ──────────────────────────────────────────────────────────

  { id: "overhead-press", name: "Barbell Overhead Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps", "core"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },
  { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "arnold-press", name: "Arnold Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: ["dumbbell"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle"] },
  { id: "lateral-raise", name: "Lateral Raise", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "front-raise", name: "Front Raise", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: ["dumbbell", "barbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "rear-delt-fly", name: "Rear Delt Fly", primaryMuscles: ["shoulders", "back"], secondaryMuscles: [], equipment: ["dumbbell", "cable"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "machine-shoulder-press", name: "Machine Shoulder Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "upright-row", name: "Upright Row", primaryMuscles: ["shoulders"], secondaryMuscles: ["biceps", "back"], equipment: ["barbell", "cable"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle"] },
  { id: "pike-pushup", name: "Pike Push-Up", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["fitness", "muscle"] },
  { id: "resistance-band-lateral-raise", name: "Resistance Band Lateral Raise", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "resistance-band-shoulder-press", name: "Resistance Band Shoulder Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "compound", goals: ["fitness"] },

  // ── BICEPS ─────────────────────────────────────────────────────────────

  { id: "barbell-curl", name: "Barbell Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "strength"] },
  { id: "dumbbell-curl", name: "Dumbbell Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "hammer-curl", name: "Hammer Curl", primaryMuscles: ["biceps", "forearms"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "incline-dumbbell-curl", name: "Incline Dumbbell Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], location: "both", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "concentration-curl", name: "Concentration Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "cable-curl", name: "Cable Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "preacher-curl", name: "Preacher Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["machine", "barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "ez-bar-curl", name: "EZ Bar Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "resistance-band-curl", name: "Resistance Band Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },

  // ── TRICEPS ────────────────────────────────────────────────────────────

  { id: "close-grip-bench", name: "Close Grip Bench Press", primaryMuscles: ["triceps"], secondaryMuscles: ["chest"], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "skull-crushers", name: "Skull Crushers", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "tricep-pushdown", name: "Tricep Pushdown", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "overhead-tricep-extension", name: "Overhead Tricep Extension", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["dumbbell", "cable"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "tricep-dips", name: "Tricep Dips", primaryMuscles: ["triceps"], secondaryMuscles: ["chest", "shoulders"], equipment: ["dip_bar", "bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength", "fitness"] },
  { id: "tricep-kickback", name: "Tricep Kickback", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "bench-dips", name: "Bench Dips", primaryMuscles: ["triceps"], secondaryMuscles: ["shoulders"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "resistance-band-pushdown", name: "Resistance Band Pushdown", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },

  // ── LEGS — QUADS ───────────────────────────────────────────────────────

  { id: "barbell-squat", name: "Barbell Back Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings", "core"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },
  { id: "front-squat", name: "Front Squat", primaryMuscles: ["quads"], secondaryMuscles: ["core", "glutes"], equipment: ["barbell"], location: "gym", difficulty: "advanced", type: "compound", goals: ["strength", "muscle"] },
  { id: "leg-press", name: "Leg Press", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "hack-squat", name: "Hack Squat Machine", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: ["machine"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle"] },
  { id: "leg-extension", name: "Leg Extension", primaryMuscles: ["quads"], secondaryMuscles: [], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "lunges", name: "Dumbbell Lunges", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness", "fat_loss"] },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], equipment: ["dumbbell", "bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["muscle", "fitness"] },
  { id: "goblet-squat", name: "Goblet Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "core"], equipment: ["dumbbell", "kettlebell"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "bodyweight-squat", name: "Bodyweight Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "jump-squat", name: "Jump Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "calves"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "compound", goals: ["fitness", "fat_loss"], hiit: true },
  { id: "step-ups", name: "Step-Ups", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: ["bodyweight", "dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "wall-sit", name: "Wall Sit", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isometric", goals: ["fitness"] },
  { id: "sumo-squat", name: "Sumo Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], equipment: ["bodyweight", "dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "resistance-band-squat", name: "Resistance Band Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },

  // ── LEGS — HAMSTRINGS / GLUTES ─────────────────────────────────────────

  { id: "leg-curl", name: "Leg Curl Machine", primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "romanian-deadlift-db", name: "Dumbbell Romanian Deadlift", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["back"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "glute-bridge", name: "Glute Bridge", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "compound", goals: ["fitness", "fat_loss"] },
  { id: "hip-thrust-barbell", name: "Barbell Hip Thrust", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["barbell", "bench"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle"] },
  { id: "hip-thrust-db", name: "Dumbbell Hip Thrust", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["dumbbell", "bench"], location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "glute-kickback", name: "Cable Glute Kickback", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["cable", "resistance_band"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "sumo-deadlift", name: "Sumo Deadlift", primaryMuscles: ["glutes", "hamstrings"], secondaryMuscles: ["back", "quads"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },
  { id: "nordic-curl", name: "Nordic Curl", primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "advanced", type: "isolation", goals: ["strength", "muscle"] },
  { id: "donkey-kick", name: "Donkey Kick", primaryMuscles: ["glutes"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "good-morning", name: "Good Morning", primaryMuscles: ["hamstrings", "back"], secondaryMuscles: ["glutes"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },

  // ── CALVES ─────────────────────────────────────────────────────────────

  { id: "standing-calf-raise", name: "Standing Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["machine", "bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "seated-calf-raise", name: "Seated Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "dumbbell-calf-raise", name: "Dumbbell Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "jump-rope", name: "Jump Rope", primaryMuscles: ["calves", "cardio"], secondaryMuscles: ["core"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },

  // ── CORE ───────────────────────────────────────────────────────────────

  { id: "plank", name: "Plank", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isometric", goals: ["fitness", "fat_loss", "muscle"] },
  { id: "side-plank", name: "Side Plank", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isometric", goals: ["fitness", "fat_loss"] },
  { id: "crunches", name: "Crunches", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "bicycle-crunch", name: "Bicycle Crunches", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "leg-raises", name: "Lying Leg Raises", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["pullup_bar"], location: "both", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "russian-twist", name: "Russian Twists", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight", "dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "ab-rollout", name: "Ab Rollout", primaryMuscles: ["core"], secondaryMuscles: ["back"], equipment: ["machine"], location: "gym", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "cable-crunch", name: "Cable Crunch", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "mountain-climbers", name: "Mountain Climbers", primaryMuscles: ["core"], secondaryMuscles: ["cardio"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "dead-bug", name: "Dead Bug", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "v-ups", name: "V-Ups", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "toe-touches", name: "Toe Touches", primaryMuscles: ["core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },

  // ── REHAB / CORRECTIVE ─────────────────────────────────────────────────

  { id: "bird-dog", name: "Bird Dog", primaryMuscles: ["core"], secondaryMuscles: ["back", "glutes"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isometric", goals: ["fitness"] },
  { id: "clamshell", name: "Clamshell", primaryMuscles: ["glutes"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "resistance-band-hip-abduction", name: "Resistance Band Hip Abduction", primaryMuscles: ["glutes"], secondaryMuscles: [], equipment: ["resistance_band", "bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "shoulder-external-rotation", name: "Shoulder External Rotation", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: ["resistance_band", "dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "wall-slide", name: "Wall Slide", primaryMuscles: ["shoulders"], secondaryMuscles: ["back"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "straight-leg-raise", name: "Straight Leg Raise", primaryMuscles: ["quads", "core"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },
  { id: "terminal-knee-extension", name: "Terminal Knee Extension", primaryMuscles: ["quads"], secondaryMuscles: [], equipment: ["resistance_band", "bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness"] },

  // ── CARDIO / CONDITIONING ──────────────────────────────────────────────

  { id: "burpees",       name: "Burpees",       primaryMuscles: ["cardio"], secondaryMuscles: ["chest", "core", "quads"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "high-knees",   name: "High Knees",   primaryMuscles: ["cardio"], secondaryMuscles: ["core"],           equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "box-jumps",    name: "Box Jumps",    primaryMuscles: ["quads", "calves"], secondaryMuscles: ["glutes"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fitness", "fat_loss"],  hiit: true },
  { id: "treadmill",    name: "Treadmill",    primaryMuscles: ["cardio"], secondaryMuscles: [],                  equipment: ["machine"],    location: "gym",  difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "cycling",      name: "Stationary Bike", primaryMuscles: ["cardio"], secondaryMuscles: ["quads"],       equipment: ["machine"],    location: "gym",  difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "rowing-machine", name: "Rowing Machine", primaryMuscles: ["cardio", "back"], secondaryMuscles: ["core"], equipment: ["machine"], location: "gym",  difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "jumping-jacks", name: "Jumping Jacks", primaryMuscles: ["cardio"], secondaryMuscles: [],               equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },

  // ── HIIT ───────────────────────────────────────────────────────────────

  { id: "tuck-jumps",      name: "Tuck Jumps",      primaryMuscles: ["quads", "cardio"],   secondaryMuscles: ["core", "calves"],           equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "split-jumps",     name: "Split Jumps",     primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["cardio", "calves"],          equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "speed-skaters",   name: "Speed Skaters",   primaryMuscles: ["glutes", "cardio"],  secondaryMuscles: ["quads", "core"],             equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "plyo-pushup",     name: "Plyo Push-Up",    primaryMuscles: ["chest", "cardio"],   secondaryMuscles: ["shoulders", "triceps", "core"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "bear-crawl",      name: "Bear Crawl",      primaryMuscles: ["core", "shoulders"], secondaryMuscles: ["quads", "chest"],            equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
  { id: "inchworm",        name: "Inchworm",        primaryMuscles: ["core", "shoulders"], secondaryMuscles: ["hamstrings", "chest"],        equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
  { id: "lateral-bounds",  name: "Lateral Bounds",  primaryMuscles: ["glutes", "quads"],   secondaryMuscles: ["cardio", "calves"],          equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "broad-jump",      name: "Broad Jump",      primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["cardio", "calves"],          equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "squat-thrust",    name: "Squat Thrust",    primaryMuscles: ["quads", "cardio"],   secondaryMuscles: ["core", "glutes"],            equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "star-jump",       name: "Star Jump",       primaryMuscles: ["cardio"],            secondaryMuscles: ["quads", "shoulders"],        equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "lateral-shuffle", name: "Lateral Shuffle", primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["cardio", "calves"],          equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find(e => e.id === id);
}

export function filterExercises(opts: {
  primaryMuscle?: MuscleGroup;
  equipment?: Equipment[];
  location?: Location;
  difficulty?: Difficulty[];
  type?: ExerciseType;
  goal?: Goal;
}): Exercise[] {
  return EXERCISES.filter(ex => {
    if (opts.primaryMuscle && !ex.primaryMuscles.includes(opts.primaryMuscle)) return false;
    if (opts.location && ex.location !== "both" && ex.location !== opts.location) return false;
    if (opts.equipment && opts.equipment.length > 0) {
      const hasEquipment = ex.equipment.some(eq => eq === "bodyweight" || opts.equipment!.includes(eq));
      if (!hasEquipment) return false;
    }
    if (opts.difficulty && !opts.difficulty.includes(ex.difficulty)) return false;
    if (opts.type && ex.type !== opts.type) return false;
    if (opts.goal && !ex.goals.includes(opts.goal)) return false;
    return true;
  });
}
