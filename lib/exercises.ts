export type Equipment =
  | "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight"
  | "pullup_bar" | "bench" | "kettlebell" | "resistance_band" | "dip_bar"
  | "treadmill" | "elliptical";

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
  requireAll?: boolean; // when true, user must have ALL listed equipment (not just any one)
  location: Location;
  difficulty: Difficulty;
  type: ExerciseType;
  goals: Goal[];
  hiit?: boolean;
}

export const EXERCISES: Exercise[] = [

  // ── CHEST ──────────────────────────────────────────────────────────────

  { id: "barbell-bench-press", name: "Barbell Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "incline-barbell-press", name: "Incline Barbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "decline-barbell-press", name: "Decline Barbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "dumbbell-bench-press", name: "Dumbbell Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "strength", "fitness"] },
  { id: "incline-dumbbell-press", name: "Incline Dumbbell Press", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "dumbbell-flyes", name: "Dumbbell Flyes", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "incline-dumbbell-flyes", name: "Incline Dumbbell Flyes", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
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
  { id: "incline-dumbbell-curl", name: "Incline Dumbbell Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "concentration-curl", name: "Concentration Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "cable-curl", name: "Cable Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "preacher-curl", name: "Preacher Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["machine", "barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "ez-bar-curl", name: "EZ Bar Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: ["barbell"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "resistance-band-curl", name: "Resistance Band Curl", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: ["resistance_band"], location: "home", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },

  // ── TRICEPS ────────────────────────────────────────────────────────────

  { id: "close-grip-bench", name: "Close Grip Bench Press", primaryMuscles: ["triceps"], secondaryMuscles: ["chest"], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle", "strength"] },
  { id: "skull-crushers", name: "EZ-Bar Skull Crushers", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "double-dumbbell-skull-crushers", name: "Double Dumbbell Skull Crushers", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["dumbbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "isolation", goals: ["muscle"] },
  { id: "tricep-pushdown", name: "Tricep Pushdown", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["cable"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "overhead-tricep-extension", name: "Overhead Tricep Extension", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
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
  { id: "hip-thrust-barbell", name: "Barbell Hip Thrust", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["barbell", "bench"], requireAll: true, location: "gym", difficulty: "intermediate", type: "compound", goals: ["muscle"] },
  { id: "hip-thrust-db", name: "Dumbbell Hip Thrust", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["dumbbell", "bench"], requireAll: true, location: "both", difficulty: "beginner", type: "compound", goals: ["muscle", "fitness"] },
  { id: "glute-kickback", name: "Cable Glute Kickback", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: ["cable", "resistance_band"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fat_loss"] },
  { id: "sumo-deadlift", name: "Sumo Deadlift", primaryMuscles: ["glutes", "hamstrings"], secondaryMuscles: ["back", "quads"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },
  { id: "nordic-curl", name: "Nordic Curl", primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "advanced", type: "isolation", goals: ["strength", "muscle"] },
  { id: "donkey-kick", name: "Donkey Kick", primaryMuscles: ["glutes"], secondaryMuscles: [], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["fitness", "fat_loss"] },
  { id: "good-morning", name: "Good Morning", primaryMuscles: ["hamstrings", "back"], secondaryMuscles: ["glutes"], equipment: ["barbell"], location: "gym", difficulty: "intermediate", type: "compound", goals: ["strength", "muscle"] },

  // ── CALVES ─────────────────────────────────────────────────────────────

  { id: "standing-calf-raise", name: "Standing Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["machine", "bodyweight"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "seated-calf-raise", name: "Seated Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["machine"], location: "gym", difficulty: "beginner", type: "isolation", goals: ["muscle"] },
  { id: "dumbbell-calf-raise", name: "Dumbbell Calf Raise", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: ["dumbbell"], location: "both", difficulty: "beginner", type: "isolation", goals: ["muscle", "fitness"] },
  { id: "jump-rope", name: "Jump Rope", primaryMuscles: ["calves"], secondaryMuscles: ["core", "shoulders"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },

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
  { id: "mountain-climbers", name: "Mountain Climbers", primaryMuscles: ["core"], secondaryMuscles: ["shoulders", "quads"], equipment: ["bodyweight"], location: "both", difficulty: "beginner", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
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
  // Prime-mover muscles below replace the placeholder ["cardio"] tag
  // (which read nowhere as a muscle anyway — Balance bucketing dropped
  // it to null). The metabolic categorisation lives in `type: "cardio"`
  // and `hiit: true` flags below, NOT in the muscle list. With proper
  // prime movers identified, the cardio/HIIT exercises now contribute
  // to the user's Balance sub-rank (the 14-day per-muscle-bucket count)
  // and — once cardio-volume is wired up — to per-muscle volume credit
  // scaled by duration × intensity. (qa: cardio-muscle-classification)

  { id: "burpees",       name: "Burpees",       primaryMuscles: ["chest", "quads", "core"], secondaryMuscles: ["shoulders", "triceps"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "high-knees",   name: "High Knees",   primaryMuscles: ["quads", "core"], secondaryMuscles: ["calves"],          equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "box-jumps",    name: "Box Jumps",    primaryMuscles: ["quads", "calves"], secondaryMuscles: ["glutes"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fitness", "fat_loss"],  hiit: true },
  { id: "treadmill",    name: "Treadmill",    primaryMuscles: ["quads", "glutes", "calves"], secondaryMuscles: ["hamstrings", "core"], equipment: ["treadmill", "machine"],    location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "cycling",      name: "Stationary Bike", primaryMuscles: ["quads", "glutes"], secondaryMuscles: ["hamstrings", "calves"],       equipment: ["elliptical", "machine"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "rowing-machine", name: "Rowing Machine", primaryMuscles: ["back", "hamstrings"], secondaryMuscles: ["quads", "biceps", "core"], equipment: ["machine"], location: "gym",  difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "elliptical",   name: "Elliptical",   primaryMuscles: ["quads", "glutes"], secondaryMuscles: ["hamstrings", "calves"], equipment: ["elliptical"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"] },
  { id: "jumping-jacks", name: "Jumping Jacks", primaryMuscles: ["calves", "shoulders"], secondaryMuscles: ["quads", "core"], equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },

  // ── HIIT ───────────────────────────────────────────────────────────────

  { id: "tuck-jumps",      name: "Tuck Jumps",      primaryMuscles: ["quads"],             secondaryMuscles: ["core", "calves", "glutes"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "split-jumps",     name: "Split Jumps",     primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["calves", "core"],            equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "speed-skaters",   name: "Speed Skaters",   primaryMuscles: ["glutes", "quads"],   secondaryMuscles: ["core", "calves"],            equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "plyo-pushup",     name: "Plyo Push-Up",    primaryMuscles: ["chest"],             secondaryMuscles: ["shoulders", "triceps", "core"], equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "bear-crawl",      name: "Bear Crawl",      primaryMuscles: ["core", "shoulders"], secondaryMuscles: ["quads", "chest"],            equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
  { id: "inchworm",        name: "Inchworm",        primaryMuscles: ["core", "shoulders"], secondaryMuscles: ["hamstrings", "chest"],        equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
  { id: "lateral-bounds",  name: "Lateral Bounds",  primaryMuscles: ["glutes", "quads"],   secondaryMuscles: ["calves", "core"],            equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "broad-jump",      name: "Broad Jump",      primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["calves", "core"],            equipment: ["bodyweight"], location: "both", difficulty: "intermediate", type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "squat-thrust",    name: "Squat Thrust",    primaryMuscles: ["quads"],             secondaryMuscles: ["core", "glutes", "chest"],   equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "star-jump",       name: "Star Jump",       primaryMuscles: ["quads", "calves"],   secondaryMuscles: ["shoulders", "core"],         equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fat_loss", "fitness"], hiit: true },
  { id: "lateral-shuffle", name: "Lateral Shuffle", primaryMuscles: ["quads", "glutes"],   secondaryMuscles: ["calves", "core"],            equipment: ["bodyweight"], location: "both", difficulty: "beginner",      type: "cardio", goals: ["fitness", "fat_loss"], hiit: true },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find(e => e.id === id);
}

// Infer equipment tags from an exercise's display name. Used as a
// fallback when the bundled workout-day exercises (id "a1", "b1",
// etc.) can't be resolved against the EXERCISES catalog by id or by
// normalized-name match. Without this fallback, the workout logger
// can't tell that "Flat Barbell Bench Press" is a barbell movement,
// so it falls into the "unknown equipment" branch and shows the BW
// (bodyweight) toggle — nonsense on a bench press. It also failed
// to show the standard-bar-weight helper, leaving users guessing
// whether their 45kg number includes the 20kg Olympic bar.
//
// Returns canonical Equipment-style strings consumable by
// loadingKindFor() in lib/plates.ts. Empty array means "couldn't
// infer" — caller should preserve whatever fallback behaviour they
// had previously. (qa: weight-input-convention-clarity)
export function inferEquipmentFromName(name: string): string[] {
  if (!name) return [];
  const n = name.toLowerCase();
  // EZ-curl bar is technically a barbell variant (gets plates) but
  // we tag it so the bar-weight helper shows the right standard
  // (≈7-11kg vs the 20kg Olympic).
  if (/\bez[\s-]?(curl|bar)\b|\bez-?curl\b/.test(n)) return ["barbell", "ez-bar"];
  // Smith machine — fixed barbell, plates load it but the bar is
  // counterbalanced so the "include bar weight" question doesn't
  // really apply. Tagging as machine wins (loadingKindFor → machine
  // → no BW toggle, no bar helper).
  if (/\bsmith\b/.test(n)) return ["machine"];
  // T-Bar Row — landmine-style, plates on one end but the loading
  // semantics behave like a machine for the user (no counterweight
  // confusion). Tag as machine.
  if (/\bt[\s-]?bar row\b|\bchest[\s-]?supported row\b|\blandmine\b/.test(n)) return ["machine"];
  // Pec deck / fixed machines.
  if (/\bpec[\s-]?deck\b|\bmachine fly\b|\bleg[\s-]?(press|curl|extension)\b|\browing machine\b|\bmachine\b|\bhammer strength\b/.test(n)) return ["machine"];
  // Cable-based — pulldowns, rope attachments, face pulls, cable
  // crossovers, pushdowns, cable curls/crunches.
  if (/\bcable\b|\bpulldown\b|\bpull[\s-]?down\b|\bface pulls?\b|\brope\b|\bpushdown\b|\bcable cross\b|\bseated cable row\b|\bcrossover\b/.test(n)) return ["cable"];
  // Dumbbell / DB / kettlebell — catch BEFORE the barbell branch so
  // "incline DB curl" doesn't fall through.
  if (/\bdumbbell\b|\bdb\b|\bkettlebell\b|\bkb\b|\bgoblet\b|\bhammer curls?\b|\blateral raise\b|\barnold press\b|\bfront raise\b/.test(n)) return ["dumbbell"];
  // Explicit barbell — anything with "barbell" or "bar X" patterns.
  if (/\bbarbell\b|\bbar(?:bell)?\s+(?:bench|row|squat|press|curl|deadlift|shrug|hip thrust|good morning)/.test(n)) return ["barbell"];
  // Bare canonical-lift names default to barbell (the gym standard)
  // unless caught above. Bench press, squat, deadlift, OHP, clean,
  // snatch are all barbell movements by convention.
  //
  // CAREFUL: "split squat" and "bulgarian split squat" are NOT
  // barbell-default — they're usually DB or bodyweight. Same for
  // "goblet squat" / "air squat" / "wall squat" / "jump squat" /
  // "pistol squat" — all non-barbell. Filter via a negative-lookbehind
  // -ish guard by excluding lines with those qualifier words.
  const squatLooksBarbell = /\bsquat\b/.test(n) && !/\bsplit\b|\bgoblet\b|\bair\b|\bwall\b|\bjump\b|\bpistol\b|\bsissy\b|\bcossack\b|\bskater\b/.test(n);
  if (/\bbench press\b|\bdeadlift\b|\boverhead press\b|\bohp\b|\bclean\b|\bsnatch\b|\bpower clean\b|\bfront squat\b|\bback squat\b|\bhip thrust\b|\bgood morning\b|\bromanian deadlift\b|\brdl\b|\bsumo deadlift\b/.test(n) || squatLooksBarbell) {
    return ["barbell"];
  }
  // Bulgarian split squats default to dumbbell (typical loading);
  // pure split squats also lean DB. Bodyweight-named squats land in
  // the bodyweight branch below.
  if (/\bbulgarian split squat\b|\bsplit squat\b(?!.*barbell)/.test(n)) return ["dumbbell"];
  // Bodyweight movements — gated on the absence of bar/dumbbell
  // markers (handled above). Add common ab moves so the BW toggle
  // doesn't surface needlessly.
  if (/\bpull[\s-]?ups?\b|\bchin[\s-]?ups?\b|\bdips?\b|\bpush[\s-]?ups?\b|\bplank\b|\bhanging\b|\bscap\b|\bmuscle[\s-]?ups?\b|\bring rows?\b|\binverted row\b|\bair squat\b|\bgoblet squat\b|\bjump squat\b|\bpistol squat\b|\bglute bridge\b(?!.*barbell)|\bcalf raise\b(?!.*barbell|.*dumbbell|.*machine)|\bcrunch(?:es)?\b(?!.*cable)|\bsit[\s-]?ups?\b|\bbicycle\b|\brussian twist\b|\bleg raise\b|\bmountain climber\b|\bburpee\b|\bjumping jack\b/.test(n)) {
    return ["bodyweight"];
  }
  return [];
}

// Does the user have everything this exercise needs? Bodyweight items
// never block — anyone with a body can do them. Returns the list of
// missing equipment so the UI can tell the user what to grab.
export function missingEquipmentFor(exercise: Exercise, available: Equipment[]): Equipment[] {
  const have = new Set<string>(available);
  // Bodyweight is always considered available — you brought your body.
  have.add("bodyweight");
  const nonBW = exercise.equipment.filter(eq => eq !== "bodyweight");
  if (nonBW.length === 0) return [];
  if (exercise.requireAll) {
    return nonBW.filter(eq => !have.has(eq));
  }
  // requireAny: only "missing" if none are present
  if (nonBW.some(eq => have.has(eq))) return [];
  return nonBW;
}

// Pick up to N substitution candidates for an exercise. Same primary
// muscle group, similar difficulty. Sorted: gear the user owns first →
// same type → same difficulty → secondary-muscle overlap.
//
// `opts.ignoreEquipment` controls whether candidates needing gear the
// user doesn't own are *excluded* or merely *ranked lower*. Auto-swaps
// (can't-do-this-today) hard-filter by equipment so every suggestion is
// actually doable. User-initiated swaps keep equipment as a ranking
// signal but still surface everything in the same-muscle pool — the
// caller flags the missing gear inline — so the user always gets a
// menu to choose from instead of an empty modal.
export function suggestSubstitutions(
  exerciseId: string,
  available: Equipment[],
  limit = 4,
  opts: { ignoreEquipment?: boolean } = {},
): Exercise[] {
  const target = getExerciseById(exerciseId);
  if (!target) return [];
  const targetMuscles = target.primaryMuscles;
  const score = (e: Exercise): number => {
    let s = 0;
    // Owned-equipment picks rank above ones the user would have to
    // acquire — dominant signal so doable swaps float to the top.
    if (missingEquipmentFor(e, available).length === 0) s += 10;
    if (e.type === target.type) s += 4;
    if (e.difficulty === target.difficulty) s += 2;
    if (e.location === target.location || e.location === "both") s += 1;
    // Prefer same secondary muscles overlap too
    const sec = (e.secondaryMuscles ?? []).filter(m => target.secondaryMuscles?.includes(m)).length;
    s += sec;
    return s;
  };
  return EXERCISES
    .filter(e => e.id !== exerciseId)
    .filter(e => targetMuscles.some(m => e.primaryMuscles.includes(m)))
    .filter(e => opts.ignoreEquipment || missingEquipmentFor(e, available).length === 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

// Full-library ranking for the user-initiated SUBSTITUTE picker. Unlike
// suggestSubstitutions (which narrows to a same-muscle, optionally
// equipment-doable shortlist and can come back empty), this returns
// EVERY other exercise — never empty — with the best same-muscle matches
// ranked first so suggestions surface at the top while the user can
// still swap in literally anything. Robust when `exerciseId` doesn't
// resolve to a library entry (e.g. a custom/planner instance id): the
// muscle-based weights just drop out and ranking falls back to
// owned-equipment ordering.
export function rankExercisesForSwap(
  exerciseId: string,
  available: Equipment[],
): Exercise[] {
  const target = getExerciseById(exerciseId);
  const score = (e: Exercise): number => {
    let s = 0;
    if (target) {
      // Same primary muscle is the dominant signal — these are the
      // "suggested" picks the UI groups at the top.
      if (target.primaryMuscles.some(m => e.primaryMuscles.includes(m))) s += 100;
      // Cross overlap: this exercise's primary hits one of the target's
      // secondaries (or vice-versa) — still a solid functional match.
      const cross =
        e.primaryMuscles.filter(m => target.secondaryMuscles?.includes(m)).length +
        (e.secondaryMuscles ?? []).filter(m => target.primaryMuscles.includes(m)).length;
      s += cross * 10;
      const secOverlap = (e.secondaryMuscles ?? []).filter(m => target.secondaryMuscles?.includes(m)).length;
      s += secOverlap * 3;
      if (e.type === target.type) s += 4;
      if (e.difficulty === target.difficulty) s += 2;
      if (e.location === target.location || e.location === "both") s += 1;
    }
    // Owned-gear nudge — kept well below the muscle weights so relevant
    // suggestions outrank merely-doable ones.
    if (missingEquipmentFor(e, available).length === 0) s += 5;
    return s;
  };
  return EXERCISES
    .filter(e => e.id !== exerciseId)
    .sort((a, b) => score(b) - score(a));
}

// Does this exercise share a primary muscle with the swap target? Used by
// the SUBSTITUTE picker to split the ranked list into a "suggested" group
// (true) and the rest of the library (false).
export function sharesPrimaryMuscle(exerciseId: string, candidate: Exercise): boolean {
  const target = getExerciseById(exerciseId);
  if (!target) return false;
  return target.primaryMuscles.some(m => candidate.primaryMuscles.includes(m));
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
    if (opts.equipment !== undefined) {
      const nonBW = ex.equipment.filter(eq => eq !== "bodyweight");
      if (nonBW.length > 0) {
        // Empty equipment list = no equipment available = bodyweight only
        if (opts.equipment.length === 0) return false;
        const passes = ex.requireAll
          ? nonBW.every(eq => opts.equipment!.includes(eq))
          : nonBW.some(eq => opts.equipment!.includes(eq));
        if (!passes) return false;
      }
    }
    if (opts.difficulty && !opts.difficulty.includes(ex.difficulty)) return false;
    if (opts.type && ex.type !== opts.type) return false;
    if (opts.goal && !ex.goals.includes(opts.goal)) return false;
    return true;
  });
}
