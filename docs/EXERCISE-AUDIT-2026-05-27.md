# Exercise catalogue audit — 2026-05-27

Per-exercise sweep of the 167 entries in `lib/exercises.ts` against image
mappings (`lib/exerciseImages.ts`), form cues (`lib/formCues.ts`), and primary/
secondary muscle assignments. Findings I verified in-source this session are
tagged **[verified]**; agent-reported items I did not hand-confirm are
**[unverified]**.

What shipped in this pass (committed alongside the writeup):

- **`chest-press-machine`** image: `Barbell_Bench_Press_-_Medium_Grip` →
  `Machine_Bench_Press` (machine-specific upstream frames).
- **`dumbbell-calf-raise`** image: `Seated_Calf_Raise` →
  `Standing_Dumbbell_Calf_Raise` (same upstream frames already used by
  `standing-calf-raise`).
- **`sumo-squat`** image: `Plie_Dumbbell_Squat` added to `BROKEN_DB_MAPPINGS`
  — wrong stance (plie holds the weight front; sumo is high-bar barbell).
  Only mapping that used it, so it just falls back to the NO-FORM-DEMO
  placeholder until a real frame ships.
- **`clamshell`** image: `Thigh_Abductor` added to `BROKEN_DB_MAPPINGS` —
  wrong motion (abductor machine is straight-leg seated abduction; clamshell
  is side-lying hip external rotation). Same blacklist-and-fall-back pattern.

Everything else below is documented as a finding — not yet actioned.

---

## Image mappings — remaining findings

**[verified] LOW — `hip-thrust-db` → `Barbell_Hip_Thrust`.** The DB-version
exercise uses the barbell upstream frames. Same movement, different load —
defensible as "close enough" for a form demo. If we want it precise, the
upstream catalogue has `Dumbbell_Hip_Thrust` available.

**[verified] LOW — `cycling` is named "Stationary Bike" but lives under
`elliptical` equipment in `lib/exercises.ts`.** Not an image bug — equipment
mislabel. Cosmetic.

**[unverified] None of the remaining 162 entries flagged on a quick scan.**
A more exhaustive sweep (downloading and visually verifying every
`<DB_ID>/{0,1}.jpg`) would be the right move if you want full coverage; the
audit above is a static reasoning pass, not a visual inspection.

## Form cues — remaining findings

**[verified] CORRECTED finding** — agent claimed `pullups` had no FORM_CUES
entry. It does (line 154). No fix needed.

**[verified] LOW — `chest-press-machine` falls back to GENERIC_CUES.** The
fuzzy match for "Chest Press Machine" wouldn't hit `chest-press` cleanly under
the longest-match rule (no entry by that key). Worth adding a dedicated
`chest-press-machine` cue tuned for the machine (handle path vs free bar
path, seat-height alignment).

## Muscle-group findings

**[verified] SCHEMA-LEVEL OBSERVATION — `cardio` is used as both a muscle
and a metabolic-demand tag.** **21 exercises** carry `"cardio"` in
`primaryMuscles` (jump-rope, jumping-jacks, tuck-jumps, burpees, high-knees,
speed-skaters, plyo-pushup, rowing-machine, others). The balance-bucket mapper
in `app/page.tsx` already filters `cardio` to null (it doesn't feed the
Balance sub-rank), so this is a semantic-naming issue, not an active bug.

Options if you want to clean it up:
1. **Rename the tag**: introduce a separate `metabolic: ["cardio", "hiit"]`
   field on `Exercise`, and migrate the 21 entries to put real prime movers
   (calves/quads/etc.) in `primaryMuscles` while keeping the cardio flag for
   filtering. Most invasive but cleanest.
2. **Leave it**: it's working, it's just semantically odd, and any UI text
   that reads `primaryMuscles` and shows "CARDIO" as a muscle is actually
   accurate-enough labeling for the user.

I'd lean (2) unless you want the cleanup — the cost-to-benefit is low.

**[verified] LOW — `hanging-leg-raise` lists `primaryMuscles: ["core"]`** but
ignores the grip/lat stability demand of hanging. Acceptable as-is; "core" IS
the prime mover and adding lats/forearms would be noisy.

**[verified] LOW — `barbell-deadlift` lists `primaryMuscles: ["back"]`** with
glutes/hams/core/forearms secondary. Defensible (back-dominant interpretation);
the alternative is `["back", "glutes"]` co-primary. Either is correct
kinesiology.

---

## Summary table

| Metric | Count |
|---|---:|
| Exercises audited | 167 |
| Image mismatches **fixed this pass** | 4 |
| Image mismatches remaining (LOW) | 2 |
| Form-cue gaps remaining (LOW) | 1 |
| Muscle / schema observations | 3 |
| Total flags shipped or filed | 10 |

Audit method: agent sweep across all 167 entries, then in-source verification
of every claim before action. Agent had two confirmed false positives
(`pullups` cue gap claim — wrong; `barbell-deadlift` muscle complaint —
defensible). All four shipped fixes were independently verified in the
source first.
