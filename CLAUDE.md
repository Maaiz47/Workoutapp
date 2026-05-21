# CLAUDE.md — instructions for Claude Code sessions on this repo

This file is read automatically at session start. Anything below is the canonical
brief for any Claude session working on IronLog.

## Always push to `main`

This repo uses direct-to-`main` development. Never open PRs, never create feature
branches, unless the user explicitly asks. Vercel auto-deploys `main` on every push.

## How to invoke QA processing

If the user says any of the following in a new session, run the **QA processing
pass** described below:

- "process QA"
- "process the feedback logged"
- "process feedback"
- "work the QA backlog"
- "check the QA dashboard"
- "action the latest QA comments"
- "summarise QA feedback"

The user shouldn't have to repeat the architecture or admin secret each time —
fetch the secret from them only if it's not already in this conversation.

## Two-step processing flow (IMPORTANT)

The pass is **TWO STEPS**. Do NOT execute fixes on the first invocation —
present a summary, wait for explicit go-ahead, then execute.

**Step 1 — Summary** (what you do when the user first asks):
1. Fetch unprocessed comments + legacy reports (see "QA processing pass" below).
2. Group them by submitting user (`comment.user.username` if set, else
   `comment.tester`).
3. For each user, list every distinct suggestion / bug they raised.
   - Dedupe within a user (multiple comments saying the same thing → one bullet).
   - Tag each with the affected QA item id where obvious.
4. Reply to the user with a structured summary like:
   ```
   ## QA backlog summary — N comments from M users

   ### @username (3 items)
   - [auth-login] Add password eye toggle
   - [onboarding-profile-setup] Split equipment by location when "Both" chosen
   - [General] Random thought about progress charts

   ### @otherusername (1 item)
   - [workout-set-logging] Set-edit button overlap on iPhone 12
   ```
5. End the summary with: "Reply with **'go ahead'** (or pick a subset) and
   I'll execute fixes for the items you confirm."
6. STOP. Do not touch the code, do not write to qa-state.json, do not
   mark anything processed. Just wait.

**Step 2 — Execute** (when the user says "go ahead" / "fix them all" /
"do items X and Y" / etc):
1. Run the full QA processing pass below — fix code, update qa-state.json,
   write a PATCHLOG entry, mark the addressed comments as processed.
2. Reply with what was actually done vs deferred, same format as before.

## QA processing pass — what to do

1. **Fetch the unprocessed comments** from the deployed app:
   ```
   GET https://ironlogmv.vercel.app/api/qa/comments?secret=<ADMIN_SECRET>
   ```
   Returns `{ comments: QAComment[], legacyReports: QAReport[], counts }`.
   The cloud Claude Code env can't reach `*.vercel.app` directly — ask the user
   to paste that URL into Safari/Arc and copy the JSON back, OR to run a console
   one-liner that POSTs the result back. If they're on iPhone with no DevTools,
   the URL-paste flow is easiest.
2. **Group comments by `itemId`**. For each item, the comments form a thread —
   read them in chronological order so the LATEST comment carries the most weight.
3. **Reconcile statuses** in `qa-state.json` (pre-action snapshot — reflects what the tester saw):
   - Latest comment says `passing` → item's `status` = passing, `lastTested` = today.
   - Latest comment says `failing` → item's `status` = failing.
   - Latest comment says `regression-retest` → item's `status` = regression-retest.
   - If multiple comments say "still broken" / "actually fixed now" over time,
     trust the LATEST one — but note in the item's `notes` that the issue had
     prior submissions you should investigate (audit trail).
4. **Act on `failing` and `regression-retest` items**:
   - Read each thread's notes carefully. Each note may contain multiple
     distinct asks (bug fixes, feature requests, UI polish).
   - Fix bugs in the code where the note is concrete and small (under ~50 lines).
   - For large feature requests, DON'T silently skip — explicitly list them in
     the PATCHLOG entry as "deferred — needs scoped work" with a one-line
     reason (e.g., "data model change required").
   - Cite the QA item id in commit messages so the audit trail is traceable:
     `fix(auth): show/hide eye on password fields (qa: auth-login)`.
