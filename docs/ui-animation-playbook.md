# IronLog — UI / animation / gesture playbook (handoff prompt)

> Paste this into a fresh Claude Code session that's going to work on
> IronLog's look-and-feel. It encodes what the last session learned so you
> start from the real patterns, not generic advice. **The last section is
> the important one: it tells you how to do BETTER than these tips — treat
> them as a starting hypothesis, verify everything against the live code and
> a running build, and update this file as you learn.**

---

## 0. What this app is (orient first)

- **Next.js 14 App Router, TypeScript.** Almost the entire app is in
  `app/page.tsx` (~21k lines). **Never read it whole — grep/Read in slices.**
  The QA dashboard is a separate page at `app/qa/page.tsx`.
- **Mobile-first iPhone PWA.** @maaiz runs it on an iPhone. Design at ~390px
  width. Respect `env(safe-area-inset-*)`. Every change is judged on a phone.
- **`framer-motion` is already a dependency** (`motion`, `AnimatePresence`).
- **Styling is inline-`style` objects**, not CSS modules. Match that idiom.
  Shared/global stuff lives in `app/globals.css`.
- **Forcing rules apply to every change**: add a `qa-state.json` item, a
  `PATCHLOG.md` section tagged `(qa: <id>)`, and run `npm run qa:scan` +
  `npm run tutorial:scan` before pushing. Don't push without an explicit
  "ship it" from @maaiz.

## 1. The design system (use it, don't reinvent it)

**Fonts:** `'DM Sans'` (body), `'Space Mono'` (labels, numbers, mono accents).

**Semantic palette** — colours mean things; keep them consistent:
| Colour | Hex | Meaning |
|---|---|---|
| Red | `#FF6B6B` (→`#ee5a24`) | primary action / danger / athlete accent |
| Teal | `#4ECDC4` | accept / social / "you" / positive |
| Gold | `#f0c040` `#FFD166` | premium / trainer / leaderboard |
| Purple | `#A29BFE` | system / missions / sleep |
| Green | `#2ecc71` | success / healed / completed |
| Blue | `#74b9ff` | hydration / water |

The active accent is a CSS var: `var(--accent)` / `var(--accent-rgb)`.

**THREE THEMES — this is the #1 gotcha.** `[data-theme]` is `iron` (default,
warm premium dark), `mono` (brutalist), or `vivid` (neon aurora).
- **MONO auto-strips inline depth.** `app/globals.css` has selectors like
  `[data-theme="mono"] [style*="box-shadow"]`, `[style*="backdropFilter"]`,
  `[style*="textShadow"]` that flatten them. So **depth you add via inline
  `style={{ boxShadow }}` is automatically neutralised in MONO** — convenient.
- **BUT class-based shadows/glow are NOT caught.** If you add a new utility
  *class* with a shadow/glow/3D transform, you MUST add a matching
  `[data-theme="mono"] .yourclass { … }` override, or MONO breaks. Grep the
  mono block before adding visual classes.
- **Always test all three themes after a visual change.** VIVID is the "loud"
  theme — keep IRON subtle-premium and let VIVID carry the neon.

**Reusable depth tokens already exist** in `globals.css` (added 2026-06-10) —
prefer these over hand-rolled shadows:
- `.card-3d` — inset top highlight + soft drop shadow (the premium card recipe)
- `.card-3d-hover` — 1px lift + shadow bloom on hover, 0.985 dip on `:active`
- `.press-3d` — a gentle physical-button strike (perspective + brightness) for CTAs
- `.focus-ring` — wide accent glow for inputs (there's also a GLOBAL
  `input:focus-visible` rule, so most inputs already glow on focus)
- `.glow-{teal,red,gold,purple}` — ambient accent glows
- `.view-forward` / `.view-back` — the page-transition slide (see §3)

## 2. Animations — the house style

- **Premium easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (the "out-expo"-ish curve
  used by view slides) or framer-motion springs. Avoid linear/ease for motion.
- **Durations are SHORT:** 0.08s (press) → 0.15–0.24s (UI) → 0.32–0.45s
  (entrances/celebrations). Anything slower feels sluggish on mobile.
