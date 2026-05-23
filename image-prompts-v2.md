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
| 5. Achievement-unlock avatars | 7 | `/public/avatars/<id>.png` |
| 6. Default avatar — TRAINER variant | 1 | `/public/ai/avatar-default-trainer.png` |
| 7. Trainer tier-unlock avatars (2 per tier) | 12 | `/public/avatars/<id>.png` |
| 8. Tier sub-rank icons NEW | 11 | `/public/sub-rank-icons/<id>.png` |
| 9. Achievement category icons NEW (OPTIONAL) | 11 | `/public/cat-icons/<id>.png` |
| **Total** | **63** | (53 if Batch 9 deferred) |

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

**Background policy (updated 2026-05-23):** these icons replace
emojis inside a tier chip that ALREADY has its own dark background
+ CSS glow. So render on a **transparent background** — subject
only, no built-in halo, no gradient. The chip's existing glow
wraps the icon and the visual treatment stays consistent across
both themes.

### Style guide (paste into every Vivid tier prompt as a prefix)

> Generate a 512×512 PNG icon for a fitness app tier badge with a
> FULLY TRANSPARENT background (alpha channel, no fill, no halo, no
> gradient). Style: **subject-only crest sticker**, no scene, no
> background imagery. Subject is a stylised animal head/bust facing
> the camera DIRECTLY HEAD-ON (front-facing, symmetrical), eyes
> locked on the viewer, NO body below the shoulders, NO text, NO
> numbers. Soft rim-light in the tier's accent colour outlining the
> subject's silhouette. Square 512×512, centred composition, ~10%
> safe margin so it reads at 64px in a chip. Reference cues:
> Premier League team crests, sports league badge logos, NFL team
> animal crests — iconic, symmetrical, badge-not-portrait.

### `vivid/kitten.png` — Tier 1
> [style guide] · Subject: a calm grey kitten face, alert eyes, tiny pink
> nose, ears upright but soft. Mood: hopeful, fresh-start energy.
> Rim-light accent colour `#94a3b8` (slate).

### `vivid/fox.png` — Tier 2
> [style guide] · Subject: a sharp-eyed orange fox face with a quick,
> sly expression. Ears pricked, white chest tuft just visible. Mood:
> sharpening, hungry, kinetic. Rim-light accent colour `#fb923c`
> (orange).

### `vivid/big-dawg.png` — Tier 3
> [style guide] · Subject: a wide-shouldered American Bully / Cane Corso
> head facing the camera head-on, focused gaze, jaw set, no aggression-
> snarl but clear power. Cropped collar suggested at the bottom edge.
> Mood: formidable, dependable, ready. Rim-light accent colour `#a78bfa`
> (violet).

### `vivid/lion.png` — Tier 4 (AGGRESSIVE)
> [style guide] · Subject: a male lion's head with a thick mane facing
> the camera head-on, mouth slightly open in a controlled half-roar
> showing canine teeth, eyes locked on the viewer. Mane catches the
> rim-light dramatically. Mood: commanding, regal, dangerous. Rim-light
> accent colour `#f97316` (deep orange).

### `vivid/gorilla.png` — Tier 5 (AGGRESSIVE)
> [style guide] · Subject: a silverback gorilla's head + upper chest,
> chest-pounding stance suggested by raised fist crossing the lower
> third of the frame. Heavy brow, bared teeth in a snarl, silver fur
> catches the rim-light. Mood: dominant, primal, overwhelming.
> Rim-light accent colour `#FF6B6B` (coral red).

### `vivid/bear.png` — Tier 6 (TOP TIER, MOST AGGRESSIVE)
> [style guide] · Subject: a massive grizzly bear's head + raised paw
> with claws extended, mouth wide in a roar showing all teeth, scars on
> snout. Mood: apex predator, untouchable, mountain-king. Rim-light
> accent colour `#92400e` (dark amber/brown).

---

## Batch 3 — Athlete tier icons (Simple theme · 6 images)

Mirror the Vivid set with abstract medal/gemstone icons. Same "aggressive
at the top" feel — Master / Diamond should look earned, not generic.

**Background policy (updated 2026-05-23):** same as Batch 2 —
**transparent background**, subject only. The chip's existing
glow wraps the icon.

### Style guide (paste into every Simple tier prompt as a prefix)

