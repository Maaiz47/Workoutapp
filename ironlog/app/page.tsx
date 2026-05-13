"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WORKOUT_DATA, WorkoutDay } from "@/lib/workouts";

// ─── HOOKS ──────────────────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const o = audioCtx.current.createOscillator(), g = audioCtx.current.createGain();
      o.connect(g); g.connect(audioCtx.current.destination);
      o.frequency.value = 880; g.gain.value = 0.3; o.start(); o.stop(audioCtx.current.currentTime + 0.15);
    } catch {}
  }, []);
  const start = useCallback((s: number) => {
    if (ref.current) clearInterval(ref.current);
    setSeconds(s); setRunning(true);
    ref.current = setInterval(() => setSeconds(p => { if (p <= 1) { clearInterval(ref.current!); setRunning(false); beep(); return 0; } return p - 1; }), 1000);
  }, [beep]);
  const stop = useCallback(() => { if (ref.current) clearInterval(ref.current); setRunning(false); setSeconds(0); }, []);
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  return { seconds, running, start, stop };
}

function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const startT = useCallback(() => { setElapsed(0); ref.current = setInterval(() => setElapsed(p => p + 1), 1000); }, []);
  const stopT = useCallback(() => { if (ref.current) clearInterval(ref.current); }, []);
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  const fmt = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return { elapsed, startT, stopT, fmt };
}

