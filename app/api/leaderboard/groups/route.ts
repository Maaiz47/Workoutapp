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