4a. **Re-reconcile `qa-state.json` AFTER acting** — this is the critical step
    that closes the loop:
   - For every item you fixed FULLY: `status` = passing, `lastTested` = today,
     prepend a line to `notes` like:
     `[2026-MM-DD <sha7>] Fixed: <one-line summary>.`
   - For items you fixed PARTIALLY: `status` = regression-retest, `lastTested`
     = today, prepend:
     `[2026-MM-DD <sha7>] Partial: <what was done>. Still pending: <what wasn't>.`
   - For items you DEFERRED: keep current status, prepend:
     `[2026-MM-DD <sha7>] Deferred: <reason>. Needs: <suggested next step>.`
   - If the user reported something not in `qa-state.json` (a brand new
     feature area or a regression in an area we don't have an item for),
     ADD a new item to `qa-state.json` so it's tracked from now on.
   - If a bug fix changed the user-visible behaviour, update the item's
     `steps` to reflect the new flow so the next manual test exercises
     what actually exists.
   - Areas that "improved but still need work" should land in
     `regression-retest` with a note explaining what's still pending — that's
     the signal to the tester that progress was made but a re-test will
     surface more.
5. **Update `PATCHLOG.md`** with one section per processing pass. Use this format:
   ```
   ## QA pass · 2026-MM-DD — <sha7>
   ### Addressed
   - <item-id>: <one-line summary of what changed>
   ### Partially addressed
   - <item-id>: <what was done> · <what remains>
   ### Deferred (needs scoped work)
   - <item-id>: <reason, suggested next step>
   ### Items with no action needed (status flips only)
   - <item-id>: passing → passing (no regression)
   ```
6. **Mark the comments processed** so they don't come back next pass:
   ```
   POST https://ironlogmv.vercel.app/api/qa/comments/mark-processed?secret=<ADMIN_SECRET>
   Body: { "ids": ["...", "..."], "sha": "<the sha you committed>" }
   ```
   Again, if you can't reach the URL directly, give the user a console snippet
   to run.
7. **Reply to the user** with a concise summary:
   - Number of comments processed
   - List of items now passing
   - List of items still failing (and why)
   - List of deferred features

## Things to remember when actioning notes

- **Never silently lose feedback.** If a comment mentions five separate things,
  address all five or explicitly call out which were deferred and why. Don't
  cherry-pick the easy ones and pretend the rest weren't there.
- **Confirm fixes are visible to the user.** Vercel takes ~1 minute to deploy
  after your push. In the summary mention "Vercel will deploy in a minute,
  refresh `/qa` after to verify."
- **Regression-retest** items: re-look at the original code path that broke,
  not just the surface symptom. If a route was rebuilt since the failing
  comment, check whether the same bug could exist in the new code.
- **Audit trail is sacred.** Never edit or delete an existing `QAComment` row,
  never edit historic `PATCHLOG.md` entries. Append-only.

## Repo basics

- Framework: Next.js 14 (App Router, TypeScript, ES5 target)
- DB: Postgres via Neon, Prisma 5
- Hosting: Vercel — `prisma db push && prisma generate && next build` runs every deploy, so schema changes go live automatically
- Admin secret: env var `ADMIN_SECRET`, gates `/api/admin*` and `/api/qa/admin*` and `/api/qa/comments*` endpoints
- The user runs the app on iPhone — keep all UI mobile-first

## File map (the bits Claude touches most)

```
app/page.tsx                          # the entire main app (huge — search/grep, don't read whole)
app/qa/page.tsx                       # the QA dashboard (thread-based, per-item save)
app/api/qa/route.ts                   # GET qa-state.json
app/api/qa/comment/route.ts           # POST save one comment / GET full thread
app/api/qa/comments/route.ts          # GET unprocessed (admin)
app/api/qa/comments/mark-processed/   # POST mark done (admin)
app/api/qa/admin/migrate-legacy/      # POST one-time QAReport → QAComment migration
qa-state.json                         # canonical test-item list at repo root
PATCHLOG.md                           # append a section every push
```
