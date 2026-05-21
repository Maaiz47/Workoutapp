import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mirrorCommentToRepo } from "@/lib/qaGitMirror";
import fs from "fs/promises";
import path from "path";

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

// POST /api/qa/comment
// Body: { itemId, tester, status, note, screenshotUrl? }
// Public — anyone testing can post. No admin gate.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, tester, status, note, screenshotUrl } = body || {};

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }
    if (!tester || typeof tester !== "string" || tester.trim().length === 0) {
      return NextResponse.json({ error: "tester is required" }, { status: 400 });
    }
    const validStatuses = ["untested", "passing", "failing", "regression-retest"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "status invalid" }, { status: 400 });
    }
    if (typeof note !== "string" || note.trim().length === 0) {
      return NextResponse.json({ error: "note is required" }, { status: 400 });
    }

    // If the request carries the ironlog-uid cookie, attach the user to the
    // comment so the admin view can group by submitter. Public anonymous
    // submissions still work (userId stays null).
    const uid = req.cookies.get("ironlog-uid")?.value || null;

    const row = await (prisma as any).qAComment.create({
      data: {
        itemId,
        tester: tester.trim(),
        userId: uid,
        status,
        note: note.trim(),
        screenshotUrl: screenshotUrl ? String(screenshotUrl).trim() : null,
      },
    });

    // Mirror the comment into the repo so Claude can git pull and read it.
    // Must AWAIT here — Vercel terminates the serverless function as soon as
    // the response is sent, which kills any unawaited in-flight fetch and
    // silently drops the mirror. The added latency is ~200-500ms but the
    // loop becomes reliable. Mirror failures are swallowed so a GitHub
    // outage never fails a user-facing submit.
    try { await mirrorCommentToRepo(row); } catch (e) { console.error("mirror failed:", e); }

    return NextResponse.json({ ok: true, id: row.id, ts: row.ts });
  } catch (e: any) {
    console.error("POST /api/qa/comment", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET /api/qa/comment?itemId=... — returns the comment thread for one item
// or all items if itemId is omitted. Public (the dashboard reads this).
export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  const where = itemId ? { itemId } : {};
  const rows = await (prisma as any).qAComment.findMany({
    where,
    orderBy: { ts: "asc" },
    select: {
      id: true, itemId: true, tester: true, userId: true, status: true,
      note: true, screenshotUrl: true, ts: true, processed: true,
    },
  });

  // Enrich with user data so the dashboard can group comments by username
  // (not just by the raw `tester` string). Done as a manual batched fetch
  // rather than a prisma `user` join because QAComment doesn't have a
  // schema-level @relation to User — adding one mid-deploy risks an FK
  // migration failure on any orphaned userIds.
  const userIds = Array.from(new Set(rows.map((r: any) => r.userId).filter(Boolean)));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds as string[] } },
        select: { id: true, username: true, email: true, role: true },
      })
    : [];
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const processedMap = await readProcessedManifest();
  const comments = rows.map((c: any) => ({
    ...c,
    user: c.userId ? (userMap.get(c.userId) || null) : null,
    processed: processedMap[c.id] ? true : c.processed,
  }));
  return NextResponse.json({ comments });
}
