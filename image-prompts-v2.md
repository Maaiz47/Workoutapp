# IronLog — image-gen plan v2 (post 1.0 milestone)

The original `image-prompts.md` covered the 82 launch assets (avatars +
stretches + exercise demos). This v2 file covers everything we've added
to the wishlist since:

| Batch | Count | Output path |
|---|---|---|
| 1. Default avatar refresh (athlete) | 1 | `/public/ai/avatar-default.png` |
| 2. Athlete tier icons — Vivid theme | 6 | `/public/tier-icons/vivid/<label>.png` |
| 3. Athlete tier icons — Simple theme | 6 | `/public/tier-icons/simple/<label>.png` |
| 4. Stretch frame fixes (regens) | 8 | `/public/stretches/<id>/{0,1}.png` |
| 5. Achievement-unlock avatars | 6 | `/public/avatars/<id>.png` |
| 6. Default avatar — TRAINER variant NEW | 1 | `/public/ai/avatar-default-trainer.png` |
| 7. Trainer tier-unlock avatars NEW | 6 | `/public/avatars/<id>.png` |
| **Total** | **34** | |

## File-size optimisation (read this BEFORE generation)

Per @maaiz (2026-05-23): the existing avatars + tier icons feel slow
on mobile. They're displayed tiny — typical render sizes are 32-52px
circles for avatars, 64-96px for tier chips, 40px in the home
profile chip. Generating at 1024×1024 and serving raw makes every
profile/leaderboard surface drag.

**Targets per image type:**

| Surface | Display size | Generate at | Then encode at |
|---|---|---|---|
| Avatars (profile circles) | 32-52px | 512×512 | 192×192 PNG quality 85, OR 256×256 WebP quality 75 |
| Tier icons (vivid + simple) | 18-96px | 512×512 | 192×192 PNG quality 85 |
| Stretch frames (FORM modal) | ~300px wide | 512×512 | 384×384 PNG quality 85 |
| Default avatar | 32-52px | 1024×1024 | 192×192 PNG quality 85 |

**Pipeline:**
1. Generate at native resolution (1024×1024 or 512×512 — your choice
   for source quality).
2. Run through a one-shot compression pass — `npx sharp-cli` (Sharp)
   or an online tool like Squoosh.app — to the "Then encode at"
   target size + quality. Aim for **<25 KB per avatar**, **<35 KB per
   tier icon**, **<60 KB per stretch frame**.
3. Save the compressed version into the public path. Keep the
   high-res original in a separate `/source/` folder if you want to
   re-export later at different sizes.

**Target totals:** at 25 KB/avatar × 34 images = 850 KB for the
entire v2 batch. Compared to the current ~3 MB existing batch this
is a 70% reduction — meaningfully faster perceived load.

Add a `scripts/compress-images.sh` helper that walks `/public/avatars`
+ `/public/tier-icons` + `/public/stretches` and reports any image
above its target size — easy regression catch on future generations.
(qa: `image-compression-pass` — planning item only, ships with
the image-gen v2 work.)

Drop each PNG at the path listed. No rebuild needed — Next.js serves
from `/public`. The wire-up notes for each batch sit at the bottom
under "Registration steps".

---

## Batch 1 — Default avatar refresh (1 image)

Current `/public/ai/avatar-default.png` is the placeholder. @maaiz
wants a better starting avatar that feels at home in the dark theme.

### `avatar-default.png`

> A sleek minimalist circular logo-style profile avatar for a
> strength-training app. Subject: a single chrome-textured barbell
> silhouette viewed from a slight 3/4 angle, plates clearly visible,
> suspended in space. Deep matte black background with a soft radial
> glow in a single warm accent colour (coral-red #FF6B6B at 30% opacity
> behind the barbell). Studio rim lighting picks out the polished metal
> edges. No text, no human figure, no extra elements. Square 1024×1024,
> centred composition, ~12% safe margin so the subject reads at small
> sizes when cropped to a 48px circle. Style: editorial product shot
> meets sci-fi UI iconography. Reference cues: Apple Fitness rings
> aesthetic, Nike Training Club hero shots, Dyson product silhouettes.

Test at 32 / 36 / 52px (the three sizes it renders at on home + settings).
If the barbell loses readability when shrunk, ask for: *"same prompt but
stripped to a single horizontal bar with 2 plate stacks each side, high
contrast silhouette"*.

