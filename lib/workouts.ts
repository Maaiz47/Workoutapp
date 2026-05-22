export type Exercise = {
  id: string; name: string; sets: number; reps: string;
  type: "compound" | "isolation" | "cardio" | "stretch" | "mobility";
  rest?: number; note?: string; trackable?: boolean;
  groupId?: string; groupType?: string; dropSets?: number; dropSet?: boolean;
  kind?: "warmup" | "main" | "cooldown";
  cues?: string[]; icon?: string; auto?: boolean;
};

export type Section = { name: string; type?: "main" | "warmup" | "cardio" | "cooldown"; exercises: Exercise[] };

export type WorkoutDay = {
  id: string; day?: number; label: string; title: string; subtitle?: string;
  focus: string; color: string; gradient: string; sections: Section[];
};

export const WORKOUT_DATA: WorkoutDay[] = [
  {
    id: "push1", day: 1, label: "01", title: "Push Day — Heavy",
    focus: "Flat Bench · Incline · Triceps · Lateral Raises", color: "#FF6B6B", gradient: "linear-gradient(135deg, #FF6B6B, #ee5a24)",
    sections: [
      { name: "Warm-Up", exercises: [{ id: "w1", name: "Incline Treadmill Walk", sets: 1, reps: "5 min", type: "cardio", trackable: false }] },
      { name: "Chest", exercises: [
        { id: "a1", name: "Flat Barbell Bench Press", sets: 4, reps: "8-10", type: "compound", rest: 70 },
        { id: "a2", name: "Incline Dumbbell Press", sets: 3, reps: "10-12", type: "compound", rest: 70 },
        { id: "a3", name: "Cable Flyes (Low-to-High)", sets: 3, reps: "12-15", type: "isolation", rest: 45 },
      ]},
      { name: "Triceps", exercises: [
        { id: "a4", name: "Tricep Rope Pushdowns", sets: 3, reps: "12-15", type: "isolation", rest: 40 },
        { id: "a5", name: "Overhead Tricep Extension", sets: 3, reps: "12-15", type: "isolation", rest: 40 },
      ]},
      { name: "Extras", exercises: [
        { id: "a6", name: "Lateral Raises", sets: 4, reps: "15", type: "isolation", rest: 35, note: "Light & slow — builds width" },
      ]},
      { name: "Finisher", exercises: [{ id: "a7", name: "Hanging Leg Raises", sets: 3, reps: "15", type: "isolation", rest: 30 }] },
    ],
  },
  {
    id: "pull1", day: 2, label: "02", title: "Pull Day — Width",
    focus: "Rows · Pulldowns · Curls · Face Pulls", color: "#4ECDC4", gradient: "linear-gradient(135deg, #4ECDC4, #44b09e)",
    sections: [
      { name: "Warm-Up", exercises: [{ id: "w2", name: "Rowing Machine", sets: 1, reps: "5 min", type: "cardio", trackable: false }] },
      { name: "Back", exercises: [
        { id: "b1", name: "Barbell Bent-Over Row", sets: 4, reps: "8-10", type: "compound", rest: 70 },
        { id: "b2", name: "Lat Pulldown (Wide)", sets: 3, reps: "10-12", type: "compound", rest: 70 },
        { id: "b3", name: "Seated Cable Row (Close)", sets: 3, reps: "10-12", type: "compound", rest: 60 },
      ]},
      { name: "Biceps", exercises: [
        { id: "b4", name: "Barbell Curl", sets: 3, reps: "10-12", type: "isolation", rest: 45 },
        { id: "b5", name: "Incline DB Curl", sets: 3, reps: "12", type: "isolation", rest: 40 },
        { id: "b6", name: "Hammer Curls", sets: 3, reps: "12", type: "isolation", rest: 40 },
      ]},
      { name: "Extras", exercises: [
        { id: "b7", name: "Face Pulls", sets: 4, reps: "15", type: "isolation", rest: 35, note: "Shoulder health + rear delts" },
      ]},
      { name: "Finisher", exercises: [{ id: "b8", name: "Cable Crunch", sets: 3, reps: "15", type: "isolation", rest: 30 }] },
    ],
  },
  {
    id: "legs", day: 3, label: "03", title: "Leg Day — Foundation",
    focus: "Squats · RDLs · Split Squats · Calves", color: "#A29BFE", gradient: "linear-gradient(135deg, #A29BFE, #6c5ce7)",
    sections: [
      { name: "Warm-Up", exercises: [{ id: "w3", name: "Bike / Light Cardio", sets: 1, reps: "5 min", type: "cardio", trackable: false }] },
      { name: "Main Lifts", exercises: [
        { id: "c1", name: "Barbell Back Squat", sets: 4, reps: "8-10", type: "compound", rest: 75 },
        { id: "c2", name: "Romanian Deadlift", sets: 3, reps: "10-12", type: "compound", rest: 70 },
        { id: "c3", name: "Leg Press", sets: 3, reps: "12", type: "compound", rest: 70 },
      ]},
      { name: "Accessories", exercises: [
        { id: "c4", name: "Bulgarian Split Squat", sets: 3, reps: "10/leg", type: "compound", rest: 60 },
        { id: "c5", name: "Leg Curl Machine", sets: 3, reps: "12-15", type: "isolation", rest: 45 },
        { id: "c6", name: "Standing Calf Raises", sets: 4, reps: "15-20", type: "isolation", rest: 35 },
      ]},
      { name: "Finisher", exercises: [{ id: "c7", name: "Plank", sets: 3, reps: "45 sec", type: "isolation", rest: 30 }] },
    ],
  },
  {
    id: "push2", day: 4, label: "04", title: "Push Day — Volume",
    focus: "Incline Bench · Flyes · Dips · Lateral Raises", color: "#FF6B6B", gradient: "linear-gradient(135deg, #fd9644, #e17055)",
    sections: [
      { name: "Warm-Up", exercises: [{ id: "w4", name: "Incline Treadmill Walk", sets: 1, reps: "5 min", type: "cardio", trackable: false }] },
      { name: "Chest", exercises: [
        { id: "d1", name: "Incline Barbell Bench Press", sets: 4, reps: "8-10", type: "compound", rest: 70 },
        { id: "d2", name: "Flat Dumbbell Press", sets: 3, reps: "10-12", type: "compound", rest: 70 },
        { id: "d3", name: "Pec Deck / Machine Fly", sets: 3, reps: "12-15", type: "isolation", rest: 45 },
      ]},
      { name: "Triceps", exercises: [
        { id: "d4", name: "Close-Grip Bench Press", sets: 3, reps: "10-12", type: "compound", rest: 60 },
        { id: "d5", name: "Tricep Dips (or Machine)", sets: 3, reps: "12-15", type: "compound", rest: 45 },
      ]},
      { name: "Extras", exercises: [
        { id: "d6", name: "Lateral Raises", sets: 4, reps: "15", type: "isolation", rest: 35, note: "Light & slow — capped delts" },
      ]},
      { name: "Finisher", exercises: [{ id: "d7", name: "Russian Twists", sets: 3, reps: "20", type: "isolation", rest: 30 }] },
    ],
  },
  {
    id: "pull2", day: 5, label: "05", title: "Pull Day — Thickness",
    focus: "Pull-Ups · T-Bar Rows · EZ Curls · Face Pulls", color: "#74b9ff", gradient: "linear-gradient(135deg, #74b9ff, #0984e3)",
    sections: [
      { name: "Warm-Up", exercises: [{ id: "w5", name: "Rowing Machine", sets: 1, reps: "5 min", type: "cardio", trackable: false }] },
      { name: "Back", exercises: [
        { id: "e1", name: "Pull-Ups / Assisted Pull-Ups", sets: 4, reps: "8-10", type: "compound", rest: 70 },
        { id: "e2", name: "T-Bar Row / Chest-Supported Row", sets: 3, reps: "10-12", type: "compound", rest: 70 },
        { id: "e3", name: "Straight-Arm Pulldown", sets: 3, reps: "12-15", type: "isolation", rest: 45 },
      ]},
      { name: "Biceps", exercises: [
        { id: "e4", name: "EZ-Bar Curl", sets: 3, reps: "10-12", type: "isolation", rest: 45 },
        { id: "e5", name: "Cable Curl (Rope)", sets: 3, reps: "12-15", type: "isolation", rest: 40 },
      ]},
      { name: "Extras", exercises: [
        { id: "e6", name: "Face Pulls", sets: 4, reps: "15", type: "isolation", rest: 35, note: "Rear delts + shoulder health" },
      ]},
      { name: "Finisher", exercises: [{ id: "e7", name: "Bicycle Crunches", sets: 3, reps: "20", type: "isolation", rest: 30 }] },
    ],
  },
];
