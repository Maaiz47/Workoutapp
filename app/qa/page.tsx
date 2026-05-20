"use client";

import { useState, useEffect, useCallback } from "react";

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

interface QAState {
  items: QAItem[];
}

interface FormItem {
  id: string;
  status: ItemStatus;
  notes: string;
  screenshotUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<ItemStatus, { label: string; color: string; bg: string; border: string }> = {
  untested:          { label: "UNTESTED",         color: "#aaa",    bg: "rgba(255,255,255,0.05)",  border: "rgba(255,255,255,0.12)" },
  passing:           { label: "PASSING",          color: "#4caf50", bg: "rgba(76,175,80,0.1)",     border: "rgba(76,175,80,0.3)" },
  failing:           { label: "FAILING",          color: "#FF6B6B", bg: "rgba(255,107,107,0.1)",   border: "rgba(255,107,107,0.3)" },
  "regression-retest": { label: "RETEST",         color: "#FFB74D", bg: "rgba(255,183,77,0.1)",    border: "rgba(255,183,77,0.3)" },
};

const AREAS = [
  "Auth", "Workout", "Plan", "Trainer", "Messaging",
  "Progress", "Body", "UI", "PWA", "Admin", "Marketing", "Other", "Archived",
];

function StatusBadge({ status }: { status: ItemStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
      fontFamily: "'Space Mono', monospace",
      padding: "3px 8px", borderRadius: 4,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  form,
  onChange,
}: {
  item: QAItem;
  form: FormItem;
  onChange: (id: string, field: keyof FormItem, value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      marginBottom: 8,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "14px 16px", display: "flex", alignItems: "center",
          gap: 10, textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.title}
          </div>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Space Mono', monospace", marginTop: 3,
          }}>
            Last tested: {formatDate(item.lastTested)}
          </div>
        </div>
        <StatusBadge status={form.status} />
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 4 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* Steps */}
          {item.steps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#FF6B6B",
                fontFamily: "'Space Mono', monospace", marginBottom: 8,
              }}>
                STEPS TO TEST
              </div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {item.steps.map((s, i) => (
                  <li key={i} style={{
                    fontSize: 12, color: "rgba(255,255,255,0.7)",
                    fontFamily: "'DM Sans', sans-serif", marginBottom: 5, lineHeight: 1.5,
                  }}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Existing notes */}
          {item.notes && (
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.4)",
              fontFamily: "'DM Sans', sans-serif",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8, padding: "8px 10px", marginBottom: 14,
              lineHeight: 1.5,
            }}>
              {item.notes}
            </div>
          )}

          {/* Status selector */}
          <div style={{ marginBottom: 10 }}>
            <label style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
              fontFamily: "'Space Mono', monospace", display: "block", marginBottom: 5,
            }}>
              STATUS
            </label>
            <select
              value={form.status}
              onChange={e => onChange(item.id, "status", e.target.value)}
              style={{
                width: "100%", background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "9px 12px",
                fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
              }}
            >
              <option value="untested">Untested</option>
              <option value="passing">Passing</option>
              <option value="failing">Failing</option>
              <option value="regression-retest">Regression — needs retest</option>
            </select>
          </div>

          {/* Tester notes textarea */}
          <div style={{ marginBottom: 10 }}>
            <label style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
              fontFamily: "'Space Mono', monospace", display: "block", marginBottom: 5,
            }}>
              NOTES
            </label>
            <textarea
              value={form.notes}
              onChange={e => onChange(item.id, "notes", e.target.value)}
              placeholder="Describe what you observed, any bugs, steps to reproduce…"
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "9px 12px",
                fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                resize: "vertical",
              }}
            />
          </div>

          {/* Screenshot URL */}
          <div>
            <label style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
              fontFamily: "'Space Mono', monospace", display: "block", marginBottom: 5,
            }}>
              SCREENSHOT URL (optional)
            </label>
            <input
              type="url"
              value={form.screenshotUrl}
              onChange={e => onChange(item.id, "screenshotUrl", e.target.value)}
              placeholder="https://…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#111", color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "9px 12px",
                fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Area Group ───────────────────────────────────────────────────────────────

