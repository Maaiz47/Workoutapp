"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { WORKOUT_DATA, WorkoutDay } from "../lib/workouts";

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

// ─── ANALYTICS HELPERS ──────────────────────────────────────────────────
function getExerciseStats(history: Record<string, any[]>, dayId: string, exId: string) {
  const sessions = history[dayId] || [];
  const dataPoints: { date: string; avgWeight: number; maxWeight: number; totalVolume: number; avgReps: number; setCount: number }[] = [];

  for (const s of sessions) {
    const sets = s.sets as Record<string, { weight: number; reps: number }>;
    let weights: number[] = [], reps: number[] = [], volume = 0, count = 0;
    for (const k in sets) {
      if (k.startsWith(exId + "-")) {
        weights.push(sets[k].weight);
        reps.push(sets[k].reps);
        volume += sets[k].weight * sets[k].reps;
        count++;
      }
    }
    if (count > 0) {
      dataPoints.push({
        date: s.date,
        avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
        maxWeight: Math.max(...weights),
        totalVolume: volume,
        avgReps: reps.reduce((a, b) => a + b, 0) / reps.length,
        setCount: count,
      });
    }
  }
  return dataPoints.reverse(); // chronological
}

function getOverallStats(history: Record<string, any[]>) {
  let totalSessions = 0;
  const exercisePRs: Record<string, { weight: number; date: string }> = {};
  const allSessions: { date: string; duration: string }[] = [];

  for (const dayId in history) {
    for (const s of history[dayId]) {
      totalSessions++;
      allSessions.push({ date: s.date, duration: s.duration });
      const sets = s.sets as Record<string, { weight: number; reps: number }>;
      for (const k in sets) {
        const eid = k.split("-").slice(0, -1).join("-");
        if (!exercisePRs[eid] || sets[k].weight > exercisePRs[eid].weight) {
          exercisePRs[eid] = { weight: sets[k].weight, date: s.date };
        }
      }
    }
  }

  // This week count
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const thisWeek = allSessions.filter(s => new Date(s.date) >= startOfWeek).length;

  // Streak: consecutive weeks with at least 1 session
  const weekSets = new Set<string>();
  for (const s of allSessions) {
    const d = new Date(s.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    weekSets.add(weekStart.toISOString().slice(0, 10));
  }
  const sortedWeeks = Array.from(weekSets).sort().reverse();
  let streak = 0;
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  let checkWeek = new Date(currentWeekStart);
  for (let i = 0; i < sortedWeeks.length; i++) {
    const weekStr = checkWeek.toISOString().slice(0, 10);
    if (sortedWeeks.includes(weekStr)) {
      streak++;
      checkWeek.setDate(checkWeek.getDate() - 7);
    } else break;
  }

  // Average session duration
  let totalMinutes = 0, durationCount = 0;
  for (const s of allSessions) {
    if (s.duration && s.duration !== "00:00:00") {
      const parts = s.duration.split(":");
      totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
      durationCount++;
    }
  }
  const avgMinutes = durationCount > 0 ? Math.round(totalMinutes / durationCount) : 0;

  // Last 28 days activity (for calendar view)
  const last28: boolean[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    last28.push(allSessions.some(s => s.date === dateStr));
  }

  return { totalSessions, exercisePRs, thisWeek, streak, avgMinutes, last28 };
}

// Mini bar chart component
function MiniChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
        {data.slice(-12).map((v, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 4, borderRadius: 2,
            height: `${Math.max(8, ((v - min) / range) * 100)}%`,
            background: i === data.length - 1 || i === data.slice(-12).length - 1
              ? color
              : `${color}40`,
            transition: "height 0.3s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>{data.slice(-12)[0]?.toFixed(1)}</span>
        <span style={{ fontSize: 9, color, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{data[data.length - 1]?.toFixed(1)}</span>
      </div>
    </div>
  );
}

// Trend indicator
function Trend({ current, previous, unit = "kg" }: { current: number; previous: number; unit?: string }) {
  if (!previous || !current) return null;
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  const up = diff > 0;
  if (diff === 0) return <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>—</span>;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace",
      color: up ? "#2ecc71" : "#FF6B6B",
      background: up ? "#2ecc7115" : "#FF6B6B15",
      padding: "2px 6px", borderRadius: 4,
    }}>
      {up ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}{unit} ({up ? "+" : ""}{pct}%)
    </span>
  );
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
  const [progressTab, setProgressTab] = useState<"dashboard" | "exercises" | "history">("dashboard");
  const [selectedExDay, setSelectedExDay] = useState<string | null>(null);

  const rest = useCountdown();
  const timer = useTimer();

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (data.user) setUser(data.user);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

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
  const lastReps = (eid: string): string | number => {
    for (const dk in history) for (const s of (history[dk] || [])) for (const sk in s.sets)
      if (sk.startsWith(eid + "-") && s.sets[sk].reps > 0) return s.sets[sk].reps;
    return "";
  };

  const overall = useMemo(() => getOverallStats(history), [history]);
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
        <button className="card-hover" onClick={() => { setView("progress"); setProgressTab("dashboard"); }} style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>VIEW PROGRESS →</button>
      </div>
    </div>
  );

  // ─── PROGRESS DASHBOARD ─────────────────────────────────────────────
  if (view === "progress") {
    const findExName = (eid: string) => {
      for (const d of WORKOUT_DATA) for (const s of d.sections) for (const e of s.exercises) if (e.id === eid) return e.name;
      return eid;
    };

    // Get top PRs
    const prList = Object.entries(overall.exercisePRs)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 8);

    // Day labels for 28-day calendar
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
        <div style={{ padding: "24px 20px 0" }}>
          <button onClick={() => { setView("home"); setOpenHist(null); setSelectedExDay(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 12, letterSpacing: 1 }}>Progress</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "16px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {(["dashboard", "exercises", "history"] as const).map(tab => (
            <button key={tab} onClick={() => setProgressTab(tab)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: progressTab === tab ? "2px solid #FF6B6B" : "2px solid transparent",
              color: progressTab === tab ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 11, fontWeight: 600, letterSpacing: 2, cursor: "pointer",
              fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
              transition: "all 0.2s",
            }}>{tab}</button>
          ))}
        </div>

        {/* ─── DASHBOARD TAB ─────────────────────────────────────────── */}
        {progressTab === "dashboard" && (
          <div className="fade-in" style={{ padding: "20px 20px 0" }}>
            {/* Overview Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "THIS WEEK", value: `${overall.thisWeek}/5`, color: overall.thisWeek >= 5 ? "#2ecc71" : overall.thisWeek >= 3 ? "#f0c040" : "#FF6B6B" },
                { label: "STREAK", value: `${overall.streak}w`, color: "#4ECDC4" },
                { label: "AVG TIME", value: overall.avgMinutes > 0 ? `${overall.avgMinutes}m` : "—", color: "#A29BFE" },
              ].map((card, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: "16px 12px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{card.value}</div>
                  <div style={{ fontSize: 8, color: card.color, letterSpacing: 2, marginTop: 4, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* 28-Day Activity Calendar */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>LAST 4 WEEKS</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>
                  {overall.last28.filter(Boolean).length} days trained
                </div>
              </div>
              {/* Day of week headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {dayLabels.map((l, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>{l}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {overall.last28.map((active, i) => {
                  const isToday = i === 27;
                  return (
                    <div key={i} style={{
                      aspectRatio: "1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      background: active ? "linear-gradient(135deg, #FF6B6B, #ee5a24)" : "rgba(255,255,255,0.03)",
                      border: isToday ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                      opacity: active ? 1 : 0.4,
                    }}>
                      {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personal Records */}
            {prList.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 14 }}>PERSONAL RECORDS</div>
                {prList.map(([eid, pr], i) => (
                  <div key={eid} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i < prList.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{findExName(eid)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{pr.date}</div>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, color: "#f0c040",
                      fontFamily: "'Space Mono', monospace",
                    }}>{pr.weight}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>kg</span></div>
                  </div>
                ))}
              </div>
            )}

            {overall.totalSessions === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                Complete your first workout to see analytics here
              </div>
            )}
          </div>
        )}

        {/* ─── EXERCISES TAB ─────────────────────────────────────────── */}
        {progressTab === "exercises" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>
            {WORKOUT_DATA.map(d => (
              <div key={d.id} style={{ marginBottom: 8 }}>
                <div className="card-hover" onClick={() => setSelectedExDay(selectedExDay === d.id ? null : d.id)}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                      <span style={{ color: d.color, marginRight: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{d.label}</span>{d.title}
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14, transition: "transform 0.2s", transform: selectedExDay === d.id ? "rotate(90deg)" : "none" }}>›</span>
                  </div>
                </div>

                {selectedExDay === d.id && d.sections.map(sec => sec.exercises.filter(ex => ex.trackable !== false).map(ex => {
                  const stats = getExerciseStats(history, d.id, ex.id);
                  if (stats.length === 0) return (
                    <div key={ex.id} className="fade-in" style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, margin: "4px 0" }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{ex.name}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>No data yet</div>
                    </div>
                  );

                  const latest = stats[stats.length - 1];
                  const prev = stats.length > 1 ? stats[stats.length - 2] : null;

                  return (
                    <div key={ex.id} className="fade-in" style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 12, padding: "16px", margin: "4px 0",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{ex.name}</div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>AVG WEIGHT</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{latest.avgWeight.toFixed(1)}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>kg</span></div>
                          {prev && <Trend current={latest.avgWeight} previous={prev.avgWeight} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>AVG REPS</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{latest.avgReps.toFixed(1)}</div>
                          {prev && <Trend current={latest.avgReps} previous={prev.avgReps} unit="" />}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>VOLUME</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{latest.totalVolume > 999 ? `${(latest.totalVolume / 1000).toFixed(1)}k` : latest.totalVolume}</div>
                          {prev && <Trend current={latest.totalVolume} previous={prev.totalVolume} unit="" />}
                        </div>
                      </div>

                      <MiniChart data={stats.map(s => s.avgWeight)} color={d.color} label="WEIGHT TREND" />
                      <MiniChart data={stats.map(s => s.totalVolume)} color="#A29BFE" label="VOLUME TREND" />
                    </div>
                  );
                }))}
              </div>
            ))}
          </div>
        )}

        {/* ─── HISTORY TAB ───────────────────────────────────────────── */}
        {progressTab === "history" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>
            {WORKOUT_DATA.map(d => (
              <div key={d.id} style={{ marginBottom: 4 }}>
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
                  <div key={si} className="fade-in" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "14px 16px", margin: "4px 0", borderLeft: `3px solid ${d.color}30` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{s.date}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4 }}>{s.duration}</div>
                    </div>
                    <div>
                      {Object.entries(s.sets as Record<string, { weight: number; reps: number }>).map(([k, v]) => {
                        const eid = k.split("-").slice(0, -1).join("-"), sn = k.split("-").pop();
                        let en = eid; for (const sec of d.sections) for (const ex of sec.exercises) if (ex.id === eid) en = ex.name;
                        return <div key={k} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                          {en} <span style={{ color: "rgba(255,255,255,0.2)" }}>S{sn}</span> <span style={{ color: "#fff", fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>{v.weight}kg × {v.reps}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
              const lr = lastReps(ex.id);

              return (
                <div key={ex.id} className="fade-in">
                  <div onClick={() => { if (!trackable || allDone) return; setExpanded(isExp ? null : ex.id); setWInput(lw !== "" ? String(lw) : ""); setRInput(lr !== "" ? String(lr) : ""); }}
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
                      <button onClick={() => { logSet(ex.id, ns, wInput, rInput); if (ns + 1 > ex.sets) setExpanded(null); if (ex.rest) rest.start(ex.rest); }}
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
