import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST — heartbeat: update lastSeenAt for the current user
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    await (prisma.user as any).update({
      where: { id: uid },
      data: { lastSeenAt: new Date() },
    });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
