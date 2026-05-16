import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — conversation list for the current user
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ fromId: uid }, { toId: uid }] },
      include: {
        from: { select: { id: true, username: true } },
        to: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const convMap = new Map<string, any>();
    for (const msg of messages) {
      const partnerId = msg.fromId === uid ? msg.toId : msg.fromId;
      const partner = msg.fromId === uid ? msg.to : msg.from;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, { partner, latestMessage: msg, unreadCount: 0 });
      }
      if (msg.toId === uid && !msg.read) {
        convMap.get(partnerId).unreadCount++;
      }
    }

    return json({ conversations: Array.from(convMap.values()) });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — send a message
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { toId, body, type = "text", requestId } = await req.json();
    if (!toId || !body?.trim()) return json({ error: "toId and body required" }, 400);

    const message = await prisma.message.create({
      data: { fromId: uid, toId, body: body.trim(), type, requestId: requestId ?? null },
      include: { from: { select: { id: true, username: true } } },
    });

    return json({ message });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
