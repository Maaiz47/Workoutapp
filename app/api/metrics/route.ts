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
    const { weightKg, bodyFatPct, date, timeOfDay } = await req.json();
    if (!weightKg && !bodyFatPct) return json({ error: "Provide at least one value" }, 400);

    const parsedWeight = weightKg ? parseFloat(weightKg) : null;
    const parsedBf = bodyFatPct ? parseFloat(bodyFatPct) : null;
    // Whitelist timeOfDay so junk values can't end up in the DB.
    // (qa: body-metric-timeofday)
    const parsedTod = timeOfDay === "morning" || timeOfDay === "evening" ? timeOfDay : null;

    const metric = await prisma.bodyMetric.create({
      data: {
        userId: uid,
        weightKg: parsedWeight,
        bodyFatPct: parsedBf,
        date: date ? new Date(date) : new Date(),
        timeOfDay: parsedTod,
      } as any,
    });

    // Keep UserProfile current weight/bf in sync ONLY when this metric is the
    // most recent (i.e. no later metric exists). Prevents back-dated entries
    // from clobbering the user's actual current stats.
    const latest = await prisma.bodyMetric.findFirst({
      where: { userId: uid },
      orderBy: { date: "desc" },
      select: { id: true, date: true },
    });
    if (latest && latest.id === metric.id) {
      const profileUpdate: Record<string, number | null> = {};
      if (parsedWeight !== null) profileUpdate.weightKg = parsedWeight;
      if (parsedBf !== null) profileUpdate.bodyFatPct = parsedBf;
      if (Object.keys(profileUpdate).length > 0) {
        await prisma.userProfile.updateMany({ where: { userId: uid }, data: profileUpdate });
      }
    }

    return json({ metric });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, 500);
  }
}
