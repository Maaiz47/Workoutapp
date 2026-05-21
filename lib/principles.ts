// Training principles — the canonical, vetted values the rest of the
// app reads from when generating plans, suggesting weights, recommending
// deloads, picking rep ranges, etc.
//
// Every entry carries a `source` citation so audits can trace where the
// number came from. The bar is "majorly accepted in evidence-based
// strength + conditioning practice" — not absolute peer-reviewed truth,
// but values you'd find in NSCA Essentials, ACSM guidelines, Schoenfeld's
// hypertrophy meta-analyses, Renaissance Periodization's volume models,
// or Helms / Tuchscherer's RPE-based programming.
//
// When numbers in other lib files disagree with these, the principle
// here wins. Update with new sources; don't edit without one.

export type Sourced<T> = T & { source: string };

// ── REP RANGES BY GOAL ──────────────────────────────────────────────
// Schoenfeld's 2017 meta-analysis showed hypertrophy gains across a wide
// rep range when sets are taken close to failure, but the classical
// strength / hypertrophy / endurance split still informs default
// programming. Each goal has a low/high band; the planner picks a value
// inside the band based on the exercise type (compound vs isolation).

export type RepRange = { low: number; high: number; restSec: number };

export const REP_RANGES_BY_GOAL: Record<string, Sourced<RepRange>> = {
  strength: {
    low: 3, high: 6, restSec: 180,
    source: "NSCA Essentials of Strength Training & Conditioning, 4th ed., Ch.17",
  },
  muscle: {
    low: 6, high: 12, restSec: 90,
    source: "Schoenfeld et al. 2017 meta-analysis on rep ranges + hypertrophy",
  },
  fat_loss: {
    low: 8, high: 15, restSec: 60,
    source: "ACSM position stand on resistance training for fat-loss populations",
  },
  fitness: {
    low: 10, high: 15, restSec: 60,
    source: "ACSM general health guidelines (resistance + cardio)",
  },
  endurance: {
    low: 12, high: 20, restSec: 45,
    source: "NSCA Ch.17, muscular endurance protocols",
  },
};

// ── REST PERIOD GUIDELINES BY EXERCISE TYPE ─────────────────────────
// Rest scales with compound vs isolation. Schoenfeld 2016 showed long
// rest (> 2 min) outperforms short rest for hypertrophy on multi-joint
// lifts. Single-joint accessories can tolerate shorter rest.

export const REST_BY_TYPE: Record<string, Sourced<{ minSec: number; maxSec: number }>> = {
  compound_strength: {
    minSec: 180, maxSec: 300,
    source: "Schoenfeld 2016 — long rest (3+ min) for multi-joint strength",
  },
  compound_hypertrophy: {
    minSec: 90, maxSec: 180,
    source: "Schoenfeld 2016 / Grgic 2017 review on rest intervals",
  },
  isolation: {
    minSec: 60, maxSec: 90,
    source: "NSCA Ch.17 — single-joint accessories",
  },
  cardio: {
    minSec: 30, maxSec: 60,
    source: "ACSM HIIT guidelines",
  },
};

// ── RPE / RIR RUBRIC ────────────────────────────────────────────────
// The RPE 10 scale maps 1:1 to RIR (reps in reserve) for sets taken to
// or close to failure. The recommended working RPE for hypertrophy is
// 7-9 (i.e. 1-3 reps shy of failure). Strength work skews 8-9.

export const RPE_RUBRIC: Sourced<Array<{ rpe: number; rir: number; meaning: string }>> = {
  source: "Tuchscherer Reactive Training Systems · Helms et al. 'Muscle and Strength Pyramids'",
  rpe: 0, rir: 0, meaning: "",
} as any;

export const RPE_SCALE: Array<{ rpe: number; rir: number; meaning: string }> = [
  { rpe: 5,  rir: 5, meaning: "Warm-up — many reps left" },
  { rpe: 6,  rir: 4, meaning: "Moderate — easy weight" },
  { rpe: 7,  rir: 3, meaning: "Sub-maximal — could do 3 more clean reps" },
  { rpe: 8,  rir: 2, meaning: "Hard — 2 in the tank, target for most working sets" },
  { rpe: 9,  rir: 1, meaning: "Top end — 1 rep shy of failure" },
  { rpe: 10, rir: 0, meaning: "Failure — couldn't have done another rep with good form" },
];

