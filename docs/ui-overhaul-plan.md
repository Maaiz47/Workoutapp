# UI Overhaul Plan — modernise, 3D depth, swipe-back coverage, leaderboard cleanup

Drafted 2026-06-10 from a three-part codebase audit (visual inventory, gesture
coverage, leaderboard surfaces). **Status: AWAITING DISCUSSION with @maaiz —
nothing implemented yet.** Each phase below is sliceable into one deploy.

---

## Part A — Visual modernisation + 3D depth

### A0. Where the app stands

The design system has strong bones: dark IRON base (`#0a0a0f`), DM Sans body +
Space Mono labels, semantic colors (red `#FF6B6B` = action, teal `#4ECDC4` =
accept/social, gold `#f0c040` = premium/trainer, purple `#A29BFE` = system),
three themes (IRON / MONO / VIVID), and real motion already in place
(`logSetFlash` 3D button press, `restTimerIdle` Y-rotation, `tier-shine`
shimmer, splash 3D logo).

Polish is unevenly distributed:

| Tier | Surfaces |
|---|---|
| **Premium already** | Home hero grid + day cards, workout session, profile IDENTITY card, tier modal, PB celebrations, splash, bottom nav |
| **Solid** | Messages inbox (system/group rows), day editor, progress charts, settings |
| **Flat (the work)** | Chat bubbles, friends/clients lists, exercise browser, leaderboard rows, inputs, wellness sections, empty states, onboarding |

**Strategy: raise the floor, don't invent a new language.** Extend the existing
premium patterns (multi-stop gradient + corner glow + inset top highlight +
soft drop shadow + glow-on-accent) to the flat surfaces. All depth work must
respect the MONO theme (which strips blur/glow/radius) — additions go through
classes/tokens MONO already overrides, not hardcoded inline shadows.

### A1. Foundation slice — shared depth tokens (do this first)

One small `globals.css` pass that everything else reuses:

- `.card-3d` — layered shadow recipe: `0 1px 0 rgba(255,255,255,0.05) inset,
  0 6px 22px -8px rgba(0,0,0,0.7)` (the nav-btn chrome, generalised).
- `.card-3d-hover` — `translateY(-1px)` + shadow expansion; active dips
  `scale(0.97)` (extends existing `.card-hover`).
- `.press-3d` — the `logSetFlash` perspective press
  (`perspective(600px) translateZ(-6px) rotateX(8deg)` + brightness flash)
  as an opt-in class for primary CTAs.
- `.focus-ring` — inputs: `0 0 0 3px rgba(var(--accent-rgb),0.25)` glow on
  focus + brightened border.
- `.glow-{teal|red|gold|purple}` — colored ambient glows for accents.
- MONO theme overrides flatten all of the above (already the pattern at
  `globals.css:336+`).

### A2. Surface slices, in priority order

1. **Chat bubbles** (`page.tsx:~14950`, conversation + groupChat) — HIGH.
   Directional shadows (sent harder, received softer), accent tint on sent
   bubbles, entrance slide-up + scale pop on new messages, unread glow.
   Currently the flattest core surface in the app.
2. **Exercise browser + customise rows** (`page.tsx:10602-10658`) — HIGH.
   Section color-coding (warm-up gold tint / main neutral / bonus red tint),
   row shadows + hover lift, icon chips in a colored circle gutter, search
   input focus glow.
3. **Leaderboard rows** (`page.tsx:5976+` and siblings) — MEDIUM-HIGH, and it
   rides with the Part C cleanup pass: alternating row backgrounds, medal
   drop-shadow + glow, current-user inset glow row, hover lift.
4. **Friends / clients lists** (`page.tsx:1771-1873`, clientsHub) — MEDIUM.
   Inline avatar thumbnails + tier glyphs on rows, colored accept/decline
   buttons, card shadows, section gradient separators.
5. **Inputs everywhere** (auth, plan, search) — MEDIUM. Apply `.focus-ring`,
   filled-state border brightening.
