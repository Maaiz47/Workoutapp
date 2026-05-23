import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { sendPushToUser } from "../../../../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — last 100 messages in chronological order. Caller must be a
// member of the group. Each message returns { id, fromId, fromUsername,
// body, type, createdAt }. fromId/fromUsername null when type starts
// with 'system_'. (qa: group-chat-system-messages)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const membership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid },
      select: { id: true },
    });
    if (!membership) return json({ error: "Not a group member" }, 403);

    const messages = await prisma.groupMessage.findMany({
      where: { groupId: params.id },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { from: { select: { id: true, username: true } } },
    });

    return json({
      messages: messages.map(m => ({
        id: m.id,
        fromId: m.fromId,
        fromUsername: m.from?.username ?? null,
        body: m.body,
        type: m.type,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — send a chat message. body must be 1..1000 chars. System
// messages are NOT sendable via this endpoint — they're posted by
// other server-side actions (e.g. group challenge creation). Push
// notifications fire to all OTHER members. (qa: group-chat-system-messages)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { body } = await req.json();
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) return json({ error: "Message body required" }, 400);
    if (trimmed.length > 1000) return json({ error: "Message too long (max 1000 chars)" }, 400);

    const [membership, group, sender] = await Promise.all([
      prisma.leaderboardGroupMember.findFirst({
        where: { groupId: params.id, userId: uid },
        select: { id: true },
      }),
      prisma.leaderboardGroup.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, members: { select: { userId: true } } },
      }),
      prisma.user.findUnique({ where: { id: uid }, select: { username: true } }),
    ]);
    if (!membership || !group || !sender) return json({ error: "Not a group member" }, 403);

    const msg = await prisma.groupMessage.create({
      data: {
        groupId: params.id,
        fromId: uid,
        body: trimmed,
        type: "text",
      },
      include: { from: { select: { id: true, username: true } } },
    });

    // Fan-out push to all OTHER members. Fire-and-forget so a missing
    // VAPID env / no subscriptions doesn't block the API response.
    const otherMembers = group.members.filter(m => m.userId !== uid);
    for (const m of otherMembers) {
      sendPushToUser(m.userId, {
        title: `${group.name} · ${sender.username}`,
        body: trimmed.slice(0, 140),
        url: `/?groupChat=${params.id}`,
      }).catch(() => {});
    }

    return json({
      message: {
        id: msg.id,
        fromId: msg.fromId,
        fromUsername: msg.from?.username ?? null,
        body: msg.body,
        type: msg.type,
        createdAt: msg.createdAt.toISOString(),
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