> Generate a 512×512 PNG icon for a fitness app tier badge with a
> FULLY TRANSPARENT background (alpha channel, no fill, no halo, no
> gradient). Style: **subject-only sticker**, premium product-shot
> aesthetic. NO text, NO numbers, NO ribbons. Soft rim-light in the
> tier's accent colour picks out the surface texture of the medal /
> gemstone. Square 512×512, centred composition, ~10% safe margin.
> Reference cues: high-end watch face close-ups, jewellery catalogue
> product shots, Apple Watch activity-ring icons rendered as
> transparent stickers.

### `simple/bronze.png` — Tier 1
> [style guide] · Subject: a circular bronze medallion with a subtle
> hammered finish and a small embossed flame motif in the centre.
> Slight oxidation patina. Rim-light accent colour `#a8784a`. Mood:
> humble, earned, weighty.

### `simple/silver.png` — Tier 2
> [style guide] · Subject: a circular polished silver medallion with a
> brushed radial texture and a small embossed lightning-bolt motif in
> the centre. Mirror-sharp edges. Rim-light accent colour `#cbd5e1`.
> Mood: clean, precise, building.

### `simple/gold.png` — Tier 3
> [style guide] · Subject: a circular polished gold medallion with a
> deeply embossed laurel-wreath motif framing a central diamond cut-out.
> Rich warm gold finish, micro-scratches catching the light. Rim-light
> accent colour `#facc15`. Mood: established, professional, respected.

### `simple/platinum.png` — Tier 4 (REFRESH — aggressive)
> [style guide] · Subject: a platinum medallion BROKEN OUT of its
> circular frame on one edge as if exploding outward, jagged
> platinum-white shards radiating from the break. Centre carries a
> stylised lifting-figure silhouette. Mood: breaking through, elite,
> kinetic. Rim-light accent colour `#7dd3fc` (icy blue).

### `simple/diamond.png` — Tier 5 (REFRESH — aggressive)
> [style guide] · Subject: a faceted brilliant-cut diamond gemstone
> floating above a fractured platinum base, blue-white light refracting
> through its facets into beam-like rays. Aggressive geometry — no soft
> edges. Mood: untouchable, hard-earned, sharp. Rim-light accent colour
> `#60a5fa` (electric blue).

### `simple/master.png` — Tier 6 (TOP TIER — MOST AGGRESSIVE)
> [style guide] · Subject: a stylised crown rendered in molten-red
> metal floating above a fractured black-and-red obsidian base, flames
> licking up around the crown's points, sparks scattering outward.
> Centre of crown holds a single coral-red gem. Mood: apex, conquered,
> on-fire. Rim-light accent colour `#FF6B6B`.

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
| `ach-forge-eternal` | 35 achievements  | Mythic cosmic forge  | All-rounder ceiling |

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

### `ach-blacksmith.png` — 25 achievements (apex of forging)
> [style guide] · Subject: a hooded blacksmith silhouette (face hidden
> in shadow under the hood) raising a forging hammer over a glowing
> anvil. Glowing-red metal on the anvil, sparks flying. Heroic 3/4
> angle. Mood: apex artisan, undeniable mastery. Accent colour
> `#FF6B6B` (coral red). Halo: deep red-amber glow with sparks
> scattered across the frame.

### `ach-forge-eternal.png` — 35 achievements (all-rounder ceiling)
> [style guide] · Subject: a colossal celestial forge floating in deep
> space, anvil carved from black obsidian, molten metal cooling on its
> surface, golden-white cosmic flames roaring upward toward an unseen
> ceiling. Constellations and nebula gas swirl in the background. No
> human figure — the forge stands alone, eternal. Mood: mythic,
> all-time, transcendent — what a master smith becomes after a lifetime.
> Accent colour `#f0c040` (rich gold) with `#FF6B6B` (coral red)
> highlights in the flames. Halo: bright gold + red glow with star
> particles + faint nebula gas drifting outward.

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

## Batch 7 — Trainer tier-unlock avatars (12 images, 2 per tier) NEW

Per @maaiz (2026-05-23, updated): special avatars that unlock on
TRAINER tier climbs (the TRAINER_TIERS ladder: Spotter → Strategist
→ Pro → Master → Legend → Hall of Fame). Athletes-without-trainer-role
don't see these in their grid. **2 avatars per trainer tier** in v1
(was originally 1; @maaiz bumped to 2 for visual variety).

### Style guide (paste into every Trainer tier avatar prompt as a prefix)

