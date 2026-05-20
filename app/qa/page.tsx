"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
                      }}>{c.tester}</span>
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
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const draftWriteTimer = useRef<any>(null);

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
      try {
        localStorage.setItem(LS_DRAFTS, JSON.stringify(drafts));
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch {}
    }, 300);
    return () => { if (draftWriteTimer.current) clearTimeout(draftWriteTimer.current); };
  }, [drafts]);

  const setDraft = useCallback((itemId: string, next: Draft) => {
    setDrafts(prev => ({ ...prev, [itemId]: next }));
  }, []);

  const onSaved = useCallback((c: Comment) => {
    setComments(prev => [...prev, c]);
  }, []);

  // ── Backup export ─────────────────────────────────────────────────────────
  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify({ tester, drafts, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-drafts-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // ── Backup import ─────────────────────────────────────────────────────────
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (typeof data.tester === "string") setTester(data.tester);
        if (data.drafts && typeof data.drafts === "object") {
          setDrafts(prev => ({ ...prev, ...data.drafts }));
        }
        alert("Backup imported.");
      } catch { alert("Could not parse backup file."); }
    };
    reader.readAsText(file);
  };

  if (loading) return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", fontSize: 12,
    }}>Loading QA…</div>
  );

  const allItems = qaState?.items ?? [];
  // Group by area.
  const grouped = AREAS
    .map(area => ({ area, items: allItems.filter(i => i.area === area) }))
    .filter(g => g.items.length > 0);

  // Header summary (using effective status).
  let totalP = 0, totalF = 0, totalR = 0;
  for (const it of allItems) {
    const s = effectiveStatus(it, comments);
    if (s === "passing") totalP++;
    else if (s === "failing") totalF++;
    else if (s === "regression-retest") totalR++;
  }
  const pct = allItems.length ? Math.round((totalP / allItems.length) * 100) : 0;
  const unprocessedCount = comments.filter(c => !c.processed).length;

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a", color: "#fff",
      padding: "20px 16px 80px", boxSizing: "border-box",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "#FF6B6B",
            fontFamily: "'Space Mono', monospace", marginBottom: 4,
          }}>IRONLOG</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 10 }}>QA Dashboard</div>

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

          {/* Tester + tools row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              value={tester}
              onChange={e => setTester(e.target.value)}
              placeholder="Your name"
              style={{
                flex: 1, background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "10px 12px",
                fontSize: 16, fontFamily: "'DM Sans', sans-serif",
                minHeight: 44,
              }}
            />
            <button onClick={downloadBackup} title="Download draft backup" style={{
              padding: "10px 12px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, letterSpacing: 1,
              fontFamily: "'Space Mono', monospace", cursor: "pointer", minHeight: 44, whiteSpace: "nowrap",
            }}>⬇ BACKUP</button>
            <label style={{
              padding: "10px 12px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
              color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, letterSpacing: 1,
              fontFamily: "'Space Mono', monospace", cursor: "pointer", minHeight: 44,
              display: "flex", alignItems: "center", whiteSpace: "nowrap",
            }}>
              ⬆ RESTORE
              <input
                type="file" accept="application/json" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ""; }}
              />
            </label>
          </div>

          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.3)",
            fontFamily: "'Space Mono', monospace",
          }}>
            {lastSavedAt ? `Draft saved locally at ${lastSavedAt}` : "Drafts auto-save as you type"} ·
            comments save to the server when you tap SAVE COMMENT inside each item
          </div>
        </div>

        {/* Groups */}
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
