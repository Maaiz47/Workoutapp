import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  const routines = await prisma.savedRoutine.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
  });
  return json({ routines });
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { name, days } = await req.json();
    if (!name?.trim()) return json({ error: "Name required" }, 400);
    if (!Array.isArray(days) || days.length === 0) return json({ error: "No plan days" }, 400);

    const routine = await prisma.savedRoutine.create({
      data: { userId: uid, name: name.trim(), planJson: days },
    });
    return json({ routine });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
