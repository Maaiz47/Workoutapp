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
        from: { select: { id: true, username: true } },
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

    return json({ messages: sanitized, partnerLastSeen: partner?.lastSeenAt ?? null });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
