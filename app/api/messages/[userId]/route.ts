import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

// GET — full conversation with a specific user, marks messages as read
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const { userId } = params;

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: uid, toId: userId },
          { fromId: userId, toId: uid },
        ],
      },
      include: { from: { select: { id: true, username: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    await prisma.message.updateMany({
      where: { fromId: userId, toId: uid, read: false },
      data: { read: true },
    });

    return json({ messages });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