> Generate a 512×512 PNG profile avatar. Style: **dark-mode app icon**,
> centred subject on a deep matte radial gradient background, soft
> rim-light, premium aesthetic — feels distinctly COACH not LIFTER.
> Subject is a stylised emblem of LEADERSHIP / GUIDANCE / MENTORSHIP
> — NO human faces, NO text. Tier-coloured radial halo fading to
> black at edges. Square 512×512, ~10% safe margin so it reads at
> 48px in a circle.

### Tier 1 · Spotter — 2 avatars

#### `trainer-t1-spotter-a.png` (the helping hand)
> [style guide] · Subject: a single open hand reaching upward in a
> "spot" / catch position, palm visible, fingers slightly bent.
> Accent colour `#94a3b8` (slate). Mood: supportive, present,
> ready. Halo: soft silver glow.

#### `trainer-t1-spotter-b.png` (the safety bar)
> [style guide] · Subject: a heavy safety bar from a power rack
> floating horizontally, with a single bead of sweat suspended above
> it catching the rim-light. Accent colour `#94a3b8` (slate). Mood:
> got-your-back, dependable. Halo: soft silver glow.

### Tier 2 · Strategist — 2 avatars

#### `trainer-t2-strategist-a.png` (the chess knight)
> [style guide] · Subject: a chess knight piece carved in brushed
> teal-steel, viewed from the side, with three thin orbital lines
> tracing around it suggesting calculated moves. Accent colour
> `#4ECDC4` (teal). Mood: tactical, thoughtful, planning. Halo:
> teal glow.

#### `trainer-t2-strategist-b.png` (the playbook)
> [style guide] · Subject: an open hardback notebook with a thin
> network of glowing teal lines linking handwritten X/O annotations,
> a single fountain pen resting across the spine. Accent colour
> `#4ECDC4` (teal). Mood: scheming, deliberate. Halo: teal glow.

### Tier 3 · Pro — 2 avatars

#### `trainer-t3-pro-a.png` (the certified clipboard)
> [style guide] · Subject: a clipboard with a single golden star
> embossed in the centre, pencil tucked into the clip at top, ribbon
> tail fluttering out from underneath. Accent colour `#FFD166`
> (golden yellow). Mood: certified, established, respected. Halo:
> warm gold glow.

#### `trainer-t3-pro-b.png` (the gold whistle)
> [style guide] · Subject: a polished gold coach's whistle on a
> braided silk lanyard, the whistle catching the rim-light, lanyard
> coiling beneath. Accent colour `#FFD166` (golden yellow). Mood:
> coach-in-charge, on-the-floor pro. Halo: warm gold glow.

### Tier 4 · Master — 2 avatars

#### `trainer-t4-master-a.png` (the crown of kettlebells)
> [style guide] · Subject: a regal master's crown in matte deep
> orange, with two crossed kettlebells beneath it in mirror-polished
> chrome. Accent colour `#fb923c` (deep orange). Mood: commanding,
> mastery, lineage. Halo: orange glow with subtle bronze flares.

#### `trainer-t4-master-b.png` (the dojo seal)
> [style guide] · Subject: a circular eastern-style seal stamped in
> deep-orange wax onto black slate, depicting a stylised crossed
> barbell + dumbbell glyph in the centre. Slight steam rising from
> the wax. Accent colour `#fb923c` (deep orange). Mood: lineage,
> tradition, mastery passed down. Halo: orange glow.

### Tier 5 · Legend — 2 avatars

#### `trainer-t5-legend-a.png` (the phoenix on the anvil)
> [style guide] · Subject: a stylised phoenix in coral-red flame,
> wings spread, perched on top of a forging anvil. Sparks scatter
> around the bird. Accent colour `#FF6B6B` (coral red). Mood:
> legendary, transcendent, fire-tested. Halo: red-orange glow with
> ember particles.

#### `trainer-t5-legend-b.png` (the lion's mantle)
> [style guide] · Subject: a stylised lion's head silhouette wearing
> a red ceremonial mantle/cape that drapes behind it, mane composed
> of subtle flame textures. Accent colour `#FF6B6B` (coral red).
> Mood: storied, mythic, untouchable. Halo: red glow with ember
> particles at the cape's hem.

### Tier 6 · Hall of Fame (apex) — 2 avatars

#### `trainer-t6-hof-a.png` (the trophy)
> [style guide] · Subject: a golden championship trophy with double
> handles, slight battle-wear / patina visible, standing on a black
> marble plinth. Behind it: a faint constellation of stars forming
> a halo. Accent colour `#f0c040` (rich gold). Mood: enshrined,
> immortal, top-of-the-hall. Halo: bright gold glow with shimmering
> star particles.

