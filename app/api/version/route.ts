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
// Number of PATCHLOG section headers that existed at-or-before the v1.2
// reset. Same mechanic as the v1.1 reset: subtract this from the live
// section count so the patch number starts at .1 for the v1.2 cohort
// and increments per shipped PATCHLOG section. Per @maaiz "Reset it to
// v1.2.1 to move sequentially from there so I can test the update
// prompt is working". (qa: version-bump-v1.2)
const PRE_V1_2_PATCH_OFFSET = 142;

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const shortSha = sha === "dev" ? "dev" : sha.substring(0, 7);
  const ref = process.env.VERCEL_GIT_COMMIT_REF || "local";
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
  const title = message.split("\n")[0].slice(0, 200);

  // Count PATCHLOG sections to derive the user-facing patch number. The
  // SHA above is still the canonical compare key — two pushes can share a
  // patch count, but their SHAs always differ.
  let patchCount = 0;
  try {
    const md = await fs.readFile(path.join(process.cwd(), "PATCHLOG.md"), "utf-8");
    const matches = md.match(/^## (QA pass|Feature|Fix|Polish)\b/gm);
    patchCount = matches ? matches.length : 0;
  } catch {}
  // Subtract the v1.0 baseline so the patch number resets when MAJOR_MINOR
  // increments. Clamp at 0 in case anyone deletes sections.
  const minorPatch = Math.max(0, patchCount - PRE_V1_2_PATCH_OFFSET);
  const appVersion = `${MAJOR_MINOR}.${minorPatch}`;

  return NextResponse.json({ sha, shortSha, appVersion, ref, title });
}
