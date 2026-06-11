# IronLog full audit + improvement plan

Drafted 2026-06-10. Consolidates **eight parallel codebase audits**: visual/3D,
swipe-back & basic functions, leaderboards, plan builder, tutorial completeness,
test-user simulation + scoring internals, emoji→icon inventory, and a broad
functional bug sweep.

**Status: IN IMPLEMENTATION.** Held locally — @maaiz wants the whole backlog
done before any deploy. Progress log below; the workstream detail follows.

### Progress log
- ✅ **Phase 1 — data integrity** (`4b09500`): `lib/num.ts` safeFloat/safeInt;
  NaN guards in metrics/profile/photos APIs; goal-celebration finite guard;
  test-user tick → UTC midnight; corrected stale cron-time label. tsc + qa:scan
  clean. Also reviewed the test-user admin system (SEED/WIPE/ADVANCE/TICK,
  15 users, visibility-OFF default) — logical & safe, only the cron-time label
  was wrong.
- ✅ **Phase 2 — swipe & basic functions** (`7f533d3`): scroller-hijack guard,
  customise-view swipe-back, overlay-dismiss stack (~20 modals, × kept),
  groupChatPrevView persistence, swipe routes via goTo(,"back").
- ✅ **Phase 3 — leaderboards, core** (`732a2dc`, `220c775`, `bfee969`):
  30-day stats in computeStatsForUsers; global `window=30d` + deterministic
  tie-breaks; **group rankings + My Leaderboards default to a 30-day activity
  board** (LAST 30 DAYS / ALL-TIME toggle); tier fallback "—". Global keeps
  tier ranking. **Follow-up slice still pending:** trainer-badge backport to
  group/my-leaderboards/trainer-client rows (needs trainer tier in those
  routes), teal mode buttons, explicit My-Leaderboards header row.
- ✅ **Phase 4 — plan builder** (`d7cce84`, `8046806`): **fixed the warm-up
  equipment bug Mashir reported** (no-equipment primer + strict equipment
  matching — was prescribing a Stationary Bike to everyone); steady-cardio
  scales to the session window; ≥3-exercise-per-day guard; overhead-press
  home eligibility. Remaining (verification, not code): manually retest
  routines-save / supersets / dropsets; quality extras (volume balance,
  progression notes) are non-blocking. Known follow-up: Band Pull-Apart band
  check.
- ✅ **Phase 5 — tutorial catch-up + auto-update** (`7d341f4`): 9 new steps
  for surfaces that shipped without one; TUTORIAL_VERSION v7→v8; NEW
  `npm run tutorial:scan` (scripts/tutorial-scan.ts) flags any recent `## Feat`
  PATCHLOG section that never mentions the tutorial — the automatic
  keep-it-updated guard. Documented in feature-forcing-rules.md.
- ✅ **WS6 — test-user splits** (`1fe0283`): synthetic users follow a real
  split (full-body / upper-lower / PPL) keyed to daysPerWeek; only test users
  affected.
- ✅ **Phase 6 — visual/3D**: foundation (`096c401`) + surface adoption —
  chat bubbles (`c9607f9`), global input focus glow (`74f6960`), friend +
  customise-exercise rows (`28c1056`), DM empty-state card (`13de730`). The
  depth language is now applied across the audit's flagged flat surfaces.
  Further empty states / minor rows can keep adopting `.card-3d` incrementally.
