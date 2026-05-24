import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendPushToUser } from "../../../../lib/push";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

// GET — list requests sent by this trainer
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Trainer account required" }, 403);

    const requests = await prisma.trainerRequest.findMany({
      where: { trainerId: uid },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });

    return json({ requests });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// POST — trainer sends an adoption request
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const trainer = await prisma.user.findUnique({ where: { id: uid } });
    if (!trainer || trainer.role !== "trainer") return json({ error: "Trainer account required" }, 403);

    const { targetUserId } = await req.json();
    if (!targetUserId) return json({ error: "targetUserId required" }, 400);

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.role !== "user") return json({ error: "User not found" }, 404);

    const existing = await prisma.trainerRequest.findUnique({
      where: { trainerId_userId: { trainerId: uid, userId: targetUserId } },
    });
    if (existing && existing.status === "pending") return json({ error: "Request already pending" }, 409);

    let request;
    if (existing) {
      request = await prisma.trainerRequest.update({
        where: { id: existing.id },
        data: { status: "pending" },
      });
    } else {
      request = await prisma.trainerRequest.create({
        data: { trainerId: uid, userId: targetUserId },
      });
    }

    // Send an adoption request message to the user
    await prisma.message.create({
      data: {
        fromId: uid,
        toId: targetUserId,
        body: `${trainer.username} wants to add you as their client`,
        type: "adoption_request",
        requestId: request.id,
      },
    }).catch(() => {}); // non-fatal if Message table not yet created

    // Push notification — fire-and-forget. (qa: push-notifications-requests)
    sendPushToUser(targetUserId, {
      title: "Trainer request",
      body: `${trainer.username} wants to add you as their client`,
      url: "/?trainer-requests=1",
    }).catch(() => {});

    return json({ request });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// PATCH — user accepts or declines an incoming trainer request
export async function PATCH(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { requestId, action } = await req.json();
    if (!requestId || !action) return json({ error: "requestId and action required" }, 400);

    const request = await prisma.trainerRequest.findUnique({ where: { id: requestId } });
    if (!request || request.userId !== uid) return json({ error: "Request not found" }, 404);
    if (request.status !== "pending") return json({ error: "Request already resolved" }, 400);

    if (action === "accept") {
      // Reverify the requesting trainer is still a trainer (could have been demoted)
      const trainer = await prisma.user.findUnique({ where: { id: request.trainerId }, select: { role: true } });
      if (!trainer || trainer.role !== "trainer") {
        await prisma.trainerRequest.update({ where: { id: requestId }, data: { status: "declined" } });
        return json({ error: "Trainer no longer available" }, 410);
      }
      // Adoption also auto-friends the pair. Per @maaiz: 'Clients
      // should automatically be friends when adopted, and only
      // revoke client ship not unfriend'. We upsert: if a friendship
      // row already exists (any direction, any status), flip it to
      // accepted; otherwise create a fresh accepted one with the
      // trainer as userA.
      // (qa: trainer-client-auto-friend)
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: request.trainerId, userBId: uid },
            { userAId: uid, userBId: request.trainerId },
          ],
        },
      });
      const txns: any[] = [
        prisma.trainerClient.create({ data: { trainerId: request.trainerId, clientId: uid } }),
        prisma.trainerRequest.update({ where: { id: requestId }, data: { status: "accepted" } }),
      ];
      if (existingFriendship) {
        if (existingFriendship.status !== "blocked") {
          txns.push(prisma.friendship.update({
            where: { id: existingFriendship.id },
            data: { status: "accepted", acceptedAt: new Date() },
          }));
        }
      } else {
        txns.push(prisma.friendship.create({
          data: { userAId: request.trainerId, userBId: uid, status: "accepted", acceptedAt: new Date() },
        }));
      }
      await prisma.$transaction(txns);
      // Notify the trainer their request was accepted.
      const me = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      if (me) {
        sendPushToUser(request.trainerId, {
          title: "Client accepted",
          body: `${me.username} accepted your coaching request`,
          url: "/?trainer-clients=1",
        }).catch(() => {});
        // Also drop an in-app message so the trainer-aside thread
        // shows "X accepted your coaching request" — the user
        // doesn't have to wait on push to know the state changed.
        // (qa: trainer-request-pending-state)
        await prisma.message.create({
          data: {
            fromId: uid,
            toId: request.trainerId,
            body: `${me.username} accepted your coaching request`,
            type: "adoption_accepted",
            requestId: request.id,
          },
        }).catch(() => {});
      }
    } else if (action === "decline") {
      await prisma.trainerRequest.update({ where: { id: requestId }, data: { status: "declined" } });
      // Drop an in-app message so the trainer sees the decline in
      // their message log. (qa: trainer-request-pending-state)
      const me = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      if (me) {
        await prisma.message.create({
          data: {
            fromId: uid,
            toId: request.trainerId,
            body: `${me.username} declined your coaching request`,
            type: "adoption_declined",
            requestId: request.id,
          },
        }).catch(() => {});
      }
    } else {
      return json({ error: "Invalid action" }, 400);
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
