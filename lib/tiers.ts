// Tier system — multi-dimensional. The headline animal/badge tier is
// derived from a weighted average of 4 sub-ranks, each 0–100. Single
// source of truth: every surface (Settings chip, Progress card, leader-
// board row, group ranking) imports from here. No duplicate ladders.

export type AnimalTier = {
  // Universal 1-based tier rank. Shared across themes so the
  // ladder semantics stay the same — Tier 3 is the same
  // achievement whether you see "Big Dawg" or "Gold".
  tierNum: number;
  label: string;
  icon: string;
  // The MIN headline score required to reach this tier (0-100).
  min: number;
  color: string;
  bg: string;
  border: string;
};

// Theme catalogue for the athlete ladder. Each theme is a 6-tier
// array indexed by tierNum-1; the `min` thresholds + `tierNum`
// MUST match across themes so a Tier 3 user sees "Big Dawg" or
// "Gold" depending on theme but they're objectively at the same
// rung. Add a new theme by appending an entry — every tier-display
// surface reads from `getAthleteTiers(theme)`.
// (qa: tier-themes)
export type AthleteTierTheme = "vivid" | "simple";

export const ATHLETE_TIER_THEMES: Record<AthleteTierTheme, AnimalTier[]> = {
  vivid: [
    { tierNum: 1, label: "Kitten",   icon: "🐱", min: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
    { tierNum: 2, label: "Fox",      icon: "🦊", min: 15, color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"   },
    { tierNum: 3, label: "Big Dawg", icon: "🐕", min: 30, color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)"  },
    { tierNum: 4, label: "Lion",     icon: "🦁", min: 50, color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.35)"  },
    { tierNum: 5, label: "Gorilla",  icon: "🦍", min: 70, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)"  },
    { tierNum: 6, label: "Bear",     icon: "🐻", min: 90, color: "#92400e", bg: "rgba(146,64,14,0.12)",   border: "rgba(146,64,14,0.45)"   },
  ],
  simple: [
    { tierNum: 1, label: "Bronze",   icon: "🥉", min: 0,  color: "#a8784a", bg: "rgba(168,120,74,0.08)",  border: "rgba(168,120,74,0.3)"  },
    { tierNum: 2, label: "Silver",   icon: "🥈", min: 15, color: "#cbd5e1", bg: "rgba(203,213,225,0.08)", border: "rgba(203,213,225,0.3)" },
    { tierNum: 3, label: "Gold",     icon: "🥇", min: 30, color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.35)" },
    { tierNum: 4, label: "Platinum", icon: "🏆", min: 50, color: "#7dd3fc", bg: "rgba(125,211,252,0.10)", border: "rgba(125,211,252,0.35)"},
    { tierNum: 5, label: "Diamond",  icon: "💎", min: 70, color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.4)"  },
    { tierNum: 6, label: "Master",   icon: "👑", min: 90, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
  ],
};

// Resolve a theme name to its ordered tier list. Falls back to
// vivid for null/unknown values.
export function getAthleteTiers(theme: string | null | undefined): AnimalTier[] {
  if (theme === "simple") return ATHLETE_TIER_THEMES.simple;
  return ATHLETE_TIER_THEMES.vivid;
}

// Backwards-compatible export — every existing call site that
// imports `ATHLETE_TIERS` still works (gets the vivid theme).
// Migrate call sites to `getAthleteTiers(profile.tierTheme)` as
// you touch them.
export const ATHLETE_TIERS: AnimalTier[] = ATHLETE_TIER_THEMES.vivid;

// Trainer ladder — expanded to 6 tiers for emotional pacing parity
// with the athlete ladder. Theme-agnostic (same labels everywhere
// regardless of the athlete tier theme the visitor has selected) —
// trainers earn ONE trainer rank, not two parallel ones.
// Lineup confirmed by @maaiz: Spotter → Strategist → Pro → Master
// → Legend → Hall of Fame. Spotter ties to gym vocabulary;
// Strategist signals plan design; Pro/Master/Hall-of-Fame are the
// achievement-arc ceiling. (qa: tier-themes — final naming pass)
export const TRAINER_TIERS: AnimalTier[] = [
  { tierNum: 1, label: "Spotter",      icon: "🤝", min: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.3)" },
  { tierNum: 2, label: "Strategist",   icon: "🧠", min: 15, color: "#4ECDC4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.3)"  },
  { tierNum: 3, label: "Pro",          icon: "⚡", min: 30, color: "#FFD166", bg: "rgba(255,209,102,0.10)", border: "rgba(255,209,102,0.35)" },
  { tierNum: 4, label: "Master",       icon: "👑", min: 50, color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.35)" },
  { tierNum: 5, label: "Legend",       icon: "🏆", min: 70, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
  { tierNum: 6, label: "Hall of Fame", icon: "⭐", min: 88, color: "#f0c040", bg: "rgba(240,192,64,0.12)",  border: "rgba(240,192,64,0.45)" },
];

export type SubRank = {
  id: string;
  label: string;
  icon: string;
  score: number;        // 0-100
  detail: string;       // short human-readable "you have X" line
};

export type TierBreakdown = {
  headline: AnimalTier;
  headlineScore: number;
  subRanks: SubRank[];
  // Cheapest dimension to improve — the one closest to its next breakpoint.
  // Used by the "Path to Next" callout.
  focusNext: SubRank | null;
};

// Soft-cap log scaler — diminishing returns. Maps a raw count to 0-100
// using a curve that hits 80 at ~`midpoint` and approaches 100 slowly.
function scoreFromCount(value: number, midpoint: number): number {
  if (value <= 0) return 0;
  // log curve hits 100 only when value ≫ midpoint
  const score = 100 * (Math.log(1 + value) / Math.log(1 + midpoint * 3));
  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── ATHLETE TIER ────────────────────────────────────────────────────────

export type AthleteStatsForTier = {
  totalSessions: number;
  streak: number;
  totalVolumeKg: number;     // sum of weight × reps across all sets
  prCount: number;
  distinctExercises: number; // exercises the user has logged at least once (lifetime)
  // Distinct exercises trained in the last 180 days. Feeds the Mastery
  // sub-rank instead of lifetime so a user stuck in a rut (same 5
  // exercises for years) loses Mastery score until they vary again.
  // Optional — falls back to `distinctExercises` (lifetime) for legacy
  // callers that haven't passed the recent count yet. (qa: tier-decay)
  recentDistinctExercises?: number;
  monthsOnApp: number;
  // Habits sub-rank inputs — all derived from the wellness trackers.
  // Optional so legacy callers still work; default to 0 if absent.
  hydrationGoalDays?: number;       // days in last 14 where glasses ≥ target
  sleepLoggedDays?: number;         // days in last 14 with a sleep entry
  energyLoggedDays?: number;        // days in last 14 with an energy entry
  // Adherence inputs — sessions in the last 4 weeks vs the user's
  // planned daysPerWeek. Lets the consistency sub-rank reward hitting
  // your target (and resting between sessions) and PENALISE
  // overtraining. (qa: tier-scoring-fairness)
  sessionsLast4Weeks?: number;
  daysPerWeek?: number;             // user's profile.daysPerWeek (3-6 typically)
};

// Adherence curve — peaks at 100% of weekly target, drops gently
// past it so overtraining doesn't print extra points. Built for
// "rest days are part of the plan" — a user training 4/wk with
// daysPerWeek=4 scores 100; one training 7/wk scores ~50; one
// training 0/wk scores 0. The drop on the right side is moderate
// (not punitive) — you can have a heavier week without losing all
// credit, but you can't farm score by training every single day.
// (qa: tier-scoring-fairness — @maaiz: "minimise reward for going
// too hard, reward sufficient rest days")
function adherenceScore(sessionsLast4Weeks: number, daysPerWeek: number): number {
  const target4w = Math.max(1, daysPerWeek) * 4;
  if (sessionsLast4Weeks <= 0) return 0;
  const ratio = sessionsLast4Weeks / target4w;
  if (ratio <= 1.0) {
    // Linear ramp 0 → 100 as user approaches target
    return Math.round(ratio * 100);
  }
  // Past target: each 25% over loses 25 points. 2× target = 0.
  const excess = ratio - 1.0;
  return Math.max(0, Math.round(100 - excess * 100));
}

export function computeAthleteTier(s: AthleteStatsForTier, theme?: string | null): TierBreakdown {
  // 5 sub-ranks. Numbers tuned to be motivating in the early game.
  // Consistency blend:
  //   50% lifetime sessions (log curve, midpoint 100) — captures
  //       long-term commitment.
  //   40% adherence — rewards hitting the weekly target AND resting.
  //       Caps at 100%; overtraining loses points. (Replaces the old
  //       streak component which punished rest days.)
  //   10% streak — kept for the everyday-grinder vibe but de-weighted
  //       heavily so it's a small bonus, not the main driver.
  // (qa: tier-scoring-fairness)
  const adherence = adherenceScore(s.sessionsLast4Weeks ?? 0, s.daysPerWeek ?? 4);
  const consistency = Math.round(
    0.5 * scoreFromCount(s.totalSessions, 100) +
    0.4 * adherence +
    0.1 * scoreFromCount(s.streak, 14)
  );
  const strength = scoreFromCount(s.prCount, 30);
  // Volume — keep log curve so cumulative work matters, but the
  // dimension is also softly bounded by the consistency adherence
  // (a user grinding 20k kg-reps in one cooking week now sits at
  // ~50% on consistency, which drags the headline). The midpoint
  // was already at 100k kg-reps (~6mo of solid training) so no
  // change here.
  const volume = scoreFromCount(s.totalVolumeKg, 100_000);
  // Mastery — distinct exercises trained in the last 180 days
  // (recency-weighted) instead of lifetime. Forces variety: a user
  // who's done the same 5 exercises for years loses Mastery score
  // even though their lifetime distinct count is high. Legacy
  // callers that haven't migrated still pass `distinctExercises`
  // and the field is undefined → falls back so we don't break them.
  // (qa: tier-decay)
  const masteryCount = s.recentDistinctExercises ?? s.distinctExercises;
  const mastery = scoreFromCount(masteryCount, 25);
  // Habits — weighted blend of hydration goal-hits + sleep/energy logging.
  // Hydration is the heaviest weight (60%) since hitting the daily target
  // is a concrete behaviour. Sleep + energy logging both rewarded for the
  // habit of tracking (you'd be amazed how rare consistent logging is).
  const hg = s.hydrationGoalDays ?? 0;
  const sl = s.sleepLoggedDays ?? 0;
  const en = s.energyLoggedDays ?? 0;
  const habits = Math.round(
    0.6 * scoreFromCount(hg, 10) +   // 10 hydration-goal days in 14 = ~80
    0.2 * scoreFromCount(sl, 10) +
    0.2 * scoreFromCount(en, 10)
  );

  const sessions4w = s.sessionsLast4Weeks ?? 0;
  const dpw = s.daysPerWeek ?? 4;
  const target4w = dpw * 4;
  const adherenceLabel = sessions4w === 0
    ? `${s.totalSessions} sessions · target ${dpw}/wk`
    : sessions4w > target4w
      ? `${s.totalSessions} sessions · ${sessions4w}/${target4w} last 4wk (over target — rest!)`
      : `${s.totalSessions} sessions · ${sessions4w}/${target4w} last 4wk`;

  const subRanks: SubRank[] = [
    { id: "consistency", label: "Consistency", icon: "🔁", score: consistency, detail: adherenceLabel },
    { id: "strength",    label: "Strength",    icon: "💪", score: strength,    detail: `${s.prCount} personal bests` },
    { id: "volume",      label: "Volume",      icon: "📈", score: volume,      detail: `${Math.round(s.totalVolumeKg / 1000)}k kg-reps lifetime` },
    { id: "mastery",     label: "Mastery",     icon: "🏆", score: mastery,     detail: s.recentDistinctExercises != null ? `${masteryCount} distinct exercises (last 6mo) · ${s.distinctExercises} lifetime` : `${s.distinctExercises} distinct exercises` },
    { id: "habits",      label: "Habits",      icon: "💧", score: habits,      detail: `${hg}d hydration · ${sl}d sleep · ${en}d energy (last 14)` },
  ];

  const headlineScore = Math.round(subRanks.reduce((sum, r) => sum + r.score, 0) / subRanks.length);
  // Resolve against the theme the caller asked for so the headline
  // tier carries the theme-correct label/icon. Sub-rank logic
  // doesn't change.
  const tiers = getAthleteTiers(theme);
  let headline = tiers[0];
  for (const t of tiers) if (headlineScore >= t.min) headline = t;

  const focusNext = pickFocusNext(subRanks);

  return { headline, headlineScore, subRanks, focusNext };
}

// ── TRAINER TIER ────────────────────────────────────────────────────────

export type TrainerStatsForTier = {
  rosterCount: number;            // clients currently in their roster
  clientsWithRecentPR: number;    // # whose latest PR is within the last 30d
  clientsWithActiveStreak: number;// # with a streak ≥ 7d
  totalClientPRs: number;         // PRs across the trainer's whole roster (lifetime)
  totalClientVolumeKg: number;    // volume across the whole roster (lifetime)
  // Trainer's OWN athlete headline score (0-100). A trainer slacking
  // on their personal training shouldn't ladder up — practising what
  // you preach matters. Optional for legacy callers; defaults to 0 if
  // omitted, which DOES drag the headline (intentional). (qa:
  // tier-trainer-discipline)
  selfAthleteScore?: number;
};

export function computeTrainerTier(s: TrainerStatsForTier): TierBreakdown {
  const roster = scoreFromCount(s.rosterCount, 15);
  const progressionPct = s.rosterCount > 0 ? (s.clientsWithRecentPR / s.rosterCount) : 0;
  const progression = Math.round(progressionPct * 100);
  const retentionPct = s.rosterCount > 0 ? (s.clientsWithActiveStreak / s.rosterCount) : 0;
  const retention = Math.round(retentionPct * 100);
  // Reach = combination of total PRs + volume across all their clients.
  const reach = Math.round(
    0.5 * scoreFromCount(s.totalClientPRs, 200) +
    0.5 * scoreFromCount(s.totalClientVolumeKg, 500_000)
  );
  // Discipline = the trainer's OWN athlete headline (0-100). The
  // headline already aggregates their personal consistency, strength,
  // volume, mastery, and habits — using it as a single dimension
  // means a trainer who lifts hard and stays consistent gets credit,
  // while one who doesn't train at all caps around 80/100 average
  // (4 strong client-side dims + 0 discipline → headline 64,
  // about Tier 3).
  const discipline = Math.max(0, Math.min(100, Math.round(s.selfAthleteScore ?? 0)));

  const subRanks: SubRank[] = [
    { id: "roster",      label: "Roster",      icon: "👥", score: roster,      detail: `${s.rosterCount} active clients` },
    { id: "progression", label: "Progression", icon: "🚀", score: progression, detail: `${s.clientsWithRecentPR}/${s.rosterCount} clients hit a PR last 30d` },
    { id: "retention",   label: "Retention",   icon: "🔁", score: retention,   detail: `${s.clientsWithActiveStreak}/${s.rosterCount} clients on a streak` },
    { id: "reach",       label: "Reach",       icon: "⭐", score: reach,       detail: `${s.totalClientPRs} PRs · ${Math.round(s.totalClientVolumeKg / 1000)}k kg-reps total` },
    { id: "discipline",  label: "Discipline",  icon: "🏋", score: discipline,  detail: `Your own athlete score · ${discipline}/100` },
  ];

  const headlineScore = Math.round(subRanks.reduce((sum, r) => sum + r.score, 0) / subRanks.length);
  let headline = TRAINER_TIERS[0];
  for (const t of TRAINER_TIERS) if (headlineScore >= t.min) headline = t;
  const focusNext = pickFocusNext(subRanks);

  return { headline, headlineScore, subRanks, focusNext };
}

// Lowest-scoring sub-rank — the cheapest dim to improve to push the
// headline up. Surfaced in the "Path to Next" callout.
function pickFocusNext(subRanks: SubRank[]): SubRank | null {
  if (subRanks.length === 0) return null;
  return [...subRanks].sort((a, b) => a.score - b.score)[0];
}

// Convenience for surfaces that only need the headline animal label.
export function getAthleteTierFromBasics(s: AthleteStatsForTier, theme?: string | null): AnimalTier {
  return computeAthleteTier(s, theme).headline;
}
