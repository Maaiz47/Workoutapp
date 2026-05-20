import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("secret");
  return ADMIN_SECRET && key === ADMIN_SECRET;
}

// POST /api/qa/admin/migrate-legacy?delete=<bool>
// Admin-gated. Reads all legacy QAReport rows, explodes each payload into
// per-item QAComment rows (only items that have a non-empty note), then
// optionally deletes the original QAReport rows once migrated.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shouldDelete = req.nextUrl.searchParams.get("delete") === "true";
  const reports = await (prisma as any).qAReport.findMany({ orderBy: { ts: "asc" } });

  let createdComments = 0;
  const migratedReportIds: string[] = [];

  for (const r of reports) {
    let payload: any = null;
    try { payload = JSON.parse(r.payloadJson); } catch { continue; }
    if (!payload || !Array.isArray(payload.items)) continue;

    const tester: string = r.tester || payload.tester || "unknown";

    for (const it of payload.items) {
      if (!it || typeof it !== "object") continue;
      const note = typeof it.notes === "string" ? it.notes.trim() : "";
      const status = typeof it.status === "string" ? it.status : "untested";
      const itemId = typeof it.id === "string" ? it.id : null;
      const screenshotUrl = typeof it.screenshotUrl === "string" && it.screenshotUrl.trim().length > 0
        ? it.screenshotUrl.trim() : null;

      // Skip "empty" entries — only carry forward rows that actually contain
      // information (either a note or a non-default status the tester set).
      if (!itemId) continue;
      const hasNote = note.length > 0;
      const hasInterestingStatus = status !== "untested";
      if (!hasNote && !hasInterestingStatus) continue;

      await (prisma as any).qAComment.create({
        data: {
          itemId,
          tester,
          status,
          note: hasNote ? note : `(no note — status set to ${status} on legacy submit)`,
          screenshotUrl,
          ts: r.ts,
        },
      });
      createdComments++;
    }

    migratedReportIds.push(r.id);
  }

  if (shouldDelete && migratedReportIds.length > 0) {
    await (prisma as any).qAReport.deleteMany({ where: { id: { in: migratedReportIds } } });
  }

  return NextResponse.json({
    ok: true,
    reportsProcessed: reports.length,
    commentsCreated: createdComments,
    legacyDeleted: shouldDelete ? migratedReportIds.length : 0,
  });
}
