# IronLog — image-generation prompts (master file)

Everything that still needs ChatGPT-generated art lives here so you can
knock it all out in one sitting. There are **three sections**:

1. **Avatars** — 30 profile-picture icons (20 tier-unlocked + 10 lucky
   drops). Square PNGs into `/public/avatars/<id>.png`.
2. **Stretches** — 7 form demos (replacing the placeholder text cards
   already shipped). Two-frame `0.png` / `1.png` pairs into
   `/public/stretches/<id>/`.
3. **Exercise demos** — 12 plyometric / cardio movements that aren't in
   the free-exercise-db open library. Two-frame `0.png` / `1.png` pairs
   into `/public/stretches/<id>/` (yes, same folder — they all share the
   `LOCAL_STRETCH_IDS` lookup; once you drop them in just append the id
   to that set in `lib/exerciseImages.ts`).

After dropping any image in, no rebuild is needed — Next.js serves them
from `/public` directly. Vercel auto-deploys on push.

---

## Section 1 — AVATARS (30 images)

### Style guide (paste into every avatar prompt as a prefix)

> Generate a 512×512 PNG profile avatar. Style: **dark-mode app icon**,
> centred subject on a deep matte background (no white), **subtle gradient
> halo** matching the avatar's theme colour, soft rim-light, premium gym-app
> aesthetic — feels at home next to Apple Fitness / Strava cards. The
> subject is a stylised emblem/illustration (NO human faces, NO text,
> NO logos, NO watermarks). Slight grain ok. **Symmetric, centred,
> works as a small circular crop**. Output: PNG, transparent or
> matching dark background — caller will overlay it on the user's
> chosen tier border colour.

### Tier 1 — Kitten / Bronze (starting pack)

