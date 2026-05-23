# IRONLOG — Patch Log

---

## Feat · 2026-05-23 — Balance sub-rank (9th dim, muscle-group coverage) (qa: tier-balance-subrank)

Per @maaiz: "Maaiz has clearly been skipping leg day · How is he being penalised for neglecting areas? Should he be?". Audit: nothing in the 8-dim scoring system penalised muscle-group neglect — a user could bench + curl every day and still rocket up the ladder.

New **Balance** sub-rank (9th dim) — rewards covering all 7 major muscle-group buckets in the last 180 days:
- `chest` · `back` · `shoulders` · `arms` (biceps + triceps + forearms) · `quads` · `posterior` (hamstrings + glutes + calves) · `core`

Each bucket needs **≥8 sets in the last 180 days** (about one session's worth) to count as "covered". Score = `(coveredBuckets / 7) × 100`.

- Skipped (hasData=false) until the user has ≥8 lifetime sessions so brand-new accounts aren't penalised.
- A leg-skipper drops to ~57 (4/7 buckets) and the EARN MORE POINTS tip card surfaces the missing buckets explicitly: "missing: quads, posterior, core".
- A balanced lifter hits 100. A powerlifter doing Big 3 + accessories naturally lands at 85-100 because deadlift + squat + bench tag back / posterior / chest / shoulders / core.

Implementation: new `setsByMuscleGroup: Record<string, number>` input on `AthleteStatsForTier`. Populated by both `computeStatsForUsers` (server-side leaderboard pipeline, imports `EXERCISES` for primary-muscle lookup) and the client-side `myAthleteBreakdown` useMemo (inlined `toBucket` mapper). Each set counts at most ONCE per bucket so multi-muscle exercises (deadlift hits back + posterior + core) contribute to multiple buckets cleanly without inflating.

Tip library extended with a `balance` key — 3 actionable nudges focused on legs / core / coverage.

---

## Fix · 2026-05-23 — Hide BW toggle on principally-weighted exercises (qa: weight-input-convention-clarity)

Per @maaiz: "Shouldn't be able to select bodyweight at all on non body weight exercises like bench press or anything involving dumbbells as a principal". The `BW` chip used to appear for ALL non-bodyweight exercises so you could mark e.g. a bench press as "bodyweight today" — which was nonsense for principally-weighted movements.

Toggle is now hidden when `loadingKindFor(equipment)` returns `"barbell"`, `"dumbbell"`, or `"machine"`. Users wanting to log a true bodyweight variant should pick the BW exercise from the catalogue (e.g. Air Squat instead of Barbell Back Squat). Still available for `"other"` / mixed-equipment exercises.

---

## Fix · 2026-05-23 — Barbell weight-input convention always visible (qa: weight-input-convention-clarity)

Per @maaiz: "Nothing helping users know in the session on the exercise that the weight input for barbell exercise needs to be in the format of both side plates plus the bar weight". The plate-breakdown hint only fired once the user entered ≥20 kg, so before that they had no idea the input expected total (including bar).

Now the helper renders the moment a barbell exercise is open — even with the input empty — reading `🏋 TOTAL WEIGHT — INCLUDES BAR + BOTH SIDES · Olympic bar = 20kg` (or `EZ bar ≈ 10kg` for EZ-curl detected by name match). As soon as the user enters a weight ≥ the bar weight, the same chip flips to the existing live plate breakdown plus the bar label.

EZ-bar detection: exercise name match on "ez bar" / "ez-bar" / "ez curl" → 10 kg default. Everything else → Olympic 20 kg.

---

## Polish · 2026-05-23 — Tutorial v6, README catch-up, BIG label truncation, CLAUDE.md image-gen tracker (qa: tier-modal-action-tips, docs-catch-up)

Per @maaiz: "have you been updating tutorial, qa, patch log, readme, and other necessities?" — PATCHLOG + qa-state were current but tutorial + README had fallen behind. Catch-up pass:

- **Tutorial bumped v5 → v6** (`lib/tutorial.ts`). Existing users will see the refreshed tutorial once on next load. New steps added: floating bottom hub, tier-badges + EARN MORE POINTS tips, dashboard layout reorder, milestones-v2 (bodyweight + warmup/cooldown + premium avatars), monthly challenges rotation, friends-and-groups (group chat in Messages inbox + invite-friends-to-groups), profile-settings (sticky floating ⚙ pill). Updated existing steps: feedback-fab (now a side tab), supersets-dropsets (now feeds Technique sub-rank), tier-sub-ranks (now 8 dims incl. Technique + absolute strength). Renamed v5 → v6 forces the tutorial overlay to resurface once for existing users.
- **README.md** rewritten: Messaging section now covers group conversations in the inbox + avatars/tiers side-by-side. NEW Leaderboard Groups + Tier System (v3.2) + Achievements/Milestones sections covering everything shipped since v1.1.0. Progress section updated to reflect the new dashboard order.
- **BIG label bug**: tier dot-bar abbreviated labels by splitting on space + slicing 8 chars, so "Big Dawg" rendered as "BIG" and "Hall of Fame" as "HALL". Now uses the full label (no split, no slice). Per @maaiz: "Bigdawg... says only big in the tier progress bar".
- **CLAUDE.md image-gen tracker** updated to reflect actual shipped progress: 22/63 images live (Batches 1 + 2 + 3 + 6 + trainer tier badges), 41 pending across stretches, achievement avatars, trainer tier unlocks, sub-rank icons, category icons, and the new Batch 10 premium milestone avatars.

---

## More polish + bugs · 2026-05-23 — Profile cap, sticky Settings toggle, group chat back-nav, in-chat leaderboard fix (qa: home-hub-premium-polish, settings-toggle-sticky-floating, group-chat-back-nav, group-chat-leaderboard-fetch)

Per @maaiz:

- **Profile button** previously grew to fill the trainer+athlete two-row tier card height (~140px square), squeezing the tier card to a thin sliver. Capped at `maxHeight: 92` with `alignSelf: center` so it sits nicely centred next to the tier card without bullying it for width.
- **Settings toggle** in the profile view was a barely-visible chip in the header. Promoted to a **floating sticky pill** at top-right of the viewport — gold gradient when in Profile (says "⚙ SETTINGS"), teal gradient when in Settings (says "👤 PROFILE"). Visible from any scroll position.
- **Group chat back-nav**: swiping out (or tapping ← Back) used to always go to `groupsHub` regardless of where the user came from. Now tracks `groupChatPrevView` at open time — coming from the Messages inbox returns to "messages"; coming from the Groups view returns to "groupsHub".
- **In-chat leaderboard panel** was empty for users who opened a group chat directly from the Messages inbox (lbGroups never loaded). Now fetches `/api/leaderboard/groups` on chat open if lbGroups is empty.

---

## More home polish · 2026-05-23 — Profile button matches tier card height + feedback FAB to side tab (qa: home-hub-premium-polish, feedback-fab-side-tab)

Per @maaiz:

- **Profile button** now uses `aspect-ratio: 1 / 1` + `height: 100%` so it auto-resizes to a SQUARE matching the tier card's height (which grows when the trainer row is present). Grid `alignItems: stretch` so both columns share row height; tier card's `1fr` width fills the rest. Min-height 72px so single-row athletes still get a comfortable target.
- **Feedback NOTE FAB** moved from the bottom-right pill to a slim side tab on the right edge, anchored at 75% of the viewport height. Default state shows only a ‹ chevron in a 32×40 teal half-pill; tapping opens the existing full feedback form unchanged. Out of the way of the floating bottom hub + main content.

---

## Home polish · 2026-05-23 — Floating bottom hub + My Exercises closed by default (qa: home-hub-floating, my-exercises-collapsed-default)

Per @maaiz:

- **My Exercises** (trainer-only section on home) is now collapsed by default. Header is tappable to expand; chevron ▼/▲ shows state; "+ NEW" button auto-expands the list. Toggle persists to localStorage (`ironlog-my-exercises-open`).
- **Bottom hub** (Messages / Progress / Ranks / Groups / Friends / Clients) is now FIXED-FLOATING. Sits at `position: fixed; bottom: 0` with safe-area inset padding + glass-blur background + thin top border. Added a bottom spacer to the home view so the last card isn't covered by the floating hub.

---

## Tier modal polish · 2026-05-23 — Bigger badges, fix GORILL truncation, earn-more-points tips (qa: tier-modal-action-tips, home-hub-premium-polish)

Per @maaiz: "tier badges need to still be showed larger especially inside the tier modal", "gorilla is displaying as gorill at the bar", and "Make suggestion steps to users to collect more tier points".

- **Headline tier icon** in the breakdown modal bumped 58 → 82 px so the tier badge actually dominates the modal header.
- **Tier ladder strip** in the modal — current icon 22 → 36 px, others 16 → 28 px so the whole row reads chunky and proportional to the headline.
- **GORILL → GORILLA**: ladder strip label was sliced to 6 chars (`label.slice(0, 6)`), truncating "Gorilla". Now uses the full label with `wordBreak: break-word` so longer tiers wrap to two lines if needed. Same fix on `CompactTierDotBar` (slice 6 → 8).
- **NEW: "⚡ EARN MORE POINTS" tip card** under the Path-to-Next callout. Surfaces 2-3 concrete actions tailored to the user's WEAKEST sub-rank (e.g. for Technique: "Tag a superset → +5 IP / session", "Run a drop chain → +3 IP", "Tag RPE on hard sets"). Per-dim tip libraries cover all 8 sub-ranks (consistency / strength / progression / volume / mastery / technique / bodycomp / habits).

---

## Fix · 2026-05-23 — All leaderboard rows showed as Kittens (CanonicalTier missing tierNum) (qa: tier-num-on-canonical)

Per @maaiz: "Why are all the test users kittens?". Traced the bug to `lib/leaderboardStats.ts`: `CanonicalTier` interface carried `idx` (0-based position) but NOT `tierNum` (1-based canonical rank). The leaderboard APIs read `s.tier.tierNum ?? 1`, which always fell back to 1 (= Kitten) for everyone.

Verified by querying the deployed `/api/leaderboard/global` as `test_veteran_chen`:
- Score 74 (correctly mapped to T5 Gorilla via the v3.2 calibration)
- `tierNum: 1` returned for ALL rows → frontend rendered every row as Kitten via `tierByNum(1)`

Fix: added `tierNum: number` to the `CanonicalTier` interface and populated it in `buildCanonicalTier` from `t.tierNum`. Now every API consumer sees the correct rank.

---

## Achievements + challenges expansion · 2026-05-23 — Bodyweight milestones, warmup/cooldown habits, monthly challenge library, premium bonus avatars (qa: achievements-bodyweight-benchmarks, achievements-warmup-cooldown-habits, monthly-challenges-library-rotation, achievements-premium-bonus-avatars)

Per @maaiz: "Which major exercise have milestones? I expect bench press, push ups, sit ups, bicep curls, pull ups etc etc · Some bodyweight movements, stretching/warmup milestones ones could be good too · I want some of the harder milestones to also unlock some premium, extra bonus avatars - add to generate prompts list" + "Check if monthly challenges are actually realistic but challenging, make a large library to rotate 3 randomly every month" + "Check global averages and make milestones scaled accordingly".

### Bodyweight benchmarks (lib/milestones.ts)
Added 14 bodyweight rep-count milestones across 5 movements. Thresholds calibrated against global fitness benchmarks (US Army APFT, Marine Corps PFT, ACSM norms, NSCA testing). Each movement has 3-4 progressive tiers, with the top one flagged `premium: true` so it also unlocks a bonus avatar:

- **Push-ups**: 20 (avg adult fit) → 50 (solid) → 100 (top 5%) → **200 ELITE (Marine Corps)** 🏛️
- **Pull-ups**: 5 (adult fit) → 10 (solid) → 20 (advanced) → **30 ELITE (Army max-score)** 👑
- **Sit-ups**: 50 (solid) → 100 (APFT max-tier) → **200 ELITE** 🌊
- **Dips**: 10 (beginner-solid) → 25 (advanced) → **50 ELITE** 🚀
- **BW squats**: 50 (avg) → 100 (solid) → 250 (trained) → **500 ELITE (iron-mind)** 🌋
- **Bicep curls (weighted)**: 20kg / 30kg / 40kg

Counter helpers: new `bestRepsForNames(state, names[])` matches the existing `bestForNames` pattern but operates on a new `maxRepsByName` field. `app/page.tsx` walks history once to populate.

### Warmup / cooldown habit milestones
First-use flags already existed (`first-warmup`, `first-cooldown`). Added six habit-formation milestones based on lifetime counts:
- Warmups: 10, 50, 200 sessions
- Cooldowns: 10, 50, 200 sessions

New `warmupSessionCount` / `cooldownSessionCount` counters added to `MilestoneState`, populated from the same per-session loop in app/page.tsx.

### Monthly challenge library + rotation
Expanded from **3 hardcoded challenges** to a **21-entry library** with deterministic monthly rotation. `getMonthChallenges(monthIso)` hashes the iso month and picks one MODEST + one SOLID + one HARD challenge, so every user sees the same 3 each month but the trio rotates fresh each month.

Library covers:
- Rep counts on specific exercises (push-ups, pull-ups, sit-ups, BW squats, curls, triceps, rows, presses, dips, bench, deadlift) — 13 entries
- Session count: 16 / 22 / 26 — 3 entries
- Total volume: 50k / 100k / 200k kg — 3 entries
- Variety: 15 / 25 distinct exercises — 2 entries

Targets calibrated against the v3.2 tier-scoring simulation data (a typical 6mo dedicated user does ~250k/month volume, ~80 sessions/3mo so ~26/mo cap is achievable but hard). Backward-compatible: `export const CHALLENGES` still works and returns this month's rotation.

### Premium bonus avatars (schema only — images pending)
Added a new `AvatarSource = "milestone-bonus"` type alongside `"tier"` and `"lucky"`. Five new bonus avatars in `lib/avatars.ts` tied 1-to-1 to the elite bodyweight milestones via `unlocksMilestoneId`:

| Avatar | Milestone | Flavour |
|---|---|---|
| `mb-pushup-elite` | 200 push-ups | 200-Push-Up Crown |
| `mb-pullup-elite` | 30 pull-ups | 30-Pull-Up Champion |
| `mb-situp-elite` | 200 sit-ups | 200-Sit-Up Sovereign |
| `mb-dip-elite` | 50 dips | 50-Dip Phenom |
| `mb-bwsquat-elite` | 500 BW squats | 500-Squat Titan |

Exported `MILESTONE_BONUS_BY_MILESTONE_ID` lookup for the avatar mint pipeline (server-side `/api/avatars` POST/GET — to be wired in a follow-up). Image-gen prompts added to `/image-prompts-v2.md` as **Batch 10** (5 images, ~125 KB compressed).

---

## Big bundle · 2026-05-23 — Group convs in Messages, friends→groups, dashboard reorder, version reset, avatar tier label, calendar verified (qa: messages-group-inbox, groups-friend-invite, dashboard-kpi-top, wellness-open-by-default, profile-avatar-tier-label, version-patch-reset-on-minor)

Per @maaiz "fix everything then deploy" — bundling a stack of UX fixes
into one push.

### Group conversations land in the Messages inbox
- `/api/messages` GET now returns both `conversations` (DMs) and
  `groupConversations` (every group the user is a member of with the
  latest GroupMessage summary + member count).
- Frontend renders a unified, latest-activity-sorted list. DM rows
  unchanged; group rows wear a gold "premium banner" treatment with a
  GROUP · N chip and the last sender / system event in the preview.
- Unread tracking is localStorage-based via
  `lastSeenGroupAt[groupId]` — flips to "seen" the moment the user
  opens the group chat. Gold NEW chip on rows with messages newer
  than the seen timestamp.

### Athletes can invite their friends to groups
- `/api/leaderboard/groups/[id]/invite` extended: any group member
  can invite their accepted friends; backend validates the friendship
  before creating the invite. Trainer-to-trainer invite flow unchanged.
- Invitees join as "client" role on accept (mirrors the existing
  trainer "+ ADD CLIENTS" placement on the rank ladder).
- Frontend: new "+ ADD FRIENDS" section in each group panel, visible
  to any member with accepted friends. Lists every friend with three
  states — INVITE / INVITED / MEMBER — mirroring the trainer flow.

### Dashboard ordering + Wellness
- KPI cards (THIS WEEK / STREAK / AVG TIME) promoted to the TOP of
  the Progress dashboard. Were buried below tier breakdown + wellness
  before; now they're the first thing the user sees.
- Wellness card moved up to sit right under the KPIs.
- WellnessCard now defaults to OPEN — only collapses if the user
  explicitly closed it (localStorage `ironlog-wellness-open === "0"`).

### Avatar tier label fix
- `Unlocks at Tier N` tooltip in the avatar picker was using raw
  internal `av.tier` (1=lowest) while the chip label used
  `displayTierNum(av.tier)` (1=top). They now both use display
  numbering — consistent with the rest of the app.

### Version patch counter reset
- `/api/version` was concatenating ALL historical PATCHLOG section
  counts onto the `1.1.X` patch number. Subtracts the pre-v1.1
  baseline (30 sections) so the next deploy reads `1.1.<small>`
  instead of `1.1.112+`. Future major.minor bumps just need a new
  offset constant.

### Calendar intensity color map — verified working
- Per @maaiz "Is the calendar intensity color map working?". Traced
  the formula at lib/page.tsx:1742: `intensity = volume × (avgRpe/10)`
  per day, normalised across all-time max, ramped 0.18 → 0.73 opacity
  in coral red. Working as designed; if you see a specific day that
  isn't colouring, tell me the date and I'll trace it.

### Deferred to next bundle (not in this push)
- Monthly challenges audit + larger library + 3-random-rotation.
- Milestone audit + bodyweight (push-ups, pull-ups, sit-ups) + warmup
  / stretching milestone batches.
- Premium "bonus" avatars unlocked by hard milestones + corresponding
  image-gen prompts in /image-prompts-v2.md.

---

## Home strip polish + chat de-emoji · 2026-05-23 (qa: home-hub-premium-polish, chat-no-emoji)

Per @maaiz screenshot feedback:

- **Profile button no longer squished.** Grid changed from `60px 1fr · alignItems: stretch` to `auto 1fr · alignItems: start`; profile button is a fixed 72×72 square that sits at the top of the cell. No longer stretches tall when the tier card grows.
- **Tier card rows restructured.** Icon is now 36px and fills the row height vertically; label + score-to-next + progress bar share the right side of each row in a flex column. Per row: `[36px tier icon] [label · T# / +N→NEXT / dot-bar stack]`. Reads way clearer.
- **Reply-arrow emoji removed from message bubbles.** The `↩` glyph was permanently rendered next to every incoming chat message even though the comment said "fades in as user swipes". Swipe-to-reply still works via the touch handlers — just no visual emoji glyph cluttering the view.

---

## Tier scoring v3.2 · 2026-05-23 — Absolute-strength blend + Technique sub-rank (qa: tier-strength-absolute-blend, tier-technique-subrank)

Per @maaiz follow-up after v3.1: dedicated users were still capping at T4-T5 around 12mo and DROPPING back to T4 at 24mo due to rate-based strength/progression decay. v3.2 fixes both structural issues plus wires the gamification rewards into the tier headline.

### Fix A — Absolute strength blend (`lib/tiers.ts:strengthSubRank`)

`strengthSubRank` now computes BOTH:
- **Rate** (unchanged): -5% / +20% e1RM half-vs-half mapped to 25-100
- **Absolute** (new): top e1RM ÷ current bodyweight, mapped 0.5× → 20, 1.0× → 40, 1.5× → 60, 2.0× → 80, 2.5× → 100

Final Strength = **max(rate, absolute)**. Veterans plateaued at elite numbers ride absolute; novices on a tear ride rate; nobody gets caught between them.

Signature change: `strengthSubRank(recentByExercise, todayMs, currentBodyweightKg?)`. `computeAthleteTier` passes `s.weightCurrentKg` automatically. `CanonicalTier` consumers transparent.

### Fix C — New Technique sub-rank

Added 8th sub-rank scored from `WorkoutLog.intensityPoints`. Each session can earn up to 25 IP (superset = +5, drop chain = +3). Lifetime sum runs through `scoreFromCount(IP, 200)` → 50 IP ≈ 57, 200 IP ≈ 77, 500 IP ≈ 90.

`AthleteStatsForTier` gains `totalIntensityPointsLifetime?: number`. `computeStatsForUsers` already aggregates this — just plumbed it through to `buildCanonicalTier`.

### Longitudinal re-projection (post v3.2)

| Months in | Munchy | Alla |
|---|---|---|
| 2wk | 42 / T3 | 37 / T3 |
| 1mo | 56 / T4 | 51 / T4 |
| 3mo | 64 / T4 | 60 / T4 |
| 6mo | **71 / T5** ✓ | 68 / T4 (just shy) |
| 9mo | 73 / T5 | 68 / T4 |
| 12mo | 75 / T5 | 70 / T5 ✓ |
| 18mo | 78 / T5 | 73 / T5 |
| 24mo | **77 / T5** (no more regression) | 74 / T5 |

T6 Bear still aspirational — theoretical elite tops out around 85. Configurable later if we want T6 reachable.

---

## Tier scoring calibration v3.1 · 2026-05-23 — Dial back v3 so 6mo dedicated users reach T5 (qa: tier-scoring-calibration-v3)

@maaiz follow-up: "if you mean they are T4 at 6 months that's too slow". v3 over-corrected — dedicated 6mo+ users were trapped at T4 Lion. v3.1 walks back the more aggressive bits:

- `scoreFromCount` denominator multiplier 10× → 5× (was 3× originally; 5× is the middle ground — gives ~74 at midpoint instead of ~80 at 3× or ~60 at 10×).
- Consistency `sessions180d` midpoint 100 → 80 (3.1×/wk benchmark, more reachable for committed weekly trainers).
- Mastery midpoint 25 → 20 (was 18 originally).
- Volume sqrt ceiling 5M → 3M kg-reps. 1M → 58, 2M → 82, 3M → 100. Years of training still hit 100 but 6mo dedicated lifters get a believable 55-65 instead of <50.
- Adherence cap stays at 90 (the v3 fix that should stay).
- Strength range stays at -5%..+20% (also a v3 keeper).

Re-simulated against the same 10 personas:

| Persona | Score | Tier |
|---|---:|---|
| 3mo casual | 64 | T4 Lion |
| 6mo dedicated | **70** | **T5 Gorilla ✓** |
| 1yr serious | 73 | T5 Gorilla ✓ |
| 8mo veteran | 70 | T5 Gorilla |
| Plateauer | 55 | T4 Lion |
| Inconsistent | 42 | T3 Big Dawg |
| Grinder | 69 | T4 Lion (just shy) |
| Quitter | 39 | T3 Big Dawg |
| Elite (1yr+, 20% gain) | 75 | T5 Gorilla |

Maaiz / Munchy / Alla as 3-6mo dedicated users should now land in the T4 → T5 transition rather than getting stuck at T4 or rocketing to T5 too early.

---

## Tier scoring calibration v3 · 2026-05-23 — Slow down upper-tier progression (qa: tier-scoring-calibration-v3)

Per @maaiz: "maaiz munchy and alla have too fast a progression in tiers" — traced the curves and they were inflating across the board. A typical 6-month user was landing at T5 Gorilla / Diamond; should be T4 Lion / Platinum.

Changes to lib/tiers.ts:

- **scoreFromCount denominator widened** 3× → 10× — log curve now hits ~60 at midpoint instead of ~80. Combined with the midpoint bumps below, this stretches every sub-rank's meaningful range so users don't saturate every dimension by 6 months.
- **Consistency sessions180d midpoint** 60 → 100. 100 sessions in 180d = full 4×/wk for the entire window (was 2.3×/wk → 79 score; now 4×/wk → 75-ish).
- **Adherence cap** 100 → 90 — hitting your `daysPerWeek` target every week is high but no longer maxed. Excellence (strength gains, volume, mastery) is what drives the headline above the cap. Overtraining-penalty ramp starts from 90.
- **Strength range** -5%..+15% → -5%..+20%. 0% gain → 40, 10% → 70, 20% → 100. Was previously +15% → 100 which let novice gains jump too easily.
- **Volume curve** replaced log-`scoreFromCount` with a sqrt-based scaler against a 5M kg-reps ceiling. The old log curve saturated at 90+ by 6mo of moderate lifting; sqrt (1M → 45, 2M → 63, 5M → 100) keeps diminishing returns but stretches the range so years of training actually differentiate from months.
- **Mastery midpoint** 18 → 25 — needs 25 exercises with ≥4 sets in 180d to hit midpoint instead of 18.

Verified against synthesised 6-month user profiles for each test-user archetype + a few hand-crafted personas (sim script at `/tmp/simulate-tiers.ts`):

| Persona | Pre-v3 | Post-v3 |
|---|---|---|
| 3mo casual (Maaiz-style) | ~72 → T5 Gorilla | 61 → T4 Lion |
| 6mo dedicated (Munchy/Alla-style) | ~75 → T5 Gorilla | 64 → T4 Lion |
| 1yr serious | ~78 → T5 Gorilla | 67 → T4 Lion |
| Plateauer | ~67 → T4 Lion | 50 → T4 Lion (just inside) |
| Inconsistent | ~52 → T4 Lion | 40 → T3 Big Dawg |
| Quitter | ~46 → T3 | 38 → T3 |
| Elite (1yr+, 20% gain, max log) | ~85 → T5 Gorilla | 72 → T5 Gorilla |

Score-band reading post-v3: T3 = established, T4 = committed (most users), T5 = elite gains across all dims, T6 = aspirational ceiling.

---

## Home chip strip refactor + enlarged tier badges + daily quest hides when done · 2026-05-23 (qa: home-hub-premium-polish, home-hub-singleline, tier-icons-vivid, tier-icons-simple, tier-icons-trainer, profile-avatars-everywhere, daily-quest-hide-when-done)

Per @maaiz on this iteration:

- Still emoji in the athlete tier chip on home — fixed L9409 (athlete-tier button inside the welcome card was the one site missed in the full sweep; now wired to `<TierGlyph>`).
- Top chip strip refactor: Progress button removed from the top chip strip and relocated back to the bottom hub (between Messages and Ranks). Top strip is now a clean `[Profile-avatar | Tier-card-far-right]` pair on a `60px 1fr` grid — the Tier card claims the rest of the width and visibly anchors the right edge.
- Tier badges enlarged: home tier chip strip went from 11px → 20px inline glyphs (next to label). Leaderboards (mine + groups + global + discovery groups) now render the tier badge at **24px — same size as the avatar chip** so the two icons feel balanced next to each user. The redundant tier label glyph on the second line was removed (it was repeated at chip size; the 24px badge does the visual work now).

## Daily quest tweaks · 2026-05-23 (qa: daily-quest-hide-when-done)

Quest chip now hides entirely once `q.isDone(state)` returns true — was previously flipping to a green "✓ DONE" state but staying visible. Per @maaiz: "Daily quest still doesn't complete and go away when done." The achievement is recognised elsewhere (hydration ring fills, PB toast etc.) so swallowing the chip on completion clears clutter on the home view. The chip's deep-link behaviour stays for the not-yet-done state.

The quest pool (lib/gamification.ts) currently has 14 quests — q-hydrate, q-train, q-rpe, q-sleep, q-energy, q-pr-hunt, q-double, q-variety, q-volume, q-superset, q-dropset, q-cardio, q-warmup-perfect, q-body-metric. `pickTodayQuest(userId)` deterministically picks one per user-per-day from this pool.

---

## Profile avatars on leaderboards + chats · 2026-05-23 — Avatar chip next to tier icon everywhere a user is listed (qa: profile-avatars-everywhere)

Per @maaiz: "I want the profile avatars to show where appropriate like message logs and in chats, and on leaderboards along with their tier icon next to each other."

Shipped a new `<UserAvatarChip avatarId={...} username={...} size={N} role={...} />` helper in app/page.tsx that resolves the user's equipped avatar from `lib/avatars.ts` and renders a circular chip (with role-aware default avatar fallback for trainers, then initial-letter circle if even the default 404s). Drop-in next to existing tier icons everywhere a user appears in a list.

Surfaces wired this pass:
- **Group chat messages** — `/api/leaderboard/groups/[id]/messages` now includes `fromAvatarId` on each message. Chat row prepends an 18px avatar chip next to the `@username` label.
- **Group leaderboard sidebar** (chat-attached "🏆 STANDINGS" mini list) — 20px avatar chip + tier glyph next to username, all inline.
- **Group leaderboard rows** (main `lbMode` modes — sessions / weight / BF) — 24px avatar chip beside the username/tier-label two-row block.
- **Global leaderboard rows** (`/leaderboard` view) — 24px avatar chip beside username/tier-label block, anonymous rows force the default avatar so the toggle still hides identity.
- **Discovery groups leaderboard** (the leaderboard panel inside each "join this group" card) — same 24px chip pattern.

API + type changes:
- `/api/leaderboard/mine` — `members.include.user.select` adds `profile.avatarId`; rankedMembers ship `avatarId` at the top level.
- `/api/leaderboard/groups` — same prisma include addition so `m.user.profile.avatarId` is available.
- `/api/leaderboard/global` (both athleteBoard + trainerBoard) — selects `profile.avatarId`, response rows ship `avatarId` + `tierIconPath` + `tierEmoji` so the renderer never has to refetch.

The default trainer avatar is automatically picked when role="trainer" and the user hasn't equipped one — uses `/ai/avatar-default-trainer.png` (Batch 6 image-gen v2).

---

## Tier badges full sweep · 2026-05-23 — All tier-icon render surfaces switched to PNG (qa: tier-icons-vivid, tier-icons-simple, tier-icons-trainer)

Follow-up to the tier-badges-ship push. Per @maaiz: "No emojis, I want only these icons to be used and see how it is" — so this sweep replaces every remaining emoji-string tier render in `app/page.tsx` with `<TierGlyph>`. After this push there should be no more raw emoji rendering of tier badges anywhere in the UI.

Sites swapped this pass:
- Tier breakdown modal — sub-rank "to reach <next>" line, headline t.emoji chip
- Tier upgrade chip — "+N PTS → SILVER 🥈" inline annotation
- Group leaderboard chips (own + member) — 11px inline glyphs
- "Your rank: #X · Tier" footer
- Home headline t.emoji chip
- Group member list tier glyph
- Member list expanded row tier line
- Trainer-tier chip on Settings IDENTITY
- Global leaderboard fallback ("entry.tier?.icon")

Types updated:
- `TierLite` in app/page.tsx gains optional `iconPath`
- `CanonicalTier` in lib/leaderboardStats.ts gains optional `iconPath` (so leaderboard API responses pass it through)
- `trainerTierFromClientCount` in app/api/leaderboard/groups/route.ts passes through `iconPath`

Also: the legacy fallback `TRAINER_TIERS` array in app/page.tsx (client-count-based loading state) renamed Master → Mentor and got iconPath wired so loading-state badges match canonical tiers.

---

## Tier badges ship · 2026-05-23 — Vivid + Simple + Trainer ladders + Mentor rename (qa: tier-icons-vivid, tier-icons-simple, tier-icons-trainer, tier-themes)

Shipped the full image-gen v2 Batch 2 + 3 + new trainer-tier batch — 18 transparent crest-style PNGs across three ladders:

- **Athlete Vivid** (`/public/tier-icons/vivid/`): kitten → fox → big-dawg → lion → gorilla → bear. Front-facing animal crests with aggression ramp starting at lion (T4).
- **Athlete Simple** (`/public/tier-icons/simple/`): bronze → silver → gold → platinum → diamond → master. Front-facing medallions with aggressive geometry kicking in at platinum (T4 shattered) and master (T6 molten crown).
- **Trainer** (`/public/tier-icons/trainer/`): spotter → strategist → pro → mentor → legend → hall-of-fame. Coach-symbol crests (hand, knight, whistle, eagle, gem, apex star) — distinct enough from animals/medallions that the three ladders never collide visually.

**Rename**: Trainer T4 went from "Master" → "Mentor" because the athlete Simple ladder already has T6 Master (the molten crown). Two Masters across ladders would have been confusing in toasts/chips. Mentor sits naturally between Pro and Legend.

**Wire-up (Phase 1)**: `lib/tiers.ts` now carries an optional `iconPath` field alongside the existing emoji `icon`; a new `<TierGlyph>` helper component in `app/page.tsx` renders the PNG when present and falls back to the emoji if the image fails to load. Three highest-visibility render sites switched over so far:
- Tier breakdown modal — big 58px headline + 16/22px tier ladder grid
- Tier-up promo toast — 36px badge in the celebration overlay

Other tier-icon render surfaces (leaderboard chips, member list, smaller pills) still show the emoji for now — they'll get the upgrade in a follow-up sweep so this push stays surgical.

Compression: all 18 PNGs are 192×192 palette-quantized, 7-26 KB each (target was <35 KB tier-icon / <25 KB avatar). Total bundle additional weight: ~240 KB across all three ladders combined.

---

## QA pass · 2026-05-23 — Pre-deploy QA fixes: sticky tier-modal close + everywhere celebrations + role chip + Apple autofill (qa: tier-modal-sticky-close, celebration-overlays-everywhere, profile-role-chip-not-toggle, weight-input-convention-clarity)

@maaiz dropped three submissions through the in-app feedback panel while I was working on the premium-polish push. Per the pre-deploy QA-comment scan rule, addressed them all before pushing.

### tier-modal-sticky-close + Apple autofill suppression
- Tier modal header (title + close ×) is now position:sticky with backdrop blur. × close stays pinned while inner content scrolls — no more scrolling back up to dismiss.
- Weight + reps inputs on the active session screen now carry `autoComplete=off`, `autoCorrect=off`, `spellCheck=false`, explicit `name=` to stop iOS Safari from suggesting passwords/autofill on numeric workout fields.
- Swipe-back gesture for the modal deferred to a separate slice — main pain point (button accessibility) solved by sticky header.

### celebration-overlays-everywhere
- Root cause: milestone unlock, PB celebration, and tier-promo toast overlays were rendered inside the home-view JSX, so they only mounted when `view=home`. Navigate to messages/groups/anywhere = celebrations silently lost.
- Relocated all three into HomeGlobals (rendered into the persistent overlay portal across every view). Removed duplicates from the home view + standalone toast renders to avoid double-render.

### profile-role-chip-not-toggle
- ATHLETE chip in Settings → Profile was styled grey (rgba(255,255,255,0.55) + 5% bg) — looked toggle-able/disabled next to the saturated TRAINER/ADMIN chips. Now matches: red FF6B6B color + 10% bg + 30% border. Reads as a label, not a control.

---

## QA pass · 2026-05-23 — Home chip-strip + bottom hub alignment + tier modal tap target (qa: home-hub-premium-polish)

@maaiz: 'UI alignment could be much better with the tier modal button and progress button for a iPhone 16 pro size phone, check general UI upgrades premium looks'.

- Top chip strip: Profile / Progress / Tier now share identical outer chrome — 14px radius, subtle inset top highlight + soft drop shadow, 1px translucent border, minHeight 60 so all three align to the same baseline.
- Progress button redesigned: vertical icon-over-label (📊 / PROGRESS in Space Mono caps) matching the bottom-hub rhythm. Subtle red-glass gradient accent.
- Tier card: gold-tinted gradient background + gold border so it reads as the premium primary action without shouting.
- Bottom hub: layered shadow + 14px radius applied via `.nav-btn` CSS class. Whole home page now reads as a unified set.
- Tier modal close button: 32 → 44px (Apple HIG minimum tap target) with inner highlight + outer ring.

---

## QA pass · 2026-05-23 — QA dashboard priority sort + visual chips (qa: qa-priority-sort)

@maaiz: 'Add a sort by priority in the qa testing too please by default and visually identifiable priority levels'.

- New `priority: 'critical' | 'high' | 'medium' | 'low'` optional field on QAItem. Items without it default to medium.
- Color hierarchy:
  - P0 CRITICAL — red (#ff4d4d) with a glowing dot
  - P1 HIGH — orange (#ff8c42) with a dot
  - P2 MEDIUM — blue (#5db8e0)
  - P3 LOW — grey
- New `PriorityBadge` rendered next to `StatusBadge` on every row.
- Sort order rewritten — items sort by **priority first**, then status (untested → retest → failing → passing), then most-recently-tested.
- Areas themselves re-ordered so the area containing the highest-priority item appears at the top of the page.
- Header tally chips show P0 / P1 / P2 / P3 counts (P0 and P1 only when > 0 so the row stays uncluttered).
- 28 recent items tagged with explicit priorities — P0 for items that need immediate post-deploy verification (Maaiz migration, force-reset hardening, friend search), P1 for newly-shipped features, P3 for planning-only items gated on other work.

---

## QA pass · 2026-05-23 — Bar-weight helper + Maaiz migration endpoint + custom-exercise weight type (qa: weight-input-bar-helper, bar-weight-data-migration-maaiz, custom-exercise-weight-input-type)

@maaiz: 'what if I don't know the weight? Or if there's standard weights for different length bars have helper text. All of maaiz input have been one side plates only for all barbell related exercises, and without bar weight. Can you update maaiz data for barbell or ez curl included weights? Always used the smaller ez curl bar. I guess the custom exercises a trainer makes they would need to classify weight time if applicable too.'

### weight-input-bar-helper
- 📏 BAR? toggle next to the WEIGHT label on barbell + EZ-curl exercises only. Tap to expand a yellow reference card listing standard bar weights:
  - Olympic 20 kg / Women's Olympic 15 kg / Standard ~10 kg / Smith 7-15 kg / Trap/hex 18-25 kg (for regular barbells)
  - Standard EZ ~7 kg / Olympic EZ ~11 kg (for EZ-curl exercises)
- Reinforces 'total on bar (incl. bar)' so users don't fall back to one-side input.

### bar-weight-data-migration-maaiz
- New POST `/api/admin/migrate-bar-weights` endpoint (ADMIN_SECRET-gated). Body: `{ username, dryRun (default true), barbellBarKg (default 20), ezCurlBarKg (default 7) }`.
- Walks every WorkoutLog row for the named user, finds sets on barbell-equipped exercises, mutates each set's weight: `new = old * 2 + bar_kg`. EZ-curl exercises use the smaller bar (7 kg default).
- Dry-run returns counts + first 20 mutations as a preview sample. Apply with `dryRun: false`. Vercel function logs carry an audit line per apply.
- Reusable for any future user with the same convention drift.

### custom-exercise-weight-input-type
- New `weightInputType: String?` column on CustomExercise. Validated against 6 canonical values + null (= auto, legacy).
- Trainer creator form now has a chip-row picker after TYPE / DIFFICULTY: Auto / Total on bar / Per dumbbell / Stack pin / Bodyweight + added / Time only / Reps only.
- Session screen reads `exLibData.weightInputType` first; falls back to equipment-derived hint if null. Built-in exercises unchanged.

---

## QA pass · 2026-05-23 — Friend search fix + achievements expansion + weight input clarity + bottom-hub Progress removal (qa: friend-search-case-insensitive, achievements-strength-benchmarks, achievements-cardio-hiit, achievements-volume, achievements-behaviour-expanded, weight-input-convention-clarity, home-hub-progress-bottom-removed)

@maaiz: 'Not getting any search results from find and add friends. Remove progress tab button from the bottom of main as it's already at the top. We need like way more achievements like HIIT related, cardio based etc I thought we discussed this. Strength achievements like difficult to achieve target weights on particular major exercises (like a bench press goal). Have you decided what the best way is to input weights?'

### friend-search-case-insensitive — bug fix
- POST /api/friends was failing for any handle that wasn't already in lowercase (e.g. '@Maaiz', 'MAAIZ'). Usernames are stored lowercase by /api/auth register; the friends route did a raw findUnique that 404'd on case mismatch.
- Fix mirrors /api/routines/[id]/share: strip leading `@` + lowercase first, then a case-insensitive findFirst fallback for legacy non-lowercase rows.
- Error copy now reads 'No user @<handle>. Check the spelling.' so the user gets a clearer signal.

### achievements-strength-benchmarks (14 new)
- Bench Press: 60 / 100 / 140 / 180 kg
- Squat: 100 / 140 / 180 kg
- Deadlift: 100 / 180 / 220 kg
- Overhead Press: 60 / 80 kg
- Barbell Row: 80 kg
- 1,000 lb Club total (bench + squat + deadlift ≥ 455 kg)
- New `bestForNames()` helper + `maxByName` field on MilestoneState. Substring matching so incline / decline / dumbbell variants all count toward the lift benchmark.

### achievements-cardio-hiit (9 new)
- HIIT: first / 10 / 50 sessions
- Cardio: first / 10 / 50 sessions + 50 / 250 / 1000 km cumulative
- Detection: any exercise with `hiit: true` in the catalogue = HIIT session; `type === 'cardio'` = cardio session. Distance estimator: minutes × 10 km/h.

### achievements-volume (3 new)
- 100k / 500k / 1M kg-reps lifetime. Computed from every non-skipped set in history.

### achievements-behaviour-expanded (2 new)
- First warmup logged (`wu-*` set key)
- First cooldown logged (`cd-*` set key)

**Catalogue total**: 22 → 50 milestones.

### weight-input-convention-clarity
- Equipment-aware hint after the existing WEIGHT label clarifies what the number represents:
  - Barbell → 'total on bar (incl. bar)'
  - Dumbbell → 'per dumbbell'
  - Machine / Cable → 'stack pin'
  - Bodyweight → 'added kg' (or 'assistance kg' when assisted)
- No data migration. Going forward the hint makes the convention explicit so PRs + e1RM + tier scoring stay reliable.

### home-hub-progress-bottom-removed
- Removed the duplicate Progress button from the bottom hub row. The top chip strip's Progress button (between Profile and Tier) stays as the canonical entry point.

---

## QA pass · 2026-05-23 — Power User rebrand (no new role) + group chat slice 1 (qa: power-user-role, group-chat-system-messages)

@maaiz follow-up clarification: 'Power user doesn't need to be a new role, it is the trainer role renamed. But we just want to make it clear that power user is what trainers want but still benefits for anyone upgrading.' Plus: 'Group chat for each group with the group leaderboards in there as a button to open. Automatic System messages here regarding group missions set, any group members hitting major PB and achievements so members can chat about it.'

### power-user-role — rebrand (reverts the separate-role design from the previous commit)
- Reverted: no more `powerUser` in extraRoles; no `upgrade-power-user` / `downgrade-power-user` API actions. Power User IS the trainer role under the hood.
- `isPowerUser()` simplified to `userHasRole(user, 'trainer') || userHasRole(user, 'admin')`.
- Combined the two Settings cards into ONE '⚡ BECOME A POWER USER' card with bulleted copy explaining **both** use cases (everyone vs coaches) so the upgrade no longer feels exclusionary.
- '⚡ POWER USER ACTIVE' status card for upgraded users; pending-request card now reads 'Power User upgrade under review'.
- Confirm-upgrade modal rephrased for both flavours; SUBMIT button gradient switched to purple A29BFE to pair with the new card.
- Server gate copy + client alert copy point to 'Settings → ⚡ BECOME A POWER USER'.
- Plan editing/building still free for everyone — only sharing is gated.

### group-chat-system-messages — slice 1
- New `GroupMessage` Prisma model: `{ id, groupId, fromId (nullable for system), body, type ('text'|'system_mission'|'system_pb'|'system_achievement'), createdAt }`. Cascade-delete via group; user-side `onDelete: SetNull` so messages survive a user delete. Indexed on `(groupId, createdAt)`.
- `LeaderboardGroup.messages` + `User.sentGroupMessages` back-relations.
- New API: `GET /api/leaderboard/groups/[id]/messages` (member-gated, last 100). `POST` (member-gated, 1-1000 chars, fans out push to all OTHER members).
- New view `groupChat` with auto-fetch on mount, swipe-back to groupsHub. Render: user messages right-aligned red gradient; others left-aligned with @username header; system messages centered with purple SYSTEM badge.
- 🏆 LEADERBOARD button toggles an inline standings panel sourced from the group's already-loaded members array (no extra fetch), sorted by tier score desc, you highlighted.
- 💬 OPEN GROUP CHAT button at the top of the expanded group panel in groupsHub so the chat is discoverable without losing the existing leaderboard / members / workout / challenges sub-panels.
- System message hook: group-challenge create now auto-posts a `system_mission` message: `🎯 @<trainer> started a new mission: "<title>" — target <n> <metric>, <days> days`.
- Slices 2-4 planned in qa-state: system_pb hook (detect at workout-log time), system_achievement hook (at MilestoneUnlock time), polish (reactions, scroll-to-bottom, paginated history).

---

## QA pass · 2026-05-23 — Power User role + disown clients + analytics-unbury planning (qa: power-user-role, trainer-disown-client, analytics-progress-unbury)

@maaiz: 'I want everyone to have the plan editing and building features. We can gatekeep sharing plans to Power User which can be specialised for trainers but available to anyone. There needs to be a way to disown clients (and the wording used can be adopting and disowning). Unbury the analytics and present them in an intuitive way through the progress slice somewhere.'

### power-user-role
- New self-service role 'powerUser' stored in `extraRoles` (no schema migration — array already exists).
- `isPowerUser()` helper alongside `userHasRole()`: returns true for `extraRoles.includes('powerUser')` OR trainer OR admin (trainers/admins are implicit Power Users).
- `/api/auth` PATCH gets two new actions: `upgrade-power-user` and `downgrade-power-user`. Idempotent. No admin approval queue — instant.
- Settings → ⚡ POWER USER card explains what's unlocked (currently plan sharing) and provides the Enable/Disable buttons. Trainers/admins see a `VIA TRAINER` / `VIA ADMIN` badge and no buttons.
- Server-side gate: `/api/routines/[id]/share` POST rejects non-Power Users with 403 + `code: POWER_USER_REQUIRED` and copy pointing them to Settings.
- Client-side gate: the ↗ share arrow on each saved routine row shows `↗⚡` for non-Power Users and an alert explaining the upgrade path on tap; share sheet doesn't open.
- Plan EDITING and BUILDING stay free for everyone. Only SHARING is gated.
- Trainer-upgrade card copy updated: 'Trainers automatically get Power User features too.'

### trainer-disown-client
- New `DELETE /api/trainer/clients/[clientId]` handler. Auth: only the trainer side of the relation can call. Deletes the TrainerClient row; cascades nothing (client's workout logs, plans, profile untouched).
- Red `DISOWN` button on the client detail header (next to MESSAGE). Confirm dialog spells out exactly what disowning means — client keeps all data, just the coaching link ends, either side can re-adopt later via the normal trainer-request flow.
- Vocabulary: 'adopting' (existing trainer requests) and 'disowning' as a clean symmetric pair per @maaiz.

### analytics-progress-unbury (planning — NO code)
- New qa-state item captures the design for a Progress → ANALYTICS sub-tab. Surfaces existing analytics (VolumeHeatmap, body metrics, per-exercise progression) in a dedicated discoverable home + adds new charts (per-exercise e1RM multi-line, session-frequency calendar, PR rate-of-change). Each chart gets a 1-sentence plain-English interpretation footer pulled from existing tier sub-rank detail strings.
- 4 slices spec'd. De-gamify aware (charts visible, tier overlays hidden).

---

## QA pass · 2026-05-23 — Tier-name-LED group chips + T-number annotations + achievement-boost planning (qa: trainer-group-visual-identity, tier-explainability, achievements-permanent-tier-boost)

@maaiz: 'wherever the tier name is mentioned, have a T1 or T2 etc label so the tier number is identifiable … trainer groups can say tier name-led … Hall of fame holders groups must be hall of famer led though … achievements/milestones contribute to the tiers right? Specifically trainer milestones for the trainer tier'.

### trainer-group-visual-identity
- /api/leaderboard/groups GET now resolves each group creator's trainer tier (TrainerClient count → TRAINER_TIERS) and returns `creatorTier: { label, icon, tierNum }` per group.
- Groups list UI replaces the generic 🤝 COACH-LED chip with the trainer's actual rung: SPOTTER-LED / STRATEGIST-LED / PRO-LED / MASTER-LED / LEGEND-LED. Hall of Fame special-cased as HALL OF FAMER-LED so the suffix reads naturally.
- Chip suffix carries the inverted display tier number (· T1 through · T6) for instant rung clarity.

### tier-explainability
- TIER UP! toast now appends · T<displayTierNum> after the tier label and uses the inverted display number (was the raw internal tierNum).
- Home tier chips' "+N → NEXT" callout now includes the next rung's display tier number so users see both the label and its T-number ("+8 → LION T3").

### achievements-permanent-tier-boost (planning — NO code)
- New qa-state item captures the design for an 8th athlete sub-rank (and 6th trainer sub-rank): 'Achievements'. Each unlocked milestone in /ACHIEVEMENTS.md carries a static weight; the user's sum-of-weights becomes their 0-100 Achievements sub-rank score, blended into the tier headline average.
- Trainer-only milestones feed ONLY the trainer ladder. Athlete-only feed ONLY the athlete ladder. Cross-role (e.g. account-age) feed both at half weight.
- Permanent: once unlocked the score can never decrease for that lever (other sub-ranks like Strength still rise + fall).
- Visible as its own labelled sub-rank — never a hidden buff (cf. the deprecated tierScoreBonus principle).
- Gates on achievements-v1 shipping first.

---

## QA pass · 2026-05-23 — Tier explainability — confirm no role boost + next-rung target (qa: tier-explainability)

@maaiz asked whether Maaiz (trainer) being Big Dawg while Alla (athlete) is Lion was due to a hidden trainer boost. Investigation: NO — `computeAthleteTier` reads only training + wellness data; role / trainer status never feeds the score. Alla genuinely outranks Maaiz on the seven sub-ranks. Made it crystal clear in the tier modal so users don't have to wonder.

- Intro paragraph: explicit "100% based on YOUR training stats. No boost for being a trainer, having more friends, paying, or anything else. Same formula for everyone."
- Trainer-side bullet rewritten to make the difference unambiguous: trainer tier folds in roster + retention + client progression + reach + the trainer's own athlete-discipline (5 dimensions). Athlete tier doesn't.
- Dual-role helper line: when comparing two athletes' tiers, roles don't matter — only the seven sub-ranks below.
- ATHLETE LADDER subtitle corrected from "5 sub-ranks" to "seven sub-ranks (only ones with data count)".
- Added concrete next-rung callout: "To reach 🦁 Lion you need +N pts on the headline (currently X, next at 50). Headline = average of the K counted sub-ranks below." Users no longer have to do the math themselves.
- Focus-next callout renamed Path to next → Quickest win; copy explains that all counted sub-ranks weight equally, so pushing the lowest one moves the headline most.

---

## QA pass · 2026-05-23 — Admin force-reset hardening (qa: auth-must-reset)

@maaiz reported Amanii was stuck on mustResetPassword in the admin panel but wasn't being prompted to set a new password on next login. Code review showed the standard login → mustReset → reset-screen path was wired correctly, but the in-session case had no refresh trigger — a user with a foregrounded tab never re-fetched `/api/auth`, so the admin's flag flip never propagated client-side.

### Client
- `refreshUser` now fires on `visibilitychange` (existing) **plus** `pageshow` (iOS bfcache + PWA wake-up), `window.focus` (desktop), and a 60s background interval. Whichever fires first, the client picks up `mustReset=true` and renders the reset screen.

### Server
- `/api/admin` `force-reset` now re-reads the user row after the write and returns `verifiedMustReset`. Writes a server-side audit line to Vercel function logs: `[admin/force-reset] target=<username> (<id>) flag-after-write=<bool> flag-after-reread=<bool> ts=<iso>`.

### Admin UI
- Force-reset alert now quotes the verified-true / verified-false state alongside the temp password, so the admin sees real DB state instead of an optimistic local update. Also updates the copy to explain both prompt paths (next login OR next app open if already signed in).

### Behaviour result (per @maaiz)
- **Already logged in**: bounced to the reset screen on next app open / focus / within 60s.
- **Not logged in**: prompted to set a new password when they sign in with their @username (unchanged — already worked).

---

## QA pass · 2026-05-23 — Friends moved to home hub + trainer '+ CLIENT' shortcut (qa: friend-system-athletes)

@maaiz couldn't find the Friends UI because the SOCIAL section had landed inside the PROFILE-view conditional block (only renders when the Settings ↔ Profile toggle is on PROFILE). On top of that, the user wanted Friends as a home-level surface and a discreet way for trainers to turn friends into clients.

### What changed
- **Removed** the Settings/Profile SOCIAL section + FriendsCard render. Friends is no longer a settings drawer entry.
- **New home-hub button**: 🤝 Friends (purple A29BFE accent) between Groups and (trainer-only) Clients. Carries an incoming-count badge when there are pending received friend requests. Visible to both athletes and trainers.
- **New view `friendsHub`**: dedicated screen rendering FriendsCard full-width with back nav. Wired into swipeBack so the iOS swipe-from-edge returns home.
- **Trainer '+ CLIENT' chip on each accepted friend row**: small purple chip alongside REMOVE. Tapping sends an adoption request via the existing `/api/trainer/request` POST (sendAdoptionRequest reused). States: '+ CLIENT' (default) → 'REQUESTED' (greyed, after send) → 'CLIENT' (purple pill, once friend has accepted). Hidden for athletes.
- **Page-level pending count**: new `pendingFriendCount` state mirrors GET /api/friends → pendingReceived.length. Refetched on user-load and on every home-view entry so the badge stays fresh after accept/decline.
- **Tutorial step added** (`friends-hub`): introduces the home hub Friends button and the trainer '+ CLIENT' shortcut.

---

## QA pass · 2026-05-23 — Watermark regression + quick-win UX + friend system slice 2 (UI + push) + search boxes + tier number inversion (qa: workout-rest-motivational-phrases, tier-ladder-dot-bar, wellness-collapsed-default, home-hub-singleline, achievements-discoverability-progress, friend-system-athletes, push-notifications-requests, search-boxes-lists, tier-number-display-inverted, trainer-made-missions, dashboard-cards-rearrangeable, exercises-tab-all-exercises, leaderboards-rearrangeable)

Big pass — fixed the watermark scroll regression from the last
deploy, landed all five quick wins, shipped friend-system slice 2
(UI + push notifications for both friend AND trainer request flows),
added search boxes to long lists, and flipped tier-number display so
TIER 1 = top. Four planning items captured for the remaining big
asks (rearrangeable cards/groups, exercises tab redesign, trainer
missions).

### workout-rest-motivational-phrases — regression fix (watermark scrolling)
- Long phrases (40+ chars) in the rotated 52px watermark were
  overflowing the container's clip rect and causing visible page
  shift when the home tagline rotated. New `WATERMARK_PHRASES =
  PHRASES.filter(p => p.length <= 22)` keeps the watermark on the
  short subset; watermark phrase is now stable per-mount (`useMemo`)
  so it doesn't rotate visibly. Hero tagline + rest overlay still
  use the full 60-entry pool.

### wellness-collapsed-default
- Wellness card was already `useState(false)` (collapsed) by default;
  added localStorage persistence (`ironlog-wellness-open`) so a
  user's chosen state survives refresh.

### home-hub-singleline (avatar fills profile button)
- Profile button's avatar image now fills the button corner-to-corner
  (no padding, transparent background, overflow:hidden). Per @maaiz:
  "profile avatar to fill the profile button or no box at all".

### home-hub-singleline (tier number label on home)
- Trainer + athlete tier chips on the home hero now carry a small
  '· T{n}' suffix after the tier label so the rung is unambiguous
  at a glance.

### achievements-discoverability-progress
- Achievements wall now surfaces at the TOP of the Progress dashboard
  (was only buried in Settings → LIBRARY & SYSTEM). Same toggle
  state shared between both surfaces. Per @maaiz: "cant find
  milestones/achievements anywhere — they should be in progress tab".

### friend-system-athletes — Slice 2 (UI)
- FriendsCard component in Settings → SOCIAL: send request by
  @username, accept/decline incoming, cancel sent, list accepted
  with REMOVE, in-card search when friends count > 4.
- Inline accept/decline for friend_request messages in conversation
  thread (purple A29BFE accent so it's visually distinct from the
  teal adoption_request).
- friend_accepted Message type also rendered in-thread + auto-created
  on accept. Conversation preview labels added: "Friend request" /
  "Friend accepted".

### push-notifications-requests
- POST /api/friends → push to recipient.
- PATCH /api/friends accept → push to sender.
- POST /api/trainer/request → push to athlete (was previously missing).
- PATCH /api/trainer/request accept → push to trainer (was previously missing).
- All fire-and-forget so a missing VAPID env or no-subs case doesn't
  block the API response. Per @maaiz: "make sure theres push
  notifications for trainer requests and friend requests, also
  friend request acceptance".

### search-boxes-lists
- Three new state vars (`conversationsFilter`, `clientsFilter`,
  `groupsFilter`) hooked into the existing list iterators.
- Search bar appears above the list when count > 4; case-insensitive
  `includes()` filter against partner username / client username /
  group name. Per @maaiz: "search box in messages and clients and
  groups".

### tier-number-display-inverted
- Per @maaiz: "tiers should be numbers so 1 is top tier (best)".
- DISPLAY-ONLY inversion via `displayTierNum(tierNum) = TIER_COUNT
  - tierNum + 1`. Internal tierNum (1=lowest, 6=highest) unchanged
  so all scoring, leaderboard sorts, promotion detection, avatar
  unlock pipelines keep working.
- Applied at: tier modal row labels (+ row list now reverse-rendered
  so top tier sits at top), tier breakdown card ('TIER X OF 6'),
  home chip tier-num suffix, global tier leaderboard rows, avatar
  picker tile chips, Settings TIERS chips.

### Planning captured (NO code)
- `trainer-made-missions` — design for trainers authoring missions
  visible to their clients (schema + endpoints + creation form +
  athlete-side merging).
- `dashboard-cards-rearrangeable` — drag-reorder for Progress
  dashboard cards + KPI numbers at top by default.
- `exercises-tab-all-exercises` — show every ever-logged exercise,
  not just current-split exercises.
- `leaderboards-rearrangeable` — drag-reorder for GROUPS and MY
  CLIENTS lists with localStorage persistence.

---

## QA pass · 2026-05-23 — Friend system slice 1 + home tier dot bar + abs mission v2 + rest-timer phrases + pro-tip 1h hide + gender lock (qa: friend-system-athletes, tier-ladder-dot-bar, mission-unlock-abs, workout-rest-motivational-phrases, pro-tip-hide-visibility, gender-achievements-differentiation, app-browser-icons-image-gen, qa-comments-deploy-precheck)

Big pass — Slice 1 of the friend system landed alongside ~6 small UX
fixes raised by @maaiz mid-session.

### friend-system-athletes — Slice 1 (schema + endpoints, NO UI)
- **Prisma**: new `Friendship` model { id, userAId, userBId, status: pending|accepted|blocked, requestedAt, acceptedAt? }. Cascade-delete on both User sides. `@@unique([userAId, userBId])`, indexes on each side + on status. User got two new relations (friendshipsA / friendshipsB).
- **Messages**: `Message.type` now accepts `friend_request` (no schema change — `type` was already a free-form String). The POST endpoint auto-creates one of these so the recipient gets a notification in the existing messages stream.
- **/api/friends route.ts** — all four verbs gated by the `ironlog-uid` cookie:
  - `GET` → `{ accepted, pendingSent, pendingReceived }` buckets, shaped from the viewer's POV (each row carries `friend: { id, username }` regardless of which side userA is).
  - `POST { toUsername }` → username lookup → validates self / dupe / blocked → creates a pending Friendship + a `friend_request` Message. **Handshake symmetry**: if the target already has a PENDING request to me, this POST auto-accepts both sides (natural UX for both-send-at-same-time race).
  - `PATCH { friendshipId, action: 'accept'|'decline'|'block' }` → only the recipient can accept/decline (decline deletes the row so a fresh request can be sent later). `block` works from either side and swaps userAId so the blocker always becomes userA.
  - `DELETE { friendshipId }` → unfriend (any side). Cannot delete a `blocked` row — must PATCH to unblock first.
- **No UI in this slice** — slice 2 builds Settings → SOCIAL friend search + list. Manual end-to-end test for now uses the two-seeded-test-users panel under Settings → DEV TOOLS.

### tier-ladder-dot-bar — home chip dot consistency
- Home hub tier chip (top-right card on the hero) used to render the
  progress bar as a single gradient line "current → next tier".
  Replaced with the same dot ladder used in the tier modal — every
  tier breakpoint is a small dot at its normalised position, current
  tier dot enlarged + glowing in tier colour, reached dots solid,
  unreached dim grey.
- New compact helper `CompactTierDotBar` (sized for the home chip
  slot, no labels — there's no room). Normalises positions by
  `lastTier.min` so the same component handles both athlete tiers
  (mins 0-90) and trainer tiers at home (raw client counts 0-30).
- Both trainer + athlete chips updated. Tap target unchanged — whole
  chip still opens TierInfoModal.

### mission-unlock-abs — Slice 2 (gender-aware threshold + clearer 'lose X%' wording + gender lock)
- `Mission.targetByGender` field added: `mission-unlock-abs-v1` now resolves to `{ male: 15, female: 22 }` (women's essential fat is higher than men's, so visible-abs threshold differs). Default target stays 15 for "other" / unknown.
- New helpers `resolveMissionTarget(m, gender)` + `resolveMissionBody(m, gender)` — body copy substitutes the per-gender target AND appends a one-liner explaining the calibration ("women's essential fat is higher than men's, so this is calibrated for you") so users understand why the number is what it is.
- ChallengesCard now takes a `gender` prop (threaded from `ob.gender`). ALL UI sites use the resolved target — preview text, progress bar denominator, profile goal PATCH, joined-view headline + foot row.
- **Wording fix**: preview now reads `lose X.X% body fat to unlock (target Y%)` (was the ambiguous `X.X% to unlock` — @maaiz: "make it clearer thats the amount to lose to complete the mission"). Joined view foot reads `cur% → target% (lose X.X%)`.
- **Gender lock**: Settings → Profile → GENDER buttons disabled + greyed out when `ob.gender` is already set; ARIA disabled + cursor-not-allowed + 🔒 LOCKED chip + footer note explains why. Server-side: `POST /api/profile` rejects gender mismatches on existing rows with `400 "Gender is locked once set — contact support to change."` (defence-in-depth even though `update` block already didn't write gender).

### workout-rest-motivational-phrases — rest-timer overlay phrase + 60-entry phrase pool
- Rest timer overlay now shows a motivational phrase below the countdown ring, soft white italic ~14px. Phrase rotates per-rest-cycle: new `cycleId` counter on `useCountdown` increments each time `start()` fires, so the phrase stays stable while seconds tick and changes on a fresh interval.
- PHRASES inventory expanded 20 → 60. New entries skewed toward rest-timer use cases: breath-paced ("Breathe. Reset. Go again.", "Slow down — the next set wins it."), form-cue ("Form before weight.", "Tempo first. Ego second."), micro-recovery ("Recovery is part of the lift.", "Aches mean you showed up."), discipline ("Stop checking your phone — set up.", "Stop negotiating with yourself.").
- Single source of truth — same `PHRASES` array now powers both the home hero tagline AND the rest overlay.

### pro-tip-hide-visibility — Slice 2 (1h hide option + localStorage persistence)
- Pro Tip dismissal was session-only state (refresh = tip back, didn't honour "today"). Now stored as a unix-ms expiry in `ironlog-tip-dismiss-until` so dismissals survive refresh.
- TWO preset durations exposed at both the chip and modal: `1h` (60-minute cool-down, "tip back after the session") and `×` / `HIDE FOR TODAY` (computes ms until local midnight).
- Chip got a new layout: `[tip body chevron][1h][×]` — both dismiss buttons separated by thin teal dividers, `1h` in lighter teal so it reads as the softer option. Modal got a matching `HIDE 1H` / `✕ HIDE FOR TODAY` button row.

### gender-achievements-differentiation — planning (NO code)
- Captured @maaiz's ask: "men and women milestones/achievements might need to be slightly different too! can add some stuff for big booty".
- 4-slice plan in `qa-state.json`. Gates on achievements-v1 system shipping first. TL;DR: add `genderFilter?: 'male'|'female'|null` to Achievement shape, author 8-12 gender-flavoured achievements (4-6 each), 'other' / unset gender sees the union.

### app-browser-icons-image-gen — planning (NO code; answers a user question)
- Question from @maaiz: "app and browser icon included in image generation list?". Answer: NOT YET. `image-prompts-v2.md` uses "dark-mode app icon" as a style descriptor for avatars / tier icons / sub-rank icons but does NOT include actual app-launcher icons or favicons as standalone deliverables. Current assets in `/public/` audited; Batch 10 spec captured in the qa-state notes (5 deliverables: 512 / 192 / 180 / favicon / optional splash).

### qa-comments-deploy-precheck — process change
- New rule baked into `CLAUDE.md`: before any `git push`, agent must `git pull origin main --rebase` and check `qa-comments/` for any unprocessed feedback the user submitted via the in-app QA panel while the agent was working. New comments → STOP, summarise, wait for go-ahead before pushing.

---

## QA pass · 2026-05-23 — UX backlog clear: warmup boxes + dot ladder + coach-led groups + 3D session feel + quest pool expansion (qa: session-warmup-row-polish, tier-ladder-dot-bar, trainer-group-visual-identity, session-page-3d-aesthetic, daily-quest-rework)

Five UX items from the held queue, all shipped in one push.

- **session-warmup-row-polish** — removed the `TAP` / `N/N · TAP` text affordance on non-trackable rows (matches trackable exercise rows). Added the same set-box strip warmups/stretches/cooldowns were missing — each box reads from `warmupSetState` and cycles pending → ✓ done → − skipped → pending on tap.
- **tier-ladder-dot-bar** — replaced the old single-segment "current → next tier" progress bar with a full-ladder dot bar. Each tier breakpoint is a dot positioned at its score-min (0-100); gaps proportional to actual score distance (so Lion → Gorilla visibly wider than Kitten → Fox). Filled track up to currentRaw using the tier-color gradient. Current dot is larger + glows.
- **trainer-group-visual-identity** — trainer-led groups now render with a teal→gold gradient border, subtle radial halo background, 🤝 COACH-LED chip, and a `led by @<trainerUsername>` subtitle. Detection: walks `grp.members` to find the row whose userId matches `grp.createdBy` + checks role. Athlete-made groups stay on the neutral default border.
- **session-page-3d-aesthetic (slice 1)** — three CSS depth touches: logSetFlash now uses perspective + rotateX press-down for tactile feel (was flat scale/brightness); rest countdown number gets a subtle ±2° Y-axis idle rotation (`restTimerIdle` keyframe); session header gets `session-header-depth` class with inset shadow + soft top drop-shadow. Slice 2 (card parallax + pointer tilt) deferred to a separate slice.
- **daily-quest-rework (slice 1)** — QUEST_POOL expanded 7 → 14 with Variety, Volume push, Superset day, Drop set day, Get cardio in, Warmup pro, Tracker check. `pickTodayQuest(userId)` now uses `hash(userId + iso)` for per-user rotation. QuestState extended with 8 optional new computed fields. Slice 2 (celebration animation, tier-score bonus, auto-dismiss) deferred.

### Deferred / planning only
- **friend-system-athletes** — needs a schema migration + Friendship table + 4 endpoints + new UI. Too large for a single push session. Planning intact in qa-state.

---

## QA pass · 2026-05-23 — Daily PB quest fix + PR→PB rename + Pro Tip hide visibility + UX queue planning (qa: daily-quest-pb-bugfix, pr-to-pb-rename, pro-tip-hide-visibility, daily-quest-rework, friend-system-athletes, trainer-group-visual-identity)

Mixed code + planning pass. @maaiz hit rapid-fire UX asks; shippable fixes done now, big new features captured as planning artefacts.

### Code fixes shipped
- **daily-quest-pb-bugfix** — the PB-hunt quest was hard-coded `hasPRToday = false` with an unfinished TODO. Now properly compares each set logged today against a `preTodayBest` map built from sets logged strictly before today; tags `hasPRToday = true` on any weight beat, weight tie with more reps, or first-time-logged exercise.
- **pr-to-pb-rename** — 5 user-facing string surfaces flipped: leaderboard column headers in trainer + group views, trainer Tier modal Progression + Reach detail lines, milestone body text, daily quest title. Internal code identifiers (prCount, exercisePRs, totalClientPRs) preserved to keep the data API contract stable.
- **Quest chip label** — `QUEST` → `DAILY QUEST` (with `✓ DONE` when complete) per @maaiz.
- **pro-tip-hide-visibility** — added a `×` button on the Pro Tip chip itself (one-tap dismiss, separated from modal-open via stopPropagation). Also bumped the in-modal `✕ HIDE FOR TODAY` button from 4%/10% white-on-dark to high-contrast teal-on-teal.

### Planning captured (no code)
- **daily-quest-rework** — pool expansion (7 → ~20), per-user random rotation, celebration animation + auto-dismiss when done, tier-score bonus (+0.5 per quest, +20 lifetime cap with audit trail), leaderboard-weighted via canonical headline. 4-slice plan.
- **friend-system-athletes** — Friendship Prisma model, friend search + accept/decline via Messages, athletes can create groups (currently trainer-only gate), routine share gets a friends-tab. 4-slice plan.
- **trainer-group-visual-identity** — distinct visual treatment for trainer-made groups: teal/gold gradient border, COACH-LED chip, trainer avatar + tier badge in header.

CLAUDE.md not updated this pass — planning items live in qa-state. Holding all commits for @maaiz deploy signal.

---

## Release · 2026-05-23 — IronLog 1.1.0 milestone (qa: achievements-v1, image-gen-plan-v2)

Bumped to **1.1.0** to mark the end of today's content/feature push.
`MAJOR_MINOR` in `app/api/version/route.ts` + `package.json` both
flipped. Patch number auto-derives from PATCHLOG section count so
each section since this release adds `1.1.<n>` to the user-facing
version string.

What's in this minor version (in order of landing):
- **tier-scoring-v2** — Strength via e1RM trend, Progression sub-rank, Body Comp (sex-aware), Consistency rebuild, hasData weighting, tierScoreBonus removed from headline, IP RPE expansion
- **test-user-generator** — 15-user roster, daily cron, /api/admin/test-users surface, Settings → DEV TOOLS panel
- **client-leaderboard-relocation** — moved from home inline to Ranks page tab + My Clients hub
- **workout polish batch** — warmup mark/skip, set-edit effort, post-done edit, silent restore, assisted BW, dual music launcher, home 1:1:2 grid, avatar picker (later refactored to swipe-back page), effort contrast, equipment-aware ± increments
- **effort backfill prompt** + ★ LIKELY suggestion hint
- **completed-summary** THIS/LAST strip with per-set ▲▼= e1RM-trend arrows
- **rest counter** persisting on LOG SET when overlay skipped
- **wellness** direct-entry inputs (hydration + sleep with decimal precision)
- **stretch image audit** (3 more frames pulled, 18/25 verified correct)
- **in-session add** BONUS section now slots before cooldown
- **planner-equipment-strict** — onboarding "both" location no longer auto-fills full gym kit
- **routine auto-naming** — Push/Pull/Legs inference + editable day titles
- **tier modal** rows now show `· TIER N`
- **theme bright-text** toggle
- **profile** chip avatar-only + role-stack visibility (athlete + trainer + admin)
- **avatar picker** routed page with swipe-back
- **contributors** consolidated to /qa#contributors (Amanii's image + QA both visible)
- **deploy-skip hotfix** — fatal "bad object" no longer silently cancels every push

### Planning slices captured this pass (no code shipped)
- **achievements-v1** — full system design in `/ACHIEVEMENTS.md`: Progress tab sub-tab, 48 achievements across 10 categories (Strength / Consistency / Volume / Variety / Wellness / Technique / Cardio-HIIT / Warmup-Cooldown / Milestones / Meme), count-milestone avatar rewards, criteria functions, data model (`UserAchievement` table), UI states, notification UX, slice plan. 4 open questions waiting on @maaiz before Slice 1 implementation. Cardio distance estimator (time × speed) spec'd inline for the 3 distance-based achievements + a future leaderboard column.
- **image-gen-plan-v2** — `/image-prompts-v2.md` carries 27 new image prompts: new default avatar (1) + Vivid tier icons (6) + Simple tier icons (6) + stretch regen pairs (8) + achievement-unlock avatars (6). Each batch documented with style guide + per-image prompt + registration steps.

CLAUDE.md's pending-reminders block now tracks both planning items so they're surfaced at the top of every future session until ticked.

---

## QA pass · 2026-05-23 — Consolidate contributors on the QA dashboard (qa: contributions-leaderboard-consolidated)

Per @maaiz: one canonical leaderboard, not two. The standalone `ContributionsView` page in `app/page.tsx` is removed (along with its route, swipe-back entry, and now-unused imports). Settings → Contributors button is now an `<a href="/qa#contributors">` that scroll-anchors directly to the existing CONTRIBUTORS leaderboard already living on `/qa`.

Also dropped the `kind !== "qa-feedback"` filter in that dashboard section so Amanii's BOTH categories — 80 image assets AND 4 early QA notes — show on the same row. Before this change her QA contributions were invisible: the FEEDBACK LEADERBOARD only counts QAComment rows submitted via the live app (different data source), and the CONTRIBUTORS section explicitly filtered her qa-feedback entries out.

---

## QA pass · 2026-05-23 — Avatar picker is now a swipe-back page (qa: profile-avatars-page)

Per @maaiz: the avatar picker shouldn't be a modal overlay — it should be a routed page like Progress, with swipe-back support. Refactored from a `fixed inset: 0` overlay into a full `AvatarPickerView` component routed under `view === "avatarPicker"`. Same inventory + selection behaviour; new wrapper.

Side effects of the refactor:
- Removed `avatarPickerOpen` state — triggers now call `setView("avatarPicker")` instead.
- HomeGlobals no longer carries the picker render or its 6 prop slots.
- `swipeBackViews` registers `avatarPicker` so the gesture works.
- Back nav: `avatarPicker → profile`.
- Home profile chip restored to `1fr 1fr 2fr` grid (was `56px 1fr 2fr` — same size as Progress button per @maaiz follow-up).

Workflow rule update: CLAUDE.md now says **commit always, deploy only on explicit user signal** ("push", "ship it", "deploy"). Stop-hook warnings about unpushed commits are informational, not deploy triggers. Supersedes the earlier "bundle related work into one push" heuristic — batching is now user-controlled.

---

## QA pass · 2026-05-23 — Home chip avatar-only + profile role stack (qa: profile-avatars-home-fix, profile-role-stack)

Two related UX tightening follow-ups.

### profile-avatars-home-fix (slice 2)
Per @maaiz: home chip should show ONLY the avatar — no username text, no role label. Tap routes to Settings → Profile where the full identity (username + all roles + tier badges + avatar picker) lives. Grid changed from `1fr 1fr 2fr` to a fixed `56px 1fr 2fr` so Progress + Tier get more breathing room on narrow phones.

### profile-role-stack
Profile view's IDENTITY card now shows ALL roles a user holds, not just the highest-priority one. Removed the `!isTrainer && !isAdmin` gate around the ATHLETE chip — every user has workout data, so the chip is always rendered. Trainer + Admin chips stack on top when held. Dual-role users (athlete who became a trainer) finally see BOTH chips.

---

## QA pass · 2026-05-23 — Home profile chip fix + tier breakdown labels + bright-text theme (qa: profile-avatars-home-fix, tier-modal-tier-labels, theme-bright-text)

Three small UX-impact fixes bundled.

### profile-avatars-home-fix
The home profile chip was hardcoded to `/ai/avatar-default.png` regardless of `profile.avatarId`, which made every avatar selection feel broken from that surface. It also crammed avatar + username + role-chip + chevron into 25% column width on a 360px phone, truncating the username to one letter and wrapping the role chip awkwardly. Two fixes: (1) use `findAvatar(currentAvatarId)` so the real selected avatar renders; (2) drop the chevron and the chip background — render role as a tiny inline label below the username. Cleaner, real avatar, no truncation. Bonus: tapping the avatar IMAGE specifically opens the picker directly (`e.stopPropagation()` so the surrounding button's "go to Settings" doesn't fire too).

### tier-modal-tier-labels
Tier breakdown rows in the modal now read `<Label> · TIER <N>` instead of just `<Label>`. Number derived from the array index (1-based). Works for both athlete themes (vivid + simple) and the trainer ladder. Per @maaiz's example `Bear - tier 1` — implemented faithful to the ladder order we defined (Kitten=1, Bear=6); flagged in qa-state notes that if @maaiz actually wants the ladder REVERSED (Bear as top → Tier 1), that's a separate bigger change.

### theme-bright-text
New yellow `💡 BRIGHT TEXT` toggle under Settings → APP PREFERENCES → THEME. Flips a localStorage flag (`ironlog.brightText`) which renders a `<style>` tag with `filter: brightness(1.16) contrast(1.06) saturate(1.05)` on body when on. Filter on body covers modals + portals too. Useful when reading on dimmed brightness — gym lighting, outdoor sun, etc.

---

## Hotfix · 2026-05-23 — vercel-should-skip false-positive skipping all deploys (qa: planner-equipment-strict)

Real root cause of the "deploys not landing" saga: my own `scripts/vercel-should-skip.sh` had a silent fallback that treated missing `VERCEL_GIT_PREVIOUS_SHA` (common after a manual redeploy of an older commit) as "no changes — skip" instead of "can't diff — proceed". Vercel uses shallow clones, so after the manual redeploy of `6c7b47e` the script could never resolve that SHA → `git diff` errored with "fatal: bad object" → `|| true` swallowed the error → empty `$CHANGES` → exit 0 (skip). Every push since the manual redeploy got cancelled in ~8s with no build attempted.

Fix: probe `git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA"` before diffing; when the object isn't in the clone, proceed with the deploy unconditionally. The build's own commit SHA becomes the new previous-sha for subsequent runs, so this self-heals after one successful deploy.

---

## Webhook diagnostic · 2026-05-23 — does Vercel still receive pushes? (qa: planner-equipment-strict)

Tiny diagnostic commit. Production is stuck on `6c7b47e` from ~2h ago with ~10 newer commits that NEVER appeared in Vercel's Deployments tab. Pushing this no-op edit to PATCHLOG.md (which is outside the `ignoreCommand` safe-set, so it WILL trigger a build) to test whether the GitHub → Vercel webhook is alive. If this commit appears as a deploy attempt within ~30s of push, the webhook is healthy and earlier commits were just dropped one-time. If it doesn't appear, the integration needs reconnecting in Vercel → Settings → Git.

---

## QA pass · 2026-05-23 — Planner equipment-strict + routine auto-naming (qa: planner-equipment-strict, routine-auto-naming)

Two related fixes that landed together.

### planner-equipment-strict
Root-cause fix for "the planner is recommending gym-only exercises in my home plan". In `app/page.tsx` line 7138 the location-card click handler was pre-populating `equipment` with the full gym kit for **both** `gym` AND `both` selections. That meant a "both" user who never unchecked anything had a profile claiming they owned every machine at home — and the planner faithfully recommended them. Now only `gym` retains the pre-check default (sensible for commercial gyms); `home` and `both` start empty so the user explicitly picks their kit per location. Customise's exercise browser stays unrestricted (defaults to `all`) so travelling users can still pull in gym moves on demand.

### routine-auto-naming
New `lib/splitNaming.ts` with two helpers: `suggestDayTitle(exercises)` infers `Push` / `Pull` / `Legs` / `Upper Body` / `Lower Body` / `Arms` / `Core` / `Full Body` from primary-muscle dominance (≥70% of exercises in one bucket → that name; otherwise top-two combination). `suggestRoutineName(days)` combines the day titles into a routine name (`Push/Pull/Legs`, `Upper/Lower 4-Day`, `Full Body 3-Day`, …).

UI wires:
- Customise day title is now an inline editable input. Saves on blur via `/api/plan` PUT (extended to accept optional `title`/`subtitle`).
- A `★ SUGGESTED: <name>` chip appears under the title when the system has a stronger label idea than the current text. Tap to accept.
- Saved-routines `+ SAVE` button pre-fills the name input with the system suggestion. User can override entirely.

---

## QA pass · 2026-05-23 — In-session add inserts BONUS before cooldown (qa: workout-in-session-exercise-add)

`handleAdd` now detects the first cooldown section (by `type === "cooldown"` or name starting with `COOL`) and splices the BONUS section directly before it instead of pushing to the end. If the user's data already has BONUS sitting after cooldown (legacy state), the next + SESSION add quietly moves it back into the correct slot. No cooldown present → unchanged push-to-end behaviour. (Reported by @maaiz: "want to be able to place new exercise added during session at wanted order — before cooldowns especially".)

---

## QA pass · 2026-05-23 — Wellness inputs + broader image audit (qa: wellness-hydration-tracking, wellness-sleep-tracking, exercise-local-images)

Three asks bundled into one push.

### Addressed
- **wellness-hydration-tracking** — confirmed the storage layer already does what @maaiz asked: `writeHydrationToday` REPLACES the day's value (no Math.max merge), so reductions persist. Added a direct-set numeric input alongside the existing +/- buttons so users can type the full day's count in one go instead of tapping + 8 times. Helper line `Update any time — latest entry wins, even if reduced` documents the behaviour explicitly.
- **wellness-sleep-tracking** — added a numeric input (0.25-precision decimal) next to the 5-9h chips so users can record 7.5h or update after a nap (e.g. 7 → 8.25). `setSleepHoursDirect` clamps 0..24 and writes through `updateSleep` which merges to the same daily entry. Helper line `Update any time — add a nap to the total or change the value entirely`.
- **exercise-local-images** — subagent audited every locally-hosted stretch/warmup/cooldown image (25 pairs) against the spec in `public/stretches/README.md` + the `lib/stretching.ts` cues. Three additional ids pulled from `LOCAL_STRETCH_IDS` (now show emoji fallback): `cd-glute-pretzel` (not a figure-four pull), `terminal-knee-extension` (both frames identical), `high-knees` (frame 1 doesn't mirror). Three MOSTLY-OK left in place but noted on CLAUDE.md reminder for review: `cd-lat-stretch`, `plyo-pushup`, `star-jump`. 18/25 verified correct.

### Backlog
- **Tier icon refresh** (added to CLAUDE.md reminder) — @maaiz wants custom-generated sick icons for the vivid theme (Bear, Gorilla, Big Dawg, Lion in particular). Wire-up in `lib/tiers.ts` to support `<img>` instead of emoji glyphs. Slot the request next to the existing wrong-form-images reminder so both image-gen tasks are tracked together.

---

## QA pass · 2026-05-23 — Rest counter on LOG SET button when overlay skipped (qa: workout-rest-skipped-counter)

Added a `screenDismissed` state + `dismissScreen()` action to the `useCountdown` rest hook. The SKIP button on the rest overlay now calls `dismissScreen()` instead of `stop()` — the overlay hides but the timer keeps ticking. While `rest.running && rest.screenDismissed`, the LOG SET button label appends ` · REST <n>s` so the user is aware they're still inside their planned rest window even though the screen is dismissed. Works across exercises (timer is hook-level). The next set's logSet → rest.start() resets `screenDismissed` so the next rest cycle shows the overlay normally. Doesn't block the tap — purely informational.

---

## QA pass · 2026-05-23 — Completed-summary directional arrows (qa: workout-completed-summary)

Slice 2: each set in the THIS line now carries a tiny ▲ (green, this set's e1RM > last session's best by ≥0.5%), ▼ (red, < by ≥0.5%), or `=` (dim grey, within ±0.5%). Reference is `estimate1RM(lastWeight, lastReps)` from `lib/performance.ts`. Assisted sets render with no arrow until workout-assisted-exercise slice 2 wires bodyweight-aware effective load.

---

## QA pass · 2026-05-23 — Completed exercise summary line (qa: workout-completed-summary)

Adds a small dim two-line strip under the per-set chip ticks once an exercise is fully logged. Line 1: `THIS <set1> · <set2> · ... ` showing weight×reps for each logged set this session. Line 2: `LAST <best>kg × <reps>` for quick comparison vs last session (only if a prior session exists). Assisted sets render as `-<assistance>kg×<reps>` so band/machine help is visible. No collapse/expand needed — the data is right where the user just finished tapping ✓ chips.

---

## Nudge · 2026-05-23 — force redeploy (production stuck at 6c7b47e)

Vercel did not pick up the 3 commits after the cron-schedule change (d012874 workout polish · 538a274 effort prompt · deaa9db effort suggestion hint) — production stayed pinned to 6c7b47e ~57 minutes after the last real-content push. ignoreCommand confirmed PROCEED locally for the diff, so this is either a quota/queue issue or a missed webhook. Empty-ish nudge commit to force a fresh build attempt.

---

## QA pass · 2026-05-23 — Effort prompt suggestion hint (qa: workout-effort-prompt)

Slice 2 of the effort backfill prompt — added a ★ LIKELY badge above whichever chip matches the user's most recent RPE for the same exercise (this-session first, then last-session). Pure visual cue: the chip is NOT pre-selected, the user still has to tap to confirm. New help line `★ HINT BASED ON YOUR RECENT EFFORT — TAP TO CONFIRM` only renders when a suggestion is available. Brand-new exercises with no history show the prompt with no hint.

---

## QA pass · 2026-05-23 — Effort backfill prompt (qa: workout-effort-prompt)

Quick follow-up to the polish batch — added the post-LOG-SET prompt the user asked for. When the user logs a set without picking an effort chip, a small bottom-sheet appears with the 1-10 chips inline; tapping one backfills the just-logged set's rpe via `patchSet`. SKIP dismisses without saving; DON'T ASK AGAIN sets a session-scoped suppression flag that resets when the workout ends. Works across all three log-set branches (standard, superset, drop set).

---

## QA pass · 2026-05-23 — Workout polish batch (qa: workout-warmup-skip, workout-warmup-mark-each-set, workout-set-edit-after-done, workout-set-edit-effort, exercise-local-images, session-autoresume-silent, workout-assisted-exercise, workout-music-launcher, home-hub-singleline, profile-avatars, workout-equipment-aware-input)

Processing pass for the 9 unprocessed QA comments + two new bug reports surfaced mid-session by @maaiz. 12 distinct fixes shipped in a single push.

### Addressed
- **workout-warmup-skip + workout-warmup-mark-each-set** (@maaiz) — Warm-ups/stretches now ALWAYS expand on tap (removed the hidden single-set tap-cycle). Per-set chip panel shows explicit ✓ MARK DONE and ↷ SKIP buttons side by side for every set, regardless of set count. Multi-set rows also keep the ✓ ALL DONE / ↷ SKIP ALL bulk actions.
- **workout-set-edit-after-done** (@maaiz) — Exercise rows used to early-return on tap once all sets were logged, making EDIT SETS unreachable. Now the row still expands so the EDIT SETS button stays available.
- **workout-set-edit-effort** (@maaiz) — Added a 1-10 EFFORT chip row to the set-edit modal (mirrors the in-session UX). Includes a CLEAR link when a value is selected. RPE was already in the stored set shape; UI just hadn't exposed it.
- **exercise-local-images / scap push-ups** (@maaiz) — Removed `wu-scap-shrugs` from `LOCAL_STRETCH_IDS` so users see the emoji fallback instead of the wrong frames (which depicted a man standing instead of a plank-position scap push-up). Added a pending reminder to `CLAUDE.md` so the user can regenerate the correct frames later.
- **workout-set-logging / effort scale contrast** (@maaiz) — Effort levels 1 and 2 used `rgba(255,255,255,0.3)` / `0.4` which made the text and border near-invisible. Bumped to slate (`#94a3b8`, `#a3b3c1`).
- **session-autoresume-silent** (@maaiz) — Removed the `resumeOverlay` state + the full-screen "SESSION RESTORED · GOT IT" panel. Restoration is silent now; the home active-session card already telegraphs the resumed workout.
- **workout-assisted-exercise** (@maaiz) — Slice 1/2: added a `− ASSISTED` button alongside `+ ADD WEIGHT` for bodyweight exercises. When active, the weight input represents ASSISTANCE in kg and gets stored on the set as `assistance: N`. Mutually exclusive with ADD WEIGHT. **Slice 2 (next pass)** wires bodyweight-aware volume math in `lib/leaderboardStats.ts`: for sets with `assistance` field, volume += max(0, bodyweight − assistance) × reps.
- **workout-music-launcher** (@maaiz) — Replaced the single Spotify-only `♪ MUSIC` pill with TWO branded buttons: Spotify (green, circular-bars mark, spotify:// deep link) and Apple Music (pink gradient, eighth-note square mark, music:// deep link). Both fall back to the web player after a 400ms scheme-resolution window.
- **home-hub-singleline** (@maaiz) — Switched the top-row layout from flex+min-widths (which wrapped the tier card onto a second line on narrow phones) to a hard `gridTemplateColumns: 1fr 1fr 2fr`. Profile + progress now reliably occupy the left half; the tier card holds the right half at all widths. Athletes see only the athlete tier; trainers see both (trainer + athlete) stacked inside the right half.
- **profile-avatars** (@munchy) — The avatar picker render was mounted inside `view === "customise"` so tapping the ✎ pencil from Settings/Profile silently no-op'd. Moved the entire render to HomePage's top-level return next to the tier promotion toast — picker now opens from any view.
- **workout-equipment-aware-input** (@maaiz — flagged mid-session) — Per-equipment ± increments on the weight input. Barbell + dumbbell: 2.5kg (plate). Machine + cable: 5kg (pin). Everything else: 1.25kg (fine). Label hint surfaces both the step size and the equipment type. No regression for manual typing.

### Slices / partials
- `exercise-local-images` — slice 1/2. Wrong asset hidden, regeneration pending. Logged as a CLAUDE.md reminder.
- `workout-assisted-exercise` — slice 1/2. UI + storage shipped, volume math integration is the next slice.

### Files touched
`app/page.tsx` (warmup chip panel, set-edit modal RPE row, allDone tap handler, music launcher, top-row grid, avatar picker mount, assisted state + button + step-aware ± buttons, silent restore), `lib/performance.ts` (EFFORT_SCALE colors), `lib/exerciseImages.ts` (wu-scap-shrugs removal), `CLAUDE.md` (pending reminder), `qa-state.json` (11 new/updated items), `qa-processed.json` (9 new entries).

---

## QA pass · 2026-05-23 — Test user generator (qa: test-user-generator)

Synthetic test-user system for observing how tier evolution + trainer client data shape up over time. Lets the admin seed a fixed roster, advance their activity manually OR via daily cron, toggle whether they show on public boards, and bulk-wipe them.

### Addressed
- **Schema** (`prisma/schema.prisma`): added `User.isTestUser` boolean + `User.testArchetype` string?, and a new `AppConfig` key/value table for app-wide settings (currently just `showTestUsersInLeaderboards`).
- **`lib/testUsers.ts`**: archetype catalogue (8 entries — completionist, completionist_f, grinder, inconsistent, beginner, veteran, plateauer, quitter), a fixed 15-user seed roster (13 athletes + 2 trainers with adopted rosters of 4 each), deterministic PRNG for idempotent day rolls, `seedTestUsers()` / `wipeTestUsers()` / `tickAllTestUsers()` / `advanceTestUsers(N)` operations, AppConfig helpers.
- **`/api/admin/test-users`** route: GET (list test users + visibility toggle state + shared password) + POST (seed | wipe | tick | advance | set-visibility). Admin-key gated.
- **`/api/admin/test-users/cron-tick`** route: GET endpoint for Vercel cron. Auth via `Authorization: Bearer ${CRON_SECRET}` OR admin key. Idempotent.
- **`vercel.json`**: added `crons` entry hitting `/api/admin/test-users/cron-tick` daily at 09:00 UTC. **You need to set `CRON_SECRET` in Vercel env vars for the cron's auth header to land — without it the cron fires but my endpoint rejects unauthenticated requests.**
- **Settings UI** in `app/page.tsx`: new `DEV TOOLS` section above `FEEDBACK & QA`. `TestUserGeneratorPanel` component: admin-secret unlock → roster list with copy buttons + shared password + visibility toggle + SEED / WIPE / ADVANCE N days / TICK buttons + archetype legend.
- **Leaderboard filtering**: `/api/leaderboard/global` (athlete tab + trainer tab) now filters `isTestUser: false` unless `AppConfig.showTestUsersInLeaderboards` is true. Defaults OFF so synthetic data never leaks to real users.

### Login as a test user
All 15 share password `IronlogTest2026!`. Usernames follow `test_<archetype>_<name>` (e.g. `test_completionist_alex`, `test_trainer_morgan`). The admin panel surfaces the full list with copy buttons.

### Not affected
- Trainer-only leaderboard (`/api/trainer/leaderboard`) — always shows clients regardless of test flag, because the entire point is to see test athletes in a trainer's roster.
- Group-scoped leaderboards (`/api/leaderboard/mine`, `/api/leaderboard/groups`) — membership-based; test users only appear if explicitly added to a group.

### Items NOT shipped
- **Auto-create test users in groups** — defer; if you want to see test users in group leaderboards, manually add them once.
- **Sex-aware archetype expansion (`f` variants for every archetype)** — only added `completionist_f`. Other female-archetype variants can be added later if you need broader sex-aware coverage.

---

## QA pass · 2026-05-23 — Tier scoring v2 ship + client leaderboard relocation (qa: tier-scoring-v2, client-leaderboard-relocation, tier-promotion-toast)

Full rollout of the design captured in the 2026-05-22 plan, with deep-think refinements that emerged in the conversation:

### Addressed
- **tier-scoring-v2** — `lib/tiers.ts` substantially reworked:
  - **Strength** now measures **e1RM trend** over the last 180 days across the user's top 6 most-trained exercises (each filtered to ≥4 sets logged in the window). Avg % change maps `-5% → +15%` linearly into `25 → 100`. Floor at 25 keeps maintainers from crashing.
  - **Progression** is a new 6th sub-rank. Linear regression of weekly volume over the available window (cap 180d). Slope-as-%-of-mean → `≤0%/wk = 30`, `0-1%/wk = 30-70`, `1-3%/wk = 70-100`. <9 weeks of data → `hasData: false` so new users aren't penalised.
  - **Body Comp** new sub-rank. Sex-calibrated curves (reads `UserProfile.gender`): healthy BF midpoint ~14% for male, ~22% for female (other/unset uses unisex midpoint). Score = 60% current-condition triangular curve + 40% 90d-maintenance (small drift = high score). `hasData` false when neither weight nor BF logged.
  - **Consistency rebuilt** — was 50% lifetime sessions + 40% adherence + 10% daily streak. Now 30% 180d sessions + 60% adherence + 10% **weekly** streak. Drops the lifetime-sessions decay problem (quitters used to score 80 forever) and the daily-streak conflict with rest-day adherence.
  - **Mastery** raises the bar — counts exercises with ≥4 sets in 180d instead of "logged at least once". Midpoint dropped from 25 to 18 to match the higher quality threshold.
  - **`hasData` weighting** — every sub-rank now returns `{ score, hasData, detail }`. Headline averages ONLY over sub-ranks where `hasData=true` so users without wellness/body-comp/exercise history aren't silently penalised.
  - **`focusNext` highest-leverage** — picks the dim with the largest `100 - score` upside (i.e. the dim that moves the headline most when lifted to its ceiling), tie-breaking on lowest score. Replaces the old "lowest score wins" which gave bad advice when a single dim was almost at its next breakpoint.
  - **`tierScoreBonus` removed from the canonical headline math**. Lucky-drop bonus still gets awarded to the profile field and the avatar page still shows it; it just no longer secretly injects into the tier score. Restores single-source-of-truth for tier scoring.
  - **IP RPE expansion** — `lib/leaderboardStats.ts` now adds `max(0, rpe - 7)` per set to the total IP. Pre-existing supersets/dropsets (+5/+3) awards still apply. RPE 10 = +3, RPE 9 = +2, RPE 8 = +1.

- **client-leaderboard-relocation** — Removed the 95-line inline trainer client leaderboard from the home view. Extracted as a reusable `ClientLeaderboardBlock` component. Mounted in two places:
  1. **Ranks page** — added a new 👤 MY CLIENTS tab (trainer-only) alongside ATHLETES and TRAINERS. Trainers can now jump from home → Ranks → MY CLIENTS instead of scrolling home.
  2. **My Clients hub** — added at the bottom of the page as a contextually-adjacent ranking surface.

  New columns: `# / CLIENT (with tier subtitle) / VOL / SESS / STRK / PR / IP`. Sort chips: SESSIONS / VOL / STREAK / ⚡ IP.

  Design rule captured: **"if a feature has its own tab/button, no inline duplicate on home"**.

- **tier-promotion-toast** — top-level toast that fires when the user's headline tierNum increases vs the last-observed value stored in `localStorage.ironlog.lastObservedTier.<userId>`. First observation is silent (baseline). Demotions are silent + resync. Tap-to-dismiss + 4s auto-dismiss.

### Items NOT shipped (explicitly deferred per user)
- **Tier calibration grace for new users** (item 10 in the punch list) — deferred.
- **Vacation grace window** (item 11) — deferred.
- **Migration notification card** — the tier-promotion toast covers the "your tier changed" affordance for upward moves; users whose tier *drops* under v2 won't get a notification. Decided not worth a one-time migration banner — the existing tier modal already explains every sub-rank.
- **Backlog items 12-16** (tier history snapshots, per-group weights, scoreFromCount compression, headline caching, sanity bounds on weights) — backlog as planned.

---

## Plan · 2026-05-22 — Tier scoring veteran-fairness + body comp + leaderboard refresh (qa: tier-scoring-veteran-fairness)

User feedback bundle captured as a design-only slice (NO code shipped):

- **PR plateau:** "tier system using recent PRs seems too easy points
  for a newcomer ... don't want them to plateau because they stopped
  hitting first-time PRs but stayed consistent and tried to progress".
  Strength sub-rank (`prCount` log curve) heavily front-loads beginners
  and starves veterans who don't hit new lifetime maxes.
- **Body composition:** "I want body fat% and bmi together to be used
  to calculate a body score or something to be part of their tier
  because how in shape they are is a valuable thing especially to be
  maintaining". Data is already there: `UserProfile.heightCm`,
  `weightKg`, `bodyFatPct` + historical `BodyMetric` rows.
- **Leaderboard columns:** "current sesh leaderboards don't make sense,
  I like the total volume pushed and stuff". Trainer's inline client
  leaderboard on home is the surface in question (SESS/STREAK/PRs/⚡IP).
- **Ranks ↔ Tier modal split:** Ranks button on home holds ALL
  leaderboard surfaces; Tier modal stays as pure ladder-explainer
  (with optional links back to leaderboards — confirmed OK).

Full spec in qa-state.json item `tier-scoring-veteran-fairness`. To pick
up tomorrow: confirm direction with user, prototype on a feature flag,
sketch a "your new tier would be X" migration screen so existing users
aren't surprised when their headline shifts.

---

## Infra · 2026-05-22 — Nudge Vercel: production stuck due to SHA dedupe across branches

Production stopped at `3b402ea` (Tier 1+2 avatars). Two subsequent
commits — `83f652f` (splash hero + picker UX + chip strip + music
move) and `c12afca` (final 3 form frames) — pushed to main + branch
in quick succession only got built as **previews** on the branch;
Vercel deduplicated by SHA and silently dropped the corresponding
production deploys.

Pattern to avoid in future: when shipping work, push to main FIRST,
let the production build register, THEN push the same SHA to the
working branch if needed (or skip the branch push entirely — main
is canonical per CLAUDE.md). Pushing both within the same second
trips Vercel's SHA-dedupe.

This commit is a no-op nudge with a fresh SHA. Pushing to main only
this time. Vercel's `ignoreCommand` will see the changes-since-last-
deployed-SHA span everything from `3b402ea`→here (including all the
real work in `83f652f` and `c12afca`) and proceed with the deploy.

---

## Assets · 2026-05-22 — Final 3 form frames → 82/82 image-gen complete ✅ (qa: exercise-local-images)

User uploaded the last 3 missing exercise frames to Drive root.
Pulled via the Drive MCP, identified each visually, placed.

- `public/stretches/wu-scap-shrugs/0.png` ← arms-relaxed standing portrait
- `public/stretches/wu-scap-shrugs/1.png` ← shoulders-shrugged-up portrait
- `public/stretches/broad-jump/1.png` ← airborne mid-leap (pairs with the
  loaded squat at frame 0 shipped in the original batch)

That closes the image-gen arc: **30/30 avatars + 52/52 exercise
frames + the splash hero = 82/82 user-facing assets all live.**

CLAUDE.md reminder ticked complete.

---

## Polish · 2026-05-22 — Splash hero live + avatar picker UX + home chip strip + music/quit separation (qa: splash-polish, profile-avatars, home-hub-singleline, workout-session-start)

User flagged four concerns; bundled into one push.

### 1. Splash hero (qa: splash-polish)
`public/ai/splash-hero.png` was never uploaded — splash had been
falling back to `home-hero.jpg` @ 15% opacity + blur(3px) +
saturate(0.6), effectively invisible behind the logo. Pulled the
user's freshly-generated chrome-barbell hero (941×1672) from Drive
via the Drive MCP and dropped it in place. Splash now renders the
cinematic intended visual.

### 2. Avatar picker UX (qa: profile-avatars)
User: "There's no way to change my avatar". The picker did exist,
but the entry point was a 18×18 ✎ badge on the 52×52 avatar — too
small to read as interactive on mobile. Fixes:

- Added a clearly-labelled `✎ CHANGE AVATAR` button under the IDENTITY
  card (cyan-tinted text-button, Space Mono caps).
- Bumped the existing pencil badge from 18×18 / 9px font to 20×20 /
  11px font as a secondary affordance.
- Picker tiles for LOCKED avatars: per user spec ("greyed out without
  a preview"), the image is replaced with a dashed-border placeholder
  showing a centered 🔒 emoji. The tile's opacity is bumped from 0.35
  to 0.6 so the name + tier badge stay legible. Unlocked tiles still
  show their full-colour artwork.

### 3. Home top chip strip (qa: home-hub-singleline)
User: "progress button can be between profile and tier buttons; profile
and progress on one side, tier wider on the other side". The top-of-home
strip was a 2-button row (Profile, Tier). Now 3 chips in order
Profile → Progress → Tier, with Profile + Progress narrower
(`flex: 1 1 100px`) and Tier widened (`flex: 2 1 220px`) since its
trainer/athlete pills + progress bars need the room. New Progress
chip is a compact icon+label button styled like its neighbours;
tapping opens the Progress dashboard. The existing Progress button
in the bottom hub row stays as a secondary entry point.

### 4. Music vs Quit separation (qa: workout-session-start)
User: "Move the music button away from quit — no accidents". In the
active workout header, ♪ MUSIC sat right next to QUIT × on the right
with only `gap: 10px` between them. Moved MUSIC to the LEFT cluster
(next to ← Home) so the right side has QUIT × alone. Mis-tap risk
between Music and Quit eliminated; behaviours unchanged.

---

## Assets · 2026-05-22 — Tier 1+2 avatars complete (30/30 avatars ✅) (qa: profile-avatars)

@maaiz uploaded the missing 6 avatars (3 starter, 3 fox) to Drive
root with iOS UUID filenames. Pulled via the Drive MCP
(`download_file_content` → base64 → decode), identified each against
the catalogue, placed at `public/avatars/`.

### Shipped
- `starter-spark` (flame on glowing coals, warm ring)
- `starter-dawn` (sunrise on horizon over ocean, soft warm ring)
- `starter-seedling` (sprout breaking through cracked earth, green ring)
- `fox-sprint` (low-poly fox running in profile, motion lines, silver
  ring)
- `fox-emberbolt` (lightning bolt + flame swirl + white-tipped fox tail,
  fiery orange ring)
- `fox-stride` (silver paw-prints with motion lines, white ring)

### Coverage
- **Avatars: 30/30 ✅** All tiers (starter through bear) plus all 10
  lucky drops are now real artwork. Tier-1 starter unlock + tier-2
  fox unlock now show the proper distinctive emblems instead of the
  gradient default.
- **Exercise frames: 49/52.** Still pending: wu-scap-shrugs ×2,
  broad-jump frame 1.

### Notes on pipeline change
Chat-pasted images aren't materialized to disk in the remote
container, so the user re-uploaded the 6 to Drive root. Drive MCP
auth uses the user's session, so files don't need to be set to
"Anyone with the link" (which gdown requires) — they can stay
restricted. Future single-file delivery can skip the public-share
step.

---

## Assets · 2026-05-22 — Image-gen batch landed (73/82) (qa: profile-avatars, exercise-local-images)

@maaiz delivered the generated image assets via a Google Drive folder
of 77 unnamed PNGs. Identified and routed every file against the
catalogue (30 avatars + 26 movements × 2 frames = 82 expected slots).

### Shipped (73 files into `public/`)
- **24 avatars** → `public/avatars/<id>.png` (Tier 3 dawg, Tier 4 lion,
  Tier 5 gorilla, Tier 6 bear, all 10 lucky)
- **49 exercise frames** → `public/stretches/<id>/{0,1}.png` covering 26
  movements, with the following pairs filled: cd-chest-doorway,
  cd-pigeon, cd-hamstring-lay, cd-lat-stretch, cd-glute-pretzel,
  wu-leg-swings, bear-crawl, elliptical, inchworm, lateral-bounds,
  lateral-shuffle, plyo-pushup, speed-skaters, split-jumps,
  squat-thrust, star-jump, tuck-jumps, jumping-jacks, burpees,
  high-knees, wall-sit, wall-slide, terminal-knee-extension, bird-dog,
  + broad-jump frame 0.

### Sorting approach
Filenames were timestamp-stubs (`image__20260522-160008.png` etc.) plus
4 random short names — no structural hints. Used a 4-way parallel
vision pipeline (gdown the Drive folder → md5 dedupe → 4 subagents
each identifying ~19 images against the catalogue → aggregate +
conflict-resolve). Byte-identical pair: `rwqrwe.png` was the same file
as `image__20260522-160008.png` (lion-crown) — dropped.

Four reassignments needed user confirmation (and got it):
- `image__20260522-160341.png` → `lion-mane` (mane-only sigil; initial
  guess was dawg-howler but jbh.png was the cleaner howler match).
- `image__20260522-172315.png` → `cd-pigeon/0.png` (low-lunge setup).
- `image__20260522-191808.png` → `tuck-jumps/0.png` (standing prep
  before the airborne tuck at frame 1).
- `image__20260522-192325.png` → `burpees/0.png` (pushup phase of a
  burpee; reassigned from a duplicate plyo-pushup-0 candidate to fill
  the otherwise-missing burpees frame 0).

### Still pending (9 slots — see CLAUDE.md reminder)
- All Tier 1 avatars (starter-spark / starter-dawn / starter-seedling)
- All Tier 2 avatars (fox-sprint / fox-emberbolt / fox-stride)
- `wu-scap-shrugs/0.png` and `wu-scap-shrugs/1.png`
- `broad-jump/1.png` (airborne / landing)

User said they'd grab the remaining 9 from their laptop and follow up.
Existing text-card placeholders stay in place for those slots until
they land.

### Housekeeping
Removed stray `public/avatars/d` (1-byte typo artifact, contents = `\n`).

---

## Infra · 2026-05-22 — Vercel ignoreCommand + deploy-frugality discipline (qa: vercel-ignore-deploys)

@maaiz: hit the Vercel deploy limit again. Two fixes — server-side
guardrail + behavioral change documented for future sessions.

### Server-side: `vercel.json` ignoreCommand

New `vercel.json` wires `ignoreCommand` to
`scripts/vercel-should-skip.sh`. The script runs on every Vercel
build and:

- Diffs against `$VERCEL_GIT_PREVIOUS_SHA` (the last successfully
  deployed commit).
- If every changed file matches a "safe-set" pattern → exit 0 →
  Vercel cancels the deploy (no quota burn).
- If ANY file is outside the safe set → exit 1 → deploy proceeds.

Safe-set (runtime-invisible files) — auto-skip:
- `qa-comments/**` (audit mirrors written by the live app, never
  read at runtime)
- `scripts/**` (dev-only helpers, not bundled)
- `CLAUDE.md`, `README.md`, `image-prompts.md`
- `public/stretches/README.md`, `public/avatars/README.md`
- `.gitignore`

NOT safe (still triggers deploy): `qa-state.json` (read by
`/api/qa`), `qa-processed.json` (read by `/api/qa/comment`),
`PATCHLOG.md` (read by `/api/version`), `prisma/schema.prisma`,
`app/**`, `lib/**`, `public/avatars/*.png`, `public/stretches/<id>/*.png`,
`package.json`, etc.

Conservative on purpose — false-positive deploys cost quota,
false-negative skips cost a missing feature.

### Behavior: CLAUDE.md discipline section

New "Deploy frugality — bundle work before pushing" section in
CLAUDE.md so every future Claude session reads the rule on
session start:

- Bundle related slices into one push, not push-between-micro-
  iterations.
- Combine independent slices when both are low-risk and ready.
- Trust the ignoreCommand; don't try to push pure-docs commits to
  trigger a "real" deploy.
- User saying "ship it" / "push to main" overrides batching.

### Smoke-tested locally

Verified the regex with two synthetic diffs:
- `CLAUDE.md` + `qa-comments/abc.json` + `scripts/foo.ts` → SKIP
- `CLAUDE.md` + `app/page.tsx` → PROCEED

(qa: vercel-ignore-deploys)

---

## Polish · 2026-05-22 — Splash duration bump + image-batch unpack helper (qa: splash-polish, image-batch-script)

Two small wins in one commit:

### Splash: 2.0s → 2.4s

Previous 2s window cut the light-sweep cycle mid-flight. Bumped
to 2.4s and tightened the sweep to a 1.4s cycle with 1.0s delay
so the user sees one full sweep complete before the splash
dismisses. Math:
- 0.85s — impact + shockwave fire
- 1.00s — sweep starts
- 1.25s — tagline fades in
- 2.40s — sweep first cycle completes, splash dismisses

### Image-batch unpack script

New `scripts/unpack-image-batch.ts`. Takes either a directory or
a .zip file with this layout:

```
avatars/<id>.png
stretches/<id>/0.png
stretches/<id>/1.png
```

Routes each into the right `/public/...` destination, skips
anything outside the pattern (logs the reason), idempotent on
re-run. System `unzip` required if you pass a .zip.

Usage:
```
npx tsx scripts/unpack-image-batch.ts ~/Downloads/ironlog-images-batch.zip
git add public/avatars public/stretches
git commit -m "chore: import image batch"
git push origin main
```

Designed for Amanii's 80-image batch handover but generalises for
any future bulk image drops.

(qa: splash-polish, image-batch-script)

---

## Polish · 2026-05-22 — Splash screen: 3D logo + light sweep + particles + camera drift (qa: splash-polish)

@maaiz: "I really want a better modern aesthetic 3D splash screen
still with animations. Can generate some stuff if you have any
great ideas." → went with Direction A (cinematic chrome barbell).

User generated a stunning 1080×1920 photoreal hero — chrome
Olympic bar with red-stripe bumper plates, dramatic single-source
light beam from upper-right, deep matte-black void with subtle
atmospheric haze. Drop at `/public/ai/splash-hero.png` and the
splash picks it up; falls back to the existing dim `home-hero.jpg`
if the file isn't there yet.

### Polish landed in the splash component

- **Full-bleed hero image** at 0.85 opacity, replacing the
  near-invisible 0.13-opacity gym photo backdrop. Wrapped in
  `.splash-camera-drift` so the image subtly drifts ±0.5% scale
  + translation over a 14s ease cycle — subliminal "the camera
  is alive" feel.
- **3D extruded IRONLOG logo** — `.splash-logo-3d` adds multi-
  layer text-shadows that create chrome depth on the letters
  without any 3D library. White IRON + red LOG read like
  iron-stamped plate text.
- **Light sweep** — `.splash-logo-sweep` slides a diagonal
  highlight across the logo letters once per 3.6s loop. Polished-
  surface-catching-the-light vibe.
- **Particle drift** — 10 dust motes float up from below at
  randomised speeds and lateral drifts. CSS-only, no library.
  Each particle has slight red+white box-shadow so they read on
  the dark hero.
- **Layered vignettes** — radial centre-to-edge darkening + top
  gradient (logo legibility) + bottom gradient (tagline
  legibility). Strong enough that text reads cleanly over the
  rich hero.
- **Logo composition reflowed** — moved to the upper third of
  the viewport so the hero image's barbell stays visible in the
  middle. Tagline + shimmer loading bar pinned to bottom 11vh.
- **BarbellMark removed** from the splash — the hero image is now
  the barbell. Component still exists for other surfaces; this
  just stops it competing with the new background.

### Animations active during the splash (now)

1. `splashCameraDrift` — 14s ambient image drift
2. `logoFall` — IRON + LOG letters bounce in
3. `impactGlow` — red flash on logo land
4. `shockwave` — two expanding rings from the impact point
5. `floorBeam` — horizontal light line under the logo
6. `splashLogoSweep` — diagonal highlight sliding across letters
7. `splashParticleDrift` — 10 dust motes drifting up
8. `fadeIn` — tagline fades in after the impact
9. `shimmer` — loading bar gradient continuously sweeps

(qa: splash-polish)

---

## Polish · 2026-05-22 — Home hub: single-row + contributors on /qa (qa: home-hub-singleline, contributions-on-qa-board)

@maaiz: "The quick actions need to be dynamically changing to fit
in one line on mobile, centered on desktop. They also don't need
a quick actions label as the buttons are self explanatory."

Plus: "I can't see Amanii's image contributions added to the QA
leaderboard. She did some heavy lifting there."

### Hub buttons → single row

- Section header (⚡ + "QUICK ACTIONS" + divider) removed. Icons
  + labels are self-explanatory.
- Layout switched from 2-col grid to flex row. Each button
  `flex: 1 1 0` with `minWidth: 0` so they share space evenly
  and labels truncate gracefully on very narrow viewports.
- Padding reduced (12px vertical, 6px horizontal) and label
  fontsize trimmed (12px → 11px) so 5 buttons fit on a 380-390px
  mobile viewport without wrap.
- "Leaderboards" shortened to "Ranks" since the 🏆 icon already
  carries the meaning — the rest of the labels stayed.
- Container `maxWidth: 480` + `margin: auto` centres the row on
  desktop.
- Badge counters (Messages unread, Clients count) repositioned
  to the new tighter button corners.

### Contributors leaderboard visible on /qa

- Added a new `ContributorsLeaderboard` section to `/qa`, right
  below the FEEDBACK LEADERBOARD. Surfaces lib/contributions.ts
  entries filtered to non-QA-feedback kinds (asset-generation,
  code, design, other) — so heavy lifters like Amanii (80 image
  assets) get credit on the QA board too, not only in Settings →
  Contributors.
- Pure-QA testers are NOT duplicated here (they already get
  visibility on the FEEDBACK LEADERBOARD above).
- Sorted by non-QA contribution count, medals for top 3.
- Each row lists the contributor's kinds with their per-kind
  count chips (e.g. 🎨 ART ×80 "Generated all 80 image assets…").
- Helper text under the header points future contributors at
  `lib/contributions.ts` for additions.

(qa: home-hub-singleline, contributions-on-qa-board)

---

## Feat · 2026-05-22 — Athletes can view their groups (qa: athlete-groups-view)

@maaiz: "Yes let athletes have a group section too for their groups.
Can they make groups with other athletes? Maybe we do need a friend
system."

### Slice 1/N — Athletes get the Groups button

- The Groups nav button in QUICK ACTIONS is now visible to ALL
  roles (was trainer-only). Athletes who've been added to a group
  via a trainer's "+ ADD CLIENTS" flow can now find that group
  from the home hub.
- "+ NEW GROUP" inside the Groups view stays trainer-gated for
  now (slice 2 of this arc unlocks athlete-created groups).
- Empty state for athletes reworded:
  - Trainers see: "No groups yet — create one above"
  - Athletes see: "You're not in any groups yet. Ask a trainer to
    add you to one of theirs, or accept an invite when you receive
    one."
- The rest of the view's actions (group leaderboard view modes,
  group-workout apply, group challenges contribute) all work for
  athletes — they were already gated correctly per action (creator
  checks, API-side trainer checks).

### Held back for follow-up slices

- **Athlete-created groups.** Requires (a) removing the
  "trainers only" check on POST /api/leaderboard/groups, (b) a
  new invite-by-username UI for athletes (current trainer
  invite-trainer flow only invites trainers). API-side change is
  small but the UI is non-trivial.
- **Friend system.** My take: not needed YET. The existing
  invite/accept gate is the consent mechanism. Adding friends
  adds another layer that could become friction. Revisit if/when
  athletes-create-groups is shipped and we see actual user-to-user
  invite abuse.
- **Self-leave button for athlete members.** Group members can
  toggle includeInRank but can't currently remove themselves
  entirely. Worth adding in slice 2.

(qa: athlete-groups-view)

---

## Feat · 2026-05-22 — Home dashboard consolidation: Leaderboards + Groups + Clients as nav buttons (qa: home-hub-consolidation)

@maaiz: "Maybe all leaderboards can be organised into one leaderboard
section with a button in home page like messages. Same for groups
and maybe clients too. It would help clean up the main dash — saved
routines and my exercises can stay where they are I think."

Three new nav buttons added to QUICK ACTIONS, three inline sections
removed from home, two new dedicated views.

### Buttons added to QUICK ACTIONS (alongside Messages + Progress)

- 🏆 **Leaderboards** — visible to all roles. Opens
  `GlobalLeaderboardView` (athlete/trainer tabs + lens picker).
- 🏝️ **Groups** — trainer-only (matches the pre-existing
  trainer-only home gating for groups). Opens the new
  `groupsHub` view.
- 👥 **Clients** — trainer-only. Opens the new `clientsHub`
  view. Pill badge shows current client count.

The 2-col grid in QUICK ACTIONS naturally accommodates 4-5 items:
2 buttons for athletes, 4 buttons for trainers.

### Inline sections removed from home

- 🌍 GLOBAL RANKINGS wide card (was a single-purpose tap target;
  Leaderboards button supersedes it).
- 🏝️ GROUPS section (the ~630-line trainer-only group management
  block, including invites, member lists, leaderboards within
  groups, group-workout setup, group challenges).
- 👥 MY CLIENTS section (the ~80-line trainer roster + per-client
  cards).

The trainer-fragment `<>...</>` that wrapped TRAINER LEADERBOARD +
GROUPS got simplified back to a plain div now that GROUPS moved
out.

### New view branches

- `view === "groupsHub"` — wraps the lifted GROUPS JSX with a
  back-button header. All state (lbGroups, activeLbGroup,
  groupWorkoutCache, groupChallengesCache, etc.) still lives on
  HomePage so the JSX continues to work unchanged inside its new
  scope.
- `view === "clientsHub"` — same pattern for MY CLIENTS.

### Routing

- Swipe-back wired for both new views (returns to home).
- `clientDetail` swipe-back now returns to `clientsHub` instead of
  home, since users get there THROUGH the clients hub.
- Tap from QUICK ACTIONS button → setView to the appropriate hub
  → JSX renders → back button returns to home.

### What stayed inline (per @maaiz)

- YOUR SPLIT (day cards)
- SAVED ROUTINES
- MY EXERCISES (trainer custom exercises)
- All the energy/pro-tip cards above YOUR SPLIT

Home is now: welcome card → energy/tip/recap → YOUR SPLIT →
SAVED ROUTINES → (trainer LEADERBOARD summary) → MY EXERCISES
(trainer) → QUICK ACTIONS (5 buttons for trainers, 2-3 for
athletes).

(qa: home-hub-consolidation)

---

## Feat · 2026-05-22 — Contributors leaderboard + soft attribution for anonymous QA (qa: contributions-leaderboard, amanii-attribution)

@maaiz: "Amanii who's user wasn't logged in when doing the QA can
be assigned to the user for feedback history, and also manually
add her into feedback/contributions leaderboard as providing all
of the missing generated image content for avatars and missing
form previews (it's like 80 photos)"

### Soft attribution for anonymous testers

When a QA comment was posted with `userId=null` but the `tester`
field matches a real `User.username` (case-insensitive), the read
API now soft-attaches the user record at request time. No DB
migration, no JSON-mirror rewrite — works for Amanii's 4 historic
comments on auth-login, auth-register, auth-must-reset, and
auth-login (the second one).

Applied to:
- `GET /api/qa/comment` (public dashboard reads)
- `GET /api/qa/comments` (admin reads)

Anywhere the dashboard reads `c.user?.username ?? c.tester ?? "anon"`
(e.g. /qa unique-testers count, per-user grouping in the admin
processing pass) now sees Amanii's comments grouped under her
username.

Also generalises: any future tester who submits a comment without
logging in but types their actual username will be auto-attributed.

### Contributors leaderboard

- New `lib/contributions.ts` — static catalogue. Each contributor
  has `username`, `displayName`, and a list of typed
  contributions (`asset-generation` | `qa-feedback` | `code` |
  `design` | `other`) with `count`, `description`, and optional
  `at` date.
- New `ContributionsView` component (separate view, not modal).
  Ranked list sorted by total contribution count, medals for top
  3, per-contribution chips showing kind + count + date.
- Entry point on Settings → FEEDBACK & QA section: a "🏅
  CONTRIBUTORS" card opens the view. Swipe-back returns to
  Settings.
- Amanii seeded as the first entry: 80 image-asset generations +
  4 early QA comments = 84 total contributions, claiming rank #1.

(qa: contributions-leaderboard, amanii-attribution)

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
