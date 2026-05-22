// Milestones — pre-defined achievement triggers fired on each session
// save. Each is checked against a `MilestoneState` snapshot of the user's
// training history; the ones that newly cross are added to the user's
// achieved-list (stored in localStorage under `ironlog-milestones`).
//
// Adding a new milestone: append to the `MILESTONES` array. ids are
// stable — never reuse them. Removing one is fine (existing achievements
// just become unreachable orphans, no data loss).

export type MilestoneState = {
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
};

export type Milestone = {
  id: string;
  label: string;       // headline shown on the celebration overlay
  body: string;        // 1-2 sentence flavour text
  icon: string;        // single emoji
  category: "anniversary" | "consistency" | "strength" | "behaviour" | "tier";
  // Plain-English "how to earn this" string. Shown in the info modal for
  // locked milestones so users know what to work toward. New ids should
  // always include one; missing falls back to body.
  requirement: string;
  check: (s: MilestoneState) => boolean;
};

export const MILESTONES: Milestone[] = [
  // ── Anniversary milestones (calendar-based, not effort-based) ─────────
  { id: "first-day",     label: "Welcome to IRONLOG",       body: "Day 1. The streak starts now.",                       icon: "🎉", category: "anniversary", requirement: "Log your first session.",                                                  check: s => s.joinedDaysAgo >= 1   && s.totalSessions >= 1 },
  { id: "week-one",      label: "One week in",              body: "Seven days on the app. Most people quit before this.", icon: "🌅", category: "anniversary", requirement: "Stay active on IRONLOG for 7 days from your join date.",                  check: s => s.joinedDaysAgo >= 7 },
  { id: "month-one",     label: "First month landed",       body: "30 days. A habit is forming.",                         icon: "📅", category: "anniversary", requirement: "Be on IRONLOG for 30 days.",                                              check: s => s.joinedDaysAgo >= 30 },
  { id: "month-three",   label: "Quarter of a year",        body: "90 days. The system isn't a trial — it's training.",   icon: "🌳", category: "anniversary", requirement: "Be on IRONLOG for 90 days.",                                              check: s => s.joinedDaysAgo >= 90 },
  { id: "month-six",     label: "Half a year strong",       body: "180 days. Your recorded experience level has officially expired — it's all real data now.", icon: "🔥", category: "anniversary", requirement: "Be on IRONLOG for 180 days. Your onboarding experience level expires here.", check: s => s.joinedDaysAgo >= 180 },
  { id: "year-one",      label: "One year on IRONLOG",      body: "365 days. You've earned this.",                        icon: "🏆", category: "anniversary", requirement: "Be on IRONLOG for a full year.",                                          check: s => s.joinedDaysAgo >= 365 },

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

  // ── Strength / PRs ───────────────────────────────────────────────────
  { id: "first-pr",      label: "First personal best",      body: "Heavier than you've ever lifted. Mark the day.",        icon: "🥇", category: "strength", requirement: "Set a personal best on any exercise (most weight × reps).",         check: s => s.prCount >= 1   },
  { id: "ten-prs",       label: "10 personal bests",        body: "Ten lifts at their peak. Real strength gains.",         icon: "🥈", category: "strength", requirement: "Set personal bests across 10 different exercises.",                  check: s => s.prCount >= 10  },
  { id: "fifty-prs",     label: "50 personal bests",        body: "You're getting strong across the board.",               icon: "🥉", category: "strength", requirement: "Set personal bests across 50 different exercises.",                  check: s => s.prCount >= 50  },
  { id: "hundred-prs",   label: "100 personal bests",       body: "Triple-digit PR count. You're not the same person.",    icon: "👑", category: "strength", requirement: "Set personal bests across 100 different exercises.",                 check: s => s.prCount >= 100 },

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
];

// Maps tier milestone id → universal tier number (1-6). The IDs are
// frozen for backwards compatibility (users keep their earned
// badges), but the underlying check now uses tierNum so labels can
// shift between themes. "Current" vs "passed" tagging matches by
// number so the overlay correctly labels which rank you're at.
// (qa: tier-themes — reported by @maaiz)
const TIER_NUM_BY_ID: Record<string, number> = {
  "tier-monkey":  2,   // legacy id → Tier 2 (Fox in vivid, Silver in simple)
  "tier-fox":     3,   // → Tier 3 (Big Dawg / Gold)
  "tier-tiger":   4,   // → Tier 4 (Lion / Platinum)
  "tier-lion":    5,   // → Tier 5 (Gorilla / Diamond)
  "tier-gorilla": 6,   // → Tier 6 (Bear / Master)
};

// Milestone returned from detectNewMilestones with an optional badge
// for tier ranks. `tierBadge: "current"` = this is the tier the user
// is at RIGHT NOW. `tierBadge: "passed"` = the user is above this
// tier (retroactive unlock — they earned it on the way up but never
// celebrated it). Non-tier milestones have no badge.
export type MilestoneAward = Milestone & { tierBadge?: "current" | "passed" };

// Walk the milestone list against the current state. Returns every
// milestone that newly crossed since the last check — INCLUDING all
// lower-tier ranks for a user who jumped straight to a higher tier
// (each gets a "passed" tag so the celebration is clearly retroactive
// and the actual current rank is also surfaced). Caller persists the
// achieved ids.
export function detectNewMilestones(
  state: MilestoneState,
  alreadyAchieved: Set<string>
): MilestoneAward[] {
  const out: MilestoneAward[] = [];
  for (const m of MILESTONES) {
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
// (currently just an array of ids, so this can stay v1 forever).
export const MILESTONE_STORAGE_KEY = "ironlog-milestones-v1";