---

## Batch 2 — Athlete tier icons (Vivid theme · 6 images)

Replace the current emoji glyphs (🐱 🦊 🐕 🦁 🦍 🐻) with custom-generated
icons. User wants them **aggressive at the top tiers** — Lion / Gorilla /
Bear should feel earned. Kitten + Fox should still feel friendly so the
progression has emotional pacing.

### Style guide (paste into every Vivid tier prompt as a prefix)

> Generate a 512×512 PNG icon for a fitness app tier badge. Style:
> **dark-mode app icon**, centred subject on a deep matte radial gradient
> background, premium gym-app aesthetic. Subject is a stylised animal
> head/bust facing the camera at a slight 3/4 angle, NO body below the
> shoulders, NO text, NO numbers. Soft rim-light in the tier's accent
> colour. Background: tier-coloured radial halo fading to near-black at
> the edges. Square 512×512, centred composition, ~10% safe margin so it
> reads at 64px in a chip. Reference cues: trading-card character
> portraits, video-game class-select icons, Premier League team crests.

### `vivid/kitten.png` — Tier 1
> [style guide] · Subject: a calm grey kitten face, alert eyes, tiny pink
> nose, ears upright but soft. Mood: hopeful, fresh-start energy.
> Accent colour `#94a3b8` (slate). Halo: subtle silver glow.

### `vivid/fox.png` — Tier 2
> [style guide] · Subject: a sharp-eyed orange fox face with a quick,
> sly expression. Ears pricked, white chest tuft just visible. Mood:
> sharpening, hungry, kinetic. Accent colour `#fb923c` (orange).
> Halo: warm amber glow.

### `vivid/big-dawg.png` — Tier 3
> [style guide] · Subject: a wide-shouldered American Bully / Cane Corso
> head in 3/4 angle, focused gaze, jaw set, no aggression-snarl but
> clear power. Cropped collar suggested at the bottom edge. Mood:
> formidable, dependable, ready. Accent colour `#a78bfa` (violet).
> Halo: purple glow.

### `vivid/lion.png` — Tier 4 (AGGRESSIVE)
> [style guide] · Subject: a male lion's head with a thick mane, mouth
> slightly open in a controlled half-roar showing canine teeth, eyes
> locked on the viewer. Mane catches the rim-light dramatically. Mood:
> commanding, regal, dangerous. Accent colour `#f97316` (deep orange).
> Halo: orange-red glow with embers.

### `vivid/gorilla.png` — Tier 5 (AGGRESSIVE)
> [style guide] · Subject: a silverback gorilla's head + upper chest,
> chest-pounding stance suggested by raised fist crossing the lower
> third of the frame. Heavy brow, bared teeth in a snarl, silver fur
> catches the rim-light. Mood: dominant, primal, overwhelming. Accent
> colour `#FF6B6B` (coral red). Halo: red-black smoky glow.

### `vivid/bear.png` — Tier 6 (TOP TIER, MOST AGGRESSIVE)
> [style guide] · Subject: a massive grizzly bear's head + raised paw
> with claws extended, mouth wide in a roar showing all teeth, scars on
> snout. Steam from breath visible in the cold air around the muzzle.
> Mood: apex predator, untouchable, mountain-king. Accent colour
> `#92400e` (dark amber/brown). Halo: golden-amber glow with subtle
> motion blur on the swing.

---

## Batch 3 — Athlete tier icons (Simple theme · 6 images)

Mirror the Vivid set with abstract medal/gemstone icons. Same "aggressive
at the top" feel — Master / Diamond should look earned, not generic.

### Style guide (paste into every Simple tier prompt as a prefix)

> Generate a 512×512 PNG icon for a fitness app tier badge. Style:
> **dark-mode app icon**, centred medal/gemstone subject on a deep matte
> radial gradient background, premium product-shot aesthetic. NO text,
> NO numbers, NO ribbons. Soft rim-light in the tier's accent colour
> picks out the surface texture. Background: tier-coloured radial halo
> fading to near-black at the edges. Square 512×512, centred
> composition, ~10% safe margin. Reference cues: high-end watch face
> close-ups, jewellery catalogue product shots, Apple Watch
> activity-ring icons.

