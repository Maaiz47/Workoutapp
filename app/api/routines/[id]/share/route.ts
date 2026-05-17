import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { toUsername } = await req.json();
    if (!toUsername?.trim()) return json({ error: "Username required" }, 400);

    const [sender, routine] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { username: true } }),
      prisma.savedRoutine.findUnique({ where: { id: params.id } }),
    ]);

    if (!routine || routine.userId !== uid) return json({ error: "Not found" }, 404);

    const recipient = await prisma.user.findUnique({
      where: { username: toUsername.trim().toLowerCase() },
      select: { id: true, username: true },
    });
    if (!recipient) return json({ error: "User not found" }, 404);
    if (recipient.id === uid) return json({ error: "Can't share with yourself" }, 400);

    await prisma.savedRoutine.create({
      data: {
        userId: recipient.id,
        name: routine.name,
        planJson: routine.planJson,
        sharedBy: sender?.username ?? uid,
      },
    });

    return json({ ok: true, to: recipient.username });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
