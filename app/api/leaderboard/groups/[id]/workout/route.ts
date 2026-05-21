import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — read the group's shared workout + the current user's
// subscription state. Anyone in the group can read.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const membership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid },
      select: { id: true, role: true },
    });
    if (!membership) return json({ error: "Not a group member" }, 403);

    const workout = await (prisma as any).groupWorkout.findUnique({
      where: { groupId: params.id },
      include: {
        subscriptions: { where: { userId: uid }, select: { activated: true, activatedAt: true } },
      },
    });
    if (!workout) return json({ workout: null });

    return json({
      workout: {
        id: workout.id,
        name: workout.name,
        description: workout.description,
        days: workout.days,
        createdAt: workout.createdAt,
        updatedAt: workout.updatedAt,
        mySubscription: workout.subscriptions[0] ?? null,
        isTrainer: membership.role === "trainer",
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// PUT — trainer creates or replaces the group workout. Body: { name,
// description?, days }. Auto-subscribes every current group member to
// the new workout (activated=false until they apply).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const trainerMembership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid, role: "trainer" },
    });
    if (!trainerMembership) return json({ error: "Only trainers in the group can set the workout" }, 403);

    const body = await req.json();
    const { name, description, days } = body;
    if (!name?.trim() || !Array.isArray(days) || days.length === 0) {
      return json({ error: "name and at least one day are required" }, 400);
    }

    // Upsert the single per-group workout row.
    const existing = await (prisma as any).groupWorkout.findUnique({ where: { groupId: params.id } });
    let workout;
    if (existing) {
      workout = await (prisma as any).groupWorkout.update({
        where: { groupId: params.id },
        data: { name: name.trim(), description: description?.trim() || null, days, updatedAt: new Date() },
      });
    } else {
      workout = await (prisma as any).groupWorkout.create({
        data: { groupId: params.id, name: name.trim(), description: description?.trim() || null, days, createdBy: uid },
      });
    }

    // Auto-subscribe every current group member (idempotent — skipDuplicates).
    const members = await prisma.leaderboardGroupMember.findMany({
      where: { groupId: params.id },
      select: { userId: true },
    });
    await (prisma as any).groupWorkoutSubscription.createMany({
      data: members.map(m => ({ userId: m.userId, groupWorkoutId: workout.id })),
      skipDuplicates: true,
    });

    return json({ workout });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// DELETE — trainer removes the group workout. Past WorkoutLogs keep
// their groupWorkoutId (with the FK going null via onDelete: SetNull)
// so they remain in users' history; the leaderboard filter just
// stops counting them.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const trainerMembership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid, role: "trainer" },
    });
    if (!trainerMembership) return json({ error: "Only trainers can remove the group workout" }, 403);

    await (prisma as any).groupWorkout.deleteMany({ where: { groupId: params.id } });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
