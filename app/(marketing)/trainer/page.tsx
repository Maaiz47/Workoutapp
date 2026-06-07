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
  "https://wa.me/9609120007?text=Hi%2C+I%27d+like+to+start+my+free+trial+on+IronLog+as+a+trainer";

const FAQ_DATA: { q: string; a: string }[] = [
  { q: "Do my clients need to pay anything?", a: "No — the IronLog athlete tier is completely free. Your clients download the app, create an account, and connect with you at zero cost." },
  { q: "Can I see my client's workouts in real time?", a: "You can see their full history after each session, including every set, weight, and reps. There's no live-stream during the workout, but the data is available the moment they finish." },
  { q: "What if my client already has their own plan?", a: "Their existing plan stays until you send them a new one. When you do, it arrives as a proposal — they can review it before it replaces their current program. No surprises." },
  { q: "Can I manage gym clients and remote clients the same way?", a: "Yes. IronLog works for in-person and remote coaching identically. Both client types log workouts, receive plans, and message you through the same interface." },
  { q: "What if a client doesn't have a smartphone?", a: "IronLog is a mobile-first web app accessible from any browser. It works on desktop too — any device with a modern browser can run it, including older phones." },
  { q: "How do leaderboards work — do my clients see each other?", a: "Only in groups you create. The Client Leaderboard is private to you (a coaching dashboard view). Leaderboard Groups are opt-in: you create one, choose public or private, and add the clients you want included. Clients only ever see each other inside a group they've been added to." },
  { q: "Can I really upload my own exercises with photos?", a: "Yes — trainer accounts unlock the Custom Exercise creator. Add up to 5 demo photos per exercise (5 MB each, hosted on Cloudinary), tag muscles and equipment, and your custom exercises appear in the same browser as the 119+ built-ins — for you and any client whose plan uses them." },
  { q: "Is my client data private?", a: "Yes. You can only see data for clients who have accepted your trainer invitation. Clients see their own data. No data is shared publicly or with third parties." },
  { q: "Can I cancel anytime?", a: "Yes. No long-term contract. Cancel from your account settings and you'll retain access until the end of your current billing period." },
];

