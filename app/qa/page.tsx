"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import MascotSplash from "./MascotSplash";

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemStatus = "untested" | "passing" | "failing" | "regression-retest";

interface QAItem {
  id: string;
  title: string;
  area: string;
  introduced: string;
  introducedBy: string;
  lastTested: string | null;
  status: ItemStatus;
  steps: string[];
  notes: string;
}

interface QAState { items: QAItem[]; }

interface Comment {
  id: string;
  itemId: string;
  tester: string;
  userId?: string | null;
  user?: { username: string; email: string | null; role: string } | null;
  status: ItemStatus;
  note: string;
  screenshotUrl: string | null;
  ts: string;
  processed: boolean;
}

interface Draft {
  status: ItemStatus;
  note: string;
  screenshotUrl: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_META: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
  untested:           { label: "UNTESTED", color: "#aaa",    bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)" },
  passing:            { label: "PASSING",  color: "#4caf50", bg: "rgba(76,175,80,0.1)",    border: "rgba(76,175,80,0.3)" },
  failing:            { label: "FAILING",  color: "#FF6B6B", bg: "rgba(255,107,107,0.1)",  border: "rgba(255,107,107,0.3)" },
  // "regression-retest" === "patched, awaiting tester re-verification".
  // Label spells it out so testers don't confuse it with a vague
  // "needs another look" state. (qa: __general__ — maaiz: "the button
  // is vague - I need it to be clearer that it's been attended and
  // pending patch")
  "regression-retest":{ label: "PATCHED · RETEST", color: "#FFB74D", bg: "rgba(255,183,77,0.1)", border: "rgba(255,183,77,0.3)" },
};

const AREAS = [
  "Auth", "Workout", "Plan", "Trainer", "Messaging",
  "Progress", "Body", "UI", "PWA", "Admin", "Marketing", "Other", "Archived",
];

const LS_DRAFTS = "qa-drafts-v2";
const LS_TESTER = "qa-tester";

// Synthetic item ID for the "General Notes" pseudo-section at the top of the
// dashboard. Notes posted here are stored as QAComment rows like any other
// item, with this magic itemId so they group together in a single thread.
const GENERAL_NOTES_ID = "__general__";
const GENERAL_NOTES_ITEM: QAItem = {
  id: GENERAL_NOTES_ID,
  title: "General Notes",
  area: "General",
  introduced: "",
  introducedBy: "",
  lastTested: null,
  status: "untested",
  steps: [],
  notes: "Use this thread for thoughts, observations, and asks that don't fit a specific test item.",
};

// Synthetic thread for the floating 💬 NOTE pill + Settings → SEND
// FEEDBACK card, both of which POST with itemId="user-feedback".
// Without this, those submissions were invisible on /qa — they
// landed in the DB but no UI surfaced them.
const USER_FEEDBACK_ID = "user-feedback";
const USER_FEEDBACK_ITEM: QAItem = {
  id: USER_FEEDBACK_ID,
  title: "User Feedback (floating pill + SEND FEEDBACK)",
  area: "General",
  introduced: "",
  introducedBy: "",
  lastTested: null,
  status: "untested",
  steps: [],
  notes: "Every submission from the in-app 💬 NOTE pill or the Settings → SEND FEEDBACK card lands here. Comments stay PENDING until Claude marks them processed (✓) — then the badge flips to PATCHED · RETEST so you know it's been attended. Reply with a passing comment to confirm the fix.",
};

// ─── Small components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ItemStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
      fontFamily: "'Space Mono', monospace",
      padding: "3px 8px", borderRadius: 4,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
      whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Short status-row datetime — drops year, keeps day+month + hours:mins.
function fmtShortDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Each line in qa-state.json's `notes` is a chronological patch entry,
// usually prefixed with [YYYY-MM-DD] or [YYYY-MM-DD <sha7>]. Parse into
// rows so the UI can render them as a list instead of a wall of text.
interface PatchEntry { dateTag: string | null; body: string }
function parsePatchHistory(notes: string): PatchEntry[] {
  if (!notes) return [];
  const lines = notes.split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(line => {
    const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    return m ? { dateTag: m[1], body: m[2] } : { dateTag: null, body: line };
  });
}

// Derive the item's "live" status. Rules:
//  - If there are no comments at all → fall back to the item's seeded status.
//  - If any UNPROCESSED comment exists → use the latest unprocessed
//    comment's status. This is the "actionable" state — what Claude
//    hasn't seen yet drives the badge.
//  - Otherwise (all comments processed) → translate the latest comment:
//      processed failing/retest → "regression-retest" (= PATCHED · RETEST)
//      processed passing → stays "passing"
//      processed untested → stays "untested"
//  Previously this just returned `sorted[0].status`, so an item where
//  the tester reported FAILING and Claude shipped a fix would keep
//  reading FAILING forever — no signal that it was attended. (qa:
//  user question about whether processed submissions stop being
//  pending until retested.)
function effectiveStatus(item: QAItem, comments: Comment[]): ItemStatus {
  const itemComments = comments.filter(c => c.itemId === item.id);
  if (itemComments.length === 0) return item.status;
  const sorted = [...itemComments].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  // Prefer the latest UNPROCESSED comment so unaddressed reports
  // still surface as pending.
  const latestPending = sorted.find(c => !c.processed);
  if (latestPending) return latestPending.status;
  // All processed — map failing/retest → regression-retest so the
  // badge reads "PATCHED · RETEST" instead of a stale "FAILING".
  const latest = sorted[0];
  if (latest.status === "failing" || latest.status === "regression-retest") return "regression-retest";
  return latest.status;
}

// ─── Feedback scoring ────────────────────────────────────────────────────────
// Transparent rubric, surfaced in the leaderboard UI so testers know how
// to earn points. Tweak the numbers below if the balance feels off — the
// breakdown rendered next to each user will follow.
//
// Verification gate: status + screenshot bonuses only unlock once Claude
// has processed the comment. Until then the comment earns only the base
// point and the note-detail bonus. This prevents inflated "failing"
// flags from gaming the board.

