// Achievements — pre-defined unlock triggers fired on each session
// save. Each is checked against an `AchievementState` snapshot of the
// user's training history; the ones that newly cross are recorded for
// the user (server-side in the UserAchievement table via
// /api/achievements, with a localStorage cache under
// `ironlog-achievements-v1`).
//
// (Historically called "milestones" — same concept; the module was
// renamed to "achievements" on 2026-06-08 to match the user-facing
// 🏆 ACHIEVEMENTS surface. Stable ids are unchanged so no earned
// unlocks were lost.)
//
// Adding a new achievement: append to the `ACHIEVEMENTS` array. ids are
// stable — never reuse them. Removing one is fine (existing unlocks
// just become unreachable orphans, no data loss).

export type AchievementState = {
  joinedDaysAgo: number;      // calendar days since the user's account was created
  totalSessions: number;      // lifetime
  longestStreakDays: number;
  prCount: number;
  hasUsedSuperset: boolean;
  hasUsedDropSet: boolean;
  hasAcceptedDeload: boolean;
  athleteTierLabel: string;   // current animal tier label (theme-specific)
  // Universal 1-6 tier rank — preferred for milestone checks since
  // the same rank can be labelled differently by theme (Tier 4 =
  // Lion in vivid OR Platinum in simple). (qa: tier-themes)
  athleteTierNum: number;
  // Most recent body fat % the user has logged (null if they've
  // never logged one). Feeds the "Unlock Your Abs" milestone.
  // (qa: mission-unlock-abs)
  currentBodyFatPct?: number | null;
  // Best weight ever logged by lowercased exercise name. Feeds the
  // strength-benchmark milestones (bench press 60/100/140 etc.) so
  // they don't depend on a specific internal exercise id. Caller
  // walks history and pre-computes this. Missing names map to 0.
  // (qa: achievements-strength-benchmarks)
  maxByName?: Record<string, number>;
  // Best reps in a single set, by lowercased exercise name. Feeds
  // bodyweight milestones (push-ups, pull-ups, sit-ups, dips, BW
  // squats) where the rep count IS the benchmark — load is constant
  // (your bodyweight) so absolute reps measure capacity directly.
  // Thresholds calibrated against global fitness averages (US Army
  // APFT, ACSM norms, NSCA testing protocols).
  // (qa: achievements-bodyweight-benchmarks)
  maxRepsByName?: Record<string, number>;
  // Lifetime total volume in kg×reps. Feeds the volume milestones.
  totalVolumeKg?: number;
  // Lifetime count of sessions where AT LEAST ONE exercise was
  // tagged with category=hiit OR category=cardio (or modality
  // equivalents). Feeds HIIT / cardio milestones. (qa:
  // achievements-cardio-hiit)
  hiitSessionCount?: number;
  cardioSessionCount?: number;
  // Estimated total cardio distance + minutes across history.
  // Distance = time × speed where speed is taken from the cardio
  // exercise metadata (treadmill 8 km/h, run 10 km/h, etc.). Used
  // for the cardio-distance milestones.
  totalCardioMinutes?: number;
  totalCardioKm?: number;
  // First-use behaviour flags. Track when a user explores a feature.
  hasUsedWarmup?: boolean;
  hasUsedCooldown?: boolean;
  // Lifetime count of sessions where the user logged ≥1 warmup
  // set (or cooldown set). Feeds the habit-formation milestones.
  // (qa: achievements-warmup-cooldown-habits)
  warmupSessionCount?: number;
  cooldownSessionCount?: number;
};

// Pick the best weight across one or more exercise-name substrings.
// e.g. `bestForNames(state, ["bench press"])` returns the max kg
// across any exercise whose lowercased name contains "bench press".
// Returns 0 if no matching exercise has been logged. Multiple names
// let one milestone catch synonyms ("OHP" / "overhead press" /
// "shoulder press"). (qa: achievements-strength-benchmarks)
export function bestForNames(state: AchievementState, names: string[]): number {
  const map = state.maxByName ?? {};
  let best = 0;
  for (const exName in map) {
    for (const target of names) {
      if (exName.includes(target.toLowerCase())) {
        if (map[exName] > best) best = map[exName];
        break;
      }
    }
  }
  return best;
}

// Same as bestForNames but operates on maxRepsByName — max reps in a
// single set across any matching exercise. Used by bodyweight
// milestones (push-ups / pull-ups / sit-ups / dips / BW squats).
// (qa: achievements-bodyweight-benchmarks)
export function bestRepsForNames(state: AchievementState, names: string[]): number {
  const map = state.maxRepsByName ?? {};
  let best = 0;
  for (const exName in map) {
    for (const target of names) {
      if (exName.includes(target.toLowerCase())) {
        if (map[exName] > best) best = map[exName];
        break;
      }
    }
  }
  return best;
}

