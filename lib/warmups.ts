// Focus-aware warm-up picker. Returns a generic 5-min cardio/mobility
// warm-up keyed off the day's focus string. Used by the session view to
// prepend a Warm-Up section even for plans that didn't save one (the old
// planGenerator never persisted warm-ups, so this restores the missing
// behaviour for every existing user). Items are render-time only — they
// aren't saved back to the routine.

export type WarmupExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  type: "cardio";
  trackable: false;
};

// Library of warm-ups, keyed loosely by the day focus theme.
const WARMUPS: Record<string, WarmupExercise> = {
  push: { id: "warmup-push", name: "Incline Treadmill Walk", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  pull: { id: "warmup-pull", name: "Rowing Machine", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  legs: { id: "warmup-legs", name: "Bike / Light Cardio", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  upper: { id: "warmup-upper", name: "Rowing Machine", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  lower: { id: "warmup-lower", name: "Bike / Light Cardio", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  full: { id: "warmup-full", name: "Rowing Machine", sets: 1, reps: "5 min", type: "cardio", trackable: false },
  cardio: { id: "warmup-cardio", name: "Dynamic Stretching", sets: 1, reps: "3 min", type: "cardio", trackable: false },
};

const GENERIC: WarmupExercise = WARMUPS.full;

// Look at the day's focus / title and pick the best warm-up entry.
export function pickWarmupForDay(opts: { title?: string; focus?: string }): WarmupExercise {
  const hay = `${opts.title ?? ""} ${opts.focus ?? ""}`.toLowerCase();
  if (/chest|shoulder|tricep|push/.test(hay)) return WARMUPS.push;
  if (/back|bicep|pull/.test(hay)) return WARMUPS.pull;
  if (/quad|hamstring|glute|calf|leg/.test(hay) && !/upper/.test(hay)) return WARMUPS.legs;
  if (/upper/.test(hay)) return WARMUPS.upper;
  if (/lower/.test(hay)) return WARMUPS.lower;
  if (/cardio|hiit|conditioning/.test(hay)) return WARMUPS.cardio;
  return GENERIC;
}
