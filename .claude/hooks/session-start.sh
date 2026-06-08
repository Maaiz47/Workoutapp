#!/usr/bin/env bash
# SessionStart hook for IronLog — Claude Code on the web.
#
# Purpose:
#   1. Ensure node dependencies are present (idempotent; fast no-op when
#      they already are).
#   2. When a *dev* DATABASE_URL is wired into the environment config,
#      sync the Prisma schema to it so the app can actually boot and be
#      runtime-tested in the session (earn achievements, mint avatars,
#      etc. — all the things that need a live Postgres).
#
# Safety:
#   - DATABASE_URL MUST point at a NON-PRODUCTION database (a Neon dev
#     branch). Never wire the prod connection string here — a session
#     could write test data into real user rows.
#   - `prisma db push` is non-interactive and will FAIL LOUDLY rather
#     than drop data if a destructive change is needed, so it is safe to
#     run automatically against a branch cloned from prod (it no-ops when
#     the schema already matches).
#   - Set DEV_DB_SKIP_PUSH=1 in the env to disable the auto-push step
#     while still installing deps.
#
# No-ops gracefully when DATABASE_URL is absent (offline/local sessions).
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- 1. dependencies (idempotent) ---
if [ ! -x node_modules/.bin/next ]; then
  echo "[session-start] installing node dependencies…"
  npm install --no-audit --no-fund
else
  echo "[session-start] node dependencies already present — skipping install."
fi

# --- 2. dev DB bootstrap ---
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[session-start] DATABASE_URL not set — skipping Prisma sync (no dev DB wired)."
  echo "[session-start] To enable runtime testing, add a Neon *dev branch*"
  echo "[session-start] connection string as DATABASE_URL in the environment config."
  exit 0
fi

echo "[session-start] DATABASE_URL detected — generating Prisma client…"
npx prisma generate

if [ "${DEV_DB_SKIP_PUSH:-}" = "1" ]; then
  echo "[session-start] DEV_DB_SKIP_PUSH=1 — leaving schema as-is."
else
  echo "[session-start] syncing Prisma schema to the dev DB (prisma db push)…"
  npx prisma db push --skip-generate
fi

echo "[session-start] dev DB ready — \`npm run dev\` can boot for runtime testing."
