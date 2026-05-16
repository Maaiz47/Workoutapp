# IRONLOG — Patch Log

---

## Environment Variables (Vercel + local `.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USER` | SMTP login (e.g. `admin@revtech.com.mv`) |
| `SMTP_PASS` | SMTP app password |
| `SMTP_FROM` | From address shown to recipients |
| `ADMIN_SECRET` | Password for `/admin` panel |

SMTP is via Google Workspace (`admin@revtech.com.mv`). SPF and DKIM are set up. DMARC record pending — to be added at Dhiraagu (domain registrar for revtech.com.mv).

---

## Upcoming — Roadmap

| Patch | Feature | Blocked by |
|---|---|---|
| — | Swap rule-based plan generator → Claude API | Anthropic checkout unavailable |
| — | DMARC DNS record for revtech.com.mv | Dhiraagu portal access |
| 6 | Trainer system: trainer/user roles, adopt users, view client progress | — |
| 7 | In-app trainer–user messaging | Patch 6 |
| 8 | GIF exercise icons, body measurement graphs, username system | — |

---

## Patch 6-prep · 2026-05-16
**Admin Panel + Icons**

### Admin panel at `/admin`
- Password-protected admin interface; navigate directly to `/admin` in the browser — no link from the app
- Login prompt accepts the `ADMIN_SECRET` env var value; key is sent as `x-admin-key` header on all API calls
- Unauthenticated requests return 401

### User management features
- **User list** — username, email, role badge, workout log count, join date
- **Delete user** — removes user and all cascaded data (profile, plan, logs); requires browser confirmation dialog
- **Role selector** — inline dropdown changes role (`user` / `trainer` / `admin`) instantly
- **Stats row** — total users, total workout logs, trainer count

### New API: `app/api/admin/route.ts`
- `GET /api/admin` — full user list with log counts
- `DELETE /api/admin` — delete user by `userId`
- `PATCH /api/admin` — update `role` field

### Schema change
- Added `role String @default("user")` to `User` model
- Applied via `npx prisma@5 db push`
- `role` is the foundation for the Patch 6 trainer system

### Icons
- `public/admin-icon.svg` — full-size admin panel icon: dark background, purple gradient shield, key symbol, circuit trace corner details. Used on the login screen (88px) and panel header (48px)
- `public/admin-favicon.svg` — simplified version of the above, optimised for browser tab size (64×64 viewBox, bolder strokes)
- `public/favicon.svg` — Ironlog browser tab icon: chunky red dumbbell on dark background, designed to read cleanly at 16–32px
- Main app layout (`app/layout.tsx`) references `favicon.svg`
- Admin layout (`app/admin/layout.tsx`) references `admin-favicon.svg` and sets page title to "Admin — Ironlog"

---

## Patch 5 · 2026-05-16
**Split Customisation — Add / Remove / Reorder Exercises**

### Per-day exercise editor
- CUSTOMISE button on the home screen opens a plan overview showing all days
- Tapping a day opens a full exercise editor with up/down reorder arrows, remove buttons, and an exercise browser
- Changes saved to the database via `PUT /api/plan`; reflected immediately in the workout view

### Exercise browser
- Searchable list of all 110+ exercises in the database, filtered live by name
- Selecting an exercise appends it to the bottom of the day's list

### Plan adapter
- `planDayToWorkoutDay()` in `app/page.tsx` converts database `PlanDay` records into the `WorkoutDay` type used by the workout view — customised plans render identically to the defaults

### API: `PUT /api/plan`
- Accepts `{ dayId, exercises[] }`, atomically deletes and recreates all `PlanExercise` rows for that day in the new order

### Type fixes (`lib/workouts.ts`)
- Added `type?: "main" | "warmup" | "cardio"` and `name` to `Section` type
- Added `subtitle?` and made `day?` optional on `WorkoutDay` — required for plan adapter compatibility

---

## Patch 4 · 2026-05-16
**Onboarding Questionnaire + Personalised Plan Generation**

### 8-step onboarding questionnaire
- New users (no workout history) are shown a questionnaire before accessing the app
- Steps: days per week → goal → fitness level → training location → equipment → gender → date of birth → body metrics (height, weight, optional body fat %)
- Existing users (have at least one workout log) skip the questionnaire and see their prior plan unchanged
- Detection: checks `WorkoutLog` count for the user; zero logs = new user flow

### Rule-based plan generator (`lib/planGenerator.ts`)
- Generates a fully custom workout plan from the user's profile — no AI API call needed
- Split logic: 2d → Full Body, 3d → PPL or Full Body ×3, 4d → Upper/Lower, 5d → PPL, 6d → PPL ×2
- Pulls exercises from `lib/exercises.ts` filtered by location, available equipment, and training goal
- Adjusts sets, reps, and rest per goal (strength / hypertrophy / fat loss / endurance / general) and fitness level
- Output format matches the intended Claude API response shape — swap is a drop-in replacement once API credits are available

### Exercise database (`lib/exercises.ts`)
- 110+ exercises tagged: primary/secondary muscles, equipment[], location (gym/home/both), difficulty, type, goals[]
- `filterExercises()` helper for querying by any combination of tags

### New Prisma models
- `UserProfile` — dob, gender, height, weight, body fat %, goal, fitness level, location, equipment[], daysPerWeek
- `WorkoutPlan` — one per user; contains ordered `PlanDay` records
- `PlanDay` — dayIndex, title, subtitle, focus string; links to `PlanExercise[]`
- `PlanExercise` — exerciseId, name, sets, reps, rest, notes, order

