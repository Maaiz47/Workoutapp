import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers, CLIENT_TIERS } from "../../../../lib/leaderboardStats";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

function getTier(totalSessions: number): string {
  let tier = CLIENT_TIERS[0].label;
  for (const t of CLIENT_TIERS) if (totalSessions >= t.min) tier = t.label;
  return tier;
}

// Client-facing group leaderboard. Returns each member's full stats
// (including body metrics) so the rankings UI can render the WEIGHT /
// BF LOSS / BF NOW modes without a second round-trip.
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
        members: { include: { user: { select: { id: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch-compute stats for everyone across every group in one go.
    const allUserIds = Array.from(new Set(groups.flatMap(g => g.members.map(m => m.userId))));
    const statsByUser = await computeStatsForUsers(allUserIds);

    const result = groups.map(group => {
      const rankedMembers = group.members
        .filter(m => m.includeInRank)
        .map(m => {
          const stats = statsByUser.get(m.userId);
          return {
            userId: m.userId,
            username: m.user.username,
            role: m.role,
            tier: getTier(stats?.totalSessions ?? 0),
            ...(stats ?? {}),
          };
        })
        .sort((a, b) => (b.totalSessions ?? 0) - (a.totalSessions ?? 0));

      return {
        id: group.id,
        name: group.name,
        privacy: group.privacy,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        leaderboard: rankedMembers,
      };
    });

    return json({ groups: result });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
