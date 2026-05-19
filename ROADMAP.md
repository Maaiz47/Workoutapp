# IRONLOG — Roadmap

Future direction, blocked items, and improvement areas. Read alongside `PATCHLOG.md` (full history) and `README.md` (architecture).

---

## Blocked

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic billing (checkout unavailable as of May 2026) |
| DMARC DNS record for revtech.com.mv | Dhiraagu registrar portal access |

---

## Recently Shipped (2026-05-19)

| Item | Status |
|---|---|
| Animations & visual polish — all areas below | ✅ Shipped — Patch 33 |
| Equipment filtering (`requireAll` — bench without bench fix) | ✅ Shipped — Patch 32 |
| Home equipment expansion (treadmill, elliptical, multi-gym) | ✅ Shipped — Patch 32 |
| Bodyweight weight toggle | ✅ Shipped — Patch 32 |
| Trainer plan generation (harder + customisable before proposal) | ✅ Shipped — Patch 32 |
| Message delivered/read/sent status | ✅ Shipped — Patch 36 |
| In-app notification suppression (soft beep + tab flash) | ✅ Shipped — Patch 37 |
| Mobile UX polish (scroll lock, 100dvh, safe areas) | ✅ Shipped — Patch 35 |

---

## Committed / In Design

These are agreed directions with enough spec to start when resources allow.

### ~~HIIT Programs~~ ✅ Shipped

- `hiitPreference` and `hiitIntensity` nullable `String?` fields on `UserProfile`
- 20+ HIIT exercises in the library: burpees, squat thrusts, tuck jumps, split jumps, box jumps, lateral bounds, broad jump, speed skaters, jump squat, plyo push-up, mountain climbers, bear crawl, inchworm, high knees, jumping jacks, jump rope, star jump, lateral shuffle
- Plan generator `hiitCircuit()` builds a 4-exercise finisher (one from each pool: full-body, lower, upper, cardio) with randomised non-repeating selection
- `hiitDay()` builds a dedicated HIIT & Conditioning day for ≥5 days/week users
- `hiitParams(intensity)` maps `light / moderate / intense` to rest and rep targets
- HIIT exercises tagged `notes: "HIIT circuit"` — rendered with orange accent and `⚡ HIIT CIRCUIT` section header in the workout view
- Onboarding step (included in profile flow) captures preference and intensity; stored to `UserProfile`

### ~~Animations & Visual Polish~~ ✅ Shipped

All target areas completed in Patch 33/34:

| Area | Shipped |
|---|---|
| View transitions | ✅ 40 px slide-in/out on all view changes, direction-aware |
| Set logging flash | ✅ Green glow + scale burst on LOG SET |
| Personal Best | ✅ 🏆 overlay on live set log, not just at workout end |
| Rest timer ring | ✅ SVG arc depletes around countdown number |
| Workout completion | ✅ Expanding rings + checkmark pop, auto-dismisses |
| Progress bar grow | ✅ `.bar-grow` spring animation on all goal bars |
| Onboarding steps | ✅ Direction-tracked slide in/out |
| Plan card hover | Already covered by `.card-hover` active scale |
| Bottom nav bounce | ✅ `.nav-btn` scale bounce on tap |

---

## Future Candidates

Unscheduled ideas — no detailed spec yet.

| Item | Notes |
|---|---|
| AI-powered plan generator | Replace rule-based generator with a Claude API call for truly personalised plans. Blocked on billing. |
| Exercise GIF demos | Full animated GIFs per exercise in the workout view. Currently using JPG start/end frames. Needs asset sourcing. |
| Timer-based HIIT mode | Dedicated interval timer view (work / rest countdown per exercise) rather than rep logging for HIIT circuits. Requires new workout view state. |
| Calorie estimation | Rough calorie burn estimate per session based on exercise type, sets, weight, and user body weight. Display on the finish screen and history. |
| Username change | Allow users to change their username with a cooldown period. Currently locked at registration. |
| Display name | Separate `displayName` from login `username`. Shown in UI; username stays for auth and sharing. |
| Plan auto-suggest supersets | Generator detects antagonist pairs (push/pull, quads/hamstrings) and marks them as supersets automatically for intermediate/advanced splits. |
| Trainer approval flow | Admin manually approves trainer upgrade requests. `roleRequest` field already on `User` schema. |
| Social workout sharing | Share a completed session as a read-only summary card (image or link). |
| Leaderboard / challenges | Opt-in personal challenges (e.g. most sessions this month) between trainer and clients or friends. |
| Wearable sync | Apple Health / Google Fit write-back for session duration and active calories. |
| Dark / light theme toggle | Currently dark only. User-selectable theme stored in settings. |
