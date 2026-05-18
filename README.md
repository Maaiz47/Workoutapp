# IRONLOG — Gym Workout Tracker

A full-stack PWA workout tracker. Log sets, track progress, get a personalised training plan, connect with a trainer, and manage everything from a clean mobile-first UI.

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

### Auth
- Multi-step login: username → register / setup / login depending on account state
- Login accepts **username or email**
- Passwords hashed with `scrypt` (Node built-in `crypto`, no external package)
- Forgot password → temp password emailed → must-reset screen on next login
- Welcome email sent on new account registration

### Workout Tracking
- Per-set weight + reps logging with ± steppers
- Rest countdown timer with audio beep and push notification
- Session elapsed timer
- Comparison indicators on every set: **vs previous set** and **vs last session**
- Warmup / cardio rows: tap to mark done, no data entry required
- Active workout persists across navigation — leave to home, message, check progress, return anytime

### Session Persistence
- In-progress workouts saved to `localStorage` continuously
- Active workout highlighted on home screen with live timer; other days greyed out
- Tap the active card to resume; tap "← Home" during workout to return without losing session
- Finish review overlay: editable duration, total sets logged, confirm before saving
- Edit any logged set mid-session via a dedicated overlay

### Home Screen
- Active workout card shows live elapsed timer and "TAP TO RESUME →" when a session is in progress
- Greyed-out cards prevent accidentally starting a second session
- Notification permission banner (in-app) shown on first visit — "Not now" dismisses persistently

### Personalised Plan
- 8-step onboarding questionnaire for new users: days per week, goals, fitness level, location, equipment, gender, DOB, body metrics
- **Multiple goals** supported — select any combination of Build Muscle, Get Stronger, Lose Fat, General Fitness
- Rule-based plan generator produces a custom split — no AI API required
  - 2d → Full Body · 3d → PPL or Full Body ×3 · 4d → Upper/Lower · 5d → PPL · 6d → PPL ×2
  - Blends sets/reps/rest across all selected goals (e.g. Muscle + Fat Loss → moderate reps, shorter rest)
  - Primary goal (strength > muscle > fat_loss > fitness) drives split type; Fat Loss adds cardio finishers
  - Pulls from 110+ exercise database tagged by muscle, equipment, location, and goal
- Existing users (have workout history) skip onboarding and keep their prior plan

### Split Customisation
- CUSTOMISE button opens a plan overview of all training days
- Per-day editor: reorder exercises (↑↓), remove, and add from the full exercise browser
- Searchable exercise browser (110+ exercises, filtered live by name)
- Changes saved to database instantly; reflected in the workout view

### Saved Routines
- Save the current plan under any custom name as a snapshot
- Restore any saved routine at any time (replaces active plan)
- Share a routine to any user by exact username — appears in their saved routines with attribution
- List is collapsed by default to prevent accidental restores; count badge shows how many are saved

### Muscle Diagram
- Anatomical SVG body diagram (front + back view) rendered entirely in-app — no images
- Every muscle group drawn with bezier-curve paths matching real anatomy: pec fan, lat triangle, deltoid heads, bicep/tricep heads, VMO teardrop, etc.
- Fiber direction lines overlay each muscle to show grain and pennation angle
- **Sub-muscle zone detail:** per-exercise targeting data (e.g. "Upper Chest", "Lateral Delt", "Long Head") shown as a labelled legend below the diagram
- Zones rendered in three layers: dim background → orange secondary → red primary with glow
- Covers 60+ exercises via `lib/muscleDetail.ts`; fallback derivation for exercise names not in the exercise library

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
- Client detail view (3 tabs):
  - **SPLIT** — view the client's current plan; trainers can edit exercises inline and propose changes
  - **HISTORY** — full session log; tap any session to see every exercise logged vs skipped, with weight × reps per set
  - **PROFILE** — client's body stats and fitness profile

### Plan Proposals (Trainer → Client)
- Trainer edits client's plan inline and taps "PROPOSE CHANGES"
- A message is sent to the client containing a full plan preview
- Client sees ACCEPT / DECLINE buttons in the conversation
- Accepting replaces their active plan; declining leaves it unchanged
- Push notification sent to client on proposal; to trainer on response

### Messaging
- In-app direct messaging between users and their trainer
- Real-time polling (1-second incremental `?since=` fetch)
- Unread message badge on the home screen
- Push notifications for new messages (when app is backgrounded)
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
    metrics/[id]/route.ts         # DELETE body metric
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
| `PlanExercise` | Exercise entry within a plan day |
| `WorkoutLog` | Completed session — sets JSON, duration, date |
| `SavedRoutine` | Named plan snapshot; shareable between users |
| `Message` | Direct message; supports text and plan_proposal types |
| `PlanProposal` | Trainer-proposed plan change; linked to a Message |
| `TrainerRequest` | Pending trainer → user connection request |
| `TrainerClient` | Accepted trainer–client relationship |
| `PushSubscription` | Web Push endpoint per device |
| `BodyMetric` | Weight + body fat % log entry |

---

## Roadmap

| Item | Status |
|---|---|
| Swap rule-based plan generator → Claude API | Blocked: Anthropic credits |
| DMARC DNS record for revtech.com.mv | Blocked: Dhiraagu registrar access |
| Animated workout-type icons (per-split muscle explode) | Not started |
| Exercise form demo GIFs | Done — JPG start/end animation added in Patch 21 |

See `PATCHLOG.md` for full history.
