# IRONLOG — Feature Roadmap

This file captures the intended design for upcoming patches in enough detail that a new session can implement them without re-clarifying requirements. Read alongside `PATCHLOG.md` (what's been built) and `README.md` (current architecture).

---

## Patch 6 — Trainer System

### Overview
Introduce two account types — `user` and `trainer`. Trainers can find users, send adoption requests, and once accepted, view that user's full progress and stats. Users receive and respond to adoption requests via a message/notification centre.

The `role` field already exists on the `User` model (`"user"` | `"trainer"` | `"admin"`) from Patch 6-prep. The admin panel can already promote any user to trainer.

---

### 6.1 — Account Type UI

**Upgrade to Trainer button (in profile/settings screen)**
- Users with `role === "user"` see an "Upgrade to Trainer" button in their profile
- Tapping it shows a confirmation screen explaining what trainer mode does
- On confirm, calls `PATCH /api/auth` (or a new `PATCH /api/profile/role`) to set `role = "trainer"`
- No downgrade path — trainer is a permanent upgrade (admin can revert via panel if needed)
- After upgrade, the UI switches to trainer mode immediately (new nav tabs, search visible)

**Trainer mode indicator**
- Trainers see a subtle badge or label on their profile ("Trainer Account")
- Home screen layout may differ slightly — trainer home shows their client list instead of their own workout plan (or shows both via tabs)

---

### 6.2 — Trainer Search & Adoption Requests

**User search (trainer only)**
- New "Clients" tab or section visible only to trainers
- Search bar to find users by username
- API: `GET /api/trainer/search?q=username` — returns matching users (id, username, role), excludes other trainers and already-adopted users
- Results show username + join date + workout log count (so trainer can see if user is active)

**Send adoption request**
- Trainer taps a user in search results → "Send Request" button
- API: `POST /api/trainer/request` with `{ targetUserId }` — creates a `TrainerRequest` record
- Request states: `pending` | `accepted` | `declined`
- A trainer cannot send duplicate requests to the same user while one is pending

**Trainer ↔ User relationship model (new Prisma models)**

```prisma
model TrainerRequest {
  id          String   @id @default(cuid())
  trainerId   String
  userId      String
  status      String   @default("pending")  // pending | accepted | declined
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  trainer     User     @relation("SentRequests",     fields: [trainerId], references: [id], onDelete: Cascade)
  user        User     @relation("ReceivedRequests", fields: [userId],    references: [id], onDelete: Cascade)

  @@unique([trainerId, userId])
  @@index([userId])
  @@index([trainerId])
}

model TrainerClient {
  id        String   @id @default(cuid())
  trainerId String
  clientId  String   @unique   // a user can only have one trainer
  createdAt DateTime @default(now())
  trainer   User     @relation("TrainerClients", fields: [trainerId], references: [id], onDelete: Cascade)
  client    User     @relation("ClientOf",       fields: [clientId],  references: [id], onDelete: Cascade)

  @@index([trainerId])
}
```

Add the corresponding relation fields to `User`:
```prisma
sentRequests     TrainerRequest[] @relation("SentRequests")
receivedRequests TrainerRequest[] @relation("ReceivedRequests")
trainerClients   TrainerClient[]  @relation("TrainerClients")
clientOf         TrainerClient?   @relation("ClientOf")
```

---

### 6.3 — Message Centre (Adoption Request Notifications)

**User-facing message centre**
- New "Inbox" / bell icon visible to all users
- Shows received adoption requests with trainer username, date, and Accept / Decline buttons
- Accept: creates `TrainerClient` record, updates `TrainerRequest.status = "accepted"`, sends confirmation
- Decline: updates `TrainerRequest.status = "declined"`
- Once accepted, user sees their trainer's name on the profile screen ("Your Trainer: @username")
- A user can only have one active trainer at a time

**Trainer-facing message centre**
- Trainers see sent requests with their current status (pending / accepted / declined)
- Accepted requests move the user into the trainer's client list

**API routes**
- `GET /api/trainer/requests` — trainer: list sent requests; user: list received requests (inferred from role)
- `PATCH /api/trainer/requests/[id]` — user accepts or declines (`{ action: "accept" | "decline" }`)
- `GET /api/trainer/clients` — trainer: list accepted clients with basic stats

---

### 6.4 — Trainer Views Client Progress

**Client list (trainer)**
- Each accepted client shown as a card: username, last active date, weekly log count, streak
- Tapping a client opens their full progress view (same as the user's own Progress screen)

**Progress data access**
- API: `GET /api/trainer/clients/[clientId]/logs` — returns workout logs for that client
- API: `GET /api/trainer/clients/[clientId]/stats` — returns PBs, streaks, activity calendar data
- Trainer can only access data for their own accepted clients — server validates `TrainerClient` relationship before returning any data

---

## Patch 7 — Trainer–User Direct Messaging

### Overview
In-app real-time (or near-real-time) messaging between a trainer and each of their accepted clients. Not a group chat — each trainer–client pair has a private thread.

### Data model

```prisma
model Message {
  id         String   @id @default(cuid())
  threadId   String
  senderId   String
  body       String
  createdAt  DateTime @default(now())
  readAt     DateTime?
  thread     MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  sender     User          @relation(fields: [senderId],  references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}

model MessageThread {
  id        String    @id @default(cuid())
  trainerId String
  clientId  String
  messages  Message[]
  createdAt DateTime  @default(now())
  trainer   User      @relation("TrainerThreads", fields: [trainerId], references: [id], onDelete: Cascade)
  client    User      @relation("ClientThreads",  fields: [clientId],  references: [id], onDelete: Cascade)

  @@unique([trainerId, clientId])
}
```

### API routes
- `GET /api/messages/[threadId]` — fetch messages for a thread (paginated, newest last)
- `POST /api/messages/[threadId]` — send a message `{ body }`
- `GET /api/messages` — list threads for the current user (trainer sees all client threads; user sees their trainer thread)
- Thread is auto-created when a client is accepted

### UI
- "Messages" tab in the nav (visible to both trainers and users who have an active trainer relationship)
- Trainer: list of client threads, unread count badge per thread
- User: single thread with their trainer
- Chat UI: scrollable message list, timestamp per message, sender label, text input + send button at bottom
- Unread indicator: messages without `readAt` are marked unread; set `readAt` on thread open

### Polling vs WebSockets
- Start with **polling** (`setInterval` every 5s when the chat screen is open) — no infrastructure changes needed, works on Vercel serverless
- WebSocket / SSE upgrade is a future optimisation if message volume justifies it

---

## Patch 8 — Polish & Media

### 8.1 — GIF Icons Per Workout Day

- Each of the 5 workout day cards on the home screen gets an animated GIF representing the focus
  - Push days: chest press / shoulder press movement
  - Pull days: row / pulldown movement
  - Leg day: squat movement
- GIFs stored in `public/gifs/` — e.g. `push.gif`, `pull.gif`, `legs.gif`
- Displayed in the day card header, likely as a small looping background or thumbnail (60–80px)
- For generated plans with custom splits, map the day `focus` string to the nearest GIF category

### 8.2 — GIF Icons Per Exercise

- Each exercise in the workout view shows a small looping GIF demonstrating the movement
- GIF shown in the exercise row (collapsed) and/or in the set logging panel (expanded)
- Naming convention: `public/gifs/exercises/[exerciseId].gif` — matches `exerciseId` from `lib/exercises.ts`
- Fallback: if no GIF exists for an exercise, show the exercise type icon (compound / isolation / cardio) as a static placeholder
- Source: likely a curated set of royalty-free exercise GIFs — to be decided when implementing

### 8.3 — Body Measurement History with Graphs

**Data model addition**
```prisma
model BodyMeasurement {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime @default(now())
  weightKg  Float
  bmi       Float?
  bodyFatPct Float?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
}
```

**Entry point**
- New section in the Progress screen: "Body Stats"
- "+ Log Measurement" button opens a sheet: date (defaults today), weight, optional body fat %
- BMI auto-calculated from weight + height stored in `UserProfile`

**Graphs**
- Weight over time — line chart, last 90 days
- BMI over time — line chart derived from logged weight + stored height
- Body fat % over time — line chart (only when data exists)
- Chart library: **recharts** (already common in Next.js projects, good mobile rendering) or a lightweight canvas-based alternative
- Data via `GET /api/measurements` — returns entries ordered by date

### 8.4 — Username System

**Context:** usernames already exist as the primary identifier (`User.username`). "Username system" here likely means one or more of:
- Allow users to **change** their username (currently set at registration and never editable)
- Display a **display name** separate from the login username (e.g. "Mohammed" shown in-app, `@maaiz` used for login/search)
- **Username search** (already needed for Patch 6 trainer search)

**Recommended approach**
- Add `displayName String?` to `User` model — optional, shown in UI instead of username when set
- Allow username change once every 30 days (store `usernameChangedAt DateTime?` on `User`)
- Settings screen: "Edit Profile" → change display name, change username (with cooldown warning)
- API: `PATCH /api/auth` with `{ displayName }` or `{ username }` — validate uniqueness before saving

---

## Implementation Order Recommendation

1. **Patch 6.1** — Role upgrade UI (small, unblocks the trainer flow)
2. **Patch 6.2** — Trainer search + request sending
3. **Patch 6.3** — Message centre / request acceptance
4. **Patch 6.4** — Trainer views client progress
5. **Patch 7** — Direct messaging (depends on 6.3 for the relationship)
6. **Patch 8.3** — Body measurements (self-contained, no dependencies)
7. **Patch 8.4** — Username system (self-contained)
8. **Patch 8.1 / 8.2** — GIF icons (needs GIF assets sourced first)

---

## Deferred / Blocked

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic API credits (checkout unavailable as of May 2026) |
| DMARC DNS record for revtech.com.mv | Dhiraagu registrar portal access |
| Push notifications for messages (Patch 7) | Needs VAPID key setup + service worker update |
