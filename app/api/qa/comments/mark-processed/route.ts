import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("secret");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// POST /api/qa/comments/mark-processed
// Body: { ids: string[], sha?: string }
// Admin-gated. Marks the given QAComment rows processed=true with timestamp.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids, sha } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const result = await (prisma as any).qAComment.updateMany({
      where: { id: { in: ids } },
      data: {
        processed: true,
        processedAt: new Date(),
        processedSha: sha ?? null,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (e: any) {
    console.error("POST /api/qa/comments/mark-processed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
