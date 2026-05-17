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
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | e.g. `mailto:admin@revtech.com.mv` |

SMTP is via Google Workspace (`admin@revtech.com.mv`). SPF and DKIM are set up. DMARC record pending — Dhiraagu registrar access required.

Generate VAPID keys: `npx web-push generate-vapid-keys`

---

## Upcoming — Roadmap

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic checkout unavailable |
| DMARC DNS record for revtech.com.mv | Dhiraagu portal access |
| GIF exercise demo icons | — |

---

## Patch 17 · 2026-05-17
**Multi-Goal Selection + Body Data Sync**

### Multiple goals
- Onboarding step 3 and Settings → BODY & STATS now allow selecting **multiple goals** simultaneously (Build Muscle, Get Stronger, Lose Fat, General Fitness)
- Tap to toggle — any combination is valid; checkmark shows selected state
- Plan generator blends volume parameters (sets, reps, rest) across all selected goals using an average: e.g. Muscle + Fat Loss → 3-4 sets, 10–16 reps, 60s rest
- Primary goal (priority: strength > muscle > fat_loss > fitness) determines the split type (PPL / Upper-Lower / Full Body)
- Fat Loss anywhere in goals adds cardio finishers to push and full-body days
- `UserProfile` stores `goals String[]` alongside legacy `goal String` — existing users retain their data; plan generation reads `goals[]` with `goal` fallback

### Body data sync (linked inputs)
- **Log in Progress → Body tab** → also updates `UserProfile.weightKg` and `bodyFatPct` (Settings reflects the latest value immediately)
- **Save in Settings → BODY & STATS** → also creates a `BodyMetric` entry if weight or body fat changed (Progress history updates automatically)
- Both directions keep the two screens in sync — only one source of truth

### Schema change
- `UserProfile`: added `goals String[]` field

---

## Patch 16 · 2026-05-17
**Personal Bests — Renamed + Reps Display**

- Renamed "PERSONAL RECORDS" → "PERSONAL BESTS" on the progress dashboard
- Each entry now shows the best weight **and** the rep count achieved at that weight (e.g. `80kg × 8 reps`)
- Tie-breaking: if two sessions share the same top weight, the one with more reps wins
- `getOverallStats` updated to store `reps` in `exercisePRs`

---

## Patch 15 · 2026-05-17
**Personal Bests — Renamed + Reps Display**

- Renamed "PERSONAL RECORDS" → "PERSONAL BESTS" on the progress dashboard
- Each entry now shows the best weight **and** the rep count achieved at that weight (e.g. `80kg × 8 reps`)
- Tie-breaking updated: if two sessions share the same top weight, the one with more reps is recorded as the best
- `getOverallStats` updated to store `reps` in `exercisePRs` alongside `weight` and `date`

---

## Patch 14 · 2026-05-17
**Client History — Tappable Sessions with Exercise Detail**

- Each session card in the trainer's client HISTORY tab is now tappable
- Tapping expands the card inline to show every exercise from the client's plan day:
  - Logged exercises show each set: `S1 80kg×8  S2 75kg×6`
  - Exercises the client skipped show a **SKIPPED** badge in red
- Card header shows `X/Y exercises` count — amber if incomplete, teal if all done
- Collapse by tapping again; smooth `›` chevron rotation indicates state

---

## Patch 13 · 2026-05-17
**Saved Routines + Routine Sharing**

### Saved routines
- New **SAVED ROUTINES** section on the home screen (below the split cards)
- `+ SAVE` button saves the current plan under a custom name as a point-in-time snapshot
- List is **collapsed by default** — tap the header to expand; count badge shows total saved
- Collapsed state prevents accidental restores
- **RESTORE** replaces the active plan with the saved snapshot (confirm dialog)
- **✕** deletes the saved routine

### Routine sharing
- Each routine has a `↗` share button
- Tap it to open an inline username field — enter an exact username and hit SEND
- The routine is copied into that user's saved routines with "from @sender" attribution shown in teal
- Recipient can restore or delete the shared routine like any other