function AreaGroup({
  area,
  items,
  formItems,
  onChange,
}: {
  area: string;
  items: QAItem[];
  formItems: Record<string, FormItem>;
  onChange: (id: string, field: keyof FormItem, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const passing = items.filter(i => formItems[i.id]?.status === "passing").length;
  const failing = items.filter(i => formItems[i.id]?.status === "failing").length;
  const retest = items.filter(i => formItems[i.id]?.status === "regression-retest").length;

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "10px 0", display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
          fontFamily: "'Space Mono', monospace", color: "#FF6B6B",
        }}>
          {area.toUpperCase()}
        </span>
        <span style={{
          fontSize: 10, color: "rgba(255,255,255,0.3)",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {items.length} item{items.length !== 1 ? "s" : ""}
          {passing > 0 && <span style={{ color: "#4caf50", marginLeft: 6 }}>✓{passing}</span>}
          {failing > 0 && <span style={{ color: "#FF6B6B", marginLeft: 6 }}>✗{failing}</span>}
          {retest > 0 && <span style={{ color: "#FFB74D", marginLeft: 6 }}>↺{retest}</span>}
        </span>
        <span style={{
          marginLeft: "auto", color: "rgba(255,255,255,0.25)", fontSize: 11,
        }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          form={formItems[item.id]}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QAPage() {
  const [qaState, setQaState] = useState<QAState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tester, setTester] = useState("");
  const [formItems, setFormItems] = useState<Record<string, FormItem>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/qa")
      .then(r => r.json())
      .then((data: QAState) => {
        setQaState(data);
        const initial: Record<string, FormItem> = {};
        for (const item of data.items) {
          initial[item.id] = {
            id: item.id,
            status: item.status,
            notes: "",
            screenshotUrl: "",
          };
        }
        setFormItems(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback((id: string, field: keyof FormItem, value: string) => {
    setFormItems(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const handleSubmit = async () => {
    if (!tester.trim()) { setError("Please enter your name before submitting."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/qa/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tester: tester.trim(), items: Object.values(formItems) }),
      });
      if (!res.ok) throw new Error("Server error");
      setSubmitted(true);
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const allItems = qaState?.items ?? [];
  const total = allItems.length;
  const passingCount = allItems.filter(i => formItems[i.id]?.status === "passing").length;
  const failingCount = allItems.filter(i => formItems[i.id]?.status === "failing").length;
  const retestCount = allItems.filter(i => formItems[i.id]?.status === "regression-retest").length;
  const pctPassing = total > 0 ? Math.round((passingCount / total) * 100) : 0;

  // ── Group items by area ───────────────────────────────────────────────────
  const grouped = AREAS.map(area => ({
    area,
    items: allItems.filter(i => i.area === area),
  })).filter(g => g.items.length > 0);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", fontSize: 12,
    }}>
      Loading QA state…
    </div>
  );

  return (
    <div style={{
      minHeight: "100dvh", background: "#0a0a0a", color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      padding: "0 0 100px",
    }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(10,10,10,0.92)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "16px 20px 12px",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 2,
            fontFamily: "'Space Mono', monospace", color: "#FF6B6B", marginBottom: 4,
          }}>
            IRONLOG
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            QA Dashboard
          </div>

          {/* Summary pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: `${total} ITEMS`, color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
              { label: `${pctPassing}% PASSING`, color: "#4caf50", bg: "rgba(76,175,80,0.08)", border: "rgba(76,175,80,0.2)" },
              { label: `${failingCount} FAILING`, color: "#FF6B6B", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.2)" },
              { label: `${retestCount} RETEST`, color: "#FFB74D", bg: "rgba(255,183,77,0.08)", border: "rgba(255,183,77,0.2)" },
            ].map(p => (
              <span key={p.label} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                fontFamily: "'Space Mono', monospace",
                padding: "4px 10px", borderRadius: 20,
                color: p.color, background: p.bg, border: `1px solid ${p.border}`,
              }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        {/* Tester name */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)",
            fontFamily: "'Space Mono', monospace", display: "block", marginBottom: 6,
          }}>
            YOUR NAME
          </label>
          <input
            type="text"
            value={tester}
            onChange={e => setTester(e.target.value)}
            placeholder="e.g. Maaiz"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#111", color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: "12px 14px",
              fontSize: 14, fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        {/* Groups */}
        {grouped.map(({ area, items }) => (
          <AreaGroup
            key={area}
            area={area}
            items={items}
            formItems={formItems}
            onChange={handleChange}
          />
        ))}

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)",
            borderRadius: 10, padding: "12px 14px",
            fontSize: 13, color: "#FF6B6B",
            fontFamily: "'DM Sans', sans-serif", marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Submit / confirmation */}
        {submitted ? (
          <div style={{
            background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.25)",
            borderRadius: 12, padding: "20px",
            textAlign: "center",
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "#4caf50",
              fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginBottom: 6,
            }}>
              REPORT SUBMITTED ✓
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif" }}>
              Thank you, {tester}. Your report has been saved.
            </div>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "16px",
              background: submitting ? "rgba(255,107,107,0.3)" : "rgba(255,107,107,0.9)",
              border: "none", borderRadius: 12,
              color: "#fff", fontSize: 14, fontWeight: 700,
              letterSpacing: 1, fontFamily: "'Space Mono', monospace",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {submitting ? "SUBMITTING…" : "SUBMIT REPORT"}
          </button>
        )}
      </div>
    </div>
  );
}
