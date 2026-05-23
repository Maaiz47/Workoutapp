import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendPushToUser } from "../../../lib/push";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

type FriendshipLite = {
  id: string;
  userAId: string;
  userBId: string;
  status: string;
  requestedAt: Date;
  acceptedAt: Date | null;
  userA: { id: string; username: string; avatarId?: string | null };
  userB: { id: string; username: string; avatarId?: string | null };
};

// Shape each Friendship row from the perspective of the asking user —
// flip A/B so the consumer always reads `friend` as "the other side".
function shapeFromViewer(f: FriendshipLite, viewerId: string) {
  const iAmA = f.userAId === viewerId;
  const other = iAmA ? f.userB : f.userA;
  return {
    id: f.id,
    status: f.status,
    direction: iAmA ? "outgoing" : "incoming", // who requested
    requestedAt: f.requestedAt,
    acceptedAt: f.acceptedAt,
    friend: { id: other.id, username: other.username },
  };
}

// GET — list friends + pending sent + pending received for the viewer.
// Returns three buckets so the UI can render each section independently.
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const rows = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: uid }, { userBId: uid }],
        status: { in: ["pending", "accepted"] },
      },
      include: {
        userA: { select: { id: true, username: true } },
        userB: { select: { id: true, username: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    const accepted: ReturnType<typeof shapeFromViewer>[] = [];
    const pendingSent: ReturnType<typeof shapeFromViewer>[] = [];
    const pendingReceived: ReturnType<typeof shapeFromViewer>[] = [];
    for (const r of rows) {
      const shaped = shapeFromViewer(r as FriendshipLite, uid);
      if (r.status === "accepted") accepted.push(shaped);
      else if (shaped.direction === "outgoing") pendingSent.push(shaped);
      else pendingReceived.push(shaped);
    }

    return json({ accepted, pendingSent, pendingReceived });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to load friends" }, 500);
  }
}

// POST — send a friend request by recipient username. Creates a pending
// Friendship row + a Message of type "friend_request" so the recipient
// sees a notification in the existing messages stream.
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const me = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, username: true } });
    if (!me) return json({ error: "Unauthorized" }, 401);

    const { toUsername } = await req.json();
    if (!toUsername || typeof toUsername !== "string") {
      return json({ error: "toUsername required" }, 400);
    }
    // Normalise the handle: strip leading @ symbols + lowercase so the
    // DB lookup matches the registration-enforced lowercase usernames.
    // Without this, "@Maaiz", "Maaiz", or any non-lowercase spelling
    // would 404 even though the user exists. Case-insensitive
    // fallback mirrors /api/routines/[id]/share for legacy accounts
    // that were created before usernames were forced lowercase.
    // (qa: friend-search-case-insensitive)
    const handle = toUsername.trim().replace(/^@+/, "").toLowerCase();
    if (!handle) return json({ error: "toUsername required" }, 400);
    if (handle === me.username.toLowerCase()) {
      return json({ error: "You can't friend yourself" }, 400);
    }

    let target = await prisma.user.findUnique({
      where: { username: handle },
      select: { id: true, username: true },
    });
    if (!target) {
      const fallback = await prisma.user.findFirst({
        where: { username: { equals: handle, mode: "insensitive" } },
        select: { id: true, username: true },
      });
      if (fallback) target = fallback;
    }
    if (!target) return json({ error: `No user @${handle}. Check the spelling.` }, 404);

    // Existing row in either direction blocks a new request.
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: uid, userBId: target.id },
          { userAId: target.id, userBId: uid },
        ],
      },
    });
    if (existing) {
      if (existing.status === "accepted") return json({ error: "Already friends" }, 409);
      if (existing.status === "blocked") return json({ error: "Cannot send request" }, 403);
      if (existing.status === "pending") {
        // If the recipient already sent ME a pending request, auto-accept
        // it on this POST — natural UX (you sent one back, you wanted in).
        if (existing.userAId === target.id && existing.userBId === uid) {
          const updated = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: "accepted", acceptedAt: new Date() },
          });
          return json({ friendship: updated, autoAccepted: true });
        }
        return json({ error: "Request already pending" }, 409);
      }
    }

    const friendship = await prisma.friendship.create({
      data: { userAId: uid, userBId: target.id, status: "pending" },
    });

    await prisma.message.create({
      data: {
        fromId: uid,
        toId: target.id,
        body: `${me.username} sent you a friend request`,
        type: "friend_request",
        requestId: friendship.id,
      },
    }).catch(() => {}); // non-fatal — friendship is the source of truth

    // Push notification — fire-and-forget so a missing VAPID env or
    // no-subs case doesn't block the API response.
    sendPushToUser(target.id, {
      title: "New friend request",
      body: `${me.username} wants to be friends`,
      url: "/?friends=1",
    }).catch(() => {});

    return json({ friendship });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to send request" }, 500);
  }
}

