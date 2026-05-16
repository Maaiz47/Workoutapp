import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function GET(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const metrics = await prisma.bodyMetric.findMany({
      where: { userId: uid },
      orderBy: { date: "desc" },
      take: 200,
    });
    return json({ metrics });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const { weightKg, bodyFatPct, date } = await req.json();
    if (!weightKg && !bodyFatPct) return json({ error: "Provide at least one value" }, 400);

    const metric = await prisma.bodyMetric.create({
      data: {
        userId: uid,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        date: date ? new Date(date) : new Date(),
      },
    });
    return json({ metric });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
