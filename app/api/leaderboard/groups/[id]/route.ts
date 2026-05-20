import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    // Check membership
    const membership = await prisma.leaderboardGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: uid } },
    });
    if (!membership) return json({ error: "Not found or not a member" }, 404);

    const group = await prisma.leaderboardGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, workoutLogs: { select: { date: true, duration: true, intensityPoints: true, sets: true }, orderBy: { date: "desc" }, take: 200 } } }
          }
        },
        invites: {
          where: { status: "pending" },
          include: { invitee: { select: { id: true, username: true } } }
        }
      },
    });

    if (!group) return json({ error: "Not found" }, 404);
    return json({ group });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    const group = await prisma.leaderboardGroup.findUnique({ where: { id: groupId } });
    if (!group) return json({ error: "Not found" }, 404);
    if (group.createdBy !== uid) return json({ error: "Only the creator can update this group" }, 403);

    const body = await req.json();
    const data: { name?: string; privacy?: string } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.privacy === "string") data.privacy = body.privacy;

    const updated = await prisma.leaderboardGroup.update({
      where: { id: groupId },
      data,
      include: { members: true, invites: true },
    });

    return json({ group: updated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const groupId = params.id;

    const group = await prisma.leaderboardGroup.findUnique({ where: { id: groupId } });
    if (!group) return json({ error: "Not found" }, 404);
    if (group.createdBy !== uid) return json({ error: "Only the creator can delete this group" }, 403);

    await prisma.leaderboardGroup.delete({ where: { id: groupId } });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
