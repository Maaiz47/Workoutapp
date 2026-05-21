"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { createPortal } from "react-dom";
import { WORKOUT_DATA, WorkoutDay } from "../lib/workouts";
import { EXERCISES } from "../lib/exercises";
import { getExerciseImageUrls } from "../lib/exerciseImages";
import { MUSCLE_DETAIL, lookupMuscleDetail } from "../lib/muscleDetail";
import { getFormCues } from "../lib/formCues";

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
    // Only request permission if not already decided — avoids mobile browsers rejecting
    // programmatic calls outside a user gesture when permission is already granted
    let permission = Notification.permission as NotificationPermission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return "denied";
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
  const [total, setTotal] = useState(0);
  const endTimeRef = useRef<number | null>(null);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const notifiedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const onFinishRef = useRef<(() => void) | null>(null);

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
    startedAtRef.current = null;
    beep();
    sendNotification();
    onFinishRef.current?.();
    onFinishRef.current = null;
  }, [beep, sendNotification]);

  const start = useCallback((secs: number, onFinish?: () => void) => {
    requestNotifPermission();
    if (ref.current) clearInterval(ref.current);
    notifiedRef.current = false;
    onFinishRef.current = onFinish || null;
    const endTime = Date.now() + secs * 1000;
    endTimeRef.current = endTime;
    startedAtRef.current = Date.now();
    setSeconds(secs);
    setTotal(secs);
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
    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    setRunning(false);
    setSeconds(0);
    endTimeRef.current = null;
    startedAtRef.current = null;
    onFinishRef.current = null;
    return elapsed;
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

  return { seconds, running, total, start, stop };
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
// For a brand-new exercise (no prior session history) suggest a reasonable
// starting weight × reps based on bodyweight, exercise name pattern, and the
// library's type tag. Returns null when bodyweight isn't known.
// The user is told this is a SUGGESTION and can adjust before logging.
function suggestedStartingSet(exId: string, exName: string, exType: string | undefined, bwKg: number): { weight: number; reps: number } | null {
  if (!bwKg || bwKg <= 0) return null;
  const round = (n: number) => Math.max(0, Math.round(n / 1.25) * 1.25);
  const n = (exName || "").toLowerCase() + " " + (exId || "").toLowerCase();
  // Bodyweight movements — no external load by default.
  if (/(push.?up|pull.?up|chin.?up|^dip\b|\bdips\b|plank|hanging.?leg.?raise|hollow.?hold|burpee|jumping.?jack|mountain.?climber)/.test(n)) {
    return { weight: 0, reps: 8 };
  }
  // Pattern-matched compound lifts (multipliers calibrated to a true-beginner load).
  if (/\bdeadlift\b/.test(n))                                     return { weight: round(bwKg * 0.6),  reps: 5  };
  if (/(barbell\s+)?back\s*squat|^squat/.test(n) && !/split|goblet/.test(n)) return { weight: round(bwKg * 0.5),  reps: 8  };
  if (/front\s*squat/.test(n))                                    return { weight: round(bwKg * 0.4),  reps: 8  };
  if (/hip\s*thrust|glute\s*bridge/.test(n))                      return { weight: round(bwKg * 0.5),  reps: 10 };
  if (/bench\s*press|chest\s*press/.test(n))                      return { weight: round(bwKg * 0.4),  reps: 8  };
  if (/incline\s*(db|dumbbell|barbell)?\s*press/.test(n))         return { weight: round(bwKg * 0.3),  reps: 8  };
  if (/overhead\s*press|military\s*press|\bohp\b|shoulder\s*press/.test(n)) return { weight: round(bwKg * 0.25), reps: 8  };
  if (/bent[-\s]*over\s*row|barbell\s*row|t.?bar\s*row/.test(n))  return { weight: round(bwKg * 0.4),  reps: 8  };
  if (/(seated|cable)\s*row/.test(n))                             return { weight: round(bwKg * 0.35), reps: 10 };
  if (/lat\s*pulldown|pulldown/.test(n))                          return { weight: round(bwKg * 0.5),  reps: 10 };
  if (/split\s*squat|lunge|bulgarian/.test(n))                    return { weight: round(bwKg * 0.15), reps: 10 };
  if (/goblet\s*squat/.test(n))                                   return { weight: round(bwKg * 0.2),  reps: 10 };
  if (/romanian\s*deadlift|\brdl\b/.test(n))                      return { weight: round(bwKg * 0.4),  reps: 8  };
  // Isolations
  if (/lateral\s*raise|side\s*raise|rear\s*delt/.test(n))         return { weight: round(bwKg * 0.04), reps: 12 };
  if (/face\s*pull/.test(n))                                      return { weight: round(bwKg * 0.15), reps: 15 };
  if (/(bicep|preacher|hammer|incline)\s*curl|ez.?bar\s*curl/.test(n)) return { weight: round(bwKg * 0.1),  reps: 10 };
  if (/leg\s*curl/.test(n))                                       return { weight: round(bwKg * 0.25), reps: 10 };
  if (/leg\s*extension/.test(n))                                  return { weight: round(bwKg * 0.3),  reps: 10 };
  if (/tricep|skull|pushdown|press.?down/.test(n))                return { weight: round(bwKg * 0.12), reps: 12 };
  if (/\bfly\b|flye/.test(n))                                     return { weight: round(bwKg * 0.1),  reps: 12 };
  if (/calf\s*raise|standing.?calf|seated.?calf/.test(n))         return { weight: round(bwKg * 0.5),  reps: 15 };
  if (/cable\s*crossover/.test(n))                                return { weight: round(bwKg * 0.08), reps: 12 };
  if (/shrug/.test(n))                                            return { weight: round(bwKg * 0.5),  reps: 12 };
  if (/abductor|adductor/.test(n))                                return { weight: round(bwKg * 0.4),  reps: 12 };
  // Fallback by library type tag.
  if (exType === "compound")  return { weight: round(bwKg * 0.3), reps: 8  };
  if (exType === "cardio")    return { weight: 0,                 reps: 10 };
  return { weight: round(bwKg * 0.1), reps: 12 };
}

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

// Drop set mode: the user runs each set as a chain of drops (initial weight
// to failure → drop weight → to failure → …) without rest between drops.
// New code uses the dropSet boolean. Legacy data with dropSets > 0 is
// treated as drop-set mode too so old routines keep working.
function isDropSetMode(ex: any): boolean {
  return ex?.dropSet === true || (ex?.dropSets ?? 0) > 0;
}

// Recommended superset pairings — antagonist or compound + isolation pairs
// that work well in alternation. Surfaced as suggestions when the user
// opens the in-session superset picker. Names are matched case-insensitively
// against the exercise library; if a name doesn't exist in the lib it's
// silently skipped.
const RECOMMENDED_PAIRINGS: Array<[string, string]> = [
  ["bench press", "barbell row"],
  ["incline dumbbell press", "lat pulldown"],
  ["overhead press", "pull up"],
  ["dumbbell shoulder press", "chin up"],
  ["bicep curl", "tricep pushdown"],
  ["barbell curl", "skull crusher"],
  ["hammer curl", "tricep extension"],
  ["squat", "romanian deadlift"],
  ["leg press", "leg curl"],
  ["leg extension", "leg curl"],
  ["chest fly", "cable row"],
  ["lateral raise", "face pull"],
  ["calf raise", "tibialis raise"],
  ["dumbbell row", "dumbbell bench press"],
  ["dip", "pull up"],
];

// Given an exercise name, return the recommended partner names (lowercased).
function recommendedPartnersFor(name: string): string[] {
  const n = (name || "").toLowerCase().trim();
  const out = new Set<string>();
  for (const [a, b] of RECOMMENDED_PAIRINGS) {
    if (n.includes(a)) out.add(b);
    if (n.includes(b)) out.add(a);
  }
  return Array.from(out);
}

// ── Set-key parsing (drop-set aware) ────────────────────────────────────────
// Keys: "eid-sn" for regular sets, "eid-sn-dN" for drop sets.
function parseSetKey(key: string): { eid: string; setNum: string; dropNum: number | null } {
  const parts = key.split("-");
  const last = parts[parts.length - 1];
  const dropMatch = last.match(/^d(\d+)$/);
  if (dropMatch && parts.length >= 3) {
    parts.pop();
    const setNum = parts.pop()!;
    return { eid: parts.join("-"), setNum, dropNum: parseInt(dropMatch[1], 10) };
  }
  const setNum = parts.pop()!;
  return { eid: parts.join("-"), setNum, dropNum: null };
}

// ── Tier systems ─────────────────────────────────────────────────────────────

const CLIENT_TIERS = [
  { label: "Kitten",  emoji: "🐱", min: 0,   color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
  { label: "Monkey",  emoji: "🐒", min: 5,   color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)"  },
  { label: "Fox",     emoji: "🦊", min: 15,  color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.3)"   },
  { label: "Tiger",   emoji: "🐯", min: 30,  color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.3)"   },
  { label: "Lion",    emoji: "🦁", min: 60,  color: "#f97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.35)"  },
  { label: "Gorilla", emoji: "🦍", min: 100, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)"  },
];

function getClientTier(totalSessions: number, streak: number, prCount: number) {
  let idx = 0;
  for (let i = CLIENT_TIERS.length - 1; i >= 0; i--) {
    if (totalSessions >= CLIENT_TIERS[i].min) { idx = i; break; }
  }
  // Bonus: strong streak + PRs can push up one tier
  if (streak >= 4 && prCount >= 8 && idx < CLIENT_TIERS.length - 1) idx++;
  return CLIENT_TIERS[idx];
}

const TRAINER_TIERS = [
  { label: "Rookie", emoji: "🏅", min: 0,  color: "#A29BFE", bg: "rgba(162,155,254,0.10)", border: "rgba(162,155,254,0.3)" },
  { label: "Coach",  emoji: "🎯", min: 3,  color: "#4ECDC4", bg: "rgba(78,205,196,0.10)",  border: "rgba(78,205,196,0.3)" },
  { label: "Pro",    emoji: "⚡", min: 10, color: "#FFD166", bg: "rgba(255,209,102,0.10)", border: "rgba(255,209,102,0.35)" },
  { label: "Elite",  emoji: "👑", min: 20, color: "#FF6B6B", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.4)" },
];

function getTrainerTier(clientCount: number) {
  let tier = TRAINER_TIERS[0];
  for (const t of TRAINER_TIERS) if (clientCount >= t.min) tier = t;
  return tier;
}

function getOverallStats(history: Record<string, any[]>) {
  let totalSessions = 0;
  const exercisePRs: Record<string, { weight: number; reps: number; date: string }> = {};
  const allSessions: { date: string; duration: string; intensityPoints?: number }[] = [];

  for (const dayId in history) {
    for (const s of history[dayId]) {
      totalSessions++;
      allSessions.push({ date: s.date, duration: s.duration, intensityPoints: s.intensityPoints ?? 0 });
      const sets = s.sets as Record<string, { weight: number; reps: number }>;
      for (const k in sets) {
        const eid = parseSetKey(k).eid;
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
  const calendarDays: { active: boolean; isToday: boolean; date: string; hasIntensity: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const daySessions = allSessions.filter(s => s.date === dateStr);
    calendarDays.push({
      active: daySessions.length > 0,
      isToday: i === 0,
      date: dateStr,
      hasIntensity: daySessions.some(s => (s.intensityPoints ?? 0) > 0),
    });
  }
  // 28 days ago - what day of week was it?
  const firstDate = new Date(now);
  firstDate.setDate(firstDate.getDate() - 27);
  const calendarPadding = firstDate.getDay(); // 0=Sun, pad that many empty cells before

  return { totalSessions, exercisePRs, thisWeek, streak, avgMinutes, calendarDays, calendarPadding };
}

// Mini bar chart component
function BodyTrendChart({ items, color, unit, goal }: { items: { value: number; date: string }[]; color: string; unit: string; goal?: number }) {
  if (items.length < 2) return null;
  const W = 320, H = 90, PL = 36, PR = 8, PT = 10, PB = 22;
  const times = items.map(i => new Date(i.date).getTime());
  const minT = Math.min(...times), maxT = Math.max(...times);
  const tRange = maxT - minT || 1;
  const vals = items.map(i => i.value);
  const allForRange = goal != null ? [...vals, goal] : vals;
  const minV = Math.min(...allForRange), maxV = Math.max(...allForRange);
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
      {goal != null && (() => {
        // extend minV/maxV range to include goal so it's always visible
        const allVals = [...vals, goal];
        const extMinV = Math.min(...allVals);
        const extMaxV = Math.max(...allVals);
        const extRange = extMaxV - extMinV || 1;
        const goalY = PT + ((extMaxV - goal) / extRange) * (H - PT - PB);
        if (goalY < PT - 5 || goalY > H - PB + 5) return null;
        return (
          <>
            <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
            <text x={PL - 4} y={goalY + 3} fill={color} fontSize="7.5" textAnchor="end" fontFamily="monospace" opacity="0.65">{goal}</text>
          </>
        );
      })()}
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

// ─── WORKOUT TYPE ICON ───────────────────────────────────────────────────────
// Block-figure dual view. Muscle groups rendered as rounded rects with CSS
// drop-shadow explosion animation. Front at cx=50, back at cx=150.
// ViewBox 0 0 200 168. Animation driven by globals.css .ma / .md classes.
function WorkoutTypeIcon({ title, color, size = 62 }: { title: string; color: string; size?: number }) {
  const t = title.toLowerCase();
  let fA: string[] = [], bA: string[] = [];

  if (t.startsWith("push"))                                                     { fA = ["ch","sh"];                    bA = ["tr","sh"]; }
  else if (t.startsWith("pull"))                                                { fA = ["bi"];                         bA = ["bk","sh"]; }
  else if (t.startsWith("leg") || t.startsWith("lower"))                       { fA = ["qd","cv"];                    bA = ["gl","hm","cv"]; }
  else if (t.startsWith("upper"))                                               { fA = ["ch","sh","bi"];               bA = ["bk","sh","tr"]; }
  else if (t.startsWith("full"))                                                { fA = ["ch","sh","bi","co","qd","cv"]; bA = ["bk","sh","tr","gl","hm","cv"]; }
  else if (t.includes("chest"))                                                 { fA = ["ch"]; }
  else if (t.includes("shoulder"))                                              { fA = ["sh"];  bA = ["sh"]; }
  else if (t.includes("arm"))                                                   { fA = ["bi"];  bA = ["tr"]; }
  else if (t.includes("back") && !t.includes("activ") && !t.includes("recov")) {               bA = ["bk"]; }
  else if (t.includes("cardio") || t.includes("hiit") || t.includes("conditio")) { fA = ["co","qd","cv"]; bA = ["hm","gl","cv"]; }

  const ff = (m: string) => fA.includes(m);
  const fb = (m: string) => bA.includes(m);
  const w  = Math.round(size * 200 / 168);
  const sk = "#111118";
  const so = "rgba(255,255,255,0.13)";
  // per-muscle stagger (seconds) for full-body cascade feel
  const D: Record<string,number> = { ch:0, sh:0.18, bi:0.36, co:0.54, qd:0.09, cv:0.62, bk:0.04, tr:0.38, gl:0.22, hm:0.13 };
  const cls = (on: boolean) => on ? "ma" : "md";
  const st  = (key: string, on: boolean): React.CSSProperties => on ? { animationDelay: `${D[key]}s` } : {};

  // Rect shorthand: x,y,w,h,rx
  const B = (x: number, y: number, w: number, h: number, rx: number, fill: string, stroke?: string) => (
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.6 : 0}/>
  );
  const M = (x: number, y: number, w: number, h: number, rx: number, key: string, on: boolean) => (
    <rect x={x} y={y} width={w} height={h} rx={rx} className={cls(on)} style={st(key, on)}/>
  );

  return (
    <svg viewBox="0 0 200 168" width={w} height={size} style={{ flexShrink: 0, '--mc': color } as React.CSSProperties}>

      {/* ── FRONT body fills ── */}
      <circle cx={50} cy={13} r={9}  fill={sk} stroke={so} strokeWidth={0.6}/>
      {B(47,21, 6, 7, 2, sk, so)}  {/* neck */}
      {B(33,28,34,53, 5, sk, so)}  {/* torso */}
      {B(21,30,11,31, 4, sk, so)}  {/* L upper arm */}
      {B(68,30,11,31, 4, sk, so)}  {/* R upper arm */}
      {B(22,62, 9,21, 3, sk, so)}  {/* L forearm */}
      {B(69,62, 9,21, 3, sk, so)}  {/* R forearm */}
      {B(34,83,13,44, 5, sk, so)}  {/* L thigh */}
      {B(53,83,13,44, 5, sk, so)}  {/* R thigh */}
      {B(35,129,11,31,4, sk, so)}  {/* L shin */}
      {B(54,129,11,31,4, sk, so)}  {/* R shin */}

      {/* ── FRONT muscles ── */}
      {M(33,28,34,26, 5, "ch", ff("ch"))}   {/* chest  = upper torso */}
      {M(33,54,34,27, 3, "co", ff("co"))}   {/* core   = lower torso */}
      {M(21,30,11,14, 4, "sh", ff("sh"))}   {/* L shoulder cap */}
      {M(68,30,11,14, 4, "sh", ff("sh"))}   {/* R shoulder cap */}
      {M(21,44,11,17, 3, "bi", ff("bi"))}   {/* L bicep */}
      {M(68,44,11,17, 3, "bi", ff("bi"))}   {/* R bicep */}
      {M(34,83,13,28, 5, "qd", ff("qd"))}   {/* L quad */}
      {M(53,83,13,28, 5, "qd", ff("qd"))}   {/* R quad */}
      {M(35,129,11,31,4, "cv", ff("cv"))}   {/* L calf */}
      {M(54,129,11,31,4, "cv", ff("cv"))}   {/* R calf */}

      {/* ── FRONT body outlines on top ── */}
      <circle cx={50} cy={13} r={9}  fill="none" stroke={so} strokeWidth={0.6}/>
      {B(47,21, 6, 7, 2, "none", so)}
      {B(33,28,34,53, 5, "none", so)}
      {B(21,30,11,31, 4, "none", so)}
      {B(68,30,11,31, 4, "none", so)}
      {B(22,62, 9,21, 3, "none", so)}
      {B(69,62, 9,21, 3, "none", so)}
      {B(34,83,13,44, 5, "none", so)}
      {B(53,83,13,44, 5, "none", so)}
      {B(35,129,11,31,4, "none", so)}
      {B(54,129,11,31,4, "none", so)}

      {/* divider */}
      <line x1={100} y1={8} x2={100} y2={162} stroke="rgba(255,255,255,0.07)" strokeWidth={0.5}/>

      {/* ── BACK body fills ── */}
      <circle cx={150} cy={13} r={9}  fill={sk} stroke={so} strokeWidth={0.6}/>
      {B(147,21, 6, 7, 2, sk, so)}
      {B(133,28,34,53, 5, sk, so)}
      {B(121,30,11,31, 4, sk, so)}
      {B(168,30,11,31, 4, sk, so)}
      {B(122,62, 9,21, 3, sk, so)}
      {B(169,62, 9,21, 3, sk, so)}
      {B(134,83,13,44, 5, sk, so)}
      {B(153,83,13,44, 5, sk, so)}
      {B(135,129,11,31,4, sk, so)}
      {B(154,129,11,31,4, sk, so)}

      {/* ── BACK muscles ── */}
      {M(133,28,34,53, 5, "bk", fb("bk"))}  {/* back = full torso back */}
      {M(121,30,11,14, 4, "sh", fb("sh"))}  {/* L rear shoulder */}
      {M(168,30,11,14, 4, "sh", fb("sh"))}  {/* R rear shoulder */}
      {M(121,44,11,17, 3, "tr", fb("tr"))}  {/* L tricep */}
      {M(168,44,11,17, 3, "tr", fb("tr"))}  {/* R tricep */}
      {M(134,83,13,22, 5, "gl", fb("gl"))}  {/* L glute */}
      {M(153,83,13,22, 5, "gl", fb("gl"))}  {/* R glute */}
      {M(134,105,13,22,4, "hm", fb("hm"))}  {/* L hamstring */}
      {M(153,105,13,22,4, "hm", fb("hm"))}  {/* R hamstring */}
      {M(135,129,11,31,4, "cv", fb("cv"))}  {/* L calf back */}
      {M(154,129,11,31,4, "cv", fb("cv"))}  {/* R calf back */}

      {/* ── BACK body outlines on top ── */}
      <circle cx={150} cy={13} r={9}  fill="none" stroke={so} strokeWidth={0.6}/>
      {B(147,21, 6, 7, 2, "none", so)}
      {B(133,28,34,53, 5, "none", so)}
      {B(121,30,11,31, 4, "none", so)}
      {B(168,30,11,31, 4, "none", so)}
      {B(122,62, 9,21, 3, "none", so)}
      {B(169,62, 9,21, 3, "none", so)}
      {B(134,83,13,44, 5, "none", so)}
      {B(153,83,13,44, 5, "none", so)}
      {B(135,129,11,31,4, "none", so)}
      {B(154,129,11,31,4, "none", so)}
    </svg>
  );
}

// Maps a primary muscle key (chest, lat, biceps, etc.) to one of the six
// AI anatomy thumbnails. Returns null if the muscle group isn't covered.
function anatomyImageFor(primary: string[]): string | null {
  const m = primary.map(k => k.toLowerCase()).join(" ");
  if (/\b(chest|pec)/.test(m))                          return "/ai/anatomy-chest.jpg";
  if (/(lat|back|trap|rhomb|erector|rear.delt)/.test(m)) return "/ai/anatomy-back.jpg";
  if (/(delt|shoulder)/.test(m))                         return "/ai/anatomy-shoulders.jpg";
  if (/(bicep|tricep|arm|forearm)/.test(m))              return "/ai/anatomy-arms.jpg";
  if (/(quad|hamstring|glute|calf|calve|leg)/.test(m))   return "/ai/anatomy-legs.jpg";
  if (/(core|abs|obliq|abdomin)/.test(m))                return "/ai/anatomy-core.jpg";
  return null;
}

// Maps a workout title to one of the 8 AI workout-card images, or null if the
// title doesn't cleanly match one of the canonical splits (chest day, arms,
// etc. fall back to the animated SVG icon).
function workoutImageFor(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("hiit"))                                 return "/ai/workout-hiit.jpg";
  if (t.includes("cardio") || t.includes("conditio"))     return "/ai/workout-cardio.jpg";
  if (t.startsWith("push") && t.includes("volume"))       return "/ai/workout-push-volume.jpg";
  if (t.startsWith("push"))                               return "/ai/workout-push.jpg";
  if (t.startsWith("pull") && t.includes("width"))        return "/ai/workout-pull-width.jpg";
  if (t.startsWith("pull"))                               return "/ai/workout-pull.jpg";
  if (t.includes("chest"))                                return "/ai/workout-chest.jpg";
  if (t.includes("back") || t.includes("lat ") || t.endsWith("lat") || t.includes("lats")) return "/ai/workout-back.jpg";
  if (t.includes("shoulder") || t.includes("delt"))       return "/ai/workout-shoulders.jpg";
  if (t.includes("arm") || t.includes("bicep") || t.includes("tricep")) return "/ai/workout-arms.jpg";
  if (t.includes("core") || t.includes("abs") || t.includes("ab "))     return "/ai/workout-core.jpg";
  if (t.includes("glute"))                                return "/ai/workout-glutes.jpg";
  if (t.includes("recovery") || t.includes("mobility") || t.includes("stretch")) return "/ai/workout-recovery.jpg";
  if (t.includes("power") || t.includes("olympic") || t.includes("explosive"))   return "/ai/workout-power.jpg";
  if (t.startsWith("full"))                               return "/ai/workout-fullbody.jpg";
  if (t.startsWith("upper"))                              return "/ai/workout-upper.jpg";
  if (t.startsWith("lower"))                              return "/ai/workout-lower.jpg";
  if (t.startsWith("leg"))                                return "/ai/workout-legs.jpg";
  return null;
}

function WorkoutCardIcon({ title, color, size = 60 }: { title: string; color: string; size?: number }) {
  const src = workoutImageFor(title);
  if (!src) return <WorkoutTypeIcon title={title} color={color} size={size}/>;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: 12, objectFit: "cover",
        boxShadow: `0 0 0 1px ${color}30, 0 4px 14px rgba(0,0,0,0.4)`,
      }}
    />
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
  const stAnim = (st: "p" | "s" | "") =>
    st === "p" ? { animation: "muscleGlow 1.8s ease-in-out infinite" }
    : st === "s" ? { animation: "muscleGlow 2.2s ease-in-out infinite 0.4s" }
    : undefined;

  const mc = (m: string) => stFill(wSt(m));
  const ms = (m: string) => stStroke(wSt(m));
  const mf = (m: string) => stFilter(wSt(m));
  const mfAnim = (m: string) => stAnim(wSt(m));

  // Render a group of sub-muscle paths in z-order: dim → secondary → primary. Bright always paints last.
  const Group = ({ paths, parent, k }: { paths: { d: string; sub: string }[]; parent: string; k: string }) => (
    <>
      {paths
        .map(pp => ({ ...pp, st: subSt(pp.sub, parent) }))
        .sort((a, b) => stOrder(a.st) - stOrder(b.st))
        .map((pp, i) => (
          <path key={`${k}-${i}`} d={pp.d} fill={stFill(pp.st)} stroke={stStroke(pp.st)} filter={stFilter(pp.st)} strokeWidth={0.7} style={stAnim(pp.st)}/>
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
    // LEFT — shorter vertically (y50→y97), fan converging at armpit
    { sub: "chest-upper", d: "M75,50 C70,47 60,44 50,46 C44,47 38,51 36,56 C36,61 37,65 41,66 C52,68 65,67 75,66 Z" },
    { sub: "chest-mid",   d: "M75,66 C65,67 52,68 41,66 C37,69 37,75 40,80 C42,83 47,84 53,84 C63,84 70,82 75,81 Z" },
    { sub: "chest-lower", d: "M75,81 C70,82 63,84 53,84 C46,84 42,87 42,92 C44,96 50,99 57,99 C64,100 71,98 75,97 Z" },
    { sub: "chest-inner", d: "M75,50 C73,53 72,61 71,69 C71,80 72,90 75,97 C77,90 78,80 78,69 C78,61 77,53 75,50 Z" },
    // RIGHT (mirror)
    { sub: "chest-upper", d: "M75,50 C80,47 90,44 100,46 C106,47 112,51 114,56 C114,61 113,65 109,66 C98,68 85,67 75,66 Z" },
    { sub: "chest-mid",   d: "M75,66 C85,67 98,68 109,66 C113,69 113,75 110,80 C108,83 103,84 97,84 C87,84 80,82 75,81 Z" },
    { sub: "chest-lower", d: "M75,81 C80,82 87,84 97,84 C104,84 108,87 108,92 C106,96 100,99 93,99 C86,100 79,98 75,97 Z" },
    { sub: "chest-inner", d: "M75,50 C77,53 78,61 79,69 C79,80 78,90 75,97 C73,90 72,80 72,69 C72,61 73,53 75,50 Z" },
  ];

  // Pec fiber lines — radiate from armpit (~42,60) toward sternum/clavicle (updated for shorter pec)
  const chestFibersF = [
    { sub: "chest-upper", d: "M42,55 L74,52" }, { sub: "chest-upper", d: "M41,59 L74,59" }, { sub: "chest-upper", d: "M41,62 L74,65" },
    { sub: "chest-mid",   d: "M41,62 L74,68" }, { sub: "chest-mid",   d: "M42,66 L74,75" }, { sub: "chest-mid",   d: "M43,70 L74,81" },
    { sub: "chest-lower", d: "M43,73 L74,86" }, { sub: "chest-lower", d: "M44,77 L65,97" }, { sub: "chest-lower", d: "M47,83 L57,98" },
    // Right mirror
    { sub: "chest-upper", d: "M108,55 L76,52" }, { sub: "chest-upper", d: "M109,59 L76,59" }, { sub: "chest-upper", d: "M109,62 L76,65" },
    { sub: "chest-mid",   d: "M109,62 L76,68" }, { sub: "chest-mid",   d: "M108,66 L76,75" }, { sub: "chest-mid",   d: "M107,70 L76,81" },
    { sub: "chest-lower", d: "M107,73 L76,86" }, { sub: "chest-lower", d: "M106,77 L85,97" }, { sub: "chest-lower", d: "M103,83 L93,98" },
  ];

  // Deltoid: arm attachment shifted further outward (18px total from original)
  const shouldersF = [
    { sub: "shoulders-side",  d: "M16,47 C5,52 -3,64 -1,75 C1,82 9,86 19,83 C23,75 22,62 19,51 Z" },
    { sub: "shoulders-front", d: "M19,51 C22,62 23,75 19,83 C27,87 36,85 41,76 C43,67 41,55 34,48 C30,45 24,47 19,51 Z" },
    { sub: "shoulders-side",  d: "M134,47 C145,52 153,64 151,75 C149,82 141,86 131,83 C127,75 128,62 131,51 Z" },
    { sub: "shoulders-front", d: "M131,51 C128,62 127,75 131,83 C123,87 114,85 109,76 C107,67 109,55 116,48 C120,45 126,47 131,51 Z" },
  ];

  // Shoulder fiber lines — shifted further outward with arm
  const shoulderFibersF = [
    { sub: "shoulders-side",  d: "M0,67 C2,73 6,79 10,82" },   { sub: "shoulders-side",  d: "M3,62 C5,68 9,74 13,79" },   { sub: "shoulders-side",  d: "M7,57 C9,63 13,70 16,76" },
    { sub: "shoulders-front", d: "M25,52 C26,61 28,71 27,80" }, { sub: "shoulders-front", d: "M29,51 C30,60 32,71 31,79" }, { sub: "shoulders-front", d: "M33,51 C34,60 36,70 35,79" },
    { sub: "shoulders-side",  d: "M150,67 C148,73 144,79 140,82" }, { sub: "shoulders-side",  d: "M147,62 C145,68 141,74 137,79" }, { sub: "shoulders-side",  d: "M143,57 C141,63 137,70 134,76" },
    { sub: "shoulders-front", d: "M125,52 C124,61 122,71 123,80" }, { sub: "shoulders-front", d: "M121,51 C120,60 118,71 119,79" }, { sub: "shoulders-front", d: "M117,51 C116,60 114,70 115,79" },
  ];

  // Biceps: shifted outward to follow wider arm attachment
  const bicepsF = [
    { sub: "biceps-long",  d: "M6,72 C2,85 1,104 4,118 C6,127 13,130 17,128 C19,117 18,98 17,83 C15,74 10,70 6,72 Z" },
    { sub: "biceps-short", d: "M17,83 C18,98 19,117 17,128 C21,130 25,130 29,127 C31,120 31,108 29,94 C27,82 21,73 17,75 C17,78 17,81 17,83 Z" },
    { sub: "brachialis",   d: "M13,122 C10,129 11,136 15,138 C20,139 24,136 24,132 C24,127 21,121 17,120 Z" },
    { sub: "biceps-long",  d: "M144,72 C148,85 149,104 146,118 C144,127 137,130 133,128 C131,117 132,98 133,83 C135,74 140,70 144,72 Z" },
    { sub: "biceps-short", d: "M133,83 C132,98 131,117 133,128 C129,130 125,130 121,127 C119,120 119,108 121,94 C123,82 129,73 133,75 C133,78 133,81 133,83 Z" },
    { sub: "brachialis",   d: "M137,122 C140,129 139,136 135,138 C130,139 126,136 126,132 C126,127 129,121 133,120 Z" },
  ];

  // Bicep fiber lines — shifted outward with arm
  const bicepFibersF = [
    { sub: "biceps-long",  d: "M6,76 C5,94 5,111 7,122" },   { sub: "biceps-long",  d: "M10,74 C9,92 9,109 10,121" },   { sub: "biceps-long",  d: "M13,73 C12,91 12,108 14,120" },
    { sub: "biceps-short", d: "M18,78 C18,95 18,112 18,126" }, { sub: "biceps-short", d: "M21,76 C21,93 21,110 21,124" }, { sub: "biceps-short", d: "M24,77 C24,94 24,110 23,123" },
    { sub: "biceps-long",  d: "M144,76 C145,94 145,111 143,122" }, { sub: "biceps-long",  d: "M140,74 C141,92 141,109 140,121" }, { sub: "biceps-long",  d: "M137,73 C138,91 138,108 136,120" },
    { sub: "biceps-short", d: "M132,78 C132,95 132,112 132,126" }, { sub: "biceps-short", d: "M129,76 C129,93 129,110 129,124" }, { sub: "biceps-short", d: "M126,77 C126,94 126,110 127,123" },
  ];

  const forearmsF = [
    { sub: "forearm-flexor", d: "M12,131 C8,138 6,150 7,160 C8,168 13,175 19,175 C25,175 29,168 30,158 C30,148 27,138 22,133 Z" },
    { sub: "forearm-flexor", d: "M138,131 C142,138 144,150 143,160 C142,168 137,175 131,175 C125,175 121,168 120,158 C120,148 123,138 128,133 Z" },
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

  // Deltoid cap (back view): shifted further outward to match wider arm attachment
  const shouldersB = [
    { sub: "shoulders-side", d: "M166,47 C155,52 147,64 149,75 C151,82 159,86 169,83 C173,75 172,62 169,51 Z" },
    { sub: "shoulders-rear", d: "M169,51 C172,62 173,75 169,83 C177,87 186,85 192,76 C195,67 193,55 185,48 C180,45 174,47 169,51 Z" },
    { sub: "shoulders-side", d: "M284,47 C295,52 300,64 300,75 C299,82 291,86 281,83 C277,75 278,62 281,51 Z" },
    { sub: "shoulders-rear", d: "M281,51 C278,62 277,75 281,83 C273,87 264,85 258,76 C255,67 257,55 265,48 C270,45 276,47 281,51 Z" },
  ];

  // Shoulder fiber lines (back view) — shifted further outward with arm
  const shoulderFibersB = [
    { sub: "shoulders-side", d: "M150,67 C152,73 156,79 160,82" }, { sub: "shoulders-side", d: "M153,62 C155,68 159,74 163,79" }, { sub: "shoulders-side", d: "M157,57 C159,63 163,70 166,76" },
    { sub: "shoulders-rear", d: "M175,52 C176,61 178,71 177,80" }, { sub: "shoulders-rear", d: "M179,51 C180,60 182,71 181,79" }, { sub: "shoulders-rear", d: "M183,51 C184,60 186,70 185,79" },
    { sub: "shoulders-side", d: "M300,67 C298,73 294,79 290,82" }, { sub: "shoulders-side", d: "M297,62 C295,68 291,74 287,79" }, { sub: "shoulders-side", d: "M293,57 C291,63 287,70 284,76" },
    { sub: "shoulders-rear", d: "M275,52 C274,61 272,71 273,80" }, { sub: "shoulders-rear", d: "M271,51 C270,60 268,71 269,79" }, { sub: "shoulders-rear", d: "M267,51 C266,60 264,70 265,79" },
  ];

  const backB = [
    // Upper trapezius — wider diamond reaching further toward acromion
    { sub: "back-traps-upper", d: "M225,38 C214,41 200,51 190,62 C186,70 188,79 198,82 C208,85 217,80 225,74 C233,80 242,85 252,82 C262,79 264,70 260,62 C250,51 236,41 225,38 Z" },
    // Mid trapezius + rhomboids
    { sub: "back-traps-mid",   d: "M200,77 C196,89 196,103 202,113 C207,121 214,124 221,122 C223,118 224,111 225,104 C226,111 227,118 229,122 C236,124 243,121 248,113 C254,103 254,89 250,77 C240,82 231,84 226,80 C225,78 225,78 224,80 C219,84 210,82 200,77 Z" },
    // Teres major — small oval at armpit
    { sub: "back-teres",       d: "M191,76 C186,81 185,90 190,95 C196,97 203,94 204,87 C204,81 198,74 191,76 Z" },
    { sub: "back-teres",       d: "M259,76 C264,81 265,90 260,95 C254,97 247,94 246,87 C246,81 252,74 259,76 Z" },
    // Latissimus dorsi — rounded triangle: armpit corners at top, single point at lower back, concave outer edges
    { sub: "back-lats",        d: "M186,82 C198,110 204,148 207,170 C214,148 214,110 213,72 C206,76 196,78 186,82 Z" },
    { sub: "back-lats",        d: "M264,82 C252,110 246,148 243,170 C236,148 236,110 237,72 C244,76 254,78 264,82 Z" },
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
    // Lats — radiating from armpit corner to lower tip
    { sub: "back-lats", d: "M190,85 C196,110 202,136 207,162" }, { sub: "back-lats", d: "M195,82 C200,108 205,133 208,160" },
    { sub: "back-lats", d: "M200,80 C204,106 207,131 208,158" }, { sub: "back-lats", d: "M205,78 C208,104 209,129 208,155" },
    { sub: "back-lats", d: "M260,85 C254,110 248,136 243,162" }, { sub: "back-lats", d: "M255,82 C250,108 245,133 242,160" },
    { sub: "back-lats", d: "M250,80 C246,106 243,131 242,158" }, { sub: "back-lats", d: "M245,78 C242,104 241,129 242,155" },
    // Erectors — vertical
    { sub: "back-lower", d: "M222,114 C222,132 222,149 222,164" }, { sub: "back-lower", d: "M224,114 C224,132 224,149 224,164" },
    { sub: "back-lower", d: "M226,114 C226,132 226,149 226,164" }, { sub: "back-lower", d: "M228,114 C228,132 228,149 228,164" },
  ];

  // Triceps: shifted outward to match wider back arm attachment
  const tricepsB = [
    { sub: "triceps-long",    d: "M174,66 C171,77 170,97 172,115 C173,127 179,132 184,130 C185,118 184,98 183,83 C181,72 177,65 174,66 Z" },
    { sub: "triceps-lateral", d: "M158,66 C155,77 153,97 155,115 C157,127 163,132 169,130 C170,117 169,97 168,83 C166,72 162,64 158,66 Z" },
    { sub: "triceps-medial",  d: "M159,121 C157,127 158,134 163,136 C167,138 172,135 173,131 C173,126 170,119 166,118 Z" },
    { sub: "triceps-long",    d: "M276,66 C279,77 280,97 278,115 C277,127 271,132 266,130 C265,118 266,98 267,83 C269,72 273,65 276,66 Z" },
    { sub: "triceps-lateral", d: "M292,66 C295,77 297,97 295,115 C293,127 287,132 281,130 C280,117 281,97 282,83 C284,72 288,64 292,66 Z" },
    { sub: "triceps-medial",  d: "M291,121 C293,127 292,134 287,136 C283,138 278,135 277,131 C277,126 280,119 284,118 Z" },
  ];

  // Tricep fiber lines — shifted outward with arm
  const tricepFibersB = [
    { sub: "triceps-lateral", d: "M159,69 L160,123" }, { sub: "triceps-lateral", d: "M162,68 L163,123" }, { sub: "triceps-lateral", d: "M165,68 L166,123" },
    { sub: "triceps-long",    d: "M175,69 L175,124" }, { sub: "triceps-long",    d: "M178,69 L178,123" }, { sub: "triceps-long",    d: "M181,69 L181,122" },
    { sub: "triceps-lateral", d: "M291,69 L290,123" }, { sub: "triceps-lateral", d: "M288,68 L287,123" }, { sub: "triceps-lateral", d: "M285,68 L284,123" },
    { sub: "triceps-long",    d: "M275,69 L275,124" }, { sub: "triceps-long",    d: "M272,69 L272,123" }, { sub: "triceps-long",    d: "M269,69 L269,122" },
  ];

  const forearmsB = [
    { sub: "forearm-extensor", d: "M163,138 C160,146 159,157 161,167 C163,175 168,180 173,178 C178,176 180,167 179,157 C178,147 174,139 169,136 Z" },
    { sub: "forearm-extensor", d: "M287,138 C290,146 291,157 289,167 C287,175 282,180 277,178 C272,176 270,167 271,157 C272,147 276,139 281,136 Z" },
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
      <path d="M9,52 C5,62 3,80 6,100 C9,116 14,128 19,130 C23,133 31,131 37,126 C39,118 40,102 40,85 C36,69 29,57 15,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M141,52 C144,62 147,80 142,100 C137,116 133,128 128,130 C124,133 116,131 110,126 C109,118 108,102 110,85 C116,69 125,57 135,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M12,131 C8,138 6,150 7,160 C8,168 13,175 19,175 C25,175 29,168 30,158 C30,148 27,138 22,133 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M138,131 C142,138 144,150 143,160 C142,168 137,175 131,175 C125,175 121,168 120,158 C120,148 123,138 128,133 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M48,194 C43,206 39,226 38,248 C37,265 41,276 49,279 C55,281 64,279 69,273 C74,265 75,251 74,233 C73,214 69,198 63,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M102,194 C107,206 111,226 112,248 C113,265 109,276 101,279 C95,281 86,279 81,273 C76,265 75,251 76,233 C77,214 81,198 87,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M28,281 C25,292 25,310 27,324 C29,336 35,344 42,345 C48,345 53,340 55,332 C57,322 57,306 54,292 C52,281 47,276 41,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M122,281 C125,292 125,310 123,324 C121,336 115,344 108,345 C102,345 97,340 95,332 C93,322 93,306 96,292 C98,281 103,276 109,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>

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
      <path d="M159,52 C155,62 151,80 157,100 C161,116 165,128 170,130 C174,133 181,131 187,126 C190,118 191,102 190,85 C184,69 177,57 163,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M291,52 C295,62 299,80 293,100 C289,116 285,128 280,130 C276,133 269,131 263,126 C260,118 259,102 260,85 C266,69 273,57 287,52 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M162,131 C158,138 156,150 157,160 C158,168 163,175 169,175 C175,175 179,168 180,158 C180,148 177,138 172,133 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M288,131 C292,138 294,150 293,160 C292,168 287,175 281,175 C275,175 271,168 270,158 C270,148 273,138 278,133 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M198,194 C193,206 189,226 188,248 C187,265 191,276 199,279 C205,281 214,279 219,273 C224,265 225,251 224,233 C223,214 219,198 213,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M252,194 C257,206 261,226 262,248 C263,265 259,276 251,279 C245,281 236,279 231,273 C226,265 225,251 226,233 C227,214 231,198 237,194 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M178,281 C175,292 175,310 177,324 C179,336 185,344 192,345 C198,345 203,340 205,332 C207,322 207,306 204,292 C202,281 197,276 191,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>
      <path d="M272,281 C275,292 275,310 273,324 C271,336 265,344 258,345 C252,345 247,340 245,332 C243,322 243,306 246,292 C248,281 253,276 259,277 Z" fill="url(#skin)" stroke="#2e2e40" strokeWidth={0.7}/>

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

// ─── MOTIVATIONAL PHRASES ───────────────────────────────────────────────
const PHRASES = [
  "Trust the process.",
  "Stay disciplined.",
  "Consistency is key.",
  "No shortcuts.",
  "Every rep counts.",
  "Progress, not perfection.",
  "Show up. Put in the work.",
  "Earn it.",
  "One more set.",
  "Strong mind. Stronger body.",
  "The grind never stops.",
  "Be stronger than your excuses.",
  "Discipline over motivation.",
  "Lift heavy. Live light.",
  "Built, not bought.",
  "Do the work.",
  "Champions train. Legends grind.",
  "Your only competition is you.",
  "Results take time.",
  "Embrace the struggle.",
];

// ─── PASSWORD INPUT ─────────────────────────────────────────────────────
// Standard password input + an eye toggle on the right that flips between
// type=password and type=text. Used across register / login / setup /
// must-reset screens.
function PasswordInput({
  value, onChange, placeholder, onKeyDown, autoFocus, style,
  autoComplete = "current-password",
  name = "password",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  /** "current-password" for login, "new-password" for register/setup/must-reset */
  autoComplete?: "current-password" | "new-password";
  name?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: style?.maxWidth ?? 300, margin: "0 auto", marginBottom: (style as any)?.marginBottom }}>
      <input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        type={show ? "text" : "password"}
        autoFocus={autoFocus}
        name={name}
        autoComplete={autoComplete}
        style={{ ...style, width: "100%", maxWidth: "100%", margin: 0, paddingRight: 46, marginBottom: 0 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          height: 36, width: 36, background: "transparent", border: "none",
          color: "rgba(255,255,255,0.5)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, padding: 0,
        }}
      >
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

// ─── PROFILE NAG BANNER ─────────────────────────────────────────────────
// Shows at the top of the home screen if any required profile fields are
// missing. Cooldowns: body-fat is nagged at most every 7 days, other fields
// every 1 day. Dismissal state lives in localStorage, no DB field needed.
function ProfileNagBanner({
  ob, onGoToSettings,
}: {
  ob: { bodyFatPct?: string; heightCm?: string; weightKg?: string; gender?: string; dob?: string };
  onGoToSettings: () => void;
}) {
  const [tick, setTick] = useState(0); // force re-render after dismiss
  const missing: { key: string; label: string; cooldownMs: number }[] = [];
  if (!ob.dob)        missing.push({ key: "dob",        label: "date of birth",  cooldownMs: 1  * 24 * 3600 * 1000 });
  if (!ob.gender)     missing.push({ key: "gender",     label: "gender",         cooldownMs: 1  * 24 * 3600 * 1000 });
  if (!ob.heightCm)   missing.push({ key: "heightCm",   label: "height",         cooldownMs: 1  * 24 * 3600 * 1000 });
  if (!ob.weightKg)   missing.push({ key: "weightKg",   label: "weight",         cooldownMs: 1  * 24 * 3600 * 1000 });
  if (!ob.bodyFatPct) missing.push({ key: "bodyFatPct", label: "body fat %",     cooldownMs: 7  * 24 * 3600 * 1000 });
  if (missing.length === 0) return null;

  // Find the soonest field that's eligible to nag right now.
  let visible: typeof missing[0] | null = null;
  for (const m of missing) {
    try {
      const last = parseInt(localStorage.getItem(`nag-${m.key}`) || "0", 10);
      if (Date.now() - last >= m.cooldownMs) { visible = m; break; }
    } catch { visible = m; break; }
  }
  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(`nag-${visible!.key}`, String(Date.now())); } catch {}
    setTick(t => t + 1);
  };

  // Distinct copy when only body fat is missing — different cadence, lower urgency.
  const onlyBf = missing.length === 1 && visible.key === "bodyFatPct";
  return (
    <div style={{ padding: "10px 16px 0" }}>
      <div style={{
        background: "rgba(255,107,107,0.07)",
        border: "1px solid rgba(255,107,107,0.25)",
        borderRadius: 12, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, marginBottom: 2 }}>
            {onlyBf ? "Add your body fat %" : `Finish your profile (${missing.length} item${missing.length === 1 ? "" : "s"} missing)`}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {onlyBf
              ? "Optional, but makes progress tracking sharper."
              : `Missing: ${missing.slice(0, 3).map(m => m.label).join(", ")}${missing.length > 3 ? "…" : ""}`}
          </div>
        </div>
        <button onClick={onGoToSettings} style={{
          padding: "8px 12px", background: "rgba(255,107,107,0.9)", border: "none",
          borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1,
          fontFamily: "'Space Mono', monospace", cursor: "pointer", whiteSpace: "nowrap",
        }}>FIX</button>
        <button onClick={dismiss} aria-label="Dismiss" style={{
          padding: "8px 10px", background: "transparent", border: "none",
          color: "rgba(255,255,255,0.4)", fontSize: 16, cursor: "pointer",
        }}>✕</button>
      </div>
    </div>
  );
}

// ─── SEND FEEDBACK CARD ─────────────────────────────────────────────────
// Lives in the Settings view. Lets any logged-in user file a short note that
// gets stored as a QAComment with their userId attached. Claude picks it up
// on the next "process QA" pass.
function SendFeedbackCard({ username }: { username: string }) {
  const [text, setText] = useState("");
  const [area, setArea] = useState<string>("Other");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const submit = async () => {
    if (!text.trim()) { setError("Write something first."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/qa/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: "user-feedback",
          tester: username || "user",
          status: "failing",
          note: `[${area}] ${text.trim()}`,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || "Couldn't send. Try again.");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      setText("");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "rgba(78,205,196,0.04)", border: "1px solid rgba(78,205,196,0.18)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#4ECDC4", letterSpacing: 3, marginBottom: 4, fontFamily: "'Space Mono', monospace" }}>💬 SEND FEEDBACK</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Spot a bug or have an idea? Tell the team.</div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace", marginBottom: 4 }}>AREA</label>
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            style={{ width: "100%", background: "#111", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}
          >
            {["Auth","Workout","Plan","Trainer","Messaging","Progress","Body","UI","PWA","Admin","Marketing","Other"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace", marginBottom: 4 }}>WHAT HAPPENED / WHAT YOU&apos;D LIKE</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Bug, idea, polish — be as specific as you can…"
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", fontSize: 16, fontFamily: "'DM Sans', sans-serif", resize: "vertical", marginBottom: 10 }}
          />

          {error && <div style={{ color: "#FF6B6B", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          {savedAt && <div style={{ color: "#4ECDC4", fontSize: 12, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>Sent ✓ at {savedAt}</div>}

          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            style={{
              width: "100%", padding: "12px",
              background: busy || !text.trim() ? "rgba(78,205,196,0.2)" : "rgba(78,205,196,0.9)",
              border: "none", borderRadius: 10, color: busy || !text.trim() ? "rgba(255,255,255,0.5)" : "#000",
              fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: busy || !text.trim() ? "not-allowed" : "pointer",
              fontFamily: "'Space Mono', monospace", minHeight: 44,
            }}
          >
            {busy ? "SENDING…" : "SEND FEEDBACK"}
          </button>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 8, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
            Your feedback is logged with your username so the team can follow up. You can send as many notes as you like — they all stack.
          </div>

          {/* Full dashboard link — for structured per-feature testing */}
          <a
            href="/qa"
            style={{
              marginTop: 12, padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, textDecoration: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#fff", fontFamily: "'Space Mono', monospace" }}>OPEN FULL QA DASHBOARD →</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Per-feature checklists, comment threads, search, status tracking</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ───────────────────────────────────────────────────────────────
function HomePage() {
  const [user, setUser] = useState<{ id: string; username: string; role: string; roleRequest?: string | null } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [appTheme, setAppTheme] = useState<"iron"|"mono"|"vivid">("iron");
  const [accentColor, setAccentColor] = useState("#FF6B6B");
  const [authLoading, setAuthLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authStep, setAuthStep] = useState<"username" | "register" | "setup" | "password" | "forgot">("username");
  const [landingTab, setLandingTab] = useState<"athlete" | "trainer">("athlete");
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
  const [log, setLog] = useState<Record<string, { weight: number; reps: number; skipped?: boolean }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wInput, setWInput] = useState("");
  const [rInput, setRInput] = useState("");
  // True when the current wInput/rInput values came from suggestedStartingSet()
  // rather than from a real prior session — used to show a "SUGGESTED" tag.
  const [isSuggested, setIsSuggested] = useState(false);
  const [bwAddWeight, setBwAddWeight] = useState(false);
  const [manualBW, setManualBW] = useState(false);
  const [logFlashId, setLogFlashId] = useState<string | null>(null);
  const [newPBs, setNewPBs] = useState<{ name: string; weight: number; reps: number }[]>([]);
  const [restStartTime, setRestStartTime] = useState<number>(0);
  const [pbAfterRest, setPbAfterRest] = useState<{ name: string; weight: number; reps: number }[]>([]);
  const [showCompleteAnim, setShowCompleteAnim] = useState(false);
  const [viewDir, setViewDir] = useState<"forward" | "back">("forward");
  const prevOnboardingStep = useRef(0);
  const [obDir, setObDir] = useState<"forward" | "back">("forward");
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [openHist, setOpenHist] = useState<string | null>(null);
  const [warmupDone, setWarmupDone] = useState<Record<string, boolean>>({});
  const [pendingDrop, setPendingDrop] = useState<{ exId: string; setNum: number; dropNum: number } | null>(null);
  const [dropWInput, setDropWInput] = useState("");
  const [dropRInput, setDropRInput] = useState("");
  const [editEx, setEditEx] = useState<string | null>(null);
  const [editSets, setEditSets] = useState<Record<string, { weight: number; reps: number; skipped?: boolean }>>({});
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [adjustedDuration, setAdjustedDuration] = useState("");
  const [resumeOverlay, setResumeOverlay] = useState<{ title: string; ageStr: string } | null>(null);
  const [progressTab, setProgressTab] = useState<"dashboard" | "exercises" | "history" | "body">("dashboard");
  const [calDateSel, setCalDateSel] = useState<string | null>(null);
  const [selectedExDay, setSelectedExDay] = useState<string | null>(null);

  // ── In-workout exercise addition ──
  const [showAddInWorkout, setShowAddInWorkout] = useState(false);
  const [aiWStep, setAiWStep] = useState<"browse" | "config">("browse");
  const [aiWSearch, setAiWSearch] = useState("");
  const [aiWFilterLoc, setAiWFilterLoc] = useState("all");
  const [aiWFilterMove, setAiWFilterMove] = useState("all");
  const [aiWFilterMuscle, setAiWFilterMuscle] = useState("all");
  const [aiWEx, setAiWEx] = useState<any | null>(null);
  const [aiWSets, setAiWSets] = useState(3);
  const [aiWReps, setAiWReps] = useState("10-12");
  const [aiWRest, setAiWRest] = useState(60);
  const [aiWPermanent, setAiWPermanent] = useState(false);

  // ── Session exercise browser ──
  const [showSessionExBrowser, setShowSessionExBrowser] = useState(false);
  const [sessionExSearch, setSessionExSearch] = useState("");
  const [addingSupersetForId, setAddingSupersetForId] = useState<string | null>(null);

  // ── Customise ──
  const [editingDay, setEditingDay] = useState<any | null>(null);
  const [superSelection, setSuperSelection] = useState<string[]>([]);
  const [customMultiMode, setCustomMultiMode] = useState(false);
  const [browserSupersetMode, setBrowserSupersetMode] = useState(false);
  const [browserSuperSel, setBrowserSuperSel] = useState<string[]>([]);
  const [trainerSuperSel, setTrainerSuperSel] = useState<{ dayIdx: number; exIds: string[] } | null>(null);
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
  const [isMounted, setIsMounted] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Trainer custom exercises ──
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [showExCreator, setShowExCreator] = useState(false);
  const [exCreatorName, setExCreatorName] = useState("");
  const [exCreatorPrimary, setExCreatorPrimary] = useState<string[]>([]);
  const [exCreatorSecondary, setExCreatorSecondary] = useState<string[]>([]);
  const [exCreatorEquip, setExCreatorEquip] = useState<string[]>([]);
  const [exCreatorType, setExCreatorType] = useState("compound");
  const [exCreatorDiff, setExCreatorDiff] = useState("intermediate");
  const [exCreatorPhotos, setExCreatorPhotos] = useState<string[]>([]);
  const [exCreatorUploading, setExCreatorUploading] = useState(false);
  const [exCreatorSaving, setExCreatorSaving] = useState(false);

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
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState<"sessions" | "streak" | "intensity">("sessions");
  const [showMyClients, setShowMyClients] = useState(true);
  const [showFindClients, setShowFindClients] = useState(false);
  const [lbGroups, setLbGroups] = useState<any[]>([]);
  const [lbGroupsLoading, setLbGroupsLoading] = useState(false);
  const [showLbGroups, setShowLbGroups] = useState(false);
  const [showLbGroupCreate, setShowLbGroupCreate] = useState(false);
  const [lbGroupName, setLbGroupName] = useState("");
  const [lbGroupPrivacy, setLbGroupPrivacy] = useState<"private"|"public">("private");
  const [creatingLbGroup, setCreatingLbGroup] = useState(false);
  const [activeLbGroup, setActiveLbGroup] = useState<any | null>(null);
  const [lbGroupClientSearch, setLbGroupClientSearch] = useState("");
  const [trainerSearchForLb, setTrainerSearchForLb] = useState("");
  const [trainerSearchResultsLb, setTrainerSearchResultsLb] = useState<any[]>([]);
  const [trainerSearchingLb, setTrainerSearchingLb] = useState(false);
  const [myLeaderboards, setMyLeaderboards] = useState<any[]>([]);
  const [myLeaderboardsLoading, setMyLeaderboardsLoading] = useState(false);
  const [showMyLeaderboards, setShowMyLeaderboards] = useState(false);
  const [pendingGroupInvites, setPendingGroupInvites] = useState<any[]>([]);
  // Intensity Points
  const [sessionIP, setSessionIP] = useState(0);
  const [ipToast, setIpToast] = useState<{ msg: string; icon: string } | null>(null);
  const completedSupersetGroups = useRef(new Set<string>());
  const completedDropExes = useRef(new Set<string>());
  const ipToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const profileWrapperRef = useRef<HTMLDivElement>(null);
  const SESSION_IP_CAP = 25;
  const [activeClient, setActiveClient] = useState<{ id: string; username: string } | null>(null);
  const [clientData, setClientData] = useState<{ profile: any; history: Record<string, any[]>; plan: any } | null>(null);
  const [clientDataLoading, setClientDataLoading] = useState(false);
  const [clientDetailTab, setClientDetailTab] = useState<"split" | "history" | "profile">("split");
  const [openClientSession, setOpenClientSession] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editedPlanDays, setEditedPlanDays] = useState<any[] | null>(null);
  const [proposingPlan, setProposingPlan] = useState(false);
  const [trainerGenerating, setTrainerGenerating] = useState(false);
  const [proposalSent, setProposalSent] = useState(false);

  // ── Body metrics ──
  const [bodyMetrics, setBodyMetrics] = useState<any[]>([]);
  const [bodyMetricsLoaded, setBodyMetricsLoaded] = useState(false);
  const [metricWeight, setMetricWeight] = useState("");
  const [metricBf, setMetricBf] = useState("");
  const [loggingMetric, setLoggingMetric] = useState(false);
  const [goalWeight, setGoalWeight] = useState("");
  const [goalBf, setGoalBf] = useState("");
  const [showGoalCelebration, setShowGoalCelebration] = useState(false);
  const [goalCelebDetails, setGoalCelebDetails] = useState<{type: 'weight'|'bf'; target: number; value: number}[]>([]);
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
  const [replyingTo, setReplyingTo] = useState<{ id: string; body: string; username: string } | null>(null);
  const [reactingToMsgId, setReactingToMsgId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const lastMsgCreatedAtRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const msgAudioCtx = useRef<AudioContext | null>(null);
  const tabFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentViewRef = useRef("home");

  // ── Onboarding + custom plan ──
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planNote, setPlanNote] = useState("");
  const [customPlan, setCustomPlan] = useState<any[] | null>(null);
  const [savedRoutines, setSavedRoutines] = useState<any[]>([]);
  const [showSavedList, setShowSavedList] = useState(false);
  const [showSaveRoutine, setShowSaveRoutine] = useState(false);
  const [showHiitPrompt, setShowHiitPrompt] = useState(false);
  const [showEmailSignupPrompt, setShowEmailSignupPrompt] = useState(false);
  const [hiitPreference, setHiitPreference] = useState("");
  const [hiitIntensity, setHiitIntensity] = useState("moderate");
  const [saveRoutineName, setSaveRoutineName] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [sharingRoutineId, setSharingRoutineId] = useState<string | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareResult, setShareResult] = useState<string | null>(null);
  const [shareClientIds, setShareClientIds] = useState<string[]>([]);
  const [ob, setOb] = useState({
    dob: "", gender: "", heightCm: "", weightKg: "", bodyFatPct: "",
    goals: [] as string[], targetAreas: [] as string[], fitnessLevel: "", location: "", equipment: [] as string[], daysPerWeek: 4,
  });
  const [rebuildMode, setRebuildMode] = useState(false);

  const [formPreview, setFormPreview] = useState<{ id: string; name: string; muscles: string[]; secondaryMuscles?: string[] } | null>(null);
  const [formFrame, setFormFrame] = useState(0);
  const [formImgError, setFormImgError] = useState(false);
  const [modalSlide, setModalSlide] = useState(0);
  const swipeTouchX = useRef(0);

  const rest = useCountdown();
  const timer = useTimer();
  const safeBot = "calc(80px + env(safe-area-inset-bottom, 0px))";
  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));
  const [phraseVisible, setPhraseVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => {
        setPhraseIdx(i => (i + 1 + Math.floor(Math.random() * (PHRASES.length - 1))) % PHRASES.length);
        setPhraseVisible(true);
      }, 320);
    }, 5000);
    return () => clearInterval(id);
  }, []);
  const phrase = PHRASES[phraseIdx];

  // ── Theme ──
  useEffect(() => {
    const t = (localStorage.getItem("ironlog-theme") ?? "iron") as "iron"|"mono"|"vivid";
    const a = localStorage.getItem("ironlog-accent") ?? "#FF6B6B";
    setAppTheme(t);
    setAccentColor(a);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
  }, [appTheme]);
  useEffect(() => {
    const [r, g, b] = [accentColor.slice(1,3), accentColor.slice(3,5), accentColor.slice(5,7)].map(h => parseInt(h, 16));
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--accent-rgb", `${r},${g},${b}`);
  }, [accentColor]);
  const changeTheme = (t: "iron"|"mono"|"vivid") => { setAppTheme(t); localStorage.setItem("ironlog-theme", t); };
  const changeAccent = (c: string) => { setAccentColor(c); localStorage.setItem("ironlog-accent", c); };

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
      // Re-register subscription silently on every app open (handles cache-cleared subscriptions)
      subscribeToPush().then(s => setNotifStatus(s));
    } else if (Notification.permission === "default") {
      // Always show banner until user explicitly allows or blocks via native prompt
      setShowNotifBanner(true);
    }
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  const refreshUser = useCallback(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (data.user) {
        setUser({ id: data.user.id, username: data.user.username, role: data.user.role ?? "user", roleRequest: data.user.roleRequest ?? null });
        if (data.user.mustReset) setMustResetPassword(true);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          subscribeToPush().then(s => setNotifStatus(s));
        }
      }
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    refreshUser();
  }, []);

  // Re-check role when tab regains focus — catches admin role changes without requiring a full reload
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refreshUser(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshUser]);

  // Minimum splash duration so the fall animation completes
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 2000);
    return () => clearTimeout(t);
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
      fetch("/api/trainer/exercises").then(r => r.json()).then(data => {
        if (data.exercises) setCustomExercises(data.exercises);
      }).catch(() => {});
      fetch("/api/leaderboard/invites").then(r => r.json()).then(data => {
        if (data.invites) setPendingGroupInvites(data.invites);
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

  // Heartbeat — update lastSeenAt every 60s while app is open and user is logged in
  useEffect(() => {
    if (!user) return;
    const beat = () => fetch("/api/presence", { method: "POST" }).catch(() => {});
    beat(); // fire immediately on login
    const id = setInterval(beat, 60_000);
    return () => clearInterval(id);
  }, [user]);

  // Poll conversations list every 5s while on the messages view
  useEffect(() => {
    if (view !== "messages") return;
    const poll = () => {
      fetch("/api/messages").then(r => r.json()).then(data => {
        if (data.conversations) {
          setConversations(data.conversations);
          setUnreadCount(data.conversations.reduce((a: number, c: any) => a + (c.unreadCount ?? 0), 0));
        }
      }).catch(() => {});
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [view]);

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

  // Poll for new messages and status updates while conversation is open
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
    // Periodically re-fetch all messages to pick up read/delivered/lastSeen changes
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/messages/${partnerId}`);
        const data = await res.json();
        if (data.partnerLastSeen !== undefined) setPartnerLastSeen(data.partnerLastSeen);
        if (data.messages?.length > 0) {
          setConversationMessages(prev => {
            const statusMap = new Map<string, { read: boolean; delivered: boolean }>(data.messages.map((m: any) => [m.id, { read: m.read, delivered: m.delivered }]));
            return prev.map((m: any) => {
              const s = statusMap.get(m.id);
              if (!s) return m;
              if (s.read === m.read && s.delivered === m.delivered) return m;
              return { ...m, read: s.read, delivered: s.delivered };
            });
          });
        }
      } catch {}
    };
    const id = setInterval(poll, 1000);
    const statusId = setInterval(pollStatus, 5000);
    return () => { clearInterval(id); clearInterval(statusId); };
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
          targetAreas: (p as any).targetAreas?.length ? (p as any).targetAreas : (p.targetArea && p.targetArea !== "none" ? [p.targetArea] : []),
          fitnessLevel: p.fitnessLevel || "",
          location: p.location || "",
          equipment: p.equipment || [],
          daysPerWeek: p.daysPerWeek || 4,
        });
        if (p.targetWeightKg) setGoalWeight(p.targetWeightKg.toString());
        if (p.targetBodyFatPct) setGoalBf(p.targetBodyFatPct.toString());
        if ((p as any).hiitPreference) setHiitPreference((p as any).hiitPreference);
        if ((p as any).hiitIntensity) setHiitIntensity((p as any).hiitIntensity);
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

  useEffect(() => {
    setObDir(onboardingStep >= prevOnboardingStep.current ? "forward" : "back");
    prevOnboardingStep.current = onboardingStep;
  }, [onboardingStep]);

  // Lock body scroll when any full-screen overlay is active (rest timer, complete anim).
  // We stash scrollY in a ref because React fires the previous cleanup BEFORE the new
  // effect body, which clears body.style.top before the unlock branch can read it —
  // that's what was causing the page to snap to the top after every rest period.
  const scrollLockY = useRef(0);
  useEffect(() => {
    const locked = rest.running || showCompleteAnim;
    if (locked) {
      scrollLockY.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollLockY.current}px`;
      document.body.style.width = "100%";
      document.body.style.overflowY = "scroll";
    } else {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
      if (scrollLockY.current > 0) {
        window.scrollTo(0, scrollLockY.current);
        scrollLockY.current = 0;
      }
    }
    return () => {
      // Only clear styles — leave scrollLockY intact so the next-render unlock branch
      // can restore the position correctly.
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflowY = "";
    };
  }, [rest.running, showCompleteAnim]);

  // Keep currentViewRef in sync so SW message handler always sees latest view
  useEffect(() => { currentViewRef.current = view; }, [view]);

  // Auto-advance after rest: stay on the current exercise while it still has
  // incomplete sets; otherwise expand the next incomplete exercise.
  const prevRestRunning = useRef(false);
  useEffect(() => {
    const wasRunning = prevRestRunning.current;
    prevRestRunning.current = rest.running;
    if (!wasRunning || rest.running) return;            // only on falling edge
    if (view !== "workout" || !activeDay || !started) return;
    const exs = activeDay.sections[0]?.exercises ?? [];
    if (expanded) {
      const cur = exs.find(e => e.id === expanded);
      if (cur && cur.trackable !== false && doneCount(cur.id, cur.sets) < cur.sets) return;
    }
    const startIdx = expanded ? exs.findIndex(e => e.id === expanded) + 1 : 0;
    for (let i = startIdx; i < exs.length; i++) {
      const e = exs[i];
      if (e.trackable !== false && doneCount(e.id, e.sets) < e.sets) {
        setExpanded(e.id);
        setWInput(""); setRInput(""); setIsSuggested(false);
        return;
      }
    }
  }, [rest.running, view, activeDay, started, expanded, log]);

  // 3D scroll tilt + hero parallax on home screen
  useEffect(() => {
    if (view !== "home") return;
    const apply = () => {
      const scrollY = window.scrollY;
      // Barbell image parallax — moves at 0.35× scroll speed
      if (heroImgRef.current) {
        heroImgRef.current.style.transform = `translateY(${scrollY * 0.35}px)`;
      }
      // Profile button fades as user scrolls into the image
      if (profileWrapperRef.current) {
        const progress = Math.min(1, Math.max(0, scrollY / 80));
        profileWrapperRef.current.style.opacity = String(1 - progress * 0.55);
      }
      // 3D card tilt
      const vh = window.innerHeight;
      const center = vh * 0.48;
      dayCardRefs.current.forEach(el => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const offset = (mid - center) / vh;
        const rotX = offset * 9;
        const scale = Math.max(0.91, 1 - Math.abs(offset) * 0.085);
        const opa = Math.max(0.5, 1 - Math.abs(offset) * 0.38);
        el.style.transform = `perspective(700px) rotateX(${rotX}deg) scale(${scale})`;
        el.style.opacity = String(opa);
      });
    };
    window.addEventListener("scroll", apply, { passive: true });
    const t = setTimeout(apply, 80);
    return () => { window.removeEventListener("scroll", apply); clearTimeout(t); };
  }, [view]);

  const softBeep = useCallback(() => {
    try {
      if (!msgAudioCtx.current) msgAudioCtx.current = new AudioContext();
      const ctx = msgAudioCtx.current;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 660;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.18);
    } catch {}
    try { navigator.vibrate?.([60]); } catch {}
  }, []);

  const stopTabFlash = useCallback(() => {
    if (tabFlashRef.current) {
      clearInterval(tabFlashRef.current);
      tabFlashRef.current = null;
    }
    document.title = "IRONLOG — Track. Lift. Progress.";
  }, []);

  const startTabFlash = useCallback(() => {
    if (tabFlashRef.current) return;
    let on = true;
    tabFlashRef.current = setInterval(() => {
      document.title = on ? "💬 New message" : "IRONLOG — Track. Lift. Progress.";
      on = !on;
    }, 900);
  }, []);

  // Stop tab flash when user opens messages
  useEffect(() => {
    if (view === "messages" || view === "conversation") stopTabFlash();
  }, [view, stopTabFlash]);

  // Listen for SW-forwarded push messages (app was focused so banner was suppressed)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "NEW_MESSAGE_PUSH") return;
      softBeep();
      if (currentViewRef.current !== "messages" && currentViewRef.current !== "conversation") {
        startTabFlash();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [softBeep, startTabFlash]);

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
        if (data.isEmail) { setShowEmailSignupPrompt(true); return; }
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
      if (typeof Notification !== "undefined" && Notification.permission === "default") setShowNotifBanner(true);
    } catch { setAuthError("Something went wrong"); }
  };

  const doSetup = async () => {
    if (passwordInput !== confirmInput) { setAuthError("Passwords don't match"); return; }
    setAuthError("");
    try {
      const data = await authPost({ action: "setup", username: nameInput.trim().toLowerCase(), email: emailInput.trim(), password: passwordInput });
      if (data.error) { setAuthError(data.error); return; }
      setUser({ id: data.id, username: data.username, role: data.role ?? "user" });
      if (typeof Notification !== "undefined" && Notification.permission === "default") setShowNotifBanner(true);
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
    // Remove this device's push subscription before clearing the session
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      }
    } catch {}
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
      return { id: ex.exerciseId, name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest, note: ex.notes ?? undefined, type: meta?.type ?? "compound", groupId: ex.groupId ?? undefined, groupType: ex.groupType ?? undefined, dropSets: ex.dropSets ?? 0 };
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

  const generateClientPlan = async () => {
    if (!activeClient) return;
    setTrainerGenerating(true);
    try {
      const res = await fetch(`/api/trainer/clients/${activeClient.id}/generate-plan`, { method: "POST" });
      const data = await res.json();
      if (data.days) {
        setEditedPlanDays(data.days);
        setEditingPlan(true);
        setProposalSent(false);
      }
    } catch {}
    setTrainerGenerating(false);
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
        // Goal reached detection
        const celebrations: {type: 'weight'|'bf'; target: number; value: number}[] = [];
        if (goalWeight && data.metric.weightKg != null) {
          const target = parseFloat(goalWeight);
          const val = data.metric.weightKg;
          const prevAtGoal = bodyMetrics.some(m => m.weightKg != null && Math.abs(m.weightKg - target) <= 1.0);
          if (!prevAtGoal && Math.abs(val - target) <= 1.0) {
            celebrations.push({ type: 'weight', target, value: val });
          }
        }
        if (goalBf && data.metric.bodyFatPct != null) {
          const target = parseFloat(goalBf);
          const val = data.metric.bodyFatPct;
          const prevAtGoal = bodyMetrics.some(m => m.bodyFatPct != null && Math.abs(m.bodyFatPct - target) <= 1.0);
          if (!prevAtGoal && Math.abs(val - target) <= 1.0) {
            celebrations.push({ type: 'bf', target, value: val });
          }
        }
        if (celebrations.length > 0) {
          setGoalCelebDetails(celebrations);
          setShowGoalCelebration(true);
        }
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
      if (data.partnerLastSeen !== undefined) setPartnerLastSeen(data.partnerLastSeen);
    } catch {}
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConversation || sendingMessage) return;
    setSendingMessage(true);
    const body = messageText.trim();
    const replyToId = replyingTo?.id ?? null;
    setMessageText("");
    setReplyingTo(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: activeConversation.id, body, replyToId }),
      });
      const data = await res.json();
      if (data.message) {
        setConversationMessages(prev => [...prev, data.message]);
        // Keep the conversation list preview in sync
        setConversations(prev => prev.map(c =>
          c.partner.id === activeConversation.id
            ? { ...c, latestMessage: data.message }
            : c
        ));
      }
    } catch { setMessageText(body); } // restore on failure
    setSendingMessage(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const myId = user!.id;
    // Optimistic update
    setConversationMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions: { emoji: string; userId: string }[] = m.reactions ?? [];
      const exists = reactions.some((r: any) => r.emoji === emoji && r.userId === myId);
      return {
        ...m,
        reactions: exists
          ? reactions.filter((r: any) => !(r.emoji === emoji && r.userId === myId))
          : [...reactions, { emoji, userId: myId }],
      };
    }));
    setReactingToMsgId(null);
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    }).catch(() => {});
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
      const profileBody = { ...ob, targetAreas: ob.targetAreas, equipment: ob.equipment.filter(e => e !== "multi_gym") };
      const profileRes = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileBody) });
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
    setRebuildMode(false);
    if (!ob.goals.every(g => g === "strength")) {
      setHiitIntensity("moderate");
      setShowHiitPrompt(true);
    }
  };

  const applyHiitChoice = async (pref: string, intensity: string) => {
    setHiitPreference(pref);
    setHiitIntensity(intensity);
    setShowHiitPrompt(false);
    if (pref === "none") return;
    try {
      await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hiitPreference: pref, hiitIntensity: intensity }) });
      const planRes = await fetch("/api/plan", { method: "POST" });
      const planData = await planRes.json();
      if (planData.plan?.days?.length) { setCustomPlan(planData.plan.days); setPlanNote(planData.planNote || ""); }
    } catch {}
  };

  const goTo = (v: string, dir: "forward" | "back" = "forward") => { setViewDir(dir); setView(v); };
  const goBack = () => goTo("home", "back");
  const shownPBs = useRef<Map<string, number>>(new Map());
  const openDay = (d: WorkoutDay) => { setActiveDay(d); goTo("workout"); setLog({}); setExpanded(null); setStarted(false); setWarmupDone({}); shownPBs.current.clear(); };
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

    // Build final log — fill in any expected sets that have no entry with skipped:true
    const finalLog: typeof log = { ...log };
    if (activeDay) {
      for (const sec of activeDay.sections) {
        for (const ex of sec.exercises) {
          if (ex.trackable === false) continue;
          for (let i = 1; i <= ex.sets; i++) {
            const k = `${ex.id}-${i}`;
            if (!(k in finalLog)) finalLog[k] = { weight: 0, reps: 0, skipped: true };
          }
        }
      }
    }

    // Detect new PBs before saving (compare session log against history)
    const detectedPBs: { id: string; name: string; weight: number; reps: number }[] = [];
    if (activeDay) {
      const exIds = Array.from(new Set(Object.keys(finalLog).map(k => parseSetKey(k).eid)));
      for (const eid of exIds) {
        const prevBest = overall.exercisePRs[eid]?.weight ?? 0;
        const sessionSets = Object.entries(finalLog)
          .filter(([k]) => parseSetKey(k).eid === eid)
          .map(([, v]) => v)
          .filter(v => !v.skipped);
        const sessionBest = sessionSets.reduce((b, s) => s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b, { weight: 0, reps: 0 });
        if (sessionBest.weight > 0 && sessionBest.weight > prevBest) {
          const exName = activeDay.sections.flatMap(s => s.exercises).find(e => e.id === eid)?.name ?? eid;
          detectedPBs.push({ id: eid, name: exName, weight: sessionBest.weight, reps: sessionBest.reps });
        }
      }
    }

    setShowCompleteAnim(true);

    if (activeDay) {
      try {
        await fetch("/api/workout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayId: activeDay.id, duration: adjustedDuration, sets: finalLog, intensityPoints: sessionIP }),
        });
        const res = await fetch("/api/workout");
        const data = await res.json();
        if (!data.error) setHistory(data);
      } catch {}
    }
    try { localStorage.removeItem("ironlog-session"); } catch {}

    completedSupersetGroups.current.clear();
    completedDropExes.current.clear();

    setTimeout(() => {
      setShowCompleteAnim(false);
      const unshownPBs = detectedPBs.filter(pb => pb.weight > (shownPBs.current.get(pb.id) ?? 0));
      if (unshownPBs.length > 0) {
        setNewPBs(unshownPBs);
        setTimeout(() => setNewPBs([]), 2400);
      }
      goBack();
      setActiveDay(null); setLog({}); setStarted(false); setSessionIP(0);
    }, 1400);
  };

  const openEditModal = (eid: string) => {
    const sets: Record<string, { weight: number; reps: number; skipped?: boolean }> = {};
    for (const [k, v] of Object.entries(log)) {
      if (k.startsWith(eid + "-")) sets[k] = { ...v };
    }
    setEditSets(sets);
    setEditEx(eid);
  };

  const saveEditSets = () => {
    // Remove any keys for this exercise that aren't in editSets (deleted)
    const newLog: typeof log = {};
    for (const [k, v] of Object.entries(log)) {
      if (editEx && k.startsWith(editEx + "-") && !(k in editSets)) continue;
      newLog[k] = v;
    }
    for (const [k, v] of Object.entries(editSets)) newLog[k] = v;
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

  const logSet = (eid: string, sn: number, w: string, r: string, dropNum?: number) => {
    const key = typeof dropNum === "number" && dropNum > 0 ? `${eid}-${sn}-d${dropNum}` : `${eid}-${sn}`;
    const newLog = { ...log, [key]: { weight: parseFloat(w) || 0, reps: parseInt(r) || 0 } };
    setLog(newLog);
    try {
      const saved = localStorage.getItem("ironlog-session");
      if (saved) { const s = JSON.parse(saved); s.log = newLog; localStorage.setItem("ironlog-session", JSON.stringify(s)); }
    } catch {}
  };

  const awardIP = (pts: number, icon: string, label: string) => {
    setSessionIP(prev => {
      const awarded = Math.min(pts, SESSION_IP_CAP - prev);
      if (awarded <= 0) return prev;
      if (ipToastTimer.current) clearTimeout(ipToastTimer.current);
      setIpToast({ msg: `+${awarded} IP · ${label}`, icon });
      ipToastTimer.current = setTimeout(() => setIpToast(null), 2500);
      return prev + awarded;
    });
  };

  const doneCount = (eid: string, total: number) => {
    let c = 0; for (let i = 1; i <= total; i++) if (log[`${eid}-${i}`]) c++; return c;
  };
  const nextSetNum = (eid: string, total: number) => {
    for (let i = 1; i <= total; i++) if (!log[`${eid}-${i}`]) return i; return null;
  };
  const lastSessionBest = (eid: string) => {
    if (!activeDay) return { weight: 0, reps: 0 };
    // Find the most recent session that actually contains this exercise.
    // Look across all logged days, not just activeDay.id, so duplicate
    // exercises in multiple plan days carry their history.
    const allSessions = Object.values(history).flat().sort((a: any, b: any) => (b.date + b.time).localeCompare(a.date + a.time));
    for (const s of allSessions) {
      const sets = (s as any).sets as Record<string, { weight: number; reps: number }>;
      let best: { weight: number; reps: number } | null = null;
      for (const sk in sets) {
        if (parseSetKey(sk).eid !== eid) continue;
        const v = sets[sk];
        if (!best || v.weight > best.weight || (v.weight === best.weight && v.reps > best.reps)) best = v;
      }
      if (best) return best;
    }
    return { weight: 0, reps: 0 };
  };

  const overall = useMemo(() => getOverallStats(history), [history]);
  const bc: Record<string, string> = { compound: "#2ecc71", isolation: "#74b9ff", cardio: "#FF6B6B" };

  const sessionExSuggestions = useMemo(() => {
    if (!activeDay) return [];
    const currentMuscles = new Set<string>();
    const currentIds = new Set<string>();
    for (const sec of activeDay.sections) {
      for (const ex of sec.exercises) {
        currentIds.add(ex.id);
        const libEx = (EXERCISES as any[]).find((e: any) => e.id === ex.id || e.name.toLowerCase() === ex.name.toLowerCase());
        if (libEx) {
          for (const m of (libEx.muscles ?? [])) currentMuscles.add((m as string).toLowerCase());
        }
      }
    }
    const userEquip = new Set<string>((ob.equipment ?? []).map((e: string) => e.toLowerCase()));
    type Scored = { ex: any; score: number };
    const scored: Scored[] = [];
    for (const libEx of (EXERCISES as any[])) {
      if (currentIds.has(libEx.id)) continue;
      const exEquip = (libEx.equipment ?? []) as string[];
      const equipOk = exEquip.length === 0 || exEquip.every((eq: string) => userEquip.has(eq.toLowerCase()) || userEquip.size === 0);
      if (!equipOk) continue;
      const exMuscles = ((libEx.muscles ?? []) as string[]).map((m: string) => m.toLowerCase());
      const overlap = exMuscles.filter((m: string) => currentMuscles.has(m)).length;
      if (overlap === 0) continue;
      scored.push({ ex: libEx, score: overlap });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 12).map(s => s.ex);
  }, [activeDay, ob.equipment, showSessionExBrowser]);

  const EQUIPMENT_OPTIONS = [
    { id: "dumbbell",        label: "Dumbbells",                gym: true,  home: true  },
    { id: "barbell",         label: "Barbell",                  gym: true,  home: false },
    { id: "cable",           label: "Cable Machine",            gym: true,  home: false },
    { id: "machine",         label: "Weight Machines",          gym: true,  home: false },
    { id: "bench",           label: "Bench / Rack",             gym: true,  home: true  },
    { id: "pullup_bar",      label: "Pull-Up Bar",              gym: true,  home: true  },
    { id: "dip_bar",         label: "Dip Bars",                 gym: true,  home: true  },
    { id: "kettlebell",      label: "Kettlebell",               gym: true,  home: true  },
    { id: "resistance_band", label: "Resistance Bands",         gym: false, home: true  },
    { id: "smith_machine",   label: "Smith Machine",            gym: true,  home: false },
    { id: "treadmill",       label: "Treadmill",                gym: false, home: true  },
    { id: "elliptical",      label: "Elliptical / Stationary Bike", gym: false, home: true },
    { id: "multi_gym",       label: "Multi-Gym / Home Station", gym: false, home: true, subOptions: [
      { id: "cable",      label: "Cable / Pulley Station" },
      { id: "machine",    label: "Weight Stations (chest · shoulder · leg)" },
      { id: "pullup_bar", label: "Pull-Up / Lat Station" },
      { id: "dip_bar",    label: "Dip Station" },
    ]},
  ];
  const toggleEquip = (id: string) => setOb(o => ({ ...o, equipment: o.equipment.includes(id) ? o.equipment.filter(e => e !== id) : [...o.equipment, id] }));

  // ─── LOADING ────────────────────────────────────────────────────────
  if (authLoading || !splashDone) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", position: "relative", overflow: "hidden", background: "#09090f" }}>
      {/* Background gym image — very dark */}
      <img src="/ai/home-hero.jpg" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.13, filter: "blur(3px) saturate(0.6)", pointerEvents: "none", zIndex: 0 }} />
      {/* Vignette overlay */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 30%, rgba(9,9,15,0.85) 100%)", pointerEvents: "none", zIndex: 0 }} />
      {/* Single ambient glow */}
      <div style={{ position: "absolute", top: "42%", left: "50%", transform: "translate(-50%,-50%)", width: "70vw", height: "70vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.1) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ textAlign: "center", zIndex: 1 }}>
        {/* BarbellMark */}
        <div style={{ marginBottom: 18, animation: "fadeIn 0.4s ease both" }}>
          <BarbellMark width={210} delay={0.05} loop={7000} />
        </div>
        {/* Logo + one-shot impact effects */}
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* Impact glow — fires once when logo lands */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "90vw", height: "90vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.2) 0%, transparent 60%)", animation: "impactGlow 1.5s ease-out 0.85s both", pointerEvents: "none" }} />
          {/* Shockwave ring 1 */}
          <div style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: "50%", border: "2px solid rgba(255,107,107,0.8)", animation: "shockwave 1s cubic-bezier(0.1,0.6,0.2,1) 0.85s both", pointerEvents: "none" }} />
          {/* Shockwave ring 2 */}
          <div style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: "50%", border: "1px solid rgba(255,107,107,0.4)", animation: "shockwave 1.4s cubic-bezier(0.1,0.6,0.2,1) 1.05s both", pointerEvents: "none" }} />
          {/* Logo */}
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 68, fontWeight: 700, letterSpacing: 12, overflow: "visible", lineHeight: 1.1, position: "relative" }}>
            <span className="logo-iron" style={{ color: "#fff" }}>IRON</span><span className="logo-log" style={{ color: "#FF6B6B" }}>LOG</span>
          </div>
        </div>
        {/* Floor beam */}
        <div style={{ width: 260, height: 1, margin: "8px auto 0", background: "linear-gradient(90deg, transparent, rgba(255,107,107,0.9), transparent)", animation: "floorBeam 1.3s ease-out 0.85s both" }} />
        {/* Tagline */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: 7, fontWeight: 400, marginTop: 20, marginBottom: 56, animation: "fadeIn 0.5s ease 1.25s both", fontFamily: "'Space Mono', monospace" }}>LIFT · TRACK · PROGRESS</div>
        {/* Loading bar */}
        <div style={{ width: 160, height: 1.5, borderRadius: 2, background: "linear-gradient(90deg, transparent, rgba(255,107,107,0.6), transparent)", backgroundSize: "200% 100%", animation: "shimmer 1.4s linear infinite", margin: "0 auto" }} />
      </div>
    </div>
  );

  // ─── LOGIN ──────────────────────────────────────────────────────────
  if (!user) {
    const inputStyle: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", padding: "14px 20px", width: "100%", maxWidth: 300, textAlign: "left" as const, outline: "none", display: "block", boxSizing: "border-box" as const, margin: "0 auto" };
    const inputStyleCenter: React.CSSProperties = { ...inputStyle, textAlign: "center" as const };
    const btnPrimary: React.CSSProperties = { display: "block", width: "100%", maxWidth: 300, margin: "16px auto 0", padding: "15px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
    const btnBack: React.CSSProperties = { background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16 };

    // ── Landing page (username step) ──────────────────────────────────
    if (authStep === "username") {
      const isTrainer = landingTab === "trainer";
      const accentColor = isTrainer ? "#4ECDC4" : "#FF6B6B";
      const features = isTrainer ? [
        { title: "Full client roster", desc: "Manage all your athletes from one screen" },
        { title: "Plan builder", desc: "Generate, customise, and propose personalised training plans" },
        { title: "Session history", desc: "Review every set your clients have logged" },
        { title: "Direct messaging", desc: "Built-in chat with delivery and read receipts" },
      ] : [
        { title: "Personalised training plan", desc: "Built for your goals, equipment, and schedule" },
        { title: "Set-by-set logging", desc: "Weight, reps, rest timer, and live personal best detection" },
        { title: "Progress analytics", desc: "Strength trends, 28-day streaks, and body metric tracking" },
        { title: "Trainer connection", desc: "Receive custom plans and message your coach in-app" },
      ];

      return (
        <div style={{ minHeight: "100dvh", position: "relative", overflowY: "auto" }}>
          <div style={{ position: "fixed", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

          {/* Sticky header with tab pills */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "12px 20px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", background: "rgba(10,10,15,0.88)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>
              <span style={{ color: "#fff" }}>IRON</span><span style={{ color: "#FF6B6B" }}>LOG</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setLandingTab("athlete")} style={{ padding: "7px 14px", borderRadius: 20, border: isTrainer ? "1px solid rgba(255,255,255,0.1)" : "none", background: isTrainer ? "transparent" : "linear-gradient(135deg,#FF6B6B,#ee5a24)", color: isTrainer ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>ATHLETES</button>
              <button onClick={() => setLandingTab("trainer")} style={{ padding: "7px 14px", borderRadius: 20, border: isTrainer ? "none" : "1px solid rgba(255,255,255,0.1)", background: isTrainer ? "linear-gradient(135deg,#4ECDC4,#26a69a)" : "transparent", color: isTrainer ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>TRAINERS</button>
            </div>
          </div>

          {/* Hero */}
          <div style={{ textAlign: "center", padding: "52px 32px 28px", zIndex: 1, position: "relative" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 44, fontWeight: 700, letterSpacing: 8, marginBottom: 6, lineHeight: 1, overflow: "visible" }}>
              <span className="logo-iron" style={{ color: "#fff" }}>IRON</span><span className="logo-log" style={{ color: "#FF6B6B" }}>LOG</span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 6, fontWeight: 300, marginBottom: 20 }}>LIFT · TRACK · PROGRESS</div>
            <div style={{ minHeight: 18 }}>
              <div key={phraseIdx} className={phraseVisible ? "phrase-in" : "phrase-out"} style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontStyle: "italic", fontFamily: "'DM Sans', sans-serif" }}>{phrase}</div>
            </div>
          </div>

          {/* Feature cards */}
          <div style={{ padding: "8px 24px 32px", maxWidth: 420, margin: "0 auto", zIndex: 1, position: "relative" }}>
            <div style={{ fontSize: 10, color: accentColor, letterSpacing: 3, fontWeight: 700, textAlign: "center", marginBottom: 16, opacity: 0.85 }}>
              {isTrainer ? "BUILT FOR TRAINERS" : "BUILT FOR ATHLETES"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {features.map((f, i) => (
                <div key={i} className="tilt-3d-item" style={{ padding: "13px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, borderLeft: `2px solid ${accentColor}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA — username input */}
          <div style={{ padding: "0 24px 60px", maxWidth: 420, margin: "0 auto", textAlign: "center", zIndex: 1, position: "relative" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginBottom: 16, letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>No subscription. No ads. Just your lifts.</div>
            <input value={nameInput} onChange={e => { setNameInput(e.target.value); setShowEmailSignupPrompt(false); }} onKeyDown={e => e.key === "Enter" && doCheckUsername()} placeholder="Username or email" autoFocus name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" style={{ ...inputStyleCenter, maxWidth: "100%" }} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            {showEmailSignupPrompt && (
              <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>No account found for <strong style={{ color: "#fff" }}>{nameInput}</strong>. Create one?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEmailInput(nameInput); setNameInput(""); setShowEmailSignupPrompt(false); setAuthStep("register"); }} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#FF6B6B,#ee5a24)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sign Up</button>
                  <button onClick={() => { setShowEmailSignupPrompt(false); setNameInput(""); setAuthError(""); }} style={{ padding: "11px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>Back</button>
                </div>
              </div>
            )}
            {!showEmailSignupPrompt && <button onClick={doCheckUsername} style={{ ...btnPrimary, maxWidth: "100%" }}>CONTINUE</button>}
          </div>
        </div>
      );
    }

    // ── Other auth steps — centered card ─────────────────────────────
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 32, position: "relative", overflow: "hidden" }}>
        <img src="/ai/login-bg.jpg" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom", opacity: 0.35, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="slide-up" style={{ textAlign: "center", zIndex: 1, width: "100%", maxWidth: 340 }}>
          <BarbellMark width={260} delay={0.05} loop={7000} />
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, letterSpacing: 8, marginBottom: 4, overflow: "visible" }}>
            <span className="logo-iron" style={{ color: "#fff" }}>IRON</span><span className="logo-log" style={{ color: "#FF6B6B" }}>LOG</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 6, fontWeight: 300, marginBottom: 32 }}>LIFT · TRACK · PROGRESS</div>

          {/* ── Step: register (new user) ── */}
          {authStep === "register" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Create your account</div>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Choose a username" autoFocus name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ ...inputStyle, marginBottom: 8 }} />
            {emailInput ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px", marginBottom: 8, textAlign: "left" }}>
                Email: <span style={{ color: "rgba(255,255,255,0.7)" }}>{emailInput}</span>
              </div>
            ) : (
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Email" type="email" name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" style={{ ...inputStyle, marginBottom: 8 }} />
            )}
            <PasswordInput value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Password" autoComplete="new-password" name="new-password" style={{ ...inputStyle, marginBottom: 8 }} />
            <PasswordInput value={confirmInput} onChange={e => setConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doRegister()} placeholder="Confirm password" autoComplete="new-password" name="confirm-password" style={inputStyle} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doRegister} style={btnPrimary}>CREATE ACCOUNT</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); setEmailInput(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: setup (existing user, no password yet) ── */}
          {authStep === "setup" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Welcome back, <strong style={{ color: "#fff" }}>{nameInput}</strong></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>Set up a password to secure your account</div>
            <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Your email" type="email" name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" style={{ ...inputStyle, marginBottom: 8 }} />
            <PasswordInput value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="New password" autoComplete="new-password" name="new-password" style={{ ...inputStyle, marginBottom: 8 }} />
            <PasswordInput value={confirmInput} onChange={e => setConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doSetup()} placeholder="Confirm password" autoComplete="new-password" name="confirm-password" style={inputStyle} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doSetup} style={btnPrimary}>SET PASSWORD</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: password (login) ── */}
          {authStep === "password" && (<>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Welcome back, <strong style={{ color: "#fff" }}>{nameInput}</strong></div>
            <PasswordInput value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="Password" autoFocus style={{ ...inputStyle, marginBottom: 4 }} />
            {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
            <button onClick={doLogin} style={btnPrimary}>LOG IN</button>
            <button onClick={() => { setAuthStep("forgot"); setEmailInput(""); setAuthError(""); setForgotSent(false); }} style={{ ...btnBack, display: "block", width: "100%" }}>Forgot password?</button>
            <button onClick={() => { setAuthStep("username"); setAuthError(""); setPasswordInput(""); }} style={btnBack}>← Back</button>
          </>)}

          {/* ── Step: forgot password ── */}
          {authStep === "forgot" && (<>
            {!forgotSent ? (<>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>Enter your email to receive a temporary password</div>
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doForgot()} placeholder="Your email" type="email" autoFocus name="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" style={inputStyle} />
              {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
              <button onClick={doForgot} style={btnPrimary}>SEND RESET EMAIL</button>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10, lineHeight: 1.5, textAlign: "center" }}>
                If the email is registered you'll receive a temporary password within a minute. If nothing arrives after 5 min check spam, then contact support.
              </div>
            </>) : (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                Check your email for a temporary password, then log in to set a new one. If nothing arrives, check your spam folder.
              </div>
            )}
            <button onClick={() => {
              // Carry the email the user typed for password reset across to the
              // login screen so they're not stuck logging in as the previous
              // (different) username they last tried. Login already accepts
              // username OR email so an email value works here.
              if (emailInput.trim()) setNameInput(emailInput.trim());
              setAuthStep("password"); setForgotSent(false); setAuthError("");
            }} style={btnBack}>← Back to login</button>
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-30%", left: "-20%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-20%", width: "50vw", height: "50vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="slide-up" style={{ textAlign: "center", zIndex: 1, width: "100%", maxWidth: 340 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "#fff", marginBottom: 4 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 6, fontWeight: 300, marginBottom: 48 }}>LIFT · TRACK · PROGRESS</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Welcome, <strong style={{ color: "#fff" }}>{user.username}</strong></div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>Set a new password to continue</div>
          <PasswordInput value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} placeholder="New password" autoFocus autoComplete="new-password" name="new-password" style={{ ...inputStyle, marginBottom: 8 }} />
          <PasswordInput value={newConfirmInput} onChange={e => setNewConfirmInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doResetPassword()} placeholder="Confirm password" autoComplete="new-password" name="confirm-password" style={inputStyle} />
          {authError && <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{authError}</div>}
          <button onClick={doResetPassword} style={btnPrimary}>SET PASSWORD</button>
          <button onClick={doLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 16 }}>Log out</button>
        </div>
      </div>
    );
  }

  // ─── ONBOARDING ─────────────────────────────────────────────────────
  if (showOnboarding) {
    const STEPS = rebuildMode ? 6 : 8;
    const progress = Math.round(((onboardingStep - (rebuildMode ? 2 : 0)) / STEPS) * 100);
    const obInput: React.CSSProperties = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", padding: "14px 20px", width: "100%", outline: "none", boxSizing: "border-box" as const };
    const obBtn: React.CSSProperties = { display: "block", width: "100%", marginTop: 24, padding: "15px", background: "linear-gradient(135deg, #FF6B6B, #ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" };
    const obSkip: React.CSSProperties = { background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 14, display: "block", width: "100%" };
    const selCard = (active: boolean): React.CSSProperties => ({ padding: "16px 20px", borderRadius: 12, border: `1px solid ${active ? "#FF6B6B" : "rgba(255,255,255,0.08)"}`, background: active ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)", cursor: "pointer", marginBottom: 10, transition: "all 0.15s" });
    const obAnimClass = obDir === "forward" ? "ob-forward" : "ob-back";

    const canNext = () => {
      if (rebuildMode && (onboardingStep === 1 || onboardingStep === 2)) return true;
      if (onboardingStep === 0) return true;
      if (onboardingStep === 1) return !!ob.dob && !!ob.gender;
      if (onboardingStep === 2) return !!ob.heightCm && !!ob.weightKg;
      if (onboardingStep === 3) return ob.goals.length > 0;
      if (onboardingStep === 4) return true;
      if (onboardingStep === 5) return !!ob.fitnessLevel;
      if (onboardingStep === 6) return !!ob.location;
      return true;
    };
    const toggleTargetArea = (id: string) => {
      setOb(o => {
        if (id === "none") return { ...o, targetAreas: o.targetAreas.includes("none") ? [] : ["none"] };
        const without = o.targetAreas.filter(x => x !== "none" && x !== id);
        return { ...o, targetAreas: o.targetAreas.includes(id) ? without : [...without, id] };
      });
    };

    if (generatingPlan) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: 32 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 32 }}>BUILDING YOUR PLAN</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: "#FF6B6B", marginBottom: 16 }}>IRON<span style={{ color: "#fff" }}>LOG</span></div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.7 }}>Analysing your goals and selecting the best exercises for you...</div>
      </div>
    );

    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", padding: "48px 24px 0", paddingBottom: safeBot }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 40 }}>
          <div className="bar-grow" style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #FF6B6B, #ee5a24)", borderRadius: 2 }} />
        </div>

        {/* Step 0: Welcome */}
        {onboardingStep === 0 && (
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ position: "relative", margin: "-12px -20px 24px", borderRadius: 16, overflow: "hidden", aspectRatio: "2 / 3", maxHeight: 360 }}>
              <img
                src="/ai/onboarding-welcome.jpg"
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,15,0.45) 0%, rgba(10,10,15,0) 35%, rgba(10,10,15,0) 55%, rgba(10,10,15,0.98) 100%)" }} />
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 8 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Let's build your plan.</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 32 }}>Answer a few quick questions and we'll put together a personalised workout programme designed around your goals, schedule, and equipment.</div>
            <button onClick={() => setOnboardingStep(1)} style={obBtn}>GET STARTED</button>
            <button onClick={() => setShowOnboarding(false)} style={obSkip}>Skip — use default plan</button>
          </div>
        )}

        {/* Step 1: DOB + gender */}
        {onboardingStep === 1 && (
          <div key={onboardingStep} className={obAnimClass}>
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
          <div key={onboardingStep} className={obAnimClass}>
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
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>YOUR GOALS</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>What are you training for?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 24 }}>Select all that apply — your plan will blend them.</div>
            {[
              { id: "muscle",   label: "Build Muscle",     desc: "Hypertrophy-focused training with progressive overload",       img: "/ai/goal-muscle.jpg" },
              { id: "strength", label: "Get Stronger",     desc: "Heavy compound lifts, low reps, long rest",                    img: "/ai/goal-stronger.jpg" },
              { id: "fat_loss", label: "Lose Fat",         desc: "Higher volume, cardio finishers, calorie-burning focus",       img: "/ai/goal-fat.jpg" },
              { id: "fitness",  label: "General Fitness",  desc: "Balanced training to improve overall health and conditioning", img: "/ai/goal-fitness.jpg" },
              { id: "maintain", label: "Maintain & Recomp", desc: "Hold your current weight while improving body composition", img: "/ai/goal-fitness.jpg" },
            ].map(g => {
              const sel = ob.goals.includes(g.id);
              return (
                <div key={g.id} style={{ ...selCard(sel), display: "flex", alignItems: "center", gap: 14 }} onClick={() => setOb(o => { const isSel = o.goals.includes(g.id); return { ...o, goals: isSel ? o.goals.filter(x => x !== g.id) : [...o.goals, g.id] }; })}>
                  <img src={g.img} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0, boxShadow: sel ? "0 0 0 1px rgba(255,107,107,0.5)" : "0 0 0 1px rgba(255,255,255,0.06)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ color: sel ? "#FF6B6B" : "#fff", fontWeight: 600 }}>{g.label}</div>
                      {sel && <div style={{ color: "#FF6B6B", fontSize: 14 }}>✓</div>}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{g.desc}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              <span style={{ color: "#FFD166", fontWeight: 600 }}>💡 Pro tip:</span> Set a 4–8 week target rather than a distant goal — smaller milestones hit faster keep motivation high.
            </div>
            <button onClick={() => setOnboardingStep(4)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(2)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 4: Target Area */}
        {onboardingStep === 4 && (
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>FOCUS</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Any specific focus area?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Select all that apply — we'll add extra work for your priority muscle groups, or adjust the plan for rehabilitation.</div>

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
              <div key={t.id} style={selCard(ob.targetAreas.includes(t.id))} onClick={() => toggleTargetArea(t.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ color: ob.targetAreas.includes(t.id) ? "#FF6B6B" : "#fff", fontWeight: 600 }}>{t.label}</div>
                  {ob.targetAreas.includes(t.id) && <div style={{ color: "#FF6B6B", fontSize: 14 }}>✓</div>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.desc}</div>
              </div>
            ))}

            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 3, marginBottom: 10, marginTop: 20 }}>REHABILITATION</div>
            {[
              { id: "rehab_knee",        label: "Rehab — Knee",        desc: "Low-impact, knee-friendly movements with controlled loading" },
              { id: "rehab_shoulder",    label: "Rehab — Shoulder",    desc: "Shoulder-safe modifications, rotator cuff and mobility work" },
              { id: "rehab_lower_back",  label: "Rehab — Lower Back",  desc: "Protect the spine — avoid heavy loading, core stability focus" },
            ].map(t => (
              <div key={t.id} style={selCard(ob.targetAreas.includes(t.id))} onClick={() => toggleTargetArea(t.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ color: ob.targetAreas.includes(t.id) ? "#FF6B6B" : "#fff", fontWeight: 600 }}>{t.label}</div>
                  {ob.targetAreas.includes(t.id) && <div style={{ color: "#FF6B6B", fontSize: 14 }}>✓</div>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{t.desc}</div>
              </div>
            ))}

            <button onClick={() => setOnboardingStep(5)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(3)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 5: Experience */}
        {onboardingStep === 5 && (
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>EXPERIENCE</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>How long have you been training?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 28 }}>This helps us set the right volume and exercise selection.</div>
            {[
              { id: "newcomer", label: "Brand new — never done this before", desc: "We'll keep things simple and safe while you build the habit" },
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
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>SETUP</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 28 }}>Where do you train?</div>
            {[
              { id: "gym",  label: "Gym",  desc: "Full access to barbells, cables, machines", img: "/ai/location-gym.jpg" },
              { id: "home", label: "Home", desc: "I train at home with my own equipment",     img: "/ai/location-home.jpg" },
              { id: "both", label: "Both", desc: "Mix of gym and home sessions",               img: "/ai/location-both.jpg" },
            ].map(l => {
              const active = ob.location === l.id;
              return (
                <div key={l.id} style={{ ...selCard(active), padding: 0, overflow: "hidden", position: "relative" }} onClick={() => setOb(o => ({ ...o, location: l.id, equipment: (l.id === "gym" || l.id === "both") ? ["barbell","dumbbell","cable","machine","bench","pullup_bar","dip_bar","kettlebell","smith_machine"] : [] }))}>
                  <div style={{ position: "relative", aspectRatio: "21 / 9" }}>
                    <img src={l.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: active ? 0.8 : 0.55 }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(10,10,15,0.85) 0%, rgba(10,10,15,0.3) 60%, rgba(10,10,15,0) 100%)" }} />
                    <div style={{ position: "absolute", inset: 0, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ color: active ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 2 }}>{l.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{l.desc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setOnboardingStep(7)} disabled={!canNext()} style={{ ...obBtn, opacity: canNext() ? 1 : 0.4 }}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(5)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 7: Equipment */}
        {onboardingStep === 7 && (
          <div key={onboardingStep} className={obAnimClass}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>EQUIPMENT</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
              {ob.location === "gym" ? "What does your gym have?" : ob.location === "home" ? "What do you have at home?" : "What equipment do you have access to?"}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
              {ob.location === "gym" ? "All standard equipment is pre-selected — untick anything your gym doesn't have." : ob.location === "home" ? "Select everything available to you." : "Include gym equipment above and home equipment below."}
            </div>
            {EQUIPMENT_OPTIONS
              .filter((e: any) => ob.location === "gym" ? e.gym : ob.location === "home" ? e.home : true)
              .map((e: any) => (
                <div key={e.id}>
                  <div style={selCard(ob.equipment.includes(e.id))} onClick={() => toggleEquip(e.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ color: ob.equipment.includes(e.id) ? "#FF6B6B" : "#fff", fontWeight: 500 }}>{e.label}</div>
                      {e.subOptions
                        ? <div style={{ fontSize: 11, color: ob.equipment.includes(e.id) ? "#FF6B6B" : "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>{ob.equipment.includes(e.id) ? "▲ CONFIGURE" : "▼ EXPAND"}</div>
                        : ob.equipment.includes(e.id) ? <div style={{ color: "#FF6B6B", fontSize: 16 }}>✓</div> : null
                      }
                    </div>
                    {e.subOptions && !ob.equipment.includes(e.id) && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Tap to configure included stations</div>
                    )}
                  </div>
                  {e.subOptions && ob.equipment.includes(e.id) && (
                    <div style={{ marginLeft: 16, marginBottom: 8 }}>
                      {e.subOptions.map((sub: any) => (
                        <div key={sub.id} style={{ ...selCard(ob.equipment.includes(sub.id)), marginBottom: 6 }} onClick={() => toggleEquip(sub.id)}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: ob.equipment.includes(sub.id) ? "#FF6B6B" : "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: 13 }}>{sub.label}</div>
                            {ob.equipment.includes(sub.id) && <div style={{ color: "#FF6B6B", fontSize: 16 }}>✓</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            <button onClick={() => setOnboardingStep(8)} style={obBtn}>CONTINUE</button>
            <button onClick={() => setOnboardingStep(6)} style={obSkip}>← Back</button>
          </div>
        )}

        {/* Step 8: Days per week */}
        {onboardingStep === 8 && (
          <div key={onboardingStep} className={obAnimClass}>
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
            <button onClick={() => setOnboardingStep(7)} style={obSkip}>← Back</button>
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
        <div key="customise" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button onClick={() => { setEditingDay(null); setShowExBrowser(false); setExSearch(""); setSuperSelection([]); setCustomMultiMode(false); setBrowserSupersetMode(false); setBrowserSuperSel([]); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#FF6B6B", letterSpacing: 3, flex: 1 }}>EDITING</div>
            {!showExBrowser && (
              <button onClick={() => { setCustomMultiMode(m => !m); setSuperSelection([]); }} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${customMultiMode ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.1)"}`, background: customMultiMode ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.04)", color: customMultiMode ? "#FF6B6B" : "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                {customMultiMode ? "CANCEL" : "SELECT"}
              </button>
            )}
          </div>
          <div style={{ padding: "0 20px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{editingDay.title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>{editingDay.focus}</div>

            {exs.map((ex: any, i: number) => {
              const exKey = ex.exerciseId ?? ex.id ?? String(i);
              const isSel = superSelection.includes(exKey);
              const inGroup = !!ex.groupId;
              const isDropSet = ex.rest === 0;
              return (
              <div key={ex.id ?? i} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? "rgba(255,107,107,0.4)" : inGroup ? "rgba(255,230,109,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {customMultiMode && (
                    <button onClick={() => setSuperSelection(s => s.includes(exKey) ? s.filter(id => id !== exKey) : [...s, exKey])} style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isSel ? "#FF6B6B" : "rgba(255,255,255,0.18)"}`, background: isSel ? "#FF6B6B" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", transition: "all 0.15s" }}>{isSel ? "✓" : ""}</button>
                  )}
                  {/* Thumbnail — click to preview form */}
                  {(() => {
                    const tu = getExerciseImageUrls(ex.exerciseId ?? ex.id, ex.name);
                    return (
                      <div onClick={() => { const m = lookupExMuscles(ex.name); setFormPreview({ id: ex.exerciseId ?? ex.id, name: ex.name, ...m }); }} style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0, cursor: "pointer", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {tu ? <img src={tu[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/> : <span style={{ fontSize: 13, opacity: 0.55, lineHeight: 1 }}>💪</span>}
                      </div>
                    );
                  })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</div>
                      {inGroup && <span style={{ fontSize: 8, color: "#FFE66D", fontFamily: "'Space Mono', monospace", letterSpacing: 1, background: "rgba(255,230,109,0.12)", border: "1px solid rgba(255,230,109,0.25)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>SUPER</span>}
                      {isDropSet && <span style={{ fontSize: 8, color: "#FF6B6B", fontFamily: "'Space Mono', monospace", letterSpacing: 1, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>DROP</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace", marginTop: 3 }}>{ex.sets} × {ex.reps}</div>
                  </div>
                  {!customMultiMode && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={async () => { const moved = moveExercise(exs, i, i - 1); if (i > 0) await saveDay(editingDay, moved); }} disabled={i === 0} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, color: i === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", width: 28, height: 28, cursor: i === 0 ? "default" : "pointer", fontSize: 14 }}>↑</button>
                      <button onClick={async () => { const moved = moveExercise(exs, i, i + 1); if (i < exs.length - 1) await saveDay(editingDay, moved); }} disabled={i === exs.length - 1} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, color: i === exs.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)", width: 28, height: 28, cursor: i === exs.length - 1 ? "default" : "pointer", fontSize: 14 }}>↓</button>
                      <button onClick={async () => { const updated = exs.filter((_: any, j: number) => j !== i); await saveDay(editingDay, updated); }} style={{ background: "rgba(255,107,107,0.1)", border: "none", borderRadius: 6, color: "#FF6B6B", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  )}
                </div>
                {!customMultiMode && (() => {
                  const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 180];
                  const restChips = REST_PRESETS.includes(ex.rest) ? REST_PRESETS : [...REST_PRESETS, ex.rest].sort((a, b) => a - b);
                  return (
                    <div style={{ display: "flex", gap: 5, marginTop: 10, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginRight: 2, flexShrink: 0 }}>REST</span>
                      {restChips.map(s => {
                        const active = ex.rest === s;
                        return <button key={s} onClick={async () => { const updated = exs.map((x: any, j: number) => j === i ? { ...x, rest: s } : x); await saveDay(editingDay, updated); }} style={{ padding: "3px 8px", borderRadius: 12, fontSize: 10, background: active ? "rgba(255,107,107,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(255,107,107,0.45)" : "rgba(255,255,255,0.08)"}`, color: active ? "#FF6B6B" : "rgba(255,255,255,0.28)", cursor: "pointer", fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{s === 0 ? "DROP SET" : `${s}s`}</button>;
                      })}
                    </div>
                  );
                })()}
                {!customMultiMode && inGroup && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={async () => {
                      const gid = ex.groupId;
                      const updated = exs.map((x: any) => x.groupId === gid ? { ...x, groupId: undefined, groupType: undefined } : x);
                      await saveDay(editingDay, updated);
                    }} style={{ padding: "3px 10px", borderRadius: 10, fontSize: 9, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.3)", color: "#FFE66D" }}>UNGROUP ×</button>
                  </div>
                )}
              </div>
              );
            })}

            {/* Multi-select action bar */}
            {customMultiMode && (
              <div style={{ background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {superSelection.length === 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif", width: "100%", textAlign: "center" }}>Tap exercises above to select them</div>
                )}
                {superSelection.length > 0 && (
                  <>
                    <button onClick={async () => {
                      const selSet = new Set(superSelection);
                      const updated = exs.filter((e: any, idx: number) => !selSet.has(e.exerciseId ?? e.id ?? String(idx)));
                      await saveDay(editingDay, updated);
                      setSuperSelection([]); setCustomMultiMode(false);
                    }} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.35)", borderRadius: 10, color: "#FF6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                      DELETE ({superSelection.length})
                    </button>
                    {superSelection.length >= 2 && (
                      <button onClick={async () => {
                        const gid = Math.random().toString(36).slice(2);
                        const selSet = new Set(superSelection);
                        const selIdx = exs.map((e: any, idx: number) => selSet.has(e.exerciseId ?? e.id ?? String(idx)) ? idx : -1).filter((idx: number) => idx >= 0).sort((a: number, b: number) => a - b);
                        const selExs = selIdx.map((idx: number) => exs[idx]);
                        const restExs = exs.filter((_: any, idx: number) => !selIdx.includes(idx));
                        const insertAt = selIdx[0];
                        const newExs = [
                          ...restExs.slice(0, insertAt),
                          ...selExs.map((e: any) => ({ ...e, groupId: gid, groupType: "superset" })),
                          ...restExs.slice(insertAt),
                        ];
                        await saveDay(editingDay, newExs);
                        setSuperSelection([]); setCustomMultiMode(false);
                      }} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.35)", borderRadius: 10, color: "#FFE66D", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                        ⟳ SUPERSET
                      </button>
                    )}
                    <button onClick={async () => {
                      const selSet = new Set(superSelection);
                      const updated = exs.map((e: any, idx: number) => selSet.has(e.exerciseId ?? e.id ?? String(idx)) ? { ...e, rest: 0 } : e);
                      await saveDay(editingDay, updated);
                      setSuperSelection([]); setCustomMultiMode(false);
                    }} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,165,0,0.1)", border: "1px solid rgba(255,165,0,0.3)", borderRadius: 10, color: "#FFA500", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                      DROP SET
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Add exercise / browser */}
            {!showExBrowser ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowExBrowser(true); setExSearch(""); setBrowserSupersetMode(false); setBrowserSuperSel([]); }} style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>+ Add Exercise</button>
                {(() => {
                  const canSuper = superSelection.length >= 2;
                  const needOne = superSelection.length === 1;
                  return (
                    <button onClick={async () => {
                      if (canSuper) {
                        const gid = Math.random().toString(36).slice(2);
                        const selSet = new Set(superSelection);
                        const selIdx = exs.map((e: any, idx: number) => selSet.has(e.exerciseId ?? e.id ?? String(idx)) ? idx : -1).filter((idx: number) => idx >= 0).sort((a: number, b: number) => a - b);
                        const selExs = selIdx.map((idx: number) => exs[idx]);
                        const restExs = exs.filter((_: any, idx: number) => !selIdx.includes(idx));
                        const insertAt = selIdx[0];
                        const newExs = [...restExs.slice(0, insertAt), ...selExs.map((e: any) => ({ ...e, groupId: gid, groupType: "superset" })), ...restExs.slice(insertAt)];
                        await saveDay(editingDay, newExs);
                        setSuperSelection([]); setCustomMultiMode(false);
                      } else {
                        setShowExBrowser(true); setExSearch(""); setBrowserSupersetMode(true); setBrowserSuperSel([]);
                      }
                    }} style={{ padding: "14px 16px", background: canSuper ? "rgba(255,230,109,0.15)" : "rgba(255,230,109,0.07)", border: `1px ${canSuper ? "solid" : "dashed"} ${canSuper ? "rgba(255,230,109,0.6)" : "rgba(255,230,109,0.25)"}`, borderRadius: 12, color: canSuper ? "#FFE66D" : needOne ? "rgba(255,230,109,0.5)" : "rgba(255,230,109,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, position: "relative" as const }}>
                      {canSuper ? `⟳ SUPERSET (${superSelection.length})` : needOne ? "⟳ +1 MORE" : "⟳ SUPERSET"}
                    </button>
                  );
                })()}
              </div>
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

                {browserSupersetMode && (
                  <div style={{ background: "rgba(255,230,109,0.07)", border: "1px solid rgba(255,230,109,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#FFE66D", fontFamily: "'Space Mono', monospace", letterSpacing: 2, marginBottom: 4 }}>⟳ SUPERSET MODE</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>Select 2 or more exercises to add as a superset pair</div>
                  </div>
                )}
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {filtered.map((ex: any) => {
                    const alreadyIn = exs.some((x: any) => (x.exerciseId ?? x.id) === ex.id);
                    const bSel = browserSuperSel.includes(ex.id);
                    return (
                      <div key={ex.id} onClick={async () => {
                        if (browserSupersetMode) {
                          setBrowserSuperSel(s => s.includes(ex.id) ? s.filter(id => id !== ex.id) : [...s, ex.id]);
                        } else {
                          const newEx = { exerciseId: ex.id, name: ex.name, sets: 3, reps: "10–12", rest: 60, notes: null };
                          await saveDay(editingDay, [...exs, newEx]);
                          setShowExBrowser(false); setExSearch(""); setExFilterLoc("all"); setExFilterMove("all"); setExFilterMuscle("all");
                        }
                      }} style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${bSel ? "rgba(255,230,109,0.4)" : alreadyIn ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)"}`, background: bSel ? "rgba(255,230,109,0.08)" : "rgba(255,255,255,0.03)", marginBottom: 6, cursor: "pointer", opacity: !browserSupersetMode && alreadyIn ? 0.45 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {browserSupersetMode && (
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${bSel ? "#FFE66D" : "rgba(255,255,255,0.2)"}`, background: bSel ? "#FFE66D" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000" }}>{bSel ? "✓" : ""}</div>
                          )}
                          {/* Thumbnail — click to preview form without triggering add */}
                          {(() => {
                            const tu = getExerciseImageUrls(ex.id, ex.name);
                            return (
                              <div onClick={e => { e.stopPropagation(); setFormPreview({ id: ex.id, name: ex.name, muscles: ex.primaryMuscles ?? [], secondaryMuscles: ex.secondaryMuscles ?? [] }); }} style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0, cursor: "pointer", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {tu ? <img src={tu[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/> : <span style={{ fontSize: 13, opacity: 0.55, lineHeight: 1 }}>💪</span>}
                              </div>
                            );
                          })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}{alreadyIn && !browserSupersetMode ? <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: 6, fontFamily: "'Space Mono', monospace" }}>IN PLAN</span> : ""}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                              <span style={{ color: "#FF6644" }}>{ex.primaryMuscles.join(" · ")}</span>
                              {ex.secondaryMuscles.length > 0 && <span style={{ color: "rgba(255,255,255,0.25)" }}> · {ex.secondaryMuscles.join(" · ")}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>No exercises match these filters</div>}
                </div>
                {browserSupersetMode && browserSuperSel.length >= 2 && (
                  <button onClick={async () => {
                    const gid = Math.random().toString(36).slice(2);
                    const newExs = browserSuperSel.map(id => {
                      const e = (EXERCISES as any[]).find(x => x.id === id)!;
                      return { exerciseId: e.id, name: e.name, sets: 3, reps: "10–12", rest: 60, notes: null, groupId: gid, groupType: "superset" };
                    });
                    await saveDay(editingDay, [...exs, ...newExs]);
                    setShowExBrowser(false); setBrowserSupersetMode(false); setBrowserSuperSel([]); setExSearch(""); setExFilterLoc("all"); setExFilterMove("all"); setExFilterMuscle("all");
                  }} style={{ width: "100%", padding: "12px", background: "rgba(255,230,109,0.12)", border: "1px solid rgba(255,230,109,0.4)", borderRadius: 10, color: "#FFE66D", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginTop: 8 }}>
                    ⟳ ADD {browserSuperSel.length} AS SUPERSET
                  </button>
                )}
                {browserSupersetMode && browserSuperSel.length === 1 && (
                  <div style={{ fontSize: 10, color: "rgba(255,230,109,0.5)", textAlign: "center", fontFamily: "'Space Mono', monospace", marginTop: 8 }}>Select one more exercise to create a superset</div>
                )}
                <button onClick={() => { setShowExBrowser(false); setExSearch(""); setExFilterLoc("all"); setExFilterMove("all"); setExFilterMuscle("all"); setBrowserSupersetMode(false); setBrowserSuperSel([]); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>Cancel</button>
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
                  <>
                    {urls && !formImgError ? (
                      <div style={{ position: "relative", width: "100%", borderRadius: 14, overflow: "hidden", background: "#111" }}>
                        <img key={urls[formFrame]} src={urls[formFrame]} alt={formPreview.name} style={{ width: "100%", display: "block", minHeight: 220, objectFit: "cover" }} onError={() => setFormImgError(true)} />
                        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{formFrame === 0 ? "START" : "END"}</div>
                      </div>
                    ) : (
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden", position: "relative" }}>
                        <img src="/ai/form-fallback.jpg" alt="" style={{ width: "100%", display: "block", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 14px", background: "linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7))", color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>NO FORM DEMO</div>
                      </div>
                    )}
                    {(() => {
                      const cues = getFormCues(formPreview.id, formPreview.name);
                      if (!cues) return null;
                      return (
                        <div style={{ marginTop: 14, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginBottom: 2 }}>FORM CUES</div>
                          {cues.map((cue, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 9, background: "rgba(255,100,68,0.15)", border: "1px solid rgba(255,100,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#FF6644", fontFamily: "'Space Mono', monospace", marginTop: 1 }}>{i + 1}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>{cue}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
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
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button onClick={() => setModalSlide(0)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${modalSlide === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.07)"}`, background: modalSlide === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.02)", color: modalSlide === 0 ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", transition: "all 0.2s" }}>
                    FORM DEMO
                  </button>
                  <button onClick={() => setModalSlide(1)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${modalSlide === 1 ? "rgba(255,100,68,0.45)" : "rgba(255,255,255,0.07)"}`, background: modalSlide === 1 ? "rgba(255,100,68,0.1)" : "rgba(255,255,255,0.02)", color: modalSlide === 1 ? "#FF6644" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", transition: "all 0.2s" }}>
                    MUSCLES
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "center", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                  TAP OUTSIDE TO CLOSE
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
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)" }}>CUSTOMISE PLAN</div>
          <div style={{ width: 48 }} />
        </div>
        <div style={{ padding: "0 20px" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 20 }}>Tap a day to add, remove, or reorder exercises. Your workout history is always preserved.</div>
          <button onClick={() => { setView("home"); setOnboardingStep(3); setRebuildMode(true); setShowOnboarding(true); }} style={{ display: "block", width: "100%", padding: "14px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 12, color: "rgba(255,107,107,0.8)", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 28 }}>↺ REBUILD MY WEEKLY PLAN</button>
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
    <div key="home" className={viewDir === "back" ? "view-back" : "view-forward"} style={{ maxWidth: 480, margin: "0 auto", paddingBottom: safeBot, minHeight: "100dvh", position: "relative", overflow: "clip" }}>
      {/* PB celebration overlay */}
      {newPBs.length > 0 && (
        <div className="pb-overlay" onClick={() => setNewPBs([])} style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", cursor: "pointer" }}>
          <div className="pb-pop" style={{ background: "rgba(12,12,15,0.9)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 20, padding: "28px 32px", maxWidth: 300, width: "90%", textAlign: "center", backdropFilter: "blur(20px)", overflow: "hidden", position: "relative" }}>
            <div className="pb-shine" style={{ position: "absolute", top: 0, left: "-60%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)" }} />
            <img src="/ai/pb-celebration.png" alt="" style={{ width: 96, height: 96, display: "block", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFD700", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>PERSONAL BEST{newPBs.length > 1 ? "S" : ""}</div>
            {newPBs.map((pb, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{pb.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,215,0,0.7)", fontFamily: "'Space Mono', monospace" }}>{pb.weight}kg × {pb.reps}</div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 14, fontFamily: "'DM Sans', sans-serif" }}>Tap to dismiss</div>
          </div>
        </div>
      )}
      {/* Full-bleed hero — profile button floats over image, no solid wrapper */}
      <div style={{ position: "relative", height: 290, overflow: "hidden", zIndex: 5 }}>
        <img ref={heroImgRef} src="/ai/home-hero.jpg" alt="" aria-hidden style={{ position: "absolute", top: "-40px", left: 0, width: "100%", height: "calc(100% + 100px)", objectFit: "cover", opacity: 0.65 }} />
        {/* Gradient: dark at top for status bar readability, clear in middle, dark at bottom for text */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,15,0.88) 0%, rgba(10,10,15,0.35) 30%, rgba(10,10,15,0) 52%, rgba(10,10,15,0) 62%, rgba(10,10,15,0.94) 100%)" }} />
        {/* Profile button — floats over the image */}
        <div ref={profileWrapperRef} style={{ position: "absolute", top: 14, left: 16, right: 16, zIndex: 10, transition: "transform 0.25s ease, opacity 0.25s ease", willChange: "transform" }}>
          <button onClick={() => setView("settings")} style={{ position: "relative", zIndex: 1, background: "rgba(10,10,18,0.48)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, cursor: "pointer", textAlign: "left", padding: "12px 16px", width: "100%", boxSizing: "border-box", boxShadow: "0 4px 24px -6px rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/ai/avatar-default.png" alt="" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,107,107,0.25)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500, letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>WELCOME BACK</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: -0.5 }}>{user.username}</div>
              {user.role === "trainer" && (() => { const t = getTrainerTier(clients.length); return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: t.color, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: "2px 6px" }}>{t.emoji} {t.label.toUpperCase()} · TRAINER</span>; })()}
              {user.role === "admin" && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#a29bfe", background: "rgba(162,155,254,0.1)", border: "1px solid rgba(162,155,254,0.3)", borderRadius: 4, padding: "2px 6px" }}>ADMIN</span>}
              {user.role === "user" && (() => { const t = getClientTier(overall.totalSessions, overall.streak, Object.keys(overall.exercisePRs).length); return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: t.color, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4, padding: "2px 6px" }}>{t.emoji} {t.label.toUpperCase()}</span>; })()}
              {user.role === "user" && user.roleRequest && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#fdcb6e", background: "rgba(253,203,110,0.1)", border: "1px solid rgba(253,203,110,0.3)", borderRadius: 4, padding: "2px 6px" }}>REVIEWING</span>}
              <span style={{ marginLeft: "auto", fontSize: 14, color: "rgba(255,255,255,0.25)" }}>›</span>
            </div>
            </div>
          </button>
        </div>
        {/* LIFT / TRACK / PROGRESS + phrase — anchored to bottom of hero */}
        <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", letterSpacing: 6, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>LIFT · TRACK · PROGRESS</div>
          <div key={phraseIdx} className={phraseVisible ? "phrase-in" : "phrase-out"} style={{ fontSize: 14, color: "rgba(255,255,255,0.52)", fontStyle: "italic", marginTop: 7, fontFamily: "'DM Sans', sans-serif" }}>{phrase}</div>
        </div>
      </div>
      {/* Notification banner — sits below the hero */}
      {showNotifBanner && notifStatus === "idle" && (
        <div style={{ margin: "14px 16px 0", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.22)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
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
            <button onClick={() => setShowNotifBanner(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "2px 0", textAlign: "center" }}>Not now</button>
          </div>
        </div>
      )}
      <ProfileNagBanner ob={ob} onGoToSettings={() => setView("settings")} />
      <div style={{ padding: "20px 16px 0", position: "relative", zIndex: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>YOUR SPLIT</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={openCustomise} style={{ background: "linear-gradient(135deg, rgba(255,107,107,0.12), rgba(238,90,36,0.06))", border: "1px solid rgba(255,107,107,0.22)", borderRadius: 8, color: "#FF6B6B", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1.5, padding: "6px 11px" }}>✏ CUSTOMISE</button>
          </div>
        </div>
        {planNote && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, fontStyle: "italic", lineHeight: 1.5 }}>{planNote}</div>}
        {(() => {
          const plan = customPlan ? customPlan.map(planDayToWorkoutDay) : WORKOUT_DATA;
          const twoCol = plan.length >= 4;
          return (
            <div style={twoCol ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } : {}}>
              {plan.map((d, i) => {
                const isActive = started && activeDay?.id === d.id;
                const isLocked = started && activeDay?.id !== d.id;
                const img = workoutImageFor(d.title);
                return (
                  <div
                    key={d.id}
                    ref={el => { dayCardRefs.current[i] = el; }}
                    style={{
                      marginBottom: twoCol ? 0 : 12,
                      cursor: isLocked ? "default" : "pointer",
                      opacity: isLocked ? 0.28 : 1,
                      transition: "transform 0.15s ease, opacity 0.15s ease",
                      willChange: "transform",
                    }}
                    onClick={() => {
                      if (isLocked) return;
                      if (isActive) { setView("workout"); return; }
                      openDay(d);
                    }}
                  >
                    <div style={{
                      borderRadius: 20,
                      height: twoCol ? 160 : 188,
                      position: "relative",
                      overflow: "hidden",
                      border: isActive ? `1px solid ${d.color}70` : `1px solid ${d.color}22`,
                      boxShadow: isActive
                        ? `0 0 28px ${d.color}35, 0 8px 32px rgba(0,0,0,0.55)`
                        : `0 6px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
                    }}>
                      {/* Background image */}
                      {img ? (
                        <img className="day-card-img" src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: isActive ? 0.8 : 0.62, transition: "opacity 0.3s" }} />
                      ) : null}
                      {/* Fallback gradient (also shown in MONO theme) */}
                      <div className="day-card-gradient" style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${d.color}38, ${d.color}08)` }} />
                      {/* Vignette gradient */}
                      <div style={{ position: "absolute", inset: 0, background: twoCol ? "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.88) 100%)" : "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.06) 40%, rgba(0,0,0,0.82) 100%)" }} />
                      {/* Left accent bar */}
                      <div style={{ position: "absolute", top: 0, left: 0, width: isActive ? 5 : 3, height: "100%", background: d.gradient, boxShadow: `0 0 14px ${d.color}90` }} />
                      {/* Day chip — top left */}
                      <div style={{ position: "absolute", top: 14, left: 16 }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: d.color, fontWeight: 700, background: "rgba(0,0,0,0.52)", borderRadius: 6, padding: "3px 8px", backdropFilter: "blur(6px)", letterSpacing: 1 }}>{d.label}</span>
                      </div>
                      {/* Active badge */}
                      {isActive && (
                        <span style={{ position: "absolute", top: 14, right: 14, fontSize: 9, fontWeight: 700, letterSpacing: 2, color: d.color, background: `${d.color}28`, border: `1px solid ${d.color}60`, borderRadius: 6, padding: "3px 8px", backdropFilter: "blur(6px)" }}>ACTIVE</span>
                      )}
                      {/* Bottom text block */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: twoCol ? "10px 12px 12px 14px" : "12px 16px 16px 20px" }}>
                        <div style={{ fontSize: twoCol ? 14 : 19, fontWeight: 700, color: "#fff", letterSpacing: twoCol ? -0.1 : -0.3, textShadow: "0 2px 10px rgba(0,0,0,0.9)", lineHeight: 1.2, whiteSpace: twoCol ? "nowrap" : "normal", overflow: twoCol ? "hidden" : "visible", textOverflow: twoCol ? "ellipsis" : "clip" }}>{d.title}</div>
                        <div style={{ fontSize: twoCol ? 10 : 12, color: "rgba(255,255,255,0.6)", marginTop: 3, textShadow: "0 1px 6px rgba(0,0,0,0.8)", fontWeight: 300, whiteSpace: twoCol ? "nowrap" : "normal", overflow: twoCol ? "hidden" : "visible", textOverflow: twoCol ? "ellipsis" : "clip" }}>{d.focus}</div>
                        {isActive && (
                          <div style={{ display: "flex", alignItems: "center", gap: twoCol ? 6 : 10, marginTop: twoCol ? 5 : 8 }}>
                            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: twoCol ? 13 : 17, fontWeight: 700, color: d.color, letterSpacing: 2, textShadow: `0 0 16px ${d.color}` }}>{timer.fmt}</div>
                            {!twoCol && <div style={{ fontSize: 10, color: d.color, opacity: 0.9, letterSpacing: 1 }}>TAP TO RESUME →</div>}
                          </div>
                        )}
                        {!isActive && history[d.id]?.[0] && (
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 4, fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            Last: {history[d.id][0].date} · {history[d.id][0].duration}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
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
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8, paddingTop: 10 }}>SHARE WITH</div>
                    {user?.role === "trainer" && clients.length > 0 ? (
                      <>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {clients.map((c: any) => {
                            const sel = shareClientIds.includes(c.id);
                            return (
                              <button key={c.id} onClick={() => setShareClientIds(ids => sel ? ids.filter(id => id !== c.id) : [...ids, c.id])}
                                style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, border: `1px solid ${sel ? "#4ECDC4" : "rgba(255,255,255,0.1)"}`, background: sel ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.04)", color: sel ? "#4ECDC4" : "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: sel ? 600 : 400 }}>
                                {sel ? "✓ " : ""}@{c.username}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={async () => {
                          if (shareClientIds.length === 0) return;
                          setSharingLoading(true); setShareResult(null);
                          const usernames = shareClientIds.map(id => clients.find((c: any) => c.id === id)?.username).filter(Boolean) as string[];
                          let lastResult = "";
                          for (const uname of usernames) {
                            const res = await fetch(`/api/routines/${r.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toUsername: uname }) });
                            const data = await res.json();
                            lastResult = data.ok ? `Sent to ${usernames.length} client${usernames.length > 1 ? "s" : ""}` : (data.error ?? "Failed");
                          }
                          setSharingLoading(false); setShareResult(lastResult); setShareClientIds([]);
                          if (lastResult.startsWith("Sent")) setTimeout(() => { setSharingRoutineId(null); setShareResult(null); }, 2000);
                        }} disabled={sharingLoading || shareClientIds.length === 0}
                          style={{ width: "100%", padding: "9px", background: shareClientIds.length > 0 ? "#4ECDC4" : "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, color: shareClientIds.length > 0 ? "#000" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: shareClientIds.length > 0 ? "pointer" : "default", fontFamily: "'Space Mono', monospace" }}>
                          {sharingLoading ? "…" : shareClientIds.length > 0 ? `SEND TO ${shareClientIds.length} CLIENT${shareClientIds.length > 1 ? "S" : ""}` : "SELECT CLIENTS ABOVE"}
                        </button>
                        <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>OR BY USERNAME</span>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                        </div>
                      </>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, marginTop: user?.role === "trainer" && clients.length > 0 ? 8 : 0 }}>
                      <input
                        value={shareUsername}
                        onChange={e => { setShareUsername(e.target.value); setShareResult(null); }}
                        onKeyDown={async e => { if (e.key === "Enter") await doShareRoutine(r.id); }}
                        placeholder="Exact username…"
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
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>👥</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 3, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>MY CLIENTS</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{clients.length}</span>
            <button onClick={() => setShowMyClients(s => !s)} style={{ padding: "5px 12px", background: showMyClients ? "rgba(78,205,196,0.16)" : "rgba(255,255,255,0.04)", border: `1px solid ${showMyClients ? "rgba(78,205,196,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, color: showMyClients ? "#4ECDC4" : "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>{showMyClients ? "HIDE" : "VIEW"}</button>
          </div>
          {showMyClients && (
            <div className="fade-in">
              {clients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <img src="/ai/empty-clients.jpg" alt="" style={{ width: 140, height: 140, opacity: 0.55, borderRadius: 14, marginBottom: 10 }} />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>No accepted clients yet — find one below</div>
                </div>
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
              {/* ── Find new clients (inline) ── */}
              <button onClick={() => setShowFindClients(s => !s)} style={{ width: "100%", marginTop: clients.length > 0 ? 6 : 0, padding: "10px 14px", background: showFindClients ? "rgba(255,107,107,0.08)" : "rgba(78,205,196,0.08)", border: `1px solid ${showFindClients ? "rgba(255,107,107,0.25)" : "rgba(78,205,196,0.22)"}`, borderRadius: 12, color: showFindClients ? "#FF6B6B" : "#4ECDC4", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                {showFindClients ? "CLOSE SEARCH" : "+ FIND CLIENTS"}
              </button>
              {showFindClients && (
                <div className="fade-in" style={{ marginTop: 10, padding: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input
                      value={trainerSearch}
                      onChange={e => { setTrainerSearch(e.target.value); if (!e.target.value.trim()) { setTrainerResults([]); setTrainerHasSearched(false); } }}
                      onKeyDown={e => { if (e.key === "Enter") doTrainerSearch(); }}
                      placeholder="Enter exact username…"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: "10px 12px", flex: 1, outline: "none", boxSizing: "border-box" }}
                    />
                    <button onClick={() => doTrainerSearch()} style={{ padding: "10px 14px", background: "#4ECDC4", border: "none", borderRadius: 10, color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>SEARCH</button>
                  </div>
                  {trainerSearching && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "10px 0" }}>Searching…</div>}
                  {trainerResults.map(u => {
                    const req = trainerRequests.find(r => r.userId === u.id);
                    const status = req?.status ?? null;
                    return (
                      <div key={u.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>@{u.username}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
                            {u.logCount} workout{u.logCount !== 1 ? "s" : ""} · {new Date(u.joinedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                          </div>
                        </div>
                        {status === "pending" && <span style={{ fontSize: 10, letterSpacing: 1, color: "#f0c040", fontFamily: "'Space Mono', monospace" }}>PENDING</span>}
                        {status === "accepted" && <span style={{ fontSize: 10, letterSpacing: 1, color: "#4ECDC4", fontFamily: "'Space Mono', monospace" }}>ACCEPTED</span>}
                        {status === "declined" && (
                          <button onClick={() => sendAdoptionRequest(u.id)} disabled={sendingRequest === u.id} style={{ fontSize: 11, padding: "5px 10px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "rgba(255,107,107,0.7)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>RE-SEND</button>
                        )}
                        {!status && (
                          <button onClick={() => sendAdoptionRequest(u.id)} disabled={sendingRequest === u.id} style={{ fontSize: 11, padding: "5px 10px", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 8, color: "#4ECDC4", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{sendingRequest === u.id ? "…" : "SEND REQUEST"}</button>
                        )}
                      </div>
                    );
                  })}
                  {trainerSearchError && (
                    <div style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center", padding: "10px 0", fontFamily: "'Space Mono', monospace" }}>{trainerSearchError}</div>
                  )}
                  {trainerHasSearched && !trainerSearching && !trainerSearchError && trainerResults.length === 0 && (
                    <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No users found matching &ldquo;{trainerSearch}&rdquo;</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {user.role === "trainer" && (
        <>
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 3, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>LEADERBOARD</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <button
              onClick={async () => {
                if (showLeaderboard) { setShowLeaderboard(false); return; }
                setLeaderboardLoading(true);
                setShowLeaderboard(true);
                try {
                  const res = await fetch("/api/trainer/leaderboard");
                  const data = await res.json();
                  if (data.leaderboard) setLeaderboard(data.leaderboard);
                } catch {}
                setLeaderboardLoading(false);
              }}
              style={{ padding: "5px 12px", background: showLeaderboard ? "rgba(162,155,254,0.16)" : "rgba(255,255,255,0.04)", border: `1px solid ${showLeaderboard ? "rgba(162,155,254,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, color: showLeaderboard ? "#a29bfe" : "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
            >{showLeaderboard ? "HIDE" : "VIEW"}</button>
          </div>
          {showLeaderboard && (
            <div className="fade-in" style={{ marginTop: 8 }}>
              {/* Sort chips */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["sessions","streak","intensity"] as const).map(s => (
                  <button key={s} onClick={() => setLeaderboardSort(s)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: 1, cursor: "pointer", fontWeight: 600, background: leaderboardSort === s ? "rgba(162,155,254,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${leaderboardSort === s ? "rgba(162,155,254,0.4)" : "rgba(255,255,255,0.08)"}`, color: leaderboardSort === s ? "#a29bfe" : "rgba(255,255,255,0.35)" }}>
                    {s === "intensity" ? "⚡ INTENSITY" : s.toUpperCase()}
                  </button>
                ))}
              </div>
              {leaderboardLoading ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Loading…</div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "20px 0" }}>No client data yet</div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 48px 48px 48px 48px", gap: 6, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["#","CLIENT","SESS","STREAK","PRs","⚡ IP"].map((h, hi) => (
                      <div key={h} style={{ fontSize: 9, color: hi > 1 && ["SESS","STREAK","PRs","⚡ IP"][hi-2] === (leaderboardSort === "sessions" ? "SESS" : leaderboardSort === "streak" ? "STREAK" : "⚡ IP") ? "#a29bfe" : "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", letterSpacing: 1, textAlign: hi > 1 ? "center" : "left" }}>{h}</div>
                    ))}
                  </div>
                  {[...leaderboard].sort((a, b) => leaderboardSort === "streak" ? b.streak - a.streak : leaderboardSort === "intensity" ? (b.totalIntensityPoints ?? 0) - (a.totalIntensityPoints ?? 0) : b.totalSessions - a.totalSessions).map((c, i) => {
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                    const tier = (() => { const t = CLIENT_TIERS.slice().reverse().find(t => c.totalSessions >= t.min); return t ?? CLIENT_TIERS[0]; })();
                    return (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr 48px 48px 48px 48px", gap: 6, padding: "11px 12px", borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i === 0 ? "rgba(240,192,64,0.03)" : "transparent" }}>
                        <div style={{ fontSize: 14, display: "flex", alignItems: "center" }}>{medal ?? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>{i + 1}</span>}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>@{c.username}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{tier.emoji} {tier.label} · {c.totalVolume.toLocaleString()}kg vol</div>
                        </div>
                        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: leaderboardSort === "sessions" ? "#a29bfe" : "#fff" }}>{c.totalSessions}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>sess</div>
                        </div>
                        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: leaderboardSort === "streak" ? "#a29bfe" : c.streak >= 3 ? "#FF6B6B" : "#fff" }}>{c.streak}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>days</div>
                        </div>
                        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: c.prCount > 0 ? "#f0c040" : "rgba(255,255,255,0.3)" }}>{c.prCount}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>PRs</div>
                        </div>
                        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: leaderboardSort === "intensity" ? "#a29bfe" : (c.totalIntensityPoints ?? 0) > 0 ? "#FFE66D" : "rgba(255,255,255,0.3)" }}>{c.totalIntensityPoints ?? 0}</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>IP</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Leaderboard Groups ── */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🏝️</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 3, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>GROUPS</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <button
              onClick={async () => {
                if (showLbGroups) { setShowLbGroups(false); return; }
                setLbGroupsLoading(true);
                setShowLbGroups(true);
                try {
                  const res = await fetch("/api/leaderboard/groups");
                  const data = await res.json();
                  if (data.groups) setLbGroups(data.groups);
                } catch {}
                setLbGroupsLoading(false);
              }}
              style={{ padding: "5px 12px", background: showLbGroups ? "rgba(78,205,196,0.16)" : "rgba(255,255,255,0.04)", border: `1px solid ${showLbGroups ? "rgba(78,205,196,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, color: showLbGroups ? "#4ECDC4" : "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
            >{showLbGroups ? "HIDE" : "VIEW"}</button>
          </div>
          {showLbGroups && (
            <div className="fade-in" style={{ marginTop: 8 }}>
              {/* Pending invites from other trainers */}
              {pendingGroupInvites.length > 0 && (
                <div style={{ background: "rgba(255,230,109,0.06)", border: "1px solid rgba(255,230,109,0.2)", borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#FFE66D", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 700, marginBottom: 8 }}>PENDING INVITES</div>
                  {pendingGroupInvites.map((inv: any) => (
                    <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{inv.group?.name}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>from @{inv.inviter?.username} · {inv.group?.members?.length ?? 0} members</div>
                      </div>
                      <button onClick={async () => {
                        try {
                          const res = await fetch(`/api/leaderboard/groups/${inv.group.id}/invite`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId: inv.id, action: "accept" }) });
                          if (res.ok) {
                            setPendingGroupInvites(p => p.filter(i => i.id !== inv.id));
                            const refreshRes = await fetch("/api/leaderboard/groups");
                            const refreshData = await refreshRes.json();
                            if (refreshData.groups) setLbGroups(refreshData.groups);
                          }
                        } catch {}
                      }} style={{ padding: "5px 10px", background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 6, color: "#4ECDC4", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>ACCEPT</button>
                      <button onClick={async () => {
                        try {
                          const res = await fetch(`/api/leaderboard/groups/${inv.group.id}/invite`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId: inv.id, action: "decline" }) });
                          if (res.ok) setPendingGroupInvites(p => p.filter(i => i.id !== inv.id));
                        } catch {}
                      }} style={{ padding: "5px 10px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 6, color: "#FF6B6B", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>DECLINE</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Create group button */}
              <button onClick={() => setShowLbGroupCreate(s => !s)} style={{ width: "100%", padding: "10px 14px", marginBottom: 8, background: showLbGroupCreate ? "rgba(255,107,107,0.1)" : "rgba(78,205,196,0.08)", border: `1px solid ${showLbGroupCreate ? "rgba(255,107,107,0.3)" : "rgba(78,205,196,0.2)"}`, borderRadius: 10, color: showLbGroupCreate ? "#FF6B6B" : "#4ECDC4", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                {showLbGroupCreate ? "CANCEL" : "+ NEW GROUP"}
              </button>
              {showLbGroupCreate && (
                <div className="fade-in" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <input value={lbGroupName} onChange={e => setLbGroupName(e.target.value)} placeholder="Group name (e.g. Strength Squad)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 12px", outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {(["private","public"] as const).map(p => (
                      <button key={p} onClick={() => setLbGroupPrivacy(p)} style={{ flex: 1, padding: "6px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "'Space Mono', monospace", background: lbGroupPrivacy === p ? "rgba(78,205,196,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${lbGroupPrivacy === p ? "rgba(78,205,196,0.4)" : "rgba(255,255,255,0.08)"}`, color: lbGroupPrivacy === p ? "#4ECDC4" : "rgba(255,255,255,0.35)" }}>{p.toUpperCase()}</button>
                    ))}
                  </div>
                  <button onClick={async () => {
                    if (!lbGroupName.trim()) return;
                    setCreatingLbGroup(true);
                    try {
                      const res = await fetch("/api/leaderboard/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: lbGroupName.trim(), privacy: lbGroupPrivacy }) });
                      const data = await res.json();
                      if (data.group) { setLbGroups(p => [data.group, ...p]); setShowLbGroupCreate(false); setLbGroupName(""); }
                      else alert(data.error ?? "Failed");
                    } catch { alert("Failed"); } finally { setCreatingLbGroup(false); }
                  }} disabled={creatingLbGroup || !lbGroupName.trim()} style={{ width: "100%", padding: "10px", background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 8, color: "#4ECDC4", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                    {creatingLbGroup ? "CREATING…" : "CREATE GROUP"}
                  </button>
                </div>
              )}
              {lbGroupsLoading ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "16px 0" }}>Loading…</div>
              ) : lbGroups.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "16px 0" }}>No groups yet — create one above</div>
              ) : (
                lbGroups.map(grp => (
                  <div key={grp.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                    <div onClick={() => setActiveLbGroup(activeLbGroup?.id === grp.id ? null : grp)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{grp.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{grp.members?.length ?? 0} members · {grp.privacy}</div>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14 }}>{activeLbGroup?.id === grp.id ? "▲" : "▼"}</span>
                    </div>
                    {activeLbGroup?.id === grp.id && (
                      <div className="fade-in" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: 14 }}>
                        {/* Trainer inclusion toggle */}
                        {(() => {
                          const myMember = grp.members?.find((m: any) => m.userId === user.id && m.role === "trainer");
                          return myMember ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Include me in ranking</div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Show your stats on this leaderboard</div>
                              </div>
                              <button onClick={async () => {
                                try {
                                  const res = await fetch(`/api/leaderboard/groups/${grp.id}/members`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ includeInRank: !myMember.includeInRank }) });
                                  if (res.ok) {
                                    setLbGroups(prev => prev.map(g => g.id !== grp.id ? g : { ...g, members: g.members.map((m: any) => m.id !== myMember.id ? m : { ...m, includeInRank: !m.includeInRank }) }));
                                    setActiveLbGroup((prev: any) => ({ ...prev, members: prev.members.map((m: any) => m.id !== myMember.id ? m : { ...m, includeInRank: !m.includeInRank }) }));
                                  }
                                } catch {}
                              }} style={{ width: 44, height: 24, borderRadius: 12, background: myMember.includeInRank ? "#4ECDC4" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                                <div style={{ position: "absolute", top: 2, left: myMember.includeInRank ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                              </button>
                            </div>
                          ) : null;
                        })()}
                        {/* Group leaderboard */}
                        {(() => {
                          const ranked = (grp.members ?? [])
                            .filter((m: any) => m.includeInRank)
                            .map((m: any) => ({
                              userId: m.userId,
                              username: m.user?.username ?? "unknown",
                              role: m.role,
                              totalSessions: m.stats?.totalSessions ?? 0,
                              totalIntensityPoints: m.stats?.totalIntensityPoints ?? 0,
                              totalVolume: m.stats?.totalVolume ?? 0,
                              streak: m.stats?.streak ?? 0,
                              prCount: m.stats?.prCount ?? 0,
                            }))
                            .sort((a: any, b: any) => b.totalSessions - a.totalSessions || b.totalVolume - a.totalVolume);

                          return (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>🏆 RANKINGS · {ranked.length}</div>
                              {ranked.length === 0 ? (
                                <div style={{ padding: "14px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, fontSize: 11.5, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                                  No members ranked yet — toggle &ldquo;Include me in ranking&rdquo; or add clients below.
                                </div>
                              ) : (
                                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 38px 38px 38px", gap: 6, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    {["#","NAME","SESS","STRK","PRs"].map((h, hi) => (
                                      <div key={h} style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: 1, textAlign: hi > 1 ? "center" : "left" }}>{h}</div>
                                    ))}
                                  </div>
                                  {ranked.map((m: any, i: number) => {
                                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                                    const tier = CLIENT_TIERS.slice().reverse().find(t => m.totalSessions >= t.min) ?? CLIENT_TIERS[0];
                                    const isMe = m.userId === user.id;
                                    return (
                                      <div key={m.userId} style={{ display: "grid", gridTemplateColumns: "26px 1fr 38px 38px 38px", gap: 6, padding: "9px 10px", borderBottom: i < ranked.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i === 0 ? "rgba(240,192,64,0.04)" : isMe ? "rgba(78,205,196,0.04)" : "transparent" }}>
                                        <div style={{ fontSize: 13, display: "flex", alignItems: "center" }}>{medal ?? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>{i + 1}</span>}</div>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: 12, fontWeight: 600, color: isMe ? "#4ECDC4" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isMe ? "YOU" : `@${m.username}`}</div>
                                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{tier.emoji} {tier.label}{m.role === "trainer" ? " · COACH" : ""}</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                          <div style={{ fontSize: 13, fontWeight: 700, color: "#a29bfe" }}>{m.totalSessions}</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                          <div style={{ fontSize: 13, fontWeight: 700, color: m.streak >= 3 ? "#FF6B6B" : "#fff" }}>{m.streak}</div>
                                        </div>
                                        <div style={{ textAlign: "center" }}>
                                          <div style={{ fontSize: 13, fontWeight: 700, color: m.prCount > 0 ? "#f0c040" : "rgba(255,255,255,0.3)" }}>{m.prCount}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Client member selection */}
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>CLIENTS IN GROUP</div>
                        <input value={lbGroupClientSearch} onChange={e => setLbGroupClientSearch(e.target.value)} placeholder="Filter clients…" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "7px 10px", outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", marginBottom: 8 }} />
                        {clients.filter(c => !lbGroupClientSearch || c.username.toLowerCase().includes(lbGroupClientSearch.toLowerCase())).map((c: any) => {
                          const inGroup = grp.members?.some((m: any) => m.userId === c.id && m.role === "client");
                          return (
                            <div key={c.id} onClick={() => {
                              const currentClientIds = (grp.members ?? []).filter((m: any) => m.role === "client").map((m: any) => m.userId);
                              const newIds = inGroup ? currentClientIds.filter((id: string) => id !== c.id) : [...currentClientIds, c.id];
                              const snapshotMembers = grp.members ?? [];
                              // Optimistic update — instant UI feedback
                              const optimisticMembers = inGroup
                                ? snapshotMembers.filter((m: any) => !(m.userId === c.id && m.role === "client"))
                                : [...snapshotMembers, { userId: c.id, role: "client", includeInRank: true, trainerId: user.id, user: { id: c.id, username: c.username, workoutLogs: [] } }];
                              setLbGroups(prev => prev.map(g => g.id !== grp.id ? g : { ...g, members: optimisticMembers }));
                              setActiveLbGroup((prev: any) => prev && prev.id === grp.id ? { ...prev, members: optimisticMembers } : prev);
                              // Fire-and-forget API call; revert on failure
                              fetch(`/api/leaderboard/groups/${grp.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientIds: newIds }) })
                                .then(res => { if (!res.ok) throw new Error(); })
                                .catch(() => {
                                  setLbGroups(prev => prev.map(g => g.id !== grp.id ? g : { ...g, members: snapshotMembers }));
                                  setActiveLbGroup((prev: any) => prev && prev.id === grp.id ? { ...prev, members: snapshotMembers } : prev);
                                });
                            }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: inGroup ? "rgba(78,205,196,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer", border: `1px solid ${inGroup ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                              <span style={{ fontSize: 13, color: inGroup ? "#4ECDC4" : "rgba(255,255,255,0.6)" }}>@{c.username}</span>
                              <span style={{ fontSize: 16 }}>{inGroup ? "✓" : "+"}</span>
                            </div>
                          );
                        })}
                        {/* Invite other trainer */}
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>INVITE TRAINER</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input value={trainerSearchForLb} onChange={e => setTrainerSearchForLb(e.target.value)} placeholder="Search by username…" style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, padding: "7px 10px", outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                            <button onClick={async () => {
                              if (trainerSearchForLb.trim().length < 2) return;
                              setTrainerSearchingLb(true);
                              try {
                                const res = await fetch(`/api/trainer/search?q=${encodeURIComponent(trainerSearchForLb.trim())}&type=trainer`);
                                const data = await res.json();
                                setTrainerSearchResultsLb(data.results ?? []);
                              } catch {} finally { setTrainerSearchingLb(false); }
                            }} style={{ padding: "7px 12px", background: "rgba(162,155,254,0.12)", border: "1px solid rgba(162,155,254,0.25)", borderRadius: 8, color: "#a29bfe", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
                              {trainerSearchingLb ? "…" : "FIND"}
                            </button>
                          </div>
                          {trainerSearchResultsLb.map((t: any) => {
                            const alreadyInvited = grp.invites?.some((inv: any) => inv.inviteeId === t.id);
                            const alreadyMember = grp.members?.some((m: any) => m.userId === t.id);
                            return (
                              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, marginTop: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <span style={{ fontSize: 13, color: "#fff" }}>@{t.username}</span>
                                {alreadyMember ? (
                                  <span style={{ fontSize: 10, color: "#4ECDC4", fontFamily: "'Space Mono', monospace" }}>MEMBER</span>
                                ) : alreadyInvited ? (
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>INVITED</span>
                                ) : (
                                  <button onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/leaderboard/groups/${grp.id}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteeId: t.id }) });
                                      if (res.ok) {
                                        const refreshRes = await fetch("/api/leaderboard/groups");
                                        const refreshData = await refreshRes.json();
                                        if (refreshData.groups) { setLbGroups(refreshData.groups); setActiveLbGroup(refreshData.groups.find((g: any) => g.id === grp.id) ?? null); }
                                        setTrainerSearchResultsLb([]);
                                        setTrainerSearchForLb("");
                                      }
                                    } catch {}
                                  }} style={{ padding: "4px 10px", background: "rgba(162,155,254,0.14)", border: "1px solid rgba(162,155,254,0.3)", borderRadius: 6, color: "#a29bfe", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>INVITE</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Delete group */}
                        {grp.createdBy === user.id && (
                          <button onClick={async () => {
                            if (!confirm(`Delete "${grp.name}"? This cannot be undone.`)) return;
                            try {
                              const res = await fetch(`/api/leaderboard/groups/${grp.id}`, { method: "DELETE" });
                              if (res.ok) { setLbGroups(p => p.filter(g => g.id !== grp.id)); setActiveLbGroup(null); }
                            } catch {}
                          }} style={{ width: "100%", marginTop: 14, padding: "8px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "#FF6B6B", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>DELETE GROUP</button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        </>
      )}

      {/* ── Trainer: Custom Exercises ── */}
      {user.role === "trainer" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🏋️</span>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 3, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>MY EXERCISES</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <button onClick={() => setShowExCreator(s => !s)} style={{ padding: "5px 12px", background: showExCreator ? "rgba(255,107,107,0.16)" : "rgba(78,205,196,0.16)", border: `1px solid ${showExCreator ? "rgba(255,107,107,0.4)" : "rgba(78,205,196,0.4)"}`, borderRadius: 14, color: showExCreator ? "#FF6B6B" : "#4ECDC4", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
              {showExCreator ? "CANCEL" : "+ NEW"}
            </button>
          </div>

          {/* Creator form */}
          {showExCreator && (() => {
            const MUSCLES = ["chest","back","shoulders","biceps","triceps","quads","hamstrings","glutes","calves","core","forearms"];
            const EQUIP = ["barbell","dumbbell","cable","machine","bodyweight","pullup_bar","bench","kettlebell","resistance_band","dip_bar"];
            const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
              set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
            const chipBtn = (label: string, active: boolean, onClick: () => void, color = "#4ECDC4") => (
              <button key={label} onClick={onClick} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, fontWeight: 600, border: `1px solid ${active ? color + "60" : "rgba(255,255,255,0.1)"}`, background: active ? color + "18" : "rgba(255,255,255,0.03)", color: active ? color : "rgba(255,255,255,0.35)" }}>{label.toUpperCase()}</button>
            );
            const uploadPhoto = async (file: File) => {
              setExCreatorUploading(true);
              try {
                const fd = new FormData(); fd.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const data = await res.json();
                if (data.url) setExCreatorPhotos(p => [...p, data.url]);
                else alert(data.error ?? "Upload failed");
              } catch { alert("Upload failed"); } finally { setExCreatorUploading(false); }
            };
            const saveExercise = async () => {
              if (!exCreatorName.trim()) return;
              setExCreatorSaving(true);
              try {
                const res = await fetch("/api/trainer/exercises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: exCreatorName.trim(), primaryMuscles: exCreatorPrimary, secondaryMuscles: exCreatorSecondary, equipment: exCreatorEquip, type: exCreatorType, difficulty: exCreatorDiff, photoUrls: exCreatorPhotos }) });
                const data = await res.json();
                if (data.exercise) { setCustomExercises(p => [data.exercise, ...p]); setShowExCreator(false); setExCreatorName(""); setExCreatorPrimary([]); setExCreatorSecondary([]); setExCreatorEquip([]); setExCreatorPhotos([]); setExCreatorType("compound"); setExCreatorDiff("intermediate"); }
                else alert(data.error ?? "Save failed");
              } catch { alert("Save failed"); } finally { setExCreatorSaving(false); }
            };
            return (
              <div className="fade-in" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px", marginBottom: 12 }}>
                {/* Name */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>EXERCISE NAME</div>
                  <input value={exCreatorName} onChange={e => setExCreatorName(e.target.value)} placeholder="e.g. Cable Crossover Twist" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box" }} />
                </div>
                {/* Primary muscles */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>PRIMARY MUSCLES</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{MUSCLES.map(m => chipBtn(m, exCreatorPrimary.includes(m), () => toggleArr(exCreatorPrimary, setExCreatorPrimary, m), "#FF6B6B"))}</div>
                </div>
                {/* Secondary muscles */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>SECONDARY MUSCLES</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{MUSCLES.map(m => chipBtn(m, exCreatorSecondary.includes(m), () => toggleArr(exCreatorSecondary, setExCreatorSecondary, m), "#A29BFE"))}</div>
                </div>
                {/* Equipment */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>EQUIPMENT</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{EQUIP.map(e => chipBtn(e.replace("_"," "), exCreatorEquip.includes(e), () => toggleArr(exCreatorEquip, setExCreatorEquip, e), "#4ECDC4"))}</div>
                </div>
                {/* Type + Difficulty */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>TYPE</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{["compound","isolation","cardio"].map(t => chipBtn(t, exCreatorType === t, () => setExCreatorType(t), "#FFE66D"))}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>DIFFICULTY</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{["beginner","intermediate","advanced"].map(d => chipBtn(d, exCreatorDiff === d, () => setExCreatorDiff(d), "#96CEB4"))}</div>
                  </div>
                </div>
                {/* Photo upload */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>FORM PHOTOS</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {exCreatorPhotos.map((url, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", background: "rgba(255,255,255,0.06)" }} />
                        <button onClick={() => setExCreatorPhotos(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#FF6B6B", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                    {exCreatorPhotos.length < 5 && (
                      <label style={{ width: 64, height: 64, borderRadius: 8, border: "1px dashed rgba(255,255,255,0.2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: exCreatorUploading ? "wait" : "pointer", fontSize: 20, color: "rgba(255,255,255,0.25)" }}>
                        {exCreatorUploading ? "⏳" : "+"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} disabled={exCreatorUploading} />
                      </label>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6, fontFamily: "'Space Mono', monospace" }}>Up to 5 photos. Requires Cloudinary setup.</div>
                </div>
                {/* Save */}
                <button onClick={saveExercise} disabled={!exCreatorName.trim() || exCreatorSaving} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#4ECDC4,#26a69a)", border: "none", borderRadius: 10, color: "#000", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: exCreatorName.trim() ? "pointer" : "not-allowed", opacity: exCreatorName.trim() ? 1 : 0.4, fontFamily: "'Space Mono', monospace" }}>
                  {exCreatorSaving ? "SAVING…" : "SAVE EXERCISE"}
                </button>
              </div>
            );
          })()}

          {/* Saved custom exercises list */}
          {customExercises.length === 0 && !showExCreator && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic", padding: "8px 0" }}>No custom exercises yet — create one above</div>
          )}
          {customExercises.map(ex => (
            <div key={ex.id} style={{ position: "relative", background: "linear-gradient(90deg, rgba(78,205,196,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 8px -4px rgba(78,205,196,0.18)" }}>
              <div aria-hidden style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, background: "linear-gradient(180deg, #4ECDC4, transparent)", borderRadius: 1 }} />
              {ex.photoUrls?.[0] && <img src={ex.photoUrls[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {!ex.photoUrls?.[0] && <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏋️</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                  {ex.primaryMuscles?.join(" · ").toUpperCase() || "—"}
                </div>
              </div>
              <button onClick={async () => { if (!confirm(`Delete "${ex.name}"?`)) return; const res = await fetch(`/api/trainer/exercises/${ex.id}`, { method: "DELETE" }); if ((await res.json()).ok) setCustomExercises(p => p.filter(e => e.id !== ex.id)); }} style={{ background: "none", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 6, color: "rgba(255,107,107,0.5)", fontSize: 9, padding: "4px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, flexShrink: 0 }}>DEL</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚡</span>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 3, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>QUICK ACTIONS</div>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="card-hover nav-btn" onClick={() => goTo("messages")} style={{ position: "relative", padding: "18px 14px", background: unreadCount > 0 ? "rgba(78,205,196,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${unreadCount > 0 ? "rgba(78,205,196,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, color: unreadCount > 0 ? "#4ECDC4" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, boxSizing: "border-box" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>💬</span>
            <span>Messages</span>
            {unreadCount > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: "#4ECDC4", color: "#000", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{unreadCount}</span>}
          </button>
          <button className="card-hover nav-btn" onClick={() => { goTo("progress"); setProgressTab("dashboard"); }} style={{ padding: "18px 14px", background: "rgba(255,107,107,0.04)", border: "1px solid rgba(255,107,107,0.14)", borderRadius: 14, color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, boxSizing: "border-box" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>📊</span>
            <span>Progress</span>
          </button>
        </div>
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
      <div key="clientDetail" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", paddingBottom: safeBot, minHeight: "100dvh" }}>
        <div style={{ padding: "24px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
        </div>
        <div style={{ padding: "0 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>@{activeClient.username}</div>
            <button
              onClick={() => openConversation({ id: activeClient.id, username: activeClient.username })}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 8, padding: "5px 10px", color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
            >
              MESSAGE
            </button>
          </div>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
                  {!clientData?.plan
                    ? <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>Using default 5-day split</div>
                    : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Custom plan</div>
                  }
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={generateClientPlan}
                      disabled={trainerGenerating}
                      style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "6px 12px", color: "#FF6B6B", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: trainerGenerating ? "not-allowed" : "pointer", fontFamily: "'Space Mono', monospace", opacity: trainerGenerating ? 0.5 : 1, whiteSpace: "nowrap" }}>
                      {trainerGenerating ? "GENERATING…" : "⚡ BUILD PLAN"}
                    </button>
                    <button onClick={startEditPlan} style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 8, padding: "6px 12px", color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>EDIT</button>
                  </div>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Editing plan</div>
                  <button onClick={() => { setEditingPlan(false); setEditedPlanDays(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                </div>
                {editedPlanDays?.[0]?.id?.startsWith("trainer-gen") && (
                  <div style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                    <span style={{ color: "#FF6B6B", fontWeight: 700 }}>⚡ AI-generated plan</span> — built from {activeClient?.username}&apos;s profile at a boosted difficulty. Adjust sets, reps, or exercises before sending.
                  </div>
                )}
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
                            <div key={ei} style={{ marginBottom: 8, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                              {(() => {
                                const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 180];
                                const restChips = REST_PRESETS.includes(ex.rest) ? REST_PRESETS : [...REST_PRESETS, ex.rest].sort((a, b) => a - b);
                                return (
                                  <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center", overflowX: "auto", scrollbarWidth: "none" }}>
                                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginRight: 2, flexShrink: 0 }}>REST</span>
                                    {restChips.map(s => {
                                      const active = ex.rest === s;
                                      return <button key={s} onClick={() => { setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : { ...day, exercises: day.exercises.map((x: any, ej: number) => ej !== ei ? x : { ...x, rest: s }) })); }} style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9, background: active ? "rgba(78,205,196,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(78,205,196,0.45)" : "rgba(255,255,255,0.08)"}`, color: active ? "#4ECDC4" : "rgba(255,255,255,0.28)", cursor: "pointer", fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{s === 0 ? "SKIP" : `${s}s`}</button>;
                                    })}
                                  </div>
                                );
                              })()}
                              <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                                {(() => {
                                  const tss = trainerSuperSel;
                                  const exKey = ex.exerciseId ?? String(ei);
                                  const isSel = tss?.dayIdx === di && tss.exIds.includes(exKey);
                                  const inGrp = !!ex.groupId;
                                  return (
                                    <>
                                      <button onClick={() => {
                                        setTrainerSuperSel(prev => {
                                          if (prev?.dayIdx !== di) return { dayIdx: di, exIds: [exKey] };
                                          const already = prev.exIds.includes(exKey);
                                          const next = already ? prev.exIds.filter(id => id !== exKey) : [...prev.exIds, exKey];
                                          return next.length === 0 ? null : { dayIdx: di, exIds: next };
                                        });
                                      }} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSel ? "#4ECDC4" : "rgba(255,255,255,0.18)"}`, background: isSel ? "#4ECDC4" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#000" }}>{isSel ? "✓" : ""}</button>
                                      {inGrp && <button onClick={() => { const gid = ex.groupId; setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : { ...day, exercises: day.exercises.map((x: any) => x.groupId === gid ? { ...x, groupId: undefined, groupType: undefined } : x) })); }} style={{ padding: "2px 8px", borderRadius: 8, fontSize: 9, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.3)", color: "#FFE66D" }}>UNGROUP ×</button>}
                                    </>
                                  );
                                })()}
                                <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                                  {(() => {
                                    const active = isDropSetMode(ex);
                                    return <button onClick={() => { setEditedPlanDays(prev => prev!.map((day, dj) => dj !== di ? day : { ...day, exercises: day.exercises.map((x: any, ej: number) => ej !== ei ? x : { ...x, dropSet: !active, dropSets: 0 }) })); }} style={{ padding: "3px 8px", borderRadius: 8, fontSize: 9, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, background: active ? "rgba(255,230,109,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "rgba(255,230,109,0.4)" : "rgba(255,255,255,0.08)"}`, color: active ? "#FFE66D" : "rgba(255,255,255,0.35)" }}>{active ? "🔻 DROP SET" : "+ DROP SET"}</button>;
                                  })()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Trainer superset CTA */}
                {trainerSuperSel && trainerSuperSel.exIds.length >= 2 && (
                  <div style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => {
                      const { dayIdx: tdi, exIds } = trainerSuperSel;
                      const gid = Math.random().toString(36).slice(2);
                      const selSet = new Set(exIds);
                      setEditedPlanDays(prev => prev!.map((day, dj) => {
                        if (dj !== tdi) return day;
                        const exArr = day.exercises;
                        const selIdxs = exArr.map((e: any, idx: number) => selSet.has(e.exerciseId ?? String(idx)) ? idx : -1).filter((idx: number) => idx >= 0).sort((a: number, b: number) => a - b);
                        const selExs = selIdxs.map((idx: number) => ({ ...exArr[idx], groupId: gid, groupType: "superset" }));
                        const restExs = exArr.filter((_: any, idx: number) => !selIdxs.includes(idx));
                        const insertAt = selIdxs[0];
                        return { ...day, exercises: [...restExs.slice(0, insertAt), ...selExs, ...restExs.slice(insertAt)] };
                      }));
                      setTrainerSuperSel(null);
                    }} style={{ flex: 1, padding: "10px", background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.4)", borderRadius: 10, color: "#4ECDC4", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                      ⟳ CREATE SUPERSET · {trainerSuperSel.exIds.length} EXERCISES
                    </button>
                    <button onClick={() => setTrainerSuperSel(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer" }}>✕</button>
                  </div>
                )}
                <button
                  onClick={proposePlan}
                  disabled={proposingPlan}
                  style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#4ECDC4,#44a08d)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: proposingPlan ? "not-allowed" : "pointer", fontFamily: "'Space Mono', monospace", opacity: proposingPlan ? 0.6 : 1, marginBottom: 8 }}
                >
                  {proposingPlan ? "SENDING…" : editedPlanDays?.[0]?.id?.startsWith("trainer-gen") ? "SEND PLAN FOR APPROVAL" : "PROPOSE TO CLIENT"}
                </button>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 8 }}>
                  {editedPlanDays?.[0]?.id?.startsWith("trainer-gen")
                    ? "Client must approve before this becomes their active plan"
                    : "Client will receive a message to accept or decline these changes"}
                </div>
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
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <img src="/ai/empty-workouts.jpg" alt="" style={{ width: 160, height: 160, opacity: 0.6, borderRadius: 14, marginBottom: 14 }} />
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No workouts logged yet</div>
                </div>
              )}
              {flatHistory.map((s: any, i: number) => {
                const sessionKey = s.id ?? `${s.dayId}-${i}`;
                const isOpen = openClientSession === sessionKey;
                const rawSets = (s.sets ?? {}) as Record<string, { weight: number; reps: number }>;

                // Group sets by exerciseId
                const byExercise: Record<string, { name: string; sets: { setNum: string; weight: number; reps: number }[] }> = {};
                for (const [k, v] of Object.entries(rawSets)) {
                  const { eid, setNum } = parseSetKey(k);
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
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <img src="/ai/empty-profile.jpg" alt="" style={{ width: 160, height: 160, opacity: 0.6, borderRadius: 14, marginBottom: 14 }} />
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No profile set up yet</div>
              </div>
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
                    const fmtEquipmentItems = (items: string[]): string[] => {
                      if (!items?.length) return [];
                      const aliases: Record<string, string> = {
                        pullup_bar: "Pull-up Bar", dip_bar: "Dip Bar",
                        resistance_band: "Resistance Band", pull_up_bar: "Pull-up Bar",
                      };
                      return items.map(e => aliases[e.toLowerCase()] ?? e.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
                    };
                    const equipItems = fmtEquipmentItems(p.equipment as string[]);
                    const rows = [
                      { label: "GOAL", value: p.goal?.replace(/_/g, " ") },
                      { label: "FITNESS LEVEL", value: p.fitnessLevel },
                      { label: "LOCATION", value: fmtLocation(p.location) },
                      { label: "FOCUS AREA", value: ((p as any).targetAreas?.filter((a: string) => a !== "none") ?? []).length > 0 ? (p as any).targetAreas.filter((a: string) => a !== "none").join(", ") : (p.targetArea && p.targetArea !== "none" ? p.targetArea : "—") },
                    ];
                    return (
                      <>
                        {rows.map((row, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>{row.label}</div>
                            <div style={{ fontSize: 13, color: "#fff", textTransform: "capitalize" }}>{row.value || "—"}</div>
                          </div>
                        ))}
                        <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>EQUIPMENT</div>
                          {equipItems.length ? equipItems.map((item, i) => (
                            <div key={i} style={{ fontSize: 13, color: "#fff", lineHeight: 1.9 }}>{item}</div>
                          )) : <div style={{ fontSize: 13, color: "#fff" }}>—</div>}
                        </div>
                      </>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

      {showHiitPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.96)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: 4, color: "#FF8C42", marginBottom: 14 }}>⚡ HIIT TRAINING</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>Add high-intensity intervals?</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 28 }}>HIIT circuits spike your heart rate, accelerate fat burn, and boost conditioning. Add them to your plan now or skip.</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>INTENSITY</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ id: "light", label: "Light" }, { id: "moderate", label: "Moderate" }, { id: "intense", label: "Intense" }].map(opt => (
                  <button key={opt.id} onClick={() => setHiitIntensity(opt.id)} style={{ flex: 1, padding: "10px 4px", background: hiitIntensity === opt.id ? "rgba(255,140,66,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${hiitIntensity === opt.id ? "rgba(255,140,66,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, color: hiitIntensity === opt.id ? "#FF8C42" : "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => applyHiitChoice("finisher", hiitIntensity)} style={{ padding: "16px 20px", background: "rgba(255,140,66,0.12)", border: "1px solid rgba(255,140,66,0.35)", borderRadius: 14, color: "#FF8C42", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>⚡ Circuit Finisher</div>
                <div style={{ fontSize: 12, color: "rgba(255,140,66,0.65)", fontWeight: 400 }}>Added at the end of each workout day</div>
              </button>
              <button onClick={() => applyHiitChoice("dedicated_day", hiitIntensity)} style={{ padding: "16px 20px", background: "rgba(255,140,66,0.07)", border: "1px solid rgba(255,140,66,0.2)", borderRadius: 14, color: "rgba(255,140,66,0.8)", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>🔥 Dedicated Day</div>
                <div style={{ fontSize: 12, color: "rgba(255,140,66,0.5)", fontWeight: 400 }}>A separate HIIT & conditioning session</div>
              </button>
              <button onClick={() => applyHiitChoice("none", hiitIntensity)} style={{ padding: "14px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", textAlign: "left" }}>Not now — I'll add it later from settings</button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  // ─── MESSAGES LIST ──────────────────────────────────────────────────
  if (view === "messages") return (
    <div key="messages" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", paddingBottom: safeBot, minHeight: "100dvh" }}>
      <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontWeight: 500, fontFamily: "'Space Mono', monospace" }}>MESSAGES</div>
      </div>
      <div style={{ padding: "0 20px" }}>
        {conversations.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <img src="/ai/empty-messages.jpg" alt="" style={{ width: 160, height: 160, opacity: 0.55, borderRadius: 14, marginBottom: 14 }} />
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No messages yet</div>
          </div>
        )}
        {conversations.map(c => {
          const lm = c.latestMessage;
          const isSentByMe = lm?.fromId === user?.id;
          const previewTick = isSentByMe
            ? lm.read ? { label: "✓✓", color: "#4ECDC4" }
            : lm.delivered ? { label: "✓✓", color: "rgba(255,255,255,0.4)" }
            : { label: "✓", color: "rgba(255,255,255,0.25)" }
            : null;
          return (
          <div key={c.partner.id} className="card-hover" onClick={() => openConversation(c.partner)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${c.unreadCount > 0 ? "rgba(78,205,196,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: "16px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>@{c.partner.username}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                {previewTick && <span style={{ color: previewTick.color, letterSpacing: -2, paddingRight: 2, flexShrink: 0 }}>{previewTick.label}</span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lm.type === "adoption_request" ? "Trainer request" : lm.type === "plan_proposal" ? "Plan update proposed" : lm.body}
                </span>
              </div>
            </div>
            {c.unreadCount > 0 && (
              <span style={{ background: "#4ECDC4", color: "#000", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono', monospace", flexShrink: 0, marginLeft: 12 }}>{c.unreadCount}</span>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );

  // ─── CONVERSATION ────────────────────────────────────────────────────
  let _viewKey: string = view;
  let _content: React.ReactNode = null;
  if (view === "conversation" && activeConversation) { _viewKey = `conv-${activeConversation.id}`; _content = (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {(() => {
        const isOnline = partnerLastSeen && (Date.now() - new Date(partnerLastSeen).getTime()) < 2 * 60 * 1000;
        const lastSeenText = (() => {
          if (!partnerLastSeen) return null;
          const diff = Math.floor((Date.now() - new Date(partnerLastSeen).getTime()) / 1000);
          if (diff < 120) return null;
          if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
          if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
          return new Date(partnerLastSeen).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        })();
        return (
          <div style={{ padding: "24px 20px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <button onClick={() => { setView("messages"); setActiveConversation(null); setReplyingTo(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Back</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 7 }}>
                @{activeConversation.username}
                {isOnline && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ecc71", display: "inline-block", flexShrink: 0 }} />}
              </div>
              {!isOnline && lastSeenText && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Last seen {lastSeenText}</div>
              )}
              {isOnline && <div style={{ fontSize: 11, color: "#2ecc71", marginTop: 1 }}>Online</div>}
            </div>
          </div>
        );
      })()}
      <div ref={messagesContainerRef} onClick={() => setReactingToMsgId(null)} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {conversationMessages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <img src="/ai/empty-messages.jpg" alt="" style={{ width: 140, height: 140, opacity: 0.5, borderRadius: 14, marginBottom: 12 }} />
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No messages yet</div>
          </div>
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
          const tickColor = msg.read ? "#4ECDC4" : msg.delivered ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)";
          // Group reactions by emoji
          const reactionGroups: Record<string, { count: number; iMine: boolean }> = {};
          for (const r of (msg.reactions ?? [])) {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, iMine: false };
            reactionGroups[r.emoji].count++;
            if (r.userId === user.id) reactionGroups[r.emoji].iMine = true;
          }
          // Swipe-to-reply + long-press-to-react
          const onTouchStart = (e: React.TouchEvent) => {
            const el = e.currentTarget as HTMLElement;
            el.dataset.sx = String(e.touches[0].clientX);
            el.dataset.sy = String(e.touches[0].clientY);
            el.dataset.swiping = "1";
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
            longPressTimer.current = setTimeout(() => {
              setReactingToMsgId(msg.id);
              el.dataset.swiping = "0";
            }, 500);
          };
          const onTouchMove = (e: React.TouchEvent) => {
            const el = e.currentTarget as HTMLElement;
            if (!el.dataset.swiping || el.dataset.swiping === "0") return;
            const dx = e.touches[0].clientX - Number(el.dataset.sx);
            const dy = e.touches[0].clientY - Number(el.dataset.sy);
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
            }
            const clamped = Math.max(0, Math.min(72, dx));
            el.style.transform = `translateX(${clamped}px)`;
            el.style.transition = "none";
          };
          const onTouchEnd = (e: React.TouchEvent) => {
            const el = e.currentTarget as HTMLElement;
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
            if (!el.dataset.swiping || el.dataset.swiping === "0") { el.style.transition = "transform 0.2s ease"; el.style.transform = "translateX(0)"; return; }
            delete el.dataset.swiping;
            const dx = e.changedTouches[0].clientX - Number(el.dataset.sx);
            el.style.transition = "transform 0.2s ease";
            el.style.transform = "translateX(0)";
            if (dx > 48) setReplyingTo({ id: msg.id, body: msg.body, username: msg.from.username });
          };
          const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "💪", "🔥"];
          return (
            <div key={msg.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", position: "relative", maxWidth: "75%" }}>
              {/* Reply arrow — fades in as user swipes */}
              <div style={{ position: "absolute", left: isMine ? "auto" : -28, right: isMine ? -28 : "auto", top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "rgba(78,205,196,0.7)", pointerEvents: "none" }}>↩</div>
              {/* Emoji picker — shown on long-press */}
              <AnimatePresence>
              {reactingToMsgId === msg.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 6 }}
                  transition={{ duration: 0.15 }}
                  style={{ position: "absolute", bottom: "calc(100% + 6px)", [isMine ? "right" : "left"]: 0, zIndex: 20, background: "rgba(30,30,38,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "6px 10px", display: "flex", gap: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                >
                  {QUICK_EMOJIS.map(em => (
                    <button key={em} onClick={() => toggleReaction(msg.id, em)} style={{ background: reactionGroups[em]?.iMine ? "rgba(78,205,196,0.18)" : "none", border: "none", borderRadius: 16, padding: "4px 5px", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>{em}</button>
                  ))}
                </motion.div>
              )}
              </AnimatePresence>
              <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ background: isMine ? "rgba(78,205,196,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${isMine ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", willChange: "transform" }}
              >
                {/* Quoted reply preview */}
                {msg.replyTo && (
                  <div style={{ borderLeft: "3px solid rgba(78,205,196,0.5)", paddingLeft: 8, marginBottom: 6, opacity: 0.7 }}>
                    <div style={{ fontSize: 10, color: "#4ECDC4", fontWeight: 600, marginBottom: 2 }}>@{msg.replyTo.from.username}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{msg.replyTo.body}</div>
                  </div>
                )}
                <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.4 }}>{renderBody(msg.body)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, display: "flex", alignItems: "center", justifyContent: isMine ? "flex-end" : "flex-start", gap: 4 }}>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {isMine && (
                    <span style={{ color: tickColor, fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center" }}>
                      {msg.read || msg.delivered ? <span style={{ letterSpacing: -3, paddingRight: 3 }}>✓✓</span> : <span>✓</span>}
                    </span>
                  )}
                </div>
              </div>
              {/* Reaction pills */}
              {Object.keys(reactionGroups).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  {Object.entries(reactionGroups).map(([em, { count, iMine }]) => (
                    <button key={em} onClick={() => toggleReaction(msg.id, em)} style={{ background: iMine ? "rgba(78,205,196,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${iMine ? "rgba(78,205,196,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "2px 7px", fontSize: 13, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Sans', sans-serif" }}>
                      {em}{count > 1 && <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {/* Reply preview strip */}
        <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden", background: "rgba(78,205,196,0.06)", borderBottom: "1px solid rgba(78,205,196,0.12)", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#4ECDC4", fontWeight: 600, marginBottom: 2 }}>Replying to @{replyingTo.username}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyingTo.body}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 18, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>×</button>
          </motion.div>
        )}
        </AnimatePresence>
        <div style={{ padding: "12px 20px 32px", display: "flex", gap: 8 }}>
          <input
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : "Message…"}
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "13px 16px", outline: "none" }}
          />
          <button onClick={sendMessage} disabled={sendingMessage || !messageText.trim()} style={{ padding: "13px 18px", background: messageText.trim() ? "#4ECDC4" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 12, color: messageText.trim() ? "#000" : "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: messageText.trim() ? "pointer" : "default", fontFamily: "'Space Mono', monospace", transition: "all 0.15s" }}>SEND</button>
        </div>
      </div>
    </div>
  );
  }

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
      <div key="settings" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", paddingBottom: safeBot }}>
        <div style={{ padding: "24px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4, color: "rgba(255,255,255,0.4)" }}>ACCOUNT</div>
        </div>

        <div style={{ padding: "0 20px" }}>

          {/* ── THEME ── */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, fontFamily: "'Space Mono', monospace", marginBottom: 14 }}>THEME</div>

            {/* Theme selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
              {([
                { id: "iron",  label: "IRON",  desc: "Dark & bold",        icon: "⚡", accent: "#FF6B6B" },
                { id: "mono",  label: "MONO",  desc: "Clean & minimal",    icon: "▣",  accent: "#ffffff" },
                { id: "vivid", label: "VIVID", desc: "Colour & energy",    icon: "✦",  accent: "#e040fb" },
              ] as const).map(t => {
                const active = appTheme === t.id;
                return (
                  <button key={t.id} onClick={() => changeTheme(t.id)} style={{ background: active ? `rgba(${t.id === "iron" ? "255,107,107" : t.id === "mono" ? "255,255,255" : "224,64,251"},0.1)` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? (t.id === "iron" ? "rgba(255,107,107,0.45)" : t.id === "mono" ? "rgba(255,255,255,0.35)" : "rgba(224,64,251,0.45)") : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "12px 8px", cursor: "pointer", textAlign: "center" as const, transition: "all 0.2s" }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: active ? (t.id === "iron" ? "#FF6B6B" : t.id === "mono" ? "#ffffff" : "#e040fb") : "rgba(255,255,255,0.45)", marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Accent colour */}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 10 }}>ACCENT COLOUR</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {["#FF6B6B","#FF8C42","#FFCA28","#4ECDC4","#40C4FF","#e040fb","#69F0AE","#fff"].map(c => (
                <button key={c} onClick={() => changeAccent(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: accentColor === c ? "2px solid #fff" : "2px solid transparent", boxShadow: accentColor === c ? `0 0 0 1px ${c}` : "none", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }} />
              ))}
              {/* Custom colour picker */}
              <label style={{ position: "relative", width: 28, height: 28, borderRadius: "50%", border: "1.5px dashed rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1 }}>+</span>
                <input type="color" value={accentColor} onChange={e => changeAccent(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
              </label>
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{accentColor.toUpperCase()}</span>
              {accentColor !== "#FF6B6B" && <button onClick={() => changeAccent("#FF6B6B")} style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>RESET</button>}
            </div>
          </div>

          {/* Profile card */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 12 }}>PROFILE</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <img src="/ai/avatar-default.png" alt="" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,107,107,0.3), 0 6px 18px rgba(255,107,107,0.18)" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>@{user.username}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Member since registration</div>
                </div>
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
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <img src="/ai/empty-profile.jpg" alt="" style={{ width: 130, height: 130, opacity: 0.5, borderRadius: 14, marginBottom: 10 }} />
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No profile set up yet — tap EDIT to add your details</div>
                </div>
              )
            ) : (
              <div>
                {[
                  { label: "Height (cm)", key: "heightCm", type: "number", placeholder: "e.g. 178" },
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
                <div style={{ padding: "14px 16px", background: "rgba(78,205,196,0.05)", border: "1px dashed rgba(78,205,196,0.25)", borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, marginBottom: 10 }}>
                    Weight and body fat are logged as recordings over time. Add a new entry to update them.
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingProfile(false); goTo("progress"); setProgressTab("body"); }}
                    style={{ width: "100%", padding: "10px", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.35)", borderRadius: 10, color: "#4ECDC4", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
                  >LOG NEW WEIGHT / BODY FAT →</button>
                </div>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["newcomer", "beginner", "intermediate", "advanced"].map(l => (
                      <button key={l} onClick={() => setOb(o => ({ ...o, fitnessLevel: l }))} style={{ flex: "1 0 auto", padding: "10px 4px", background: ob.fitnessLevel === l ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${ob.fitnessLevel === l ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: ob.fitnessLevel === l ? "#FF6B6B" : "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer", textTransform: "capitalize" }}>{l}</button>
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
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8 }}>EQUIPMENT</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {EQUIPMENT_OPTIONS
                      .filter((e: any) => ob.location === "gym" ? e.gym : ob.location === "home" ? e.home : true)
                      .map((e: any) => {
                        const has = ob.equipment.includes(e.id);
                        return (
                          <div key={e.id}>
                            <button onClick={() => toggleEquip(e.id)} style={{ width: "100%", padding: "10px 14px", background: has ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${has ? "rgba(255,107,107,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: has ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                              <span>{e.label}</span>
                              {e.subOptions ? <span style={{ fontSize: 10, opacity: 0.6 }}>{has ? "▲" : "▼"}</span> : has ? <span>✓</span> : null}
                            </button>
                            {e.subOptions && has && (
                              <div style={{ marginLeft: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                                {e.subOptions.map((sub: any) => {
                                  const subHas = ob.equipment.includes(sub.id);
                                  return (
                                    <button key={sub.id} onClick={() => toggleEquip(sub.id)} style={{ width: "100%", padding: "8px 12px", background: subHas ? "rgba(255,107,107,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${subHas ? "rgba(255,107,107,0.3)" : "rgba(255,255,255,0.05)"}`, borderRadius: 8, color: subHas ? "#FF6B6B" : "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                                      <span>{sub.label}</span>{subHas && <span>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
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
                      const sel = ob.targetAreas.includes(t.id);
                      return (
                        <button key={t.id} onClick={() => {
                          setOb(o => {
                            if (t.id === "none") return { ...o, targetAreas: sel ? [] : ["none"] };
                            const without = o.targetAreas.filter(x => x !== "none" && x !== t.id);
                            return { ...o, targetAreas: sel ? without : [...without, t.id] };
                          });
                        }} style={{ padding: "9px 14px", background: sel ? "rgba(255,107,107,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: sel ? "#FF6B6B" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
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
                          daysPerWeek: ob.daysPerWeek, targetAreas: ob.targetAreas,
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

          {/* HIIT Training Preferences */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 3, marginBottom: 16, fontFamily: "'Space Mono', monospace" }}>⚡ HIIT TRAINING</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>INTENSITY</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ id: "light", label: "Light" }, { id: "moderate", label: "Moderate" }, { id: "intense", label: "Intense" }].map(opt => (
                  <button key={opt.id} onClick={() => { setHiitIntensity(opt.id); fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hiitPreference: hiitPreference || "none", hiitIntensity: opt.id }) }).catch(() => {}); }} style={{ flex: 1, padding: "10px 4px", background: hiitIntensity === opt.id ? "rgba(255,140,66,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${hiitIntensity === opt.id ? "rgba(255,140,66,0.4)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: hiitIntensity === opt.id ? "#FF8C42" : "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer", textTransform: "capitalize" }}>{opt.label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>MODE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { id: "finisher", label: "Circuit Finisher", desc: "Added at the end of each workout day" },
                  { id: "dedicated_day", label: "Dedicated Day", desc: "A separate HIIT & conditioning session" },
                  { id: "none", label: "None", desc: "No HIIT in your plan" },
                ].map(opt => {
                  const sel = hiitPreference === opt.id;
                  return (
                    <button key={opt.id} onClick={() => { setHiitPreference(opt.id); fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hiitPreference: opt.id, hiitIntensity: hiitIntensity || "moderate" }) }).catch(() => {}); }} style={{ padding: "10px 14px", background: sel ? "rgba(255,140,66,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel ? "rgba(255,140,66,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, color: sel ? "#FF8C42" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: sel ? "rgba(255,140,66,0.55)" : "rgba(255,255,255,0.25)", marginTop: 2 }}>{opt.desc}</div>
                      </div>
                      {sel && <span style={{ color: "#FF8C42" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
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

          {/* Send feedback */}
          <SendFeedbackCard username={user?.username || ""} />

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
      if (customPlan) for (const d of customPlan as any[]) for (const e of (d.exercises ?? [])) if ((e.exerciseId ?? e.id) === eid) return e.name;
      const libEx = (EXERCISES as any[]).find((e: any) => e.id === eid);
      if (libEx) return libEx.name;
      return eid;
    };

    // Get top PRs
    const prList = Object.entries(overall.exercisePRs)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 8);

    // Day labels for 28-day calendar
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <div key="progress" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", paddingBottom: safeBot, minHeight: "100dvh", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: "-20%", right: "-20%", pointerEvents: "none", overflow: "hidden" }}>
          {Array.from({ length: 16 }).map((_, n) => (
            <div key={n} style={{ fontSize: 52, fontWeight: 800, color: "#fff", opacity: 0.022, fontFamily: "'DM Sans', sans-serif", letterSpacing: -1, whiteSpace: "nowrap", transform: "rotate(-18deg)", marginBottom: 48, userSelect: "none" }}>{phrase}</div>
          ))}
        </div>
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
            {/* Tier Card */}
            {user.role === "user" && (() => {
              const tier = getClientTier(overall.totalSessions, overall.streak, Object.keys(overall.exercisePRs).length);
              const tierIdx = CLIENT_TIERS.findIndex(t => t.label === tier.label);
              const next = CLIENT_TIERS[tierIdx + 1];
              const curMin = CLIENT_TIERS[tierIdx].min;
              const progress = next ? Math.min(1, Math.max(0, (overall.totalSessions - curMin) / (next.min - curMin))) : 1;
              return (
                <div style={{ position: "relative", background: "linear-gradient(135deg, rgba(240,192,64,0.10), rgba(225,112,85,0.04) 60%, rgba(240,192,64,0.02))", border: "1px solid rgba(240,192,64,0.22)", borderRadius: 16, padding: "18px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 18, overflow: "hidden", boxShadow: "0 4px 24px -8px rgba(240,192,64,0.18), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                  <div aria-hidden className="tier-shine" />
                  <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,192,64,0.18), transparent 70%)", pointerEvents: "none" }} />
                  <div style={{ fontSize: 44, lineHeight: 1, filter: "drop-shadow(0 2px 8px rgba(240,192,64,0.35))" }}>{tier.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#f0c040", letterSpacing: 0.3 }}>{tier.label}</div>
                      {next && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{Math.max(0, overall.totalSessions - curMin)}/{next.min - curMin}</div>}
                    </div>
                    <div style={{ height: 5, background: "rgba(240,192,64,0.10)", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)" }}>
                      <div className="bar-grow" style={{ height: "100%", width: `${progress * 100}%`, background: "linear-gradient(90deg, #f0c040, #e17055)", borderRadius: 3, boxShadow: "0 0 12px rgba(240,192,64,0.55)" }} />
                    </div>
                    {next && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 6, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>NEXT: {next.emoji} {next.label.toUpperCase()}</div>}
                    {!next && <div style={{ fontSize: 9, color: "#f0c040", marginTop: 6, fontFamily: "'Space Mono', monospace", letterSpacing: 2, fontWeight: 700 }}>MAX RANK — ABSOLUTE UNIT</div>}
                  </div>
                </div>
              );
            })()}
            {/* Overview Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "THIS WEEK", value: `${overall.thisWeek}/5`, color: overall.thisWeek >= 5 ? "#2ecc71" : overall.thisWeek >= 3 ? "#f0c040" : "#FF6B6B" },
                { label: "STREAK", value: `${overall.streak}w`, color: "#4ECDC4" },
                { label: "AVG TIME", value: overall.avgMinutes > 0 ? `${overall.avgMinutes}m` : "—", color: "#A29BFE" },
              ].map((card, i) => (
                <div key={i} style={{
                  position: "relative", overflow: "hidden",
                  background: `linear-gradient(180deg, ${card.color}10, rgba(255,255,255,0.02))`,
                  border: `1px solid ${card.color}22`,
                  borderRadius: 14, padding: "16px 12px", textAlign: "center",
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 12px -6px ${card.color}30`,
                }}>
                  <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`, opacity: 0.5 }} />
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", letterSpacing: -0.5 }}>{card.value}</div>
                  <div style={{ fontSize: 8, color: card.color, letterSpacing: 2, marginTop: 4, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{card.label}</div>
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
                      <div key={i}
                        onClick={() => day.active ? setCalDateSel(calDateSel === day.date ? null : day.date) : undefined}
                        style={{
                          aspectRatio: "1", borderRadius: 7, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          background: calDateSel === day.date ? "linear-gradient(135deg, #fff, #f5f5f5)" : day.active ? "linear-gradient(135deg, #FF6B6B, #ee5a24)" : "rgba(255,255,255,0.03)",
                          border: day.isToday ? "1px solid rgba(255,255,255,0.45)" : calDateSel === day.date ? "1px solid rgba(255,255,255,0.6)" : "1px solid transparent",
                          opacity: day.active || day.isToday ? 1 : 0.35,
                          cursor: day.active ? "pointer" : "default",
                          boxShadow: calDateSel === day.date ? "0 0 16px rgba(255,255,255,0.35)" : day.active ? "0 2px 8px -2px rgba(255,107,107,0.35), inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
                          transition: "transform 0.15s ease, box-shadow 0.2s ease",
                          transform: calDateSel === day.date ? "scale(1.08)" : "scale(1)",
                        }}>
                        <div style={{
                          fontSize: 10, fontWeight: day.isToday ? 700 : 500,
                          fontFamily: "'Space Mono', monospace",
                          color: calDateSel === day.date ? "#111" : day.active ? "#fff" : day.isToday ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                        }}>{dateNums[i]}</div>
                        {day.hasIntensity && <div style={{ fontSize: 7, lineHeight: 1, marginTop: 1 }}>⚡</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Calendar Session Recap */}
            {calDateSel && (() => {
              const dateLabel = new Date(calDateSel + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
              const daySessions: { dayId: string; session: any }[] = [];
              for (const [dayId, sessions] of Object.entries(history)) {
                for (const s of sessions as any[]) {
                  if (s.date === calDateSel) daySessions.push({ dayId, session: s });
                }
              }
              return (
                <div className="fade-in" style={{ position: "relative", overflow: "hidden", background: "linear-gradient(180deg, rgba(255,107,107,0.05), rgba(255,255,255,0.02))", border: "1px solid rgba(255,107,107,0.18)", borderRadius: 16, padding: "18px", marginBottom: 12, boxShadow: "0 4px 20px -8px rgba(255,107,107,0.18)" }}>
                  <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,107,107,0.5), transparent)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#FF6B6B", letterSpacing: 2.5, fontFamily: "'Space Mono', monospace", fontWeight: 700, marginBottom: 4 }}>SESSION RECAP</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{dateLabel}</div>
                    </div>
                    <button onClick={() => setCalDateSel(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                  </div>
                  {daySessions.map(({ dayId, session }, si) => {
                    const dayName = findExName(dayId) !== dayId ? findExName(dayId) : (() => {
                      for (const d of WORKOUT_DATA) if (d.id === dayId) return d.title;
                      if (customPlan) for (const d of customPlan as any[]) if (d.id === dayId) return d.title;
                      return dayId;
                    })();
                    const rawSets = (session.sets ?? {}) as Record<string, { weight: number; reps: number }>;
                    const byEx: Record<string, { name: string; sets: { sn: string; weight: number; reps: number }[] }> = {};
                    for (const [k, v] of Object.entries(rawSets)) {
                      const { eid, setNum: sn } = parseSetKey(k);
                      if (!byEx[eid]) byEx[eid] = { name: findExName(eid), sets: [] };
                      byEx[eid].sets.push({ sn, weight: v.weight, reps: v.reps });
                    }
                    for (const ex of Object.values(byEx)) ex.sets.sort((a, b) => Number(a.sn) - Number(b.sn));
                    return (
                      <div key={si} style={{ marginBottom: si < daySessions.length - 1 ? 16 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{dayName}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", background: "rgba(255,255,255,0.04)", padding: "2px 7px", borderRadius: 4 }}>{session.duration}</div>
                        </div>
                        {Object.entries(byEx).map(([eid, ex]) => (
                          <div key={eid} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: "#fff", fontWeight: 500, marginBottom: 5 }}>{ex.name}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {ex.sets.map(set => (
                                <div key={set.sn} style={{ fontSize: 10, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", fontFamily: "'Space Mono', monospace" }}>
                                  {set.weight > 0 ? `${set.weight}kg × ${set.reps}` : `${set.reps} reps`}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {daySessions.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No session data for this date.</div>}
                </div>
              );
            })()}

            {/* Personal Records */}
            {prList.length > 0 && (
              <div style={{ position: "relative", background: "linear-gradient(180deg, rgba(240,192,64,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(240,192,64,0.14)", borderRadius: 16, padding: "18px", marginBottom: 12, overflow: "hidden", boxShadow: "0 4px 20px -8px rgba(240,192,64,0.12)" }}>
                <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(240,192,64,0.5), transparent)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 15, filter: "drop-shadow(0 0 6px rgba(240,192,64,0.5))" }}>🏆</span>
                  <span style={{ fontSize: 10, color: "#f0c040", letterSpacing: 2.5, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>PERSONAL BESTS</span>
                </div>
                {prList.map(([eid, pr], i) => {
                  const exName = findExName(eid);
                  const imgUrl = getExerciseImageUrls(eid, exName);
                  return (
                  <div key={eid} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 4px 10px 8px",
                    borderLeft: "2px solid rgba(240,192,64,0.25)",
                    marginLeft: -8,
                    borderBottom: i < prList.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {imgUrl ? (
                        <img src={imgUrl[0]} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.06)" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,107,107,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏋️</div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>🏆 {exName}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{pr.date}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0c040", fontFamily: "'Space Mono', monospace" }}>
                        {pr.weight}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>kg</span>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginTop: 1 }}>× {pr.reps} reps</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* My Leaderboards (client) */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={async () => {
                  if (showMyLeaderboards) { setShowMyLeaderboards(false); return; }
                  setMyLeaderboardsLoading(true);
                  setShowMyLeaderboards(true);
                  try {
                    const res = await fetch("/api/leaderboard/mine");
                    const data = await res.json();
                    if (data.groups) setMyLeaderboards(data.groups);
                  } catch {}
                  setMyLeaderboardsLoading(false);
                }}
                style={{ width: "100%", padding: "14px 18px", background: showMyLeaderboards ? "rgba(255,230,109,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${showMyLeaderboards ? "rgba(255,230,109,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, color: showMyLeaderboards ? "#FFE66D" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box" }}
              >
                <span style={{ fontSize: 18 }}>🏆</span>
                <span>My Leaderboards</span>
                <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.15)", fontSize: 14 }}>{showMyLeaderboards ? "▲" : "▼"}</span>
              </button>
              {showMyLeaderboards && (
                <div className="fade-in" style={{ marginTop: 8 }}>
                  {myLeaderboardsLoading ? (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Loading…</div>
                  ) : myLeaderboards.length === 0 ? (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "20px 0" }}>You haven't been added to any leaderboard yet</div>
                  ) : (
                    myLeaderboards.map((grp: any) => (
                      <div key={grp.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFE66D" }}>{grp.name}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{grp.members?.length ?? 0} participants</div>
                        </div>
                        {/* Leaderboard rows */}
                        {grp.leaderboard?.map((entry: any, idx: number) => {
                          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                          const isMe = entry.userId === user.id;
                          return (
                            <div key={entry.userId} style={{ display: "grid", gridTemplateColumns: "28px 1fr 48px 48px", gap: 8, padding: "10px 12px", borderBottom: idx < grp.leaderboard.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: isMe ? "rgba(255,230,109,0.04)" : "transparent" }}>
                              <div style={{ fontSize: 13, display: "flex", alignItems: "center" }}>{medal ?? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>{idx + 1}</span>}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? "#FFE66D" : "#fff" }}>@{entry.username}{isMe ? " (you)" : ""}</div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{entry.tier?.emoji} {entry.tier?.label}</div>
                              </div>
                              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{entry.totalSessions}</div>
                                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>sess</div>
                              </div>
                              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: (entry.totalIntensityPoints ?? 0) > 0 ? "#FFE66D" : "rgba(255,255,255,0.3)" }}>{entry.totalIntensityPoints ?? 0}</div>
                                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>⚡ IP</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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
                      {(() => {
                        const byEx: Record<string, { name: string; sets: { sn: string; w: number; r: number }[] }> = {};
                        for (const [k, v] of Object.entries(s.sets as Record<string, { weight: number; reps: number }>)) {
                          const { eid, setNum: sn } = parseSetKey(k);
                          if (!byEx[eid]) byEx[eid] = { name: findExName(eid), sets: [] };
                          byEx[eid].sets.push({ sn, w: v.weight, r: v.reps });
                        }
                        for (const ex of Object.values(byEx)) ex.sets.sort((a, b) => Number(a.sn) - Number(b.sn));
                        return Object.entries(byEx).map(([eid, ex]) => (
                          <div key={eid} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{ex.name}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {ex.sets.map(set => (
                                <div key={set.sn} style={{ fontSize: 10, color: "#fff", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 7px", fontFamily: "'Space Mono', monospace" }}>
                                  {set.w > 0 ? `${set.w}kg × ${set.r}` : `${set.r} reps`}
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
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

            {showGoalCelebration && (
              <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(16px)" }} onClick={() => setShowGoalCelebration(false)}>
                <div className="goal-celeb-pop" onClick={e => e.stopPropagation()} style={{ background: "rgba(12,12,15,0.95)", border: "1px solid rgba(255,215,0,0.35)", borderRadius: 24, padding: "32px 28px", maxWidth: 320, width: "90%", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div className="goal-celeb-shine" style={{ position: "absolute", top: 0, left: "-60%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.1), transparent)", pointerEvents: "none" }} />
                  <div className="goal-celeb-icon" style={{ fontSize: 52, marginBottom: 8 }}>🎯</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD700", letterSpacing: 3, fontFamily: "'Space Mono', monospace", marginBottom: 6 }}>GOAL REACHED</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20, lineHeight: 1.6 }}>
                    {goalCelebDetails.map((g, i) => (
                      <div key={i} style={{ color: "#fff", fontWeight: 600 }}>
                        {g.type === 'weight' ? `${g.value}kg` : `${g.value}% body fat`}
                        <span style={{ color: "#4ECDC4", fontSize: 11, marginLeft: 6 }}>✓ {g.target}{g.type === 'weight' ? 'kg' : '%'} target</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.5 }}>You crushed it. Time to set your next target.</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setShowGoalCelebration(false); setEditingGoals(true); }} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg, #FFD700, #f39c12)", border: "none", borderRadius: 12, color: "#000", fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>SET NEW GOAL</button>
                    <button onClick={() => setShowGoalCelebration(false)} style={{ padding: "13px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Done</button>
                  </div>
                </div>
              </div>
            )}

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
                              <div className="bar-grow" style={{ height: "100%", background: "linear-gradient(90deg,#4ECDC4,#44a08d)", borderRadius: 3, width: `${100 - Math.min(100, Math.abs(diff / ((weightData[0] ?? targetW) - targetW + 0.001)) * 100)}%`, minWidth: diff === 0 ? "100%" : "4px" }} />
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
                              <div className="bar-grow" style={{ height: "100%", background: "linear-gradient(90deg,#A29BFE,#9b59b6)", borderRadius: 3, width: `${100 - Math.min(100, Math.abs(diff / ((bfData[0] ?? targetBf) - targetBf + 0.001)) * 100)}%`, minWidth: diff === 0 ? "100%" : "4px" }} />
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
                      <BodyTrendChart items={weightItems} color="#4ECDC4" unit="kg" goal={targetW ?? undefined} />
                    </div>
                  )}
                  {bfItems.length >= 2 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>BODY FAT TREND</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#A29BFE", fontFamily: "'Space Mono', monospace" }}>{bfItems[bfItems.length - 1].value.toFixed(1)}%</div>
                      </div>
                      <BodyTrendChart items={bfItems} color="#A29BFE" unit="%" goal={targetBf ?? undefined} />
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
        <div key="workout-prep" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "80vw", borderRadius: "50%", background: `radial-gradient(circle, ${activeDay.color}12 0%, transparent 60%)`, pointerEvents: "none", animation: "breathe 4s ease infinite" }} />
          <div aria-hidden style={{ position: "absolute", top: "10%", left: "-20%", right: "-20%", pointerEvents: "none", overflow: "hidden" }}>
            {[0, 1, 2, 3].map(n => (
              <div key={n} style={{ fontSize: 52, fontWeight: 800, color: "#fff", opacity: 0.03, fontFamily: "'DM Sans', sans-serif", letterSpacing: -1, whiteSpace: "nowrap", transform: "rotate(-18deg)", marginBottom: 48, userSelect: "none" }}>{phrase}</div>
            ))}
          </div>
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
      <div key="workout-session" className="view-forward" style={{ maxWidth: 480, margin: "0 auto", paddingBottom: safeBot, minHeight: "100dvh" }}>
        {newPBs.length > 0 && !rest.running && (
          <div className="pb-overlay" onClick={() => setNewPBs([])} style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", cursor: "pointer" }}>
            <div className="pb-pop" style={{ background: "rgba(12,12,15,0.9)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 20, padding: "28px 32px", maxWidth: 300, width: "90%", textAlign: "center", backdropFilter: "blur(20px)", overflow: "hidden", position: "relative" }}>
              <div className="pb-shine" style={{ position: "absolute", top: 0, left: "-60%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)" }} />
              <img src="/ai/pb-celebration.png" alt="" className="trophy-bounce" style={{ width: 96, height: 96, display: "block", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FFD700", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>PERSONAL BEST{newPBs.length > 1 ? "S" : ""}</div>
              {newPBs.map((pb, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{pb.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,215,0,0.7)", fontFamily: "'Space Mono', monospace" }}>{pb.weight}kg × {pb.reps}</div>
                </div>
              ))}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 14, fontFamily: "'DM Sans', sans-serif" }}>Tap to dismiss</div>
            </div>
          </div>
        )}
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
                {Object.entries(editSets).sort(([a], [b]) => {
                  const pa = parseSetKey(a), pb = parseSetKey(b);
                  const da = parseInt(pa.setNum) || 0, db = parseInt(pb.setNum) || 0;
                  return da !== db ? da - db : (pa.dropNum ?? 0) - (pb.dropNum ?? 0);
                }).map(([k, v]) => {
                  const { setNum: sn, dropNum } = parseSetKey(k);
                  const isSkipped = !!v.skipped;
                  return (
                    <div key={k} style={{ background: isSkipped ? "rgba(255,107,107,0.04)" : "rgba(255,255,255,0.04)", border: `1px solid ${isSkipped ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "16px", marginBottom: 8, opacity: isSkipped ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>SET {sn}{dropNum ? ` · DROP ${dropNum}` : ""}</div>
                          {isSkipped && <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,107,107,0.6)", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 4, padding: "1px 5px", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>SKIPPED</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isSkipped && <button onClick={() => setEditSets(prev => ({ ...prev, [k]: { weight: 0, reps: 0 } }))} style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)", borderRadius: 8, color: "#2ecc71", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>RESTORE</button>}
                          <button onClick={() => setEditSets(prev => { const next = { ...prev }; delete next[k]; return next; })} style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "#FF6B6B", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>DELETE</button>
                        </div>
                      </div>
                      {!isSkipped && (
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
                      )}
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
          const rawPrimary = formPreview.muscles;
          const rawSecondary = formPreview.secondaryMuscles ?? [];
          // If exercise isn't in the library by name, derive broad muscle names from sub-muscle detail keys
          const detFb = rawPrimary.length === 0 ? lookupMuscleDetail(formPreview.id, formPreview.name) : null;
          const primary = rawPrimary.length > 0 ? rawPrimary
            : (detFb?.p ?? []).map((k: string) => k.split("-")[0]).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
          const secondary = rawSecondary.length > 0 ? rawSecondary
            : (detFb?.s ?? []).map((k: string) => k.split("-")[0]).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
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
                  <>
                    {urls && !formImgError ? (
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
                      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, overflow: "hidden", position: "relative" }}>
                        <img src="/ai/form-fallback.jpg" alt="" style={{ width: "100%", display: "block", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "0 16px 14px", background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.75))", gap: 4 }}>
                          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, fontFamily: "'Space Mono', monospace" }}>NO FORM DEMO</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Search YouTube for &ldquo;{formPreview.name} form&rdquo;</div>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const cues = getFormCues(formPreview.id, formPreview.name);
                      if (!cues) return null;
                      return (
                        <div style={{ marginTop: 14, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", marginBottom: 2 }}>FORM CUES</div>
                          {cues.map((cue, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 9, background: "rgba(255,100,68,0.15)", border: "1px solid rgba(255,100,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#FF6644", fontFamily: "'Space Mono', monospace", marginTop: 1 }}>{i + 1}</div>
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>{cue}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
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

                {/* Slide tab nav */}
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button onClick={() => setModalSlide(0)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${modalSlide === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.07)"}`, background: modalSlide === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.02)", color: modalSlide === 0 ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", transition: "all 0.2s" }}>
                    FORM DEMO
                  </button>
                  <button onClick={() => setModalSlide(1)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${modalSlide === 1 ? "rgba(255,100,68,0.45)" : "rgba(255,255,255,0.07)"}`, background: modalSlide === 1 ? "rgba(255,100,68,0.1)" : "rgba(255,255,255,0.02)", color: modalSlide === 1 ? "#FF6644" : "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 1.5, fontFamily: "'Space Mono', monospace", transition: "all 0.2s" }}>
                    MUSCLES
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "center", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                  TAP OUTSIDE TO CLOSE
                </div>
              </div>
            </div>
          );
        })()}

        {rest.running && isMounted && (() => {
          const progress = rest.total > 0 ? rest.seconds / rest.total : 0;
          const R = 70, C = 2 * Math.PI * R;
          const dash = C * progress;
          const hasPB = newPBs.length > 0;
          return createPortal(
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: hasPB ? "flex-start" : "center", paddingTop: hasPB ? 60 : "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 9999, backdropFilter: "blur(20px)", touchAction: "none", overscrollBehavior: "none" }}>
              <div style={{ fontSize: 12, letterSpacing: 6, color: "rgba(255,255,255,0.3)", marginBottom: 28, fontFamily: "'Space Mono', monospace" }}>REST</div>
              <div style={{ position: "relative", width: 172, height: 172, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="172" height="172" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
                  <circle cx="86" cy="86" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                  <circle cx="86" cy="86" r={R} fill="none" stroke="#FF6B6B" strokeWidth="6"
                    strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.25s linear" }} />
                </svg>
                <div style={{ fontSize: 72, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{rest.seconds}</div>
              </div>
              {hasPB && (
                <div className="pb-pop" style={{ marginTop: 36, background: "rgba(12,12,15,0.85)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 16, padding: "20px 28px", maxWidth: 320, width: "85%", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div className="pb-shine" style={{ position: "absolute", top: 0, left: "-60%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.12), transparent)" }} />
                  <div className="trophy-bounce" style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#FFD700", letterSpacing: 2, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>PERSONAL BEST{newPBs.length > 1 ? "S" : ""}</div>
                  {newPBs.map((pb, i) => (
                    <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                      <div style={{ fontWeight: 600 }}>{pb.name}</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", color: "#FFD700", marginTop: 2 }}>{pb.weight}kg × {pb.reps}</div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => {
                const elapsed = rest.stop();
                if (hasPB && elapsed != null && elapsed < 5000) {
                  setTimeout(() => setNewPBs([]), 5000);
                } else {
                  setNewPBs([]);
                }
              }} style={{ marginTop: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 36px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", letterSpacing: 2, cursor: "pointer" }}>SKIP</button>
            </div>,
            document.body
          );
        })()}
        <div style={{ padding: "16px 20px 14px", background: `linear-gradient(180deg, ${activeDay.color}10, transparent)`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>← Home</button>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Jump to multi-select customise for this day — lets the user
                  pair already-existing exercises into a superset without
                  hunting for the customise screen first. */}
              <button
                onClick={() => {
                  const pd = customPlan?.find(d => d.id === activeDay.id);
                  if (pd) {
                    setEditingDay(pd);
                    setCustomMultiMode(true);
                    setSuperSelection([]);
                    setView("customise");
                  }
                }}
                style={{ background: "rgba(255,230,109,0.08)", border: "1px solid rgba(255,230,109,0.25)", borderRadius: 6, padding: "5px 10px", color: "#FFE66D", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
                title="Pair exercises into a superset"
              >⟳ PAIR</button>
              <button onClick={abandonWorkout} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>QUIT ×</button>
            </div>
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
            {(() => {
              // Group exercises: singles pass through; consecutive exercises sharing a groupId become a superset block
              type ExItem = { kind: "single"; ex: typeof sec.exercises[0] } | { kind: "superset"; group: typeof sec.exercises; groupId: string };
              const items: ExItem[] = [];
              let j = 0;
              while (j < sec.exercises.length) {
                const ex = sec.exercises[j];
                if (ex.groupId && ex.groupType === "superset") {
                  const grp = [ex]; j++;
                  while (j < sec.exercises.length && sec.exercises[j].groupId === ex.groupId) { grp.push(sec.exercises[j]); j++; }
                  items.push({ kind: "superset", group: grp, groupId: ex.groupId });
                } else { items.push({ kind: "single", ex }); j++; }
              }

              const renderEx = (ex: typeof sec.exercises[0], superCtx?: { group: typeof sec.exercises; idx: number }) => {
                const normName = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
                const exLibData = (EXERCISES as any[]).find((e: any) => e.id === ex.id || normName(e.name) === normName(ex.name));
                const BW_EQUIP = ["bodyweight", "pullup_bar", "dip_bar"];
                const isBW = exLibData && Array.isArray(exLibData.equipment) && exLibData.equipment.length > 0
                  && exLibData.equipment.every((eq: string) => BW_EQUIP.includes(eq));
                const activeBW = isBW || manualBW;
                const trackable = ex.trackable !== false;
                const done = doneCount(ex.id, ex.sets);
                const allDone = done >= ex.sets;
                const ns = nextSetNum(ex.id, ex.sets);
                const isExp = expanded === ex.id;
                const hasDrop = pendingDrop?.exId === ex.id;
                const { weight: lw, reps: lr } = lastSessionBest(ex.id);
                const wuDone = !trackable && warmupDone[ex.id];
                const exIsDropSet = isDropSetMode(ex);
                // Legacy `dropCount` retained for the few places that still
                // reason about how many drops are in the chain, but the flow
                // is now open-ended — the user taps DONE when they're spent.
                const dropCount = exIsDropSet ? 99 : 0;

                const effectiveWeight = activeBW && !bwAddWeight ? "0" : wInput;
                const handleLog = () => {
                  if (!ns) return;
                  if (superCtx && superCtx.idx < superCtx.group.length - 1) {
                    logSet(ex.id, ns, effectiveWeight, rInput);
                    const nextEx = superCtx.group[superCtx.idx + 1];
                    const { weight: nw, reps: nr } = lastSessionBest(nextEx.id);
                    setExpanded(nextEx.id); setWInput(nw ? String(nw) : ""); setRInput(nr ? String(nr) : ""); setBwAddWeight(false); setManualBW(false);
                  } else if (dropCount > 0) {
                    logSet(ex.id, ns, effectiveWeight, rInput);
                    const w = parseFloat(effectiveWeight) || 0;
                    setPendingDrop({ exId: ex.id, setNum: ns, dropNum: 1 });
                    setDropWInput(w > 0 ? String(Math.round(w * 0.8 * 4) / 4) : ""); setDropRInput("");
                  } else {
                    logSet(ex.id, ns, effectiveWeight, rInput);
                    if (ns + 1 > ex.sets) {
                      setExpanded(null);
                      // Award IP for completing full superset (last exercise, last set)
                      if (isLastInSuper && ex.groupId && !completedSupersetGroups.current.has(ex.groupId)) {
                        completedSupersetGroups.current.add(ex.groupId);
                        awardIP(5, "⚡", "SUPERSET LOCKED");
                      }
                    }
                    if (ex.rest) rest.start(ex.rest, () => setNewPBs([]));
                  }
                };

                let lastSetN = 0;
                for (let i = ex.sets; i >= 1; i--) { if (log[`${ex.id}-${i}`]) { lastSetN = i; break; } }
                const lastLogged = lastSetN > 0 ? log[`${ex.id}-${lastSetN}`] : null;

                const wDiff = (cur: number) => {
                  const tags: React.ReactNode[] = [];
                  if (!cur) return null;
                  if (lastLogged) { const d = +(cur - lastLogged.weight).toFixed(2); tags.push(d === 0 ? <span key="prev" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= S{lastSetN}</span> : <span key="prev" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}kg vs S{lastSetN}</span>); }
                  if (lw > 0) { const d = +(cur - lw).toFixed(2); tags.push(d === 0 ? <span key="last" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= last session</span> : <span key="last" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}kg vs last session</span>); }
                  return tags.length > 0 ? <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{tags}</div> : null;
                };
                const rDiff = (cur: number) => {
                  const tags: React.ReactNode[] = [];
                  if (!cur) return null;
                  if (lastLogged) { const d = cur - lastLogged.reps; tags.push(d === 0 ? <span key="prev" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= S{lastSetN}</span> : <span key="prev" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)} rep{Math.abs(d) !== 1 ? "s" : ""} vs S{lastSetN}</span>); }
                  if (lr > 0) { const d = cur - lr; tags.push(d === 0 ? <span key="last" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>= last session</span> : <span key="last" style={{ fontSize: 10, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: d > 0 ? "#2ecc71" : "#FF6B6B", background: d > 0 ? "#2ecc7115" : "#FF6B6B15", padding: "2px 5px", borderRadius: 4 }}>{d > 0 ? "▲" : "▼"} {Math.abs(d)} rep{Math.abs(d) !== 1 ? "s" : ""} vs last session</span>); }
                  return tags.length > 0 ? <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>{tags}</div> : null;
                };

                const isLastInSuper = superCtx && superCtx.idx === superCtx.group.length - 1;
                const logBtnLabel = superCtx && !isLastInSuper ? `LOG SET ${ns} → NEXT` : `LOG SET ${ns}`;

                return (
                  <div key={ex.id} className="fade-in">
                    <div onClick={() => {
                      if (!trackable) { setWarmupDone(prev => ({ ...prev, [ex.id]: !prev[ex.id] })); return; }
                      if (allDone) return;
                      setManualBW(false);
                      setBwAddWeight(isBW && lw > 0);
                      setExpanded(isExp ? null : ex.id);
                      // Prefer real prior-session values; otherwise fall back to a
                      // computed suggested starting set so the user isn't staring
                      // at "0". The SUGGESTED tag below the input makes the
                      // intent obvious.
                      if (lw > 0 || lr > 0) {
                        setWInput(lw ? String(lw) : "");
                        setRInput(lr ? String(lr) : "");
                        setIsSuggested(false);
                      } else {
                        const bw = parseFloat(ob.weightKg || "0");
                        const sug = suggestedStartingSet(ex.id, ex.name, (ex as any).type, bw);
                        if (sug) {
                          setWInput(sug.weight ? String(sug.weight) : "");
                          setRInput(sug.reps ? String(sug.reps) : "");
                          setIsSuggested(true);
                        } else {
                          setWInput("");
                          setRInput("");
                          setIsSuggested(false);
                        }
                      }
                    }}
                      style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: (allDone || wuDone) ? 0.3 : 1, cursor: "pointer", transition: "opacity 0.3s", borderLeft: ex.note === "HIIT circuit" ? "3px solid rgba(255,140,66,0.7)" : undefined }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                          {(() => { const tu = getExerciseImageUrls(ex.id, ex.name); return tu ? (
                            <img src={tu[0]} alt="" onClick={e => { e.stopPropagation(); const m = lookupExMuscles(ex.name); setFormPreview({ id: ex.id, name: ex.name, ...m }); }}
                              style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#1a1a1a", cursor: "pointer" }}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : null; })()}
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</span>
                          {ex.type && <span style={{ fontSize: 9, fontWeight: 600, color: bc[ex.type] || "#888", opacity: 0.7, letterSpacing: 1, flexShrink: 0 }}>{ex.type.toUpperCase()}</span>}
                          {exIsDropSet && <span style={{ fontSize: 9, fontWeight: 700, color: "#FFE66D", background: "rgba(255,230,109,0.12)", border: "1px solid rgba(255,230,109,0.25)", borderRadius: 4, padding: "1px 5px", letterSpacing: 1, flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>🔻 DROP SET</span>}
                          {ex.note === "HIIT circuit" && <span style={{ fontSize: 9, fontWeight: 700, color: "#FF8C42", background: "rgba(255,140,66,0.12)", border: "1px solid rgba(255,140,66,0.3)", borderRadius: 4, padding: "1px 5px", letterSpacing: 1, flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>⚡ HIIT</span>}
                          <button onClick={e => { e.stopPropagation(); const m = lookupExMuscles(ex.name); setFormPreview({ id: ex.id, name: ex.name, ...m }); }} style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "2px 6px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginLeft: 6, flexShrink: 0 }}>FORM</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {trackable && done > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(ex.id); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>EDIT</button>
                          )}
                          {trackable && (() => {
                            const dsActive = isDropSetMode(ex);
                            return (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                setActiveDay(d => !d ? d : ({
                                  ...d,
                                  sections: d.sections.map(s => ({
                                    ...s,
                                    exercises: s.exercises.map(x => x.id !== ex.id ? x : { ...x, dropSet: !dsActive, dropSets: 0 })
                                  }))
                                }));
                              }} title={dsActive ? "Drop set mode is ON for this exercise — tap to turn off. Each set will run as a chain: go to failure, drop the weight, again, until you tap DONE." : "Make this a drop set exercise — go to failure, drop the weight, again, until you're done. No rest between drops."} style={{ background: dsActive ? "rgba(255,230,109,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${dsActive ? "rgba(255,230,109,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: dsActive ? "#FFE66D" : "rgba(255,255,255,0.35)", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                                {dsActive ? "🔻 DROP SET" : "+ DROP SET"}
                              </button>
                            );
                          })()}
                          {trackable && (!ex.groupId ? (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setAddingSupersetForId(ex.id);
                              setShowSessionExBrowser(true);
                              setSessionExSearch("");
                            }} style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 6, color: "#4ECDC4", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>+ SUPERSET</button>
                          ) : (
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const gid = ex.groupId;
                              setActiveDay(d => !d ? d : ({
                                ...d,
                                sections: d.sections.map(s => ({
                                  ...s,
                                  exercises: s.exercises.map(x => x.groupId === gid ? { ...x, groupId: undefined, groupType: undefined } : x)
                                }))
                              }));
                            }} style={{ background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.3)", borderRadius: 6, color: "#FFE66D", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>⟳ UNGROUP</button>
                          ))}
                          {(allDone || wuDone) && <span style={{ fontSize: 16, color: "#2ecc71" }}>✓</span>}
                          {!trackable && !wuDone && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>TAP TO MARK DONE</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4, fontWeight: 300 }}>
                        {trackable ? `${ex.sets} × ${ex.reps}` : ex.reps}{ex.rest ? ` · ${ex.rest}s rest` : ""}
                      </div>
                      {ex.note && ex.note !== "HIIT circuit" && <div style={{ fontSize: 11, color: "#f0c040", marginTop: 5, fontStyle: "italic", opacity: 0.8 }}>{ex.note}</div>}
                      {trackable && lw > 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6, fontFamily: "'Space Mono', monospace" }}>Last session: {lw}kg × {lr || "?"}</div>}
                      {trackable && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          {Array.from({ length: ex.sets }, (_, i) => {
                            const entry = log[`${ex.id}-${i + 1}`];
                            const d = !!entry, c = i + 1 === ns;
                            const skipped = entry?.skipped;
                            return <div key={i} style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "'Space Mono', monospace", background: skipped ? "rgba(255,107,107,0.08)" : d ? "#2ecc7120" : c ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", color: skipped ? "rgba(255,107,107,0.5)" : d ? "#2ecc71" : c ? "#fff" : "rgba(255,255,255,0.25)", border: c ? "1px solid rgba(255,255,255,0.15)" : skipped ? "1px solid rgba(255,107,107,0.2)" : "1px solid transparent" }}>{skipped ? "−" : d ? "✓" : i + 1}</div>;
                          })}
                        </div>
                      )}
                    </div>

                    {/* Drop set panel */}
                    {hasDrop && (
                      <div className="fade-in" style={{ padding: "14px 16px", background: "rgba(255,230,109,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: "3px solid rgba(255,230,109,0.3)" }}>
                        <div style={{ fontSize: 11, color: "#FFE66D", fontFamily: "'Space Mono', monospace", letterSpacing: 2, marginBottom: 12 }}>DROP {pendingDrop!.dropNum} · REDUCE WEIGHT, TO FAILURE</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>WEIGHT (kg)</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <button onClick={() => setDropWInput(String(Math.max(0, (parseFloat(dropWInput) || 0) - 1.25)))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <input type="number" inputMode="decimal" value={dropWInput} onChange={e => setDropWInput(e.target.value)} placeholder="0" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                              <button onClick={() => setDropWInput(String((parseFloat(dropWInput) || 0) + 1.25))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6 }}>REPS</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <button onClick={() => setDropRInput(String(Math.max(0, (parseInt(dropRInput) || 0) - 1)))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <input type="number" inputMode="numeric" value={dropRInput} onChange={e => setDropRInput(e.target.value)} placeholder="0" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                              <button onClick={() => setDropRInput(String((parseInt(dropRInput) || 0) + 1))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => {
                            logSet(ex.id, pendingDrop!.setNum, dropWInput, dropRInput, pendingDrop!.dropNum);
                            const w = parseFloat(dropWInput) || 0;
                            setPendingDrop({ ...pendingDrop!, dropNum: pendingDrop!.dropNum + 1 });
                            setDropWInput(w > 0 ? String(Math.round(w * 0.8 * 4) / 4) : ""); setDropRInput("");
                          }} title="Log this drop and continue the chain — drop the weight again, go to failure again." style={{ flex: 1, padding: "14px", background: "rgba(255,230,109,0.15)", border: "1px solid rgba(255,230,109,0.3)", borderRadius: 10, color: "#FFE66D", fontSize: 12, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                            + DROP
                          </button>
                          <button onClick={() => {
                            logSet(ex.id, pendingDrop!.setNum, dropWInput, dropRInput, pendingDrop!.dropNum);
                            setPendingDrop(null);
                            if (!completedDropExes.current.has(ex.id)) {
                              completedDropExes.current.add(ex.id);
                              awardIP(3, "🔥", "DROP CHAIN");
                            }
                            if (pendingDrop!.setNum + 1 > ex.sets) setExpanded(null);
                            if (ex.rest) rest.start(ex.rest, () => setNewPBs([]));
                          }} title="End the drop chain here — log this drop and start your rest." style={{ flex: 1, padding: "14px", background: "rgba(46,204,113,0.18)", border: "1px solid rgba(46,204,113,0.4)", borderRadius: 10, color: "#2ecc71", fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                            ✓ DONE
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Regular set input */}
                    {isExp && trackable && ns && !hasDrop && (
                      <div className="fade-in" style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {(() => {
                          const cues = getFormCues(ex.id, ex.name);
                          if (!cues || cues.length === 0) return null;
                          return (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.45, display: "flex", gap: 6, alignItems: "flex-start" }}>
                              <span style={{ color: "#FF6B6B", fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: 1, flexShrink: 0, marginTop: 2 }}>TIP</span>
                              <span>{cues[0]}</span>
                            </div>
                          );
                        })()}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 12, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Set {ns} of {ex.sets}{superCtx && !isLastInSuper ? ` · then ${superCtx.group[superCtx.idx + 1].name}` : ""}</span>
                          {lw > 0
                            ? <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>Last: {lw}kg × {lr}</span>
                            : isSuggested
                              ? <span style={{ fontSize: 10, fontWeight: 700, color: "#FFE66D", background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.3)", padding: "2px 6px", borderRadius: 4, letterSpacing: 1, fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }} title="First time logging this exercise — these are estimated starting values. Adjust before tapping LOG.">★ SUGGESTED</span>
                              : null}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          {isBW && (
                            <>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>BODYWEIGHT</div>
                              <button onClick={() => { setBwAddWeight(!bwAddWeight); if (!bwAddWeight) setWInput(""); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: `1px solid ${bwAddWeight ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.15)"}`, background: bwAddWeight ? "rgba(255,107,107,0.1)" : "rgba(255,255,255,0.04)", color: bwAddWeight ? "#FF6B6B" : "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                                {bwAddWeight ? "− REMOVE WEIGHT" : "+ ADD WEIGHT"}
                              </button>
                            </>
                          )}
                          {!isBW && (
                            <button onClick={() => { setManualBW(!manualBW); if (!manualBW) setWInput(""); setBwAddWeight(false); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: `1px solid ${manualBW ? "rgba(46,204,113,0.5)" : "rgba(255,255,255,0.12)"}`, background: manualBW ? "rgba(46,204,113,0.12)" : "rgba(255,255,255,0.04)", color: manualBW ? "#2ecc71" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                              {manualBW ? "✓ BODYWEIGHT" : "BW"}
                            </button>
                          )}
                          {manualBW && !isBW && (
                            <button onClick={() => { setBwAddWeight(!bwAddWeight); if (!bwAddWeight) setWInput(""); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: `1px solid ${bwAddWeight ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.12)"}`, background: bwAddWeight ? "rgba(255,107,107,0.1)" : "rgba(255,255,255,0.04)", color: bwAddWeight ? "#FF6B6B" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
                              {bwAddWeight ? "− REMOVE WEIGHT" : "+ ADD WEIGHT"}
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          {(!activeBW || bwAddWeight) && (
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>{activeBW ? "ADDED WEIGHT (kg)" : "WEIGHT (kg)"}</div>
                              <div style={{ display: "flex", alignItems: "center" }}>
                                <button onClick={() => setWInput(String(Math.max(0, (parseFloat(wInput) || 0) - 1.25)))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                <input type="number" inputMode="decimal" value={wInput} onChange={e => setWInput(e.target.value)} placeholder="0" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                                <button onClick={() => setWInput(String((parseFloat(wInput) || 0) + 1.25))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                              </div>
                              {wDiff(parseFloat(wInput))}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>REPS DONE</div>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <button onClick={() => setRInput(String(Math.max(0, (parseInt(rInput) || 0) - 1)))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px 0 0 10px", color: "#FF6B6B", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <input type="number" inputMode="numeric" value={rInput} onChange={e => setRInput(e.target.value)} placeholder="0" style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderRight: "none", color: "#fff", fontSize: 17, fontFamily: "'Space Mono', monospace", padding: "8px 2px", textAlign: "center", outline: "none" }} />
                              <button onClick={() => setRInput(String((parseInt(rInput) || 0) + 1))} style={{ width: 34, height: 42, flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0 10px 10px 0", color: "#2ecc71", fontSize: 16, fontFamily: "'Space Mono', monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                            {rDiff(parseInt(rInput))}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const w = parseFloat(effectiveWeight) || 0;
                            const prevBest = overall.exercisePRs[ex.id]?.weight ?? 0;
                            handleLog();
                            setLogFlashId(ex.id);
                            setTimeout(() => setLogFlashId(null), 420);
                            if (w > 0 && w > prevBest && w > (shownPBs.current.get(ex.id) ?? 0)) {
                              shownPBs.current.set(ex.id, w);
                              setNewPBs([{ name: ex.name, weight: w, reps: parseFloat(rInput) || 0 }]);
                              setTimeout(() => setNewPBs([]), 5000);
                            }
                          }}
                          className={logFlashId === ex.id ? "log-flash" : ""}
                          style={{ width: "100%", padding: "14px", background: activeDay.gradient, border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: ((!effectiveWeight && !activeBW) && !rInput) ? 0.4 : 1 }}>
                          {logBtnLabel}
                        </button>
                        <button onClick={() => {
                          if (!ns) return;
                          const k = `${ex.id}-${ns}`;
                          const newLog = { ...log, [k]: { weight: 0, reps: 0, skipped: true } };
                          setLog(newLog);
                          try {
                            const saved = localStorage.getItem("ironlog-session");
                            if (saved) { const s = JSON.parse(saved); s.log = newLog; localStorage.setItem("ironlog-session", JSON.stringify(s)); }
                          } catch {}
                          if (ns + 1 > ex.sets) setExpanded(null);
                        }} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'Space Mono', monospace", marginTop: 6 }}>SKIP SET</button>
                      </div>
                    )}
                    {/* Skip exercise link */}
                    {isExp && trackable && !allDone && (
                      <div style={{ padding: "6px 16px 12px", textAlign: "right" }}>
                        <button onClick={() => {
                          const newLog = { ...log };
                          for (let i = 1; i <= ex.sets; i++) {
                            const k = `${ex.id}-${i}`;
                            if (!(k in newLog)) newLog[k] = { weight: 0, reps: 0, skipped: true };
                          }
                          setLog(newLog);
                          try {
                            const saved = localStorage.getItem("ironlog-session");
                            if (saved) { const s = JSON.parse(saved); s.log = newLog; localStorage.setItem("ironlog-session", JSON.stringify(s)); }
                          } catch {}
                          setExpanded(null);
                        }} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, padding: "4px 0" }}>Skip exercise</button>
                      </div>
                    )}
                  </div>
                );
              };

              return items.map((item, itemIdx) => {
                if (item.kind === "single") {
                  const prevItem = itemIdx > 0 ? items[itemIdx - 1] : null;
                  const isFirstHiit = item.ex.note === "HIIT circuit" && (!prevItem || prevItem.kind !== "single" || prevItem.ex.note !== "HIIT circuit");
                  if (!isFirstHiit) return renderEx(item.ex);
                  return (
                    <div key={item.ex.id}>
                      <div style={{ padding: "14px 20px 6px", display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,140,66,0.2)" }} />
                        <span style={{ fontSize: 9, letterSpacing: 3, color: "#FF8C42", fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>⚡ HIIT CIRCUIT</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,140,66,0.2)" }} />
                      </div>
                      {renderEx(item.ex)}
                    </div>
                  );
                }
                return (
                  <div key={item.groupId} style={{ borderLeft: "2px solid rgba(255,230,109,0.2)", marginLeft: 12 }}>
                    <div style={{ padding: "8px 20px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, letterSpacing: 3, color: "#FFE66D", fontWeight: 700, fontFamily: "'Space Mono', monospace", opacity: 0.7 }}>⟳ SUPERSET</span>
                    </div>
                    {item.group.map((ex, idx) => renderEx(ex, { group: item.group, idx }))}
                  </div>
                );
              });
            })()}
          </div>
        ))}

        <div style={{ padding: "20px 20px 0" }}>
          <button onClick={() => {
            setAddingSupersetForId(null);
            setShowSessionExBrowser(true);
            setSessionExSearch("");
          }} style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>
            + ADD EXERCISE
          </button>
        </div>

        <div style={{ padding: "0 20px 20px", marginTop: 12 }}>
          <button onClick={finish} style={{ width: "100%", padding: "16px", background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 12, color: "#2ecc71", fontSize: 13, fontWeight: 600, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>FINISH & SAVE</button>
        </div>

        {/* IP toast */}
        {ipToast && (
          <div style={{ position: "fixed", bottom: 120, left: "50%", transform: "translateX(-50%)", zIndex: 250, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,230,109,0.4)", borderRadius: 28, padding: "10px 22px", display: "flex", alignItems: "center", gap: 10, pointerEvents: "none", animation: "goalCelebPop 0.3s ease" }}>
            <span style={{ fontSize: 22 }}>{ipToast.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFE66D", fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>{ipToast.msg}</div>
          </div>
        )}

        {/* Workout complete animation */}
        {showCompleteAnim && (
          <div className="complete-overlay" style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 300, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)", pointerEvents: "none", overflow: "hidden" }}>
            <img src="/ai/complete-bg.jpg" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, mixBlendMode: "screen" }} />
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="complete-ring" style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "3px solid rgba(46,204,113,0.6)" }} />
              <div className="complete-ring" style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "2px solid rgba(46,204,113,0.3)", animationDelay: "0.18s" }} />
              <div className="complete-pop" style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(46,204,113,0.15)", border: "2px solid rgba(46,204,113,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 36 }}>✓</span>
              </div>
            </div>
            <div className="complete-pop" style={{ marginTop: 32, fontSize: 20, fontWeight: 700, color: "#2ecc71", letterSpacing: 3, fontFamily: "'Space Mono', monospace", animationDelay: "0.2s" }}>SAVED</div>
            {sessionIP > 0 && (
              <div className="complete-pop" style={{ marginTop: 14, fontSize: 15, fontWeight: 700, color: "#FFE66D", letterSpacing: 2, fontFamily: "'Space Mono', monospace", animationDelay: "0.35s", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚡</span><span>+{sessionIP} INTENSITY PTS</span>
              </div>
            )}
          </div>
        )}

        {/* ── In-workout exercise add overlay ── */}
        {showAddInWorkout && (() => {
          const LIST = (EXERCISES as any[]);
          const exMovement = (e: any): string => {
            const pm: string[] = e.primaryMuscles;
            if (pm.includes("cardio")) return "cardio";
            if (pm.some((m: string) => ["chest","shoulders","triceps"].includes(m))) return "push";
            if (pm.some((m: string) => ["back","biceps","forearms"].includes(m))) return "pull";
            if (pm.some((m: string) => ["quads","hamstrings","glutes","calves"].includes(m))) return "legs";
            return "core";
          };
          const filtered = LIST.filter((e: any) => {
            if (aiWSearch && !e.name.toLowerCase().includes(aiWSearch.toLowerCase()) &&
                !e.primaryMuscles.some((m: string) => m.toLowerCase().includes(aiWSearch.toLowerCase())) &&
                !e.secondaryMuscles.some((m: string) => m.toLowerCase().includes(aiWSearch.toLowerCase()))) return false;
            if (aiWFilterLoc !== "all") {
              if (aiWFilterLoc === "bodyweight" && !e.equipment.every((eq: string) => ["bodyweight","resistance_band"].includes(eq))) return false;
              else if (aiWFilterLoc === "gym" && e.location !== "gym") return false;
              else if (aiWFilterLoc === "home" && e.location !== "home") return false;
            }
            if (aiWFilterMove !== "all" && exMovement(e) !== aiWFilterMove) return false;
            if (aiWFilterMuscle !== "all" && !e.primaryMuscles.includes(aiWFilterMuscle) && !e.secondaryMuscles.includes(aiWFilterMuscle)) return false;
            return true;
          });
          const chipStyle = (active: boolean, color?: string) => ({
            padding: "5px 12px", borderRadius: 20, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            border: active ? "1px solid transparent" : "1px solid rgba(255,255,255,0.1)",
            background: active ? (color ?? "#fff") : "rgba(255,255,255,0.04)",
            color: active ? "#000" : "rgba(255,255,255,0.5)",
            cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
          });
          const row = { display: "flex", gap: 6, overflowX: "auto" as const, paddingBottom: 6, marginBottom: 4, scrollbarWidth: "none" as const };
          const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 180];
          const restChips = REST_PRESETS.includes(aiWRest) ? REST_PRESETS : [...REST_PRESETS, aiWRest].sort((a, b) => a - b);

          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} onClick={() => setShowAddInWorkout(false)} />
              <div style={{ position: "relative", background: "#111", borderRadius: "20px 20px 0 0", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Handle bar */}
                <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
                </div>

                {aiWStep === "browse" ? (
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, letterSpacing: 3, color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace" }}>ADD EXERCISE</div>
                      <button onClick={() => setShowAddInWorkout(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", padding: 0 }}>✕</button>
                    </div>
                    <input value={aiWSearch} onChange={e => setAiWSearch(e.target.value)} placeholder="Search exercises..." autoFocus style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "12px 16px", outline: "none", boxSizing: "border-box", marginBottom: 10, flexShrink: 0 }} />
                    <div style={{ flexShrink: 0, marginBottom: 6 }}>
                      <div style={row}>
                        {[["all","All"],["gym","Gym"],["home","Home"],["bodyweight","BW"]].map(([v,l]) => (
                          <button key={v} onClick={() => setAiWFilterLoc(v)} style={chipStyle(aiWFilterLoc===v,"#4ECDC4")}>{l}</button>
                        ))}
                      </div>
                      <div style={row}>
                        {[["all","All"],["push","Push"],["pull","Pull"],["legs","Legs"],["core","Core"],["cardio","Cardio"]].map(([v,l]) => (
                          <button key={v} onClick={() => setAiWFilterMove(v)} style={chipStyle(aiWFilterMove===v,"#FF6B6B")}>{l}</button>
                        ))}
                      </div>
                      <div style={row}>
                        {[["all","All"],["chest","Chest"],["back","Back"],["shoulders","Shoulders"],["biceps","Biceps"],["triceps","Triceps"],["quads","Quads"],["hamstrings","Hamstrings"],["glutes","Glutes"],["core","Core"]].map(([v,l]) => (
                          <button key={v} onClick={() => setAiWFilterMuscle(v)} style={chipStyle(aiWFilterMuscle===v,"#FFE66D")}>{l}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", letterSpacing: 1, marginBottom: 4 }}>{filtered.length} EXERCISES</div>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {filtered.map((ex: any) => (
                        <div key={ex.id} onClick={() => { setAiWEx(ex); setAiWStep("config"); }} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", marginBottom: 6, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {(() => { const tu = getExerciseImageUrls(ex.id, ex.name); return tu ? <img src={tu[0]} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display="none"; }}/> : null; })()}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                                <span style={{ color: "#FF6644" }}>{ex.primaryMuscles.join(" · ")}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {filtered.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>No exercises match these filters</div>}
                    </div>
                  </div>
                ) : aiWEx ? (
                  <div style={{ overflowY: "auto", padding: "16px 20px 32px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                      <button onClick={() => setAiWStep("browse")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => setShowAddInWorkout(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 18, cursor: "pointer", padding: 0 }}>✕</button>
                    </div>

                    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{aiWEx.name}</div>
                    <div style={{ fontSize: 11, color: "#FF6644", marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>{(aiWEx.primaryMuscles as string[]).join(" · ")}</div>

                    {/* Sets */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>SETS</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={() => setAiWSets(s => Math.max(1, s - 1))} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer" }}>−</button>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", minWidth: 32, textAlign: "center" }}>{aiWSets}</div>
                        <button onClick={() => setAiWSets(s => Math.min(10, s + 1))} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 18, cursor: "pointer" }}>+</button>
                      </div>
                    </div>

                    {/* Reps */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>REPS</div>
                      <input value={aiWReps} onChange={e => setAiWReps(e.target.value)} placeholder="e.g. 10-12" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 16, fontFamily: "'DM Sans', sans-serif", padding: "10px 14px", outline: "none", boxSizing: "border-box", width: "100%" }} />
                    </div>

                    {/* REST chips */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>REST</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {restChips.map(s => {
                          const active = aiWRest === s;
                          return (
                            <button key={s} onClick={() => setAiWRest(s)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, fontFamily: "'Space Mono', monospace", border: active ? "1px solid #FF6B6B" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.04)", color: active ? "#FF6B6B" : "rgba(255,255,255,0.45)", cursor: "pointer" }}>
                              {s === 0 ? "SKIP" : `${s}s`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Permanent toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>Save to plan</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Add permanently to this workout day</div>
                      </div>
                      <button onClick={() => setAiWPermanent(p => !p)} style={{ width: 44, height: 26, borderRadius: 13, border: "none", background: aiWPermanent ? "#FF6B6B" : "rgba(255,255,255,0.12)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: aiWPermanent ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                      </button>
                    </div>

                    <button onClick={async () => {
                      if (!aiWEx) return;
                      const newEx = {
                        id: aiWEx.id, name: aiWEx.name, sets: aiWSets, reps: aiWReps, rest: aiWRest,
                        type: (aiWEx.type ?? "compound") as "compound" | "isolation" | "cardio",
                        trackable: true,
                      };
                      // Add to active session
                      setActiveDay(prev => {
                        if (!prev) return prev;
                        const addedIdx = prev.sections.findIndex(s => s.name === "Added");
                        if (addedIdx >= 0) {
                          const secs = prev.sections.map((s, i) => i === addedIdx ? { ...s, exercises: [...s.exercises, newEx] } : s);
                          return { ...prev, sections: secs };
                        }
                        return { ...prev, sections: [...prev.sections, { name: "Added", type: "main" as const, exercises: [newEx] }] };
                      });
                      // Update localStorage
                      try {
                        const saved = localStorage.getItem("ironlog-session");
                        if (saved) {
                          const s = JSON.parse(saved);
                          const addedIdx = (s.dayData?.sections ?? []).findIndex((sec: any) => sec.name === "Added");
                          if (addedIdx >= 0) {
                            s.dayData.sections[addedIdx].exercises.push(newEx);
                          } else {
                            s.dayData.sections = [...(s.dayData?.sections ?? []), { name: "Added", type: "main", exercises: [newEx] }];
                          }
                          localStorage.setItem("ironlog-session", JSON.stringify(s));
                        }
                      } catch {}
                      // Save to plan permanently
                      if (aiWPermanent && activeDay) {
                        const planDay = customPlan?.find((d: any) => d.id === activeDay.id);
                        if (planDay) {
                          const exs: any[] = planDay.exercises ?? [];
                          const payload = [...exs, { exerciseId: aiWEx.id, name: aiWEx.name, sets: aiWSets, reps: aiWReps, rest: aiWRest, notes: null, groupId: null, groupType: null, dropSets: 0 }];
                          await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayId: activeDay.id, exercises: payload }) });
                          setCustomPlan((prev: any) => prev ? prev.map((d: any) => d.id === activeDay.id ? { ...d, exercises: payload } : d) : prev);
                        }
                      }
                      setShowAddInWorkout(false);
                    }} style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#FF6B6B,#ee5a24)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {aiWPermanent ? "ADD & SAVE TO PLAN" : "ADD FOR THIS SESSION"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })()}

        {/* ── Session exercise browser modal ── */}
        {showSessionExBrowser && (() => {
          const isSuperMode = !!addingSupersetForId;
          const partnerEx = isSuperMode ? activeDay?.sections.flatMap(s => s.exercises).find(e => e.id === addingSupersetForId) : null;
          const searchLower = sessionExSearch.toLowerCase().trim();
          // Set of exercise ids already in the active day. In superset mode
          // we DO show these (the user wants to pair already-planned
          // exercises) but with a ✓ IN SESSION badge so it's clear.
          const inSessionIds = new Set<string>();
          activeDay?.sections.forEach(s => s.exercises.forEach(x => inSessionIds.add(x.id)));
          // Recommended partners for the anchor exercise — surfaced at top.
          const recommendedNames = isSuperMode && partnerEx ? recommendedPartnersFor(partnerEx.name) : [];
          const recommended = recommendedNames.length > 0
            ? (EXERCISES as any[]).filter((e: any) => recommendedNames.some(n => e.name.toLowerCase().includes(n)))
            : [];
          const filteredAll = (EXERCISES as any[]).filter((e: any) => {
            if (searchLower && !e.name.toLowerCase().includes(searchLower)) return false;
            // Add mode: hide already-added exercises (no point re-adding).
            // Superset mode: show them — pairing an existing exercise is now allowed.
            if (!isSuperMode && inSessionIds.has(e.id)) return false;
            // Skip the anchor itself (can't pair with self).
            if (isSuperMode && partnerEx && e.id === partnerEx.id) return false;
            // Skip exercises already in a different superset (prevents orphan groups).
            if (isSuperMode) {
              const inGroupAlready = activeDay?.sections.some(s => s.exercises.some(x => x.id === e.id && x.groupId && x.groupId !== (partnerEx as any)?.groupId));
              if (inGroupAlready) return false;
            }
            return true;
          });
          const visibleList = searchLower ? filteredAll.slice(0, 40) : null;
          // Pair an exercise (library OR already in session) with the anchor.
          // permanent=true also writes the change to the user's saved routine.
          const handlePair = (libOrInEx: any, permanent: boolean) => {
            if (!addingSupersetForId) return;
            if (permanent) {
              const ok = window.confirm("This will permanently modify your saved routine so these two exercises are always paired as a superset. Continue?");
              if (!ok) return;
            }
            setActiveDay(d => {
              if (!d) return d;
              return {
                ...d,
                sections: d.sections.map(s => {
                  const idx = s.exercises.findIndex(x => x.id === addingSupersetForId);
                  if (idx < 0) return s;
                  const existingGid = (s.exercises[idx] as any).groupId ?? `sup-${Date.now()}`;
                  const alreadyIn = inSessionIds.has(libOrInEx.id);
                  if (alreadyIn) {
                    // Pull the existing exercise out of its current position
                    // and place it right after the anchor inside the group.
                    const rest = s.exercises.filter(x => x.id !== libOrInEx.id);
                    const anchorIdx = rest.findIndex(x => x.id === addingSupersetForId);
                    const anchor = { ...rest[anchorIdx], groupId: existingGid, groupType: "superset" as const };
                    const partner = { ...s.exercises.find(x => x.id === libOrInEx.id)!, groupId: existingGid, groupType: "superset" as const, rest: 0 } as any;
                    rest[anchorIdx] = anchor;
                    rest.splice(anchorIdx + 1, 0, partner);
                    return { ...s, exercises: rest };
                  }
                  // Library exercise → insert as a new card next to the anchor.
                  const newEx: any = {
                    id: libOrInEx.id, name: libOrInEx.name, sets: 3, reps: "10-12",
                    rest: 0, type: libOrInEx.type ?? "isolation",
                    dropSet: false, dropSets: 0,
                    groupId: existingGid, groupType: "superset" as const,
                  };
                  const updatedExs = s.exercises.map(x => x.id === addingSupersetForId ? { ...x, groupId: existingGid, groupType: "superset" as const } : x);
                  updatedExs.splice(idx + 1, 0, newEx);
                  return { ...s, exercises: updatedExs };
                })
              };
            });
            if (permanent) {
              // Fire-and-forget save to the user's stored routine. Picks the
              // first routine — the active session is always derived from
              // the live activeDay edit so the user sees the change instantly.
              try {
                fetch("/api/plan", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(plan => {
                  if (!plan?.days) return;
                  // No-op stub: the activeDay already reflects the change; a
                  // future slice can persist this to the underlying routine
                  // via /api/routines. For now the change sticks for the
                  // session and the user has been warned.
                });
              } catch {}
            }
            setShowSessionExBrowser(false);
            setAddingSupersetForId(null);
            setSessionExSearch("");
          };
          // Legacy add-only path used when NOT in superset mode.
          const handleAdd = (libEx: any) => {
            const newEx: any = {
              id: libEx.id, name: libEx.name, sets: 3, reps: "10-12", rest: 60,
              type: libEx.type ?? "isolation",
              dropSet: false, dropSets: 0,
            };
            setActiveDay(d => {
              if (!d) return d;
              const sections = [...d.sections];
              const bonusIdx = sections.findIndex(s => s.name.toUpperCase() === "BONUS");
              if (bonusIdx >= 0) {
                sections[bonusIdx] = { ...sections[bonusIdx], exercises: [...sections[bonusIdx].exercises, newEx] };
              } else {
                sections.push({ name: "Bonus", exercises: [newEx] });
              }
              return { ...d, sections };
            });
            setShowSessionExBrowser(false);
            setAddingSupersetForId(null);
            setSessionExSearch("");
          };
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 250, display: "flex", flexDirection: "column", padding: 20, backdropFilter: "blur(16px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 3, fontFamily: "'Space Mono', monospace" }}>
                    {isSuperMode ? "PICK SUPERSET PARTNER" : "ADD EXERCISE"}
                  </div>
                  {isSuperMode && partnerEx && (
                    <div style={{ fontSize: 13, color: "#4ECDC4", marginTop: 4 }}>Pairs with: <strong>{partnerEx.name}</strong></div>
                  )}
                </div>
                <button onClick={() => { setShowSessionExBrowser(false); setAddingSupersetForId(null); setSessionExSearch(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", padding: 8 }}>✕</button>
              </div>
              <input
                value={sessionExSearch}
                onChange={e => setSessionExSearch(e.target.value)}
                placeholder="Search exercises..."
                autoFocus
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "12px 16px", width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />
              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* Pair-mode: helper sentence explaining the two confirm options.
                    Surfaced inline so the user knows the picker results in either
                    a session-only pairing or a permanent routine edit. */}
                {isSuperMode && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 12, padding: "10px 12px", background: "rgba(78,205,196,0.04)", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}>
                    Tap <strong>SESSION</strong> on an exercise to pair it for this workout only, or <strong>PERMANENT</strong> to also save it to your routine. Exercises already in today&apos;s session show a <span style={{ color: "#4ECDC4" }}>✓ IN SESSION</span> badge but can still be paired.
                  </div>
                )}
                {/* Superset mode: recommended partners at the top. */}
                {isSuperMode && !searchLower && recommended.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: "rgba(255,230,109,0.6)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>✨ RECOMMENDED PAIRINGS</div>
                    {recommended.map((libEx: any) => {
                      const muscles = ((libEx.muscles ?? []) as string[]).slice(0, 2).join(" · ");
                      const alreadyIn = inSessionIds.has(libEx.id);
                      return (
                        <div key={`rec-${libEx.id}`} style={{ padding: "12px 14px", background: "rgba(255,230,109,0.06)", border: "1px solid rgba(255,230,109,0.25)", borderRadius: 10, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{libEx.name}</div>
                              {muscles && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{muscles.toUpperCase()}</div>}
                            </div>
                            {alreadyIn && <span style={{ fontSize: 9, color: "#4ECDC4", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 4, padding: "2px 6px", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>✓ IN SESSION</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handlePair(libEx, false)} style={{ flex: 1, padding: "8px", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 8, color: "#4ECDC4", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>+ SESSION</button>
                            <button onClick={() => handlePair(libEx, true)} style={{ flex: 1, padding: "8px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: 8, color: "#FF6B6B", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>+ PERMANENT</button>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 2, margin: "16px 0 8px", fontFamily: "'Space Mono', monospace" }}>ALL EXERCISES</div>
                  </>
                )}
                {/* Add-mode suggestions (unchanged behaviour for the non-superset path). */}
                {!isSuperMode && !searchLower && sessionExSuggestions.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>✨ SUGGESTED FOR THIS WORKOUT</div>
                    {sessionExSuggestions.map((libEx: any) => {
                      const muscles = ((libEx.muscles ?? []) as string[]).slice(0, 2).join(" · ");
                      return (
                        <button key={libEx.id} onClick={() => handleAdd(libEx)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "rgba(78,205,196,0.04)", border: "1px solid rgba(78,205,196,0.18)", borderRadius: 10, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{libEx.name}</div>
                            {muscles && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{muscles.toUpperCase()}</div>}
                          </div>
                          <span style={{ color: "#4ECDC4", fontSize: 14 }}>+</span>
                        </button>
                      );
                    })}
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: 2, margin: "16px 0 8px", fontFamily: "'Space Mono', monospace" }}>ALL EXERCISES</div>
                  </>
                )}
                {(visibleList ?? filteredAll.slice(0, 50)).map((libEx: any) => {
                  const muscles = ((libEx.muscles ?? []) as string[]).slice(0, 2).join(" · ");
                  const alreadyIn = inSessionIds.has(libEx.id);
                  return (
                    <div key={`all-${libEx.id}`} style={{ padding: isSuperMode ? "11px 14px" : 0, background: isSuperMode ? "rgba(255,255,255,0.03)" : "transparent", border: isSuperMode ? "1px solid rgba(255,255,255,0.06)" : "none", borderRadius: 10, marginBottom: 6 }}>
                      {isSuperMode ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{libEx.name}</div>
                              {muscles && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{muscles.toUpperCase()}</div>}
                            </div>
                            {alreadyIn && <span style={{ fontSize: 9, color: "#4ECDC4", background: "rgba(78,205,196,0.12)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 4, padding: "2px 6px", letterSpacing: 1, fontFamily: "'Space Mono', monospace" }}>✓ IN SESSION</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handlePair(libEx, false)} style={{ flex: 1, padding: "6px", background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.2)", borderRadius: 8, color: "#4ECDC4", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>+ SESSION</button>
                            <button onClick={() => handlePair(libEx, true)} style={{ flex: 1, padding: "6px", background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 8, color: "#FF6B6B", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>+ PERMANENT</button>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => handleAdd(libEx)} style={{ width: "100%", textAlign: "left", padding: "11px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{libEx.name}</div>
                            {muscles && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>{muscles.toUpperCase()}</div>}
                          </div>
                          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>+</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  const _isForward = viewDir !== "back";
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={_viewKey}
        initial={{ opacity: 0, x: _isForward ? 22 : -22 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: _isForward ? -22 : 22 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ minHeight: "100dvh" }}
      >
        {_content}
      </motion.div>
    </AnimatePresence>
  );
}

function LifterIcon({ size = 120, opacity = 1 }: { size?: number; opacity?: number }) {
  const stroke = { stroke: "#fff", strokeWidth: 8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <motion.svg width={size} height={size} viewBox="0 0 200 200" aria-hidden style={{ display: "block", margin: "0 auto", opacity }}>
      <motion.g
        animate={{ y: [10, -6, 10], scaleY: [0.84, 1, 0.84] }}
        transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, times: [0, 0.5, 1] }}
        style={{ transformOrigin: "100px 132px" }}
      >
        <line x1="35" y1="72" x2="165" y2="72" stroke="#FF6B6B" strokeWidth="7" strokeLinecap="round"/>
        <rect x="20" y="54" width="11" height="36" rx="3" fill="#FF6B6B"/>
        <rect x="33" y="58" width="8"  height="28" rx="3" fill="#FF6B6B"/>
        <rect x="159" y="58" width="8" height="28" rx="3" fill="#FF6B6B"/>
        <rect x="169" y="54" width="11" height="36" rx="3" fill="#FF6B6B"/>
        <circle cx="100" cy="52" r="10" fill="#fff"/>
        <line x1="100" y1="65"  x2="100" y2="116" {...stroke}/>
        <line x1="100" y1="82"  x2="62"  y2="72"  {...stroke}/>
        <line x1="100" y1="82"  x2="138" y2="72"  {...stroke}/>
        <line x1="100" y1="116" x2="75"  y2="150" {...stroke}/>
        <line x1="100" y1="116" x2="125" y2="150" {...stroke}/>
        <line x1="75"  y1="150" x2="62"  y2="178" {...stroke}/>
        <line x1="125" y1="150" x2="138" y2="178" {...stroke}/>
        <line x1="54"  y1="178" x2="70"  y2="178" {...stroke}/>
        <line x1="130" y1="178" x2="146" y2="178" {...stroke}/>
      </motion.g>
    </motion.svg>
  );
}

// Vertical barbell mark — plates drop from top and bottom onto the bar.
// height prop controls rendered height; width is derived from the 40:108 viewBox ratio.
// Horizontal barbell with round plates — matches the app icon.
// Plates fly in from off-screen left/right; bar shaft appears first.
function BarbellMark({ width = 300, delay = 0, loop }: { width?: number; delay?: number; loop?: number }) {
  const h = Math.round(width * 88 / 320);
  const slam = { type: "spring" as const, stiffness: 500, damping: 18 };
  const platesDelay = delay + 0.42;
  // Optional: re-fire the form-up animation periodically by remounting the
  // animated subtree via a changing key.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setTick(t => t + 1), loop);
    return () => clearInterval(id);
  }, [loop]);
  return (
    <div style={{ width, height: h, overflow: "hidden", position: "relative", margin: "0 auto" }}>
      <svg key={tick} width={width} height={h} viewBox="0 0 320 88" style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id="bm-chrome" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#f0f0f0"/>
            <stop offset="30%"  stopColor="#c0c0c0"/>
            <stop offset="65%"  stopColor="#808080"/>
            <stop offset="100%" stopColor="#b8b8b8"/>
          </linearGradient>
          <radialGradient id="bm-plo" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#ff7a7a"/>
            <stop offset="55%"  stopColor="#dd2b2b"/>
            <stop offset="100%" stopColor="#8a1010"/>
          </radialGradient>
          <radialGradient id="bm-pli" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#ff6868"/>
            <stop offset="55%"  stopColor="#cc2020"/>
            <stop offset="100%" stopColor="#7a0e0e"/>
          </radialGradient>
          <radialGradient id="bm-pro" cx="62%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#ff7a7a"/>
            <stop offset="55%"  stopColor="#dd2b2b"/>
            <stop offset="100%" stopColor="#8a1010"/>
          </radialGradient>
          <radialGradient id="bm-pri" cx="62%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#ff6868"/>
            <stop offset="55%"  stopColor="#cc2020"/>
            <stop offset="100%" stopColor="#7a0e0e"/>
          </radialGradient>
        </defs>

        {/* Bar shaft — scaleX in from center first */}
        <motion.g
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          style={{ transformOrigin: "160px 44px" }}
          transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect x="0"   y="38" width="320" height="12" rx="5" fill="url(#bm-chrome)"/>
          {/* Knurling centre section */}
          <rect x="100" y="39" width="120" height="10" rx="3" fill="rgba(0,0,0,0.22)"/>
        </motion.g>

        {/* Left big inner plate — arrives first, rendered behind small outer */}
        <motion.g initial={{ x: -420 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay }}>
          <rect x="14" y="6"  width="24" height="76" rx="5" fill="url(#bm-pli)"/>
          <rect x="14" y="6"  width="24" height="76" rx="5" fill="none" stroke="rgba(255,120,120,0.18)" strokeWidth="0.8"/>
        </motion.g>
        {/* Left small outer plate — arrives 70ms later, rendered on top */}
        <motion.g initial={{ x: -420 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay + 0.07 }}>
          <rect x="0"  y="20" width="16" height="48" rx="3" fill="url(#bm-plo)"/>
          <rect x="0"  y="20" width="16" height="48" rx="3" fill="none" stroke="rgba(255,150,150,0.3)" strokeWidth="1"/>
        </motion.g>

        {/* Right big inner plate — arrives first, rendered behind small outer */}
        <motion.g initial={{ x: 420 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay }}>
          <rect x="282" y="6"  width="24" height="76" rx="5" fill="url(#bm-pri)"/>
          <rect x="282" y="6"  width="24" height="76" rx="5" fill="none" stroke="rgba(255,120,120,0.18)" strokeWidth="0.8"/>
        </motion.g>
        {/* Right small outer plate — arrives 70ms later, rendered on top */}
        <motion.g initial={{ x: 420 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay + 0.07 }}>
          <rect x="304" y="20" width="16" height="48" rx="3" fill="url(#bm-pro)"/>
          <rect x="304" y="20" width="16" height="48" rx="3" fill="none" stroke="rgba(255,150,150,0.3)" strokeWidth="1"/>
        </motion.g>
      </svg>
    </div>
  );
}

function VerticalBarMark({ height = 96, delay = 0 }: { height?: number; delay?: number }) {
  const w = Math.round(height * 40 / 108);
  const slam = { type: "spring" as const, stiffness: 480, damping: 18 };
  const barDelay = delay;
  const platesDelay = delay + 0.52;
  return (
    <div style={{ width: w, height, overflow: "hidden", position: "relative", flexShrink: 0 }}>
      <svg width={w} height={height} viewBox="0 0 40 108" style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id="vbm-steel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#aaaaaa" stopOpacity="0.75"/>
          </linearGradient>
          <linearGradient id="vbm-fire" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B6B"/>
            <stop offset="100%" stopColor="#ee5a24"/>
          </linearGradient>
        </defs>

        {/* Bar shaft + sleeves — appears first */}
        <motion.g
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          style={{ transformOrigin: "20px 54px" }}
          transition={{ duration: 0.45, delay: barDelay, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Top sleeve */}
          <rect x="16" y="0"  width="8" height="15" rx="2" fill="url(#vbm-steel)"/>
          {/* Bar shaft */}
          <rect x="17" y="30" width="6" height="48" rx="2" fill="url(#vbm-steel)" opacity="0.8"/>
          {/* Bottom sleeve */}
          <rect x="16" y="93" width="8" height="15" rx="2" fill="url(#vbm-steel)"/>
        </motion.g>

        {/* Top plates — drop from above */}
        <motion.g
          initial={{ y: -120 }} animate={{ y: 0 }}
          transition={{ ...slam, delay: platesDelay }}
        >
          {/* Outer plate */}
          <rect x="2"  y="13" width="36" height="13" rx="3" fill="url(#vbm-fire)"/>
          {/* Inner plate */}
          <rect x="7"  y="24" width="26" height="8"  rx="2" fill="url(#vbm-fire)" opacity="0.75"/>
        </motion.g>

        {/* Bottom plates — rise from below (stagger +60ms) */}
        <motion.g
          initial={{ y: 120 }} animate={{ y: 0 }}
          transition={{ ...slam, delay: platesDelay + 0.06 }}
        >
          {/* Inner plate */}
          <rect x="7"  y="76" width="26" height="8"  rx="2" fill="url(#vbm-fire)" opacity="0.75"/>
          {/* Outer plate */}
          <rect x="2"  y="82" width="36" height="13" rx="3" fill="url(#vbm-fire)"/>
        </motion.g>
      </svg>
    </div>
  );
}

// Full lockup: vertical mark + IRONLOG wordmark side by side.
function LogoLockup({ markHeight = 80, fontSize = 56, delay = 0, animate: doAnimate = true }: { markHeight?: number; fontSize?: number; delay?: number; animate?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(markHeight * 0.25) }}>
      <VerticalBarMark height={markHeight} delay={doAnimate ? delay : 999} />
      <motion.div
        initial={doAnimate ? { opacity: 0, x: -12 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, delay: delay + 0.72, ease: [0.16, 1, 0.3, 1] }}
        style={{ fontFamily: "'Space Mono', monospace", fontSize, fontWeight: 700, letterSpacing: Math.round(fontSize * 0.12), lineHeight: 1, whiteSpace: "nowrap" as const }}
      >
        <span style={{ color: "#fff" }}>IRON</span><span style={{ color: "#FF6B6B" }}>LOG</span>
      </motion.div>
    </div>
  );
}

function BarIcon({ width = 160, delay = 0, fallIn = false }: { width?: number; delay?: number; fallIn?: boolean }) {
  const h = Math.round(width * 50 / 156);
  const barDelay = delay;
  const platesDelay = delay + (fallIn ? 0.58 : 0.22);
  const slam = { type: "spring" as const, stiffness: 520, damping: 17 };
  return (
    <div style={{ width, height: h, overflow: "hidden", margin: "0 auto", position: "relative" }}>
      <svg width={width} height={h} viewBox="18 64 156 50" style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id="bi-steel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#999999" stopOpacity="0.8"/>
          </linearGradient>
          <linearGradient id="bi-fire" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B6B"/>
            <stop offset="100%" stopColor="#ee5a24"/>
          </linearGradient>
        </defs>
        <motion.rect
          x="46" y="83" width="100" height="10" rx="5"
          fill="url(#bi-steel)" opacity="0.7"
          initial={fallIn ? { y: -150, opacity: 0 } : { scaleX: 0, opacity: 0 }}
          animate={fallIn ? { y: 0, opacity: 0.7 } : { scaleX: 1, opacity: 0.7 }}
          style={{ transformOrigin: "96px 88px" }}
          transition={fallIn
            ? { duration: 0.6, delay: barDelay, ease: [0.55, 0, 0.45, 1] }
            : { duration: 0.35, delay: barDelay, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.g initial={{ x: -320 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay }}>
          <rect x="28" y="68" width="14" height="40" rx="4" fill="url(#bi-fire)"/>
          <rect x="22" y="78" width="8"  height="20" rx="3" fill="#fff" opacity="0.3"/>
        </motion.g>
        <motion.g initial={{ x: -320 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay + 0.06 }}>
          <rect x="38" y="73" width="10" height="30" rx="3" fill="url(#bi-fire)" opacity="0.75"/>
        </motion.g>
        <motion.g initial={{ x: 320 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay }}>
          <rect x="150" y="68" width="14" height="40" rx="4" fill="url(#bi-fire)"/>
          <rect x="162" y="78" width="8"  height="20" rx="3" fill="#fff" opacity="0.3"/>
        </motion.g>
        <motion.g initial={{ x: 320 }} animate={{ x: 0 }} transition={{ ...slam, delay: platesDelay + 0.06 }}>
          <rect x="144" y="73" width="10" height="30" rx="3" fill="url(#bi-fire)" opacity="0.75"/>
        </motion.g>
      </svg>
    </div>
  );
}

function PwaBanner() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [visible, setVisible] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (window.self !== window.top) return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    if (isStandalone) return;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (!isIOS && !isAndroid) return;

    // Set platform regardless of cooldown — needed for the signup re-prompt path
    setPlatform(isIOS ? "ios" : "android");

    // Signup re-prompt: bypass cooldown, show as urgent/important
    const onSignup = () => { setUrgent(true); setVisible(true); };
    window.addEventListener("ironlog-pwa-signup", onSignup);

    // Regular flow: respect 3-day cooldown
    let t: ReturnType<typeof setTimeout> | undefined;
    const last = localStorage.getItem("ironlog-pwa-v2");
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    if (!last || Date.now() - parseInt(last) >= THREE_DAYS) {
      t = setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("ironlog-pwa-signup", onSignup);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem("ironlog-pwa-v2", String(Date.now()));
    setVisible(false);
    setUrgent(false);
  };

  if (!platform) return null;

  // Shared phone frame
  const phone = (children: React.ReactNode, h = 220) => (
    <div style={{ width: 160, height: h, borderRadius: 20, border: "2px solid #3a3a3a", background: "#111", overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      {/* status bar */}
      <div style={{ background: "#111", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px 3px", flexShrink: 0 }}>
        <span style={{ fontSize: 7, color: "#fff", fontWeight: 700 }}>18:12</span>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <span style={{ fontSize: 6, color: "#fff" }}>▂▄▆</span>
          <span style={{ fontSize: 6, color: "#fff" }}>WiFi</span>
          <span style={{ fontSize: 6, color: "#fff" }}>▓</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );

  // Shared IRONLOG app content — matches actual landing page layout
  const appContent = (
    <div style={{ flex: 1, background: "#0a0a0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Nav */}
      <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 3, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 7.5, fontWeight: 700, color: "#fff" }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></span>
        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          <span style={{ fontSize: 4, background: "rgba(255,107,107,0.15)", border: "0.5px solid rgba(255,107,107,0.5)", color: "#FF6B6B", borderRadius: 3, padding: "1px 3px", fontWeight: 600 }}>ATHLETES</span>
          <span style={{ fontSize: 4, background: "rgba(78,205,196,0.15)", border: "0.5px solid rgba(78,205,196,0.5)", color: "#4ECDC4", borderRadius: 3, padding: "1px 3px", fontWeight: 600 }}>TRAINERS</span>
        </div>
      </div>
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "5px 4px 3px", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: 0.5, lineHeight: 1 }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
        <div style={{ fontSize: 3.5, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, marginTop: 2 }}>LIFT · TRACK · PROGRESS</div>
        <div style={{ fontSize: 4, color: "rgba(255,255,255,0.25)", fontStyle: "italic", marginTop: 2 }}>Do the work.</div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "3px 4px", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[["119+","EXERCISES"],["FREE","FOR ATHLETES"],["PWA","INSTALLABLE"]].map(([v,l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 6, fontWeight: 700, color: "#FF6B6B" }}>{v}</div>
            <div style={{ fontSize: 3, color: "rgba(255,255,255,0.3)", letterSpacing: 0.3 }}>{l}</div>
          </div>
        ))}
      </div>
      {/* Feature cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, padding: "3px 4px" }}>
        {[
          ["Log every set in seconds","Your last session's numbers are always right there — just enter weight and reps."],
          ["Rest timer follows you","Configurable per exercise. Push notification fires even with your screen locked."],
          ["Live personal bests","A trophy overlay fires the moment you beat a record — no waiting until the end."],
          ["Personalised plan","Tell us your goals, equipment, and schedule. Get a full weekly split instantly."],
        ].map(([t,d]) => (
          <div key={t} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, padding: "3px 4px" }}>
            <div style={{ fontSize: 4.5, fontWeight: 700, color: "#fff", marginBottom: 1 }}>{t}</div>
            <div style={{ fontSize: 3, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const iosSteps = [
    {
      label: "Open the website in Safari",
      mockup: phone(
        <>
          {/* Safari URL bar */}
          <div style={{ background: "#1c1c1e", padding: "5px 8px 4px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 6, color: "#aaa", fontWeight: 600 }}>AA</span>
              <div style={{ flex: 1, background: "#2c2c2e", borderRadius: 7, padding: "3px 8px", textAlign: "center" }}>
                <span style={{ fontSize: 7, color: "#eee" }}>ironlog.app</span>
              </div>
              <span style={{ fontSize: 9, color: "#aaa" }}>↻</span>
            </div>
          </div>
          {/* Real page via iframe — PwaBanner is suppressed inside iframes */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <iframe src="/" scrolling="no" tabIndex={-1} style={{ width: 390, height: 550, border: "none", transform: "scale(0.4)", transformOrigin: "top left", pointerEvents: "none" }} />
          </div>
          {/* Safari toolbar */}
          <div style={{ background: "#1c1c1e", borderTop: "1px solid #333", padding: "5px 0", display: "flex", justifyContent: "space-around", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>◁</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>▷</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>⬆</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>📖</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>⊞</span>
          </div>
        </>
      ),
    },
    {
      label: 'Tap the Share button (⬆) then "Add to Home Screen"',
      mockup: phone(
        <>
          {/* App peeking behind sheet — mini nav bar matching real app header */}
          <div style={{ background: "#0a0a0f", padding: "4px 7px", display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, fontWeight: 700, color: "#fff" }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></span>
            <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
              <span style={{ fontSize: 4.5, background: "rgba(255,107,107,0.15)", border: "0.5px solid rgba(255,107,107,0.5)", color: "#FF6B6B", borderRadius: 3, padding: "1px 3px", fontWeight: 600 }}>ATHLETES</span>
              <span style={{ fontSize: 4.5, background: "rgba(78,205,196,0.15)", border: "0.5px solid rgba(78,205,196,0.5)", color: "#4ECDC4", borderRadius: 3, padding: "1px 3px", fontWeight: 600 }}>TRAINERS</span>
            </div>
          </div>
          {/* iOS share sheet */}
          <div style={{ flex: 1, background: "#1c1c1e", display: "flex", flexDirection: "column" }}>
            {/* App info row */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <img src="/apple-touch-icon.png" alt="IRONLOG" style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 6, fontWeight: 700, color: "#fff" }}>IRONLOG</div>
                <div style={{ fontSize: 4.5, color: "#888" }}>ironlog.app</div>
              </div>
              <div style={{ marginLeft: "auto", background: "rgba(255,255,255,0.08)", borderRadius: 6, padding: "1px 4px" }}>
                <span style={{ fontSize: 4.5, color: "#aaa" }}>Options ›</span>
              </div>
            </div>
            {/* App icon row */}
            <div style={{ display: "flex", justifyContent: "space-around", padding: "4px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              {[{ c: "#29ABE2", l: "AirDrop" }, { c: "#34C759", l: "Messages" }, { c: "#1976D2", l: "Mail" }, { c: "#25D366", l: "WhatsApp" }].map(({ c, l }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: c, margin: "0 auto 1px" }} />
                  <div style={{ fontSize: 3.5, color: "#888" }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Action list */}
            <div style={{ background: "#2c2c2e", margin: "3px 3px 0", borderRadius: 7, overflow: "hidden", flex: 1 }}>
              {[
                { label: "Copy", icon: "⎘" },
                { label: "Add to Reading List", icon: "∞" },
                { label: "Add Bookmark", icon: "□" },
                { label: "Add to Favorites", icon: "☆" },
              ].map(({ label, icon }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.75)" }}>{label}</span>
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{icon}</span>
                </div>
              ))}
              {/* Highlighted — red rectangle border like the reference */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", outline: "2px solid #FF6B6B", outlineOffset: "-1px" }}>
                <span style={{ fontSize: 6.5, color: "#fff", fontWeight: 700 }}>Add to Home Screen</span>
                <span style={{ fontSize: 7, color: "rgba(255,255,255,0.5)" }}>⊞</span>
              </div>
              {[
                { label: "Markup", icon: "✎" },
                { label: "Print", icon: "▤" },
              ].map(({ label, icon }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.75)" }}>{label}</span>
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{icon}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Safari toolbar — share button highlighted with red box */}
          <div style={{ background: "#1c1c1e", borderTop: "1px solid #333", padding: "5px 0", display: "flex", justifyContent: "space-around", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>◁</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>▷</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, color: "#FF6B6B" }}>⬆</span>
              <div style={{ position: "absolute", inset: -3, border: "2px solid #FF6B6B", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>📖</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>⊞</span>
          </div>
        </>,
        310
      ),
    },
    {
      label: "The app will be added to your Home screen",
      mockup: phone(
        <div style={{ flex: 1, background: "linear-gradient(160deg,#1a0a0a,#2d0d0d)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "16px 8px", gap: 6 }}>
          <img src="/apple-touch-icon.png" alt="IRONLOG" style={{ width: 48, height: 48, borderRadius: 13, boxShadow: "0 6px 20px rgba(255,107,107,0.4)" }} />
          <span style={{ fontSize: 7, color: "#fff", fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>IRONLOG</span>
        </div>,
        240
      ),
    },
  ];

  const androidSteps = [
    {
      label: "Open the website in Chrome",
      mockup: phone(
        <>
          {/* Chrome address bar */}
          <div style={{ background: "#202124", padding: "5px 6px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: "#888" }}>□</span>
            <div style={{ flex: 1, background: "#303134", borderRadius: 20, padding: "3px 7px", display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34a853" }} />
              <span style={{ fontSize: 6.5, color: "#bbb" }}>ironlog.app</span>
            </div>
            <span style={{ fontSize: 8, color: "#888" }}>☆</span>
            <span style={{ fontSize: 12, color: "#888", fontWeight: 900 }}>⋮</span>
          </div>
          {/* Real page via iframe */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <iframe src="/" scrolling="no" tabIndex={-1} style={{ width: 390, height: 600, border: "none", transform: "scale(0.4)", transformOrigin: "top left", pointerEvents: "none" }} />
          </div>
        </>
      ),
    },
    {
      label: 'Tap the menu (⋮) then "Add to Home screen"',
      mockup: phone(
        <>
          {/* Chrome bar with ⋮ highlighted */}
          <div style={{ background: "#202124", padding: "5px 6px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 7, color: "#888" }}>←</span>
            <span style={{ fontSize: 7, color: "#555" }}>→</span>
            <div style={{ flex: 1, background: "#303134", borderRadius: 20, padding: "2px 6px", display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34a853" }} />
              <span style={{ fontSize: 5.5, color: "#bbb" }}>ironlog.app</span>
            </div>
            <span style={{ fontSize: 8, color: "#888" }}>☆</span>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#FF6B6B", fontWeight: 900, lineHeight: 1 }}>⋮</span>
              <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "2px solid #FF6B6B" }} />
            </div>
          </div>
          {/* IRONLOG app partially visible behind menu */}
          <div style={{ background: "#0a0a0f", padding: "3px 6px", flexShrink: 0 }}>
            <div style={{ fontSize: 7.5, fontWeight: 900, color: "#fff" }}>IRON<span style={{ color: "#FF6B6B" }}>LOG</span></div>
          </div>
          {/* Chrome dropdown menu */}
          <div style={{ flex: 1, background: "#2a2a2a", overflow: "hidden" }}>
            {["New tab","New incognito tab","History","Downloads","Bookmarks","Recent tabs","Share...","Find in page","Translate..."].map((item, i) => (
              <div key={i} style={{ padding: "3px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.6)" }}>{item}</span>
              </div>
            ))}
            {/* Highlighted — red rectangle border matching reference */}
            <div style={{ padding: "3px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", outline: "2px solid #FF6B6B", outlineOffset: "-1px", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 7 }}>⊞</span>
              <span style={{ fontSize: 6.5, color: "#fff", fontWeight: 700 }}>Add to Home screen</span>
            </div>
            {[["Desktop site","□"],["Settings","⚙"],["Help & feedback","?"]].map(([item, icon], i) => (
              <div key={i} style={{ padding: "3px 8px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.4)" }}>{item}</span>
                <span style={{ fontSize: 6, color: "rgba(255,255,255,0.2)" }}>{icon}</span>
              </div>
            ))}
          </div>
        </>,
        295
      ),
    },
    {
      label: "The app will be added to your Home screen",
      mockup: phone(
        <div style={{ flex: 1, background: "linear-gradient(160deg,#0a0a1a,#0d0d2d)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "16px 8px", gap: 6 }}>
          <img src="/icon-192.png" alt="IRONLOG" style={{ width: 48, height: 48, borderRadius: 13, boxShadow: "0 6px 20px rgba(255,107,107,0.4)" }} />
          <span style={{ fontSize: 7, color: "#fff", fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>IRONLOG</span>
        </div>,
        240
      ),
    },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const platformLabel = platform === "ios" ? "iOS (Safari)" : "Android (Chrome)";
  const platformIcon = platform === "ios" ? "" : "🤖"; //  = Apple logo (renders on all Apple devices)

  return createPortal(
    <AnimatePresence>
    {visible && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(0,0,0,0.65)" }} onClick={dismiss} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9998, display: "flex", justifyContent: "center" }}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ maxWidth: 480, width: "100%", background: "#0c0c10", borderTop: urgent ? "3px solid #FF6B6B" : "2px solid rgba(255,107,107,0.45)", borderRadius: "22px 22px 0 0", boxShadow: urgent ? "0 -20px 70px rgba(255,107,107,0.3)" : "0 -16px 60px rgba(255,107,107,0.15)", display: "flex", flexDirection: "column", maxHeight: "92dvh" }}>
          <div style={{ overflowY: "auto", padding: "0 18px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "12px auto 16px" }} />
            {/* Urgent badge — shown only on post-signup re-prompt */}
            {urgent && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.35)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FF6B6B", letterSpacing: 0.2 }}>Account created — one last step!</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 3, lineHeight: 1.4 }}>Add IronLog to your Home Screen for instant access, offline use & push notifications.</div>
                </div>
              </div>
            )}
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 14px rgba(255,107,107,0.35)" }}>
                  <img src="/icon-192.png" alt="IRONLOG" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#fff" }}>{urgent ? "Add to Home Screen" : "Install IronLog"}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{platformIcon} {platformLabel} · Free · No App Store</div>
                </div>
              </div>
              <button onClick={dismiss} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
            </div>
            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
              {steps.map((step, i) => (
                <div key={i}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FF6B6B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{step.label}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>{step.mockup}</div>
                </div>
              ))}
            </div>
            {/* Dismiss */}
            <button onClick={dismiss} style={{ width: "100%", padding: "13px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remind me later</button>
          </div>
        </motion.div>
      </div>
    </>
    )}
    </AnimatePresence>,
    document.body
  );
}

export default function Page() {
  return (
    <>
      <PwaBanner />
      <HomePage />
    </>
  );
}
