# Dev database for Claude Code on the web

Web sessions run in an ephemeral sandbox with **no `DATABASE_URL`**, so the
app can't boot and DB-backed changes (achievements persistence, avatar
minting, anything Prisma) can't be runtime-tested there. To fix that we wire
a **non-production Neon branch** into the environment and let a SessionStart
hook sync the schema to it.

## One-time setup (done in the web UI / Neon console — not from a session)

1. **Create a Neon dev branch.** In the Neon console for the IronLog
   project → **Branches** → **New branch** off `main`/prod. Neon branches
   are copy-on-write, isolated, and come pre-loaded with the real schema.
   Name it something obvious like `dev` or `claude-dev`.
2. **Copy its connection string.** Use the **pooled** connection string
   (host contains `-pooler`) so serverless/short-lived connections behave.
3. **Add it to the environment config.** In Claude Code on the web →
   environment settings → environment variables → add
   `DATABASE_URL = <the dev branch pooled URL>`. Store it as a **secret**.
   - ⚠️ **Never paste the production connection string here.** A session
     can write test data; keep it on an isolated branch.
4. Start (or restart) a session. The SessionStart hook does the rest.

## What the hook does (`.claude/hooks/session-start.sh`)

- Ensures node deps are present (idempotent).
- If `DATABASE_URL` is set: `prisma generate` + `prisma db push` to bring
  the dev branch schema in line with `prisma/schema.prisma`. (`db push` is
  non-interactive and fails loudly rather than dropping data, so it's a
  no-op on a branch already matching prod.)
- If `DATABASE_URL` is **absent**: skips cleanly with a hint — the app just
  won't be runtime-testable that session.

Escape hatch: set `DEV_DB_SKIP_PUSH=1` in the env to install deps but skip
the schema push.

## Running the app in a session once the dev DB is wired

```bash
npm run dev        # boots Next.js against the dev branch
```

Resetting the dev branch: delete + recreate it in the Neon console (instant),
or `npx prisma db push --force-reset` from a session to wipe + re-sync.

## Why a branch, not "reuse an existing DB"

IronLog runs on a single Neon DB that Vercel deploys against — the only
"existing" database is **production**. Pointing a session at it would mean
test writes land in real user rows. A branch gives the same convenience with
full isolation, and is free to reset or throw away.
