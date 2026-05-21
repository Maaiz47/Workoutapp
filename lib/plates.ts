// Plate calculator — figures out the plate stack you need to load per
// side of a barbell to reach a target weight. Standard kg plates +
// Olympic bar assumption. Used by the set-input panel for barbell
// exercises so the user can stop doing arithmetic mid-set.

export type PlateLoad = {
  // Per-side plate breakdown, largest first. e.g. [20, 5, 2.5]
  perSide: number[];
  // Bar weight assumed (default 20kg).
  bar: number;
  // Remainder we couldn't represent (e.g. you asked for 100.5kg with 20kg
  // bar but smallest plate is 1.25kg). Hidden when 0.
  shortfall: number;
};

const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// Greedy plate fit. Returns the smallest set of standard kg plates per
// side that sums to (target − bar) / 2. Caps at 8 plates per side just
// to avoid the UI overflowing for absurd loads.
export function calcPlates(targetKg: number, barKg: number = 20): PlateLoad {
  const perSideTarget = (targetKg - barKg) / 2;
  if (perSideTarget <= 0) {
    return { perSide: [], bar: barKg, shortfall: 0 };
  }
  const perSide: number[] = [];
  let remaining = perSideTarget;
  // Round to nearest 0.5 to avoid floating-point dust.
  remaining = Math.round(remaining * 2) / 2;
  for (const p of STANDARD_PLATES_KG) {
    while (remaining >= p - 1e-9 && perSide.length < 8) {
      perSide.push(p);
      remaining -= p;
      remaining = Math.round(remaining * 1000) / 1000;
    }
  }
  return { perSide, bar: barKg, shortfall: Math.max(0, Math.round(remaining * 100) / 100) };
}

// Decide what kind of loading the exercise uses based on its equipment[].
// Used to pick the right helper text under the weight input.
export type LoadingKind = "barbell" | "dumbbell" | "machine" | "bodyweight" | "other";
export function loadingKindFor(equipment: string[]): LoadingKind {
  const set = new Set((equipment ?? []).map(e => String(e).toLowerCase()));
  if (set.has("barbell")) return "barbell";
  if (set.has("dumbbell") || set.has("kettlebell")) return "dumbbell";
  if (set.has("machine") || set.has("cable")) return "machine";
  if (set.size === 0 || set.has("bodyweight") || set.has("pullup_bar") || set.has("dip_bar")) return "bodyweight";
  return "other";
}

// Short, human-readable label of the per-side plate stack.
//   [20, 10, 2.5] → "20 + 10 + 2.5 per side"
//   []            → "bar only"
export function formatPlateLabel(load: PlateLoad): string {
  if (load.perSide.length === 0) return "bar only";
  return `${load.perSide.join(" + ")} per side`;
}
