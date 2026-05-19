# IRONLOG — Train Smarter. Track Everything.

**IRONLOG** is a full-stack progressive web app built for serious lifters and the trainers who coach them. Log every set, watch your progress compound, get a personalised training plan, and stay connected with your trainer — all from a polished mobile-first interface that installs directly to your home screen.

No ads. No subscriptions. No fluff. Just your lifts.

> Built on Next.js 14 · PostgreSQL · Prisma · Web Push · Vercel

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma v5 |
| Auth | Cookie-based (`ironlog-uid`, httpOnly, 1-year) |
| Email | Nodemailer via Google Workspace SMTP |
| Push Notifications | Web Push API + VAPID (`web-push` package) |
| Hosting | Vercel |

---

## Features

### Auth & Onboarding
- Multi-step login: username → register / setup / login depending on account state
- Login accepts **username or email**
- Passwords hashed with `scrypt` (Node built-in `crypto`, no external package)
- Forgot password → temp password emailed → must-reset screen on next login
- Welcome email sent on new account registration
- **Animated login screen:** `IRON` and `LOG` drop from above with a squash-and-stretch impact animation on page load; the `I` is rendered as an inline SVG dumbbell glyph
- Rotating motivational phrase cycles every 5 seconds with slide-in/out transitions — visible on both the login screen and the home screen

### Workout Tracking
- Per-set weight + reps logging with ± steppers
- **Rest countdown timer:** SVG arc ring depletes around the countdown number; audio double-beep + vibration on completion; push notification when app is backgrounded
- Session elapsed timer
- Comparison indicators on every set: **vs previous set** and **vs last session**
- **Personal Best detection:** 🏆 overlay pops immediately when you log a weight that beats your last session — no waiting until the end
- Warmup / cardio rows: tap to mark done, no data entry required
- **Bodyweight toggle:** bodyweight exercises hide the weight field by default; `+ ADD WEIGHT` reveals it for weighted variants (vest, belt, etc.)
- Active workout persists across navigation — leave to home, message, check progress, return anytime
- **Supersets:** pair any two or more exercises; auto-advances between them with no rest, fires rest after the last in the group
- **Drop sets:** set rest to 0 (SKIP) on any exercise — a drop set panel slides in immediately after the main set with weight pre-reduced ~20%; rest only fires after all drops complete
- **Add exercise mid-session:** `+ ADD EXERCISE` button opens a full exercise browser during any active workout; configure sets, reps, and rest; toggle "Save to plan" to make it permanent or keep it session-only
- **Workout complete animation:** full-screen expanding rings + checkmark pop on save; auto-dismisses before navigating home

### Session Persistence
- In-progress workouts saved to `localStorage` continuously
- Active workout highlighted on home screen with live timer; other days greyed out
- Tap the active card to resume; tap "← Home" during workout to return without losing session
- Finish review overlay: editable duration, total sets logged, confirm before saving
- Edit any logged set mid-session via a dedicated overlay

### Home Screen
- **Animated workout-type icons:** each workout card shows a front-and-back block-figure SVG with muscles animating (CSS `filter: drop-shadow` explosion) to indicate which muscle groups are targeted — push, pull, legs, upper, full body, cardio each have distinct patterns with per-muscle stagger delays
- Active workout card shows live elapsed timer and "TAP TO RESUME →" when a session is in progress
- Greyed-out cards prevent accidentally starting a second session
- Notification permission banner (in-app) shown on first visit — "Not now" dismisses persistently
- Rotating motivational phrase displayed below the `LIFT · TRACK · PROGRESS` tagline

### Personalised Plan
- 8-step onboarding questionnaire for new users: days per week, goals, fitness level, location, equipment, gender, DOB, body metrics
- **Multiple goals** supported — select any combination of Build Muscle, Get Stronger, Lose Fat, General Fitness
- **Equipment-aware filtering:** exercises require the right gear — bench press won't appear for users who only have dumbbells (`requireAll` flag handles multi-item requirements). Home equipment options include treadmill, elliptical, and multi-gym (expands to configure which stations are included: cable, machine, pull-up bar, dip bar)
- Rule-based plan generator produces a custom split — no AI API required
  - 2d → Full Body · 3d → PPL or Full Body ×3 · 4d → Upper/Lower · 5d → PPL · 6d → PPL ×2
  - Blends sets/reps/rest across all selected goals (e.g. Muscle + Fat Loss → moderate reps, shorter rest)
  - Primary goal (strength > muscle > fat_loss > fitness) drives split type; Fat Loss adds cardio finishers
  - Pulls from 110+ exercise database tagged by muscle, equipment, location, and goal
