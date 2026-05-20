import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const memberships = await prisma.leaderboardGroupMember.findMany({
      where: { userId: uid },
      select: { groupId: true },
    });
    const groupIds = memberships.map(m => m.groupId);

    const groups = await prisma.leaderboardGroup.findMany({
      where: { id: { in: groupIds } },
      include: {
        members: {
          include: { user: { select: { id: true, username: true } } }
        },
        invites: {
          where: { status: "pending" },
          include: { invitee: { select: { id: true, username: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch-compute stats for every member across all groups in a single query
    const allUserIds = Array.from(new Set(groups.flatMap(g => g.members.map(m => m.userId))));
    const statsByUser = await computeStatsForUsers(allUserIds);

    const result = groups.map(g => ({
      ...g,
      members: g.members.map(m => ({ ...m, stats: statsByUser.get(m.userId) ?? null })),
    }));

    return json({ groups: result });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
    if (!user || user.role !== "trainer") return json({ error: "Trainers only" }, 403);

    const { name, privacy } = await req.json();
    if (!name?.trim()) return json({ error: "Name required" }, 400);

    const group = await prisma.leaderboardGroup.create({
      data: {
        name: name.trim(),
        createdBy: uid,
        privacy: privacy ?? "private",
        members: {
          create: { userId: uid, role: "trainer", includeInRank: false }
        }
      },
      include: { members: true, invites: true }
    });

    return json({ group }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
