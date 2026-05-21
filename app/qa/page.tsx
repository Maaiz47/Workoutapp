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
  "regression-retest":{ label: "RETEST",   color: "#FFB74D", bg: "rgba(255,183,77,0.1)",   border: "rgba(255,183,77,0.3)" },
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

// Derive the item's "live" status: prefer the latest unprocessed comment's
// status, else the latest comment overall, else the seeded item.status.
function effectiveStatus(item: QAItem, comments: Comment[]): ItemStatus {
  const itemComments = comments.filter(c => c.itemId === item.id);
  if (itemComments.length === 0) return item.status;
  const sorted = [...itemComments].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  return sorted[0].status;
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

  const canSave = !!tester.trim() && !!draft.note.trim() && !saving;

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
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{item.title}</div>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Space Mono', monospace", marginTop: 3,
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <span>{itemComments.length} comment{itemComments.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>Last tested: {fmtDate(item.lastTested)}</span>
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

          {item.notes && (
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.4)",
              fontFamily: "'DM Sans', sans-serif",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8, padding: "8px 10px", marginBottom: 14,
              lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{item.notes}</div>
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
                <option value="regression-retest">Needs retest</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace",
                display: "block", marginBottom: 4,
              }}>NOTE (required)</label>
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

  // Group by area (after filter).
  const grouped = AREAS
    .map(area => ({ area, items: filteredItems.filter(i => i.area === area) }))
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

          {/* Search */}
          <div style={{ marginTop: 14, position: "relative" }}>
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

        {/* Leaderboard — points + counts per tester. Hidden during searches. */}
        {!q && <Leaderboard comments={comments} />}

        {/* General Notes — always at the top, only hidden when search excludes it */}
        {generalMatches && (
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "#4ECDC4",
              fontFamily: "'Space Mono', monospace",
              padding: "8px 4px", marginBottom: 4,
            }}>GENERAL</div>
            <ItemCard
              item={GENERAL_NOTES_ITEM}
              comments={comments}
              draft={drafts[GENERAL_NOTES_ID] || { status: "untested", note: "", screenshotUrl: "" }}
              setDraft={d => setDrafts(prev => ({ ...prev, [GENERAL_NOTES_ID]: d }))}
              tester={tester}
              onSaved={onSaved}
            />
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
