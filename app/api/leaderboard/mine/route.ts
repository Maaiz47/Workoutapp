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
        workout: {
          include: { subscriptions: { select: { userId: true, activated: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch-compute stats for everyone across every group in one go (overall).
    const allUserIds = Array.from(new Set(groups.flatMap(g => g.members.map(m => m.userId))));
    const statsByUser = await computeStatsForUsers(allUserIds);

    // Per-group filtered stats (only logs tagged with that group's workout).
    const groupFilteredStats = new Map<string, Map<string, any>>();
    for (const g of groups) {
      const gw = (g as any).workout;
      if (!gw) continue;
      const activatedUserIds = (gw.subscriptions ?? [])
        .filter((s: any) => s.activated)
        .map((s: any) => s.userId);
      if (activatedUserIds.length === 0) {
        groupFilteredStats.set(g.id, new Map());
        continue;
      }
      const filtered = await computeStatsForUsers(activatedUserIds, gw.id);
      groupFilteredStats.set(g.id, filtered);
    }

    const result = groups.map(group => {
      const gw: any = (group as any).workout;
      const filtered = groupFilteredStats.get(group.id) ?? new Map();
      const activatedSet = new Set(
        (gw?.subscriptions ?? []).filter((s: any) => s.activated).map((s: any) => s.userId)
      );

      const rankedMembers = group.members
        .filter(m => m.includeInRank)
        .map(m => {
          const stats = statsByUser.get(m.userId);
          const fStats = filtered.get(m.userId);
          return {
            userId: m.userId,
            username: m.user.username,
            role: m.role,
            tier: getTier(stats?.totalSessions ?? 0),
            ...(stats ?? {}),
            // Filtered (only sessions tagged with this group's workout).
            groupActivated: activatedSet.has(m.userId),
            groupSessions: fStats?.totalSessions ?? 0,
            groupVolume: fStats?.totalVolume ?? 0,
            groupIntensity: fStats?.totalIntensityPoints ?? 0,
            groupStreak: fStats?.streak ?? 0,
          };
        })
        .sort((a, b) => (b.totalSessions ?? 0) - (a.totalSessions ?? 0));

      return {
        id: group.id,
        name: group.name,
        privacy: group.privacy,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        workout: gw
          ? {
              id: gw.id,
              name: gw.name,
              description: gw.description,
              hasDays: Array.isArray(gw.days) && gw.days.length > 0,
              myActivated: gw.subscriptions?.some((s: any) => s.userId === uid && s.activated) ?? false,
              mySubscribed: gw.subscriptions?.some((s: any) => s.userId === uid) ?? false,
            }
          : null,
        leaderboard: rankedMembers,
      };
    });

    return json({ groups: result });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
