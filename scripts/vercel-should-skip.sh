#!/usr/bin/env bash
# Vercel `ignoreCommand` — runs from the repo root on every deploy.
# Exit 0  = SKIP this deploy (treated as canceled, doesn't count toward quota).
# Exit 1  = PROCEED with the deploy as normal.
# Exit !0,1 = error → treated as PROCEED defensively.
#
# Purpose: stop burning Vercel deploy quota on commits that only touch
# audit mirrors, dev scripts, and pure-docs files that have NO runtime
# impact. Anything bundled into the Next.js output OR served from
# /public still triggers a deploy.

set -e

# First deploy or no previous SHA available — always proceed.
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "vercel-should-skip: no previous SHA — proceeding with deploy."
  exit 1
fi

# All files changed since the last successful deploy.
CHANGES=$(git diff "$VERCEL_GIT_PREVIOUS_SHA" HEAD --name-only || true)

if [ -z "$CHANGES" ]; then
  echo "vercel-should-skip: no file diffs detected — skipping deploy."
  exit 0
fi

# Files that DON'T need a redeploy to take effect:
#   qa-comments/      — audit-log mirrors written by the live app via
#                       the GH API; nothing reads them at runtime.
#   scripts/          — dev-only helpers, never bundled into the
#                       Next.js output or shipped to the client.
#   CLAUDE.md         — instructions for Claude sessions, not runtime.
#   README.md         — repo docs.
#   image-prompts.md  — static generation-prompts catalogue.
#   public/stretches/README.md — folder-level docs, not user-facing.
#   .gitignore        — VCS metadata.
#
# Anything OUTSIDE this pattern triggers a deploy. This is intentionally
# conservative — qa-state.json, qa-processed.json, PATCHLOG.md, prisma
# schema, app/, lib/, public/* binaries, package.json, etc. all DO
# trigger a deploy.
SAFE_PATTERN='^(qa-comments/|scripts/|CLAUDE\.md$|README\.md$|image-prompts\.md$|public/stretches/README\.md$|public/avatars/README\.md$|\.gitignore$)'

echo "vercel-should-skip: files changed since $VERCEL_GIT_PREVIOUS_SHA:"
echo "$CHANGES" | sed 's/^/  /'

# If ANY changed file is outside the safe set → proceed.
if echo "$CHANGES" | grep -vE "$SAFE_PATTERN" | grep -q .; then
  echo "vercel-should-skip: real files changed — proceeding with deploy."
  exit 1
fi

echo "vercel-should-skip: only safe-set files changed — skipping deploy."
exit 0
