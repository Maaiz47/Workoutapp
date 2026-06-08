import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Disable static caching — we want the latest server-side SHA on every hit
// so the client can detect a deploy that happened after it loaded.
export const dynamic = "force-dynamic";

// Manual major.minor — bump these in code for milestone releases.
// The patch number is auto-derived from PATCHLOG section count.
// 1.1.0 milestone (2026-05-23): tier scoring v2, test-user generator,
// workout polish batch, planner-equipment-strict, routine auto-naming,
// avatar picker as routed page, contributors consolidated to /qa.
// 1.2.0 milestone (2026-05-27): per-session UX overhaul — new-user
// tier ramp + recalibration, profile preview modal, auto-update
// banner via overlay portal, bottom-nav portal fix, exercise
// catalogue audit + cardio muscle reclassification, achievements
// expansion (+15), form-cue longest-match. (qa: version-bump-v1.2)
const MAJOR_MINOR = "1.2";
// Number of PATCHLOG `## ` sections that existed up to v1.2.14, minus 15,
// so the live count maps to the continuous patch number. We subtract this
// from the live section count so the patch increments per shipped section.
//
// IMPORTANT: the patch number is now derived from EVERY top-level `## `
// PATCHLOG header (see the count below) — NOT a fixed list of header
// words. It used to match only `## (QA pass|Feature|Fix|Polish)`, but the
// header vocabulary drifted (`## Feat`, `## Bugfix`, `## Chore`, `## Hotfix`
// stopped matching), which silently froze the version at v1.2.14 across
// several deploys. Counting all `## ` sections makes drift impossible:
// any PATCHLOG entry bumps the version. (qa: version-bump-v1.2)
//
// Recalibrated 2026-06-08: 258 sections at this commit → v1.2.15
// (offset 243). The prior build read v1.2.14, so the number stays
// continuous. If you ever bump MAJOR_MINOR, reset this offset to the
// current section count so the patch restarts near .0/.1.
const PRE_V1_2_PATCH_OFFSET = 243;

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const shortSha = sha === "dev" ? "dev" : sha.substring(0, 7);
  const ref = process.env.VERCEL_GIT_COMMIT_REF || "local";
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
  const title = message.split("\n")[0].slice(0, 200);

  // Count EVERY top-level PATCHLOG section to derive the user-facing patch
  // number. The SHA above is still the canonical compare key — two pushes
  // can share a patch count, but their SHAs always differ.
  let patchCount = 0;
  try {
    const md = await fs.readFile(path.join(process.cwd(), "PATCHLOG.md"), "utf-8");
    const matches = md.match(/^## /gm);
    patchCount = matches ? matches.length : 0;
  } catch {}
  // Subtract the v1.0 baseline so the patch number resets when MAJOR_MINOR
  // increments. Clamp at 0 in case anyone deletes sections.
  const minorPatch = Math.max(0, patchCount - PRE_V1_2_PATCH_OFFSET);
  const appVersion = `${MAJOR_MINOR}.${minorPatch}`;

  return NextResponse.json({ sha, shortSha, appVersion, ref, title });
}
