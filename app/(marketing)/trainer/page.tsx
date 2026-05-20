"use client";

import { useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { MarketingNav } from "../_components/MarketingNav";
import { MarketingFooter } from "../_components/MarketingFooter";
import { Reveal, Stagger, StaggerItem } from "../_components/Reveal";
import { AnimatedCounter } from "../_components/AnimatedCounter";

const WA_LINK =
  "https://wa.me/9609120007?text=Hi%2C+I%27d+like+to+start+my+free+trial+on+IronLog+as+a+trainer";

const FAQ_DATA: { q: string; a: string }[] = [
  { q: "Do my clients need to pay anything?", a: "No — the IronLog athlete tier is completely free. Your clients download the app, create an account, and connect with you at zero cost." },
  { q: "Can I see my client's workouts in real time?", a: "You can see their full history after each session, including every set, weight, and reps. There's no live-stream during the workout, but the data is available the moment they finish." },
  { q: "What if my client already has their own plan?", a: "Their existing plan stays until you send them a new one. When you do, it arrives as a proposal — they can review it before it replaces their current program. No surprises." },
  { q: "Can I manage gym clients and remote clients the same way?", a: "Yes. IronLog works for in-person and remote coaching identically. Both client types log workouts, receive plans, and message you through the same interface." },
  { q: "What if a client doesn't have a smartphone?", a: "IronLog is a mobile-first web app accessible from any browser. It works on desktop too — any device with a modern browser can run it, including older phones." },
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
          <StaggerItem className="solution-card">
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
        </Reveal>

        {/* Showcase 2 — Program Builder */}
        <Reveal direction="up" amount={0.1}>
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
        </Reveal>

        {/* Showcase 3 — Client History */}
        <Reveal direction="up" amount={0.1}>
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
        </Reveal>

        {/* Showcase 4 — Messaging */}
        <Reveal direction="up" amount={0.1}>
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
