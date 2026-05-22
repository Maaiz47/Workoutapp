import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("secret");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// Read qa-processed.json from the deployed filesystem. It's committed to the
// repo by Claude after a processing pass, so its contents become live on the
// next Vercel build. Empty / missing → nothing processed via the file path.
async function readProcessedManifest(): Promise<Record<string, { ts: string; sha?: string; summary?: string }>> {
  try {
    const p = path.join(process.cwd(), "qa-processed.json");
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed?.processedIds || {};
  } catch {
    return {};
  }
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

  const rawComments = await (prisma as any).qAComment.findMany({
    where,
    orderBy: { ts: "asc" },
  });

  // Merge in the file-backed processed manifest. After a Claude processing
  // pass, qa-processed.json gets committed with the IDs Claude actioned;
  // we treat those as processed regardless of the DB flag (the file is the
  // source of truth for processed state going forward).
  const processedMap = await readProcessedManifest();
  const comments = rawComments.map((c: any) => {
    const fileEntry = processedMap[c.id];
    if (fileEntry) {
      return { ...c, processed: true, processedAt: fileEntry.ts, processedSha: fileEntry.sha ?? null };
    }
    return c;
  });

  // If the caller asked for unprocessed only, re-apply that filter post-merge.
  if (!includeProcessed) {
    const filteredComments = comments.filter((c: any) => !c.processed);
    comments.length = 0;
    for (const c of filteredComments) comments.push(c);
  }

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

  // Soft attribution: anonymous comments (userId=null) where `tester`
  // matches a real username get the user record attached at read time.
  // Mirrors the public GET in /api/qa/comment. (qa: amanii-attribution)
  const anonTesterNames = Array.from(new Set(
    comments.filter((c: any) => !c.userId && typeof c.tester === "string" && c.tester.trim()).map((c: any) => c.tester.trim())
  )) as string[];
  const softUsers = anonTesterNames.length > 0
    ? await prisma.user.findMany({
        where: { username: { in: anonTesterNames, mode: "insensitive" } },
        select: { id: true, username: true, email: true, role: true },
      })
    : [];
  const softByName = new Map(softUsers.map((u: any) => [u.username.toLowerCase(), { username: u.username, email: u.email, role: u.role }]));

  const commentsWithUser = comments.map((c: any) => {
    let user = c.userId ? (userById[c.userId] ?? null) : null;
    if (!user && c.tester) user = softByName.get(String(c.tester).toLowerCase()) ?? null;
    return { ...c, user };
  });

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
