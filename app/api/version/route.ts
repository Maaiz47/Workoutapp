import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Disable static caching — we want the latest server-side SHA on every hit
// so the client can detect a deploy that happened after it loaded.
export const dynamic = "force-dynamic";

// Manual major.minor — bump these in code for milestone releases.
// The patch number is auto-derived from PATCHLOG section count.
const MAJOR_MINOR = "1.0";

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
  const appVersion = `${MAJOR_MINOR}.${patchCount}`;

  return NextResponse.json({ sha, shortSha, appVersion, ref, title });
}
