import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — conversation thread; supports ?since= for incremental polling
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const { userId } = params;
  const since = req.nextUrl.searchParams.get("since");

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: uid, toId: userId },
          { fromId: userId, toId: uid },
        ],
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      include: {
        // avatarId pulled through `profile` so DM bubbles can render
        // a per-message avatar chip (matching the group chat author
        // chip). (qa: chat-dm-per-message-avatars)
        from: { select: { id: true, username: true, role: true, profile: { select: { avatarId: true } } } },
        proposal: { select: { id: true, status: true, planJson: true } },
        replyTo: { select: { id: true, body: true, from: { select: { username: true } } } },
        reactions: { select: { emoji: true, userId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: since ? 50 : 100,
    });

    // Mark incoming messages as delivered + read
    await (prisma.message as any).updateMany({
      where: { fromId: userId, toId: uid },
      data: { delivered: true, read: true },
    });

    // Return partner's lastSeenAt for online indicator
    const partner = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { lastSeenAt: true },
    });

    // Sanitize soft-deleted messages — keep the row so clients see
    // the delete consistently, but replace the body + strip the
    // reply-to body/reactions/proposal so nothing leaks. The client
    // checks `deleted: true` to render the placeholder bubble.
    // (qa: message-soft-delete)
    const sanitized = messages.map((m: any) => {
      if (!m.deletedAt) return m;
      return {
        ...m,
        body: "",
        proposal: null,
        replyTo: null,
        reactions: [],
        deleted: true,
      };
    });

    // Resolve request status for adoption_request / friend_request
    // bubbles so the client can render a PENDING / ACCEPTED / DECLINED
    // pill on both sides of the thread. Without this the trainer
    // (who SENT the request) just sees a plain bubble with no idea
    // whether the client has acted on it.
    // (qa: trainer-request-pending-state)
    const adoptionIds = sanitized
      .filter((m: any) => (m.type === "adoption_request" || m.type === "adoption_accepted" || m.type === "adoption_declined") && m.requestId)
      .map((m: any) => m.requestId as string);
    const friendIds = sanitized
      .filter((m: any) => (m.type === "friend_request" || m.type === "friend_accepted") && m.requestId)
      .map((m: any) => m.requestId as string);
    const adoptionRows = adoptionIds.length
      ? await prisma.trainerRequest.findMany({ where: { id: { in: adoptionIds } }, select: { id: true, status: true } })
      : [];
    const friendRows = friendIds.length
      ? await prisma.friendship.findMany({ where: { id: { in: friendIds } }, select: { id: true, status: true } })
      : [];
    const adoptionStatus = new Map(adoptionRows.map((r: any) => [r.id, r.status]));
    const friendStatus = new Map(friendRows.map((r: any) => [r.id, r.status]));
    const withStatus = sanitized.map((m: any) => {
      if ((m.type === "adoption_request" || m.type === "adoption_accepted" || m.type === "adoption_declined") && m.requestId) {
        return { ...m, requestStatus: adoptionStatus.get(m.requestId) ?? null };
      }
      if ((m.type === "friend_request" || m.type === "friend_accepted") && m.requestId) {
        return { ...m, requestStatus: friendStatus.get(m.requestId) ?? null };
      }
      return m;
    });

    return json({ messages: withStatus, partnerLastSeen: partner?.lastSeenAt ?? null });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
