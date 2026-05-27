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

// Per-tier flavor label — replaces the old experience chip
// (newcomer / beginner / INTERMEDIATE / advanced) on the rank
// card. Per @maaiz 2026-05-26: "Instead of intermediate for
// athlete tier classification, can show something like now a
// baller. Bear can be apex beast. Gorilla absolute unit". One
// row per theme; tierNum is 1 (lowest) → 6 (highest).
// (qa: tier-flavor-tagline)
export function tierFlavor(tierNum: number, theme: string | null | undefined): string {
  const map: Record<string, Record<number, string>> = {
    vivid: {
      1: "JUST HATCHED",
      2: "WARMING UP",
      3: "NOW A BALLER",
      4: "ON THE PROWL",
      5: "ABSOLUTE UNIT",
      6: "APEX BEAST",
    },
    simple: {
      1: "DUSTING OFF",
      2: "PICKING UP",
      3: "GOLD STANDARD",
      4: "ELITE TERRITORY",
      5: "BRILLIANT FORM",
      6: "GAME MASTER",
    },
  };
  const key = theme === "simple" ? "simple" : "vivid";
  return map[key][tierNum] ?? "ON THE GRIND";
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

// Soft-cap log scaler — diminishing returns. Maps a raw count to 0-100.
// v3.1 calibration: denominator multiplier 3× → 5× (originally bumped
// to 10× in v3 but that over-flattened — dedicated 6-12mo users got
// trapped at T4 Lion). 5× gives ~74 at midpoint instead of ~80 (v0)
// or ~60 (v3). Combined with the midpoint bumps in computeAthleteTier,
// this lets 6mo+ users cross into T5 while still slowing brand-new
// users out of T5 territory. (qa: tier-scoring-calibration-v3)
function scoreFromCount(value: number, midpoint: number): number {
  if (value <= 0) return 0;
  const score = 100 * (Math.log(1 + value) / Math.log(1 + midpoint * 5));
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

  // ── v3.2 inputs (qa: tier-strength-absolute-blend, tier-technique-subrank) ──
  // Lifetime sum of WorkoutLog.intensityPoints. Each session can earn
  // up to 25 IP (superset = +5, drop chain = +3). Feeds the Technique
  // sub-rank so users doing supersets/dropsets/etc. actually move the
  // headline. Optional — absent / 0 means hasData=false for Technique.
  totalIntensityPointsLifetime?: number;

  // ── v3.3 input (qa: tier-balance-subrank) ──
  // Sets-per-muscle-group bucket in the last 14 DAYS. Keys are the
  // canonical buckets used by the Balance sub-rank:
  //   "chest" | "back" | "shoulders" | "arms" | "quads" | "posterior" | "core"
  // Bucket mapping (handled by the caller — both server-side
  // computeStatsForUsers and the client-side app/page.tsx compute it):
  //   - arms      = biceps + triceps + forearms
  //   - posterior = hamstrings + glutes + calves
  // 14-day window (was 180d in the first cut — too lenient; users who
  // skipped legs for 3 weeks weren't being warned). Optional — absent
  // / undefined means hasData=false for Balance.
  setsByMuscleGroup?: Record<string, number>;

  // Lucky-drop / smart-pick lifetime bonus (UserProfile.tierScoreBonus).
  // Added to the base headline at the end, capped at LUCKY_BONUS_CAP.
  // Surfaced as a 'Lucky' pseudo sub-rank so the user can see where
  // the bump came from. (qa: random-rare-rewards, suggestion-bonus)
  tierScoreBonus?: number;

  // ── v3.5 inputs (qa: tier-scoring-v35) ──
  // Volume blend: lifetime + recent-90d. Caller passes 90d kg-reps so
  // long-history vets don't ride 5-year-old totals while inactive.
  recentVolumeKg90d?: number;
  // Last 12 weeks of distinct training days. Feeds the pure-adherence
  // Consistency formula (sessionsLast12Weeks / (daysPerWeek × 12)).
  sessionsLast12Weeks?: number;
  // Latest BodyMetric date with a non-null weight reading. Drives the
  // BodyComp freshness ramp — ≤7d full, 8-30d decay, >30d/never floor
  // at 20 (nudges weekly weigh-in).
  weightLastLogMs?: number | null;
  // Self-declared experience level from onboarding (`UserProfile.
  // fitnessLevel`). Seeds the Progression ramp multiplier. Beginner
  // ×1.0, Intermediate ×1.15, Advanced ×1.30. Blended toward observed
  // (e1RM/BW + sessions180d) as account tenure passes 12 weeks; fully
  // observed past 24 weeks. Hidden from UI — no leaderboard column
  // calls this out, no toast tells users they're being ramped.
  fitnessLevel?: string | null;
  // User goal (`UserProfile.goal`) — feeds BodyComp goal-aware
  // maintenance band. "muscle"/"bulk" → ideal +1kg/90d; "cut"/"fat-
  // loss" → ideal -2kg/90d; "maintain" → ideal 0kg/90d.
  goal?: string | null;
  // Account creation timestamp (ms). Drives the declared→observed
  // experience-level blend window (12-24wk).
  accountCreatedAtMs?: number;
};

// v3.5 sub-rank weights — per-dimension contribution to the headline
// score (sum = 100). Previously every counted sub-rank averaged with
// equal weight (~11% each), which let weakly-signalled dims like
// Technique pull the same lever as Strength. v3.5 ranks the dims by
// signal quality + user-facing importance: Strength leads at 20%,
// Consistency at 16%, Volume/Progression each 12%, Mastery/Balance
// each 10%, BodyComp 8%, Habits 7%, Technique 5%. Headline aggregates
// as Σ(score_i × weight_i) / Σ(weight_i). (qa: tier-scoring-v35)
export const SUBRANK_WEIGHTS: Record<string, number> = {
  strength: 20,
  consistency: 16,
  volume: 12,
  progression: 12,
  mastery: 10,
  balance: 10,
  bodycomp: 8,
  habits: 7,
  technique: 5,
};

// Soft floor for sub-ranks with hasData=false. v3.5 changes the
// aggregation rule: empty dims used to be EXCLUDED from the average
// (so users who didn't log wellness weren't penalised — the dim
// simply didn't count). Now empty dims contribute SOFT_FLOOR_SCORE
// (30) at their full weight, so the headline reflects what the user
// is leaving on the table. Two carve-outs:
//   - BodyComp uses its own internal floor (20) keyed to weigh-in
//     freshness — the goal is to nudge weekly logging, not just
//     reward not-tracking.
//   - The 30 floor is chosen so a brand-new user with NO data
//     anywhere lands at exactly 30 (matches the old "Big Dawg" min)
//     instead of the old 0 — avoids a worse new-user experience
//     while still rewarding engagement. (qa: tier-scoring-v35)
const SOFT_FLOOR_SCORE = 30;

// Cap on the lucky-drop / smart-pick lifetime bonus that's additive
// to the headline. Matches the MAX_LIFETIME_BONUS in lib/luckyDrops.ts
// + the suggestion-bonus 20-point cap in /api/workout. Keeps the
// bonus meaningful (5-20% of headline at most) without letting it
// dominate. (qa: random-rare-rewards, suggestion-bonus)
const LUCKY_BONUS_CAP = 20;

// Map a declared/observed experience level to a Progression ramp
// multiplier. Advanced lifters earn MORE Progression credit per
// %-per-week of volume growth — natural gain rates slow at higher
// training ages, so the curve has to bend toward them or veterans
// look like they're stagnating. Multipliers are hidden from UI:
// no leaderboard column, no toast, no settings preview. Users
// shouldn't be able to A/B their declared level for score.
// (qa: tier-scoring-v35)
function experienceLevelToMultiplier(level: string | null | undefined): number {
  const l = (level ?? "").toLowerCase().trim();
  if (l === "advanced" || l === "expert") return 1.30;
  if (l === "intermediate") return 1.15;
  return 1.0; // beginner / unknown / blank
}

// Infer the user's observed experience level from objective signals:
// best e1RM ÷ bodyweight across qualified lifts AND 180-day session
// volume. Used as the OBSERVED side of the Progression ramp blend —
// the declared field gets blended toward this as account tenure
// grows. Thresholds tuned conservatively: hitting Advanced requires
// BOTH a 1.5× BW lift AND ≥60 sessions in 180d, so a few PRs alone
// can't bump you. (qa: tier-scoring-v35)
function inferObservedLevel(e1RMOverBW: number, sessions180d: number): string {
  if (e1RMOverBW >= 1.5 && sessions180d >= 60) return "advanced";
  if (e1RMOverBW >= 1.0 || sessions180d >= 30) return "intermediate";
  return "beginner";
}

// Blend the declared and observed multipliers based on account
// tenure (in weeks). 0-12 wks → 100% declared (new users get the
// benefit of self-assessment). 12-24 wks → linear blend. 24+ wks
// → 100% observed (we've seen enough to grade you). This is the
// "adjusts with the user over time" mechanism @maaiz asked for —
// claiming Advanced on day 1 helps initially, but the system
// self-corrects toward measured reality within 6 months.
// (qa: tier-scoring-v35)
function blendExperienceMultiplier(
  declaredMult: number,
  observedMult: number,
  accountTenureWeeks: number,
): number {
  if (accountTenureWeeks <= 12) return declaredMult;
  if (accountTenureWeeks >= 24) return observedMult;
  const t = (accountTenureWeeks - 12) / 12;
  return declaredMult * (1 - t) + observedMult * t;
}

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
    // Linear ramp 0 → 90 as user approaches target. Cap at 90 (not 100)
    // so "perfect attendance" is high but not maxed — leaves headroom
    // for excellence to drive the headline score upward via the OTHER
    // sub-ranks (strength, volume, mastery). Without this cap a user
    // who simply showed up gets 100 on the biggest weighted component
    // and rides into upper tiers too fast.
    // (qa: tier-scoring-calibration-v3 — @maaiz: "too fast progression")
    return Math.round(ratio * 90);
  }
  // Past target: each 25% over loses 25 points. 2× target → 0.
  // Start from 90 (not 100) per the cap above.
  const excess = ratio - 1.0;
  return Math.max(0, Math.round(90 - excess * 100));
}

