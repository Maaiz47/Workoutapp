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
  athleteTierLabel: string;   // current animal tier label
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

  // ── Tier-up — fire once per animal tier reached ──────────────────────
  { id: "tier-monkey",   label: "Reached Monkey",           body: "Branching out, swinging from one PR to the next.",      icon: "🐒", category: "tier", requirement: "Reach the Monkey tier (headline tier score ≥ 15).", check: s => s.athleteTierLabel === "Monkey"  || s.athleteTierLabel === "Fox"  || s.athleteTierLabel === "Tiger" || s.athleteTierLabel === "Lion" || s.athleteTierLabel === "Gorilla" },
  { id: "tier-fox",      label: "Reached Fox",              body: "Cunning. Quick. You know what you're doing now.",       icon: "🦊", category: "tier", requirement: "Reach the Fox tier (headline tier score ≥ 30).",    check: s => s.athleteTierLabel === "Fox"     || s.athleteTierLabel === "Tiger" || s.athleteTierLabel === "Lion" || s.athleteTierLabel === "Gorilla" },
  { id: "tier-tiger",    label: "Reached Tiger",            body: "Stalking PRs with intent.",                             icon: "🐯", category: "tier", requirement: "Reach the Tiger tier (headline tier score ≥ 50).",  check: s => s.athleteTierLabel === "Tiger"   || s.athleteTierLabel === "Lion" || s.athleteTierLabel === "Gorilla" },
  { id: "tier-lion",     label: "Reached Lion",             body: "King of your own training. The pride watches.",         icon: "🦁", category: "tier", requirement: "Reach the Lion tier (headline tier score ≥ 70).",   check: s => s.athleteTierLabel === "Lion"    || s.athleteTierLabel === "Gorilla" },
  { id: "tier-gorilla",  label: "Reached Gorilla",          body: "Top of the food chain. Absolute unit.",                 icon: "🦍", category: "tier", requirement: "Reach the Gorilla tier (headline tier score ≥ 90).", check: s => s.athleteTierLabel === "Gorilla" },
];

// Walk the milestone list against the current state. Returns the IDs that
// crossed since the last check (i.e. newly achieved). Caller persists.
export function detectNewMilestones(state: MilestoneState, alreadyAchieved: Set<string>): Milestone[] {
  const out: Milestone[] = [];
  for (const m of MILESTONES) {
    if (alreadyAchieved.has(m.id)) continue;
    if (m.check(state)) out.push(m);
  }
  return out;
}

// localStorage key — bump if the schema of stored entries ever changes
// (currently just an array of ids, so this can stay v1 forever).
export const MILESTONE_STORAGE_KEY = "ironlog-milestones-v1";
