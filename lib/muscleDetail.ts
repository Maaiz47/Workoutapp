// Per-exercise sub-muscle targeting for the body diagram.
// Each entry maps an exercise ID to specific sub-regions of a muscle group.
//
// SUB-MUSCLE KEYS:
//   chest:      chest-upper (clavicular), chest-mid (sternocostal upper),
//               chest-lower (sternocostal lower), chest-inner (medial/sternal)
//   shoulders:  shoulders-front (anterior delt), shoulders-side (lateral delt),
//               shoulders-rear (posterior delt)
//   back:       back-traps-upper (upper trapezius), back-traps-mid (mid traps + rhomboids),
//               back-lats (latissimus dorsi), back-lower (erector spinae / lower back),
//               back-teres (teres major, upper outer back)
//   biceps:     biceps-long (outer / long head, peak), biceps-short (inner / short head),
//               brachialis (deep, lower upper arm — neutral grip / hammers)
//   triceps:    triceps-long (medial/inner long head, stretched overhead),
//               triceps-lateral (outer head), triceps-medial (deep medial head)
//   quads:      quads-outer (vastus lateralis), quads-rectus (rectus femoris center),
//               quads-inner (vastus medialis / teardrop)
//   hamstrings: hamstrings-outer (biceps femoris), hamstrings-inner (semi-t/semi-m)
//   glutes:     glutes-max (gluteus maximus, main bulk), glutes-med (gluteus medius/min, hip abduction)
//   calves:     calves-gastroc (gastrocnemius, straight-leg), calves-soleus (bent-knee)
//   core:       core-abs-upper, core-abs-lower, core-obliques, core-serratus
//   forearms:   forearm-flexor, forearm-extensor
//
// Resolution: if any sub-muscle of a parent (e.g. "chest-upper") appears in p/s,
// only those sub-zones glow. If only the parent ("chest") appears, all sub-zones glow.

