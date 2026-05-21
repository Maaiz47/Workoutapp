import { NextResponse } from "next/server";

// Disable static caching — we want the latest server-side SHA on every hit
// so the client can detect a deploy that happened after it loaded.
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  const shortSha = sha === "dev" ? "dev" : sha.substring(0, 7);
  const ref = process.env.VERCEL_GIT_COMMIT_REF || "local";
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || "";
  // Strip the first line of the commit message — that's usually the title.
  const title = message.split("\n")[0].slice(0, 200);
  return NextResponse.json({ sha, shortSha, ref, title });
}