// Recommended working RPE by training goal. Used by suggestProgression()
// to bias up/down based on the user's last set.
export const TARGET_RPE_BY_GOAL: Record<string, Sourced<{ low: number; high: number }>> = {
  strength: { low: 8, high: 9, source: "Helms et al., Pyramids of Training" },
  muscle:   { low: 7, high: 9, source: "Schoenfeld + Helms — proximity-to-failure ranges" },
  fat_loss: { low: 7, high: 8, source: "NSCA conditioning chapter — moderate effort, high frequency" },
  fitness:  { low: 6, high: 8, source: "ACSM general resistance training" },
};

// ── VOLUME LANDMARKS PER MUSCLE GROUP ───────────────────────────────
// Renaissance Periodization's MEV / MAV / MRV model. Sets per muscle
// per WEEK. MEV = minimum to grow, MAV = optimal sweet-spot, MRV =
// maximum recoverable — exceed this and you're digging a hole.

export type VolumeLandmarks = {
  mv: number;   // maintenance — minimum to NOT lose
  mev: number;  // minimum effective volume for growth
  mav: number;  // maximum adaptive — sweet spot
  mrv: number;  // maximum recoverable — overtrain past this
};

export const VOLUME_LANDMARKS: Record<string, Sourced<VolumeLandmarks>> = {
  chest:      { mv: 6, mev: 10, mav: 16, mrv: 22, source: "Israetel / RP — Chest training volumes" },
  back:       { mv: 8, mev: 10, mav: 18, mrv: 25, source: "Israetel / RP — Back training volumes" },
  shoulders:  { mv: 6, mev: 8,  mav: 18, mrv: 26, source: "Israetel / RP — Shoulder training volumes (front+side+rear pooled)" },
  biceps:     { mv: 5, mev: 8,  mav: 16, mrv: 22, source: "Israetel / RP — Biceps training volumes" },
  triceps:    { mv: 4, mev: 6,  mav: 12, mrv: 18, source: "Israetel / RP — Triceps training volumes" },
  quads:      { mv: 6, mev: 8,  mav: 16, mrv: 20, source: "Israetel / RP — Quad training volumes" },
  hamstrings: { mv: 4, mev: 6,  mav: 12, mrv: 20, source: "Israetel / RP — Hamstring training volumes" },
  glutes:     { mv: 4, mev: 8,  mav: 16, mrv: 24, source: "Israetel / RP — Glute training volumes" },
  calves:     { mv: 6, mev: 8,  mav: 14, mrv: 20, source: "Israetel / RP — Calf training volumes" },
  core:       { mv: 4, mev: 8,  mav: 14, mrv: 20, source: "Israetel / RP — Core training volumes" },
};

// ── FREQUENCY PER MUSCLE GROUP ──────────────────────────────────────
// Schoenfeld 2016 meta-analysis: ≥ 2x/week per muscle outperforms 1x
// when volume is equated. 2-3x is the practical sweet spot. Higher
// frequencies (4+) need careful sub-failure programming.

export const FREQUENCY_PER_MUSCLE: Sourced<{ min: number; optimal: number; max: number }> = {
  min: 2, optimal: 2, max: 4,
  source: "Schoenfeld et al. 2016 — Effect of training frequency on hypertrophy",
};

// ── DELOAD POLICY ───────────────────────────────────────────────────
// Renaissance Periodization's mesocycle structure: 4-6 weeks of
// accumulation, then a 1-week deload at 50-70% of working weight and
// fewer sets. Beginner thresholds are looser since beginners don't
// accumulate enough fatigue to need frequent deloads.

export const DELOAD_POLICY: Record<string, Sourced<{ weeksBetween: number; weightMultiplier: number; setMultiplier: number }>> = {
  newcomer:     { weeksBetween: 8, weightMultiplier: 0.85, setMultiplier: 0.85, source: "Practical Programming (Rippetoe) — beginners rarely need deloads" },
  beginner:     { weeksBetween: 6, weightMultiplier: 0.75, setMultiplier: 0.85, source: "Practical Programming (Rippetoe) — intermediate transition" },
  intermediate: { weeksBetween: 5, weightMultiplier: 0.70, setMultiplier: 0.80, source: "Israetel / RP — intermediate deload protocol" },
  advanced:     { weeksBetween: 4, weightMultiplier: 0.65, setMultiplier: 0.75, source: "Israetel / RP — advanced lifters deload more frequently" },
};