### `simple/bronze.png` — Tier 1
> [style guide] · Subject: a circular bronze medallion with a subtle
> hammered finish and a small embossed flame motif in the centre.
> Slight oxidation patina. Accent colour `#a8784a`. Mood: humble,
> earned, weighty.

### `simple/silver.png` — Tier 2
> [style guide] · Subject: a circular polished silver medallion with a
> brushed radial texture and a small embossed lightning-bolt motif in
> the centre. Mirror-sharp edges. Accent colour `#cbd5e1`. Mood: clean,
> precise, building.

### `simple/gold.png` — Tier 3
> [style guide] · Subject: a circular polished gold medallion with a
> deeply embossed laurel-wreath motif framing a central diamond cut-out.
> Rich warm gold finish, micro-scratches catching the light. Accent
> colour `#facc15`. Mood: established, professional, respected.

### `simple/platinum.png` — Tier 4 (REFRESH — aggressive)
> [style guide] · Subject: a platinum medallion BROKEN OUT of its
> circular frame on one edge as if exploding outward, jagged
> platinum-white shards radiating from the break. Centre carries a
> stylised lifting-figure silhouette. Mood: breaking through, elite,
> kinetic. Accent colour `#7dd3fc` (icy blue). Halo: icy-white glow
> with crystalline highlights.

### `simple/diamond.png` — Tier 5 (REFRESH — aggressive)
> [style guide] · Subject: a faceted brilliant-cut diamond gemstone
> floating above a fractured platinum base, blue-white light refracting
> through its facets into beam-like rays. Aggressive geometry — no soft
> edges. Mood: untouchable, hard-earned, sharp. Accent colour `#60a5fa`
> (electric blue). Halo: bright cyan glow with prismatic streaks.

### `simple/master.png` — Tier 6 (TOP TIER — MOST AGGRESSIVE)
> [style guide] · Subject: a stylised crown rendered in molten-red
> metal floating above a fractured black-and-red obsidian base, flames
> licking up around the crown's points, sparks scattering outward.
> Centre of crown holds a single coral-red gem. Mood: apex, conquered,
> on-fire. Accent colour `#FF6B6B`. Halo: deep red glow fading to dark
> with ember particles.

---

## Batch 4 — Stretch frame fixes (8 images = 4 pairs × 2 frames)

CLAUDE.md pending reminder — these were pulled from `LOCAL_STRETCH_IDS`
because the existing frames don't match the spec. Regenerate to the
detail below, then re-add each id to `lib/exerciseImages.ts`.

### `wu-scap-shrugs/0.png` — Scap push-ups (retracted)
> Single male athlete in plank position, locked elbows, shoulder blades
> RETRACTED (pinched together) so chest dips slightly between shoulders.
> Black tank top + black shorts, neutral gym background, side-view
> camera at floor level. Photoreal style, dark background, dramatic
> rim-light from above-left. Square 512×512.

### `wu-scap-shrugs/1.png` — Scap push-ups (protracted)
> Same athlete + same exact camera + same gym background as frame 0,
> still in plank position with locked elbows, but shoulder blades now
> PROTRACTED (pushed apart) — upper back rounded UPWARD, chest pushed up
> away from the floor. Show clear upper-back rounding so the animation
> reads as a scap push-up. Square 512×512.

### `cd-glute-pretzel/0.png` — Glute pretzel (setup)
> Single male athlete lying on back, right ankle crossed over left
> knee in a figure-four shape, hands at sides on the floor. Yoga mat
> visible. Top-down camera angle. Photoreal style, dark gym background,
> rim-light. Square 512×512.

### `cd-glute-pretzel/1.png` — Glute pretzel (pull through gap)
> Same athlete, same setup (figure-four right-over-left), but BOTH ARMS
> THREADED THROUGH the gap between the legs, hands clasping behind the
> LEFT (bottom) thigh, pulling the left thigh toward the chest. Right
> knee opens OUTWARD (away from chest) so the figure-four is clearly
> visible. Same top-down camera + background as frame 0. Square 512×512.

### `terminal-knee-extension/0.png` — TKE (bent, slack band)
> Single male athlete standing facing camera, right leg straight on
> ground, LEFT KNEE BENT ~30° with a resistance band looped behind the
> left knee — band visibly SLACK / draped. Both arms at sides. Photoreal
> style, dark gym background, neutral camera angle at hip level.
> Square 512×512.

