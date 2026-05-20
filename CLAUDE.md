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
- "work the QA backlog"
- "process feedback"
- "check the QA dashboard"
- "action the latest QA comments"

The user shouldn't have to repeat the architecture or admin secret each time —
fetch the secret from them only if it's not already in this conversation.

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
3. **Reconcile statuses** in `qa-state.json`:
   - Latest comment says `passing` → item's `status` = passing, `lastTested` = today.
   - Latest comment says `failing` → item's `status` = failing, prepend the
     comment notes (with timestamp + commit sha) to the item's `notes` field.
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