const SCORE_RUBRIC = {
  base: 1,
  failing: 5,            // bug report — most valuable (gated on processed)
  regressionRetest: 3,   // mid-value — flags something to recheck (gated)
  passing: 1,            // confirms a fix actually works (gated)
  screenshot: 2,         // attached evidence (gated + URL-validated)
  processed: 3,          // Claude actioned it — confirmed actionable
  perCharNote: 0.05,     // detail bonus, instant — rewards effort
  noteBonusCap: 15,
} as const;

// A screenshot only earns points if it's actually a fetchable URL.
function isValidScreenshotUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (u.length < 12 || u.length > 2000) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  try { new URL(u); } catch { return false; }
  return true;
}

function scoreComment(c: Comment): number {
  let s = SCORE_RUBRIC.base;
  // Status + screenshot bonuses only count once Claude has verified the
  // comment by processing it. Until then they sit pending.
  if (c.processed) {
    if (c.status === "failing") s += SCORE_RUBRIC.failing;
    else if (c.status === "regression-retest") s += SCORE_RUBRIC.regressionRetest;
    else if (c.status === "passing") s += SCORE_RUBRIC.passing;
    if (isValidScreenshotUrl(c.screenshotUrl)) s += SCORE_RUBRIC.screenshot;
    s += SCORE_RUBRIC.processed;
  }
  // Detail bonus is always instant — rewards a thorough note regardless
  // of outcome. Cap raised so long-form feedback is meaningfully rewarded.
  const noteBonus = Math.min(SCORE_RUBRIC.noteBonusCap, (c.note?.length || 0) * SCORE_RUBRIC.perCharNote);
  s += noteBonus;
  return Math.round(s * 10) / 10;
}

interface LeaderRow {
  name: string;          // display name (username if known, else tester-as-typed)
  isRegistered: boolean; // true if backed by a logged-in user.username
  total: number;         // sum of scoreComment()
  count: number;         // total comments
  bugs: number;          // verified failing (processed)
  retests: number;       // verified regression-retest (processed)
  passes: number;        // verified passing (processed)
  screenshots: number;   // valid URL AND processed
  processed: number;     // total comments that have been actioned
  pending: number;       // comments still awaiting verification
  lastTs: string;        // most recent comment ts
}

function buildLeaderboard(comments: Comment[]): LeaderRow[] {
  const byKey: Record<string, LeaderRow> = {};
  for (const c of comments) {
    const username = c.user?.username?.trim();
    const tester = c.tester?.trim() || "anon";
    const isRegistered = !!username;
    const name = isRegistered ? username! : tester;
    const key = (isRegistered ? "u:" + username : "t:" + tester).toLowerCase();
    if (!byKey[key]) byKey[key] = {
      name, isRegistered, total: 0, count: 0,
      bugs: 0, retests: 0, passes: 0, screenshots: 0, processed: 0, pending: 0,
      lastTs: c.ts,
    };
    const row = byKey[key];
    row.total += scoreComment(c);
    row.count += 1;
    if (c.processed) {
      row.processed += 1;
      if (c.status === "failing") row.bugs += 1;
      else if (c.status === "regression-retest") row.retests += 1;
      else if (c.status === "passing") row.passes += 1;
      if (isValidScreenshotUrl(c.screenshotUrl)) row.screenshots += 1;
    } else {
      row.pending += 1;
    }
    if (+new Date(c.ts) > +new Date(row.lastTs)) row.lastTs = c.ts;
  }
  return Object.values(byKey)
    .map(r => ({ ...r, total: Math.round(r.total * 10) / 10 }))
    .sort((a, b) => b.total - a.total || b.count - a.count);
}

function rankBadge(idx: number): { emoji: string; color: string } {
  if (idx === 0) return { emoji: "🥇", color: "#FFD700" };
  if (idx === 1) return { emoji: "🥈", color: "#C0C0C0" };
  if (idx === 2) return { emoji: "🥉", color: "#CD7F32" };
  return { emoji: `#${idx + 1}`, color: "rgba(255,255,255,0.45)" };
}

