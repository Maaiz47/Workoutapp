import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// DELETE — soft-delete the sender's own DM message. Sets deletedAt
// without removing the row so the recipient's polling cycle sees the
// row become a 'Message deleted' placeholder. Only the original
// sender can delete their message.
//
// Nested under [userId] so the route slug doesn't collide with the
// conversation thread GET at /api/messages/[userId]/route.ts —
// Next.js requires sibling dynamic segments use the same slug name.
// Client passes both the partner userId (conversation context) and
// the messageId being deleted. (qa: message-soft-delete)
export async function DELETE(req: NextRequest, { params }: { params: { userId: string; messageId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const { messageId } = params;
  if (!messageId) return json({ error: "messageId required" }, 400);

  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, fromId: true, deletedAt: true },
    });
    if (!msg) return json({ error: "Not found" }, 404);
    if (msg.fromId !== uid) return json({ error: "Forbidden — can only delete your own messages" }, 403);
    if (msg.deletedAt) return json({ ok: true, alreadyDeleted: true });

    await (prisma.message as any).update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
