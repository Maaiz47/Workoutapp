import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST: Bulk set client members for this group (trainer only, replaces all their clients in the group)
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

    const { clientIds } = await req.json();
    if (!Array.isArray(clientIds)) return json({ error: "clientIds must be an array" }, 400);

    // Delete all existing clients added by this trainer
    await prisma.leaderboardGroupMember.deleteMany({
      where: { groupId, trainerId: uid, role: "client" },
    });

    // Add new clients (skip any that are already members with another role)
    for (const clientId of clientIds) {
      await prisma.leaderboardGroupMember.upsert({
        where: { groupId_userId: { groupId, userId: clientId } },
        create: { groupId, userId: clientId, role: "client", trainerId: uid, includeInRank: true },
        update: { trainerId: uid },
      });
    }

    // If the group already has a shared workout, auto-subscribe every
    // new client (activated=false until they tap APPLY).
    const groupWorkout = await (prisma as any).groupWorkout.findUnique({
      where: { groupId },
      select: { id: true },
    });
    if (groupWorkout && clientIds.length > 0) {
      await (prisma as any).groupWorkoutSubscription.createMany({
        data: clientIds.map((cid: string) => ({ userId: cid, groupWorkoutId: groupWorkout.id })),
        skipDuplicates: true,
      });
    }

    const group = await prisma.leaderboardGroup.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: { id: true, username: true } } } } },
    });

    return json({ group });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// PATCH: Toggle trainer's own includeInRank for this group
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    const membership = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: uid } },
    });
    if (!membership) return json({ error: "Not a member of this group" }, 404);

    const { includeInRank } = await req.json();
    if (typeof includeInRank !== "boolean") return json({ error: "includeInRank must be a boolean" }, 400);

    const updated = await prisma.leaderboardGroupMember.update({
      where: { groupId_userId: { groupId, userId: uid } },
      data: { includeInRank },
    });

    return json({ member: updated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