### New API routes
- `GET /api/profile` — fetch current user's profile
- `POST /api/profile` — upsert profile (used at onboarding completion)
- `GET /api/plan` — fetch plan with all days and exercises
- `POST /api/plan` — two modes:
  - `{ action: "init" }` → creates plan from `WORKOUT_DATA` defaults (preserves original day IDs so workout history still matches)
  - No action body → generates from profile using `planGenerator`

---

## Patch 3 · 2026-05-16
**Full Password Auth System + Email + Resume Overlay**

### Multi-step auth flow
- Auth is now multi-step: enter username/email → screen adapts based on account state
  - `new` → register screen (email + password + confirm) — sends welcome email on success
  - `needs-setup` → setup screen (existing username-only account — add email + new password + confirm)
  - `has-password` → login screen (password entry + forgot password link)
- Passwords hashed with `scrypt` via Node built-in `crypto` — no external package (`lib/crypto.ts`)
- Login accepts **username or email** — if input contains `@`, email lookup is tried first

### Forgot password flow
- "Forgot password?" on the login step emails a randomly generated temporary password
- Temp password is hashed and stored; `mustResetPassword` flag is set on the user
- Email not found → still returns success (prevents email enumeration)
- API route: `app/api/auth/forgot/route.ts`

### Must-reset password screen
- After logging in with a temp password, user sees a full-screen "Set a new password" prompt before the app loads
- Reset via `PUT /api/auth`; clears `mustResetPassword` in the database on success

### Email system (`lib/email.ts`)
- Fully rewritten with proper HTML email structure: DOCTYPE, `<table>` layout, inline styles (Gmail-compatible)
- Plain-text fallback included on every email for spam filter compliance
- **Welcome email** — sent automatically on new account registration; includes username and app link
- **Forgot password email** — sends temp password with instructions to reset on login
- SMTP via Google Workspace (`admin@revtech.com.mv`); configured via env vars
- Graceful fallback: if SMTP not configured, temp password is logged to server console instead of crashing

### Resume workout overlay
- If the app is opened with a saved session in `localStorage`, a full-screen overlay appears (instead of a silent resume)
- Overlay shows the workout name and how long ago the session started (e.g. "Push Day — Heavy · started 42 min ago")
- Single "GOT IT" button accepts the resume and navigates to the workout
- Quitting or finishing a workout always clears the saved session

### Schema changes
- `User`: added `email String? @unique`, `passwordHash String?`, `mustResetPassword Boolean @default(false)`

### Label clarity — "vs last session"
- All comparison labels updated from "vs last" / "Last best:" to "vs last session" / "Last session:"
- Clarifies the reference is the most recent previous session for that specific day

### Dependencies
- Added `nodemailer ^6.9.0` — run `npm install` after pulling

---

## Patch 2 · 2026-05-16
**Session Persistence, Finish Review & Edit Sets**

### localStorage session save
- In-progress workouts saved to `localStorage` (`ironlog-session`) on every set logged and on start
- On login, saved session is detected and resume overlay shown (see Patch 3 for overlay details — original was a browser prompt, replaced in Patch 3)
- Resuming restores all logged sets and restarts the timer from the original start time
- Quitting (abandon) or finishing always clears the saved session

### Finish review overlay
- Replaced native `confirm()` dialogs with a full-screen review overlay on save
- Overlay shows session duration in an editable field — user can correct it if the session was left open
- Shows total sets logged before confirming
- Cancelling returns to the workout without data loss

### Edit set feature
- EDIT button appears in the top-right of each exercise row once at least one set has been logged
- Opens a full-screen overlay showing all logged sets with ± steppers for weight and reps
- Saves back to session log and localStorage on confirm

---

## Patch 1 · 2026-05-16
**UI Fixes, Set Comparisons & Warmup Improvements**

### Layout fix — portrait overflow
- Stepper buttons reduced: 40px → 34px wide, 48px → 42px tall
- Input fields given `minWidth: 0` so they compress correctly in portrait without horizontal scroll
- Both columns use `flex: 1` with overflow constraints

### Set difference indicators
- Log set panel shows comparison tags below weight and reps:
  - **vs S{n}** — difference from the previous set in the current session (from set 2 onwards)
  - **vs last session** — difference from the max weight/reps in the most recent prior session for that day
- Last session reference uses the **max** value across all sets (not the first stored value)

### Warmup / cardio exercises
- Non-trackable exercises show "TAP TO MARK DONE"
- Tapping toggles a ✓ done state and dims the row to 30% opacity

### Instruction hint
- Subtle italic hint "Tap an exercise to log a set" below the session timer

---

## v1.0 · Initial Build
**Full-stack PWA workout tracker**

- Next.js 14 app with Prisma + PostgreSQL (Neon) backend
- 5-day PPL split: Push Heavy, Pull Width, Legs, Push Volume, Pull Thickness (`lib/workouts.ts`)
- Per-set weight and reps logging with ± steppers and last-session pre-fill
- Session timer (elapsed) and rest countdown timer with audio beep + push notification on rest completion
- Progress screen: 28-day activity calendar, weekly streak, average session time, personal records dashboard
- Per-exercise analytics: avg weight, avg reps, PB, weight trend mini-chart, session-over-session trend indicators
- Full session history with delete per session
- Cookie-based auth (`ironlog-uid`, 1-year, httpOnly) — find-or-create by username
- PWA manifest, service worker, install-to-homescreen support
