import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { sendPushToUser } from "../../../../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const rel = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!rel) return json({ error: "Not your client" }, 403);

    const { days } = await req.json();
    if (!Array.isArray(days) || days.length === 0) return json({ error: "Invalid plan data" }, 400);

    const trainer = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });

    const proposal = await prisma.planProposal.create({
      data: { trainerId: uid, clientId: params.clientId, planJson: { days } },
    });

    const dayCount = days.length;
    const exCount = days.reduce((t: number, d: any) => t + (d.exercises?.length ?? 0), 0);

    await prisma.message.create({
      data: {
        fromId: uid,
        toId: params.clientId,
        body: `@${trainer?.username} proposed a new ${dayCount}-day workout plan (${exCount} exercises total)`,
        type: "plan_proposal",
        proposalId: proposal.id,
      },
    });

    sendPushToUser(params.clientId, {
      title: `@${trainer?.username}`,
      body: `Proposed a new ${dayCount}-day workout plan`,
      url: "/",
    }).catch(() => {});

    return json({ proposalId: proposal.id });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
