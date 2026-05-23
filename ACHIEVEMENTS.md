# Achievements system — design doc (v1)

Planning artefact for the achievements feature. NO code shipped yet —
this is the spec the next slice will build against. Tracked in
`qa-state.json` as `achievements-v1` (untested / planning).

---

## TL;DR — recommended shape

- **Where:** new **Achievements** sub-tab inside the **Progress** view
  (alongside Dashboard / Body / etc.). NOT Profile — Profile is
  identity-focused; achievements are progression-focused.
- **What:** ~25 achievements grouped into 6 categories. Tap any tile
  → modal with description, criterion in plain English, progress bar,
  unlock date if earned, and the avatar reward (if applicable).
- **Reward:** **6 count-milestone avatars** (3/6/10/15/20/25
  achievements unlocked) — see `image-prompts-v2.md` Batch 5. No tier
  score bonus, no badge points; achievements are bragging-rights +
  avatar collectables.
- **Notification:** toast (same pattern as `tier-promotion-toast`) when
  a new achievement unlocks during gameplay. Suppressed for the
  initial backfill on rollout day (otherwise existing users would get
  a wall of toasts).
- **Data:** new `UserAchievement` table (Prisma) — one row per
  unlock with `(userId, achievementId, earnedAt)`. Computed on the
  fly per session-save + on the daily test-user tick; idempotent
  on retry.

---

## Why Progress, not Profile

Considered three locations:

| Surface | Pros | Cons |
|---|---|---|
| **Profile (Settings)** | Already shows tier badges + avatar gallery; users associate "rewards" with identity | Settings is admin-style — pref toggles, account info. Achievements are progress, not config. Wrong mental model. |
| **Progress tab** ✅ | Already houses Dashboard / Body / "what have I done" data. Achievements = milestones over time. Natural fit. | Adds a new sub-tab — slight nav weight. |
| **Dedicated /achievements page** | Maximum prominence | Buries it behind a separate route; users don't go there cold. |

**Pick: Progress tab → new "Achievements" sub-tab.** Reasoning:

1. **Mental model match.** Progress is "show me what I've accomplished
   over time". Achievements are exactly that — discrete milestones.
2. **Discoverability.** Users already visit Progress to look at the
   dashboard heatmap and body trends. The new tab sits one tap away,
   not behind a separate top-nav button.