// PATCH — accept | decline | block a pending request. Only the recipient
// (userB) can accept/decline an incoming request. Block can be invoked
// by either party at any status.
export async function PATCH(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { friendshipId, action } = await req.json();
    if (!friendshipId || !action) return json({ error: "friendshipId and action required" }, 400);
    if (!["accept", "decline", "block"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!f) return json({ error: "Friendship not found" }, 404);
    if (f.userAId !== uid && f.userBId !== uid) return json({ error: "Not your request" }, 403);

    if (action === "accept") {
      if (f.userBId !== uid) return json({ error: "Only recipient can accept" }, 403);
      if (f.status !== "pending") return json({ error: "Request already resolved" }, 400);
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      // Notify the original sender (userA) that their request was accepted.
      const me = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      if (me) {
        sendPushToUser(f.userAId, {
          title: "Friend request accepted",
          body: `${me.username} accepted your friend request`,
          url: "/?friends=1",
        }).catch(() => {});
        await prisma.message.create({
          data: {
            fromId: uid,
            toId: f.userAId,
            body: `${me.username} accepted your friend request`,
            type: "friend_accepted",
            requestId: friendshipId,
          },
        }).catch(() => {});
      }
      return json({ friendship: updated });
    }

    if (action === "decline") {
      if (f.userBId !== uid) return json({ error: "Only recipient can decline" }, 403);
      if (f.status !== "pending") return json({ error: "Request already resolved" }, 400);
      // Decline = delete the row so a fresh request can be sent later
      // (mirrors how trainer-decline leaves nothing in the way of a
      // future retry). No audit row needed for athlete-to-athlete.
      await prisma.friendship.delete({ where: { id: friendshipId } });
      return json({ ok: true });
    }

    if (action === "block") {
      // Whoever blocks becomes userA on the row (preserve who initiated
      // the block for any future audit). If the blocker is currently
      // userB, swap the sides on update.
      const data: { status: string; userAId?: string; userBId?: string; acceptedAt: null } = {
        status: "blocked",
        acceptedAt: null,
      };
      if (f.userBId === uid) {
        data.userAId = uid;
        data.userBId = f.userAId;
      }
      const updated = await prisma.friendship.update({ where: { id: friendshipId }, data });
      return json({ friendship: updated });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to update friendship" }, 500);
  }
}

// DELETE — unfriend. Either side of an accepted friendship can remove
// the row; future requests can be sent fresh.
export async function DELETE(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { friendshipId } = await req.json();
    if (!friendshipId) return json({ error: "friendshipId required" }, 400);

    const f = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!f) return json({ error: "Friendship not found" }, 404);
    if (f.userAId !== uid && f.userBId !== uid) return json({ error: "Not your friendship" }, 403);
    if (f.status === "blocked") return json({ error: "Cannot delete a block — PATCH to remove" }, 400);

    await prisma.friendship.delete({ where: { id: friendshipId } });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to unfriend" }, 500);
  }
}
