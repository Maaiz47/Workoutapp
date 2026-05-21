// Pro Tips — curated, evidence-based one-liners surfaced contextually
// on home (rotating daily) and browsable in Settings.
//
// Each tip carries:
//   id            — stable, never reused
//   text          — 1-2 sentences, plain English
//   category      — programming / technique / recovery / nutrition / mindset
//   source        — citation; pulls from lib/principles.ts where possible
//   relevantWhen? — optional predicate against TipContext. If absent the
//                   tip is "evergreen" and eligible for the daily rotation.
//
// New tips: append to TIPS. Removing one is fine — orphan ids in
// localStorage just become unreachable.

export type TipCategory = "programming" | "technique" | "recovery" | "nutrition" | "mindset" | "habit";

export type TipContext = {
  // What we know about the user right now. Predicates use this to
  // surface tips that fit the moment, not random ones.
  totalSessionsLifetime: number;
  daysSinceLastSession: number;
  currentStreak: number;
  experienceLevel: "newcomer" | "beginner" | "intermediate" | "advanced";
  recentAvgRpe: number | null;
  prCountLast30Days: number;
  hydrationToday: number;
  hydrationTarget: number;
  sleepLastNight: number | null;
  hasActiveInjury: boolean;
  hour: number;            // current hour 0-23
  dayOfWeek: number;       // 0=Sun, 6=Sat
};

export type ProTip = {
  id: string;
  text: string;
  category: TipCategory;
  source: string;
  relevantWhen?: (ctx: TipContext) => boolean;
};

