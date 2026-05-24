import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { computeStatsForUsers } from "../../../../lib/leaderboardStats";
import { TRAINER_TIERS } from "../../../../lib/tiers";

// Trainer tier label from raw client count. Matches getTrainerTier on
// the client. Used to badge groups with the trainer's rung-name —
// e.g. PRO-LED, MASTER-LED, HALL OF FAMER-LED. (qa: trainer-group-visual-identity)
function trainerTierFromClientCount(count: number): { label: string; icon: string; iconPath?: string; tierNum: number } {
  let tier = TRAINER_TIERS[0];
  for (const t of TRAINER_TIERS) if (count >= t.min) tier = t;
  return { label: tier.label, icon: tier.icon, iconPath: tier.iconPath, tierNum: tier.tierNum };
}

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
          include: { user: { select: { id: true, username: true, profile: { select: { avatarId: true } } } } }
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

    // Resolve each group creator's trainer tier (when they're a
    // trainer) so the client can render an X-LED chip with the actual
    // rung name instead of a generic COACH-LED chip. Client counts
    // come from TrainerClient; trainerTierFromClientCount maps to
    // TRAINER_TIERS. (qa: trainer-group-visual-identity)
    const creatorIds = Array.from(new Set(groups.map(g => g.createdBy)));
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, role: true, extraRoles: true },
    });
    const trainerCreatorIds = creators.filter(c => c.role === "trainer" || (c.extraRoles ?? []).includes("trainer")).map(c => c.id);
    const clientCountsByTrainer: Record<string, number> = {};
    if (trainerCreatorIds.length > 0) {
      const counts = await prisma.trainerClient.groupBy({
        by: ["trainerId"],
        where: { trainerId: { in: trainerCreatorIds } },
        _count: { clientId: true },
      });
      for (const c of counts) {
        clientCountsByTrainer[c.trainerId] = c._count.clientId;
      }
    }
    const creatorTierById: Record<string, { label: string; icon: string; tierNum: number } | null> = {};
    for (const cId of creatorIds) {
      if (trainerCreatorIds.includes(cId)) {
        creatorTierById[cId] = trainerTierFromClientCount(clientCountsByTrainer[cId] ?? 0);
      } else {
        creatorTierById[cId] = null;
      }
    }

    const result = groups.map(g => ({
      ...g,
      members: g.members.map(m => ({ ...m, stats: statsByUser.get(m.userId) ?? null })),
      creatorTier: creatorTierById[g.createdBy] ?? null,
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
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { role: true, extraRoles: true } });
    if (!user) return json({ error: "Not found" }, 404);
    const roles = [user.role, ...((user as any).extraRoles ?? [])];
    const isTrainer = roles.includes("trainer");

    const { name, privacy, memberIds } = await req.json();
    if (!name?.trim()) return json({ error: "Name required" }, 400);

    // Validate memberIds (if provided) — only accept users the
    // creator has an established relationship with:
    //   • Trainer creator + accepted TrainerClient → direct-add as
    //     a member (group-PT pattern).
    //   • Accepted Friendship in either direction → direct-add.
    // Anyone else is silently dropped from the member list — they'd
    // need to be added via the existing invite flow.
    // (qa: groups-multi-select-create)
    const requestedIds: string[] = Array.isArray(memberIds) ? memberIds.filter((x: any) => typeof x === "string" && x !== uid) : [];
    let validMemberIds: string[] = [];
    if (requestedIds.length > 0) {
      const [trainerLinks, friendships] = await Promise.all([
        isTrainer
          ? prisma.trainerClient.findMany({ where: { trainerId: uid, clientId: { in: requestedIds } }, select: { clientId: true } })
          : Promise.resolve([] as { clientId: string }[]),
        prisma.friendship.findMany({
          where: {
            status: "accepted",
            OR: [
              { userAId: uid, userBId: { in: requestedIds } },
              { userBId: uid, userAId: { in: requestedIds } },
            ],
          },
          select: { userAId: true, userBId: true },
        }),
      ]);
      const ok = new Set<string>();
      for (const t of trainerLinks) ok.add(t.clientId);
      for (const f of friendships) ok.add(f.userAId === uid ? f.userBId : f.userAId);
      validMemberIds = requestedIds.filter(id => ok.has(id));
    }

    // Gating: trainers can always create. Non-trainers can create
    // when seeding the group with at least one friend (avoids ghost
    // single-user groups from non-power users).
    if (!isTrainer && validMemberIds.length === 0) {
      return json({ error: "Trainers can create empty groups; everyone else needs to pick at least one friend to start." }, 403);
    }

    const group = await prisma.leaderboardGroup.create({
      data: {
        name: name.trim(),
        createdBy: uid,
        privacy: privacy ?? "private",
        members: {
          create: [
            { userId: uid, role: isTrainer ? "trainer" : "member", includeInRank: !isTrainer },
            ...validMemberIds.map(mId => ({ userId: mId, role: "member", includeInRank: true })),
          ],
        }
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, profile: { select: { avatarId: true } } } } } },
        invites: true,
      },
    });

    return json({ group, addedMemberCount: validMemberIds.length, droppedCount: requestedIds.length - validMemberIds.length }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
