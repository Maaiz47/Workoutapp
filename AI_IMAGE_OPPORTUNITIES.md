# IRONLOG — AI Image Opportunities & Prompts

Master list of every place an AI-generated image would meaningfully improve IRONLOG, with copy-paste-ready prompts for ChatGPT / DALL-E / GPT Image.

## Brand style clause (append to every prompt for consistency)

> Match a brand style of dark matte black backgrounds, single crimson (#dc2626) rim light, photoreal cinematic gym aesthetic, no faces, no text, no logos, premium and serious in tone.

## Palette & constraints

- Background: near-black `#0a0a0a` – `#1a1a1a`
- Primary accent: crimson `#dc2626`
- Secondary accent: muted teal `#4ECDC4`
- HIIT accent: orange (swap crimson for orange in HIIT-only assets)
- No faces, no text, no logos
- Mobile-first: vertical/square crops preferred

## How to use these prompts

Each prompt is self-contained — paste it as-is into ChatGPT's image tool. The aspect-ratio cue is built into the last line. If ChatGPT only offers fixed sizes (1024×1024, 1024×1536, 1536×1024), pick the closest and crop after.

## Progress tracker

- [x] 1. Login / splash background
- [x] 2. Home screen hero strip
- [x] 3. Workout card — Push
- [x] 4. Workout card — Pull
- [x] 5. Workout card — Legs
- [x] 6. Workout card — Upper
- [x] 7. Workout card — Lower
- [x] 8. Workout card — Full Body
- [x] 9. Workout card — Cardio
- [x] 10. Workout card — HIIT
- [x] 11. Onboarding Step 0 — Welcome
- [x] 12. Onboarding goal — Build Muscle
- [x] 13. Onboarding goal — Get Stronger
- [x] 14. Onboarding goal — Lose Fat
- [x] 15. Onboarding goal — General Fitness
- [x] 16. Onboarding Step 6 — Training Location (3 tiles)
- [x] 17. PB / Personal Best celebration overlay
- [x] 18. "No workouts logged yet" empty state
- [x] 19. "No PBs yet" empty state
- [x] 20. "No messages yet" empty state
- [x] 21. "No clients yet" — trainer view
- [x] 22. "No users found" — trainer search
- [x] 23. "No profile set up yet" empty state
- [x] 24. Form demo fallback — "No form demo available"
- [x] 25. Anatomy thumbnails (chest, back, shoulders, arms, legs, core)
- [x] 26. Settings profile avatar default
- [x] 27. promo.html landing hero
- [x] 28. trainer.html landing hero
- [x] 29. client.html landing hero
- [x] 30. Workout-complete celebration backdrop
- [ ] 31. ROADMAP "what's next" banner

---

## 1. Login / splash background — `app/page.tsx` login screen ✅ generated

**Current:** plain dark backdrop behind the dropping `IRONLOG` glyphs.
**Why:** First impression. A subtle textured backdrop multiplies the impact of the squash-and-stretch logo animation.
**Format:** 1024×1536 portrait.
**Save as:** `public/ai/login-bg.jpg`

```
Cinematic ultra-dark photograph of a knurled olympic barbell loaded with chalked iron plates resting on a concrete gym floor, shot from a low oblique angle. Single hard rim light from camera-right rakes across the knurling and plate edges with a faint warm-crimson tint; the rest of the frame falls to deep matte black with no visible background detail. Heavy negative space in the upper two-thirds for app text overlay. Photoreal, 35mm look, fine film grain, no people, no logos, no text. Tall portrait composition, 2:3 aspect ratio (1024x1536).
```

---

## 2. Home screen hero strip — above "TODAY'S TRAINING" ✅ generated

**Current:** text-only `LIFT · TRACK · PROGRESS` tagline.
**Why:** Narrow cinematic band sets the tone without competing with workout cards.
**Format:** 1536×512 ultrawide (crop from 1536×1024).
**Save as:** `public/ai/home-hero.jpg`

```
Ultrawide cinematic banner, pure black background, single horizontal sliver of warm tungsten light grazing a lifter's chalked hands gripping a barbell at the centre. Crimson key light at low intensity, the rest dissolves into matte black on both sides for clean text overlay. Photoreal, sharp on the hands, shallow depth elsewhere, no faces, no text, no logos. Wide landscape composition, 3:2 aspect ratio (1536x1024) with heavy empty space top and bottom so the centre can be cropped to a 3:1 banner.
```

---

## 3–10. Workout-type card art (Push / Pull / Legs / Upper / Lower / Full Body / Cardio / HIIT)

**Current:** animated SVG block-figure with muscle "explosion" — abstract.
**Why:** Photoreal motion stills make each card instantly identifiable and motivating. Generate the set with the same master prompt for consistency.
**Format:** 1024×1024 square per card.

**Master prompt (repeat per card, swap only the action line):**

```
Cinematic gym photograph in a consistent series. Deep matte black studio background, single crimson rim light, secondary cold white key from above. Athlete wearing a plain charcoal t-shirt and dark shorts. Framing crops naturally at the jawline so the face is out of frame — the head shape is still anatomically present at the very top of the image, NOT erased or replaced with black. Photoreal, sharp, faint motion blur on the moving limb, gritty film grain, no logos, no text. Square 1:1 composition (1024x1024).

Action: <ACTION_LINE>
```

| # | Card | ACTION_LINE |
|---|---|---|
| 3 | Push | Mid-rep dumbbell bench press, plates visible at frame edge, chalk dust drifting. |
| 4 | Pull | Heavy bent-over barbell row at peak contraction, torso angled ~45 degrees forward, barbell pulled into the belly, elbows driven high and back, lats fanned wide. Side three-quarter angle. |
| 5 | Legs | Below-parallel back squat in a power rack, barbell across traps, plates compressing. |
| 6 | Upper | Seated overhead press lockout, dumbbells silhouetted against the rim light. |
| 7 | Lower | Romanian deadlift mid-descent, barbell tracking shins, hamstrings loaded. |
| 8 | Full Body | Clean and press catch position, barbell at shoulders, knees soft. |
| 9 | Cardio | Sprinter mid-stride on a dark treadmill belt, shoes blurred, sweat highlighted. |
| 10 | HIIT | Kettlebell swing at the top of the arc, frozen, sweat droplets visible. **Swap crimson rim for orange rim.** |

---

## 11. Onboarding Step 0 — Welcome (`page.tsx` ~line 2535)

**Current:** text-only welcome screen.
**Why:** Hooks the user before the 8-step questionnaire.
**Format:** 1024×1536 portrait.

```
Cinematic portrait, athlete from behind walking toward a single rack of barbells under one cone of warm overhead light in an otherwise pitch-black gym. Crimson floor reflection. No face visible. Heavy negative space top and bottom for headline and CTA. Photoreal, moody, gritty, no text, no logos. Tall portrait composition, 2:3 aspect ratio (1024x1536).
```

---

## 12–15. Onboarding goal cards — Step 3 (`page.tsx` ~lines 2583–2605)

**Current:** four text cards: Build Muscle / Get Stronger / Lose Fat / General Fitness.
**Why:** Consistent tactile icons make the choice fast.
**Format:** 512×512 square each, identical style across the four.

**Master prompt:**

```
Tactile icon illustration, dark charcoal background with subtle radial vignette, single crimson-tinted spotlight, semi-flat 3D rendered object with soft shadows and a hint of brushed metal texture. Centred, clean negative space, no text. Square 1:1 composition (1024x1024, can be downscaled to 512).

Object: <OBJECT_LINE>
```

| # | Goal | OBJECT_LINE |
|---|---|---|
| 12 | Build Muscle | A single chalked dumbbell with subtle muscle-fibre line texture etched into the handle. |
| 13 | Get Stronger | An over-loaded barbell bending slightly under thick competition plates. |
| 14 | Lose Fat | A stopwatch fused with a flame motif, crimson glow inside the dial. |
| 15 | General Fitness | A balanced kettlebell + skipping rope + apple arrangement, evenly lit. |

---

## 16. Onboarding Step 6 — Training Location (`page.tsx` ~line 2678)

**Current:** three radio buttons (Gym / Home / Both), text only.
**Why:** Helps users picture their setup.
**Format:** Three matching 512×512 tiles.

```
Set of three matching cinematic stills in identical dark moody style, crimson rim light, no people, photoreal, no text. Each tile is a square 1:1 composition (1024x1024), generate them one at a time and keep lighting and palette identical across all three:
1) Commercial gym corner — squat rack with loaded barbell, dumbbell row in soft focus background.
2) Home garage gym — single bench, a pair of adjustable dumbbells, concrete floor.
3) Split composition showing both side by side, faint vertical seam between them.
```

---

## 17. PB / Personal Best celebration overlay (`page.tsx` ~line 3174)

**Current:** trophy emoji + gold glow over a dark card.
**Why:** The biggest dopamine moment deserves a real visual.
**Format:** 1024×1024, transparent-friendly composition.

```
Hyper-detailed photoreal close-up of a single chalked hand slamming a barbell collar pin into place, crimson-and-gold sparks bursting outward against pure black background, sparks frozen mid-flight, faint smoke. Centred composition with strong radial symmetry for overlay use. No text, no logos. Square 1:1 composition (1024x1024). Pure black background only — no other scene elements — so it can be exported with the background masked out for an overlay.
```

---

## 18. "No workouts logged yet" empty state (`page.tsx:3881`)

**Current:** 13px grey text on black.
**Why:** Empty Progress tab is demotivating — turn it into a day-one call.
**Format:** 512×512 square.

```
Cinematic photograph on a SOLID DEEP MATTE BLACK BACKGROUND — black should fill 90% of the frame. A single empty olympic barbell (no plates loaded) rests on a dark concrete gym floor, lit by one narrow crimson spotlight from camera-left. The mood is quiet and still — NO dust plumes, NO sparks, NO smoke, NO explosions. Just the bar sitting there, waiting. Photoreal, moody, no people, no text, no logos. Centred composition. Square 1:1 (1024x1024).
```

---

## 19. "No PBs yet" / first Personal Best card

**Current:** blank list area.
**Why:** Frames the first PB as something to chase.
**Format:** 512×512 square.

```
Photoreal close-up of a brushed-steel trophy plate engraved with a placeholder dash "—", resting on a black gym floor, single crimson rim light from the right, faint chalk specks. Centred, no text. Square 1:1 composition (1024x1024).
```

---

## 20. "No messages yet" empty state (`page.tsx:4091`, also 4153)

**Current:** 13px grey text.
**Why:** Encourages users to connect with their trainer/clients.
**Format:** 512×512 square.

```
Minimal illustration on near-black background, two stylised speech-bubble shapes formed from chalked barbell collars, crimson inner glow, faintly overlapping. Flat icon-illustration style, clean lines, no text. Square 1:1 composition (1024x1024).
```

---

## 21. "No clients yet" — trainer view (`page.tsx` ~line 3482)

**Current:** "No accepted clients yet — send requests above" text.
**Why:** Coaches see this on day one; an aspirational visual softens the blank.
**Format:** 512×512 square.

```
Photoreal cinematic still: a trainer's hand (no face) extending a clipboard with a blank workout card toward the viewer, dark gym blurred behind, single crimson rim light. Centred, gritty, no text, no logos. Square 1:1 composition (1024x1024).
```

---

## 22. "No users found" — trainer search (`page.tsx:3474`)

**Current:** small grey text.
**Why:** Negative feedback moment — make the empty result encouraging.
**Format:** 384×384 square.

```
Minimal flat illustration on charcoal background, a chalked magnifying glass over an empty open notebook page with a faint dumbbell watermark, crimson handle accent. Centred, no text. Square 1:1 composition (1024x1024, can be downscaled to 384).
```

---

## 23. "No profile set up yet" — Settings & client profile (`page.tsx:3982` and 4441)

**Current:** grey text.
**Why:** A subtle silhouette guides users into the EDIT flow.
**Format:** 512×512 square.

```
Minimal anatomical silhouette of a generic athletic figure facing forward, rendered as a faint crimson outline on pure black, with small empty placeholder dots at chest, waist, thigh measurement points. Clean diagram look, no text, no labels. Square 1:1 composition (1024x1024).
```

---

## 24. Form demo fallback — "No form demo available" (`page.tsx:3084` and 5570)

**Current:** grey rounded box with placeholder text — currently the weakest fallback in the app.
**Why:** A generic "form fundamentals" tile beats blank.
**Format:** 1024×1280 (4:5 portrait).

```
Photoreal silhouette of a generic athlete in a neutral standing setup position, side profile, crimson outline highlighting the spine, hips, and knees as alignment cues. Pure black background, three faint horizontal guide lines at hip, knee, and ankle. No face, no text, no logos. Tall portrait composition, 2:3 aspect ratio (1024x1536).
```

---

## 25. Anatomy thumbnails for the FORM modal (6 images)

**Current:** in-app SVG body diagram exists; no contextual hero above it.
**Why:** Small thumbnail reinforces "you're hitting THIS area".
**Format:** 512×512 square each, generate six.

**Master prompt:**

```
Photoreal anatomical close-up: lit musculature on pure black background, single crimson rim light highlighting the muscle group in focus, the rest of the body dissolves into shadow. Consistent style across the set, no face, no skin blemishes, no text, no labels. Square 1:1 composition (1024x1024).

Muscle group: <chest | upper back / lats | shoulders / deltoids | arms / biceps + triceps | legs (see special leg prompt below — content filters reject thigh framing) | core / abs>

**Note on the Legs entry:** ChatGPT's content filter rejects close-up upper-thigh framing even when the intent is clearly anatomical. Use this clothed-knee-down prompt instead:

```
Photoreal anatomical close-up on a SOLID DEEP MATTE BLACK BACKGROUND. Cinematic studio lighting with a single crimson rim light from camera-right highlighting an athlete's lower body — wearing dark athletic shorts that end above the knee. Quad sweep visible just below the hem of the shorts (vastus lateralis and the VMO teardrop above the knee), calf head defined further down. Framing from the bottom of the shorts down to mid-shin, three-quarter angle. Everything outside the lit muscle dissolves into deep shadow. No skin blemishes. Sweat highlights catch the rim light subtly. No text, no labels, no logos. Square 1:1 (1024x1024).
```
```

---

## 26. Settings profile avatar default

**Current:** no avatar — just text username + role badge.
**Why:** Default monogram tile gives identity without requiring uploads.
**Format:** 256×256 square.

```
Flat icon, black background with subtle radial gradient, a single bold crimson dumbbell silhouette centred, soft inner glow, ready to be tinted or overlaid with initials. Clean, no text. Square 1:1 composition (1024x1024, downscale to 256).
```

---

## 27. promo.html landing hero (`public/promo.html`)

**Current:** gradient hero, text only.
**Why:** Highest-leverage marketing image in the whole product.
**Format:** 1792×1024 (16:9 landscape).

```
Premium product marketing photograph, dark moody gym shot from low angle, a single athlete (back to camera, no face) chalking hands above a loaded barbell, a phone resting on a bench in the foreground showing a faint glowing red app interface (blurred, no readable text). Cinematic crimson rim light, tungsten warmth on the bench, deep black background. Heavy negative space upper-right for headline. Photoreal, no logos, no readable text. Wide landscape composition, 3:2 aspect ratio (1536x1024).
```

---

## 28. trainer.html landing hero (`public/trainer.html`)

**Current:** text-only trainer recruitment page.
**Why:** Needs to telegraph "professional tool, not toy."
**Format:** 1792×1024 (16:9 landscape).

```
Cinematic photograph of a coach (no face, mid-torso only) holding a phone displaying a stylised client list interface — the interface itself just abstract crimson and white bars, no readable names or text — with a client lifting in the soft-focus background. Dark gym, crimson rim light, premium look. Heavy negative space top-left for headline. Photoreal, no logos, no readable text. Wide landscape composition, 3:2 aspect ratio (1536x1024).
```

---

## 29. client.html landing hero (`public/client.html`)

**Current:** text-only.
**Why:** Parity with promo/trainer hero.
**Format:** 1792×1024 (16:9 landscape).

```
Cinematic photograph, athlete mid-set of a barbell row, chalked hands, lats flared, shot from a low three-quarter angle. Pure black background, crimson rim light from behind, single warm tungsten key from camera-left. Mid-torso framing only, no face. Heavy negative space lower-right for headline. Photoreal, gritty, no logos, no text. Wide landscape composition, 3:2 aspect ratio (1536x1024).
```

---

## 30. Workout-complete celebration backdrop

**Current:** SVG expanding rings + checkmark animation.
**Why:** A faint background still elevates the animation without competing with it.
**Format:** 1024×1024 low-detail backdrop.

```
Minimal, semi-blurred photo backdrop: chalk dust drifting in front of a black wall lit by a single distant crimson spotlight, very low contrast and detail so SVG animations can overlay cleanly. Photoreal, soft, no people, no text. Square 1:1 composition (1024x1024).
```

---

## 31. ROADMAP / "what's next" banner

**Current:** plain markdown in `ROADMAP.md`.
**Why:** If surfaced in-app, a single banner sells the trajectory.
**Format:** 1792×1024 (16:9 landscape).

```
Cinematic photograph, a single staircase of stacked weight plates ascending from foreground (small plates) to background (large plates), each plate edge-lit with crimson rim light against pure black. Symbolic progression. Photoreal, no people, no text. Wide landscape composition, 3:2 aspect ratio (1536x1024).
```

---

## Highest-ROI first six (if you only generate a handful)

1. #1 login backdrop
2. #2 home hero strip
3. #3–10 the eight workout-type cards (one batch — same master prompt)
4. #17 PB celebration
5. #24 form-demo fallback
6. #27 promo.html hero

## Recommended file placement

Save generated images under `/public/ai/` with these filenames:

```
public/ai/
  login-bg.jpg                  # #1
  home-hero.jpg                 # #2
  workout-push.jpg              # #3
  workout-pull.jpg              # #4
  workout-legs.jpg              # #5
  workout-upper.jpg             # #6
  workout-lower.jpg             # #7
  workout-fullbody.jpg          # #8
  workout-cardio.jpg            # #9
  workout-hiit.jpg              # #10
  onboarding-welcome.jpg        # #11
  goal-muscle.jpg               # #12
  goal-stronger.jpg             # #13
  goal-fat.jpg                  # #14
  goal-fitness.jpg              # #15
  location-gym.jpg              # #16a
  location-home.jpg             # #16b
  location-both.jpg             # #16c
  pb-celebration.png            # #17 (PNG for transparency)
  empty-workouts.jpg            # #18
  empty-pbs.jpg                 # #19
  empty-messages.jpg            # #20
  empty-clients.jpg             # #21
  empty-search.jpg              # #22
  empty-profile.jpg             # #23
  form-fallback.jpg             # #24
  anatomy-chest.jpg             # #25a
  anatomy-back.jpg              # #25b
  anatomy-shoulders.jpg         # #25c
  anatomy-arms.jpg              # #25d
  anatomy-legs.jpg              # #25e
  anatomy-core.jpg              # #25f
  avatar-default.png            # #26 (PNG)
  promo-hero.jpg                # #27
  trainer-hero.jpg              # #28
  client-hero.jpg               # #29
  complete-bg.jpg               # #30
  roadmap-banner.jpg            # #31
```

Compress JPGs to <100KB for mobile. Use WebP if your hosting supports it.