- **Animate `transform` + `opacity` ONLY** for 60fps. Never animate
  `width`/`height`/`top`/`left`/`margin` (layout thrash). Use `willChange`
  sparingly (it's a memory cost, not free).
- **Respect `prefers-reduced-motion`** — gate non-essential animation
  (the view-slide already does).
- **Don't add near-duplicate keyframes.** `globals.css` already has:
  `fadeIn`, `fadeIn3d`, `logSetFlash` (3D button press — study this for press
  effects), `restTimerIdle` (subtle Y-rotation "living" element), `restChipPulse`,
  `tierShine` (shimmer sweep), `pbPop`/`pbShine`/`trophyBounce` (celebrations),
  plus splash animations. Grep `@keyframes` before writing a new one.
- **`AnimatePresence`** is the tool for mount/unmount transitions (modals,
  toasts, emoji pickers). It's used throughout — copy the existing pattern.
- **Stagger** list entrances subtly (e.g. small per-item delay) rather than
  animating a whole list as one block.

## 3. Swipe-to-go-back (the gesture system already exists — extend it)

The mechanism lives in `app/page.tsx`:
- **`useSwipeBack(onBack, enabled)`** (~line 700): document-level touch
  listeners. Arms only when the touch starts in the **left 60px** AND not
  inside a horizontally-scrollable element. Fires when **dx > 60** and
  **dy < dx*0.7** (diagonal guard so vertical scroll / pull-to-refresh don't
  misfire).
- **`hasHorizontalScrollAncestor(el)`** — the guard that stops left-edge
  carousels (equipment tags, etc.) from hijacking the gesture. If you add a
  horizontal scroller near the left edge, this already protects it.
- **`swipeBackViews` Set + the back-chain** (~line 7240): each view maps to a
  back target. **Route navigation through `goTo(v, "back")`**, not raw
  `setView`, so the `.view-back` slide plays.
- **Overlay-dismiss stack** (`overlayDismissers`): full-screen modals register
  a close-fn; edge-swipe closes the topmost open overlay BEFORE navigating the
  view beneath. **Add new full-screen modals to this list** (keep their × too).
- **`*PrevView` memories** (e.g. `groupChatPrevView`, `customisePrevView`) are
  persisted to `sessionStorage` so a mid-flow reload backs out correctly.

**To add swipe-back to a new surface:** add it to `swipeBackViews`, add a
back-target branch (via `goTo(target, "back")`), and if it's reachable from
multiple places, add a `sessionStorage`-persisted prevView memory. For a new
modal, push to `overlayDismissers`.

## 4. 3D / depth — the IronLog way

- **Subtle-premium for IRON.** The reference is the profile IDENTITY card and
  the bottom-nav buttons: multi-stop gradient + corner glow + inset top
  highlight (`0 1px 0 rgba(255,255,255,0.05) inset`) + soft distance-falloff
  drop shadow (`0 6px 22px -8px rgba(0,0,0,0.7)`). That's `.card-3d`.
- **Pressed/physical states:** `perspective(600px) translateZ(-Npx)` +
  `brightness()` flash. See `logSetFlash` and `.press-3d`.
- **Directional depth tells hierarchy:** e.g. chat — outgoing bubbles get a
  harder accent-tinted shadow, incoming a softer neutral one; group chat keeps
  a richer gradient so groups read *more premium* than DMs. Use shadow
  intensity + tint to signal importance.
- **Glow-on-accent, not glow-on-everything.** Reserve glows for tier/medal/
  active/premium elements. Overusing glow cheapens it.
- **MONO must flatten it** (see §1). Inline shadows auto-flatten; class shadows
  need an explicit override.

## 5. Performance (it's one giant component)

- `app/page.tsx` is a single massive component — **minimise re-renders.**
  `useMemo`/`useCallback` for derived data and handlers; avoid heavy work in
  the render path. Watch for state that changes on every tick (timers).
- Prefer CSS animations/transitions over JS-driven ones where possible (they
  run off the main thread).
- Images: the app uses `/ai/*` and `/public` assets; lazy where sensible,
  always `onError` to hide a broken image gracefully (existing pattern).
- The PWA caches aggressively — the version banner is SHA-based
  (`app/api/version`). Don't break the `## ` PATCHLOG section count that drives
  the visible version number (see CLAUDE.md).

---

## 6. ⭐ How to do BETTER than this playbook (the self-improvement loop)

**Do not treat the tips above as ground truth. They're last session's best
understanding — your job is to surpass them.** Run this loop:

1. **Audit the real state first — measure, don't assume.** Before changing
   anything, build a baseline:
   - `grep -n "@keyframes" app/globals.css` — full animation inventory.
   - `grep -rn "boxShadow\|box-shadow" app/page.tsx | wc -l` — how consistent is
     depth today? Where's it missing?
   - List every `[data-theme="mono"]` override and confirm your changes are
     covered.
   - Re-read this file's claims against the code. **If a tip is stale, fix the
     code AND fix this file.** The codebase is the source of truth.

2. **SEE it, don't just read it.** Code review can't judge "feel." Run the app
   and capture before/after screenshots at 390px width (use the `/run` or
   `/verify` skills, or a headless browser). Compare visually. A diff that
   "looks fine in code" can be janky on screen.

3. **Profile for jank.** Use a Chrome performance trace / React Profiler on the
   surfaces you touch. Confirm animations hit 60fps and you're animating only
   `transform`/`opacity`. Check you didn't add re-renders to the giant
   component. Run Lighthouse on the PWA for regressions.

4. **Set a concrete bar with references.** "Premium" is measurable against
   real apps: Apple Fitness/Health glyphs, Nike Training Club, Strava,
   Linear, Things 3. Name the specific app you're matching for each surface
   and justify why your result clears it.

5. **Test all three themes + reduced-motion + accessibility** after every
   visual change. MONO is the usual breakage. Verify focus states are visible
   and tap targets are ≥44px.

6. **Close the loop with the real user.** @maaiz tests on a physical iPhone and
   files QA notes in-app. After shipping a visual slice, ask him to exercise
   specific gestures/surfaces; mine `qa-comments/` for reactions. Real-device
   feel beats any heuristic here — the audit that produced this work started
   from his reports.

7. **Adversarially self-review, then iterate.** After implementing, spin up a
   fresh review pass (or the `/code-review` skill) asking "what still looks
   cheap / inconsistent / off-brand?" Treat the first version as a draft.

8. **Leave the playbook better than you found it.** Anything you learn that
   contradicts or extends §1–§5 — append it here with a date, so the next
   session starts even further ahead. This file is meant to compound.

**The meta-point:** these tips get you to parity with the current app's best
patterns. Beating them comes from *measuring* (screenshots, profiles,
references, user feedback) rather than trusting any single source — including
this document.