export const MUSCLE_DETAIL: Record<string, { p: string[]; s: string[] }> = {

  // ── CHEST ──────────────────────────────────────────────────────────────
  "barbell-bench-press":         { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps-lateral", "triceps-medial"] },
  "dumbbell-bench-press":        { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps-lateral", "triceps-medial"] },
  "chest-press-machine":         { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps-lateral", "triceps-medial"] },
  "resistance-band-chest-press": { p: ["chest-mid"],                s: ["shoulders-front", "triceps-lateral"] },

  // Incline press — clavicular head emphasis (30–45° bench)
  "incline-barbell-press":  { p: ["chest-upper"], s: ["shoulders-front", "triceps-lateral"] },
  "incline-dumbbell-press": { p: ["chest-upper"], s: ["shoulders-front", "triceps-lateral"] },
  "decline-pushups":        { p: ["chest-upper"], s: ["shoulders-front", "triceps-lateral"] },
  "pike-pushup":            { p: ["shoulders-front", "shoulders-side"], s: ["triceps-lateral", "core-abs-upper"] },

  // Decline / dips — lower costal fibres
  "decline-barbell-press": { p: ["chest-lower"],  s: ["triceps-lateral"] },
  "chest-dips":            { p: ["chest-lower"],  s: ["triceps-lateral", "shoulders-front"] },

  // Flyes / crossovers — adduction, inner fibres
  "dumbbell-flyes":         { p: ["chest-mid", "chest-inner"],   s: ["shoulders-front"] },
  "incline-dumbbell-flyes": { p: ["chest-upper", "chest-inner"], s: ["shoulders-front"] },
  "cable-crossover":        { p: ["chest-inner", "chest-lower"], s: ["shoulders-front"] },
  "pec-deck":               { p: ["chest-mid", "chest-inner"],   s: [] },

  // Pushup variations
  "pushups":      { p: ["chest-mid"],                s: ["chest-lower", "shoulders-front", "triceps-lateral", "core-abs-upper"] },
  "wide-pushups": { p: ["chest-mid", "chest-inner"], s: ["shoulders-front", "triceps-lateral"] },

  // Tricep-dominant chest assists
  "close-grip-bench": { p: ["triceps-lateral", "triceps-medial"], s: ["chest-inner", "chest-mid", "shoulders-front"] },
  "diamond-pushups":  { p: ["triceps-lateral", "triceps-medial"], s: ["chest-inner", "shoulders-front"] },

  // ── SHOULDERS ──────────────────────────────────────────────────────────
  "overhead-press":                 { p: ["shoulders-front", "shoulders-side"], s: ["triceps-long", "triceps-lateral", "back-traps-upper", "core-abs-upper"] },
  "dumbbell-shoulder-press":        { p: ["shoulders-front", "shoulders-side"], s: ["triceps-long", "triceps-lateral", "back-traps-upper"] },
  "machine-shoulder-press":         { p: ["shoulders-front"],                   s: ["shoulders-side", "triceps-lateral"] },
  "arnold-press":                   { p: ["shoulders-front", "shoulders-side"], s: ["shoulders-rear", "triceps-lateral"] },
  "resistance-band-shoulder-press": { p: ["shoulders-front", "shoulders-side"], s: ["triceps-lateral"] },

  // Lateral isolation — medial delt only
  "lateral-raise":                 { p: ["shoulders-side"], s: [] },
  "cable-lateral-raise":           { p: ["shoulders-side"], s: [] },
  "resistance-band-lateral-raise": { p: ["shoulders-side"], s: [] },

  // Upright row — side delt + upper traps
  "upright-row":   { p: ["shoulders-side", "back-traps-upper"], s: ["biceps-short", "forearm-flexor"] },

  // Front raise — anterior isolation
  "front-raise":   { p: ["shoulders-front"], s: ["chest-upper"] },

  // Rear delt / external rotation
  "rear-delt-fly":              { p: ["shoulders-rear"], s: ["back-traps-mid"] },
  "face-pull":                  { p: ["shoulders-rear", "back-traps-mid"], s: ["biceps-short"] },
  "shoulder-external-rotation": { p: ["shoulders-rear"], s: [] },
  "wall-slide":                 { p: ["back-traps-mid", "shoulders-rear"], s: [] },

  // ── BACK ───────────────────────────────────────────────────────────────
  // Vertical pulls — lats dominant
  "pullups":                  { p: ["back-lats", "back-teres"], s: ["biceps-long", "back-traps-mid", "forearm-flexor"] },
  "chinups":                  { p: ["back-lats"], s: ["biceps-short", "biceps-long", "back-traps-mid"] },
  "lat-pulldown":             { p: ["back-lats"], s: ["biceps-long", "back-traps-mid"] },
  "wide-grip-lat-pulldown":   { p: ["back-lats", "back-teres"], s: ["biceps-long"] },
  "resistance-band-pulldown": { p: ["back-lats"], s: ["biceps-long"] },
  "straight-arm-pulldown":    { p: ["back-lats"], s: ["triceps-long"] },

  // Horizontal rows — mid back + lats
  "barbell-row":             { p: ["back-lats", "back-traps-mid"], s: ["shoulders-rear", "biceps-long", "forearm-flexor"] },
  "t-bar-row":               { p: ["back-lats", "back-traps-mid"], s: ["biceps-long"] },
  "seated-cable-row":        { p: ["back-traps-mid", "back-lats"], s: ["biceps-long", "shoulders-rear"] },
  "single-arm-dumbbell-row": { p: ["back-lats", "back-traps-mid"], s: ["biceps-long"] },
  "inverted-row":            { p: ["back-traps-mid", "back-lats"], s: ["biceps-short", "core-abs-upper"] },
  "resistance-band-row":     { p: ["back-traps-mid", "back-lats"], s: ["biceps-long"] },

  // Shrugs — upper traps only
  "barbell-shrugs":  { p: ["back-traps-upper"], s: ["forearm-flexor"] },
  "dumbbell-shrugs": { p: ["back-traps-upper"], s: ["forearm-flexor"] },

  // Lower back & posterior chain
  "hyperextension": { p: ["back-lower"], s: ["glutes-max", "hamstrings-outer", "hamstrings-inner"] },
  "superman":       { p: ["back-lower"], s: ["glutes-max", "shoulders-rear"] },
  "good-morning":   { p: ["hamstrings-outer", "hamstrings-inner", "back-lower"], s: ["glutes-max"] },

  // ── BICEPS ─────────────────────────────────────────────────────────────
  "barbell-curl":         { p: ["biceps-long", "biceps-short"], s: ["forearm-flexor"] },
  "dumbbell-curl":        { p: ["biceps-long", "biceps-short"], s: ["forearm-flexor"] },
  "cable-curl":           { p: ["biceps-long", "biceps-short"], s: ["forearm-flexor"] },
  "resistance-band-curl": { p: ["biceps-long", "biceps-short"], s: ["forearm-flexor"] },

  // Elbow-forward variants — short head emphasis (no long-head stretch)
  "concentration-curl": { p: ["biceps-short"], s: ["brachialis", "forearm-flexor"] },
  "preacher-curl":      { p: ["biceps-short"], s: ["brachialis", "forearm-flexor"] },
  "ez-bar-curl":        { p: ["biceps-short", "biceps-long"], s: ["forearm-flexor"] },

  // Elbow-behind variants — long head stretched
  "incline-dumbbell-curl": { p: ["biceps-long"], s: ["forearm-flexor"] },

  // Neutral grip — brachialis + outer head
  "hammer-curl": { p: ["brachialis", "biceps-long"], s: ["forearm-extensor", "forearm-flexor"] },

  // ── TRICEPS ────────────────────────────────────────────────────────────
  // Overhead / behind-the-head — long head stretched
  "overhead-tricep-extension": { p: ["triceps-long"], s: ["triceps-lateral"] },
  "skull-crushers":            { p: ["triceps-long", "triceps-lateral"], s: ["triceps-medial"] },

  // Arm-at-side — lateral & medial dominant
  "tricep-pushdown":          { p: ["triceps-lateral", "triceps-medial"], s: [] },
  "resistance-band-pushdown": { p: ["triceps-lateral", "triceps-medial"], s: [] },
  "tricep-kickback":          { p: ["triceps-lateral"], s: ["triceps-medial", "shoulders-rear"] },

  // Dips — long + lateral
  "tricep-dips": { p: ["triceps-lateral", "triceps-long"], s: ["chest-lower", "shoulders-front"] },
  "bench-dips":  { p: ["triceps-lateral", "triceps-long"], s: ["shoulders-front"] },

  // ── QUADS ──────────────────────────────────────────────────────────────
  "barbell-squat":           { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max", "back-lower", "core-abs-upper", "hamstrings-outer"] },
  "front-squat":             { p: ["quads-rectus", "quads-inner", "quads-outer"], s: ["glutes-max", "core-abs-upper", "back-lower"] },
  "bodyweight-squat":        { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max"] },
  "goblet-squat":            { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max", "core-abs-upper"] },
  "jump-squat":              { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max", "calves-gastroc"] },
  "box-jumps":               { p: ["quads-outer", "quads-rectus"],                s: ["glutes-max", "calves-gastroc", "hamstrings-outer"] },
  "sumo-squat":              { p: ["quads-inner", "glutes-max"], s: ["quads-rectus", "hamstrings-inner"] },
  "bulgarian-split-squat":   { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max", "hamstrings-outer"] },
  "lunges":                  { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max", "hamstrings-outer"] },
  "step-ups":                { p: ["quads-outer", "quads-rectus"], s: ["glutes-max", "hamstrings-outer", "calves-gastroc"] },
  "leg-press":               { p: ["quads-outer", "quads-rectus"], s: ["glutes-max", "hamstrings-outer"] },
  "hack-squat":              { p: ["quads-outer", "quads-rectus"], s: ["glutes-max"] },
  "leg-extension":           { p: ["quads-rectus", "quads-outer"], s: ["quads-inner"] },
  "terminal-knee-extension": { p: ["quads-inner"], s: ["quads-rectus"] },
  "wall-sit":                { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max"] },
  "resistance-band-squat":   { p: ["quads-outer", "quads-rectus", "quads-inner"], s: ["glutes-max"] },

  // ── HAMSTRINGS & DEADLIFTS ─────────────────────────────────────────────
  "romanian-deadlift":    { p: ["hamstrings-outer", "hamstrings-inner", "glutes-max"], s: ["back-lower", "forearm-flexor"] },
  "romanian-deadlift-db": { p: ["hamstrings-outer", "hamstrings-inner", "glutes-max"], s: ["back-lower"] },
  "leg-curl":             { p: ["hamstrings-outer", "hamstrings-inner"], s: ["calves-gastroc"] },
  "nordic-curl":          { p: ["hamstrings-outer", "hamstrings-inner"], s: ["glutes-max", "core-abs-lower"] },

  "barbell-deadlift": { p: ["back-lower", "glutes-max", "hamstrings-outer", "hamstrings-inner"], s: ["back-lats", "back-traps-upper", "quads-outer", "forearm-flexor"] },
  "sumo-deadlift":    { p: ["glutes-max", "quads-inner", "hamstrings-inner"], s: ["back-lower", "back-traps-upper", "forearm-flexor"] },

  // ── GLUTES ─────────────────────────────────────────────────────────────
  "hip-thrust-barbell":            { p: ["glutes-max"], s: ["hamstrings-outer", "quads-rectus"] },
  "hip-thrust-db":                 { p: ["glutes-max"], s: ["hamstrings-outer"] },
  "glute-bridge":                  { p: ["glutes-max"], s: ["hamstrings-outer", "core-abs-lower"] },
  "glute-kickback":                { p: ["glutes-max"], s: ["hamstrings-outer"] },
  "donkey-kick":                   { p: ["glutes-max"], s: ["hamstrings-outer"] },
  "clamshell":                     { p: ["glutes-med"], s: [] },
  "resistance-band-hip-abduction": { p: ["glutes-med"], s: ["glutes-max"] },

  // ── CALVES ─────────────────────────────────────────────────────────────
  "standing-calf-raise": { p: ["calves-gastroc"], s: ["calves-soleus"] },
  "dumbbell-calf-raise": { p: ["calves-gastroc"], s: ["calves-soleus"] },
  "seated-calf-raise":   { p: ["calves-soleus"], s: ["calves-gastroc"] },

  // ── CORE ───────────────────────────────────────────────────────────────
  "crunches":           { p: ["core-abs-upper"], s: [] },
  "cable-crunch":       { p: ["core-abs-upper"], s: ["core-obliques"] },
  "bicycle-crunch":     { p: ["core-abs-upper", "core-obliques"], s: ["core-abs-lower"] },
  "v-ups":              { p: ["core-abs-upper", "core-abs-lower"], s: [] },
  "toe-touches":        { p: ["core-abs-upper"], s: ["core-abs-lower"] },
  "hanging-leg-raise":  { p: ["core-abs-lower"], s: ["core-obliques", "forearm-flexor"] },
  "leg-raises":         { p: ["core-abs-lower"], s: ["core-obliques"] },
  "straight-leg-raise": { p: ["core-abs-lower"], s: ["quads-rectus"] },
  "mountain-climbers":  { p: ["core-abs-lower"], s: ["shoulders-front", "core-abs-upper"] },
  "ab-rollout":         { p: ["core-abs-upper", "core-abs-lower"], s: ["core-obliques", "back-lats", "shoulders-front"] },
  "plank":              { p: ["core-abs-upper", "core-abs-lower"], s: ["core-obliques", "shoulders-front"] },
  "side-plank":         { p: ["core-obliques"], s: ["shoulders-side", "glutes-med"] },
  "russian-twist":      { p: ["core-obliques"], s: ["core-abs-upper"] },
  "dead-bug":           { p: ["core-abs-lower"], s: ["core-abs-upper"] },
  "bird-dog":           { p: ["back-lower", "core-abs-upper"], s: ["glutes-max"] },
};

// Normalized name → MUSCLE_DETAIL key aliases for exercises whose display names
// don't match any EXERCISES library ID (e.g. workout-plan exercises).
const NAME_ALIASES: Record<string, string> = {
  // Cable
  "cableflyeslowtohigh":        "cable-crossover",
  "cableflyeshightolw":         "cable-crossover",
  "cableflyeshightolow":        "cable-crossover",
  "cableflyes":                 "cable-crossover",
  "cablecurlrope":              "cable-curl",
  "cablecurlwrope":             "cable-curl",
  // Triceps
  "tricepropepushdowns":        "tricep-pushdown",
  "tricepropepushdown":         "tricep-pushdown",
  "tricepdipsorchine":          "tricep-dips",
  "tricepdipsmachine":          "tricep-dips",
  "overheadtricepextension":    "overhead-tricep-extension",
  "overheadtricepdumbbellext":  "overhead-tricep-extension",
  // Back
  "barbellbentoverrow":         "barbell-row",
  "barbellbentrow":             "barbell-row",
  "bentoverrow":                "barbell-row",
  "tbarrowchestsupportedrow":   "t-bar-row",
  "chestsupportedrow":          "t-bar-row",
  "latpulldownwide":            "wide-grip-lat-pulldown",
  "widegriplatpulldown":        "wide-grip-lat-pulldown",
  "seatedcablerowclose":        "seated-cable-row",
  "straightarmpulldown":        "straight-arm-pulldown",
  // Squats & legs
  "barbellbacksquat":           "barbell-squat",
  "backsquat":                  "barbell-squat",
  "legcurlmachine":             "leg-curl",
  "seatedlegcurl":              "leg-curl",
  "lyinglegcurl":               "leg-curl",
  "standingcalfraises":         "standing-calf-raise",
  "standingcalfraising":        "standing-calf-raise",
  // Press
  "inclinebarbellbenchpress":   "incline-barbell-press",
  "flatbarbellbenchpress":      "barbell-bench-press",
  "flatdumbbellpress":          "dumbbell-bench-press",
  "pecdeckmachinefly":          "pec-deck",
  "pecdeckmachineflyes":        "pec-deck",
  "pecdeck":                    "pec-deck",
  "machinefly":                 "pec-deck",
  "closegripbenchpress":        "close-grip-bench",
  // Curls
  "inclinedbcurl":              "incline-dumbbell-curl",
  "ezbarcurl":                  "ez-bar-curl",
  // Pulls
  "pullupsassistedpullups":     "pullups",
  "assistedpullups":            "pullups",
  // Misc
  "hanginglegraises":           "hanging-leg-raise",
  "facepulls":                  "face-pull",
  "hammercurls":                "hammer-curl",
  "lateralraises":              "lateral-raise",
  "bulgariansplitsquat":        "bulgarian-split-squat",
  "legpress":                   "leg-press",
  "romaniandeadlift":           "romanian-deadlift",
  "barbellcurl":                "barbell-curl",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve sub-muscle detail by exercise ID first, then by exercise name.
 * Handles workout-plan exercises whose IDs ("a3", "b4"…) don't exist in MUSCLE_DETAIL.
 */
export function lookupMuscleDetail(
  exerciseId?: string,
  exerciseName?: string
): { p: string[]; s: string[] } | null {
  if (exerciseId && MUSCLE_DETAIL[exerciseId]) return MUSCLE_DETAIL[exerciseId];

  if (!exerciseName) return null;
  const key = norm(exerciseName);

  // Explicit alias first
  const aliasId = NAME_ALIASES[key];
  if (aliasId && MUSCLE_DETAIL[aliasId]) return MUSCLE_DETAIL[aliasId];

  // Auto-resolve: normalized MUSCLE_DETAIL key matches or is substring of name
  for (const [id, data] of Object.entries(MUSCLE_DETAIL)) {
    const idKey = norm(id);
    if (key === idKey || key.includes(idKey) || idKey.includes(key)) return data;
  }

  return null;
}
