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

export const TUTORIAL_VERSION = "v5";
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
    body: "Tap the teal 💬 NOTE pill in the bottom-right of any screen — pick 🐞 BUG or 💡 IDEA, type a sentence, send. The note auto-captures which screen you were on. The pill is for reporting issues only; to mark something as ✓ WORKING, head to the full /qa dashboard. Toggle the pill on/off any time from Settings → FEEDBACK & QA.",
    where: "💬 NOTE pill (everywhere) · Settings → FEEDBACK & QA · /qa dashboard",
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
    title: "Supersets + drop sets",
    body: "Every exercise card has a + SUPERSET button (pair two with recommended pairings) and a + DROP SET toggle (open-ended drop chain to failure). Routine builder supports both too.",
    where: "Active session · Routine builder",
  },
  {
    id: "customise",
    icon: "🛠",
    title: "Customise your routine",
    body: "Open the Customise screen for any day to edit warm-ups, exercises, sets/reps/rest, and cool-downs. Add an exercise just for today (+ SESSION) or save it to your routine (+ ROUTINE).",
    where: "Home → Customise",
  },
  {
    id: "global-rankings",
    icon: "🌍",
    title: "See how you stack up",
    body: "The 🏆 Leaderboards button on home opens the Ranks page — tabs for ATHLETES, TRAINERS, and (if you're a trainer) MY CLIENTS. Toggle between Top 100, your tier band, or around-you. Athletes can opt out of being named in Settings; trainers are always public.",
    where: "Home → 🏆 Leaderboards",
  },
  {
    id: "tier-sub-ranks",
    icon: "🏅",
    title: "How your tier is scored",
    body: "Tap your tier chip to see the breakdown. Strength tracks your e1RM trend (are you getting stronger?), Progression tracks rising weekly volume, Body Comp scores condition + maintenance (sex-calibrated), and Consistency rewards hitting your weekly target — rest days included. Sub-ranks you don't have data for are quietly skipped so empty dims don't drag your headline.",
    where: "Progress → tap your tier chip",
  },
  {
    id: "friends-hub",
    icon: "🤝",
    title: "Find your friends",
    body: "Tap 🤝 Friends on the home hub to add training partners by @username. Send a request, accept incoming ones, and unfriend any time. Trainers see a discreet '+ CLIENT' shortcut on each friend row so they can also send a coaching request without re-searching.",
    where: "Home → 🤝 Friends",
  },
  {
    id: "updates",
    icon: "🔄",
    title: "Stay current",
    body: "App version is shown in Settings. Tap CHECK FOR UPDATES any time to see if there's a newer build. Tap REFRESH NOW to pick it up — works inside the installed PWA too.",
    where: "Settings → 🔄 APP VERSION",
  },
];
