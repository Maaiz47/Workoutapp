import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST: Invite another trainer to the group
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    // Must be a trainer member of this group
    const membership = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: uid } },
    });
    if (!membership || membership.role !== "trainer") return json({ error: "Trainer membership required" }, 403);

    const { inviteeId } = await req.json();
    if (!inviteeId) return json({ error: "inviteeId required" }, 400);

    // Check invitee exists and is a trainer
    const invitee = await prisma.user.findUnique({ where: { id: inviteeId }, select: { id: true, role: true } });
    if (!invitee) return json({ error: "User not found" }, 404);
    if (invitee.role !== "trainer") return json({ error: "Can only invite trainers" }, 400);

    // Check not already a member
    const existing = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: inviteeId } },
    });
    if (existing) return json({ error: "Already a member" }, 409);

    // Upsert invite (in case a prior declined invite exists, create a new pending one)
    const invite = await prisma.leaderboardGroupInvite.upsert({
      where: { groupId_inviteeId: { groupId, inviteeId } },
      create: { groupId, inviterId: uid, inviteeId, status: "pending" },
      update: { inviterId: uid, status: "pending" },
    });

    return json({ invite }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// PATCH: Respond to invite (accept or decline)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;
    const { inviteId, action } = await req.json();

    if (!inviteId) return json({ error: "inviteId required" }, 400);
    if (action !== "accept" && action !== "decline") return json({ error: "action must be 'accept' or 'decline'" }, 400);

    const invite = await prisma.leaderboardGroupInvite.findUnique({ where: { id: inviteId } });
    if (!invite) return json({ error: "Invite not found" }, 404);
    if (invite.groupId !== groupId) return json({ error: "Invite does not belong to this group" }, 400);
    if (invite.inviteeId !== uid) return json({ error: "Not your invite" }, 403);
    if (invite.status !== "pending") return json({ error: "Invite already responded to" }, 409);

    const status = action === "accept" ? "accepted" : "declined";
    const updated = await prisma.leaderboardGroupInvite.update({
      where: { id: inviteId },
      data: { status },
    });

    if (action === "accept") {
      // Add invitee as a trainer member of the group
      await prisma.leaderboardGroupMember.upsert({
        where: { groupId_userId: { groupId, userId: uid } },
        create: { groupId, userId: uid, role: "trainer", includeInRank: false },
        update: { role: "trainer" },
      });

      // If the group already has a shared workout, auto-subscribe the
      // newly-joined trainer (activated=false). Trainers train too.
      const groupWorkout = await (prisma as any).groupWorkout.findUnique({
        where: { groupId },
        select: { id: true },
      });
      if (groupWorkout) {
        await (prisma as any).groupWorkoutSubscription.upsert({
          where: { userId_groupWorkoutId: { userId: uid, groupWorkoutId: groupWorkout.id } },
          create: { userId: uid, groupWorkoutId: groupWorkout.id },
          update: {},
        });
      }
    }

    return json({ invite: updated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