- ⏳ **WS7 — icon wire-up**: ready, gated on external art (Batch 16 spec'd).
- ⏳ **Phase 3 follow-up** (cosmetic): trainer-badge backport (needs trainer
  tier in 2 routes), teal mode buttons, MyLB header row.
- ⏳ **WS7 — icon wire-up**: ready (Batch 16 spec'd; `TierGlyph` pattern
  exists) but gated on external art generation — no dead code added.
- ⏳ **Phase 3 follow-up**: trainer-badge backport (needs trainer tier in 2
  routes), teal mode buttons, MyLB header row.

---

## Decisions locked (from @maaiz, 2026-06-10)

1. **Leaderboard default metric:** **tier ranking**, not raw lifetime sessions
   (raw sessions = "oldest wins"). Newcomer catch-up handled by the 30-day lens.
2. **30-day lens:** YES. **Groups default to a rolling-30-day activity board**
   (tenure-neutral, a strong newcomer can top it immediately); **global ranks
   default to tier/all-time** (prestige). Both get an all-time ↔ 30-day toggle.
   ✅ confirmed.
3. **3D depth:** YES, subtle-premium for the IRON theme (extend the IDENTITY-card
   language); VIVID stays the loud option.
4. **Swipe feedback:** YES — add the sliding/dimming page animation.
5. **Modal edge-swipe = close:** YES — and **keep the × button too**.
6. **Chat styling:** groups stay visibly more premium than DMs, but lift DMs too.

---

## Cross-cutting CRITICAL bugs (fix first — data integrity)

These recur across the app and silently corrupt data or break features. One
small shared-utility pass kills most of them.

1. **`parseFloat` with no NaN guard → DB poisoning.** `app/api/metrics/route.ts:31-32`,
   `app/api/profile/route.ts:26-27,59-60,80,98-99`, `app/api/photos/route.ts:41`.
   Typing "abc" in weight/body-fat/height stores `NaN`, which then breaks tier
   scoring, body-comp trends, and display. **Fix:** a `safeFloat(v)` helper that
   returns `null` unless `Number.isFinite`, used at every parse site.
2. **Goal-reached celebration never fires** (`app/page.tsx:8173,8181`): compares
   `parseFloat(goalWeight)` to a number; if the target stored `NaN`, the compare
   is always false. Likely explains a "failing" QA item. Fix rides with #1.
3. **Timezone inconsistency in date math** — two places, same root cause:
   - `app/page.tsx:9076-9088`: `todayIso` is UTC but `last + "T12:00:00"` is local
     → wrong workout suggestion / streak miscount across the date boundary.
   - `lib/testUsers.ts:510`: simulated day bucketed at server-LOCAL midnight while
     streaks read UTC ISO → off-by-one streaks for test users.
   **Fix:** one shared `todayIso()/dayKey()` util used everywhere (all-UTC).
4. **~45 silent `.catch(() => {})`** in `app/page.tsx` (profile save line 1960,
   group-delete 13497, avatar equip, plan/leaderboard loads, …). Failures look
   like success → silent data loss + impossible debugging. **Fix:** at minimum
   `.catch(e => console.error(...))`; user-facing toast on the critical paths
   (profile, plan, metrics, message-delete, avatar).

---

## Workstream 1 — Swipe-back & basic-function correctness

Mechanism: `useSwipeBack` (`app/page.tsx:687-722`) + `swipeBackViews`
(`7178-7192`), left-edge 60px, no visual feedback. 14/16 views covered.

**Bugs**
- 🐛 **Left-edge horizontal-scroller hijack** (`app/page.tsx:10452,10613,13088`):
  scrolling equipment-tag/substitute carousels near the left edge fires
  navigation. Fix: in `onTouchStart`, don't arm if an ancestor is
  horizontally scrollable (`scrollWidth > clientWidth`).
- **`customise` view has no swipe-back** — add it (needs a `customisePrevView`
  memory, entered from home OR workout).
- **`groupChatPrevView` lost on reload** (`app/page.tsx:6821`) → wrong back
  target. Persist to sessionStorage.

**Coverage (decision #5)** — overlay-stack swipe-dismiss: instead of adding ~12
modals one-by-one, open modals push a close-fn onto a stack; `useSwipeBack` pops
the top overlay first, then falls back to the view chain. Covers profile-preview,
tier modal, day-card expand, daily quest, weekly recap, exercise/session pickers,
substitution, history, note. Keep the × on all of them.

**Polish** — add the sliding/dim page-transition animation (decision #4;
framer-motion is already in the bundle).

**Verify sweep** — confirm pull-to-refresh (3 chat surfaces) and 350ms-hold
drag-reorder don't regress; each view's × target matches its swipe target.

---

## Workstream 2 — Leaderboards (logic + consistency + visual)

Six surfaces: global athlete, global trainer, trainer-clients block, group
rankings (trainer view), My Leaderboards (Progress), group-chat standings.

**Logic (the substance)**
- **Unify ranking:** default = **tier/headline score** everywhere, with
  deterministic tie-breaks (score → sessions → username). Today global ranks by
  tier, groups by raw sessions, trainer-clients by sessions — same person ranks
  differently per surface. (`global/route.ts:192`, `page.tsx:14250`).
- **30-day lens** (decision #2): groups default 30-day, global default all-time;
  toggle both. Scoring audit confirms most sub-ranks are ALREADY windowed
  (Consistency 180d, Habits/Balance 14d, Strength rate, Progression); only
  **Volume, Technique, Strength-absolute** need new 30-day computations added to
  `computeStatsForUsers` (`lib/leaderboardStats.ts:549-645`).
- **`viewerRank` can be null** when the viewer is filtered out (coached filter) —
  compute pre-filter so "Your rank: #N" always shows.
- **Null body metrics** silently sink members in WEIGHT/BF modes — add a
  "Log weight/body fat to appear here" hint instead.

**Consistency**
- **Trainer badge everywhere** (open ask `trainer-badge-everywhere`): only the
  global athlete board shows it; backport to group rankings, My Leaderboards,
  trainer-clients rows.
- **My Leaderboards has no column headers** — add them.
- Unify mode-button accent (trainer view uses red, others gold/teal → teal),
  unify row padding (10px 12px), trim the 7-col trainer-clients block.
- Tier fallback `?? "Kitten"` mislabels missing tiers → show "—".

**Visual** (rides with Workstream 6): alternating rows, medal glow, current-user
glow row, consistent empty states, raster medals (image-gen Batch 16).

---

## Workstream 3 — Plan builder

Generation (`lib/planGenerator.ts`) is solid for standard splits; gaps:

**Bugs**
- **Cardio days ignore `targetSessionMinutes`** (tightening logic only hits
  strength days, `planGenerator.ts:752-788`) — adapt cardio length too.
- **A day can generate with too few/0 exercises** when every option for a muscle
  is equipment-gated (`.filter(Boolean)` drops nulls) — add a "≥3 per day" guard
  + fallback.
- **Over-gated library exercises**: `requireAll` on incline curl (needs dumbbell
  AND bench), OHP/preacher-curl flagged gym-only (`lib/exercises.ts`) — loosen so
  home users keep viable picks.

**Coverage** — thin calves/core/forearms libraries; bodyweight-only plans repeat
~4 moves all week with no progression ladder.

**Untested/regression flows to verify** — `routines-save` (save-as-routine may
not be wired in the UI at all), `plan-customise-superset`, `workout-dropsets`,
`plan-customise-add-remove` (fallback-day clone).

**Quality (non-blocking)** — weekly volume-balance check, session-time realism
estimate, progressive-overload/deload notes, calisthenics progression notes.

---

## Workstream 4 — Tutorial completeness

24 steps (v7), ~55% coverage, several forcing-rule violations. Add steps for
(high→low impact): **RPE/effort logging** (feeds scoring+deload, undocumented),
**rest timer UI**, **cardio logging**, **bodyweight/body-fat entry**, **Daily
Quest**, **deload week**, **weekly recap**, **PB celebrations**, and the **entire
trainer family** (clients hub, custom-exercise create/edit, propose-metrics,
trainer tier). Clarify steps 9 (sub-ranks listed with no definitions), 2 (QA, too
verbose), 16 (achievements jargon). Bump `TUTORIAL_VERSION` once when the batch
lands. Going forward, hold the forcing rule (every shipped surface → a step).

---

## Workstream 5 — Visual modernisation + 3D depth

Polish is uneven: home/workout/profile/tier-modal already premium; flat spots =
chat bubbles, exercise browser, friends/clients lists, leaderboard rows, inputs,
empty states, onboarding, wellness sections.

- **5a. Foundation:** shared depth tokens in `globals.css` (`.card-3d`,
  `.card-3d-hover`, `.press-3d`, `.focus-ring`, `.glow-*`), all flattened by the
  MONO theme override. Everything else reuses these.
- **5b. Surfaces, priority order:** chat bubbles (groups > DMs, decision #6) →
  exercise browser/customise rows → leaderboard rows (with WS2) → friends/clients
  → inputs (focus ring) → empty states (gradient card + real CTA) → wellness
  (colored per-metric borders) → onboarding (parallax + progress) → micro-polish
  (checkbox spring, tier-ladder glow, modal confirm/delete gradients).

---

## Workstream 6 — Test-user realism

The cron IS running (`vercel.json` daily 23:00 UTC, idempotent, archetype-driven
via `lib/testUsers.ts`) — good. Gaps:
- **Timezone day-bucket bug** (`testUsers.ts:510`) — fix with the shared date util
  (cross-cutting #3).
- **Splits aren't modeled** — every archetype cycles the same fixed 8-lift
  rotation regardless of its assigned plan. @maaiz specifically wants them to
  follow their split. Drive `buildSession()` from each user's actual PlanDays
  (muscle focus + planned rest days) instead of the fixed list.

---

## Workstream 7 — Emoji → premium icons

`TierGlyph` (`app/page.tsx:135`) already does image-with-emoji-fallback for tier
badges — the proven pattern. Generalise it to a small `<IconGlyph>` wrapper and
migrate the highest-visibility emoji: **5 nav hub glyphs + 3 leaderboard medals**
(new **Batch 16** appended to `image-prompts-v2.md`) and the **14 sub-rank icons**
(**Batch 8**, already spec'd, still pending art). Daily-quest + achievement-
category icons are lower-priority future batches. Art generation is external; the
wire-up (≈20 lines + wrapper) ships when PNGs land.

---

## Recommended phasing (each = one deploy)

| Phase | Contents | Why first |
|---|---|---|
| **1 — Data-integrity** | Cross-cutting #1–#4: `safeFloat` + NaN guards, shared UTC date util (fixes streaks + test-user buckets + goal celebration), de-silence critical catches | Highest user impact, smallest surface, unblocks correct scoring |
| **2 — Swipe & basic functions** | WS1: scroller-hijack, customise view, overlay-stack dismiss + × , groupChatPrevView, slide animation | Core "does it work" pass you asked for |
| **3 — Leaderboards** | WS2 logic + 30-day lens + consistency + row visual pass | Biggest competitive/fairness win |
| **4 — Plan builder** | WS3 bugs + guards + verify untested flows | Core feature correctness |
| **5 — Tutorial catch-up** | WS4 missing steps + clarity + version bump | Clears forcing-rule debt |
| **6 — Visual/3D** | WS5 tokens + chat bubbles + inputs, then the rest | Premium feel |
| **(rolling)** | WS6 test-user splits; WS7 icon wire-up as art lands | Independent |

## Open items for @maaiz

- Phase order above OK, or pull anything forward? (I'd start Phase 1 — the
  data-integrity bugs are quietly hurting real scoring today.)
- Test-user splits: drive from each user's real PlanDays (more realistic, more
  work) vs a per-archetype split template (simpler)? Recommend real PlanDays.
- Tutorial: one big catch-up step-batch now, or fold steps in per feature as we
  ship each workstream? Recommend the latter for the trainer family, a small
  batch now for the existing debt (RPE/rest/cardio/quest/deload/recap/PB).
