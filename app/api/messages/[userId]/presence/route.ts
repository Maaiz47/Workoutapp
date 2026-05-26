import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — lightweight peer-presence lookup for the open DM view. Used by
// the client's 15s presence-poll so the online dot / "last seen X"
// updates live without reopening the conversation. Returns just the
// peer's lastSeenAt so the payload stays tiny.
// (qa: messaging-online-status-live)
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  const peerId = params.userId;
  if (!peerId) return json({ error: "userId required" }, 400);
  try {
    const peer = await (prisma.user as any).findUnique({
      where: { id: peerId },
      select: { lastSeenAt: true },
    });
    return json({ partnerLastSeen: peer?.lastSeenAt ?? null });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