### New schema model
- `SavedRoutine`: `id`, `userId`, `name`, `planJson Json`, `sharedBy String?`, `createdAt`

### New API routes
- `GET /api/routines` — list user's saved routines
- `POST /api/routines` — save snapshot (`{ name, days }`)
- `DELETE /api/routines/[id]` — delete
- `POST /api/routines/[id]` — restore into active plan (replaces WorkoutPlan in a transaction)
- `POST /api/routines/[id]/share` — copy routine to another user by username

---

## Patch 12 · 2026-05-17
**Editable Profile in Settings**

- New **BODY & STATS** card in Settings / Account view
- Collapsed state shows a 6-cell stats grid: weight, height, body fat %, age, goal, days/week
- Tap EDIT to expand a full form with inputs for:
  - Weight (kg), Height (cm), Body Fat (%), Date of Birth
  - Gender, Goal, Fitness Level, Days per week (pill selectors)
- Saving calls `POST /api/profile` and updates `UserProfile` in the database
- Form pre-fills from the existing profile fetched on mount

---

## Patch 11 · 2026-05-17
**Active Workout Persistence + UX Fixes**

### Leave workout and return
- Users can now leave an active workout at any time via `← Home` in the workout header
- Session state (started, log, timer) is preserved in component state — returning to the workout view resumes seamlessly
- A separate `QUIT ×` button in the workout header abandons the session with confirmation

### Home screen active card
- The active workout day card gets a coloured border, **ACTIVE** badge, and live elapsed timer
- Other workout cards are dimmed to 30% opacity and non-tappable during an active session
- Session restore on page reload stays on home — user sees the active card, taps to resume

### Notification permission flow (fixed)
- In-app banner (teal card) shown on first visit for users who haven't granted/denied permission
- "Not now" dismisses persistently via `localStorage`; "ENABLE" triggers the native browser prompt
- Auth effects no longer call `subscribeToPush()` unconditionally — native prompt no longer appears on every page load
- `subscribeToPush()` is called silently only when permission is already `"granted"`

### MY CLIENTS always visible for trainers
- The MY CLIENTS section on the trainer's home screen now always renders even when there are no accepted clients
- Empty state: "No accepted clients yet"

### Swipe back navigation (widened)
- Swipe zone widened from 30px to 60px from the left edge for reliability on real devices
- Swipe-back supported in: conversation, messages, clientDetail, progress, settings, workout (when started)

---

## Patch 10 · 2026-05-17
**Body Metrics Tracking**

### Logging and history
- New **Body** tab in the Progress screen
- Log weight (kg) and/or body fat % with an optional date; stored as `BodyMetric` records
- History list shows all entries in reverse chronological order with a delete button per entry

### Goals
- Set a target weight and target body fat % from the Body tab
- Stored on `UserProfile` via new `PATCH /api/profile` endpoint
- Progress bars show current vs target with percentage complete

### Trend chart
- Line chart rendered as an SVG showing the last 12 weight entries
- Min/max labels on Y axis; date labels on first and last points

### New schema additions
- `BodyMetric` model: `id`, `userId`, `date`, `weightKg Float?`, `bodyFatPct Float?`
- `UserProfile`: added `targetWeightKg Float?`, `targetBodyFatPct Float?`

### New API routes
- `GET /api/metrics` — list user's body metrics (last 200, newest first)
- `POST /api/metrics` — log a new entry (`{ weightKg?, bodyFatPct?, date? }`)
- `DELETE /api/metrics/[id]` — delete a metric entry (ownership verified)
- `PATCH /api/profile` — update goal targets only (`{ targetWeightKg?, targetBodyFatPct? }`)

---

## Patch 9 · 2026-05-17
**Plan Proposals (Trainer → Client)**

### Trainer workflow
- In the client detail SPLIT tab, trainer can tap **EDIT PLAN** to enter an inline editing mode
- Each day's exercises are shown with editable set/reps/rest fields
- **PROPOSE CHANGES** sends the edited plan to the client as a special message

