"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { WORKOUT_DATA, WorkoutDay } from "../lib/workouts";
import { EXERCISES } from "../lib/exercises";

const VAPID_PUBLIC_KEY = "BOhlYEJGvtpt4q1HA9DkjMDIvNpj-Yh9ia8Jffoy1ETlCMDxzqUDJzXMRSE1ByqbHooHvqHRmTW47G_osz8P5p4";

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
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
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
  const [showExBrowser, setShowExBrowser] = useState(false);

  // ── Settings / trainer upgrade ──
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [notifStatus, setNotifStatus] = useState<"idle" | "granted" | "denied" | "unsupported" | "error" | "requesting">("idle");
  const [testingNotif, setTestingNotif] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showNotifBanner, setShowNotifBanner] = useState(false);

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
  const [editingGoals, setEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
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
  const [ob, setOb] = useState({
    dob: "", gender: "", heightCm: "", weightKg: "", bodyFatPct: "",
    goal: "", targetArea: "", fitnessLevel: "", location: "", equipment: [] as string[], daysPerWeek: 4,
  });

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
        setUser({ id: data.user.id, username: data.user.username, role: data.user.role ?? "user" });
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
          goal: p.goal || "",
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
      setView("home"); setActiveDay(null); setLog({});
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
    setView("home"); setActiveDay(null); setLog({});
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
    setView("home"); setActiveDay(null); setLog({});
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

  // ─── LOADING ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ color: "#555", fontSize: 13, letterSpacing: 4, fontFamily: "'Space Mono', monospace" }}>IRONLOG</div>
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

    const EQUIPMENT_OPTIONS = [
      { id: "dumbbell", label: "Dumbbells" }, { id: "barbell", label: "Barbell" },
      { id: "resistance_band", label: "Resistance Bands" }, { id: "pullup_bar", label: "Pull-Up Bar" },
      { id: "bench", label: "Bench" }, { id: "kettlebell", label: "Kettlebell" },
      { id: "dip_bar", label: "Dip Bars" },
    ];

    const toggleEquip = (id: string) => setOb(o => ({ ...o, equipment: o.equipment.includes(id) ? o.equipment.filter(e => e !== id) : [...o.equipment, id] }));

    const canNext = () => {
      if (onboardingStep === 0) return true;
      if (onboardingStep === 1) return !!ob.dob && !!ob.gender;
      if (onboardingStep === 2) return !!ob.heightCm && !!ob.weightKg;
      if (onboardingStep === 3) return !!ob.goal;
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
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 4, marginBottom: 8 }}>YOUR GOAL</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 28 }}>What are you training for?</div>
            {[
              { id: "muscle", label: "Build Muscle", desc: "Hypertrophy-focused training with progressive overload" },
              { id: "strength", label: "Get Stronger", desc: "Heavy compound lifts, low reps, long rest" },
              { id: "fat_loss", label: "Lose Fat", desc: "Higher volume, cardio finishers, calorie-burning focus" },
              { id: "fitness", label: "General Fitness", desc: "Balanced training to improve overall health and conditioning" },
            ].map(g => (
              <div key={g.id} style={selCard(ob.goal === g.id)} onClick={() => setOb(o => ({ ...o, goal: g.id }))}>
                <div style={{ color: ob.goal === g.id ? "#FF6B6B" : "#fff", fontWeight: 600, marginBottom: 4 }}>{g.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{g.desc}</div>
              </div>
            ))}
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

    // Day editor view
    if (editingDay) {
      const exs: any[] = editingDay.exercises ?? [];
      const filtered = EXERCISES_LIST.filter((e: any) =>
        !exSearch || e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
        e.primaryMuscles.some((m: string) => m.includes(exSearch.toLowerCase()))
      ).slice(0, 40);

      return (
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
                <input value={exSearch} onChange={e => setExSearch(e.target.value)} placeholder="Search by name or muscle..." autoFocus style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", padding: "12px 16px", width: "100%", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {filtered.map((ex: any) => (
                    <div key={ex.id} onClick={async () => {
                      const newEx = { exerciseId: ex.id, name: ex.name, sets: 3, reps: "10–12", rest: 60, notes: null };
                      await saveDay(editingDay, [...exs, newEx]);
                      setShowExBrowser(false); setExSearch("");
                    }} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", marginBottom: 6, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{ex.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{ex.primaryMuscles.join(", ")} · {ex.equipment.join(", ")} · {ex.difficulty}</div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>No exercises found</div>}
                </div>
                <button onClick={() => { setShowExBrowser(false); setExSearch(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
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
      {customPlan && (
        <div style={{ padding: "4px 20px 0", textAlign: "center" }}>
          <button onClick={async () => {
            if (!confirm("Revert to the original 5-day split? Your custom plan will be removed, but your workout history is kept.")) return;
            await fetch("/api/plan", { method: "DELETE" });
            setCustomPlan(null);
            setPlanNote("");
          }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1, padding: "10px 0" }}>← revert to original 5-day split</button>
        </div>
      )}
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
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: d.color, fontWeight: 700, opacity: 0.8 }}>{d.label}</span>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{d.title}</span>
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
        {!clientDataLoading && clientDetailTab === "history" && (
          <div className="fade-in" style={{ padding: "16px 20px 0" }}>
            {flatHistory.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "48px 0" }}>No workouts logged yet</div>
            )}
            {flatHistory.map((s: any, i: number) => {
              const setCount = typeof s.sets === "object" ? Object.keys(s.sets).length : 0;
              return (
                <div key={`${s.id}-${i}`} style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 12, padding: "14px 16px", marginBottom: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.dayName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
                      {s.date} · {s.duration}{setCount > 0 ? ` · ${setCount} set${setCount !== 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                { label: "GENDER", value: p.gender || "—" },
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
                  {[
                    { label: "GOAL", value: p.goal?.replace(/_/g, " ") },
                    { label: "FITNESS LEVEL", value: p.fitnessLevel },
                    { label: "LOCATION", value: p.location },
                    { label: "EQUIPMENT", value: (p.equipment as string[])?.join(", ") || "—" },
                    { label: "TARGET AREA", value: p.targetArea && p.targetArea !== "none" ? p.targetArea : "—" },
                  ].map((row, i) => (
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
          return (
            <div key={msg.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", background: isMine ? "rgba(78,205,196,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${isMine ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", maxWidth: "75%" }}>
              <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.4 }}>{msg.body}</div>
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

    const doUpgrade = async () => {
      setUpgrading(true);
      setUpgradeError("");
      try {
        const res = await fetch("/api/auth", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upgrade-trainer" }) });
        const data = await res.json();
        if (data.error) { setUpgradeError(data.error); setUpgrading(false); return; }
        setUser(u => u ? { ...u, role: "trainer" } : u);
        setConfirmUpgrade(false);
      } catch { setUpgradeError("Something went wrong"); }
      setUpgrading(false);
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

          {/* Trainer upgrade */}
          {!isTrainer && !confirmUpgrade && (
            <div style={{ background: "rgba(78,205,196,0.04)", border: "1px solid rgba(78,205,196,0.15)", borderRadius: 16, padding: "20px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "rgba(78,205,196,0.6)", letterSpacing: 3, marginBottom: 10 }}>BECOME A TRAINER</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 16 }}>Upgrade your account to trainer mode. You'll be able to search for users, send adoption requests, and monitor your clients' progress and stats.</div>
              <button onClick={() => setConfirmUpgrade(true)} style={{ background: "rgba(78,205,196,0.1)", border: "1px solid rgba(78,205,196,0.3)", borderRadius: 10, padding: "12px 20px", color: "#4ECDC4", fontSize: 13, fontWeight: 600, letterSpacing: 1, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Upgrade to Trainer →</button>
            </div>
          )}

          {!isTrainer && confirmUpgrade && (
            <div style={{ background: "rgba(78,205,196,0.06)", border: "1px solid rgba(78,205,196,0.25)", borderRadius: 16, padding: "24px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Confirm upgrade</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 8 }}>
                As a trainer you'll be able to:<br />
                · Search for users by username<br />
                · Send them an adoption request<br />
                · View their full workout history and stats once accepted
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 20, lineHeight: 1.6 }}>This is a permanent upgrade — your own training plan and history are not affected.</div>
              {upgradeError && <div style={{ fontSize: 13, color: "#FF6B6B", marginBottom: 12 }}>{upgradeError}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={doUpgrade} disabled={upgrading} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg, #4ECDC4, #44a08d)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 1, cursor: upgrading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: upgrading ? 0.6 : 1 }}>{upgrading ? "UPGRADING…" : "CONFIRM UPGRADE"}</button>
                <button onClick={() => { setConfirmUpgrade(false); setUpgradeError(""); }} style={{ padding: "13px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
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
                {!editingGoals && <button onClick={() => setEditingGoals(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>EDIT</button>}
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
                    <button onClick={() => setEditingGoals(false)} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
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
              const weightData = bodyMetrics.filter(m => m.weightKg != null).map(m => m.weightKg).reverse();
              const bfData = bodyMetrics.filter(m => m.bodyFatPct != null).map(m => m.bodyFatPct).reverse();
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
                  {weightData.length >= 2 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 8 }}>WEIGHT TREND</div>
                      <MiniChart data={weightData} color="#4ECDC4" label={`${weightData[weightData.length - 1]}kg`} />
                    </div>
                  )}
                  {bfData.length >= 2 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontFamily: "'Space Mono', monospace", fontWeight: 600, marginBottom: 8 }}>BODY FAT TREND</div>
                      <MiniChart data={bfData} color="#A29BFE" label={`${bfData[bfData.length - 1]}%`} />
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
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace" }}>{new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                      <div style={{ fontSize: 13, color: "#fff", marginTop: 2, fontWeight: 500 }}>
                        {m.weightKg != null ? `${m.weightKg}kg` : ""}
                        {m.weightKg != null && m.bodyFatPct != null ? " · " : ""}
                        {m.bodyFatPct != null ? `${m.bodyFatPct}% bf` : ""}
                      </div>
                    </div>
                    <button onClick={() => deleteBodyMetric(m.id)} style={{ background: "none", border: "none", color: "rgba(255,107,107,0.4)", fontSize: 16, cursor: "pointer", padding: "4px 8px" }}>×</button>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>{ex.name}</span>
                        {ex.type && <span style={{ fontSize: 9, fontWeight: 600, color: bc[ex.type] || "#888", opacity: 0.7, letterSpacing: 1 }}>{ex.type.toUpperCase()}</span>}
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
