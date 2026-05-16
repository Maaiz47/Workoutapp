import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

const COOKIE = "ironlog-uid";

function json(data: object, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const requests = await prisma.trainerRequest.findMany({
      where: { userId: uid, status: "pending" },
      include: { trainer: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return json({ requests });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