3. **Cross-link opportunity.** From Achievements tab, link selected
   tiles back into the Dashboard ("see the volume chart that powered
   this") — keeps the Progress experience cohesive.

The avatar gallery stays in Profile because avatars ARE identity. The
"unlock new avatar at N achievements" affordance gets a single small
**"+1 toward next avatar unlock"** chip on the Achievements tab so the
link between the two surfaces is obvious without duplicating the avatar
grid.

---

## Categories + initial catalogue (~40 achievements)

Nine categories. Numbers chosen to be earnable (no impossible grind)
but not trivial. The count-milestone avatar system (Batch 5) treats
ALL of these as 1 point each — there's no "rare" achievement weighted
higher than "common"; each one is one tile to collect.

**Note on PB scoring:** per @maaiz's confirmation, personal bests for
**leaderboards + tier scoring** use **e1RM** (Epley formula: `weight ×
(1 + reps/30)`), so a 100kg × 5 lift and a 120kg × 1 are roughly
equivalent. This means the "1RM Cheater" achievement under the Meme
category is a wink at users who exploit the 1-rep slot for an
inflated raw-weight PB number; the actual STRENGTH sub-rank already
discounts it via e1RM. See `lib/tiers.ts` `strengthSubRank()` +
`lib/performance.ts` `estimate1RM()`.

### 💪 Strength (6)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `str-first-rep` | **First Rep** | Log ANY working set | Day-1 win, gets users into the rhythm |
| `str-plate-loader` | **Plate Loader** | One working set ≥ 60kg on any compound | Real-weight milestone |
| `str-hundred-club` | **Hundred Club** | One working set ≥ 100kg on any compound | The first big number |
| `str-big-three` | **Big Three Hundred** | Sum of best squat + bench + deadlift e1RM ≥ 300kg | Powerlifting tradition |
| `str-rate-up` | **Trending Up** | e1RM trend on top-3 lifts > +5% over 90 days | Rewards actual strength progress, not just volume |
| `str-double-bw` | **Double Bodyweight** | One working set with weight ≥ 2× user's bodyweight (deadlift / squat usually) | The classic powerlifting flex |

### 🔁 Consistency (6)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `con-week-1` | **Week One** | Train 3+ days in a single calendar week | Onboarding milestone |
| `con-month-1` | **First Month** | 12+ sessions in a single calendar month | Sustained commitment |
| `con-streak-7` | **Iron Week** | Hit weekly target (`daysPerWeek` from profile) for 4 consecutive weeks | Tests adherence, not raw count |
| `con-comeback` | **Comeback Kid** | Log a session after a 14+ day gap | Rewards getting back on the horse — don't punish breaks |
| `con-half-k` | **Half-K** | 500 lifetime sessions | Long-haul recognition |
| `con-rest-respect` | **Rest Day Respect** | Perfect adherence (no overtraining) for 8 consecutive weeks | Counter-narrative to "more is better" — moved from Wellness so the category math is even |

### 📈 Volume (4)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `vol-ten-k` | **Ten K Tonner** | 10,000 kg-reps lifetime | First volume milestone |
| `vol-hundred-k` | **Hundred K Hauler** | 100,000 kg-reps lifetime | Mid-game milestone |
| `vol-million` | **Megalift** | 1,000,000 kg-reps lifetime | Long-tail recognition |
| `vol-week-warrior` | **Volume Week** | 5,000+ kg-reps in a single calendar week | Short-term burst |

### 🏆 Variety (5)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `var-fifteen` | **Versatile** | 15 distinct exercises trained (≥4 sets each) | Solid programming proof |
| `var-thirty` | **Exercise Encyclopaedia** | 30 distinct exercises trained (≥4 sets each) | Power-user level |
| `var-equipment-adventurer` | **Equipment Adventurer** | Train with all 4 main equipment types (barbell + dumbbell + cable/machine + bodyweight) in 30 days | Rewards mixing modalities |
| `var-anatomy-geek` | **Anatomy Geek** | Train every muscle group (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core) in a single calendar month | Forces well-rounded programming |
| `var-plan-architect` | **Plan Architect** | Save 3 custom routines in the routine vault | Power-user nudge for the routine system |

### 💧 Wellness (3)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `wel-hydration-week` | **Hydration Hero** | Hit hydration target 7 days in a row | Easy onboarding to wellness |
| `wel-sleep-month` | **Sleep Scholar** | Log sleep 28 days in a row | Habit-formation level |
| `wel-body-comp-30` | **Tracking Beast** | Log weight or body fat 30 days in a row | Body comp data discipline |

(`wel-rest-respect` moved into Consistency where it conceptually fits.)

### ⚡ Technique (5) NEW

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `tec-superset-25` | **Superset Sniper** | Complete 25 supersets | Existing IP system tracks these |
| `tec-superset-100` | **Superset Architect** | Complete 100 supersets | Heavy-user tier |
| `tec-drop-50` | **Drop Chain Devotee** | Complete 50 drop sets | Existing IP system tracks these |
| `tec-drop-250` | **Drop Set Demon** | Complete 250 drop sets | Heavy-user tier |
| `tec-honest-logger` | **Honest Logger** | Log RPE on 100 sets | Rewards effort discipline (feeds the IP RPE bonus + Strength trend) |

### 🏃 Cardio / HIIT (7) NEW

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `car-hiit-survivor` | **HIIT Survivor** | Complete 10 HIIT circuit days | Rewards opting into the HIIT day in plan settings |
| `car-treadmill-time` | **Treadmill Tactician** | Accumulate 5 hours total treadmill / cardio-machine time | Existing cardio sub-flow tracks minutes |
| `car-speed-demon` | **Speed Demon** | Single treadmill session ≥ 14 km/h average for 5+ minutes | Tempo run flex |
| `car-endurance-hero` | **Endurance Hero** | Single cardio session ≥ 60 minutes | Long-form effort recognition |
| `car-marathon-month` | **Marathon Month** | Accumulate 42.2 km of estimated cardio distance in a single calendar month | Long-distance running equivalent without needing GPS |
| `car-century-club` | **Century Club** | 100 km lifetime estimated cardio distance | Mid-game milestone |
| `car-iron-thousand` | **Iron Thousand** | 1,000 km lifetime estimated cardio distance | Apex endurance recognition (months-to-years to earn) |

**Distance estimation formula:**

Per @maaiz: machine inputs already capture `minutes` and `speed` — combine
those to derive a rough distance per cardio set when the user hasn't
typed a `distance` value directly:

```ts
// in lib/cardioStats.ts (new):
export function cardioSetDistanceKm(set: {
  minutes?: number;
  speed?: number;     // km/h
  distance?: number;  // km, if user logged it directly
}): number {
  if (typeof set.distance === "number" && set.distance > 0) return set.distance;
  if (typeof set.minutes === "number" && typeof set.speed === "number" && set.minutes > 0 && set.speed > 0) {
    return (set.minutes / 60) * set.speed;
  }
  return 0;
}
```

Use this same helper everywhere distance matters:
- The 3 distance-based achievements above (`car-marathon-month`,
  `car-century-club`, `car-iron-thousand`)
- A future **"Distance" leaderboard column** on the global / group
  boards (e.g. weekly km, all-time km)
- A future **Cardio dashboard card** in Progress → Dashboard ("18.4
  km this week")

The estimation is *rough* on purpose — speed × time ignores incline
adjustments + interval pacing. For the leaderboard surface, add a tiny
ⓘ tooltip: *"Distance is estimated from machine time × speed when no
direct distance is logged."*

**Cardio-input feature dependency:** the user previously flagged
"treadmill/cardio machine time and speed can be user input with system
suggestions". Cardio sets already accept `{minutes, incline, speed,
distance}` inputs in the in-session UI (`logSet` opts.cardio). The
"system suggestions" piece is already partially built via
`suggestCardio()` in app/page.tsx. The distance helper above closes
the achievement loop without needing GPS or a new input field.

### 🤸 Warmup/Cooldown (3) NEW

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `wc-warmup-streak` | **Warmup Disciple** | Mark ALL warmup sets ✓ DONE (not SKIP) for 10 consecutive sessions | Rewards injury-prevention discipline |
| `wc-cooldown-streak` | **Cool Customer** | Mark ALL cooldown sets ✓ DONE for 10 consecutive sessions | Same |
| `wc-full-prehab` | **Full Prehab** | Both warmup AND cooldown perfect for 30 consecutive sessions | Apex tier of prehab discipline |

### 🌟 Milestones (5)

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `mil-tier-fox` | **Sharpened** | Reach Fox tier (T2) | First tier climb |
| `mil-tier-big-dawg` | **Big League** | Reach Big Dawg tier (T3) | Mid-tier badge |
| `mil-tier-lion` | **Pride** | Reach Lion tier (T4) | Top-half recognition |
| `mil-become-trainer` | **Coach** | Have your trainer-role request approved (User.extraRoles includes "trainer") | One-time identity transition |
| `mil-profile-polished` | **Profile Polished** | Complete every profile field (dob, gender, height, weight, body fat %, avatar selected, fitness level, daysPerWeek) | Tracks user investment in the system |

(Higher tiers — Gorilla / Bear — gate their own avatar slot anyway; no
need to duplicate via achievements. Trainer-leaderboard milestones —
e.g. roster size 5 — could be added in v2 alongside more trainer
content.)

### 😂 Meme / Funny (4) NEW

Easter-egg style achievements that reward weird or amusing behaviour.
Per @maaiz's "funny achievements" ask. Kept tonally light in the
description copy so users smile when they unlock them.

| ID | Title | Criterion | Reward note |
|---|---|---|---|
| `meme-1rm-cheater` | **1RM Cheater** | Log a 1-rep set at ≥150% of your typical working weight for that exercise (PR padding) | Wink at users who exploit the 1-rep slot. Their tier Strength sub-rank already discounts it via e1RM averaging across all sets — this is a meta-acknowledgement. Copy idea: *"You 1-repped 150% of your usual. Sus, but we logged it. Your e1RM trend isn't fooled."* |
| `meme-vampire` | **Vampire Lifter** | Log a session starting between 00:00 and 04:00 local time | Night-owl recognition |
| `meme-crack-of-dawn` | **Crack of Dawn** | Log a session starting before 06:00 local time | Morning-shift recognition |
| `meme-rest-rebel` | **Rest Day Rebel** | Train 14 days in a row (anti-pattern of `con-rest-respect`) | Both rest-respecter and rest-rebel can earn an achievement — they're orthogonal life-styles, not opposites |

---

### Final catalogue size

| Category | Count |
|---|---|
| 💪 Strength | 6 |
| 🔁 Consistency | 6 |
| 📈 Volume | 4 |
| 🏆 Variety | 5 |
| 💧 Wellness | 3 |
| ⚡ Technique | 5 |
| 🏃 Cardio / HIIT | 7 |
| 🤸 Warmup/Cooldown | 3 |
| 🌟 Milestones | 5 |
| 😂 Meme | 4 |
| **Total** | **48** |

The 6 count-milestone avatars (3/6/10/15/20/25 unlocks) feel properly
paced against 48 achievements — even casual users can hit a 3-avatar
threshold quickly, while the 25-achievement apex avatar remains a
real climb. If we add the 7 "open for discussion" suggestions below
that lifts the total to 55 and we'd likely want a 7th avatar
threshold (35 unlocks → 7th milestone avatar). Easy to add later.

---

## My suggestions you might want to add (open for discussion)

A few more ideas I think would land well — bring up if you want any:

- **`var-routine-sharer` — Routine Sharer.** Share a saved routine
  with another user via the existing "+ SHARE" affordance. Rewards
  community use.
- **`var-note-taker` — Note Taker.** Add notes to 25 sets (long-press
  on a logged set chip). Rewards the under-discovered note feature.
- **`mil-globe-walker` — Globe Walker.** Appear on the Global
  leaderboard at least once (the ≥5 sessions qualification). Rewards
  publicly competing.
- **`mil-group-joiner` — Squad Up.** Join your first leaderboard
  group. Rewards social use.
- **`tec-speedrun` — Speedrun.** Complete a workout with ≥10 sets in
  under 30 minutes (real time, not perceived). Rewards efficient
  programming.
- **`tec-long-hauler` — Long Hauler.** Single workout > 90 minutes
  with ≥20 sets. Rewards the marathon training day.
- **`meme-sandbagger` — Sandbagger.** Entire workout logged at RPE ≤
  3 (you're saving yourself, we noticed). Funny callout, no penalty.

Total possible: 45 + 7 = 52. If we add ALL my suggestions, the avatar
count system might want a 7th milestone (e.g. "all 50 unlocked →
final avatar"). Easy to add later if the user base actually grinds
through 45+. Flag if you want these in v1 vs deferred.

---

## Cardio-input feature ask (from @maaiz, deferred for separate slice)

> "treadmill/cardio machine time and speed can be user input with
> system suggestions"

This is already PARTIALLY implemented. Looking at the code:

- `logSet` accepts `opts.cardio: { minutes, incline, speed, distance }`
- `app/page.tsx` line ~14010 has a cardio-specific input panel for
  cardio exercises with the right inputs
- `suggestCardio()` in `lib/performance.ts` returns suggested values
  based on last session

What's missing or worth checking:
1. **System suggestions visibility** — is the ★ SUGGESTED affordance
   on the cardio inputs as prominent as on weight×reps? Verify via
   QA.
2. **Cardio exercise discovery** — does the user know they can pick
   a treadmill / bike / rower exercise into their plan? Maybe needs
   a small nudge in customise.
3. **Cardio-history surface** — Progress dashboard could show
   "total cardio minutes this month" as a card. Currently the volume
   heatmap focuses on lifting.

Spin this up as `cardio-input-polish` qa item if you want it tracked.
For achievements v1, the existing cardio sub-flow is enough to power
the 4 cardio achievements above.

---

## Reward integration: count-milestone avatars

Per @maaiz: "more avatars that unlock by achievement-unlock count".
Implementation:

- Add `source: "achievement"` to the `AvatarSource` union in `lib/avatars.ts`.
- Add an `achievementCount: number` field on `Avatar` (analogous to
  `tier: number` on tier-source avatars).
- 6 milestone avatars defined in `image-prompts-v2.md` Batch 5
  (spark → blacksmith).
- Avatar minting in `/api/avatars` GET: after the existing
  `tierAvatarsAtOrBelow` backfill, compute earned-achievement count
  and mint any achievement-source avatars where `achievementCount ≤
  earnedCount`. Idempotent via existing `UserAvatarUnlock.@@unique
  userId+avatarId`.
- No score bonus — these are pure cosmetic collectables.

---

## Data model

### New table

```prisma
model UserAchievement {
  id            String   @id @default(cuid())
  userId        String
  achievementId String
  earnedAt      DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementId])
  @@index([userId])
}
```

Idempotent via the unique constraint. `earnedAt` lets us:
- Sort earned achievements newest-first in the UI
- Show "unlocked X days ago" in the detail modal
- Reconstruct an achievements timeline later if we ever want it

### Computation surface

A new `lib/achievements.ts` module exports:

```ts
export type AchievementDef = {
  id: string;
  category: "strength" | "consistency" | "volume" | "variety" | "wellness" | "milestone";
  title: string;
  description: string;          // 1-2 sentences shown in the detail modal
  icon: string;                  // emoji glyph for the tile
  // Pure function: returns { unlocked: boolean, progress: 0..1, current?: number, target?: number }
  // given the user's current stats. progress=1 → unlocked.
  evaluate: (s: AthleteStats) => { unlocked: boolean; progress: number; current?: number; target?: number };
};

