// Tier system — multi-dimensional. The headline animal/badge tier is
// derived from a weighted average of 4 sub-ranks, each 0–100. Single
// source of truth: every surface (Settings chip, Progress card, leader-
// board row, group ranking) imports from here. No duplicate ladders.

export type AnimalTier = {
  label: string;
  icon: string;
  // The MIN headline score required to reach this tier (0-100).
  min: number;
  color: string;
  bg: string;
  border: string;
};

// Athlete ladder — animal tiers. Headline score = average of 4 sub-ranks.
export const ATHLETE_TIERS: AnimalTier[] = [
  { label: "Kitten",  icon: "🐱", min: 0,  color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
  { label: "Monkey",  icon: "🐒", min: 15, color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)"  },
  { label: "Fox",     icon: "🦊", min: 30, color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"   },
  { label: "Tiger",   icon: "🐯", min: 50, color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.3)"   },
  { label: "Lion",    icon: "🦁", min: 70, color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.35)"  },
  { label: "Gorilla", icon: "🦍", min: 90, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)"  },
];

// Trainer ladder — same animal vibe, different sub-ranks (see below).
export const TRAINER_TIERS: AnimalTier[] = [
  { label: "Rookie", icon: "🏅", min: 0,  color: "#A29BFE", bg: "rgba(162,155,254,0.10)", border: "rgba(162,155,254,0.3)" },
  { label: "Coach",  icon: "🎯", min: 25, color: "#4ECDC4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.3)"  },
  { label: "Pro",    icon: "⚡", min: 50, color: "#FFD166", bg: "rgba(255,209,102,0.10)", border: "rgba(255,209,102,0.35)" },
  { label: "Elite",  icon: "👑", min: 75, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
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
  distinctExercises: number; // exercises the user has logged at least once
  monthsOnApp: number;
};

export function computeAthleteTier(s: AthleteStatsForTier): TierBreakdown {
  // 4 sub-ranks. Numbers tuned to be motivating in the early game.
  const consistency = Math.round(
    0.6 * scoreFromCount(s.totalSessions, 100) +
    0.4 * scoreFromCount(s.streak, 14)
  );
  const strength = scoreFromCount(s.prCount, 30);
  const volume = scoreFromCount(s.totalVolumeKg, 100_000); // 100k kg-reps = ~80
  const mastery = scoreFromCount(s.distinctExercises, 25);

  const subRanks: SubRank[] = [
    { id: "consistency", label: "Consistency", icon: "🔁", score: consistency, detail: `${s.totalSessions} sessions · ${s.streak}d streak` },
    { id: "strength",    label: "Strength",    icon: "💪", score: strength,    detail: `${s.prCount} personal bests` },
    { id: "volume",      label: "Volume",      icon: "📈", score: volume,      detail: `${Math.round(s.totalVolumeKg / 1000)}k kg-reps lifetime` },
    { id: "mastery",     label: "Mastery",     icon: "🏆", score: mastery,     detail: `${s.distinctExercises} distinct exercises` },
  ];

  const headlineScore = Math.round(subRanks.reduce((sum, r) => sum + r.score, 0) / subRanks.length);
  let headline = ATHLETE_TIERS[0];
  for (const t of ATHLETE_TIERS) if (headlineScore >= t.min) headline = t;

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

  const subRanks: SubRank[] = [
    { id: "roster",      label: "Roster",      icon: "👥", score: roster,      detail: `${s.rosterCount} active clients` },
    { id: "progression", label: "Progression", icon: "🚀", score: progression, detail: `${s.clientsWithRecentPR}/${s.rosterCount} clients hit a PR last 30d` },
    { id: "retention",   label: "Retention",   icon: "🔁", score: retention,   detail: `${s.clientsWithActiveStreak}/${s.rosterCount} clients on a streak` },
    { id: "reach",       label: "Reach",       icon: "⭐", score: reach,       detail: `${s.totalClientPRs} PRs · ${Math.round(s.totalClientVolumeKg / 1000)}k kg-reps total` },
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
export function getAthleteTierFromBasics(s: AthleteStatsForTier): AnimalTier {
  return computeAthleteTier(s).headline;
}
