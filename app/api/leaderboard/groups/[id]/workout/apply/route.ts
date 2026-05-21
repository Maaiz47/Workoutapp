import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST — member activates their subscription to the group's workout.
// activated=true means the group days show up in the user's home view
// AND their sessions tagged with the groupWorkoutId count for the
// filtered group leaderboard.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const membership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid },
      select: { id: true },
    });
    if (!membership) return json({ error: "Not a group member" }, 403);

    const workout = await (prisma as any).groupWorkout.findUnique({ where: { groupId: params.id } });
    if (!workout) return json({ error: "Group has no workout set" }, 404);

    // Upsert subscription (idempotent — existing rows get flipped activated=true).
    const sub = await (prisma as any).groupWorkoutSubscription.upsert({
      where: { userId_groupWorkoutId: { userId: uid, groupWorkoutId: workout.id } },
      create: { userId: uid, groupWorkoutId: workout.id, activated: true, activatedAt: new Date() },
      update: { activated: true, activatedAt: new Date() },
    });

    return json({ subscription: sub });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

// DELETE — member deactivates their subscription. We keep the row so
// past activatedAt is preserved; only the `activated` flag flips. Past
// WorkoutLogs that were tagged stay tagged (audit trail), they just
// stop counting once the user reactivates a NEW workout or the trainer
// publishes a new version.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const membership = await prisma.leaderboardGroupMember.findFirst({
      where: { groupId: params.id, userId: uid },
      select: { id: true },
    });
    if (!membership) return json({ error: "Not a group member" }, 403);

    const workout = await (prisma as any).groupWorkout.findUnique({ where: { groupId: params.id } });
    if (!workout) return json({ error: "Group has no workout set" }, 404);

    await (prisma as any).groupWorkoutSubscription.updateMany({
      where: { userId: uid, groupWorkoutId: workout.id },
      data: { activated: false },
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
