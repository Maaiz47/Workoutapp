# IRONLOG — Patch Log

---

## Feat · 2026-05-22 — Recency-weighted Mastery (qa: tier-decay)

@maaiz approved shipping just the highest-impact decay change.

### What changed

Mastery sub-rank now uses **distinct exercises trained in the last
180 days**, not lifetime. A user stuck in a 5-exercise rut for a
year loses Mastery score until they vary again. Returning users
(2-month break) barely feel it — 6-month window is forgiving by
design.

### Why this one

- Solves the rut problem (the only way the old system rewarded
  variety was through career breadth, which lifelong lifters
  could coast on).
- Aligns with the existing adaptive-recency engine that already
  classifies per-exercise recency for the picker dots. Same
  philosophy: variety = freshness.
- Bounded blast radius — only Mastery's input changes; the
  other 4 sub-ranks are untouched. A returning user re-builds
  Mastery score quickly because the curve hits 80 at just
  ~25 distinct exercises (midpoint).

### Implementation

- `AthleteStatsForTier` gets a new optional input
  `recentDistinctExercises`. When provided, Mastery uses it;
  otherwise falls back to lifetime so legacy callers don't
  break.
- `computeStatsFromLogs` (server-side, used for leaderboard
  rows) walks logs once with a 180d gate and emits both
  lifetime + recent counts. Recent feeds Mastery score; lifetime
  is kept on `LeaderboardMemberStats.distinctExercises` for
  callers that display it.
- Mastery detail line now reads
  `"X distinct exercises (last 6mo) · Y lifetime"` when the
  recent count is provided, so users see both numbers.
- All three places in `app/page.tsx` that compute the visitor's
  own breakdown (the canonical memo, the milestone-up trigger,
  the Progress dashboard tier card) updated to compute the
  recent set alongside lifetime.

### What's still in play (next slices if needed)

- Volume blend (60% lifetime + 40% rolling 90d). Will revisit
  after Mastery soaks for a week or two.
- PR softening with age. Lower priority; current PR count is
  already a relatively small driver of the headline.

(qa: tier-decay)

---

## Fix · 2026-05-22 — Surface the global leaderboard on home (qa: global-leaderboard-entry)

@maaiz: "I'm not seeing any global leaderboards placed anywhere,
not for trainers in general, not for a global athlete leaderboard
which we already discussed either."

Root cause: the view existed (`GlobalLeaderboardView` at line
3709, route `/api/leaderboard/global`) but the only entry point
was buried INSIDE the TierInfoModal — user had to tap a tier
badge → modal opens → scroll down → tap a button. Four taps
deep, behind a thing most users never open.

### Fix

- Added a first-class entry point on the home screen, right
  above the GROUPS section: a wide `🌍 GLOBAL RANKINGS` card
  with subtitle "See how you stack up · Athletes + trainers
  ranked across the whole app."
- One tap → opens `GlobalLeaderboardView`. The view's own
  internal toggles handle athletes-vs-trainers and
  top-100-vs-tier-band-vs-around-you.
- Existing TierInfoModal "🌍 GLOBAL TIER LEADERBOARD" button
  kept — second entry point doesn't hurt.

### Tutorial

- Added a `global-rankings` step explaining the new entry
  point.
- Bumped `TUTORIAL_VERSION` v3 → v4 so existing users see it
  once on next launch.

(qa: global-leaderboard-entry)

---

## Feat · 2026-05-22 — Suggested-workout bonus (qa: suggestion-bonus)

@maaiz: "Doing suggested workouts can give a slight tier point bonus."

### Slice 1/N — +1 tier-score bonus when you log the suggested day

- New field `UserProfile.lastSuggestionBonusAt` (cooldown tracker).
- `suggestedNext` picker hoisted from the grid IIFE into a
  component-level `useMemo` so both the day-card render AND the
  workout-save handler can read it.
- Workout-save flow now computes `wasSuggested = suggestedNext?.id
  === activeDay?.id` and passes it to `POST /api/workout`.
- Server: when `wasSuggested === true`, increment
  `tierScoreBonus` by +1 (subject to: 20h cooldown via
  `lastSuggestionBonusAt`, and the existing +20 lifetime cap
  shared with lucky drops).
- Returns `{ suggestionBonus: 1 }` in the response when awarded.
- Client reuses the lucky-drop celebration overlay with the
  message "🎯 Smart pick — +1 for following the suggested day."
  Quieter than a lucky drop (no surprise factor) but still gives
  the dopamine hit.

### Why the existing infrastructure handles it

The +1 lands in the SAME `tierScoreBonus` bucket as lucky drops,
which already flows through `lib/leaderboardStats.ts ::
buildCanonicalTier` and gets blended into the headline athlete
score on every leaderboard surface. No tier-formula changes
needed.

### Carrots a user can stack

- 20% chance per session → lucky drop (+1..+5)
- 100% chance once per 20h → suggestion bonus (+1)
- Combined cap: +20 lifetime
A user who follows the plan EVERY day will fill the +20 bucket in
~20 days. A user who never follows it and never gets a lucky drop
sits at +0. The score difference is meaningful but not
overwhelming (+20 on a 100-point scale = ~1 tier rung at the
margins).

(qa: suggestion-bonus)

---

## Fix · 2026-05-22 — Suggested-next moves onto the day card (qa: home-suggested-overlay)

User screenshot showed the standalone "▶ SUGGESTED NEXT · Leg Day —
Foundation · {reason} · START ▸" banner eating ~120px of vertical
space between the welcome card and YOUR SPLIT. The same day was
ALSO rendered just below in the split grid — visually a duplicate.

@maaiz: "Suggested next to be shown overlaid on the card, not as
its own announcement taking up too much space."

### Fix

- Deleted the standalone banner block above YOUR SPLIT (~150 LOC
  of JSX + picking logic).
- Moved the same picking logic (oldest-last-logged + back-to-back
  pattern penalty + first-time bias) into the grid IIFE so it
  shares the `plan` const — single source of truth, no recompute.
- Day card render now reads `isSuggested = !started &&
  suggestedNext?.id === d.id` and decorates the matching card with:
  - A `▶ NEXT UP` chip in the day's accent colour, top-right
    (where the ACTIVE chip lives during a session — they're
    mutually exclusive: ACTIVE only fires `started`, NEXT UP only
    fires `!started`, so no overlap).
  - Stronger border (`${d.color}80` vs `${d.color}22`) and a
    subtle `0 0 20px ${d.color}55` outer glow so the suggested
    card pops without being garish.
- The auto-start-on-tap convenience of the old banner is dropped
  — tapping the suggested card opens the day with the normal
  expanding animation, user taps START on the next screen like
  any other day. One extra tap, but the home screen is no longer
  cluttered with a duplicate announcement.

(qa: home-suggested-overlay)

---

## Fix · 2026-05-22 — Tier info modal: canonical trainer ladder + athlete sub-rank breakdown (qa: tier-explainability)

User flagged two issues on the "Two ladders, one app" modal:

1. **Trainer ladder was lying.** Showed "Spotter 0+ clients →
   Strategist 2+ clients → Pro 5+ clients → Master 10+ clients →
   Legend 18+ clients → Hall of Fame 30+ clients" — but the YOU
   badge said "49 PTS" and the progress bar said "+0 PTS → MASTER ·
   49/10 PTS". The thresholds (legacy client counts) didn't match
   the metric (canonical headline 0–100 score). User saw nonsense.

2. **Athlete ladder was vague.** Showed "Lion · 57 PTS · +13 PTS →
   GORILLA" with the tier list but no explanation of WHY the score
   was 57 / which sub-rank to push.

### Fix

- **Trainer ladder** now uses `TRAINER_TIERS_NEW_LITE` (the
  canonical score-based ladder from `lib/tiers.ts`) instead of the
  legacy client-count fallback `TRAINER_TIERS`. Thresholds now read
  Spotter 0+ pts → Strategist 15+ → Pro 30+ → Master 50+ → Legend
  70+ → Hall of Fame 88+ — matching the actual computation.
- Trainer unit subtitle updated to "raw trainer score (0–100). Five
  sub-ranks feed it." (was "more active clients unlocks the next
  tier" — true for the loading-state fallback only).
- `unitWord` for the trainer ladder switched from `"clients"` to
  `"pts"` so the misleading "1 PT = 1 CLIENT" footer line stops
  rendering.
- **Athlete sub-rank breakdown panel** added directly under the
  athlete ladder, mirroring the existing trainer-sub-rank panel:
  five rows (Consistency / Strength / Volume / Mastery / Habits)
  with `X/100` scores, progress bars, and the same "Path to next"
  callout pointing at the weakest dimension. Reuses
  `athleteBreakdown.subRanks` (already computed by
  `computeAthleteTier` for the Progress dashboard) — modal just
  needed it forwarded as a prop.

### What the user sees now

- Trainer at headline 49 → correctly highlighted as **Pro** (30+
  pts), with "+1 PTS → MASTER" instead of nonsense "+0 PTS / 49/10
  PTS".
- Athlete at headline 57 → still Lion, but now sees five sub-rank
  bars so they know exactly which dimension to grind (likely
  Habits, given hydration/sleep/energy default low until they start
  logging wellness).

(qa: tier-explainability)

---

## Fix · 2026-05-22 — Form-preview audit + 26 local placeholders (qa: form-preview-audit)

Audited every entry in `EXERCISE_DB_MAP` against the actual
free-exercise-db manifest (873 canonical exercises). Findings:

- ✓ **109/109 DB ids we reference do exist** in free-exercise-db. No
  broken-link form previews.
- ⚠ **7 wrong-semantic mappings** — the DB id existed but pointed
  to a completely different exercise:
  - `jumping-jacks` → was `Air_Bike` (an ab-bike crunch, not jumping
    jacks)
  - `burpees` → was `Mountain_Climbers` (different exercise)
  - `high-knees` → was `Mountain_Climbers` (debatable but
    misleading)
  - `wall-sit` → was `Plank` (different muscle group entirely —
    quads vs core)
  - `wall-slide` → was `External_Rotation` (different movement)
  - `terminal-knee-extension` → was `Lying_Leg_Curls` (hamstring vs
    quad, opposite muscle)
  - `bird-dog` → was `Dead_Bug` (related but different posture
    family)
- 🚫 **12 exercises with NO mapping** — fell through to the no-image
  fallback: `bear-crawl`, `broad-jump`, `elliptical`, `inchworm`,
  `lateral-bounds`, `lateral-shuffle`, `plyo-pushup`,
  `speed-skaters`, `split-jumps`, `squat-thrust`, `star-jump`,
  `tuck-jumps`.

### Action shipped this pass

1. **Removed the 7 wrong DB mappings** from `EXERCISE_DB_MAP` (with
   a comment explaining why).
2. **Extended `scripts/generate-stretch-placeholders.ts`** to render
   text-card placeholders for ALL 26 movements (7 stretches + 12
   plyometric + 7 ex-wrong). Each pair has a START frame and an
   END frame with the cue text so the FORM modal's 900ms alternation
   visually reads as "what to do".
3. **Registered all 26 ids in `LOCAL_STRETCH_IDS`** in
   `lib/exerciseImages.ts`. The local PNGs are picked up first,
   shadowing any remaining DB lookup.
4. **Consolidated all image-gen prompts** into `/image-prompts.md`
   at repo root (deleted the now-redundant `avatars-prompts.md` —
   its content moved into Section 1). The file lists every prompt
   needed: 30 avatars + 7 real stretch photos + 19 exercise demos
   = 56 prompt entries / 82 image files.
5. **Updated CLAUDE.md pending reminder** — replaced the
   "9 missing stretches" reminder with the consolidated
   "82 image-gen assets" reminder pointing at the master file.

### Note: placeholder files use PNG extension

The loader (`getExerciseImageUrls` in `lib/exerciseImages.ts`) now
returns `/stretches/<id>/{0,1}.png` for any id in
`LOCAL_STRETCH_IDS` (was `.jpg`). The free-exercise-db fallback
still uses `.jpg` since their remote files are JPGs. Real photos
generated by the user can be saved as either extension — just match
what the loader expects (`.png` for now).

---

## Feat · 2026-05-22 — Adaptive rewards + group challenges + lucky drops (qa: adaptive-exercise-rewards, group-challenges, random-rare-rewards, profile-avatars)

@maaiz on the next-features design call: ship the three motivational
gimmicks but fold them INTO the tier ladder — no separate XP/coins.
Avatars instead of cosmetic-shop currency. Use existing profile focus
fields where personalisation matters; don't add a new class-picker.

Three concurrent slices land in this pass:

### Slice 1/N — Adaptive exercise rewards
The variety nudge users actually see right now is a coloured dot on
the plan-editor exercise browser:

- `lib/adaptiveRewards.ts` computes per-exercise recency from the
  user's existing workout history. Tiers:
  - **Never logged** → blue dot, 1.30× multiplier
  - **Neglected (14+d)** → blue dot, 1.25×
  - **Cooling (8-13d)** → pale blue, 1.10×
  - **Baseline (4-7d)** → no dot, 1.00×
  - **Warm (0-3d)** → amber, 0.90×
  - **Over-trained (3×/7d)** → red, 0.75×
- Plan editor picker (`app/page.tsx` ~6862) renders the dot next
  to each exercise name. Tap opens a popover with last-logged
  date, status headline, and the bonus/dampener text. Tapping the
  row itself (anywhere else) still adds the exercise — only the dot
  is its own button.
- Slice 1 is **client-only metadata** — the multiplier doesn't yet
  alter the tier score formula. A later slice can blend it into
  the volume sub-rank if it tests well. The in-session "add
  exercise" picker (~13387) gets its dot in slice 2.

### Slice 1/N — Group challenges with shared progress
- Prisma `GroupChallenge` model (groupId, createdBy, metric,
  target, title, optional exerciseSubstrings, startedAt, endsAt,
  state) plus cascade-delete on group removal.
- API: `POST/GET/DELETE /api/leaderboard/groups/[id]/challenges`.
  POST is leader-only (createdBy check). GET enriches each row
  with computed `progress`, per-member contribution map,
  `myContribution`, and derived state (active/completed/expired).
  Progress recomputed on every read from member WorkoutLogs in
  the window — no cached counter so edits stay correct.
- UI: 🎯 CHALLENGES card on each group's panel. Active challenges
  show a shared yellow progress bar with `progress/target unit`,
  days left, your contribution line. Leader sees + START button
  → inline form (title, metric dropdown, target, days,
  optional exercise filter). Leader can also CANCEL active ones.
  Non-leaders see read-only with progress + their contribution.
- Metrics supported: total_reps, total_sessions,
  total_volume_kg, exercise_distinct. Optional
  `exerciseSubstrings` (CSV) restricts reps/volume to matching
  exercises so a group can run e.g. "1000 pushup reps together".

### Slice 1/N — Random rare rewards (lucky drops + avatars)
- Prisma additions: `UserProfile.avatarId`,
  `UserProfile.tierScoreBonus` (Int, default 0, capped at +20
  lifetime), `UserProfile.lastLuckyDropAt`, and `UserAvatarUnlock`
  model (userId+avatarId unique, source `"tier"|"lucky"`,
  optional tier).
- `lib/avatars.ts` catalogue defines 30 avatars: 20
  tier-progression unlocks (3-4 per tier 1-6) + 10
  lucky-drop-only avatars with weighted rarity (clover at weight
  25 down to mythic at weight 1).
- `lib/luckyDrops.ts` drives the roll: 20% per-session
  eligibility, gated by a 24h cooldown. 35% of fired drops are
  rare avatars (when any unlockable remain), the rest are
  +1..+5 tier-score bonuses. Once all rare avatars are owned the
  pool falls back to score bonuses.
- `/api/workout` POST now rolls after persisting the WorkoutLog
  and returns `{ luckyDrop }` in the response. `postWithQueue`
  was extended to expose the response body so the client can
  surface the celebration.
- `/api/avatars` GET returns inventory (auto-backfills tier
  unlocks the user qualifies for) + tier idx + tierScoreBonus.
  PATCH equips an unlocked avatar id (or null to clear).
- UI: avatar in Settings > IDENTITY card is now a button — tap
  to open the picker. Grid shows all 30 avatars with locked
  silhouettes for ones not yet earned (TIER N hint or RARE
  badge for lucky-only). Tap to equip; image updates immediately.
- Lucky drop celebration overlay (purple-tinted for avatars,
  green for score bonuses) renders after session save. Shows
  the flavour string from `lib/luckyDrops.ts`.
- `lib/leaderboardStats.ts` now blends `tierScoreBonus` into
  every canonical tier score, so the lottery actually moves the
  metric users care about — same ladder, no parallel currency.

### Avatar art — deliverable for @maaiz
`/avatars-prompts.md` (NEW at repo root) has ChatGPT prompts for
every one of the 30 avatars with a unified dark-mode style guide.
User generates → drops the resulting PNGs into `/public/avatars/`
keyed by avatar id (e.g. `/public/avatars/starter-spark.png`).
Missing files fall back to `/ai/avatar-default.png` automatically,
so the picker is functional immediately even with zero art
generated.

### qa-state.json items added
`adaptive-exercise-rewards`, `group-challenges`,
`random-rare-rewards`, `profile-avatars`. All four start at
`regression-retest` with full multi-step QA scripts.

### Tutorial
No new tutorial step this pass — the lucky drop overlay is
self-explanatory at the moment of award, the avatar picker
discovers itself via the ✎ badge on the IDENTITY chip, and
adaptive recency dots are discoverable from the existing picker.
Once the avatars have art and the system has soaked for a week,
we can revisit and add a "Lucky drops & avatars" step.

---

## Feat · 2026-05-22 — QA steps individually commentable (qa: qa-per-step-comments-v2)

@maaiz: "Full qa system still isn't how I intended.
There are steps to testing each function/feature, I want
to be able to individually comment on each step not the
whole function/feature."

Previous slice gave each step a 💬 button that scoped a
single shared form to that step — still item-centric in
practice. This pass makes each step a first-class commentable
unit:

- Each step row in `/qa` is now a clickable card. Numbered
  chip on the left, step body, comment count, chevron.
