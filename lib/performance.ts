// Performance helpers — estimated 1RM, RPE/RIR scale meta. Kept separate
// from app/page.tsx because Next.js route files can only export the
// component-related symbols (default, metadata, etc).

// Estimated 1-rep-max via Epley: weight × (1 + reps/30). For reps = 1
// this returns the weight unchanged. Useful for plotting strength gains
// over time without ever asking the user to actually test a 1RM.
// Returns 0 for invalid inputs.
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Build a CSV string from a workout history map. One row per logged set
// across every session, columns: date, dayId, exercise, setKey, weight,
// reps, RPE, note, est1RM. Used by the Settings "Export CSV" button.
export function buildHistoryCSV(history: Record<string, any[]>): string {
  const rows: string[] = [];
  rows.push("date,dayId,exerciseKey,setKey,weight,reps,rpe,est1RM,note");
  const esc = (s: any) => {
    const v = s == null ? "" : String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  for (const dayId in history) {
    for (const session of history[dayId]) {
      const date = session.date ?? "";
      const sets = session.sets ?? {};
      for (const setKey in sets) {
        const s = sets[setKey];
        if (!s) continue;
        const exKey = setKey.replace(/-\d+(-d\d+)?$/, "");
        const w = s.weight ?? 0, r = s.reps ?? 0;
        const e1 = estimate1RM(w, r);
        rows.push([
          esc(date), esc(dayId), esc(exKey), esc(setKey),
          esc(w), esc(r),
          esc(s.rpe ?? ""), esc(e1),
          esc(s.note ?? ""),
        ].join(","));
      }
    }
  }
  return rows.join("\n") + "\n";
}

// Combined effort scale meta — what to show under each 1-10 chip. Maps the
// classic RPE (Rate of Perceived Exertion) and RIR (Reps in Reserve)
// interpretations onto the same 1-10 scale so the UI works for both schools
// of thought without forcing a Settings toggle.
export const EFFORT_SCALE: Array<{ value: number; rpe: string; rir: string; color: string }> = [
  { value: 1,  rpe: "WARM-UP",   rir: "many left", color: "rgba(255,255,255,0.3)" },
  { value: 2,  rpe: "VERY EASY", rir: "9+ RIR",    color: "rgba(255,255,255,0.4)" },
  { value: 3,  rpe: "EASY",      rir: "8 RIR",     color: "#74b9ff" },
  { value: 4,  rpe: "LIGHT",     rir: "7 RIR",     color: "#74b9ff" },
  { value: 5,  rpe: "MODERATE",  rir: "5 RIR",     color: "#55efc4" },
  { value: 6,  rpe: "SOMEWHAT",  rir: "4 RIR",     color: "#55efc4" },
  { value: 7,  rpe: "HARD",      rir: "3 RIR",     color: "#fdcb6e" },
  { value: 8,  rpe: "VERY HARD", rir: "2 RIR",     color: "#fdcb6e" },
  { value: 9,  rpe: "NEAR MAX",  rir: "1 RIR",     color: "#FF6B6B" },
  { value: 10, rpe: "FAILURE",   rir: "0 RIR",     color: "#FF6B6B" },
];