export const TIPS: ProTip[] = [
  // ── Programming ──────────────────────────────────────────────────
  {
    id: "rpe-target",
    text: "Most working sets should sit at RPE 7-9 — one to three reps shy of failure. Train too easy and you under-stimulate; too hard and you can't recover.",
    category: "programming",
    source: "Helms et al. Muscle and Strength Pyramids · Schoenfeld proximity-to-failure research",
  },
  {
    id: "frequency-2x",
    text: "Train each muscle group at least twice a week. Schoenfeld's 2016 meta showed 2× frequency outperforms 1× at the same weekly volume.",
    category: "programming",
    source: "Schoenfeld et al. 2016 — Training frequency on hypertrophy meta-analysis",
  },
  {
    id: "rest-by-lift",
    text: "Big compound lifts deserve 2-3 minutes rest. Isolations can do 60-90 seconds. Hurrying rest for compounds tanks your top sets.",
    category: "programming",
    source: "Schoenfeld 2016 rest interval study · Grgic 2017 review",
  },
  {
    id: "deload-pre-emptive",
    text: "Don't wait for a stall to deload. After 4-6 weeks of accumulation, a planned light week protects long-term progress.",
    category: "programming",
    source: "Renaissance Periodization mesocycle structure",
    relevantWhen: ctx => ctx.experienceLevel === "intermediate" || ctx.experienceLevel === "advanced",
  },
  {
    id: "compound-first",
    text: "Order matters — put your hardest, most technical lift first while you're fresh. Save curls and lateral raises for the end.",
    category: "programming",
    source: "NSCA Essentials Ch.18 — exercise order recommendations",
  },
  {
    id: "no-program-hopping",
    text: "Stick with a program for at least 8-12 weeks before judging it. Constant program-hopping is the #1 reason intermediates stall.",
    category: "programming",
    source: "Practical Programming (Rippetoe & Kilgore) — Ch.5 program design",
  },
  {
    id: "vary-rep-ranges",
    text: "Cycle through rep ranges over a month — heavy weeks (3-6), volume weeks (8-12), endurance weeks (15+). Each stimulus targets different adaptations.",
    category: "programming",
    source: "Helms et al. — undulating periodization",
    relevantWhen: ctx => ctx.experienceLevel !== "newcomer",
  },

  // ── Technique ────────────────────────────────────────────────────
  {
    id: "control-eccentric",
    text: "Control the lowering phase. 2-3 seconds down, no bouncing. The eccentric is where most muscle damage and growth happens.",
    category: "technique",
    source: "Schoenfeld 2015 tempo meta-analysis",
  },
  {
    id: "full-rom",
    text: "Full range of motion beats partial reps for hypertrophy in nearly every study. Lengthening the muscle under load is the strongest stimulus.",
    category: "technique",
    source: "Pedrosa et al. 2022 — full vs partial ROM meta-analysis",
  },
  {
    id: "breathe-bracing",
    text: "Breathe in at the top, brace your core, lower under control, exhale at the top of the lift. Especially crucial for squats, deads, and overhead work.",
    category: "technique",
    source: "Stuart McGill — Low Back Disorders, 3rd ed.",
  },
  {
    id: "mind-muscle",
    text: "On isolation lifts (curls, raises, fly), focus on feeling the muscle work. Schoenfeld's MMC research shows this can boost hypertrophy on smaller muscles.",
    category: "technique",
    source: "Schoenfeld et al. 2018 — Attentional focus on hypertrophy",
  },
  {
    id: "neutral-spine",
    text: "Don't round your back under load. Brace, hinge from the hips, keep your spine neutral. A single bad rep can cost weeks of training.",
    category: "technique",
    source: "Stuart McGill — Back mechanics fundamentals",
  },
  {
    id: "warmup-sets",
    text: "Before your top set, do a build-up: 50%, 70%, 85% of your working weight for a few reps each. Cheap insurance against injury.",
    category: "technique",
    source: "Behm & Chaouachi 2011 — warm-up systematic review",
  },

  // ── Recovery ─────────────────────────────────────────────────────
  {
    id: "sleep-king",
    text: "Sleep is the single biggest recovery lever. 7-9 hours nightly. No supplement comes close to its effect on strength and hypertrophy.",
    category: "recovery",
    source: "ACSM nutrition + sleep position stands",
    relevantWhen: ctx => ctx.sleepLastNight != null && ctx.sleepLastNight < 7,
  },
  {
    id: "rest-day-not-lazy",
    text: "Rest days build muscle. The work happens in the gym; the growth happens between sessions. Skipping rest = stalling progress.",
    category: "recovery",
    source: "Practical Programming Ch.3 — recovery as a stimulus driver",
    relevantWhen: ctx => ctx.currentStreak >= 6,
  },
  {
    id: "deload-after-3-stalls",
    text: "If a lift hasn't moved in 3 sessions, take a deload week before changing the exercise. 70% weights × 1 fewer set is the standard formula.",
    category: "recovery",
    source: "Israetel / Renaissance Periodization deload protocol",
  },
  {
    id: "active-recovery",
    text: "Light movement on rest days (walking, easy mobility, swimming) accelerates recovery vs total rest. Aim for 20-30 min low intensity.",
    category: "recovery",
    source: "Dupuy et al. 2018 — Recovery techniques meta-analysis",
  },
  {
    id: "post-workout-window",
    text: "The 'anabolic window' lasts hours, not minutes. As long as you hit your daily protein, the exact timing post-workout matters less than people claim.",
    category: "recovery",
    source: "Aragon & Schoenfeld 2013 — Nutrient timing revisited",
  },

  // ── Nutrition ────────────────────────────────────────────────────
  {
    id: "protein-target",
    text: "Aim for 1.6-2.2 g of protein per kg of bodyweight per day. That's the evidence-based hypertrophy range — more isn't better, less leaves gains on the table.",
    category: "nutrition",
    source: "Helms et al. 2014 meta-analysis — protein for natural lifters",
  },
  {
    id: "hydration-perf",
    text: "Even 2% dehydration drops strength and endurance noticeably. ~35 ml of water per kg of bodyweight per day, more on training days.",
    category: "nutrition",
    source: "ACSM position stand on exercise and fluid replacement",
    relevantWhen: ctx => ctx.hydrationToday < ctx.hydrationTarget * 0.5,
  },
  {
    id: "carbs-for-volume",
    text: "If you're doing high-rep / high-volume training, don't skimp on carbs. They fuel anaerobic glycolysis — your bread-and-butter energy system in the 6-15 rep range.",
    category: "nutrition",
    source: "Jeukendrup & Gleeson — Sport Nutrition, 3rd ed.",
  },
  {
    id: "caffeine-pre",
    text: "100-200 mg of caffeine ~45 min before a heavy session reliably boosts strength and endurance. More isn't proportionally better.",
    category: "nutrition",
    source: "Grgic et al. 2020 meta — Caffeine on muscle strength",
  },

  // ── Mindset ──────────────────────────────────────────────────────
  {
    id: "show-up",
    text: "On low-energy days, drop the weight and show up anyway. Half a session beats no session — and you almost always feel better once you start.",
    category: "mindset",
    source: "Practical observation across coaches; no single citation",
    relevantWhen: ctx => ctx.daysSinceLastSession >= 3,
  },
  {
    id: "small-progress",
    text: "+2.5 kg or +1 rep is real progress. Over a year that's 130 kg / 50 reps of growth. Compounding wins.",
    category: "mindset",
    source: "Helms et al. — Compounding progression chapter",
  },
  {
    id: "consistency-over-intensity",
    text: "A B+ program executed for a year beats an A+ program done for two months. Frequency × time is the lever.",
    category: "mindset",
    source: "Pyramid of Training — Helms et al.",
  },
  {
    id: "comparison-thief",
    text: "Compare to last-week-you, not Instagram. Genetics, sleep, drugs, training age — everyone's curve is different.",
    category: "mindset",
    source: "General coaching wisdom",
  },

  // ── Habit / behavioural ──────────────────────────────────────────
  {
    id: "track-everything",
    text: "Logging every set is the cheapest performance lever. You can't improve what you don't measure.",
    category: "habit",
    source: "Behavioural change literature (Locke & Latham goal-setting)",
  },
  {
    id: "rpe-on-every-set",
    text: "Tag effort (RPE) on each set. Two weeks of data and you'll have a much sharper picture of which lifts are sandbagged vs maxed.",
    category: "habit",
    source: "Tuchscherer — RTS methodology",
    relevantWhen: ctx => ctx.totalSessionsLifetime >= 5,
  },
  {
    id: "warmup-mobility",
    text: "5 minutes of dynamic mobility before lifting reduces injury risk meaningfully. Static stretches go AFTER, not before.",
    category: "habit",
    source: "Behm & Chaouachi 2011 — Acute effects of warm-up",
  },
  {
    id: "track-bodyweight-weekly",
    text: "Weigh yourself 3-5 mornings a week, take the average. Daily fluctuations of ±1.5 kg are normal water/glycogen swings.",
    category: "habit",
    source: "Helms et al. — Nutritional periodization chapter",
  },

  // ── Context-conditional ─────────────────────────────────────────
  {
    id: "morning-train",
    text: "Training in the morning? Spend an extra 5 min on warm-up. Body temperature is lower and joints take longer to come online.",
    category: "technique",
    source: "ACSM exercise physiology — circadian effects on performance",
    relevantWhen: ctx => ctx.hour < 9 && ctx.hour >= 5,
  },
  {
    id: "evening-train",
    text: "Most people are slightly stronger in the late afternoon / early evening — body temperature peaks. If you can train then, you'll see it on the bar.",
    category: "programming",
    source: "Chtourou & Souissi 2012 — Circadian rhythm and performance",
    relevantWhen: ctx => ctx.hour >= 14 && ctx.hour < 18,
  },
  {
    id: "injury-substitute",
    text: "An injury isn't a rest sentence — train around it. Pinpoint the painful range and substitute movements that avoid it. Stay in the gym.",
    category: "recovery",
    source: "McGill — Back disorders, training-around-injury protocols",
    relevantWhen: ctx => ctx.hasActiveInjury,
  },
  {
    id: "first-week",
    text: "Don't max out in week 1. Use the first 4-6 sessions to learn movement patterns and calibrate weights — even if it feels too easy.",
    category: "programming",
    source: "Practical Programming Ch.7 — Novice progression",
    relevantWhen: ctx => ctx.totalSessionsLifetime < 5,
  },
  {
    id: "long-streak-deload",
    text: "Your current streak is impressive — but watch for grinding-fatigue. A planned light week now beats a forced 2-week break later.",
    category: "recovery",
    source: "Israetel — overreaching prevention",
    relevantWhen: ctx => ctx.currentStreak >= 14,
  },
  {
    id: "high-rpe-bias",
    text: "Your recent sets are averaging RPE 9+. That's grind-mode. Reserve true 9-10 sets for the last set of an exercise, not every set.",
    category: "programming",
    source: "Helms — How proximity-to-failure affects volume",
    relevantWhen: ctx => ctx.recentAvgRpe != null && ctx.recentAvgRpe >= 8.7,
  },
];

// Pick today's pro tip deterministically by date, biased toward
// context-relevant ones. If multiple tips' relevantWhen() returns true,
// rotate among them daily; if none match, fall back to evergreens.
export function pickDailyTip(ctx: TipContext): ProTip {
  const iso = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of iso) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  const contextualMatches = TIPS.filter(t => t.relevantWhen && t.relevantWhen(ctx));
  const evergreens = TIPS.filter(t => !t.relevantWhen);

  // Bias: 60% chance to surface a contextual tip if any apply, else evergreen.
  // The hash modulo gives us a deterministic but seemingly varied roll.
  if (contextualMatches.length > 0 && (hash % 5) >= 2) {
    return contextualMatches[hash % contextualMatches.length];
  }
  return evergreens[hash % evergreens.length];
}