export default function TrainerPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 600], [0, 80]);
  const bannerScale = useTransform(scrollY, [0, 600], [1, 1.08]);

  return (
    <>
      <MarketingNav active="trainer" ctaLabel="Get Started" ctaHref={WA_LINK} />

      {/* HERO BANNER IMAGE */}
      <div className="hero-banner">
        <motion.img
          src="/hero-trainer.jpg"
          alt=""
          loading="eager"
          style={{ y: bannerY, scale: bannerScale }}
        />
        <div className="hero-banner-overlay" />
      </div>

      {/* HERO */}
      <section className="section-hero">
        <motion.div
          className="hero-eyebrow square"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          💼 FOR PERSONAL TRAINERS &amp; COACHES
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Stop managing clients<br />from <em>five different apps.</em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          IronLog puts your programs, client data, session history, and messaging in one place — so you spend less time admin-ing and more time coaching.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <a href={WA_LINK} className="btn-primary">Start Your Free Trial</a>
          <a href="#how-it-works" className="btn-ghost">See How It Works</a>
        </motion.div>
        <Stagger className="hero-proof" stagger={0.1} amount={0.5}>
          <StaggerItem className="proof-item"><div className="proof-num">30 days</div><div className="proof-label">FREE TRIAL</div></StaggerItem>
          <StaggerItem className="proof-item"><div className="proof-num">No card</div><div className="proof-label">REQUIRED</div></StaggerItem>
          <StaggerItem className="proof-item"><div className="proof-num"><AnimatedCounter to={5} /> min</div><div className="proof-label">TO ONBOARD A CLIENT</div></StaggerItem>
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* PAIN / SOLUTION */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">THE PROBLEM</div>
          <h2 className="section-title">Your current stack<br />is costing you clients.</h2>
          <p className="section-lead">Most trainers use 4–5 separate tools to run their business. Every gap between tools is friction — and friction leads to drop-offs.</p>
        </Reveal>
        <Stagger className="pain-grid" stagger={0.15}>
          <StaggerItem className="pain-card">
            <h4>✗ THE MESSY REALITY</h4>
            <ul>
              {[
                ["📄", "Programs sent as PDFs or Google Docs"],
                ["📱", "Clients logging workouts in Notes or nothing"],
                ["💬", "Check-ins via WhatsApp across multiple chats"],
                ["📊", "Progress tracked in Excel spreadsheets"],
                ["🔄", "No visibility into whether clients actually trained"],
                ["😤", "Chasing clients for updates every week"],
              ].map(([e, t], i) => (
                <li key={i}><span>{e}</span>{t}</li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem>
            <MouseTilt3D className="solution-card">
            <h4>✓ THE IRONLOG WAY</h4>
            <ul>
              {[
                ["📲", "Programs delivered live to their phone"],
                ["📊", "Clients log sets in the same app they receive the plan"],
                ["💬", "One inbox for all client messages"],
                ["📈", "Progress charts and PRs update automatically"],
                ["👁️", "Full session history visible anytime, no chasing"],
                ["✅", "Plan updates pushed in seconds, not emails"],
              ].map(([e, t], i) => (
                <li key={i}><span>{e}</span>{t}</li>
              ))}
            </ul>
            </MouseTilt3D>
          </StaggerItem>
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* SHOWCASES */}
      <section className="mkt-section" id="how-it-works">
        <Reveal>
          <div className="section-tag">HOW IT WORKS</div>
          <h2 className="section-title">The full coaching loop,<br />closed.</h2>
          <p className="section-lead">Every tool you need, connected in one platform. From writing the program to watching it executed — IronLog covers it all.</p>
        </Reveal>

        {/* Showcase 1 — Client Roster */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase">
            <div className="showcase-text">
              <div className="showcase-eyebrow">CLIENT MANAGEMENT</div>
              <h3>Your entire client roster in your pocket</h3>
              <p>See every client, their last training date, total session count, and quick-jump into their data. No more losing track of who you trained when, or forgetting to follow up after a missed session.</p>
              <ul className="showcase-list">
                {[
                  "Add clients by username — they accept your invite",
                  "See last training date at a glance",
                  "Colour-coded activity signals",
                  "Jump straight into any client's history or plan",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">MY CLIENTS — 6 ACTIVE</div>
              {[
                { letter: "A", grad: "linear-gradient(135deg,#FF6644,#FF9900)", name: "ahmed_m", sub: "Last session today · 14 sessions", badgeText: "ACTIVE", badgeStyle: { background: "rgba(92,219,149,0.15)", color: "#5CDB95" } },
                { letter: "S", grad: "linear-gradient(135deg,#4ECDC4,#0099AA)", name: "sara_fit", sub: "Last session yesterday · 9 sessions", badgeText: "ACTIVE", badgeStyle: { background: "rgba(92,219,149,0.15)", color: "#5CDB95" } },
                { letter: "I", grad: "linear-gradient(135deg,#FFE66D,#CC9900)", name: "ibrahim_gains", sub: "Last session 4 days ago · 23 sessions", badgeText: "CHECK IN", badgeStyle: { background: "rgba(255,230,109,0.12)", color: "#FFE66D" } },
                { letter: "M", grad: "linear-gradient(135deg,#A78BFA,#6D28D9)", name: "mara_run", sub: "Last session 8 days ago · 5 sessions", badgeText: "INACTIVE", badgeStyle: { background: "rgba(255,80,80,0.12)", color: "#FF6060" } },
              ].map((c, i) => (
                <motion.div
                  key={i}
                  className="mock-client-row"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                >
                  <div className="mock-avatar" style={{ background: c.grad }}>{c.letter}</div>
                  <div><div className="mock-client-name">{c.name}</div><div className="mock-client-sub">{c.sub}</div></div>
                  <div className="mock-badge" style={c.badgeStyle}>{c.badgeText}</div>
                </motion.div>
              ))}
            </div>
          </div>
          </Tilt3D>
        </Reveal>

        {/* Showcase 2 — Program Builder */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase reverse">
            <div className="showcase-text">
              <div className="showcase-eyebrow">PROGRAM DELIVERY</div>
              <h3>Build programs once, deliver them instantly</h3>
              <p>Write a custom weekly split directly in the app using the exercise browser. Filter 119+ exercises by movement type, muscle group, or equipment. Send the plan to your client&apos;s phone in one tap — they see it live, with full form demos, anatomical muscle maps, and sub-muscle zone detail.</p>
              <ul className="showcase-list">
                {[
                  "Full exercise browser with filter chips",
                  "Drag to reorder exercises in any day",
                  "Set custom sets, reps, and rest times per exercise",
                  "Send as a proposal — client approves before it's live",
                  "Update any client's plan at any time",
                  "HIIT finisher circuits auto-added for conditioning",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">AHMED&apos;S MONDAY · PUSH DAY</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                <div className="mock-chip">Gym</div>
                <div className="mock-chip">Push</div>
                <div className="mock-chip">Chest</div>
              </div>
              {[
                { name: "Barbell Bench Press", muscle: "chest · triceps", scheme: "4 sets · 8–10 reps · 90s rest" },
                { name: "Incline Dumbbell Press", muscle: "chest · shoulders", scheme: "3 sets · 10–12 reps · 60s rest" },
                { name: "Triceps Pushdown", muscle: "triceps", scheme: "3 sets · 12–15 reps · 45s rest" },
              ].map((ex, i) => (
                <motion.div
                  key={i}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12, marginBottom: 8 }}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 2 }}>{ex.name}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,102,68,0.85)" }}>{ex.muscle}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{ex.scheme}</div>
                </motion.div>
              ))}
            </div>
          </div>
          </Tilt3D>
        </Reveal>

        {/* Showcase 3 — Client History */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase">
            <div className="showcase-text">
              <div className="showcase-eyebrow">CLIENT HISTORY</div>
              <h3>See every set your clients have ever logged</h3>
              <p>Browse any client&apos;s full training history — every session, every exercise, every set. Know exactly what weight they moved last week before you update their program. No more guessing or waiting for them to tell you.</p>
              <ul className="showcase-list">
                {[
                  "Session-by-session breakdown",
                  "Expandable set-level detail",
                  "Per-exercise trend data and personal bests",
                  "Body metrics, weight trend, and body fat chart",
                  "28-day activity calendar per client",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">AHMED&apos;S HISTORY · LAST SESSION</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Monday 13 May · 52 minutes</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: "rgba(255,255,255,0.75)" }}>Barbell Bench Press</div>
              <div className="mock-set-row"><div className="mock-set-num">SET 1</div><div className="mock-set-val">80kg × 10</div></div>
              <div className="mock-set-row"><div className="mock-set-num">SET 2</div><div className="mock-set-val">85kg × 8</div></div>
              <div className="mock-set-row"><div className="mock-set-num">SET 3</div><div className="mock-set-val">87.5kg × 7</div><div className="mock-set-pr">NEW PR</div></div>
              <div style={{ fontSize: 11.5, fontWeight: 600, margin: "12px 0 6px", color: "rgba(255,255,255,0.75)" }}>Incline DB Press</div>
              <div className="mock-set-row"><div className="mock-set-num">SET 1</div><div className="mock-set-val">30kg × 12</div></div>
              <div className="mock-set-row"><div className="mock-set-num">SET 2</div><div className="mock-set-val">32.5kg × 10</div></div>
            </div>
          </div>
          </Tilt3D>
        </Reveal>

        {/* Showcase 4 — Messaging */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase reverse">
            <div className="showcase-text">
              <div className="showcase-eyebrow">IN-APP MESSAGING</div>
              <h3>One inbox. Every client.</h3>
              <p>Stop switching between WhatsApp threads, Instagram DMs, and email to manage client check-ins. IronLog&apos;s messaging keeps all your coaching conversations in one place, attached to the client&apos;s data where it belongs.</p>
              <ul className="showcase-list">
                {[
                  "Dedicated message thread per client",
                  "Unread message badge on the main screen",
                  "Receive and send plan acceptance messages",
                  "Professional context — conversations are coaching-focused",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">MESSAGES · AHMED_M</div>
              <div style={{ padding: "8px 0" }}>
                <motion.div className="mock-msg" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}>Hey coach, feeling good after Monday. Shoulder felt a bit tight on the last set of OHP</motion.div>
                <motion.div className="mock-msg me" initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 }}>Good to know — I&apos;ll swap the behind-neck press for a neutral grip. Check your updated plan 👊</motion.div>
                <motion.div className="mock-msg" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.5 }}>Just saw it, thanks! Starting now</motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                  style={{ marginTop: 12, padding: 10, background: "rgba(92,219,149,0.07)", border: "1px solid rgba(92,219,149,0.18)", borderRadius: 8, fontSize: 10.5, color: "rgba(92,219,149,0.85)" }}
                >
                  ✓ Ahmed accepted your plan proposal
                </motion.div>
              </div>
            </div>
          </div>
          </Tilt3D>
        </Reveal>

        {/* Showcase 5 — Custom Exercises (NEW) */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase">
            <div className="showcase-text">
              <div className="showcase-eyebrow">CUSTOM EXERCISE LIBRARY</div>
              <h3>Build your own exercises.<br />With your own demo photos.</h3>
              <p>The 119+ built-in exercises cover the basics. For everything else — your unique cable variations, your favourite mobility drills, your signature finishers — create your own. Name them. Tag the muscles. Upload up to five demo photos. Drop them into any client&apos;s plan.</p>
              <ul className="showcase-list">
                {[
                  "Trainer-only creation — your library, your IP",
                  "Tag primary muscles, secondaries, equipment, type, difficulty",
                  "Upload up to 5 demo photos per exercise (Cloudinary)",
                  "Appears in the same browser as the 119 built-ins",
                  "Edit or delete any time — changes propagate instantly",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">+ CREATE EXERCISE</div>
              <div className="ce-form">
                <div className="ce-row">
                  <div className="ce-label">Exercise Name</div>
                  <div className="ce-input">Cable Crossover Twist</div>
                </div>
                <div className="ce-row">
                  <div className="ce-label">Primary Muscles</div>
                  <div className="ce-chips">
                    <div className="ce-chip on muscle">CHEST</div>
                    <div className="ce-chip on muscle">SERRATUS</div>
                    <div className="ce-chip">SHOULDERS</div>
                    <div className="ce-chip">CORE</div>
                  </div>
                </div>
                <div className="ce-row">
                  <div className="ce-label">Equipment</div>
                  <div className="ce-chips">
                    <div className="ce-chip on equip">CABLES</div>
                    <div className="ce-chip">DUMBBELLS</div>
                  </div>
                </div>
                <div className="ce-row">
                  <div className="ce-label">Demo Photos · 2 / 5</div>
                  <div className="ce-photo-grid">
                    <div className="ce-photo">📷</div>
                    <div className="ce-photo">📷</div>
                    <div className="ce-photo-add">+</div>
                  </div>
                </div>
                <button className="ce-save" type="button">SAVE EXERCISE</button>
                <div className="ce-saved">
                  <div className="ce-label" style={{ marginBottom: 8 }}>Your Library · 3 Custom</div>
                  {[
                    { name: "Cable Crossover Twist", muscle: "chest · serratus", icon: "🏋️" },
                    { name: "Tempo Spanish Squat", muscle: "quads · adductors", icon: "🦵" },
                    { name: "Banded Pull-Apart", muscle: "rear delts · traps", icon: "💪" },
                  ].map((e, i) => (
                    <motion.div
                      key={i}
                      className="ce-saved-item"
                      initial={{ opacity: 0, y: 6 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.1 + i * 0.07 }}
                    >
                      <div className="ce-saved-thumb">{e.icon}</div>
                      <div className="ce-saved-meta">
                        <div className="ce-saved-name">{e.name}</div>
                        <div className="ce-saved-muscle">{e.muscle}</div>
                      </div>
                      <div className="ce-saved-tag">CUSTOM</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </Tilt3D>
          <Expandable
            label="See the full creator flow"
            collapsedLabel="Hide details"
            detail={
              <>
                <h5>How it works end-to-end</h5>
                <div className="expandable-detail-grid">
                  <div><h6>1 · Open the creator</h6><p>Trainer settings → Custom Exercises → + CREATE. Form slides in below the toggle.</p></div>
                  <div><h6>2 · Name &amp; tag</h6><p>Exercise name (≤80 chars), then chip-select up to 12 primary muscles, 12 secondaries, 12 equipment items.</p></div>
                  <div><h6>3 · Classify</h6><p>Type: compound / isolation / cardio / isometric. Difficulty: beginner / intermediate / advanced.</p></div>
                  <div><h6>4 · Upload demos</h6><p>Up to 5 photos via our Cloudinary pipeline. 5 MB max each. JPG / PNG / WebP / GIF. Trainer-only access.</p></div>
                  <div><h6>5 · Save</h6><p>One tap. Appears in your library and in every client&apos;s exercise browser instantly, with a CUSTOM badge.</p></div>
                  <div><h6>6 · Use in any plan</h6><p>Drop into a workout day like any built-in exercise. Edit fields, photos, or delete at any time.</p></div>
                </div>
              </>
            }
          />
        </Reveal>

        {/* Showcase 6 — Client Leaderboard (NEW) */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase reverse">
            <div className="showcase-text">
              <div className="showcase-eyebrow">CLIENT LEADERBOARD</div>
              <h3>Turn coaching<br />into a competition.</h3>
              <p>Stack your clients head-to-head. Rank them by sessions completed, current streak, or intensity score — pick the lens that matters most this week. Medals go to the top three, the leader sits on gold, every client wears their tier emoji. Use it for accountability, motivation, or just to see who&apos;s really showing up.</p>
              <ul className="showcase-list">
                {[
                  "Three sort modes — sessions, streak, intensity points",
                  "🥇🥈🥉 medals on top three, gold row on first place",
                  "Tier emojis (🐱 Kitten → 🦍 Gorilla) on every client",
                  "Total training volume per client at a glance",
                  "Updates live as clients log workouts",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">MY CLIENTS · RANKED</div>
              <div className="lb-sort">
                <div className="lb-sort-chip active">SESSIONS</div>
                <div className="lb-sort-chip">STREAK</div>
                <div className="lb-sort-chip">INTENSITY</div>
              </div>
              {[
                { rank: "🥇", name: "ibrahim_gains", tier: "🦁", sub: "23 sessions · 4-week streak", stat: "23", gold: true },
                { rank: "🥈", name: "ahmed_m", tier: "🐯", sub: "14 sessions · 3-week streak", stat: "14" },
                { rank: "🥉", name: "sara_fit", tier: "🦊", sub: "9 sessions · 2-week streak", stat: "9" },
                { rank: "4", name: "mara_run", tier: "🐒", sub: "5 sessions · 1-week streak", stat: "5" },
                { rank: "5", name: "yusuf_lift", tier: "🐱", sub: "2 sessions · new", stat: "2" },
              ].map((r, i) => (
                <motion.div
                  key={i}
                  className={`lb-row${r.gold ? " gold" : ""}`}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.08 * i }}
                >
                  <div className={`lb-rank${i < 3 ? " medal" : ""}`}>{r.rank}</div>
                  <div className="lb-user">
                    <div className="lb-user-name"><span className="lb-user-tier">{r.tier}</span>{r.name}</div>
                    <div className="lb-user-sub">{r.sub}</div>
                  </div>
                  <div className="lb-stat">{r.stat}</div>
                </motion.div>
              ))}
            </div>
          </div>
          </Tilt3D>
          <Expandable
            label="What the sort modes actually rank"
            collapsedLabel="Hide details"
            detail={
              <>
                <h5>Three lenses, three stories</h5>
                <div className="expandable-detail-grid">
                  <div><h6>SESSIONS</h6><p>Total completed workouts across all time. The volume crown — who&apos;s putting in the most reps.</p></div>
                  <div><h6>STREAK</h6><p>Current consecutive weeks with at least one logged session. Rewards consistency over raw volume.</p></div>
                  <div><h6>INTENSITY</h6><p>Weighted score: total volume × frequency × PR rate. Catches the clients pushing harder, not just longer.</p></div>
                </div>
                <h5 style={{ marginTop: 18 }}>The tier system rewarding effort</h5>
                <p>🐱 Kitten (0+) → 🐒 Monkey (5+) → 🦊 Fox (15+) → 🐯 Tiger (30+) → 🦁 Lion (60+) → 🦍 Gorilla (100+). A streak of 4+ weeks combined with 8+ PRs bumps your client up a tier ahead of schedule.</p>
              </>
            }
          />
        </Reveal>

        {/* Showcase 7 — Leaderboard Groups (NEW) */}
        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
          <div className="showcase">
            <div className="showcase-text">
              <div className="showcase-eyebrow">SOCIAL COMPETITION</div>
              <h3>Create a leaderboard.<br />Invite the gym.</h3>
              <p>Spin up a private leaderboard for your top six clients. Or a public one with three other trainers and all their athletes. Or both. Members compete on shared rankings, see each other&apos;s tier progress, and get notified when someone breaks a PR. The motivation engine you can&apos;t install in a one-on-one session.</p>
              <ul className="showcase-list">
                {[
                  "Create public or private groups in seconds",
                  "Add your clients in bulk via search",
                  "Invite other trainers by username",
                  "Optional self-inclusion — show your own stats or stay out",
                  "Pending invites surface at the top until accepted",
                  "Delete a group any time (creator only)",
                ].map((t, i) => (
                  <li key={i}><span className="sl-check">✦</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-visual">
              <div className="mock-header">LEADERBOARD GROUPS · 2</div>
              <motion.div
                className="lb-invite"
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                <div className="lb-invite-meta">
                  <div className="lb-invite-name">🔥 Resort Trainers Q2</div>
                  <div className="lb-invite-sub">FROM @COACH_HASAN · 12 MEMBERS</div>
                </div>
                <div className="lb-invite-actions">
                  <button className="lb-invite-btn accept" type="button">ACCEPT</button>
                  <button className="lb-invite-btn decline" type="button">×</button>
                </div>
              </motion.div>
              {[
                { name: "💪 My Roster", privacy: "private", sub: "6 MEMBERS · YOU + 5 CLIENTS", privacyClass: "private" },
                { name: "🏝️ Malé Strength Network", privacy: "public", sub: "23 MEMBERS · 4 TRAINERS", privacyClass: "public" },
              ].map((g, i) => (
                <motion.div
                  key={i}
                  className="lb-group"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.1 }}
                >
                  <div className="lb-group-head">
                    <div className="lb-group-name">{g.name}</div>
                    <div className={`lb-group-privacy ${g.privacyClass}`}>{g.privacy.toUpperCase()}</div>
                  </div>
                  <div className="lb-group-sub">{g.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>
          </Tilt3D>
          <Expandable
            label="See the full invite &amp; member flow"
            collapsedLabel="Hide details"
            detail={
              <>
                <h5>Setting up a group, end-to-end</h5>
                <div className="expandable-detail-grid">
                  <div><h6>1 · Create</h6><p>Tap + NEW GROUP. Pick a name. Toggle Public / Private. Done — your group exists.</p></div>
                  <div><h6>2 · Add clients</h6><p>Search your own roster, tap to add. Checkmark appears on each added client. Bulk-add the lot in two seconds.</p></div>
                  <div><h6>3 · Invite trainers</h6><p>Search by username. INVITE button shows MEMBER / INVITED / state. They accept from their own Pending section.</p></div>
                  <div><h6>4 · Self-inclusion</h6><p>Toggle &ldquo;Include me in ranking&rdquo;. Useful if you train alongside clients — or skip if you want to stay scorekeeper.</p></div>
                  <div><h6>5 · Pending invites</h6><p>Anything sent to you appears at the top of the Groups section: name, inviter, member count, ACCEPT / DECLINE.</p></div>
                  <div><h6>6 · Cleanup</h6><p>Creator can delete the group. Members can leave any time. No notifications spam — invites only.</p></div>
                </div>
              </>
            }
          />
        </Reveal>
      </section>

      <hr className="mkt-divider" />

      {/* GETTING STARTED STEPS */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">GETTING STARTED</div>
          <h2 className="section-title">Set up in under 10 minutes.</h2>
          <p className="section-lead">No training required. If you can use a smartphone, you can run your coaching business on IronLog.</p>
        </Reveal>
        <Stagger className="steps" stagger={0.07}>
          {[
            { n: "01", t: "Create your account", d: "Sign up with email. Immediately enable Trainer Mode in settings — no review or approval process." },
            { n: "02", t: "Invite your first client", d: "Your client downloads IronLog free and creates an account. You search their username and send an invite. They accept in one tap." },
            { n: "03", t: "Build their program", d: "Open their Split tab. Add exercises to each day using the exercise browser. Set sets, reps, and rest. Takes 5–10 minutes for a full week." },
            { n: "04", t: "Send the plan", d: "Tap \"Send Proposal.\" Your client sees the new plan in their app and approves it. It goes live immediately after their confirmation." },
            { n: "05", t: "Watch the data come in", d: "Every time they train, the session logs in real time. Visit their History tab to see exactly what they did, down to individual sets." },
            { n: "06", t: "Adjust & repeat", d: "When they plateau or hit a new PR, update the plan. Push the change live in seconds. No PDFs, no emails, no confusion." },
          ].map((s) => (
            <StaggerItem key={s.n} className="step">
              <div className="step-num">{s.n}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* EARLY ACCESS */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">EARLY ACCESS</div>
          <h2 className="section-title">Start your free trial.<br />No card needed.</h2>
          <p className="section-lead">IronLog is currently in early access. Get in touch and we&apos;ll set you up with a full 30-day trial — no commitment, no credit card, no catch.</p>
        </Reveal>
        <Reveal direction="up" delay={0.05}>
          <div className="price-hero">
            <div className="price-left">
              <div className="price-tag">TRAINER ACCESS</div>
              <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: "14px 0 4px", color: "#fff" }}>Get in touch</div>
              <div className="price-per">early access · founding trainer rates</div>
              <div className="price-note">Founding members lock in special lifetime rates</div>
              <div style={{ marginTop: 20 }}>
                <a href={WA_LINK} className="btn-primary" style={{ fontSize: 14, padding: "13px 28px" }}>Start 30-Day Free Trial</a>
              </div>
              <div className="trial-note">🔒 No credit card required to trial</div>
            </div>
            <div className="price-right">
              <ul>
                {[
                  "Full workout tracking for you + all clients",
                  "Build & deliver custom programs",
                  "Full client session history",
                  "In-app client messaging",
                  "Plan proposals + client approval",
                  "Client body metrics & progress charts",
                  "119+ exercises with form demos",
                  "Muscle activation maps",
                  "Personalised plan generation for clients",
                ].map((f, i) => (
                  <li key={i}><span className="price-check">✓</span>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal direction="up" delay={0.1}>
          <div style={{ marginTop: 16, padding: "18px 20px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Questions about pricing?</div>
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>Message us on WhatsApp and we&apos;ll walk you through your options. Founding trainers get preferential rates.</div>
            </div>
            <a href={WA_LINK} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Chat With Us →</a>
          </div>
        </Reveal>
      </section>

      <hr className="mkt-divider" />

      {/* FAQ */}
      <section className="mkt-section">
        <Reveal>
          <div className="section-tag">QUESTIONS</div>
          <h2 className="section-title">Common questions<br />from trainers.</h2>
        </Reveal>
        <Reveal>
          <div className="faq">
            {FAQ_DATA.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className={`faq-item${isOpen ? " open" : ""}`}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <div className="faq-q">
                    {item.q}
                    <span className="faq-icon">+</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="faq-a">{item.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* TESTIMONIALS */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="section-tag">EARLY ACCESS FEEDBACK</div>
          <h2 className="section-title">Trainers are noticing.</h2>
        </Reveal>
        <Stagger className="testimonial-grid" stagger={0.1}>
          {[
            { quote: "I used to send PDF programs over Instagram DMs and hope for the best. Now I can see whether they actually did the session — it changed how I coach entirely.", author: "— Personal trainer, Malé City" },
            { quote: "The form demo + muscle map is the feature I didn't know I needed. My beginners actually understand why they're doing an exercise now.", author: "— S&C coach, Hulhumalé" },
            { quote: "Managing 8 remote clients used to be chaos. IronLog cut my admin time in half in the first week. The messaging alone is worth it.", author: "— Online coach, resort gym" },
          ].map((t, i) => (
            <StaggerItem key={i} className="testimonial">
              <div className="stars">★★★★★</div>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="testimonial-author">{t.author}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* CTA BANNER */}
      <Reveal as="section" className="cta-banner">
        <div className="section-tag" style={{ display: "flex", justifyContent: "center" }}>READY TO START?</div>
        <h2>Your first 30 days are free.<br />No excuses.</h2>
        <p>Set up your trainer account, invite one client, and see exactly how different coaching with real data feels.</p>
        <a href={WA_LINK} className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }}>Start Free Trial — No Card Needed</a>
      </Reveal>

      <MarketingFooter tagline="COACHING. SIMPLIFIED. · IRONLOG.APP" />
    </>
  );
}
