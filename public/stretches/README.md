# Custom stretch / warm-up form demos

This folder holds locally-hosted two-frame demo images for stretches and
warm-ups that don't exist in the free-exercise-db open library. When you
drop a new pair in, register the id in `lib/exerciseImages.ts` (the
`LOCAL_STRETCH_IDS` set) and the FORM modal automatically picks them up.

## File layout

```
public/stretches/
  cd-chest-doorway/
    0.jpg     ← start-of-movement frame (e.g. arm raised, about to step through)
    1.jpg     ← end-of-movement frame (chest stretched, step completed)
  cd-pigeon/
    0.jpg
    1.jpg
  ...
```

The FORM modal animates by alternating `0.jpg` and `1.jpg` every 900 ms,
so the two frames should differ in pose just enough that the user
visually understands the motion.

## Required dimensions / format

- **Square**, at least **400 × 400 px** (the modal renders at ~360 px).
- **JPG**, ~80% quality, **< 100 KB each** (these ship in /public so they
  go straight to the user's bundle — keep them small).
- **Black background** (`#000000`) to match the app's dark UI. No drop
  shadows, no rims, no white border.
- Subject framed centred with ~10 % padding all around.

## Visual style (match free-exercise-db photographic feel)

The existing demos in free-exercise-db are real-gym photographs of a
white-tank-top, dark-shorts male model with white sneakers, even
fluorescent lighting, against a black backdrop. To match, use the
following base style prompt for any image generator:

> **Style guide:** Photographic, gym photo studio, full-body shot, single
> male model in a white sleeveless tank top and black shorts with white
> sneakers, athletic build, neutral expression, even soft fluorescent
> lighting, plain matte-black backdrop, no logos, no text overlays, no
> watermarks. Composition: subject centred, ~10 % padding, square frame.

## Stretches we need to generate (or source from elsewhere)

For each stretch below, generate frame `0` (start) and frame `1` (end)
using the prompts. The IDs in `lib/stretching.ts` are the folder names.

### `cd-chest-doorway` — Doorway Chest Stretch
- **0**: Model standing in a doorway, right forearm vertical against the
  doorframe at shoulder height, body squared up, hasn't stepped through
  yet. Black studio backdrop with a stylised doorway prop (just a
  vertical bar of dark grey at shoulder width, no actual door).
- **1**: Same setup, model has rotated torso 30° to the left (away from
  the contact arm), front foot stepped through, chest visibly stretched.

### `cd-pigeon` — Pigeon Pose
- **0**: Model in a kneeling lunge transition — right shin bent in
  front of body parallel to mat, hands on the floor either side,
  torso upright, hips just starting to sink. On a black yoga mat.
- **1**: Full pigeon — hips sunk to the floor, torso folded slightly
  forward over the front shin, forearms resting on the mat. Same angle.

### `cd-hamstring-lay` — Lying Hamstring Stretch
- **0**: Model on back, head on the floor, left leg flat on the floor,
  right leg raised about 60° from horizontal, foot looped through a
  black resistance band/strap, hands holding the band.
- **1**: Right leg pulled to ~90° toward chest using the band, left
  leg still flat. Same camera angle, side view.

### `cd-lat-stretch` — Overhead Lat Stretch
- **0**: Model standing tall, right arm overhead with hand reaching up,
  left hand at the side. Side view, full body.
- **1**: Right arm still overhead, left hand has crossed over the head
  and grabbed the right wrist, model laterally bent ~25° to the left
  with right side visibly stretched.

### `cd-glute-pretzel` — Figure-Four Stretch
- **0**: Model lying flat on back, both knees bent with feet on the
  floor, right ankle just crossed over left knee (start of figure-four
  setup). Hands at sides.
- **1**: Both arms reaching through the gap to clasp behind the left
  thigh, pulling left thigh toward chest, right knee opening outward,
  classic figure-four glute stretch.

### `wu-leg-swings` — Leg Swings
- **0**: Model standing side-on to camera, one hand resting on a wall
  for balance, right leg swung forward to ~45° (max forward arc).
- **1**: Same setup, right leg swung backward to ~30° (max backward
  arc). Same camera position, same arm-on-wall.

### `wu-scap-shrugs` — Scap Push-Ups
- **0**: Model in a high plank, locked elbows, shoulder blades
  RETRACTED (pinched together) — chest dips slightly between shoulders.
  Side view.
- **1**: Same plank, shoulder blades PROTRACTED (pushed apart) — upper
  back rounded, chest pushed up away from the floor. Same side view.

## When you have a pair generated

1. Save as `0.jpg` and `1.jpg` in the correct folder under
   `/public/stretches/<id>/`.
2. Open `lib/exerciseImages.ts`, find the `LOCAL_STRETCH_IDS` set, and
   add the id (e.g. `"cd-pigeon"`).
3. Commit. The FORM modal will animate those frames automatically.

## ChatGPT batch prompt template

If using ChatGPT with image generation, send all eight pairs at once:

> Generate sixteen images (eight stretch demos × two frames each) for a
> fitness app's FORM DEMO modal. **Required style for ALL:** photographic,
> gym studio, single male model in white sleeveless tank + black shorts
> + white sneakers, athletic build, neutral expression, even soft
> fluorescent lighting, plain matte-black backdrop, no logos / text /
> watermarks, square 400×400 px, JPG, model centred with ~10% padding,
> consistent same-model identity across all sixteen images.
>
> Then generate each pair using the start/end pose descriptions below.

Then paste in the eight prompts from the section above. Save each
returned image into the matching folder, register the id, commit.

## Anything you can't generate

If a stretch can't be generated photorealistically (e.g. equipment
needed isn't easily depicted), look for a CC-BY image from:
- Wikimedia Commons (`commons.wikimedia.org`)
- Pixabay
- Pexels
- Unsplash (limited stretch coverage)

Attribute in a `CREDITS.md` next to the image if licence requires it.