### Client workflow
- Plan proposal arrives as a `plan_proposal` message in the conversation
- Full plan preview is shown: all days with their exercises
- **ACCEPT** and **DECLINE** buttons appear below the preview
- Accepting replaces the client's active `WorkoutPlan` (transactional — atomic swap)
- Declining leaves the current plan unchanged
- Both actions update the proposal `status` in the database

### Notifications
- Push notification sent to client when a proposal arrives
- Push notification sent to trainer when client accepts or declines

### New schema additions
- `PlanProposal` model: `id`, `trainerId`, `clientId`, `status`, `planJson Json`, timestamps
- `Message`: added `proposalId String?` linking a message to a `PlanProposal`

### New API routes
- `POST /api/trainer/clients/[clientId]/proposal` — create proposal and linked message
- `PATCH /api/plan-proposals/[id]` — accept or decline (`{ action: "accept" | "decline" }`)

---

## Patch 8 · 2026-05-17
**Push Notifications + VAPID**

### Web Push setup
- `web-push` npm package (dynamic import in API routes to avoid build-time errors)
- VAPID keys stored as env vars; service worker (`public/sw.js`) handles push events
- `PushSubscription` model stores endpoint + keys per device (multiple devices per user supported)

### In-app permission banner
- Teal banner shown on first app load when permission is `"default"` and not previously dismissed
- "ENABLE" button triggers the native browser permission prompt then saves the subscription
- "Not now" stores `ironlog-notif-dismissed` in `localStorage` and hides the banner permanently
- Enable button also available in Settings if dismissed earlier

### Notification triggers
- **Rest timer complete** — fires from the service worker rest countdown; works when app is backgrounded
- **New message** — sent server-side when a message is created
- **Trainer request** — sent to user when a trainer sends a request
- **Plan proposal** — sent to client when trainer proposes a plan change
- **Proposal response** — sent to trainer when client accepts or declines

### New API routes
- `POST /api/push/subscribe` — save or update a device's push subscription
- `POST /api/push/test` — send a test notification to the current user's devices

---

## Patch 7 · 2026-05-17
**In-App Messaging**

### Message model
- `Message`: `fromId`, `toId`, `body`, `type` (text / plan_proposal), `read`, `requestId?`, `proposalId?`

### Conversations list
- Messages view shows all conversation threads sorted by most recent
- Unread count badge on the home screen nav (red dot with count)

### Conversation thread
- Real-time polling: incremental `?since=` fetch every second for new messages
- Messages grouped by sender with timestamps
- Incoming messages marked as read on open
- `plan_proposal` message type renders a full plan preview with ACCEPT / DECLINE buttons

### Swipe back
- Swipe right from the left edge to navigate back from a conversation to the messages list
- Same gesture works in client detail, progress, settings, and workout views

### New API routes
- `GET /api/messages` — list conversation threads with last message and unread count
- `GET /api/messages/[userId]` — thread with a specific user (supports `?since=` incremental)
- `POST /api/messages/[userId]` — send a message

---

## Patch 6 · 2026-05-17
**Trainer System**

### Role and upgrade
- Users can request a trainer role upgrade from Settings → TRAINER UPGRADE
- Upgrade is immediate (no approval required); role stored on `User.role`
- Trainer badge shown next to username on the home screen

### Finding clients
- Trainers can search for users by exact username via a search bar on the home screen
- Search results show username, workout count, and join date
- **SEND REQUEST** sends a `TrainerRequest` (pending → accepted)

### Client management
- Users see pending trainer requests in Settings and can ACCEPT or DECLINE
- Accepted clients appear in the **MY CLIENTS** section on the trainer's home screen
- Each client card shows workout count and last workout date; tap to open client detail

### Client detail view (3 tabs)
- **SPLIT** — client's current plan with all exercises per day; trainer can edit inline
- **HISTORY** — full session log; each session is tappable to see per-exercise detail
- **PROFILE** — client's body stats (age, weight, height, body fat %, goal, fitness level, location, equipment)

### New schema models
- `TrainerRequest`: `trainerId`, `userId`, `status` (pending/accepted/declined)
- `TrainerClient`: `trainerId`, `clientId` (unique — one trainer per client)

