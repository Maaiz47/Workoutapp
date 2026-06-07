import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) {
  const res = NextResponse.json(data, { status });
  // Never cache — admins need to see new submissions immediately.
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/qa/comments/admin-feed
//
// Admin-only feed of OTHER users' submissions (bug reports, ideas,
// feedback, retests) so admins see them in the in-app system-
// notifications log. Per @maaiz: "I want admins to always get a push
// notification AND see the submission in system notifications when
// someone submits anything except themselves."
//
// Returns { submissions: [] } (not a 403) for non-admins so the client
// can call it unconditionally without special-casing — a regular user
// just gets nothing to merge into their feed.
// (qa: admin-submission-notifications)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ submissions: [] });

  try {
    const me = await prisma.user.findUnique({
      where: { id: uid },
      select: { role: true, extraRoles: true },
    });
    const isAdmin = !!me && (me.role === "admin" || (Array.isArray(me.extraRoles) && me.extraRoles.includes("admin")));
    if (!isAdmin) return json({ submissions: [] });

    // Last 30 days, newest first, capped — enough to surface the recent
    // backlog without unbounded growth. Include anonymous (userId=null)
    // submissions; exclude only the admin's OWN rows. A bare
    // `NOT: { userId: uid }` would drop null rows (SQL NULL != uid is
    // NULL), so OR the null case in explicitly.
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await (prisma as any).qAComment.findMany({
      where: {
        ts: { gte: since },
        OR: [{ userId: null }, { userId: { not: uid } }],
      },
      orderBy: { ts: "desc" },
      take: 50,
      select: { id: true, itemId: true, tester: true, userId: true, status: true, note: true, ts: true },
    });

    const userIds = Array.from(new Set(rows.map((r: any) => r.userId).filter(Boolean))) as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
      : [];
    const nameById = new Map(users.map((u: any) => [u.id, u.username]));

    const submissions = rows.map((r: any) => ({
      id: r.id,
      itemId: r.itemId,
      status: r.status,
      note: r.note,
      ts: r.ts.toISOString(),
      submitter: (r.userId ? nameById.get(r.userId) : null) || r.tester || "Someone",
    }));

    return json({ submissions });
  } catch (e: any) {
    return json({ submissions: [], error: e?.message ?? "Failed" }, 200);
  }
}