- Existing users (have workout history) skip onboarding and keep their prior plan

### Split Customisation
- CUSTOMISE button opens a plan overview of all training days
- Per-day editor: reorder exercises (↑↓), remove, and add from the full exercise browser
- Searchable exercise browser (110+ exercises, filtered live by name, filterable by location / push-pull-legs / muscle group)
- **Custom rest times:** per-exercise rest chip selector (`SKIP / 30s – 180s`) — default pre-highlighted, one tap to override; SKIP (0s) marks the exercise as a drop set
- **Multi-select mode:** SELECT button enters multi-select; select any exercises then bulk DELETE, create **⟳ SUPERSET**, or mark as **DROP SET** (sets rest = 0)
- **Supersets from existing exercises:** select 2+ exercises in multi-select → `⟳ SUPERSET` — groups them and reorders them consecutively
- **Supersets from library:** `⟳ SUPERSET` button opens browser in superset-pick mode — select any exercises from the library and add them as a new paired group in one action
- **⟳ SUPERSET button** is context-aware: 0 selected → opens library picker; 1 selected → shows `+1 MORE` hint; 2+ selected → lights up gold and creates the superset on tap
- Changes saved to database instantly; reflected in the workout view

### Saved Routines
- Save the current plan under any custom name as a snapshot
- Restore any saved routine at any time (replaces active plan)
- Share a routine to any user by exact username — appears in their saved routines with attribution
- **Trainers:** share to multiple clients at once — client list shown as selectable chips in the share panel; `SEND TO N CLIENTS` loops through each in one action
- List is collapsed by default to prevent accidental restores; count badge shows how many are saved

### Muscle Diagram & Form Cues
- Anatomical SVG body diagram (front + back view) rendered entirely in-app — no images
- Every muscle group drawn with bezier-curve paths matching real anatomy: pec fan, lat triangle, deltoid heads, bicep/tricep heads, VMO teardrop, etc.
- Fiber direction lines overlay each muscle to show grain and pennation angle
- **Sub-muscle zone detail:** per-exercise targeting data (e.g. "Upper Chest", "Lateral Delt", "Long Head") shown as a labelled legend below the diagram
- Zones rendered in three layers: dim background → orange secondary → red primary with glow
- Covers 60+ exercises via `lib/muscleDetail.ts`; fallback derivation for exercise names not in the exercise library
- **Form cues:** 2–3 activation-focused coaching cues per exercise shown below the form demo image in the FORM modal; covers 119 exercises via `lib/formCues.ts` with ID-first then name-match lookup

### Progress
- **Dashboard tab:** 28-day activity calendar, weekly streak, average session time, Personal Bests per exercise (best weight + reps achieved)
- **Exercises tab:** per-exercise analytics — avg weight, avg reps, PB, weight trend chart, full session history
- **History tab:** full session log grouped by training day, expandable per session
- **Body tab:** log weight and body fat % over time, set target goals, trend chart, progress-to-goal bars

### Body Metrics
- Log weight (kg) and body fat % with a date stamp
- **Synced with Settings**: logging in Progress updates your profile; saving in Settings creates a metric entry
- Set target weight and target body fat % goals
- Trend chart shows last 12 entries
- Progress bars toward goals; history list with delete

### Profile & Settings
- **BODY & STATS** section in Settings: edit weight, height, body fat %, date of birth, gender, goal, fitness level, and days per week
- Changes sync to `UserProfile` in the database

### Trainer System
- Trainer accounts can search for users by exact username and send a training request
- Users accept/decline trainer requests from Settings
- Accepted clients appear in the **MY CLIENTS** section on the trainer's home screen
- **Trainer badge** shown next to username on home screen — reflects role changes without reload (re-fetches on tab focus via `visibilitychange`)
- Client detail view (3 tabs):
  - **SPLIT** — view the client's current plan; trainers can edit sets, reps, rest times, supersets, and drop sets inline and propose changes; **⚡ BUILD PLAN** generates a fresh plan (one tier harder than the client's fitness level) ready to review and customise before sending
  - **HISTORY** — full session log; tap any session to see every exercise logged vs skipped, with weight × reps per set
  - **PROFILE** — client's body stats and fitness profile; equipment shown as a clean line-by-line list