// ── PROGRESSIVE OVERLOAD INCREMENTS ─────────────────────────────────
// How much weight to add when the user hits the top of their rep
// range with RPE ≤ 7. Compound lifts tolerate larger jumps; isolations
// need smaller (1.25kg microplates).

export const OVERLOAD_INCREMENTS_KG: Record<string, Sourced<{ compound: number; isolation: number }>> = {
  newcomer:     { compound: 5.0,  isolation: 2.5,  source: "Practical Programming — linear progression for beginners" },
  beginner:     { compound: 2.5,  isolation: 2.5,  source: "Practical Programming — intermediate progression" },
  intermediate: { compound: 2.5,  isolation: 1.25, source: "Wendler 5/3/1 — slow progression at intermediate" },
  advanced:     { compound: 1.25, isolation: 1.25, source: "Helms — microloading is the norm at advanced levels" },
};

// ── 1RM PERCENTAGE ZONES ────────────────────────────────────────────
// What weight (as % of 1RM) corresponds to what training quality.

export const ONE_RM_ZONES: Sourced<Array<{ pctLow: number; pctHigh: number; label: string; goal: string }>> = {
  source: "Wendler 5/3/1 · NSCA load prescription tables",
  pctLow: 0, pctHigh: 0, label: "", goal: "",
} as any;

export const ONE_RM_ZONES_LIST: Array<{ pctLow: number; pctHigh: number; label: string; goal: string }> = [
  { pctLow: 40, pctHigh: 60,  label: "Warm-up / technique",  goal: "Movement quality, prep" },
  { pctLow: 60, pctHigh: 75,  label: "Hypertrophy / volume", goal: "Muscle growth, work capacity" },
  { pctLow: 75, pctHigh: 85,  label: "Strength",             goal: "Maximal strength development" },
  { pctLow: 85, pctHigh: 95,  label: "Peaking",              goal: "Neural strength, low volume" },
  { pctLow: 95, pctHigh: 100, label: "Max effort",           goal: "Single-rep maxes (peaking blocks only)" },
];

// Epley is the most widely used 1RM estimator and remains a good fit
// up to ~10 reps. Past that the formula overestimates. Always cap.
export const ONE_RM_FORMULA: Sourced<{ description: string; maxRepsAccurate: number }> = {
  description: "Epley: estimated 1RM = weight × (1 + reps / 30)",
  maxRepsAccurate: 10,
  source: "Epley 1985 · still standard in most strength research",
};

// ── EXPERIENCE LEVEL GATES ──────────────────────────────────────────
// What constitutes each level. The app's auto-experience system uses
// these thresholds at the 6-month mark to derive a user's level from
// their actual training, not their onboarding self-report.

export const EXPERIENCE_GATES: Sourced<Array<{ level: string; months: number; sessions: number; prs: number; description: string }>> = {
  source: "Practical Programming (Rippetoe & Kilgore) — novice / intermediate / advanced definitions",
  level: "", months: 0, sessions: 0, prs: 0, description: "",
} as any;

export const EXPERIENCE_GATES_LIST: Array<{ level: string; months: number; sessions: number; prs: number; description: string }> = [
  { level: "newcomer",     months: 0,  sessions: 0,   prs: 0,  description: "First weeks. Linear progression session-to-session." },
  { level: "beginner",     months: 3,  sessions: 30,  prs: 0,  description: "Linear progression still working, basics learned." },
  { level: "intermediate", months: 6,  sessions: 80,  prs: 10, description: "Weekly progression — needs structured programming." },
  { level: "advanced",     months: 12, sessions: 180, prs: 30, description: "Microloading + periodization required for further gains." },
];

// ── RECOVERY PRINCIPLES ─────────────────────────────────────────────
// Non-training factors that affect performance. Used to tune the deload
// suggester + the wellness tracker's recommendations.

