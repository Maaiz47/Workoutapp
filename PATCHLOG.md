# IRONLOG — Patch Log

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
