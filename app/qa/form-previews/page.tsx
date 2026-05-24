"use client";

import { useEffect, useMemo, useState } from "react";
import { EXERCISES } from "@/lib/exercises";
import { WORKOUT_DATA } from "@/lib/workouts";
import { getExerciseImageUrls } from "@/lib/exerciseImages";

// Form-preview review page.
//
// Surfaces every exercise the app might show a form-demo animation
// for (WORKOUT_DATA slot ids + EXERCISES catalog ids), plays its
// 2-frame loop, and lets the reviewer flag wrong ones. Flagged ids
// persist in localStorage and can be copied to clipboard for the
// developer to add to BROKEN_DB_MAPPINGS in lib/exerciseImages.ts.
//
// Why a dedicated page: the prod app has 200+ exercises sourced
// from a remote free-exercise-db with fuzzy name mappings. Manual
// audit one-by-one inside the workout flow is tedious; this page
// lets a reviewer scroll the full library in one session. Lives
// under /qa/form-previews so it's discoverable from the dashboard
// but not in the main app nav.
//
// (qa: form-preview-images-wrong)

type Entry = {
  id: string;
  name: string;
  source: "workout-data" | "exercises";
  urls: [string, string] | null;
};

const FLAG_KEY = "ironlog-form-preview-flags-v1";