### `terminal-knee-extension/1.png` — TKE (fully extended, taut band)
> Same athlete + same camera as frame 0, but left leg now FULLY
> EXTENDED with the band CLEARLY TAUT / stretched behind the knee. Subtle
> quad flex visible above the knee. Show a clear visual difference vs
> frame 0 — band tension is the key signal. Square 512×512.

### `high-knees/0.png` — High knees (right leg up)
> Single male athlete jogging in place, RIGHT KNEE driven up to hip
> height, left foot planted on the floor, arms in opposite pump (left
> arm forward, right arm back). Side-view camera at hip level. Photoreal
> style, dark gym background, rim-light. Square 512×512.

### `high-knees/1.png` — High knees (left leg up — MIRROR)
> Same athlete + same camera + same background as frame 0, but legs/arms
> MIRRORED: LEFT KNEE driven up to hip height, right foot planted, right
> arm forward + left arm back. The two frames must alternate cleanly so
> the animation reads as a running motion. Square 512×512.

---

## Batch 5 — Achievement-unlock avatars (6 images)

New profile avatars that unlock by **achievement count** (see
`ACHIEVEMENTS.md` for the catalogue + criteria). The unlock thresholds:

| ID | Unlocks at | Theme | Vibe |
|---|---|---|---|
| `ach-spark`         | 3 achievements   | Forging spark        | Just lit |
| `ach-hammer`        | 6 achievements   | Smith's hammer       | Crafting yourself |
| `ach-anvil`         | 10 achievements  | Forged anvil         | Tested |
| `ach-phoenix`       | 15 achievements  | Rising phoenix       | Comeback fuel |
| `ach-crucible`      | 20 achievements  | Glowing crucible     | Refined |
| `ach-blacksmith`    | 25 achievements  | Master blacksmith    | Apex craft |

### Style guide (paste into every Achievement avatar prompt as a prefix)

> Generate a 512×512 PNG profile avatar. Style: **dark-mode app icon**,
> centred subject on a deep matte radial gradient background, soft
> rim-light, premium aesthetic. The subject is a stylised
> blacksmithing-themed emblem — NO human faces (except `ach-blacksmith`
> which has a silhouette only), NO text. Tier-coloured radial halo
> fading to black. Square 512×512, ~10% safe margin so it reads at
> 48px in a circle.

### `ach-spark.png` — 3 achievements
> [style guide] · Subject: a single bright yellow-orange spark just
> struck from a flint, suspended mid-air, with two smaller flying
> embers around it. Slight motion-blur trail behind. Accent colour
> `#fde047`. Halo: warm yellow glow.

### `ach-hammer.png` — 6 achievements
> [style guide] · Subject: a polished steel forging hammer suspended
> upright (head-up, handle-down), wrapped leather grip on the handle,
> small sparks ricocheting off the hammer head. Accent colour
> `#94a3b8` (steel). Halo: cool silver glow with orange ember accents.

### `ach-anvil.png` — 10 achievements
> [style guide] · Subject: a heavy iron anvil viewed from a slight 3/4
> angle, scuffed steel-grey surface, single glowing-hot horseshoe
> resting on top emitting heat shimmer. Accent colour `#a8784a`
> (bronze). Halo: amber-orange glow.

### `ach-phoenix.png` — 15 achievements
> [style guide] · Subject: a stylised phoenix bird rising with wings
> half-spread, body composed of orange-red flames transitioning to
> golden feathers at the wing tips. Single forging flame at the bird's
> feet. Mood: rebirth, momentum. Accent colour `#f97316` (deep orange).
> Halo: red-orange glow with ember trails.

### `ach-crucible.png` — 20 achievements
> [style guide] · Subject: a heavy stone crucible with molten metal
> glowing white-hot inside, beams of light shooting upward from the
> opening, surrounded by floating tools (hammer, tongs) in soft focus.
> Mood: refinement, mastery. Accent colour `#FFE66D` (yellow-gold).
> Halo: bright golden glow with white-hot core.

### `ach-blacksmith.png` — 25 achievements (apex)
> [style guide] · Subject: a hooded blacksmith silhouette (face hidden
> in shadow under the hood) raising a forging hammer over a glowing
> anvil. Glowing-red metal on the anvil, sparks flying. Heroic 3/4
> angle. Mood: apex artisan, undeniable mastery. Accent colour
> `#FF6B6B` (coral red). Halo: deep red-amber glow with sparks
> scattered across the frame.

