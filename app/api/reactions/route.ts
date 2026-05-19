import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST — toggle a reaction on a message
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { messageId, emoji } = await req.json();
    if (!messageId || !emoji) return json({ error: "messageId and emoji required" }, 400);

    const existing = await (prisma.messageReaction as any).findUnique({
      where: { messageId_userId_emoji: { messageId, userId: uid, emoji } },
    });

    if (existing) {
      await (prisma.messageReaction as any).delete({ where: { id: existing.id } });
      return json({ action: "removed", messageId, emoji });
    } else {
      await (prisma.messageReaction as any).create({
        data: { messageId, userId: uid, emoji },
      });
      return json({ action: "added", messageId, emoji });
    }
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