- **MESSAGE button** on the client detail header — opens a direct conversation with the client in one tap

### Plan Proposals (Trainer → Client)
- Trainer edits client's plan inline and taps "PROPOSE CHANGES"
- A message is sent to the client containing a full plan preview
- Client sees ACCEPT / DECLINE buttons in the conversation
- Accepting replaces their active plan; declining leaves it unchanged
- Push notification sent to client on proposal; to trainer on response

### Messaging
- In-app direct messaging between users and their trainer
- Real-time polling (1-second incremental `?since=` fetch for conversation thread; 5-second list refresh while on the messages screen)
- **Message status indicators** — sent (`✓`), delivered (`✓✓` grey), read (`✓✓` teal) shown on sent bubbles and in the conversation list preview
- Conversation list always shows the absolute latest message — updates instantly after sending without needing to leave and re-open
- Unread message badge on the home screen nav button
- **Smart notifications:** push banner suppressed when the app tab is in focus — a soft beep + short vibration is played instead; browser tab title flashes `💬 New message` if the user is on a different view. Banner notifications fire normally when the app is backgrounded
- Swipe left-to-right from the edge to go back in any conversation or detail view

### Push Notifications
- Web Push API with VAPID keys
- In-app permission banner on first use — native browser prompt only triggers on explicit "Enable" tap
- Notifications for: rest timer done, new message, trainer request, plan proposal, proposal response
- Push subscriptions stored per device; multiple devices supported per user

### Admin Panel
- Navigate to `/admin` — password prompt (matches `ADMIN_SECRET` env var)
- User list: username, email, role badge, log count, join date
- Delete any user (cascades: profile, plan, logs)
- Role selector: `user` / `trainer` / `admin`

### PWA
- Install to homescreen on iOS and Android
- Service worker for offline shell and push event handling
- Custom SVG favicon per route (red dumbbell for main app, purple shield for admin)

---

## Environment Variables

Add these in Vercel → Settings → Environment Variables, and in your local `.env`:

```env
DATABASE_URL=           # Neon PostgreSQL connection string
SMTP_HOST=              # e.g. smtp.gmail.com
SMTP_PORT=              # e.g. 587
SMTP_USER=              # e.g. admin@yourdomain.com
SMTP_PASS=              # App password (not your account password)
SMTP_FROM=              # From address shown to recipients
ADMIN_SECRET=           # Password for the /admin panel
VAPID_PUBLIC_KEY=       # Web Push public key (generate with web-push)
VAPID_PRIVATE_KEY=      # Web Push private key
VAPID_SUBJECT=          # e.g. mailto:admin@yourdomain.com
```

> Generate VAPID keys: `npx web-push generate-vapid-keys`

> **SMTP note:** using Google Workspace. SPF and DKIM are configured on the sending domain.

---

## Local Development

```bash
git clone https://github.com/Maaiz47/Workoutapp.git
cd Workoutapp
npm install
cp .env.example .env        # fill in your values
npx prisma@5 db push        # sync schema to your database
npm run dev
```