export const RECOVERY_GUIDELINES: Sourced<{ sleepHours: { min: number; ideal: number }; proteinGPerKg: { lower: number; upper: number }; hydrationMlPerKg: number }> = {
  sleepHours: { min: 7, ideal: 8.5 },
  proteinGPerKg: { lower: 1.6, upper: 2.2 },
  hydrationMlPerKg: 35,
  source: "ACSM nutrition position stand (2016) · Helms et al. nutrition for natural lifters",
};

// ── WARM-UP & COOL-DOWN PROTOCOL ────────────────────────────────────
// Behm & Chaouachi 2011 reviewed warm-up strategies and concluded that
// general (5-10min cardio) + dynamic mobility is the best pre-training
// combination. Static stretching belongs post-workout, not pre.

export const WARMUP_PROTOCOL: Sourced<{ generalCardioMin: number; dynamicMobilityMin: number; specificSetsLoad: number[] }> = {
  generalCardioMin: 5,
  dynamicMobilityMin: 5,
  specificSetsLoad: [0.50, 0.70, 0.85],
  source: "Behm & Chaouachi 2011 systematic review on acute warm-up effects",
};

export const COOLDOWN_PROTOCOL: Sourced<{ lightCardioMin: number; staticStretchSecPerHold: number; recommendedStretchCount: number }> = {
  lightCardioMin: 3,
  staticStretchSecPerHold: 30,
  recommendedStretchCount: 5,
  source: "ACSM position stand on flexibility training",
};

// ── COMPOUND vs ISOLATION RATIO ─────────────────────────────────────
// Most plan designers settle on ~60-70% compounds for hypertrophy plans
// and 80-90% compounds for strength plans. The remainder is isolation
// for muscle balance + specialisation. Not strictly evidence-based —
// it's a practical consensus.

export const COMPOUND_ISOLATION_MIX_BY_GOAL: Record<string, Sourced<{ compoundPct: number }>> = {
  strength: { compoundPct: 0.85, source: "Practical consensus — strength programs heavily compound-dominant" },
  muscle:   { compoundPct: 0.65, source: "Helms et al. — Pyramid of Training, exercise selection chapter" },
  fat_loss: { compoundPct: 0.70, source: "Practical consensus — compounds = more calories burned per minute" },
  fitness:  { compoundPct: 0.60, source: "ACSM general resistance training balance" },
};

// ── TEMPO ───────────────────────────────────────────────────────────
// Conventional 2-1-2-0 cadence (2s eccentric, 1s pause, 2s concentric,
// 0s reset). Schoenfeld 2015 meta-analysis found no significant
// difference in hypertrophy across rep durations from 0.5-8s, BUT
// control of the eccentric remains universally recommended for safety.

export const DEFAULT_TEMPO: Sourced<{ eccentricSec: number; concentricSec: number; pauseSec: number; description: string }> = {
  eccentricSec: 2,
  concentricSec: 2,
  pauseSec: 0,
  description: "2-second controlled lower, 2-second deliberate lift — default unless the exercise specifies otherwise",
  source: "Schoenfeld 2015 tempo meta — no significant hypertrophy difference, but control of the eccentric is universally recommended for safety",
};

// ── HELPER: derive a target RPE for a user's goal mix ───────────────
// User profile typically has multiple goals. Take the highest-RPE goal
// to avoid undertraining for strength when "muscle" is also selected.
export function targetRpeFor(goals: string[]): { low: number; high: number } {
  let low = 6, high = 8;
  for (const g of goals) {
    const t = TARGET_RPE_BY_GOAL[g];
    if (!t) continue;
    if (t.low > low) low = t.low;
    if (t.high > high) high = t.high;
  }
  return { low, high };
}

// ── HELPER: blended rep range for goal mix ──────────────────────────
// Average the goals' bands so users selecting multiple goals get a
// sensible middle band rather than the narrowest.
export function blendedRepRange(goals: string[]): { low: number; high: number; restSec: number } {
  const entries = goals.map(g => REP_RANGES_BY_GOAL[g]).filter(Boolean);
  if (entries.length === 0) return { low: 8, high: 12, restSec: 90 };
  const low = Math.round(entries.reduce((s, e) => s + e.low, 0) / entries.length);
  const high = Math.round(entries.reduce((s, e) => s + e.high, 0) / entries.length);
  const restSec = Math.round(entries.reduce((s, e) => s + e.restSec, 0) / entries.length);
  return { low, high, restSec };
}
