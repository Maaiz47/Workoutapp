import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const COOKIE = "ironlog-uid";
function json(data: object, status = 200) { return NextResponse.json(data, { status }); }

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);

  try {
    const metric = await prisma.bodyMetric.findUnique({ where: { id: params.id } });
    if (!metric || metric.userId !== uid) return json({ error: "Not found" }, 404);
    await prisma.bodyMetric.delete({ where: { id: params.id } });
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = req.cookies.get(COOKIE)?.value;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  try {
    const metric = await prisma.bodyMetric.findUnique({ where: { id: params.id } });
    if (!metric || metric.userId !== uid) return json({ error: "Not found" }, 404);
    const { weightKg, bodyFatPct, date, timeOfDay } = await req.json();
    const parsedTod = timeOfDay === "morning" || timeOfDay === "evening" ? timeOfDay
      : timeOfDay === null || timeOfDay === "" ? null
      : undefined;
    const updated = await prisma.bodyMetric.update({
      where: { id: params.id },
      data: {
        ...(weightKg !== undefined && { weightKg: weightKg ? parseFloat(weightKg) : null }),
        ...(bodyFatPct !== undefined && { bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(parsedTod !== undefined && { timeOfDay: parsedTod }),
      } as any,
    });
    return json({ metric: updated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
