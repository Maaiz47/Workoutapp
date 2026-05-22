# IronLog avatar art — ChatGPT image-gen prompts

Each avatar is a 512×512 PNG dropped into `/public/avatars/<id>.png`.
The file id under each prompt is the EXACT filename to save it as.

## Style guide (paste into every prompt as a prefix)

> Generate a 512×512 PNG profile avatar. Style: **dark-mode app icon**,
> centred subject on a deep matte background (no white), **subtle gradient halo**
> matching the avatar's theme colour, soft rim-light, premium gym-app
> aesthetic — feels at home next to Apple Fitness / Strava cards. The
> subject is a stylised emblem/illustration (NO human faces, NO text,
> NO logos, NO watermarks). Slight grain ok. **Symmetric, centred,
> works as a small circular crop**. Output: PNG, transparent or
> matching dark background — caller will overlay it on the user's
> chosen tier border colour.

---

## Tier 1 — Kitten / Bronze (starting pack, friendly)

### 1. `starter-spark.png`
A small bronze ember glowing on a dark slate background. Tiny rising
sparks. Halo colour: warm bronze (#a8784a). Feels like a flame just
sparking to life.

### 2. `starter-dawn.png`
A thin horizon line at sunrise — deep navy below, pale apricot above,
a single small sun emerging. Halo: pale apricot (#fcd7a3). Quiet,
patient. No mountains, just the line.

### 3. `starter-seedling.png`
A small green sprout pushing out of a dark cracked surface, two
leaves curling outward. Halo: emerald (#34d399). Feels alive but
fragile.

---

## Tier 2 — Fox / Silver (sharpening, quick)

### 4. `fox-sprint.png`
A geometric fox silhouette in mid-stride, silver-orange gradient body,
trailing motion lines behind it. Halo: orange-silver
(#fb923c → #cbd5e1).

### 5. `fox-emberbolt.png`
A lightning-bolt-shaped fox tail glowing amber over a dark obsidian
background. Just the bolt-tail, no full fox. Halo: amber (#f59e0b).

### 6. `fox-stride.png`
A pair of sleek paw prints in silver, ascending diagonally on a dark
gradient. Halo: cool silver (#cbd5e1).

---

## Tier 3 — Big Dawg / Gold (formidable, earned)

### 7. `dawg-howler.png`
A bold geometric wolf head silhouette, head tilted up mid-howl, gold
trim around the mane. Halo: gold (#facc15). No teeth visible — just
the strong shape.

### 8. `dawg-ironpaw.png`
A single large dog paw print embossed in gold-iron, with riveted
metal texture. Halo: bronzed gold (#facc15 → #92400e).

### 9. `dawg-watcher.png`
A pair of glowing gold eyes peering through dark fur — only eyes
and a faint outline of the head visible. Halo: deep gold (#eab308).

---

## Tier 4 — Lion / Platinum (commanding, regal)

### 10. `lion-crown.png`
A stylised lion's mane forming a crown silhouette, platinum-blue
gradient. Halo: icy platinum (#7dd3fc). No facial features — just
the crown-mane.

### 11. `lion-mane.png`
A full lion mane viewed from the back, swept dramatically to one side,
platinum-orange highlights. Halo: orange (#f97316).

### 12. `lion-thunder.png`
A lion silhouette with thunder bolts radiating from its head, platinum
and bright cyan. Halo: bright cyan (#22d3ee). Bold and loud.

---

## Tier 5 — Gorilla / Diamond (towering, immovable)

### 13. `gorilla-titan.png`
A massive geometric gorilla chest/shoulder silhouette, viewed from
below, chiselled diamond facets layered over it. Halo: ice diamond
(#60a5fa).

### 14. `gorilla-stoneheart.png`
A gorilla fist clenched holding a glowing blue diamond at its centre.
Halo: deep diamond blue (#3b82f6).

### 15. `gorilla-vanguard.png`
A gorilla silhouette in profile, standing tall, with a flag-pole
held over one shoulder — the flag is a clean diamond shape. Halo:
icy blue (#60a5fa).

---

## Tier 6 — Bear / Master (apex, mythic-leaning)

### 16. `bear-warden.png`
A standing bear silhouette in front of a circular crest, holding a
heavy iron-chain crown floating above its head. Halo: deep crimson
gold (#92400e → #f0c040).

### 17. `bear-ursanova.png`
A bear constellation glowing on a deep midnight sky — Ursa Major
shape, gold star clusters. Halo: cosmic gold (#facc15).

### 18. `bear-eternal.png`
A bear silhouette climbing an infinite staircase that loops back
into itself (Penrose stairs), gold lines. Halo: warm gold (#f0c040).

### 19. `bear-monolith.png`
A massive monolithic black stone slab with a bear paw print burned
into its centre, glowing gold. Halo: gold-on-black (#f0c040).

### 20. `bear-pinnacle.png`
A bear silhouette standing at the peak of a single sharp mountain,
stars above, gold horizon. Halo: peak gold (#facc15).

---

## Lucky-drop pool (rare → mythic)

These are the random rewards. Rarer = more dramatic art.

### 21. `lucky-clover.png` (common rare)
A four-leaf clover formed of green ribbons, each leaf catching light.
Halo: clover green (#22c55e). Slight sparkle.

### 22. `lucky-shooting-star.png`
A single bright streak across a dark sky, leaving a trailing arc of
embers. Halo: hot white (#ffffff → #fde68a).

### 23. `lucky-prism.png`
A floating glass triangular prism refracting a rainbow beam through
its centre. Halo: full-spectrum (multi-colour gradient).

### 24. `lucky-firefly.png`
A swarm of fireflies forming a glowing orb in dark woods, dotted
warm yellow points of light. Halo: firefly yellow (#fef08a).

### 25. `lucky-glacier.png`
A floating chunk of crystal-blue glacier ice, fractured planes
catching cold light. Halo: arctic blue (#7dd3fc).

### 26. `lucky-aurora.png` (rare)
Curtains of green-pink aurora dancing over a dark mountain ridge,
no foreground subject — just the lights. Halo: aurora green-pink
(#34d399 → #f0abfc).

### 27. `lucky-phoenix.png` (rare)
A phoenix mid-rebirth — orange/red flame wings unfurling from a
glowing core, ember particles. Halo: phoenix red (#ef4444 →
#fb923c).

### 28. `lucky-eclipse.png` (very rare)
A solar eclipse — black disc with a brilliant corona of golden fire.
Halo: corona gold (#f59e0b).

### 29. `lucky-cosmic.png` (very rare)
A floating astronaut helmet reflecting a galaxy, deep purple-blue
nebula visible inside the visor. Halo: nebula purple (#a855f7).

### 30. `lucky-mythic.png` (mythic — almost no one gets this)
A glowing dragon's eye filling the entire frame, vertical slit pupil,
swirling iridescent iris (gold→teal→violet). Halo: iridescent
multi-colour. Should feel like discovering a secret.

---

## After generating

1. Save each as `/public/avatars/<id>.png`.
2. Verify all 30 files exist.
3. No CLAUDE.md edit needed — the catalogue is in `lib/avatars.ts`
   and reads files by id at request time.
4. If you generate FEWER than 30 to start, the picker will just show
   a placeholder square for the missing ones — no crash, no
   functionality loss.
