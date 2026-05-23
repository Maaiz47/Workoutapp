// Tier system — multi-dimensional. The headline animal/badge tier is
// derived from a weighted average of sub-ranks (each 0-100). Single
// source of truth: every surface (Settings chip, Progress card, leader-
// board row, group ranking) imports from here. No duplicate ladders.
//
// v2 (qa: tier-scoring-v2) — Strength now measures e1RM trend (not PR
// count); a new Progression sub-rank rewards rising weekly volume;
// Body Comp scores current condition + 90d maintenance with sex-aware
// curves; Consistency drops lifetime-sessions in favour of 180d
// sessions + adherence + weekly streak; Mastery requires ≥4 sets in
// 180d to "count" an exercise; tierScoreBonus is no longer blended
// into the canonical headline; sub-ranks with no data are excluded
// from the headline average so users who don't log wellness or body
// comp aren't silently penalised.

export type AnimalTier = {
  // Universal 1-based tier rank. Shared across themes so the
  // ladder semantics stay the same — Tier 3 is the same
  // achievement whether you see "Big Dawg" or "Gold".
  tierNum: number;
  label: string;
  icon: string;
  // Optional PNG path that supersedes `icon` when present.
  // Renderers fall back to the emoji `icon` when iconPath is missing
  // or the image fails to load. (qa: tier-icons-vivid, tier-icons-simple, tier-icons-trainer)
  iconPath?: string;
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
    { tierNum: 1, label: "Kitten",   icon: "🐱", iconPath: "/tier-icons/vivid/kitten.png",   min: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
    { tierNum: 2, label: "Fox",      icon: "🦊", iconPath: "/tier-icons/vivid/fox.png",      min: 15, color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"   },
    { tierNum: 3, label: "Big Dawg", icon: "🐕", iconPath: "/tier-icons/vivid/big-dawg.png", min: 30, color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)"  },
    { tierNum: 4, label: "Lion",     icon: "🦁", iconPath: "/tier-icons/vivid/lion.png",     min: 50, color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.35)"  },
    { tierNum: 5, label: "Gorilla",  icon: "🦍", iconPath: "/tier-icons/vivid/gorilla.png",  min: 70, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)"  },
    { tierNum: 6, label: "Bear",     icon: "🐻", iconPath: "/tier-icons/vivid/bear.png",     min: 90, color: "#92400e", bg: "rgba(146,64,14,0.12)",   border: "rgba(146,64,14,0.45)"   },
  ],
  simple: [
    { tierNum: 1, label: "Bronze",   icon: "🥉", iconPath: "/tier-icons/simple/bronze.png",   min: 0,  color: "#a8784a", bg: "rgba(168,120,74,0.08)",  border: "rgba(168,120,74,0.3)"  },
    { tierNum: 2, label: "Silver",   icon: "🥈", iconPath: "/tier-icons/simple/silver.png",   min: 15, color: "#cbd5e1", bg: "rgba(203,213,225,0.08)", border: "rgba(203,213,225,0.3)" },
    { tierNum: 3, label: "Gold",     icon: "🥇", iconPath: "/tier-icons/simple/gold.png",     min: 30, color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.35)" },
    { tierNum: 4, label: "Platinum", icon: "🏆", iconPath: "/tier-icons/simple/platinum.png", min: 50, color: "#7dd3fc", bg: "rgba(125,211,252,0.10)", border: "rgba(125,211,252,0.35)"},
    { tierNum: 5, label: "Diamond",  icon: "💎", iconPath: "/tier-icons/simple/diamond.png",  min: 70, color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.4)"  },
    { tierNum: 6, label: "Master",   icon: "👑", iconPath: "/tier-icons/simple/master.png",   min: 90, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
  ],
};

// Resolve a theme name to its ordered tier list. Falls back to
// vivid for null/unknown values.
export function getAthleteTiers(theme: string | null | undefined): AnimalTier[] {
  if (theme === "simple") return ATHLETE_TIER_THEMES.simple;
  return ATHLETE_TIER_THEMES.vivid;
}

// Display-only inverted tier rank — per @maaiz: "tiers should be
// numbers so 1 is top tier (best)". Internal `tierNum` stays as
// (1 = lowest, 6 = highest) so existing scoring, promotion logic,
// avatar unlock pipelines, and leaderboard sorts keep working. This
// helper returns the number shown to the user (1 = top). Both
// athlete and trainer ladders have 6 tiers so the math is fixed.
// (qa: tier-number-display-inverted)
export const TIER_COUNT = 6;
export function displayTierNum(tierNum: number): number {
  return TIER_COUNT - tierNum + 1;
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
  { tierNum: 1, label: "Spotter",      icon: "🤝", iconPath: "/tier-icons/trainer/spotter.png",      min: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.3)" },
  { tierNum: 2, label: "Strategist",   icon: "🧠", iconPath: "/tier-icons/trainer/strategist.png",   min: 15, color: "#4ECDC4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.3)"  },
  { tierNum: 3, label: "Pro",          icon: "⚡", iconPath: "/tier-icons/trainer/pro.png",          min: 30, color: "#FFD166", bg: "rgba(255,209,102,0.10)", border: "rgba(255,209,102,0.35)" },
  { tierNum: 4, label: "Mentor",       icon: "👑", iconPath: "/tier-icons/trainer/mentor.png",       min: 50, color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.35)" },
  { tierNum: 5, label: "Legend",       icon: "🏆", iconPath: "/tier-icons/trainer/legend.png",       min: 70, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
  { tierNum: 6, label: "Hall of Fame", icon: "⭐", iconPath: "/tier-icons/trainer/hall-of-fame.png", min: 88, color: "#f0c040", bg: "rgba(240,192,64,0.12)",  border: "rgba(240,192,64,0.45)" },
];

export type SubRank = {
  id: string;
  label: string;
  icon: string;
  score: number;        // 0-100
  detail: string;       // short human-readable "you have X" line
  // True when the sub-rank had enough signal to score. Headline
  // average only includes subRanks with hasData=true — users who
  // don't log wellness / body comp aren't penalised for empty data.
  // (qa: tier-scoring-v2)
  hasData: boolean;
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

// Epley estimated 1RM (the standard among lifters). reps capped at 12
// because the formula gets unreliable past rep ranges that aren't
// actually strength-tested. We also floor at 0 / clamp to 1 rep so
// silly inputs don't blow up.
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const r = Math.min(12, Math.max(1, reps));
  return weight * (1 + r / 30);
}

// ── ATHLETE TIER ────────────────────────────────────────────────────────

// One set of one exercise in a workout. Sets are bucketed by
// `exerciseId` upstream; here we just see the flat list per
// exercise for the last 180 days.
export type RecentSet = { dateMs: number; weight: number; reps: number; rpe?: number | null };

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

  // ── v2 inputs (qa: tier-scoring-v2) ──
  // 180d session count for the recency-weighted Consistency dim
  // (replaces lifetime totalSessions in the consistency blend).
  sessions180d?: number;
  // Consecutive WEEKS where sessionsThisWeek ≥ daysPerWeek. Rest-day
  // friendly weekly streak — replaces the daily streak in Consistency.
  weeklyStreak?: number;
  // Per-exercise set list (last 180d). Strength sub-rank computes
  // e1RM trend across the user's top-6 most-trained qualifying lifts
  // (≥4 sets logged in the window). Mastery counts how many lifts
  // qualify under the same ≥4-set filter.
  recentSetsByExercise?: Record<string, RecentSet[]>;
  // Weekly volume series (last ~26 weeks). Progression sub-rank fits
  // a linear regression and converts the slope-as-%-of-mean into a
  // 0-100 score.
  weeklyVolumes?: Array<{ weekStartMs: number; volumeKg: number }>;
  // Body comp inputs. Latest weight + BF for the "Body Comp" dim
  // (current condition vs sex-calibrated healthy ranges); 90d deltas
  // reward staying in the maintenance band.
  weightCurrentKg?: number | null;
  bfCurrentPct?: number | null;
  weightChange90dKg?: number | null;
  bfChange90dPct?: number | null;
  gender?: string | null;           // "male" / "female" / "other"
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

// Strength sub-rank — measures whether the user is GETTING STRONGER,
// not how many lifetime PRs they've banked. Methodology:
//   1. Filter to exercises with ≥4 sets logged in the last 180 days.
//   2. Pick the top 6 by set count (the user's actual main lifts).
//   3. For each: take the best e1RM in the FIRST 90 days of the
//      window vs the best e1RM in the SECOND 90 days. % change.
//   4. Average % change across the 6.
//   5. Map -5% → +15% linearly to 25 → 100. Floor at 25 (a true
//      plateau is still showing up — don't crash the tier).
// (qa: tier-scoring-v2)
function strengthSubRank(recentByExercise: Record<string, RecentSet[]>, todayMs: number): { score: number; hasData: boolean; detail: string; pctChange: number | null; qualifiedCount: number } {
  const qualified = Object.entries(recentByExercise)
    .map(([id, sets]) => ({ id, sets, count: sets.length }))
    .filter(e => e.count >= 4)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  if (qualified.length === 0) return { score: 50, hasData: false, detail: "log ≥4 sets of an exercise to start tracking", pctChange: null, qualifiedCount: 0 };
  const halfPoint = todayMs - 90 * 86400000;
  const pctChanges: number[] = [];
  for (const { sets } of qualified) {
    const first = sets.filter(s => s.dateMs < halfPoint);
    const second = sets.filter(s => s.dateMs >= halfPoint);
    if (first.length === 0 || second.length === 0) continue;
    let e1rm1 = 0, e1rm2 = 0;
    for (const s of first) { const e = epley1RM(s.weight, s.reps); if (e > e1rm1) e1rm1 = e; }
    for (const s of second) { const e = epley1RM(s.weight, s.reps); if (e > e1rm2) e1rm2 = e; }
    if (e1rm1 <= 0) continue;
    pctChanges.push((e1rm2 - e1rm1) / e1rm1);
  }
  if (pctChanges.length === 0) {
    // Not enough history split across both halves — show the user
    // their setup is in progress without crashing them.
    return { score: 50, hasData: false, detail: "keep logging — strength trend kicks in past 90d of history", pctChange: null, qualifiedCount: qualified.length };
  }
  const avgPct = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length;
  // Map -5% .. +15% linearly into 25 .. 100. Clamp.
  const raw = 25 + ((avgPct + 0.05) / 0.20) * 75;
  const score = Math.max(25, Math.min(100, Math.round(raw)));
  const pctRounded = Math.round(avgPct * 1000) / 10; // one decimal place
  const detail = `${pctRounded >= 0 ? "+" : ""}${pctRounded}% e1RM (180d, top ${pctChanges.length})`;
  return { score, hasData: true, detail, pctChange: avgPct, qualifiedCount: qualified.length };
}

// Progression sub-rank — rewards a rising weekly-volume trend over
// the available history. Linear regression > start-vs-end snapshot
// so one outlier week doesn't dominate.
//   • <9 weeks of data → score 50, hasData false (excluded from
//     headline average so brand-new users aren't penalised).
//   • Slope/mean → "% growth per week".
//   • ≤0%/wk → 30 (regression penalty — not catastrophic, life happens).
//   •  0-1%/wk → linear 30 → 70.
//   •  1-3%/wk → linear 70 → 100. 3%+ caps at 100.
// (qa: tier-scoring-v2)
function progressionSubRank(weekly: Array<{ weekStartMs: number; volumeKg: number }>): { score: number; hasData: boolean; detail: string; slopePct: number | null } {
  if (!weekly || weekly.length < 9) {
    return { score: 50, hasData: false, detail: weekly && weekly.length > 0 ? `log ${9 - weekly.length} more week${weekly.length === 8 ? "" : "s"} to unlock progression` : "no weekly volume yet", slopePct: null };
  }
  const sorted = [...weekly].sort((a, b) => a.weekStartMs - b.weekStartMs);
  const n = sorted.length;
  const xs = sorted.map((_, i) => i);
  const ys = sorted.map(w => w.volumeKg);
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slopePerWeek = den > 0 ? num / den : 0;
  const slopePctPerWeek = meanY > 0 ? slopePerWeek / meanY : 0;
  let score: number;
  if (slopePctPerWeek <= 0) score = 30;
  else if (slopePctPerWeek <= 0.01) score = Math.round(30 + (slopePctPerWeek / 0.01) * 40);
  else score = Math.round(Math.min(100, 70 + ((slopePctPerWeek - 0.01) / 0.02) * 30));
  const pctRounded = Math.round(slopePctPerWeek * 1000) / 10; // % per week, 1 dp
  const detail = `${pctRounded >= 0 ? "+" : ""}${pctRounded}%/wk volume trend · ${n}wk`;
  return { score, hasData: true, detail, slopePct: slopePctPerWeek };
}

// Body Comp sub-rank — current condition + 90-day maintenance trend.
// Sex-calibrated curves so women aren't systematically lower-scored
// than men at equivalent fitness. Sub-score split:
//   • 60% "current condition" — how close BF% (and weight where BF
//     missing) sits to the healthy band for the user's sex.
//   • 40% "90d maintenance" — staying within ±2kg / ±1% BF earns
//     full 40; bigger drifts decay. Rewards stability, not change
//     direction (cuts and bulks both register as instability).
// hasData false unless we have ≥1 of weight OR BF logged.
// (qa: tier-scoring-v2)
function bodyCompSubRank(
  weight: number | null | undefined,
  bf: number | null | undefined,
  weight90Δ: number | null | undefined,
  bf90Δ: number | null | undefined,
  gender: string | null | undefined,
): { score: number; hasData: boolean; detail: string } {
  const hasBF = typeof bf === "number" && bf > 0;
  const hasWeight = typeof weight === "number" && weight > 0;
  if (!hasBF && !hasWeight) {
    return { score: 50, hasData: false, detail: "log weight or body-fat to track condition" };
  }
  // Sex-calibrated BF healthy midpoints.
  const isFemale = gender === "female";
  const isOther = gender === "other" || !gender;
  const bfMid = isFemale ? 22 : 14;          // healthy midpoint
  const bfTolerance = isFemale ? 8 : 8;      // ±8 = score still ≥50
  // Score current condition.
  let conditionScore: number;
  if (hasBF) {
    // Triangular curve peaking at midpoint. 100 at mid, decays to
    // 0 at mid ± 2×tolerance.
    const dist = Math.abs((bf as number) - bfMid);
    const decay = Math.max(0, 1 - dist / (bfTolerance * 2));
    conditionScore = Math.round(100 * decay);
  } else {
    // Weight-only proxy — without height we can't compute BMI
    // accurately. Award a neutral 60 so users who only log weight
    // aren't penalised for the gap.
    conditionScore = 60;
  }
  // Score 90d maintenance — small change = high score.
  let maintenanceScore: number;
  const wΔ = typeof weight90Δ === "number" ? Math.abs(weight90Δ) : null;
  const bfΔ = typeof bf90Δ === "number" ? Math.abs(bf90Δ) : null;
  if (wΔ == null && bfΔ == null) {
    // No 90-day comparison data yet — give them the benefit of the
    // doubt (50) rather than 0 which would tank the dim.
    maintenanceScore = 50;
  } else {
    // ≤2kg or ≤1% BF over 90d = 100. Beyond that, decay linearly.
    const wPart = wΔ == null ? null : Math.max(0, 1 - (wΔ - 2) / 6);   // 0 at 8kg drift
    const bfPart = bfΔ == null ? null : Math.max(0, 1 - (bfΔ - 1) / 5); // 0 at 6% drift
    const parts = [wPart, bfPart].filter((x): x is number => x != null);
    maintenanceScore = Math.round(100 * Math.min(1, parts.reduce((a, b) => a + b, 0) / parts.length));
  }
  const blended = Math.round(0.6 * conditionScore + 0.4 * maintenanceScore);
  const score = Math.max(0, Math.min(100, blended));
  const parts: string[] = [];
  if (hasBF) parts.push(`${(bf as number).toFixed(1)}% BF`);
  if (hasWeight) parts.push(`${(weight as number).toFixed(1)}kg`);
  if (wΔ != null) parts.push(`${(weight90Δ as number) >= 0 ? "+" : ""}${(weight90Δ as number).toFixed(1)}kg/90d`);
  const sexNote = isOther ? "" : isFemale ? " · ♀ curve" : " · ♂ curve";
  return { score, hasData: true, detail: parts.join(" · ") + sexNote };
}

export function computeAthleteTier(s: AthleteStatsForTier, theme?: string | null): TierBreakdown {
  // Consistency v2 — 30% 180d sessions, 60% adherence, 10% weekly streak.
  // Dropped lifetime totalSessions (quitters used to score 80 forever);
  // dropped the daily streak (conflicted with rest-day adherence).
  // Weekly streak = consecutive weeks hitting daysPerWeek target,
  // so rest days are NOT penalised. (qa: tier-scoring-v2)
  const adherence = adherenceScore(s.sessionsLast4Weeks ?? 0, s.daysPerWeek ?? 4);
  const recent180dSessions = s.sessions180d ?? Math.min(s.totalSessions, 60);
  const weeklyStreak = s.weeklyStreak ?? 0;
  const consistency = Math.round(
    0.3 * scoreFromCount(recent180dSessions, 60) +
    0.6 * adherence +
    0.1 * scoreFromCount(weeklyStreak, 8)
  );

  // Strength v2 — e1RM trend instead of lifetime PR count.
  const todayMs = Date.now();
  const strengthRes = strengthSubRank(s.recentSetsByExercise ?? {}, todayMs);

  // Progression v2 — new sub-rank. Weekly volume regression slope.
  const progressionRes = progressionSubRank(s.weeklyVolumes ?? []);

  // Volume — lifetime kg-reps log curve, unchanged. (Captures
  // "how much work have you done" cumulatively — distinct from
  // Strength/Progression which measure RATE.)
  const volume = scoreFromCount(s.totalVolumeKg, 100_000);

  // Mastery v2 — exercises with ≥4 sets in 180d (depth-weighted
  // distinct count). Raises the bar from naive "logged at least
  // once" so doing the same 25 lifts seriously isn't worse than
  // dabbling in 25 random movements.
  const recentByEx = s.recentSetsByExercise ?? {};
  const masteryQualified = Object.values(recentByEx).filter(arr => (arr?.length ?? 0) >= 4).length;
  const masteryLegacy = s.recentDistinctExercises ?? s.distinctExercises;
  const masteryCount = Object.keys(recentByEx).length > 0 ? masteryQualified : masteryLegacy;
  const masteryHasData = Object.keys(recentByEx).length > 0
    ? masteryQualified > 0
    : masteryLegacy > 0;
  const mastery = scoreFromCount(masteryCount, 18);

  // Habits — unchanged from v1.
  const hg = s.hydrationGoalDays ?? 0;
  const sl = s.sleepLoggedDays ?? 0;
  const en = s.energyLoggedDays ?? 0;
  const habitsAny = hg > 0 || sl > 0 || en > 0;
  const habits = Math.round(
    0.6 * scoreFromCount(hg, 10) +
    0.2 * scoreFromCount(sl, 10) +
    0.2 * scoreFromCount(en, 10)
  );

  // Body Comp v2 — new sub-rank (sex-aware).
  const bcRes = bodyCompSubRank(s.weightCurrentKg, s.bfCurrentPct, s.weightChange90dKg, s.bfChange90dPct, s.gender);

  // Detail strings.
  const sessions4w = s.sessionsLast4Weeks ?? 0;
  const dpw = s.daysPerWeek ?? 4;
  const target4w = dpw * 4;
  const adherenceLabel = sessions4w === 0
    ? `target ${dpw}/wk · ${recent180dSessions} sess last 6mo`
    : sessions4w > target4w
      ? `${sessions4w}/${target4w} last 4wk (over target — rest!)`
      : `${sessions4w}/${target4w} last 4wk · streak ${weeklyStreak}wk`;

  const subRanks: SubRank[] = [
    { id: "consistency", label: "Consistency", icon: "🔁", score: consistency,      detail: adherenceLabel,                                            hasData: true },
    { id: "strength",    label: "Strength",    icon: "💪", score: strengthRes.score, detail: strengthRes.detail,                                       hasData: strengthRes.hasData },
    { id: "progression", label: "Progression", icon: "🚀", score: progressionRes.score, detail: progressionRes.detail,                                 hasData: progressionRes.hasData },
    { id: "volume",      label: "Volume",      icon: "📈", score: volume,           detail: `${Math.round(s.totalVolumeKg / 1000)}k kg-reps lifetime`, hasData: s.totalVolumeKg > 0 },
    { id: "mastery",     label: "Mastery",     icon: "🏆", score: mastery,          detail: `${masteryCount} exercises ≥4 sets (last 6mo) · ${s.distinctExercises} lifetime`, hasData: masteryHasData },
    { id: "bodycomp",    label: "Body Comp",   icon: "⚖️", score: bcRes.score,      detail: bcRes.detail,                                              hasData: bcRes.hasData },
    { id: "habits",      label: "Habits",      icon: "💧", score: habits,           detail: `${hg}d hydration · ${sl}d sleep · ${en}d energy (14d)`,    hasData: habitsAny },
  ];

  // Headline = average over sub-ranks WITH data. Users who don't
  // log wellness, don't track body comp, or have no exercise history
  // yet aren't silently penalised for empty dims. Consistency is
  // always counted (everyone has session data — even 0 sessions is
  // a signal).
  const counted = subRanks.filter(r => r.hasData);
  const headlineScore = counted.length > 0
    ? Math.round(counted.reduce((sum, r) => sum + r.score, 0) / counted.length)
    : 0;

  // Resolve against the theme the caller asked for so the headline
  // tier carries the theme-correct label/icon. Sub-rank logic
  // doesn't change.
  const tiers = getAthleteTiers(theme);
  let headline = tiers[0];
  for (const t of tiers) if (headlineScore >= t.min) headline = t;

  const focusNext = pickFocusNext(subRanks, headlineScore, tiers);

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
  const discipline = Math.max(0, Math.min(100, Math.round(s.selfAthleteScore ?? 0)));

  const subRanks: SubRank[] = [
    { id: "roster",      label: "Roster",      icon: "👥", score: roster,      detail: `${s.rosterCount} active clients`,                                    hasData: s.rosterCount > 0 },
    { id: "progression", label: "Progression", icon: "🚀", score: progression, detail: `${s.clientsWithRecentPR}/${s.rosterCount} clients hit a PB last 30d`, hasData: s.rosterCount > 0 },
    { id: "retention",   label: "Retention",   icon: "🔁", score: retention,   detail: `${s.clientsWithActiveStreak}/${s.rosterCount} clients on a streak`,   hasData: s.rosterCount > 0 },
    { id: "reach",       label: "Reach",       icon: "⭐", score: reach,       detail: `${s.totalClientPRs} PBs · ${Math.round(s.totalClientVolumeKg / 1000)}k kg-reps total`, hasData: s.rosterCount > 0 },
    { id: "discipline",  label: "Discipline",  icon: "🏋", score: discipline,  detail: `Your own athlete score · ${discipline}/100`,                          hasData: true },
  ];

  const counted = subRanks.filter(r => r.hasData);
  const headlineScore = counted.length > 0
    ? Math.round(counted.reduce((sum, r) => sum + r.score, 0) / counted.length)
    : 0;
  let headline = TRAINER_TIERS[0];
  for (const t of TRAINER_TIERS) if (headlineScore >= t.min) headline = t;
  const focusNext = pickFocusNext(subRanks, headlineScore, TRAINER_TIERS);

  return { headline, headlineScore, subRanks, focusNext };
}

// Path-to-next: highest-leverage sub-rank — the one that, if it climbs
// to the dim ceiling (or 100), moves the HEADLINE the most. With N
// counted sub-ranks of equal weight, lifting one dim by Δ adds Δ/N to
// the headline. So the best target is the dim with the largest
// (100 − current) score, AMONG dims that have data. Ties → lower-score
// dim wins (felt like the more honest signal). (qa: tier-scoring-v2)
function pickFocusNext(subRanks: SubRank[], _headlineScore: number, _tiers: AnimalTier[]): SubRank | null {
  const eligible = subRanks.filter(r => r.hasData);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => {
    const upsideA = 100 - a.score;
    const upsideB = 100 - b.score;
    if (upsideB !== upsideA) return upsideB - upsideA;
    return a.score - b.score;
  })[0];
}

// Convenience for surfaces that only need the headline animal label.
export function getAthleteTierFromBasics(s: AthleteStatsForTier, theme?: string | null): AnimalTier {
  return computeAthleteTier(s, theme).headline;
}
