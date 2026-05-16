import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

// GET — list requests sent by this trainer
export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const trainer = await prisma.user.findUnique({ where: { id: uid } });
  if (!trainer || trainer.role !== "trainer") return json({ error: "Trainer account required" }, 403);

  const requests = await prisma.trainerRequest.findMany({
    where: { trainerId: uid },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });

  return json({ requests });
}

// POST — send an adoption request
export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const trainer = await prisma.user.findUnique({ where: { id: uid } });
  if (!trainer || trainer.role !== "trainer") return json({ error: "Trainer account required" }, 403);

  const { targetUserId } = await req.json();
  if (!targetUserId) return json({ error: "targetUserId required" }, 400);

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { clientOf: true },
  });
  if (!target || target.role !== "user") return json({ error: "User not found" }, 404);
  if (target.clientOf) return json({ error: "User already has a trainer" }, 409);

  const existing = await prisma.trainerRequest.findUnique({
    where: { trainerId_userId: { trainerId: uid, userId: targetUserId } },
  });
  if (existing && existing.status === "pending") return json({ error: "Request already pending" }, 409);

  // Re-use existing record if previously declined; create fresh otherwise
  let request;
  if (existing) {
    request = await prisma.trainerRequest.update({
      where: { id: existing.id },
      data: { status: "pending" },
    });
  } else {
    request = await prisma.trainerRequest.create({
      data: { trainerId: uid, userId: targetUserId },
    });
  }

  return json({ request });
}
