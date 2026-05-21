// Legacy single-warm-up shim. New code should use lib/stretching.ts.
// Kept so the older pickWarmupForDay() callsite still resolves.

import { pickPrimaryWarmup } from "./stretching";

export type WarmupExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  type: "cardio";
  trackable: false;
};

export function pickWarmupForDay(opts: { title?: string; focus?: string }): WarmupExercise {
  const w = pickPrimaryWarmup({ title: opts.title, focus: opts.focus });
  return { id: w.id, name: w.name, sets: 1, reps: w.reps, type: "cardio", trackable: false };
}