#### `trainer-t6-hof-b.png` (the celestial torch)
> [style guide] · Subject: a golden torch held upright by an unseen
> hand, flame composed of swirling cosmic gas with embedded stars,
> the torch base etched with HALL OF FAME glyphs (illegible runes,
> not text). Accent colour `#f0c040` (rich gold) with `#a78bfa`
> (cosmic violet) accents in the flame. Mood: passed-down legacy,
> torch-bearer, mythic. Halo: gold + violet glow with star particles.

**Wire-up:** add 12 entries to `lib/avatars.ts` `AVATARS` array.
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

## Batch 8 — Tier sub-rank icons (11 images) NEW

Per @maaiz: anything we can elevate from emoji glyph to ChatGPT-
generated raster without losing performance, do it. The tier modal
shows 7 athlete sub-ranks + 4 trainer-tier sub-ranks (currently
emojis). These are repeated everywhere — promotion toast, tier
chip, breakdown view — so elevating to consistent dark-mode raster
icons gives the biggest cohesion win for the smallest image budget.

Render size: ~32px in chips, ~48px in the modal. Generate at 256×256
PNG, compress to 96×96 / quality 85 (target <12 KB each). Total
batch budget: ~130 KB.

**Background policy (updated 2026-05-23):** same as Batches 2 + 3
— **transparent background**, glyph only. These slot into existing
chips that carry their own background + glow.

### Style guide (paste into every Sub-rank icon prompt)

> Generate a 256×256 PNG icon for a fitness app tier-breakdown
> sub-rank chip with a FULLY TRANSPARENT background (alpha channel,
> no fill, no halo, no gradient). Style: **subject-only monoline
> glyph**, premium app aesthetic. NO text, NO numbers, NO bounding
> circle, NO scene. The glyph is a single recognisable monoline
> icon in the sub-rank's accent colour with subtle inner highlights
> — think Apple Fitness Health-app glyph energy rendered as a
> transparent sticker. Square 256×256, ~15% safe margin so the
> glyph reads at 32px.

### Athlete sub-ranks (7)

| ID | Concept | Accent colour | Prompt addition |
|---|---|---|---|
| `consistency` | Loop of circling arrows on a calendar grid | `#4ECDC4` (teal) | "two arrows chasing each other in a circular loop, overlaid on a faint 7-cell calendar strip" |
| `strength` | Flexed bicep silhouette | `#FF6B6B` (coral red) | "stylised flexed-arm silhouette, monoline outline, single highlight on the bicep peak" |
| `progression` | Upward-trending rocket arrow | `#FFE66D` (yellow) | "stylised rocket shape composed of upward arrow lines, exhaust trail beneath" |
| `volume` | Stacked weight plates rising bar chart | `#a78bfa` (violet) | "three stacked weight plates of increasing size forming an ascending bar chart" |
| `mastery` | Trophy silhouette with crossed swords | `#f0c040` (gold) | "trophy cup with two crossed barbells behind it as the 'handles'" |
| `bodycomp` | Balanced scale with a leaf and dumbbell | `#34d399` (green) | "old-style balance scale, leaf on one pan + dumbbell on the other" |
| `habits` | Water droplet ringed by sleep crescent | `#74b9ff` (blue) | "water droplet centred inside a crescent moon arc" |

### Trainer sub-ranks (4 — fields not already covered above)

| ID | Concept | Accent colour | Prompt addition |
|---|---|---|---|
| `roster` | Three head-silhouettes forming a triangle | `#a78bfa` (violet) | "three minimal head silhouettes arranged in a triangle, slight depth shadow" |
| `retention` | Circular loop with anchor in centre | `#4ECDC4` (teal) | "circular loop with a small anchor symbol inside, indicating clients staying" |
| `reach` | Sphere with orbit lines + spark points | `#f0c040` (gold) | "wireframe sphere with two orbital lines, four small spark dots on the orbits" |
| `discipline` | Kettlebell with focus ring | `#fb923c` (orange) | "single kettlebell viewed front-on with a thin concentric focus ring around it" |

**Wire-up:** in `lib/tiers.ts`, change each sub-rank's `icon` field
from the emoji string to a path like `/sub-rank-icons/strength.png`.
The render in the tier modal + breakdown view needs to detect path
vs emoji (starts with `/` → render `<img>`, else render as text).
Lift existing emojis into a fallback when image fails to load. About
a 15-line change across lib/tiers.ts + the 2-3 render sites.
(qa: tier-modal-icons-raster)

---

## Batch 9 — Achievement category icons (11 images, OPTIONAL)

