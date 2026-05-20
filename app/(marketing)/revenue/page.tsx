"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { MarketingNav } from "../_components/MarketingNav";
import { MarketingFooter } from "../_components/MarketingFooter";
import { Reveal, Stagger, StaggerItem } from "../_components/Reveal";
import { AnimatedCounter } from "../_components/AnimatedCounter";

export default function RevenuePage() {
  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 600], [0, -60]);

  return (
    <>
      <MarketingNav active="revenue" showRevenue ctaLabel={null} />

      {/* COVER */}
      <section className="cover">
        <motion.div className="cover-bg" style={{ y: coverY }} />
        <motion.div
          className="doc-type"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          CONFIDENTIAL · BUSINESS MODEL
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          How <span>IronLog</span><br />makes money.
        </motion.h1>
        <motion.p
          className="cover-sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          A freemium SaaS built on trainer subscriptions — with a clear short-term path to revenue and a long-term roadmap to gym licensing, AI tiers, and international expansion.
        </motion.p>
        <motion.div
          className="cover-meta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span className="meta-item">VERSION 2.0</span>
          <span className="meta-item">MAY 2026</span>
          <span className="meta-item">CONFIDENTIAL</span>
        </motion.div>
      </section>

      <hr className="mkt-divider" />

      <div className="page">
        {/* CORE THESIS */}
        <Reveal>
          <div className="section-tag">THE CORE THESIS</div>
          <h2 className="section-title">Free for athletes.<br />Paid for trainers.</h2>
          <p className="section-lead">
            The athlete side is free forever — this drives mass adoption and makes every trainer&apos;s client roster sticky. Revenue comes from trainers who get measurable, immediate value from managing clients professionally on one platform.
          </p>
        </Reveal>
        <Stagger className="grid-2" stagger={0.12}>
          <StaggerItem className="card">
            <div style={{ fontSize: 28, marginBottom: 12 }}>🏋️</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Athletes — Free</h3>
            <p className="text-sm">Workout logging, personalised plan generation, progress tracking, exercise library — all free, forever. Athletes never pay. This removes friction for trainer onboarding: any client, any budget.</p>
          </StaggerItem>
          <StaggerItem className="card" style={{ borderColor: "rgba(255,102,68,0.22)" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>💼</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Trainers — Subscription</h3>
            <p className="text-sm">Client management, program delivery, workout history access, progress tracking, plan proposals. The tools a serious coach needs to run a professional business — and willing to pay for.</p>
          </StaggerItem>
        </Stagger>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* PRICING TIERS */}
        <Reveal>
          <div className="section-tag">PRICING TIERS</div>
          <h2 className="section-title">Three tiers. Simple.</h2>
          <p className="section-lead">Priced in USD for global positioning. Trainers in Maldives, UK, UAE, and Australia all pay the same rate — no geographic discount needed at this stage.</p>
        </Reveal>
        <Stagger className="pricing-grid" stagger={0.1}>
          <StaggerItem className="tier">
            <div className="tier-name">ATHLETE</div>
            <div className="tier-price"><span className="amount">$0</span><span className="per"> / forever</span></div>
            <div className="tier-desc">For anyone who trains. No card needed, no trial — just free.</div>
            <ul>
              {[
                "Full workout logging",
                "Personalised training plan",
                "Progress tracking & PRs",
                "119+ exercises + form cues",
                "Body metrics & trends",
                "Receive trainer programs",
              ].map((f, i) => (
                <li key={i}><span className="tier-check">✓</span>{f}</li>
              ))}
              <li><span className="tier-check" style={{ color: "rgba(255,255,255,0.15)" }}>✗</span><span style={{ color: "rgba(255,255,255,0.25)" }}>Manage clients</span></li>
            </ul>
            <a href="#" className="tier-btn">Get Started Free</a>
          </StaggerItem>

          <StaggerItem className="tier hero-tier">
            <div className="tier-badge">MOST POPULAR</div>
            <div className="tier-name" style={{ marginTop: 18 }}>TRAINER — STARTER</div>
            <div className="tier-price"><span className="curr">$</span><span className="amount">19</span><span className="per"> / month</span></div>
            <div className="tier-desc">For trainers with up to 10 active clients. Best for independent coaches starting out.</div>
            <ul>
              <li><span className="tier-check">✓</span>Everything in Athlete</li>
              <li><span className="tier-check">✓</span>Up to <b>10 clients</b></li>
              <li><span className="tier-check">✓</span>Build &amp; deliver programs</li>
              <li><span className="tier-check">✓</span>View client workout history</li>
              <li><span className="tier-check">✓</span>In-app client messaging</li>
              <li><span className="tier-check">✓</span>Plan proposals + approvals</li>
              <li><span className="tier-check">✓</span>Client body metrics access</li>
            </ul>
            <a href="#" className="tier-btn cta">Start Free Trial</a>
          </StaggerItem>

          <StaggerItem className="tier">
            <div className="tier-name">TRAINER — PRO</div>
            <div className="tier-price"><span className="curr">$</span><span className="amount">49</span><span className="per"> / month</span></div>
            <div className="tier-desc">Unlimited clients. For established coaches and full-time personal trainers.</div>
            <ul>
              <li><span className="tier-check">✓</span>Everything in Starter</li>
              <li><span className="tier-check">✓</span><b>Unlimited clients</b></li>
              <li><span className="tier-check">✓</span>Priority support</li>
              <li><span className="tier-check">✓</span>Routine library sharing</li>
              <li><span className="tier-check">✓</span>Early access to new features</li>
              <li><span className="tier-check" style={{ color: "var(--yellow)" }}>→</span><span style={{ color: "var(--yellow)" }}>Gym white-label (Q4 2026)</span></li>
              <li><span className="tier-check" style={{ color: "var(--yellow)" }}>→</span><span style={{ color: "var(--yellow)" }}>Analytics dashboard (Q4 2026)</span></li>
            </ul>
            <a href="#" className="tier-btn">Start Free Trial</a>
          </StaggerItem>
        </Stagger>
        <Reveal>
          <div className="callout">
            <h4>30-day free trial on all trainer plans</h4>
            <p>No credit card required to start. Trainers experience the full platform before deciding to pay. Trial-to-paid conversion is the #1 metric to optimise in Year 1.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* FOUNDING MEMBERS */}
        <Reveal>
          <div className="section-tag">FOUNDING MEMBER STRATEGY</div>
          <h2 className="section-title">Lock in early adopters.<br />Build the base fast.</h2>
          <p className="section-lead">The fastest path to revenue isn&apos;t charging full price to strangers — it&apos;s charging a discounted lifetime rate to people who already trust you. Lock in 50 founding trainers and 10 founding gyms before opening public pricing.</p>
        </Reveal>
        <Stagger className="founding-grid" stagger={0.15}>
          <StaggerItem className="founding-card f1">
            <div className="founding-label green">FOUNDING TRAINERS</div>
            <h3>First 50 trainers</h3>
            <p className="text-sm" style={{ marginTop: 8 }}>Offer a founding member rate locked for life. Creates urgency (&quot;only 50 spots&quot;), rewards early trust, and gives you 50 advocates who feel invested in your success.</p>
            <div className="founding-price">
              <span className="was">$19/mo standard</span>
              <span className="now-price green">$15<span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>/mo forever</span></span>
              <div className="founding-slots">↳ 50 spots only · First come, first served</div>
            </div>
          </StaggerItem>
          <StaggerItem className="founding-card f2">
            <div className="founding-label orange">FOUNDING GYMS</div>
            <h3>First 10 gym deals</h3>
            <p className="text-sm" style={{ marginTop: 8 }}>White-label or multi-trainer gym account. Founding rate locks them in before the feature is even fully built — pre-sells the Q4 roadmap and funds development.</p>
            <div className="founding-price">
              <span className="was">$199/mo standard</span>
              <span className="now-price orange">$99<span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>/mo forever</span></span>
              <div className="founding-slots">↳ 10 spots only · Hand-selected partners</div>
            </div>
          </StaggerItem>
        </Stagger>
        <Reveal>
          <div className="callout green">
            <h4>Why this works</h4>
            <p>Founding members tell other people — not because you asked them to, but because they got a deal they&apos;re proud of. A trainer at a Maldives resort gym who saved $4/month forever will mention it to every trainer colleague. The discounted rate pays for itself in referrals within 60 days.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* SPEED TO REVENUE */}
        <Reveal>
          <div className="section-tag">SPEED TO REVENUE</div>
          <h2 className="section-title">0–90 day sprint.</h2>
          <p className="section-lead">The fastest path from product-complete to paying customers. Every action below has a direct line to MRR. Nothing in this list takes more than a day to execute.</p>
        </Reveal>
        <Stagger className="sprint-cols" stagger={0.12}>
          <StaggerItem className="sprint-col">
            <div className="sprint-col-head green">WEEK 1–2</div>
            <div className="sprint-col-title">Turn on payments</div>
            <div className="sprint-col-target">Target: product ready to charge</div>
            <SprintItem done text={<><b>Core product built</b> — logging, trainer tools, muscle maps, plans all live</>} />
            <SprintItem text={<>Sign up for <b>Paddle or Lemon Squeezy</b> (1 hour — no US entity needed)</>} />
            <SprintItem text="Wire up payment link to trainer signup flow" />
            <SprintItem text="Test full purchase → access flow end-to-end" />
            <SprintItem text="Set up Wise account for receiving USD payouts" />
            <SprintItem text="DM 20 trainers you know personally — offer founding rate" />
          </StaggerItem>
          <StaggerItem className="sprint-col">
            <div className="sprint-col-head orange">MONTH 1</div>
            <div className="sprint-col-title">First paying users</div>
            <div className="sprint-col-target">Target: $285 MRR (15 trainers × $19)</div>
            <SprintItem text={<>Onboard <b>5 beta trainers free</b> for 30 days — get testimonials</>} />
            <SprintItem text={<>Record a <b>60-second demo video</b> — real app, real use case</>} />
            <SprintItem text={<>Post demo to <b>LinkedIn + Instagram</b> (fitness trainer hashtags)</>} />
            <SprintItem text="Visit 3 gyms in Malé — show the app in person to management" />
            <SprintItem text="Convert beta trainers to founding member rate ($15/mo)" />
            <SprintItem text="Collect 2–3 written testimonials with real names and photos" />
          </StaggerItem>
          <StaggerItem className="sprint-col">
            <div className="sprint-col-head yellow">MONTHS 2–3</div>
            <div className="sprint-col-title">Scale the base</div>
            <div className="sprint-col-target">Target: $1,200 MRR (55 trainers)</div>
            <SprintItem text={<>Launch on <b>ProductHunt</b> — drives inbound from the right crowd</>} />
            <SprintItem text="Post weekly trainer tip content on LinkedIn — build authority" />
            <SprintItem text={<>Reach out to <b>5 resort gym managers</b> — offer founding gym rate</>} />
            <SprintItem text={<>Sign up for <b>YC Startup School</b> (free) — network + credibility</>} />
            <SprintItem text="Partner with 1 fitness influencer for a free account + review" />
            <SprintItem text="Apply to 1 local or regional startup accelerator" />
          </StaggerItem>
        </Stagger>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* MILESTONES */}
        <Reveal>
          <div className="section-tag">SHORT-TERM GOALS</div>
          <h2 className="section-title">Month-by-month<br />milestones.</h2>
          <p className="section-lead">Concrete, measurable targets for the first six months. Each milestone unlocks the next — trainer retention funds gym outreach, gym deals fund AI development.</p>
        </Reveal>
        <Stagger className="milestone-grid" stagger={0.08}>
          <Milestone tier="m1" period="MONTH 1" num="$285" numColor="green" items={["15 paying trainers", "5 beta users onboarded", "Payments live on Paddle", "First 3 testimonials collected", "Demo video published"]} />
          <Milestone tier="m2" period="MONTH 2" num="$760" numColor="orange" items={["40 paying trainers", "ProductHunt launch", "First resort gym inquiry", "Weekly content schedule live", "Churn rate tracked < 6%"]} />
          <Milestone tier="m3" period="MONTH 3" num="$1,200" numColor="yellow" items={["55 paying trainers", "First gym deal signed ($99 founding)", "YC Startup School enrolled", "Influencer partnership active", "$1K MRR milestone celebrated"]} />
          <Milestone tier="m6" period="MONTH 6" num="$2,800" numColor="purple" items={["120 paying trainers", "3 gym/resort deals ($99–199/mo)", "UK market outreach started", "AI coaching features scoped", "First press mention or feature"]} />
        </Stagger>
        <Reveal>
          <div className="callout yellow">
            <h4>The compounding effect</h4>
            <p>At 70% trial-to-paid conversion and 5% monthly churn, every 20 new trainers added per month produces compounding MRR. Month 6 isn&apos;t just Month 1 × 6 — it&apos;s Month 1 growth stacked on retained users from every prior month. The curve bends upward from Month 3 onwards.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* FINANCIAL PROJECTIONS */}
        <Reveal>
          <div className="section-tag">FINANCIAL PROJECTIONS</div>
          <h2 className="section-title">Month 12 scenarios.</h2>
          <p className="section-lead">Based on 20 trainers onboarded in Month 1, organic word-of-mouth growth, and a 70% trial-to-paid conversion rate.</p>
        </Reveal>
        <Stagger className="scenarios" stagger={0.12}>
          <Scenario label="CONSERVATIVE" cls="con" mid={false}
            rows={[["Trainers (Starter)", "30", "teal"], ["Trainers (Pro)", "8", "teal"], ["Gym deals", "1", "teal"], ["Churn rate", "8% / mo", "dim"]]}
            total="$1,161" arr="~$13.9K ARR" />
          <Scenario label="MODERATE" cls="mod" mid
            rows={[["Trainers (Starter)", "65", "orange"], ["Trainers (Pro)", "22", "orange"], ["Gym deals", "3", "orange"], ["Churn rate", "5% / mo", "dim"]]}
            total="$2,910" arr="~$34.9K ARR" />
          <Scenario label="AGGRESSIVE" cls="agg" mid={false}
            rows={[["Trainers (Starter)", "130", "yellow"], ["Trainers (Pro)", "55", "yellow"], ["Gym deals", "8", "yellow"], ["Churn rate", "3% / mo", "dim"]]}
            total="$6,757" arr="~$81.1K ARR" />
        </Stagger>
        <Reveal>
          <div className="callout teal">
            <h4>The gym licensing kicker</h4>
            <p>A single resort gym on a white-label plan at $199–$299/month equals 10–16 individual trainer subscriptions. The Maldives has 160+ resort islands — and each has at least one gym. This is a high-value, low-competition distribution channel with direct personal access.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* UNIT ECONOMICS */}
        <Reveal>
          <div className="section-tag">UNIT ECONOMICS</div>
          <h2 className="section-title">The numbers that matter.</h2>
          <p className="section-lead">SaaS health requires LTV:CAC above 3:1. Fitness coaching has exceptionally high retention once clients are embedded in the workflow.</p>
        </Reveal>
        <Stagger className="econ-grid" stagger={0.07}>
          <Econ num={<><AnimatedCounter to={312} prefix="$" /></>} color="orange" label="LTV — STARTER" note="$19/mo × 16.5 mo avg retention" />
          <Econ num={<><AnimatedCounter to={833} prefix="$" /></>} color="orange" label="LTV — PRO" note="$49/mo × 17 mo avg retention" />
          <Econ num={<><AnimatedCounter to={8} prefix="~$" /></>} color="teal" label="CAC (ORGANIC)" note="Word-of-mouth, zero ad spend" />
          <Econ num="39:1" color="green" label="LTV:CAC RATIO" note="Excellent for early-stage SaaS" />
          <Econ num={<><AnimatedCounter to={30} suffix=" days" /></>} color="yellow" label="PAYBACK PERIOD" note="Month 2 is pure margin" />
          <Econ num="~80%" color="purple" label="GROSS MARGIN" note="After payment processing fees" />
        </Stagger>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* LONG-TERM VISION */}
        <Reveal>
          <div className="section-tag">LONG-TERM VISION</div>
          <h2 className="section-title">Years 1–5.</h2>
          <p className="section-lead">Each year unlocks a new revenue channel. The model compounds — trainers bring clients, clients become athletes, athletes become trainers. The flywheel builds a defensible moat.</p>
        </Reveal>
        <div className="vision-timeline">
          {[
            { y: "y1", year: "Y1", period: "YEAR 1 · END OF 2026", title: "Establish & validate", statColor: "green", mrr: "$5K MRR", arr: "~$60K ARR", trainers: "250 trainers", gyms: "5 gym deals", desc: "Core trainer subscription model proven. Payment infrastructure live. Founding member cohort locked in. First 5 gym/resort deals closed. UK outreach started. Product-market fit confirmed by retention data — trainers who onboard 1+ clients stay 12+ months." },
            { y: "y2", year: "Y2", period: "YEAR 2 · 2027", title: "Expand & automate", statColor: "orange", mrr: "$20K MRR", arr: "~$240K ARR", trainers: "750 trainers", gyms: "20 gyms", desc: "UK and UAE markets generating 30% of revenue. Gym white-labelling fully live. AI coaching tier launched at $79/month. First contractor hired (support / outreach). Trainer marketplace pilot — trainers can list profiles, earn client referrals through the platform." },
            { y: "y3", year: "Y3", period: "YEAR 3 · 2028", title: "Scale & diversify", statColor: "yellow", mrr: "$60K MRR", arr: "~$720K ARR", trainers: "2,000 trainers", gyms: "60 gyms", desc: "Australia market open. Corporate wellness pilot launched — per-employee pricing for companies offering staff fitness benefits. First enterprise gym chain deal (20+ locations). Team of 3 full-time. Revenue from 4 distinct streams: subscriptions, gym licensing, AI tier, marketplace commission." },
            { y: "y4", year: "Y4", period: "YEAR 4 · 2029", title: "Institutional traction", statColor: "purple", mrr: "$150K MRR", arr: "~$1.8M ARR", trainers: "5,000 trainers", gyms: "150 gyms", desc: "US market soft launch. Corporate wellness at scale — 10+ enterprise clients. Certification body partnerships (PT exam bodies offering IronLog as a tools recommendation). Team of 8. Seed round or strategic investor if growth justifies external capital. Potential acquisition interest from fitness platforms." },
            { y: "y5", year: "Y5", period: "YEAR 5 · 2030", title: "Dominant or exit", statColor: "teal", mrr: "$400K MRR", arr: "~$4.8M ARR", trainers: "12,000 trainers", gyms: "400 gyms", desc: "IronLog is the default platform for independent trainers globally. At this scale, strategic acquisition by a fitness equipment brand, health platform, or insurtech becomes realistic at 5–8× ARR ($24M–$38M). Alternatively: Series A to push for US market dominance. Either path is a strong outcome from zero external funding in Year 1." },
          ].map((v, i) => (
            <Reveal key={v.y} direction="up" delay={i * 0.05} amount={0.1}>
              <div className="vision-row">
                <div className={`vision-dot ${v.y}`}>{v.year}</div>
                <div className="vision-body">
                  <div className="vision-period">{v.period}</div>
                  <h4>{v.title}</h4>
                  <div className="vision-stats">
                    <span className={`vision-stat ${v.statColor}`}>{v.mrr}</span>
                    <span className="vision-stat dim">{v.arr}</span>
                    <span className="vision-stat dim">{v.trainers}</span>
                    <span className="vision-stat dim">{v.gyms}</span>
                  </div>
                  <p>{v.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* REVENUE STREAM EVOLUTION */}
        <Reveal>
          <div className="section-tag">REVENUE STREAM EVOLUTION</div>
          <h2 className="section-title">Six streams.<br />Built over five years.</h2>
          <p className="section-lead">The business doesn&apos;t rely on a single revenue line. Each stream activates on a deliberate schedule — no stream is turned on before the prior one is profitable enough to fund its development.</p>
        </Reveal>
        <Reveal direction="up" delay={0.05}>
          <div className="stream-table-wrap">
            <table className="stream-table">
              <thead>
                <tr><th>Stream</th><th>Status</th><th>When</th><th>Unit price</th><th>Year 5 potential</th></tr>
              </thead>
              <tbody>
                {[
                  ["Trainer subscriptions", "live", "● READY", "Now — activate Paddle", "$19–$49 / month", "$2.1M / yr"],
                  ["Gym & resort licensing", "soon", "◐ Q4 2026", "White-label module built", "$199–$499 / month", "$720K / yr"],
                  ["AI coaching tier", "soon", "◐ 2027", "After 500+ trainer base", "$79–$99 / month", "$960K / yr"],
                  ["Trainer marketplace", "later", "○ 2027", "Requires sufficient athlete base", "10–15% commission", "$480K / yr"],
                  ["Corporate wellness", "later", "○ 2028", "After UK/UAE established", "$8–15 / employee / month", "$1.2M / yr"],
                  ["Data & research licensing", "later", "○ 2029", "Requires 50K+ user dataset", "Annual B2B contracts", "$240K / yr"],
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row[0]}</td>
                    <td className={row[1]}>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td>{row[4]}</td>
                    <td className="headline">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal>
          <div className="callout">
            <h4>Total Year 5 revenue potential: ~$5.7M ARR</h4>
            <p>At 80% gross margin, this translates to ~$4.6M gross profit. Even at half this scale, IronLog is a highly profitable, bootstrapped business — with or without investment. The model is deliberately designed to avoid depending on external capital to reach profitability.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* PAYMENT INFRASTRUCTURE */}
        <Reveal>
          <div className="section-tag">PAYMENT INFRASTRUCTURE</div>
          <h2 className="section-title">Collecting money from Maldives.</h2>
          <p className="section-lead">Stripe is not directly available in MVB. Here&apos;s the stack, ranked by speed to implement.</p>
        </Reveal>
        <Stagger className="pay-grid" stagger={0.1}>
          <StaggerItem className="pay-card">
            <div className="pay-badge best">RECOMMENDED NOW</div>
            <h4>Paddle</h4>
            <p>Acts as Merchant of Record — they charge the customer, handle all taxes and VAT globally, then pay you via bank transfer or Wise. No US entity needed. Works today.</p>
            <ul className="pay-pros">
              {["5% + $0.50 per transaction", "Payouts to MVB via Wise", "Handles VAT/tax globally", "Built-in subscription management", "No US entity required"].map((t, i) => (
                <li key={i}>✓ <span>{t}</span></li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem className="pay-card">
            <div className="pay-badge good">ALSO GOOD</div>
            <h4>Lemon Squeezy</h4>
            <p>Same Merchant of Record model as Paddle. Slightly simpler setup, developer-friendly API, built-in affiliate programme. Growing fast with strong SaaS community.</p>
            <ul className="pay-pros">
              {["5% + $0.50 per transaction", "Payouts via Wise or bank", "Built-in affiliate program", "Great dashboard UX", "Stripe Checkout-like embed"].map((t, i) => (
                <li key={i}>✓ <span>{t}</span></li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem className="pay-card">
            <div className="pay-badge later">SCALE LATER</div>
            <h4>Stripe via Atlas</h4>
            <p>Stripe Atlas registers a US LLC for ~$500. Gives full Stripe access with lower fees and maximum flexibility. Worth doing at $2K+ MRR.</p>
            <ul className="pay-pros">
              {["$500 one-time setup cost", "2.9% + $0.30 per transaction", "Full Stripe product suite", "~4–6 weeks to set up", "US tax filing required annually"].map((t, i) => (
                <li key={i}>→ <span>{t}</span></li>
              ))}
            </ul>
          </StaggerItem>
        </Stagger>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* ACQUISITION FUNNEL */}
        <Reveal>
          <div className="section-tag">ACQUISITION FUNNEL</div>
          <h2 className="section-title">From discovery to paid.</h2>
          <p className="section-lead">The trainer funnel is shorter than typical B2C. Trainers are motivated buyers — they want tools that save time and make them look professional to clients.</p>
        </Reveal>
        <Reveal direction="up" delay={0.05}>
          <div className="funnel">
            <FunnelStage num="1,000" numColor="orange" label="Trainers reached" sub="Social posts, word of mouth, gym visits, outreach" delay={0} />
            <FunnelStage num="280" numColor="teal" label="Visit the trainer pitch page" sub="28% click-through from outreach" delay={0.1} />
            <FunnelStage num="140" numColor="yellow" label="Sign up for free trial" sub="50% of visitors start trial" delay={0.2} />
            <FunnelStage num="98" numColor="purple" label="Onboard at least 1 client" sub="70% activation rate once signed up" delay={0.3} />
            <FunnelStage num="82" numColor="green" label="Convert to paid" sub="84% of activated trainers pay" delay={0.4} />
          </div>
        </Reveal>
        <Reveal>
          <div className="callout">
            <h4>Key insight: activation = retention</h4>
            <p>A trainer who onboards even one client has strong reasons to stay — their clients now depend on the app. The most important metric in Month 1 is not signups, it&apos;s &quot;trainers who have connected at least one client.&quot; That&apos;s the activation event that drives everything else.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* MARKET EXPANSION */}
        <Reveal>
          <div className="section-tag">MARKET EXPANSION</div>
          <h2 className="section-title">Four markets.<br />Four phases.</h2>
          <p className="section-lead">Growth is geographic and sequential. Each market funds the next. No market is entered without the prior one being cash flow positive.</p>
        </Reveal>
        <Stagger className="geo-grid" stagger={0.1}>
          <GeoCard phase="ph1" phaseLabel="PHASE 1 · NOW" flag="🇲🇻" title="Maldives" when="2026 · HOME MARKET" desc="160+ resort islands, each with a gym. 300+ independent trainers in Malé and Hulhumalé. Personal relationships are the distribution channel — no cold outreach needed. Local presence creates trust no competitor can replicate." opp="Est. 300 trainers, 40 gyms addressable" />
          <GeoCard phase="ph2" phaseLabel="PHASE 2 · Q4 2026" flag="🇬🇧" title="United Kingdom" when="2026–2027 · ENGLISH MARKET" desc="Large South Asian diaspora with cultural familiarity. 60,000+ registered personal trainers. Premium willingness to pay ($19/mo is modest for a UK PT charging £50–80/hour). Strong fitness influencer culture drives organic discovery." opp="Est. 60K PTs, top 1% = 600 customers" />
          <GeoCard phase="ph3" phaseLabel="PHASE 3 · 2027" flag="🇦🇪" title="UAE / Dubai" when="2027 · LUXURY FITNESS MARKET" desc="Booming luxury fitness market. High concentration of premium PTs, boutique gyms, and resort wellness. Similar timezone to Maldives. USD pricing is natural. Strong alignment with IronLog's positioning." opp="Est. 8K PTs, 500 premium gyms" />
          <GeoCard phase="ph4" phaseLabel="PHASE 4 · 2028" flag="🇦🇺" title="Australia" when="2028 · SCALE MARKET" desc="Strong outdoor fitness culture, high gym density, English-speaking, high willingness to pay. Shares PT certification standards with UK. Self-serve entry — no local team needed. Bridgehead for broader Asia-Pacific expansion." opp="Est. 30K PTs, growing fitness app market" />
        </Stagger>
        <Reveal>
          <div className="callout teal">
            <h4>Why not the US first?</h4>
            <p>The US fitness app market is saturated, customer acquisition is expensive, and competition is well-funded. Starting in markets where IronLog has a natural advantage (Maldives relationships, UK diaspora) means first-mover position, lower CAC, and stronger unit economics — which fund the eventual US push from a position of strength.</p>
          </div>
        </Reveal>

        <hr className="mkt-divider" style={{ margin: "56px 0" }} />

        {/* REVENUE ROADMAP */}
        <Reveal>
          <div className="section-tag">REVENUE ROADMAP</div>
          <h2 className="section-title">Phased execution.</h2>
          <p className="section-lead">Seven phases, each with clear entry criteria, exit milestones, and a defined revenue unlock. No phase begins until the prior phase&apos;s key metric is hit.</p>
        </Reveal>
        <div className="roadmap">
          <RoadmapItem dotState="done" dot="✓" phase="PHASE 1 · COMPLETE" tags={[["done", "DONE"]]} title="Platform built" desc="Full workout logging, exercise library (119+ exercises), muscle maps, trainer tools, plan builder, client management, push notifications, rest timer, PB tracking — all live in production. PWA-installable on iOS and Android." kpis={[["highlight", "Product complete"], ["", "119+ exercises live"], ["", "iOS + Android PWA"], ["", "Trainer + athlete roles"]]} />
          <RoadmapItem dotState="now" dot="◉" phase="PHASE 2 · NOW — Q3 2026" tags={[["now", "ACTIVE"], ["q3", "Q3 2026"]]} title="Payments live + founding member push" desc="Wire up Paddle or Lemon Squeezy. Launch founding member pricing ($15/mo, first 50 trainers). Run direct outreach to 100+ trainers across Malé, Hulhumalé, and resort contacts. Build email onboarding sequence. Target: first payment received within 7 days of Paddle going live." kpis={[["highlight", "$285 MRR by Month 1"], ["", "50 founding trainer spots"], ["", "Paddle integration"], ["", "Demo video published"]]} />
          <RoadmapItem dotState="soon" dot="○" phase="PHASE 3 · Q3–Q4 2026" tags={[["q3", "Q3 2026"]]} title="Organic growth engine" desc="Weekly content on LinkedIn and Instagram (trainer tips, product updates, user stories). ProductHunt launch in Month 2. Apply to YC Startup School. Partner with 2–3 fitness influencers for free accounts. Target: 100 trainers by end of Q3, driven by referrals from founding member cohort." kpis={[["highlight", "$1K MRR by Month 3"], ["", "ProductHunt launch"], ["", "100 trainers"], ["", "Influencer partnership"]]} />
          <RoadmapItem dotState="soon" dot="○" phase="PHASE 4 · Q4 2026" tags={[["q4", "Q4 2026"]]} title="Gym & resort licensing" desc="$199–$299/month white-label accounts for gyms and resorts. Custom branding, multiple staff trainer accounts, gym-wide client roster. First target: 5 resort gym operators in the Maldives via direct personal outreach. One deal = 10× the value of one trainer subscription." kpis={[["highlight", "5 gym deals closed"], ["", "$2.5K MRR"], ["", "White-label module built"], ["", "UK outreach started"]]} />
          <RoadmapItem dotState="soon" dot="○" phase="PHASE 5 · Q1–Q2 2027" tags={[["teal", "2027"]]} title="UK market + AI coaching tier" desc="Launch in the UK via targeted LinkedIn outreach and South Asian fitness community networks. Simultaneously launch AI coaching tier ($79/month): adaptive plan adjustments, workout summaries, natural language program generation. AI tier justifies a higher price point and reinvigorates growth among existing Pro users upgrading." kpis={[["highlight", "$10K MRR"], ["", "UK trainers live"], ["", "AI tier launched"], ["", "500 total trainers"]]} />
          <RoadmapItem dotState="soon" dot="○" phase="PHASE 6 · 2027–2028" tags={[["purple", "2028"]]} title="Trainer marketplace + UAE" desc="Athletes can discover and book trainers through IronLog. Trainers pay 10–15% commission on client bookings generated through the platform. Marketplace turns every free athlete user into a potential revenue source. UAE market opens simultaneously — premium positioning, minimal adaptation required." kpis={[["highlight", "$40K MRR"], ["", "Marketplace live"], ["", "UAE trainers active"], ["", "1,500 total trainers"]]} />
          <RoadmapItem dotState="soon" dot="○" phase="PHASE 7 · 2028–2030" tags={[["yellow", "LONG-TERM"]]} title="Corporate wellness + acquisition potential" desc="Enterprise B2B — companies pay per employee per month to offer IronLog as a staff wellness benefit. Australia market open. At $4M+ ARR, the business becomes an attractive acquisition target for fitness equipment brands (Technogym, Life Fitness), health platforms (Whoop, Garmin), or insurtech. Alternatively: Series A to push for US market leadership." kpis={[["highlight", "$4M+ ARR"], ["", "Corporate wellness live"], ["", "Acquisition / Series A"], ["", "Australia + US entry"]]} />
        </div>
      </div>

      <MarketingFooter tagline="CONFIDENTIAL · NOT FOR DISTRIBUTION · © 2026 IRONLOG" />
    </>
  );
}

/* ───── Helpers ───── */

function SprintItem({ done, text }: { done?: boolean; text: React.ReactNode }) {
  return (
    <div className="sprint-item">
      <div className={`sprint-cb ${done ? "done" : "todo"}`}>{done ? "✓" : ""}</div>
      <div className="sprint-text">{text}</div>
    </div>
  );
}

function Milestone({ tier, period, num, numColor, items }: { tier: string; period: string; num: string; numColor: string; items: string[] }) {
  return (
    <StaggerItem className={`milestone ${tier}`}>
      <div className="milestone-period">{period}</div>
      <div className={`milestone-num ${numColor}`}>{num}</div>
      <div className="milestone-label">MRR TARGET</div>
      <ul className="milestone-items">
        {items.map((t, i) => (<li key={i}>✓ <span>{t}</span></li>))}
      </ul>
    </StaggerItem>
  );
}

function Scenario({ label, cls, mid, rows, total, arr }: { label: string; cls: string; mid: boolean; rows: [string, string, string][]; total: string; arr: string }) {
  return (
    <StaggerItem className={`scenario ${mid ? "mid" : ""}`}>
      <div className={`scenario-label ${cls}`}>{label}</div>
      {rows.map(([lbl, val, color], i) => (
        <div key={i} className="scenario-row"><span>{lbl}</span><b className={color === "dim" ? "dim-c" : color + "-c"} style={color === "dim" ? { color: "rgba(255,255,255,0.3)" } : undefined}>{val}</b></div>
      ))}
      <div className="scenario-total">{total}<span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 400, marginLeft: 4 }}>/mo</span></div>
      <div className="scenario-arr">{arr}</div>
    </StaggerItem>
  );
}

function Econ({ num, color, label, note }: { num: React.ReactNode; color: string; label: string; note: string }) {
  return (
    <StaggerItem className="econ-card">
      <div className={`econ-num ${color}`}>{num}</div>
      <div className="econ-label">{label}</div>
      <div className="econ-note">{note}</div>
    </StaggerItem>
  );
}

function FunnelStage({ num, numColor, label, sub, delay }: { num: string; numColor: string; label: string; sub: string; delay: number }) {
  return (
    <motion.div
      className="funnel-stage"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={`funnel-num ${numColor}`}>{num}</div>
      <div>
        <div className="funnel-label">{label}</div>
        <div className="funnel-sub">{sub}</div>
      </div>
    </motion.div>
  );
}

function GeoCard({ phase, phaseLabel, flag, title, when, desc, opp }: { phase: string; phaseLabel: string; flag: string; title: string; when: string; desc: string; opp: string }) {
  return (
    <StaggerItem className="geo-card">
      <div className={`geo-phase ${phase}`}>{phaseLabel}</div>
      <div className="geo-flag">{flag}</div>
      <h4>{title}</h4>
      <div className="geo-when">{when}</div>
      <p>{desc}</p>
      <div className="geo-opp">📍 <span>{opp}</span></div>
    </StaggerItem>
  );
}

function RoadmapItem({ dotState, dot, phase, tags, title, desc, kpis }: { dotState: string; dot: string; phase: string; tags: [string, string][]; title: string; desc: string; kpis: [string, string][] }) {
  return (
    <Reveal direction="up" amount={0.1}>
      <div className="roadmap-item">
        <div className={`roadmap-dot ${dotState}`}>{dot}</div>
        <div className="roadmap-body">
          <div className="roadmap-phase">{phase}</div>
          {tags.map(([cls, label], i) => (<span key={i} className={`mini-tag ${cls}`}>{label}</span>))}
          <h4>{title}</h4>
          <p>{desc}</p>
          <div className="roadmap-kpis">
            {kpis.map(([cls, label], i) => (
              <div key={i} className={`roadmap-kpi${cls ? ` ${cls}` : ""}`}>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
