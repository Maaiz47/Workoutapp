// Maps exercise IDs to precise sub-muscle targeting for the body diagram.
// When an exercise is in this map, the diagram shows specific muscle regions
// (e.g. upper vs lower pec, anterior vs lateral vs rear delt) instead of the whole group.

export const MUSCLE_DETAIL: Record<string, { p: string[]; s: string[] }> = {
  // ── CHEST ──────────────────────────────────────────────────────────────
  // Flat press — mid + lower sternal fibres, anterior delt assists
  "barbell-bench-press":          { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps"] },
  "dumbbell-bench-press":         { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps"] },
  "chest-press-machine":          { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps"] },
  "resistance-band-chest-press":  { p: ["chest-mid", "chest-lower"], s: ["shoulders-front", "triceps"] },

  // Incline press — clavicular (upper) head emphasis
  "incline-barbell-press":   { p: ["chest-upper"], s: ["shoulders-front", "triceps"] },
  "incline-dumbbell-press":  { p: ["chest-upper"], s: ["shoulders-front", "triceps"] },
  "decline-pushups":         { p: ["chest-upper"], s: ["shoulders-front", "triceps"] },

  // Decline press / dips — lower costal fibres
  "decline-barbell-press": { p: ["chest-lower"], s: ["triceps"] },
  "chest-dips":            { p: ["chest-lower"], s: ["triceps", "shoulders-front"] },

  // Flyes — inner / medial fibres (stretch + squeeze range)
  "dumbbell-flyes":         { p: ["chest-inner", "chest-mid"], s: ["shoulders-front"] },
  "incline-dumbbell-flyes": { p: ["chest-upper", "chest-inner"], s: ["shoulders-front"] },
  "cable-crossover":        { p: ["chest-inner", "chest-lower"], s: [] },
  "pec-deck":               { p: ["chest-inner", "chest-mid"],   s: [] },

  // General push — broad activation
  "pushups":       { p: ["chest-mid"],          s: ["chest-lower", "shoulders-front", "triceps"] },
  "wide-pushups":  { p: ["chest-inner", "chest-mid"], s: ["shoulders-front", "triceps"] },

  // Tricep-dominant with chest assist
  "close-grip-bench": { p: ["triceps"], s: ["chest-inner", "chest-mid"] },
  "diamond-pushups":  { p: ["triceps"], s: ["chest-inner"] },
  "tricep-dips":      { p: ["triceps"], s: ["chest-lower", "shoulders-front"] },
  "bench-dips":       { p: ["triceps"], s: ["shoulders-front"] },

  // ── SHOULDERS ──────────────────────────────────────────────────────────
  // Overhead press — anterior + lateral together
  "overhead-press":              { p: ["shoulders-front", "shoulders-side"], s: ["triceps", "core"] },
  "dumbbell-shoulder-press":     { p: ["shoulders-front", "shoulders-side"], s: ["triceps"] },
  "machine-shoulder-press":      { p: ["shoulders-front", "shoulders-side"], s: ["triceps"] },
  "arnold-press":                { p: ["shoulders-front", "shoulders-side"], s: ["triceps"] },
  "pike-pushup":                 { p: ["shoulders-front", "shoulders-side"], s: ["triceps"] },
  "resistance-band-shoulder-press": { p: ["shoulders-front", "shoulders-side"], s: ["triceps"] },

  // Lateral raise — medial/lateral delt isolation
  "lateral-raise":               { p: ["shoulders-side"], s: [] },
  "cable-lateral-raise":         { p: ["shoulders-side"], s: [] },
  "resistance-band-lateral-raise":{ p: ["shoulders-side"], s: [] },
  "upright-row":                 { p: ["shoulders-side"], s: ["back", "biceps"] },

  // Front raise — anterior delt isolation
  "front-raise": { p: ["shoulders-front"], s: [] },

  // Rear delt — posterior head
  "rear-delt-fly":             { p: ["shoulders-rear"], s: ["back"] },
  "face-pull":                 { p: ["shoulders-rear"], s: ["back", "biceps"] },
  "shoulder-external-rotation":{ p: ["shoulders-rear"], s: [] },
  "wall-slide":                { p: ["shoulders-rear"], s: ["back"] },

  // ── BACK ───────────────────────────────────────────────────────────────
  "pullups":                { p: ["back"], s: ["biceps", "forearms"] },
  "chinups":                { p: ["back"], s: ["biceps", "forearms"] },
  "lat-pulldown":           { p: ["back"], s: ["biceps"] },
  "wide-grip-lat-pulldown": { p: ["back"], s: ["biceps"] },
  "resistance-band-pulldown":{ p: ["back"], s: ["biceps"] },
  "barbell-row":            { p: ["back"], s: ["biceps", "shoulders-rear", "forearms"] },
  "seated-cable-row":       { p: ["back"], s: ["biceps"] },
  "t-bar-row":              { p: ["back"], s: ["biceps"] },
  "single-arm-dumbbell-row":{ p: ["back"], s: ["biceps"] },
  "inverted-row":           { p: ["back"], s: ["biceps", "core"] },
  "straight-arm-pulldown":  { p: ["back"], s: [] },
  "barbell-shrugs":         { p: ["back"], s: [] },
  "dumbbell-shrugs":        { p: ["back"], s: [] },
  "hyperextension":         { p: ["back"], s: ["glutes", "hamstrings"] },
  "superman":               { p: ["back"], s: ["glutes"] },
  "resistance-band-row":    { p: ["back"], s: ["biceps"] },

  // ── BICEPS ─────────────────────────────────────────────────────────────
  "barbell-curl":       { p: ["biceps"], s: ["forearms"] },
  "dumbbell-curl":      { p: ["biceps"], s: ["forearms"] },
  "hammer-curl":        { p: ["biceps", "forearms"], s: [] },
  "concentration-curl": { p: ["biceps"], s: ["forearms"] },
  "preacher-curl":      { p: ["biceps"], s: ["forearms"] },
  "ez-bar-curl":        { p: ["biceps"], s: ["forearms"] },
  "cable-curl":         { p: ["biceps"], s: [] },
  "incline-dumbbell-curl":{ p: ["biceps"], s: [] },

  // ── TRICEPS ────────────────────────────────────────────────────────────
  "skull-crushers":           { p: ["triceps"], s: [] },
  "tricep-pushdown":          { p: ["triceps"], s: [] },
  "tricep-kickback":          { p: ["triceps"], s: [] },
  "resistance-band-pushdown": { p: ["triceps"], s: [] },
};