These would replace the category emojis (💪 🔁 📈 🏆 💧 ⚡ 🏃 🤸 🌟
🤝 😂) in the Achievements grid sub-headers. **Marked OPTIONAL —
generate ONLY if Batch 8 lands well and you want consistent visual
cohesion across the tier modal + achievements UI.** Otherwise emojis
are fine for the category headers (they're decorative, not
functional).

Render size: ~24px in the sub-header strip. Generate at 256×256 PNG,
compress to 96×96 / quality 85. Total batch budget: ~130 KB.

**Background policy:** transparent — same as Batch 8.

### Style guide (same as Batch 8 — transparent-background monoline glyph)

### Categories (11)

| ID | Concept | Accent colour |
|---|---|---|
| `cat-strength` | Reuse `sub-rank-icons/strength.png` (flexed arm) — no separate render needed | `#FF6B6B` |
| `cat-consistency` | Reuse `sub-rank-icons/consistency.png` | `#4ECDC4` |
| `cat-volume` | Reuse `sub-rank-icons/volume.png` | `#a78bfa` |
| `cat-variety` | Color-wheel split into 4 quadrants | `#fb923c` (orange) |
| `cat-wellness` | Reuse `sub-rank-icons/habits.png` | `#74b9ff` |
| `cat-technique` | Stylised double-arrow superset glyph | `#a855f7` (purple) |
| `cat-cardio` | Running shoe in profile, stride lines beneath | `#FFE66D` (yellow) |
| `cat-warmup-cooldown` | Stretching figure silhouette | `#fdcb6e` (warm yellow) |
| `cat-milestone` | Five-pointed star with subtle trail | `#f0c040` (gold) |
| `cat-trainer` | Whistle on lanyard (mini version of trainer-t3-pro-b) | `#4ECDC4` (teal) |
| `cat-meme` | Wink-face emoji-style icon — NOT a literal emoji, a custom raster wink with personality | `#94a3b8` (slate) |

5 of 11 reuse Batch 8 assets — only 6 NEW renders needed if Batch 8
already shipped. Wire-up: trivial — string lookup in
`lib/achievements.ts` `categoryIcon(category)`.
(qa: achievements-category-icons-raster)

---

## Future elevation candidates (NOT in this batch)

Logged for completeness — these are NOT being generated now but
COULD be elevated to raster later if the user wants:

- **Per-achievement tile icons** — 62 individual achievement icons.
  HUGE batch. Skip for v1; tile uses category icon + the
  achievement title text. Could batch later if @maaiz wants every
  tile uniquely illustrated.
- **Equipment selection icons in onboarding** — currently emoji
  (🏋️ 🏠 etc.). Low-value elevation; emojis read fine in that
  context.
- **Wellness card section icons** — 💧 😴 ⚡ etc. Same as above —
  emojis fine, low elevation value.
- **Workout day card hero images** — already raster (generated at
  launch). Refresh batch would be 5-7 images if @maaiz wants new
  aesthetics, but the current ones are functional.

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

Total: **63 images** (53 if Batch 9 deferred). Breakdown:
- 1 athlete default avatar refresh
- 12 athlete tier icons (vivid + simple)
- 8 stretch regen frames (4 pairs)
- 7 achievement-unlock avatars (incl. 35-milestone)
- 1 trainer default avatar
- 12 trainer tier-unlock avatars (2 per tier × 6)
- 11 sub-rank icons (athlete + trainer)
- 11 achievement category icons (OPTIONAL — 6 new if Batch 8 already
  shipped + 5 reuses)

Compressed to the targets in the file-size table above, that's
roughly 1.4 MB total (excluding Batch 9). Smaller than current
launch batch (~3 MB) despite being more images.

Commit each batch as you go. Vercel auto-deploys (now that the
deploy-skip script bug is fixed). Suggested generation order to
maximise visible value early:

1. Batch 1 (default avatar) — instant standalone win, 1 image
2. Batches 2 + 3 (tier icons, 12) — biggest visual cohesion upgrade
3. Batch 6 (trainer default, 1)
4. Batch 4 (stretch fixes, 8) — unblocks ticking the wrong-image reminder
5. Batch 8 (sub-rank icons, 11) — UI cohesion + powers Batch 9 reuses
6. Batch 7 (trainer tier avatars, 12) — gates on trainer-role users existing
7. Batch 5 (achievement avatars, 7) — gates on achievements-v1 shipping
8. Batch 9 (category icons, 11 OPTIONAL) — last polish
