"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { WORKOUT_DATA, WorkoutDay } from "../lib/workouts";
import { EXERCISES } from "../lib/exercises";
import { getExerciseImageUrls } from "../lib/exerciseImages";
import { MUSCLE_DETAIL, lookupMuscleDetail } from "../lib/muscleDetail";

const VAPID_PUBLIC_KEY = "BOhlYEJGvtpt4q1HA9DkjMDIvNpj-Yh9ia8Jffoy1ETlCMDxzqUDJzXMRSE1ByqbHooHvqHRmTW47G_osz8P5p4";

const SUB_MUSCLE_LABELS: Record<string, string> = {
  "chest-upper": "Upper Chest", "chest-mid": "Mid Chest", "chest-lower": "Lower Chest", "chest-inner": "Inner Chest",
  "shoulders-front": "Anterior Delt", "shoulders-side": "Lateral Delt", "shoulders-rear": "Posterior Delt",
  "biceps-long": "Long Head", "biceps-short": "Short Head", "brachialis": "Brachialis",
  "back-lats": "Latissimus Dorsi", "back-traps-upper": "Upper Trapezius", "back-traps-mid": "Mid Traps",
  "back-lower": "Erector Spinae", "back-teres": "Teres Major",
  "triceps-long": "Long Head", "triceps-lateral": "Lateral Head", "triceps-medial": "Medial Head",
  "quads-outer": "Vastus Lateralis", "quads-rectus": "Rectus Femoris", "quads-inner": "VMO",
  "hamstrings-outer": "Biceps Femoris", "hamstrings-inner": "Semimembranosus",
  "calves-gastroc": "Gastrocnemius", "calves-soleus": "Soleus",
  "glutes-max": "Gluteus Maximus", "glutes-med": "Gluteus Medius",
  "core-abs-upper": "Upper Abs", "core-abs-lower": "Lower Abs", "core-obliques": "Obliques", "core-serratus": "Serratus",
  "forearm-flexor": "Flexors", "forearm-extensor": "Extensors",
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)));
}

async function subscribeToPush(): Promise<"granted" | "denied" | "unsupported" | "error"> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    // Ensure SW is registered (safe to call if already registered)
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok ? "granted" : "error";
  } catch {
    return "error";
  }
}

// ─── HOOKS ──────────────────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const endTimeRef = useRef<number | null>(null);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const notifiedRef = useRef(false);

  // Request notification permission and register service worker
  const requestNotifPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {}
    }
  }, []);

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.3; o.start(); o.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        try {
          const o2 = ctx.createOscillator(), g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.frequency.value = 1100; g2.gain.value = 0.3; o2.start(); o2.stop(ctx.currentTime + 0.15);
        } catch {}
      }, 250);
    } catch {}
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
  }, []);

  const sendNotification = useCallback(async () => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    // Use service worker for reliable background notifications
    if ("serviceWorker" in navigator && Notification.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "REST_DONE" });
        return;
      } catch {}
    }
    // Fallback to regular notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("IRONLOG", {
          body: "Rest over — time for your next set 💪",
          tag: "ironlog-rest",
        });
      } catch {}
    }
  }, []);

  const finish = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
    setRunning(false);
    setSeconds(0);
    endTimeRef.current = null;
    beep();
    sendNotification();
  }, [beep, sendNotification]);

  const start = useCallback((secs: number) => {
    requestNotifPermission();
    if (ref.current) clearInterval(ref.current);
    notifiedRef.current = false;
    const endTime = Date.now() + secs * 1000;
    endTimeRef.current = endTime;
    setSeconds(secs);
    setRunning(true);

    ref.current = setInterval(() => {
      const remaining = Math.ceil((endTimeRef.current! - Date.now()) / 1000);
      if (remaining <= 0) {
        finish();
      } else {
        setSeconds(remaining);
      }
    }, 250); // Check 4x per second for accuracy after background
  }, [finish, requestNotifPermission]);

  const stop = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
    setRunning(false);
    setSeconds(0);
    endTimeRef.current = null;
  }, []);

  // Handle coming back from background — check if timer expired while away
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && endTimeRef.current) {
        const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          finish();
        } else {
          setSeconds(remaining);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (ref.current) clearInterval(ref.current);
    };
  }, [finish]);

  return { seconds, running, start, stop };
}

function useTimer() {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    if (startTime) setElapsed(Math.floor((Date.now() - startTime) / 1000));
  }, [startTime]);

  const startT = useCallback(() => {
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
  }, []);

  const stopT = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
    setStartTime(null);
  }, []);

  // Update every second, and also on visibility change (when user comes back to tab)
  useEffect(() => {
    if (!startTime) return;
    ref.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && startTime) {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (ref.current) clearInterval(ref.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startTime]);

  const resumeT = useCallback((savedStart: number) => {
    setStartTime(savedStart);
    setElapsed(Math.floor((Date.now() - savedStart) / 1000));
  }, []);

  const fmt = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return { elapsed, startT, resumeT, stopT, fmt };
}

function useSwipeBack(onBack: () => void, enabled: boolean) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      active = startX < 60;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dx > 60 && dy < dx * 0.7) onBackRef.current();
    };

    const onTouchCancel = () => { active = false; };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled]);
}