export type Achievement = {
  id: string;
  label: string;       // headline shown on the celebration overlay
  body: string;        // 1-2 sentence flavour text
  icon: string;        // single emoji
  category: "anniversary" | "consistency" | "strength" | "behaviour" | "tier" | "hiit" | "cardio" | "volume" | "bodyweight" | "warmup-cooldown";
  // Premium tag — when true, hitting this milestone also unlocks a
  // bonus avatar (linked by the milestone id ↔ avatar id mapping
  // in lib/avatars.ts). Render gold-banner styling on the celebration
  // overlay + an extra "+ AVATAR UNLOCKED" line.
  // (qa: achievements-premium-bonus-avatars)
  premium?: boolean;
  // Plain-English "how to earn this" string. Shown in the info modal for
  // locked milestones so users know what to work toward. New ids should
  // always include one; missing falls back to body.
  requirement: string;
  check: (s: AchievementState) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ── Anniversary milestones (calendar-based, not effort-based) ─────────
  { id: "first-day",     label: "Welcome to IRONLOG",       body: "Day 1. The streak starts now.",                       icon: "🎉", category: "anniversary", requirement: "Log your first session.",                                                  check: s => s.joinedDaysAgo >= 1   && s.totalSessions >= 1 },
  { id: "week-one",      label: "One week in",              body: "Seven days on the app. Most people quit before this.", icon: "🌅", category: "anniversary", requirement: "Stay active on IRONLOG for 7 days from your join date.",                  check: s => s.joinedDaysAgo >= 7 },
  { id: "month-one",     label: "First month landed",       body: "30 days. A habit is forming.",                         icon: "📅", category: "anniversary", requirement: "Be on IRONLOG for 30 days.",                                              check: s => s.joinedDaysAgo >= 30 },
  { id: "month-three",   label: "Quarter of a year",        body: "90 days. The system isn't a trial — it's training.",   icon: "🌳", category: "anniversary", requirement: "Be on IRONLOG for 90 days.",                                              check: s => s.joinedDaysAgo >= 90 },
  { id: "month-six",     label: "Half a year strong",       body: "180 days. Your recorded experience level has officially expired — it's all real data now.", icon: "🔥", category: "anniversary", requirement: "Be on IRONLOG for 180 days. Your onboarding experience level expires here.", check: s => s.joinedDaysAgo >= 180 },
  { id: "year-one",      label: "One year on IRONLOG",      body: "365 days. You've earned this.",                        icon: "🏆", category: "anniversary", requirement: "Be on IRONLOG for a full year.",                                          check: s => s.joinedDaysAgo >= 365 },
  { id: "year-two",      label: "Two years on IRONLOG",     body: "730 days. This isn't a phase — it's who you are.",      icon: "🎖️", category: "anniversary", requirement: "Be on IRONLOG for two full years.",                                       check: s => s.joinedDaysAgo >= 730 },

  // ── Consistency / session count ───────────────────────────────────────
  { id: "session-1",     label: "First session logged",     body: "The hardest one is done.",                              icon: "✅", category: "consistency", requirement: "Complete and log 1 session.",      check: s => s.totalSessions >= 1   },
  { id: "session-10",    label: "10 sessions",              body: "Ten down. Routine has a foothold.",                     icon: "🔟", category: "consistency", requirement: "Complete 10 lifetime sessions.",  check: s => s.totalSessions >= 10  },
  { id: "session-50",    label: "50 sessions",              body: "Half a hundred. The pattern is yours now.",             icon: "5️⃣0️⃣", category: "consistency", requirement: "Complete 50 lifetime sessions.",  check: s => s.totalSessions >= 50  },
  { id: "session-100",   label: "100 sessions",             body: "Triple digits. You're a regular.",                      icon: "💯", category: "consistency", requirement: "Complete 100 lifetime sessions.", check: s => s.totalSessions >= 100 },
  { id: "session-250",   label: "250 sessions",             body: "Most lifters never get here.",                          icon: "🎯", category: "consistency", requirement: "Complete 250 lifetime sessions.", check: s => s.totalSessions >= 250 },
  { id: "session-500",   label: "500 sessions",             body: "A small fraction of the human population is here.",     icon: "🌟", category: "consistency", requirement: "Complete 500 lifetime sessions.", check: s => s.totalSessions >= 500 },
  { id: "session-1000",  label: "1,000 sessions",           body: "Statistically incredible. The dojo bows to you.",       icon: "🐉", category: "consistency", requirement: "Complete 1,000 lifetime sessions.", check: s => s.totalSessions >= 1000 },
  { id: "streak-7",      label: "7-day streak",             body: "A full week without missing.",                          icon: "🔥", category: "consistency", requirement: "Train at least once a day for 7 consecutive days.",    check: s => s.longestStreakDays >= 7 },
  { id: "streak-30",     label: "30-day streak",            body: "A whole month uninterrupted. Untouchable.",             icon: "⚡", category: "consistency", requirement: "Train at least once a day for 30 consecutive days.",   check: s => s.longestStreakDays >= 30 },
  { id: "streak-100",    label: "100-day streak",           body: "Ridiculous. Genuinely.",                                icon: "🌋", category: "consistency", requirement: "Train at least once a day for 100 consecutive days.",  check: s => s.longestStreakDays >= 100 },
  { id: "streak-365",    label: "365-day streak",           body: "A full year without a single missed day. Mythical.",    icon: "🗓️", category: "consistency", requirement: "Train at least once a day for 365 consecutive days.",  check: s => s.longestStreakDays >= 365 },

  // ── Strength / PRs ───────────────────────────────────────────────────
  { id: "first-pr",      label: "First personal best",      body: "Heavier than you've ever lifted. Mark the day.",        icon: "🥇", category: "strength", requirement: "Set a personal best on any exercise (most weight × reps).",         check: s => s.prCount >= 1   },
  { id: "ten-prs",       label: "10 personal bests",        body: "Ten lifts at their peak. Real strength gains.",         icon: "🥈", category: "strength", requirement: "Set personal bests across 10 different exercises.",                  check: s => s.prCount >= 10  },
  { id: "fifty-prs",     label: "50 personal bests",        body: "You're getting strong across the board.",               icon: "🥉", category: "strength", requirement: "Set personal bests across 50 different exercises.",                  check: s => s.prCount >= 50  },
  { id: "hundred-prs",   label: "100 personal bests",       body: "Triple-digit PB count. You're not the same person.",    icon: "👑", category: "strength", requirement: "Set personal bests across 100 different exercises.",                 check: s => s.prCount >= 100 },
  { id: "prs-250",       label: "250 personal bests",       body: "A quarter-thousand peaks. Relentless progression.",     icon: "🏵️", category: "strength", requirement: "Set personal bests across 250 different exercises.",                 check: s => s.prCount >= 250 },

  // ── Behaviour milestones — used a feature for the first time ─────────
  { id: "first-superset",label: "First superset",           body: "Two exercises, no rest. The dojo respects pace.",       icon: "⟳", category: "behaviour", requirement: "Pair two exercises into a superset in an active workout (+ SUPERSET).", check: s => s.hasUsedSuperset },
  { id: "first-dropset", label: "First drop set",           body: "To failure, drop, again. Brutal.",                      icon: "🔻", category: "behaviour", requirement: "Mark an exercise as a drop set and complete it (toggle + DROP SET).",   check: s => s.hasUsedDropSet },
  { id: "first-deload",  label: "First deload accepted",    body: "Smart lifters take the foot off the gas. Good move.",   icon: "🛟", category: "behaviour", requirement: "Accept the 🛟 DELOAD SUGGESTED banner when the app offers one.",       check: s => s.hasAcceptedDeload },

  // ── Tier-up — fire once per tier crossed. IDs are stable (any
  //    existing achievement keeps its slot in localStorage). Checks
  //    use athleteTierNum so they're correct regardless of which
  //    theme (vivid / simple) the user has chosen — Tier 2 = Fox in
  //    vivid OR Silver in simple, but the milestone fires either way.
  //    Labels follow the VIVID default theme; the celebration overlay
  //    overlays the user's CURRENT theme label at render time.
  //    (qa: tier-themes)
  { id: "tier-monkey",   label: "Reached Tier 2 — Fox",      body: "Cunning, quick, adaptive. You're past the starter line.", icon: "🦊", category: "tier", requirement: "Reach Tier 2 (headline tier score ≥ 15).", check: s => s.athleteTierNum >= 2 },
  { id: "tier-fox",      label: "Reached Tier 3 — Big Dawg", body: "Big Dawg energy. The pack respects pace like yours.",     icon: "🐕", category: "tier", requirement: "Reach Tier 3 (headline tier score ≥ 30).", check: s => s.athleteTierNum >= 3 },
  { id: "tier-tiger",    label: "Reached Tier 4 — Lion",     body: "King of your own training. The pride watches.",            icon: "🦁", category: "tier", requirement: "Reach Tier 4 (headline tier score ≥ 50).", check: s => s.athleteTierNum >= 4 },
  { id: "tier-lion",     label: "Reached Tier 5 — Gorilla",  body: "Absolute unit. The work shows.",                            icon: "🦍", category: "tier", requirement: "Reach Tier 5 (headline tier score ≥ 70).", check: s => s.athleteTierNum >= 5 },
  { id: "tier-gorilla",  label: "Reached Tier 6 — Bear",     body: "Apex. Top fraction of trainees. Untouchable foundation.",   icon: "🐻", category: "tier", requirement: "Reach Tier 6 (headline tier score ≥ 90).", check: s => s.athleteTierNum >= 6 },

  // ── Body composition unlocks ─────────────────────────────────────────
  // (qa: mission-unlock-abs)
  { id: "abs-unlocked",  label: "Abs Unlocked",              body: "Body fat at 15% or under — the six-pack reveal threshold. The work shows.", icon: "🔓", category: "behaviour", requirement: "Log a body fat reading of 15% or lower.", check: s => s.currentBodyFatPct != null && s.currentBodyFatPct <= 15 },

  // ── Strength benchmarks — specific weight targets on the big lifts.
  //    Per @maaiz: 'Strength achievements like difficult to achieve
  //    target weights on particular major exercises (like a bench
  //    press goal)'. Each check uses bestForNames(state, [...]) so it
  //    matches any variant (barbell bench, incline bench all count).
  //    Bench press benchmarks pace the industry plate counts:
  //      60kg ≈ "1 plate on a 20kg bar" (10kg per side)
  //      100kg ≈ "1 big plate per side" (40kg per side + bar)
  //      140kg ≈ "3 plates per side"
  //    Same logic for squat / deadlift / overhead press / row.
  //    (qa: achievements-strength-benchmarks)
  { id: "bench-60kg",    label: "Bench Press · 60 kg",       body: "1 plate per side. The first real bench milestone.", icon: "🏋️", category: "strength", requirement: "Log a bench press set at 60 kg or more.",  check: s => bestForNames(s, ["bench press"]) >= 60 },
  { id: "bench-100kg",   label: "Bench Press · 100 kg",      body: "1 big plate per side + bar. A genuine strength benchmark.", icon: "🥉", category: "strength", requirement: "Log a bench press set at 100 kg or more.", check: s => bestForNames(s, ["bench press"]) >= 100 },
  { id: "bench-140kg",   label: "Bench Press · 140 kg",      body: "3 plates per side. Top 5% of intermediate lifters.", icon: "🥈", category: "strength", requirement: "Log a bench press set at 140 kg or more.", check: s => bestForNames(s, ["bench press"]) >= 140 },
  { id: "bench-180kg",   label: "Bench Press · 180 kg",      body: "4 plates per side. Genuinely strong.",              icon: "🥇", category: "strength", requirement: "Log a bench press set at 180 kg or more.", check: s => bestForNames(s, ["bench press"]) >= 180 },
  { id: "squat-100kg",   label: "Squat · 100 kg",            body: "1 plate per side + bar. The squat club's door opens here.", icon: "🦵", category: "strength", requirement: "Log a squat set at 100 kg or more.",      check: s => bestForNames(s, ["squat"]) >= 100 },
  { id: "squat-140kg",   label: "Squat · 140 kg",            body: "3 plates per side. Strong-club territory.",         icon: "🥋", category: "strength", requirement: "Log a squat set at 140 kg or more.",      check: s => bestForNames(s, ["squat"]) >= 140 },
  { id: "squat-180kg",   label: "Squat · 180 kg",            body: "4 plates per side. Elite intermediate range.",       icon: "🐂", category: "strength", requirement: "Log a squat set at 180 kg or more.",      check: s => bestForNames(s, ["squat"]) >= 180 },
  { id: "deadlift-100kg",label: "Deadlift · 100 kg",         body: "1 plate per side. Floor pulled clean.",              icon: "🪨", category: "strength", requirement: "Log a deadlift set at 100 kg or more.",   check: s => bestForNames(s, ["deadlift"]) >= 100 },
  { id: "deadlift-180kg",label: "Deadlift · 180 kg",         body: "4 plates per side. Real pulling strength.",          icon: "⚓", category: "strength", requirement: "Log a deadlift set at 180 kg or more.",   check: s => bestForNames(s, ["deadlift"]) >= 180 },
  { id: "deadlift-220kg",label: "Deadlift · 220 kg",         body: "5 plates per side. Top of the intermediate ladder.", icon: "🐉", category: "strength", requirement: "Log a deadlift set at 220 kg or more.",   check: s => bestForNames(s, ["deadlift"]) >= 220 },
  { id: "ohp-60kg",      label: "Overhead Press · 60 kg",    body: "Straight bar to lockout. Real shoulder strength.",   icon: "🗿", category: "strength", requirement: "Log an overhead/military/shoulder press set at 60 kg or more.", check: s => bestForNames(s, ["overhead press", "military press", "shoulder press"]) >= 60 },
  { id: "ohp-80kg",      label: "Overhead Press · 80 kg",    body: "Few lifters get here without years of work.",        icon: "🏛️", category: "strength", requirement: "Log an overhead/military/shoulder press set at 80 kg or more.", check: s => bestForNames(s, ["overhead press", "military press", "shoulder press"]) >= 80 },
  { id: "row-80kg",      label: "Barbell Row · 80 kg",       body: "Heavy back work pays compound dividends.",           icon: "🚣", category: "strength", requirement: "Log a barbell row set at 80 kg or more.", check: s => bestForNames(s, ["barbell row", "bent over row", "pendlay"]) >= 80 },
  { id: "hipthrust-100kg", label: "Hip Thrust · 100 kg",     body: "Glutes that move real load.",                        icon: "🍑", category: "strength", requirement: "Log a hip thrust set at 100 kg or more.", check: s => bestForNames(s, ["hip thrust"]) >= 100 },
  { id: "hipthrust-180kg", label: "Hip Thrust · 180 kg",     body: "Posterior-chain power. A sprinter's engine.",        icon: "🚂", category: "strength", requirement: "Log a hip thrust set at 180 kg or more.", check: s => bestForNames(s, ["hip thrust"]) >= 180 },
  { id: "legpress-200kg",  label: "Leg Press · 200 kg",      body: "Two hundred on the sled. Quads loaded.",             icon: "🦿", category: "strength", requirement: "Log a leg press set at 200 kg or more.", check: s => bestForNames(s, ["leg press"]) >= 200 },
  { id: "legpress-300kg",  label: "Leg Press · 300 kg",      body: "Three plates of sled. Tree-trunk legs.",             icon: "🌲", category: "strength", requirement: "Log a leg press set at 300 kg or more.", check: s => bestForNames(s, ["leg press"]) >= 300 },
  { id: "1000-club",     label: "1,000 lb Club (total)",     body: "Bench + squat + deadlift summed past 1,000 lb (455 kg). A classic strength milestone.", icon: "💎", category: "strength", requirement: "Have lifetime PBs in bench + squat + deadlift summing to 455 kg or more.", check: s => (bestForNames(s, ["bench press"]) + bestForNames(s, ["squat"]) + bestForNames(s, ["deadlift"])) >= 455 },
  { id: "plate-trio",    label: "Plate Trio",                body: "Bench, squat, AND deadlift all past 100 kg. A balanced base — no skipped lifts.", icon: "🎰", category: "strength", requirement: "Log bench, squat, and deadlift each at 100 kg or more.", check: s => bestForNames(s, ["bench press"]) >= 100 && bestForNames(s, ["squat"]) >= 100 && bestForNames(s, ["deadlift"]) >= 100 },
  { id: "two-plate-club", label: "Two-Plate Club",           body: "Bench 100 · Squat 140 · Deadlift 180 — two plates per side across the board.", icon: "💠", category: "strength", requirement: "Bench ≥ 100 kg, squat ≥ 140 kg, and deadlift ≥ 180 kg.", check: s => bestForNames(s, ["bench press"]) >= 100 && bestForNames(s, ["squat"]) >= 140 && bestForNames(s, ["deadlift"]) >= 180 },

  // ── HIIT — short-burst conditioning sessions. (qa: achievements-cardio-hiit)
  { id: "hiit-first",    label: "First HIIT session",        body: "Heart rate slammed. Conditioning gains start now.",  icon: "⚡", category: "hiit", requirement: "Complete a HIIT-tagged workout once.",                check: s => (s.hiitSessionCount ?? 0) >= 1 },
  { id: "hiit-10",       label: "10 HIIT sessions",          body: "Conditioning is sharpening.",                        icon: "🌀", category: "hiit", requirement: "Complete 10 HIIT-tagged workouts.",                  check: s => (s.hiitSessionCount ?? 0) >= 10 },
  { id: "hiit-50",       label: "50 HIIT sessions",          body: "Your engine is built different now.",                icon: "🌪️", category: "hiit", requirement: "Complete 50 HIIT-tagged workouts.",                  check: s => (s.hiitSessionCount ?? 0) >= 50 },
  { id: "hiit-100",      label: "100 HIIT sessions",         body: "A hundred all-out sessions. VO₂ max of a machine.",  icon: "🔋", category: "hiit", requirement: "Complete 100 HIIT-tagged workouts.",                 check: s => (s.hiitSessionCount ?? 0) >= 100 },

  // ── Cardio — dedicated cardio sessions. (qa: achievements-cardio-hiit)
  { id: "cardio-first",  label: "First cardio session",      body: "Steady-state engine work. Heart benefits compound.", icon: "🏃", category: "cardio", requirement: "Complete a cardio-tagged workout once.",            check: s => (s.cardioSessionCount ?? 0) >= 1 },
  { id: "cardio-10",     label: "10 cardio sessions",        body: "Aerobic base building.",                              icon: "🚴", category: "cardio", requirement: "Complete 10 cardio-tagged workouts.",                check: s => (s.cardioSessionCount ?? 0) >= 10 },
  { id: "cardio-50",     label: "50 cardio sessions",        body: "Endurance levels other lifters envy.",                icon: "🚣", category: "cardio", requirement: "Complete 50 cardio-tagged workouts.",                check: s => (s.cardioSessionCount ?? 0) >= 50 },
  { id: "cardio-50km",   label: "50 km cumulative",          body: "Real distance covered.",                              icon: "🛣️", category: "cardio", requirement: "Log 50 km of cumulative cardio distance.",            check: s => (s.totalCardioKm ?? 0) >= 50 },
  { id: "cardio-250km",  label: "250 km cumulative",         body: "Marathon×6. You've covered serious ground.",          icon: "🗺️", category: "cardio", requirement: "Log 250 km of cumulative cardio distance.",           check: s => (s.totalCardioKm ?? 0) >= 250 },
  { id: "cardio-1000km", label: "1,000 km cumulative",       body: "Four-figure kilometres. Endurance athlete tier.",     icon: "🌍", category: "cardio", requirement: "Log 1,000 km of cumulative cardio distance.",         check: s => (s.totalCardioKm ?? 0) >= 1000 },
  // Cardio TIME milestones — read totalCardioMinutes (minutes spent,
  // independent of the distance estimator). This field was computed +
  // passed into MilestoneState but no achievement consumed it until
  // now. (qa: achievements-cardio-time)
  { id: "cardio-time-300",  label: "5 hours of cardio",      body: "300 minutes of engine work banked.",                  icon: "⏱️", category: "cardio", requirement: "Log 5 cumulative hours (300 min) of cardio.",        check: s => (s.totalCardioMinutes ?? 0) >= 300 },
  { id: "cardio-time-1200", label: "20 hours of cardio",     body: "Twenty hours. Your aerobic base runs deep.",          icon: "🕰️", category: "cardio", requirement: "Log 20 cumulative hours (1,200 min) of cardio.",     check: s => (s.totalCardioMinutes ?? 0) >= 1200 },
  { id: "cardio-time-3000", label: "50 hours of cardio",     body: "Fifty hours of steady-state. Heart of an athlete.",   icon: "❤️‍🔥", category: "cardio", requirement: "Log 50 cumulative hours (3,000 min) of cardio.",     check: s => (s.totalCardioMinutes ?? 0) >= 3000 },

  // ── Volume — total kg×reps lifted lifetime. (qa: achievements-volume)
  { id: "volume-100k",   label: "100,000 kg-reps",           body: "Six figures of total work done.",                     icon: "📦", category: "volume", requirement: "Lift 100,000 kg-reps cumulative across your history.", check: s => (s.totalVolumeKg ?? 0) >= 100_000 },
  { id: "volume-500k",   label: "500,000 kg-reps",           body: "Half a million in volume. The body adapts.",          icon: "🏗️", category: "volume", requirement: "Lift 500,000 kg-reps cumulative across your history.", check: s => (s.totalVolumeKg ?? 0) >= 500_000 },
  { id: "volume-1m",     label: "1,000,000 kg-reps",         body: "Seven-figure volume. You move mountains.",            icon: "🗿", category: "volume", requirement: "Lift 1,000,000 kg-reps cumulative across your history.", check: s => (s.totalVolumeKg ?? 0) >= 1_000_000 },
  { id: "volume-5m",     label: "5,000,000 kg-reps",         body: "Five million. Most lifters never count this high.",   icon: "🏔️", category: "volume", requirement: "Lift 5,000,000 kg-reps cumulative across your history.", check: s => (s.totalVolumeKg ?? 0) >= 5_000_000 },
  { id: "volume-10m",    label: "10,000,000 kg-reps",        body: "Eight figures of total work. A decade of iron.",      icon: "🌌", category: "volume", requirement: "Lift 10,000,000 kg-reps cumulative across your history.", check: s => (s.totalVolumeKg ?? 0) >= 10_000_000 },

  // ── Behaviour — first-time feature use. (qa: achievements-behaviour-expanded)
  { id: "first-warmup",  label: "First warmup logged",       body: "Joints warm, injury risk down.",                      icon: "🔥", category: "behaviour", requirement: "Complete a warmup row in any session.",            check: s => !!s.hasUsedWarmup },
  { id: "first-cooldown",label: "First cooldown logged",     body: "Recovery starts with the last set, not the next morning.", icon: "🌬️", category: "behaviour", requirement: "Complete a cooldown row in any session.",          check: s => !!s.hasUsedCooldown },

  // ── Bodyweight benchmarks — single-best-set rep counts on the
  //    big bodyweight movements. Thresholds calibrated against
  //    global fitness averages:
  //      Push-ups:  20 = average adult male / female fit, 50 = solid,
  //                 100 = top 5% intermediate, 200 = elite (Marines).
  //      Pull-ups:   5 = adult fit, 10 = solid, 20 = advanced,
  //                 30 = elite (US Army max score for "perfect").
  //      Sit-ups:   25 = average, 50 = solid, 100 = APFT max-tier,
  //                 200 = elite.
  //      Dips:      10 = beginner-solid, 25 = advanced, 50 = elite.
  //      BW squats: 50 = average, 100 = solid, 250 = trained, 500
  //                 = endurance-elite (military fitness ladder).
  //    Each milestone label maps to one of these brackets. Elite
  //    tiers (premium: true) unlock a bonus avatar — see
  //    lib/avatars.ts ach- entries + /image-prompts-v2.md Batch 10.
  //    (qa: achievements-bodyweight-benchmarks)
  { id: "pushups-20",   label: "20 push-ups",            body: "First plateau cleared. Average adult fitness benchmark.", icon: "💪", category: "bodyweight", requirement: "Log a set of 20+ push-ups (any push-up variant).",                                       check: s => bestRepsForNames(s, ["push-up", "push up", "pushup"]) >= 20 },
  { id: "pushups-50",   label: "50 push-ups",            body: "Half a hundred in one set. Solid base built.",            icon: "🔥", category: "bodyweight", requirement: "Log a set of 50+ push-ups in a single set.",                                             check: s => bestRepsForNames(s, ["push-up", "push up", "pushup"]) >= 50 },
  { id: "pushups-100",  label: "100 push-ups",           body: "A century unbroken. Top 5% of gym-goers.",                icon: "💯", category: "bodyweight", requirement: "Log a set of 100+ push-ups in a single set.",                                            check: s => bestRepsForNames(s, ["push-up", "push up", "pushup"]) >= 100 },
  { id: "pushups-200",  label: "200 push-ups · ELITE",   body: "200 in a row. Marine Corps fitness elite.",               icon: "🏛️", category: "bodyweight", requirement: "Log a set of 200+ push-ups in a single set — unlocks a bonus avatar.", premium: true, check: s => bestRepsForNames(s, ["push-up", "push up", "pushup"]) >= 200 },

  { id: "pullups-5",    label: "5 pull-ups",             body: "First five. Real pulling strength.",                      icon: "🤜", category: "bodyweight", requirement: "Log a set of 5+ pull-ups (or chin-ups).",                                                check: s => bestRepsForNames(s, ["pull-up", "pull up", "pullup", "chin-up", "chinup", "chin up"]) >= 5 },
  { id: "pullups-10",   label: "10 pull-ups",            body: "Double digits. Solid back development.",                  icon: "💪", category: "bodyweight", requirement: "Log a set of 10+ pull-ups (or chin-ups).",                                              check: s => bestRepsForNames(s, ["pull-up", "pull up", "pullup", "chin-up", "chinup", "chin up"]) >= 10 },
  { id: "pullups-20",   label: "20 pull-ups",            body: "Advanced lat strength territory.",                        icon: "🦅", category: "bodyweight", requirement: "Log a set of 20+ pull-ups (or chin-ups).",                                              check: s => bestRepsForNames(s, ["pull-up", "pull up", "pullup", "chin-up", "chinup", "chin up"]) >= 20 },
  { id: "pullups-30",   label: "30 pull-ups · ELITE",    body: "Marine Corps max-score territory. One-percenter.",        icon: "👑", category: "bodyweight", requirement: "Log a set of 30+ pull-ups (or chin-ups) — unlocks a bonus avatar.", premium: true, check: s => bestRepsForNames(s, ["pull-up", "pull up", "pullup", "chin-up", "chinup", "chin up"]) >= 30 },

  { id: "situps-50",    label: "50 sit-ups",             body: "Half-century core. Solid baseline.",                      icon: "🔄", category: "bodyweight", requirement: "Log a set of 50+ sit-ups (or crunches).",                                                check: s => bestRepsForNames(s, ["sit-up", "sit up", "situp", "crunch"]) >= 50 },
  { id: "situps-100",   label: "100 sit-ups",            body: "Century core. APFT max-tier rep range.",                  icon: "🌀", category: "bodyweight", requirement: "Log a set of 100+ sit-ups (or crunches).",                                              check: s => bestRepsForNames(s, ["sit-up", "sit up", "situp", "crunch"]) >= 100 },
  { id: "situps-200",   label: "200 sit-ups · ELITE",    body: "Endurance core that won't fail you. Bonus avatar.",       icon: "🌊", category: "bodyweight", requirement: "Log a set of 200+ sit-ups (or crunches) — unlocks a bonus avatar.", premium: true,   check: s => bestRepsForNames(s, ["sit-up", "sit up", "situp", "crunch"]) >= 200 },

  { id: "dips-10",      label: "10 dips",                body: "First ten. Triceps + chest in one move.",                 icon: "🤸", category: "bodyweight", requirement: "Log a set of 10+ dips (parallel bar / bench).",                                          check: s => bestRepsForNames(s, ["dip"]) >= 10 },
  { id: "dips-25",      label: "25 dips",                body: "Strong dips. Advanced upper-body.",                       icon: "🏋️", category: "bodyweight", requirement: "Log a set of 25+ dips.",                                                                 check: s => bestRepsForNames(s, ["dip"]) >= 25 },
  { id: "dips-50",      label: "50 dips · ELITE",        body: "Half a hundred dips. Calisthenics elite.",                icon: "🚀", category: "bodyweight", requirement: "Log a set of 50+ dips — unlocks a bonus avatar.", premium: true,                          check: s => bestRepsForNames(s, ["dip"]) >= 50 },

  { id: "bwsquats-50",  label: "50 bodyweight squats",   body: "Reps in the legs. Endurance base started.",               icon: "🦵", category: "bodyweight", requirement: "Log a set of 50+ bodyweight squats.",                                                   check: s => bestRepsForNames(s, ["bodyweight squat", "air squat", "body weight squat"]) >= 50 },
  { id: "bwsquats-100", label: "100 bodyweight squats",  body: "Century squat. Real leg endurance.",                      icon: "🏃", category: "bodyweight", requirement: "Log a set of 100+ bodyweight squats.",                                                  check: s => bestRepsForNames(s, ["bodyweight squat", "air squat", "body weight squat"]) >= 100 },
  { id: "bwsquats-250", label: "250 bodyweight squats",  body: "Mental + physical endurance benchmark.",                  icon: "⛰️", category: "bodyweight", requirement: "Log a set of 250+ bodyweight squats.",                                                  check: s => bestRepsForNames(s, ["bodyweight squat", "air squat", "body weight squat"]) >= 250 },
  { id: "bwsquats-500", label: "500 squats · ELITE",     body: "Half a thousand reps. Iron mind territory.",              icon: "🌋", category: "bodyweight", requirement: "Log a set of 500+ bodyweight squats — unlocks a bonus avatar.", premium: true,           check: s => bestRepsForNames(s, ["bodyweight squat", "air squat", "body weight squat"]) >= 500 },

  // ── Bicep curl benchmarks (weighted but typically light enough
  //    they don't show in the bench/squat/dl benchmarks above).
  //    Thresholds: 20kg = casual, 30kg = solid, 40kg = strong,
  //    50kg+ = elite isolation strength.
  //    (qa: achievements-bodyweight-benchmarks)
  { id: "curls-20kg",   label: "Bicep curls · 20 kg",    body: "First proper curl benchmark — clean form.",               icon: "💪", category: "strength", requirement: "Log a bicep curl set at 20 kg or more.",                                                    check: s => bestForNames(s, ["bicep curl", "barbell curl", "dumbbell curl", "ez curl", "preacher curl"]) >= 20 },
  { id: "curls-30kg",   label: "Bicep curls · 30 kg",    body: "Solid curl strength. Sleeve-stretcher.",                  icon: "🧗", category: "strength", requirement: "Log a bicep curl set at 30 kg or more.",                                                    check: s => bestForNames(s, ["bicep curl", "barbell curl", "dumbbell curl", "ez curl", "preacher curl"]) >= 30 },
  { id: "curls-40kg",   label: "Bicep curls · 40 kg",    body: "Advanced isolation strength.",                            icon: "🏗️", category: "strength", requirement: "Log a bicep curl set at 40 kg or more.",                                                    check: s => bestForNames(s, ["bicep curl", "barbell curl", "dumbbell curl", "ez curl", "preacher curl"]) >= 40 },

  // ── Warmup / cooldown habit milestones — reward consistent
  //    pre/post work, not just the first-time use. Computed from
  //    hasUsedWarmup / hasUsedCooldown flags PLUS the new lifetime
  //    warmupSessionCount / cooldownSessionCount counters.
  //    (qa: achievements-warmup-cooldown-habits)
  { id: "warmup-10",    label: "10 warmups logged",      body: "Joints respect the work that respects them.",             icon: "🔥", category: "warmup-cooldown", requirement: "Log a warmup set in 10 different sessions.",                                       check: s => (s.warmupSessionCount ?? 0) >= 10 },
  { id: "warmup-50",    label: "50 warmups logged",      body: "Warming up is a non-negotiable habit now.",               icon: "🌅", category: "warmup-cooldown", requirement: "Log a warmup set in 50 different sessions.",                                       check: s => (s.warmupSessionCount ?? 0) >= 50 },
  { id: "warmup-200",   label: "200 warmups logged",     body: "Two hundred prep blocks. Injury-proofed.",                icon: "🛡️", category: "warmup-cooldown", requirement: "Log a warmup set in 200 different sessions.",                                      check: s => (s.warmupSessionCount ?? 0) >= 200 },
  { id: "cooldown-10",  label: "10 cooldowns logged",    body: "Recovery isn't optional — you've made it routine.",        icon: "🌬️", category: "warmup-cooldown", requirement: "Log a cooldown set in 10 different sessions.",                                     check: s => (s.cooldownSessionCount ?? 0) >= 10 },
  { id: "cooldown-50",  label: "50 cooldowns logged",    body: "Half a hundred recovery flows. Body thanks you.",         icon: "🍃", category: "warmup-cooldown", requirement: "Log a cooldown set in 50 different sessions.",                                     check: s => (s.cooldownSessionCount ?? 0) >= 50 },
  { id: "cooldown-200", label: "200 cooldowns logged",   body: "Recovery champion. Your future self benefits.",            icon: "🧘", category: "warmup-cooldown", requirement: "Log a cooldown set in 200 different sessions.",                                    check: s => (s.cooldownSessionCount ?? 0) >= 200 },
];

