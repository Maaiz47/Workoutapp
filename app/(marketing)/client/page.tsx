"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { MarketingNav } from "../_components/MarketingNav";
import { MarketingFooter } from "../_components/MarketingFooter";
import { Reveal, Stagger, StaggerItem } from "../_components/Reveal";
import { Tilt3D } from "../_components/Tilt3D";
import { Expandable } from "../_components/Expandable";

const APP_LINK = "https://ironlogmv.vercel.app";

const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "⚡", title: "Instant set logging", desc: "Tap a set, enter weight and reps. Done in 3 seconds. Your last set's numbers are always visible so you know whether to push or hold back." },
  { icon: "🏆", title: "Automatic PR detection", desc: "IronLog tracks your personal bests across every exercise. When you break a record, you know it immediately — no manual checking." },
  { icon: "⏱️", title: "Smart rest timer", desc: "Set your rest period once per exercise. When time's up, you get a push notification — even if you lock your phone between sets." },
  { icon: "📋", title: "Personalised training plan", desc: "Tell IronLog your goals, fitness level, available equipment, and days per week. Get a complete personalised weekly program built to your needs." },
  { icon: "🎬", title: "Exercise form demos", desc: "Swipe to see start and finish position images for any exercise. No more guessing if your form is right — the reference is always one tap away." },
  { icon: "🫀", title: "Muscle activation maps", desc: "Every exercise shows an anatomical front and back body diagram — primary muscles glow red, secondaries orange. Sub-muscle zone detail pinpoints exactly which head is working." },
  { icon: "📊", title: "Progress charts", desc: "Weight trend, body fat trend, 28-day activity calendar, weekly stats, and per-exercise progress graphs. See the trajectory at a glance." },
  { icon: "🔥", title: "Streak tracking", desc: "Week-over-week training streaks keep you consistent. Sessions logged, average duration, and weekly frequency — all tracked automatically." },
  { icon: "💾", title: "Save & share routines", desc: "Build a program you love? Save it. Share it with a training partner by username. Restore any saved routine with one tap." },
  { icon: "⚡", title: "HIIT & Conditioning", desc: "20+ circuit exercises — burpees, jump squats, mountain climbers, plyometrics — added automatically as a finisher or dedicated conditioning day based on your schedule." },
];

const CLIENT_CAL_ACTIVE = new Set([1, 2, 4, 5, 8, 9, 11, 12, 15, 16, 18, 19, 22, 23, 25, 26]);

