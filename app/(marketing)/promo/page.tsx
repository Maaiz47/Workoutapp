"use client";

import { useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { MarketingNav } from "../_components/MarketingNav";
import { MarketingFooter } from "../_components/MarketingFooter";
import { Reveal, Stagger, StaggerItem } from "../_components/Reveal";
import { AnimatedCounter } from "../_components/AnimatedCounter";
import { Tilt3D, MouseTilt3D } from "../_components/Tilt3D";
import { Expandable } from "../_components/Expandable";

const WA_LINK =
  "https://wa.me/9609120007?text=Hi%2C+I%27d+like+to+request+early+access+to+IronLog";

type TabKey = "tracking" | "trainer" | "exercises" | "progress" | "plans" | "competition";

interface FeatureItem {
  icon: string;
  bg: string;
  title: string;
  desc: string;
}

const TAB_DATA: Record<TabKey, { label: string; items: FeatureItem[] }> = {
  tracking: {
    label: "Workout Tracking",
    items: [
      { icon: "🏋️", bg: "rgba(255,102,68,0.15)", title: "Live Session Tracking", desc: "Log every set, rep, and weight in real time. Swipe through your day's exercises with a clean, distraction-free interface." },
      { icon: "📊", bg: "rgba(255,102,68,0.15)", title: "Last Session Comparison", desc: "See exactly what you lifted last time, right next to your input. Know instantly if you're progressing." },
      { icon: "🏆", bg: "rgba(255,102,68,0.15)", title: "Automatic PR Detection", desc: "Personal records are tracked and celebrated automatically. No manual logging — IronLog spots new bests the moment they happen." },
      { icon: "⏱️", bg: "rgba(78,205,196,0.15)", title: "Smart Rest Timer", desc: "Configurable rest periods with push notifications. Even if you lock your phone, you'll know when to get back under the bar." },
      { icon: "📝", bg: "rgba(78,205,196,0.15)", title: "Warmup Tracking", desc: "Mark warmup sets separately from working sets. Keep your data clean without losing context on your approach." },
      { icon: "▶️", bg: "rgba(78,205,196,0.15)", title: "Session Resume", desc: "Close the app mid-workout and resume exactly where you left off. Your session persists until you explicitly finish it." },
      { icon: "⚡", bg: "rgba(255,102,68,0.15)", title: "HIIT & Conditioning", desc: "20+ circuit exercises including burpees, jump squats, mountain climbers, and plyometrics. Auto-added as a finisher or dedicated day based on your schedule." },
    ],
  },
  trainer: {
    label: "Trainer Tools",
    items: [
      { icon: "👥", bg: "rgba(255,102,68,0.15)", title: "Client Roster", desc: "All your clients in one place. See each person's last workout date, total session count, and jump straight into their data." },
      { icon: "📋", bg: "rgba(255,102,68,0.15)", title: "Program Delivery", desc: "Build custom weekly splits and push them directly to a client's app. No PDFs, no WhatsApp screenshots — live updates, instantly." },
      { icon: "👁️", bg: "rgba(255,102,68,0.15)", title: "Client History Access", desc: "Browse any client's full workout history, session by session. See every set logged, so you never write a program blind." },
      { icon: "💬", bg: "rgba(78,205,196,0.15)", title: "In-App Messaging", desc: "Chat with clients without leaving the platform. No more juggling WhatsApp, email, and your coaching app separately." },
      { icon: "📨", bg: "rgba(78,205,196,0.15)", title: "Plan Proposals", desc: "Send updated programs as proposals. Clients see the new plan before it goes live — clean handoff, no confusion." },
      { icon: "📈", bg: "rgba(78,205,196,0.15)", title: "Client Progress View", desc: "Check any client's body metrics, PR list, and training trends. Spot plateaus early and adjust their program on the fly." },
    ],
  },
  exercises: {
    label: "Exercise Library",
    items: [
      { icon: "🔍", bg: "rgba(255,230,109,0.15)", title: "Smart Exercise Browser", desc: "Filter 119+ exercises by location, movement pattern (push/pull/legs/core/cardio), and target muscle group simultaneously." },
      { icon: "🎬", bg: "rgba(255,230,109,0.15)", title: "Form Demo Images", desc: "Every exercise shows start and finish position images sourced from a verified database of hundreds of movements." },
      { icon: "🫀", bg: "rgba(255,230,109,0.15)", title: "Muscle Activation Maps", desc: "Swipe from the form demo to a glowing muscle body diagram — primary muscles in red, secondary in orange, front and back views." },
      { icon: "🏷️", bg: "rgba(255,102,68,0.15)", title: "Muscle Group Filters", desc: "Filter by chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, or core — including compound overlap." },
      { icon: "🏠", bg: "rgba(255,102,68,0.15)", title: "Equipment-Aware", desc: "Every exercise is tagged for gym, home, or both. Bodyweight filter isolates exercises that need zero equipment." },
      { icon: "📐", bg: "rgba(255,102,68,0.15)", title: "Difficulty Levels", desc: "Beginner, intermediate, and advanced labels on every exercise. Perfect for matching movements to your client's actual level." },
    ],
  },
  progress: {
    label: "Progress & Analytics",
    items: [
      { icon: "📅", bg: "rgba(78,205,196,0.15)", title: "28-Day Activity Calendar", desc: "Visual snapshot of training consistency. See exactly which days were hit at a glance — weekly patterns become obvious." },
      { icon: "🔥", bg: "rgba(78,205,196,0.15)", title: "Streak Tracking", desc: "Week-over-week training streaks to keep motivation high. Nothing kills consistency faster than watching a streak disappear." },
      { icon: "📉", bg: "rgba(78,205,196,0.15)", title: "Weight & Body Fat Trends", desc: "Log and chart body weight and body fat percentage over time. Clean line charts show the trajectory that matters." },
      { icon: "💪", bg: "rgba(255,102,68,0.15)", title: "Top 8 Personal Records", desc: "Your highest lifts across every tracked exercise, with the date they were set. Revisit them, beat them." },
      { icon: "📈", bg: "rgba(255,102,68,0.15)", title: "Per-Exercise Trend Charts", desc: "Average weight, average reps, and personal best for any exercise in your history. Spot stalls before they become months of wasted time." },
      { icon: "⚖️", bg: "rgba(255,102,68,0.15)", title: "BMI & Body Stats", desc: "Track height, weight, body fat, and target goals with BMI categorization. Full body composition picture in one view." },
    ],
  },
  plans: {
    label: "Plan Builder",
    items: [
      { icon: "📋", bg: "rgba(255,230,109,0.15)", title: "Smart Plan Generation", desc: "Answer a few questions about goals, level, equipment, and days per week — get a complete weekly split in seconds." },
      { icon: "✏️", bg: "rgba(255,230,109,0.15)", title: "Full Custom Builder", desc: "Drag, add, and remove exercises from any day. Complete control over sets, reps, rest periods, and exercise order." },
      { icon: "💾", bg: "rgba(255,230,109,0.15)", title: "Save & Restore Routines", desc: "Save any program as a named routine. Restore it later with one tap — never lose a good program you built." },
      { icon: "🔗", bg: "rgba(78,205,196,0.15)", title: "Routine Sharing", desc: "Share saved routines to any user by username. Trainers can push programs; athletes can share what's working." },
      { icon: "🎯", bg: "rgba(78,205,196,0.15)", title: "Target Area Selection", desc: "Build around specific goals: full body, upper/lower split, or rehabilitation-focused with options like knee and lower back." },
      { icon: "🔄", bg: "rgba(78,205,196,0.15)", title: "Instant Regeneration", desc: "Update your settings — location, equipment, goals — and regenerate a fresh plan immediately without losing your history." },
    ],
  },
  competition: {
    label: "Competition",
    items: [
      { icon: "🏆", bg: "rgba(255,230,109,0.18)", title: "6-Tier Animal Progression", desc: "🐱 Kitten → 🐒 Monkey → 🦊 Fox → 🐯 Tiger → 🦁 Lion → 🦍 Gorilla. Climb by session count. 4-week streak + 8 PRs bumps you up early." },
      { icon: "📊", bg: "rgba(167,139,250,0.18)", title: "Client Leaderboard (Trainers)", desc: "Rank every client by sessions, streak, or intensity score. Medals on top three. Gold row on first place. Tier emojis everywhere." },
      { icon: "🏝️", bg: "rgba(78,205,196,0.18)", title: "Leaderboard Groups", desc: "Spin up public or private groups. Add your clients in bulk. Invite other trainers by username. Pending invites surface at the top of the dashboard." },
      { icon: "🥇", bg: "rgba(255,230,109,0.18)", title: "Live Rank Updates", desc: "Rankings recompute the moment anyone in the group logs a session. No daily rollup — instant feedback for everyone competing." },
      { icon: "👤", bg: "rgba(167,139,250,0.18)", title: "Tier Card", desc: "Big gradient gold card on your home screen showing current tier, progress bar to the next rank, and exactly how many more sessions you need." },
      { icon: "✏️", bg: "rgba(255,102,68,0.15)", title: "Custom Exercise Library", desc: "Trainer-only: build your own exercises with custom names, muscle tags, equipment, and up to 5 demo photos hosted on our Cloudinary pipeline." },
      { icon: "🔥", bg: "rgba(255,102,68,0.15)", title: "Streak + PR Bonuses", desc: "Two parallel performance bonuses combine to fast-track your tier promotion. Consistency and intensity both rewarded — not just raw session count." },
    ],
  },
};

const TAB_ORDER: TabKey[] = ["tracking", "trainer", "exercises", "progress", "plans", "competition"];

const PROMO_CAL_ACTIVE = new Set([2, 3, 6, 7, 9, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27]);

export default function PromoPage() {
  const [tab, setTab] = useState<TabKey>("tracking");
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.4]);

  return (
    <>
      <MarketingNav active="promo" ctaLabel="Get Early Access" ctaHref={WA_LINK} />

      {/* HERO */}
      <section className="promo-hero">
        <motion.div className="mkt-hero-radial orange" style={{ y: heroY, opacity: heroOpacity }} />
        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          ⚡ BUILT FOR TRAINERS &amp; ATHLETES
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Your clients.<br />
          Your program.<br />
          <span>Your edge.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          IronLog is the all-in-one training platform for serious coaches — manage clients, write programs, track progress, and communicate from one clean app.
        </motion.p>
        <motion.div
          className="hero-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <a href={WA_LINK} className="btn-primary">Request Early Access</a>
          <a href="#features" className="btn-outline">See All Features</a>
        </motion.div>
      </section>

      {/* APP MOCKUP IMAGE */}
      <Reveal as="div" direction="up" amount={0.05} style={{ display: "flex", justifyContent: "center", padding: "0 24px 32px", background: "linear-gradient(to bottom, transparent, rgba(255,102,68,0.04), transparent)" }}>
        <MouseTilt3D style={{ maxWidth: 420, width: "92%" }}>
          <motion.img
            src="/ai/promo-hero.jpg"
            alt="IronLog app interface"
            loading="eager"
            style={{ width: "100%", borderRadius: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(255,102,68,0.14)", display: "block" }}
          />
        </MouseTilt3D>
      </Reveal>

      {/* STATS BAR */}
      <Reveal>
        <div className="stats-bar">
          <div className="stat"><div className="stat-num"><AnimatedCounter to={119} suffix="+" /></div><div className="stat-label">EXERCISES</div></div>
          <div className="stat"><div className="stat-num"><AnimatedCounter to={12} /></div><div className="stat-label">MUSCLE GROUPS</div></div>
          <div className="stat"><div className="stat-num">∞</div><div className="stat-label">CUSTOM ROUTINES</div></div>
          <div className="stat"><div className="stat-num"><AnimatedCounter to={1} /></div><div className="stat-label">APP FOR ALL</div></div>
        </div>
      </Reveal>

      {/* WHO IT'S FOR */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">WHO IT&apos;S FOR</div>
          <h2 className="section-title">One platform, two sides.</h2>
          <p className="section-sub">Whether you&apos;re a trainer building a client roster or an athlete chasing PRs, IronLog has you covered.</p>
        </Reveal>
        <Stagger className="persona-grid" stagger={0.12}>
          <StaggerItem className="persona-card trainer">
            <div className="persona-label">FOR TRAINERS</div>
            <h3>Grow your coaching business</h3>
            <ul>
              {[
                "Build and deliver custom programs to each client",
                "Create custom exercises with up to 5 demo photos each",
                "Rank clients on a live leaderboard — sessions, streak, intensity",
                "Spin up public or private leaderboard groups, invite other trainers",
                "Monitor every client's live workout data and history",
                "Send plan updates and proposals with one tap",
                "Message clients directly inside the app — ticks show delivery & read",
                "Searchable client roster with tier badges and activity signals",
              ].map((t, i) => (
                <li key={i}><span className="check">✦</span>{t}</li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem className="persona-card client">
            <div className="persona-label">FOR ATHLETES &amp; CLIENTS</div>
            <h3>Train smarter every session</h3>
            <ul>
              {[
                "Personalised plan matched to your goals and equipment",
                "Set-by-set logging with automatic PR detection",
                "Earn your tier — 🐱 Kitten → 🦍 Gorilla, six ranks of progression",
                "Join leaderboard groups and compete with friends and gym mates",
                "See your last session's numbers right on screen",
                "Rest timer with push notifications",
                "Exercise form demos and muscle activation maps",
                "Body metrics, weight trends, and streak tracking",
              ].map((t, i) => (
                <li key={i}><span className="check">✦</span>{t}</li>
              ))}
            </ul>
          </StaggerItem>
        </Stagger>
      </section>

      {/* FEATURE TABS */}
      <section id="features" className="mkt-section">
        <Reveal>
          <div className="section-tag">FEATURES</div>
          <h2 className="section-title">Everything in one place.</h2>
          <p className="section-sub">Click a category to explore the features.</p>
        </Reveal>

        <Reveal direction="up" delay={0.05}>
          <div className="feat-tabs" role="tablist">
            {TAB_ORDER.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`feat-tab${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
              >
                {TAB_DATA[key].label}
              </button>
            ))}
          </div>
        </Reveal>

        <div style={{ position: "relative", minHeight: 320 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="feat-grid"
            >
              {TAB_DATA[tab].items.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="feat-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 + i * 0.04 }}
                >
                  <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="mkt-section">
          <Reveal>
            <div className="section-tag">HOW IT WORKS</div>
            <h2 className="section-title">From signup to coaching<br />in four steps.</h2>
            <p className="section-sub">Designed to get you and your clients productive fast.</p>
          </Reveal>
          <Stagger className="steps" stagger={0.1}>
            {[
              { dot: "✦", title: "Upgrade to Trainer", text: "Flip the trainer switch in settings. Instantly unlocks client management, plan proposals, and your client dashboard." },
              { dot: "🔍", title: "Find Your Clients", text: "Search clients by username and send an adoption request. They accept, and you're connected — simple as that." },
              { dot: "📋", title: "Build & Send Their Program", text: "Open their split tab, customise their weekly plan, and send it as a proposal. They see it live in their app." },
              { dot: "📊", title: "Monitor & Adjust", text: "Check their history any time. If they're stalling, update the program. If they're crushing it, push harder." },
            ].map((s, i) => (
              <StaggerItem key={i} className="step">
                <div className="step-dot">{s.dot}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* MOCKUPS */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">THE APP</div>
          <h2 className="section-title">Clean. Fast. No clutter.</h2>
          <p className="section-sub">Every screen is designed for one-handed use mid-workout.</p>
        </Reveal>
        <Stagger className="mockup-grid" stagger={0.1}>
          {/* Workout */}
          <StaggerItem className="mockup">
            <div className="m-header">MONDAY · PUSH</div>
            <div className="m-card">
              <div className="m-card-title">Barbell Bench Press</div>
              <div className="m-card-sub" style={{ color: "var(--orange)" }}>chest · compound</div>
              <div style={{ marginTop: 8 }}>
                <div className="m-row"><div className="m-dot" /><span>Set 1 — 80kg × 8</span><span style={{ color: "var(--teal)", marginLeft: "auto" }}>✓</span></div>
                <div className="m-row"><div className="m-dot" /><span>Set 2 — 82.5kg × 7</span><span style={{ color: "var(--teal)", marginLeft: "auto" }}>✓</span></div>
                <div className="m-row" style={{ background: "rgba(255,102,68,0.07)", borderRadius: 6, padding: 6, margin: "4px 0" }}>
                  <div className="m-dot" style={{ background: "var(--yellow)" }} />
                  <span style={{ color: "var(--yellow)" }}>Set 3 — ACTIVE</span>
                </div>
              </div>
            </div>
            <div className="m-card" style={{ borderColor: "rgba(78,205,196,0.22)" }}>
              <div className="m-card-sub">⏱ REST · 00:42</div>
              <div className="m-bar"><motion.div className="m-bar-fill" style={{ background: "var(--teal)" }} initial={{ width: 0 }} whileInView={{ width: "60%" }} viewport={{ once: true }} transition={{ duration: 1, ease: "easeOut" }} /></div>
            </div>
            <div className="mockup-label">WORKOUT SESSION</div>
          </StaggerItem>

          {/* Progress */}
          <StaggerItem className="mockup">
            <div className="m-header">PROGRESS</div>
            <div className="m-card">
              <div className="m-card-title">This Week</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: "var(--orange)" }}>4</div><div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>SESSIONS</div></div>
                <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: "var(--teal)" }}>3</div><div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>WEEK STREAK</div></div>
                <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)" }}>52m</div><div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>AVG TIME</div></div>
              </div>
            </div>
            <div className="m-card">
              <div className="m-card-title">Activity · April</div>
              <div style={{ display: "flex", gap: 2, marginTop: 8, flexWrap: "wrap" }}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <motion.div
                    key={i}
                    style={{ width: 10, height: 10, borderRadius: 2, background: PROMO_CAL_ACTIVE.has(i) ? "var(--orange)" : "rgba(255,255,255,0.06)" }}
                    initial={{ opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                  />
                ))}
              </div>
            </div>
            <div className="m-card">
              <div className="m-card-title">🏆 Top PR</div>
              <div className="m-card-sub">Deadlift · 180kg · last Tuesday</div>
            </div>
            <div className="mockup-label">PROGRESS DASHBOARD</div>
          </StaggerItem>

          {/* Exercise browser */}
          <StaggerItem className="mockup">
            <div className="m-header">ADD EXERCISE</div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "7px 10px", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 8, width: "100%" }}>🔍 Search exercises...</div>
            <div style={{ display: "flex", gap: 4, width: "100%", marginBottom: 4, flexWrap: "wrap" }}>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, fontWeight: 700, background: "var(--teal)", color: "#000" }}>Gym</div>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Home</div>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Bodyweight</div>
            </div>
            <div style={{ display: "flex", gap: 4, width: "100%", marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, fontWeight: 700, background: "rgba(255,102,68,0.85)", color: "#000" }}>Push</div>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Pull</div>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Legs</div>
              <div style={{ padding: "3px 8px", borderRadius: 10, fontSize: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Core</div>
            </div>
            {[
              { name: "Bench Press", muscle: "chest" },
              { name: "Overhead Press", muscle: "shoulders" },
              { name: "Incline DB Press", muscle: "chest" },
            ].map((e, i) => (
              <div key={i} className="m-row" style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 6, marginBottom: 4 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: "rgba(255,102,68,0.22)", marginRight: 4, flexShrink: 0 }} />
                <div><div style={{ fontSize: 8, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 7, color: "var(--orange)" }}>{e.muscle}</div></div>
                <div style={{ fontSize: 7, background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4, marginLeft: "auto" }}>FORM</div>
              </div>
            ))}
            <div className="mockup-label">EXERCISE BROWSER</div>
          </StaggerItem>

          {/* Trainer dashboard */}
          <StaggerItem className="mockup">
            <div className="m-header">MY CLIENTS</div>
            {[
              { name: "ahmed_m", sub: "Last session: today", count: "12 sessions", active: true, grad: "linear-gradient(135deg,var(--orange),#FF9900)" },
              { name: "sara_fit", sub: "Last session: yesterday", count: "8 sessions", grad: "linear-gradient(135deg,var(--teal),#0099AA)" },
              { name: "ibrahim_gains", sub: "Last session: 3 days ago", count: "21 sessions", dim: true, grad: "linear-gradient(135deg,var(--yellow),#CC9900)" },
            ].map((c, i) => (
              <div key={i} className="m-card" style={{ borderColor: c.active ? "rgba(255,102,68,0.22)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: c.grad, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 9, fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{c.sub}</div></div>
                  <div style={{ fontSize: 7, color: c.dim ? "rgba(255,255,255,0.3)" : "var(--teal)" }}>{c.count}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: 8, background: "rgba(255,102,68,0.08)", border: "1px dashed rgba(255,102,68,0.3)", borderRadius: 8, fontSize: 8, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>+ Add client by username</div>
            <div className="mockup-label">TRAINER DASHBOARD</div>
          </StaggerItem>
        </Stagger>
      </section>

      {/* COMPARISON TABLE */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="mkt-section">
          <Reveal>
            <div className="section-tag">COMPARISON</div>
            <h2 className="section-title">Why IronLog wins.</h2>
            <p className="section-sub">Other apps do one thing well. IronLog connects the full coaching loop.</p>
          </Reveal>
          <Reveal direction="up" delay={0.1}>
            <div className="compare-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>IronLog</th>
                    <th>Generic trackers</th>
                    <th>Coaching platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Workout logging", ["yes", "✓ Full"], ["yes", "✓ Full"], ["partial", "~ Basic"]],
                    ["Exercise form demos + muscle maps", ["yes", "✓"], ["no", "✗"], ["no", "✗"]],
                    ["Trainer→client program delivery", ["yes", "✓"], ["no", "✗"], ["yes", "✓"]],
                    ["In-app client messaging", ["yes", "✓"], ["no", "✗"], ["partial", "~ Paid add-on"]],
                    ["Client workout history access", ["yes", "✓"], ["no", "✗"], ["yes", "✓"]],
                    ["Personalised training plans", ["yes", "✓"], ["no", "✗"], ["no", "✗"]],
                    ["Routine sharing between users", ["yes", "✓"], ["no", "✗"], ["no", "✗"]],
                    ["Body metric + trend tracking", ["yes", "✓"], ["partial", "~ Basic"], ["partial", "~ Limited"]],
                    ["Works without internet", ["partial", "~ Partial"], ["yes", "✓"], ["no", "✗"]],
                  ].map((row, i) => (
                    <tr key={i}>
                      <td>{row[0] as string}</td>
                      {(row.slice(1) as [string, string][]).map(([cls, text], j) => (
                        <td key={j} className={`cell-${cls}`}>{text}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">EARLY FEEDBACK</div>
          <h2 className="section-title">What trainers are saying.</h2>
        </Reveal>
        <Stagger className="testimonial-grid" stagger={0.1}>
          {[
            { quote: "Finally an app where I can see my clients' actual sets in real time. I used to wait for them to screenshot and send it — now I just open their profile.", author: "— Personal trainer, Malé City" },
            { quote: "The muscle body map on the form preview is actually a game-changer for explaining exercises to beginners. They see exactly what should light up.", author: "— S&C coach, Hulhumalé" },
            { quote: "My clients actually follow the program now because it's on their phone, not a PDF they lose. Session logging takes 10 seconds per set.", author: "— Freelance trainer, Resort gym" },
          ].map((t, i) => (
            <StaggerItem key={i} className="testimonial">
              <div className="stars">★★★★★</div>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="testimonial-author">{t.author}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* CTA */}
      <Reveal as="section" className="cta-section">
        <div className="section-tag" style={{ display: "inline-block", marginBottom: 14 }}>EARLY ACCESS</div>
        <h2>Ready to modernise<br />your coaching?</h2>
        <p>IronLog is in early access. Trainers who join now get free platform access and shape what gets built next.</p>
        <a href={WA_LINK} className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }}>Get Early Access →</a>
      </Reveal>

      <MarketingFooter tagline="BUILT FOR ATHLETES · DESIGNED FOR TRAINERS · MADE WITH INTENTION" />
    </>
  );
}