// Maps tier milestone id → universal tier number (1-6). The IDs are
// frozen for backwards compatibility (users keep their earned
// badges), but the underlying check now uses tierNum so labels can
// shift between themes. "Current" vs "passed" tagging matches by
// number so the overlay correctly labels which rank you're at.
// (qa: tier-themes — reported by @maaiz)
export const TIER_NUM_BY_ID: Record<string, number> = {
  "tier-monkey":  2,   // legacy id → Tier 2 (Fox in vivid, Silver in simple)
  "tier-fox":     3,   // → Tier 3 (Big Dawg / Gold)
  "tier-tiger":   4,   // → Tier 4 (Lion / Platinum)
  "tier-lion":    5,   // → Tier 5 (Gorilla / Diamond)
  "tier-gorilla": 6,   // → Tier 6 (Bear / Master)
};

// Achievement returned from detectNewAchievements with an optional
// badge for tier ranks. `tierBadge: "current"` = this is the tier the
// user is at RIGHT NOW. `tierBadge: "passed"` = the user is above this
// tier (retroactive unlock — they earned it on the way up but never
// celebrated it). Non-tier achievements have no badge.
export type AchievementAward = Achievement & { tierBadge?: "current" | "passed" };

// Walk the achievement list against the current state. Returns every
// achievement that newly crossed since the last check — INCLUDING all
// lower-tier ranks for a user who jumped straight to a higher tier
// (each gets a "passed" tag so the celebration is clearly retroactive
// and the actual current rank is also surfaced). Caller persists the
// achieved ids.
export function detectNewAchievements(
  state: AchievementState,
  alreadyAchieved: Set<string>
): AchievementAward[] {
  const out: AchievementAward[] = [];
  for (const m of ACHIEVEMENTS) {
    if (alreadyAchieved.has(m.id)) continue;
    if (!m.check(state)) continue;
    if (m.category === "tier") {
      const milestoneTierNum = TIER_NUM_BY_ID[m.id];
      const tierBadge: "current" | "passed" = milestoneTierNum === state.athleteTierNum ? "current" : "passed";
      out.push({ ...m, tierBadge });
    } else {
      out.push(m);
    }
  }
  return out;
}

// localStorage key — bump if the schema of stored entries ever changes
// (currently just an array of ids, so this can stay v1 forever). This
// is now a client-side CACHE; the server (UserAchievement table) is the
// source of truth — see /api/achievements. Renamed from the legacy
// `ironlog-milestones-v1` key on 2026-06-08; the old key is still read
// once on load to migrate existing users' local data. (qa: achievements-v1)
export const ACHIEVEMENT_STORAGE_KEY = "ironlog-achievements-v1";
// Legacy key — read-only, for one-time migration into the new key + the
// server backfill. Do not write to it.
export const LEGACY_MILESTONE_STORAGE_KEY = "ironlog-milestones-v1";
