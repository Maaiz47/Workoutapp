# IRONLOG — Patch Log

---

## Patch 3 · 2026-05-16
**Full Password Auth System + Label Clarity**

### Password authentication
- New users must now register with an email and password — username alone no longer grants access
- Auth flow is multi-step: enter username → then register / set up / log in depending on account state
  - `new` → register screen (email + password + confirm)
  - `needs-setup` → setup screen (existing user with no password yet — email + new password + confirm)
  - `has-password` → login screen (password entry + forgot password link)
- Passwords hashed with `scrypt` via Node built-in `crypto` (no external package) — `lib/crypto.ts`

### Forgot password flow
- "Forgot password?" link on the login step sends a temporary password to the user's registered email
- Temp password is generated randomly, hashed and stored, and `mustResetPassword` flag is set
- Email sent via Nodemailer (SMTP config via env vars); if SMTP not configured, temp password is logged to server console
- Email not found → still returns success to prevent email enumeration
- New API route: `app/api/auth/forgot/route.ts`

### Must-reset password screen
- After logging in with a temp password, the user is shown a full-screen "Set a new password" prompt before accessing the app
- Enforced client-side via `mustResetPassword` state; once reset, the flag is cleared in the database
- Reset via `PUT /api/auth` (requires active session cookie)

### Schema changes
- `prisma/schema.prisma`: added `email String? @unique`, `passwordHash String?`, `mustResetPassword Boolean @default(false)` to `User` model
- Run `prisma db push` to apply to existing database

### Label clarity — "vs last session"
- All comparison tags and reference labels updated to say "vs last session" / "Last session:" / "= last session" instead of "vs last" / "Last best:" / "= last best"
- Makes it immediately clear the reference is from the previous time that day was trained, not the current session

### Dependencies
- Added `nodemailer ^6.9.0` to `package.json`; run `npm install` to pick it up
- `lib/email.ts`: graceful fallback if `nodemailer` not installed or SMTP not configured

---

## Patch 2 · 2026-05-16
**Session Persistence, Finish Review & Edit Sets**

### localStorage session save
- In-progress workouts are now saved to `localStorage` under the key `ironlog-session` on every set logged and on workout start
- On login, if a saved session is found for the current user, a resume prompt appears showing how long ago the session started (e.g. "Resume Push Day — Heavy session started 12m ago?")
- Resuming restores all logged sets and restarts the session timer from the original start time so elapsed time is accurate
- Quitting (abandon) or finishing always clears the saved session

### Finish review overlay
- Replaced native browser `confirm()` dialogs on save with a full-screen review overlay
- Overlay shows the session duration in an editable field — user can correct it if the session was left open or paused before finishing (e.g. forgot to press finish)
- Shows total sets logged before confirming
- Cancelling returns to the workout without losing any data

### Edit set feature
- An **EDIT** button appears in the top-right of each exercise row once at least one set has been logged
- Tapping EDIT opens a full-screen overlay showing every logged set for that exercise with ± steppers for weight and reps
- Changes are saved back to the session log and localStorage on confirm
- Designed to prevent misclicks: button is small, requires deliberate tap, and has a separate overlay rather than inline editing

---

## Patch 1 · 2026-05-16
**UI Fixes, Set Comparisons & Warmup Improvements**

### Layout fix — portrait overflow
- Weight and reps stepper buttons reduced from 40px → 34px wide, 48px → 42px tall
- Input fields given `minWidth: 0` so they compress correctly in portrait mode without horizontal scrolling
- Both columns use `flex: 1` with proper overflow constraints

### Set difference indicators
- The log set panel now shows comparison tags below weight and reps inputs:
  - **vs S{n}** — difference from the previous set in the current session (shown from set 2 onwards, even on first-ever session)
  - **vs last** — difference from the max weight/reps recorded in the most recent previous session for that day
- Last session reference now correctly uses the **max** value across all sets in that session rather than the first stored value

### Last session reference label
- Renamed from "Last:" to "Last best:" to clarify it reflects the best set of the previous session, not any individual set

### Instruction hint
- Added subtle italic hint "Tap an exercise to log a set" below the session timer on the active workout screen

### Warmup / cardio exercises
- Non-trackable exercises (warmup, cardio rows) now show "TAP TO MARK DONE" label
- Tapping anywhere on the row toggles a ✓ done state and dims the row to 30% opacity
- No data entry required

---

## v1.0 · Initial Build
**Full-stack PWA workout tracker**

- Next.js 14 app with Prisma + PostgreSQL backend
- 5-day PPL split (Push Heavy, Pull Width, Legs, Push Volume, Pull Thickness)
- Per-set weight and reps logging with ± steppers and last-session pre-fill
- Session timer (elapsed) and rest countdown timer with audio beep + push notification on rest completion
- Progress screen: 28-day activity calendar, weekly streak, average session time, personal records dashboard
- Per-exercise analytics: avg weight, avg reps, PB, weight trend mini-chart, session-over-session trend indicators
- Full session history with delete per session
- Cookie-based auth (find-or-create by username, 1-year session)
- PWA manifest, service worker, install-to-homescreen support
