# IRONLOG — Roadmap

Future direction, blocked items, and improvement areas. Read alongside `PATCHLOG.md` (full history) and `README.md` (architecture).

---

## Blocked

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic billing (checkout unavailable as of May 2026) |
| DMARC DNS record for revtech.com.mv | Dhiraagu registrar portal access |

---

## Committed / In Design

These are agreed directions with enough spec to start when resources allow.

### HIIT Programs
- Detect from user profile when HIIT is appropriate: goals (`lose_fat`, `general_fitness`), body fat %, days per week, fitness level
- One-time prompt after plan generation: "Your goals suggest HIIT could accelerate fat loss — want to include it?"
- Two modes: **finisher** (append a 3–4 exercise HIIT circuit after each strength day) and **dedicated day** (replace one day with a full 20-min session for ≥5 days/week)
- ~18 new bodyweight exercises added to the library (burpees, mountain climbers, jump squats, etc.)
- Short rest chips pre-set to 20s for HIIT exercises; HIIT sections rendered with orange accent
- Preference stored on `UserProfile` (`hiitPreference`, `hiitIntensity`)
- Schema: two nullable `String?` fields on `UserProfile` — additive, no breaking changes

### Animations & Visual Polish
The app has solid bones but interactions feel static in places. Target areas:

| Area | Plan |
|---|---|
| **View transitions** | Slide-in / slide-out between home → workout, home → progress, home → settings. Currently hard cuts. |
| **Set logging** | Brief "logged" micro-animation on the LOG SET button — green flash + slight scale pulse |
| **Personal Best** | Celebration animation when a new PB is detected at session save — trophy/flash overlay |
| **Rest timer countdown** | Visual ring or arc around the timer number that depletes as rest ticks down |
| **Workout completion** | Full-screen finish animation on SAVE — could echo the muscle explosion icons |
| **Progress milestones** | Streak counter animates on increment; goal progress bars animate to new value on load |
| **Onboarding steps** | Each step slides in from the right, slides out to the left (currently fade only) |
| **Plan card hover** | Already has `card-hover` class — extend to a subtle lift + left-border glow on press |
| **Bottom nav icons** | Icon scale bounce on tab switch |

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