- Tapping expands the step INLINE to reveal:
  - That step's thread (filtered to `stepIndex === i`)
  - A reply form scoped to the step (status / note /
    screenshot URL / save button labelled "SAVE COMMENT
    ON STEP N")
- Only ONE step open per item at a time (`openStepIndex`
  local state) — keeps the active surface unambiguous.
- The item-level thread + form at the bottom now ONLY
  show step-less comments (`stepIndex == null`). Per-step
  comments live inline next to their step.
- Bottom item-level form is HIDDEN while a step is open,
  so you can't accidentally cross-post.

Data model unchanged — `QAComment.stepIndex` already
existed. This is a UI-only redesign.

---

## Feat · 2026-05-22 — Time-of-day for body metrics + Unlock Your Abs (qa: body-metric-timeofday, mission-unlock-abs)

### 1. Weight/BF time-of-day capture
@maaiz: "Make user select what time weight was recorded
morning or evening. Advise that weight should be recorded
prior to workouts, ideally in the morning and daily or
once a week. Make weight recordings recognisable on the
graph by the selection via color code. Same applies for
body fat %."

- **Schema**: `BodyMetric.timeOfDay String?` — nullable for
  backwards compat. API POST/PATCH whitelist
  `morning|evening`.
- **UI**: LOG TODAY card now has a yellow advisory at the
  top ("Best logged before workouts, ideally in the
  morning, fasted") and a pill picker below the inputs
  (☀️ MORNING teal / 🌙 EVENING amber). Default: morning.
- **History rows**: small badge next to the date showing
  ☀️ AM or 🌙 EVE.
- **BodyTrendChart**: dots colour-coded — morning = primary
  chart colour (teal for weight, purple for BF), evening
  = amber #FFB454 for both. A legend appears below the
  chart when both kinds of readings exist.
- **Edit form**: same picker, pre-seeded from the entry.

### 2. Unlock Your Abs mission
@maaiz: "Make a 6 month challenge for body fat under 15%
and call it something about unlocking abs (as 15% and
under is when they really show right?)" → revised to
"Actually no need for a 6 month time limit, can just be a
challenge anyone joins and it should automatically update
their goal body fat but show an error if they haven't
recorded any. It can also be a milestone unlock if
someone has or achieves under the abs %."

- **lib/challenges.ts**: new `MISSIONS` array alongside
  monthly `CHALLENGES`. Each mission supports an optional
  `durationDays` (0 / undefined = open-ended) and
  `setsProfileGoal: true` so JOIN writes the target into
  `profile.targetBodyFatPct`.
- **Mission**: id `mission-unlock-abs-v1`, target = 15% BF,
  open-ended (no deadline).
- **JOIN flow**: PATCH /api/profile updates
  `targetBodyFatPct=15`. If the user has no BF reading
  yet, JOIN is blocked with an inline error ⚠ "Log a
  body fat reading first".
- **Milestone**: new `abs-unlocked` in `lib/milestones.ts`
  fires when `currentBodyFatPct <= 15`. Triggers from the
  workout-save milestone pipeline AND from `logBodyMetric`
  directly so the celebration fires the moment a sub-15%
  reading lands. Sticky once earned.
- **Card UI**: rendered above MONTHLY CHALLENGES section
  in `ChallengesCard`. Pre-join preview shows current
  gap. Joined state shows fill-bar + "Goal body fat set
  to 15%. No deadline — keep logging your BF readings,
  the bar fills as you progress."
- bodyMetrics now eagerly-fetched on user mount so the
  mission card on home has data without visiting Body
  tab first.

---

## Feat · 2026-05-22 — Global tier leaderboard + scoring fairness (qa: tier-global-leaderboard, tier-scoring-fairness)

@maaiz: "Is there a tier global leaderboard anywhere? Should
we have it?" + "Points should be fair to reward sufficient
rest days and minimise reward for going too hard."

### 1. Global tier leaderboard
New cross-app ranking surface. Two tabs (🏆 Athletes /
🤝 Trainers), three lenses (Top 100 / Your tier band /
Around you ±5).

- **Endpoint**: `GET /api/leaderboard/global?kind=&lens=`
  iterates all qualifying users, computes their canonical
  tier score via `computeStatsForUsers` (athletes) or
  `computeTrainerTier` (trainers), sorts, slices to the
  requested lens. Athletes need ≥ 5 lifetime sessions to
  qualify so bots + casual accounts don't pollute the top.
- **Schema**: `UserProfile.hideFromGlobalLeaderboard
  Boolean @default(false)` — athlete opt-out. When true,
  the row shows as `Athlete #<rank>` instead of @username.
  Trainers can't opt out; their board is intentionally
  public for client discovery (user direction).
- **UI**: standalone `GlobalLeaderboardView` in
  app/page.tsx with kind/lens tabs, meta strip (your rank,
  total ranked, your tier), and ranked rows colour-coded
  per tier theme. Entry point: 🌍 GLOBAL TIER LEADERBOARD
  button in TierInfoModal.
- **Settings**: new 🌍 GLOBAL BOARD toggle under APP
  PREFERENCES with a 44×26 iOS-style switch. Hidden for
  trainers.

### 2. Scoring fairness — adherence over streak
The consistency sub-rank was 60% lifetime sessions + 40%
streak. The streak component punished rest days — a user
training 4×/wk with proper rest would have streak=0 most
of the week and lose those points. New formula:

```
consistency = 50% × log(lifetime sessions)
            + 40% × adherence(sessions in last 4 weeks,
                              daysPerWeek)
            + 10% × log(streak)
```

`adherence` curves to 100 when the user hits exactly their
weekly target (`daysPerWeek × 4` distinct training days in
the last 28 days). Above target it DROPS — 150% scores 50,
200% scores 0. So overtraining loses points; resting on
schedule earns them.

- New `AthleteStatsForTier.sessionsLast4Weeks` +
  `daysPerWeek` inputs.
- `computeStatsForUsers` fetches each user's
  `UserProfile.daysPerWeek` alongside their logs so the
  server-side tier matches the client.
- Detail line under Consistency reads e.g. "16/16 last
  4wk" when on target, or "28/16 last 4wk (over target —
  rest!)" if overtrained.
- Streak kept as a small 10% bonus — every-day grinder
  vibe still recognised, just not the primary driver.

Existing top-tier users who overtrained may see a one-time
score dip. That's the intent: hard training without rest
shouldn't out-score smart training with rest. The path to
recovery is to actually rest.

---

## Feat · 2026-05-22 — Trainer tier now includes Discipline (qa: tier-trainer-discipline)

@maaiz: "I want the athlete tier a trainer has to play a
role in the trainer tier — they can't be slacking and be a
good trainer."

### What changed
Added a 5th sub-rank to the trainer tier breakdown:
**Discipline** — driven by the trainer's OWN athlete
headline score (0-100). The trainer ladder headline is now
the average of 5 sub-ranks (was 4):

- 👥 Roster — active client count
- 🚀 Progression — % of clients with a recent PR
- 🔁 Retention — % on an active streak
- ⭐ Reach — total client PRs + volume
- 🏋 Discipline — **NEW** the trainer's own athlete score

### Why it matters
A trainer with a big roster + great client progress but no
personal training would previously sit at Pro/Elite. Now
their Discipline dim is 0, dragging the headline down by
1/5 of the missing points — caps them around mid-Pro at
best. Top trainer tiers require actually training yourself,
which is the design intent.

### Server pipeline
`/api/trainer/me/tier` now also calls
`computeStatsForUsers([trainerUid])` and passes the
returned canonical athlete score into `computeTrainerTier`
as `selfAthleteScore`. Same pipeline as every other tier
surface, so the number a trainer sees in their Discipline
dim matches the headline on their personal Progress
dashboard exactly.

### Existing trainers
This is a one-time tier-score drop for trainers who weren't
training themselves. Earned milestone badges stay (the
celebration system uses `>=` tier checks, not exact match).
The path to recovery is simple: train and the score climbs.

### Tier name redesign — final lineup (added 2026-05-22 same day)
@maaiz locked the trainer ladder names. New 6-tier lineup
replaces the old 4-tier Rookie/Coach/Pro/Elite:

| # | Name | Icon | Score |
|---|---|---|---|
| 1 | Spotter      | 🤝 | 0  |
| 2 | Strategist   | 🧠 | 15 |
| 3 | Pro          | ⚡ | 30 |
| 4 | Master       | 👑 | 50 |
| 5 | Legend       | 🏆 | 70 |
| 6 | Hall of Fame | ⭐ | 88 |

`TRAINER_TIERS` in lib/tiers.ts rebuilt as 6 entries.
`tierNum` already universal so the modal's sub-rank panel +
leaderboard rendering both pick up the new names without
extra wiring. Client-count fallback array in page.tsx
(used during loading before /api/trainer/me/tier responds)
re-keyed to the new names too — mins are roster counts
(0/2/5/10/18/30), not scores. Modal explainer copy updated
to drop the obsolete "Coach is a tier of trainers" line —
replaced with "Spotter → Hall of Fame, Discipline included".

---

## Feat · 2026-05-22 — Athlete tier theme system + ladder redesign (qa: tier-themes)

@maaiz: "Rework the athlete tier names: Kitten → Fox → Big
Dawg → Lion → Gorilla → Bear" + "Universal tier numbers 1-N
alongside the name" + "Simple theme uses Bronze → Silver →
Gold → Diamond" + "Trainers tiers unchanged across themes".

### The new athlete ladder (6 tiers, Monkey + Tiger retired)

| # | Vivid (default) | Simple | Score |
|---|---|---|---|
| 1 | 🐱 Kitten   | 🥉 Bronze   | 0  |
| 2 | 🦊 Fox      | 🥈 Silver   | 15 |
| 3 | 🐕 Big Dawg | 🥇 Gold     | 30 |
| 4 | 🦁 Lion     | 🏆 Platinum | 50 |
| 5 | 🦍 Gorilla  | 💎 Diamond  | 70 |
| 6 | 🐻 Bear     | 👑 Master   | 90 |

The score thresholds match the previous breakpoints
(0/15/30/50/70/90) so anyone mid-ladder doesn't get
demoted by the rename.

### Theme architecture (lib/tiers.ts)
- New `tierNum: number` on `AnimalTier`. Universal across
  themes — Tier 4 is the same achievement whether you see
  "Lion" or "Platinum".
- `ATHLETE_TIER_THEMES: Record<"vivid"|"simple", AnimalTier[]>`
  catalogue. Both themes share `tierNum` + `min`; only
  `label`, `icon`, and `color` differ.
- `getAthleteTiers(theme)` returns the right array.
  `computeAthleteTier(stats, theme)` resolves the headline
  against the chosen theme.
- Trainer ladder kept theme-agnostic (per user direction):
  Rookie / Coach / Pro / Elite everywhere.

### Persistence
- `UserProfile.tierTheme String?` (Prisma) — null/"vivid" |
  "simple". Whitelist-validated on PATCH so a junk theme
  string can't break `getAthleteTiers`.
- HomePage hydrates `tierTheme` from the profile fetch and
  passes it into every tier-display surface
  (`HomeGlobals` → `TierInfoModal`, leaderboard rows,
  tier card on home, Progress dashboard).

### Settings UI
- New `🏆 TIER NAMES` card under APP PREFERENCES with two
  options side-by-side (Vivid / Simple), each with a
  6-emoji preview row + "Kitten → Bear" / "Bronze → Master"
  subtitle. Tap to switch, auto-saves.

### Leaderboards now theme-shift per viewer
The server-side stats endpoint ships tier objects in the
default Vivid theme. Client-side, each leaderboard row
remaps the tier by `tierNum` into the viewer's chosen
theme so a Simple-theme user sees Bronze/Silver/Gold even
on rows owned by other users. (The viewer's identity
drives the theme, not the row owner's.)

### Milestones updated to use tierNum
The 5 tier-up milestone checks were string-equality on
`athleteTierLabel === "Tiger" || ...`. With Tiger and
Monkey removed from the lineup, those checks would have
fired incorrectly. Rebuilt to use
`state.athleteTierNum >= N`, theme-agnostic. Labels
updated to "Reached Tier N — <Vivid name>". Milestone IDs
(tier-monkey, tier-fox, tier-tiger, tier-lion, tier-gorilla)
preserved so users keep their earned badges; only the
display strings + check semantics changed.

### Why these specific 6 names
Asked @maaiz directly. They said: drop Tiger entirely,
keep Lion, replace Dawg with "Big Dawg". Final lineup:
Kitten → Fox → Big Dawg → Lion → Gorilla → Bear. Bear at
the top reads as a heavier, more grounded apex than the
previous Gorilla-as-top.

---

## QA pass · 2026-05-22 — 3 comments actioned (qa: plan-customise-add-remove, home-polish-v2, qa-dashboard)

Processed three unprocessed comments from the `qa-comments/`
mirror. Two @maaiz drive-by polish notes plus one @munchy bug
report. None flagged as suspicious — all genuine product
feedback.

### Addressed
- **@munchy · plan-customise-add-remove**:
  "Adding a new exercise in splits editing doesn't do anything."
  Root cause: when a user has no custom plan, customise falls
  back to WORKOUT_DATA — but those day IDs (`push1`, `pull1`)
  don't exist in DB. saveDay's `PUT /api/plan` 404'd silently
  and the UI ate the response. Fix: new `clone-fallback-day`
  POST action on `/api/plan` upserts in one step (bootstraps
  the WorkoutPlan if missing, creates a fresh PlanDay with a
  generated cuid — NOT the WORKOUT_DATA id since those would
  collide between users — and stocks it with the supplied
  exercises). Client-side `saveDay` detects the 404 and falls
  back to the clone path, then replaces the fallback row in
  `customPlan` with the real DB row. Subsequent edits on the
  same day hit the real id directly.
- **@maaiz · home-polish-v2**: "Gray out other sessions while
  a session is active." Locked day cards in YOUR SPLIT already
  used opacity 0.28; bumped the visual cue: opacity 0.22 +
  `grayscale(85%)` + `pointer-events: none`. Also hid the
  Suggested Next card while a session is active so the home
  screen doesn't dangle a second workout in front of the user
  mid-session.
- **@maaiz · qa-dashboard**: "Search bar not floating, want it
  always visible." Search was `position: sticky` inside the
  header section, so it slid out of view once the user
  scrolled past the header into the items list. Switched to
  `position: fixed` at viewport top with safe-area inset,
  backdrop blur, and a bottom shadow. Page top padding bumped
  to reserve room. Now visible across the whole scroll.

### qa-state reconciliation
- `plan-customise-add-remove`: untested → regression-retest,
  added the new-user scenario to its `steps[]`.
- `home-polish-v2`: lastTested → 2026-05-22, appended visual-
  lock step.
- `qa-dashboard`: lastTested → 2026-05-22, appended floating-
  search step.

---

## Feat · 2026-05-22 — Pending backlog clear (parts 4–5) (qa: tier-trainer-keeps-athlete, qa-per-step-comments)

Closes the remaining two items from the backlog clear after
parts 1-3 below.

### 4. Trainer tier — server-side multi-dim (qa: tier-trainer-keeps-athlete)
The trainer tier in the modal + Settings IDENTITY was still
computed from `clients.length` only (legacy
`getTrainerTier(N)`). The canonical multi-dim
`computeTrainerTier(stats)` already existed in lib/tiers.ts
but wasn't wired. Now:
- New `GET /api/trainer/me/tier` endpoint walks the
  trainer's roster, calls `computeStatsForUsers`, aggregates
  4 dimensions: `rosterCount`, `clientsWithRecentPR`
  (prCount > 0 AND last session ≤ 30 days), `clientsWithActiveStreak`
  (streak ≥ 7), `totalClientPRs`, `totalClientVolumeKg`,
  then calls `computeTrainerTier()` and returns the full
  `TierBreakdown`.
- HomePage fetches on mount when the user is a trainer,
  stores as `myTrainerBreakdown`, passes through HomeGlobals
  → TierInfoModal.
- Modal gains a new 🎯 YOUR TRAINER SUB-RANKS panel
  (renders only when breakdown is loaded + isTrainer) with
  4 bars (Roster / Progression / Retention / Reach), each
  showing N/100 score + a detail line. Plus a "Path to
  next" callout pointing at the lowest sub-rank — same
  shape as the athlete one on Progress Dashboard.
- Headline trainer tier in the ladder ribbon now sources
  from the breakdown when available, falls back to
  `getTrainerTier(clients.length)` while loading so we
  never render an empty badge.

### 5. /qa per-step comments (qa: qa-per-step-comments)
QAComments were item-level only — a tester saying "step 3
of the warmup flow is broken" had to write that in prose
and hope the next pass parsed it correctly. Now:
- Schema: `QAComment.stepIndex Int?` (nullable; null =
  item-level legacy behaviour). Index on
  `[itemId, stepIndex]` for thread queries.
- `POST /api/qa/comment` accepts + validates `stepIndex`
  (non-negative integer 0–99). `GET` returns it in the
  payload.
- /qa UI changes:
  - Each step in the STEPS TO TEST list grows a small 💬
    button on the right. Steps that already have scoped
    comments show the count (e.g. `💬 2`).
  - Tapping 💬 → sets `draft.stepIndex = i`, smooth-scrolls
    to the comment form, and the form shows a
    `💬 STEP N` indicator chip with a `× CLEAR` button.
  - Saved comments render the chip inline next to the
    tester name in the thread so reviewers see at a
    glance which step each comment is about.
- Step scope is optional — comments without one stay
  item-level. Existing data unaffected.

---

## Feat · 2026-05-22 — Pending backlog clear (parts 1–3) (qa: plan-cardio-day, onboarding-profile-setup, tier-info-modal)

Working the deferred slice-2 / next-pass items @maaiz
flagged. Items 1-3 of 5 done this pass.

### 1. Cardio day onboarding prompt (slice 2 of plan-cardio-day)
The cardio day field was editable in Settings → TRAINING
last pass but not surfaced during onboarding — new users
went through the HIIT prompt and never saw the cardio
question. Now: after the HIIT prompt closes (any selection),
a second prompt opens with the same shape: 4 options
(Steady-State / Intervals / Mixed / Skip) each with a 1-line
description. Choosing one PATCHes the profile and
regenerates the plan once at the end (HIIT save was
deferred to share the same regenerate call).

### 2. targetSessionMinutes → planGenerator tightening
`profile.targetSessionMinutes` was saved + shown vs. actual
since the previous slice, but planGenerator ignored it.
Now: a post-process step at the end of plan generation
inspects the target and tightens for short windows:
- `< 40 min` → auto-pair the last TWO isolation accessories
  of each strength day into a superset (groupId +
  groupType="superset", notes "Auto-paired (tight session)"
  on both). Saves ~3-4 min per day of run-time.
- `<= 30 min` → ALSO add a "Drop set on final working set
  (tight session)" note to the day's heaviest compound
  (just a textual nudge — drop-set mode itself stays
  user-controlled).
- `>= 40 min` → no change (default).
The planNote appended for the user reads e.g. "Tightened
for your 30-min window — last two isolations auto-paired
as supersets and drop-set notes added to top compounds."

### 3. TierInfoModal "Jump to my leaderboard row" deep-link
The tier explainer modal had a "Open Progress → Dashboard"
hint but no direct way to see where you actually rank.
Added a new `↓ JUMP TO MY LEADERBOARD ROW` button below the
hint. Tap → closes the modal, navigates home, scrolls to
the YOU row (`id="lb-you-row"`) in the first leaderboard
group via `scrollIntoView({ behavior: "smooth", block:
"center" })`. Wired the callback through HomeGlobals →
TierInfoModal so the modal stays generic (no view-coupling).

Items 4 (trainer multi-dim server-side tier) and 5 (/qa
per-step comments) coming next.

---

## Feat · 2026-05-22 — Dedicated cardio day opt-in (qa: plan-cardio-day)

@maaiz: "A lot of people like to have a fully cardio day,
make it a part of profile/initial questions asked to use in
the building routine to have a cardio day or not, and what
they should do."

### Slice 1 — schema + planGenerator + Settings UI

- **Schema:** `UserProfile.cardioPreference String?` — null/"none"
  | "steady" | "intervals" | "mixed". Applied via `prisma db
  push` on next Vercel deploy.
- **/api/profile PATCH + POST:** accept and persist
  `cardioPreference`.
- **planGenerator:** new `buildDedicatedCardioDay(profile,
  style)` emits one of three day shapes:
  - `steady` → 1 exercise × 30 min easy LISS, conversational
    pace, ~6/10 effort. Title "Cardio — Steady".
  - `intervals` → 10 sets × 1 min HARD (8–9/10) + 60s easy,
    3 min easy cooldown. Title "Cardio — Intervals".
  - `mixed` → 10 min easy warm-up + 8×45 sec hard / 45 sec
    easy + 5 min easy cooldown. Title "Cardio — Mixed".
  Equipment chosen from `preferredCardioIds(profile)` — gym
  users get treadmill / cycling / rower, home users get
  jump rope / jumping jacks / mountain climbers.
  Appended in addition to the strength split, skipped if
  the fat-loss auto-cardio day was already added so the
  user doesn't end up with two.
- **Settings UI:** new 🏃 CARDIO DAY block in TRAINING
  section (right under HIIT). Four chips
  (None / Steady-State / Intervals / Mixed) with one-line
  descriptions of what each contains. Auto-saves on tap,
  helper line tells the user to rebuild their plan to
  apply.

### Slice 2 — deferred to next pass

Surfacing the same prompt mid-onboarding (currently it's
only post-hoc in Settings + ↺ REBUILD WEEKLY PLAN). The
HIIT prompt screen is a good shape to copy — likely added
right after the HIIT step in the onboarding flow.

---

## Fix · 2026-05-22 — Stop "Reached Monkey" popping for users already at Tiger (qa: milestones-celebrations)

Hot take: the prior commit silently swallowed lower-tier
milestones to avoid the misleading popup. @maaiz course-
corrected — we should celebrate every tier the user
crossed, but each one should clearly say whether it's a
"passed" tier (retroactive, the user is currently higher)
or the "current" tier they just hit. So the previous
silent-swallow has been replaced with explicit tagging.

### What changed (revised)
- `detectNewMilestones()` now returns `MilestoneAward[]` —
  each milestone augmented with `tierBadge: "current" |
  "passed" | undefined` for tier ones.
- Caller orders tier milestones low→high in the queue, so a
  Tiger user who just unlocked all three sees Monkey
  (PASSED) → Fox (PASSED) → Tiger (CURRENT) as a ladder
  climb, with the actual current rank as the finale.
- Celebration overlay shows a green `✓ CURRENT TIER` chip
  when the tier matches the user's headline, and a faint
  `↑ PASSED TIER` chip for retroactive unlocks. Both still
  pop as full celebration cards — no badges are silently
  marked any more.

@maaiz: finished a session and got a "Reached Monkey
milestone" popup despite being TIGER on the leaderboard +
home tier display, AND having been Tiger before the session
started.

### Root cause
Tier milestones (`tier-monkey`, `tier-fox`, `tier-tiger`,
`tier-lion`, `tier-gorilla`) each check `athleteTierLabel
=== <self> OR any higher tier`, so a Tiger user passes the
check for Monkey AND Fox AND Tiger simultaneously. The old
`detectNewMilestones()` returned ALL passing-and-not-yet-
achieved milestones, queueing celebrations for every step
below the user's current rank. If the user had never had a
tier milestone in their achieved list (because they reached
Tiger before the milestone system landed, or cleared
localStorage), the next session save would fire
"Reached Monkey" first — misleading.

### Fix
`detectNewMilestones()` now returns
`{ celebrate: Milestone[], silentlyAchieved: string[] }`.
When multiple tier milestones unlock in the same pass, only
the HIGHEST tier goes into `celebrate`; the rest go into
`silentlyAchieved` — the caller marks them achieved so the
badges land in the user's collection (correctly — they HAVE
earned the right to be called Monkey/Fox since they're
Tiger), but no popups fire for the intermediate ranks. Next
session for the @maaiz scenario surfaces "Reached Tiger"
correctly, and Monkey+Fox quietly join the badge gallery.

Non-tier milestones (consistency, strength, behaviour,
anniversary) keep the all-fire-at-once behaviour as before
— it makes sense to celebrate "First PR" and "10 sessions"
in the same overlay queue.

### Existing badges left intact
Users who already received the misleading "Reached Monkey"
keep that achievement in their list — they earned the badge
on merit (being at or above Monkey tier), it was just the
popup label that was wrong. No backfill needed.

---

## Feat · 2026-05-22 — Varied core exercise per day in every generated plan (qa: plan-rebuild)

@maaiz: "Want variations of core exercises in a routine being
built — different core variations on different days at least."
Previously the default WORKOUT_DATA put 'Hanging Leg Raises'
on every single day, and the plan generator didn't add any
core finisher at all to push/pull/leg days. So a user with a
generated 5-day split saw zero dedicated core; a user on the
default fallback plan did 5×HLR per week.

### planGenerator now adds a rotating core finisher
After all day-builders run (push/pull/leg/upper/lower/cardio),
the generator walks each planDay and — if it doesn't already
carry a core-primary exercise — appends one from an
11-exercise pool:

`hanging-leg-raise → cable-crunch → plank → russian-twist →
bicycle-crunch → v-ups → ab-rollout → dead-bug → side-plank →
leg-raises → bird-dog`

A single shared `coreUsed` set across days ensures no
duplicates until the pool is exhausted. Each pick respects
the user's equipment + level via the existing `pickExercise`
filters (e.g. no-bar users skip HLR, no-cable users skip
cable crunch). Movement patterns intentionally rotate
between hip flexion, anti-extension, rotation, and loaded
flexion so the user hits the whole core anatomically across
the week, not just one slice.

Rep schemes auto-pick per exercise: isometrics get
`30-45 sec`, advanced hip-flexion movements get `10-12`,
everything else `15-20`. Rest = 45s, sets = 3.

### Default WORKOUT_DATA finishers also varied
For users still on the seed plan (haven't completed profile),
the 5 default days now end with 5 distinct exercises:

- Push Heavy (a7): Hanging Leg Raises (kept canonical)
- Pull Width (b8): Cable Crunch
- Legs (c7): Plank (45 sec hold)
- Push Volume (d7): Russian Twists
- Pull Thickness (e7): Bicycle Crunches

`lib/exerciseImages.ts` `b8`/`c7`/`d7`/`e7` mappings
repointed to `Cable_Crunch` / `Plank` / `Russian_Twist` /
`Air_Bike` so the FORM modal animations still match the
exercise name (verified all four resolve 200 from
free-exercise-db).

---

## Fix · 2026-05-22 — Real form demos for 13 of 22 stretches + plan for the rest (qa: workout-warmup)

@maaiz: "Surely we can have the stretch and warm up/down
forms." Up until now the FORM modal for any stretch fell
straight through to the decorative chained-circles icon and
"NO FORM DEMO" text. Audited the open-source
free-exercise-db catalogue and mapped 13 of our 22 stretches
straight onto real demo photos:

- **Warmups → free-exercise-db model id**
  - `wu-treadmill` → `Jogging_Treadmill`
  - `wu-rower` → `Rowing_Stationary`
  - `wu-bike` → `Bicycling_Stationary`
  - `wu-arm-circles` → `Arm_Circles`
  - `wu-band-pullapart` → `Band_Pull_Apart`
  - `wu-hip-openers` → `Worlds_Greatest_Stretch`
  - `wu-cat-cow` → `Cat_Stretch`
  - `wu-bw-squat` → `Bodyweight_Squat`
  - `wu-inchworm` → `Inchworm`
- **Cooldowns / stretches → free-exercise-db model id**
  - `cd-childs-pose` → `Childs_Pose`
  - `cd-quad-standing` → `Quad_Stretch`
  - `cd-calf-wall` → `Calf_Stretch_Hands_Against_Wall`
  - `cd-tri-overhead` → `Triceps_Stretch`
  - `cd-bicep-wall` → `Standing_Biceps_Stretch`
  - `cd-cat-cow` → `Cat_Stretch`
  - `cd-shoulder-cross` → `Shoulder_Stretch`

### The 9 stretches with no good match in any open library
- `cd-chest-doorway` Doorway Chest Stretch
- `cd-pigeon` Pigeon Pose
- `cd-hamstring-lay` Lying Hamstring Stretch
- `cd-lat-stretch` Overhead Lat Stretch
- `cd-glute-pretzel` Figure-Four Stretch
- `wu-leg-swings` Leg Swings
- `wu-scap-shrugs` Scap Push-Ups
- (sticking with chained-circles fallback in the interim)

For these, infrastructure now supports locally-hosted demos:
`getExerciseImageUrls()` checks a `LOCAL_STRETCH_IDS` set
first and returns `/stretches/<id>/{0,1}.jpg` when present,
so when we generate the missing demos we just drop the JPG
pair under `/public/stretches/<id>/` and register the id —
no code changes needed.

A full generation plan lives at `public/stretches/README.md`
with: required dimensions, style guide that matches
free-exercise-db's photographic look (white tank, black
shorts, black backdrop, even lighting), per-stretch start +
end pose prompts ready to paste into ChatGPT image-gen, and
fallback sources (Wikimedia, Pixabay) for anything that
can't be generated cleanly.

---

## Fix · 2026-05-22 — Tighter active workout row + name always visible (qa: workout-set-logging)

Follow-up to the earlier row de-cramp. @maaiz pointed out
that even the new layout still felt crowded — buttons stacked
across every row regardless of whether the user was actively
logging the exercise. Tightened it up:

- **Name + image + ✓ marker** stay on the top row exactly as
  before, with `wordBreak: break-word` so long names wrap to a
  second line instead of truncating.
- **All metadata + status chips merged onto ONE dim line**
  under the name: `3 × 12-15 · 40s · last 9.1kg×12 · COMPOUND
  🔻 DROP ⇄ NEED CABLE 🤕 SHOULDER ⚡ HIIT`. Saves two whole
  rows per card vs the previous "sets / last / chips on
  separate lines" layout.
- **Action buttons (FORM, EDIT, +DROP SET, +SUPERSET) hide
  when the card is collapsed.** They only appear when you've
  expanded the exercise you're actively logging. Collapsed
  cards become title + meta + set chips — a clean scannable
  list. The thumbnail still opens the FORM modal in collapsed
  mode so FORM-without-expanding isn't lost.
- Name font bumped to 15 px / weight 600 from 14 / 500 so the
  exercise title reads as the primary handle.

---

## Fix · 2026-05-22 — Active workout sessions survive a refresh (qa: workout-set-logging)

Reported by @maaiz: a user lost their session mid-workout to
what looked like a browser/PWA refresh. Investigated and
found a real bug — the old `begin()` wrote
`localStorage["ironlog-session"]` once with `log: {}` and
never updated it. As the user logged sets, the React `log`
state changed but the localStorage copy stayed empty. On
refresh the restore effect at the top of HomePage loaded the
saved session and hydrated `setLog(session.log || {})` →
empty log → progress gone.

### Fix
- New `useEffect` watches `[log, warmupSetState, sessionIP]`
  (alongside `user`, `activeDay`, `started`) and flushes the
  full state to localStorage on every change. Start time is
  read from the previous record so it never resets.
- The restore effect now also rehydrates `warmupSetState` and
  `sessionIP`, so per-set warmup/cooldown marks and intensity
  points survive the reload, not just the lifting log.
- After a restore, a brief "Session restored · N sets saved"
  banner shows above the home screen with the elapsed time
  (`Started 12 min ago`) so the user knows their progress is
  intact and the timer is running off the original start.
- Belt-and-braces: a `beforeunload` listener fires while a
  session is active, so the browser/PWA shows its native
  "Leave site?" confirm if the user accidentally hits reload
  or close. The listener is removed when the session ends.

### Why this hadn't surfaced sooner
The `edit a logged set` path (line ~5128) explicitly re-wrote
`log` into localStorage, so editing kept the saved copy in
sync. The normal `logSet` path didn't. So the bug only bit
when a refresh happened between logging and editing — easy
to miss in QA, brutal when it happens to a real user
mid-workout.

---

## Fix · 2026-05-22 — Tricep rope pushdown form image now shows the rope (qa: workout-set-logging)

Reported by @maaiz: the FORM modal for `Tricep Rope Pushdowns`
was animating the angled-bar attachment, not the rope. Same
class of bug as the cable-fly mismap below — the
free-exercise-db has a separate
`Triceps_Pushdown_-_Rope_Attachment` model. Remapped `a4` and
added rope-named overrides (`Rope Pushdown`,
`Rope Pushdowns`, `Tricep Rope Pushdown`,
`Rope Tricep Pushdown`, `Triceps Rope Pushdown`,
`Rope Triceps Pushdown`) → all now hit the rope image. Plain
`Tricep Pushdown` without "Rope" still maps to the bar image.

---

## Fix · 2026-05-22 — Active workout row de-cramped + correct cable-fly image (qa: workout-set-logging)

### Exercise row no longer truncates the name
Reported by @maaiz with a screenshot showing "Cabl..." in the
active workout view — full name was "Cable Crossover" but the
row had FORM + EDIT + + DROP SET + + SUPERSET buttons stacked
next to the title, ellipsis-ing it. Restructured the row:
- Top sub-row: 38 px image + name (now allowed to `wordBreak`
  + 1.25 line-height — can wrap to two lines if needed) + ✓
  completion marker or `TAP` hint on the right.
- Sets × reps line sits directly under the name, inside the
  same column as the title (visually grouped, not floating
  beneath the whole row).
- Status chips (`COMPOUND`, `🔻 DROP SET`, `⇄ NEED EQUIP`,
  `🤕 INJURY`, `⚡ HIIT`) collapse onto their own conditional
  row beneath — entire row hides when no chips apply, so
  simple exercises don't gain visual weight.
- Action buttons (`FORM`, `EDIT`, `+ DROP SET`, `+ SUPERSET` /
  `⟳ UNGROUP`) moved to a dedicated row at the bottom of the
  card, flex-wrap enabled, so they never compete with the
  title for horizontal space.

### Cable Flyes (Low-to-High) form preview now shows the right movement
Reported by @maaiz: the FORM DEMO modal for `Cable Flyes
(Low-to-High)` was animating a guy doing a normal mid-height
cable crossover. The free-exercise-db has both
`Cable_Crossover` (the standard depiction the modal was
showing) AND `Low_Cable_Crossover` (proper low-pulley start,
hands sweep up to chest height). Remapped:
- `a3` WORKOUT_DATA short id → `Low_Cable_Crossover`
- `NAME_OVERRIDES["Cable Flyes (Low-to-High)"]` →
  `Low_Cable_Crossover`
- Added `Low Cable Fly` / `Low Cable Flyes` aliases for
  custom-routine entries.
- `High-to-Low` and plain `Cable Flyes` keep `Cable_Crossover`
  since that's what the standard image depicts.

---

## Polish · 2026-05-21 — PB persists for full rest duration + clearer effort scale (qa: workout-set-logging)

### PB stays visible through the whole rest timer
The set-log button set a hard `setTimeout(() => setNewPBs([]),
5000)` after detecting a PB. With a long rest (e.g. 90 s) the
PB dismissed at 5 s and the user saw just the timer afterwards.
Now the manual 5-second timeout only runs when there's no rest
planned for the exercise; otherwise the existing
`rest.start(ex.rest, () => setNewPBs([]))` callback clears the
PB on rest completion. So the PB card sits at the top of the
rest overlay for the entire rest.

### Effort scale clarity (RPE chips)
The 1-10 chip row offered no in-context explanation — the
RPE/RIR meta only appeared after the user picked a value, so a
new tester had to guess what 7 vs 9 meant.
- New band-label strip above the chips: `EASY (5+ left) ·
  MODERATE (4-5) · HARD (2-3) · NEAR (1) · MAX (fail)`, each
  segment proportional to its chip count and colour-coded.
- Chips ship with a faint band-tint by default (`color1a`
  background + `color44` border) so the cool→warm gradient
  reads at a glance even before selection. Active chip flips
  to the band's full colour.
- Plain-English helper line below the chips when no value is
  picked: "Tap the number that matches how many more reps you
  could have squeezed out at the same weight. 10 = couldn't
  have done one more."
- Header reads `EFFORT — HOW HARD?` with `RIR = reps in
  reserve` shown as a hint until selection, then swaps to the
  full meta (e.g. `HARD · 3 RIR`).

---

## Fix · 2026-05-21 — Share routines reliability + per-set marking for warmups/cooldowns/stretches (qa: workout-warmup, workout-set-logging)

### Share routines — case-insensitive lookup + dedupe + clearer errors
- Username lookup now strips leading `@` and falls back to a
  case-insensitive match if the exact-lowercase lookup misses
  (catches legacy accounts that registered before the auth
  route forced lowercase).
- Dedupe: if the same routine (by name + sender) was shared
  with the same recipient in the last 7 days, the second send
  returns `{ ok: true, deduped: true }` instead of creating a
  duplicate row.
- Errors are now specific: `Routine not found`,
  `Not your routine`, `No user @x. Check the spelling.`,
  `Can't share with yourself`. The 500 catch logs to the
  server console with the prisma error.
- Trainer multi-share aggregates results across the loop —
  previously only the LAST attempt's status surfaced. Now
  reads e.g. `Sent to 3, 1 already had it, 1 failed (No user
  @x. Check the spelling.)`.

### Per-set marking for warmups / cooldowns / stretches
- `warmupDone` (per-exercise boolean) replaced with
  `warmupSetState` (per-set state: done / skipped / pending,
  keyed `${exId}-${setNum}`).
- Single-set warmups: row tap still cycles pending → done →
  skipped → pending (no behaviour change for the common
  case).
- Multi-set warmups (e.g. 2×15 band pull-aparts): tap row to
  expand; the panel shows one chip per set with the cycle
  behaviour, plus `✓ ALL DONE` / `↷ SKIP ALL` shortcuts.
- Row header shows `0/2 · TAP` instead of `TAP TO MARK DONE`
  when there are multiple sets so the count is visible
  inline.
- "Done" fade-out applies once every set has any state
  (done or skipped) — the row clears when you've actually
  triaged it, not before.

---

## Feature · 2026-05-21 — Cardio tracking (time + incline + speed) + animated stretch icons in FORM modal (qa: workout-warmup, workout-set-logging)

### Cardio tracking
Cardio machines (treadmill, bike, rower, elliptical, sprint, etc.)
used to be trackable only as weight × reps — meaningless for
duration-based work. Now:
- `logSet()` accepts an `opts.cardio` payload `{ minutes,
  incline?, speed?, distance? }`. Cardio sets store `weight: 0`,
  `reps: 0`, `cardio: true` + the fields, so volume calculations
  correctly skip them.
- `isCardioExercise(ex)` detects via `ex.type === "cardio"` OR
  name match (treadmill / bike / rower / elliptical / cardio /
  jog / run / sprint). `isTreadmillExercise(ex)` is a subset.
- The active-workout expanded panel swaps in a cardio block
  when the row is cardio: MIN + (treadmill only: INCLINE %) +
  KM/H inputs, plus `★ USE SUGGESTION` and `REPEAT LAST` chips
  for one-tap fill.
- `lastCardioSession(eid)` walks history for the most recent
  cardio set of that exercise. `suggestCardio()` proposes the
  next session: first-time defaults (treadmill: 15 min @ 2% @
  6 km/h, others: 12 min); returning users get +1 min, with a
  +1% incline bump every time minutes crosses 20.
- Session Recap (Progress > History calendar tap) and the
  per-routine Progress history both render cardio sets as
  `Nmin · X% · Ykm/h` instead of "0 reps".

### Stretch icons + animation in FORM modal
Tapping FORM on a warmup / cooldown / stretch row used to show
"NO FORM DEMO" on a flat placeholder image because the EXERCISES
library has no photos for stretches. Now:
- The two FORM modals (customise + active workout) check
  `findStretchById(formPreview.id)` first.
- If a stretch matches, render its emoji icon (already shipped
  in `lib/stretching.ts` per stretch) at 110-120 px on a
  yellow→teal radial-gradient backdrop, with a bobbing /
  scaling keyframe animation and a softly pulsing glow ring.
- Below the icon: `WARMUP · 10 each leg` (kind + reps) so the
  modal still communicates what the stretch is.
- Falls back to the existing "NO FORM DEMO" placeholder only
  for ids that aren't stretches AND have no library photo.

Reported by @maaiz — "There's no icons for warm ups cool down
and stretches. Also no animation".

---

## Fix · 2026-05-21 — Suggested Next Workout avoids back-to-back same-pattern days (qa: home-polish-v2)

User flagged: suggestion offered a Pull Day (Thickness) the day
after a Pull Day (Width). Two pull days in a row — back / biceps
get no recovery. The old picker only looked at "oldest last-done"
and ignored movement pattern.

- New `classify(day)` derives a movement pattern (push / pull /
  legs / core / cardio / mobility / mixed) from the day's
  exercise list (using `EXERCISES.primaryMuscles` +
  `secondaryMuscles`) with a title-keyword fallback. Top bucket
  wins if it's at least 40% of the muscle hits; otherwise mixed.
- Picker now checks the most recent session (today or yesterday)
  and identifies its pattern.
- Each candidate day is scored: lower = better. Older last-done
  reduces score; +200 penalty if its pattern matches the recent
  session's pattern (skips push-after-push, pull-after-pull,
  legs-after-legs). Mixed / mobility days bypass the penalty
  since they're recovery-friendly. Never-done gets a small
  preference.
- Reason copy adapts: when we deliberately skip a same-pattern
  candidate, the card reads "Push Day was last session —
  flipping muscle group so back/biceps/legs/etc can recover.
  Nd since you last did this one."

---

## Fix · 2026-05-21 — Add-day picker UX + bootstrap-collision fix (qa: home-polish-v2)

### "Couldn't add day. Try again in a moment."
The previous add-day flow seeded a freshly-bootstrapped plan with
WORKOUT_DATA's hardcoded day ids (`push1`, `pull1`, …). PlanDay.id
is a global primary key, so the second user to hit that path
collided on those ids and the API errored out with the catch-all
500. Fix: when bootstrapping, create an EMPTY WorkoutPlan and let
the new day be the only entry. The user's home grid still falls
back to WORKOUT_DATA when customPlan is empty, so nothing breaks.

Also added a guard: any `action` value that isn't `init` or
`add-day` returns 400 instead of silently falling through to the
regenerate-from-profile branch (which would wipe an existing
plan).

### "What is conditioning?" — clearer day picker
Replaced the two `window.prompt()` calls with an inline picker:
- 6 preset cards (Cardio Day, HIIT / Conditioning, Mobility /
  Recovery, Core / Abs Focus, Arms Day, Custom). Each preset
  card shows an icon + title + 1-line description so the
  meaning is obvious.
- Tapping a preset auto-fills the title + focus inputs (which
  the user can still edit). "Custom" leaves both blank.
- Title / Focus inputs sit below the presets. Cancel / ADD DAY
  buttons at the bottom; ADD DAY is disabled until there's a
  non-empty title.
- Inline error banner shows the server's exact reason if the
  request fails (instead of an empty alert).

---

## Fix · 2026-05-21 — Customise screen + leaderboard error + add-day affordance (qa: home-polish-v2, qa-dashboard, tier-pills-clarity)

### Customise — default-plan users couldn't edit
The customise view's day list was iterating `customPlan ?? []`, so
users on the default `WORKOUT_DATA` plan (no `customPlan` set yet)
saw "No plan yet — complete the questionnaire first" even though
their home grid was clearly populated.
- Fall back to mapping `WORKOUT_DATA` into the customPlan shape
  when the user has no custom plan, so all days are visible and
  tappable. Editing a default day persists to a new custom plan
  on save (existing PUT flow).

### Add a manual session day
New `+ ADD DAY (CARDIO / MOBILITY / CUSTOM)` button at the
bottom of the customise day list. Prompts for title + focus
text, hits a new `/api/plan POST { action: "add-day" }`
endpoint, then opens the new (empty) day in the per-day editor
so the user can add exercises immediately. The server-side
add-day bootstraps a workout plan from `WORKOUT_DATA` first if
the user has none yet, so the new day persists no matter what.

### Leaderboard render crash
The `/api/leaderboard/mine` route now ships canonical
`stats.tier` as an OBJECT (`CanonicalTier`), but one leaderboard
row render still rendered `{entry.tier}` directly as text —
React threw "Objects are not valid as a React child" and the
whole leaderboard pane errored. Switched the render to
`{entry.tier?.icon} {entry.tier?.label}` (with Kitten
fallbacks).

---

## Feature · 2026-05-21 — Suggested Next Workout card on home (qa: home-polish-v2)

New `▶ SUGGESTED NEXT` card above the YOUR SPLIT grid that picks
the day the user should do next based on their history:
- Newest log per day id is computed from `history`.
- Days are ranked by oldest last-done (never-done = empty string,
  which sorts first), tie-broken by plan order.
- The top-ranked day is surfaced as a card showing the day label,
  title, and a one-liner reason — "Brand new — start here" for
  first-time users, "Never logged this day" for partial logs, or
  "Last done N days ago — the most overdue day in your plan" for
  regular returning users.
- One-tap START button that calls `openDay()` + `begin()`, skipping
  the prep screen (same flow as the day-card START on the grid).
- Hero auto-size constant adjusted (+84 px) so the card doesn't
  push the last grid row below the bottom UI when scrolled to top.

---

## Fix · 2026-05-21 — Volume × Muscle scales bodyweight by movement load coefficient (qa: progress-volume-heatmap)

Crediting full bodyweight for every bodyweight rep was wildly over-
counting — a push-up moves the upper-body portion (~65%), not your
whole mass; a hanging leg raise moves the legs (~40%).

- New `BW_LOAD_PCT` table in `lib/performance.ts` with per-exercise
  coefficients drawn from rough sports-science approximations
  (push-up 0.65, decline push-up 0.75, pull-up/dip 1.0, inverted
  row 0.55, bodyweight squat 0.75, lunge 0.75, hanging leg raise
  0.4, crunch 0.15, bicycle crunch 0.2, mountain climber 0.3,
  burpee 0.7, plank 0, …).
- New exported helper `bodyweightLoadPct(exId, exName)` — tries
  the id-keyed table first, then a name-based fuzzy match so
  default-plan short ids like `a7` (Hanging Leg Raises) resolve
  to 0.4 via the name lookup. Conservative 0.5 default for
  unknown bodyweight movements.
- `volumeByMuscle` now takes an optional `exerciseNames: Record<
  string, string>` map and scales rawWeight=0 sets by
  `bodyweightKg × bodyweightLoadPct(...)`. VolumeHeatmap builds
  the name map alongside the muscle map and passes both.

So 3×15 hanging leg raises at 80 kg bodyweight now credit core
with `15 × (80 × 0.4) × 3 = 1,440 kg-reps` (instead of 3,600 with
the prior naive 100% credit, or 0 with the original silent skip).

---

## Feature · 2026-05-21 — Trainer ⇄ Client Stats tab + form previews on warmups/cooldowns/stretches (qa: tier-trainer-keeps-athlete, workout-warmup, settings-identity-tiers)

### Trainer client view — new STATS tab
Trainers used to only see SPLIT / HISTORY / PROFILE for each
client. Zero graphs, zero summary metrics — they had to scroll
session history to gauge anything. New STATS tab (default landing
tab) surfaces what they actually need:
- Headline canonical athlete tier (icon + label + score) — same
  one the client sees on their own dashboard, server-side via
  `computeStatsForUsers`.
- Stat tiles: sessions / streak / this-week count / avg time
  (with green/amber/red against the client's `targetSessionMinutes`).
- 28-day activity strip (one cell per day, intensity-coloured).
- **Volume × Muscle heatmap** — reuses the existing component
  with the client's plan + bodyweight, so the trainer sees
  identical numbers to the client.
- Top 6 PRs with date.
- Body metrics inline trend: weight + body-fat % line plots with
  start → end labels and signed delta.
- Empty-state when the client hasn't logged anything yet.

Schema / API:
- `/api/trainer/clients/[clientId]` now ships
  `bodyMetrics[]` + canonical `stats.tier` (via
  `computeStatsForUsers`) so the frontend has everything it
  needs in a single round-trip.

### Form previews on warmups / cooldowns / stretches
The `FORM` button + thumbnail tap on stretch rows already
existed, but tapping opened a modal with generic cues + no
muscles because:
- `getFormCues()` only looked in `lib/formCues.ts`, missing the
  inline `cues[]` arrays in `lib/stretching.ts`.
- `lookupExMuscles()` only looked in the main `EXERCISES`
  library, missing stretch `primaryMuscles`.

Fix:
- `getFormCues()` now falls back to `findStretchById()` by id
  AND scans `ALL_WARMUPS + ALL_COOLDOWNS` by normalised name.
- `lookupExMuscles()` does the same. So tapping FORM on
  "Cat-Cow" or "Doorway Chest Stretch" now shows the actual
  cues and target muscles instead of the generic fallback.

---

## QA fixes · 2026-05-21 — Soreness history + Volume × Muscle bodyweight credit + Target session time editor (qa: progress-volume-heatmap, onboarding-profile-setup, settings-identity-tiers)

### Soreness table — remembers + shows trend
The soreness table was an opt-in 1–5 picker per muscle that looked
empty after every reload AND offered no view of whether soreness
was creeping up or down for a muscle over time.
- Already remembered today's pick in localStorage (`ironlog-soreness-v1`)
  — confirmed it now hydrates on mount so today's rating shows on refresh.
- Each muscle row now renders a 14-day sparkline (mini bars, height
  scales with rating, colour by heat band) to the LEFT of the
  rating buttons.
- A trend chip next to the sparkline shows the delta vs the last
  logged entry (`↑n` red, `↓n` green, `=` muted). Tooltip on the
  chip surfaces the previous logging date + rating.
- Added two helpers in `lib/wellness.ts`:
  `readSorenessHistory(muscle, days)` and `readSorenessLast(muscle)`.

### Volume × Muscle — Core stops reading "skipped" for bodyweight work
Hanging Leg Raises (and other bodyweight movements) were logged
with `weight: 0`, so `0 × reps = 0` volume — core / abs surfaces
read "skipped" even after weeks of training.
- `volumeByMuscle()` in `lib/performance.ts` now takes a
  `bodyweightKg` arg. When a set has zero weight but positive
  reps it falls back to `max(1, bodyweightKg || 70)` so the
  movement contributes. The VolumeHeatmap passes the user's
  `ob.weightKg` (defaults to 70 kg if missing).

### Target session time — editable post-onboarding + actual vs goal
Onboarding step 8 already collects a target duration (30/45/60/90+)
but there was no way to change it afterwards, and nothing surfaced
how the user's actual avg time compared to that goal.
- New `⏱ TARGET SESSION TIME` card in Settings → TRAINING (above
  the HIIT card). Same chip row as onboarding; tapping a chip
  saves immediately via `POST /api/profile`.
- Live actual-vs-target readout below the chips: `Your avg m /
  target m (+N over | -N under | on target)` with a coloured
  progress bar (green ≤ 5 m over, amber ≤ 15 m over, red beyond).
- Empty-state copy when no completed sessions yet.
- Footnote flags that plan-tailoring (auto supersets / drop sets
  / HIIT for tight windows) is the next slice.

---

## Polish · 2026-05-21 — Welcome card split into separate profile + tiers boxes (qa: tier-pills-clarity)

The hero welcome card was a single button (avatar + name + tier
pills inside, plus a chevron) — but the inner tier pills became
clickable in a recent slice, which gave us a button-within-button
that only worked because of `stopPropagation`. Confusing tap
target.

- Split into **two side-by-side boxes**, each its own clear tap
  target. flexWrap so they stack on very narrow phones.
- **LEFT (profile)** — avatar + username + role chip (ADMIN /
  TRAINER / ATHLETE / REVIEWING) + chevron → opens profile.
- **RIGHT (tiers)** — trainer + athlete tier mini-cards with
  gradient progress bars and "+N → NEXT" remaining-points
  readouts → opens TierInfoModal.
- Inner tier rows are now presentational divs (parent button
  handles the tap), removing the nested-button accessibility
  smell.

---

## Feature · 2026-05-21 — /qa Dashboard Metrics + open-/qa overlay from the floating pill (qa: qa-dashboard, quick-feedback-fab)

### Dashboard Metrics card
New `📊 DASHBOARD METRICS` card at the top of /qa (above the
leaderboard, hidden during searches). At-a-glance health view:
- Segmented status progress bar (passing / retest / failing /
  untested) with raw counts beneath each colour
- Three headline cards: % passing (big number + `cP/total`),
  open items (untested + retest + failing), pending comments
  (with "N ppl" indicator showing how many testers have
  unprocessed asks)
- Activity strip: comment counts for today / last 7d / last
  30d / all-time
- HEALTH BY AREA mini-bars sorted worst-first — instantly
  visible which area is the hotspot

Status colours align with the rest of /qa
(passing → #4caf50, retest → #FFB74D, failing → #FF6B6B,
untested → grey).

### QA dashboard overlay from the floating 💬 NOTE pill
The expanded Quick Note form now has a `🥋 VIEW FULL QA
DASHBOARD →` action that opens /qa in a fullscreen iframe
overlay (z-index 9700, sits above page content). Testers can
browse the backlog, search comments, and even post replies
without losing their place in the active app screen they were
testing. Close button × in the top-right; close also dismisses
the FAB sheet beneath.

---

## Polish · 2026-05-21 — /qa items sorted by status priority within each area (qa: qa-dashboard)

Items within each area group now order by what's most actionable:
**UNTESTED → PATCHED · RETEST → FAILING → PASSING**. Secondary
sort within a bucket is most-recently-tested-first so freshly-
patched retests bubble to the top. Area headers stay so context
isn't lost. Matches the tester's mental model — "show me what
needs a first pass, then what to verify after my patches, then
the bugs (which should be empty after a QA pass), then the
confirmed-working stuff at the bottom".

---

## Fix · 2026-05-21 — Catch-all submissions visible on /qa + processed comments stop reading "FAILING" (qa: qa-dashboard, quick-feedback-fab)

### Two gaps the user flagged
1. Submissions from the floating 💬 NOTE pill and the Settings → SEND
   FEEDBACK card both POST with `itemId: "user-feedback"`, but
   there's no item with that id in `qa-state.json` — so on `/qa`
   they landed in a black hole. Testers couldn't see whether
   their drive-by notes were attended or still pending.
2. `effectiveStatus(item, comments)` just returned the latest
   comment's status verbatim. After Claude shipped a fix and
   marked the comment processed, the badge kept reading
   "FAILING" forever — no visible indication that it had been
   attended pending re-test.

### Fix
- New synthetic `USER_FEEDBACK_ITEM` rendered alongside General
  Notes at the top of /qa (GENERAL section, before the regular
  area groups). Every pill / SEND FEEDBACK submission shows up
  here with the same threaded UI as other items — date, tester
  @handle, status badge, screenshot link, processed ✓ tick.
- Rewrote `effectiveStatus`:
  - Any UNPROCESSED comment still drives the badge (so unaddressed
    reports surface as actionable).
  - Once all comments are processed, latest failing or retest →
    `regression-retest` (= "PATCHED · RETEST"), passing stays
    passing, untested stays untested. So a fixed-and-marked
    issue reads "PATCHED · RETEST" instead of a stale "FAILING".
- The dashboard's "N FAILING / N RETEST / N TO PROCESS" chips
  reflect the new logic — once Claude processes a batch, the
  FAILING count drops and the RETEST count grows.

---

## QA pass · 2026-05-21 — Process 14 unactioned comments (qa: auth-register, auth-login, auth-must-reset, onboarding-profile-setup, workout-warmup, qa-dashboard, quick-feedback-fab, tier-pills-clarity, tier-info-modal, settings-identity-tiers, progress-volume-heatmap)

@Amanii's 4 comments + @maaiz's 10 comments (including 2 submitted
mid-pass) all addressed in a single batch.

### Auth — @Amanii
- **auth-register** DOB box overflow on iOS Safari. Stripped
  WebkitAppearance, added `minWidth: 0` + `maxWidth: 100%` so the
  native date picker chrome can't push the input past its form
  column. Same treatment applied to the Settings → edit profile
  DOB so it sits flush with the Height field above.
- **auth-login** Passing — status flipped.
- **auth-login** /qa: passing comments no longer require a note.
  The textarea label switches to "(optional)" and SAVE enables
  without a body when status=passing. Failing / retest / untested
  still require a note (the note is what makes them actionable).
- **auth-must-reset** Admin force-reset now generates a TEMP
  password (via `lib/crypto.generateTempPassword`), hashes + saves
  it, and returns the plaintext to the admin UI (auto-copied to
  clipboard + shown in the alert). Previously it ONLY flipped
  `mustResetPassword: true`, so users who'd forgotten their old
  password were locked out entirely — the reset prompt never had a
  chance to fire.

### /qa dashboard — @maaiz
- **Sticky search**: the search box now stays pinned to the top of
  the viewport while the backlog scrolls. Backdrop-blur so items
  behind it don't smear.
- **Clearer retest status**: the badge label is "PATCHED · RETEST"
  (was "RETEST"); the comment form option reads "Patched · please
  retest". Spells out that the state means "attended, awaiting
  re-verification" instead of vague "needs another look".
- **Title wrapping**: long /qa item titles like "Trainers see
  their athlete tier on Progress dashboard too" now wrap with
  `word-break: break-word` instead of being ellipsis-clipped on
  narrow phones.
- **Per-step comments**: deferred to next slice — currently each
  test gets one thread; per-step needs a richer comment schema +
  thread grouping.

### Onboarding — @maaiz · Slice 1/2
- Added a **target session duration** chip row to step 8 (30m /
  45m / 60m / 90m+, defaulting to 45m "Standard"). Persisted via
  new `UserProfile.targetSessionMinutes` (Int, nullable, Prisma
  schema gain). Rebuild-from-Settings flow preselects the saved
  value. Slice 2 (next pass): planGenerator reads the field and
  tailors the workout — tighter windows favour supersets / drop
  sets / HIIT finishers; longer windows allow more isolation work.

### Welcome card · Profile — @maaiz
- **Tier pills with mini progress bars**: the Trainer + Athlete
  pills are now on their own row beneath the username, each a
  small card with a gradient progress bar and a "+N → NEXT"
  remaining-points readout (or "★ TOP" at max). flexWrap so they
  sit side-by-side on most phones and stack on very narrow ones.
- **"Member since registration"** → computed duration from
  `User.createdAt`: "Member for Xd / Xmo / Xy [Xmo]" or "Joined
  today" for brand-new users.
- **DOB alignment** in Settings → edit profile — same iOS Safari
  fix as the onboarding DOB.

### TierInfoModal — @maaiz
- Added a **"⚡ HOW TO EARN ATHLETE POINTS"** section listing each
  of the 5 sub-ranks (Consistency, Strength, Volume, Mastery,
  Habits) with what feeds it AND the rough input that gets it to
  ~80. Plus a footnote explaining the diminishing-returns curve
  so the "+N PTS → next" number reads correctly.

### Quick Note pill — @maaiz
- **Removed the ✓ WORKS chip**: the floating pill is for issue
  reports only (bug / idea). To mark something as ✓ working,
  testers use the full /qa dashboard.
- Tutorial step (`qa-feedback`) rewritten to match; tutorial
  version bumped to v3 so existing users see the updated copy.

### Workout — @maaiz
- **Single START prompt**: tapping ▶ START WORKOUT on the
  expanded day card now calls `openDay()` AND `begin()` so the
  workout-prep middle screen never appears. One intent, one tap.
- **Form previews on warmups/cooldowns + treadmill incline %**:
  deferred IDEA. Logged for next pass.

### Volume × Muscle — @maaiz
- "Core skipped" despite hanging leg raises was already addressed
  in commit `0e6722c` (default-plan short ids like `a7` for
  Hanging Leg Raises now resolve via `lookupExMuscles(name)`,
  fuzzy-matching to the library's `hanging-leg-raise` entry
  whose primaryMuscles is `["core"]`). Volume on those sessions
  now credits core correctly.

### Status flips in qa-state.json
- `auth-login` regression-retest → **passing**
- `auth-register` notes appended (DOB fix)
- `auth-must-reset` notes appended (temp password flow), still
  regression-retest until tester verifies
- `onboarding-profile-setup` notes appended (slice 1 target
  duration), still regression-retest until tester verifies
- `tier-pills-clarity` notes appended (slice 3 progress bars)

### Deferred to next pass
- Onboarding **slice 2**: planGenerator consumes
  `targetSessionMinutes` to scale the workout.
- /qa **per-step comments** + per-step thread schema.
- Workout: **form previews** on warmup / cooldown / stretches +
  treadmill incline % handling.

---

## Polish · 2026-05-21 — Volume × Muscle no-credit bug + dead-tier cleanup (qa: progress-volume-heatmap)

### Volume × Muscle: every muscle was "skipped"
On the default plan the heatmap on Progress → Dashboard rendered
every muscle as `skipped` even after multiple sessions. Root
cause: `lib/workouts.ts` (`WORKOUT_DATA`) uses short two-char
exercise ids like `b1`, `b3`, `a7` — but the heatmap's
`muscleMap` was built only from the `EXERCISES` library (which
uses real ids like `barbell-bench-press`). The id lookup just
silently returned `[]` for every default-plan set so no muscle
got credited.

Fix: the `muscleMap` now layers three sources, in order, and
short-circuits as soon as it finds primaryMuscles for an id:
  1. EXERCISES library entries by id.
  2. WORKOUT_DATA short ids → resolved via `lookupExMuscles(name)`
     (normalised name match into the library).
  3. customPlan exercises by exerciseId → prefer their own
     `primaryMuscles` field, fall back to name lookup.

### Dead-code cleanup
Removed the legacy `CLIENT_TIERS` + `getClientTier` exports
that nothing imports anymore (every surface now reads from
`lib/tiers.ts::computeAthleteTier`). Also removed the
`lib/leaderboardStats.ts::CLIENT_TIERS` + `getTier` exports for
the same reason — the canonical tier is now baked into every
row's `stats.tier` field server-side.

### Misc
- Removed a stale `dayLabels` declaration left over after the
  Dashboard 28-day calendar was consolidated into the History
  tab.
- Verified `next build` runs clean.

---

## Fix · 2026-05-21 — Server-side canonical tier on every leaderboard row (qa: tier-pills-clarity)

### Background
After the previous slice unified the visitor's OWN tier across all
surfaces, other users' rows on group + trainer leaderboards were
still approximate: the frontend recomputed `computeAthleteTier`
with `distinctExercises = monthsOnApp = 0` because the API didn't
ship those fields.

### Fix
- `lib/leaderboardStats.ts::computeStatsFromLogs` now walks every
  logged set once to collect PR count + total volume + distinct
  exercises in a single pass (previously distinct-exercises was
  computed only on the visitor's machine).
- `computeStatsForUsers` additionally fetches each user's
  `User.createdAt` to derive `monthsOnApp`, then calls
  `computeAthleteTier` to bake a `CanonicalTier` object onto every
  row: `{ label, icon, color, bg, border, min, score, idx }`.
- The trainer's clients leaderboard route now uses
  `computeStatsForUsers` (was its own ad-hoc loop) so it gets the
  same canonical tier for free.
- The user-facing group leaderboard route stops shadowing the
  canonical tier with a legacy session-count string — the spread
  of `stats` carries the tier object through.
- Frontend reads `m.tier` / `c.tier` directly instead of
  recomputing client-side. Visitor's own row still overrides with
  the local breakdown (only place wellness data can join in,
  since hydration/sleep/energy live in localStorage).

### Known limitation
Wellness data is still localStorage-only, so OTHER users' rows
can sit one rung below their own dashboard view (specifically when
their dashboard's Habits sub-rank is high). All surfaces now agree
on the same LADDER, threshold formula, and labels — so a "your
Tiger is their Tiger" feel is consistent, even if the absolute
score may differ slightly per row.

---

## Fix · 2026-05-21 — Unify athlete tier across welcome card, Settings, leaderboards, modal (qa: tier-pills-clarity)

### Background
Two athlete-tier ladders coexisted. The Progress dashboard tier card
used the canonical `computeAthleteTier` from `lib/tiers.ts` (a 0–100
composite score with thresholds Kitten 0 / Monkey 15 / Fox 30 /
Tiger 50 / Lion 70 / Gorilla 90). Everywhere else — welcome card
pill, Settings IDENTITY card, TierInfoModal, group leaderboards,
trainer's clients leaderboard — used the legacy session-count
ladder in `page.tsx::CLIENT_TIERS` (5/15/30/60/100 sessions). The
user saw "MONKEY" in their group leaderboard but "TIGER" on
Progress, with no explanation.

### Fix
- Hoisted the canonical breakdown to a HomePage `useMemo`
  (`myAthleteBreakdown`) computed once from full local stats
  (totalSessions, streak, totalVolumeKg, prCount, distinctExercises,
  monthsOnApp, hydration/sleep/energy days).
- Welcome card pill, Settings IDENTITY pill, and the TierInfoModal
  now read from `myAthleteBreakdown.headline` so all three match
  the Progress dashboard tier.
- TierInfoModal switched from `CLIENT_TIERS` to a `ATHLETE_TIERS_LITE`
  adapter (lib/tiers.ts `AnimalTier` mapped to local `TierLite`
  shape) — same labels, score-based thresholds, progress bar
  driven by `headlineScore`.
- Group leaderboard rows: visitor's row uses `myAthleteBreakdown`
  directly; other rows call `computeAthleteTier` with the stats the
  API ships (totalSessions / streak / prCount / totalVolume) and
  zero-defaults for wellness / distinctExercises / monthsOnApp.
  Other rows are slightly under-counted vs their own dashboards but
  read from the same score LADDER, so labels are consistent across
  surfaces.
- Trainer's clients leaderboard: same `computeAthleteTier`
  treatment.
- Fixed the rogue "· COACH" suffix on trainer rows in the group
  leaderboard — "COACH" is a TIER name (Rookie/Coach/Pro/Elite),
  so appending it to an athlete-tier row was nonsense. Now reads
  "· TRAINER" (the role) when the row belongs to a trainer.
- Dropped the "1 PT = 1 SESSION" footnote inside TierInfoModal for
  ladders whose unit is already "pts" (athlete ladder) — was reading
  "1 PT = 1 PT". Kept on the trainer ladder where "1 PT = 1
  CLIENT" is the right semantic.

### Known limitation, deferred
Other users' rows still under-count because the leaderboard API
doesn't ship wellness / distinctExercises / monthsOnApp. Next
slice: enhance `lib/leaderboardStats.ts` to compute and return a
canonical tier label per user so the frontend can render it
verbatim.

---

## Polish · 2026-05-21 — Tier modal progress bars + globally-mounted floating note pill (qa: tier-info-modal, quick-feedback-fab)

### Why
Two QA notes:
1. The floating 💬 NOTE pill wasn't visible on home, settings, or any
   other major view — only on conversation. Root cause: HomePage has
   8+ view branches that each early-return their own JSX, bypassing
   the fall-through render where the FAB was mounted.
2. The TierInfoModal showed thresholds but no visual progress — users
   couldn't see at a glance how far they were from the next tier.

### Fixed — Quick Note pill visibility
- Refactored FAB + TierInfoModal mounting to use a SEPARATE React
  root attached to `<div id="ironlog-overlay-root">` on
  `document.body`, kept in sync via two effects at the top of
  HomePage. Effects fire regardless of which view branch
  ultimately returns. Container creation is idempotent so React
  18 Strict Mode's dev-only double-invoke doesn't leak elements;
  cleanup defers the unmount one tick to avoid racing the
  remount.
- Bundled FAB + TierInfoModal into a new `HomeGlobals` component
  for reuse.

### Added — tier-modal progress bars
- Each ladder row in TierInfoModal now reads the user's RAW count
  for that ladder (sessions for athlete, clients for trainer).
  On the user's CURRENT tier row, a progress bar renders below
  the tier name showing `<current> / <next-min> <unit>` on the
  left and `<remaining> TO <next-tier-name> <emoji>` on the
  right, with a gradient-filled bar between (current-tier colour
  → next-tier colour).
- At the top tier the bar is replaced with "★ TOP OF THE LADDER ·
  <count> <unit>".
- The YOU chip on the highlighted row also gains the raw count
  ("YOU · 12") so it's a useful summary at a glance.

### QA tracking
- Extended `tier-info-modal` test plan to include the progress bar
  and max-tier behaviour. Status flipped back to
  regression-retest.

---

## Feature · 2026-05-21 — Home declutter v3 + Profile split from Settings (qa: home-polish-v2, profile-settings-split)

### Background
User feedback on the home view: "Reorganise, a lot of overlays
and profile tab wasting space." On a 5-day plan the welcome
card + hero + tagline + Pro Tip card + YOUR SPLIT label
combined left the 5th day card half-cut at the bottom of the
viewport. The welcome card alone took ~150px (avatar + WELCOME
BACK label + big name + two rows of tier pills with `· TIER
N/M` suffixes). Pro Tip was another ~140px padded card.

User also asked for the "profile" to be conceptually separate
from "settings" — theme/notifications/feedback are app-level
concerns, while identity/training/body data are about the
user.

### Home declutter (qa: home-polish-v2)
- **Hero 200 → 150px** with brighter gradient.
- **Welcome chip compressed**: single horizontal row — avatar
  (38→32px) · name · inline tier pills · `›`. Dropped the
  "WELCOME BACK" overhead label entirely (redundant). Tier
  pills now show `emoji + LABEL` (e.g. `🎯 COACH`, `🐒 MONKEY`)
  with no "TIER N/M" suffix — the explainer modal carries the
  full breakdown so the chip stays tiny.
- **Tagline shrunk**: 18→15px, italic phrase 16→12px, moved
  deeper into the hero.
- **Pro Tip card → slim chip**: single-row chip (icon · PRO TIP
  label · truncated text · ›). Taps open a bottom-sheet modal
  with full body, source citation, and a HIDE FOR TODAY button.
  Saves ~120px of vertical real-estate on home.

### Profile / Settings split (qa: profile-settings-split)
- Introduced a new view value `"profile"` distinct from
  `"settings"`. The welcome chip and ProfileNagBanner now route
  to `"profile"`.
- Same render block, conditional sections:
  - **PROFILE view**: YOUR PROFILE (identity, roles, tiers,
    body metrics, photos) + TRAINING (HIIT prefs, trainer
    upgrade).
  - **SETTINGS view**: APP PREFERENCES (theme), ALERTS
    (notifications), FEEDBACK & QA, LIBRARY & SYSTEM (export,
    log out, app version).
- Header label switches PROFILE ↔ SETTINGS. A small top-right
  button (`⚙ SETTINGS` / `👤 PROFILE`) toggles between the two
  surfaces so users can hop without going back to home.
- Swipe-back gesture supports both views.

---

## Feature · 2026-05-21 — Tier clarity: COACH is unmistakably a TIER + both ladders visible (qa: tier-pills-clarity, tier-info-modal, settings-identity-tiers)

### Background
User feedback flagged that the welcome card pill `🎯 COACH · TRAINER`
was ambiguous: is COACH a role, a separate title, or a tier? There
was also no surface anywhere in the app that explained the tier
system, listed the other tiers that exist, or let a trainer see
their own athlete tier alongside their trainer tier.

### Added
- **`TierInfoModal`** — bottom-sheet that explains the tier system
  with one declarative line ("Coach is a tier of trainers, not a
  separate role") and renders BOTH ladders in full: athlete (Kitten →
  Gorilla, 6 tiers) and trainer (Rookie → Elite, 4 tiers). Each row
  shows the threshold for that tier. The visitor's current tier row
  on each ladder they participate in is highlighted with the tier
  colour + a "YOU" chip. Ladders the visitor isn't on are still
  rendered but tagged "NOT ACTIVE FOR YOU".
- **`TierLadder`** — reusable presentational component used inside
  the modal.

### Changed — welcome card pills
- Split the cramped single pill `🎯 COACH · TRAINER` into a clearer
  row of separate badges. Role labels (ADMIN, TRAINER, ATHLETE) come
  first as small monospace chips; tier badges come after as tappable
  pills with explicit `· TIER N/M` suffixes (e.g. `🎯 COACH · TIER
  2/4`). Each tier pill carries a ⓘ glyph and opens the new
  TierInfoModal on tap (via stopPropagation so the parent welcome
  card button doesn't simultaneously navigate to Settings).
- **For trainers, BOTH ladders are now visible in the pill row**:
  their trainer tier AND their athlete tier — so a coaching user
  can see their full standing at a glance, addressing the explicit
  "make their athlete tier visible right there too" feedback.

### Changed — Settings IDENTITY card
- Reworked the IDENTITY card under YOUR PROFILE to mirror the
  welcome-card pill layout: a "ROLE" labelled row of role badges,
  then a "TIERS" labelled row with both tier pills using the
  long-form `· TRAINER TIER N/M` / `· ATHLETE TIER N/M` suffix
  for absolute clarity.
- Added a dashed "🏆 HOW TIERS WORK — SEE BOTH LADDERS →" button
  that opens the same TierInfoModal so Settings has a discoverable
  entry point too.

### QA tracking
- Added three items: `tier-pills-clarity` (welcome card),
  `tier-info-modal` (the explainer modal), `settings-identity-tiers`
  (Settings IDENTITY card). All in `regression-retest`.

### Next slices (not in this pass)
- A standalone TRAINER tier card on Progress → Dashboard mirroring
  the existing athlete tier card (with the 4 sub-rank bars from
  `computeTrainerTier`). Currently only the athlete card lives
  there; trainers can see the full breakdown for athletes but only
  a headline for themselves.
- Wire the modal's "YOU" rows to deep-link into Progress →
  Dashboard so users can jump from explainer to per-stat detail.

---

## Feature · 2026-05-21 — Group shared workout Slice 2/N: trainer + member UI (qa: group-shared-workout)

### Added
- **Trainer 🏋 SHARED WORKOUT panel** inside each active group's
  management modal (Leaderboard tab). When no workout is set: tap
  `+ SET GROUP WORKOUT` → name/description form → SET pushes the
  trainer's current `customPlan` as the routine. When one is set:
  shows `↺ SYNC TO MY PLAN` (re-push the trainer's current plan,
  useful for updates) and `REMOVE` (DELETE — past tagged WorkoutLogs
  keep null groupWorkoutId via FK SetNull, so user history stays
  intact, they just stop counting in the filtered leaderboard).
- **Pre-fetch on group panel open** — opening any group's manage
  panel hits GET /api/leaderboard/groups/[id]/workout once and caches
  the response so the SET vs EDIT state is correct without an extra
  tap.
- **Member 🏋 GROUP ROUTINE banner** on My Leaderboards card —
  shown only for groups that have a workout. APPLY button (or
  ✓ APPLIED · LEAVE if already activated) wired to POST/DELETE
  /api/leaderboard/groups/[id]/workout/apply.
- **ALL SESSIONS / 🏋 GROUP ONLY toggle** per group leaderboard
  card. When 🏋 GROUP ONLY is on, only members with an activated
  subscription appear, and the sessions/IP columns show
  `groupSessions`/`groupIntensity` (sessions tagged with that
  group's workout via /api/workout POST).

### Files
- `app/page.tsx` — added 7 new state slots
  (openGroupWorkoutId, groupWorkoutCache, groupWorkoutLoading,
  groupWorkoutSaving, groupWorkoutName, groupWorkoutDesc,
  lbGroupOnly); trainer SET WORKOUT panel; member APPLY banner;
  filter toggle + sessions cell swap.

### Next slice (3/N)
- Render the group workout's days alongside the personal plan on
  Home with a ▣ GROUP badge.
- Tag the WorkoutLog with `groupWorkoutId` at session save when
  the active day belongs to an activated group workout.

---

## QA-design review · 2026-05-21 — Micro-testing + commenting along the way + Settings reorg (qa: quick-feedback-fab, settings-send-feedback, settings-reorg)

### Audit findings
The /qa dashboard is solid for structured per-feature testing (threads,
statuses, search, leaderboard, patch history, repo mirror, processed
gating). But three gaps blocked true "micro testing along the way":
1. **No global quick-comment widget.** To file a note mid-flow the
   tester had to leave the screen they were testing, navigate to
   Settings, expand SendFeedbackCard, then navigate back — a flow
   killer that discourages drive-by notes.
2. **`SendFeedbackCard` hardcoded `status: "failing"`** on every
   submit. Praise notes and ideas all got flagged as bugs,
   polluting the leaderboard and statuses.
3. **No view-context auto-capture** — every note had to manually
   describe where the tester was when filing.
4. **Settings was a jumbled flat list** of cards — profile/training
   data was interleaved with theme, gamification, feedback, and
   system housekeeping with no scannable hierarchy.

### Added
- **`QuickFeedbackFab`** — small teal "💬 NOTE" pill fixed in the
  bottom-right of every authed screen (any logged-in user, not just
  admin). Tap → bottom-sheet form with three explicit kind chips
  (🐞 BUG → failing, 💡 IDEA → untested, ✓ WORKS → passing).
  Auto-captures the current `view` state into the note prefix so
  Claude knows exactly where the tester was. Posts to the same
  `POST /api/qa/comment` endpoint as the Settings card
  (itemId="user-feedback"). zIndex 9500 — sits below all fullscreen
  modals (workout overlays, install banner, side menu) so it never
  fights critical UI. Hide-for-session toggle persisted in
  `sessionStorage` under `ironlog-fab-hidden`.
- **`QuickNoteToggle`** — per-user opt-in/out toggle in Settings →
  FEEDBACK & QA. Backed by `localStorage["ironlog-fab-enabled"]`,
  default ON. Fires a `ironlog-fab-toggle` custom event so the live
  FAB picks up the change without a page reload.
- **`SettingsSectionHeader`** — a thin, consistent label row used
  to group related cards in Settings.

### Fixed
- **`SendFeedbackCard` status bug** — replaced the hardcoded
  `"failing"` with the same three-chip picker. Default is 💡 IDEA
  so feedback no longer false-positives as bug reports. Note is
  prefixed with the picked chip's icon + label so the
  user-feedback thread stays self-describing.

### Settings UI cleanup
- Reorganised the Settings view from a flat list of mixed cards
  into five scannable sections, each with a section banner:
  **APP PREFERENCES** (theme + accent), **YOUR PROFILE** (identity
  + body & stats), **TRAINING** (HIIT + trainer upgrade),
  **ALERTS** (push notifications), **FEEDBACK & QA** (Quick Note
  toggle + Send Feedback card + /qa dashboard link), and
  **LIBRARY & SYSTEM** (version, export, gamification,
  achievements, pro tips, restart tutorial, log out).
- The page title now reads `SETTINGS` (was `ACCOUNT`) — "account"
  was misleading because the page held theme + gamification +
  achievements alongside real account-y bits.
- Renamed the PROFILE card subtitle to `IDENTITY` so it reads
  unambiguously under the YOUR PROFILE section header.

### Tutorial
- Bumped `TUTORIAL_VERSION` to `v2` and rewrote the `qa-feedback`
  step to surface the new 💬 NOTE pill as the primary "drop a
  thought while testing" surface, with the Settings card and /qa
  dashboard as secondary structured paths.

### QA tracking
- Added `quick-feedback-fab` item to qa-state.json with a 10-step
  test plan covering visibility per view, the Settings toggle,
  chip selection, view-context capture, hide-for-session, and
  z-index ordering under overlays.
- Added `settings-reorg` item covering the new section banners and
  the renamed page title.
- Flipped `settings-send-feedback` from untested → regression-retest
  with an updated 8-step test plan that exercises the new KIND chips
  and verifies the status mapping per chip.

---

## Feature · 2026-05-21 (at) — Group shared workout: schema + API (Slice 1/N) (qa: group-shared-workout)

### Added — Prisma schema
- `GroupWorkout` (one per `LeaderboardGroup`, groupId @unique). Holds
  `name`, `description?`, `days` (Json blob, same shape the home view
  consumes), `createdBy`, timestamps. `onDelete: Cascade` from the
  parent group.
- `GroupWorkoutSubscription` — per-user opt-in: `(userId,
  groupWorkoutId)` composite unique, `activated: Boolean @default(false)`,
  `joinedAt`, `activatedAt?`. Auto-created when the workout is first
  set or when a new member joins; the user must explicitly **apply**
  to flip `activated=true`.
- `WorkoutLog.groupWorkoutId` — optional FK to GroupWorkout with
  `onDelete: SetNull`. When the workout is later deleted, past logs
  keep their slot in the user's history; they just stop counting on
  the filtered leaderboard.

### Added — API
- `GET /api/leaderboard/groups/[id]/workout` — returns the group's
  shared workout + the caller's subscription state + `isTrainer`. Any
  group member can read.
- `PUT /api/leaderboard/groups/[id]/workout` (trainer-only) — upserts
  the workout. Auto-creates a `GroupWorkoutSubscription` (activated
  false) for every current group member via `createMany {
  skipDuplicates }`. Trainers can later overwrite the workout in place.
- `DELETE /api/leaderboard/groups/[id]/workout` (trainer-only) —
  removes the GroupWorkout row; past WorkoutLogs go null on
  `groupWorkoutId` via the FK SetNull so they're preserved in
  per-user history.
- `POST /api/leaderboard/groups/[id]/workout/apply` — member
  activates their subscription (`activated=true`, `activatedAt=now`).
  Group days now eligible to surface in the home view and sessions
  tagged with this groupWorkoutId now count for the filtered group
  leaderboard.
- `DELETE /api/leaderboard/groups/[id]/workout/apply` — member
  leaves (flips `activated=false`; row is kept so past `activatedAt`
  is preserved as audit trail).

### Wiring — auto-subscription on member add
- `POST /api/leaderboard/groups/[id]/members` (trainer adds clients)
  now auto-creates subscriptions for the new clients if the group
  already has a workout.
- `PATCH /api/leaderboard/groups/[id]/invite` (a trainer accepts an
  invite) now auto-creates a subscription for the joining trainer.

### Wiring — session tagging + filtered leaderboard
- `POST /api/workout` accepts an optional `groupWorkoutId` field.
  Before persisting, the route checks the caller has an `activated`
  GroupWorkoutSubscription for that workout — otherwise the tag is
  dropped (can't game the leaderboard from a non-applied client).
- `lib/leaderboardStats.ts → computeStatsForUsers(userIds,
  groupWorkoutId?)` now takes an optional filter that scopes the
  WorkoutLog query to logs tagged with that groupWorkoutId. Used by
  the My Leaderboards endpoint to compute "this group only" sessions
  alongside overall sessions.
- `GET /api/leaderboard/mine` response shape extended per group with
  a `workout` summary (`id`, `name`, `description`, `hasDays`,
  `myActivated`, `mySubscribed`) and per-member `groupActivated`,
  `groupSessions`, `groupVolume`, `groupIntensity`, `groupStreak`.
  Existing fields untouched — purely additive.

### Next slice
- Trainer-side UI: SET / EDIT / REMOVE buttons in the active-group
  management panel that POST a customPlan-derived `days` array.
- Member-side UI: `APPLY GROUP WORKOUT` / `LEAVE` card on the
  Progress → Dashboard above the My Leaderboards block.
- Home view: when `mySubscription.activated` is true, surface the
  group days alongside the personal split with a `▣ GROUP` badge.
  Starting a workout from a group day must tag the resulting log
  with `groupWorkoutId`.
- My Leaderboards: per-group `ALL · GROUP ONLY` toggle that switches
  the rankings table to use `groupSessions` and filters out
  non-activated members.

---

## Feature · 2026-05-21 (as) — home polish v2 + tier intuitiveness (qa: home-polish-v2, tier-system-intuitive)

### Changed — home
- Hero height 220→200; tagline stays inside the hero at `top: 62%`
  (user confirmed overlaid-on-hero is the right placement).
- **Daily Quest compressed** from full card to a slim single-row
  chip (icon · `QUEST` label · title · ›). Body text moved to a
  tap-info modal.
- **Daily Quest tappable** — opens an info modal with full body +
  context-aware action: hydration / sleep / energy quests get an
  `▸ OPEN WELLNESS` deep-link to Progress → Dashboard; behavioural
  quests get a `GOT IT` acknowledge button.
- **Dynamic day-card heights**: 1 day → 420px (hero card filling
  the screen); 2 days → 260px; 3 days → 178px; 4-6 days → 138px in
  2-col. No more dead black space when the user has only 1-2 days
  in their split.
- **Day-card expand overlay** — title + focus + `▶ START WORKOUT`
  now vertically centered with flex (was glued to the bottom edge).

### Redesigned — tier card
- `tier-system-intuitive`: tier card on Progress → Dashboard now
  obviously a tier system at a glance:
  - **`🏆 YOUR RANK · TIER N OF 6`** explicit header at the top.
  - Bigger animal icon (58px) + bigger name (26px caps).
  - **Horizontal ladder of all 6 animals** below — current
    highlighted with glow, past tiers full-colour, future tiers
    greyed.
  - Explicit `OVERALL SCORE · N / next-min → NEXT TIER` row.
  - `5 STATS FEED THIS RANK` label above the sub-rank grid so
    cause-and-effect is unmistakable.

---

## Feature · 2026-05-21 (ar) — milestone info overlay + trainers see athlete tier (qa: milestone-info-overlay, tier-trainer-keeps-athlete)

### Added
- `milestone-info-overlay`: each milestone tile in the Settings
  achievements wall is now tappable. Opens an info modal with:
  - **Locked**: greyscale icon, `🔒 LOCKED · CATEGORY` header, full
    label, and a **`HOW TO UNLOCK`** card containing plain-English
    unlock criteria.
  - **Earned**: full-colour icon, gold `✓ ACHIEVED · CATEGORY`
    header, full label, and the achievement's flavour-text body.
- Every Milestone definition in `lib/milestones.ts` gained a
  `requirement` field with plain-English criteria. Anniversaries
  say "Be on IRONLOG for N days", session/streak/PR ones spell out
  the count, behaviour milestones cite the feature, tier-ups cite
  the headline tier score breakpoint.

### Fixed
- `tier-trainer-keeps-athlete`: athlete tier card on Progress →
  Dashboard was gated to `role === "user"` — invisible to
  trainers and admins. Removed the gate so trainers see their
  *own* training rank too (they train themselves). Still hidden in
  Pure Mode (de-gamify).

---

## Feature · 2026-05-21 (aq) — home layout polish + day-card expand animation (qa: home-layout-polish)

### Changed
- **Hero shorter** — height 290→220 so the cards section starts higher.
- **Tagline bigger and centered** — `LIFT · TRACK · PROGRESS` 14→18,
  phrase 14→16. Moved from absolute `bottom: 18` (glued to hero
  bottom) to absolute `top: 58%` translateY centered. Soft text-
  shadow added for readability over the image.
- **Soft fade between hero and cards** — transparent-to-black
  gradient overlay where hero meets the dark cards section. No
  more hard seam.
- **Cards tighter** — twoCol card height 160→138, gap 10→8,
  dashboard padding-top 20→10. 6-day splits fit better.

### Added
- **Card-expand animation** — tapping a day card morphs its image
  to fullscreen via framer-motion's `layoutId` shared-element. After
  the morph (~180ms), title + focus + a big `▶ START WORKOUT`
  button fade in. `← Back` collapses; START actually opens the day.
- **Pure Mode fallback** — `🧘 PURE MODE` users skip the animation
  and get the instant transition.

---

## Feature · 2026-05-21 (ap) — knowledge base unification: principles + pro tips (qa: knowledge-principles, knowledge-pro-tips)

### Phase 1 — `lib/principles.ts` (the single source of truth)
- Every numerical training value the app uses (rep ranges, rest seconds,
  volume landmarks, RPE rubric, deload windows, overload increments,
  experience gates, recovery guidelines, warm-up / cool-down protocol,
  compound:isolation mix, default tempo) is now centralised in
  `lib/principles.ts`, each entry carrying a `source: ...` field citing
  the canonical reference (NSCA Essentials, ACSM position stands,
  Schoenfeld meta-analyses, Renaissance Periodization, Helms et al.
  Pyramids of Training, Practical Programming by Rippetoe & Kilgore,
  Behm & Chaouachi warm-up review, etc.).
- Helpers: `targetRpeFor(goals)`, `blendedRepRange(goals)`.
- Audit pass:
  - `lib/planGenerator.ts` → `volumeForGoals()` now reads `blendedRepRange()`
    instead of inline numbers.
  - `lib/experience.ts` → `experienceProfile()` reads `DELOAD_POLICY`
    from principles for the deload window.
  - `lib/performance.ts` → `suggestProgression()` RPE rubric already
    aligned; header comment added for traceability.

### Phase 2 — `lib/proTips.ts` (curated, context-aware)
- 40 vetted training tips across 6 categories: programming, technique,
  recovery, nutrition, mindset, habit.
- Each carries a `source` citation. Many are conditioned by a
  `relevantWhen(ctx)` predicate so they surface when the user actually
  needs them — e.g. low-sleep tip when sleep < 7h, long-streak deload
  tip at 14+ day streak, high-RPE bias tip when recent average ≥ 8.7,
  injury-substitution tip when there's an active injury, etc.
- `pickDailyTip(ctx)` picks deterministically by ISO date with a 60%
  bias toward context-relevant matches; falls back to evergreens.
- **Home surface**: small teal `💡 PRO TIP` card below the Daily Quest,
  above YOUR SPLIT. Dismissible per-day with `×`.
- **Settings library**: `💡 PRO TIPS LIBRARY (40)` button below the
  Achievements wall. Collapsible, grouped by category, every tip
  shows its source. NOT hidden by de-gamify mode (educational ≠
  gamification).

### Skipped (deferred per user)
- AI coach via Claude API — explicitly not now.

---

## Feature · 2026-05-21 (ao) — Slice G 2/2: progress photo log via Vercel Blob (qa: progress-photo-log)

### Added
- `progress-photo-log`: new `📸 PROGRESS PHOTOS` card on Progress →
  Body tab. Capture or pick a photo, it uploads to Vercel Blob and
  appears in a 3-col gallery with date + bodyweight overlays.
- Schema: new `ProgressPhoto` model (userId, url, takenAt, weightKg,
  notes). Vercel auto-migrates on deploy.
- API: `POST /api/photos` (multipart upload, 8MB cap, per-user
  pathing `progress/<uid>/<ts>-<rand>.<ext>`), `GET /api/photos`
  (lists newest-first), `DELETE /api/photos/[id]` (owner-only,
  removes DB row + best-effort deletes blob).
- Surfaces a clear error message if `BLOB_READ_WRITE_TOKEN` isn't
  configured.

### ⚠ ACTION REQUIRED ON VERCEL
- Add `BLOB_READ_WRITE_TOKEN` to **Project → Settings →
  Environment Variables**. Create the token in **Project →
  Storage → Connect Blob Store**. Without this the upload route
  will return a friendly error telling the user to set it up.
- New package: `@vercel/blob` is now in dependencies; Vercel
  installs it on the next deploy automatically.

### Slice closeout
With this push **Slices A through G + Modality Mix + Tier redesign
+ Gamification+ pass are all live**. The full set of features the
user approved is shipped.

---

## Feature · 2026-05-21 (an) — Slice G ½: offline-tolerant workout save (qa: workout-offline-sync)

### Added
- `workout-offline-sync`: `lib/offlineSync.ts` ships `postWithQueue()`
  and `drainQueue()`. The workout-save POST now goes through the
  queueing wrapper — if the network errors or `navigator.onLine`
  is false, the payload is stashed in localStorage and replayed
  on the next `online` event (or immediately on next mount if
  already online).
- Yellow **`☁ N PENDING`** chip in the home view header next to the
  YOUR SPLIT row when there are queued saves. Disappears
  automatically once they drain to the server.
- Items dropped after 5 failed replays to avoid permanent stuck
  state.

### Next (Slice G 2/2)
- Progress photo log via Vercel Blob (needs the `@vercel/blob` npm
  package + a `BLOB_READ_WRITE_TOKEN` env var added on Vercel —
  surfaced in the next commit message so you can set it before
  the deploy).

---

## Feature · 2026-05-21 (am) — Gamification+ pass + Pure Mode toggle (qa: gamification-daily-quest, gamification-de-gamify)

### Added
- `gamification-daily-quest`: new **DAILY QUEST** card on the home
  view (above YOUR SPLIT). Deterministically picks one of 7 quests
  per day (💧 Hydrate · 🏋 Train · 🎯 Tag effort · 😴 Sleep check-in
  · ⚡ Energy check · 🥇 PR hunt · 🔥 Double up). Card turns green
  when the condition is satisfied.
- **Hidden achievements** (6): Dawn Patrol (train before 6am), Night
  Owl (after 10pm), Birthday Lift (train on your DOB), 30-Day Hydra
  (30 consecutive hydration goal days), Full Stack × 7 (7 full-stack
  days lifetime), Quarter Balanced (4 balanced weeks lifetime). All
  in `lib/gamification.ts`. Don't appear in the wall until earned.
- **Full-Stack Day combo detector** — fires when the user does all of
  hydration target + sleep log + energy log + session in the same
  day. Persisted per-date so it counts once.
- **Balanced Week badge** — week-keyed detection of hitting all 5
  muscle category buckets (chest · back · shoulders · arms · legs)
  in a single ISO week.
- `gamification-de-gamify`: **🎮 GAMIFICATION · ON ↔ 🧘 PURE MODE · ON**
  toggle in Settings (above Achievements). When ON, hides the
  entire gamification stack — Daily Quest, Tier Card, Monthly
  Challenges, Achievements wall, milestone celebration overlays.
  Tracking UI (wellness, recap, graphs, calendar, volume heatmap)
  stays — those aren't game elements. Milestone IDs continue to
  persist silently in localStorage so toggling back on resurfaces
  them in the wall.

---

## Feature · 2026-05-21 (al) — Slice F + tier Habits sub-rank (qa: engagement-challenges, engagement-achievements, engagement-weekly-recap, tier-habits-subrank)

### Added — engagement
- `engagement-challenges`: `🎯 MONTHLY CHALLENGES` card at the top of
  Progress → Dashboard. v1 ships 3 hardcoded challenges (Push-Up
  Monster 1000 reps · Showing Up 20 sessions · Heavy Hauler 50k kg).
  JOIN/✓ JOINED opt-in (localStorage). Progress bar from real
  history. Global leaderboard rank is a follow-up slice.
- `engagement-achievements`: `🏆 ACHIEVEMENTS (N/total)` button in
  Settings opens a 2-col badge wall. Every milestone defined in
  `lib/milestones.ts` is shown — achieved ones gold + flavour text
  visible, locked ones greyed.
- `engagement-weekly-recap`: Sunday-anchored modal that pops up on
  the first home open each ISO week. Shows last week's sessions,
  total volume, top exercise. Tap to dismiss. Skipped on weeks with
  zero training. Real server-side push notifications deferred to a
  later slice.

### Added — tier extension
- `tier-habits-subrank`: the athlete tier system now has **5** sub-
  ranks instead of 4. New **💧 Habits** sub-rank fed by wellness
  logging:
  - 60% weight on **hydration goal-hits** (days in last 14 where
    glasses ≥ 8)
  - 20% weight on **sleep logged days** (last 14)
  - 20% weight on **energy logged days** (last 14)
  Tracked via `wellnessLast14Days()` helper that walks the localStorage
  daily maps. So consistent hydration + sleep tracking actually
  contribute to your headline animal tier score now, as the user
  requested.

---

## Feature · 2026-05-21 (ak) — Slice E: wellness card (hydration, sleep, soreness, injury) (qa: progress-wellness-card)

### Added
- `progress-wellness-card`: a new `🌱 WELLNESS` collapsible card at
  the top of Progress → Dashboard. Four lightweight daily trackers,
  all localStorage-backed, all opt-in:
  - 💧 **Hydration** — glass counter, target 8/day, segmented bar.
  - 😴 **Sleep & Energy** — 5/6/7/8/9h chips for sleep duration,
    😴/😐/🙂/💪/⚡ chips for energy. Tap same chip again to clear.
  - 💢 **Soreness** — 10 muscle groups, each with a 1-5 rating row.
    Tap a number to set, same number again to clear.
  - 🤕 **Injury log** — persistent list of active injuries (16 body
    parts incl. joints). + ADD picks from a body-part chip-set;
    ✓ HEALED removes.
- **In-session integration**: active session exercise cards now
  show a red `🤕 INJURY · <PART>` chip when the exercise's primary
  or secondary muscles match an active injury. Tap → reuses the
  existing substitute-modal to swap the lift.
- All wellness data is localStorage-backed for now — no schema
  migration. Easy to promote to DB later if/when needed.

---

## Feature · 2026-05-21 (aj) — Slice D: plate calculator + music launcher (qa: workout-plate-calculator, workout-music-launcher)

### Added
- `workout-plate-calculator`: under the weight input on barbell
  exercises, a teal `🏋 BAR + 20 + 10 + 2.5 PER SIDE` hint
  shows the plate stack you need. `lib/plates.ts` greedy-fits the
  standard kg plate set (25/20/15/10/5/2.5/1.25) per side, assuming
  a 20kg bar. Hides on dumbbell / machine / bodyweight exercises
  where the breakdown is noise.
- `workout-music-launcher`: small green `♪ MUSIC` chip in the active
  workout header (next to QUIT ×). Deep-links to Spotify
  (`spotify:`) with a 400ms fallback to `open.spotify.com` so it
  works whether the app is installed or not.

---

## Feature · 2026-05-21 (ai) — multi-dim tier redesign + experience auto-progression + milestones + experience-tuned deload (qa: athlete-tier-redesign, milestones-celebrations)

### Added
- `athlete-tier-redesign`: new `lib/tiers.ts` is the single source of
  truth for the tier ladder. Headline animal tier (🐱 Kitten → 🦍
  Gorilla) now comes from the **average of 4 sub-ranks** — each 0-100,
  each visible:
  - 🔁 **Consistency** (sessions + streak)
  - 💪 **Strength** (PR count)
  - 📈 **Volume** (total kg×reps lifetime)
  - 🏆 **Mastery** (distinct exercises trained)
  Same shape for trainers but with role-appropriate dimensions
  (Roster · Progression · Retention · Reach). The "Path to Next"
  callout points at the user's weakest dimension so the next tier
  feels reachable.
- **Experience badge**: `lib/experience.ts` exposes
  `effectiveExperience()` — the onboarding-recorded fitness level is
  trusted for the first 6 months, then fully auto-derived from
  months-on-app + total sessions + PR count. Surfaced as a small
  chip (🌱 NEWCOMER / 🌿 BEGINNER / 🌳 INTERMEDIATE / 🔥 ADVANCED)
  next to the headline tier.
- `milestones-celebrations`: `lib/milestones.ts` ships 25+ milestones
  across 5 categories (anniversary, consistency, strength,
  behaviour, tier). Anniversary milestones fire on day 1 / 7 / 30 /
  90 / 180 / 365. Session counts fire at 1/10/50/100/250/500/1000.
  Streak milestones at 7/30/100 days. First PR / first superset /
  first drop set / first deload accepted. Tier-up milestones for
  every animal level. Celebration overlay is a queue-based splash —
  full-screen card with icon + label + flavour text + tap-to-continue
  counter. Achieved IDs persisted in localStorage so users only
  see each milestone once.
- **Experience-tuned deload detector**: `shouldSuggestDeload()` now
  accepts `weeksWindow`, `sessionThreshold`, and `recentAvgRpe`.
  Advanced lifters get a 3-week window / 8-session threshold;
  newcomers get 6 weeks / 15 sessions. A recent avg RPE ≥ 8.5
  shaves a week off the window and 2 off the threshold (grinders
  get a deload sooner).

---

## Feature · 2026-05-21 (ah) — Modality Mix: calisthenics + recovery + onboarding chip-row (qa: profile-modality-mix)

### Added
- `profile-modality-mix`: profile edit / onboarding now has a
  `MODALITY MIX` chip-row above DAYS PER WEEK with four multi-select
  options:
  - 💪 **STRENGTH** — classic lifting (default for legacy users)
  - 🤸 **CALISTHENICS** — biases plan-gen toward bodyweight progressions
  - 🧘 **RECOVERY** — appends a dedicated Recovery & Mobility day
  - 🏃 **CARDIO+** — keeps cardio finishers / dedicated cardio day
- Schema: new `UserProfile.modalities String[]` field. Empty list at
  read time means classic strength behaviour, so existing users
  notice nothing until they opt in.
- `lib/planGenerator.ts` accepts `modalities` on `UserProfileInput`:
  - **recovery** prepends a Recovery & Mobility day using
    `pickCooldowns()`. No weight / reps tracking — just mark-done
    holds.
  - **calisthenics** applies a small swap-map for ~8 main barbell
    movements → bodyweight equivalents (`barbell-bench-press` →
    `push-up`, `back-squat` → `bodyweight-squat`, `lat-pulldown` →
    `pull-up`, etc.). Sets/reps/rest unchanged — it's a non-
    destructive bias.
- planNote string mentions the active modalities so the user sees
  what changed in their new plan.

### What's NOT in this pass
- Full yoga modality (skipped per the design discussion — different
  data model, scope trap)
- Calisthenics progressions library (skipped — was option 3, defer)

### Next
- Design discussion: athlete / trainer tier-progress clarity (the
  current Kitten → Gorilla / Bronze → Diamond systems need a clearer
  intuitive progression path)

---

## Feature · 2026-05-21 (ag) — Slice C ⅔ + 3⁄3: deload detector + volume heatmap (qa: workout-deload-detector, progress-volume-heatmap)

### Added — deload detector
- `workout-deload-detector`: when starting a session, the app checks
  whether the user has stacked ≥10 sessions and ≥4 weeks since their
  last deload. If so, a blue `🛟 DELOAD SUGGESTED` banner appears
  at the top of the session with two actions:
  - **`✓ ACCEPT DELOAD`** — logs today as a deload event in
    `localStorage.ironlog-deloads`, replaces the banner with a small
    `🛟 DELOAD WEEK ACTIVE` chip, and **the pre-fill scales the
    last-session weight by 0.7** (round to 0.25kg). Reps untouched.
  - **`SNOOZE 7D`** — writes a 7-day suppression key.
  Deload state clears at session end so the next session pre-fills
  normally. `shouldSuggestDeload()` lives in `lib/performance.ts`.

### Added — volume heatmap
- `progress-volume-heatmap`: Progress → Dashboard tab now opens with
  a `📊 VOLUME × MUSCLE` card. 2-column grid of 10 muscle groups
  (chest, back, shoulders, biceps, triceps, quads, hamstrings,
  glutes, calves, core) coloured by total kg×reps absorbed in the
  window (default 14D, switchable 7D / 14D / 30D). Greener as
  volume rises, red when zero ("skipped"). Helps the user spot
  neglected groups at a glance.
- `volumeByMuscle()` helper walks every logged set, looks up the
  exerciseId's `primaryMuscles`, credits weight×reps to each.

### Slice plan progress
- Slice A (foundation + viewing): done
- Slice B (smart suggestions): done
- **Slice C (programming pass): done with this push**
- Next: Modality Mix (calisthenics flag + recovery day + onboarding chips)
- Then: athlete/trainer tier-progress clarity (design discussion)

---

## Feature · 2026-05-21 (af) — Slice C ⅓: auto-substitute on missing equipment (qa: workout-auto-substitute)

### Added
- `workout-auto-substitute`: when starting a session, any exercise the
  user doesn't have the required equipment for now shows an orange
  `⇄ NEED <equipment>` chip on the card header. Bodyweight is always
  considered available — only real gear blocks.
- Tap the chip → modal listing up to 4 same-muscle alternatives the
  user CAN do with their current profile equipment, sorted by type +
  difficulty match. Tap to swap the exercise in the active session
  (saved routine untouched).
- New helpers in `lib/exercises.ts`:
  - `missingEquipmentFor(exercise, available)` — returns the list of
    missing items (respects `requireAll` vs requireAny).
  - `suggestSubstitutions(exerciseId, available, limit)` — scored
    alternative picker.
- Editable equipment list already lives in Settings → Edit Profile
  (no new UI needed — re-toggle items and re-open the session to
  see chips update).

### Slice plan
- Slice C ⅓: ✓ auto-substitute
- Slice C ⅔: deload week detection (next)
- Slice C 3⁄3: volume / frequency heatmap by muscle group (next)
- Then: Modality Mix (calisthenics flag + recovery day + onboarding chips)
- Then: athlete/trainer tier clarity + progress path design

---

## Feature · 2026-05-21 (ae) — Slice B: auto progressive overload + plateau detector (qa: workout-progression-suggest, workout-plateau-detector)

### Added
- `workout-progression-suggest`: when expanding an exercise with prior
  history, the system computes a suggested next weight based on the
  last session's RPE (if logged) or reps-vs-target. Shown as a
  star-prefixed chip between the inputs and the EFFORT row:
  `SYSTEM SUGGESTS +X.XKG → YYKG` with a one-line reason inline
  (e.g. *"last set was RPE 7 — could push more"*). Green when going
  up, red when backing off. **`ACCEPT`** button slots the value
  into the weight input; **`×`** dismisses. RPE rubric (Epley-paired):
    - ≤ 5 → +5kg (way too light)
    - 6–7 → +2.5kg (could push more)
    - 8 → hold (right at target)
    - 9 → hold (too heavy already)
    - 10 → −2.5kg (failed)
  Falls back to a rep-vs-target heuristic when no RPE was logged
  for the last session.
- `workout-plateau-detector`: in the customise screen, each exercise
  with a stale est-1RM (no improvement across the last 3 sessions
  given enough history) gets a gold **`⚠ PLATEAU`** chip. Tapping
  opens a modal showing the stale 1RM and up to 5 same-muscle
  variations from the exercise library to swap into.

### Slice plan progress
- Slice A (foundation + viewing): done
- **Slice B (smart suggestions): done with this push**
- Next: Slice C (deload + auto-substitute + volume heatmap) plus
  the new Modality Mix + tier-progress asks

---

## Feature · 2026-05-21 (ad) — leaderboard groups: weight / BF loss / BF now modes (qa: leaderboard-body-modes)

### Added
- `leaderboard-body-modes`: leaderboard groups can now be ranked by
  four metrics, switched via chips at the top of each group's
  rankings table:
    - **SESSIONS** (existing — sessions / streak / PRs)
    - **WEIGHT Δ** — current weight + signed change from first
      recorded entry. Sub-toggle: `⬇ LOSS LEADERS` (most negative
      Δ first, cyan) / `⬆ GAIN LEADERS` (most positive Δ first,
      purple). For cutters and bulkers respectively.
    - **BF LOSS** — current BF% + signed Δ BF%. Sorted most loss
      first. Cyan for loss, red for gain.
    - **BF NOW** — current BF% only. Sorted lowest (leanest) first.
- `lib/leaderboardStats.ts` gained body-metric fields
  (`weightStart`, `weightCurrent`, `weightChangeKg`, `bfStart`,
  `bfCurrent`, `bfChangePct`, plus the corresponding start dates).
  `computeBodyStats()` walks BodyMetric rows in date order to
  derive them.
- `/api/leaderboard/mine` refactored to use the shared
  `computeStatsForUsers()` so the client-side leaderboard view
  (Progress → Dashboard → My Leaderboards) gets body metrics too.
- All modes gracefully handle members with no body data — they
  show `—` in the relevant columns and sink to the bottom.
- Strictly group-local — never global. Body data is only visible
  to the group's own members, just like the existing rankings.

---

## Feature · 2026-05-21 (ac) — per-exercise metric graphs · month calendar · CSV export (qa: progress-exercises, progress-history, settings-csv-export)

### Added (Slice A · Commit 2 — viewing layer)
- `progress-exercises`: replaced the single MiniChart bar in each
  per-exercise card with **`ExerciseMetricChart`** — a 4-tab SVG line
  chart switching between `EST 1RM` (default) · `MAX WEIGHT` ·
  `VOLUME` · `AVG EFFORT`. `getExerciseStats()` now emits `est1RM`
  (Epley) and `avgRpe` per session so all four metrics plot from
  real data.
- `progress-history`: month-grid **`HistoryCalendar`** now sits at
  the top of the History tab. 6×7 Monday-start grid with `‹ / ›`
  month nav, today indicator, and two switchable colour modes:
  - **INTENSITY** — red gradient by `volume × avg-RPE` (or proxy 6
    when RPE is unset)
  - **PBs** — gold gradient by count of personal bests detected
    that day (tracked via 1RM-tracker walking the chronological log)
- `settings-csv-export`: new **`⬇ EXPORT WORKOUT HISTORY (CSV)`**
  button in Settings (between SEND FEEDBACK and RESTART TUTORIAL).
  `lib/performance.ts` gained `buildHistoryCSV(history)` — emits
  one row per logged set with columns: date, dayId, exerciseKey,
  setKey, weight, reps, rpe, est1RM, note. Comma/quote/newline
  escaping included. Filename: `ironlog-history-<YYYY-MM-DD>.csv`.

This closes out **Slice A** — the foundation for the performance
metrics system. Slice B (auto progressive overload + plateau
detector) depends on this and is next.

---

## Feature · 2026-05-21 (ab) — RPE/effort + set notes + 1RM helper · kill yellow PAIR button (qa: workout-set-logging)

### Added (Slice A · Commit 1 — capture layer)
- `workout-set-logging`: every set now has an optional **1-10
  EFFORT** chip row between the reps input and LOG SET. Combined
  scale — value's RPE label and RIR equivalent show inline
  (e.g. `8 → VERY HARD · 2 RIR`). Chip colour ramps cool→warm with
  difficulty. Tapping the same chip deselects (null = unset).
- **Long-press a logged set badge** to open a 📝 SET NOTE modal
  (240-char textarea). Notes persist in the WorkoutLog sets JSON.
  Badges with a note attached show a small amber dot in the
  top-right corner.
- New `lib/performance.ts` with `estimate1RM(weight, reps)` (Epley:
  `w × (1 + r/30)`) and `EFFORT_SCALE` metadata. The 1RM helper is
  used by the upcoming history graphs in Commit 2.

### Removed
- `workout-supersets`: yellow `⟳ PAIR` header button removed from
  the active workout view. It only redirected to the customise
  screen and is fully redundant — the per-exercise `+ SUPERSET`
  button now picks recommended pairings, in-session OR library
  partners, and offers `+ SESSION` vs `+ ROUTINE` save.

### Next (Slice A · Commit 2)
- Per-exercise graphs in History (weight / 1RM / volume / RPE)
- Calendar upgrade with INTENSITY / PBs switchable tabs
- CSV export in Settings

---

## Feature · 2026-05-21 (aa) — first-launch tutorial + Settings restart (qa: tutorial-onboarding)

### Added
- `tutorial-onboarding`: data-driven first-launch coach-card
  walkthrough. 8 steps live in `lib/tutorial.ts`:
    1. Welcome
    2. QA + feedback (Doppo at /qa, SEND FEEDBACK in Settings)
    3. Start today's session
    4. Warm-up + cool-down baked in
    5. Log a set + rest timer + auto-advance
    6. Supersets + drop sets
    7. Customise your routine (+ SESSION / + ROUTINE)
    8. App version + CHECK FOR UPDATES
- `TutorialOverlay` component renders the steps as full-screen
  cards with a top progress bar, SKIP, BACK / NEXT, and a final
  ✓ GOT IT button. Mounted on both home and settings so the
  Settings restart button doesn't have to navigate away.
- One-time per device: localStorage key `ironlog-tutorial-seen-v1`
  set on first dismissal. `TUTORIAL_VERSION` constant in
  `lib/tutorial.ts` controls the key suffix — bumping it forces
  every existing user to see the tutorial once.
- **🎓 RESTART TUTORIAL** button in Settings clears the flag and
  reopens the overlay without changing view.
- `CLAUDE.md` updated with a new "Every shipped user-facing
  feature MUST update the tutorial" forcing rule so future
  passes keep `TUTORIAL_STEPS` in sync with what's actually live.

---

## Feature · 2026-05-21 (z) — planGenerator bakes warm-ups + cool-downs into new plans (qa: workout-warmup)

### Added (slice 4/N — final slice of the warm-up / cool-down system)
- `workout-warmup`: `lib/planGenerator.ts` now persists warm-up +
  cool-down exercises on every newly generated plan. Each day's
  `exercises` array is rebuilt as `[warmups..., mains..., cooldowns...]`
  before the plan is returned.
- `pickWarmups()` / `pickCooldowns()` are called with the user's full
  context — focus, goals, available equipment, and the rehab profile
  if set — so rehab users get safer substitutions baked into their
  saved routine, not just at session time.
- `/api/plan` POST persists the new `kind` field alongside the
  existing PUT path. Newly registered users now have warm-ups +
  cool-downs in their plan from day one rather than relying on the
  render-time injection used for legacy plans.

### Behaviour summary across the full slice 2 → 4
- Existing users (plans without warm-up rows): see auto-picks
  injected at session render time (no migration needed).
- New users: warm-ups + cool-downs persisted directly into their
  saved plan from creation.
- Either way, customise screen offers `+ ADD WARM-UP` /
  `+ ADD COOL-DOWN` to override the defaults from the stretch
  library, with REMOVE to revert.
- Every stretch row in customise or the active session opens a
  form-cue modal with 2-3 short technique cues + an icon.

---

## Feature · 2026-05-21 (y) — custom warm-up/cool-down editing + form-cue modal (qa: workout-warmup)

### Added (slice 3/N)
- `workout-warmup`: the warm-up and cool-down sections in the
  customise screen are now editable. Each section has a
  `+ ADD WARM-UP` / `+ ADD COOL-DOWN` button that opens a stretch-
  library sheet filtered to that kind (`ALL_WARMUPS` — 11 entries;
  `ALL_COOLDOWNS` — 12 entries). Tapping a library item appends a
  `PlanExercise` row with `kind="warmup"` / `"cooldown"` and saves
  via `/api/plan` PUT.
- Saved items take precedence over the auto-picks; each saved row
  has a `REMOVE` button. When the last saved row is removed the
  section reverts to the auto-pick.
- **Form-cue modal** — tap any row in either section (saved OR
  auto-picked) and a modal opens with the icon, name, duration,
  and 2-3 short technique cues pulled from the library. Works
  universally because `findStretchById()` resolves cue data from
  the saved row's `exerciseId`.
- Auto-pick fallback still applies in the active session — if a
  user never customises, their session shows focus-appropriate
  defaults from `pickWarmups()` / `pickCooldowns()`.

### Next slice (4/N)
- `lib/planGenerator.ts` wires warm-up + cool-down exercises into
  newly generated plans so they're persisted from creation rather
  than relying on render-time injection.

---

## Feature · 2026-05-21 (x) — three-section workout: warm-up + main + cool-down (qa: workout-warmup)

### Added (slice 2/N — foundation + customise integration)
- `workout-warmup`: shipped the full warm-up + cool-down system
  foundation. Every saved workout day now resolves to three sections
  (Warm-Up · Main · Cool-Down) in both the active session and the
  customise screen.
- New `lib/stretching.ts` with two libraries:
    - **8 dynamic warm-ups** (arm circles, band pull-aparts, leg
      swings, world's greatest stretch, cat-cow, scap push-ups,
      bodyweight squat, inchworm) plus 3 cardio primers
      (treadmill / rower / bike). Picker `pickWarmups(ctx)` returns
      1 cardio + 2-3 dynamic moves matched to the day's focus
      (push / pull / legs / upper / lower / full / cardio) with
      refinements for `goals`, `equipment`, and `rehab` profile.
    - **12 static cool-down stretches** (doorway chest, child's
      pose, pigeon, hamstring, quad, calf, lat, tricep, bicep,
      figure-four, cat-cow, cross-body shoulder). Picker
      `pickCooldowns(ctx)` returns 3-5 stretches matched to the
      muscles trained.
- Each stretch ships with 2-3 form cues + an emoji icon ready for
  the modal in slice 3.
- Schema: `PlanExercise.kind String @default("main")` (Vercel
  auto-migrates). `/api/plan` PUT now persists it.
- `planToWorkoutDay()` builds three sections — groups saved
  exercises by `kind`, and fills in auto-picks from the library
  for any empty section so every active session has a complete
  warm-up + cool-down even before users add their own.
- Customise screen mirrors the three-section split:
    - Yellow `🔥 WARM-UP` block at the top (auto preview)
    - The existing `💪 MAIN` editable list
    - Teal `🧘 COOL-DOWN` block at the bottom (auto preview)

### Next slice (3/N)
- Custom editing per section: stretch-library picker, drag-reorder,
  per-exercise form-cue modal, planGenerator wiring so newly
  generated plans persist with warm-up + cool-down exercises.

---

## Fix · 2026-05-21 (w) — restore the missing warm-up section (qa: workout-warmup)

### Fixed
- `workout-warmup`: warm-ups were absent from every active session
  because `lib/planGenerator.ts` never wrote warm-up exercises to
  `PlanExercise` rows, and the only place warm-ups existed was the
  hardcoded demo templates in `lib/workouts.ts`. The user-reported
  regression was: "the saved workout had warm-ups built in like 5
  min treadmill walks but they are missing now."
- Shipped `lib/warmups.ts` — a small focus-keyed warm-up library:
    - push days → incline treadmill walk
    - pull days → rowing machine
    - leg days → bike / light cardio
    - upper / lower / full / cardio variants
  `pickWarmupForDay({ title, focus })` picks the best match.
- `planToWorkoutDay()` now prepends a `Warm-Up` section with the
  picked exercise so every active session gets one — even existing
  plans that never persisted warm-ups in the DB. Render-time only;
  not saved back to the routine.
- Customise screen shows the same suggestion as a read-only dashed
  yellow card at the top of the exercise list, with a note saying
  full editing + warm-down + stretching lands in the next pass.

---

## Fix · 2026-05-21 (v) — iOS PWA refresh-to-black after "REFRESH NOW" (qa: settings-version-check)

### Fixed
- `settings-version-check`: REFRESH NOW left the iOS PWA on a black
  screen until the user swiped the viewport to wake it up. Known iOS
  PWA quirk where `location.reload()` in standalone mode can suspend
  the page until a touch event. Replaced with
  `location.replace(currentUrl + "?_v=" + Date.now())` — iOS treats
  this as a fresh navigation and renders cleanly, no manual swipe
  needed.
- While we're here: REFRESH NOW now also posts `{ type: "SKIP_WAITING" }`
  to any waiting service worker. `public/sw.js` gained a message
  handler that calls `self.skipWaiting()` on that signal so the new
  bundle activates on the next page load instead of waiting through
  the usual SW staleness window.

---

## Polish · 2026-05-21 (u) — user-facing `v1.0.N` version label (qa: settings-version-check)

### Changed
- `settings-version-check`: the user-visible version is now a friendly
  `v1.0.N` semver-ish string instead of a raw commit SHA. The patch
  number (`N`) is auto-derived on each request from the count of
  `^## (QA pass|Feature|Fix|Polish)` sections in `PATCHLOG.md`.
  `MAJOR_MINOR = "1.0"` is a constant in `/api/version` — bump it
  manually for milestone releases.
- The SHA stays as the canonical compare key (two pushes within the
  same patch count will always have different SHAs). A small
  `build <sha7>` line surfaces beneath the friendly label for
  QA / support reference.

---

## Feature · 2026-05-21 (t) — manual "Check for updates" in Settings (qa: settings-version-check)

### Added
- `settings-version-check`: new `🔄 APP VERSION` card in Settings,
  sitting above SEND FEEDBACK. Shows the SHA the client is currently
  running and has a `CHECK FOR UPDATES` button.
- New `GET /api/version` endpoint returns Vercel's
  `VERCEL_GIT_COMMIT_SHA` (plus ref + commit title) as
  `{ sha, shortSha, ref, title }`. Cached as `force-dynamic` so the
  hit always returns the current deploy.
- Client snapshots the SHA on Settings mount as the "running" version.
  Tapping CHECK FOR UPDATES refetches and compares:
    - Match → green `✓ YOU'RE ON THE LATEST · v <sha>` toast.
    - Mismatch → red panel showing both SHAs + a `🔄 REFRESH NOW`
      button. The refresh handler calls
      `navigator.serviceWorker.getRegistration()?.update()` before
      `location.reload()` so the PWA picks up the new bundle on the
      reload rather than serving the cached one.
- No background polling — purely manual per the user's preference
  (keeps traffic to zero unless someone explicitly checks).

---

## QA pass · 2026-05-21 (s) — action 3 mirrored comments from @maaiz (qa: admin-multi-role, qa-dashboard, qa-coverage-sweep)

### Addressed
- `admin-multi-role`: schema gains `User.extraRoles String[] @default([])`
  (Vercel auto-runs `prisma db push` on deploy). New
  `userHasRole(user, name)` helper checks both the primary `role`
  and the new extras array. All trainer-feature gates in
  `app/page.tsx` migrated to use the helper, so an admin can also
  hold the trainer role and unlock trainer-only surfaces without
  losing admin powers. `/api/auth` GET returns `extraRoles`.
  `/api/admin` PATCH gains a `set-extra-roles` action; `/admin`
  page shows per-user `+ TRAINER` / `+ ADMIN` toggle chips next
  to the existing primary-role select.
- `qa-dashboard`: status row now reads `TESTED ×N · LAST <date hh:mm>`
  instead of `N comments · Last tested: <date>`. Latest activity
  is `max(item.lastTested, newest comment ts)` so a just-submitted
  comment moves the line forward before the next QA pass. The
  notes blob is now rendered as a structured **📜 PATCH HISTORY**
  list — each `[date]` line becomes its own row with the date
  tag highlighted in red and the body in regular weight.
- `qa-coverage-sweep`: bumped `npm run qa:scan` from 5 → 10
  most-recent feature/pass sections per the request, so more of
  the recent history gets covered each run.

---

## Polish · 2026-05-21 (r) — rename "+ PERMANENT" → "+ ROUTINE" + rewrite confirms (qa: workout-supersets, workout-in-session-exercise-add)

### Changed
- `workout-supersets`, `workout-in-session-exercise-add`: relabelled
  the `+ PERMANENT` button to `+ ROUTINE` — symmetric with the
  `+ SESSION` partner, fits comfortably on mobile, and reads as
  "save to your routine" rather than as clinical jargon.
- Helper text under both pickers rewritten so the destination is
  obvious from the line alone:
  - "Tap **+ SESSION** to add for this workout only, or
    **+ ROUTINE** to save it to your routine so it appears in every
    future session of this day."
- Confirm dialogs rephrased to the same plain language:
  - Superset: "Save this pair to your routine? These two exercises
    will be paired as a superset in every future session of this
    day."
  - Add: "Add this exercise to your routine? It will appear in
    every future session of this day."
  - Anchor-not-in-routine refusal: "Can't save this pair to your
    routine — the anchor exercise isn't in your saved routine yet.
    Add it to your routine first, then pair it."

---

## Feature · 2026-05-21 (q) — persist superset + add-exercise to the saved routine (qa: workout-supersets, workout-in-session-exercise-add)

### Wired up the PERMANENT save
- `workout-supersets`: the `+ PERMANENT` confirm in the in-session
  picker is no longer a stub — it actually writes the pairing back to
  the user's saved routine. After the active-day update, the handler
  finds the matching `customPlan` day, replays the same insertion
  logic on its exercises array (keyed by `exerciseId` instead of `id`),
  PUTs the new payload to `/api/plan`, and patches local
  `customPlan` state so the routine view stays in sync. If the
  anchor exercise itself is session-only (not in the saved routine),
  an inline alert refuses the permanent pair and tells the user to
  add the anchor permanently first.
- `workout-in-session-exercise-add`: `+ Add Exercise` now mirrors the
  superset picker's two-mode UI. Every row shows `+ SESSION` (teal,
  this-workout-only) and `+ PERMANENT` (red, with a confirm dialog
  warning before persisting to the routine via PUT /api/plan).
  Helper text at the top of the sheet explains the two modes.
- `/api/plan` PUT handler now also persists the new
  `PlanExercise.dropSet` boolean alongside the legacy `dropSets`
  integer (shipped in p).

---

## Feature · 2026-05-21 (p) — workout flows: drop sets + superset picker rebuilt (qa: workout-dropsets, workout-supersets)

### Refactored — drop sets are now an open-ended chain
- `workout-dropsets`: replaced the fixed-count drop-set model (0/1/2/3
  selector) with a single boolean toggle. Schema gains
  `PlanExercise.dropSet Boolean @default(false)` (Vercel auto-runs
  `prisma db push` so the column appears on next deploy). Legacy
  `dropSets Int` is still respected by `isDropSetMode(ex)` so old
  routines keep working seamlessly.
- Customise screen + in-session card header both show a single
  `+ DROP SET` ↔ `🔻 DROP SET` toggle. Collapsed exercise card
  surfaces a yellow `🔻 DROP SET` chip so the mode is visible at a
  glance without expanding.
- New active-session drop flow: enter weight + reps for the regular
  set → tap LOG → drop panel opens with weight × 0.8 pre-filled
  (NO rest yet). Drop panel has two buttons:
    - **`+ DROP`** — log this drop, open the next with another × 0.8
      pre-fill. Chain is open-ended; the user decides how many drops
      they did in real-time.
    - **`✓ DONE`** — log this drop, end the chain, start rest,
      advance the set counter.

### Rebuilt — in-session superset picker
- `workout-supersets`: the per-exercise `+ SUPERSET` button still
  opens the session exercise browser, but the picker is overhauled:
  - **In-session exercises are now included** in the list (previously
    filtered out). They display a teal `✓ IN SESSION` badge but are
    still pairable, so the user can group two already-planned
    exercises without leaving the workout.
  - **`✨ RECOMMENDED PAIRINGS`** section at the top, driven by a
    new static antagonist + compound-isolation table
    (`RECOMMENDED_PAIRINGS` / `recommendedPartnersFor()` in
    `app/page.tsx`). 15 canonical pairs to start (e.g. bench press ↔
    barbell row, biceps curl ↔ tricep pushdown).
  - **Two confirm modes** per exercise: `+ SESSION` (session-scoped
    pair, the saved routine is untouched) and `+ PERMANENT`
    (warns via a confirm dialog before applying — placeholder for
    routine-level persistence in a follow-up slice).
  - Anchor exercise excluded from the list (can't pair with self);
    exercises already in a different superset excluded (prevents
    orphan groups).
- Auto-open after rest in a superset pair continues to work via the
  existing unconditional auto-advance flow shipped in (g).

---

## Fix · 2026-05-21 (o) — make "Open in browser" actually escape the PWA + clearer labels (qa: qa-dashboard)

### Fixed
- `qa-dashboard`: the previous `<a target="_blank">` to /qa stayed
  trapped in the iOS PWA's in-app webview — exact same overlay
  behaviour as the Doppo splash. Replaced with a button that:
    1. Tries `navigator.share({title, url})` first — on iOS PWA the
       native share sheet appears with "Open in Safari", which is
       the only reliable escape from a standalone PWA on iOS.
    2. Falls back to `window.open(url, "_blank", ...)` — handles
       Android PWA + desktop.
    3. Last resort: copies the URL to clipboard so the user can
       paste into their browser manually.
- `qa-dashboard`: relabelled "↗ IN BROWSER" → "📤 OPEN IN BROWSER"
  and added a one-line helper directly under the chip row that
  explains 📤 (pop into system browser) vs 🥋 (re-play Doppo
  intro) so testers don't have to hover for a tooltip to
  understand the actions.

---

## Feature · 2026-05-21 (n) — "Open in browser" escape chip for PWA testers (qa: qa-dashboard)

### Added
- `qa-dashboard`: a teal "↗ IN BROWSER" chip in the dashboard
  header next to SUMMON DOPPO. Target is `/qa` with
  `target="_blank"` + `rel="noopener noreferrer"`. Purpose: when
  a tester has IRONLOG installed as a PWA and the PWA itself is
  what they're testing, they can pop the dashboard out into the
  system browser (Safari / Chrome) so the PWA stays free for
  the actual testing while feedback gets logged in the browser.
  In non-PWA contexts the chip simply opens a fresh tab — still
  useful for sharing the URL or for split-window workflows.

---

## Fix · 2026-05-21 (m) — Doppo: comments load, mascot stops drifting (qa: qa-mascot-splash)

### Fixed
- `qa-mascot-splash`: the (l) "fix" was itself broken. Adding
  `user: { select: ... }` to the `prisma.qAComment.findMany` failed
  at runtime because `QAComment` has no schema-level `@relation` to
  `User` — the call threw and the comments endpoint returned 500.
  That's why the dashboard counts (visible behind the splash) were
  all zeros and Doppo greeted every tester as a STRANGER with an
  EMPTY record.
  - Reverted the broken prisma join.
  - Replaced with manual batched enrichment in the route handler:
    fetch rows → collect distinct userIds → one
    `prisma.user.findMany({ where: { id: { in: ... } } })` → merge
    the user object onto each comment. No schema migration risk.
- `qa-mascot-splash`: speech bubble was growing line-by-line during
  the typewriter, shoving the mascot upward each time. Fixed by
  reserving vertical space for every line in the chosen arc up-front
  via `minHeight: calc(N * 1.55em + (N-1)*4px)` on the dialogue
  container — the bubble height locks from frame 1 and the mascot
  stays anchored.
- Bumped sessionStorage key to `qa-doppo-seen-v3` so every active
  session sees the corrected greeting + stable layout.

---

## Fix · 2026-05-21 (l) — Doppo recognises returning testers (qa: qa-mascot-splash)

### Fixed
- `qa-mascot-splash`: Doppo was greeting logged-in users (with real
  comment history + points on the leaderboard) as STRANGERs and
  claiming their record was EMPTY. Two compounding bugs:
  1. `GET /api/qa/comment` selected `userId` (the FK) but not the
     `user` join. Every comment came back without `c.user.username`,
     so `buildLeaderboard` grouped everyone by the raw typed `tester`
     string. Doppo's lookup by `u:<authedUsername>` matched nothing.
     Fix: added `user: { select: { username, email, role } }` to the
     prisma query.
  2. Race: the auth fetch (`/api/auth`) was independent of the comment
     fetch. The mascot effect opened the moment `loading` went false,
     which sometimes ran before auth resolved — so the lookup
     happened with `authedUsername === null`. Fix: added an
     `authChecked` state, gated the splash open on
     `!loading && authChecked`.
- Also: visitor-row lookup now falls back to matching by tester name
  if the username key misses (belt-and-braces for any stragglers).
- Bumped sessionStorage key to `qa-doppo-seen-v2` so every active
  session sees the corrected greeting once.

---

## Feature · 2026-05-21 (k) — Doppo, the Baki-style QA sensei splash (qa: qa-mascot-splash)

### Added
- `qa-mascot-splash`: full-screen mascot splash that greets testers on
  `/qa`. Concept: a Baki-style hyper-muscular QA inspector named
  DOPPO addresses the tester in a manga speech bubble with
  personalised, slightly unhinged dialogue. Five dialogue arcs
  selected by the visitor's standing:
    - first-time / zero comments → introduces himself, demands a bug
    - rank #1 → solemnly acknowledges, demands more
    - top 3 → encourages the climb
    - many comments, zero verified bugs → calls them cowardly
    - default returning → recaps stats, demands more
- Typewriter animation: tap mid-dialogue to skip, tap after to
  dismiss. Sessionstorage-gated (`qa-doppo-seen-v1`) so it shows once
  per session.
- "🥋 SUMMON DOPPO" chip next to the QA Dashboard title to
  re-summon him on demand.
- Image loaded from `/public/qa-mascot.png`. If the file is missing
  the splash falls back to a placeholder card explaining where to
  drop the PNG, so the component is shippable before the art lands.
- Visual: red radial vignette, animated manga speed-line conic
  gradient backdrop, manga ink-style speech bubble with the
  classic 3-px black border + black drop-shadow.

---

## Feature · 2026-05-21 (j) — QA dashboard cleanup + coverage sweep (qa: qa-dashboard, qa-coverage-sweep)

### Cleaned up
- `qa-dashboard`: removed the BACKUP / RESTORE buttons. They were
  vestigial — comments save to the server immediately on SAVE COMMENT,
  so the only thing those buttons rescued was un-submitted draft text.
  Toolbar real-estate reclaimed.
- `qa-dashboard`: the "Your name" input now auto-fills from the
  logged-in user's username and is hidden entirely when authed. A
  small "SIGNED IN AS @username" chip replaces it. Anonymous
  visitors (incognito etc.) still see the input as a fallback. The
  page fetches `/api/auth` on mount to detect this.

### Added
- `qa-coverage-sweep`: new `scripts/qa-scan.ts` (run via
  `npm run qa:scan`). Parses `PATCHLOG.md` for `(qa: <id>)` tags,
  cross-references `qa-state.json`, and flags:
  - **Orphan tags** — `(qa: foo)` referenced but foo isn't in
    qa-state.json. Hard error (exit non-zero).
  - **Untagged sections** — recent feature/pass entries with no
    `(qa: …)` tag at all. Warning by default; `--strict` escalates
    it to an error so this can gate CI later.
- `qa-coverage-sweep`: CLAUDE.md updated with a new forcing rule —
  every shipped feature MUST have a qa-state.json item, and every
  PATCHLOG entry MUST tag the item(s) it touches. The qa:scan
  script enforces it.

---

## Feature · 2026-05-21 (i) — QA leaderboard: verification-gated scoring (qa: qa-leaderboard)

### Refined
- `qa-leaderboard`: tightened the rubric so points reflect *verified*
  signal, not just what the tester typed.
  - **Status bonuses** (failing / regression-retest / passing) only
    unlock once Claude has marked the comment processed. A falsely
    flagged "failing" comment no longer earns the +5.
  - **Screenshot bonus** now requires the URL to pass
    `isValidScreenshotUrl()` (well-formed `http(s)://`, valid
    `new URL()`, sensible length) AND the comment to be processed.
    Broken / bogus screenshot fields no longer earn points.
  - **Note-detail cap raised** from +5 to +15 (rate still 0.05/char,
    so a ~300-char note now hits the cap — rewards long-form
    feedback meaningfully more).
- Leaderboard rows show a new `⧗ pending` chip with the count of
  comments still awaiting verification, so testers can see what's
  queued vs already credited.
- Rubric expander rewritten to split "instant on submit" from
  "unlocked after Claude verifies" so the gating is obvious.

---

## Feature · 2026-05-21 (h) — QA leaderboard (qa: qa-leaderboard)

### Added
- `qa-leaderboard`: per-user feedback dashboard at the top of `/qa`.
  Aggregates from the already-loaded `QAComment` rows (no new endpoint
  needed) and shows rank medals, comment count, status breakdown
  (bugs / retests / confirms / screenshots / shipped), and a total
  points figure per tester. Sorted by points desc.
- Transparent scoring rubric exposed via a "HOW POINTS ARE AWARDED"
  expander on the card — currently:
    +1 base, +5 failing, +3 regression-retest, +1 passing,
    +2 screenshot, +3 processed, +0.05/char of note (cap +5).
- Registered users show as `@username`; anonymous testers show their
  typed name + a GUEST chip. Hidden during search to keep that flow
  focused.

---

## QA pass · 2026-05-21 (g) — drop the auto-advance toggle (qa: workout-rest-timer)

### Addressed
- `workout-rest-timer`: removed the opt-in "Auto-advance to next exercise
  after rest" toggle per user feedback (comment
  `cmpewcs3o0000vh3mw3at8fqw`). The behaviour is now unconditional:
  the workout view stays on the current exercise while it still has
  incomplete sets, and auto-expands the next incomplete exercise the
  moment all sets are done (or the user manually skips / picks
  another). Deleted the `autoAdvanceAfterRest` state + the two
  `ironlog-auto-advance` localStorage useEffects from `app/page.tsx`,
  dropped the `if (!autoAdvanceAfterRest) return;` guard from the
  rest-timer falling-edge effect, and removed the ⚙ WORKOUT BEHAVIOUR
  Settings card. `qa-state.json` steps updated to reflect the new
  unconditional flow.

---

## QA pass · 2026-05-21 (f) — action 4 mirrored comments from @maaiz

### Addressed
- `workout-rest-timer`: scroll-to-top bug after rest ends is fixed. The
  body-scroll-lock useEffect was clearing `document.body.style.top` in
  its cleanup before the new effect body could read it to restore the
  scrollY. Stashed scrollY in a useRef so it survives the cleanup. The
  page now stays exactly where you were when the rest timer dismisses.
- `workout-rest-timer`: new opt-in setting "Auto-advance to next
  exercise after rest" in Settings → Workout Behaviour (localStorage-
  backed). Default off. When on, the next incomplete exercise
  auto-expands once rest ends and inputs are reset so the next-tap
  refill from history / suggestion isn't stale.
- `workout-set-logging`: brand-new exercises (no prior history) now
  pre-fill with a computed SUGGESTED weight × reps via
  suggestedStartingSet(). Pattern-matches against bodyweight for known
  compounds (deadlift 0.6×, squat 0.5×, bench 0.4×, OHP 0.25×, etc),
  isolations (curls 0.1×, lateral raise 0.04×), and bodyweight
  movements. ★ SUGGESTED badge sits next to the set header so the user
  knows it's a suggestion and adjusts before logging. Already-logged
  exercises still use the historical lastSessionBest() pre-fill.
- `exercise-form-cues`: elliptical (the one gap in the cue library)
  now has cues. getFormCues() returns a 3-line generic fallback for
  any uncovered exercise instead of null — covers custom-trainer
  exercises too. In the active workout, the first cue surfaces inline
  as a TIP line above the set-input panel so cues aren't buried.
- `workout-supersets`: slice 1/N — added a ⟳ PAIR button to the
  active-workout header that drops you straight into the customise
  screen with multi-select pre-armed for the current day. Pick two
  exercises, tap ⟳ SUPERSET, return to the workout. Slice 2/N (next
  pass) is true in-session multi-select without exiting to customise.

### Slices (shipped first part, more to do)
- `workout-supersets`: slice 1/N done — shortcut shipped; slice 2/N
  is the real in-session multi-select.

---

## QA pass · 2026-05-21 (e) — first end-to-end mirror loop closes

### Addressed
- Two QA submissions arrived via the new auto-mirror (qa-comments/):
  - `user-feedback` (id `cmpet8uo5...nmce573y`) — handshake test from
    Settings → Send Feedback. Note: "Test show me 12345666 if you got
    this". No code action; marked processed.
  - `auth-trainer-login` (id `cmpetczrk...wzvu9kct`) — submitted via
    /qa thread by @maaiz with status=passing, note: "Works". Flipped
    `auth-trainer-login` from untested → passing in qa-state.json with
    a dated resolution line. Marked processed.

Both entries added to qa-processed.json so they don't reappear on the
next "process QA" invocation. End-to-end loop now confirmed working:
submission → mirror → git pull → resolve → push → /qa reflects new
processed state on next deploy.

---

## QA pass · 2026-05-21 (d) — re-link workout history (real fix)

### Addressed
- `routines-restore` / home cards: the orphan-log self-heal added in pass (a)
  wasn't actually finding any matches. The `repairOrphanLogs()` server fn
  was reading WorkoutLog.sets as `Record<exerciseId, ...>` but the real
  shape is `Record<"<exerciseId>-<setNum>", ...>` (with `-d<n>` suffix
  for drop sets). Every "exerciseId" it was scoring was actually a full
  set key — so zero overlap with current plan days, zero relinks.
  Fixed by mirroring the client-side `parseSetKey()` algorithm
  server-side: pop the trailing set-number (and any `dN` drop-set suffix)
  and use the joined remainder as the eid. On the next home-screen load
  the GET /api/workout call should now find your old logs and relink
  them to the matching new plan days. The "Last: <date>" line on each
  workout card should reappear after that single page load.

---

## QA pass · 2026-05-21 (c) — iOS autofill

### Addressed
- `auth-login`, `auth-register`, `auth-must-reset`, `auth-forgot-password`:
  All auth inputs now declare the right `autocomplete` + `name` +
  `inputMode` attributes so iOS's QuickType bar and iCloud Keychain
  surface saved credentials for IronLog. Login uses
  `autocomplete="current-password"`; register / setup / must-reset use
  `autocomplete="new-password"` so iOS prompts to save (or update) the
  password on submit. Username inputs add `autocapitalize="none"` +
  `autocorrect="off"` + `spellcheck=false` so they don't get autocorrected.

---

## QA pass · 2026-05-21 (b) — eliminate deferrals, ship slices

Process change: **CLAUDE.md no longer permits a "deferred" outcome.** Every
QA item must have at least one concrete code change shipped per pass, even
if it's just a schema field, an API hook, or a placeholder. Items stay in
`regression-retest` between passes with a "Slice 1/N: <done>. Next slice:
<next step>" line so progress is visible and the next pass picks up exactly
where this one stopped.

Items previously flagged "deferred" — now sliced:

### Addressed
- `admin-panel`: **Force Reset** button shipped on every user row. New PATCH
  action `force-reset` flips `mustResetPassword=true` on the target user;
  next login routes them through the must-reset screen. Button shows
  "Reset pending" and disables once the flag is set.
- `auth-login`: ProfileNagBanner shipped at the top of the home screen.
  Detects missing dob/gender/height/weight/bodyFatPct and shows a tappable
  "FIX" CTA jumping to Settings. localStorage cooldown — 1 day for most
  fields, 7 days for body fat.
- `auth-login`: onboarding-welcome image alignment fix. Was using
  `aspectRatio: 3/4` (the source image is 2:3, so it was being cropped
  horizontally); switched to 2/3 with `objectPosition: center 35%` so the
  figure stays centred and the rack reads. Gradient overlay tightened.
- `onboarding-profile-setup`: equipment-split first slice. UserProfile gains
  `equipmentHome[]` and `equipmentGym[]` columns; `/api/profile` POST reads
  and stores them when present. Vercel's build script syncs the schema on
  next deploy.

### Slices (shipped first part, more to do)
- `onboarding-profile-setup`: equipment split — next slice is the two-column
  equipment selector in the onboarding equipment step when `location='both'`
  + plan-generator update to pick the right set per training day.
- `onboarding-profile-setup`: in-app tutorial — next slice is a 3-card
  swipeable post-onboarding tutorial.
- `onboarding-profile-setup`: more pro tips — next slice is a rotating
  pro-tips card on the home screen; some content still needed from user.

### Not done by design
- `admin-panel` "force-show-password" — passwords are scrypt-hashed and not
  retrievable. Forcing a reset is the right primitive; revealing existing
  passwords is impossible without breaking auth security. Documented in
  the item's notes.

---

## QA pass · 2026-05-21 — `01da6f1` + dashboard upgrades

### Addressed
- `auth-register`: 👁 eye toggle on register password + confirm
- `auth-login`: 👁 eye toggle on login password
- `auth-must-reset`: 👁 eye toggle on must-reset password + confirm
- `admin-panel`: 👁 eye toggle on admin key input
- `admin-panel`: user table wrapped in horizontal-scroll container, page padding tightened for mobile
- `auth-forgot-password`: "← Back to login" now carries the typed email into the username field (login accepts username OR email), so user doesn't get stuck logging in as the previous attempt's username
- `auth-forgot-password`: clearer helper text under the input + on the sent confirmation explaining the "check spam, then contact support" path
- `qa-dashboard`: added live search across titles/areas/steps/notes/threads
- `qa-dashboard`: added a "General Notes" thread at the top for free-form notes not tied to a specific test item
- `settings-send-feedback`: new card inside Settings — any logged-in user can submit feedback that gets logged as a `QAComment` tagged with their userId
- `qa-comments`: comments now carry a `userId` (set automatically from the `ironlog-uid` cookie); the admin `/qa` view shows `@username` on each comment

### Deferred (need their own scoped work)
- `auth-login`: "Get started after sign up image not aligned well" — referenced screenshot https://kommodo.ai/i/GU546DBZf0aGwpwXesPk needed to identify which image element
- `auth-login`: daily nag for incomplete profile (BF% every 7 days) — needs `lastNaggedAt` per profile field on `UserProfile` + banner component
- `onboarding-profile-setup`: split equipment into homeEquipment / gymEquipment when location='Both' — data-model change + plan-generator updates
- `onboarding-profile-setup`: in-app tutorial with theme intro — needs UX flow design
- `onboarding-profile-setup`: "more pro tips" — waiting on concrete content from the user
- `onboarding-profile-setup`: referenced UI fit screenshot https://kommodo.ai/i/EX97cHmDMifmmYNqHVGq needed to action
- `admin-panel`: "force-show-password" — impossible by design (passwords are scrypt-hashed, not retrievable). "Force-reset" doable as a future button on a user row but warrants its own pass

### Process changes
- CLAUDE.md updated with a two-step QA processing flow: when the user invokes "process QA" the response is a SUMMARY of suggestions grouped by submitting user. Fixes only execute on explicit go-ahead.
- New trigger phrases accepted: "process the feedback logged", "summarise QA feedback".
- Routine retired entirely — processing is now exclusively user-triggered.

### Schema
- `QAComment.userId` added (optional FK convention to `User.id`; no relation declared on User to avoid back-ref churn). Vercel's build script will sync on next deploy via `prisma db push`.

---

## Environment Variables (Vercel + local `.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USER` | SMTP login (e.g. `admin@revtech.com.mv`) |
| `SMTP_PASS` | SMTP app password |
| `SMTP_FROM` | From address shown to recipients |
| `ADMIN_SECRET` | Password for `/admin` panel |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | e.g. `mailto:admin@revtech.com.mv` |

SMTP is via Google Workspace (`admin@revtech.com.mv`). SPF and DKIM are set up. DMARC record pending — Dhiraagu registrar access required.

Generate VAPID keys: `npx web-push generate-vapid-keys`

---

## Blocked / Pending

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic billing (checkout unavailable) |
| DMARC DNS record for revtech.com.mv | Dhiraagu registrar portal access |

See `ROADMAP.md` for the full future features list.

---

## Patch 40 · 2026-05-20 — QA sync `4098899`
**QA infrastructure first-run seed + group leaderboard / MY CLIENTS search**

### Commit `4098899` — Group leaderboards + MY CLIENTS collapsible with built-in search
- Added collapsible "MY CLIENTS" section on the trainer home screen with an inline search field that filters clients by username in real time
- Added group leaderboard feature: trainers can create named groups (private or public), invite members, and view a ranked leaderboard within each group
- New Prisma models: `LeaderboardGroup`, `LeaderboardGroupMember`, `LeaderboardGroupInvite`
- New API routes: `/api/leaderboard/groups`, `/api/leaderboard/groups/[id]`, `/api/leaderboard/groups/[id]/members`, `/api/leaderboard/groups/[id]/invite`, `/api/leaderboard/invites`, `/api/leaderboard/mine`

### QA artefacts created (first run)
- `/qa-state.json` — seeded with **47 test items** covering all major feature surfaces
- `/app/qa/page.tsx` — live QA dashboard: grouped by area, collapsible, status dropdowns, notes textarea, screenshot URL, tester name, submit report button, summary header
- `/app/api/qa/route.ts` — GET endpoint serving `qa-state.json`
- `/app/api/qa/report/route.ts` — POST endpoint persisting submitted reports to `QAReport` DB table
- `/prisma/schema.prisma` — added `QAReport` model (`id`, `ts`, `tester`, `payloadJson`)
- `/qa-reports/` — write-once report directory initialised
- `/admin` — QA Dashboard shortcut link added to the admin panel

### QA items added: 47 new, 0 re-flagged, 0 reports processed
New items: auth-register, auth-login, auth-trainer-login, auth-forgot-password, auth-must-reset, onboarding-profile-setup, workout-session-start, workout-set-logging, workout-rest-timer, workout-pb-detection, workout-supersets, workout-dropsets, workout-finish-save, workout-abandon, workout-in-session-exercise-add, plan-customise-add-remove, plan-customise-superset, plan-rebuild, plan-hiit-preference, routines-save, routines-share, trainer-request-send, trainer-client-management, trainer-client-detail, trainer-generate-plan, trainer-plan-proposal-accept, trainer-plan-proposal-reject, trainer-custom-exercises, trainer-leaderboard, messaging-send-receive, messaging-reactions, messaging-reply-to, messaging-presence, progress-dashboard, progress-exercises, progress-history, progress-body, body-metrics-trend, push-notifications-subscribe, pwa-install, leaderboard-personal, leaderboard-groups-create, leaderboard-groups-invite, leaderboard-groups-search, theme-iron-mono-vivid, admin-panel, marketing-promo-page, marketing-trainer-page, marketing-client-page, upload-profile-image, trainer-role-request

---

## Patch 39 · 2026-05-19
**HIIT Programs — Finisher Circuits + Dedicated Days**

### Schema
- `hiitPreference String?` and `hiitIntensity String?` on `UserProfile` — nullable, additive, no breaking changes

### Exercise library
- 20+ HIIT exercises added across four pools used by the circuit builder:
  - **Full-body:** burpees, squat thrusts, tuck jumps
  - **Lower:** split jumps, box jumps, lateral bounds, broad jump, speed skaters, jump squat
  - **Upper:** plyo push-up, mountain climbers, bear crawl, inchworm
  - **Cardio:** high knees, jumping jacks, jump rope, star jump, lateral shuffle

### Plan generator — `hiitCircuit()` (finisher mode)
- Appended after applicable strength days when `hiitPreference === "finisher"`
- Picks one exercise from each of the four pools (full-body, lower, upper, cardio) with non-repeating session randomisation
- `hiitParams(intensity)` maps intensity to rest and rep targets: `light` → 30 s rest / 12 reps, `moderate` → 20 s / 15 reps, `intense` → 15 s / 20 reps
- Each exercise: 3 sets, `notes: "HIIT circuit"` tag

### Plan generator — `hiitDay()` (dedicated mode)
- Replaces one training day when `hiitPreference === "dedicated"` and `daysPerWeek >= 5`
- Day titled "HIIT & Conditioning", subtitle "High Intensity Circuit · Core"
- Draws from all four pools with a larger selection (6 exercises + core finisher)

### Workout view rendering
- Exercises tagged `notes: "HIIT circuit"` are grouped visually under an **⚡ HIIT CIRCUIT** section divider (orange `#FF8C42` accent, separator lines either side)
- HIIT sections appear after the main strength exercises within the same workout day

### Onboarding
- HIIT preference captured during the profile/onboarding flow: opt-in toggle, then finisher vs dedicated choice, then intensity level (light / moderate / intense)
- Saved to `UserProfile.hiitPreference` and `UserProfile.hiitIntensity` via `POST /api/profile`

---

## Patch 38 · 2026-05-19
**Message Delivery Status — Conversations List Live Preview**

- After sending a message the conversation list preview updates instantly to the new message with the correct tick state — no longer shows a stale preview until the page is reopened
- Input field clears immediately on send (not after server round-trip); text is restored if the request fails
- Conversations list polls every 5 seconds while the messages screen is open — incoming messages and status upgrades appear without leaving the screen

---

## Patch 37 · 2026-05-19
**In-App Notification Suppression — Soft Beep + Tab Flash**

- Push notification banner is now suppressed when the app tab is in focus — the OS notification no longer interrupts you while you're already using the app
- When a message arrives and the app is focused, the service worker forwards it to the page via `postMessage` instead of showing a banner
- Page responds with a short 660 Hz sine-wave beep (180 ms, soft) + phone vibration (60 ms)
- If the user is on a different view (not messages/conversation), the browser tab title alternates between `💬 New message` and the app name every 900 ms until they open the messages screen
- Tab flash stops automatically when the user navigates to messages or conversation
- When the app is backgrounded or in a different tab, full banner notification still fires as normal

---

## Patch 36 · 2026-05-19
**Messaging — Delivered / Read / Sent Status**

- Added `delivered` boolean field to the `Message` schema (migration: `20260519_message_delivered`)
- **Sent** (`✓` dim): message created in database
- **Delivered** (`✓✓` grey): recipient's client fetched their message list — their session is active
- **Read** (`✓✓` teal): recipient opened the specific conversation
- Tick indicators shown on sent message bubbles (bottom-right, inline with timestamp)
- Conversation list preview shows tick status before the message text for messages you sent
- Polling: 5-second status-refresh loop re-fetches all messages in the open conversation and merges `read`/`delivered` changes on already-rendered bubbles — ticks upgrade in real time
- `GET /api/messages` now marks all incoming messages as `delivered = true` (recipient is online)
- `GET /api/messages/[userId]` marks incoming messages as `delivered = true, read = true`

---

## Patch 35 · 2026-05-19
**Mobile UX — Rest Timer Scroll Lock + Comprehensive Polish**

- **Rest timer scroll-through fixed:** body scroll is now locked (iOS-safe `position: fixed` technique) whenever the rest timer or workout-complete overlay is active — body position/scrollY is saved and restored on dismiss
- Rest timer overlay: `touch-action: none` + `overscroll-behavior: none` prevent any touch-based scroll passing through
- Replaced all `100vh` with `100dvh` (dynamic viewport height) across every view — fixes content being cut off or over-tall when the mobile browser URL bar appears or hides
- `safe-area-inset-bottom` added to all view bottom paddings via `env()` — content is no longer hidden behind the iPhone home indicator
- `-webkit-tap-highlight-color: transparent` applied globally — eliminates the grey flash on every button tap
- `text-size-adjust: 100%` prevents iOS from auto-bumping font sizes on orientation change
- `user-select: none` on all buttons — prevents accidental text selection when tapping quickly
- Added `.scroll-y` utility class (momentum scrolling) and `.safe-bottom` helper for future use

---

## Patch 34 · 2026-05-19
**Animation Bug Fixes — LOG SET Flash, Live PB Detection, Stronger View Transitions**

- **LOG SET flash fixed:** the LOG SET button had a `key` prop tied to the set number — when a set was logged the key changed, React remounted the button, and the flash animation was destroyed before it played. Key removed; animation now fires correctly
- **PB celebration — live during workout:** Personal Best detection moved from end-of-workout save to the LOG SET click handler. The 🏆 overlay now pops immediately when you log a weight that beats your last session. Each exercise PB only fires once per session; any remaining unshown PBs (e.g. no explicit set logged) still appear after the completion animation
- View slide animation increased from 24 px / 0.3 s to 40 px / 0.35 s for a clearly perceptible transition
- LOG SET flash updated to use `box-shadow` glow (`rgba(46,204,113,0.5)`) instead of background-color override — more reliable against gradient button backgrounds

---

## Patch 33 · 2026-05-19
**Animations & Visual Polish (full pass)**

- **View transitions:** all main views (`home`, `workout-prep`, `workout-session`, `progress`, `messages`, `conversation`, `settings`, `customise`, `clientDetail`) animate in with a 40 px right-slide + fade on forward navigation; back navigation uses a left-slide. Direction is tracked with `viewDir` state; `goTo()` / `goBack()` helpers wrap `setView`
- **LOG SET flash:** green brightness burst + scale pulse on the LOG SET button each time a set is confirmed (`.log-flash` keyframe, 380 ms)
- **Personal Best overlay:** `🏆 PERSONAL BEST` card pops up with a scale-in animation and a diagonal shine sweep; shown on the home screen after saving a workout with a new PB
- **Rest timer ring:** SVG arc depletes around the countdown number — full circle at rest start, shrinks to 0 at zero. Driven by `rest.total` (initial seconds) tracked in `useCountdown`
- **Workout complete overlay:** full-screen finish animation on SAVE — expanding concentric rings + checkmark scale-in; auto-dismisses after 1.4 s before navigating home
- **Progress bar grow:** weight-goal, body-fat, and onboarding progress bars animate from 0 to their value on load (`.bar-grow`, 0.9 s spring)
- **Onboarding step slides:** each step slides in from the right / left depending on direction (forward/back tracking via `prevOnboardingStep` ref)
- **Nav button bounce:** Messages and VIEW PROGRESS buttons scale-bounce on tap (`.nav-btn` + `@keyframes navBounce`)

---

## Patch 32 · 2026-05-19
**Equipment Filtering, Home Equipment, Bodyweight Weight Toggle, Trainer Plan Generation**

### Equipment filtering fix — bench press for home users
- Added `requireAll?: boolean` to the `Exercise` interface
- 12 exercises that require both a weight AND a bench (all bench press variants, dumbbell flyes, skull crushers, hip thrusts, incline curl) marked `requireAll: true`
- `filterExercises()` and `pickExercise()` in `planGenerator.ts` now use `.every()` for `requireAll` exercises and `.some()` for others — bench press no longer appears for users with only dumbbells

### New home equipment options
- Added `treadmill` and `elliptical` to the `Equipment` union type
- New `multi_gym` option in the equipment picker expands to show sub-options: cable machine, multi-machine, pull-up bar, dip bar — selecting sub-options adds the real equipment IDs; `multi_gym` itself is filtered out before saving to the profile
- Treadmill exercise updated to `equipment: ["treadmill", "machine"]`; cycling exercise linked to `elliptical`; new standalone elliptical exercise added

### Bodyweight weight toggle
- Bodyweight exercises (`equipment: ["bodyweight"]`) no longer show the weight input by default
- A `+ ADD WEIGHT` toggle reveals the field for weighted variants (vest, belt, etc.)
- `effectiveWeight` is `"0"` when BW mode and toggle is off; normal input value otherwise

### Trainer plan generation
- New API route: `POST /api/trainer/clients/[clientId]/generate-plan`
- Verifies trainer role and trainer-client relationship; fetches client profile
- Bumps client fitness level one tier (`newcomer → beginner → intermediate → advanced`) for a harder workout
- `boostPlan()` adds +1 set per exercise (compound cap 6, isolation cap 4)
- Returns plan days without persisting — trainer reviews and edits in the customise view before proposing
- `⚡ BUILD PLAN` button added to trainer's client detail Split tab
- "AI-generated plan" banner shown when the generated plan is active in the editor

---

## Patch 31 · 2026-05-19
**Deployment Fix — Feature Branch → Main Merge**

- All accumulated feature work from `claude/workout-reset-target-area-4sVKv` was committed but not pushed to `main` — Vercel was deploying from `main` and not picking up changes
- Merged feature branch → main; all prior patches now live

---

## Patch 30 · 2026-05-18
**Visual Polish — Animated Login Logo, Rotating Phrase, Trainer Role Refresh**

### Animated IRONLOG logo
- On login page load, `IRON` drops from 180px above the viewport and lands with a squash-and-stretch impact keyframe (`logoFall`): overshoot → squash wide/short → bounce tall/narrow → settle
- `LOG` follows 130ms later with the same animation so it lands as `IRON` finishes settling
- Other auth-step logo instances (register, password, forgot) are plain static text — no re-trigger on step transitions

### Dumbbell "I" glyph
- The `I` in `IRON` is replaced by an inline SVG dumbbell — two 26×9 rounded-rect plates connected by an 8×16 bar, matching the 40px Space Mono cap height and fontWeight 700 weight
- Falls as part of the `IRON` unit in the drop animation; `marginRight: 8` preserves the letterSpacing gap before `R`

### Rotating motivational phrase
- Static `useMemo` phrase replaced with a `phraseIdx` state that advances to a random non-repeating phrase every 5 seconds
- Phrase transitions with `phraseOut` (slides up + fades, 300ms) then `phraseIn` (slides up from below + fades in, 400ms) — CSS keyframes in `globals.css`
- Same rotating state shown on both login page and home screen

### Login page improvements
- Removed emoji feature-icon row (📈 Strength 🔥 Fat Loss) — cleaner, text-only layout
- Tagline corrected to `LIFT · TRACK · PROGRESS` (was `TRACK · LIFT · PROGRESS`)
- Motivational phrase sits between tagline and form as a single italic line

### Home screen
- Diagonal watermark phrase removed from behind workout cards — was distracting and illegible
- Single italic phrase line now sits cleanly between `LIFT · TRACK · PROGRESS` and `YOUR SPLIT`

### Trainer role refresh
- Added `visibilitychange` listener on mount: re-fetches `/api/auth` whenever the tab regains focus
- Trainer badge, `MY CLIENTS` section, and trainer-specific UI now reflect role changes (e.g. admin upgrade) without requiring a full page reload

---

## Patch 29 · 2026-05-18
**Add Exercise During Active Session**

- A `+ ADD EXERCISE` button appears above FINISH & SAVE during any active workout session
- Tapping it opens a full-screen bottom sheet with two steps:
  1. **Browse** — full 110+ exercise library with the same search + location / movement / muscle filters as the Customise view
  2. **Configure** — exercise name, sets (stepper 1–10, default 3), reps (text, default "10-12"), REST chips (SKIP / 30s–180s, default 60s)
- **"Save to plan" toggle**: OFF adds the exercise only to the current session (not persisted to the plan); ON also calls `PUT /api/plan` to permanently append it to the day
- Added exercise appears in a new **"Added"** section below the main workout sections and is written into `localStorage` so it survives mid-session navigation
- Bottom sheet dismisses on backdrop tap or ✕

---

## Patch 28 · 2026-05-18
**Customise Multi-Select, Superset-from-Library, Client Routine Share, Drop-Set Simplification**

### Multi-select mode in Customise
- New **SELECT** toggle button in the day editor header enters multi-select mode (CANCEL exits)
- In multi-select mode: circular checkboxes appear on each exercise card; ↑↓ and individual × buttons are hidden
- Bottom action bar shows contextual CTAs based on the current selection:
  - **DELETE (N)** — removes all selected exercises in one save (any number selected)
  - **⟳ SUPERSET** — groups selected exercises as a superset (requires ≥ 2 selected)
  - **DROP SET** — sets `rest = 0` on all selected exercises, marking them as drop sets
- `+ Add Exercise` button remains accessible while in multi-select mode

### Superset button behaviour
- The **⟳ SUPERSET** button at the bottom of the exercise list now reacts to selection state:
  - 0 selected → opens the exercise browser in superset-pick mode (unchanged)
  - 1 selected → button reads `⟳ +1 MORE` with a hint styling
  - ≥ 2 selected → button lights up gold, reads `⟳ SUPERSET (N)`, and creates the superset directly on tap without opening the browser

### Add as Superset from library
- New **⟳ SUPERSET** shortcut button beside `+ Add Exercise` opens the browser in **superset mode**
- A gold "SUPERSET MODE" banner explains the flow; clicking exercises toggles selection
- `⟳ ADD N AS SUPERSET` CTA appears once ≥ 2 are selected; tapping it adds all as a new superset group to the plan
- Already-in-plan exercises are marked `IN PLAN` and dimmed in normal mode

### Drop sets via rest = 0
- Removed explicit NONE / ×1 / ×2 / ×3 drop chip row from each exercise card
- Drop sets are now signalled by setting rest to **0 (SKIP)** — the REST chip row is still present
- In the workout view: exercises with `rest === 0` automatically trigger the drop set panel after the main set logs (same weight pre-reduction, same yellow panel)
- `DROP` badge appears on exercise name header when `rest === 0`
- Legacy `dropSets > 0` values also trigger the drop panel for backward compatibility

### Multi-client routine share
- Sharing panel now shows the trainer's client list as selectable chips when `role === "trainer"` and accepted clients exist
- Multi-select chips → `SEND TO N CLIENTS` button loops through each and calls `POST /api/routines/:id/share`
- Username text input remains available below (separated by an "OR BY USERNAME" divider) for sharing with non-clients

---

## Patch 27 · 2026-05-18
**Supersets and Drop Sets**

### Supersets
- Any two consecutive exercises in the customize view can be paired as a superset using the new `⟳ SUPER` toggle (appears below the REST chips row on each exercise card)
- Paired exercises share a `groupId` and render as a visually connected block in the workout view — a `⟳ SUPERSET` bracket with a gold left border connects them
- Logging a set in a superset auto-advances to the next exercise in the pair with no rest in between — the LOG SET button shows `→ NEXT` as a hint; the input header names the coming exercise
- Rest timer fires only after the last exercise in the group completes its set for that round
- Unpairing: tapping `⟳ SUPER ✓` again removes the groupId from both exercises and restores independent behaviour

### Drop sets
- Each exercise can be assigned 0–3 drop sets via a `DROP +/-` counter (also below the REST chips row)
- A `DROP×N` badge appears on the exercise header in the workout view so users see the expectation before logging
- After logging the main set, a yellow-accented drop set panel slides in immediately (no rest)
- Weight is pre-reduced by ~20% each drop as a starting suggestion — fully adjustable with the same ± steppers
- Rest timer only fires after all drops are completed
- Drop sets can coexist with supersets (drops apply to the last exercise in a superset after the group round completes)

### Data model
- `PlanExercise`: added `groupId String?`, `groupType String?`, `dropSets Int @default(0)`
- Migration: `prisma/migrations/20260518_superset_dropset/migration.sql`
- `PUT /api/plan` updated to persist all three new fields

### Workout log
- Drop set entries keyed as `{exerciseId}-{setNum}-d{dropNum}` — backward compatible with existing log format

---

## Patch 26 · 2026-05-18
**Custom Rest Times per Exercise**

- Each exercise card in the user customize view now shows a row of preset rest chips: `30s / 45s / 60s / 75s / 90s / 120s / 180s`
- The plan-generated default is pre-highlighted in red — no action needed to keep it, one tap to override
- Changes are saved immediately to the database via the existing `PUT /api/plan` endpoint
- The same chip row is present in the trainer inline plan editor (chips highlighted in teal to match the trainer colour scheme)
- Rest time is still shown during the workout view exactly as before (`· {rest}s rest` on the exercise subtitle)

---

## Patch 25 · 2026-05-18
**Form Cues, Trainer MESSAGE Button, Equipment Display**

### Per-exercise form cues
- New `lib/formCues.ts` — 119 exercises covered, 2–3 cues each focused on muscle activation and correct form
- `getFormCues(exerciseId?, exerciseName?)` resolves by exercise ID first, then by normalised name match (substring/alias fallback)
- Cues render below the form demo image in the exercise form modal (slide 0) as numbered badges (1 / 2 / 3 in `#FF6644`) with cue text at 12px / 1.55 line height
- Visible in both the workout view FORM modal and the exercise browser FORM modal in the customise view

### Trainer MESSAGE button
- A `MESSAGE` button (teal, monospace, 11px) now appears next to the client username in the trainer's client detail header
- Tapping it opens the direct conversation with that client immediately via `openConversation({ id, username })`
- Removes the need to navigate back to the messages list to initiate a conversation from a client profile

### Equipment display fix (client profile tab)
- Equipment in the client's PROFILE tab previously rendered as a comma-joined string that overflowed into the label
- Now renders as a vertical per-item list — one line per equipment item — with the "Equipment" label above it

---

## Patch 24 · 2026-05-18
**Animated Workout-Type Icons**

### WorkoutTypeIcon component
- New `WorkoutTypeIcon` component renders a front-and-back block-figure SVG (200×168 viewBox, default height 62px) on each home screen workout card
- Title-based mapping: "Push" → chest + shoulders + triceps; "Pull" → back + biceps + rear shoulders; "Leg" / "Lower" → quads + glutes + hamstrings + calves; "Upper" → chest + shoulders + biceps + back + triceps; "Full Body" → all groups; "Cardio" / "HIIT" → full-body cardio pattern
- Block-figure style: `<rect rx>` shapes for clean rendering at small sizes — head, neck, torso, arms, forearms, thighs, shins drawn as rounded rectangles
- Front and back views separated by a hairline divider at the centre of the SVG

### CSS explosion animation
- `globals.css`: `@keyframes muscleExplode` — opacity 0.28 → 1 → 0.82 → 0.28 with `filter: drop-shadow` glow at peak using `var(--mc)` (the per-instance colour CSS custom property)
- `.ma` class applies the animation; `.md` is the dim default fill for inactive muscles
- Per-muscle stagger delays (`animation-delay`) so each muscle group fires in sequence — full-body workouts cascade visibly through every muscle
- CSS variable `--mc` set on the SVG element propagates to all child shapes sharing the same keyframe without duplication

---


**Anatomical Muscle Diagram + Sub-Muscle Detail System**

### Anatomical SVG body diagram
- Complete redesign of the front/back body diagram using bezier-curve anatomical paths — no more rectangles or ovals
- Every muscle group drawn to match real anatomy:
  - Pectorals: three-zone fan (upper/mid/lower + inner head strip)
  - Deltoids: lateral cap + anterior/posterior heads as distinct sub-zones
  - Latissimus dorsi: rounded triangle from armpit corner to lower-back point with concave outer edges
  - Trapezius: wider diamond reaching the acromion on both sides
  - Biceps: long head + short head + brachialis
  - Triceps: lateral head + long head + medial head
  - Quads: vastus lateralis, rectus femoris, VMO teardrop
  - Hamstrings, glutes, calves, forearms all redrawn proportionally
- `FiberGroup` renders thin stroke-only lines over each muscle to indicate fiber direction and grain
- Body figure proportioned with: arms spread wider from torso, legs spread at feet, calves shifted outward, deltoids laterally positioned so they no longer overlap the pectorals

### Sub-muscle zone detail
- New `lib/muscleDetail.ts` — `MUSCLE_DETAIL` map covering 60+ exercises with primary (`p`) and secondary (`s`) sub-muscle keys (e.g. `"chest-upper"`, `"biceps-long"`, `"shoulders-side"`)
- `lookupMuscleDetail(id?, name?)` resolves by exercise ID, then name alias, then substring match
- `MuscleDiagram` renders sub-zone fills: dim for all zones, orange for secondary, red + glow for primary
- `SUB_MUSCLE_LABELS` maps keys to display names shown as a legend under the diagram (e.g. "Lateral Delt", "Long Head", "Upper Chest")

### Bug fix: sub-muscle detail for exercises not in the EXERCISES library
- Exercises with custom or variant names (e.g. "Cable Flyes (Low-to-High)") previously showed no muscles in the workout modal because `lookupExMuscles` returned empty
- Fix: if `rawPrimary` is empty, `lookupMuscleDetail` is called and broad muscle names are derived by splitting sub-muscle keys on `"-"` (e.g. `"chest-inner"` → `"chest"`)

---

## Patch 22 · 2026-05-18
**UI Fixes — Split Date, Profile Format, History Labels, Chat, Sub-Muscle Names, Form Modal**

- Workout card last-done date now renders on its own line instead of inline with the subtitle
- Profile header stats formatting corrected (spacing, units)
- History tab session group labels fixed
- Chat / conversation link resolution fixed
- Sub-muscle detail names now display correctly in the diagram legend
- Form preview modal (FORM button) now accessible from the plan editor (Customise → Add Exercise browser), not only from the active workout view

---

## Patch 21 · 2026-05-17
**Exercise Form Preview Modal**

### Form preview modal
- New full-screen modal that animates between the start and end position JPG images from the free-exercise-db GitHub repository to demonstrate proper exercise form
- Image URLs follow the pattern `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{DB_ID}/{frame}.jpg` where frame is `0` (start) or `1` (end)
- Images alternate automatically every 900 ms; a START/END label overlays the bottom-right corner of the image
- If no image mapping exists for an exercise, the modal shows a graceful "No form demo available" message instead of hiding the button
- Tapping the dark backdrop or the × button closes the modal

### FORM button — workout view
- Each exercise row in the active workout view now has a small `FORM` button inline with the exercise name
- Tapping it opens the form preview modal without collapsing or logging the set (stopPropagation)

### FORM button — exercise browser
- Each exercise row in the Customise → Add Exercise browser also has a `FORM` button
- Tapping it opens the form preview modal without triggering the "add exercise" action (stopPropagation)

### lib/exerciseImages.ts
- New utility file mapping internal exercise IDs to free-exercise-db directory names for ~110 exercises across all muscle groups

---

## Patch 20 · 2026-05-17
**Body Metrics Edit + BMI Card + Settings: Location/Equipment/Focus Area + Regenerate Plan**

### Body metric editing
- Each history entry in the Body tab now has an edit (✎) button alongside the existing delete (×) button
- Tapping edit opens an inline form with date, weight, and body fat inputs pre-filled with the current values
- SAVE calls the new `PATCH /api/metrics/[id]` endpoint and updates the entry in-place (re-sorted by date)
- Cancel reverts without saving

### BMI card
- New BMI card inserted between the Goals section and the LOG TODAY section in the Body tab
- Only renders when height is set in the profile; uses the latest logged weight (or profile weight as fallback)
- Colour-coded category: Underweight (purple), Normal range (teal), Overweight (amber), Obese (red)

### ob staleness fix after logging
- After logging a body metric, `ob.weightKg` and `ob.bodyFatPct` are now updated in state immediately
- Settings → BODY & STATS form now reflects the latest logged values without requiring a page reload

### Settings: Location, Equipment, Focus Area
- LOCATION selector (Gym / Home / Both) added to the Settings BODY & STATS edit form
- EQUIPMENT multi-select (same options as onboarding) shown when location is not "gym"
- FOCUS AREA selector with all target areas (Balanced, Shoulders, Glutes, Back, Chest, Arms, Core, Legs, Rehab variants) added before SAVE CHANGES

### Regenerate Plan button
- REBUILD PLAN FROM SETTINGS button added below SAVE CHANGES in settings
- Tapping shows a confirmation card explaining the plan will be replaced
- CONFIRM REBUILD calls `POST /api/plan` and replaces `customPlan` state with the newly generated plan
- `EQUIPMENT_OPTIONS` and `toggleEquip` moved to component scope so they are accessible in both onboarding and settings

### API
- `PATCH /api/metrics/[id]` handler already existed; no new routes needed

---

## Patch 19 · 2026-05-17
**Body Trend Charts — Time-Scaled + Date Labels; Goals Cancel Fix**

### Time-scaled trend charts
- Weight and body fat trend charts now use a new `BodyTrendChart` SVG component
- X-axis positions are proportional to actual time between recordings — recordings a week apart are spaced further than recordings a day apart
- Date labels shown on x-axis (first recording, a middle point, most recent)
- Current value displayed as a large number in the chart header; latest dot is highlighted in full colour, older dots are dimmed
- Y-axis shows min and max values

### Goals cancel fix
- Opening the Goals EDIT dialog now snapshots the current values
- Cancelling restores the snapshot — previously, clearing the inputs then cancelling would leave the Goals section showing "—" until page reload (values were only in DB from last explicit SAVE GOALS, but local state was cleared)

---

## Patch 18 · 2026-05-17
**Bug fixes — Multi-goal toggle + Body metrics refresh**

### Multi-goal stale closure fix
- Fixed a stale closure bug in the goals toggle (both onboarding step 3 and Settings → BODY & STATS) where rapid taps could skip de-selection
- `onClick` now computes `isSel` inside the React state updater (`setOb(o => { const isSel = o.goals.includes(g.id); ... })`) so it always reads the latest state, not the render-time snapshot

### Body metrics not refreshing after Settings save fix
- After saving profile from Settings → BODY & STATS, `setBodyMetricsLoaded(false)` is now called so the Progress → Body tab re-fetches on next open
- Previously, body metric entries logged from a Settings save would not appear in Progress → Body history until app restart

---

## Patch 17 · 2026-05-17
**Multi-Goal Selection + Body Data Sync**

### Multiple goals
- Onboarding step 3 and Settings → BODY & STATS now allow selecting **multiple goals** simultaneously (Build Muscle, Get Stronger, Lose Fat, General Fitness)
- Tap to toggle — any combination is valid; checkmark shows selected state
- Plan generator blends volume parameters (sets, reps, rest) across all selected goals using an average: e.g. Muscle + Fat Loss → 3-4 sets, 10–16 reps, 60s rest
- Primary goal (priority: strength > muscle > fat_loss > fitness) determines the split type (PPL / Upper-Lower / Full Body)
- Fat Loss anywhere in goals adds cardio finishers to push and full-body days
- `UserProfile` stores `goals String[]` alongside legacy `goal String` — existing users retain their data; plan generation reads `goals[]` with `goal` fallback

### Body data sync (linked inputs)
- **Log in Progress → Body tab** → also updates `UserProfile.weightKg` and `bodyFatPct` (Settings reflects the latest value immediately)
- **Save in Settings → BODY & STATS** → also creates a `BodyMetric` entry if weight or body fat changed (Progress history updates automatically)
- Both directions keep the two screens in sync — only one source of truth

### Schema change
- `UserProfile`: added `goals String[]` field

---

## Patch 16 · 2026-05-17
**Personal Bests — Renamed + Reps Display**

- Renamed "PERSONAL RECORDS" → "PERSONAL BESTS" on the progress dashboard
- Each entry now shows the best weight **and** the rep count achieved at that weight (e.g. `80kg × 8 reps`)
- Tie-breaking: if two sessions share the same top weight, the one with more reps wins
- `getOverallStats` updated to store `reps` in `exercisePRs`

---

## Patch 14 · 2026-05-17
**Client History — Tappable Sessions with Exercise Detail**

- Each session card in the trainer's client HISTORY tab is now tappable
- Tapping expands the card inline to show every exercise from the client's plan day:
  - Logged exercises show each set: `S1 80kg×8  S2 75kg×6`
  - Exercises the client skipped show a **SKIPPED** badge in red
- Card header shows `X/Y exercises` count — amber if incomplete, teal if all done
- Collapse by tapping again; smooth `›` chevron rotation indicates state

---

## Patch 13 · 2026-05-17
**Saved Routines + Routine Sharing**

### Saved routines
- New **SAVED ROUTINES** section on the home screen (below the split cards)
- `+ SAVE` button saves the current plan under a custom name as a point-in-time snapshot
- List is **collapsed by default** — tap the header to expand; count badge shows total saved
- Collapsed state prevents accidental restores
- **RESTORE** replaces the active plan with the saved snapshot (confirm dialog)
- **✕** deletes the saved routine

### Routine sharing
- Each routine has a `↗` share button
- Tap it to open an inline username field — enter an exact username and hit SEND
- The routine is copied into that user's saved routines with "from @sender" attribution shown in teal
- Recipient can restore or delete the shared routine like any other

### New schema model
- `SavedRoutine`: `id`, `userId`, `name`, `planJson Json`, `sharedBy String?`, `createdAt`

### New API routes
- `GET /api/routines` — list user's saved routines
- `POST /api/routines` — save snapshot (`{ name, days }`)
- `DELETE /api/routines/[id]` — delete
- `POST /api/routines/[id]` — restore into active plan (replaces WorkoutPlan in a transaction)
- `POST /api/routines/[id]/share` — copy routine to another user by username

---

## Patch 12 · 2026-05-17
**Editable Profile in Settings**

- New **BODY & STATS** card in Settings / Account view
- Collapsed state shows a 6-cell stats grid: weight, height, body fat %, age, goal, days/week
- Tap EDIT to expand a full form with inputs for:
  - Weight (kg), Height (cm), Body Fat (%), Date of Birth
  - Gender, Goal, Fitness Level, Days per week (pill selectors)
- Saving calls `POST /api/profile` and updates `UserProfile` in the database
- Form pre-fills from the existing profile fetched on mount

---

## Patch 11 · 2026-05-17
**Active Workout Persistence + UX Fixes**

### Leave workout and return
- Users can now leave an active workout at any time via `← Home` in the workout header
- Session state (started, log, timer) is preserved in component state — returning to the workout view resumes seamlessly
- A separate `QUIT ×` button in the workout header abandons the session with confirmation

### Home screen active card
- The active workout day card gets a coloured border, **ACTIVE** badge, and live elapsed timer
- Other workout cards are dimmed to 30% opacity and non-tappable during an active session
- Session restore on page reload stays on home — user sees the active card, taps to resume

### Notification permission flow (fixed)
- In-app banner (teal card) shown on first visit for users who haven't granted/denied permission
- "Not now" dismisses persistently via `localStorage`; "ENABLE" triggers the native browser prompt
- Auth effects no longer call `subscribeToPush()` unconditionally — native prompt no longer appears on every page load
- `subscribeToPush()` is called silently only when permission is already `"granted"`

### MY CLIENTS always visible for trainers
- The MY CLIENTS section on the trainer's home screen now always renders even when there are no accepted clients
- Empty state: "No accepted clients yet"

### Swipe back navigation (widened)
- Swipe zone widened from 30px to 60px from the left edge for reliability on real devices
- Swipe-back supported in: conversation, messages, clientDetail, progress, settings, workout (when started)

---

## Patch 10 · 2026-05-17
**Body Metrics Tracking**

### Logging and history
- New **Body** tab in the Progress screen
- Log weight (kg) and/or body fat % with an optional date; stored as `BodyMetric` records
- History list shows all entries in reverse chronological order with a delete button per entry

### Goals
- Set a target weight and target body fat % from the Body tab
- Stored on `UserProfile` via new `PATCH /api/profile` endpoint
- Progress bars show current vs target with percentage complete

### Trend chart
- Line chart rendered as an SVG showing the last 12 weight entries
- Min/max labels on Y axis; date labels on first and last points

### New schema additions
- `BodyMetric` model: `id`, `userId`, `date`, `weightKg Float?`, `bodyFatPct Float?`
- `UserProfile`: added `targetWeightKg Float?`, `targetBodyFatPct Float?`

### New API routes
- `GET /api/metrics` — list user's body metrics (last 200, newest first)
- `POST /api/metrics` — log a new entry (`{ weightKg?, bodyFatPct?, date? }`)
- `DELETE /api/metrics/[id]` — delete a metric entry (ownership verified)
- `PATCH /api/profile` — update goal targets only (`{ targetWeightKg?, targetBodyFatPct? }`)

---

## Patch 9 · 2026-05-17
**Plan Proposals (Trainer → Client)**

### Trainer workflow
- In the client detail SPLIT tab, trainer can tap **EDIT PLAN** to enter an inline editing mode
- Each day's exercises are shown with editable set/reps/rest fields
- **PROPOSE CHANGES** sends the edited plan to the client as a special message

### Client workflow
- Plan proposal arrives as a `plan_proposal` message in the conversation
- Full plan preview is shown: all days with their exercises
- **ACCEPT** and **DECLINE** buttons appear below the preview
- Accepting replaces the client's active `WorkoutPlan` (transactional — atomic swap)
- Declining leaves the current plan unchanged
- Both actions update the proposal `status` in the database

### Notifications
- Push notification sent to client when a proposal arrives
- Push notification sent to trainer when client accepts or declines

### New schema additions
- `PlanProposal` model: `id`, `trainerId`, `clientId`, `status`, `planJson Json`, timestamps
- `Message`: added `proposalId String?` linking a message to a `PlanProposal`

### New API routes
- `POST /api/trainer/clients/[clientId]/proposal` — create proposal and linked message
- `PATCH /api/plan-proposals/[id]` — accept or decline (`{ action: "accept" | "decline" }`)

---

## Patch 8 · 2026-05-17
**Push Notifications + VAPID**

### Web Push setup
- `web-push` npm package (dynamic import in API routes to avoid build-time errors)
- VAPID keys stored as env vars; service worker (`public/sw.js`) handles push events
- `PushSubscription` model stores endpoint + keys per device (multiple devices per user supported)

### In-app permission banner
- Teal banner shown on first app load when permission is `"default"` and not previously dismissed
- "ENABLE" button triggers the native browser permission prompt then saves the subscription
- "Not now" stores `ironlog-notif-dismissed` in `localStorage` and hides the banner permanently
- Enable button also available in Settings if dismissed earlier

### Notification triggers
- **Rest timer complete** — fires from the service worker rest countdown; works when app is backgrounded
- **New message** — sent server-side when a message is created
- **Trainer request** — sent to user when a trainer sends a request
- **Plan proposal** — sent to client when trainer proposes a plan change
- **Proposal response** — sent to trainer when client accepts or declines

### New API routes
- `POST /api/push/subscribe` — save or update a device's push subscription
- `POST /api/push/test` — send a test notification to the current user's devices

---

## Patch 7 · 2026-05-17
**In-App Messaging**

### Message model
- `Message`: `fromId`, `toId`, `body`, `type` (text / plan_proposal), `read`, `requestId?`, `proposalId?`

### Conversations list
- Messages view shows all conversation threads sorted by most recent
- Unread count badge on the home screen nav (red dot with count)

### Conversation thread
- Real-time polling: incremental `?since=` fetch every second for new messages
- Messages grouped by sender with timestamps
- Incoming messages marked as read on open
- `plan_proposal` message type renders a full plan preview with ACCEPT / DECLINE buttons

### Swipe back
- Swipe right from the left edge to navigate back from a conversation to the messages list
- Same gesture works in client detail, progress, settings, and workout views

### New API routes
- `GET /api/messages` — list conversation threads with last message and unread count
- `GET /api/messages/[userId]` — thread with a specific user (supports `?since=` incremental)
- `POST /api/messages/[userId]` — send a message

---

## Patch 6 · 2026-05-17
**Trainer System**

### Role and upgrade
- Users can request a trainer role upgrade from Settings → TRAINER UPGRADE
- Upgrade is immediate (no approval required); role stored on `User.role`
- Trainer badge shown next to username on the home screen

### Finding clients
- Trainers can search for users by exact username via a search bar on the home screen
- Search results show username, workout count, and join date
- **SEND REQUEST** sends a `TrainerRequest` (pending → accepted)

### Client management
- Users see pending trainer requests in Settings and can ACCEPT or DECLINE
- Accepted clients appear in the **MY CLIENTS** section on the trainer's home screen
- Each client card shows workout count and last workout date; tap to open client detail

### Client detail view (3 tabs)
- **SPLIT** — client's current plan with all exercises per day; trainer can edit inline
- **HISTORY** — full session log; each session is tappable to see per-exercise detail
- **PROFILE** — client's body stats (age, weight, height, body fat %, goal, fitness level, location, equipment)

### New schema models
- `TrainerRequest`: `trainerId`, `userId`, `status` (pending/accepted/declined)
- `TrainerClient`: `trainerId`, `clientId` (unique — one trainer per client)

### New API routes
- `GET /api/trainer/search?q=` — find users by exact username
- `POST /api/trainer/request` — send a trainer request
- `GET /api/trainer/request/incoming` — list incoming requests for a user
- `PATCH /api/trainer/request/incoming` — accept or decline a request
- `GET /api/trainer/clients` — list accepted clients with stats
- `GET /api/trainer/clients/[clientId]` — client profile + history + plan

---

## Patch 6-prep · 2026-05-16
**Admin Panel + Icons**

### Admin panel at `/admin`
- Password-protected admin interface; navigate directly to `/admin` in the browser — no link from the app
- Login prompt accepts the `ADMIN_SECRET` env var value; key is sent as `x-admin-key` header on all API calls
- Unauthenticated requests return 401

### User management features
- **User list** — username, email, role badge, workout log count, join date
- **Delete user** — removes user and all cascaded data (profile, plan, logs); requires browser confirmation dialog
- **Role selector** — inline dropdown changes role (`user` / `trainer` / `admin`) instantly
- **Stats row** — total users, total workout logs, trainer count

### New API: `app/api/admin/route.ts`
- `GET /api/admin` — full user list with log counts
- `DELETE /api/admin` — delete user by `userId`
- `PATCH /api/admin` — update `role` field

### Schema change
- Added `role String @default("user")` to `User` model

### Icons
- `public/admin-icon.svg` — full-size admin panel icon
- `public/admin-favicon.svg` — tab-optimised version
- `public/favicon.svg` — red dumbbell browser tab icon
- Admin layout (`app/admin/layout.tsx`) references `admin-favicon.svg`

---

## Patch 5 · 2026-05-16
**Split Customisation — Add / Remove / Reorder Exercises**

### Per-day exercise editor
- CUSTOMISE button on the home screen opens a plan overview showing all days
- Tapping a day opens a full exercise editor with up/down reorder arrows, remove buttons, and an exercise browser
- Changes saved to the database via `PUT /api/plan`; reflected immediately in the workout view

### Exercise browser
- Searchable list of all 110+ exercises in the database, filtered live by name
- Selecting an exercise appends it to the bottom of the day's list

### API: `PUT /api/plan`
- Accepts `{ dayId, exercises[] }`, atomically deletes and recreates all `PlanExercise` rows for that day in the new order

---

## Patch 4 · 2026-05-16
**Onboarding Questionnaire + Personalised Plan Generation**

### 8-step onboarding questionnaire
- New users (no workout history) are shown a questionnaire before accessing the app
- Steps: days per week → goal → fitness level → training location → equipment → gender → date of birth → body metrics
- Existing users (have at least one workout log) skip the questionnaire

### Rule-based plan generator (`lib/planGenerator.ts`)
- Generates a fully custom workout plan from the user's profile — no AI API call needed
- Split logic: 2d → Full Body, 3d → PPL or Full Body ×3, 4d → Upper/Lower, 5d → PPL, 6d → PPL ×2
- Pulls exercises from `lib/exercises.ts` filtered by location, equipment, and goal
- Adjusts sets, reps, and rest per goal and fitness level

### New Prisma models
- `UserProfile`, `WorkoutPlan`, `PlanDay`, `PlanExercise`

### New API routes
- `GET/POST /api/profile`, `GET/POST /api/plan`

---

## Patch 3 · 2026-05-16
**Full Password Auth System + Email + Resume Overlay**

### Multi-step auth flow
- Username → register / setup / login based on account state
- Passwords hashed with `scrypt` (Node built-in `crypto`)
- Login accepts username or email

### Forgot password flow
- Emails a randomly generated temporary password; `mustResetPassword` flag set
- Must-reset screen shown on next login before app loads

### Email system (`lib/email.ts`)
- HTML emails with plain-text fallback; Gmail-compatible inline styles
- Welcome email + forgot password email via Google Workspace SMTP

### Resume workout overlay
- Full-screen overlay if a saved session exists in `localStorage`
- Shows workout name and elapsed time; single "GOT IT" button to resume

### Schema changes
- `User`: added `email`, `passwordHash`, `mustResetPassword`

---

## Patch 2 · 2026-05-16
**Session Persistence, Finish Review & Edit Sets**

- In-progress workouts saved to `localStorage` on every set logged
- Finish review overlay: editable duration, total sets, confirm before saving
- Edit any logged set mid-session via a full-screen overlay with ± steppers

---

## Patch 1 · 2026-05-16
**UI Fixes, Set Comparisons & Warmup Improvements**

- Portrait overflow fix: stepper buttons and input fields constrained correctly
- Set comparison tags: vs previous set (within session) and vs last session
- Warmup / cardio exercises: tap to mark done, row dims to 30% opacity
- Instruction hint: "Tap an exercise to log a set"

---

## v1.0 · Initial Build
**Full-stack PWA workout tracker**

- Next.js 14 + Prisma + PostgreSQL (Neon)
- 5-day PPL split (Push Heavy, Pull Width, Legs, Push Volume, Pull Thickness)
- Per-set weight and reps logging with ± steppers and last-session pre-fill
- Session timer and rest countdown with audio beep + push notification
- Progress screen: 28-day calendar, weekly streak, avg session time, personal bests, exercise analytics
- Cookie-based auth (`ironlog-uid`, 1-year, httpOnly)
- PWA manifest, service worker, install-to-homescreen support
