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