export default function ClientPage() {
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 600], [0, 80]);
  const bannerScale = useTransform(scrollY, [0, 600], [1, 1.08]);

  return (
    <>
      <MarketingNav active="client" ctaLabel="Start Free" ctaHref={APP_LINK} ctaVariant="teal" />

      {/* HERO BANNER IMAGE */}
      <div className="hero-banner">
        <motion.img
          src="/ai/client-hero.jpg"
          alt=""
          loading="eager"
          style={{ y: bannerY, scale: bannerScale }}
        />
        <div className="hero-banner-overlay" />
      </div>

      {/* HERO */}
      <section className="promo-hero">
        <motion.div className="mkt-hero-radial teal" />
        <motion.div
          className="hero-pill teal square"
          style={{ borderRadius: 6 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          🏆 FREE FOR ATHLETES · ALWAYS
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Your workouts.<br />Your data.<br /><em className="teal" style={{ color: "var(--teal)", fontStyle: "normal" }}>Your results.</em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          IronLog tracks every set, celebrates every PR, and shows exactly how far you&apos;ve come — all for free.
        </motion.p>
        <motion.div
          className="hero-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <a href={APP_LINK} className="btn-teal">Start Training Free</a>
          <a href="#features" className="btn-outline">See the App</a>
        </motion.div>
        <motion.div
          className="free-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          🔒 No credit card · No trial expiry · No catch
        </motion.div>
      </section>

      <hr className="mkt-divider" />

      {/* BEFORE / AFTER */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">THE DIFFERENCE</div>
          <h2 className="section-title">Stop guessing.<br />Start progressing.</h2>
          <p className="section-lead">Most gym-goers have no idea what they lifted last week. That&apos;s why most gym-goers plateau. IronLog fixes that.</p>
        </Reveal>
        <Stagger className="ba-grid" stagger={0.15}>
          <StaggerItem className="ba-card before">
            <div className="ba-label">✗ WITHOUT IRONLOG</div>
            <ul>
              {[
                ["😵", "Can't remember what weight you used last time"],
                ["📝", "Tracking in Notes app, or not at all"],
                ["❓", "No idea if you're actually getting stronger"],
                ["⏰", "Rest times are guesswork"],
                ["📋", "Following a random YouTube program with no structure"],
                ["💪", "No form demos — just trying to copy someone at the gym"],
              ].map(([e, t], i) => (
                <li key={i}><span>{e}</span>{t}</li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem className="ba-card after">
            <div className="ba-label">✓ WITH IRONLOG</div>
            <ul>
              {[
                "Last session's numbers shown right next to your input",
                "One tap per set — log in under 3 seconds",
                "Automatic PR alerts the moment you break a record",
                "Rest timer with push notification — even with phone locked",
                "Personalised plan built around your goals and equipment",
                "Form demos + muscle activation maps for every exercise",
              ].map((t, i) => (
                <li key={i}><span style={{ color: "var(--teal)" }}>✦</span>{t}</li>
              ))}
            </ul>
          </StaggerItem>
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* FEATURES */}
      <section id="features" className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">FEATURES</div>
          <h2 className="section-title">Everything you need.<br />Nothing you don&apos;t.</h2>
          <p className="section-lead">Built to be used during a workout — fast, clean, and one-handed.</p>
        </Reveal>
        <Stagger className="feat-grid" stagger={0.06}>
          {FEATURES.map((f, i) => (
            <StaggerItem key={i} className="feat-card">
              <div className="feat-icon" style={{ background: "rgba(78,205,196,0.13)" }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* TIERS — PROGRESSION */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">PROGRESSION</div>
          <h2 className="section-title">From kitten<br />to <em style={{ color: "var(--yellow)", fontStyle: "normal" }}>absolute unit.</em></h2>
          <p className="section-lead">Every session you log moves you closer to the next tier. Six ranks. Six animals. Each one earned, none of them given. Your tier shows up next to your name everywhere — your profile, leaderboards, every group you join.</p>
        </Reveal>

        <Reveal direction="up" amount={0.1}>
          <Tilt3D depth={18}>
            <div className="tier-strip">
              {[
                { key: "k", emoji: "🐱", name: "KITTEN", req: "0+" },
                { key: "m", emoji: "🐒", name: "MONKEY", req: "5+" },
                { key: "f", emoji: "🦊", name: "FOX", req: "15+" },
                { key: "t", emoji: "🐯", name: "TIGER", req: "30+" },
                { key: "l", emoji: "🦁", name: "LION", req: "60+" },
                { key: "g", emoji: "🦍", name: "GORILLA", req: "100+" },
              ].map((t, i) => (
                <motion.div
                  key={t.key}
                  className={`tier-pill ${t.key}`}
                  initial={{ opacity: 0, y: 16, rotateX: -20 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="tier-emoji">{t.emoji}</div>
                  <div className="tier-name">{t.name}</div>
                  <div className="tier-req">{t.req} sessions</div>
                </motion.div>
              ))}
            </div>
          </Tilt3D>
        </Reveal>

        <Reveal direction="up" delay={0.1}>
          <div style={{ marginTop: 28 }}>
            <div className="tier-card-big">
              <div className="tier-card-emoji">🐯</div>
              <div className="tier-card-meta">
                <div className="tier-card-label">YOUR TIER</div>
                <div className="tier-card-name">TIGER</div>
                <div className="tier-card-bar">
                  <motion.div
                    className="tier-card-bar-fill"
                    initial={{ width: 0 }}
                    whileInView={{ width: "62%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="tier-card-next">19 more sessions until <strong>🦁 LION</strong></div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal direction="up" delay={0.15}>
          <Expandable
            label="The shortcuts up the ranks"
            collapsedLabel="Hide details"
            detail={
              <>
                <h5>How the bonus bumps work</h5>
                <p>Hitting the session threshold isn&apos;t the only way up. Two combined performance bonuses can promote you a tier ahead of schedule:</p>
                <ul>
                  <li><strong>4-week training streak</strong> — log at least one session every week for four consecutive weeks.</li>
                  <li><strong>8+ personal records</strong> — automatic PR detection across any tracked exercise.</li>
                </ul>
                <p>Hit both at once and you skip ahead one rank. The system rewards consistency and intensity — not just bums-on-benches volume.</p>
                <h5 style={{ marginTop: 18 }}>What &ldquo;absolute unit&rdquo; means</h5>
                <p>🦍 Gorilla is the cap. 100+ sessions logged, plus the streak/PR bonus on top. The tier card flips to read &ldquo;MAX RANK — ABSOLUTE UNIT&rdquo; with a permanent gold glow. There&apos;s no rank above it.</p>
              </>
            }
          />
        </Reveal>
      </section>

      <hr className="mkt-divider" />

      {/* LEADERBOARDS — COMPETITION */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">COMPETITION</div>
          <h2 className="section-title">Train with friends.<br /><em className="teal" style={{ color: "var(--teal)", fontStyle: "normal" }}>Beat them at it.</em></h2>
          <p className="section-lead">Solo lifting is fine. Solo lifting with a public scoreboard, six of your gym mates, and an automatic ranking algorithm is better. Join a leaderboard group, see where you stand, climb the ranks.</p>
        </Reveal>

        <Reveal direction="up" amount={0.1}>
          <Tilt3D>
            <div className="trainer-block">
              <div className="trainer-block-text">
                <div className="tblock-tag">WHAT YOU SEE</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, lineHeight: 1.25 }}>Live rankings.<br />Three lenses on effort.</h3>
                <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 20, lineHeight: 1.7 }}>
                  Switch the sort to see who&apos;s training the most, who&apos;s most consistent, or who&apos;s pushing hardest. Tier emojis ride next to every name. Top three get medals. First place sits on a gold row.
                </p>
                <ul>
                  {[
                    "🥇🥈🥉 Medals for the top three",
                    "Sort by sessions, streak, or intensity",
                    "Live updates whenever anyone logs a workout",
                    "Public or private groups — you choose what to join",
                    "Get invited by a trainer or another athlete",
                  ].map((t, i) => (
                    <li key={i} style={{ fontSize: 13, padding: "7px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none", color: "var(--text)", display: "flex", gap: 10 }}>
                      <span style={{ color: "var(--teal)" }}>✦</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="trainer-block-visual">
                <div className="tblock-visual-inner">
                  <div className="mock-header">🏝️ MALÉ STRENGTH NETWORK</div>
                  <div className="lb-sort">
                    <div className="lb-sort-chip active">SESSIONS</div>
                    <div className="lb-sort-chip">STREAK</div>
                    <div className="lb-sort-chip">INTENSITY</div>
                  </div>
                  {[
                    { rank: "🥇", name: "ibrahim_gains", tier: "🦁", sub: "23 SESSIONS · 4-WEEK STREAK", stat: "23", gold: true },
                    { rank: "🥈", name: "ahmed_m", tier: "🐯", sub: "14 SESSIONS · 3-WEEK STREAK", stat: "14" },
                    { rank: "🥉", name: "YOU", tier: "🐯", sub: "11 SESSIONS · 3-WEEK STREAK", stat: "11" },
                    { rank: "4", name: "sara_fit", tier: "🦊", sub: "9 SESSIONS · 2-WEEK STREAK", stat: "9" },
                    { rank: "5", name: "yusuf_lift", tier: "🐱", sub: "2 SESSIONS · NEW", stat: "2" },
                  ].map((r, i) => (
                    <motion.div
                      key={i}
                      className={`lb-row${r.gold ? " gold" : ""}`}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: 0.08 * i }}
                      style={r.name === "YOU" ? { outline: "1px solid rgba(78,205,196,0.45)", outlineOffset: -1 } : undefined}
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
            </div>
          </Tilt3D>
        </Reveal>

        <Reveal direction="up" delay={0.1}>
          <Expandable
            label="How to join a group"
            collapsedLabel="Hide details"
            detail={
              <>
                <h5>Three ways in</h5>
                <div className="expandable-detail-grid">
                  <div><h6>Trainer invite</h6><p>Your coach builds a group of their clients (and maybe other trainers&apos; clients) — you get notified, tap ACCEPT, you&apos;re in.</p></div>
                  <div><h6>Athlete invite</h6><p>A training partner can invite you to a group they&apos;re part of. Same flow — pending invite at the top of your leaderboards screen.</p></div>
                  <div><h6>Public group</h6><p>Public groups are joinable without an invite. Limited rollout — currently launch-region only, expanding soon.</p></div>
                </div>
                <h5 style={{ marginTop: 18 }}>How rankings update</h5>
                <p>Every time you (or anyone in the group) logs a session, ranks recompute. The scoreboard reflects your last completed workout immediately. No daily rollup — it&apos;s live.</p>
              </>
            }
          />
        </Reveal>
      </section>

      <hr className="mkt-divider" />

      {/* HOW IT WORKS */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">GETTING STARTED</div>
          <h2 className="section-title">Up and tracking<br />in 3 minutes.</h2>
          <p className="section-lead">No tutorial needed. Walk through onboarding once and you&apos;ll have a full week&apos;s training plan waiting.</p>
        </Reveal>
        <Stagger className="steps" stagger={0.08}>
          {[
            { n: "01", t: "Create your free account", d: "No credit card, no subscription prompt. Just email and password. You're in." },
            { n: "02", t: "Tell us about you", d: "9 quick questions: goals, fitness level, equipment, days per week. Takes under 2 minutes." },
            { n: "03", t: "Get your plan", d: "IronLog generates a personalised weekly training split based on your answers. Edit it anytime or follow it as-is." },
            { n: "04", t: "Start your first session", d: "Tap the day, select an exercise, and log your first set. You'll see exactly what you need to beat next time." },
          ].map((s) => (
            <StaggerItem key={s.n} className="step">
              <div className="step-num teal">{s.n}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* MOCKUPS */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">THE APP</div>
          <h2 className="section-title">Clean during a workout.<br />Informative after.</h2>
          <p className="section-lead">Designed to be used with sweaty hands, one thumb, mid-set.</p>
        </Reveal>
        <Stagger className="mockup-grid" stagger={0.1}>
          {/* Active Session */}
          <StaggerItem className="mockup tall">
            <div className="mock-head">ACTIVE SESSION</div>
            <div className="m-ex">
              <div className="m-ex-name">Barbell Squat</div>
              <div className="m-ex-muscle">quads · glutes · hamstrings</div>
            </div>
            <div className="m-set"><div className="m-set-n">SET 1</div><div className="m-set-v">100kg × 8</div><div className="m-set-cmp">↑ +5kg</div></div>
            <div className="m-set"><div className="m-set-n">SET 2</div><div className="m-set-v">100kg × 7</div><div className="m-set-cmp" style={{ color: "rgba(255,255,255,0.25)" }}>= same</div></div>
            <div className="m-set" style={{ background: "rgba(255,230,109,0.07)", border: "1px solid rgba(255,230,109,0.18)" }}>
              <div className="m-set-n" style={{ color: "var(--yellow)" }}>SET 3</div>
              <div className="m-set-v" style={{ color: "var(--yellow)" }}>105kg × 6</div>
              <div className="m-set-pr">NEW PR</div>
            </div>
            <div style={{ marginTop: 10, background: "rgba(78,205,196,0.09)", border: "1px solid rgba(78,205,196,0.18)", borderRadius: 8, padding: 8, fontSize: 8.5, color: "var(--teal)" }}>⏱ REST · 01:30 remaining</div>
            <div className="mockup-label bare">WORKOUT LOGGING</div>
          </StaggerItem>

          {/* Progress */}
          <StaggerItem className="mockup tall">
            <div className="mock-head">PROGRESS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
              {[
                { v: "5", l: "SESSIONS", c: "var(--orange)" },
                { v: "4", l: "STREAK", c: "var(--teal)" },
                { v: "54m", l: "AVG", c: "var(--yellow)" },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 6, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.25)" }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 5, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>ACTIVITY · MAY</div>
            <div className="m-cal">
              {Array.from({ length: 28 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="m-cal-dot"
                  style={{ background: CLIENT_CAL_ACTIVE.has(i) ? "var(--orange)" : "rgba(255,255,255,0.06)" }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.2, delay: i * 0.012 }}
                />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>TOP PRs</div>
            <div className="m-pr-row">
              <div className="m-pr-badge">🏆</div>
              <div><div className="m-pr-name">Deadlift</div><div className="m-pr-val">180kg · May 14</div></div>
            </div>
            <div className="m-pr-row">
              <div className="m-pr-badge" style={{ background: "linear-gradient(135deg,var(--teal),#009999)" }}>🏆</div>
              <div><div className="m-pr-name">Bench Press</div><div className="m-pr-val">100kg · May 12</div></div>
            </div>
            <div className="mockup-label bare">PROGRESS DASHBOARD</div>
          </StaggerItem>

          {/* Exercise Library */}
          <StaggerItem className="mockup tall">
            <div className="mock-head">EXERCISE LIBRARY</div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 7, padding: "6px 8px", fontSize: 8, color: "rgba(255,255,255,0.2)", marginBottom: 7 }}>🔍 Pull day exercises...</div>
            <div style={{ display: "flex", gap: 3, marginBottom: 7, flexWrap: "wrap" }}>
              <div style={{ padding: "2px 6px", borderRadius: 8, fontSize: 6.5, fontWeight: 700, background: "var(--teal)", color: "#000" }}>Gym</div>
              <div style={{ padding: "2px 6px", borderRadius: 8, fontSize: 6.5, background: "rgba(255,102,68,0.85)", color: "#000", fontWeight: 700 }}>Pull</div>
              <div style={{ padding: "2px 6px", borderRadius: 8, fontSize: 6.5, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>Back</div>
            </div>
            {[
              { name: "Barbell Row", muscle: "back · biceps · forearms" },
              { name: "Lat Pulldown", muscle: "back · biceps" },
              { name: "Pull-Ups", muscle: "back · biceps · forearms" },
            ].map((ex, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 8px", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(255,102,68,0.22)", flexShrink: 0 }} />
                <div><div style={{ fontSize: 8.5, fontWeight: 700 }}>{ex.name}</div><div style={{ fontSize: 6.5, color: "var(--orange)" }}>{ex.muscle}</div></div>
                <div style={{ fontSize: 6.5, background: "rgba(255,255,255,0.05)", padding: "2px 4px", borderRadius: 3, marginLeft: "auto", color: "rgba(255,255,255,0.4)" }}>FORM</div>
              </div>
            ))}
            <div className="mockup-label bare">EXERCISE BROWSER</div>
          </StaggerItem>

          {/* Body Metrics */}
          <StaggerItem className="mockup tall">
            <div className="mock-head">BODY TRACKING</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--teal)" }}>83.2</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>KG · CURRENT</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--orange)" }}>78.0</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>KG · TARGET</div>
              </div>
            </div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>WEIGHT TREND</div>
            <svg viewBox="0 0 130 40" style={{ width: "100%", marginBottom: 10 }}>
              <defs>
                <linearGradient id="cliGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ECDC4" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <motion.polyline
                points="0,35 15,33 30,32 45,30 60,28 75,27 90,24 105,22 120,18 130,15"
                fill="none"
                stroke="rgba(78,205,196,0.7)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <polyline points="0,35 15,33 30,32 45,30 60,28 75,27 90,24 105,22 120,18 130,15 130,40 0,40" fill="url(#cliGrad)" opacity="0.2" />
            </svg>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>BMI</div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>24.1</div>
              <div style={{ fontSize: 7, color: "var(--green)" }}>NORMAL</div>
            </div>
            <div className="mockup-label bare">BODY METRICS</div>
          </StaggerItem>
        </Stagger>
      </section>

      <hr className="mkt-divider" />

      {/* TRAINER CONNECTION */}
      <section className="mkt-section mkt-section-tight">
        <Reveal>
          <div className="section-tag teal">WORK WITH A TRAINER</div>
          <h2 className="section-title">Have a trainer?<br />They&apos;ll love this too.</h2>
          <p className="section-lead">If your trainer uses IronLog, they can see your data, send you programs, and message you — all inside the same app you&apos;re already using.</p>
        </Reveal>
        <Reveal direction="up" delay={0.05}>
          <div className="trainer-block">
            <div className="trainer-block-text">
              <div className="tblock-tag">HOW IT WORKS</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, lineHeight: 1.25 }}>You share. They coach.<br />Nothing extra to set up.</h3>
              <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 20, lineHeight: 1.7 }}>
                Your trainer searches your username, sends a connection request, and you accept. From that moment, they can view your history, write you a custom program, and message you directly. You keep full control — disconnect at any time.
              </p>
              <ul>
                {[
                  "Your trainer sees your sessions and PRs",
                  "They send you programs you can preview before accepting",
                  "In-app messages stay attached to your training context",
                  "You don't need to pay anything — the trainer covers the cost",
                ].map((t, i) => (
                  <li key={i} style={{ fontSize: 13, padding: "7px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", color: "var(--text)", display: "flex", gap: 10 }}>
                    <span style={{ color: "var(--orange)" }}>✦</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="trainer-block-visual">
              <div className="tblock-visual-inner">
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: 2, marginBottom: 12 }}>TRAINER MESSAGE</div>
                <motion.div
                  style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px 10px 10px 2px", padding: "9px 12px", fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginBottom: 8 }}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  Great session yesterday! I&apos;m pushing your squat weight 5kg from next week.
                </motion.div>
                <motion.div
                  style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px 10px 10px 2px", padding: "9px 12px", fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  I&apos;ve sent you an updated plan — take a look and accept when ready.
                </motion.div>
                <motion.div
                  style={{ padding: 10, background: "rgba(255,102,68,0.1)", border: "1px solid rgba(255,102,68,0.22)", borderRadius: 8, fontSize: 10.5, color: "rgba(255,102,68,0.85)" }}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  📋 New plan proposal from coach_ali — <span style={{ textDecoration: "underline" }}>Review &amp; Accept</span>
                </motion.div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <hr className="mkt-divider" />

      {/* FREE BANNER */}
      <section className="mkt-section mkt-section-tight" style={{ textAlign: "center" }}>
        <Reveal direction="up">
          <div className="free-banner">
            <div className="big-free">FREE</div>
            <div className="free-sub">Completely, permanently free.</div>
            <p style={{ fontSize: 15, color: "var(--text)", maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.7 }}>
              Every athlete feature — workout logging, personalised plans, PR tracking, form demos, muscle maps, progress charts, body metrics — free forever. No ads, no trial, no hidden tier.
            </p>
            <a href={APP_LINK} className="btn-teal" style={{ fontSize: 15, padding: "14px 36px" }}>Create Your Free Account</a>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <Reveal as="section" className="cta-section">
        <div className="section-tag teal" style={{ display: "inline-block", marginBottom: 14 }}>YOUR FIRST SESSION</div>
        <h2>Start tonight.<br />See the difference.</h2>
        <p>Log one workout. Look at the numbers after. You&apos;ll never go back to guessing.</p>
        <a href={APP_LINK} className="btn-teal" style={{ fontSize: 16, padding: "16px 40px" }}>Get IronLog Free →</a>
      </Reveal>

      <MarketingFooter tagline="FREE FOR ATHLETES · ALWAYS · IRONLOGMV.VERCEL.APP" />
    </>
  );
}
