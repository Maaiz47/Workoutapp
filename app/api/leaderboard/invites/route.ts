import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const invites = await prisma.leaderboardGroupInvite.findMany({
      where: { inviteeId: uid, status: "pending" },
      include: {
        group: { select: { id: true, name: true, createdBy: true, members: { select: { userId: true } } } },
        inviter: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ invites });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