// ─── ANALYTICS HELPERS ──────────────────────────────────────────────────
function getExerciseStats(history: Record<string, any[]>, dayId: string, exId: string) {
  const sessions = history[dayId] || [];
  const dataPoints: { date: string; avgWeight: number; maxWeight: number; totalVolume: number; avgReps: number; setCount: number }[] = [];
  let pbWeight = 0, pbReps = 0, pbDate = "";

  for (const s of sessions) {
    const sets = s.sets as Record<string, { weight: number; reps: number }>;
    let weights: number[] = [], reps: number[] = [], volume = 0, count = 0;
    for (const k in sets) {
      if (k.startsWith(exId + "-")) {
        weights.push(sets[k].weight);
        reps.push(sets[k].reps);
        volume += sets[k].weight * sets[k].reps;
        count++;
        // Track PB: highest weight, and if tied, most reps at that weight
        if (sets[k].weight > pbWeight || (sets[k].weight === pbWeight && sets[k].reps > pbReps)) {
          pbWeight = sets[k].weight;
          pbReps = sets[k].reps;
          pbDate = s.date;
        }
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
  return { dataPoints: dataPoints.reverse(), pb: { weight: pbWeight, reps: pbReps, date: pbDate } };
}

function getOverallStats(history: Record<string, any[]>) {
  let totalSessions = 0;
  const exercisePRs: Record<string, { weight: number; reps: number; date: string }> = {};
  const allSessions: { date: string; duration: string }[] = [];

  for (const dayId in history) {
    for (const s of history[dayId]) {
      totalSessions++;
      allSessions.push({ date: s.date, duration: s.duration });
      const sets = s.sets as Record<string, { weight: number; reps: number }>;
      for (const k in sets) {
        const eid = k.split("-").slice(0, -1).join("-");
        const { weight, reps } = sets[k];
        if (!exercisePRs[eid] || weight > exercisePRs[eid].weight || (weight === exercisePRs[eid].weight && reps > exercisePRs[eid].reps)) {
          exercisePRs[eid] = { weight, reps, date: s.date };
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
  // Today is always the last cell. We show 28 days ending today.
  // The grid is 7 columns (S M T W T F S). 
  // We need to figure out which column today falls in, then pad the first row
  // so that 28 days ago lands on its correct weekday.
  const calendarDays: { active: boolean; isToday: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    calendarDays.push({
      active: allSessions.some(s => s.date === dateStr),
      isToday: i === 0,
    });
  }
  // 28 days ago - what day of week was it?
  const firstDate = new Date(now);
  firstDate.setDate(firstDate.getDate() - 27);
  const calendarPadding = firstDate.getDay(); // 0=Sun, pad that many empty cells before

  return { totalSessions, exercisePRs, thisWeek, streak, avgMinutes, calendarDays, calendarPadding };
}

// Mini bar chart component
function BodyTrendChart({ items, color, unit }: { items: { value: number; date: string }[]; color: string; unit: string }) {
  if (items.length < 2) return null;
  const W = 320, H = 90, PL = 36, PR = 8, PT = 10, PB = 22;
  const times = items.map(i => new Date(i.date).getTime());
  const minT = Math.min(...times), maxT = Math.max(...times);
  const tRange = maxT - minT || 1;
  const vals = items.map(i => i.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const vRange = maxV - minV || 1;
  const cx = (d: string) => PL + ((new Date(d).getTime() - minT) / tRange) * (W - PL - PR);
  const cy = (v: number) => PT + ((maxV - v) / vRange) * (H - PT - PB);
  const pathD = items.map((it, i) => `${i === 0 ? "M" : "L"}${cx(it.date).toFixed(1)},${cy(it.value).toFixed(1)}`).join(" ");
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  // Candidate label positions: first, second-to-last, last
  const LABEL_MIN_GAP = 38; // min px between label centres before suppressing
  const candidates = items.length === 2
    ? [0, items.length - 1]
    : [0, items.length - 2, items.length - 1];
  const uniqueCandidates = candidates.filter((v, i, a) => a.indexOf(v) === i);
  // Collision filter: left-to-right, skip any label whose x is within MIN_GAP of the last drawn
  const visibleIdxs: number[] = [];
  let lastX = -Infinity;
  for (const idx of uniqueCandidates) {
    const x = Math.max(PL, Math.min(W - PR, cx(items[idx].date)));
    if (x - lastX >= LABEL_MIN_GAP) { visibleIdxs.push(idx); lastX = x; }
  }
  // If only 1 survives and we had 2 candidates, still try to render just 1 centred label
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
      <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x={PL - 4} y={PT + 5} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end" fontFamily="monospace">{maxV.toFixed(1)}</text>
      {vRange > 0 && <text x={PL - 4} y={H - PB} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="end" fontFamily="monospace">{minV.toFixed(1)}</text>}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return <circle key={i} cx={cx(it.date)} cy={cy(it.value)} r={isLast ? 4 : 2.5} fill={isLast ? color : `${color}70`} />;
      })}
      {visibleIdxs.map((idx, i) => {
        const it = items[idx];
        const x = Math.max(PL, Math.min(W - PR, cx(it.date)));
        const anchor = i === 0 ? "start" : i === visibleIdxs.length - 1 ? "end" : "middle";
        return <text key={idx} x={x} y={H - 5} fill="rgba(255,255,255,0.25)" fontSize="7.5" textAnchor={anchor} fontFamily="monospace">{fmt(it.date)}</text>;
      })}
    </svg>
  );
}

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

// ─── MUSCLE DIAGRAM ──────────────────────────────────────────────────────────
function MuscleDiagram({ primary, secondary, exerciseId, exerciseName }: { primary: string[]; secondary: string[]; exerciseId?: string; exerciseName?: string }) {
  // Per-exercise sub-muscle detail; otherwise fall back to broad primary/secondary muscle groups.
  const detail = lookupMuscleDetail(exerciseId, exerciseName);
  const p = detail?.p ?? primary;
  const s = detail?.s ?? secondary;

  // If any sub-muscle of `parent` is in p/s, only those sub-zones glow; siblings stay dim.
  const hasSubFor = (parent: string) => [...p, ...s].some(m => m.startsWith(parent + "-"));

  const subSt = (sub: string, parent: string): "p" | "s" | "" => {
    if (p.includes(sub)) return "p";
    if (s.includes(sub)) return "s";
    if (hasSubFor(parent)) return "";
    if (p.includes(parent)) return "p";
    if (s.includes(parent)) return "s";
    return "";
  };

  // Whole-muscle helpers used for groups without sub-zones.
  const wSt = (m: string): "p" | "s" | "" => p.includes(m) ? "p" : s.includes(m) ? "s" : "";
  const stFill = (st: "p" | "s" | "") => st === "p" ? "#FF4422" : st === "s" ? "#FF9900" : "rgba(255,255,255,0.06)";
  const stStroke = (st: "p" | "s" | "") => st === "p" ? "rgba(255,100,60,0.55)" : st === "s" ? "rgba(255,160,40,0.45)" : "rgba(255,255,255,0.09)";
  const stFilter = (st: "p" | "s" | "") => st === "p" ? "url(#mgp)" : st === "s" ? "url(#mgs)" : undefined;
  const stOrder = (st: "p" | "s" | "") => st === "p" ? 2 : st === "s" ? 1 : 0;

  const mc = (m: string) => stFill(wSt(m));
  const ms = (m: string) => stStroke(wSt(m));
  const mf = (m: string) => stFilter(wSt(m));

  // Render a group of sub-muscle paths in z-order: dim → secondary → primary. Bright always paints last.
  const Group = ({ paths, parent, k }: { paths: { d: string; sub: string }[]; parent: string; k: string }) => (
    <>
      {paths
        .map(pp => ({ ...pp, st: subSt(pp.sub, parent) }))
        .sort((a, b) => stOrder(a.st) - stOrder(b.st))
        .map((pp, i) => (
          <path key={`${k}-${i}`} d={pp.d} fill={stFill(pp.st)} stroke={stStroke(pp.st)} filter={stFilter(pp.st)} strokeWidth={0.7}/>
        ))}
    </>
  );

  // Fiber direction lines rendered on top of fills — make muscles look anatomical not blobby.
  const FiberGroup = ({ paths, parent, k }: { paths: { d: string; sub: string }[]; parent: string; k: string }) => (
    <>
      {paths.map((fp, i) => {
        const st = subSt(fp.sub, parent);
        const op = st === "p" ? 0.32 : st === "s" ? 0.16 : 0.036;
        return <path key={`${k}f${i}`} d={fp.d} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth={0.38} opacity={op} strokeLinecap="round"/>;
      })}
    </>
  );

  const seg = "rgba(0,0,0,0.3)";

  // ─── FRONT VIEW path arrays (cx=75) ───────────────────────────────────

  // Pec: true fan converging at armpit (~42,65). Each zone is a horizontal slice of the fan.
  const chestF = [
    // LEFT — clavicular head (upper), sternocostal (mid/lower), sternal fibers (inner)
    { sub: "chest-upper", d: "M75,50 C70,47 60,44 50,46 C44,47 38,52 36,59 C36,64 37,69 41,70 C52,72 65,71 75,70 Z" },
    { sub: "chest-mid",   d: "M75,70 C65,71 52,72 41,70 C37,74 37,81 40,87 C42,90 47,91 53,91 C63,91 70,89 75,88 Z" },
    { sub: "chest-lower", d: "M75,88 C70,89 63,91 53,91 C46,91 42,94 42,99 C44,104 50,108 58,109 C65,110 72,108 75,106 Z" },
    { sub: "chest-inner", d: "M75,50 C73,53 72,62 71,71 C71,84 72,96 75,106 C77,96 78,84 78,71 C78,62 77,53 75,50 Z" },
    // RIGHT (mirror)
    { sub: "chest-upper", d: "M75,50 C80,47 90,44 100,46 C106,47 112,52 114,59 C114,64 113,69 109,70 C98,72 85,71 75,70 Z" },
    { sub: "chest-mid",   d: "M75,70 C85,71 98,72 109,70 C113,74 113,81 110,87 C108,90 103,91 97,91 C87,91 80,89 75,88 Z" },
    { sub: "chest-lower", d: "M75,88 C80,89 87,91 97,91 C104,91 108,94 108,99 C106,104 100,108 92,109 C85,110 78,108 75,106 Z" },
    { sub: "chest-inner", d: "M75,50 C77,53 78,62 79,71 C79,84 78,96 75,106 C73,96 72,84 72,71 C72,62 73,53 75,50 Z" },
  ];

  // Pec fiber lines — radiate from armpit (~42,66) toward sternum/clavicle
  const chestFibersF = [
    { sub: "chest-upper", d: "M42,60 L74,52" }, { sub: "chest-upper", d: "M41,64 L74,59" }, { sub: "chest-upper", d: "M41,67 L74,66" },
    { sub: "chest-mid",   d: "M41,67 L74,72" }, { sub: "chest-mid",   d: "M42,71 L74,79" }, { sub: "chest-mid",   d: "M43,75 L74,86" },
    { sub: "chest-lower", d: "M44,79 L74,91" }, { sub: "chest-lower", d: "M46,84 L68,106" }, { sub: "chest-lower", d: "M49,90 L59,108" },
    // Right mirror
    { sub: "chest-upper", d: "M108,60 L76,52" }, { sub: "chest-upper", d: "M109,64 L76,59" }, { sub: "chest-upper", d: "M109,67 L76,66" },
    { sub: "chest-mid",   d: "M109,67 L76,72" }, { sub: "chest-mid",   d: "M108,71 L76,79" }, { sub: "chest-mid",   d: "M107,75 L76,86" },
    { sub: "chest-lower", d: "M106,79 L76,91" }, { sub: "chest-lower", d: "M104,84 L82,106" }, { sub: "chest-lower", d: "M101,90 L91,108" },
  ];

  // Deltoid: thick spherical cap. Lateral = outer dome. Anterior = forward face blending with pec.
  const shouldersF = [
    { sub: "shoulders-side",  d: "M37,44 C29,50 24,65 26,81 C28,92 35,96 43,94 C46,84 45,66 42,50 C40,46 38,44 37,44 Z" },
    { sub: "shoulders-front", d: "M42,50 C45,66 46,84 43,94 C50,96 57,92 61,82 C64,70 62,55 55,47 C50,44 45,47 42,50 Z" },
    { sub: "shoulders-side",  d: "M113,44 C121,50 126,65 124,81 C122,92 115,96 107,94 C104,84 105,66 108,50 C110,46 112,44 113,44 Z" },
    { sub: "shoulders-front", d: "M108,50 C105,66 104,84 107,94 C100,96 93,92 89,82 C86,70 88,55 95,47 C100,44 105,47 108,50 Z" },
  ];

  // Shoulder fiber lines — arc from top to bottom, following deltoid fiber direction
  const shoulderFibersF = [
    { sub: "shoulders-side",  d: "M27,68 C28,76 31,85 34,91" }, { sub: "shoulders-side",  d: "M31,62 C32,72 35,82 38,90" }, { sub: "shoulders-side",  d: "M35,57 C36,68 38,79 41,88" },
    { sub: "shoulders-front", d: "M49,51 C50,62 51,75 50,87" }, { sub: "shoulders-front", d: "M53,50 C54,61 55,74 54,86" }, { sub: "shoulders-front", d: "M57,51 C57,62 57,75 56,86" },
    { sub: "shoulders-side",  d: "M123,68 C122,76 119,85 116,91" }, { sub: "shoulders-side",  d: "M119,62 C118,72 115,82 112,90" }, { sub: "shoulders-side",  d: "M115,57 C114,68 112,79 109,88" },
    { sub: "shoulders-front", d: "M101,51 C100,62 99,75 100,87" }, { sub: "shoulders-front", d: "M97,50 C96,61 95,74 96,86" }, { sub: "shoulders-front", d: "M93,51 C93,62 93,75 94,86" },
  ];

  // Biceps: long head = outer peaked teardrop, short head = broader inner, brachialis = lower bump
  const bicepsF = [
    { sub: "biceps-long",  d: "M29,72 C25,85 24,104 27,118 C29,127 36,130 40,128 C42,117 41,98 40,83 C38,74 33,70 29,72 Z" },
    { sub: "biceps-short", d: "M40,83 C41,98 42,117 40,128 C44,130 48,130 52,127 C54,120 54,108 52,94 C50,82 44,73 40,75 C40,78 40,81 40,83 Z" },
    { sub: "brachialis",   d: "M36,122 C33,129 34,136 38,138 C43,139 47,136 47,132 C47,127 44,121 40,120 Z" },
    { sub: "biceps-long",  d: "M121,72 C125,85 126,104 123,118 C121,127 114,130 110,128 C108,117 109,98 110,83 C112,74 117,70 121,72 Z" },
    { sub: "biceps-short", d: "M110,83 C109,98 108,117 110,128 C106,130 102,130 98,127 C96,120 96,108 98,94 C100,82 106,73 110,75 C110,78 110,81 110,83 Z" },
    { sub: "brachialis",   d: "M114,122 C117,129 116,136 112,138 C107,139 103,136 103,132 C103,127 106,121 110,120 Z" },
  ];

  // Bicep fiber lines — longitudinal along each head
  const bicepFibersF = [
    { sub: "biceps-long",  d: "M29,76 C28,94 28,111 30,122" }, { sub: "biceps-long",  d: "M33,74 C32,92 32,109 33,121" }, { sub: "biceps-long",  d: "M36,73 C35,91 35,108 37,120" },
    { sub: "biceps-short", d: "M41,78 C41,95 41,112 41,126" }, { sub: "biceps-short", d: "M44,76 C44,93 44,110 44,124" }, { sub: "biceps-short", d: "M47,77 C47,94 47,110 46,123" },
    { sub: "biceps-long",  d: "M121,76 C122,94 122,111 120,122" }, { sub: "biceps-long",  d: "M117,74 C118,92 118,109 117,121" }, { sub: "biceps-long",  d: "M114,73 C115,91 115,108 113,120" },
    { sub: "biceps-short", d: "M109,78 C109,95 109,112 109,126" }, { sub: "biceps-short", d: "M106,76 C106,93 106,110 106,124" }, { sub: "biceps-short", d: "M103,77 C103,94 103,110 104,123" },
  ];

  const forearmsF = [
    { sub: "forearm-flexor", d: "M28,138 C25,146 24,157 26,167 C28,175 33,180 38,178 C43,176 45,167 44,157 C43,147 39,139 34,136 Z" },
    { sub: "forearm-flexor", d: "M122,138 C125,146 126,157 124,167 C122,175 117,180 112,178 C107,176 105,167 106,157 C107,147 111,139 116,136 Z" },
  ];

  const coreF = [
    // Obliques
    { sub: "core-obliques", d: "M44,94 C42,103 42,118 45,130 C47,140 53,148 60,150 C62,144 61,134 60,124 C58,112 53,103 48,96 Z" },
    { sub: "core-obliques", d: "M106,94 C108,103 108,118 105,130 C103,140 97,148 90,150 C88,144 89,134 90,124 C92,112 97,103 102,96 Z" },
    // Serratus anterior — finger-like under armpit
    { sub: "core-serratus", d: "M48,90 C47,95 47,100 49,103 C53,102 56,99 57,93 Z" },
    { sub: "core-serratus", d: "M102,90 C103,95 103,100 101,103 C97,102 94,99 93,93 Z" },
    // Upper abs (top 4 of 6-pack: rows 1 and 2)
    { sub: "core-abs-upper", d: "M65,104 C63,104 62,107 62,112 C62,117 64,120 67,120 C70,120 73,119 75,118 C77,119 80,120 83,120 C86,120 88,117 88,112 C88,107 87,104 85,104 Z" },
    { sub: "core-abs-upper", d: "M63,121 C61,121 60,125 61,131 C62,137 65,140 68,140 C71,140 73,138 75,136 C77,138 79,140 82,140 C85,140 88,137 89,131 C90,125 89,121 87,121 Z" },
    // Lower abs (bottom 2 of 6-pack)
    { sub: "core-abs-lower", d: "M63,141 C61,141 60,145 62,151 C63,156 67,159 70,159 C73,159 75,156 75,154 C75,156 77,159 80,159 C83,159 87,156 88,151 C90,145 89,141 87,141 Z" },
  ];

  const quadsF = [
    // LEFT thigh: vastus lateralis (long outer teardrop), rectus femoris (central spindle), VMO (teardrop above knee)
    { sub: "quads-outer",  d: "M46,197 C42,215 41,238 45,257 C47,271 55,278 62,278 C66,275 67,265 65,250 C63,234 56,214 50,197 Z" },
    { sub: "quads-rectus", d: "M56,197 C52,215 51,238 54,256 C57,268 64,274 69,273 C72,270 73,260 71,245 C69,228 63,210 58,197 Z" },
    { sub: "quads-inner",  d: "M55,260 C52,268 53,278 59,282 C65,284 71,281 72,275 C73,269 70,261 64,258 C60,255 57,257 55,260 Z" },
    // RIGHT thigh
    { sub: "quads-outer",  d: "M104,197 C108,215 109,238 105,257 C103,271 95,278 88,278 C84,275 83,265 85,250 C87,234 94,214 100,197 Z" },
    { sub: "quads-rectus", d: "M94,197 C98,215 99,238 96,256 C93,268 86,274 81,273 C78,270 77,260 79,245 C81,228 87,210 92,197 Z" },
    { sub: "quads-inner",  d: "M95,260 C98,268 97,278 91,282 C85,284 79,281 78,275 C77,269 80,261 86,258 C90,255 93,257 95,260 Z" },
  ];

  // Quad fiber lines — vertical along each head
  const quadFibersF = [
    { sub: "quads-outer",  d: "M47,200 C46,228 46,252 47,268" }, { sub: "quads-outer",  d: "M50,200 C49,228 49,252 50,268" }, { sub: "quads-outer",  d: "M53,200 C52,228 52,250 53,266" },
    { sub: "quads-rectus", d: "M58,200 C57,228 57,252 58,268" }, { sub: "quads-rectus", d: "M61,200 C60,228 60,252 61,268" }, { sub: "quads-rectus", d: "M64,200 C63,228 63,250 64,266" },
    { sub: "quads-inner",  d: "M57,263 C56,269 57,276 60,280" }, { sub: "quads-inner",  d: "M62,262 C61,268 62,275 65,279" },
    { sub: "quads-outer",  d: "M103,200 C104,228 104,252 103,268" }, { sub: "quads-outer",  d: "M100,200 C101,228 101,252 100,268" }, { sub: "quads-outer",  d: "M97,200 C98,228 98,250 97,266" },
    { sub: "quads-rectus", d: "M92,200 C93,228 93,252 92,268" }, { sub: "quads-rectus", d: "M89,200 C90,228 90,252 89,268" }, { sub: "quads-rectus", d: "M86,200 C87,228 87,250 86,266" },
    { sub: "quads-inner",  d: "M93,263 C94,269 93,276 90,280" }, { sub: "quads-inner",  d: "M88,262 C89,268 88,275 85,279" },
  ];

  const calvesF = [
    // Front view shows outer edge of gastroc bulge
    { sub: "calves-gastroc", d: "M46,285 C42,299 42,316 46,328 C49,334 55,335 59,331 C60,323 58,308 55,296 Z" },
    { sub: "calves-soleus",  d: "M46,326 C44,334 46,343 51,345 C57,346 61,343 61,338 C60,333 57,328 52,327 Z" },
    { sub: "calves-gastroc", d: "M104,285 C108,299 108,316 104,328 C101,334 95,335 91,331 C90,323 92,308 95,296 Z" },
    { sub: "calves-soleus",  d: "M104,326 C106,334 104,343 99,345 C93,346 89,343 89,338 C90,333 93,328 98,327 Z" },
  ];

  // ─── BACK VIEW path arrays (cx=225) ───────────────────────────────────

  // Deltoid cap (back view): same thick rounded shape, now with rear head visible
  const shouldersB = [
    { sub: "shoulders-side", d: "M187,44 C179,50 174,65 176,81 C178,92 185,96 193,94 C196,84 195,66 192,50 C190,46 188,44 187,44 Z" },
    { sub: "shoulders-rear", d: "M192,50 C195,66 196,84 193,94 C200,96 207,92 211,82 C214,70 212,55 205,47 C200,44 195,47 192,50 Z" },
    { sub: "shoulders-side", d: "M263,44 C271,50 276,65 274,81 C272,92 265,96 257,94 C254,84 255,66 258,50 C260,46 262,44 263,44 Z" },
    { sub: "shoulders-rear", d: "M258,50 C255,66 254,84 257,94 C250,96 243,92 239,82 C236,70 238,55 245,47 C250,44 255,47 258,50 Z" },
  ];

  // Shoulder fiber lines (back view)
  const shoulderFibersB = [
    { sub: "shoulders-side", d: "M175,68 C177,77 180,87 183,93" }, { sub: "shoulders-side", d: "M179,62 C181,73 184,83 186,91" }, { sub: "shoulders-side", d: "M183,58 C185,69 188,80 190,89" },
    { sub: "shoulders-rear", d: "M198,52 C199,63 200,76 200,88" }, { sub: "shoulders-rear", d: "M202,51 C203,62 204,75 204,87" }, { sub: "shoulders-rear", d: "M206,52 C207,63 207,76 207,87" },
    { sub: "shoulders-side", d: "M275,68 C273,77 270,87 267,93" }, { sub: "shoulders-side", d: "M271,62 C269,73 266,83 264,91" }, { sub: "shoulders-side", d: "M267,58 C265,69 262,80 260,89" },
    { sub: "shoulders-rear", d: "M252,52 C251,63 250,76 250,88" }, { sub: "shoulders-rear", d: "M248,51 C247,62 246,75 246,87" }, { sub: "shoulders-rear", d: "M244,52 C243,63 243,76 243,87" },
  ];

  const backB = [
    // Upper trapezius — kite/diamond shape from neck to acromions
    { sub: "back-traps-upper", d: "M225,40 C212,44 199,53 190,64 C188,71 190,78 198,80 C208,82 218,78 225,72 C232,78 242,82 252,80 C260,78 262,71 260,64 C251,53 238,44 225,40 Z" },
    // Mid trapezius + rhomboids
    { sub: "back-traps-mid",   d: "M200,77 C196,89 196,103 202,113 C207,121 214,124 221,122 C223,118 224,111 225,104 C226,111 227,118 229,122 C236,124 243,121 248,113 C254,103 254,89 250,77 C240,82 231,84 226,80 C225,78 225,78 224,80 C219,84 210,82 200,77 Z" },
    // Teres major — small oval at armpit
    { sub: "back-teres",       d: "M191,76 C186,81 185,90 190,95 C196,97 203,94 204,87 C204,81 198,74 191,76 Z" },
    { sub: "back-teres",       d: "M259,76 C264,81 265,90 260,95 C254,97 247,94 246,87 C246,81 252,74 259,76 Z" },
    // Latissimus dorsi — dramatic V-wings from armpit to lower back
    { sub: "back-lats",        d: "M191,80 C186,95 184,117 187,139 C189,156 196,167 204,171 C210,173 216,171 219,163 C222,154 222,139 219,123 C216,105 210,87 204,80 C199,74 194,73 191,80 Z" },
    { sub: "back-lats",        d: "M259,80 C264,95 266,117 263,139 C261,156 254,167 246,171 C240,173 234,171 231,163 C228,154 228,139 231,123 C234,105 240,87 246,80 C251,74 256,73 259,80 Z" },
    // Erector spinae — twin columns flanking spine
    { sub: "back-lower",       d: "M220,112 C217,124 216,143 218,158 C220,167 223,172 225,173 C225,165 224,147 224,131 C224,121 222,112 220,112 Z" },
    { sub: "back-lower",       d: "M230,112 C233,124 234,143 232,158 C230,167 227,172 225,173 C225,165 226,147 226,131 C226,121 228,112 230,112 Z" },
  ];

  // Back fiber lines
  const backFibersB = [
    // Upper traps — diagonal from spine to acromion
    { sub: "back-traps-upper", d: "M225,43 C218,53 210,62 200,78" }, { sub: "back-traps-upper", d: "M225,43 C232,53 240,62 250,78" },
    { sub: "back-traps-upper", d: "M225,45 C220,55 213,63 204,77" }, { sub: "back-traps-upper", d: "M225,45 C230,55 237,63 246,77" },
    // Mid traps/rhomboids — toward scapula
    { sub: "back-traps-mid",   d: "M207,85 C214,90 218,97 221,106" }, { sub: "back-traps-mid",   d: "M205,92 C212,94 216,101 219,111" },
    { sub: "back-traps-mid",   d: "M243,85 C236,90 232,97 229,106" }, { sub: "back-traps-mid",   d: "M245,92 C238,94 234,101 231,111" },
    // Lats — diagonal from upper-outer to lower-inner
    { sub: "back-lats", d: "M194,84 C201,107 208,133 213,163" }, { sub: "back-lats", d: "M198,85 C205,108 211,134 216,161" },
    { sub: "back-lats", d: "M202,86 C208,109 214,134 218,158" }, { sub: "back-lats", d: "M206,87 C211,109 216,133 220,154" },
    { sub: "back-lats", d: "M256,84 C249,107 242,133 237,163" }, { sub: "back-lats", d: "M252,85 C245,108 239,134 234,161" },
    { sub: "back-lats", d: "M248,86 C242,109 236,134 232,158" }, { sub: "back-lats", d: "M244,87 C239,109 234,133 230,154" },
    // Erectors — vertical
    { sub: "back-lower", d: "M222,114 C222,132 222,149 222,164" }, { sub: "back-lower", d: "M224,114 C224,132 224,149 224,164" },
    { sub: "back-lower", d: "M226,114 C226,132 226,149 226,164" }, { sub: "back-lower", d: "M228,114 C228,132 228,149 228,164" },
  ];

  // Triceps: lateral (outer strip) + long (inner strip) form horseshoe. Medial = elbow bump.
  const tricepsB = [
    { sub: "triceps-long",    d: "M195,66 C192,77 191,97 193,115 C194,127 200,132 205,130 C206,118 205,98 204,83 C202,72 198,65 195,66 Z" },
    { sub: "triceps-lateral", d: "M182,66 C179,77 177,97 179,115 C181,127 187,132 193,130 C194,117 193,97 192,83 C190,72 186,64 182,66 Z" },
    { sub: "triceps-medial",  d: "M183,121 C181,127 182,134 187,136 C191,138 196,135 197,131 C197,126 194,119 190,118 Z" },
    { sub: "triceps-long",    d: "M255,66 C258,77 259,97 257,115 C256,127 250,132 245,130 C244,118 245,98 246,83 C248,72 252,65 255,66 Z" },
    { sub: "triceps-lateral", d: "M268,66 C271,77 273,97 271,115 C269,127 263,132 257,130 C256,117 257,97 258,83 C260,72 264,64 268,66 Z" },
    { sub: "triceps-medial",  d: "M267,121 C269,127 268,134 263,136 C259,138 254,135 253,131 C253,126 256,119 260,118 Z" },
  ];

  // Tricep fiber lines — longitudinal along each head (horseshoe direction)
  const tricepFibersB = [
    { sub: "triceps-lateral", d: "M183,69 L184,123" }, { sub: "triceps-lateral", d: "M186,68 L187,123" }, { sub: "triceps-lateral", d: "M189,68 L190,123" },
    { sub: "triceps-long",    d: "M196,69 L196,124" }, { sub: "triceps-long",    d: "M199,69 L199,123" }, { sub: "triceps-long",    d: "M202,69 L202,122" },
    { sub: "triceps-lateral", d: "M267,69 L266,123" }, { sub: "triceps-lateral", d: "M264,68 L263,123" }, { sub: "triceps-lateral", d: "M261,68 L260,123" },
    { sub: "triceps-long",    d: "M254,69 L254,124" }, { sub: "triceps-long",    d: "M251,69 L251,123" }, { sub: "triceps-long",    d: "M248,69 L248,122" },
  ];

  const forearmsB = [
    { sub: "forearm-extensor", d: "M178,138 C175,146 174,157 176,167 C178,175 183,180 188,178 C193,176 195,167 194,157 C193,147 189,139 184,136 Z" },
    { sub: "forearm-extensor", d: "M272,138 C275,146 276,157 274,167 C272,175 267,180 262,178 C257,176 255,167 256,157 C257,147 261,139 266,136 Z" },
  ];

  // Glutes: maximus is a large rounded fan, medius visible upper-outer
  const glutesB = [
    { sub: "glutes-med", d: "M195,184 C189,191 188,202 194,209 C201,212 210,210 213,203 C215,195 210,184 204,182 Z" },
    { sub: "glutes-med", d: "M255,184 C261,191 262,202 256,209 C249,212 240,210 237,203 C235,195 240,184 246,182 Z" },
    { sub: "glutes-max", d: "M195,192 C189,205 187,223 191,239 C195,253 206,261 217,259 C223,256 226,246 224,232 C221,216 215,202 207,193 Z" },
    { sub: "glutes-max", d: "M255,192 C261,205 263,223 259,239 C255,253 244,261 233,259 C227,256 224,246 226,232 C229,216 235,202 243,193 Z" },
  ];

  // Glute fiber lines — diagonal (gluteus fibers run diagonally)
  const gluteFibersB = [
    { sub: "glutes-max", d: "M197,196 C202,211 208,228 212,243" }, { sub: "glutes-max", d: "M202,194 C207,209 213,226 216,241" },
    { sub: "glutes-max", d: "M207,193 C212,208 217,224 219,238" }, { sub: "glutes-max", d: "M212,194 C216,208 219,223 220,236" },
    { sub: "glutes-max", d: "M253,196 C248,211 242,228 238,243" }, { sub: "glutes-max", d: "M248,194 C243,209 237,226 234,241" },
    { sub: "glutes-max", d: "M243,193 C238,208 233,224 231,238" }, { sub: "glutes-max", d: "M238,194 C234,208 231,223 230,236" },
    { sub: "glutes-med", d: "M197,188 C201,196 205,203 207,208" }, { sub: "glutes-med", d: "M253,188 C249,196 245,203 243,208" },
  ];

  const hamstringsB = [
    // Biceps femoris (outer) + semimembranosus/semitendinosus (inner)
    { sub: "hamstrings-outer", d: "M196,252 C191,268 190,290 194,310 C197,323 206,330 214,329 C219,327 220,316 218,299 C215,282 208,264 202,251 Z" },
    { sub: "hamstrings-inner", d: "M214,252 C218,268 219,290 217,310 C214,323 205,329 200,328 C196,326 195,315 197,299 C199,282 206,264 213,252 Z" },
    { sub: "hamstrings-outer", d: "M254,252 C259,268 260,290 256,310 C253,323 244,330 236,329 C231,327 230,316 232,299 C235,282 242,264 248,251 Z" },
    { sub: "hamstrings-inner", d: "M236,252 C232,268 231,290 233,310 C236,323 245,329 250,328 C254,326 255,315 253,299 C251,282 244,264 237,252 Z" },
  ];

  // Hamstring fiber lines — longitudinal
  const hamFibersB = [
    { sub: "hamstrings-outer", d: "M197,257 C196,282 196,306 197,320" }, { sub: "hamstrings-outer", d: "M200,256 C199,281 199,305 200,319" }, { sub: "hamstrings-outer", d: "M203,256 C202,281 202,305 203,319" },
    { sub: "hamstrings-inner", d: "M211,256 C211,281 211,305 211,319" }, { sub: "hamstrings-inner", d: "M214,256 C214,281 214,305 214,319" }, { sub: "hamstrings-inner", d: "M217,256 C216,281 216,305 216,318" },
    { sub: "hamstrings-outer", d: "M253,257 C254,282 254,306 253,320" }, { sub: "hamstrings-outer", d: "M250,256 C251,281 251,305 250,319" }, { sub: "hamstrings-outer", d: "M247,256 C248,281 248,305 247,319" },
    { sub: "hamstrings-inner", d: "M239,256 C239,281 239,305 239,319" }, { sub: "hamstrings-inner", d: "M236,256 C236,281 236,305 236,319" }, { sub: "hamstrings-inner", d: "M233,256 C234,281 234,305 233,318" },
  ];

  // Gastrocnemius: classic diamond/kite shape from behind. Two heads converging.
  const calvesB = [
    { sub: "calves-gastroc", d: "M200,288 C194,303 193,321 197,336 C201,344 210,347 217,344 C219,339 219,328 217,315 C214,301 208,287 203,284 Z" },
    { sub: "calves-soleus",  d: "M198,334 C195,342 197,351 203,353 C211,354 218,350 219,344 C216,339 209,334 202,334 Z" },
    { sub: "calves-gastroc", d: "M250,288 C256,303 257,321 253,336 C249,344 240,347 233,344 C231,339 231,328 233,315 C236,301 242,287 247,284 Z" },
    { sub: "calves-soleus",  d: "M252,334 C255,342 253,351 247,353 C239,354 232,350 231,344 C234,339 241,334 248,334 Z" },
  ];

  // Calf fiber lines — vertical along the gastroc belly
  const calveFibersB = [
    { sub: "calves-gastroc", d: "M200,291 C199,311 199,330 201,338" }, { sub: "calves-gastroc", d: "M204,290 C203,310 203,329 205,337" },
    { sub: "calves-gastroc", d: "M208,290 C207,310 207,329 209,337" }, { sub: "calves-gastroc", d: "M212,291 C211,311 211,330 213,337" },
    { sub: "calves-gastroc", d: "M250,291 C251,311 251,330 249,338" }, { sub: "calves-gastroc", d: "M246,290 C247,310 247,329 245,337" },
    { sub: "calves-gastroc", d: "M242,290 C243,310 243,329 241,337" }, { sub: "calves-gastroc", d: "M238,291 C239,311 239,330 237,337" },
  ];

  return (
    <svg viewBox="0 0 300 365" style={{ width: "100%", maxHeight: 340 }}>
      <defs>
        <filter id="mgp" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="mgs" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="skin" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1f1f2c"/>
          <stop offset="100%" stopColor="#141420"/>
        </radialGradient>
      </defs>

      {/* ═══ FRONT VIEW (cx=75) ═══ */}

      {/* Body silhouette */}
      <circle cx={75} cy={19} r={14} fill="url(#skin)" stroke="#2e2e40" strokeWidth={1}/>
      <path d="M69,32 Q75,37 81,32 L80,46 Q75,49 70,46 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M38,50 C35,62 34,84 35,110 C36,132 40,152 47,164 C52,174 62,181 75,182 C88,181 98,174 103,164 C110,152 114,132 115,110 C116,84 115,62 112,50 C103,44 90,40 75,40 C60,40 47,44 38,50 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.8}/>
      <path d="M47,166 C46,172 46,178 49,183 C54,189 63,192 75,192 C87,192 96,189 101,183 C104,178 104,172 103,166 Z" fill="#141420" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M36,52 C31,62 28,80 28,100 C28,116 31,128 36,132 C40,135 45,133 48,127 C51,119 52,103 51,85 C50,69 46,57 41,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M114,52 C119,62 122,80 122,100 C122,116 119,128 114,132 C110,135 105,133 102,127 C99,119 98,103 99,85 C100,69 104,57 109,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M29,134 C26,142 25,154 26,164 C27,172 31,178 37,178 C42,177 45,170 45,160 C45,150 42,140 38,135 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M121,134 C124,142 125,154 124,164 C123,172 119,178 113,178 C108,177 105,170 105,160 C105,150 108,140 112,135 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M48,194 C45,206 43,226 45,246 C47,262 53,274 61,278 C67,280 73,278 76,272 C79,264 80,250 79,232 C78,214 73,198 67,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M102,194 C105,206 107,226 105,246 C103,262 97,274 89,278 C83,280 77,278 74,272 C71,264 70,250 71,232 C72,214 77,198 83,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M46,281 C43,292 43,310 45,324 C47,336 53,344 60,345 C66,345 71,340 73,332 C75,322 75,306 72,292 C70,281 65,276 59,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M104,281 C107,292 107,310 105,324 C103,336 97,344 90,345 C84,345 79,340 77,332 C75,322 75,306 78,292 C80,281 85,276 91,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>

      {/* Muscle overlays — z-ordered so primary always paints on top of dim */}
      <Group paths={shouldersF} parent="shoulders" k="shF"/>
      <FiberGroup paths={shoulderFibersF} parent="shoulders" k="shF"/>
      <Group paths={chestF}     parent="chest"     k="chF"/>
      <FiberGroup paths={chestFibersF}    parent="chest"     k="chF"/>
      <line x1={75} y1={55} x2={75} y2={106} stroke={seg} strokeWidth={0.5}/>
      <Group paths={bicepsF}    parent="biceps"    k="biF"/>
      <FiberGroup paths={bicepFibersF}    parent="biceps"    k="biF"/>
      <Group paths={forearmsF}  parent="forearms"  k="faF"/>
      <Group paths={coreF}      parent="core"      k="coF"/>
      <line x1={75} y1={107} x2={75} y2={159} stroke={seg} strokeWidth={0.5}/>
      <Group paths={quadsF}     parent="quads"     k="qdF"/>
      <FiberGroup paths={quadFibersF}     parent="quads"     k="qdF"/>
      <Group paths={calvesF}    parent="calves"    k="cvF"/>

      <text x={75} y={358} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.25)" fontFamily="monospace" letterSpacing={2}>FRONT</text>

      {/* ═══ BACK VIEW (cx=225) ═══ */}

      <circle cx={225} cy={19} r={14} fill="url(#skin)" stroke="#2e2e40" strokeWidth={1}/>
      <path d="M219,32 Q225,37 231,32 L230,46 Q225,49 220,46 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M188,50 C185,62 184,84 185,110 C186,132 190,152 197,164 C202,174 212,181 225,182 C238,181 248,174 253,164 C260,152 264,132 265,110 C266,84 265,62 262,50 C253,44 240,40 225,40 C210,40 197,44 188,50 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.8}/>
      <path d="M197,166 C196,172 196,178 199,183 C204,189 213,192 225,192 C237,192 246,189 251,183 C254,178 254,172 253,166 Z" fill="#141420" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M186,52 C181,62 178,80 178,100 C178,116 181,128 186,132 C190,135 195,133 198,127 C201,119 202,103 201,85 C200,69 196,57 191,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M264,52 C269,62 272,80 272,100 C272,116 269,128 264,132 C260,135 255,133 252,127 C249,119 248,103 249,85 C250,69 254,57 259,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M179,134 C176,142 175,154 176,164 C177,172 181,178 187,178 C192,177 195,170 195,160 C195,150 192,140 188,135 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M271,134 C274,142 275,154 274,164 C273,172 269,178 263,178 C258,177 255,170 255,160 C255,150 258,140 262,135 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M198,194 C195,206 193,226 195,246 C197,262 203,274 211,278 C217,280 223,278 226,272 C229,264 230,250 229,232 C228,214 223,198 217,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M252,194 C255,206 257,226 255,246 C253,262 247,274 239,278 C233,280 227,278 224,272 C221,264 220,250 221,232 C222,214 227,198 233,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M196,281 C193,292 193,310 195,324 C197,336 203,344 210,345 C216,345 221,340 223,332 C225,322 225,306 222,292 C220,281 215,276 209,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M254,281 C257,292 257,310 255,324 C253,336 247,344 240,345 C234,345 229,340 227,332 C225,322 225,306 228,292 C230,281 235,276 241,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>

      <Group paths={shouldersB}  parent="shoulders"  k="shB"/>
      <FiberGroup paths={shoulderFibersB} parent="shoulders" k="shB"/>
      <Group paths={backB}       parent="back"       k="bkB"/>
      <FiberGroup paths={backFibersB}     parent="back"      k="bkB"/>
      <line x1={225} y1={74} x2={225} y2={170} stroke={seg} strokeWidth={0.5}/>
      <Group paths={tricepsB}    parent="triceps"    k="trB"/>
      <FiberGroup paths={tricepFibersB}   parent="triceps"   k="trB"/>
      <Group paths={forearmsB}   parent="forearms"   k="faB"/>
      <Group paths={glutesB}     parent="glutes"     k="glB"/>
      <FiberGroup paths={gluteFibersB}    parent="glutes"    k="glB"/>
      <line x1={225} y1={190} x2={225} y2={252} stroke={seg} strokeWidth={0.5}/>
      <Group paths={hamstringsB} parent="hamstrings" k="hmB"/>
      <FiberGroup paths={hamFibersB}      parent="hamstrings" k="hmB"/>
      <Group paths={calvesB}     parent="calves"     k="cvB"/>
      <FiberGroup paths={calveFibersB}    parent="calves"    k="cvB"/>

      <text x={225} y={358} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.25)" fontFamily="monospace" letterSpacing={2}>BACK</text>
    </svg>
  );
}

function lookupExMuscles(name: string): { muscles: string[]; secondaryMuscles: string[] } {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = n(name);
  let found = EXERCISES.find(e => n(e.name) === key);
  if (!found) found = EXERCISES.find(e => key.includes(n(e.name)) || n(e.name).includes(key));
  return { muscles: found?.primaryMuscles ?? [], secondaryMuscles: found?.secondaryMuscles ?? [] };
}

// ─── MAIN ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const [user, setUser] = useState<{ id: string; username: string; role: string; roleRequest?: string | null } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authStep, setAuthStep] = useState<"username" | "register" | "setup" | "password" | "forgot">("username");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [newConfirmInput, setNewConfirmInput] = useState("");

  const [view, setView] = useState("home");
  const [activeDay, setActiveDay] = useState<WorkoutDay | null>(null);
  const [started, setStarted] = useState(false);
  const [log, setLog] = useState<Record<string, { weight: number; reps: number }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wInput, setWInput] = useState("");
  const [rInput, setRInput] = useState("");
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [openHist, setOpenHist] = useState<string | null>(null);
  const [warmupDone, setWarmupDone] = useState<Record<string, boolean>>({});
  const [editEx, setEditEx] = useState<string | null>(null);
  const [editSets, setEditSets] = useState<Record<string, { weight: number; reps: number }>>({});
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [adjustedDuration, setAdjustedDuration] = useState("");
  const [resumeOverlay, setResumeOverlay] = useState<{ title: string; ageStr: string } | null>(null);
  const [progressTab, setProgressTab] = useState<"dashboard" | "exercises" | "history" | "body">("dashboard");
  const [selectedExDay, setSelectedExDay] = useState<string | null>(null);

  // ── Customise ──
  const [editingDay, setEditingDay] = useState<any | null>(null);
  const [exSearch, setExSearch] = useState("");
  const [exFilterLoc, setExFilterLoc] = useState("all");
  const [exFilterMove, setExFilterMove] = useState("all");
  const [exFilterMuscle, setExFilterMuscle] = useState("all");
  const [showExBrowser, setShowExBrowser] = useState(false);

  // ── Settings / trainer upgrade ──
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeNote, setUpgradeNote] = useState("");
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "error" | "requesting">("idle");
  const [testingNotif, setTestingNotif] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Trainer search ──
  const [trainerSearch, setTrainerSearch] = useState("");
  const [trainerResults, setTrainerResults] = useState<any[]>([]);
  const [trainerSearching, setTrainerSearching] = useState(false);
  const [trainerHasSearched, setTrainerHasSearched] = useState(false);
  const [trainerSearchError, setTrainerSearchError] = useState<string | null>(null);
  const [trainerRequests, setTrainerRequests] = useState<any[]>([]);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [respondingRequest, setRespondingRequest] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [activeClient, setActiveClient] = useState<{ id: string; username: string } | null>(null);
  const [clientData, setClientData] = useState<{ profile: any; history: Record<string, any[]>; plan: any } | null>(null);
  const [clientDataLoading, setClientDataLoading] = useState(false);
  const [clientDetailTab, setClientDetailTab] = useState<"split" | "history" | "profile">("split");
  const [openClientSession, setOpenClientSession] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editedPlanDays, setEditedPlanDays] = useState<any[] | null>(null);
  const [proposingPlan, setProposingPlan] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);

  // ── Body metrics ──
  const [bodyMetrics, setBodyMetrics] = useState<any[]>([]);
  const [bodyMetricsLoaded, setBodyMetricsLoaded] = useState(false);
  const [metricWeight, setMetricWeight] = useState("");
  const [metricBf, setMetricBf] = useState("");
  const [loggingMetric, setLoggingMetric] = useState(false);
  const [goalWeight, setGoalWeight] = useState("");
  const [goalBf, setGoalBf] = useState("");
  const [goalWeightPrev, setGoalWeightPrev] = useState("");
  const [goalBfPrev, setGoalBfPrev] = useState("");
  const [editingGoals, setEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editMetricWeight, setEditMetricWeight] = useState("");
  const [editMetricBf, setEditMetricBf] = useState("");
  const [editMetricDate, setEditMetricDate] = useState("");
  const [savingMetric, setSavingMetric] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState<{ id: string; username: string } | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const lastMsgCreatedAtRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ── Onboarding + custom plan ──
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planNote, setPlanNote] = useState("");
  const [customPlan, setCustomPlan] = useState<any[] | null>(null);
  const [savedRoutines, setSavedRoutines] = useState<any[]>([]);
  const [showSavedList, setShowSavedList] = useState(false);
  const [showSaveRoutine, setShowSaveRoutine] = useState(false);
  const [saveRoutineName, setSaveRoutineName] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [sharingRoutineId, setSharingRoutineId] = useState<string | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareResult, setShareResult] = useState<string | null>(null);
  const [ob, setOb] = useState({
    dob: "", gender: "", heightCm: "", weightKg: "", bodyFatPct: "",
    goals: [] as string[], targetArea: "", fitnessLevel: "", location: "", equipment: [] as string[], daysPerWeek: 4,
  });

  const [formPreview, setFormPreview] = useState<{ id: string; name: string; muscles: string[]; secondaryMuscles?: string[] } | null>(null);
  const [formFrame, setFormFrame] = useState(0);
  const [formImgError, setFormImgError] = useState(false);
  const [modalSlide, setModalSlide] = useState(0);
  const swipeTouchX = useRef(0);

  const rest = useCountdown();
  const timer = useTimer();

  const swipeBackViews = new Set(["conversation", "messages", "clientDetail", "progress", "settings", "workout"]);
  useSwipeBack(() => {
    if (view === "conversation") { setView("messages"); setActiveConversation(null); }
    else if (view === "messages") setView("home");
    else if (view === "clientDetail") { setView("home"); setEditingPlan(false); setEditedPlanDays(null); }
    else if (view === "progress") { setView("home"); }
    else if (view === "settings") setView("home");
    else if (view === "workout" && started) setView("home"); // leave but keep session alive
  }, swipeBackViews.has(view));

  // On mount: check browser permission; if already granted, re-register subscription
  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setNotifStatus("unsupported"); return;
    }
    if (Notification.permission === "denied") { setNotifStatus("denied"); return; }
    if (Notification.permission === "granted") {
      // Re-save subscription in case it wasn't stored yet (e.g. first deploy with push)
      subscribeToPush().then(s => setNotifStatus(s));
    } else if (Notification.permission === "default") {
      // Show banner unless user previously dismissed it
      const dismissed = localStorage.getItem("ironlog-notif-dismissed");
      if (!dismissed) setShowNotifBanner(true);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (data.user) {
        setUser({ id: data.user.id, username: data.user.username, role: data.user.role ?? "user", roleRequest: data.user.roleRequest ?? null });
        if (data.user.mustReset) setMustResetPassword(true);
        // Only silently re-save subscription if permission already granted — never prompt here
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          subscribeToPush().then(s => setNotifStatus(s));
        }
      }
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

  useEffect(() => {
    if (user?.role === "trainer") {
      fetch("/api/trainer/request").then(r => r.json()).then(data => {
        if (data.requests) setTrainerRequests(data.requests);
      }).catch(() => {});
      fetch("/api/trainer/clients").then(r => r.json()).then(data => {
        if (data.clients) setClients(data.clients);
      }).catch(() => {});
    }
    if (user?.role === "user") {
      fetch("/api/trainer/request/incoming").then(r => r.json()).then(data => {
        if (data.requests) setIncomingRequests(data.requests);
      }).catch(() => {});
    }
    fetch("/api/messages").then(r => r.json()).then(data => {
      if (data.conversations) {
        setConversations(data.conversations);
        setUnreadCount(data.conversations.reduce((a: number, c: any) => a + (c.unreadCount ?? 0), 0));
      }
    }).catch(() => {});
  }, [user]);

  // Keep lastMsgCreatedAtRef in sync for polling
  useEffect(() => {
    const last = conversationMessages[conversationMessages.length - 1];
    if (last) lastMsgCreatedAtRef.current = last.createdAt;
  }, [conversationMessages]);

  // Auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    if (view !== "conversation") return;
    const container = messagesContainerRef.current;
    if (!container) { messagesEndRef.current?.scrollIntoView(); return; }
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages, view]);

  // Poll for new messages every 3 seconds while conversation is open
  useEffect(() => {
    if (view !== "conversation" || !activeConversation) return;
    const partnerId = activeConversation.id;
    const poll = async () => {
      const since = lastMsgCreatedAtRef.current;
      if (!since) return;
      try {
        const res = await fetch(`/api/messages/${partnerId}?since=${encodeURIComponent(since)}`);
        const data = await res.json();
        if (data.messages?.length > 0) {
          setConversationMessages(prev => {
            const ids = new Set(prev.map((m: any) => m.id));
            const fresh = data.messages.filter((m: any) => !ids.has(m.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
      } catch {}
    };
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [view, activeConversation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile").then(r => r.json()).then(profileData => {
      if (profileData.profile) {
        const p = profileData.profile;
        setOb({
          dob: p.dob ? p.dob.substring(0, 10) : "",
          gender: p.gender || "",
          heightCm: p.heightCm?.toString() || "",
          weightKg: p.weightKg?.toString() || "",
          bodyFatPct: p.bodyFatPct?.toString() || "",
          goals: p.goals?.length ? p.goals : (p.goal ? [p.goal] : []),
          targetArea: p.targetArea || "none",
          fitnessLevel: p.fitnessLevel || "",
          location: p.location || "",
          equipment: p.equipment || [],
          daysPerWeek: p.daysPerWeek || 4,
        });
        if (p.targetWeightKg) setGoalWeight(p.targetWeightKg.toString());
        if (p.targetBodyFatPct) setGoalBf(p.targetBodyFatPct.toString());
        fetch("/api/plan").then(r => r.json()).then(planData => {
          if (planData.plan?.days?.length) setCustomPlan(planData.plan.days);
        });
        fetch("/api/routines").then(r => r.json()).then(d => {
          if (Array.isArray(d.routines)) setSavedRoutines(d.routines);
        });
      } else {
        setShowOnboarding(true);
      }
    }).catch(() => setShowOnboarding(true));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const saved = localStorage.getItem("ironlog-session");
      if (!saved) return;
      const session = JSON.parse(saved);
      if (session.userId !== user.id) { localStorage.removeItem("ironlog-session"); return; }
      // Support stored full day data (custom plans) or fall back to WORKOUT_DATA lookup
      const day: WorkoutDay | undefined = session.dayData ?? WORKOUT_DATA.find((d: WorkoutDay) => d.id === session.dayId);
      if (!day) { localStorage.removeItem("ironlog-session"); return; }
      setActiveDay(day);
      setLog(session.log || {});
      setStarted(true);
      timer.resumeT(session.startTime);
      // Stay on home — the active card will show the live session
    } catch { try { localStorage.removeItem("ironlog-session"); } catch {} }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formPreview) return;
    setFormFrame(0);
    setFormImgError(false);
    setModalSlide(0);
    const iv = setInterval(() => setFormFrame(f => f === 0 ? 1 : 0), 900);
    return () => clearInterval(iv);
  }, [formPreview]);

  const authPost = async (body: object) => {
    const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  };

  const doCheckUsername = async () => {
    const input = nameInput.trim().toLowerCase();
    if (!input) return;
    setAuthError("");
    try {
      const data = await authPost({ action: "check", username: input });
      if (data.error) { setAuthError(data.error); return; }
      if (data.state === "new") {
        if (data.isEmail) { setAuthError("No account found with that email. Please use your username to register."); return; }
        setAuthStep("register");
      } else {
        if (data.username) setNameInput(data.username);
        if (data.state === "needs-setup") setAuthStep("setup");
        else setAuthStep("password");
      }
    } catch { setAuthError("Something went wrong"); }
  };

  const doRegister = async () => {
    if (passwordInput !== confirmInput) { setAuthError("Passwords don't match"); return; }
    setAuthError("");
    try {
      const data = await authPost({ action: "register", username: nameInput.trim().toLowerCase(), email: emailInput.trim(), password: passwordInput });
      if (data.error) { setAuthError(data.error); return; }
      setUser({ id: data.id, username: data.username, role: data.role ?? "user" });
      setShowNotifBanner(!localStorage.getItem("ironlog-notif-dismissed"));
    } catch { setAuthError("Something went wrong"); }
  };

  const doSetup = async () => {
    if (passwordInput !== confirmInput) { setAuthError("Passwords don't match"); return; }
    setAuthError("");
    try {
      const data = await authPost({ action: "setup", username: nameInput.trim().toLowerCase(), email: emailInput.trim(), password: passwordInput });
      if (data.error) { setAuthError(data.error); return; }
      setUser({ id: data.id, username: data.username, role: data.role ?? "user" });
      setShowNotifBanner(!localStorage.getItem("ironlog-notif-dismissed"));
    } catch { setAuthError("Something went wrong"); }
  };

  const doLogin = async () => {
    setAuthError("");
    try {
      const data = await authPost({ action: "login", username: nameInput.trim().toLowerCase(), password: passwordInput });
      if (data.error) { setAuthError(data.error); return; }
      setUser({ id: data.id, username: data.username, role: data.role ?? "user" });
      if (data.mustReset) setMustResetPassword(true);
    } catch { setAuthError("Something went wrong"); }
  };

  const doForgot = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.trim() }) });
      const data = await res.json();
      if (data.error) { setAuthError(data.error); return; }
      setForgotSent(true);
    } catch { setAuthError("Something went wrong"); }
  };

  const doResetPassword = async () => {
    if (newPasswordInput !== newConfirmInput) { setAuthError("Passwords don't match"); return; }
    setAuthError("");
    try {
      const res = await fetch("/api/auth", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: newPasswordInput }) });
      const data = await res.json();
      if (data.error) { setAuthError(data.error); return; }
      setMustResetPassword(false);
      setNewPasswordInput(""); setNewConfirmInput("");
    } catch { setAuthError("Something went wrong"); }
  };

  const doLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setUser(null); setView("home"); setActiveDay(null); timer.stopT();
    setAuthStep("username"); setPasswordInput(""); setEmailInput("");
    setCustomPlan(null); setShowOnboarding(false); setOnboardingStep(0);
  };

  const planDayToWorkoutDay = (day: any): WorkoutDay => ({
    id: day.id,
    title: day.title,
    subtitle: day.subtitle,
    label: `DAY ${(day.dayIndex ?? 0) + 1}`,
    color: ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"][day.dayIndex % 6] || "#FF6B6B",
    gradient: ["linear-gradient(135deg,#FF6B6B,#ee5a24)","linear-gradient(135deg,#4ECDC4,#44a08d)","linear-gradient(135deg,#45B7D1,#2980b9)","linear-gradient(135deg,#96CEB4,#6aab8e)","linear-gradient(135deg,#f7d794,#e17055)","linear-gradient(135deg,#DDA0DD,#9b59b6)"][day.dayIndex % 6] || "linear-gradient(135deg,#FF6B6B,#ee5a24)",
    focus: day.focus,
    sections: [{ name: "Main", type: "main" as const, exercises: day.exercises.map((ex: any) => {
      const meta = (EXERCISES as any[]).find((e: any) => e.id === ex.exerciseId);
      return { id: ex.exerciseId, name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest, note: ex.notes ?? undefined, type: meta?.type ?? "compound" };
    }) }],
  });

  const doTrainerSearch = async (q?: string) => {
    const term = (q ?? trainerSearch).trim();
    if (term.length < 1) { setTrainerResults([]); setTrainerHasSearched(false); setTrainerSearchError(null); return; }
    setTrainerSearching(true);
    setTrainerHasSearched(true);
    setTrainerSearchError(null);
    try {
      const res = await fetch(`/api/trainer/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) {
        setTrainerSearchError(`API error ${res.status}: ${data.error ?? "unknown"}`);
        setTrainerResults([]);
      } else {
        setTrainerResults(data.results ?? []);
      }
    } catch (e: any) {
      setTrainerSearchError(`Network error: ${e?.message ?? "unknown"}`);
    }
    setTrainerSearching(false);
  };

  const openClientDetail = async (c: { id: string; username: string }) => {
    setActiveClient(c);
    setClientDetailTab("split");
    setClientData(null);
    setClientDataLoading(true);
    setView("clientDetail");
    try {
      const res = await fetch(`/api/trainer/clients/${c.id}`);
      const data = await res.json();
      if (data.username) setClientData({ profile: data.profile, history: data.history, plan: data.plan });
    } catch {}
    setClientDataLoading(false);
  };

  const startEditPlan = () => {
    if (!clientData) return;
    const days = clientData.plan
      ? clientData.plan.days.map((d: any) => ({
          dayIndex: d.dayIndex,
          title: d.title,
          subtitle: d.subtitle ?? d.focus,
          focus: d.focus,
          exercises: d.exercises.map((ex: any) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest: ex.rest,
            notes: ex.notes ?? null,
            order: ex.order,
          })),
        }))
      : WORKOUT_DATA.map((d, i) => ({
          dayIndex: i,
          title: d.title,
          subtitle: d.focus,
          focus: d.focus,
          exercises: d.sections.flatMap(s => s.exercises).filter(e => e.trackable !== false).map((ex, j) => ({
            exerciseId: ex.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest: ex.rest ?? 60,
            notes: ex.note ?? null,
            order: j,
          })),
        }));
    setEditedPlanDays(days);
    setEditingPlan(true);
    setProposalSent(false);
  };

  const doSaveRoutine = async () => {
    const days = customPlan ?? (WORKOUT_DATA as any[]).map((d, i) => ({
      title: d.title, subtitle: d.focus, focus: d.focus,
      exercises: d.sections.flatMap((s: any) => s.exercises).filter((e: any) => e.trackable !== false).map((ex: any, j: number) => ({
        order: j, exerciseId: ex.id, name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest ?? 60, notes: ex.note ?? null,
      })),
    }));
    if (!saveRoutineName.trim()) return;
    setSavingRoutine(true);
    try {
      const res = await fetch("/api/routines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: saveRoutineName.trim(), days }) });
      const data = await res.json();
      if (data.routine) { setSavedRoutines(prev => [data.routine, ...prev]); setShowSaveRoutine(false); setSaveRoutineName(""); }
    } finally { setSavingRoutine(false); }
  };

  const doRestoreRoutine = async (id: string, name: string) => {
    if (!confirm(`Restore "${name}"? Your current plan will be replaced.`)) return;
    const res = await fetch(`/api/routines/${id}`, { method: "POST" });
    const data = await res.json();
    if (data.plan?.days?.length) setCustomPlan(data.plan.days);
  };

  const doDeleteRoutine = async (id: string) => {
    if (!confirm("Delete this saved routine?")) return;
    await fetch(`/api/routines/${id}`, { method: "DELETE" });
    setSavedRoutines(prev => prev.filter(r => r.id !== id));
  };

  const doShareRoutine = async (id: string) => {
    if (!shareUsername.trim()) return;
    setSharingLoading(true);
    setShareResult(null);
    try {
      const res = await fetch(`/api/routines/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUsername: shareUsername.trim() }) });
      const data = await res.json();
      if (data.ok) { setShareResult(`Sent to @${data.to}`); setShareUsername(""); setTimeout(() => { setSharingRoutineId(null); setShareResult(null); }, 2000); }
      else setShareResult(data.error ?? "Failed");
    } finally { setSharingLoading(false); }
  };

  const proposePlan = async () => {
    if (!activeClient || !editedPlanDays) return;
    setProposingPlan(true);
    try {
      const res = await fetch(`/api/trainer/clients/${activeClient.id}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: editedPlanDays }),
      });
      if (res.ok) {
        setProposalSent(true);
        setEditingPlan(false);
        setEditedPlanDays(null);
      }
    } catch {}
    setProposingPlan(false);
  };

  const respondToProposal = async (proposalId: string, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/plan-proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setConversationMessages(prev => prev.map(m =>
          m.proposalId === proposalId
            ? { ...m, proposal: { ...m.proposal, status: action === "accept" ? "accepted" : "declined" } }
            : m
        ));
        if (action === "accept") {
          // Reload custom plan
          fetch("/api/plan").then(r => r.json()).then(d => {
            if (d.plan) setCustomPlan(d.plan.days);
          }).catch(() => {});
        }
      }
    } catch {}
  };

  const logBodyMetric = async () => {
    if (!metricWeight && !metricBf) return;
    setLoggingMetric(true);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: metricWeight || undefined, bodyFatPct: metricBf || undefined }),
      });
      const data = await res.json();
      if (data.metric) {
        setBodyMetrics(prev => [data.metric, ...prev]);
        if (metricWeight) setOb(o => ({ ...o, weightKg: metricWeight }));
        if (metricBf) setOb(o => ({ ...o, bodyFatPct: metricBf }));
        setMetricWeight("");
        setMetricBf("");
      }
    } catch {}
    setLoggingMetric(false);
  };

  const deleteBodyMetric = async (id: string) => {
    try {
      await fetch(`/api/metrics/${id}`, { method: "DELETE" });
      setBodyMetrics(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const saveBodyMetricEdit = async () => {
    if (!editingMetricId) return;
    setSavingMetric(true);
    try {
      const res = await fetch(`/api/metrics/${editingMetricId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editMetricWeight && { weightKg: editMetricWeight }),
          ...(editMetricBf && { bodyFatPct: editMetricBf }),
          ...(editMetricDate && { date: editMetricDate }),
        }),
      });
      const data = await res.json();
      if (data.metric) {
        setBodyMetrics(prev =>
          prev.map(m => m.id === editingMetricId ? data.metric : m)
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
        setEditingMetricId(null);
      }
    } catch {}
    setSavingMetric(false);
  };

  const regeneratePlan = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/plan", { method: "POST" });
      const data = await res.json();
      if (data.plan?.days?.length) {
        setCustomPlan(data.plan.days);
        setPlanNote(data.planNote || "");
      }
      setRegenConfirm(false);
    } catch {}
    setRegenerating(false);
  };

  const saveGoals = async () => {
    setSavingGoals(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWeightKg: goalWeight || null, targetBodyFatPct: goalBf || null }),
      });
      setEditingGoals(false);
    } catch {}
    setSavingGoals(false);
  };

  const sendAdoptionRequest = async (targetUserId: string) => {
    setSendingRequest(targetUserId);
    try {
      const res = await fetch("/api/trainer/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId }) });
      const data = await res.json();
      if (data.request) setTrainerRequests(prev => [data.request, ...prev.filter(r => r.userId !== targetUserId)]);
      else if (data.error) setTrainerSearchError(data.error);
    } catch {}
    setSendingRequest(null);
  };

  const respondToRequest = async (requestId: string, action: "accept" | "decline") => {
    setRespondingRequest(requestId);
    try {
      const res = await fetch("/api/trainer/request", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action }) });
      const data = await res.json();
      if (data.ok) setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch {}
    setRespondingRequest(null);
  };

  const openConversation = async (partner: { id: string; username: string }) => {
    setActiveConversation(partner);
    setConversationMessages([]);
    setView("conversation");
    try {
      const res = await fetch(`/api/messages/${partner.id}`);
      const data = await res.json();
      if (data.messages) {
        setConversationMessages(data.messages);
        setConversations(prev => prev.map(c => c.partner.id === partner.id ? { ...c, unreadCount: 0 } : c));
        setUnreadCount(prev => Math.max(0, prev - (conversations.find(c => c.partner.id === partner.id)?.unreadCount ?? 0)));
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConversation || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: activeConversation.id, body: messageText.trim() }),
      });
      const data = await res.json();
      if (data.message) {
        setConversationMessages(prev => [...prev, data.message]);
        setMessageText("");
      }
    } catch {}
    setSendingMessage(false);
  };

  const openCustomise = async () => {
    setEditingDay(null);
    if (!customPlan) {
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "init" }) });
      const data = await res.json();
      if (data.plan?.days?.length) setCustomPlan(data.plan.days);
    }
    setView("customise");
  };

  const saveDay = async (day: any, exercises: any[]) => {
    const res = await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayId: day.id, exercises }) });
    const data = await res.json();
    if (data.day) {
      setCustomPlan(prev => prev ? prev.map(d => d.id === day.id ? { ...d, exercises: data.day.exercises } : d) : prev);
      setEditingDay((prev: any) => prev ? { ...prev, exercises: data.day.exercises } : prev);
    }
  };

  const moveExercise = (exercises: any[], from: number, to: number) => {
    const arr = [...exercises];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    return arr;
  };

  const submitOnboarding = async () => {
    setGeneratingPlan(true);
    try {
      const profileRes = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ob) });
      if (!profileRes.ok) { setGeneratingPlan(false); return; }
      const planRes = await fetch("/api/plan", { method: "POST" });
      const planData = await planRes.json();
      if (planData.plan?.days?.length) {
        setCustomPlan(planData.plan.days);
        setPlanNote(planData.planNote || "");
      }
    } catch {}
    setGeneratingPlan(false);
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const openDay = (d: WorkoutDay) => { setActiveDay(d); setView("workout"); setLog({}); setExpanded(null); setStarted(false); setWarmupDone({}); };
  const begin = () => {
    setStarted(true);
    timer.startT();
    if (user && activeDay) {
      try { localStorage.setItem("ironlog-session", JSON.stringify({ userId: user.id, dayId: activeDay.id, dayData: activeDay, startTime: Date.now(), log: {} })); } catch {}
    }
  };

  const finish = () => {
    const setCount = Object.keys(log).length;
    if (setCount === 0) {
      if (!confirm("No sets logged. Quit without saving?")) return;
      timer.stopT();
      try { localStorage.removeItem("ironlog-session"); } catch {}
      setView("home"); setActiveDay(null); setLog({}); setStarted(false);
      return;
    }
    setAdjustedDuration(timer.fmt);
    setShowFinishPrompt(true);
  };

  const doSaveWorkout = async () => {
    setShowFinishPrompt(false);
    timer.stopT();
    if (activeDay) {
      try {
        await fetch("/api/workout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayId: activeDay.id, duration: adjustedDuration, sets: log }),
        });
        const res = await fetch("/api/workout");
        const data = await res.json();
        if (!data.error) setHistory(data);
      } catch {}
    }
    try { localStorage.removeItem("ironlog-session"); } catch {}
    setView("home"); setActiveDay(null); setLog({}); setStarted(false);
  };

  const openEditModal = (eid: string) => {
    const sets: Record<string, { weight: number; reps: number }> = {};
    for (const [k, v] of Object.entries(log)) {
      if (k.startsWith(eid + "-")) sets[k] = { ...v };
    }
    setEditSets(sets);
    setEditEx(eid);
  };

  const saveEditSets = () => {
    const newLog = { ...log, ...editSets };
    setLog(newLog);
    try {
      const saved = localStorage.getItem("ironlog-session");
      if (saved) { const s = JSON.parse(saved); s.log = newLog; localStorage.setItem("ironlog-session", JSON.stringify(s)); }
    } catch {}
    setEditEx(null);
  };

  const abandonWorkout = () => {
    if (!confirm("Quit workout? Your progress will NOT be saved.")) return;
    timer.stopT();
    try { localStorage.removeItem("ironlog-session"); } catch {}
    setView("home"); setActiveDay(null); setLog({}); setStarted(false);
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Delete this session? This can't be undone.")) return;
    try {
      await fetch("/api/workout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      });
      const res = await fetch("/api/workout");
      const data = await res.json();
      if (!data.error) setHistory(data);
    } catch {}
  };

  const logSet = (eid: string, sn: number, w: string, r: string) => {
    const newLog = { ...log, [`${eid}-${sn}`]: { weight: parseFloat(w) || 0, reps: parseInt(r) || 0 } };
    setLog(newLog);
    try {
      const saved = localStorage.getItem("ironlog-session");
      if (saved) { const s = JSON.parse(saved); s.log = newLog; localStorage.setItem("ironlog-session", JSON.stringify(s)); }
    } catch {}
  };

  const doneCount = (eid: string, total: number) => {
    let c = 0; for (let i = 1; i <= total; i++) if (log[`${eid}-${i}`]) c++; return c;
  };
  const nextSetNum = (eid: string, total: number) => {
    for (let i = 1; i <= total; i++) if (!log[`${eid}-${i}`]) return i; return null;
  };
  const lastSessionBest = (eid: string) => {
    if (!activeDay) return { weight: 0, reps: 0 };
    const sessions = history[activeDay.id] || [];
    if (!sessions.length) return { weight: 0, reps: 0 };
    const recent = sessions[0];
    let w = 0, r = 0;
    const sets = recent.sets as Record<string, { weight: number; reps: number }>;
    for (const sk in sets) {
      if (sk.startsWith(eid + "-")) {
        if (sets[sk].weight > w) w = sets[sk].weight;
        if (sets[sk].reps > r) r = sets[sk].reps;
      }
    }
    return { weight: w, reps: r };
  };

  const overall = useMemo(() => getOverallStats(history), [history]);
  const bc: Record<string, string> = { compound: "#2ecc71", isolation: "#74b9ff", cardio: "#FF6B6B" };

  const EQUIPMENT_OPTIONS = [
    { id: "dumbbell", label: "Dumbbells" }, { id: "barbell", label: "Barbell" },
    { id: "resistance_band", label: "Resistance Bands" }, { id: "pullup_bar", label: "Pull-Up Bar" },
    { id: "bench", label: "Bench" }, { id: "kettlebell", label: "Kettlebell" },
    { id: "dip_bar", label: "Dip Bars" },
  ];
  const toggleEquip = (id: string) => setOb(o => ({ ...o, equipment: o.equipment.includes(id) ? o.equipment.filter(e => e !== id) : [...o.equipment, id] }));

  // ─── LOADING ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 18 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, letterSpacing: 6, color: "rgba(255,255,255,0.55)", animation: "breathe 1.8s ease infinite" }}>
        IRON<span style={{ color: "#FF6B6B" }}>LOG</span>
      </div>
      <div style={{ width: 80, height: 2, borderRadius: 2, background: "linear-gradient(90deg, transparent, rgba(255,107,107,0.4), transparent)", backgroundSize: "200% 100%", animation: "shimmer 1.4s linear infinite" }}/>
    </div>
  );

  // ─── LOGIN ──────────────────────────────────────────────────────────
  if (!user) {
    const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", padding: "14px 20px", width: "100%", maxWidth: 300, textAlign: "left" as const, outline: "none", display: "block", boxSizing: "border-box" as const, margin: "0 auto" };
    const inputStyleCenter: React.CSSProperties = { ...inputStyle, textAlign: "center" as const };
    const btnPrimary: React.CSSProperties = { display: "block", width: "100%", maxWidth: 300, margin: "16px auto 0", padding: "15px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
    const btnBack: React.CSSProperties = { background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16 };

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="slide-up" style={{ textAlign: "center", zIndex: 1, width: "100%", maxWidth: 340 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "#fff", marginBottom: 4 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 6, fontWeight: 300, marginBottom: 48 }}>TRACK · LIFT · PROGRESS</div>

          {/* ── Step: username ── */}
          {authStep === "username" && (<>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doCheckUsername()} placeholder="Username or email" autoFocus style={inputStyleCenter} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doCheckUsername} style={btnPrimary}>CONTINUE</button>
          </>)}

          {/* ── Step: register (new user) ── */}
          {authStep === "register" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Create your account</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 20, letterSpacing: 1 }}>{nameInput}</div>
            <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Email" type="email" style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Password" type="password" style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={confirmInput} onChange={e => setConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doRegister()} placeholder="Confirm password" type="password" style={inputStyle} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doRegister} style={btnPrimary}>CREATE ACCOUNT</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: setup (existing user, no password yet) ── */}
          {authStep === "setup" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Welcome back, <strong style={{ color: "#fff" }}>{nameInput}</strong></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>Set up a password to secure your account</div>
            <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Your email" type="email" style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="New password" type="password" style={{ ...inputStyle, marginBottom: 8 }} />
            <input value={confirmInput} onChange={e => setConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doSetup()} placeholder="Confirm password" type="password" style={inputStyle} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doSetup} style={btnPrimary}>SET PASSWORD</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: password (login) ── */}
          {authStep === "password" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Welcome back, <strong style={{ color: "#fff" }}>{nameInput}</strong></div>
            <input value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="Password" type="password" autoFocus style={{ ...inputStyle, marginBottom: 4 }} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doLogin} style={btnPrimary}>LOG IN</button>
            <button onClick={() => { setAuthStep("forgot"); setEmailInput(""); setAuthError(""); setForgotSent(false); }} style={{ ...btnBack, display: "block", width: "100%" }}>Forgot password?</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); setPasswordInput(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: forgot password ── */}
          {authStep === "forgot" && (<>
            {!forgotSent ? (<>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Enter your email to receive a temporary password</div>
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doForgot()} placeholder="Your email" type="email" autoFocus style={inputStyle} />
              {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
              <button onClick={doForgot} style={btnPrimary}>SEND RESET EMAIL</button>
            </>) : (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                Check your email for a temporary password, then log in to set a new one.
              </div>
            )}
            <button onClick={() => { setAuthStep("password"); setForgotSent(false); setAuthError(""); }} style={btnBack}>← Back to login</button>
          </>)}
        </div>
      </div>
    );
  }

  // ─── MUST RESET PASSWORD ────────────────────────────────────────────
  if (user && mustResetPassword) {
    const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", padding: "14px 20px", width: "100%", maxWidth: 300, textAlign: "center" as const, outline: "none", display: "block", boxSizing: "border-box" as const, margin: "0 auto" };
    const btnPrimary: React.CSSProperties = { display: "block", width: "100%", maxWidth: 300, margin: "16px auto 0", padding: "15px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="slide-up" style={{ textAlign: "center", zIndex: 1, width: "100%", maxWidth: 340 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "#fff", marginBottom: 4 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 6, fontWeight: 300, marginBottom: 48 }}>TRACK · LIFT · PROGRESS</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Welcome, <strong style={{ color: "#fff" }}>{user.username}</strong></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>Set a new password to continue</div>
          <input value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} placeholder="New password" type="password" autoFocus style={{ ...inputStyle, marginBottom: 8 }} />
          <input value={newConfirmInput} onChange={e => setNewConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doResetPassword()} placeholder="Confirm password" type="password" style={inputStyle} />
          {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
          <button onClick={doResetPassword} style={btnPrimary}>SET PASSWORD</button>
          <button onClick={doLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16 }}>Log out</button>
        </div>
      </div>
    );
  }

  // ─── ONBOARDING ─────────────────────────────────────────────────────
  if (showOnboarding) {
    const STEPS = 8;
    const progress = Math.round((onboardingStep / STEPS) * 100);
    const obInput: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", padding: "14px 20px", width: "100%", outline: "none", boxSizing: "border-box" as const };
    const obBtn: React.CSSProperties = { display: "block", width: "100%", marginTop: 24, padding: "15px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
    const obSkip: React.CSSProperties = { background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 14, display: "block", width: "100%" };
    const selCard = (active: boolean): React.CSSProperties => ({ padding: "16px 20px", borderRadius: 12, border: `1px solid ${active ? "#FF6B6B" : "rgba(255,255,255,0.08)"}`, background: active ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)", cursor: "pointer", marginBottom: 10, transition: "all 0.15s" });

    const canNext = () => {
      if (onboardingStep === 0) return true;
      if (onboardingStep === 1) return !!ob.dob && !!ob.gender;
      if (onboardingStep === 2) return !!ob.heightCm && !!ob.weightKg;
      if (onboardingStep === 3) return ob.goals.length > 0;
      if (onboardingStep === 4) return !!ob.targetArea;
      if (onboardingStep === 5) return !!ob.fitnessLevel;
      if (onboardingStep === 6) return !!ob.location;
      return true;
    };

    if (generatingPlan) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 32 }}>BUILDING YOUR PLAN</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: "#FF6B6B", marginBottom: 16 }}>IRON<span style={{ color: "#fff" }}>LOG</span></div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.7 }}>Analysing your goals and selecting the best exercises for you...</div>
      </div>
    );

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", padding: "48px 24px 80px" }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 40 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #FF6B6B, #ee5a24)", borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>

        {/* Step 0: Welcome */}
        {onboardingStep === 0 && (
          <div className="slide-up">
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 8 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Let's build your plan.</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 32 }}>Answer a few quick questions and we'll put together a personalised workout programme designed around your goals, schedule, and equipment.</div>
            <button onClick={() => setOnboardingStep(1)} style={obBtn}>GET STARTED</button>
            <button onClick={() => setShowOnboarding(false)} style={obSkip}>Skip — use default plan</button>
          </div>
        )}

        {/* Step 1: DOB + gender */}
        {onboardingStep === 1 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>ABOUT YOU</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 28 }}>When were you born?</div>
            <input type="date" value={ob.dob} onChange={e => setOb(o => ({ ...o, dob: e.target.value }))} style={{ ...obInput, marginBottom: 24, colorScheme: "dark" }} />
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>Gender</div>
            {["Male", "Female", "Other"].map(g => (
              <div key={g} style={selCard(ob.gender === g.toLowerCase())} onClick={() => setOb(o => ({ ...o, gender: g.toLowerCase() }))}>
                <div style={{ color: ob.gender === g.toLowerCase() ? "#FF6B6B" : "#fff", fontWeight: 500 }}>{g}</div>
              </div>
            ))}
            <button onClick={() => setOnboardingStep(2)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(0)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 2: Height + weight */}
        {onboardingStep === 2 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>YOUR BODY</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 28 }}>Height & weight</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Height (cm)</div>
            <input type="number" placeholder="e.g. 178" value={ob.heightCm} onChange={e => setOb(o => ({ ...o, heightCm: e.target.value }))} style={{ ...obInput, marginBottom: 16 }} />
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Weight (kg)</div>
            <input type="number" placeholder="e.g. 80" value={ob.weightKg} onChange={e => setOb(o => ({ ...o, weightKg: e.target.value }))} style={{ ...obInput, marginBottom: 16 }} />
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Body fat % <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span></div>
            <input type="number" placeholder="e.g. 18" value={ob.bodyFatPct} onChange={e => setOb(o => ({ ...o, bodyFatPct: e.target.value }))} style={obInput} />
            <button onClick={() => setOnboardingStep(3)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(1)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 3: Goal */}
        {onboardingStep === 3 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>YOUR GOALS</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>What are you training for?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Select all that apply — your plan will blend them.</div>
            {[
              { id: "muscle", label: "Build Muscle", desc: "Hypertrophy-focused training with progressive overload" },
              { id: "strength", label: "Get Stronger", desc: "Heavy compound lifts, low reps, long rest" },
              { id: "fat_loss", label: "Lose Fat", desc: "Higher volume, cardio finishers, calorie-burning focus" },
              { id: "fitness", label: "General Fitness", desc: "Balanced training to improve overall health and conditioning" },
            ].map(g => {
              const sel = ob.goals.includes(g.id);
              return (
                <div key={g.id} style={selCard(sel)} onClick={() => setOb(o => { const isSel = o.goals.includes(g.id); return { ...o, goals: isSel ? o.goals.filter(x => x !== g.id) : [...o.goals, g.id] }; })}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ color: sel ? "#FF6B6B" : "#fff", fontWeight: 600 }}>{g.label}</div>
                    {sel && <div style={{ color: "#FF6B6B", fontSize: 14 }}>✓</div>}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{g.desc}</div>
                </div>
              );
            })}
            <button onClick={() => setOnboardingStep(4)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(2)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 4: Target Area */}
        {onboardingStep === 4 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>FOCUS</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Any specific focus area?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>We'll add extra work for your priority muscle group, or adjust the plan for rehabilitation.</div>

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginBottom: 10 }}>MUSCLE FOCUS</div>
            {[
              { id: "none",      label: "Balanced",  desc: "No specific focus — well-rounded programme" },
              { id: "shoulders", label: "Shoulders", desc: "Build wider, rounder shoulders — extra OHP and lateral work" },
              { id: "glutes",    label: "Glutes",    desc: "Grow a bigger, stronger butt — hip thrust and glute priority" },
              { id: "back",      label: "Back",      desc: "Wider, thicker back — extra pull volume" },
              { id: "chest",     label: "Chest",     desc: "Build a bigger chest — extra pressing and isolation" },
              { id: "arms",      label: "Arms",      desc: "Bigger biceps and triceps — extra curl and extension work" },
              { id: "core",      label: "Core",      desc: "Stronger core and abs — extra core finishers on every day" },
              { id: "legs",      label: "Legs",      desc: "Bigger quads and hamstrings — extra leg volume" },
            ].map(t => (
              <div key={t.id} style={selCard(ob.targetArea === t.id)} onClick={() => setOb(o => ({ ...o, targetArea: t.id }))}>
                <div style={{ color: ob.targetArea === t.id ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.desc}</div>
              </div>
            ))}

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginBottom: 10, marginTop: 20 }}>REHABILITATION</div>
            {[
              { id: "rehab_knee",        label: "Rehab — Knee",        desc: "Low-impact, knee-friendly movements with controlled loading" },
              { id: "rehab_shoulder",    label: "Rehab — Shoulder",    desc: "Shoulder-safe modifications, rotator cuff and mobility work" },
              { id: "rehab_lower_back",  label: "Rehab — Lower Back",  desc: "Protect the spine — avoid heavy loading, core stability focus" },
            ].map(t => (
              <div key={t.id} style={selCard(ob.targetArea === t.id)} onClick={() => setOb(o => ({ ...o, targetArea: t.id }))}>
                <div style={{ color: ob.targetArea === t.id ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.desc}</div>
              </div>
            ))}

            <button onClick={() => setOnboardingStep(5)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(3)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 5: Experience */}
        {onboardingStep === 5 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>EXPERIENCE</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>How long have you been training?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>This helps us set the right volume and exercise selection.</div>
            {[
              { id: "beginner", label: "Less than 1 year", desc: "Focus on form, fundamentals, and building habits" },
              { id: "intermediate", label: "1–3 years", desc: "Comfortable with the main lifts, ready for more volume" },
              { id: "advanced", label: "3+ years", desc: "Strong base, looking to optimise and push harder" },
            ].map(l => (
              <div key={l.id} style={selCard(ob.fitnessLevel === l.id)} onClick={() => setOb(o => ({ ...o, fitnessLevel: l.id }))}>
                <div style={{ color: ob.fitnessLevel === l.id ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{l.desc}</div>
              </div>
            ))}
            <button onClick={() => setOnboardingStep(6)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(4)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 6: Location */}
        {onboardingStep === 6 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>SETUP</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 28 }}>Where do you train?</div>
            {[
              { id: "gym", label: "Gym", desc: "Full access to barbells, cables, machines" },
              { id: "home", label: "Home", desc: "I train at home with my own equipment" },
              { id: "both", label: "Both", desc: "Mix of gym and home sessions" },
            ].map(l => (
              <div key={l.id} style={selCard(ob.location === l.id)} onClick={() => setOb(o => ({ ...o, location: l.id, equipment: l.id === "gym" ? ["barbell","dumbbell","cable","machine","bench","pullup_bar","dip_bar","kettlebell"] : o.equipment }))}>
                <div style={{ color: ob.location === l.id ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{l.desc}</div>
              </div>
            ))}
            <button onClick={() => setOnboardingStep(ob.location === "gym" ? 8 : 7)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(5)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 7: Equipment (home/both only) */}
        {onboardingStep === 7 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>EQUIPMENT</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>What do you have available?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Select everything you have access to.</div>
            {EQUIPMENT_OPTIONS.map(e => (
              <div key={e.id} style={selCard(ob.equipment.includes(e.id))} onClick={() => toggleEquip(e.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: ob.equipment.includes(e.id) ? "#FF6B6B" : "#fff", fontWeight: 500 }}>{e.label}</div>
                  {ob.equipment.includes(e.id) && <div style={{ color: "#FF6B6B", fontSize: 16 }}>✓</div>}
                </div>
              </div>
            ))}
            <button onClick={() => setOnboardingStep(8)} style={obBtn}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(6)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 8: Days per week */}
        {onboardingStep === 8 && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>SCHEDULE</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>How many days per week?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>We'll recommend the optimal split for your schedule and goal.</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {[2,3,4,5,6].map(d => (
                <div key={d} onClick={() => setOb(o => ({ ...o, daysPerWeek: d }))} style={{ flex: 1, minWidth: 52, padding: "18px 0", textAlign: "center", borderRadius: 12, border: `1px solid ${ob.daysPerWeek === d ? "#FF6B6B" : "rgba(255,255,255,0.08)"}`, background: ob.daysPerWeek === d ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)", cursor: "pointer", color: ob.daysPerWeek === d ? "#FF6B6B" : "#fff", fontWeight: 700, fontSize: 20 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginBottom: 8 }}>days per week</div>
            <button onClick={submitOnboarding} style={obBtn}>BUILD MY PLAN</button>
            <button onClick={() => setOnboardingStep(ob.location === "gym" ? 6 : 7)} style={obSkip}>← Back</button>
          </div>
        )}
      </div>
    );
  }

  // ─── CUSTOMISE ──────────────────────────────────────────────────────
  if (view === "customise") {
    const planDays = customPlan ?? [];
    const EXERCISES_LIST = (EXERCISES as any[]);
    const exMovement = (e: any): string => {
      const pm: string[] = e.primaryMuscles;
      if (pm.includes("cardio")) return "cardio";
      if (pm.some((m: string) => ["chest", "shoulders", "triceps"].includes(m))) return "push";
      if (pm.some((m: string) => ["back", "biceps", "forearms"].includes(m))) return "pull";
      if (pm.some((m: string) => ["quads", "hamstrings", "glutes", "calves"].includes(m))) return "legs";
      return "core";
    };

    // Day editor view
    if (editingDay) {
      const exs: any[] = editingDay.exercises ?? [];
      const filtered = EXERCISES_LIST.filter((e: any) => {
        if (exSearch && !e.name.toLowerCase().includes(exSearch.toLowerCase()) &&
            !e.primaryMuscles.some((m: string) => m.toLowerCase().includes(exSearch.toLowerCase())) &&
            !e.secondaryMuscles.some((m: string) => m.toLowerCase().includes(exSearch.toLowerCase()))) return false;
        if (exFilterLoc !== "all") {
          if (exFilterLoc === "bodyweight" && !e.equipment.every((eq: string) => ["bodyweight", "resistance_band"].includes(eq))) return false;
          else if (exFilterLoc === "gym" && e.location !== "gym") return false;
          else if (exFilterLoc === "home" && !["home", "both"].includes(e.location)) return false;
        }
        if (exFilterMove !== "all" && exMovement(e) !== exFilterMove) return false;
        if (exFilterMuscle !== "all" && !e.primaryMuscles.includes(exFilterMuscle) && !e.secondaryMuscles.includes(exFilterMuscle)) return false;
        return true;
      }).slice(0, 60);

      return (
        <>
        <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", padding: "0 0 100px" }}>
          <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button onClick={() => { setEditingDay(null); setShowExBrowser(false); setExSearch(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#FF6B6B", letterSpacing: 3 }}>EDITING</div>
          </div>
          <div style={{ padding: "0 20px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{editingDay.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>{editingDay.focus}</div>

            {exs.map((ex: any, i: number) => (
              <div key={ex.id ?? i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace", marginTop: 3 }}>{ex.sets} × {ex.reps} · {ex.rest}s</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={async () => { const moved = moveExercise(exs, i, i - 1); if (i > 0) await saveDay(editingDay, moved); }} disabled={i === 0} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, color: i === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", width: 28, height: 28, cursor: i === 0 ? "default" : "pointer", fontSize: 14 }}>↑</button>
                  <button onClick={async () => { const moved = moveExercise(exs, i, i + 1); if (i < exs.length - 1) await saveDay(editingDay, moved); }} disabled={i === exs.length - 1} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, color: i === exs.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", width: 28, height: 28, cursor: i === exs.length - 1 ? "default" : "pointer", fontSize: 14 }}>↓</button>
                  <button onClick={async () => { const updated = exs.filter((_: any, j: number) => j !== i); await saveDay(editingDay, updated); }} style={{ background: "rgba(255,107,107,0.1)", border: "none", borderRadius: 6, color: "#FF6B6B", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}

            {/* Add exercise */}
            {!showExBrowser ? (
              <button onClick={() => { setShowExBrowser(true); setExSearch(""); }} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>+ Add Exercise</button>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 3, marginBottom: 12, fontFamily: "'Space Mono', monospace" }}>ADD EXERCISE</div>
                <input value={exSearch} onChange={e => setExSearch(e.target.value)} placeholder="Search exercises..." autoFocus style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "12px 16px", width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

                {/* Filter rows */}
                {(() => {
                  const chipStyle = (active: boolean, color?: string) => ({
                    padding: "5px 12px", borderRadius: 20, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                    border: active ? "1px solid transparent" : "1px solid rgba(255,255,255,0.1)",
                    background: active ? (color ?? "#fff") : "rgba(255,255,255,0.04)",
                    color: active ? "#000" : "rgba(255,255,255,0.5)",
                    cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
                  });
                  const row = { display: "flex", gap: 6, overflowX: "auto" as const, paddingBottom: 6, marginBottom: 6, scrollbarWidth: "none" as const };
                  return (
                    <div style={{ marginBottom: 10 }}>
                      {/* Location / equipment */}
                      <div style={row}>
                        {[["all","All"],["gym","Gym"],["home","Home"],["bodyweight","Bodyweight"]].map(([v,l]) => (
                          <button key={v} onClick={() => setExFilterLoc(v)} style={chipStyle(exFilterLoc===v,"#4ECDC4")}>{l}</button>
                        ))}
                      </div>
                      {/* Push / pull / movement */}
                      <div style={row}>
                        {[["all","All"],["push","Push"],["pull","Pull"],["legs","Legs"],["core","Core"],["cardio","Cardio"]].map(([v,l]) => (
                          <button key={v} onClick={() => setExFilterMove(v)} style={chipStyle(exFilterMove===v,"#FF6B6B")}>{l}</button>
                        ))}
                      </div>
                      {/* Muscle group */}
                      <div style={row}>
                        {[["all","All"],["chest","Chest"],["back","Back"],["shoulders","Shoulders"],["biceps","Biceps"],["triceps","Triceps"],["forearms","Forearms"],["quads","Quads"],["hamstrings","Hamstrings"],["glutes","Glutes"],["calves","Calves"],["core","Core"]].map(([v,l]) => (
                          <button key={v} onClick={() => setExFilterMuscle(v)} style={chipStyle(exFilterMuscle===v,"#FFE66D")}>{l}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{filtered.length} EXERCISES</div>
                    </div>
                  );
                })()}

                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {filtered.map((ex: any) => (
                    <div key={ex.id} onClick={async () => {
                      const newEx = { exerciseId: ex.id, name: ex.name, sets: 3, reps: "10–12", rest: 60, notes: null };
                      await saveDay(editingDay, [...exs, newEx]);
                      setShowExBrowser(false); setExSearch(""); setExFilterLoc("all"); setExFilterMove("all"); setExFilterMuscle("all");
                    }} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", marginBottom: 6, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {(() => { const tu = getExerciseImageUrls(ex.id, ex.name); return tu ? <img src={tu[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/> : null; })()}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                            <span style={{ color: "#FF6644" }}>{ex.primaryMuscles.join(" · ")}</span>
                            {ex.secondaryMuscles.length > 0 && <span style={{ color: "rgba(255,255,255,0.25)" }}> · {ex.secondaryMuscles.join(" · ")}</span>}
                            <span style={{ color: "rgba(255,255,255,0.2)" }}> · {ex.difficulty}</span>
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setFormPreview({ id: ex.id, name: ex.name, muscles: ex.primaryMuscles ?? [], secondaryMuscles: ex.secondaryMuscles ?? [] }); }}
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "2px 6px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, flexShrink: 0 }}
                        >FORM</button>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>No exercises match these filters</div>}
                </div>
                <button onClick={() => { setShowExBrowser(false); setExSearch(""); setExFilterLoc("all"); setExFilterMove("all"); setExFilterMuscle("all"); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
        {formPreview && (() => {
          const urls = getExerciseImageUrls(formPreview.id, formPreview.name);
          const primary = formPreview.muscles; const secondary = formPreview.secondaryMuscles ?? [];
          const allMuscles = [...primary, ...secondary].filter((m, i, a) => a.indexOf(m) === i);
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setFormPreview(null)}>
              <div style={{ width: "100%", maxWidth: 420 }} onClick={e => e.stopPropagation()}
                onTouchStart={e => { swipeTouchX.current = e.touches[0].clientX; }}
                onTouchEnd={e => { const dx = e.changedTouches[0].clientX - swipeTouchX.current; if (Math.abs(dx) > 50) setModalSlide(dx < 0 ? 1 : 0); }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{formPreview.name}</div>
                    {allMuscles.length > 0 && (
                      <div style={{ fontSize: 10, letterSpacing: 1 }}>
                        {primary.map((m, i) => <span key={m} style={{ color: "#FF6644" }}>{i > 0 ? " · " : ""}{m.toUpperCase()}</span>)}
                        {secondary.map((m, i) => <span key={m} style={{ color: "rgba(255,255,255,0.35)" }}>{(i > 0 || primary.length > 0) ? " · " : ""}{m.toUpperCase()}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setFormPreview(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 0 0 12px" }}>×</button>
                </div>
                {modalSlide === 0 ? (
                  urls && !formImgError ? (
                    <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", background: "#111" }}>
                      <img key={urls[formFrame]} src={urls[formFrame]} alt={formPreview.name} style={{ width: "100%", display: "block", minHeight: 220, objectFit: "cover" }} onError={() => setFormImgError(true)} />
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{formFrame === 0 ? "START" : "END"}</div>
                    </div>
                  ) : (
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 36, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No form demo available</div>
                  )
                ) : (
                  <div style={{ background: "#0b0b0b", borderRadius: 14, overflow: "hidden", padding: "10px 8px 4px" }}>
                    <MuscleDiagram primary={primary} secondary={secondary} exerciseId={formPreview.id} exerciseName={formPreview.name}/>
                    {allMuscles.length > 0 && (() => {
                      const det = lookupMuscleDetail(formPreview.id, formPreview.name);
                      const pNames = det ? det.p.filter((k, i, a) => a.indexOf(k) === i).map((k: string) => SUB_MUSCLE_LABELS[k] ?? k) : [];
                      const sNames = det ? det.s.filter((k, i, a) => a.indexOf(k) === i).map((k: string) => SUB_MUSCLE_LABELS[k] ?? k) : [];
                      return (
                        <div style={{ textAlign: "center", padding: "6px 8px 8px" }}>
                          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF4422" }}/><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>PRIMARY</span></div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF9900" }}/><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>SECONDARY</span></div>
                          </div>
                          {pNames.length > 0 && <div style={{ fontSize: 11, color: "#FF6644" }}>{pNames.join("  ·  ")}</div>}
                          {sNames.length > 0 && <div style={{ fontSize: 10, color: "rgba(255,200,100,0.6)", marginTop: 2 }}>{sNames.join("  ·  ")}</div>}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10 }}>
                  <button onClick={() => setModalSlide(0)} style={{ width: modalSlide === 0 ? 20 : 8, height: 8, borderRadius: 4, border: "none", background: modalSlide === 0 ? "#fff" : "rgba(255,255,255,0.25)", cursor: "pointer", padding: 0, transition: "all 0.25s" }}/>
                  <button onClick={() => setModalSlide(1)} style={{ width: modalSlide === 1 ? 20 : 8, height: 8, borderRadius: 4, border: "none", background: modalSlide === 1 ? "#FF6644" : "rgba(255,255,255,0.25)", cursor: "pointer", padding: 0, transition: "all 0.25s" }}/>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "center", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                  {modalSlide === 0 ? "SWIPE LEFT · MUSCLES MAP" : "SWIPE RIGHT · FORM DEMO"} · TAP OUTSIDE TO CLOSE
                </div>
              </div>
            </div>
          );
        })()}
        </>
      );
    }

    // Plan overview — list all days
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", padding: "0 0 100px" }}>
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)" }}>CUSTOMISE PLAN</div>
          <div style={{ width: 48 }} />
        </div>
        <div style={{ padding: "0 20px" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 20 }}>Tap a day to add, remove, or reorder exercises. Your workout history is always preserved.</div>
          <button onClick={() => { setView("home"); setOnboardingStep(0); setShowOnboarding(true); }} style={{ display: "block", width: "100%", padding: "14px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 12, color: "rgba(255,107,107,0.8)", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 28 }}>↺ REBUILD MY WEEKLY PLAN</button>
          {planDays.map((day: any, i: number) => (
            <div key={day.id} className="card-hover" style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => setEditingDay(day)}>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{day.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{day.exercises?.length ?? 0} exercises</div>
                </div>
                <div style={{ color: "#FF6B6B", fontSize: 13, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>EDIT ›</div>
              </div>
            </div>
          ))}
          {planDays.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 40 }}>No plan yet. Complete the questionnaire first.</div>
          )}
        </div>
      </div>
    );
  }

  // ─── HOME ───────────────────────────────────────────────────────────
  if (view === "home") return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 20px 0" }}>
        <button onClick={() => setView("settings")} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, cursor: "pointer", textAlign: "left", padding: "10px 14px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 300, letterSpacing: 1 }}>Welcome back</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{user.username}</div>
            {user.role === "trainer" && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#4ECDC4", background: "rgba(78,205,196,0.1)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 4, padding: "2px 6px" }}>TRAINER</span>}
            {user.role === "admin" && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#a29bfe", background: "rgba(162,155,254,0.1)", border: "1px solid rgba(162,155,254,0.3)", borderRadius: 4, padding: "2px 6px" }}>ADMIN</span>}
            {user.role === "user" && user.roleRequest && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#fdcb6e", background: "rgba(253,203,110,0.1)", border: "1px solid rgba(253,203,110,0.3)", borderRadius: 4, padding: "2px 6px" }}>REVIEWING</span>}
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>›</span>
          </div>
        </button>
        <button onClick={doLogout} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", letterSpacing: 1 }}>LOG OUT</button>
      </div>
      {showNotifBanner && notifStatus === "idle" && (
        <div style={{ margin: "16px 20px 0", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.22)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#4ECDC4", marginBottom: 3 }}>Enable notifications</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>Get notified when you receive a message or a trainer sends you a request.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button onClick={async () => {
              setShowNotifBanner(false);
              setNotifStatus("requesting");
              const s = await subscribeToPush();
              setNotifStatus(s);
            }} style={{ background: "#4ECDC4", border: "none", borderRadius: 8, padding: "7px 14px", color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>ENABLE</button>
            <button onClick={() => { localStorage.setItem("ironlog-notif-dismissed", "1"); setShowNotifBanner(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "2px 0", textAlign: "center" }}>Not now</button>
          </div>
        </div>
      )}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>YOUR SPLIT</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={openCustomise} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>CUSTOMISE</button>
          </div>
        </div>
        {planNote && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontStyle: "italic", lineHeight: 1.5 }}>{planNote}</div>}
        {(customPlan ? customPlan.map(planDayToWorkoutDay) : WORKOUT_DATA).map((d, i) => {
          const isActive = started && activeDay?.id === d.id;
          const isLocked = started && activeDay?.id !== d.id;
          return (
            <div
              key={d.id}
              className={isLocked ? undefined : "card-hover"}
              style={{ animationDelay: `${i * 0.06}s`, marginBottom: 10, cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.3 : 1, transition: "opacity 0.2s" }}
              onClick={() => {
                if (isLocked) return;
                if (isActive) { setView("workout"); return; }
                openDay(d);
              }}
            >
              <div style={{
                background: isActive ? `${d.color}14` : "rgba(255,255,255,0.04)",
                border: isActive ? `1px solid ${d.color}60` : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16, padding: "20px", position: "relative", overflow: "hidden",
                boxShadow: isActive ? `0 0 20px ${d.color}18` : "none",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: isActive ? 6 : 4, height: "100%", background: d.gradient, borderRadius: "16px 0 0 16px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: d.color, fontWeight: 700, opacity: 0.7 }}>{d.label}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{d.title}</span>
                      {isActive && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: d.color, background: `${d.color}18`, border: `1px solid ${d.color}40`, borderRadius: 4, padding: "2px 6px" }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, fontWeight: 300 }}>{d.focus}</div>
                    {isActive && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: d.color, letterSpacing: 2 }}>{timer.fmt}</div>
                        <div style={{ fontSize: 11, color: d.color, opacity: 0.7, letterSpacing: 1 }}>TAP TO RESUME →</div>
                      </div>
                    )}
                    {!isActive && history[d.id]?.[0] && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 10, fontFamily: "'Space Mono', monospace" }}>Last: {history[d.id][0].date} · {history[d.id][0].duration}</div>}
                  </div>
                  <div style={{ color: isActive ? d.color : "rgba(255,255,255,0.15)", fontSize: 20 }}>›</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* ── Saved Routines ── */}
      <div style={{ padding: "20px 20px 0" }}>
        {/* Header row — always visible */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showSavedList || showSaveRoutine ? 12 : 0 }}>
          <button onClick={() => { setShowSavedList(s => !s); setShowSaveRoutine(false); setSharingRoutineId(null); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>SAVED ROUTINES</div>
            {savedRoutines.length > 0 && <div style={{ background: "rgba(78,205,196,0.15)", borderRadius: 10, padding: "1px 7px", fontSize: 10, color: "#4ECDC4", fontFamily: "'Space Mono', monospace" }}>{savedRoutines.length}</div>}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", transform: showSavedList ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
          </button>
          <button onClick={() => { setShowSaveRoutine(s => !s); setShowSavedList(false); setSaveRoutineName(""); setSharingRoutineId(null); }} style={{ background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 8, color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace", padding: "6px 12px" }}>
            {showSaveRoutine ? "CANCEL" : "+ SAVE"}
          </button>
        </div>

        {/* Save name input */}
        {showSaveRoutine && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={saveRoutineName}
              onChange={e => setSaveRoutineName(e.target.value)}
              onKeyDown={async e => { if (e.key === "Enter") await doSaveRoutine(); }}
              placeholder="Name this routine…"
              maxLength={40}
              autoFocus
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "11px 14px", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={doSaveRoutine} disabled={savingRoutine || !saveRoutineName.trim()} style={{ padding: "11px 16px", background: saveRoutineName.trim() ? "#4ECDC4" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, color: saveRoutineName.trim() ? "#000" : "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: saveRoutineName.trim() ? "pointer" : "default", fontFamily: "'Space Mono', monospace" }}>
              {savingRoutine ? "…" : "SAVE"}
            </button>
          </div>
        )}

        {/* Routine list — hidden by default */}
        {showSavedList && (
          <div className="fade-in">
            {savedRoutines.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans', sans-serif", padding: "4px 0 8px" }}>No saved routines yet.</div>
            )}
            {savedRoutines.map(r => (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                {/* Routine row */}
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
                      {(r.planJson as any[]).length} days · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {r.sharedBy && <span style={{ color: "rgba(78,205,196,0.5)", marginLeft: 6 }}>from @{r.sharedBy}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setSharingRoutineId(sharingRoutineId === r.id ? null : r.id); setShareUsername(""); setShareResult(null); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "'Space Mono', monospace", padding: "6px 10px" }}>↗</button>
                    <button onClick={() => doRestoreRoutine(r.id, r.name)} style={{ background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 8, color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace", padding: "6px 10px" }}>RESTORE</button>
                    <button onClick={() => doDeleteRoutine(r.id)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "rgba(255,255,255,0.25)", fontSize: 11, cursor: "pointer", fontFamily: "'Space Mono', monospace", padding: "6px 10px" }}>✕</button>
                  </div>
                </div>
                {/* Share panel */}
                {sharingRoutineId === r.id && (
                  <div className="fade-in" style={{ padding: "0 14px 12px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8, paddingTop: 10 }}>SHARE WITH USER</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={shareUsername}
                        onChange={e => { setShareUsername(e.target.value); setShareResult(null); }}
                        onKeyDown={async e => { if (e.key === "Enter") await doShareRoutine(r.id); }}
                        placeholder="Exact username…"
                        autoFocus
                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: "9px 12px", outline: "none", boxSizing: "border-box" }}
                      />
                      <button onClick={() => doShareRoutine(r.id)} disabled={sharingLoading || !shareUsername.trim()} style={{ padding: "9px 14px", background: shareUsername.trim() ? "#4ECDC4" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, color: shareUsername.trim() ? "#000" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: shareUsername.trim() ? "pointer" : "default", fontFamily: "'Space Mono', monospace" }}>
                        {sharingLoading ? "…" : "SEND"}
                      </button>
                    </div>
                    {shareResult && <div style={{ fontSize: 11, color: shareResult.startsWith("Sent") ? "#4ECDC4" : "rgba(255,107,107,0.8)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{shareResult}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {user.role === "trainer" && (
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>FIND CLIENTS</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={trainerSearch}
              onChange={e => { setTrainerSearch(e.target.value); if (!e.target.value.trim()) { setTrainerResults([]); setTrainerHasSearched(false); } }}
              onKeyDown={e => { if (e.key === "Enter") doTrainerSearch(); }}
              placeholder="Enter exact username…"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "13px 16px", flex: 1, outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={() => doTrainerSearch()} style={{ padding: "13px 18px", background: "#4ECDC4", border: "none", borderRadius: 12, color: "#000", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>SEARCH</button>
          </div>
          {trainerSearching && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "12px 0" }}>Searching…</div>}
          {trainerResults.map(u => {
            const req = trainerRequests.find(r => r.userId === u.id);
            const status = req?.status ?? null;
            return (
              <div key={u.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                    {u.logCount} workout{u.logCount !== 1 ? "s" : ""} · joined {new Date(u.joinedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                  </div>
                </div>
                {status === "pending" && <span style={{ fontSize: 10, letterSpacing: 1, color: "#f0c040", fontFamily: "'Space Mono', monospace" }}>PENDING</span>}
                {status === "accepted" && <span style={{ fontSize: 10, letterSpacing: 1, color: "#4ECDC4", fontFamily: "'Space Mono', monospace" }}>ACCEPTED</span>}
                {status === "declined" && (
                  <button onClick={() => sendAdoptionRequest(u.id)} disabled={sendingRequest === u.id} style={{ fontSize: 11, padding: "6px 12px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "rgba(255,107,107,0.7)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>RE-SEND</button>
                )}
                {!status && (
                  <button onClick={() => sendAdoptionRequest(u.id)} disabled={sendingRequest === u.id} style={{ fontSize: 11, padding: "6px 12px", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 8, color: "#4ECDC4", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{sendingRequest === u.id ? "…" : "SEND REQUEST"}</button>
                )}
              </div>
            );
          })}
          {trainerSearchError && (
            <div style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center", padding: "12px 0", fontFamily: "'Space Mono', monospace" }}>{trainerSearchError}</div>
          )}
          {trainerHasSearched && !trainerSearching && !trainerSearchError && trainerResults.length === 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "16px 0" }}>No users found matching "{trainerSearch}"</div>
          )}
        </div>
      )}
      {user.role === "trainer" && (
        <div style={{ padding: "24px 20px 0" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>MY CLIENTS</div>
          {clients.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic", padding: "8px 0" }}>No accepted clients yet — send requests above</div>
          ) : clients.map(c => (
            <div key={c.id} className="card-hover" onClick={() => openClientDetail(c)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>@{c.username}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                  {c.logCount} workout{c.logCount !== 1 ? "s" : ""}
                  {c.lastWorkout ? ` · last ${new Date(c.lastWorkout.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : " · no sessions yet"}
                </div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="card-hover" onClick={() => setView("messages")} style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: unreadCount > 0 ? "#4ECDC4" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxSizing: "border-box" }}>
          MESSAGES
          {unreadCount > 0 && <span style={{ background: "#4ECDC4", color: "#000", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{unreadCount}</span>}
        </button>
        <button className="card-hover" onClick={() => { setView("progress"); setProgressTab("dashboard"); }} style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>VIEW PROGRESS →</button>
      </div>
    </div>
  );

  // ─── CLIENT DETAIL ──────────────────────────────────────────────────
  if (view === "clientDetail" && activeClient) {
    const COLORS = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"];
    const GRADIENTS = [
      "linear-gradient(135deg,#FF6B6B,#ee5a24)",
      "linear-gradient(135deg,#4ECDC4,#44a08d)",
      "linear-gradient(135deg,#45B7D1,#2980b9)",
      "linear-gradient(135deg,#96CEB4,#6aab8e)",
      "linear-gradient(135deg,#f7d794,#e17055)",
      "linear-gradient(135deg,#DDA0DD,#9b59b6)",
    ];

    const splitDays: Array<{ id: string; label: string; title: string; focus: string; color: string; gradient: string; exercises: any[] }> = clientData?.plan
      ? clientData.plan.days.map((d: any, i: number) => ({
          id: d.id,
          label: `DAY ${i + 1}`,
          title: d.title,
          focus: d.focus,
          color: COLORS[i % 6],
          gradient: GRADIENTS[i % 6],
          exercises: d.exercises,
        }))
      : WORKOUT_DATA.map((d, i) => ({
          id: d.id,
          label: d.label,
          title: d.title,
          focus: d.focus,
          color: d.color,
          gradient: d.gradient,
          exercises: d.sections.flatMap(s => s.exercises).map(ex => ({
            name: ex.name, sets: ex.sets, reps: ex.reps,
          })),
        }));

    const getDayName = (dayId: string) => {
      if (clientData?.plan) {
        const pd = clientData.plan.days.find((d: any) => d.id === dayId);
        if (pd) return pd.title;
      }
      for (const d of WORKOUT_DATA) if (d.id === dayId) return d.title;
      return "Workout";
    };

    const flatHistory = clientData
      ? Object.entries(clientData.history)
          .flatMap(([dayId, sessions]) => (sessions as any[]).map(s => ({ ...s, dayId, dayName: getDayName(dayId) })))
          .sort((a, b) => b.date.localeCompare(a.date))
      : [];

    const lastWorkoutByDay: Record<string, string> = {};
    for (const s of flatHistory) {
      if (!lastWorkoutByDay[s.dayId]) lastWorkoutByDay[s.dayId] = s.date;
    }

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
        <div style={{ padding: "24px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
        </div>
        <div style={{ padding: "0 20px 0" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>@{activeClient.username}</div>
          {clientData?.profile && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
              {clientData.profile.goal?.replace(/_/g, " ")} · {clientData.profile.fitnessLevel}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "16px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {(["split", "history", "profile"] as const).map(tab => (
            <button key={tab} onClick={() => setClientDetailTab(tab)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: clientDetailTab === tab ? "2px solid #4ECDC4" : "2px solid transparent",
              color: clientDetailTab === tab ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 11, fontWeight: 600, letterSpacing: 2, cursor: "pointer",
              fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
              transition: "all 0.2s",
            }}>{tab}</button>
          ))}
        </div>

        {clientDataLoading && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "48px 0" }}>Loading…</div>
        )}

        {/* ─── SPLIT TAB ─── */}
        {!clientDataLoading && clientDetailTab === "split" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>
            {proposalSent && (
              <div style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#4ECDC4", textAlign: "center" }}>
                Proposal sent — waiting for client to accept
              </div>
            )}
            {!editingPlan ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  {!clientData?.plan
                    ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Using default 5-day split</div>
                    : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Custom plan</div>
                  }
                  <button onClick={startEditPlan} style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 8, padding: "6px 14px", color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>EDIT PLAN</button>
                </div>
                {splitDays.map(d => (
                  <div key={d.id} style={{ marginBottom: 8 }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: d.gradient, borderRadius: "14px 0 0 14px" }} />
                      <div style={{ paddingLeft: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: d.color, fontWeight: 700, opacity: 0.8 }}>{d.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{d.title}</span>
                          </div>
                          {lastWorkoutByDay[d.id] && (
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>{lastWorkoutByDay[d.id]}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 5, fontWeight: 300 }}>{d.focus}</div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                          {d.exercises.map((ex: any, i: number) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{ex.name}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>{ex.sets}×{ex.reps}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Editing plan</div>
                  <button onClick={() => { setEditingPlan(false); setEditedPlanDays(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                </div>
                {(editedPlanDays ?? []).map((d: any, di: number) => {
                  const color = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"][di % 6];
                  const gradient = ["linear-gradient(135deg,#FF6B6B,#ee5a24)","linear-gradient(135deg,#4ECDC4,#44a08d)","linear-gradient(135deg,#45B7D1,#2980b9)","linear-gradient(135deg,#96CEB4,#6aab8e)","linear-gradient(135deg,#f7d794,#e17055)","linear-gradient(135deg,#DDA0DD,#9b59b6)"][di % 6];
                  return (
                    <div key={di} style={{ marginBottom: 12 }}>
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: gradient, borderRadius: "14px 0 0 14px" }} />
                        <div style={{ paddingLeft: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color, fontWeight: 700, opacity: 0.8 }}>DAY {di + 1}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{d.title}</span>
                          </div>
                          {d.exercises.map((ex: any, ei: number) => (
                            <div key={ei} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
                              <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ex.name}</div>
                              <input
                                type="number"
                                value={ex.sets}
                                min={1} max={20}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 1;
                                  setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : {
                                    ...day,
                                    exercises: day.exercises.map((x: any, ej: number) => ej !== ei ? x : { ...x, sets: val }),
                                  }));
                                }}
                                style={{ width: 40, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 12, textAlign: "center", padding: "4px", fontFamily: "'Space Mono', monospace" }}
                              />
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>×</span>
                              <input
                                type="text"
                                value={ex.reps}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : {
                                    ...day,
                                    exercises: day.exercises.map((x: any, ej: number) => ej !== ei ? x : { ...x, reps: val }),
                                  }));
                                }}
                                style={{ width: 52, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 12, textAlign: "center", padding: "4px", fontFamily: "'Space Mono', monospace" }}
                              />
                              <button onClick={() => {
                                setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : {
                                  ...day,
                                  exercises: day.exercises.filter((_: any, ej: number) => ej !== ei),
                                }));
                              }} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.5)", fontSize: 14, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={proposePlan}
                  disabled={proposingPlan}
                  style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#4ECDC4,#44a08d)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: proposingPlan ? "not-allowed" : "pointer", fontFamily: "'Space Mono', monospace", opacity: proposingPlan ? 0.6 : 1, marginBottom: 8 }}
                >
                  {proposingPlan ? "SENDING…" : "PROPOSE TO CLIENT"}
                </button>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 8 }}>Client will receive a message to accept or decline these changes</div>
              </>
            )}
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {!clientDataLoading && clientDetailTab === "history" && (() => {
          // Build exerciseId → name: seed from WORKOUT_DATA first, then override with custom plan
          const exNameMap: Record<string, string> = {};
          for (const d of WORKOUT_DATA) {
            for (const s of d.sections) {
              for (const ex of s.exercises) exNameMap[ex.id] = ex.name;
            }
          }
          if (clientData?.plan?.days) {
            for (const day of clientData.plan.days) {
              for (const ex of day.exercises ?? []) {
                if (ex.exerciseId) exNameMap[ex.exerciseId] = ex.name;
              }
            }
          }

          return (
            <div className="fade-in" style={{ padding: "16px 20px 0" }}>
              {flatHistory.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "48px 0" }}>No workouts logged yet</div>
              )}
              {flatHistory.map((s: any, i: number) => {
                const sessionKey = s.id ?? `${s.dayId}-${i}`;
                const isOpen = openClientSession === sessionKey;
                const rawSets = (s.sets ?? {}) as Record<string, { weight: number; reps: number }>;

                // Group sets by exerciseId
                const byExercise: Record<string, { name: string; sets: { setNum: string; weight: number; reps: number }[] }> = {};
                for (const [k, v] of Object.entries(rawSets)) {
                  const parts = k.split("-");
                  const setNum = parts.pop()!;
                  const eid = parts.join("-");
                  if (!byExercise[eid]) byExercise[eid] = { name: exNameMap[eid] ?? eid, sets: [] };
                  byExercise[eid].sets.push({ setNum, weight: v.weight, reps: v.reps });
                }
                for (const ex of Object.values(byExercise)) ex.sets.sort((a, b) => Number(a.setNum) - Number(b.setNum));

                // Planned exercises for this day from client plan
                const planDay = (clientData?.plan as any)?.days?.find((d: any) => d.id === s.dayId);
                const plannedExercises: { exerciseId: string; name: string; sets: number }[] =
                  planDay?.exercises ?? Object.keys(byExercise).map(eid => ({ exerciseId: eid, name: exNameMap[eid] ?? eid, sets: 0 }));

                const loggedCount = Object.keys(byExercise).length;
                const totalCount = plannedExercises.length || loggedCount;
                const completedCount = plannedExercises.filter((pe: any) => byExercise[pe.exerciseId]).length;

                return (
                  <div key={sessionKey} style={{ marginBottom: 8 }}>
                    <div
                      onClick={() => setOpenClientSession(isOpen ? null : sessionKey)}
                      style={{
                        background: isOpen ? "rgba(78,205,196,0.06)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isOpen ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.05)"}`,
                        borderRadius: isOpen ? "12px 12px 0 0" : 12,
                        padding: "14px 16px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.dayName}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                          {s.date} · {s.duration}
                          {totalCount > 0 && <span style={{ color: completedCount === totalCount ? "#4ECDC4" : "rgba(255,180,0,0.7)", marginLeft: 8 }}>
                            {completedCount}/{totalCount} exercises
                          </span>}
                        </div>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 14, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
                    </div>

                    {isOpen && (
                      <div className="fade-in" style={{
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(78,205,196,0.15)",
                        borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px",
                      }}>
                        {plannedExercises.length > 0 ? plannedExercises.map((pe: any) => {
                          const logged = byExercise[pe.exerciseId];
                          return (
                            <div key={pe.exerciseId} style={{ marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: logged ? "#fff" : "rgba(255,255,255,0.2)" }}>{pe.name}</div>
                                {!logged && <div style={{ fontSize: 10, color: "rgba(255,107,107,0.5)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>SKIPPED</div>}
                              </div>
                              {logged && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 4 }}>
                                  {logged.sets.map(set => (
                                    <div key={set.setNum} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>
                                      S{set.setNum} <span style={{ color: "#fff", fontWeight: 600 }}>{set.weight}kg×{set.reps}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }) : Object.entries(byExercise).map(([eid, ex]) => (
                          <div key={eid} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{ex.name}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                              {ex.sets.map(set => (
                                <div key={set.setNum} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>
                                  S{set.setNum} <span style={{ color: "#fff", fontWeight: 600 }}>{set.weight}kg×{set.reps}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ─── PROFILE TAB ─── */}
        {!clientDataLoading && clientDetailTab === "profile" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>
            {!clientData?.profile ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "48px 0" }}>No profile set up yet</div>
            ) : (() => {
              const p = clientData.profile;
              const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null;
              const stats = [
                { label: "AGE", value: age ? `${age}y` : "—" },
                { label: "WEIGHT", value: `${p.weightKg}kg` },
                { label: "HEIGHT", value: `${p.heightCm}cm` },
                { label: "BODY FAT", value: p.bodyFatPct ? `${p.bodyFatPct}%` : "—" },
                { label: "DAYS/WK", value: `${p.daysPerWeek}` },
                { label: "GENDER", value: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "—" },
              ];
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {stats.map((s, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{s.value}</div>
                        <div style={{ fontSize: 8, color: "#4ECDC4", letterSpacing: 2, marginTop: 4, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const fmtLocation = (loc: string) => {
                      if (!loc) return "—";
                      if (loc.toLowerCase() === "both") return "Gym & Home";
                      return loc.charAt(0).toUpperCase() + loc.slice(1);
                    };
                    const fmtEquipment = (items: string[]) => {
                      if (!items?.length) return "—";
                      const aliases: Record<string, string> = {
                        pullup_bar: "Pull-up Bar", dip_bar: "Dip Bar",
                        resistance_band: "Resistance Band", pull_up_bar: "Pull-up Bar",
                      };
                      return items.map(e => aliases[e.toLowerCase()] ?? e.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(", ");
                    };
                    return [
                      { label: "GOAL", value: p.goal?.replace(/_/g, " ") },
                      { label: "FITNESS LEVEL", value: p.fitnessLevel },
                      { label: "LOCATION", value: fmtLocation(p.location) },
                      { label: "EQUIPMENT", value: fmtEquipment(p.equipment as string[]) },
                      { label: "TARGET AREA", value: p.targetArea && p.targetArea !== "none" ? p.targetArea : "—" },
                    ];
                  })().map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: "#fff", textTransform: "capitalize" }}>{row.value || "—"}</div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // ─── MESSAGES LIST ──────────────────────────────────────────────────
  if (view === "messages") return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px", minHeight: "100vh" }}>
      <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>MESSAGES</div>
      </div>
      <div style={{ padding: "0 20px" }}>
        {conversations.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 60 }}>No messages yet</div>
        )}
        {conversations.map(c => (
          <div key={c.partner.id} className="card-hover" onClick={() => openConversation(c.partner)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${c.unreadCount > 0 ? "rgba(78,205,196,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "16px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>@{c.partner.username}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.latestMessage.type === "adoption_request" ? "Trainer request" : c.latestMessage.type === "plan_proposal" ? "Plan update proposed" : c.latestMessage.body}
              </div>
            </div>
            {c.unreadCount > 0 && (
              <span style={{ background: "#4ECDC4", color: "#000", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono', monospace", flexShrink: 0, marginLeft: 12 }}>{c.unreadCount}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ─── CONVERSATION ────────────────────────────────────────────────────
  if (view === "conversation" && activeConversation) return (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "24px 20px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <button onClick={() => { setView("messages"); setActiveConversation(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>@{activeConversation.username}</div>
      </div>
      <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {conversationMessages.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 40 }}>No messages yet</div>
        )}
        {conversationMessages.map(msg => {
          const isMine = msg.from.id === user.id;
          if (msg.type === "adoption_request") {
            const isPending = incomingRequests.some(r => r.id === msg.requestId);
            return (
              <div key={msg.id} style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 14, padding: "14px 16px", maxWidth: "85%" }}>
                <div style={{ fontSize: 10, color: "#4ECDC4", letterSpacing: 3, fontFamily: "'Space Mono', monospace", marginBottom: 6 }}>TRAINER REQUEST</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: isPending ? 12 : 0 }}>{msg.body}</div>
                {isPending && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => respondToRequest(msg.requestId, "accept")} disabled={respondingRequest === msg.requestId} style={{ flex: 1, padding: "9px", background: "#4ECDC4", border: "none", borderRadius: 8, color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{respondingRequest === msg.requestId ? "…" : "ACCEPT"}</button>
                    <button onClick={() => respondToRequest(msg.requestId, "decline")} disabled={respondingRequest === msg.requestId} style={{ flex: 1, padding: "9px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "rgba(255,107,107,0.8)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{respondingRequest === msg.requestId ? "…" : "DECLINE"}</button>
                  </div>
                )}
                {!isPending && !isMine && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontFamily: "'Space Mono', monospace" }}>RESOLVED</div>}
              </div>
            );
          }
          if (msg.type === "plan_proposal" && msg.proposal) {
            const p = msg.proposal;
            const isPending = p.status === "pending" && !isMine;
            const planDays: any[] = (p.planJson as any)?.days ?? [];
            return (
              <div key={msg.id} style={{ background: "rgba(78,205,196,0.05)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 14, padding: "14px 16px", maxWidth: "92%", alignSelf: "flex-start" }}>
                <div style={{ fontSize: 10, color: "#4ECDC4", letterSpacing: 3, fontFamily: "'Space Mono', monospace", marginBottom: 6 }}>PLAN UPDATE</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>{msg.body}</div>
                {planDays.map((d: any, di: number) => {
                  const color = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"][di % 6];
                  return (
                    <div key={di} style={{ marginBottom: 8, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>DAY {di + 1} — {d.title}</div>
                      {(d.exercises ?? []).map((ex: any, ei: number) => (
                        <div key={ei} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.8 }}>
                          <span>{ex.name}</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)" }}>{ex.sets}×{ex.reps}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {isPending && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => respondToProposal(p.id, "accept")} style={{ flex: 1, padding: "9px", background: "#4ECDC4", border: "none", borderRadius: 8, color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>ACCEPT PLAN</button>
                    <button onClick={() => respondToProposal(p.id, "decline")} style={{ flex: 1, padding: "9px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "rgba(255,107,107,0.8)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>DECLINE</button>
                  </div>
                )}
                {!isPending && (
                  <div style={{ fontSize: 11, color: p.status === "accepted" ? "#4ECDC4" : "rgba(255,107,107,0.6)", marginTop: 8, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                    {p.status === "accepted" ? "✓ ACCEPTED" : p.status === "declined" ? "✗ DECLINED" : "PENDING"}
                  </div>
                )}
              </div>
            );
          }
          const renderBody = (text: string) => {
            const parts = text.split(/(https?:\/\/[^\s]+)/g);
            return parts.map((part, i) =>
              /^https?:\/\//.test(part)
                ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#4ECDC4", wordBreak: "break-all", textDecoration: "underline" }}>{part}</a>
                : part
            );
          };
          return (
            <div key={msg.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", background: isMine ? "rgba(78,205,196,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${isMine ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", maxWidth: "75%" }}>
              <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.4 }}>{renderBody(msg.body)}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, textAlign: isMine ? "right" : "left" }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: "12px 20px 32px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexShrink: 0 }}>
        <input
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Message…"
          style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "13px 16px", outline: "none" }}
        />
        <button onClick={sendMessage} disabled={sendingMessage || !messageText.trim()} style={{ padding: "13px 18px", background: messageText.trim() ? "#4ECDC4" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 12, color: messageText.trim() ? "#000" : "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: messageText.trim() ? "pointer" : "default", fontFamily: "'Space Mono', monospace", transition: "all 0.15s" }}>SEND</button>
      </div>
    </div>
  );

  // ─── SETTINGS ───────────────────────────────────────────────────────
  if (view === "settings") {
    const isTrainer = user.role === "trainer";
    const hasPendingRequest = user.roleRequest === "trainer";

    const doUpgrade = async () => {
      setUpgrading(true);
      setUpgradeError("");
      try {
        const res = await fetch("/api/auth", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request-trainer", note: upgradeNote.trim() }),
        });
        const data = await res.json();
        if (data.error) { setUpgradeError(data.error); setUpgrading(false); return; }
        setUser(u => u ? { ...u, role: data.user.role, roleRequest: data.user.roleRequest } : u);
        setConfirmUpgrade(false);
        setUpgradeNote("");
      } catch { setUpgradeError("Something went wrong"); }
      setUpgrading(false);
    };

    const cancelRequest = async () => {
      setCancellingRequest(true);
      try {
        const res = await fetch("/api/auth", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel-role-request" }),
        });
        const data = await res.json();
        if (!data.error) {
          setUser(u => u ? { ...u, roleRequest: null } : u);
        }
      } catch {}
      setCancellingRequest(false);
    };

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", padding: "0 0 80px" }}>
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)" }}>ACCOUNT</div>
        </div>

        <div style={{ padding: "0 20px" }}>
          {/* Profile card */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 12 }}>PROFILE</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>@{user.username}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Member since registration</div>
              </div>
              {isTrainer
                ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#4ECDC4", background: "rgba(78,205,196,0.1)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 6, padding: "4px 10px" }}>TRAINER</span>
                : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "4px 10px" }}>USER</span>
              }
            </div>
          </div>

          {/* Body & Stats */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingProfile ? 16 : 0 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 3 }}>BODY & STATS</div>
              {!editingProfile
                ? <button onClick={() => setEditingProfile(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", color: "rgba(255,255,255,0.6)", fontSize: 11, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>EDIT</button>
                : <button onClick={() => setEditingProfile(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              }
            </div>
            {!editingProfile ? (
              ob.weightKg || ob.heightCm || ob.dob ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
                  {[
                    { label: "WEIGHT", value: ob.weightKg ? `${ob.weightKg}kg` : "—" },
                    { label: "HEIGHT", value: ob.heightCm ? `${ob.heightCm}cm` : "—" },
                    { label: "BODY FAT", value: ob.bodyFatPct ? `${ob.bodyFatPct}%` : "—" },
                    { label: "GOAL", value: ob.goals.length ? ob.goals.map(g => g.replace(/_/g, " ")).join(", ") : "—" },
                    { label: "LEVEL", value: ob.fitnessLevel || "—" },
                    { label: "DAYS/WK", value: ob.daysPerWeek ? `${ob.daysPerWeek}` : "—" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{s.value}</div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginTop: 4, fontFamily: "'Space Mono', monospace" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 10 }}>No profile set up yet — tap EDIT to add your details</div>
              )
            ) : (
              <div>
                {[
                  { label: "Weight (kg)", key: "weightKg", type: "number", placeholder: "e.g. 80" },
                  { label: "Height (cm)", key: "heightCm", type: "number", placeholder: "e.g. 178" },
                  { label: "Body Fat %", key: "bodyFatPct", type: "number", placeholder: "e.g. 18 (optional)" },
                  { label: "Date of birth", key: "dob", type: "date", placeholder: "" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>{f.label.toUpperCase()}</div>
                    <input
                      type={f.type}
                      value={(ob as any)[f.key]}
                      placeholder={f.placeholder}
                      onChange={e => setOb(o => ({ ...o, [f.key]: e.target.value }))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "11px 14px", outline: "none", boxSizing: "border-box", fontFamily: f.type === "number" ? "'Space Mono', monospace" : "'DM Sans', sans-serif", colorScheme: "dark" }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>GENDER</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["male", "female", "other"].map(g => (
                      <button key={g} onClick={() => setOb(o => ({ ...o, gender: g }))} style={{ flex: 1, padding: "10px 6px", background: ob.gender === g ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${ob.gender === g ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, color: ob.gender === g ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{g}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>GOALS <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(select all that apply)</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[{ id: "muscle", label: "Build Muscle" }, { id: "strength", label: "Get Stronger" }, { id: "fat_loss", label: "Lose Fat" }, { id: "fitness", label: "General Fitness" }].map(g => {
                      const sel = ob.goals.includes(g.id);
                      return (
                        <button key={g.id} onClick={() => setOb(o => { const isSel = o.goals.includes(g.id); return { ...o, goals: isSel ? o.goals.filter(x => x !== g.id) : [...o.goals, g.id] }; })} style={{ padding: "10px 14px", background: sel ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: sel ? "#FF6B6B" : "rgba(255,255,255,0.55)", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                          {g.label}{sel && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>FITNESS LEVEL</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["beginner", "intermediate", "advanced"].map(l => (
                      <button key={l} onClick={() => setOb(o => ({ ...o, fitnessLevel: l }))} style={{ flex: 1, padding: "10px 4px", background: ob.fitnessLevel === l ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${ob.fitnessLevel === l ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: ob.fitnessLevel === l ? "#FF6B6B" : "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer", textTransform: "capitalize" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>DAYS PER WEEK</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setOb(o => ({ ...o, daysPerWeek: n }))} style={{ flex: 1, padding: "12px 0", background: ob.daysPerWeek === n ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${ob.daysPerWeek === n ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: ob.daysPerWeek === n ? "#FF6B6B" : "rgba(255,255,255,0.45)", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>LOCATION</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ id: "gym", label: "Gym" }, { id: "home", label: "Home" }, { id: "both", label: "Both" }].map(l => (
                      <button key={l.id} onClick={() => setOb(o => ({ ...o, location: l.id }))} style={{ flex: 1, padding: "10px 4px", background: ob.location === l.id ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${ob.location === l.id ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: ob.location === l.id ? "#FF6B6B" : "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>{l.label}</button>
                    ))}
                  </div>
                </div>
                {ob.location !== "gym" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>EQUIPMENT</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {EQUIPMENT_OPTIONS.map(e => {
                        const has = ob.equipment.includes(e.id);
                        return (
                          <button key={e.id} onClick={() => toggleEquip(e.id)} style={{ padding: "10px 14px", background: has ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${has ? "rgba(255,107,107,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: has ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                            {e.label}{has && <span>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>FOCUS AREA</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { id: "none", label: "Balanced" },
                      { id: "shoulders", label: "Shoulders" },
                      { id: "glutes", label: "Glutes" },
                      { id: "back", label: "Back" },
                      { id: "chest", label: "Chest" },
                      { id: "arms", label: "Arms" },
                      { id: "core", label: "Core" },
                      { id: "legs", label: "Legs" },
                      { id: "rehab_knee", label: "Rehab — Knee" },
                      { id: "rehab_shoulder", label: "Rehab — Shoulder" },
                      { id: "rehab_lower_back", label: "Rehab — Lower Back" },
                    ].map(t => {
                      const sel = ob.targetArea === t.id;
                      return (
                        <button key={t.id} onClick={() => setOb(o => ({ ...o, targetArea: t.id }))} style={{ padding: "9px 14px", background: sel ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: sel ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                          {t.label}{sel && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  disabled={savingProfile}
                  onClick={async () => {
                    setSavingProfile(true);
                    try {
                      await fetch("/api/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          dob: ob.dob, gender: ob.gender, heightCm: ob.heightCm, weightKg: ob.weightKg,
                          bodyFatPct: ob.bodyFatPct || null, goals: ob.goals, fitnessLevel: ob.fitnessLevel,
                          location: ob.location || "gym", equipment: ob.equipment.length ? ob.equipment : ["barbell","dumbbell","cable","machine"],
                          daysPerWeek: ob.daysPerWeek, targetArea: ob.targetArea || "none",
                        }),
                      });
                      setEditingProfile(false);
                      setBodyMetricsLoaded(false);
                    } catch {}
                    setSavingProfile(false);
                  }}
                  style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#FF6B6B,#ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: savingProfile ? "not-allowed" : "pointer", fontFamily: "'Space Mono', monospace", opacity: savingProfile ? 0.6 : 1 }}
                >{savingProfile ? "SAVING…" : "SAVE CHANGES"}</button>
                {!regenConfirm ? (
                  <button
                    onClick={() => setRegenConfirm(true)}
                    style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "'Space Mono', monospace", marginTop: 8 }}
                  >REBUILD PLAN FROM SETTINGS</button>
                ) : (
                  <div style={{ marginTop: 8, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 12, padding: "14px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>This will replace your current workout plan with a new one generated from your updated settings.</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={regeneratePlan} disabled={regenerating} style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg,#FF6B6B,#ee5a24)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{regenerating ? "REBUILDING…" : "CONFIRM REBUILD"}</button>
                      <button onClick={() => setRegenConfirm(false)} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trainer upgrade — request flow */}
          {!isTrainer && hasPendingRequest && (
            <div style={{ background: "linear-gradient(180deg, rgba(253,203,110,0.08), rgba(253,203,110,0.02))", border: "1px solid rgba(253,203,110,0.3)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "#fdcb6e", animation: "pulse 2s ease infinite" }}/>
                <div style={{ fontSize: 11, color: "#fdcb6e", letterSpacing: 3, fontWeight: 700 }}>REQUEST PENDING</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Trainer upgrade under review</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 16 }}>Your request has been sent to the IronLog admins for review. You'll be notified once it's approved — usually within 24–48 hours.</div>
              <button
                onClick={cancelRequest}
                disabled={cancellingRequest}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 18px", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500, cursor: cancellingRequest ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: cancellingRequest ? 0.5 : 1 }}
              >{cancellingRequest ? "Cancelling…" : "Cancel request"}</button>
            </div>
          )}

          {!isTrainer && !hasPendingRequest && !confirmUpgrade && (
            <div style={{ background: "linear-gradient(180deg, rgba(78,205,196,0.06), rgba(78,205,196,0.02))", border: "1px solid rgba(78,205,196,0.18)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(78,205,196,0.7)", letterSpacing: 3, marginBottom: 10, fontWeight: 700 }}>BECOME A TRAINER</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 16 }}>Request a trainer upgrade. Once approved by an admin, you'll be able to search for users, send adoption requests, and monitor your clients' progress and stats.</div>
              <button onClick={() => setConfirmUpgrade(true)} style={{ background: "rgba(78,205,196,0.1)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 10, padding: "12px 20px", color: "#4ECDC4", fontSize: 13, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Request Trainer Upgrade →</button>
            </div>
          )}

          {!isTrainer && !hasPendingRequest && confirmUpgrade && (
            <div style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 16, padding: "24px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Request trainer access</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 14 }}>
                As a trainer you'll be able to:<br />
                · Search for users by username<br />
                · Send them an adoption request<br />
                · View their full workout history and stats once accepted
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>BACKGROUND <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>(optional, helps admins approve faster)</span></div>
              <textarea
                value={upgradeNote}
                onChange={e => setUpgradeNote(e.target.value.slice(0, 500))}
                placeholder="Briefly tell us about your training background, certifications, or who you'd like to train…"
                rows={4}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, padding: "12px 14px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", resize: "vertical", marginBottom: 6 }}
              />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "right", marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>{upgradeNote.length}/500</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16, lineHeight: 1.6 }}>An admin will review your request. You can cancel it any time before approval.</div>
              {upgradeError && <div style={{ fontSize: 13, color: "#FF6B6B", marginBottom: 12 }}>{upgradeError}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={doUpgrade} disabled={upgrading} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg, #4ECDC4, #44a08d)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 1, cursor: upgrading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: upgrading ? 0.6 : 1 }}>{upgrading ? "SUBMITTING…" : "SUBMIT REQUEST"}</button>
                <button onClick={() => { setConfirmUpgrade(false); setUpgradeError(""); setUpgradeNote(""); }} style={{ padding: "13px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}

          {isTrainer && (
            <div style={{ background: "rgba(78,205,196,0.04)", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(78,205,196,0.6)", letterSpacing: 3, marginBottom: 8 }}>TRAINER MODE ACTIVE</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>Search for users by username on the home screen and send adoption requests. Clients can accept via their Messages inbox.</div>
            </div>
          )}

          {/* Notifications */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>NOTIFICATIONS</div>
            {notifStatus === "granted" ? (
              <div>
                <div style={{ fontSize: 13, color: "#4ECDC4", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginBottom: 12 }}>✓ ENABLED</div>
                <button
                  onClick={async () => {
                    setTestingNotif("sending");
                    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
                    setTestingNotif(res?.ok ? "sent" : "error");
                    setTimeout(() => setTestingNotif("idle"), 4000);
                  }}
                  disabled={testingNotif === "sending"}
                  style={{ width: "100%", padding: "10px", background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 10, color: testingNotif === "sent" ? "#4ECDC4" : testingNotif === "error" ? "rgba(255,107,107,0.8)" : "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
                >
                  {testingNotif === "sending" ? "SENDING…" : testingNotif === "sent" ? "✓ CHECK YOUR NOTIFICATIONS" : testingNotif === "error" ? "FAILED — CHECK ENV VARS" : "SEND TEST NOTIFICATION"}
                </button>
              </div>
            ) : notifStatus === "denied" ? (
              <>
                <div style={{ fontSize: 13, color: "rgba(255,107,107,0.8)", marginBottom: 8 }}>Blocked — enable notifications in your browser/device settings, then tap below.</div>
                <button onClick={() => { setNotifStatus("requesting"); subscribeToPush().then(s => setNotifStatus(s)); }} style={{ width: "100%", padding: "12px", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 10, color: "#4ECDC4", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>RETRY</button>
              </>
            ) : notifStatus === "unsupported" ? (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Not supported on this browser. On iOS, add IRONLOG to your home screen first.</div>
            ) : notifStatus === "error" ? (
              <div style={{ fontSize: 13, color: "rgba(255,107,107,0.7)", marginBottom: 8 }}>
                Something went wrong registering. Check that VAPID env vars are set on Vercel.
              </div>
            ) : (
              <button onClick={() => { setNotifStatus("requesting"); subscribeToPush().then(s => setNotifStatus(s)); }} style={{ width: "100%", padding: "12px", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 10, color: "#4ECDC4", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                {notifStatus === "requesting" ? "ENABLING…" : "ENABLE PUSH NOTIFICATIONS"}
              </button>
            )}
          </div>

          {/* Log out */}
          <button onClick={doLogout} style={{ width: "100%", marginTop: 8, padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, color: "rgba(255,255,255,0.35)", fontSize: 12, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>LOG OUT</button>
        </div>
      </div>
    );
  }

  // ─── PROGRESS DASHBOARD ─────────────────────────────────────────────
  if (view === "progress") {
    // Lazy-load body metrics on first visit to body tab
    if (progressTab === "body" && !bodyMetricsLoaded) {
      fetch("/api/metrics").then(r => r.json()).then(d => {
        if (d.metrics) setBodyMetrics(d.metrics);
        setBodyMetricsLoaded(true);
      }).catch(() => setBodyMetricsLoaded(true));
    }

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
          {(["dashboard", "exercises", "history", "body"] as const).map(tab => (
            <button key={tab} onClick={() => setProgressTab(tab)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: progressTab === tab ? "2px solid #FF6B6B" : "2px solid transparent",
              color: progressTab === tab ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 10, fontWeight: 600, letterSpacing: 1, cursor: "pointer",
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
            {(() => {
              // Pre-compute date numbers for each cell
              const dateNums: number[] = [];
              for (let i = 27; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dateNums.push(d.getDate());
              }
              return (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>LAST 4 WEEKS</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>
                      {overall.calendarDays.filter(d => d.active).length} days trained
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                    {dayLabels.map((l, i) => (
                      <div key={i} style={{ textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {Array.from({ length: overall.calendarPadding }, (_, i) => (
                      <div key={`pad-${i}`} style={{ aspectRatio: "1" }} />
                    ))}
                    {overall.calendarDays.map((day, i) => (
                      <div key={i} style={{
                        aspectRatio: "1", borderRadius: 6, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        background: day.active ? "linear-gradient(135deg, #FF6B6B, #ee5a24)" : "rgba(255,255,255,0.03)",
                        border: day.isToday ? "1px solid rgba(255,255,255,0.4)" : "1px solid transparent",
                        opacity: day.active || day.isToday ? 1 : 0.35,
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: day.isToday ? 700 : 500,
                          fontFamily: "'Space Mono', monospace",
                          color: day.active ? "#fff" : day.isToday ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                        }}>{dateNums[i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Personal Records */}
            {prList.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 14 }}>PERSONAL BESTS</div>
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
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0c040", fontFamily: "'Space Mono', monospace" }}>
                        {pr.weight}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>kg</span>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginTop: 1 }}>× {pr.reps} reps</div>
                    </div>
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
                  const { dataPoints: stats, pb } = getExerciseStats(history, d.id, ex.id);
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

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>AVG WEIGHT</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{latest.avgWeight.toFixed(1)}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>kg</span></div>
                          {prev && <div style={{ marginTop: 4 }}><Trend current={latest.avgWeight} previous={prev.avgWeight} /></div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>AVG REPS</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{latest.avgReps.toFixed(1)}</div>
                          {prev && <div style={{ marginTop: 4 }}><Trend current={latest.avgReps} previous={prev.avgReps} unit="" /></div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>PB</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0c040", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
                            {pb.weight}<span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>kg</span>
                          </div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginTop: 4 }}>× {pb.reps} · {pb.date}</div>
                        </div>
                      </div>

                      <MiniChart data={stats.map(s => s.avgWeight)} color={d.color} label="WEIGHT TREND" />
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
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{s.date}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4 }}>{s.duration}</div>
                      </div>
                      {s.id && <button onClick={() => deleteSession(s.id)} style={{
                        background: "none", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 6,
                        color: "rgba(255,107,107,0.5)", fontSize: 9, padding: "3px 8px", cursor: "pointer",
                        fontFamily: "'Space Mono', monospace", letterSpacing: 1,
                      }}>DELETE</button>}
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
        {/* ─── BODY TAB ──────────────────────────────────────────────── */}
        {progressTab === "body" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>

            {/* Goals section */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>GOALS</div>
                {!editingGoals && <button onClick={() => { setGoalWeightPrev(goalWeight); setGoalBfPrev(goalBf); setEditingGoals(true); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>EDIT</button>}
              </div>
              {editingGoals ? (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>TARGET WEIGHT (kg)</div>
                      <input type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="e.g. 75"
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>TARGET BODY FAT (%)</div>
                      <input type="number" value={goalBf} onChange={e => setGoalBf(e.target.value)} placeholder="e.g. 15"
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveGoals} disabled={savingGoals} style={{ flex: 1, padding: "10px", background: "#4ECDC4", border: "none", borderRadius: 10, color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{savingGoals ? "SAVING…" : "SAVE GOALS"}</button>
                    <button onClick={() => { setGoalWeight(goalWeightPrev); setGoalBf(goalBfPrev); setEditingGoals(false); }} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  {[{ label: "WEIGHT", value: goalWeight ? `${goalWeight}kg` : "—", color: "#4ECDC4" }, { label: "BODY FAT", value: goalBf ? `${goalBf}%` : "—", color: "#A29BFE" }].map((g, i) => (
                    <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{g.value}</div>
                      <div style={{ fontSize: 8, color: g.color, letterSpacing: 2, marginTop: 4, fontFamily: "'Space Mono', monospace" }}>{g.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ob.heightCm && (() => {
              const latestW = (bodyMetrics.find((m: any) => m.weightKg != null) as any)?.weightKg ?? (ob.weightKg ? parseFloat(ob.weightKg) : null);
              if (!latestW) return null;
              const h = parseFloat(ob.heightCm) / 100;
              const bmi = latestW / (h * h);
              const cat = bmi < 18.5 ? { label: "Underweight", color: "#A29BFE" }
                : bmi < 25   ? { label: "Normal range", color: "#4ECDC4" }
                : bmi < 30   ? { label: "Overweight", color: "#FFD166" }
                : { label: "Obese", color: "#FF6B6B" };
              return (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 4 }}>BMI</div>
                    <div style={{ fontSize: 11, color: cat.color, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{cat.label}</div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{bmi.toFixed(1)}</div>
                </div>
              );
            })()}

            {/* Log today */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 12 }}>LOG TODAY</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 6 }}>WEIGHT (kg)</div>
                  <input type="number" value={metricWeight} onChange={e => setMetricWeight(e.target.value)} placeholder="e.g. 80.5"
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 6 }}>BODY FAT (%)</div>
                  <input type="number" value={metricBf} onChange={e => setMetricBf(e.target.value)} placeholder="e.g. 18.5"
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "11px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                </div>
              </div>
              <button onClick={logBodyMetric} disabled={loggingMetric || (!metricWeight && !metricBf)} style={{ width: "100%", padding: "12px", background: metricWeight || metricBf ? "#4ECDC4" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 10, color: metricWeight || metricBf ? "#000" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: metricWeight || metricBf ? "pointer" : "default", fontFamily: "'Space Mono', monospace", transition: "all 0.15s" }}>
                {loggingMetric ? "LOGGING…" : "LOG NOW"}
              </button>
            </div>

            {/* Trend + progress (if data exists) */}
            {bodyMetrics.length > 0 && (() => {
              const latest = bodyMetrics[0];
              const weightItems = bodyMetrics.filter(m => m.weightKg != null).map(m => ({ value: m.weightKg as number, date: m.date as string })).reverse();
              const bfItems = bodyMetrics.filter(m => m.bodyFatPct != null).map(m => ({ value: m.bodyFatPct as number, date: m.date as string })).reverse();
              const weightData = weightItems.map(i => i.value);
              const bfData = bfItems.map(i => i.value);
              const targetW = goalWeight ? parseFloat(goalWeight) : null;
              const targetBf = goalBf ? parseFloat(goalBf) : null;

              return (
                <>
                  {/* Progress vs goals */}
                  {(targetW || targetBf) && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 14 }}>PROGRESS TO GOAL</div>
                      {targetW && latest.weightKg != null && (() => {
                        const diff = latest.weightKg - targetW;
                        const pct = Math.min(100, Math.max(0, diff > 0
                          ? Math.max(0, 100 - (diff / Math.abs(latest.weightKg - targetW + 0.001)) * 100)
                          : 100));
                        return (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Weight</div>
                              <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: Math.abs(diff) < 0.5 ? "#4ECDC4" : "rgba(255,255,255,0.5)" }}>
                                {latest.weightKg}kg → {targetW}kg <span style={{ color: diff > 0 ? "#FF6B6B" : "#4ECDC4" }}>({diff > 0 ? "+" : ""}{diff.toFixed(1)}kg)</span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                              <div style={{ height: "100%", background: "linear-gradient(90deg,#4ECDC4,#44a08d)", borderRadius: 3, width: `${100 - Math.min(100, Math.abs(diff / ((weightData[0] ?? targetW) - targetW + 0.001)) * 100)}%`, transition: "width 0.5s", minWidth: diff === 0 ? "100%" : "4px" }} />
                            </div>
                          </div>
                        );
                      })()}
                      {targetBf && latest.bodyFatPct != null && (() => {
                        const diff = latest.bodyFatPct - targetBf;
                        return (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Body fat</div>
                              <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: Math.abs(diff) < 0.5 ? "#4ECDC4" : "rgba(255,255,255,0.5)" }}>
                                {latest.bodyFatPct}% → {targetBf}% <span style={{ color: diff > 0 ? "#FF6B6B" : "#4ECDC4" }}>({diff > 0 ? "+" : ""}{diff.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                              <div style={{ height: "100%", background: "linear-gradient(90deg,#A29BFE,#9b59b6)", borderRadius: 3, width: `${100 - Math.min(100, Math.abs(diff / ((bfData[0] ?? targetBf) - targetBf + 0.001)) * 100)}%`, transition: "width 0.5s", minWidth: diff === 0 ? "100%" : "4px" }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Trend charts */}
                  {weightItems.length >= 2 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>WEIGHT TREND</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#4ECDC4", fontFamily: "'Space Mono', monospace" }}>{weightItems[weightItems.length - 1].value.toFixed(1)}kg</div>
                      </div>
                      <BodyTrendChart items={weightItems} color="#4ECDC4" unit="kg" />
                    </div>
                  )}
                  {bfItems.length >= 2 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>BODY FAT TREND</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#A29BFE", fontFamily: "'Space Mono', monospace" }}>{bfItems[bfItems.length - 1].value.toFixed(1)}%</div>
                      </div>
                      <BodyTrendChart items={bfItems} color="#A29BFE" unit="%" />
                    </div>
                  )}
                </>
              );
            })()}

            {/* History */}
            {bodyMetrics.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 12 }}>HISTORY</div>
                {bodyMetrics.slice(0, 30).map(m => (
                  <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {editingMetricId === m.id ? (
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>DATE</div>
                            <input type="date" value={editMetricDate} onChange={e => setEditMetricDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>WEIGHT (kg)</div>
                            <input type="number" value={editMetricWeight} onChange={e => setEditMetricWeight(e.target.value)} placeholder="—" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>BODY FAT (%)</div>
                            <input type="number" value={editMetricBf} onChange={e => setEditMetricBf(e.target.value)} placeholder="—" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveBodyMetricEdit} disabled={savingMetric} style={{ flex: 1, padding: "8px", background: "#4ECDC4", border: "none", borderRadius: 8, color: "#000", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{savingMetric ? "SAVING…" : "SAVE"}</button>
                          <button onClick={() => setEditingMetricId(null)} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                          <div style={{ fontSize: 13, color: "#fff", marginTop: 2, fontWeight: 500 }}>
                            {m.weightKg != null ? `${m.weightKg}kg` : ""}
                            {m.weightKg != null && m.bodyFatPct != null ? " · " : ""}
                            {m.bodyFatPct != null ? `${m.bodyFatPct}% bf` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button onClick={() => { setEditingMetricId(m.id); setEditMetricWeight(m.weightKg != null ? String(m.weightKg) : ""); setEditMetricBf(m.bodyFatPct != null ? String(m.bodyFatPct) : ""); setEditMetricDate(new Date(m.date).toISOString().slice(0, 10)); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>✎</button>
                          <button onClick={() => deleteBodyMetric(m.id)} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.4)", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}>×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!bodyMetricsLoaded && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "24px 0" }}>Loading…</div>
            )}
            {bodyMetricsLoaded && bodyMetrics.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "24px 0" }}>Log your first measurement above to start tracking</div>
            )}
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
        {resumeOverlay && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 32 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 32 }}>SESSION RESTORED</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>{resumeOverlay.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginBottom: 48 }}>Started {resumeOverlay.ageStr}</div>
            <button onClick={() => setResumeOverlay(null)} style={{ padding: "16px 48px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 14, color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 3, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>GOT IT</button>
          </div>
        )}

        {showFinishPrompt && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 32 }}>
            <div style={{ fontSize: 12, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 32, fontFamily: "'Space Mono', monospace" }}>SAVE WORKOUT</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10, letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>DURATION</div>
            <input value={adjustedDuration} onChange={e => setAdjustedDuration(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#fff", fontSize: 30, fontFamily: "'Space Mono', monospace", padding: "14px 20px", textAlign: "center", outline: "none", letterSpacing: 4, width: "100%", maxWidth: 280 }} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>Edit if session was paused or left open</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 28, fontFamily: "'Space Mono', monospace" }}>{Object.keys(log).length} sets logged</div>
            <button onClick={doSaveWorkout}
              style={{ marginTop: 32, width: "100%", maxWidth: 280, padding: "16px", background: "linear-gradient(135deg, #2ecc71, #27ae60)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 3, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              SAVE
            </button>
            <button onClick={() => setShowFinishPrompt(false)}
              style={{ marginTop: 12, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "12px" }}>
              Cancel
            </button>
          </div>
        )}

        {editEx && (() => {
          const exName = activeDay!.sections.flatMap(s => s.exercises).find(e => e.id === editEx)?.name || editEx;
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", zIndex: 300, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 3, fontFamily: "'Space Mono', monospace" }}>EDIT SETS</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginTop: 4 }}>{exName}</div>
                </div>
                <button onClick={() => setEditEx(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", padding: 8 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {Object.entries(editSets).sort(([a], [b]) => parseInt(a.split("-").pop()!) - parseInt(b.split("-").pop()!)).map(([k, v]) => {
                  const sn = k.split("-").pop();
                  return (
                    <div key={k} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px", marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 12, fontFamily: "'Space Mono', monospace" }}>SET {sn}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>WEIGHT (kg)</div>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <button onClick={() => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], weight: +Math.max(0, prev[k].weight - 1.25).toFixed(2) } }))}
                              style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <input type="number" inputMode="decimal" value={v.weight || ""} onChange={e => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], weight: parseFloat(e.target.value) || 0 } }))}
                              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                            <button onClick={() => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], weight: +(prev[k].weight + 1.25).toFixed(2) } }))}
                              style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>REPS</div>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <button onClick={() => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], reps: Math.max(0, prev[k].reps - 1) } }))}
                              style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <input type="number" inputMode="numeric" value={v.reps || ""} onChange={e => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], reps: parseInt(e.target.value) || 0 } }))}
                              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                            <button onClick={() => setEditSets(prev => ({ ...prev, [k]: { ...prev[k], reps: prev[k].reps + 1 } }))}
                              style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={saveEditSets}
                style={{ width: "100%", padding: "16px", background: activeDay!.gradient, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16 }}>
                SAVE CHANGES
              </button>
            </div>
          );
        })()}

        {formPreview && (() => {
          const urls = getExerciseImageUrls(formPreview.id, formPreview.name);
          const primary = formPreview.muscles;
          const secondary = formPreview.secondaryMuscles ?? [];
          const allMuscles = [...primary, ...secondary].filter((m, i, a) => a.indexOf(m) === i);
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setFormPreview(null)}>
              <div style={{ width: "100%", maxWidth: 420 }}
                onClick={e => e.stopPropagation()}
                onTouchStart={e => { swipeTouchX.current = e.touches[0].clientX; }}
                onTouchEnd={e => { const dx = e.changedTouches[0].clientX - swipeTouchX.current; if (Math.abs(dx) > 50) setModalSlide(dx < 0 ? 1 : 0); }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{formPreview.name}</div>
                    {allMuscles.length > 0 && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
                        {primary.map((m, i) => <span key={m} style={{ color: "#FF6644" }}>{i > 0 ? " · " : ""}{m.toUpperCase()}</span>)}
                        {secondary.map((m, i) => <span key={m} style={{ color: "rgba(255,255,255,0.35)" }}>{(i > 0 || primary.length > 0) ? " · " : ""}{m.toUpperCase()}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setFormPreview(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 0 0 12px" }}>×</button>
                </div>

                {/* Slide content */}
                {modalSlide === 0 ? (
                  urls && !formImgError ? (
                    <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", background: "#111" }}>
                      <img key={urls[formFrame]} src={urls[formFrame]} alt={formPreview.name}
                        style={{ width: "100%", display: "block", minHeight: 220, objectFit: "cover" }}
                        onError={() => setFormImgError(true)}
                      />
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{formFrame === 0 ? "START" : "END"}</div>
                      <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: formFrame === 0 ? "#fff" : "rgba(255,255,255,0.25)", transition: "background 0.3s" }}/>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: formFrame === 1 ? "#fff" : "rgba(255,255,255,0.25)", transition: "background 0.3s" }}/>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 36, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 32, opacity: 0.3 }}>🏋️</div>
                      <div>No form demo available</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Search YouTube for &ldquo;{formPreview.name} form&rdquo;</div>
                    </div>
                  )
                ) : (
                  <div style={{ background: "#0b0b0b", borderRadius: 14, overflow: "hidden", padding: "10px 8px 4px" }}>
                    <MuscleDiagram primary={primary} secondary={secondary} exerciseId={formPreview.id} exerciseName={formPreview.name}/>
                    {allMuscles.length === 0 && !lookupMuscleDetail(formPreview.id, formPreview.name) && (
                      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12, paddingBottom: 12 }}>No muscle data for this exercise</div>
                    )}
                    {allMuscles.length > 0 && (
                      <>
                        <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "6px 0 4px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF4422" }}/><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>PRIMARY</span></div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#FF9900" }}/><span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>SECONDARY</span></div>
                        </div>
                        {(() => {
                          const det = lookupMuscleDetail(formPreview.id, formPreview.name);
                          if (!det) return null;
                          const pNames = det.p.filter((k, i, a) => a.indexOf(k) === i).map((k: string) => SUB_MUSCLE_LABELS[k] ?? k);
                          const sNames = det.s.filter((k, i, a) => a.indexOf(k) === i).map((k: string) => SUB_MUSCLE_LABELS[k] ?? k);
                          return (
                            <div style={{ textAlign: "center", padding: "2px 8px 8px" }}>
                              <div style={{ fontSize: 9, color: "rgba(78,205,196,0.5)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 5 }}>⊕ SUB-MUSCLE DETAIL</div>
                              <div style={{ fontSize: 11, color: "#FF6644", lineHeight: 1.6 }}>{pNames.join("  ·  ")}</div>
                              {sNames.length > 0 && <div style={{ fontSize: 10, color: "rgba(255,200,100,0.6)", marginTop: 2, lineHeight: 1.6 }}>{sNames.join("  ·  ")}</div>}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Slide indicators + navigation */}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
                  <button onClick={() => setModalSlide(0)} style={{ width: modalSlide === 0 ? 20 : 8, height: 8, borderRadius: 4, border: "none", background: modalSlide === 0 ? "#fff" : "rgba(255,255,255,0.25)", cursor: "pointer", padding: 0, transition: "all 0.25s" }}/>
                  <button onClick={() => setModalSlide(1)} style={{ width: modalSlide === 1 ? 20 : 8, height: 8, borderRadius: 4, border: "none", background: modalSlide === 1 ? "#FF6644" : "rgba(255,255,255,0.25)", cursor: "pointer", padding: 0, transition: "all 0.25s" }}/>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "center", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                  {modalSlide === 0 ? "SWIPE LEFT · MUSCLES MAP" : "SWIPE RIGHT · FORM DEMO"} · TAP OUTSIDE TO CLOSE
                </div>
              </div>
            </div>
          );
        })()}

        {rest.running && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(20px)" }}>
            <div style={{ fontSize: 12, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>REST</div>
            <div style={{ fontSize: 96, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", animation: "countPulse 1s ease infinite" }}>{rest.seconds}</div>
            <button onClick={rest.stop} style={{ marginTop: 40, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 36px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", letterSpacing: 2, cursor: "pointer" }}>SKIP</button>
          </div>
        )}
        <div style={{ padding: "16px 20px 14px", background: `linear-gradient(180deg, ${activeDay.color}10, transparent)`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Home</button>
            <button onClick={abandonWorkout} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>QUIT ×</button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 10 }}>{activeDay.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 300 }}>{activeDay.focus}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>{timer.fmt}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 3, fontFamily: "'Space Mono', monospace" }}>SESSION</div>
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "10px 20px 2px", fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>Tap an exercise to log a set</div>
        {activeDay.sections.map((sec, si) => (
          <div key={si}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "rgba(255,255,255,0.3)", padding: "22px 20px 10px", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>{sec.name.toUpperCase()}</div>
            {sec.exercises.map(ex => {
              const trackable = ex.trackable !== false;
              const done = doneCount(ex.id, ex.sets);
              const allDone = done >= ex.sets;
              const ns = nextSetNum(ex.id, ex.sets);
              const isExp = expanded === ex.id;
              const { weight: lw, reps: lr } = lastSessionBest(ex.id);
              const wuDone = !trackable && warmupDone[ex.id];

              return (
                <div key={ex.id} className="fade-in">
                  <div onClick={() => {
                    if (!trackable) { setWarmupDone(prev => ({ ...prev, [ex.id]: !prev[ex.id] })); return; }
                    if (allDone) return;
                    setExpanded(isExp ? null : ex.id);
                    setWInput(lw ? String(lw) : "");
                    setRInput(lr ? String(lr) : "");
                  }}
                    style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: (allDone || wuDone) ? 0.3 : 1, cursor: "pointer", transition: "opacity 0.3s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                        {(() => { const tu = getExerciseImageUrls(ex.id, ex.name); return tu ? (
                          <img src={tu[0]} alt="" onClick={e => { e.stopPropagation(); const m = lookupExMuscles(ex.name); setFormPreview({ id: ex.id, name: ex.name, ...m }); }}
                            style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#1a1a1a", cursor: "pointer" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : null; })()}
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</span>
                        {ex.type && <span style={{ fontSize: 9, fontWeight: 600, color: bc[ex.type] || "#888", opacity: 0.7, letterSpacing: 1, flexShrink: 0 }}>{ex.type.toUpperCase()}</span>}
                        <button
                          onClick={e => { e.stopPropagation(); const m = lookupExMuscles(ex.name); setFormPreview({ id: ex.id, name: ex.name, ...m }); }}
                          style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "2px 6px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginLeft: 6, flexShrink: 0 }}
                        >FORM</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {trackable && done > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(ex.id); }}
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>EDIT</button>
                        )}
                        {(allDone || wuDone) && <span style={{ fontSize: 16, color: "#2ecc71" }}>✓</span>}
                        {!trackable && !wuDone && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>TAP TO MARK DONE</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 300 }}>
                      {trackable ? `${ex.sets} × ${ex.reps}` : ex.reps}{ex.rest ? ` · ${ex.rest}s rest` : ""}
                    </div>
                    {ex.note && <div style={{ fontSize: 11, color: "#f0c040", marginTop: 5, fontStyle: "italic", opacity: 0.8 }}>{ex.note}</div>}
                    {trackable && lw > 0 && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6, fontFamily: "'Space Mono', monospace" }}>
                        Last session: {lw}kg × {lr || "?"}
                      </div>
                    )}
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

                  {isExp && trackable && ns && (() => {
                    // Find the highest-numbered set that's actually been logged
                    let lastSetN = 0;
                    for (let i = ex.sets; i >= 1; i--) { if (log[`${ex.id}-${i}`]) { lastSetN = i; break; } }
                    const lastLogged = lastSetN > 0 ? log[`${ex.id}-${lastSetN}`] : null;

                    const wDiff = (cur: number) => {
                      const tags: React.ReactNode[] = [];
                      if (!cur) return null;
                      if (lastLogged) {
                        const d = +(cur - lastLogged.weight).toFixed(2);
                        tags.push(d === 0
                          ? <span key="prev" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= S{lastSetN}</span>
                          : <span key="prev" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}kg vs S{lastSetN}</span>
                        );
                      }
                      if (lw > 0) {
                        const d = +(cur - lw).toFixed(2);
                        tags.push(d === 0
                          ? <span key="last" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= last session</span>
                          : <span key="last" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}kg vs last session</span>
                        );
                      }
                      return tags.length > 0 ? <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{tags}</div> : null;
                    };

                    const rDiff = (cur: number) => {
                      const tags: React.ReactNode[] = [];
                      if (!cur) return null;
                      if (lastLogged) {
                        const d = cur - lastLogged.reps;
                        tags.push(d === 0
                          ? <span key="prev" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= S{lastSetN}</span>
                          : <span key="prev" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)} rep{Math.abs(d) !== 1 ? "s" : ""} vs S{lastSetN}</span>
                        );
                      }
                      if (lr > 0) {
                        const d = cur - lr;
                        tags.push(d === 0
                          ? <span key="last" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= last session</span>
                          : <span key="last" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)} rep{Math.abs(d) !== 1 ? "s" : ""} vs last session</span>
                        );
                      }
                      return tags.length > 0 ? <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{tags}</div> : null;
                    };

                    return (
                      <div className="fade-in" style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 12, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>Set {ns} of {ex.sets}</span>
                          {lw > 0 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>Last session: {lw}kg × {lr}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>WEIGHT (kg)</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <button onClick={() => setWInput(String(Math.max(0, (parseFloat(wInput) || 0) - 1.25)))}
                                style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <input type="number" inputMode="decimal" value={wInput} onChange={e => setWInput(e.target.value)} placeholder="0"
                                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                              <button onClick={() => setWInput(String((parseFloat(wInput) || 0) + 1.25))}
                                style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                            {wDiff(parseFloat(wInput))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>REPS DONE</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <button onClick={() => setRInput(String(Math.max(0, (parseInt(rInput) || 0) - 1)))}
                                style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <input type="number" inputMode="numeric" value={rInput} onChange={e => setRInput(e.target.value)} placeholder="0"
                                style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                              <button onClick={() => setRInput(String((parseInt(rInput) || 0) + 1))}
                                style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                            {rDiff(parseInt(rInput))}
                          </div>
                        </div>
                        <button onClick={() => { logSet(ex.id, ns, wInput, rInput); if (ns + 1 > ex.sets) setExpanded(null); if (ex.rest) rest.start(ex.rest); }}
                          style={{ width: "100%", padding: "14px", background: activeDay.gradient, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: (!wInput && !rInput) ? 0.4 : 1 }}>
                          LOG SET {ns}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ padding: 20 }}>
          <button onClick={finish} style={{ width: "100%", padding: "16px", background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 12, color: "#2ecc71", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>FINISH & SAVE</button>
        </div>
      </div>
    );
  }

  return null;
}