// ─── MAIN ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [view, setView] = useState("home");
  const [activeDay, setActiveDay] = useState<WorkoutDay | null>(null);
  const [started, setStarted] = useState(false);
  const [log, setLog] = useState<Record<string, { weight: number; reps: number }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wInput, setWInput] = useState("");
  const [rInput, setRInput] = useState("");
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [openHist, setOpenHist] = useState<string | null>(null);

  const rest = useCountdown();
  const timer = useTimer();

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (data.user) setUser(data.user);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

  // Load history when logged in
  useEffect(() => {
    if (user) {
      fetch("/api/workout").then(r => r.json()).then(data => {
        if (!data.error) setHistory(data);
      }).catch(() => {});
    }
  }, [user]);

  const doLogin = async () => {
    if (!nameInput.trim()) return;
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: nameInput.trim() }),
      });
      const data = await res.json();
      if (data.error) { setAuthError(data.error); return; }
      setUser(data);
    } catch { setAuthError("Something went wrong"); }
  };

  const doLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setUser(null); setView("home"); setActiveDay(null); timer.stopT();
  };

  const openDay = (d: WorkoutDay) => { setActiveDay(d); setView("workout"); setLog({}); setExpanded(null); setStarted(false); };
  const begin = () => { setStarted(true); timer.startT(); };

  const finish = async () => {
    timer.stopT();
    if (Object.keys(log).length > 0 && activeDay) {
      try {
        await fetch("/api/workout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayId: activeDay.id, duration: timer.fmt, sets: log }),
        });
        const res = await fetch("/api/workout");
        const data = await res.json();
        if (!data.error) setHistory(data);
      } catch {}
    }
    setView("home"); setActiveDay(null); setLog({});
  };

  const logSet = (eid: string, sn: number, w: string, r: string) =>
    setLog({ ...log, [`${eid}-${sn}`]: { weight: parseFloat(w) || 0, reps: parseInt(r) || 0 } });

  const doneCount = (eid: string, total: number) => {
    let c = 0; for (let i = 1; i <= total; i++) if (log[`${eid}-${i}`]) c++; return c;
  };
  const nextSetNum = (eid: string, total: number) => {
    for (let i = 1; i <= total; i++) if (!log[`${eid}-${i}`]) return i; return null;
  };
  const lastWeight = (eid: string): string | number => {
    for (const dk in history) for (const s of (history[dk] || [])) for (const sk in s.sets)
      if (sk.startsWith(eid + "-") && s.sets[sk].weight > 0) return s.sets[sk].weight;
    return "";
  };

  const bc: Record<string, string> = { compound: "#2ecc71", isolation: "#74b9ff", cardio: "#FF6B6B" };

  // ─── LOADING ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ color: "#555", fontSize: 13, letterSpacing: 4, fontFamily: "'Space Mono', monospace" }}>IRONLOG</div>
    </div>
  );

  // ─── LOGIN ──────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div className="slide-up" style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 42, fontWeight: 700, letterSpacing: 8, color: "#fff", marginBottom: 4 }}>
          IRON<span style={{ color: "#FF6B6B" }}>LOG</span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: 6, fontWeight: 300, marginBottom: 56 }}>TRACK · LIFT · PROGRESS</div>
        <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="Enter your name" autoFocus
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 16, fontFamily: "'DM Sans', sans-serif", padding: "16px 24px", width: "100%", maxWidth: 300, textAlign: "center", outline: "none" }} />
        {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 12 }}>{authError}</div>}
        <button onClick={doLogin} style={{
          display: "block", width: "100%", maxWidth: 300, margin: "20px auto 0", padding: "16px",
          background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12,
          color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>GET STARTED</button>
      </div>
    </div>
  );

  // ─── HOME ───────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 20px 0" }}>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 300 }}>Welcome back</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginTop: 2 }}>{user.username}</div>
        </div>
        <button onClick={doLogout} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", letterSpacing: 1 }}>LOG OUT</button>
      </div>
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>YOUR SPLIT</div>
        {WORKOUT_DATA.map((d, i) => (
          <div key={d.id} className="card-hover fade-in" style={{ animationDelay: `${i * 0.06}s`, marginBottom: 10, cursor: "pointer" }} onClick={() => openDay(d)}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: d.gradient, borderRadius: "16px 0 0 16px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: d.color, fontWeight: 700, opacity: 0.7 }}>{d.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{d.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, fontWeight: 300 }}>{d.focus}</div>
                  {history[d.id]?.[0] && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 10, fontFamily: "'Space Mono', monospace" }}>Last: {history[d.id][0].date} · {history[d.id][0].duration}</div>}
                </div>
                <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 20 }}>›</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 20px 0" }}>
        <button className="card-hover" onClick={() => setView("progress")} style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>VIEW PROGRESS →</button>
      </div>
    </div>
  );

  // ─── PROGRESS ───────────────────────────────────────────────────────
  if (view === "progress") return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
      <div style={{ padding: "24px 20px" }}>
        <button onClick={() => { setView("home"); setOpenHist(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginTop: 12 }}>Progress</div>
      </div>
      {WORKOUT_DATA.map(d => (
        <div key={d.id} style={{ padding: "0 20px", marginBottom: 4 }}>
          <div className="card-hover" onClick={() => setOpenHist(openHist === d.id ? null : d.id)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}><span style={{ color: d.color, marginRight: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{d.label}</span>{d.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{history[d.id] ? `${history[d.id].length} session${history[d.id].length !== 1 ? "s" : ""}` : "No sessions yet"}</div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14, transition: "transform 0.2s", transform: openHist === d.id ? "rotate(90deg)" : "none" }}>›</span>
            </div>
          </div>
          {openHist === d.id && history[d.id]?.map((s: any, si: number) => (
            <div key={si} className="fade-in" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "14px 18px", margin: "2px 0", borderLeft: `2px solid ${d.color}30` }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace" }}>{s.date} · {s.duration}</div>
              <div style={{ marginTop: 8 }}>
                {Object.entries(s.sets as Record<string, { weight: number; reps: number }>).map(([k, v]) => {
                  const eid = k.split("-").slice(0, -1).join("-"), sn = k.split("-").pop();
                  let en = eid; for (const sec of d.sections) for (const ex of sec.exercises) if (ex.id === eid) en = ex.name;
                  return <div key={k} style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>{en} Set {sn}: <span style={{ color: "#fff", fontWeight: 500 }}>{v.weight}kg × {v.reps}</span></div>;
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ─── WORKOUT ────────────────────────────────────────────────────────
  if (view === "workout" && activeDay) {
    if (!started) {
      const tEx = activeDay.sections.reduce((t, s) => t + s.exercises.filter(e => e.trackable !== false).length, 0);
      const tSets = activeDay.sections.reduce((t, s) => t + s.exercises.filter(e => e.trackable !== false).reduce((a, e) => a + e.sets, 0), 0);
      return (
        <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "80vw", borderRadius: "50%", background: `radial-gradient(circle, ${activeDay.color}12 0%, transparent 60%)`, pointerEvents: "none", animation: "breathe 4s ease infinite" }} />
          <div className="slide-up" style={{ zIndex: 1 }}>
            <button onClick={() => { setView("home"); setActiveDay(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 48 }}>← Back</button>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: activeDay.color, letterSpacing: 4, marginBottom: 12, opacity: 0.7 }}>DAY {activeDay.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>{activeDay.title}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 8, fontWeight: 300 }}>{activeDay.focus}</div>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 32 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{tEx}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>EXERCISES</div></div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{tSets}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 2 }}>TOTAL SETS</div></div>
            </div>
            <button onClick={begin} style={{ marginTop: 48, padding: "18px 56px", background: activeDay.gradient, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: 3, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", boxShadow: `0 8px 32px ${activeDay.color}30` }}>START WORKOUT</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
        {rest.running && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(20px)" }}>
            <div style={{ fontSize: 12, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>REST</div>
            <div style={{ fontSize: 96, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", animation: "countPulse 1s ease infinite" }}>{rest.seconds}</div>
            <button onClick={rest.stop} style={{ marginTop: 40, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 36px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", letterSpacing: 2, cursor: "pointer" }}>SKIP</button>
          </div>
        )}
        <div style={{ padding: "20px 20px 16px", background: `linear-gradient(180deg, ${activeDay.color}10, transparent)`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <button onClick={finish} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← End & Save</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 8 }}>{activeDay.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 300 }}>{activeDay.focus}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>{timer.fmt}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 3, fontFamily: "'Space Mono', monospace" }}>SESSION</div>
        </div>

        {activeDay.sections.map((sec, si) => (
          <div key={si}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "rgba(255,255,255,0.3)", padding: "22px 20px 10px", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>{sec.name.toUpperCase()}</div>
            {sec.exercises.map(ex => {
              const trackable = ex.trackable !== false;
              const done = doneCount(ex.id, ex.sets);
              const allDone = done >= ex.sets;
              const ns = nextSetNum(ex.id, ex.sets);
              const isExp = expanded === ex.id;
              const lw = lastWeight(ex.id);

              return (
                <div key={ex.id} className="fade-in">
                  <div onClick={() => { if (!trackable || allDone) return; setExpanded(isExp ? null : ex.id); setWInput(lw !== "" ? String(lw) : ""); setRInput(""); }}
                    style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: allDone ? 0.3 : 1, cursor: trackable ? "pointer" : "default", transition: "opacity 0.3s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>{ex.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: bc[ex.type] || "#888", opacity: 0.7, letterSpacing: 1 }}>{ex.type.toUpperCase()}</span>
                      </div>
                      {allDone && <span style={{ fontSize: 16, color: "#2ecc71" }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 300 }}>
                      {trackable ? `${ex.sets} × ${ex.reps}` : ex.reps}{ex.rest ? ` · ${ex.rest}s rest` : ""}
                    </div>
                    {ex.note && <div style={{ fontSize: 11, color: "#f0c040", marginTop: 5, fontStyle: "italic", opacity: 0.8 }}>{ex.note}</div>}
                    {trackable && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        {Array.from({ length: ex.sets }, (_, i) => {
                          const d = !!log[`${ex.id}-${i + 1}`], c = i + 1 === ns;
                          return <div key={i} style={{
                            width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 600, fontFamily: "'Space Mono', monospace",
                            background: d ? "#2ecc7120" : c ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                            color: d ? "#2ecc71" : c ? "#fff" : "rgba(255,255,255,0.25)",
                            border: c ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                          }}>{d ? "✓" : i + 1}</div>;
                        })}
                      </div>
                    )}
                  </div>

                  {isExp && trackable && ns && (
                    <div className="fade-in" style={{ padding: "18px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 14, fontWeight: 500 }}>
                        Set {ns} of {ex.sets}
                        {lw && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>Last: {lw}kg</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>WEIGHT (kg/side)</div>
                          <input type="number" inputMode="decimal" value={wInput} onChange={e => setWInput(e.target.value)} placeholder="0"
                            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 20, fontFamily: "'Space Mono', monospace", padding: "12px", textAlign: "center", outline: "none" }} />
                          {(() => {
                            const cur = parseFloat(wInput), prev = parseFloat(String(lw));
                            if (!cur || !prev || cur === prev) return null;
                            const diff = cur - prev, pct = ((diff / prev) * 100).toFixed(1), up = diff > 0;
                            return <div style={{ marginTop: 8, textAlign: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: up ? "#2ecc71" : "#FF6B6B", background: up ? "#2ecc7118" : "#FF6B6B18", padding: "4px 10px", borderRadius: 6 }}>
                                {up ? "▲" : "▼"} {up ? "+" : ""}{diff}kg ({up ? "+" : ""}{pct}%)
                              </span>
                            </div>;
                          })()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>REPS DONE</div>
                          <input type="number" inputMode="numeric" value={rInput} onChange={e => setRInput(e.target.value)} placeholder="0"
                            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 20, fontFamily: "'Space Mono', monospace", padding: "12px", textAlign: "center", outline: "none" }} />
                        </div>
                      </div>
                      <button onClick={() => { logSet(ex.id, ns, wInput, rInput); if (ns + 1 > ex.sets) setExpanded(null); if (ex.rest) rest.start(ex.rest); setRInput(""); }}
                        style={{ width: "100%", padding: "14px", background: activeDay.gradient, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: (!wInput && !rInput) ? 0.4 : 1 }}>
                        LOG SET {ns}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ padding: 20 }}>
          <button onClick={finish} style={{ width: "100%", padding: "16px", background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 12, color: "#FF6B6B", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>FINISH WORKOUT</button>
        </div>
      </div>
    );
  }

  return null;
}
