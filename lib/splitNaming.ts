// Helpers that infer a short, conventional name for a workout day or
// whole routine based on the exercises in it. Used to pre-fill the
// "save routine" dialog and to suggest day titles in the customise
// editor. Users can always override — these are starting points, not
// hard rules. (qa: routine-auto-naming)

import { EXERCISES } from "./exercises";

const PUSH_MUSCLES = new Set(["chest", "shoulders", "triceps"]);
const PULL_MUSCLES = new Set(["back", "biceps", "lats", "rear-delts", "rear_delts", "forearms", "traps"]);
const LEG_MUSCLES  = new Set(["quads", "hamstrings", "glutes", "calves", "adductors"]);
const CORE_MUSCLES = new Set(["core", "abs", "obliques"]);

type ExerciseLike = { id?: string; exerciseId?: string; name?: string };

function musclesFor(ex: ExerciseLike): string[] {
  const id = ex.id ?? ex.exerciseId;
  if (id) {
    const lib = EXERCISES.find(e => e.id === id);
    if (lib) {
      return [
        ...(lib.primaryMuscles ?? []),
        ...(lib.secondaryMuscles ?? []),
      ].map(m => m.toLowerCase());
    }
  }
  // Name-keyword fallback for exercises not in the library.
  const n = (ex.name ?? "").toLowerCase();
  const hits: string[] = [];
  if (/(squat|leg|lunge|hamstring|glute|calf|deadlift|hip thrust|romanian)/.test(n)) hits.push("quads", "hamstrings", "glutes");
  if (/(bench|chest|push.?up|fly|dip|press)/.test(n)) hits.push("chest");
  if (/(pull|row|chin|lat)/.test(n)) hits.push("back");
  if (/(shoulder|overhead|lateral raise|front raise|arnold|pike)/.test(n)) hits.push("shoulders");
  if (/(curl|bicep)/.test(n)) hits.push("biceps");
  if (/(tricep|skull|kickback)/.test(n)) hits.push("triceps");
  if (/(plank|crunch|sit.?up|leg raise|ab|core)/.test(n)) hits.push("core");
  return hits;
}

// Infer a single day's name based on its exercises. Returns a short,
// title-cased label like "Push", "Pull", "Legs", "Upper", "Lower",
// "Full Body", "Push/Pull", "Arms", "Core". Returns null when the day
// is empty or too small to categorise (let caller keep existing name).
export function suggestDayTitle(exercises: ExerciseLike[]): string | null {
  if (!exercises || exercises.length === 0) return null;
  let push = 0, pull = 0, legs = 0, core = 0;
  let bi = 0, tri = 0;
  for (const ex of exercises) {
    const ms = musclesFor(ex);
    let counted = false;
    for (const m of ms) {
      if (PUSH_MUSCLES.has(m)) { push += 1; counted = true; break; }
      if (PULL_MUSCLES.has(m)) { pull += 1; counted = true; break; }
      if (LEG_MUSCLES.has(m))  { legs += 1; counted = true; break; }
      if (CORE_MUSCLES.has(m)) { core += 1; counted = true; break; }
    }
    if (!counted) continue;
    for (const m of ms) {
      if (m === "biceps") bi += 1;
      if (m === "triceps") tri += 1;
    }
  }
  const total = push + pull + legs + core;
  if (total === 0) return null;
  // Single-bucket dominance — if one bucket holds ≥70% of the
  // exercises, name the day after it.
  const buckets = [
    { name: "Push", n: push },
    { name: "Pull", n: pull },
    { name: "Legs", n: legs },
    { name: "Core", n: core },
  ].sort((a, b) => b.n - a.n);
  const top = buckets[0];
  if (top.n / total >= 0.7) {
    if (top.name === "Core") {
      if (push + pull + legs === 0) return "Core";
      // Core mixed with another bucket → call it after the bigger one.
      const nextTop = buckets[1];
      if (nextTop.n > 0) return nextTop.name;
    }
    return top.name;
  }
  // Arms-specific case: biceps + triceps dominate (push+pull mostly arms).
  if (bi + tri > 0 && (bi + tri) / total >= 0.6) return "Arms";
  // Upper-body case: push + pull dominate, no legs.
  if (legs === 0 && push > 0 && pull > 0) return "Upper Body";
  // Lower-body case: legs dominate.
  if (push === 0 && pull === 0 && legs > 0) return "Lower Body";
  // Mixed case: combine the top two non-zero buckets.
  const named = buckets.filter(b => b.n > 0).slice(0, 2).map(b => b.name);
  if (named.length === 1) return named[0];
  if (named.length === 2) return `${named[0]}/${named[1]}`;
  return "Full Body";
}

// Infer a routine name based on its days. Examples:
//   • Three days = Push / Pull / Legs → "Push/Pull/Legs"
//   • Four days = Upper / Lower / Upper / Lower → "Upper/Lower 4-Day"
//   • Mixed Full Body × 3 → "Full Body 3-Day"
//   • Falls back to "<N>-Day Custom Routine".
export function suggestRoutineName(days: Array<{ title?: string; exercises?: ExerciseLike[] }>): string {
  if (!days || days.length === 0) return "Custom Routine";
  const titles: string[] = days.map(d => {
    const auto = d.exercises ? suggestDayTitle(d.exercises) : null;
    const t = (d.title && d.title.trim()) ? d.title.trim() : null;
    // Prefer the auto-derived label if the stored title looks generic
    // (e.g. "Day 1", "Workout A"). Otherwise use the stored title.
    if (auto && (!t || /^(day\s*\d|workout\s*[a-z]|untitled)$/i.test(t))) return auto;
    return t ?? auto ?? `Day ${days.indexOf(d) + 1}`;
  });
  // Dedupe + preserve order.
  const unique: string[] = [];
  for (const t of titles) if (!unique.includes(t)) unique.push(t);
  if (unique.length === 1) return `${unique[0]} ${days.length}-Day`;
  if (unique.length <= 3) return unique.join("/");
  return `${days.length}-Day Custom Routine`;
}