### New API routes
- `GET /api/trainer/search?q=` — find users by exact username
- `POST /api/trainer/request` — send a trainer request
- `GET /api/trainer/request/incoming` — list incoming requests for a user
- `PATCH /api/trainer/request/incoming` — accept or decline a request
- `GET /api/trainer/clients` — list accepted clients with stats
- `GET /api/trainer/clients/[clientId]` — client profile + history + plan

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

### Icons
- `public/admin-icon.svg` — full-size admin panel icon
- `public/admin-favicon.svg` — tab-optimised version
- `public/favicon.svg` — red dumbbell browser tab icon
- Admin layout (`app/admin/layout.tsx`) references `admin-favicon.svg`

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

### API: `PUT /api/plan`
- Accepts `{ dayId, exercises[] }`, atomically deletes and recreates all `PlanExercise` rows for that day in the new order

---

## Patch 4 · 2026-05-16
**Onboarding Questionnaire + Personalised Plan Generation**

### 8-step onboarding questionnaire
- New users (no workout history) are shown a questionnaire before accessing the app
- Steps: days per week → goal → fitness level → training location → equipment → gender → date of birth → body metrics
- Existing users (have at least one workout log) skip the questionnaire

### Rule-based plan generator (`lib/planGenerator.ts`)
- Generates a fully custom workout plan from the user's profile — no AI API call needed
- Split logic: 2d → Full Body, 3d → PPL or Full Body ×3, 4d → Upper/Lower, 5d → PPL, 6d → PPL ×2
- Pulls exercises from `lib/exercises.ts` filtered by location, equipment, and goal
- Adjusts sets, reps, and rest per goal and fitness level

### New Prisma models
- `UserProfile`, `WorkoutPlan`, `PlanDay`, `PlanExercise`

### New API routes
- `GET/POST /api/profile`, `GET/POST /api/plan`

---

## Patch 3 · 2026-05-16
**Full Password Auth System + Email + Resume Overlay**

### Multi-step auth flow
- Username → register / setup / login based on account state
- Passwords hashed with `scrypt` (Node built-in `crypto`)
- Login accepts username or email

### Forgot password flow
- Emails a randomly generated temporary password; `mustResetPassword` flag set
- Must-reset screen shown on next login before app loads

### Email system (`lib/email.ts`)
- HTML emails with plain-text fallback; Gmail-compatible inline styles
- Welcome email + forgot password email via Google Workspace SMTP

### Resume workout overlay
- Full-screen overlay if a saved session exists in `localStorage`
- Shows workout name and elapsed time; single "GOT IT" button to resume

### Schema changes
- `User`: added `email`, `passwordHash`, `mustResetPassword`

---

## Patch 2 · 2026-05-16
**Session Persistence, Finish Review & Edit Sets**

- In-progress workouts saved to `localStorage` on every set logged
- Finish review overlay: editable duration, total sets, confirm before saving
- Edit any logged set mid-session via a full-screen overlay with ± steppers

---

## Patch 1 · 2026-05-16
**UI Fixes, Set Comparisons & Warmup Improvements**

- Portrait overflow fix: stepper buttons and input fields constrained correctly
- Set comparison tags: vs previous set (within session) and vs last session
- Warmup / cardio exercises: tap to mark done, row dims to 30% opacity
- Instruction hint: "Tap an exercise to log a set"

---

## v1.0 · Initial Build
**Full-stack PWA workout tracker**

- Next.js 14 + Prisma + PostgreSQL (Neon)
- 5-day PPL split (Push Heavy, Pull Width, Legs, Push Volume, Pull Thickness)
- Per-set weight and reps logging with ± steppers and last-session pre-fill
- Session timer and rest countdown with audio beep + push notification
- Progress screen: 28-day calendar, weekly streak, avg session time, personal bests, exercise analytics
- Cookie-based auth (`ironlog-uid`, 1-year, httpOnly)
- PWA manifest, service worker, install-to-homescreen support
