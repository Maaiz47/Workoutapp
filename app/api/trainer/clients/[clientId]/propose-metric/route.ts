import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { sendPushToUser } from "../../../../../../lib/push";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// POST /api/trainer/clients/[clientId]/propose-metric
// Body: { weightKg?: number, bodyFatPct?: number, date?: string (ISO),
//         timeOfDay?: "morning" | "evening" }
//
// Slice 1 of the trainer-proposes-and-client-approves body-metric
// flow (qa: trainer-proposed-body-metric). Trainer-only. Creates a
// Message of type="metric_proposal" sent to the client, carrying the
// proposed body-metric data as a JSON-encoded body. The client opens
// the proposal in their messages thread, taps APPROVE or DECLINE
// (slice 2 — UI + accept endpoint), and on approval a BodyMetric row
// is created with recordedByUserId set to the trainer's id so the
// trend chart can colour-code trainer-recorded points distinctly.
//
// Per @maaiz: "Maybe trainers should be able to 'edit' the profile
// of clients just weight and body fat — can be approved by client
// before applying the new data record".
export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    // Must be a trainer with this client.
    const link = await prisma.trainerClient.findFirst({
      where: { trainerId: uid, clientId: params.clientId },
    });
    if (!link) return json({ error: "Not your client" }, 403);

    const me = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
    if (!me) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const weightKgRaw = (body as any)?.weightKg;
    const bodyFatPctRaw = (body as any)?.bodyFatPct;
    const dateRaw: unknown = (body as any)?.date;
    const todRaw: unknown = (body as any)?.timeOfDay;

    const weightKg = weightKgRaw === null || weightKgRaw === undefined || weightKgRaw === "" ? null : parseFloat(weightKgRaw);
    const bodyFatPct = bodyFatPctRaw === null || bodyFatPctRaw === undefined || bodyFatPctRaw === "" ? null : parseFloat(bodyFatPctRaw);
    if ((weightKg === null || isNaN(weightKg as any)) && (bodyFatPct === null || isNaN(bodyFatPct as any))) {
      return json({ error: "Provide at least one of weightKg / bodyFatPct" }, 400);
    }
    const date = typeof dateRaw === "string" && dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
    const timeOfDay = todRaw === "morning" || todRaw === "evening" ? todRaw : null;

    const proposal = {
      weightKg: weightKg != null && !isNaN(weightKg as any) ? weightKg : null,
      bodyFatPct: bodyFatPct != null && !isNaN(bodyFatPct as any) ? bodyFatPct : null,
      date,
      timeOfDay,
      proposedBy: uid,
      proposedAt: new Date().toISOString(),
    };

    // The Message.body carries the proposal payload as JSON so the
    // client-side accept endpoint can parse + apply it without a
    // separate proposal table. (Same pattern as the existing
    // PlanProposal flow uses planJson on a sibling relation.)
    const message = await (prisma.message as any).create({
      data: {
        fromId: uid,
        toId: params.clientId,
        body: JSON.stringify(proposal),
        type: "metric_proposal",
      },
    });

    await sendPushToUser(params.clientId, {
      title: `@${me.username} sent a body-metric proposal`,
      body: [
        proposal.weightKg != null ? `weight ${proposal.weightKg} kg` : null,
        proposal.bodyFatPct != null ? `BF ${proposal.bodyFatPct}%` : null,
      ].filter(Boolean).join(" · ") || "Tap to review",
      url: "/",
    }).catch(() => {});

    return json({ message, proposal });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
