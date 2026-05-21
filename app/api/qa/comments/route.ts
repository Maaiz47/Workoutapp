import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("secret");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// GET /api/qa/comments?since=<iso>&processed=<bool>&secret=...
// Admin-gated. Default: returns all UNPROCESSED comments. Used by Claude to
// pull the backlog when manually invoked.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  const processedParam = req.nextUrl.searchParams.get("processed");
  const includeProcessed = processedParam === "true" || processedParam === "all";

  const where: any = {};
  if (!includeProcessed) where.processed = false;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (!isNaN(d.getTime())) where.ts = { gte: d };
  }

  const comments = await (prisma as any).qAComment.findMany({
    where,
    orderBy: { ts: "asc" },
  });

  // Resolve userId → username/role for the admin view so Claude can group by user.
  const userIds = Array.from(new Set(comments.map((c: any) => c.userId).filter(Boolean))) as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, email: true, role: true },
      })
    : [];
  const userById: Record<string, { username: string; email: string | null; role: string }> = {};
  for (const u of users) userById[u.id] = { username: u.username, email: u.email, role: u.role };
  const commentsWithUser = comments.map((c: any) => ({
    ...c,
    user: c.userId ? (userById[c.userId] ?? null) : null,
  }));

  // Also surface any legacy QAReport rows that haven't been migrated yet.
  const legacyReports = await (prisma as any).qAReport.findMany({
    orderBy: { ts: "asc" },
  });

  return NextResponse.json({
    comments: commentsWithUser,
    legacyReports,
    counts: {
      comments: commentsWithUser.length,
      legacyReports: legacyReports.length,
      uniqueUsers: userIds.length,
    },
  });
}