// Pure 3-month adherence — actual ÷ target sessions over the last 12
// weeks. Unlike adherenceScore (4w, caps at 90 to leave headroom for
// other dims when Consistency drove 60% of the headline), v3.5 makes
// Consistency a single 16% dim so we cap at 100. The rolling 12w
// window absorbs missed-week noise (illness, travel) without needing
// a separate "deload exemption". Over-training drop mirrors the 4w
// curve. (qa: tier-scoring-v35)
function adherenceScore12w(sessionsLast12Weeks: number, daysPerWeek: number): number {
  const target = Math.max(1, daysPerWeek) * 12;
  if (sessionsLast12Weeks <= 0) return 0;
  const ratio = sessionsLast12Weeks / target;
  if (ratio <= 1.0) return Math.round(ratio * 100);
  const excess = ratio - 1.0;
  return Math.max(0, Math.round(100 - excess * 100));
}

// Strength sub-rank — measures BOTH whether the user is getting
// stronger (rate) AND whether they're objectively strong (absolute).
// v3.5: blend is now 0.6×rate + 0.4×absolute (was max). The max
// rule lets vets coast on absolute alone; the blend forces continued
// effort on the rate side too. When only one signal is available
// (no bodyweight, or no 90d history), the available signal carries
// 100% of the score.
//
// Rate methodology (unchanged from v2/v3):
//   1. Filter to exercises with ≥4 sets logged in the last 180 days.
//   2. Pick the top 6 by set count.
//   3. Best e1RM in first 90d vs best e1RM in last 90d → % change.
//   4. Map -5% → +20% linearly into 25 → 100. Floor at 25.
//
// Absolute methodology (v3.2):
//   - Top e1RM across all qualified exercises ÷ current bodyweight.
//   - 0.5× BW → 20, 1.0× → 40, 1.5× → 60, 2.0× → 80, 2.5× → 100.
//   - Skipped if bodyweight unavailable.
//
// (qa: tier-scoring-calibration-v3, tier-strength-absolute-blend,
// tier-scoring-v35)
function strengthSubRank(
  recentByExercise: Record<string, RecentSet[]>,
  todayMs: number,
  currentBodyweightKg?: number | null,
  weeklyVolumes?: Array<{ weekStartMs: number; volumeKg: number }>,
): { score: number; hasData: boolean; detail: string; pctChange: number | null; qualifiedCount: number } {
  // New-user ramp (qa: tier-newuser-ramp): same 9-training-week
  // ramp Progression uses. A 1-week user benching their own
  // bodyweight shouldn't score 40+ on Strength on day one. After
  // 9 training weeks the score is fully earned and the natural
  // plateau of strength gains takes over (rate-of-change asymptote
  // already lives in the existing calculation).
  const RAMP_WEEKS = 9;
  const weeksLogged = weeklyVolumes?.length ?? 0;
  const rampFactor = Math.min(1, weeksLogged / RAMP_WEEKS);
  const rampSuffix = rampFactor < 1 ? ` · ramping ${Math.round(rampFactor * 100)}%` : "";
  const applyRamp = (raw: number) => Math.round(raw * rampFactor);

  const qualified = Object.entries(recentByExercise)
    .map(([id, sets]) => ({ id, sets, count: sets.length }))
    .filter(e => e.count >= 4)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  // Per @maaiz: copy is unclear — name the gate (4+ sets of any one
  // exercise, plus list the big lifts that score most heavily).
  // (qa: progress-strength-subrank-copy)
  if (qualified.length === 0) return { score: applyRamp(50), hasData: false, detail: "log 4+ sets of any one exercise (squat / bench / DL / OHP score most) to start tracking strength" + rampSuffix, pctChange: null, qualifiedCount: 0 };

  // ── Absolute strength component ────────────────────────────────────
  let topE1RM = 0;
  for (const { sets } of qualified) {
    for (const s of sets) {
      const e = epley1RM(s.weight, s.reps);
      if (e > topE1RM) topE1RM = e;
    }
  }
  let absoluteScore = 0;
  let absoluteHasData = false;
  let absoluteRatio: number | null = null;
  if (currentBodyweightKg && currentBodyweightKg > 0 && topE1RM > 0) {
    absoluteHasData = true;
    absoluteRatio = topE1RM / currentBodyweightKg;
    // Linear: 0.5× → 20, 1.0× → 40, 1.5× → 60, 2.0× → 80, 2.5× → 100
    absoluteScore = Math.min(100, Math.max(20, Math.round(20 + (absoluteRatio - 0.5) * 40)));
  }

  // ── Rate-of-change component ──────────────────────────────────────
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
  let rateScore = 50;
  let rateHasData = false;
  let avgPct: number | null = null;
  if (pctChanges.length > 0) {
    rateHasData = true;
    avgPct = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length;
    const raw = 25 + ((avgPct + 0.05) / 0.25) * 75;
    rateScore = Math.max(25, Math.min(100, Math.round(raw)));
  }

  // ── Blend ─────────────────────────────────────────────────────────
  const hasData = rateHasData || absoluteHasData;
  if (!hasData) {
    return { score: applyRamp(50), hasData: false, detail: "keep logging — strength trend kicks in past 90d of history" + rampSuffix, pctChange: null, qualifiedCount: qualified.length };
  }
  // max() so the dominant signal wins — beginners ride rate, veterans
  // ride absolute. Plateaued amateurs get the better of two modest
  // scores.
  const finalScore = Math.max(rateScore, absoluteScore);

  let detail: string;
  if (rateHasData && absoluteHasData) {
    const pctRounded = Math.round((avgPct as number) * 1000) / 10;
    detail = `${pctRounded >= 0 ? "+" : ""}${pctRounded}% e1RM · best ${Math.round(topE1RM)}kg (${(absoluteRatio as number).toFixed(2)}× BW)`;
  } else if (rateHasData) {
    const pctRounded = Math.round((avgPct as number) * 1000) / 10;
    detail = `${pctRounded >= 0 ? "+" : ""}${pctRounded}% e1RM (180d, top ${pctChanges.length})`;
  } else {
    detail = `best e1RM ${Math.round(topE1RM)}kg (${(absoluteRatio as number).toFixed(2)}× BW) · trend pending`;
  }
  return { score: applyRamp(finalScore), hasData: true, detail: detail + rampSuffix, pctChange: avgPct, qualifiedCount: qualified.length };
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
  // New-user ramp (qa: tier-newuser-ramp): instead of handing brand-
  // new users a flat 50-point freebie until they hit the 9-week
  // unlock, ramp the floor linearly. Weeks 0/9 → 0pts, 4/9 → 22,
  // 8/9 → 44, 9+ → real slope at full credit. Kills the 13-day
  // accounts that vaulted to Lion off the free 6pts from Progression
  // alone. Per @maaiz "stepped % every week until reaching 100".
  const RAMP_WEEKS = 9;
  const weeksLogged = weekly?.length ?? 0;
  if (weeksLogged < RAMP_WEEKS) {
    const ramped = Math.round(50 * weeksLogged / RAMP_WEEKS);
    const remaining = RAMP_WEEKS - weeksLogged;
    return {
      score: ramped,
      hasData: false,
      detail: weeksLogged > 0
        ? `${weeksLogged}/${RAMP_WEEKS} weeks logged · ramping ${Math.round(100 * weeksLogged / RAMP_WEEKS)}% (log ${remaining} more week${remaining === 1 ? "" : "s"} to unlock full progression scoring)`
        : "log at least one full week of workouts to start tracking week-over-week volume",
      slopePct: null,
    };
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
  // Consistency v3.1 — sessions180d midpoint 60 → 80 (was 100 in v3 but
  // that flattened the curve too aggressively). 80 sessions in 180d ≈
  // 3.1/wk which is a sensible "established weekly trainer" benchmark.
  // (qa: tier-scoring-calibration-v3)
  const consistency = Math.round(
    0.3 * scoreFromCount(recent180dSessions, 80) +
    0.6 * adherence +
    0.1 * scoreFromCount(weeklyStreak, 8)
  );

  // Strength v3.2 — rate-of-change blended with absolute strength
  // (best e1RM ÷ bodyweight) via max(). Veterans plateaued at elite
  // numbers no longer regress as gain rates naturally slow.
  // (qa: tier-strength-absolute-blend)
  const todayMs = Date.now();
  const strengthRes = strengthSubRank(s.recentSetsByExercise ?? {}, todayMs, s.weightCurrentKg, s.weeklyVolumes);

  // Progression v2 — new sub-rank. Weekly volume regression slope.
  const progressionRes = progressionSubRank(s.weeklyVolumes ?? []);

  // Volume v3.1 — sqrt curve against 3M kg-reps ceiling (was 5M in
  // v3, which left 6mo users at Volume=48 and trapped them at T4).
  // 3M ceiling: 1M → 58, 2M → 82, 3M → 100. Years of training still
  // hit 100, but 6mo dedicated lifters get a believable 55-65.
  // (qa: tier-scoring-calibration-v3)
  const volume = Math.min(100, Math.max(0, Math.round(100 * Math.sqrt(Math.max(0, s.totalVolumeKg) / 3_000_000))));

  // Mastery v2 — exercises with ≥4 sets in 180d (depth-weighted
  // distinct count). Raises the bar from naive "logged at least
  // once" so doing the same 25 lifts seriously isn't worse than
  // dabbling in 25 random movements.
  //
  // Per @maaiz: "Maaiz has 80 mastery but he's probably not done many
  // different exercises just 1 routine and not for that long yet". The
  // legacy fallback to `distinctExercises` was inflating the score for
  // users who've TRIED many exercises but mastered few. Drop the fallback
  // — if there's no recent-set data, mastery is honestly 0.
  // (qa: progress-mastery-subrank-audit)
  const recentByEx = s.recentSetsByExercise ?? {};
  const masteryQualified = Object.values(recentByEx).filter(arr => (arr?.length ?? 0) >= 4).length;
  const masteryCount = masteryQualified;
  const masteryHasData = Object.keys(recentByEx).length > 0 && masteryQualified > 0;
  // Mastery v3.2 — midpoint bumped 20 → 25 to honestly reward depth
  // (a user with 5 qualified exercises scores ~37, not ~58). Pairs
  // with the no-legacy-fallback above. (qa: progress-mastery-subrank-audit)
  let mastery = scoreFromCount(masteryCount, 25);
  // Hard cap at 60 when the user has only logged one routine's worth
  // of distinct exercises and no breadth — single-routine users were
  // crossing 80 which felt unearned. (qa: progress-mastery-subrank-audit)
  if (masteryQualified > 0 && masteryQualified <= 6) {
    mastery = Math.min(mastery, 60);
  }

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

  // Technique v3.2 — rewards intensity work logged via supersets /
  // drop chains / techniques. Each session can earn up to 25 IP
  // (superset = +5, drop chain = +3). Lifetime total is summed.
  // Midpoint 200 IP = ~40 technique-sessions, hits ~77 at mid; 500 IP
  // climbs toward 90+. (qa: tier-technique-subrank)
  const techniquePts = s.totalIntensityPointsLifetime ?? 0;
  const technique = scoreFromCount(techniquePts, 200);
  const techniqueHasData = techniquePts > 0;

  // Balance v3.3 — rewards covering all 7 major muscle-group buckets
  // in the last 14 DAYS (was 180d in the first cut — too lenient;
  // users skipping legs for 3 weeks weren't being warned). Each bucket
  // needs ≥3 sets in the 14d window to count as "covered" (roughly
  // one focused movement targeting that area). Score = (covered
  // buckets / 7) × 100. Skipped (hasData=false) until ≥4 sessions in
  // the last 14d so lapsed / brand-new users aren't penalised.
  //
  // Bucket map (the upstream caller supplies setsByMuscleGroup with
  // these canonical keys — see lib/exercises.ts MuscleGroup type for
  // the raw → bucket mapping):
  //   chest · back · shoulders · arms · quads · posterior · core
  // (qa: tier-balance-subrank)
  const BUCKETS = ["chest", "back", "shoulders", "arms", "quads", "posterior", "core"] as const;
  const MIN_SETS_PER_BUCKET = 3;
  const setsByGroup = s.setsByMuscleGroup ?? {};
  const coveredBuckets = BUCKETS.filter(b => (setsByGroup[b] ?? 0) >= MIN_SETS_PER_BUCKET);
  const balance = Math.round((coveredBuckets.length / BUCKETS.length) * 100);
  // Recency gate: need at least 4 sessions in the last 4 weeks to
  // assess balance fairly (a complete cycle of upper + lower would
  // span ~2 weeks; 4 sessions guarantees enough volume to grade).
  // Also requires at least one bucket has SOME data so a brand-new
  // user with zero sets logged is skipped.
  const recentEnoughForBalance = (s.sessionsLast4Weeks ?? 0) >= 4;
  const balanceHasData = recentEnoughForBalance && Object.keys(setsByGroup).length > 0;
  // Detail string surfaces which buckets are missing so the user
  // knows exactly which area to attack RIGHT NOW (14d window means
  // the gap is recent and actionable).
  const missingBuckets = BUCKETS.filter(b => (setsByGroup[b] ?? 0) < MIN_SETS_PER_BUCKET);
  const balanceDetail = balanceHasData
    ? (missingBuckets.length === 0
        ? `all ${BUCKETS.length} muscle groups touched (14d)`
        : `${coveredBuckets.length}/${BUCKETS.length} groups (14d) · neglected: ${missingBuckets.join(", ")}`)
    : "log ≥4 sessions in 4 weeks to unlock the balance check";

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
    // Technique copy: name ALL three sources of intensity points so the
    // user doesn't see "supersets/dropsets" and miss that RPE-per-set
    // also feeds this. Per @maaiz: "Technique subrank says super sets
    // for drop sets for IP, but we also get IP from the RPE per set?
    // Make it make sense". (qa: progress-technique-subrank-copy)
    { id: "technique",   label: "Technique",   icon: "⚡", score: technique,        detail: techniqueHasData ? `${techniquePts} IP lifetime · RPE per set + supersets + drop sets` : "earn IP via RPE-tagged sets, supersets, or drop chains", hasData: techniqueHasData },
    { id: "balance",     label: "Balance",     icon: "⚖️", score: balance,          detail: balanceDetail,                                             hasData: balanceHasData },
    { id: "bodycomp",    label: "Body Comp",   icon: "🧬", score: bcRes.score,      detail: bcRes.detail,                                              hasData: bcRes.hasData },
    { id: "habits",      label: "Habits",      icon: "💧", score: habits,           detail: `${hg}d hydration · ${sl}d sleep · ${en}d energy (14d)`,    hasData: habitsAny },
  ];

  // Headline = average over sub-ranks WITH data. Users who don't
  // log wellness, don't track body comp, or have no exercise history
  // yet aren't silently penalised for empty dims. Consistency is
  // always counted (everyone has session data — even 0 sessions is
  // a signal).
  const counted = subRanks.filter(r => r.hasData);
  const baseHeadline = counted.length > 0
    ? Math.round(counted.reduce((sum, r) => sum + r.score, 0) / counted.length)
    : 0;

  // Lucky-drop / Smart-pick bonus — additive on top of the base
  // headline, capped at LUCKY_BONUS_CAP. v2 removed this because
  // it was a 'silent injection' that broke single-source-of-truth.
  // v3.5 brings it back AS A VISIBLE component: surfaced as its own
  // 'Lucky' pseudo sub-rank so the user can see exactly how many
  // points came from rare drops + smart-pick suggestions.
  // (qa: random-rare-rewards, suggestion-bonus)
  const luckyBonus = Math.max(0, Math.min(LUCKY_BONUS_CAP, Math.round(s.tierScoreBonus ?? 0)));
  if (luckyBonus > 0) {
    subRanks.push({
      id: "lucky",
      label: "Lucky",
      icon: "🍀",
      // Display as fraction of cap (out of 100 for sub-rank scale)
      // so the breakdown surface can show the bar visually.
      score: Math.round((luckyBonus / LUCKY_BONUS_CAP) * 100),
      detail: `+${luckyBonus} lifetime · rare drops + smart-pick bonuses`,
      hasData: true,
    });
  }
  const headlineScore = Math.max(0, Math.min(100, baseHeadline + luckyBonus));

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
