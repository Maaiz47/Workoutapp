import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tester, items } = body;

  if (!tester || typeof tester !== "string" || tester.trim().length === 0) {
    return NextResponse.json({ error: "tester name is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  await (prisma as any).qAReport.create({
    data: {
      tester: tester.trim(),
      payloadJson: JSON.stringify(body),
    },
  });

  return NextResponse.json({ ok: true });
}
