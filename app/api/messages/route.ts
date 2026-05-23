import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendPushToUser } from "../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — conversation list for the current user (DMs + group threads)
//
// Returns BOTH 1:1 DMs and the user's group memberships' latest-message
// summaries in a single payload so the Messages inbox can show a unified
// timeline. Group convs render with a "GROUP · N members" chip to
// distinguish them. Unread tracking for group threads is client-side
// (localStorage lastSeenGroupAt[groupId]) — the API just ships the
// latest message; the frontend diffs against its own seen-timestamp.
// (qa: messages-group-inbox)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const [messages, groupMemberships] = await Promise.all([
      prisma.message.findMany({
        where: { OR: [{ fromId: uid }, { toId: uid }] },
        include: {
          from: { select: { id: true, username: true, lastSeenAt: true } },
          to:   { select: { id: true, username: true, lastSeenAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaderboardGroupMember.findMany({
        where: { userId: uid },
        include: {
          group: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
      }),
    ]);

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

    // Mark all incoming messages as delivered (recipient client is active)
    await (prisma.message as any).updateMany({
      where: { toId: uid, delivered: false },
      data: { delivered: true },
    });

    // Build group conversation summaries. One query per group for the
    // latest message — acceptable since most users are in <20 groups.
    const groupConversations: any[] = [];
    for (const m of groupMemberships) {
      const latest = await prisma.groupMessage.findFirst({
        where: { groupId: m.groupId },
        orderBy: { createdAt: "desc" },
        include: { from: { select: { id: true, username: true } } },
      });
      groupConversations.push({
        groupId: m.groupId,
        name: m.group.name,
        memberCount: (m.group as any)._count?.members ?? 0,
        latestMessage: latest
          ? {
              id: latest.id,
              fromId: latest.fromId,
              fromUsername: latest.from?.username ?? null,
              body: latest.body,
              type: latest.type,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
        joinedAt: m.joinedAt.toISOString(),
      });
    }
    // Sort by latest activity descending. Groups with no messages yet
    // sort by joinedAt as a fallback so newly-joined groups still appear.
    groupConversations.sort((a, b) => {
      const aT = a.latestMessage?.createdAt ?? a.joinedAt;
      const bT = b.latestMessage?.createdAt ?? b.joinedAt;
      return bT.localeCompare(aT);
    });

    return json({
      conversations: Array.from(convMap.values()),
      groupConversations,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — send a message
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { toId, body, type = "text", requestId, replyToId } = await req.json();
    if (!toId || !body?.trim()) return json({ error: "toId and body required" }, 400);

    // Update sender's lastSeenAt (non-blocking)
    (prisma.user as any).update({ where: { id: uid }, data: { lastSeenAt: new Date() } }).catch(() => {});

    const message = await (prisma.message as any).create({
      data: { fromId: uid, toId, body: body.trim(), type, requestId: requestId ?? null, replyToId: replyToId ?? null },
      include: {
        from: { select: { id: true, username: true } },
        replyTo: { select: { id: true, body: true, from: { select: { username: true } } } },
      },
    });

    // Send push notification to recipient (non-blocking)
    const notifBody = type === "adoption_request"
      ? `@${message.from.username} wants to add you as their client`
      : body.trim().substring(0, 100);

    sendPushToUser(toId, {
      title: `@${message.from.username}`,
      body: notifBody,
      url: "/",
    }).catch(() => {});

    return json({ message });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