> Always use `npx prisma@5` — the default `npx prisma` may resolve to v7 which has breaking changes.

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import into [vercel.com/new](https://vercel.com/new)
3. Add all environment variables (see table above)
4. Build command (already in `package.json`): `prisma db push && prisma generate && next build`
5. Deploy — the build command handles schema sync automatically

---

## Project Structure

```
app/
  page.tsx                        # Main app — all views (home, workout, progress, messages,
  |                               #   conversation, settings, customise, clientDetail)
  layout.tsx                      # Root layout — metadata, favicon, PWA head tags
  globals.css                     # Global styles, keyframe animations, utility classes
  admin/
    page.tsx                      # Admin panel UI
    layout.tsx                    # Admin metadata + favicon
  api/
    auth/route.ts                 # Session · register · login · reset · logout
    auth/forgot/route.ts          # Send temp password email
    profile/route.ts              # GET / POST / PATCH user profile + goals
    plan/route.ts                 # GET / POST (generate/init) / PUT (update day) / DELETE
    workout/route.ts              # GET / POST workout logs
    metrics/route.ts              # GET / POST body metrics
    metrics/[id]/route.ts         # DELETE / PATCH body metric
    messages/route.ts             # GET conversation list + unread count
    messages/[userId]/route.ts    # GET / POST messages in a thread
    plan-proposals/[id]/route.ts  # PATCH (accept/decline) plan proposal
    routines/route.ts             # GET / POST saved routines
    routines/[id]/route.ts        # DELETE / POST (restore) saved routine
    routines/[id]/share/route.ts  # POST share routine to another user
    trainer/search/route.ts       # GET search users by username
    trainer/request/route.ts      # POST send trainer request
    trainer/request/incoming/     # GET / PATCH incoming requests
    trainer/clients/route.ts      # GET accepted clients list
    trainer/clients/[clientId]/   # GET client detail (profile + history + plan)
    trainer/clients/[clientId]/proposal/route.ts  # POST propose plan change
    push/subscribe/route.ts       # POST save push subscription
    push/test/route.ts            # POST send test notification
    admin/route.ts                # GET / DELETE / PATCH user management

lib/
  prisma.ts             # Prisma client singleton
  crypto.ts             # scrypt password hashing
  email.ts              # Welcome + forgot password emails via Nodemailer
  exercises.ts          # 110+ exercise database + filterExercises()
  exerciseImages.ts     # Exercise ID → free-exercise-db image URL mapping (~110 exercises)
  formCues.ts           # Per-exercise form coaching cues (119 exercises, 2–3 cues each)
  muscleDetail.ts       # Sub-muscle targeting data (60+ exercises) for the anatomy diagram
  planGenerator.ts      # Rule-based plan generation from user profile
  workouts.ts           # Default 5-day PPL split data + types

prisma/
  schema.prisma         # Full schema — see models below

public/
  favicon.svg           # Main app tab icon (red dumbbell)
  admin-favicon.svg     # Admin tab icon (purple shield)
  admin-icon.svg        # Full-size admin panel icon
  icon-192.svg          # PWA homescreen icon
  manifest.json         # PWA manifest
  sw.js                 # Service worker (push events + rest timer notifications)
```

### Prisma Models

| Model | Purpose |
|---|---|
| `User` | Auth, role, relations |
| `UserProfile` | Body stats, goals, fitness profile |
| `WorkoutPlan` | One per user; container for plan days |
| `PlanDay` | A single training day with ordered exercises |
| `PlanExercise` | Exercise entry within a plan day — includes `groupId`, `groupType`, `dropSets` |
| `WorkoutLog` | Completed session — sets JSON, duration, date |
| `SavedRoutine` | Named plan snapshot; shareable between users |
| `Message` | Direct message; supports text and plan_proposal types; `read` + `delivered` boolean fields for status indicators |
| `PlanProposal` | Trainer-proposed plan change; linked to a Message |
| `TrainerRequest` | Pending trainer → user connection request |
| `TrainerClient` | Accepted trainer–client relationship |
| `PushSubscription` | Web Push endpoint per device |
| `BodyMetric` | Weight + body fat % log entry |

---

## Roadmap

See `ROADMAP.md` for the full future feature plan. See `PATCHLOG.md` for the full history.

**Recently shipped:**
- ✅ Animations & visual polish (view transitions, LOG SET flash, PB celebration, rest timer ring, workout complete overlay, progress bar grow, onboarding slides, nav bounce)
- ✅ Equipment filtering (`requireAll` flag — bench press no longer appears for dumbbell-only users)
- ✅ Home equipment expansion (treadmill, elliptical, multi-gym with sub-options)
- ✅ Bodyweight weight toggle
- ✅ Trainer plan generation (harder plan, review before proposing)
- ✅ Message delivery/read/sent status with live tick upgrades
- ✅ Smart in-app notification suppression (soft beep + tab flash instead of OS banner)
- ✅ Mobile UX polish (rest timer scroll lock, `100dvh`, safe-area insets, tap highlight removal)

| Blocked item | Reason |
|---|---|
| AI-powered plan generator | Anthropic billing unavailable as of May 2026 |
| DMARC DNS record | Dhiraagu registrar portal access |
