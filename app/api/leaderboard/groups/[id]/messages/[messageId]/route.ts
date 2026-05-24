import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// DELETE — soft-delete a group message. Only the original sender
// can delete. System messages (fromId=null) cannot be deleted.
// (qa: message-soft-delete)
export async function DELETE(req: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const { id: groupId, messageId } = params;
  if (!groupId || !messageId) return json({ error: "groupId + messageId required" }, 400);

  try {
    // Must be a member of the group to delete anything within it.
    const membership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId, userId: uid },
      select: { id: true },
    });
    if (!membership) return json({ error: "Not a group member" }, 403);

    const msg = await prisma.groupMessage.findUnique({
      where: { id: messageId },
      select: { id: true, fromId: true, groupId: true, type: true, deletedAt: true },
    });
    if (!msg || msg.groupId !== groupId) return json({ error: "Not found" }, 404);
    if (!msg.fromId) return json({ error: "Cannot delete system messages" }, 400);
    if (msg.fromId !== uid) return json({ error: "Forbidden — can only delete your own messages" }, 403);
    if (msg.deletedAt) return json({ ok: true, alreadyDeleted: true });

    await (prisma.groupMessage as any).update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
