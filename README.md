# IRONLOG — Gym Workout Tracker

A full-stack PWA workout tracker. Log sets, track progress, get a personalised training plan, and manage everything from a clean mobile-first UI.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| ORM | Prisma v5 |
| Auth | Cookie-based (`ironlog-uid`, httpOnly, 1-year) |
| Email | Nodemailer via Google Workspace SMTP |
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
- Instruction hint: "Tap an exercise to log a set"

### Session Persistence
- In-progress workouts saved to `localStorage` continuously
- Resume overlay on return: shows workout name and time elapsed since session started
- Finish review overlay: editable duration field, total sets logged, confirm before saving
- Edit any logged set mid-session: ± steppers per set in a dedicated overlay

### Personalised Plan
- 8-step onboarding questionnaire for new users: days per week, goal, fitness level, location, equipment, gender, DOB, body metrics
- Rule-based plan generator produces a custom split — no AI API required
  - 2d → Full Body · 3d → PPL or Full Body ×3 · 4d → Upper/Lower · 5d → PPL · 6d → PPL ×2
  - Adjusts sets/reps/rest per goal (strength / hypertrophy / fat loss / endurance) and fitness level
  - Pulls from 110+ exercise database tagged by muscle, equipment, location, and goal
- Existing users (have workout history) skip onboarding and keep their prior plan

### Split Customisation
- CUSTOMISE button opens a plan overview of all training days
- Per-day editor: reorder exercises (↑↓), remove, and add from the full exercise browser
- Searchable exercise browser (110+ exercises, filtered live by name)
- Changes saved to database instantly; reflected in the workout view

### Progress
- 28-day activity calendar
- Weekly streak and average session time
- Personal records dashboard per exercise
- Per-exercise analytics: avg weight, avg reps, PB, weight trend chart
- Full session history with delete per session

### Admin Panel
- Navigate to `/admin` — password prompt (matches `ADMIN_SECRET` env var)
- User list: username, email, role badge, log count, join date
- Delete any user (cascades: profile, plan, logs)
- Role selector: `user` / `trainer` / `admin` (foundation for upcoming trainer system)

### PWA
- Install to homescreen on iOS and Android
- Service worker for offline shell
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
```

> **SMTP note:** using Google Workspace. SPF and DKIM are configured on the sending domain. DMARC record pending.

---

## Local Development

```bash
git clone https://github.com/Maaiz47/Workoutapp.git
cd Workoutapp-main
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
4. Set build command to:
   ```
   npx prisma@5 generate && next build
   ```
5. Deploy — database schema is pushed separately via `npx prisma@5 db push` from local

---

## Project Structure

```
app/
  page.tsx              # Main app — all views (home, workout, progress, auth, onboarding, customise)
  layout.tsx            # Root layout — metadata, favicon, PWA head tags
  admin/
    page.tsx            # Admin panel UI
    layout.tsx          # Admin metadata + favicon
  api/
    auth/route.ts       # GET session · POST (check/register/setup/login) · PUT reset · DELETE logout
    auth/forgot/        # POST — send temp password email
    profile/route.ts    # GET/POST user profile
    plan/route.ts       # GET/POST/PUT workout plan
    logs/route.ts       # GET/POST workout logs
    admin/route.ts      # GET/DELETE/PATCH user management

lib/
  prisma.ts             # Prisma client singleton
  crypto.ts             # scrypt password hashing
  email.ts              # Welcome + forgot password emails via Nodemailer
  exercises.ts          # 110+ exercise database + filterExercises()
  planGenerator.ts      # Rule-based plan generation from user profile
  workouts.ts           # Default 5-day PPL split data + types

prisma/
  schema.prisma         # User, UserProfile, WorkoutPlan, PlanDay, PlanExercise, WorkoutLog

public/
  favicon.svg           # Main app tab icon (red dumbbell)
  admin-favicon.svg     # Admin tab icon (purple shield, tab-optimised)
  admin-icon.svg        # Full-size admin panel icon (login screen + header)
  icon-192.svg          # PWA homescreen icon
  manifest.json         # PWA manifest
  sw.js                 # Service worker
```

---

## Roadmap

| Patch | Feature |
|---|---|
| 6 | Trainer system — trainer/user roles, adopt clients, view client progress |
| 7 | In-app trainer–user messaging |
| 8 | GIF exercise icons, body measurement graphs |
| — | Swap rule-based plan generator → Claude API (blocked: Anthropic credits) |
| — | DMARC DNS record (blocked: Dhiraagu registrar access) |

See `PATCHLOG.md` for full history of what was built and when.