function loadFlags(): Record<string, true> {
  try {
    const raw = localStorage.getItem(FLAG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveFlags(flags: Record<string, true>) {
  try { localStorage.setItem(FLAG_KEY, JSON.stringify(flags)); } catch {}
}

// Build a deduped list of every reviewable exercise. WORKOUT_DATA
// uses short slot ids (a1, b1, ...) which the image lookup resolves
// via EXERCISE_DB_MAP — these are the actual ids users see in the
// app, so we audit them first. Then we add EXERCISES catalog entries
// for canonical lookups. Same-name dupes are skipped.
function buildEntries(): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const day of WORKOUT_DATA) {
    for (const sec of day.sections) {
      for (const ex of sec.exercises) {
        const key = `wd:${ex.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: ex.id,
          name: ex.name,
          source: "workout-data",
          urls: getExerciseImageUrls(ex.id, ex.name),
        });
      }
    }
  }
  for (const ex of EXERCISES as any[]) {
    const key = `ex:${ex.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: ex.id,
      name: ex.name,
      source: "exercises",
      urls: getExerciseImageUrls(ex.id, ex.name),
    });
  }
  return out;
}

function AnimatedFrames({ urls, name }: { urls: [string, string]; name: string }) {
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f === 0 ? 1 : 0)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#0a0a0a", borderRadius: 8, overflow: "hidden" }}>
      <img
        src={urls[frame]}
        alt={name}
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div style={{ position: "absolute", top: 4, right: 4, fontSize: 9, fontWeight: 700, color: "#FFD166", background: "rgba(0,0,0,0.7)", padding: "2px 6px", borderRadius: 4, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{frame === 0 ? "START" : "END"}</div>
    </div>
  );
}

export default function FormPreviewsReviewPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with-image" | "no-image" | "flagged">("all");
  const [flags, setFlags] = useState<Record<string, true>>({});

  useEffect(() => { setFlags(loadFlags()); }, []);

  const entries = useMemo(() => buildEntries(), []);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (q && !e.name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q)) return false;
      if (filter === "with-image" && !e.urls) return false;
      if (filter === "no-image" && e.urls) return false;
      if (filter === "flagged" && !flags[e.id]) return false;
      return true;
    });
  }, [entries, search, filter, flags]);

  const totalCount = entries.length;
  const withImage = entries.filter(e => e.urls).length;
  const flagCount = Object.keys(flags).length;

  function toggleFlag(id: string) {
    setFlags(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      saveFlags(next);
      return next;
    });
  }

  async function copyFlagsToClipboard() {
    const ids = Object.keys(flags).sort();
    const dbIdLines = ids.map(id => {
      const ex = entries.find(e => e.id === id);
      if (!ex || !ex.urls) return `// ${id}: no image source`;
      const dbId = ex.urls[0].split("/").slice(-2, -1)[0];
      return `// ${ex.name} (id=${id})\n"${decodeURIComponent(dbId)}",`;
    }).join("\n");
    const out = ids.length === 0 ? "" : `// Flagged ${ids.length} form-preview(s) via /qa/form-previews on ${new Date().toISOString().slice(0,10)}\n${dbIdLines}`;
    try {
      await navigator.clipboard.writeText(out);
      alert(`Copied ${ids.length} flagged ${ids.length === 1 ? "entry" : "entries"} to clipboard.\n\nPaste into BROKEN_DB_MAPPINGS in lib/exerciseImages.ts.`);
    } catch {
      // Fallback: show in a prompt for manual copy
      prompt("Copy this into BROKEN_DB_MAPPINGS:", out);
    }
  }

  function clearAllFlags() {
    if (!confirm("Clear all flags? This won't undo any blacklist changes already shipped — just resets this page's review queue.")) return;
    setFlags({});
    saveFlags({});
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "24px 16px", fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <a href="/qa" style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textDecoration: "none", letterSpacing: 1.5, fontFamily: "'Space Mono', monospace" }}>← QA DASHBOARD</a>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Form-Preview Audit</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", marginTop: 4, letterSpacing: 1 }}>
                {totalCount} exercises · {withImage} with image · {flagCount} flagged
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {flagCount > 0 && (
                <>
                  <button onClick={copyFlagsToClipboard} style={{ padding: "8px 14px", background: "rgba(255,209,102,0.12)", border: "1px solid rgba(255,209,102,0.4)", borderRadius: 999, color: "#FFD166", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", cursor: "pointer" }}>📋 COPY {flagCount} FLAGGED</button>
                  <button onClick={clearAllFlags} style={{ padding: "8px 14px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 999, color: "#FF6B6B", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", cursor: "pointer" }}>CLEAR</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ padding: "12px 14px", background: "rgba(255,209,102,0.05)", border: "1px solid rgba(255,209,102,0.18)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          Scroll through the form-demo animations below. Tap <strong style={{ color: "#FF6B6B" }}>FLAG</strong> on any that don't match the exercise name. When you're done, tap <strong style={{ color: "#FFD166" }}>COPY FLAGGED</strong> to copy the blacklist snippet — paste it into <code style={{ color: "#74b9ff", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>BROKEN_DB_MAPPINGS</code> in <code style={{ color: "#74b9ff", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>lib/exerciseImages.ts</code>.
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or id…"
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "with-image", "no-image", "flagged"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 10px",
                  background: filter === f ? "rgba(78,205,196,0.18)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filter === f ? "rgba(78,205,196,0.45)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 6,
                  color: filter === f ? "#4ECDC4" : "rgba(255,255,255,0.5)",
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >{f.toUpperCase().replace("-", " ")}</button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {visible.map(ex => (
            <div key={`${ex.source}:${ex.id}`} style={{
              background: flags[ex.id] ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${flags[ex.id] ? "rgba(255,107,107,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 10,
              overflow: "hidden",
              display: "flex", flexDirection: "column",
            }}>
              {ex.urls ? (
                <AnimatedFrames urls={ex.urls} name={ex.name} />
              ) : (
                <div style={{ aspectRatio: "1 / 1", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>NO IMAGE</div>
              )}
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2, wordBreak: "break-word" }}>{ex.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace", letterSpacing: 0.5, marginBottom: 8 }}>
                  {ex.id} · {ex.source === "workout-data" ? "WD" : "CAT"}
                </div>
                <button
                  onClick={() => toggleFlag(ex.id)}
                  disabled={!ex.urls}
                  style={{
                    width: "100%",
                    padding: "7px",
                    background: flags[ex.id] ? "rgba(255,107,107,0.25)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${flags[ex.id] ? "rgba(255,107,107,0.55)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6,
                    color: flags[ex.id] ? "#FF6B6B" : ex.urls ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                    fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", cursor: ex.urls ? "pointer" : "not-allowed",
                  }}
                >{flags[ex.id] ? "✓ FLAGGED" : ex.urls ? "FLAG WRONG" : "—"}</button>
              </div>
            </div>
          ))}
        </div>
        {visible.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No exercises match the current filter.</div>
        )}
      </div>
    </div>
  );
}