---

## Batch 6 — Trainer default avatar (1 image) NEW

Per @maaiz: trainers should have a different default avatar from
athletes. App detects user role and picks the right starting image
(wire-up below).

### `avatar-default-trainer.png`

> A sleek minimalist circular logo-style profile avatar for a
> strength-training app, COACH variant. Subject: a clipboard +
> stopwatch combo suspended in space, clipboard tilted slightly with a
> minimalist training-plan grid visible (no readable text), stopwatch
> overlapping the bottom corner of the clipboard with the second-hand
> mid-tick. Both objects in polished brushed-steel finish. Deep matte
> black background with a soft radial glow in teal (#4ECDC4 at 30%
> opacity behind the subject). Studio rim lighting picks out the
> metal edges. No human figure, no text, no extra elements. Square
> 1024×1024, centred composition, ~12% safe margin for the 48px
> cropped circle render. Style: editorial product shot meets sci-fi
> UI iconography. Reference cues: Apple Fitness rings, Strava coach
> badges, Whoop strap product shots.

**Wire-up:** in app/page.tsx, every site that currently uses
`/ai/avatar-default.png` needs to become role-aware:

```ts
const userIsTrainer = userHasRole(user, "trainer");
const defaultAvatarSrc = userIsTrainer ? "/ai/avatar-default-trainer.png" : "/ai/avatar-default.png";
// then: const src = av ? `/avatars/${av.id}.png` : defaultAvatarSrc;
```

Affected sites (4 today): home profile chip (line ~8573), AvatarPickerView
Default tile (line ~4204), Settings profile circle (line ~11358), and the
onError fallback (line ~4223 + ~11361). Add to AvatarPickerView via a
new `defaultAvatarSrc` prop so the picker doesn't need to import the
role check itself. (qa: profile-avatars-trainer-default)

---

## Batch 7 — Trainer tier-unlock avatars (6 images) NEW

Per @maaiz: special avatars that unlock on TRAINER tier climbs (the
TRAINER_TIERS ladder: Spotter → Strategist → Pro → Master → Legend
→ Hall of Fame). Athletes-without-trainer-role don't see these in
their grid. 1 avatar per trainer tier in v1; can expand to 3-per-tier
later if @maaiz wants the full athlete-parity treatment.

### Style guide (paste into every Trainer tier avatar prompt as a prefix)

> Generate a 512×512 PNG profile avatar. Style: **dark-mode app icon**,
> centred subject on a deep matte radial gradient background, soft
> rim-light, premium aesthetic — feels distinctly COACH not LIFTER.
> Subject is a stylised emblem of LEADERSHIP / GUIDANCE / MENTORSHIP
> — NO human faces, NO text. Tier-coloured radial halo fading to
> black at edges. Square 512×512, ~10% safe margin so it reads at
> 48px in a circle.

### `trainer-t1-spotter.png` — Spotter (Tier 1)
> [style guide] · Subject: a single open hand reaching upward in a
> "spot" / catch position, palm visible, fingers slightly bent.
> Accent colour `#94a3b8` (slate). Mood: supportive, present,
> ready. Halo: soft silver glow.

### `trainer-t2-strategist.png` — Strategist (Tier 2)
> [style guide] · Subject: a chess knight piece carved in brushed
> teal-steel, viewed from the side, with three thin orbital lines
> tracing around it suggesting calculated moves. Accent colour
> `#4ECDC4` (teal). Mood: tactical, thoughtful, planning. Halo:
> teal glow.

### `trainer-t3-pro.png` — Pro (Tier 3)
> [style guide] · Subject: a clipboard with a single golden star
> embossed in the centre, pencil tucked into the clip at top, ribbon
> tail fluttering out from underneath. Accent colour `#FFD166`
> (golden yellow). Mood: certified, established, respected. Halo:
> warm gold glow.

### `trainer-t4-master.png` — Master (Tier 4)
> [style guide] · Subject: a regal master's crown in matte deep
> orange, with two crossed kettlebells beneath it in mirror-polished
> chrome. Accent colour `#fb923c` (deep orange). Mood: commanding,
> mastery, lineage. Halo: orange glow with subtle bronze flares.