6. **Empty states** — MEDIUM. Bordered gradient card + a real CTA button
   (e.g. "START YOUR FIRST WORKOUT") instead of plain image + text.
7. **Wellness sections** (`page.tsx:1293-1442`) — LOW-MED. Colored left
   borders per metric (teal water / purple sleep / red soreness), section
   gradient underlines.
8. **Onboarding** — MEDIUM (first impression). Slide parallax, animated
   progress bar, 3D fade-in titles, CTA glow.
9. **Micro-polish batch** — checkbox spring animation w/ SVG check draw,
   tier-ladder dot glow + connector gradients, modal confirm/delete button
   gradients.

Each slice = one PATCHLOG entry + qa-state item, deployable independently.

---

## Part B — Swipe-back & basic-function correctness

### B0. Mechanism as-is

`useSwipeBack` (`page.tsx:687-722`): document-level touch listeners, left-edge
60px activation, 60px rightward drag, `dy < dx*0.7` diagonal guard, no slide
animation. A `swipeBackViews` set (`page.tsx:7178-7192`) gates 14 of 16 views.

### B1. Coverage gaps to fix

| Gap | Fix | Priority |
|---|---|---|
| `customise` view has NO swipe-back | Add to set. Needs a `customisePrevView` memory (entered from home OR workout) mirroring `groupChatPrevView` | HIGH |
| Profile preview modal (`previewUserId`) — tapped constantly, X-only | Swipe-to-dismiss (and these modals are full-screen: treat edge-swipe = close) | HIGH |
| Tier info modal, day-card expand, daily quest, weekly recap | Swipe-to-dismiss; all already have backdrop/X | MED |
| In-workout full-screen pickers (exercise browser, session browser, substitution, history, note) | Swipe-to-dismiss — generic "modal stack" handler: if any dismissible overlay is open, edge-swipe closes the TOP overlay instead of navigating the view underneath | HIGH (this one rule fixes ~12 modals at once) |
| `/qa` page | Edge-swipe → `router.back()` / link to app home | LOW |
| Onboarding steps | Edge-swipe = previous step (not dismiss) | MED |

**Proposed architecture:** instead of adding 12 modals to a set one-by-one,
introduce a tiny overlay registry: open modals push a close-fn onto a stack;
`useSwipeBack` pops the stack first, falls back to the view chain. One
mechanism, every current and future modal inherits it.

### B2. Gesture bugs to fix

1. **Left-edge horizontal-scroller hijack (real bug):** equipment-tag rows and
   substitute carousels (`page.tsx:10452, 10613, 13088`) near the left edge can
   trigger navigation when the user meant to scroll. Fix in `onTouchStart`:
   walk up from `e.target`; if an ancestor is horizontally scrollable
   (`scrollWidth > clientWidth`), don't arm the gesture.
2. **`groupChatPrevView` lost on reload** — back target defaults to
   `groupsHub` after refresh even when entered from messages. Persist to
   sessionStorage.
3. **No visual affordance** — gesture navigates with zero feedback. Optional:
   subtle slide/dim of the leaving view (framer-motion already in the bundle).
   Decide in discussion — adds polish but also complexity.

### B3. Basic-function verification sweep

While in there, verify-and-fix pass over: every view's explicit back button
matches its swipe target; pull-to-refresh on the three chat surfaces doesn't
regress; drag-to-reorder still wins its 350ms-hold race (audit says no
conflict, confirm on device).

---

## Part C — Leaderboards cleanup

Six surfaces exist: global athlete, global trainer, trainer-clients block,
group rankings (trainer view), My Leaderboards (Progress tab), group-chat
standings panel.

### C1. Logic / competitiveness (the substance)

1. **Inconsistent ranking metric** — global ranks by tier→sessions; groups
   rank by raw lifetime sessions; trainer-clients by sessions. **Proposal:
   headline score (0-100, the canonical tier score) becomes the primary sort
   on every surface**, with explicit tie-breakers (score → sessions →
   username) so ranks are deterministic. ← needs @maaiz sign-off
