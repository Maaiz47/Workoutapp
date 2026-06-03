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

    // Build the before/after diff for the audit log. Only fields
    // explicitly present in the PATCH body count as edited — leaving
    // a field untouched should NOT show up as a no-op change.
    // (qa: body-metric-edit-history)
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    if (weightKg !== undefined) {
      before.weightKg = metric.weightKg;
      after.weightKg = weightKg ? parseFloat(weightKg) : null;
    }
    if (bodyFatPct !== undefined) {
      before.bodyFatPct = metric.bodyFatPct;
      after.bodyFatPct = bodyFatPct ? parseFloat(bodyFatPct) : null;
    }
    if (date !== undefined) {
      before.date = metric.date instanceof Date ? metric.date.toISOString() : metric.date;
      after.date = new Date(date).toISOString();
    }
    if (parsedTod !== undefined) {
      before.timeOfDay = metric.timeOfDay;
      after.timeOfDay = parsedTod;
    }

    const hasChanges = Object.keys(before).length > 0;
    const nextHistory = hasChanges
      ? [
          ...(Array.isArray((metric as any).editHistory) ? (metric as any).editHistory : []),
          { ts: new Date().toISOString(), editedByUserId: uid, before, after },
        ]
      : ((metric as any).editHistory ?? null);

    const updated = await prisma.bodyMetric.update({
      where: { id: params.id },
      data: {
        ...(weightKg !== undefined && { weightKg: weightKg ? parseFloat(weightKg) : null }),
        ...(bodyFatPct !== undefined && { bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(parsedTod !== undefined && { timeOfDay: parsedTod }),
        ...(hasChanges && { editHistory: nextHistory }),
      } as any,
    });
    return json({ metric: updated });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