### `trainer-t5-legend.png` — Legend (Tier 5)
> [style guide] · Subject: a stylised phoenix in coral-red flame,
> wings spread, perched on top of a forging anvil. Sparks scatter
> around the bird. Accent colour `#FF6B6B` (coral red). Mood:
> legendary, transcendent, fire-tested. Halo: red-orange glow with
> ember particles.

### `trainer-t6-hof.png` — Hall of Fame (Tier 6, apex)
> [style guide] · Subject: a golden championship trophy with double
> handles, slight battle-wear / patina visible, standing on a black
> marble plinth. Behind it: a faint constellation of stars forming
> a halo. Accent colour `#f0c040` (rich gold). Mood: enshrined,
> immortal, top-of-the-hall. Halo: bright gold glow with shimmering
> star particles.

**Wire-up:** add 6 entries to `lib/avatars.ts` `AVATARS` array.
Schema additions:
- `Avatar.ladder?: "athlete" | "trainer"` — defaults to "athlete"
  when omitted (backward-compatible for the 20 existing tier
  avatars). Trainer-tier avatars set `ladder: "trainer"`.
- `/api/avatars` GET: when computing `tierAvatarsAtOrBelow`, also
  compute trainer tier (if user has trainer role) and mint trainer-
  tier avatars where `avatar.tier ≤ user.trainerTier`. Filter the
  full inventory by role: pure athletes don't see `ladder: "trainer"`
  rows; trainer-athletes see both.
- AvatarPickerView grid: group avatars by `ladder` when the user has
  multiple — Athlete Tier Unlocks / Trainer Tier Unlocks / Lucky /
  Achievement sub-sections. (qa: profile-avatars-trainer-tier)

---

## Registration steps

### Default avatar (Batch 1)
1. Save as `/public/ai/avatar-default.png` (overwriting current placeholder).
2. No code change. Refresh in browser to test at 32/36/52px.

### Tier icons (Batches 2 + 3)
1. Save to `/public/tier-icons/vivid/<label>.png` and
   `/public/tier-icons/simple/<label>.png` (where `<label>` is lowercase
   with hyphens — e.g. `big-dawg.png`, `bronze.png`).
2. Edit `lib/tiers.ts`: change each tier's `icon` field from the emoji
   string to a path like `/tier-icons/vivid/bear.png`. Where the icon is
   rendered (search for `t.icon` in app/page.tsx) we'll need to detect
   whether it's a path (starts with `/`) and render `<img>` instead of
   text. About a 5-line change. Lift the existing emoji into a fallback
   when image fails to load.
3. After landing, sweep the tier modal + chip surfaces to confirm icons
   read clearly at all sizes (some are 9px tall in chip subtitles).

### Stretch frame regens (Batch 4)
1. Save pairs to `/public/stretches/<id>/{0,1}.png` (overwriting current
   wrong versions).
2. Re-add each id to `LOCAL_STRETCH_IDS` in `lib/exerciseImages.ts`
   (currently removed — they fall back to emoji).
3. Tick / delete the corresponding line in CLAUDE.md's pending-reminders
   block.

### Achievement-unlock avatars (Batch 5)
1. Save each as `/public/avatars/<id>.png` (e.g.
   `/public/avatars/ach-phoenix.png`).
2. Append entries to `lib/avatars.ts` `AVATARS` array with
   `source: "achievement"`, `achievementCount: <threshold>`, and a
   short flavour line.
3. Add `"achievement"` to the `AvatarSource` union type.
4. Wire up unlock minting in `app/api/avatars/route.ts` — after the
   tier-source backfill, count the user's earned achievements and mint
   any achievement-source avatars they qualify for. (Achievement
   computation lands as part of the `achievements-v1` qa-state item;
   see `ACHIEVEMENTS.md`.)

---

## After all batches land

Total: **34 images** (was 27 before trainer additions). Compressed to
the targets in the file-size table above, that's roughly 850 KB
total — meaningful for mobile load.

Once all batches ship: CLAUDE.md's pending image reminders
(wrong-form-images + tier-icons + achievements + image-gen-plan-v2)
can all be ticked off. Add a new pending reminder for trainer-tier
3-per-tier expansion only if you decide to grow past 1-per-tier.

Commit each batch as you go. Vercel auto-deploys (now that the
deploy-skip script bug is fixed).