2. **Lifetime metrics bury new members** — a new athlete can never catch a
   veteran on cumulative sessions/volume. **Proposal: add a LAST 30D lens**
   (sessions/volume/PBs within the window) alongside ALL-TIME on group +
   global boards. Time-bound competition is what makes groups competitive. ←
   needs sign-off (touches `computeStatsForUsers`)
3. **viewerRank can be null** when the viewer is filtered out (coached filter)
   — compute pre-filter so "Your rank: #N" always shows.
4. **Null body metrics UX** — members without weight/BF logs silently sink to
   the bottom of WEIGHT/BF modes. Add a one-line hint: "Log weight/body fat to
   appear in this ranking."

### C2. Consistency / cleanliness

5. **Trainer badge everywhere** (open QA ask `trainer-badge-everywhere`):
   currently only the global athlete board shows the trainer-tier badge;
   backport to group rankings, My Leaderboards, trainer-clients rows.
6. **My Leaderboards has no column headers** — numbers are unlabeled. Add the
   header row the other surfaces have.
7. **Unify mode-button accent** (trainer group view uses red, others
   gold/teal) → teal everywhere; unify row padding (10px 12px).
8. **Weight direction toggle** — collapse the second LOSS/GAIN button row into
   the mode row.
9. **Tier fallback** — `?? "Kitten"` silently mislabels missing tiers → "—".
10. **Trainer-clients block** — 7 dense columns vs 3-4 elsewhere; trim to
    match (e.g. drop VOL or PB into the row subtitle).

### C3. Visual pass

Rides with slice A2-3: alternating rows, medal glows, current-user glow row,
consistent empty states.

---

## Suggested phasing (each = one deploy)

| Phase | Contents | Size |
|---|---|---|
| 1 | B2.1 scroller-hijack fix + B1 customise view + overlay-stack swipe-dismiss + groupChatPrevView persistence | M |
| 2 | C1 + C2 leaderboard logic & consistency cleanup (+ C3/A2-3 visual row pass) | M-L |
| 3 | A1 depth tokens + A2-1 chat bubbles + A2-5 inputs | M |
| 4 | A2-2 exercise browser + A2-4 friends/clients | M |
| 5 | A2-6..9 empty states, wellness, onboarding, micro-polish | S-M |

## Decisions (from @maaiz, 2026-06-10)

1. **Leaderboard metric:** default = **tier ranking** (not raw sessions — raw
   sessions = "oldest wins", which @maaiz explicitly wants to avoid). Newcomer
   catch-up handled by the 30-day lens (#2), not by changing the default.
2. **30-day lens:** YES. Rolling-30-day activity board so a strong newcomer
   tops it immediately regardless of tenure. Proposed: **30-day default in
   GROUPS** (current activity), **tier/all-time default on GLOBAL ranks**
   (prestige). ✅ CONFIRMED by @maaiz 2026-06-10.
3. **3D intensity:** YES to 3D. Subtle-premium for IRON (IDENTITY-card
   direction); VIVID stays the loud option.
4. **Swipe visual feedback:** YES — add the sliding/dimming page animation.
5. **Modal edge-swipe = close:** YES — edge-swipe dismisses full-screen modals,
   **but keep the × button too** (both affordances).

**Chat styling:** keep GROUP chats visibly more premium than DMs, but lift DMs
too (don't leave them flat).

## Scope expansion (2026-06-10) — full audit, not just swipe-back

@maaiz widened this to a full functional audit. Five more parallel audits
launched; findings fold into this doc + a bug backlog:
- **Plan builder** working as best as possible (generation + customise).
- **Tutorial** must cover ALL functions and explain them clearly.
- **Emoji → premium icons** migration + append needed icons (and any other
  images) to `image-prompts-v2.md` for future generation.
- **Test-user auto-activity:** verify test users keep getting fresh random
  sessions over time per their behavioral pattern + split (not stale/uniform).
- **Leaderboard defaults** everywhere start from a logical default (tier),
  with the 30-day catch-up lens.
- **Broad bug sweep:** any/all broken functions across the app.
