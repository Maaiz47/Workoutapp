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
// v8 bump (2026-06-10): catch-up batch for surfaces that shipped
// without a tutorial step (audit finding), so coverage matches the app:
//   · RPE / effort logging  · rest-timer behaviour  · cardio logging
//   · body-metric logging   · Daily Quest           · deload weeks
//   · weekly recap + PB celebrations  · themes/display  · trainer tools
// Going forward, `npm run tutorial:scan` flags any recent PATCHLOG
// feature that didn't touch this file (see scripts/tutorial-scan.ts).
export const TUTORIAL_VERSION = "v8";
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
    body: "Every session opens with a focus-aware warm-up and ends with matching cool-down stretches. Tap any stretch row to see form cues. Don't fancy one? Hit ⇄ SWAP to switch it for another warm-up or stretch — or skip it. Customise from the routine editor.",
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
    id: "substitute-exercise",
    icon: "⇄",
    title: "Swap any exercise mid-session",
    body: "Tap ⇄ SUBSTITUTE on any exercise card to swap it out. The best same-muscle matches surface under ✨ SUGGESTED, but you can search and pick literally any exercise in the library. + JUST TODAY swaps for this session only; ↻ REPLACE also updates your saved routine going forward. Any sets you'd already logged stay under the original exercise.",
    where: "Active session — exercise card",
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
    title: "Achievements — earn them, unlock forge avatars",
    body: "The Achievements wall (Progress → 🏆 ACHIEVEMENTS) tracks 80+ unlocks: streaks, PRs, strength benchmarks, bodyweight feats, cardio, volume and more. Your earned achievements now save to your account, so they follow you across devices. The hardest single feats (200 push-ups, 30 pull-ups…) unlock a PREMIUM bonus avatar — and your TOTAL count unlocks a separate set of blacksmith 'forge' avatars (3 / 6 / 10 / 15 / 20 / 25 / 35 earned).",
    where: "Progress → Achievements · Profile → Avatar",
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
    body: "Tap your avatar at the top-left of home to open your profile. From there, the floating ⚙ SETTINGS pill at the top-right gets you to APP PREFERENCES, FEEDBACK & QA, account, and the AVATAR PICKER (tier-unlocked, lucky-drop, milestone-bonus premium, and the achievement-count 'forge' avatars).",
    where: "Home top-left avatar → Profile · ⚙ SETTINGS top-right",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Stay current",
    body: "App version is shown in Settings. Tap CHECK FOR UPDATES any time to see if there's a newer build. Tap REFRESH NOW to pick it up — works inside the installed PWA too.",
    where: "Settings → 🔄 APP VERSION",
  },
  {
    id: "home-wellness-nudge",
    icon: "💧",
    title: "Wellness daily nudge on Home",
    body: "If you haven't logged today's hydration (target) or sleep, a small teal WELLNESS row appears on Home above your Daily Quest. Tap to drop into Progress → Dashboard to log it. The nudge disappears the moment you hit both. (qa: progress-wellness-reminders-on-home)",
    where: "Home → just above DAILY QUEST",
  },
  {
    id: "workout-tap-to-edit-set",
    icon: "✏️",
    title: "Tap a done set to edit",
    body: "In an active session, tap any DONE set box (the ✓ ones) to open the EDIT modal for that exercise — fix the weight / reps / RPE without hunting for the EDIT button. Long-press still drops a per-set note like before. (qa: workout-active-edit-set-tap)",
    where: "Active session → tap any ✓ set box",
  },
  // ── v8 catch-up batch (2026-06-10) — surfaces that shipped without a
  //    tutorial step. See PATCHLOG + docs/feature-forcing-rules.md.
  {
    id: "effort-rpe",
    icon: "🎯",
    title: "Tag your effort (RPE)",
    body: "After logging a set, pick how hard it felt on the 1–10 effort scale. It's optional but worth it: hard sets (RPE 8–10) earn bonus intensity points, and your effort trend is what tells IronLog when to suggest a recovery week. Skip a few and it'll nudge you.",
    where: "Active session → effort chips under each set",
  },
  {
    id: "rest-timer",
    icon: "⏱️",
    title: "Rest timer runs itself",
    body: "Log a set and a rest timer starts automatically — full-screen so you can glance at it from across the gym. Tap SKIP when you're ready early; if you dismiss it, a small countdown rides along on the next-set button so you never lose track.",
    where: "Active session → after LOG SET",
  },
  {
    id: "cardio-logging",
    icon: "🏃",
    title: "Logging cardio",
    body: "Cardio moves (treadmill, bike, rower, intervals) swap the weight/reps inputs for what actually matters — minutes, and where relevant incline, speed or distance. Fill what your machine shows; it all feeds your volume and streak.",
    where: "Active session → any cardio exercise",
  },
  {
    id: "body-metrics",
    icon: "⚖️",
    title: "Log weight & body fat",
    body: "Add your bodyweight (and body-fat % if you track it) from the Progress dashboard. It powers the Body Comp tier sub-rank, the WEIGHT/BF leaderboards, and your goal-reached celebrations — and trainers can propose updates for their clients.",
    where: "Progress → Dashboard → log metrics",
  },
  {
    id: "daily-quest",
    icon: "🎯",
    title: "Daily Quest",
    body: "Each day Home shows a Daily Quest — a small bonus objective (hydrate, tag effort, hit a volume target, sneak in cardio…). Complete it for extra intensity points. It refreshes every day, so there's always a fresh one.",
    where: "Home → DAILY QUEST card",
  },
  {
    id: "deload-week",
    icon: "🛟",
    title: "Deload weeks — recover smart",
    body: "If your recent effort + volume say you're running hot, IronLog suggests a DELOAD: a lighter week (~0.7× load) so you recover and come back stronger. It's a recommendation, not a penalty — accept it or carry on.",
    where: "Active session → DELOAD SUGGESTED banner",
  },
  {
    id: "recap-and-pbs",
    icon: "🏆",
    title: "Weekly recap & personal bests",
    body: "Hit a new best on any lift and a gold PERSONAL BEST celebration pops — tap to dismiss. Every Sunday a Weekly Recap sums up your sessions, volume and top exercise so you can see the week at a glance.",
    where: "Anywhere (PBs) · Sundays (recap)",
  },
  {
    id: "themes-display",
    icon: "🎨",
    title: "Make it yours — themes",
    body: "Settings has three looks: IRON (warm premium dark, default), VIVID (neon aurora) and MONO (clean brutalist). There's also a brighter-text option for readability. Pick whatever feels best — it's purely cosmetic.",
    where: "Settings → APP PREFERENCES",
  },
  {
    id: "trainer-tools",
    icon: "🧑‍🏫",
    title: "For trainers",
    body: "Coaching? Your Clients hub holds your roster and per-client stats/history, you can build custom exercises in MY EXERCISES on Home, propose weight/body-fat updates to clients, and you climb your own trainer tier (Spotter → Hall of Fame) as your clients progress.",
    where: "Home → Clients · Home → MY EXERCISES",
  },
];