// ─── DASHBOARD METRICS ──────────────────────────────────────────────────
// Header-only chips at the top of /qa were the previous summary, but the
// tester asked for a richer at-a-glance dashboard. Surfaces:
//  - Status segmented progress bar with % passing + raw counts
//  - Activity row: comments today / last 7d / last 30d, total threads
//    with unprocessed work, top recent area
//  - Per-area mini-bars showing % passing per area (greens = healthy,
//    reds = hotspots)
//  - Open work: count of unprocessed comments + how many testers
//    have items pending
function DashboardMetrics({
  items, comments,
}: {
  items: QAItem[];
  comments: Comment[];
}) {
  const [open, setOpen] = useState(true);

  // Status counts via effectiveStatus per item.
  let cP = 0, cF = 0, cR = 0, cU = 0;
  for (const it of items) {
    const s = effectiveStatus(it, comments);
    if (s === "passing") cP++;
    else if (s === "failing") cF++;
    else if (s === "regression-retest") cR++;
    else cU++;
  }
  const total = items.length || 1;
  const pctP = Math.round((cP / total) * 100);
  const pctR = Math.round((cR / total) * 100);
  const pctF = Math.round((cF / total) * 100);
  const pctU = Math.max(0, 100 - pctP - pctR - pctF);

  // Activity windows.
  const now = Date.now();
  const dayMs = 86400000;
  const today = comments.filter(c => now - +new Date(c.ts) < dayMs).length;
  const last7 = comments.filter(c => now - +new Date(c.ts) < 7 * dayMs).length;
  const last30 = comments.filter(c => now - +new Date(c.ts) < 30 * dayMs).length;

  const unprocessed = comments.filter(c => !c.processed).length;
  const testersWithPending = new Set(
    comments.filter(c => !c.processed).map(c => (c.user?.username ?? c.tester ?? "anon").toLowerCase())
  ).size;

  // Per-area status breakdown.
  const areaBuckets: Record<string, { total: number; p: number; r: number; f: number; u: number }> = {};
  for (const it of items) {
    const a = it.area || "Other";
    if (!areaBuckets[a]) areaBuckets[a] = { total: 0, p: 0, r: 0, f: 0, u: 0 };
    areaBuckets[a].total += 1;
    const s = effectiveStatus(it, comments);
    if (s === "passing") areaBuckets[a].p++;
    else if (s === "regression-retest") areaBuckets[a].r++;
    else if (s === "failing") areaBuckets[a].f++;
    else areaBuckets[a].u++;
  }
  const areaRows = Object.entries(areaBuckets)
    .map(([area, b]) => ({ area, ...b, pct: Math.round((b.p / b.total) * 100) }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total); // worst-health areas first

  return (
    <div style={{
      marginBottom: 18,
      background: "linear-gradient(180deg, rgba(78,205,196,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      border: "1px solid rgba(78,205,196,0.22)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "14px 16px", background: "transparent",
          border: "none", color: "#fff", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#4ECDC4" }}>DASHBOARD METRICS</span>
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
          {pctP}% PASSING · {unprocessed} TO PROCESS {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 16px" }}>
          {/* Status segmented bar — visually shows the health of the whole backlog. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              height: 10, borderRadius: 5, overflow: "hidden",
              display: "flex", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {cP > 0 && <div style={{ width: `${pctP}%`, background: "#4caf50" }} title={`${cP} passing`} />}
              {cR > 0 && <div style={{ width: `${pctR}%`, background: "#FFB74D" }} title={`${cR} retest`} />}
              {cF > 0 && <div style={{ width: `${pctF}%`, background: "#FF6B6B" }} title={`${cF} failing`} />}
              {cU > 0 && <div style={{ width: `${pctU}%`, background: "rgba(255,255,255,0.18)" }} title={`${cU} untested`} />}
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 6,
              fontSize: 10, color: "rgba(255,255,255,0.5)",
              fontFamily: "'Space Mono', monospace", letterSpacing: 0.5,
            }}>
              <span style={{ color: "#4caf50" }}>✓ {cP} PASS</span>
              <span style={{ color: "#FFB74D" }}>↻ {cR} RETEST</span>
              <span style={{ color: "#FF6B6B" }}>✗ {cF} FAIL</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>· {cU} UNTESTED</span>
            </div>
          </div>

          {/* Headline cards: % passing big number + activity counts. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[
              { label: "PASSING", value: `${pctP}%`, sub: `${cP}/${total}`, color: "#4caf50" },
              { label: "OPEN", value: `${cU + cR + cF}`, sub: "items", color: "#FFB74D" },
              { label: "PENDING", value: `${unprocessed}`, sub: testersWithPending ? `${testersWithPending} ppl` : "—", color: "#4ECDC4" },
            ].map(card => (
              <div key={card.label} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "10px 8px", textAlign: "center",
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color, fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, color: card.color, marginTop: 4, fontFamily: "'Space Mono', monospace" }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1, fontFamily: "'Space Mono', monospace" }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Activity timeline strip. */}
          <div style={{
            display: "flex", gap: 12, marginBottom: 14,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
            fontFamily: "'Space Mono', monospace", letterSpacing: 0.5,
            fontSize: 11,
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: today > 0 ? "#FFD700" : "rgba(255,255,255,0.5)" }}>{today}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>TODAY</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{last7}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>LAST 7D</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{last30}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>LAST 30D</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{comments.length}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 2 }}>ALL TIME</div>
            </div>
          </div>

          {/* Per-area mini bars — worst health first so hotspots are obvious. */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "rgba(255,255,255,0.5)",
              fontFamily: "'Space Mono', monospace", marginBottom: 8,
            }}>HEALTH BY AREA · WORST FIRST</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {areaRows.map(r => (
                <div key={r.area} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.65)",
                    fontFamily: "'Space Mono', monospace", width: 80, flexShrink: 0,
                  }}>{r.area.toUpperCase()}</div>
                  <div style={{
                    flex: 1, height: 6, borderRadius: 3,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    overflow: "hidden", display: "flex",
                  }}>
                    {r.p > 0 && <div style={{ width: `${(r.p / r.total) * 100}%`, background: "#4caf50" }} title={`${r.p} passing`} />}
                    {r.r > 0 && <div style={{ width: `${(r.r / r.total) * 100}%`, background: "#FFB74D" }} title={`${r.r} retest`} />}
                    {r.f > 0 && <div style={{ width: `${(r.f / r.total) * 100}%`, background: "#FF6B6B" }} title={`${r.f} failing`} />}
                    {r.u > 0 && <div style={{ width: `${(r.u / r.total) * 100}%`, background: "rgba(255,255,255,0.18)" }} title={`${r.u} untested`} />}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: r.pct >= 70 ? "#4caf50" : r.pct >= 40 ? "#FFB74D" : "#FF6B6B",
                    fontFamily: "'Space Mono', monospace", width: 36, textAlign: "right", flexShrink: 0,
                  }}>{r.pct}%</div>
                  <div style={{
                    fontSize: 9, color: "rgba(255,255,255,0.35)",
                    fontFamily: "'Space Mono', monospace", width: 28, textAlign: "right", flexShrink: 0,
                  }}>{r.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ comments }: { comments: Comment[] }) {
  const [open, setOpen] = useState(true);
  const [showRubric, setShowRubric] = useState(false);
  const rows = buildLeaderboard(comments);

  if (rows.length === 0) return null;

  const totalComments = comments.length;
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div style={{
      marginBottom: 18,
      background: "linear-gradient(180deg, rgba(255,215,0,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      border: "1px solid rgba(255,215,0,0.2)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "14px 16px", background: "transparent",
          border: "none", color: "#fff", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#FFD700" }}>FEEDBACK LEADERBOARD</span>
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
          {rows.length} {rows.length === 1 ? "TESTER" : "TESTERS"} · {totalComments} COMMENTS · {Math.round(totalPoints)} PTS {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 14px" }}>
          {rows.map((r, idx) => {
            const badge = rankBadge(idx);
            return (
              <div key={r.name + idx} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 8px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{
                  flexShrink: 0, width: 36, textAlign: "center",
                  fontSize: idx < 3 ? 18 : 12,
                  fontWeight: 700, fontFamily: "'Space Mono', monospace",
                  color: badge.color,
                }}>{badge.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {r.isRegistered ? "@" + r.name : r.name}
                    </span>
                    {!r.isRegistered && (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>GUEST</span>
                    )}
                  </div>
                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: 8, marginTop: 3,
                    fontSize: 10, color: "rgba(255,255,255,0.5)",
                    fontFamily: "'Space Mono', monospace",
                  }}>
                    <span>{r.count} comments</span>
                    {r.bugs > 0 && <span style={{ color: "#FF6B6B" }}>✗ {r.bugs} verified bugs</span>}
                    {r.retests > 0 && <span style={{ color: "#FFB74D" }}>↻ {r.retests} retests</span>}
                    {r.passes > 0 && <span style={{ color: "#4caf50" }}>✓ {r.passes} confirms</span>}
                    {r.screenshots > 0 && <span style={{ color: "#4ECDC4" }}>📷 {r.screenshots} useful</span>}
                    {r.processed > 0 && <span style={{ color: "rgba(255,215,0,0.8)" }}>★ {r.processed} shipped</span>}
                    {r.pending > 0 && <span style={{ color: "rgba(255,255,255,0.35)" }}>⧗ {r.pending} pending</span>}
                  </div>
                </div>
                <div style={{
                  flexShrink: 0, textAlign: "right", paddingLeft: 6,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD700", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>
                    {r.total.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginTop: 2 }}>POINTS</div>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setShowRubric(s => !s)}
            style={{
              marginTop: 10, width: "100%",
              padding: "8px", background: "transparent",
              border: "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 6,
              color: "rgba(255,255,255,0.45)",
              fontSize: 10, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace", cursor: "pointer",
            }}
          >{showRubric ? "HIDE SCORING RUBRIC ▲" : "HOW POINTS ARE AWARDED ▼"}</button>

          {showRubric && (
            <div style={{
              marginTop: 8, padding: 12,
              background: "rgba(0,0,0,0.25)", borderRadius: 6,
              fontSize: 11, lineHeight: 1.7,
              color: "rgba(255,255,255,0.65)",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              <strong style={{ color: "#fff" }}>Instant on submit:</strong>
              <ul style={{ margin: "6px 0 10px 0", paddingLeft: 18 }}>
                <li><strong>+{SCORE_RUBRIC.base}</strong> for submitting a comment</li>
                <li><strong>+0.05 / char</strong> of detail in the note, capped at +{SCORE_RUBRIC.noteBonusCap}</li>
              </ul>
              <strong style={{ color: "#fff" }}>Unlocked after Claude verifies the comment (★ processed):</strong>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                <li><strong>+{SCORE_RUBRIC.processed}</strong> just for being actioned</li>
                <li><strong>+{SCORE_RUBRIC.failing}</strong> if the status was correctly <span style={{ color: "#FF6B6B" }}>FAILING</span> (real bug)</li>
                <li><strong>+{SCORE_RUBRIC.regressionRetest}</strong> if correctly flagged <span style={{ color: "#FFB74D" }}>RETEST</span></li>
                <li><strong>+{SCORE_RUBRIC.passing}</strong> if correctly confirmed <span style={{ color: "#4caf50" }}>PASSING</span></li>
                <li><strong>+{SCORE_RUBRIC.screenshot}</strong> if the screenshot URL is valid AND the shot was actually useful</li>
              </ul>
              <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                Bogus status flags and broken screenshot links earn no bonus — verification gates them.
                Anything still pending shows as <span style={{ color: "rgba(255,255,255,0.5)" }}>⧗ pending</span> in your row.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item card with thread + draft ────────────────────────────────────────────

function ItemCard({
  item,
  comments,
  draft,
  setDraft,
  tester,
  onSaved,
}: {
  item: QAItem;
  comments: Comment[];
  draft: Draft;
  setDraft: (next: Draft) => void;
  tester: string;
  onSaved: (newComment: Comment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemComments = comments
    .filter(c => c.itemId === item.id)
    .sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  const eff = effectiveStatus(item, comments);
  // Most recent activity: the latest of item.lastTested (set by Claude
  // during processing) or the timestamp of the newest comment. Whichever
  // is more recent represents the last time this item was poked at.
  const lastCommentTs = itemComments.length > 0 ? itemComments[itemComments.length - 1].ts : null;
  const lastActivity = (() => {
    const a = item.lastTested ? +new Date(item.lastTested) : 0;
    const b = lastCommentTs ? +new Date(lastCommentTs) : 0;
    const max = Math.max(a, b);
    return max > 0 ? new Date(max).toISOString() : null;
  })();
  const patchHistory = parsePatchHistory(item.notes);

  // Passing comments don't NEED a note — a green tick on a test
  // is information by itself. Failing / retest / untested still
  // require a note (otherwise the entry is unactionable).
  // (qa: auth-login — Amanii: "Passing tests don't need a required note")
  const noteRequired = draft.status !== "passing";
  const canSave = !!tester.trim() && (!noteRequired || !!draft.note.trim()) && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/qa/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          tester: tester.trim(),
          status: draft.status,
          note: draft.note.trim(),
          screenshotUrl: draft.screenshotUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Server error");
        setSaving(false);
        return;
      }
      const data = await res.json();
      onSaved({
        id: data.id,
        itemId: item.id,
        tester: tester.trim(),
        status: draft.status,
        note: draft.note.trim(),
        screenshotUrl: draft.screenshotUrl.trim() || null,
        ts: data.ts || new Date().toISOString(),
        processed: false,
      });
      // Clear the draft after a successful save so the next comment starts fresh.
      setDraft({ status: draft.status, note: "", screenshotUrl: "" });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, marginBottom: 8, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            // Wrap long titles instead of ellipsis-clipping them —
            // testers couldn't read items like "Trainers see their
            // athlete tier on Progress dashboard too" on narrow
            // phones. (qa: workout-warmup — maaiz: "I can't read this
            // issue title btw")
            wordBreak: "break-word",
            lineHeight: 1.3,
          }}>{item.title}</div>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Space Mono', monospace", marginTop: 3,
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          }}>
            <span>TESTED ×{itemComments.length}</span>
            <span>·</span>
            <span>LAST {fmtShortDateTime(lastActivity)}</span>
          </div>
        </div>
        <StatusBadge status={eff} />
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 4 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {item.steps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#FF6B6B",
                fontFamily: "'Space Mono', monospace", marginBottom: 8,
              }}>STEPS TO TEST</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {item.steps.map((s, i) => (
                  <li key={i} style={{
                    fontSize: 12, color: "rgba(255,255,255,0.7)",
                    fontFamily: "'DM Sans', sans-serif", marginBottom: 5, lineHeight: 1.5,
                  }}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {patchHistory.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
                fontFamily: "'Space Mono', monospace", marginBottom: 8,
              }}>📜 PATCH HISTORY ({patchHistory.length})</div>
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 8, padding: "8px 10px",
              }}>
                {patchHistory.map((p, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 8, padding: "5px 0",
                    borderTop: i === 0 ? "none" : "1px dashed rgba(255,255,255,0.05)",
                  }}>
                    {p.dateTag && (
                      <span style={{
                        flexShrink: 0, fontSize: 10,
                        color: "#FF6B6B", fontFamily: "'Space Mono', monospace",
                        letterSpacing: 0.5, opacity: 0.8,
                      }}>{p.dateTag}</span>
                    )}
                    <span style={{
                      fontSize: 11, color: "rgba(255,255,255,0.55)",
                      fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
                    }}>{p.body}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {itemComments.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
                fontFamily: "'Space Mono', monospace", marginBottom: 8,
              }}>THREAD</div>
              {itemComments.map(c => (
                <div key={c.id} style={{
                  background: c.processed ? "rgba(76,175,80,0.04)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${c.processed ? "rgba(76,175,80,0.15)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10, padding: "10px 12px", marginBottom: 6,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, marginBottom: 6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <StatusBadge status={c.status} />
                      <span style={{
                        fontSize: 11, color: "rgba(255,255,255,0.6)",
                        fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                      }}>{c.user?.username ? `@${c.user.username}` : c.tester}</span>
                      {c.user?.role === "trainer" && (
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "#4ECDC4", background: "rgba(78,205,196,0.1)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 3, padding: "1px 5px" }}>TRAINER</span>
                      )}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 10, color: "rgba(255,255,255,0.35)",
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      <span>{fmtDateTime(c.ts)}</span>
                      {c.processed && <span style={{ color: "#4caf50" }}>✓</span>}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, color: "rgba(255,255,255,0.8)",
                    fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>{c.note}</div>
                  {c.screenshotUrl && (
                    <a href={c.screenshotUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: "inline-block", marginTop: 8,
                      fontSize: 11, color: "#FF6B6B", textDecoration: "none",
                      fontFamily: "'Space Mono', monospace",
                    }}>📎 Screenshot</a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{
            background: "rgba(255,107,107,0.04)",
            border: "1px dashed rgba(255,107,107,0.25)",
            borderRadius: 10, padding: 12,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#FF6B6B",
              fontFamily: "'Space Mono', monospace", marginBottom: 8,
            }}>ADD A COMMENT</div>

            <div style={{ marginBottom: 8 }}>
              <label style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace",
                display: "block", marginBottom: 4,
              }}>STATUS</label>
              <select
                value={draft.status}
                onChange={e => setDraft({ ...draft, status: e.target.value as ItemStatus })}
                style={{
                  width: "100%", background: "#111", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, padding: "9px 12px",
                  fontSize: 16, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                }}
              >
                <option value="untested">Untested</option>
                <option value="passing">Passing</option>
                <option value="failing">Failing</option>
                <option value="regression-retest">Patched · please retest</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace",
                display: "block", marginBottom: 4,
              }}>NOTE {noteRequired ? "(required)" : "(optional)"}</label>
              <textarea
                value={draft.note}
                onChange={e => setDraft({ ...draft, note: e.target.value })}
                placeholder="What happened? Steps to reproduce, what you expected vs saw…"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#111", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, padding: "9px 12px",
                  fontSize: 16, fontFamily: "'DM Sans', sans-serif", resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace",
                display: "block", marginBottom: 4,
              }}>SCREENSHOT URL (optional)</label>
              <input
                type="url"
                value={draft.screenshotUrl}
                onChange={e => setDraft({ ...draft, screenshotUrl: e.target.value })}
                placeholder="https://…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#111", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, padding: "9px 12px",
                  fontSize: 16, fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {error && (
              <div style={{ color: "#FF6B6B", fontSize: 12, marginBottom: 8 }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={!canSave}
              style={{
                width: "100%", padding: "12px",
                background: canSave ? "rgba(255,107,107,0.9)" : "rgba(255,107,107,0.25)",
                border: "none", borderRadius: 8,
                color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 1,
                fontFamily: "'Space Mono', monospace",
                cursor: canSave ? "pointer" : "not-allowed",
                minHeight: 44,
              }}
            >
              {saving ? "SAVING…" : "SAVE COMMENT"}
            </button>
            {!tester.trim() && (
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6,
                textAlign: "center", fontFamily: "'DM Sans', sans-serif",
              }}>Enter your name at the top of the page first.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group (collapsible by area) ─────────────────────────────────────────────

function AreaGroup({
  area,
  items,
  comments,
  drafts,
  setDraft,
  tester,
  onSaved,
}: {
  area: string;
  items: QAItem[];
  comments: Comment[];
  drafts: Record<string, Draft>;
  setDraft: (itemId: string, next: Draft) => void;
  tester: string;
  onSaved: (c: Comment) => void;
}) {
  const [open, setOpen] = useState(true);

  // Counts by effective status.
  let p = 0, f = 0, r = 0, u = 0;
  for (const it of items) {
    const s = effectiveStatus(it, comments);
    if (s === "passing") p++;
    else if (s === "failing") f++;
    else if (s === "regression-retest") r++;
    else u++;
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "8px 4px", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}
      >
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#FF6B6B",
          fontFamily: "'Space Mono', monospace",
        }}>{area.toUpperCase()}</span>
        <span style={{
          fontSize: 11, color: "rgba(255,255,255,0.4)",
          fontFamily: "'Space Mono', monospace",
        }}>{items.length} items</span>
        <span style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          {p > 0 && <span style={{ fontSize: 11, color: "#4caf50", fontFamily: "'Space Mono', monospace" }}>✓{p}</span>}
          {f > 0 && <span style={{ fontSize: 11, color: "#FF6B6B", fontFamily: "'Space Mono', monospace" }}>✗{f}</span>}
          {r > 0 && <span style={{ fontSize: 11, color: "#FFB74D", fontFamily: "'Space Mono', monospace" }}>↻{r}</span>}
          {u > 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>·{u}</span>}
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 6 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          comments={comments}
          draft={drafts[item.id] || { status: "untested", note: "", screenshotUrl: "" }}
          setDraft={d => setDraft(item.id, d)}
          tester={tester}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QAPage() {
  const [qaState, setQaState] = useState<QAState | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tester, setTester] = useState("");
  const [authedUsername, setAuthedUsername] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [showMascot, setShowMascot] = useState(false);
  const draftWriteTimer = useRef<any>(null);

  // Doppo splash: show once per session, or whenever the user re-summons.
  // Wait for BOTH comments AND auth to land before opening — otherwise
  // Doppo can't look up the visitor's leaderboard row and falsely
  // greets a known tester as a stranger with an empty record.
  // Bumping the version forces every active session to see Doppo again
  // with the corrected dialogue lookup.
  const SS_MASCOT_KEY = "qa-doppo-seen-v3";
  useEffect(() => {
    if (loading || !authChecked) return;
    try {
      if (!sessionStorage.getItem(SS_MASCOT_KEY)) {
        setShowMascot(true);
        sessionStorage.setItem(SS_MASCOT_KEY, "1");
      }
    } catch {}
  }, [loading, authChecked]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Hydrate tester + drafts from localStorage immediately so the page never
    // looks empty after a refresh.
    try {
      const t = localStorage.getItem(LS_TESTER);
      if (t) setTester(t);
      const d = localStorage.getItem(LS_DRAFTS);
      if (d) setDrafts(JSON.parse(d));
    } catch {}

    // If the visitor is logged in, the server has them — pre-fill the tester
    // name from the user's username and skip rendering the name field.
    fetch("/api/auth", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const u = data?.user?.username;
        if (typeof u === "string" && u.trim()) {
          setAuthedUsername(u);
          setTester(u);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));

    Promise.all([
      fetch("/api/qa", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/qa/comment", { cache: "no-store" }).then(r => r.json()),
    ]).then(([state, commentsRes]: [QAState, { comments: Comment[] }]) => {
      setQaState(state);
      setComments(commentsRes.comments || []);
      // Seed any missing drafts with default status from the item.
      setDrafts(prev => {
        const next = { ...prev };
        for (const it of state.items) {
          if (!next[it.id]) next[it.id] = { status: "untested", note: "", screenshotUrl: "" };
        }
        if (!next[GENERAL_NOTES_ID]) {
          next[GENERAL_NOTES_ID] = { status: "untested", note: "", screenshotUrl: "" };
        }
        if (!next[USER_FEEDBACK_ID]) {
          next[USER_FEEDBACK_ID] = { status: "untested", note: "", screenshotUrl: "" };
        }
        return next;
      });
    }).finally(() => setLoading(false));
  }, []);

  // ── Persist tester name as it changes ─────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(LS_TESTER, tester); } catch {}
  }, [tester]);

  // ── Persist drafts (debounced) ────────────────────────────────────────────
  useEffect(() => {
    if (draftWriteTimer.current) clearTimeout(draftWriteTimer.current);
    draftWriteTimer.current = setTimeout(() => {
      try { localStorage.setItem(LS_DRAFTS, JSON.stringify(drafts)); } catch {}
    }, 300);
    return () => { if (draftWriteTimer.current) clearTimeout(draftWriteTimer.current); };
  }, [drafts]);

  const setDraft = useCallback((itemId: string, next: Draft) => {
    setDrafts(prev => ({ ...prev, [itemId]: next }));
  }, []);

  const onSaved = useCallback((c: Comment) => {
    setComments(prev => [...prev, c]);
  }, []);

  if (loading) return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", fontSize: 12,
    }}>Loading QA…</div>
  );

  const allItems = qaState?.items ?? [];

  // ── Search filter ─────────────────────────────────────────────────────────
  // Matches against title, area, steps, notes, AND every comment's tester+note
  // on that item — so a typo in a thread is findable too.
  const q = search.trim().toLowerCase();
  const matchesQuery = (it: QAItem) => {
    if (!q) return true;
    if (it.title.toLowerCase().includes(q)) return true;
    if (it.area.toLowerCase().includes(q)) return true;
    if (it.id.toLowerCase().includes(q)) return true;
    if (it.notes && it.notes.toLowerCase().includes(q)) return true;
    if (it.steps.some(s => s.toLowerCase().includes(q))) return true;
    if (comments.some(c => c.itemId === it.id && (
      c.note.toLowerCase().includes(q) || c.tester.toLowerCase().includes(q)
    ))) return true;
    return false;
  };
  const filteredItems = allItems.filter(matchesQuery);
  const generalMatches = q
    ? (GENERAL_NOTES_ITEM.title.toLowerCase().includes(q) ||
       comments.some(c => c.itemId === GENERAL_NOTES_ID &&
         (c.note.toLowerCase().includes(q) || c.tester.toLowerCase().includes(q))))
    : true;
  const userFeedbackMatches = q
    ? (USER_FEEDBACK_ITEM.title.toLowerCase().includes(q) ||
       comments.some(c => c.itemId === USER_FEEDBACK_ID &&
         (c.note.toLowerCase().includes(q) || c.tester.toLowerCase().includes(q))))
    : true;

  // Group by area, then within each area sort items by status
  // priority so the most actionable surfaces first:
  //   untested (never touched)
  //   regression-retest (PATCHED · RETEST — fix shipped, verify)
  //   failing (live bugs — rare after a QA pass)
  //   passing (confirmed working, parked at the bottom)
  // (qa: user request — "all untested issues in qa in order before
  // retest, then fails then passes")
  const STATUS_PRIORITY: Record<ItemStatus, number> = {
    untested: 0,
    "regression-retest": 1,
    failing: 2,
    passing: 3,
  };
  const grouped = AREAS
    .map(area => ({
      area,
      items: filteredItems
        .filter(i => i.area === area)
        .slice()
        .sort((a, b) => {
          const ea = effectiveStatus(a, comments);
          const eb = effectiveStatus(b, comments);
          const pa = STATUS_PRIORITY[ea];
          const pb = STATUS_PRIORITY[eb];
          if (pa !== pb) return pa - pb;
          // Secondary sort: most-recently-tested first within a
          // status bucket so the freshly-patched retest items
          // bubble to the top of their group.
          const ta = a.lastTested ? +new Date(a.lastTested) : 0;
          const tb = b.lastTested ? +new Date(b.lastTested) : 0;
          return tb - ta;
        }),
    }))
    .filter(g => g.items.length > 0);

  // Header summary uses the UNFILTERED list — these counts reflect the whole
  // backlog, not what's currently visible.
  let totalP = 0, totalF = 0, totalR = 0;
  for (const it of allItems) {
    const s = effectiveStatus(it, comments);
    if (s === "passing") totalP++;
    else if (s === "failing") totalF++;
    else if (s === "regression-retest") totalR++;
  }
  const pct = allItems.length ? Math.round((totalP / allItems.length) * 100) : 0;
  const unprocessedCount = comments.filter(c => !c.processed).length;

  // PWA escape: tap "Open in Browser" → try the native share sheet first
  // (iOS PWAs only reliably escape via Share → "Open in Safari"), then
  // window.open (works on Android PWA + desktop), then clipboard as a
  // last resort so the user can paste the URL into their browser.
  const openQaInBrowser = async () => {
    const url = (typeof window !== "undefined" ? window.location.origin : "") + "/qa";
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "IRONLOG QA", url });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled the share
      }
    }
    const opened = typeof window !== "undefined" && window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;
    try {
      await navigator.clipboard.writeText(url);
      alert("QA URL copied. Paste it into your browser to open.");
    } catch {
      window.prompt("Copy this URL and paste it into your browser:", url);
    }
  };

  // Find the visitor's leaderboard standing so Doppo's dialogue can react.
  // Prefer the username-keyed row when logged in; fall back to a tester-name
  // match (case-insensitive on either the username OR the typed tester) so
  // a legacy row keyed on the raw `tester` string is still resolvable.
  const allRows = buildLeaderboard(comments);
  const findVisitor = (): number => {
    const handles = [authedUsername, tester.trim()].filter(Boolean) as string[];
    for (const h of handles) {
      const needleU = ("u:" + h).toLowerCase();
      const needleT = ("t:" + h).toLowerCase();
      const idx = allRows.findIndex(r => {
        const key = (r.isRegistered ? "u:" + r.name : "t:" + r.name).toLowerCase();
        return key === needleU || key === needleT;
      });
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const visitorIdx = findVisitor();
  const visitorRow = visitorIdx >= 0 ? allRows[visitorIdx] : null;

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a", color: "#fff",
      padding: "20px 16px 80px", boxSizing: "border-box",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <AnimatePresence>
        {showMascot && (
          <MascotSplash
            username={authedUsername}
            points={visitorRow?.total ?? 0}
            rank={visitorIdx >= 0 ? visitorIdx + 1 : null}
            totalTesters={allRows.length}
            bugs={visitorRow?.bugs ?? 0}
            comments={visitorRow?.count ?? 0}
            onDismiss={() => setShowMascot(false)}
          />
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#FF6B6B",
            fontFamily: "'Space Mono', monospace", marginBottom: 4,
          }}>IRONLOG</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>QA Dashboard</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={openQaInBrowser}
                title="Pop /qa out into your system browser (Safari / Chrome). Useful when the IRONLOG PWA itself is what you're testing — keeps the PWA free while you log feedback in the browser."
                style={{
                  padding: "6px 12px",
                  background: "rgba(78,205,196,0.08)",
                  border: "1px solid rgba(78,205,196,0.3)",
                  borderRadius: 999,
                  color: "#4ECDC4", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  fontFamily: "'Space Mono', monospace",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >📤 OPEN IN BROWSER</button>
              <button
                onClick={() => setShowMascot(true)}
                title="Re-play the Doppo intro splash with your current leaderboard stats"
                style={{
                  padding: "6px 12px",
                  background: "rgba(255,107,107,0.08)",
                  border: "1px solid rgba(255,107,107,0.3)",
                  borderRadius: 999,
                  color: "#FF6B6B", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  fontFamily: "'Space Mono', monospace",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >🥋 SUMMON DOPPO</button>
            </div>
          </div>
          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.4)",
            fontFamily: "'Space Mono', monospace",
            marginBottom: 12, lineHeight: 1.5,
          }}>
            📤 <strong>OPEN IN BROWSER</strong> pops this dashboard into Safari / Chrome — use it when you&apos;re testing the installed PWA itself.{" "}
            🥋 <strong>SUMMON DOPPO</strong> re-plays the QA-sensei intro.
          </div>

          {/* Summary chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace",
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>{allItems.length} ITEMS</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace",
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(76,175,80,0.1)", color: "#4caf50",
              border: "1px solid rgba(76,175,80,0.3)",
            }}>{pct}% PASSING</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace",
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(255,107,107,0.1)", color: "#FF6B6B",
              border: "1px solid rgba(255,107,107,0.3)",
            }}>{totalF} FAILING</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace",
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(255,183,77,0.1)", color: "#FFB74D",
              border: "1px solid rgba(255,183,77,0.3)",
            }}>{totalR} RETEST</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Space Mono', monospace",
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(78,205,196,0.08)", color: "#4ECDC4",
              border: "1px solid rgba(78,205,196,0.25)",
            }}>{unprocessedCount} TO PROCESS</span>
          </div>

          {/* Signed-in chip OR name field for anonymous testers */}
          {authedUsername ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px",
              background: "rgba(78,205,196,0.08)",
              border: "1px solid rgba(78,205,196,0.25)",
              borderRadius: 999,
              fontSize: 11, color: "#4ECDC4",
              fontFamily: "'Space Mono', monospace", letterSpacing: 1,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ECDC4" }} />
              SIGNED IN AS @{authedUsername.toUpperCase()}
            </div>
          ) : (
            <input
              value={tester}
              onChange={e => setTester(e.target.value)}
              placeholder="Your name (for the comment thread)"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "10px 12px",
                fontSize: 16, fontFamily: "'DM Sans', sans-serif",
                minHeight: 44,
              }}
            />
          )}

          {/* Search — sticky to the top of the viewport so it stays
              accessible while scrolling the long backlog. (qa:
              __general__ — maaiz: "Make search box floating that stays
              always") */}
          <div style={{
            marginTop: 14, position: "sticky",
            top: "calc(env(safe-area-inset-top, 0px) + 6px)",
            zIndex: 50,
            // Backdrop blur so items behind it don't smear through.
            background: "rgba(10,10,10,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            margin: "14px -4px 0",
            padding: "6px 4px 8px",
            borderRadius: 10,
          }}>
            <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items, steps, notes, threads…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "10px 36px 10px 12px",
                fontSize: 16, fontFamily: "'DM Sans', sans-serif",
                minHeight: 44,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                  width: 32, height: 32, background: "transparent", border: "none",
                  color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            )}
            {q && (
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.4)",
                fontFamily: "'Space Mono', monospace", marginTop: 6,
              }}>{filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} match{filteredItems.length === 1 ? "es" : ""}</div>
            )}
            </div>
          </div>
        </div>

        {/* Leaderboard — points + counts per tester. Hidden during searches. */}
        {!q && <DashboardMetrics items={allItems} comments={comments} />}
        {!q && <Leaderboard comments={comments} />}

        {/* General catch-all threads — General Notes + User Feedback
            (floating pill + SEND FEEDBACK). Both have synthetic items
            because they don't live in qa-state.json. Each comment is an
            independent ask; the item's effective status reflects
            "any unprocessed pending?" so once Claude marks everything
            attended the badge flips to PATCHED · RETEST. */}
        {(generalMatches || userFeedbackMatches) && (
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#4ECDC4",
              fontFamily: "'Space Mono', monospace",
              padding: "8px 4px", marginBottom: 4,
            }}>GENERAL</div>
            {generalMatches && (
              <ItemCard
                item={GENERAL_NOTES_ITEM}
                comments={comments}
                draft={drafts[GENERAL_NOTES_ID] || { status: "untested", note: "", screenshotUrl: "" }}
                setDraft={d => setDrafts(prev => ({ ...prev, [GENERAL_NOTES_ID]: d }))}
                tester={tester}
                onSaved={onSaved}
              />
            )}
            {userFeedbackMatches && (
              <ItemCard
                item={USER_FEEDBACK_ITEM}
                comments={comments}
                draft={drafts[USER_FEEDBACK_ID] || { status: "untested", note: "", screenshotUrl: "" }}
                setDraft={d => setDrafts(prev => ({ ...prev, [USER_FEEDBACK_ID]: d }))}
                tester={tester}
                onSaved={onSaved}
              />
            )}
          </div>
        )}

        {/* Groups */}
        {grouped.length === 0 && q && (
          <div style={{
            textAlign: "center", padding: "32px 16px",
            color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace", fontSize: 12,
          }}>No items match &quot;{search}&quot;.</div>
        )}
        {grouped.map(g => (
          <AreaGroup
            key={g.area}
            area={g.area}
            items={g.items}
            comments={comments}
            drafts={drafts}
            setDraft={setDraft}
            tester={tester}
            onSaved={onSaved}
          />
        ))}

        <div style={{
          marginTop: 24, padding: 14,
          background: "rgba(78,205,196,0.05)", border: "1px solid rgba(78,205,196,0.2)",
          borderRadius: 10,
          fontSize: 12, color: "rgba(255,255,255,0.55)",
          fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
        }}>
          Comments are saved immediately to the server when you tap SAVE COMMENT.
          You can come back any time, see the full thread, and add another comment
          to keep the conversation going until an issue is resolved. Tell Claude
          &quot;process QA&quot; when you want the backlog actioned.
        </div>
      </div>
    </div>
  );
}
