/** @type {import('next').NextConfig} */
const fs = require("fs");
const path = require("path");

// Bake the build's git SHA + derived version INTO the client bundle, so the
// running app knows which build is actually loaded — not just what the
// server's /api/version reports. Without this, `runningSha` was read from
// the server at mount, so a stale PWA bundle (iOS serves the old cached
// bundle on reopen) looked "up to date" and the update banner never fired
// — the user had to force-close to pick up a deploy. Comparing the baked
// SHA against the live server SHA makes the banner fire reliably.
//
// Keep MAJOR_MINOR / OFFSET in sync with app/api/version/route.ts — both
// derive the patch number by counting `## ` PATCHLOG sections. See
// CLAUDE.md "The in-app version number is derived from PATCHLOG".
const MAJOR_MINOR = "1.2";
const PRE_V1_2_PATCH_OFFSET = 243;
function buildVersion() {
  try {
    const md = fs.readFileSync(path.join(__dirname, "PATCHLOG.md"), "utf8");
    const count = (md.match(/^## /gm) || []).length;
    return `${MAJOR_MINOR}.${Math.max(0, count - PRE_V1_2_PATCH_OFFSET)}`;
  } catch {
    return "";
  }
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    // Empty locally (no Vercel git env) — the client falls back to the
    // old /api/version behaviour so dev isn't affected.
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "",
    NEXT_PUBLIC_BUILD_VERSION: buildVersion(),
  },
};
module.exports = nextConfig;
