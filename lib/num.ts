// Numeric parse helpers — guard against NaN poisoning the DB.
//
// `parseFloat("abc")` returns NaN, which is truthy enough to slip past
// `if (x)` checks and then silently corrupts everything downstream:
// tier scoring, body-comp trends, goal-reached detection, leaderboard
// math. Always route user-supplied numbers through these so an invalid
// value becomes `null` (or a fallback) instead of NaN.
// (qa: numeric-nan-guards)

/** Parse to a finite number, else `fallback` (default null). Accepts
 *  number | string | null | undefined. Empty/whitespace → fallback. */
export function safeFloat(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Integer flavour of safeFloat (truncates toward zero). */
export function safeInt(v: unknown, fallback: number | null = null): number | null {
  const n = safeFloat(v, null);
  return n === null ? fallback : Math.trunc(n);
}
