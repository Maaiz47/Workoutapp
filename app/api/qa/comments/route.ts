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

  // Also surface any legacy QAReport rows that haven't been migrated yet.
  // These are dumped raw so Claude can see what's there during a manual pass.
  const legacyReports = await (prisma as any).qAReport.findMany({
    orderBy: { ts: "asc" },
  });

  return NextResponse.json({
    comments,
    legacyReports,
    counts: {
      comments: comments.length,
      legacyReports: legacyReports.length,
    },
  });
}
