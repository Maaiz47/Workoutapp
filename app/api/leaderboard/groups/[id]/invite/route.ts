import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST: Invite another user to the group. Trainers can invite other
// trainers (existing flow — invitee joins as co-trainer). Any member
// can invite their FRIENDS (new — invitee joins as "client" role
// once they accept). Validates the friendship is accepted.
// (qa: groups-friend-invite)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    // Inviter must be a member of this group (any role).
    const membership = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: uid } },
    });
    if (!membership) return json({ error: "Group membership required to invite" }, 403);

    const { inviteeId } = await req.json();
    if (!inviteeId) return json({ error: "inviteeId required" }, 400);
    if (inviteeId === uid) return json({ error: "Can't invite yourself" }, 400);

    // Check invitee exists.
    const invitee = await prisma.user.findUnique({ where: { id: inviteeId }, select: { id: true, role: true } });
    if (!invitee) return json({ error: "User not found" }, 404);

    // Check not already a member.
    const existing = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: inviteeId } },
    });
    if (existing) return json({ error: "Already a member" }, 409);

    // Authorisation matrix:
    //   1. Inviter is trainer + invitee is trainer → existing trainer
    //      co-invite flow (invitee joins as "trainer" role).
    //   2. Inviter is ANY member + invitee is their accepted friend
    //      → friend invite (invitee joins as "client" on accept).
    const inviterIsTrainer = membership.role === "trainer";
    const inviteeIsTrainer = invitee.role === "trainer";

    let intendedJoinRole: "trainer" | "client" = "client";
    if (inviterIsTrainer && inviteeIsTrainer) {
      intendedJoinRole = "trainer";
    } else {
      // Verify accepted friendship in either direction.
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "accepted",
          OR: [
            { userAId: uid, userBId: inviteeId },
            { userAId: inviteeId, userBId: uid },
          ],
        },
        select: { id: true },
      });
      if (!friendship) {
        return json({ error: "Can only invite trainers (if you're a trainer) or accepted friends" }, 403);
      }
      intendedJoinRole = "client";
    }

    // Upsert invite (in case a prior declined invite exists, create a new pending one).
    // We don't persist intendedJoinRole on the invite row — it's
    // re-derived at accept time using the same rules.
    const invite = await prisma.leaderboardGroupInvite.upsert({
      where: { groupId_inviteeId: { groupId, inviteeId } },
      create: { groupId, inviterId: uid, inviteeId, status: "pending" },
      update: { inviterId: uid, status: "pending" },
    });

    return json({ invite, intendedJoinRole }, 201);
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
