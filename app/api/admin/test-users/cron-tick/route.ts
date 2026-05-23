// Daily Vercel cron entry point for the test-user generator. Hit by
// the cron schedule in vercel.json (`0 9 * * *` UTC). Idempotent — if
// it runs twice on the same day, the second call is a no-op because
// tickAllTestUsers() skips users who already have a log for today.
// (qa: test-user-generator)
//
// Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` automatically
// when crons are configured in env. We also accept the admin secret
// so manual testing works.

import { NextRequest, NextResponse } from "next/server";
import { tickAllTestUsers } from "../../../../../lib/testUsers";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: NextRequest): boolean {
  const authz = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && authz === `Bearer ${CRON_SECRET}`) return true;
  const key = req.headers.get("x-admin-key");
  if (ADMIN_SECRET && key === ADMIN_SECRET) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await tickAllTestUsers();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
