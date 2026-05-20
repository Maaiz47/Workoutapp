import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const row = await (prisma as any).qAComment.create({
      data: {
        itemId,
        tester: tester.trim(),
        status,
        note: note.trim(),
        screenshotUrl: screenshotUrl ? String(screenshotUrl).trim() : null,
      },
    });

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
      id: true, itemId: true, tester: true, status: true,
      note: true, screenshotUrl: true, ts: true, processed: true,
    },
  });
  return NextResponse.json({ comments: rows });
}