export const ACHIEVEMENTS: AchievementDef[] = [/* 25 entries */];

export function evaluateAll(stats: AthleteStats): Array<{
  def: AchievementDef;
  status: "locked" | "in-progress" | "unlocked";
  progress: number;             // 0..1
  current?: number;
  target?: number;
}>;
```

Pure stats → evaluation function. No side effects. Persistence (the
`UserAchievement` rows) happens in the workout-save endpoint or on a
periodic check — see "Server hooks" below.

### Server hooks

Two surfaces fire achievement evaluation:

1. **Workout save** (`/api/workout` POST) — after the existing PB +
   lucky-drop side effects, compute the user's earned achievements,
   diff against `UserAchievement` rows, and INSERT any newly-met ones.
   Return the newly-unlocked list in the response payload so the
   client can fire the toast.
2. **Test-user cron tick** (`/api/admin/test-users/cron-tick`) —
   same evaluate-and-insert call so test users accumulate
   achievements over time.

NO standalone "evaluate all users daily" cron — the workout-save hook
covers organic users; the test-user cron covers test users. If a user
edits an old log via EDIT SETS, the next workout save will pick up
any new achievements that the edit enabled.

---

## UI design — Progress tab → Achievements sub-tab

### Tab nav

Progress view currently has tabs like `Dashboard / Body / etc.`. Add
**Achievements** as a new tab. Default to Dashboard (current behaviour);
deep-link friendly via `?tab=achievements`.

### Top strip

A compact summary above the grid:

```
ACHIEVEMENTS                                              13 / 25
[████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] +2 to next avatar
```

Showing `<earned>/<total>` + progress to the next avatar threshold.
Tap "next avatar" → opens the Avatar Picker page focused on the
upcoming achievement-source avatar.

### Grid

Category-grouped, each category has its own subhead and a 3-column grid
of tiles. Tile states:

- **Locked** — greyscale icon, "?" overlay, no progress bar visible
- **In progress** — coloured icon at ~70% opacity, ring progress
  indicator around the circular tile, label visible
- **Unlocked** — full-colour icon, small ✓ in corner, earned date
  whispered below

Tap any tile → modal with:
- Full description
- Criterion in plain English ("Reach Big Dawg tier — currently at
  Fox tier (T2/T3 climbing)")
- Progress bar with current/target
- Earned date (if unlocked)
- Avatar reward callout (if applicable — e.g. "Unlocks the Spark
  avatar — 3rd achievement total")

### Empty / new-user state

Brand-new user (0 achievements earned) sees a friendly hero block:

> 🌱 **No achievements yet — log your first set to earn the First Rep
> badge.** Achievements are milestones that track your training over
> time. They live on this page; some unlock new avatars too.

Then the grid below shows ALL achievements in "locked" state for
discoverability.

---

## Notification UX

Mirror the existing `tier-promotion-toast`:

- One-time fire when a new achievement crosses from "in-progress" to
  "unlocked"
- Toast appears at top of screen, dismissable on tap, auto-dismiss
  after 4-5s
- Stores last-known earned count in localStorage so we don't re-toast
  across refreshes
- **Suppress on initial backfill** — first time the API responds with
  achievements for a pre-existing user (rollout day), we silently set
  the local marker to whatever they already have so they don't get
  hit with 20 toasts in a row

For multi-unlock cases (rare but possible): if the workout-save
response includes 2+ newly-unlocked achievements, fire a single
"X achievements unlocked!" toast that opens the Progress →
Achievements tab on tap.

---

## Tracking + rollout plan

### qa-state items to add

- `achievements-v1` — the system foundation (catalogue + computation + UI + toast). Status `untested` until shipped.
- `achievement-avatars` — the 6 count-milestone avatars + the
  `source: "achievement"` minting path. Depends on Batch 5 images +
  `achievements-v1`.
- `progress-tab-achievements-subtab` — the UI sub-tab specifically (so QA can isolate that regression target).

### Implementation slices

1. **Slice 1 (foundation):** new `lib/achievements.ts` catalogue +
   `UserAchievement` schema + workout-save hook. Backfill on first GET.
   No UI yet — verify in admin tools that test users start accumulating
   rows.
2. **Slice 2 (UI):** Progress → Achievements sub-tab with grid + tile
   modal. Read-only, no notification yet.
3. **Slice 3 (notification):** unlock toast wired to workout-save
   response. localStorage suppression for initial backfill.
4. **Slice 4 (avatar rewards):** Add the 6 count-milestone avatars to
   `lib/avatars.ts`, wire achievement-source minting in
   `/api/avatars` GET, drop images into `/public/avatars/`.

Each slice ships independently — Vercel deploys cumulative. After
Slice 4 lands, tick the CLAUDE.md achievement reminder and bump the
qa-state items to `regression-retest`.

---

## Open questions (decide before Slice 1)

- **Should rare or in-progress achievements show a hint?** Currently
  spec says "lock = ? overlay". Should it show the title + a teaser
  ("Reach this milestone…") so users have something to chase?
  *Recommendation:* show the title always, hide only the description
  until in-progress. Pure-mystery achievements feel unfair on mobile.

- **Trainer-specific achievements?** Spec covers athlete behaviour
  only. Could add "First Client", "Five-Client Roster", "Client PR
  Coach" etc. in a follow-up batch under a new `trainer` category.
  *Recommendation:* defer to v2 — keep v1 catalogue tight at 25.

- **Achievement points → tier score bonus?** Tempting but conflicts
  with the recent `tier-scoring-v2` cleanup that removed the silent
  `tierScoreBonus` injection. Achievements should stay pure
  collectable, no score side-effect.
  *Recommendation:* keep separate.

- **Re-evaluate frequency for non-workout achievements** (hydration
  streak, body comp tracking) — workout save is the trigger, but the
  user might hit a wellness milestone WITHOUT logging a workout that
  day. Either:
  (a) Add a lightweight "/api/achievements/recheck" endpoint called
      from the wellness logging surfaces, or
  (b) Just compute on next workout-save (eventual consistency, may
      delay the toast by a day).
  *Recommendation:* option (a) — small extra endpoint, fires from
  `writeHydrationToday` / `writeSleepToday` write paths. Cheap +
  feels responsive.
