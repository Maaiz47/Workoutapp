import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendPushToUser } from "../../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const proposal = await prisma.planProposal.findUnique({ where: { id: params.id } });
    if (!proposal) return json({ error: "Not found" }, 404);
    if (proposal.clientId !== uid) return json({ error: "Forbidden" }, 403);
    if (proposal.status !== "pending") return json({ error: "Already resolved" }, 409);

    const { action } = await req.json();
    if (action !== "accept" && action !== "decline") return json({ error: "Invalid action" }, 400);

    if (action === "accept") {
      const planData = proposal.planJson as { days: any[] };

      await prisma.$transaction(async (tx) => {
        await tx.workoutPlan.deleteMany({ where: { userId: uid } });
        await tx.workoutPlan.create({
          data: {
            userId: uid,
            days: {
              create: planData.days.map((day: any, i: number) => ({
                dayIndex: i,
                title: day.title,
                subtitle: day.subtitle ?? day.focus,
                focus: day.focus,
                exercises: {
                  create: (day.exercises ?? []).map((ex: any, j: number) => ({
                    order: j,
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest: ex.rest,
                    notes: ex.notes ?? null,
                  })),
                },
              })),
            },
          },
        });
        await tx.planProposal.update({ where: { id: params.id }, data: { status: "accepted" } });
      });

      const client = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      await sendPushToUser(proposal.trainerId, {
        title: `@${client?.username}`,
        body: "Accepted your workout plan proposal",
        url: "/",
      }).catch(() => {});
    } else {
      await prisma.planProposal.update({ where: { id: params.id }, data: { status: "declined" } });

      const client = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      await sendPushToUser(proposal.trainerId, {
        title: `@${client?.username}`,
        body: "Declined your workout plan proposal",
        url: "/",
      }).catch(() => {});
    }

    return json({ status: action === "accept" ? "accepted" : "declined" });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