**`starter-spark.png`** — A small bronze ember glowing on a dark slate
background. Tiny rising sparks. Halo colour: warm bronze (#a8784a).
Feels like a flame just sparking to life.

**`starter-dawn.png`** — A thin horizon line at sunrise — deep navy
below, pale apricot above, a single small sun emerging. Halo: pale
apricot (#fcd7a3). Quiet, patient. No mountains, just the line.

**`starter-seedling.png`** — A small green sprout pushing out of a dark
cracked surface, two leaves curling outward. Halo: emerald (#34d399).
Feels alive but fragile.

### Tier 2 — Fox / Silver

**`fox-sprint.png`** — A geometric fox silhouette in mid-stride,
silver-orange gradient body, trailing motion lines behind it. Halo:
orange-silver (#fb923c → #cbd5e1).

**`fox-emberbolt.png`** — A lightning-bolt-shaped fox tail glowing
amber over a dark obsidian background. Just the bolt-tail, no full
fox. Halo: amber (#f59e0b).

**`fox-stride.png`** — A pair of sleek paw prints in silver, ascending
diagonally on a dark gradient. Halo: cool silver (#cbd5e1).

### Tier 3 — Big Dawg / Gold

**`dawg-howler.png`** — A bold geometric wolf head silhouette, head
tilted up mid-howl, gold trim around the mane. Halo: gold (#facc15).
No teeth visible — just the strong shape.

**`dawg-ironpaw.png`** — A single large dog paw print embossed in
gold-iron, with riveted metal texture. Halo: bronzed gold (#facc15 →
#92400e).

**`dawg-watcher.png`** — A pair of glowing gold eyes peering through
dark fur — only eyes and a faint outline of the head visible. Halo:
deep gold (#eab308).

### Tier 4 — Lion / Platinum

**`lion-crown.png`** — A stylised lion's mane forming a crown
silhouette, platinum-blue gradient. Halo: icy platinum (#7dd3fc). No
facial features — just the crown-mane.

**`lion-mane.png`** — A full lion mane viewed from the back, swept
dramatically to one side, platinum-orange highlights. Halo: orange
(#f97316).

**`lion-thunder.png`** — A lion silhouette with thunder bolts radiating
from its head, platinum and bright cyan. Halo: bright cyan (#22d3ee).
Bold and loud.

### Tier 5 — Gorilla / Diamond

**`gorilla-titan.png`** — A massive geometric gorilla chest/shoulder
silhouette, viewed from below, chiselled diamond facets layered over
it. Halo: ice diamond (#60a5fa).

**`gorilla-stoneheart.png`** — A gorilla fist clenched holding a
glowing blue diamond at its centre. Halo: deep diamond blue (#3b82f6).

**`gorilla-vanguard.png`** — A gorilla silhouette in profile, standing
tall, with a flag-pole held over one shoulder — the flag is a clean
diamond shape. Halo: icy blue (#60a5fa).

### Tier 6 — Bear / Master

**`bear-warden.png`** — A standing bear silhouette in front of a
circular crest, holding a heavy iron-chain crown floating above its
head. Halo: deep crimson gold (#92400e → #f0c040).

**`bear-ursanova.png`** — A bear constellation glowing on a deep
midnight sky — Ursa Major shape, gold star clusters. Halo: cosmic gold
(#facc15).

**`bear-eternal.png`** — A bear silhouette climbing an infinite
staircase that loops back into itself (Penrose stairs), gold lines.
Halo: warm gold (#f0c040).

**`bear-monolith.png`** — A massive monolithic black stone slab with a
bear paw print burned into its centre, glowing gold. Halo:
gold-on-black (#f0c040).

**`bear-pinnacle.png`** — A bear silhouette standing at the peak of a
single sharp mountain, stars above, gold horizon. Halo: peak gold
(#facc15).

### Lucky-drop pool (rare → mythic)

**`lucky-clover.png`** — A four-leaf clover formed of green ribbons,
each leaf catching light. Halo: clover green (#22c55e). Slight sparkle.

**`lucky-shooting-star.png`** — A single bright streak across a dark
sky, leaving a trailing arc of embers. Halo: hot white (#ffffff →
#fde68a).

**`lucky-prism.png`** — A floating glass triangular prism refracting a
rainbow beam through its centre. Halo: full-spectrum (multi-colour
gradient).

**`lucky-firefly.png`** — A swarm of fireflies forming a glowing orb in
dark woods, dotted warm yellow points of light. Halo: firefly yellow
(#fef08a).

**`lucky-glacier.png`** — A floating chunk of crystal-blue glacier ice,
fractured planes catching cold light. Halo: arctic blue (#7dd3fc).

**`lucky-aurora.png`** — Curtains of green-pink aurora dancing over a
dark mountain ridge, no foreground subject — just the lights. Halo:
aurora green-pink (#34d399 → #f0abfc).

**`lucky-phoenix.png`** — A phoenix mid-rebirth — orange/red flame
wings unfurling from a glowing core, ember particles. Halo: phoenix
red (#ef4444 → #fb923c).

**`lucky-eclipse.png`** — A solar eclipse — black disc with a brilliant
corona of golden fire. Halo: corona gold (#f59e0b).

**`lucky-cosmic.png`** — A floating astronaut helmet reflecting a
galaxy, deep purple-blue nebula visible inside the visor. Halo: nebula
purple (#a855f7).

**`lucky-mythic.png`** — A glowing dragon's eye filling the entire
frame, vertical slit pupil, swirling iridescent iris (gold→teal→violet).
Halo: iridescent multi-colour. Should feel like discovering a secret.

---

## Section 2 — STRETCH demos (7 movements × 2 frames = 14 images)

### Style guide

> Photographic, gym photo studio, single male model in white sleeveless
> tank + black shorts + white sneakers, athletic build, neutral
> expression, even soft fluorescent lighting, plain matte-black backdrop,
> no logos / text / watermarks. **Square 600×600**, save as PNG (not JPG),
> model centred with ~10% padding. **Consistent same-model identity**
> across all 14 images.

For each stretch generate frame 0 (start) and frame 1 (end). Save as
`/public/stretches/<id>/0.png` and `/1.png`. Placeholders already exist
— overwriting will replace them automatically.

### `cd-chest-doorway/0.png` & `1.png` — Doorway Chest Stretch

- **0** — Standing in a doorway, right forearm vertical against the
  doorframe at shoulder height, body squared up, hasn't stepped
  through yet. Stylised vertical bar of dark grey at shoulder width
  represents the doorframe.
- **1** — Same setup, torso rotated 30° to the left (away from the
  contact arm), front foot stepped through, chest visibly stretched.

### `cd-pigeon/0.png` & `1.png` — Pigeon Pose

- **0** — Kneeling lunge transition — right shin bent in front of body
  parallel to mat, hands on the floor either side, torso upright, hips
  just starting to sink. On a black yoga mat.
- **1** — Full pigeon — hips sunk to the floor, torso folded slightly
  forward over the front shin, forearms resting on the mat. Same
  angle.

### `cd-hamstring-lay/0.png` & `1.png` — Lying Hamstring Stretch

- **0** — On back, head on the floor, left leg flat on the floor,
  right leg raised about 60° from horizontal, foot looped through a
  black resistance band/strap, hands holding the band.
- **1** — Right leg pulled to ~90° toward chest using the band, left
  leg still flat. Same camera angle, side view.

### `cd-lat-stretch/0.png` & `1.png` — Overhead Lat Stretch

- **0** — Standing tall, right arm overhead with hand reaching up,
  left hand at the side. Side view, full body.
- **1** — Right arm still overhead, left hand has crossed over the
  head and grabbed the right wrist, model laterally bent ~25° to the
  left with right side visibly stretched.

### `cd-glute-pretzel/0.png` & `1.png` — Figure-Four Glute Stretch

- **0** — Lying flat on back, both knees bent with feet on the floor,
  right ankle just crossed over left knee (start of figure-four
  setup). Hands at sides.
- **1** — Both arms reaching through the gap to clasp behind the left
  thigh, pulling left thigh toward chest, right knee opening outward,
  classic figure-four glute stretch.

### `wu-leg-swings/0.png` & `1.png` — Leg Swings

- **0** — Standing side-on to camera, one hand resting on a wall for
  balance, right leg swung forward to ~45° (max forward arc).
- **1** — Same setup, right leg swung backward to ~30° (max backward
  arc). Same camera position, same arm-on-wall.

### `wu-scap-shrugs/0.png` & `1.png` — Scap Push-Ups

- **0** — High plank, locked elbows, shoulder blades RETRACTED
  (pinched together) — chest dips slightly between shoulders. Side
  view.
- **1** — Same plank, shoulder blades PROTRACTED (pushed apart) —
  upper back rounded, chest pushed up away from the floor. Same side
  view.

---

## Section 3 — EXERCISE demos (19 movements × 2 frames = 38 images)

These are exercises that need custom demos because either (a) they
aren't in free-exercise-db at all, or (b) the previous mapping pointed
to a semantically wrong movement (e.g. "jumping-jacks" was pointing to
"Air Bike" — totally different exercise). Save as
`/public/stretches/<id>/0.png` and `/1.png` (yes, the `stretches/`
folder — it's just our generic "local demos" location, not
stretch-specific). Placeholders already exist for all 19 movements so
overwriting is enough — `LOCAL_STRETCH_IDS` in `lib/exerciseImages.ts`
already lists them.

### Style guide

Same as stretches above — same model, same lighting, same backdrop, so
the look stays consistent across all 38 local demos.

### `bear-crawl/0.png` & `1.png` — Bear Crawl

- **0** — Quadrupedal start. Hands and feet on the floor, hips raised
  slightly above shoulders, knees hovering 2-3 inches off the ground,
  back flat. Looking forward.
- **1** — Mid-crawl. Right hand and left foot extended forward
  together (contralateral), opposite limbs still bearing weight,
  knees still hovering. Movement frozen mid-step.

### `broad-jump/0.png` & `1.png` — Broad Jump

- **0** — Pre-jump load. Standing tall but knees softly bent, arms
  swung back behind the hips, leaning slightly forward — loaded
  spring position.
- **1** — Mid-air apex. Both feet off the floor, arms swung
  forward/up, knees tucked toward chest, body leaning forward — a
  clear horizontal jump in motion.

### `elliptical/0.png` & `1.png` — Elliptical Trainer

This one is just gym-equipment imagery, no model needed (model can be
omitted for these two frames if it simplifies).

- **0** — Front-three-quarter view of a commercial elliptical machine
  (chrome handles, large stride pedals, console with screen) on the
  black studio backdrop. No model.
- **1** — Same elliptical, slightly different angle (side view this
  time) so the FORM modal animation feels like the camera is rotating
  around it. No model.

### `inchworm/0.png` & `1.png` — Inchworm Walkout

- **0** — Standing with feet together, hinged at the hips, hands
  touching the floor in front of the feet (top of an Inchworm forward
  fold).
- **1** — Plank position at the end of the hand-walk — hands extended
  forward, body in a straight line, feet still in original position,
  hands well in front. Frozen at full plank extension.

### `lateral-bounds/0.png` & `1.png` — Lateral Bounds (Skater Bounds)

- **0** — Loaded on right leg, left leg lifted slightly back-and-up,
  arms swung to the right side, body slightly tilted right —
  pre-bound load.
- **1** — Mid-air mid-bound, leaping sideways to the left, both feet
  off the floor briefly, arms swung the opposite way (left now),
  visible horizontal motion.

### `lateral-shuffle/0.png` & `1.png` — Lateral Shuffle

- **0** — Athletic stance facing the camera, feet shoulder-width
  apart, knees slightly bent, arms in a low athletic carry. Centred
  in frame.
- **1** — Mid-shuffle to the right. Right foot has stepped out, left
  foot mid-step (about to close the gap), arms swung to match. Body
  still facing camera.

### `plyo-pushup/0.png` & `1.png` — Plyometric Push-Up

- **0** — Bottom of a push-up, elbows bent ~90°, chest hovering an
  inch off the floor, body in a straight plank line.
- **1** — Mid-air at the top — hands have left the floor, both palms
  open and slightly apart, body still in plank line, ~6 inches of air
  beneath the hands. Frozen mid-clap-pushup.

### `speed-skaters/0.png` & `1.png` — Speed Skaters

- **0** — Balanced on right leg, left leg crossed BEHIND the standing
  leg with toe lightly tapping the floor, torso bent forward over the
  right knee, arms reaching across to the right side — classic
  speed-skater pose.
- **1** — Mirror — now balanced on left leg, right leg crossed behind,
  torso angled the other way, arms swung to the left. Same camera
  angle.

### `split-jumps/0.png` & `1.png` — Split Jumps (Jumping Lunges)

- **0** — Bottom of a lunge — right foot forward, left foot back, both
  knees bent ~90°, back knee close to (but not touching) the floor,
  arms in opposite swing (left arm forward, right arm back).
- **1** — Mid-air switch — both feet off the floor, legs scissoring
  past each other mid-jump, arms swinging to swap sides. Clear
  vertical air.

### `squat-thrust/0.png` & `1.png` — Squat Thrust

- **0** — Deep squat with hands on the floor between the feet, knees
  outside the elbows, ready to kick the legs back.
- **1** — Full plank — feet kicked back, body in a straight line,
  hands directly under shoulders. (Both frames together convey the
  squat-thrust transition.)

### `star-jump/0.png` & `1.png` — Star Jump

- **0** — Crouched start — feet together, knees bent into a tight
  crouch, arms tucked at the chest. Loaded spring.
- **1** — Mid-air apex — body fully extended into an X-shape, arms
  reaching up-and-out diagonally, legs splayed mid-jump, feet off the
  floor. Star pose frozen in air.

### `tuck-jumps/0.png` & `1.png` — Tuck Jumps

- **0** — Standing, slight knee bend, arms loosely at the sides, eyes
  forward. Pre-jump.
- **1** — Mid-air apex — both knees tucked high toward the chest, both
  hands lightly touching the front of the shins, feet off the floor.
  Frozen at peak of the tuck.

### `jumping-jacks/0.png` & `1.png` — Jumping Jacks

- **0** — Standing tall, feet together, arms at sides. Pre-jack.
- **1** — Mid-jack — feet jumped wide (shoulder-width+), arms swung up
  overhead in a clap or near-clap, body fully extended.

### `burpees/0.png` & `1.png` — Burpees

- **0** — Bottom of a push-up (chest near floor, body in plank line).
- **1** — Standing-and-jumping apex — feet off the floor, both hands
  reaching overhead, full body extension. Combined the two frames
  convey the whole drop-down → jump-up burpee motion.

### `high-knees/0.png` & `1.png` — High Knees

- **0** — Running in place. Right knee driven up to or above hip
  height, left foot planted. Arms in opposite pump.
- **1** — Mirror — left knee high, right foot planted. Same camera
  angle. The alternation reads as the running motion.

### `wall-sit/0.png` & `1.png` — Wall Sit

- **0** — Setup — back flat against a stylised dark grey wall panel,
  feet shoulder-width and ~2 ft from wall, body still standing tall.
- **1** — Hold — slid down to a 90° knee bend, thighs parallel to the
  floor, back still flat against the wall, arms relaxed at sides or
  folded across the chest.

### `wall-slide/0.png` & `1.png` — Wall Slide

- **0** — Setup — back and both forearms pressed against a dark grey
  wall panel, arms in a 'goalpost' shape (elbows at shoulder height,
  forearms vertical).
- **1** — Slide complete — arms slid up the wall to a fully extended
  overhead position, wrists still on the wall. Lats and shoulders
  visibly working.

### `terminal-knee-extension/0.png` & `1.png` — Terminal Knee Extension

- **0** — Standing, a thick band looped around the back of the right
  knee, anchored to a pole behind. Knee bent ~30° (slack on the band).
- **1** — Knee fully extended against the band's tension, leg locked
  out straight, glute squeezed. Same camera angle.

### `bird-dog/0.png` & `1.png` — Bird Dog

- **0** — Quadruped setup — on hands and knees, wrists directly under
  shoulders, knees directly under hips, spine neutral, eyes down.
- **1** — Right arm extended forward and left leg extended back, both
  parallel to the floor, body forming a straight line from fingertips
  to toes. Hips square.

---

## After generation — registration steps

1. **Avatars** (Section 1) — just drop the PNGs in `/public/avatars/`.
   No code change needed. `lib/avatars.ts` already references them by
   id; missing files fall back to the default chip until you generate
   them.
2. **Stretches** (Section 2) — drop pairs in
   `/public/stretches/<id>/0.png` & `1.png`. Placeholders already
   exist so overwriting is enough. No code change.
3. **Exercise demos** (Section 3) — drop pairs in
   `/public/stretches/<id>/0.png` & `1.png` (same folder pattern).
   Then add each id to `LOCAL_STRETCH_IDS` in
   `lib/exerciseImages.ts` (the Set near the top). The FORM modal
   immediately picks them up.

Total: **30 avatars + 14 stretch frames + 38 exercise frames = 82
images**.

Commit each batch as you go. Vercel auto-deploys.
