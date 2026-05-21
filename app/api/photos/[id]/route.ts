import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// DELETE — removes the DB row AND the blob. Owner-only.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const row = await (prisma as any).progressPhoto.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, url: true },
    });
    if (!row || row.userId !== uid) return json({ error: "Not found" }, 404);
    // Try to delete the blob too — failure here is non-fatal (the URL
    // will become orphaned but the DB row still goes away).
    try { await del(row.url); } catch {}
    await (prisma as any).progressPhoto.delete({ where: { id: params.id } });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Delete failed" }, 500);
  }
}
