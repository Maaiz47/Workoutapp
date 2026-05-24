// First-launch tutorial steps. New users see this on their first authed
// page load. Triggered by localStorage flag `ironlog-tutorial-seen-vN` —
// bump the version constant below when steps change meaningfully so
// existing users see the updated tutorial once.
//
// CLAUDE.md REMINDER: every shipped feature that adds a new user-visible
// surface should also add (or update) a step here. See the corresponding
// rule in CLAUDE.md.

export type TutorialStep = {
  id: string;          // stable, used for analytics + per-step skip tracking
  icon: string;        // single emoji
  title: string;
  body: string;        // 1-3 sentences, plain-English
  // Optional: tell the user where in the app the feature lives. Rendered
  // as a small tag at the bottom of the card (e.g. "🛠 In: Settings").
  where?: string;
};

// v6 (2026-05-23) — large batch of new surfaces since v5:
//   · new tier badge PNGs (animal / medallion / coach-symbol crests)
//   · Technique sub-rank (supersets / drop chains feed the tier headline)
//   · "EARN MORE POINTS" tip card inside the tier breakdown modal
//   · Group conversations surfaced in the Messages inbox
//   · Athletes inviting friends to leaderboard groups
//   · Dashboard reorder (KPIs at top, Wellness open by default)
//   · Floating bottom hub + sticky Settings ⇄ Profile toggle
//   · Bodyweight + warmup/cooldown milestones with premium bonus avatars
//   · Monthly challenges now a rotating library (3 random / month)
// v7 bump (2026-05-24): introduces several substantial UI/scoring
// changes worth re-showing to existing users:
//   · Press-and-hold to reorder exercises (session + customise)
//   · Long-press to delete your own messages (DMs + group chat)
//   · Pinned 📢 IRONLOG SYSTEM feed in the Messages inbox
//   · Fresh Legs IP bonus + recovery cap (deters IP farming)
//   · Visible 'Lucky' sub-rank surfaces lifetime drop bonus
export const TUTORIAL_VERSION = "v7";
export const TUTORIAL_STORAGE_KEY = `ironlog-tutorial-seen-${TUTORIAL_VERSION}`;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    icon: "🏋️",
    title: "Welcome to IRONLOG",
    body: "Quick 30-second tour. You can skip any time and restart from Settings whenever you want.",
  },
  {
    id: "qa-feedback",
    icon: "🥋",
    title: "Found a bug? Got an idea?",
    body: "Tap the teal ‹ tab on the right edge of any screen (around 3/4 of the way down) — pick 🐞 BUG or 💡 IDEA, type a sentence, send. The note auto-captures which screen you were on. The tab is for reporting issues only; to mark something as ✓ WORKING, head to the full /qa dashboard. Toggle the tab on/off any time from Settings → FEEDBACK & QA.",
    where: "Right-edge ‹ tab (everywhere) · Settings → FEEDBACK & QA · /qa dashboard",
  },
  {
    id: "start-workout",
    icon: "▶️",
    title: "Start today's session",
    body: "Your home screen shows today's workout day. Tap it to open the session, then START to begin logging.",
    where: "Home",
  },
  {
    id: "warmup-cooldown",
    icon: "🔥",
    title: "Warm-up + cool-down baked in",
    body: "Every session opens with a focus-aware warm-up and ends with matching cool-down stretches. Tap any stretch row to see form cues. Customise from the routine editor.",
    where: "Active session · Customise routine",
  },
  {
    id: "log-set",
    icon: "💪",
    title: "Log a set",
    body: "Tap an exercise to expand, enter weight + reps, hit LOG SET. The rest timer kicks in automatically and the next incomplete exercise auto-opens once rest ends.",
    where: "Active session",
  },
  {
    id: "supersets-dropsets",
    icon: "⟳",
    title: "Supersets + drop sets · earn TECHNIQUE points",
    body: "Every exercise card has a + SUPERSET button (pair two with recommended pairings) and a + DROP SET toggle (open-ended drop chain to failure). Each superset awards +5 IP, each drop chain +3 IP — these now feed the new Technique sub-rank that contributes to your tier score.",
    where: "Active session · Routine builder",
  },
  {
    id: "bottom-hub",
    icon: "🧭",
    title: "Floating bottom hub",
    body: "Messages, Progress, Ranks, Groups, Friends (and Clients if you're a trainer) live in a floating bar fixed to the bottom of the screen. Stays reachable while you scroll. Tap an icon to jump straight to that view.",
    where: "Home — bottom of screen",
  },
  {
    id: "tier-badges",
    icon: "🦁",
    title: "Tier badges + 'EARN MORE POINTS' tips",
    body: "Tap your tier chip at the top-right of home to see the breakdown. The headline tier wears a custom badge (Kitten → Bear / Bronze → Master / Spotter → Hall of Fame); switch the look between Vivid animals and Simple medallions in Settings → 🏆 TIER NAMES. Inside the modal, the '⚡ EARN MORE POINTS' card gives you 2-3 concrete actions to climb — tailored to your weakest sub-rank.",
    where: "Home tier chip · Settings → 🏆 TIER NAMES",
  },
  {
    id: "tier-sub-ranks",
    icon: "🏅",
    title: "How your tier is scored",
    body: "9 sub-ranks feed the headline: Consistency · Strength (rate × absolute) · Progression · Volume · Mastery · Technique · Balance · Body Comp · Habits — plus a 🍀 Lucky sub-rank when you've earned rare drops or smart-pick bonuses. Sub-ranks you don't have data for are skipped so empty dims don't drag your headline. Veterans don't regress — strength absolute (e1RM ÷ bodyweight) prevents that.",
    where: "Progress → tap your tier chip",
  },
  {
    id: "ip-fresh-legs",
    icon: "✨",
    title: "Fresh Legs bonus · Recovery cap",
    body: "Train hard, rest, train hard. The first session after a full rest day earns a +5 IP 'FRESH LEGS' bonus. Past your weekly target (daysPerWeek + 1) extra sessions earn 0 IP that week — recovery beats farming. Set your weekly target in onboarding or update it from Settings.",
    where: "Active session · Settings → APP PREFERENCES → target days/week",
  },
  {
    id: "reorder-exercises",
    icon: "↕",
    title: "Drag the ≡ handle to reorder exercises",
    body: "Each exercise card has a small ≡ grip handle on the right. Press and hold the handle for half a second to pick the card up, then drag to a new position — works in active sessions AND on the Customise screen. Supersets move as a block; same-day order auto-saves to your session + plan. (The handle keeps scroll working on the rest of the card.)",
    where: "Active session · Customise routine",
  },
  {
    id: "message-delete",
    icon: "🗑",
    title: "Delete your own messages",
    body: "Long-press your own bubble (in a DM or group chat) and tap 🗑 DELETE — the message becomes 'Message deleted' for everyone, instantly. You can only delete your own; system messages can't be deleted. Reactions, replies and quoted text are stripped from deleted bubbles.",
    where: "Messages → any conversation · Group chat",
  },
  {
    id: "system-feed",
    icon: "📢",
    title: "IRONLOG SYSTEM messages",
    body: "A pinned 📢 IRONLOG SYSTEM row sits at the top of your Messages inbox with app changes, warnings, and admin notices. Read-only feed, severity-tinted. Updates land here whenever we ship.",
    where: "Messages inbox → top pinned row",
  },
  {
    id: "dashboard-layout",
    icon: "📊",
    title: "Progress dashboard at a glance",
    body: "Open Progress from the bottom hub. Your KPI cards (THIS WEEK / STREAK / AVG TIME) sit at the top. Wellness is right below and OPEN by default — tap once to log hydration / sleep / energy. Below that: Challenges (3 random per month), Achievements wall, Volume Heatmap, Tier Card, PBs.",
    where: "Progress (bottom hub) → Dashboard",
  },
  {
    id: "milestones-v2",
    icon: "🏆",
    title: "More milestones — including ELITE-only bonus avatars",
    body: "The Achievements grid now includes bodyweight benchmarks (push-ups 20/50/100/200, pull-ups 5/10/20/30, sit-ups, dips, BW squats, curls) and warmup/cooldown habit goals. The hardest tier of each — 200 push-ups, 30 pull-ups, etc. — unlocks a PREMIUM bonus avatar reserved for that single feat.",
    where: "Progress → Achievements",
  },
  {
    id: "monthly-challenges",
    icon: "🎯",
    title: "Monthly challenges — 3 random each month",
    body: "The Challenges card on Progress now rotates a fresh trio every month — one MODEST, one SOLID, one HARD. Everyone in the app sees the same 3 for any given month, so you can compare with your friends. Opt-in per challenge from the card.",
    where: "Progress → Challenges card",
  },
  {
    id: "global-rankings",
    icon: "🌍",
    title: "See how you stack up",
    body: "The 🏆 Ranks button on the bottom hub opens the leaderboard — tabs for ATHLETES, TRAINERS, and (if you're a trainer) MY CLIENTS. Toggle between Top 100, your tier band, or around-you. Every row shows the user's avatar + tier badge side-by-side at the same size. Anonymous? Toggle visibility in Settings → APP PREFERENCES.",
    where: "Bottom hub → 🏆 Ranks",
  },
  {
    id: "friends-and-groups",
    icon: "🤝",
    title: "Friends · Groups · Group chat in your inbox",
    body: "Add friends by @username from the 🤝 Friends hub. Inside any leaderboard group you're a member of, scroll to '+ ADD FRIENDS' to invite your accepted friends to join — they'll appear on the group rankings once they accept. Group conversations now show up in your Messages inbox alongside DMs with a gold GROUP · N chip — tap to enter the chat, with the 🏆 STANDINGS toggle to see who's leading inside.",
    where: "Home → 🤝 Friends · 🏝️ Groups · 💬 Messages",
  },
  {
    id: "customise",
    icon: "🛠",
    title: "Customise your routine",
    body: "Open the Customise screen for any day to edit warm-ups, exercises, sets/reps/rest, and cool-downs. Add an exercise just for today (+ SESSION) or save it to your routine (+ ROUTINE). Trainers: your custom exercises live in a collapsible MY EXERCISES card on home — closed by default to keep the view compact.",
    where: "Home → Customise · Home → MY EXERCISES (trainer)",
  },
  {
    id: "profile-settings",
    icon: "👤",
    title: "Profile, Settings, Avatar",
    body: "Tap your avatar at the top-left of home to open your profile. From there, the floating ⚙ SETTINGS pill at the top-right gets you to APP PREFERENCES, FEEDBACK & QA, account, and the AVATAR PICKER (tier-unlocked, lucky-drop, and the new milestone-bonus premium avatars).",
    where: "Home top-left avatar → Profile · ⚙ SETTINGS top-right",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Stay current",
    body: "App version is shown in Settings. Tap CHECK FOR UPDATES any time to see if there's a newer build. Tap REFRESH NOW to pick it up — works inside the installed PWA too.",
    where: "Settings → 🔄 APP VERSION",
  },
];
